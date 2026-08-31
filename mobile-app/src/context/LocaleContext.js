import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "servon.language";

const en = {
  "nav.dashboard": "Dashboard", "nav.orders": "Orders", "nav.menu": "Menu", "nav.tables": "Tables", "nav.analytics": "Analytics",
  "nav.inventory": "Inventory", "nav.staff": "Staff", "nav.rooms": "Rooms", "nav.reviews": "Reviews", "nav.referrals": "Referrals", "nav.support": "Support",
  "profile.language": "Language", "profile.languageHelp": "Choose the language used in the Servon app.", "language.english": "English", "language.marathi": "मराठी", "language.hindi": "हिन्दी",
  "common.save": "Save", "common.cancel": "Cancel", "common.delete": "Delete", "common.edit": "Edit", "common.close": "Close", "common.search": "Search", "common.loading": "Loading…", "common.error": "Something went wrong", "common.success": "Success", "common.back": "Back",
  "profile.title": "Profile", "profile.unsaved": "Unsaved", "profile.settings": "Settings",
  "status.available": "Available", "status.notAvailable": "Not Available", "status.preparing": "Preparing", "status.served": "Served", "status.paid": "Paid",
};

const mr = {
  "nav.dashboard": "डॅशबोर्ड", "nav.orders": "ऑर्डर", "nav.menu": "मेनू", "nav.tables": "टेबल", "nav.analytics": "विश्लेषण",
  "nav.inventory": "स्टॉक", "nav.staff": "कर्मचारी", "nav.rooms": "रूम", "nav.reviews": "पुनरावलोकने", "nav.referrals": "रेफरल", "nav.support": "मदत",
  "profile.language": "भाषा", "profile.languageHelp": "सर्व्हॉन अॅपची भाषा निवडा.", "language.english": "English", "language.marathi": "मराठी", "language.hindi": "हिन्दी",
  "common.save": "जतन करा", "common.cancel": "रद्द करा", "common.delete": "हटवा", "common.edit": "बदला", "common.close": "बंद करा", "common.search": "शोधा", "common.loading": "लोड होत आहे…", "common.error": "काहीतरी चूक झाली", "common.success": "यशस्वी", "common.back": "मागे",
  "profile.title": "प्रोफाइल", "profile.unsaved": "जतन केलेले नाही", "profile.settings": "सेटिंग्ज",
  "status.available": "उपलब्ध", "status.notAvailable": "उपलब्ध नाही", "status.preparing": "तयार होत आहे", "status.served": "सर्व्ह केले", "status.paid": "भरले",
};

const hi = {
  "nav.dashboard": "डैशबोर्ड", "nav.orders": "ऑर्डर", "nav.menu": "मेनू", "nav.tables": "टेबल", "nav.analytics": "एनालिटिक्स",
  "nav.inventory": "स्टॉक", "nav.staff": "स्टाफ", "nav.rooms": "रूम", "nav.reviews": "रिव्यू", "nav.referrals": "रेफरल", "nav.support": "सहायता",
  "profile.language": "भाषा", "profile.languageHelp": "सर्वॉन ऐप की भाषा चुनें।", "language.english": "English", "language.marathi": "मराठी", "language.hindi": "हिन्दी",
  "common.save": "सेव करें", "common.cancel": "रद्द करें", "common.delete": "हटाएँ", "common.edit": "बदलें", "common.close": "बंद करें", "common.search": "खोजें", "common.loading": "लोड हो रहा है…", "common.error": "कुछ गलत हो गया", "common.success": "सफल", "common.back": "वापस",
  "profile.title": "प्रोफ़ाइल", "profile.unsaved": "सेव नहीं किया", "profile.settings": "सेटिंग्स",
  "status.available": "उपलब्ध", "status.notAvailable": "उपलब्ध नहीं", "status.preparing": "तैयार हो रहा है", "status.served": "परोसा गया", "status.paid": "भुगतान किया",
};

const dictionaries = { en, mr, hi };
const LocaleContext = createContext({ language: "en", setLanguage: () => {}, t: (key) => key });

export function LocaleProvider({ children }) {
  const [language, setLanguageState] = useState("en");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const saved = Platform.OS === "web" ? window.localStorage.getItem(STORAGE_KEY) : await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && dictionaries[saved]) setLanguageState(saved);
      } finally { setReady(true); }
    })();
  }, []);
  const setLanguage = useCallback(async (next) => {
    if (!dictionaries[next]) return;
    setLanguageState(next);
    if (Platform.OS === "web") window.localStorage.setItem(STORAGE_KEY, next);
    else await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);
  const t = useCallback((key, values = {}) => {
    const template = dictionaries[language]?.[key] ?? en[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`);
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t, ready }), [language, setLanguage, t, ready]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export const useLocale = () => useContext(LocaleContext);