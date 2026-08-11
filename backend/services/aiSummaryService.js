const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── GENERATE FULL DAILY SUMMARY ──────────────────────────────────────
const generateSummary = async (data) => {
  const topItemsText = data.topItems.length > 0
    ? data.topItems.map(i => `${i.name} (${i.total_quantity} orders)`).join(', ')
    : 'No items ordered';

  const peakHoursText = data.hourlyDistribution.length > 0
    ? data.hourlyDistribution
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 3)
        .map(h => `${Math.floor(h.hour)}:00`)
        .join(', ')
    : 'No peak hours recorded';

  const prompt = `
You are a restaurant business analyst. Based on the following daily data, provide a concise summary.

**Data:**
- Date: ${data.date}
- Total Orders: ${data.totalOrders}
- Total Revenue: ₹${data.totalRevenue.toFixed(0)}
- Average Order Value: ₹${data.avgOrderValue.toFixed(0)}
- Top Items: ${topItemsText}
- Peak Hours: ${peakHoursText}

**Instructions:**
1. Write a short summary (2-3 sentences).
2. Highlight the most important metric.
3. Give 1 quick recommendation.
4. Total length: under 60 words.

**Format:** Plain text, no markdown.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful restaurant business analyst. Keep summaries very short and focused." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI daily summary error:', error);
    return `📊 ${data.totalOrders} orders, ₹${data.totalRevenue.toFixed(0)} revenue. Top: ${topItemsText}.`;
  }
};

// ─── GENERATE HOURLY INSIGHTS ──────────────────────────────────────────
const generateInsights = async (data) => {
  const topItemsText = data.topItems.length > 0
    ? data.topItems.map(i => `${i.name} (${i.total_quantity} orders)`).join(', ')
    : 'No items ordered';

  const peakHoursText = data.hourlyDistribution.length > 0
    ? data.hourlyDistribution
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 3)
        .map(h => `${Math.floor(h.hour)}:00 (${h.orders} orders)`)
        .join(', ')
    : 'No peak hours recorded';

  const prompt = `
You are a restaurant analyst. Based on the following daily data, generate 6 separate insights. 
Each insight must be a short, self-contained sentence (max 30 words). 
Return ONLY a JSON array of strings.

**Data:**
- Date: ${data.date}
- Total Orders: ${data.totalOrders}
- Total Revenue: ₹${data.totalRevenue.toFixed(0)}
- Average Order Value: ₹${data.avgOrderValue.toFixed(0)}
- Top Items: ${topItemsText}
- Peak Hours: ${peakHoursText}

**Example output:**
["Total orders reached 47, up 12% from yesterday.", "Revenue was ₹12,840, your highest Tuesday so far.", "Butter Chicken was the top seller with 12 orders, 3x more than the next item.", "Peak hour was 8 PM with 15 orders, accounting for 32% of daily sales.", "Average order value is ₹273 – adding a dessert upsell could boost it by 15%.", "Lunch traffic is low – consider a 'combo deal' to attract more midday customers."]
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful restaurant analyst. Always output a valid JSON array." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    const jsonStr = response.choices[0].message.content.trim();
    const cleaned = jsonStr.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('OpenAI hourly insights error:', error);
    return [
      `Total orders: ${data.totalOrders}`,
      `Revenue: ₹${data.totalRevenue.toFixed(0)}`,
      `Top item: ${data.topItems[0]?.name || 'No items'}`,
      `Average order value: ₹${data.avgOrderValue.toFixed(0)}`,
      `Peak hour: ${peakHoursText.split(',')[0] || 'No peak'}`,
      `Keep up the great work!`
    ];
  }
};

// ─── GENERATE HOURLY BUSINESS BRIEF (AI Business Summary feature) ────────────
const generateHourlyBrief = async (metrics) => {
  const today = metrics.today || {};
  const yesterday = metrics.yesterday || {};
  const topItems = today.topItems || [];
  const bottomItems = today.bottomItems || [];
  const peakHours = today.peakHours || [];
  const reviews = today.reviews || {};
  const lowStock = today.lowStockItems || [];
  const trend = metrics.trend || [];

  const topItemsText = topItems.length > 0
    ? topItems.map(i => `${i.name} (${i.total_quantity})`).join(', ')
    : 'No items ordered yet';

  const slowItemsText = bottomItems.length > 0
    ? bottomItems.map(i => `${i.name} (${i.total_quantity})`).join(', ')
    : 'N/A';

  const peakHoursText = peakHours.length > 0
    ? peakHours.slice(0, 3).map(h => `${h.hour}:00 (${h.orders} orders)`).join(', ')
    : 'No peak hours yet';

  const trendText = trend.length > 0
    ? trend.map(d => `${d.date}: ${d.orders} orders / ₹${d.revenue.toFixed(0)}`).join('; ')
    : 'No trend data';

  const prompt = `
You are a restaurant business analyst. Based on the following real-time metrics, generate a concise hourly business brief.
Return ONLY a valid JSON object (no markdown, no code fences) with EXACTLY these string fields:
- "revenue": short string under ~20 words
- "profit": short string under ~20 words
- "orders": short string under ~20 words
- "avgOrderValue": short string under ~20 words
- "bestSeller": short string under ~20 words
- "needsAttention": short string under ~20 words
- "peakHours": short string under ~20 words
- "customerFeedback": short string under ~20 words
- "recommendations": array of 1-3 short strings
- "todaysFocus": short string under ~20 words

**Metrics:**
- Today: ${today.totalOrders || 0} orders, ₹${(today.totalRevenue || 0).toFixed(0)} revenue, ₹${(today.avgOrderValue || 0).toFixed(0)} avg order value.
- Profit: ₹${(today.profit || 0).toFixed(0)} (revenue ₹${(today.totalRevenue || 0).toFixed(0)} - expenses ₹${(today.totalExpenses || 0).toFixed(0)}).
- Cancellations: ${today.cancelledOrders || 0}.
- Top items: ${topItemsText}.
- Slow-moving items: ${slowItemsText}.
- Peak hours: ${peakHoursText}.
- Reviews: ${reviews.totalRating || 0} total, avg ${(reviews.avgRating || 0).toFixed(1)}, ${reviews.positiveCount || 0} positive, ${reviews.negativeCount || 0} negative.
- Low stock: ${lowStock.length > 0 ? lowStock.map(i => i.name).join(', ') : 'None'}.
- Yesterday (same time): ${yesterday.totalOrders || 0} orders, ₹${(yesterday.totalRevenue || 0).toFixed(0)} revenue.
- 7-day trend: ${trendText}.

**Context:** This is an AI business summary shown to the restaurant owner. Keep every field short, actionable, and under ~20 words. Use the day-over-day and 7-day trend context to make the "todaysFocus" recommendation smart.
`;

  const fallbackJson = {
    revenue: `₹${(today.totalRevenue || 0).toFixed(0)} so far today`,
    profit: `₹${(today.profit || 0).toFixed(0)} estimated profit today`,
    orders: `${today.totalOrders || 0} orders so far today`,
    avgOrderValue: `₹${(today.avgOrderValue || 0).toFixed(0)} average order value`,
    bestSeller: topItems[0] ? `${topItems[0].name} (${topItems[0].total_quantity})` : 'No items yet',
    needsAttention: slowItemsText !== 'N/A' ? `Slow sellers: ${slowItemsText}` : 'Nothing critical yet',
    peakHours: peakHoursText,
    customerFeedback: reviews.totalRating > 0
      ? `${reviews.totalRating} reviews, avg ${(reviews.avgRating || 0).toFixed(1)}`
      : 'No reviews yet today',
    recommendations: [
      topItems[0] ? `Push ${topItems[0].name} — it\'s your top seller.` : 'Start promoting your menu.',
      lowStock.length > 0 ? `Restock: ${lowStock.slice(0, 3).map(i => i.name).join(', ')}.` : 'Stock levels are healthy.',
    ],
    todaysFocus: yesterday.totalRevenue > 0
      ? `Revenue is ${today.totalRevenue >= yesterday.totalRevenue ? 'up' : 'behind'} vs yesterday same time.`
      : 'Build momentum for the rest of the day.',
  };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful restaurant business analyst. Always output valid JSON without markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    let jsonStr = response.choices[0].message.content.trim();
    // Strip any ```json ... ``` fences if the model adds them
    jsonStr = jsonStr.replace(/```json|```/g, '').trim();

    const parsed = JSON.parse(jsonStr);

    // Ensure recommendations is always an array
    if (!Array.isArray(parsed.recommendations)) {
      parsed.recommendations = parsed.recommendations ? [String(parsed.recommendations)] : fallbackJson.recommendations;
    }

    const plainText = `📊 ${today.totalOrders || 0} orders, ₹${(today.totalRevenue || 0).toFixed(0)} revenue. ${parsed.todaysFocus || ''}`;

    return { json: parsed, text: plainText };
  } catch (error) {
    console.error('OpenAI hourly brief error:', error);
    const plainText = `📊 ${today.totalOrders || 0} orders, ₹${(today.totalRevenue || 0).toFixed(0)} revenue. ${fallbackJson.todaysFocus || ''}`;
    return { json: fallbackJson, text: plainText };
  }
};

module.exports = { generateSummary, generateInsights, generateHourlyBrief };
