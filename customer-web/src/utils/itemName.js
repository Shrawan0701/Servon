const LIQUOR_NAME_FALLBACKS = {
  mr: {
    "tuborg strong": "ट्युबॉर्ग स्ट्रॉंग",
    tuborg: "ट्युबॉर्ग",
    "tuborg classic": "ट्युबॉर्ग क्लासिक",
    kingfisher: "किंगफिशर",
    "kingfisher ultra": "किंगफिशर अल्ट्रा",
    "carlsberg beer": "कार्ल्सबर्ग बीअर",
    "heineken beer": "हेनेकेन बीअर",
    budweiser: "बडवायझर",
    "godfather beer": "गॉडफादर बीअर",
    "london beer": "लंडन बीअर",
    breezer: "ब्रीझर",
    "royal stag": "रॉयल स्टॅग",
    "royal stag double": "रॉयल स्टॅग डबल",
    "royal green": "रॉयल ग्रीन",
    signature: "सिग्नेचर",
    "imperial blue": "इम्पीरियल ब्लू",
    "mcdowell's rum": "मॅकडॉवेल्स रम",
    "mcdowell's": "मॅकडॉवेल्स",
    "mcdowell's platinum": "मॅकडॉवेल्स प्लॅटिनम",
    b7: "बी७",
    "dsp black": "डीएसपी ब्लॅक",
    goa: "गोवा",
    "grand masters": "ग्रँड मास्टर्स",
    "iconiq white": "आयकॉनिक व्हाईट",
    "royal challenge": "रॉयल चॅलेंज",
    "oaksmith silver": "ओक्समिथ सिल्व्हर",
    "oaksmith gold": "ओक्समिथ गोल्ड",
    oaken: "ओकेन",
    antiquity: "अँटिक्विटी",
    "green label": "ग्रीन लेबल",
    "officer's choice": "ऑफिसर्स चॉईस",
    jameson: "जेम्सन",
    "black dog": "ब्लॅक डॉग",
    teachers: "टीचर्स",
    "black & white": "ब्लॅक अँड व्हाईट",
    "vat 69": "व्हॅट ६९",
    "ballantine's": "बॅलेंटाईन्स",
    haywards: "हेवर्ड्स",
    "haywards 2000": "हेवर्ड्स २०००",
    "masters delight": "मास्टर्स डिलाइट",
    "classic gold": "क्लासिक गोल्ड",
    "brown man": "ब्राउन मॅन",
    "premium whisky": "प्रीमियम व्हिस्की",
    "barrel whisky": "बॅरल व्हिस्की",
    "x-treme whisky": "एक्स्ट्रीम व्हिस्की",
    empire: "एम्पायर",
    "blenders reserve": "ब्लेंडर्स रिझर्व्ह",
    "after dark": "आफ्टर डार्क",
    "amber whisky": "अंबर व्हिस्की",
    "vulcan blue": "व्हल्कन ब्लू",
    "alpha bull": "अल्फा बुल",
    "kalani white": "कलानी व्हाईट",
    "bullet rum": "बुलेट रम",
    "old monk": "ओल्ड मॉन्क",
    "dark old rum": "डार्क ओल्ड रम",
    "gold medal rum": "गोल्ड मेडल रम",
    "mad rum": "मॅड रम",
    "blak bacardi": "ब्लॅक बकार्डी",
    smirnoff: "स्मिरनॉफ",
    vodka: "व्होडका",
    xclamation: "एक्सक्लेमेशन",
    "xclamation vodka": "एक्सक्लेमेशन व्होडका",
    "silver kastle vodka": "सिल्व्हर कॅसल व्होडका",
    "gold medal vodka": "गोल्ड मेडल व्होडका",
    "shaky vodka jamun": "शेकी व्होडका जांभूळ",
    "smirnoff jamun": "स्मिरनॉफ जांभूळ",
    bombay: "बॉम्बे",
    "bombay quarter": "बॉम्बे क्वार्टर",
    "lemon duet gin": "लेमन ड्युएट जिन",
    "knight fox gin": "नाईट फॉक्स जिन",
    "doctor brandy": "डॉक्टर ब्रँडी",
    "let's go cranberry": "लेट्स गो क्रॅनबेरी",
    "bacardi limon": "बकार्डी लिमोन",
    "magic moments": "मॅजिक मोमेंट्स",
    "magik moments": "मॅजिक मोमेंट्स",
    "magic moment": "मॅजिक मोमेंट",
  },
  hi: {
    "tuborg strong": "ट्यूबॉर्ग स्ट्रॉन्ग",
    tuborg: "ट्यूबॉर्ग",
    "tuborg classic": "ट्यूबॉर्ग क्लासिक",
    kingfisher: "किंगफिशर",
    "kingfisher ultra": "किंगफिशर अल्ट्रा",
    "carlsberg beer": "कार्ल्सबर्ग बीयर",
    "heineken beer": "हेनेकेन बीयर",
    budweiser: "बडवायजर",
    "godfather beer": "गॉडफादर बीयर",
    "london beer": "लंदन बीयर",
    breezer: "ब्रीजर",
    "royal stag": "रॉयल स्टैग",
    "royal stag double": "रॉयल स्टैग डबल",
    "royal green": "रॉयल ग्रीन",
    signature: "सिग्नेचर",
    "imperial blue": "इंपीरियल ब्लू",
    "mcdowell's rum": "मैकडॉवेल्स रम",
    "mcdowell's": "मैकडॉवेल्स",
    "mcdowell's platinum": "मैकडॉवेल्स प्लेटिनम",
    b7: "बी७",
    "dsp black": "डीएसपी ब्लैक",
    goa: "गोवा",
    "grand masters": "ग्रैंड मास्टर्स",
    "iconiq white": "आइकोनिक व्हाइट",
    "royal challenge": "रॉयल चैलेंज",
    "oaksmith silver": "ओक्समिथ सिल्वर",
    "oaksmith gold": "ओक्समिथ गोल्ड",
    oaken: "ओकेन",
    antiquity: "एंटीक्विटी",
    "green label": "ग्रीन लेबल",
    "officer's choice": "ऑफिसर्स चॉइस",
    jameson: "जेम्सन",
    "black dog": "ब्लैक डॉग",
    teachers: "टीचर्स",
    "black & white": "ब्लैक एंड व्हाइट",
    "vat 69": "वेट 69",
    "ballantine's": "बैलेंटाइन्स",
    haywards: "हेवर्ड्स",
    "haywards 2000": "हेवर्ड्स 2000",
    "masters delight": "मास्टर्स डिलाइट",
    "classic gold": "क्लासिक गोल्ड",
    "brown man": "ब्राउन मैन",
    "premium whisky": "प्रीमियम व्हिस्की",
    "barrel whisky": "बैरल व्हिस्की",
    "x-treme whisky": "एक्सट्रीम व्हिस्की",
    empire: "एम्पायर",
    "blenders reserve": "ब्लेंडर्स रिजर्व",
    "after dark": "आफ्टर डार्क",
    "amber whisky": "अंबर व्हिस्की",
    "vulcan blue": "वल्कन ब्लू",
    "alpha bull": "अल्फा बुल",
    "kalani white": "कलानी व्हाइट",
    "bullet rum": "बुलेट रम",
    "old monk": "ओल्ड मॉन्क",
    "dark old rum": "डार्क ओल्ड रम",
    "gold medal rum": "गोल्ड मेडल रम",
    "mad rum": "मैड रम",
    "blak bacardi": "ब्लैक बकार्डी",
    smirnoff: "स्मिरनॉफ",
    vodka: "वोडका",
    xclamation: "एक्सक्लेमेशन",
    "xclamation vodka": "एक्सक्लेमेशन वोडका",
    "silver kastle vodka": "सिल्वर कास्टल वोडका",
    "gold medal vodka": "गोल्ड मेडल वोडका",
    "shaky vodka jamun": "शेकी वोडका जामुन",
    "smirnoff jamun": "स्मिरनॉफ जामुन",
    bombay: "बॉम्बे",
    "bombay quarter": "बॉम्बे क्वार्टर",
    "lemon duet gin": "लेमन डुएट जिन",
    "knight fox gin": "नाइट फॉक्स जिन",
    "doctor brandy": "डॉक्टर ब्रांडी",
    "let's go cranberry": "लेट्स गो क्रैनबेरी",
    "bacardi limon": "बकार्डी लिमोन",
    "magic moments": "मैजिक मोमेंट्स",
    "magik moments": "मैजिक मोमेंट्स",
    "magic moment": "मैजिक मोमेंट",
  },
};

function fallbackLiquorName(item, lang) {
  if (!item || item.menu_type !== "liquor" || lang === "en") return null;
  const source = String(item.name || "").trim();
  if (!source) return null;
  const sizeMatch = source.match(/\s+(\d+(?:\.\d+)?)\s*ml$/i);
  const baseName = sizeMatch ? source.slice(0, sizeMatch.index).trim() : source;
  const normalized = baseName.toLowerCase().replace(/\s+/g, " ");
  const translated = LIQUOR_NAME_FALLBACKS[lang]?.[normalized];
  if (!translated) return null;
  return sizeMatch ? `${translated} ${sizeMatch[1]} ML` : translated;
}

// Resolves the display name of a menu item for a given Servon locale code
// (en | mr | hi). Item names are stored as `name` (the default/English name)
// plus optional `name_mr` and `name_hi`. Falls back to the default name when
// translation is unavailable, so existing/legacy items never break.
export function localizedItemName(item, language) {
  if (!item) return "";
  const lang = language === "mr" ? "mr" : language === "hi" ? "hi" : "en";
  const liquorFallback = fallbackLiquorName(item, lang);
  const storedLocalized = lang === "mr" ? item.name_mr : lang === "hi" ? item.name_hi : null;
  const hasUsefulStoredLocalized = storedLocalized && String(storedLocalized).trim().toLowerCase() !== String(item.name || "").trim().toLowerCase();
  const name = hasUsefulStoredLocalized
    ? storedLocalized
    : lang === "mr" && item.name_mr && !liquorFallback
    ? item.name_mr
    : lang === "hi" && item.name_hi && !liquorFallback
      ? item.name_hi
      : liquorFallback || item.name || item.name_mr || item.name_hi || "";
  if (item.menu_type === "liquor" && item.size_ml && !/\d+(?:\.\d+)?\s*ml$/i.test(String(name))) {
    return `${name} ${Number(item.size_ml)} ML`;
  }
  return name;
}
