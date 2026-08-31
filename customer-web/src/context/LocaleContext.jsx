import { createContext, useCallback, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "servon.customer.language";
const en = {
  language: "Language", english: "English", marathi: "मराठी", hindi: "हिन्दी", all: "All", table: "Table", thali: "Thali", showLess: "Show less", more: "+{count} more",
  invalidQr: "Invalid QR Code", invalidQrHelp: "Please scan a valid Servon menu link.", menuLoadFailed: "Failed to load menu. Please try again.", items: "{count} item", itemsPlural: "{count} items", viewCart: "View Cart · ₹{total} →",
  cartEmpty: "Your cart is empty", goBackMenu: "Go Back to Menu", yourCart: "Your Cart", each: "₹{price} each", specialInstructions: "Special Instructions", instructionsPlaceholder: "E.g. No onions, extra spicy…", billSummary: "Bill Summary", subtotal: "Subtotal", grandTotal: "Grand Total", paymentNotice: "Confirm your order and pay on billing counter", placingOrder: "Placing Order…", confirmOrder: "Confirm Order · ₹{total}", orderFailed: "Failed to place order. Please try again.",
  orderPlaced: "Order Placed!", orderSent: "Your order has been sent to the kitchen. The restaurant will start preparing it shortly.", editWindow: "Edit window closes in", editOrder: "Edit Order", editHelp: "Go back to menu to modify your order", preparing: "🔥 Order is now being prepared!", orderId: "Order ID: {id}", orderMore: "Order More Items",
  feedbackThanks: "Thank you!", feedbackHelp: "Your feedback helps us improve.", mealQuestion: "How was your meal?", yourOrder: "Your Order", comments: "Any specific comments?", commentsPlaceholder: "Tell us what you loved, or what we can improve…", submitting: "Submitting…", submitFeedback: "Submit Feedback", ratingNeeded: "Please select a star rating!", feedbackFailed: "Failed to submit feedback. Please try again.", invalidLink: "This link doesn't seem to be a valid Servon menu link.",
  voiceOrder: "Voice Order", tapMic: "Tap the mic and say your order", listening: "Listening…", understanding: "Understanding…", speakAgain: "Speak Again", pickOne: "Which one did you mean?", notFound: "couldn't be found on the menu", unavailableNote: "Some items are currently unavailable and have been removed from your order", removeItem: "Remove", micUnsupported: "Voice ordering isn't supported on this browser.",
};
const mr = {
  language: "भाषा", english: "English", marathi: "मराठी", hindi: "हिन्दी", all: "सर्व", table: "टेबल", thali: "थाळी", showLess: "कमी दाखवा", more: "+{count} अधिक",
  invalidQr: "अवैध QR कोड", invalidQrHelp: "कृपया वैध सर्व्हॉन मेनू लिंक स्कॅन करा.", menuLoadFailed: "मेनू लोड झाला नाही. पुन्हा प्रयत्न करा.", items: "{count} पदार्थ", itemsPlural: "{count} पदार्थ", viewCart: "कार्ट पहा · ₹{total} →",
  cartEmpty: "तुमची कार्ट रिकामी आहे", goBackMenu: "मेनूकडे परत जा", yourCart: "तुमची कार्ट", each: "₹{price} प्रत्येक", specialInstructions: "विशेष सूचना", instructionsPlaceholder: "उदा. कांदा नको, जास्त तिखट…", billSummary: "बिल सारांश", subtotal: "उपएकूण", grandTotal: "एकूण रक्कम", paymentNotice: "ऑर्डर निश्चित करा आणि बिलिंग काउंटरवर पैसे भरा", placingOrder: "ऑर्डर होत आहे…", confirmOrder: "ऑर्डर निश्चित करा · ₹{total}", orderFailed: "ऑर्डर झाली नाही. पुन्हा प्रयत्न करा.",
  orderPlaced: "ऑर्डर झाली!", orderSent: "तुमची ऑर्डर स्वयंपाकघरात पाठवली आहे. लवकरच तयार केली जाईल.", editWindow: "ऑर्डर बदलण्याची वेळ", editOrder: "ऑर्डर बदला", editHelp: "ऑर्डर बदलण्यासाठी मेनूकडे परत जा", preparing: "🔥 ऑर्डर तयार होत आहे!", orderId: "ऑर्डर आयडी: {id}", orderMore: "आणखी पदार्थ मागवा",
  feedbackThanks: "धन्यवाद!", feedbackHelp: "तुमचा अभिप्राय आम्हाला सुधारण्यास मदत करतो.", mealQuestion: "जेवण कसे होते?", yourOrder: "तुमची ऑर्डर", comments: "काही विशेष सूचना?", commentsPlaceholder: "तुम्हाला काय आवडले किंवा काय सुधारता येईल ते सांगा…", submitting: "पाठवत आहे…", submitFeedback: "अभिप्राय पाठवा", ratingNeeded: "कृपया स्टार रेटिंग निवडा!", feedbackFailed: "अभिप्राय पाठवता आला नाही. पुन्हा प्रयत्न करा.", invalidLink: "ही वैध सर्व्हॉन मेनू लिंक दिसत नाही.",
  voiceOrder:"व्हॉइस ऑर्डर", tapMic:"मायक टॅप करा आणि तुमची ऑर्डर सांगा", listening:"ऐकत आहे…", understanding:"समजून घेत आहे…", speakAgain:"पुन्हा बोला", pickOne:"तुमचा अर्थ कोणता होता?", notFound:"मेनूमध्ये सापडले नाही", unavailableNote:"काही पदार्थ सध्या उपलब्ध नाहीत आणि तुमच्या ऑर्डरमधून काढले आहेत", removeItem:"काढा", micUnsupported:"या ब्राउझरमध्ये व्हॉइस ऑर्डर समर्थित नाही",
};
const hi = {
  language: "भाषा", english: "English", marathi: "मराठी", hindi: "हिन्दी", all: "सभी", table: "टेबल", thali: "थाली", showLess: "कम दिखाएँ", more: "+{count} और",
  invalidQr: "अमान्य QR कोड", invalidQrHelp: "कृपया मान्य सर्वॉन मेनू लिंक स्कैन करें।", menuLoadFailed: "मेनू लोड नहीं हुआ। फिर से कोशिश करें।", items: "{count} आइटम", itemsPlural: "{count} आइटम", viewCart: "कार्ट देखें · ₹{total} →",
  cartEmpty: "आपकी कार्ट खाली है", goBackMenu: "मेनू पर वापस जाएँ", yourCart: "आपकी कार्ट", each: "₹{price} प्रत्येक", specialInstructions: "विशेष निर्देश", instructionsPlaceholder: "जैसे: प्याज नहीं, ज्यादा तीखा…", billSummary: "बिल सारांश", subtotal: "उप-योग", grandTotal: "कुल राशि", paymentNotice: "ऑर्डर पक्का करें और बिलिंग काउंटर पर भुगतान करें", placingOrder: "ऑर्डर किया जा रहा है…", confirmOrder: "ऑर्डर पक्का करें · ₹{total}", orderFailed: "ऑर्डर नहीं हो पाया। फिर से कोशिश करें।",
  orderPlaced: "ऑर्डर हो गया!", orderSent: "आपका ऑर्डर रसोई में भेज दिया गया है। इसे जल्द तैयार किया जाएगा।", editWindow: "ऑर्डर बदलने का समय", editOrder: "ऑर्डर बदलें", editHelp: "ऑर्डर बदलने के लिए मेनू पर वापस जाएँ", preparing: "🔥 ऑर्डर तैयार हो रहा है!", orderId: "ऑर्डर आईडी: {id}", orderMore: "और आइटम ऑर्डर करें",
  feedbackThanks: "धन्यवाद!", feedbackHelp: "आपकी राय हमें बेहतर बनाने में मदद करती है।", mealQuestion: "आपका भोजन कैसा था?", yourOrder: "आपका ऑर्डर", comments: "कोई खास सुझाव?", commentsPlaceholder: "बताइए आपको क्या अच्छा लगा या क्या बेहतर हो सकता है…", submitting: "भेजा जा रहा है…", submitFeedback: "राय भेजें", ratingNeeded: "कृपया स्टार रेटिंग चुनें!", feedbackFailed: "राय भेजी नहीं जा सकी। फिर से कोशिश करें।", invalidLink: "यह मान्य सर्वॉन मेनू लिंक नहीं लगती।",
voiceOrder:"वॉइस ऑर्डर", tapMic:"माइक थपें और अपना ऑर्डर बोलें", listening:"सुन रहा है…", understanding:"समझ रहा है…", speakAgain:"फिर बोलें", pickOne:"आपका मतलब कौन सा था?", notFound:"मेनू में नहीं मिला", unavailableNote:"कुछ आइटम अभी उपलब्ध नहीं हैं और आपके ऑर्डर से हटा दिए गए हैं", removeItem:"हटाएँ", micUnsupported:"इस ब्राउज़र में वॉइस ऑर्डर समर्थित नहीं है",
};
const dictionaries = { en, mr, hi };
const LocaleContext = createContext(null);
export function LocaleProvider({ children }) {
  const [language, setLanguageState] = useState(() => localStorage.getItem(STORAGE_KEY) || "en");
  const setLanguage = useCallback((next) => { if (dictionaries[next]) { localStorage.setItem(STORAGE_KEY, next); setLanguageState(next); } }, []);
  const t = useCallback((key, values = {}) => (dictionaries[language]?.[key] ?? en[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`), [language]);
  return <LocaleContext.Provider value={useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])}>{children}</LocaleContext.Provider>;
}
export const useLocale = () => useContext(LocaleContext);

export function LanguageSelector() {
  const { language, setLanguage, t } = useLocale();
  return <div aria-label={t("language")} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
    {[['en', t('english')], ['mr', t('marathi')], ['hi', t('hindi')]].map(([code, label]) => <button key={code} onClick={() => setLanguage(code)} style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 7px", background: language === code ? "#111" : "#fff", color: language === code ? "#fff" : "#111", cursor: "pointer" }}>{label}</button>)}
  </div>;
}
