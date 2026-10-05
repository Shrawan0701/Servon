const OpenAI = require("openai");

let openai = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

function cleanTranslation(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseJson(content) {
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function translateMenuItemName(englishName) {
  const source = cleanTranslation(englishName);
  if (!source || !process.env.OPENAI_API_KEY) {
    return { name_mr: null, name_hi: null };
  }

  try {
    const client = getOpenAIClient();
    if (!client) return { name_mr: null, name_hi: null };

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 180,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You translate Indian restaurant menu item names. Return only strict JSON with keys name_mr and name_hi. Use natural Marathi and natural Hindi food-menu wording. Preserve brand names, proper nouns, numbers, sizes, and quantities. Keep widely recognized food names natural instead of awkward literal translations.",
        },
        {
          role: "user",
          content: `Translate this menu item name from English into Marathi and Hindi: "${source}"`,
        },
      ],
    });

    const parsed = parseJson(response.choices?.[0]?.message?.content);
    return {
      name_mr: cleanTranslation(parsed?.name_mr),
      name_hi: cleanTranslation(parsed?.name_hi),
    };
  } catch (error) {
    console.error("Menu translation failed:", error.message);
    return { name_mr: null, name_hi: null };
  }
}

module.exports = {
  translateMenuItemName,
};
