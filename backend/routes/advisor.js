// routes/advisor.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { askAdvisor, generateInsights } = require('../services/advisorService');

// ─── ASK A QUESTION ──────────────────────────────────────────────────
router.post('/ask', auth, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || question.trim().length < 3) {
      return res.status(400).json({ error: 'Please ask a valid question.' });
    }

    const businessId = req.businessId;
    const result = await askAdvisor(businessId, question);

    // Save conversation
    const insertResult = await pool.query(
      `INSERT INTO advisor_conversations (business_id, question, answer, context_data, tokens_used)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [businessId, question, result.answer, {}, result.tokensUsed]
    );

    res.json({
      success: true,
      id: insertResult.rows[0].id,
      question,
      answer: result.answer,
      tokensUsed: result.tokensUsed,
    });
  } catch (err) {
    console.error('Ask advisor error:', err);
    res.status(500).json({ error: 'Failed to get advisor response.' });
  }
});

// ─── GET INSIGHTS (Proactive) ──────────────────────────────────────
router.get('/insights', auth, async (req, res) => {
  try {
    const businessId = req.businessId;

    // Check if we have recent insights (less than 6 hours old)
    const existing = await pool.query(
      `SELECT * FROM advisor_insights 
       WHERE business_id = $1 
         AND created_at > NOW() - INTERVAL '6 hours'
       ORDER BY priority DESC
       LIMIT 5`,
      [businessId]
    );

    if (existing.rows.length > 0) {
      return res.json({ insights: existing.rows });
    }

    // Generate fresh insights
    const insights = await generateInsights(businessId);

    // Save insights
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
    res.status(500).json({ error: 'Failed to generate insights.' });
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