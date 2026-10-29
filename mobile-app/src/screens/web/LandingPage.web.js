import React, { useEffect, useState } from "react";
import MarketingShell from "./MarketingShell.web";
import LandingExperience from "./LandingExperience.web";
import DemoDialog from "./DemoDialog.web";

export default function LandingPage({
  onNavigate,
  openDemo,
  setOpenDemoOnLanding,
}) {
  const [demoOpen, setDemoOpen] = useState(false);
  useEffect(() => {
    if (openDemo) {
      setDemoOpen(true);
      setOpenDemoOnLanding?.(false);
    }
  }, [openDemo, setOpenDemoOnLanding]);
  useEffect(() => {
    const schema = document.createElement("script");
    schema.type = "application/ld+json";
    schema.id = "servon-marketing-schema";
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          name: "Servon Labs Private Limited",
          url: "https://www.servon.cloud/",
          logo: "https://www.servon.cloud/favicon.png",
        },
        {
          "@type": "WebSite",
          name: "Servon",
          url: "https://www.servon.cloud/",
        },
        {
          "@type": "SoftwareApplication",
          name: "Servon",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, Android, iOS",
          description:
            "Restaurant management with QR ordering, billing, inventory and AI insights.",
        },
      ],
    });
    document.head.appendChild(schema);
    // Retain the existing analytics property; load its script only once.
    if (!document.getElementById("servon-marketing-analytics")) {
      const analytics = document.createElement("script");
      analytics.id = "servon-marketing-analytics";
      analytics.async = true;
      analytics.src =
        "https://www.googletagmanager.com/gtag/js?id=G-2D5DS8141R";
      document.head.appendChild(analytics);
      window.dataLayer = window.dataLayer || [];
      window.gtag =
        window.gtag ||
        function () {
          window.dataLayer.push(arguments);
        };
      window.gtag("js", new Date());
      window.gtag("config", "G-2D5DS8141R");
    }
    return () => schema.remove();
  }, []);
  const book = () => setDemoOpen(true);
  return (
    <MarketingShell onNavigate={onNavigate} onBookDemo={book}>
      <LandingExperience onBookDemo={book} onNavigate={onNavigate} />
      {demoOpen && <DemoDialog onClose={() => setDemoOpen(false)} />}
    </MarketingShell>
  );
}
