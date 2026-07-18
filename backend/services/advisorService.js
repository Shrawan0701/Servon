const OpenAI = require('openai');
const { collectAdvisorData } = require('../utils/advisorData');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate an AI response to a business question – Consultant-style, actionable guidance
 */
const askAdvisor = async (businessId, question) => {
  const q = question.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");

  // 1. Dynamic Multilingual Greeting Guard
  const englishGreetings = ["hi", "hello", "hey", "yo", "good morning", "good afternoon", "greetings"];
  const hindiGreetings = ["namaste", "namaskar", "hello sir", "hello mam", "ram ram"];
  const marathiGreetings = ["namaskar", "jay hari", "ram ram mam", "ram ram sir"];

  if (englishGreetings.includes(q)) {
    return {
      answer: "Hey there! Great to see you. I'm your AI Business Advisor. Ask me anything about your restaurant's sales, menu pricing, operating costs, or customer metrics, and let's scale your business together!",
      tokensUsed: 0,
    };
  }
  
  if (hindiGreetings.includes(q) || q.includes("kaise ho") || q.includes("kaise hain")) {
    return {
      answer: "Namaste! Aapka swagat hai. Main aapka AI Business Advisor hoon. Aap apne restaurant ke sales, menu, pricing ya customers ke baare mein kuch bhi pooch sakte hain. Bataiye, aaj business kaise badhana hai?",
      tokensUsed: 0,
    };
  }

  if (marathiGreetings.includes(q) || q.includes("kase ahat") || q.includes("kasa aahe")) {
    return {
      answer: "Namaskar! Tumche swagat aahe. Me tumcha AI Business Advisor aahe. Tumhi tumchya hotel chya sales, menu, ani customer metrics baddal kahihi vicharu shakta. Sanga, aaj business kasa vadhvaycha?",
      tokensUsed: 0,
    };
  }
  
  // 2. Collect business data
  const data = await collectAdvisorData(businessId, '30 days');
  const orderedTrend = [...data.dailyTrend].slice(0, 7).reverse();

  // 3. Build context-aware prompt
  const prompt = `
You are Servon's AI Business Advisor.
Analyze this live data block and directly answer the owner's question.

BUSINESS DATA:
Period: Last 30 days
Total Orders: ${data.summary.totalOrders}
Total Revenue: Rs.${data.summary.totalRevenue.toFixed(0)}
Average Order Value: Rs.${data.summary.avgOrderValue.toFixed(0)}
Tables Used: ${data.summary.tablesUsed}

TOP SELLING ITEMS:
${data.topItems.map((item, i) => `${i + 1}. ${item.name} | Orders: ${item.total_quantity} | Revenue: Rs.${parseFloat(item.total_revenue).toFixed(0)}`).join('\n')}

PEAK HOURS:
${data.peakHours.slice(0,5).map(h => `${Math.floor(h.hour)}:00 — ${h.orders} orders`).join('\n')}

WEEKDAY PERFORMANCE:
${data.weekdayPattern.map(d => {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return `${days[d.day_of_week]} — ${d.orders} orders, Rs.${parseFloat(d.revenue).toFixed(0)}`;
}).join('\n')}

CUSTOMER REVIEWS:
Total Reviews: ${data.reviews.total_reviews} | Rating: ${Number(data.reviews.avg_rating||0).toFixed(1)} | Positive: ${data.reviews.positive} | Negative: ${data.reviews.negative}

OWNER'S REAL TIME QUESTION:
"${question}"

CRITICAL OUTPUT INSTRUCTIONS:
- You must match the owner's text style.
- If the question is in Roman Hindi / Hinglish (e.g., "sales kaise badhau"), your response must be 100% written in Roman Hindi / Hinglish.
- If the question is in Roman Marathi (e.g., "sales kashe wadhvu"), your response must be 100% written in Roman Marathi.
- Provide 2 to 4 actionable steps.
- Do not use markdown format. No asterisks, no headers. Plain text sentences only.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: `You are Servon's AI Business Advisor, an expert restaurant consultant.

CRITICAL DIRECTIVE: You will look at the owner's question and perfectly match its writing language and script style. 

- QUESTION: "hotel ka revenue kaise badhau" -> This is Roman Hindi / Hinglish. You MUST respond completely in Roman Hindi / Hinglish text. Do not use Devanagari script. Do not use English text.
- QUESTION: "hotel cha sales kashe wadhvu" -> This is Roman Marathi. You MUST respond completely in Roman Marathi text. Do not use Devanagari script. Do not use English text.

STYLE SAFETY RULES:
1. Never use markdown language syntax. No bold markers (**), no headers (#), no bullet asterisks (*). 
2. Write response as clear plain text using standard digits (1, 2, 3) for itemization.
3. Be friendly, motivating, and highly practical.` 
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2, 
      max_tokens: 500,
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
  const orderedTrend = [...data.dailyTrend].slice(0, 7).reverse();

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
      temperature: 0.3,
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