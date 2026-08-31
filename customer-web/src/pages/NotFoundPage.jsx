import { LanguageSelector, useLocale } from "../context/LocaleContext";
export default function NotFoundPage() { 
const { t } = useLocale();
return ( 
<div style={{ textAlign: "center", padding: "100px 24px" }}> 
<div style={{ fontSize: 64 }}>🍽</div> 
<div style={{ display: "flex", justifyContent: "flex-end" }}><LanguageSelector /></div>
<h2 style={{ marginTop: 16 }}>{t("invalidQr")}</h2> 
<p style={{ color: "#666" }}>{t("invalidLink")}</p> 
</div> 
); 
}
