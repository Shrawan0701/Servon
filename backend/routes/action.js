const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const OpenAI = require("openai");
const { toFile } = require("openai");
const { resolveVoiceAction } = require("../services/servonActionService");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── UNIFIED SERVON VOICE ASSISTANT ──────────────────────────────────
// One microphone, one AI/voice infrastructure. The same endpoint understands
// whether the staff is talking about an ORDER or a ROOM operation, then
// resolves the request against this business's authoritative data. Nothing
// is written to the database here — the frontend shows a confirmation first.
router.post("/voice", auth, async (req, res) => {
  try {
    const audio = req.files?.audio;

    if (!audio || Array.isArray(audio) || !audio.data?.length) {
      return res.status(400).json({
        success: false,
        error: "A short audio recording is required.",
        intent: null,
      });
    }

    if (
      !audio.mimetype?.startsWith("audio/") &&
      audio.mimetype !== "video/webm"
    ) {
      return res.status(400).json({
        success: false,
        error: "Please upload a valid audio recording.",
        intent: null,
      });
    }

    // Transcribe with the same OpenAI model used by the Advisor. The
    // language is intentionally left to the model so English, Hindi and
    // Marathi (and mixed speech) are handled automatically.
    const transcription = await openai.audio.transcriptions.create({
      file: await toFile(audio.data, audio.name || "servon-voice.webm", {
        type: audio.mimetype || "audio/webm",
      }),
      model: "gpt-4o-mini-transcribe",
      prompt:
        "Restaurant and hotel staff dictating food orders and room guest details. Hindi, Marathi and English are common.",
    });

    const transcript = transcription.text?.trim();
    if (!transcript) {
      return res.json({
        success: false,
        transcript: "",
        error: "I couldn't understand the request clearly. Please try again.",
        intent: null,
      });
    }

    const result = await resolveVoiceAction(transcript, req.businessId);
    return res.json(result);
  } catch (err) {
    console.error("Servon unified voice action error:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message || "Unable to process the voice request.",
      intent: null,
    });
  }
});

module.exports = router;