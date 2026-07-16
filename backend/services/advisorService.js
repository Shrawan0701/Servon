const OpenAI = require('openai');
const { collectAdvisorData } = require('../utils/advisorData');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate an AI response to a business question – Consultant-style, actionable guidance
 */
const askAdvisor = async (businessId, question) => {
  // 1. Collect business data
  const data = await collectAdvisorData(businessId, '30 days');

  // Reverse so the trend reads oldest -> newest (most recent day last)
  const orderedTrend = [...data.dailyTrend].slice(0, 7).reverse();

  // 2. Build the prompt with context – now with a strong consultant persona
  const prompt = `
You are a trusted restaurant business consultant with 20 years of experience. Your client (the restaurant owner) has asked you a question. You always give practical, step‑by‑step advice that they can implement immediately.

**BUSINESS DATA:**
- Period: Last 30 days
- Total Orders: ${data.summary.totalOrders}
- Total Revenue: ₹${data.summary.totalRevenue.toFixed(0)}
- Average Order Value: ₹${data.summary.avgOrderValue.toFixed(0)}
- Tables Used: ${data.summary.tablesUsed}

**TOP ITEMS:**
${data.topItems.map((item, i) => `${i+1}. ${item.name} - ${item.total_quantity} orders, ₹${parseFloat(item.total_revenue).toFixed(0)} revenue`).join('\n')}

**PEAK HOURS:**
${data.peakHours.slice(0, 5).map(h => `${Math.floor(h.hour)}:00 - ${h.orders} orders`).join('\n')}

**WEEKDAY PATTERNS:**
${data.weekdayPattern.map(d => {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return `${days[parseInt(d.day_of_week)]}: ${d.orders} orders, ₹${parseFloat(d.revenue).toFixed(0)} revenue`;
}).join('\n')}

**REVIEWS:**
- Total: ${data.reviews.total_reviews}
- Average Rating: ${Number(data.reviews.avg_rating || 0).toFixed(1)}/5
- Positive: ${data.reviews.positive}, Negative: ${data.reviews.negative}

**RECENT DAILY TREND (oldest to most recent):**
${orderedTrend.map(d => `${d.date}: ${d.orders} orders, ₹${parseFloat(d.revenue).toFixed(0)}`).join('\n')}

**USER QUESTION:** ${question}

**INSTRUCTIONS:**
1. Start with a warm, human response.
2. Give 2-3 numbered, actionable recommendations – use '1.', '2.', '3.' (no bullet symbols like '*' or '-').
3. Each numbered point should be a clear action with a specific number from the data.
4. End with a single encouraging sentence.
5. Total length: under 200 words.
6. IMPORTANT: Do NOT use any markdown or formatting symbols like '*', '-', '_', or '**'. Do not bold or italicize any text. Use ONLY plain text and numbers. For example, write "1. Optimize your menu" instead of "1. **Optimize your menu**".

**ANSWER:**
`;

  // 3. Call OpenAI
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are a warm, experienced restaurant consultant. Your answers are concise, actionable, and backed by the data. Always give numbered steps and a clear first priority. Never repeat the question – just answer directly. Absolutely never use markdown symbols like **, *, -, or _. Output plain text only." 
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
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
Based on the following restaurant data, identify 3 key insights and actionable recommendations.

**BUSINESS DATA:**
- Total Orders: ${data.summary.totalOrders}
- Total Revenue: ₹${data.summary.totalRevenue.toFixed(0)}
- Average Order Value: ₹${data.summary.avgOrderValue.toFixed(0)}
- Tables Used: ${data.summary.tablesUsed}

**TOP ITEMS:**
${data.topItems.map((item, i) => `${i+1}. ${item.name} - ${item.total_quantity} orders, ₹${parseFloat(item.total_revenue).toFixed(0)} revenue`).join('\n')}

**PEAK HOURS:**
${data.peakHours.slice(0, 5).map(h => `${Math.floor(h.hour)}:00 - ${h.orders} orders`).join('\n')}

**WEEKDAY PATTERNS:**
${data.weekdayPattern.map(d => {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return `${days[parseInt(d.day_of_week)]}: ${d.orders} orders, ₹${parseFloat(d.revenue).toFixed(0)} revenue`;
}).join('\n')}

**REVIEWS:**
- Total: ${data.reviews.total_reviews}
- Average Rating: ${Number(data.reviews.avg_rating || 0).toFixed(1)}/5
- Positive: ${data.reviews.positive}, Negative: ${data.reviews.negative}

**RECENT DAILY TREND (oldest to most recent):**
${orderedTrend.map(d => `${d.date}: ${d.orders} orders, ₹${parseFloat(d.revenue).toFixed(0)}`).join('\n')}

**OUTPUT FORMAT (JSON only, no markdown, no preamble):**
[
  {
    "title": "Short insight title (max 6 words)",
    "description": "One or two sentences, with a specific number or % from the data above.",
    "priority": 0-2,
    "action": "One specific, concrete action to take"
  }
]
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a restaurant business analyst. Output valid JSON only — no markdown fences, no commentary. Every insight must cite a real number from the data provided." },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 500,
    });

    const jsonStr = response.choices[0].message.content.trim();
    const cleaned = jsonStr.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('OpenAI insights generation error:', error);
    return [
      {
        title: "Review your top items",
        description: "Focus on your best-sellers to maximise revenue.",
        priority: 1,
        action: "Review menu pricing and availability for top items."
      }
    ];
  }
};

module.exports = { askAdvisor, generateInsights };