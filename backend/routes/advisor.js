const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { askAdvisor, generateInsights } = require('../services/advisorService');
const OpenAI = require('openai');
const { toFile } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const saveConversation = async (businessId, question, result) => {
  const insertResult = await pool.query(
    `INSERT INTO advisor_conversations (business_id, question, answer, context_data, tokens_used)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [businessId, question, result.answer, {}, result.tokensUsed]
  );
  return insertResult.rows[0].id;
};

// ─── ASK A QUESTION ──────────────────────────────────────────────────
router.post('/ask', auth, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      console.log(req.body);
      return res.status(400).json({ error: "Question missing" });
    }

    console.log("Question:", question);

    const businessId = req.businessId;
    const result = await askAdvisor(businessId, question);

    // Save conversation
    const id = await saveConversation(businessId, question, result);

    res.json({
      success: true,
      id,
      question,
      answer: result.answer,
      tokensUsed: result.tokensUsed,
    });
  } catch (err) {
    console.error('Ask advisor error:', err);
    res.status(500).json({ error: 'Failed to get advisor response.' });
  }
});

// VOICE ADVISOR: audio upload -> transcription -> existing advisor -> spoken reply.
// Audio is kept in memory only and is never written to disk by this endpoint.
router.post('/voice', auth, async (req, res) => {
  try {
    console.log("========== VOICE ADVISOR REQUEST ==========");
    console.log("Business ID:", req.businessId);

    console.log("req.files:", req.files);

    const audio = req.files?.audio;

    console.log("audio exists:", !!audio);

    if (audio) {
      console.log("audio.name:", audio.name);
      console.log("audio.mimetype:", audio.mimetype);
      console.log("audio.size:", audio.size);
      console.log("audio.data length:", audio.data?.length);
    }

    if (!audio || Array.isArray(audio) || !audio.data?.length) {
      console.log("❌ No valid audio uploaded.");
      return res.status(400).json({
        error: "A short audio recording is required.",
      });
    }

    if (
      !audio.mimetype?.startsWith("audio/") &&
      audio.mimetype !== "video/webm"
    ) {
      console.log("❌ Invalid mimetype:", audio.mimetype);
      return res.status(400).json({
        error: "Please upload a valid audio recording.",
      });
    }

    console.log("🎤 Starting transcription...");

    const transcription = await openai.audio.transcriptions.create({
      file: await toFile(audio.data, audio.name || "voice-question.webm", {
        type: audio.mimetype || "audio/webm",
      }),
      model: "gpt-4o-mini-transcribe",
      prompt:
        "Restaurant orders, sales, revenue, menu, customers, pricing, and Servon business metrics.",
    });

    console.log("✅ Transcription:", transcription);

    const question = transcription.text?.trim();

    console.log("Question:", question);

    if (!question) {
      return res.status(422).json({
        error: "I could not understand that recording. Please try again.",
      });
    }

    console.log("🤖 Asking advisor...");

    const result = await askAdvisor(req.businessId, question);

    console.log("✅ Advisor response generated.");

    const id = await saveConversation(req.businessId, question, result);

    console.log("🔊 Generating speech...");

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      input: result.answer.slice(0, 4096),
      response_format: "mp3",
      instructions:
        "Speak clearly, warmly, and confidently as a restaurant business advisor.",
    });

    console.log("✅ Speech generated.");

    const audioBase64 = Buffer.from(
      await speech.arrayBuffer()
    ).toString("base64");

    console.log("✅ Returning response.");

    console.log("Base64 length:", audioBase64.length);
console.log("Sending response to client...");

    res.json({
      success: true,
      id,
      transcript: question,
      question,
      answer: result.answer,
      tokensUsed: result.tokensUsed,
      audio: `data:audio/mpeg;base64,${audioBase64}`,
    });
  } catch (err) {
    console.error("========== VOICE ADVISOR ERROR ==========");

    console.error("Message:", err.message);
    console.error("Name:", err.name);

    if (err.status) {
      console.error("Status:", err.status);
    }

    if (err.code) {
      console.error("Code:", err.code);
    }

    if (err.response) {
      console.error("Response Status:", err.response.status);
      console.error("Response Data:", err.response.data);
    }

    if (err.error) {
      console.error("Error Object:", err.error);
    }

    console.error("Full Error:");
    console.error(err);

    console.error("Stack:");
    console.error(err.stack);

    return res.status(500).json({
      error: err.message || "Unable to process the voice question.",
    });
  }
});

// ─── GET INSIGHTS (Proactive) ──────────────────────────────────────
router.get('/insights', auth, async (req, res) => {
  try {
    const businessId = req.businessId;

    // To ensure insights are live, we clear older generated insights 
    // for this business before saving and serving the fresh ones.
    await pool.query(
      `DELETE FROM advisor_insights WHERE business_id = $1`,
      [businessId]
    );

    // Generate fresh, positive insights based on live stats
    const insights = await generateInsights(businessId);

    // Save fresh insights
    for (const insight of insights) {
      await pool.query(
        `INSERT INTO advisor_insights 
         (business_id, insight_type, title, description, priority, is_actionable, action_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [businessId, 'general', insight.title, insight.description, insight.priority, true, insight.action]
      );
    }

    // Return saved insights
    const result = await pool.query(
      `SELECT * FROM advisor_insights 
       WHERE business_id = $1 
       ORDER BY priority DESC, created_at DESC
       LIMIT 5`,
      [businessId]
    );

    res.json({ insights: result.rows });
  } catch (err) {
    console.error('Insights error:', err);
    res.status(500).json({ error: 'Failed to generate live insights.' });
  }
});

// ─── GET CONVERSATION HISTORY ──────────────────────────────────────
router.get('/conversations', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, question, answer, created_at
       FROM advisor_conversations
       WHERE business_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.businessId]
    );
    res.json({ conversations: result.rows });
  } catch (err) {
    console.error('Conversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations.' });
  }
});

// ─── DELETE SINGLE CONVERSATION ──────────────────────────────────────
router.delete('/conversations/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.businessId;

    const result = await pool.query(
      `DELETE FROM advisor_conversations 
       WHERE id = $1 AND business_id = $2
       RETURNING id`,
      [id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (err) {
    console.error('Delete conversation error:', err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// ─── DELETE ALL CONVERSATIONS ──────────────────────────────────────
router.delete('/conversations', auth, async (req, res) => {
  try {
    const businessId = req.businessId;

    await pool.query(
      `DELETE FROM advisor_conversations WHERE business_id = $1`,
      [businessId]
    );

    res.json({ success: true, message: 'All conversations cleared' });
  } catch (err) {
    console.error('Clear conversations error:', err);
    res.status(500).json({ error: 'Failed to clear conversations' });
  }
});

module.exports = router;
