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

module.exports = { generateSummary, generateInsights };