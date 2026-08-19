const OpenAI = require('openai');
const { collectAdvisorData } = require('../utils/advisorData');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate an AI response to a business question – Consultant-style, actionable guidance
 */
const askAdvisor = async (businessId, question, selectedLanguage = null) => {
  const q = question.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
  const responseLanguage = { en: 'English', hi: 'Hindi', mr: 'Marathi' }[selectedLanguage] || null;

  // 1. Dynamic Multilingual Greeting Guard
  const englishGreetings = ["hi", "hello", "hey", "yo", "good morning", "good afternoon", "greetings"];
  const hindiGreetings = ["namaste", "namaskar", "hello sir", "hello mam", "ram ram"];
  const marathiGreetings = ["namaskar", "jay hari", "ram ram mam", "ram ram sir"];

  if (!responseLanguage && englishGreetings.includes(q)) {
    return {
      answer: "Hey there! Great to see you. I'm your AI Business Advisor. Ask me anything about your restaurant's sales, menu pricing, operating costs, or general restaurant industry strategies, and let's scale your business together!",
      tokensUsed: 0,
    };
  }
  
  if (!responseLanguage && (hindiGreetings.includes(q) || q.includes("kaise ho") || q.includes("kaise hain"))) {
    return {
      answer: "Namaste! Aapka swagat hai. Main aapka AI Business Advisor hoon. Aap apne restaurant ke sales, menu, pricing ya general restaurant trends ke baare mein kuch bhi pooch sakte hain. Bataiye, aaj kaise help karu?",
      tokensUsed: 0,
    };
  }

  if (!responseLanguage && (marathiGreetings.includes(q) || q.includes("kase ahat") || q.includes("kasa aahe"))) {
    return {
      answer: "Namaskar! Tumche swagat aahe. Me tumcha AI Business Advisor aahe. Tumhi tumchya hotel chya sales, menu, ani generic industry updates baddal kahihi vicharu shakta. Sanga, aaj business kasa vadhvaycha?",
      tokensUsed: 0,
    };
  }
  
  // 2. Collect business data
  const data = await collectAdvisorData(businessId, '30 days');

  // 3. Build context-aware prompt
  const prompt = `
You are Servon's AI Business Advisor. Your goal is to provide high-quality, non-repetitive advice to a restaurant owner.

INTENT DETECTION RULE:
Evaluate the owner's question carefully. 
- If the question is about broader restaurant business concepts, the general food industry, macro economics, general strategy, or general advice (e.g., "how can you increase sales", "how does a restaurant manage supply chain", "what are global food trends"), do NOT get trapped discussing only their specific 30-day dashboard numbers. Answer with rich, creative, professional industry strategies.
- If the question is specifically asking about their own metrics (e.g., "what are my sales", "analyze my data"), look closely at the live data block below to customize your answer.

LIVE BUSINESS DATA (Use if specific data analysis is requested):
Period: Last 30 days
Total Orders: ${data.summary.totalOrders}
Total Revenue: Rs.${data.summary.totalRevenue.toFixed(0)}
Average Order Value: Rs.${data.summary.avgOrderValue.toFixed(0)}
Tables Used: ${data.summary.tablesUsed}

TOP SELLING ITEMS:
${data.topItems.map((item, i) => `${i + 1}. ${item.name} | Orders: ${item.total_quantity} | Revenue: Rs.${parseFloat(item.total_revenue).toFixed(0)}`).join('\n')}

PEAK HOURS:
${data.peakHours.slice(0,5).map(h => `${Math.floor(h.hour)}:00 — ${h.orders} orders`).join('\n')}

CUSTOMER REVIEWS:
Total Reviews: ${data.reviews.total_reviews} | Rating: ${Number(data.reviews.avg_rating||0).toFixed(1)} | Positive: ${data.reviews.positive} | Negative: ${data.reviews.negative}

OWNER'S QUESTION:
"${question}"

CRITICAL REPETITION BAN:
Avoid regurgitating the exact same standard templates (like only mentioning customer feedback, peak hour staffing, menu diversification, or basic marketing) if the question allows for deeper business logic. Be creative, analytical, and diverse in your tactical suggestions.

CRITICAL OUTPUT INSTRUCTIONS:
- Voice response language is ${responseLanguage || 'automatically detected from the owner question'}. ${responseLanguage ? `Respond entirely in ${responseLanguage}; do not switch languages. This is spoken audio, so use casual spoken ${responseLanguage} like a normal person talking, not formal or textbook ${responseLanguage} — the same style you'd use chatting with a friend, keeping common business terms in English.` : ''}
- Default language is professional English. If the question is in English, you must respond in English.
- If the question is in Roman Hindi / Hinglish, respond completely in Roman Hindi / Hinglish.
- If the question is in Roman Marathi, respond completely in Roman Marathi.
- Do not use markdown format. No asterisks, no headers. Plain text sentences only. Use standard numbers (1, 2, 3) for itemization.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: `You are Servon's AI Business Advisor, an expert restaurant consultant.

CRITICAL DIRECTIVE: You must dynamically detect the language of the owner's text and perfectly mirror it.

VOICE LANGUAGE OVERRIDE: ${responseLanguage ? `This is a voice request that will be read aloud by text-to-speech. Respond entirely in ${responseLanguage}, even if the transcribed question uses another language. Speak the way a real restaurant owner casually talks to a friend or staff member — simple, everyday, spoken ${responseLanguage}, not formal, literary, or Sanskritized/shuddh ${responseLanguage} and not newsreader-style phrasing. Keep common business words in English exactly as Indian restaurant owners naturally say them (sales, profit, order, menu, customer, table, discount, offer, staff, revenue), and keep sentences short like real speech.` : 'No voice language was selected; detect the owner language normally.'}

1. ENGLISH DETECTION: If the question is in English (e.g., "What's my analytics till today", "how to increase sales", or "Can you answer in english"), you MUST respond entirely in professional English.
2. HINGLISH DETECTION: If the question is in Roman Hindi / Hinglish (e.g., "sales kaise badhau"), respond completely in Roman Hindi / Hinglish text.
3. MARATHI DETECTION: If the question is in Roman Marathi (e.g., "sales kashe wadhvu"), respond completely in Roman Marathi text.

STYLE SAFETY RULES:
- Never use markdown syntax. No bold markers (**), no headers (#), no bullet asterisks (*). 
- Write the response as clean plain text. Use standard digits (1, 2, 3) for itemization.
- Provide practical, creative, non-repetitive consultant-level steps.` 
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.6, // Bumping temperature up to allow creative, diverse industry strategies
      max_tokens: 600,
    });

    return {
      answer: response.choices[0].message.content.trim(),
      tokensUsed: response.usage?.total_tokens || 0,
    };
  } catch (error) {
    console.error('OpenAI askAdvisor error:', error);
    return {
      answer: "I'm having trouble analysing your data right now. Please try again in a moment.",
      tokensUsed: 0,
    };
  }
};

/**
 * Generate proactive insights (for the dashboard) – using OpenAI JSON output
 */
const generateInsights = async (businessId) => {
  const data = await collectAdvisorData(businessId, '30 days');

  const prompt = `
You are Servon's AI Business Advisor, a top-tier restaurant management consultant.
Identify highly positive business opportunities based on live data. 

STRICT TITLING RULES:
Do NOT use negative words such as: "Low", "Poor", "Weak", "No", "Zero", "Bad", "Declining", "Failure", "Problem", "Lack".
Use only constructive, growth-focused titles.

BUSINESS DATA:
Period: Last 30 days
Total Orders: ${data.summary.totalOrders}
Total Revenue: Rs.${data.summary.totalRevenue.toFixed(0)}
Average Order Value: Rs.${data.summary.avgOrderValue.toFixed(0)}

OUTPUT FORMAT (JSON ARRAY ONLY, NO MARKDOWN ENVELOPE):
[
  {
    "title": "Title of the Opportunity",
    "description": "Consultant-style analysis citing actual numbers from the live data above explaining the opportunity.",
    "priority": 3,
    "action": "One concrete, practical step to implement this week."
  }
]
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are Servon's senior restaurant consultant. You analyze metrics and produce output exclusively in valid, raw JSON arrays without markdown wrappers." 
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 600,
    });

    const jsonStr = response.choices[0].message.content.trim();
    const cleaned = jsonStr.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('OpenAI insights generation error:', error);
    return [
      {
        title: "Menu Optimisation Opportunity",
        description: "Focus on highlighting and featuring top-performing items to drive overall customer ticket averages.",
        priority: 3,
        action: "Create a feature section on the menu for items with high order volume."
      }
    ];
  }
};

module.exports = { askAdvisor, generateInsights };
