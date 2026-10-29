import React, { useEffect, useRef, useState } from "react";
import MarketingShell, { SiteLink } from "./MarketingShell.web";
import { MarkIcon } from "./MarketingTheme.web";
import { publicPath, publicScreen } from "./publicRoutes";

const pageInfo = {
  about: ["OUR STORY", "leaf", "About Servon"],
  features: ["THE PRODUCT", "layers", "Product"],
  pricing: ["FIND YOUR FIT", "receipt", "Pricing"],
  contact: ["LET’S TALK", "mail", "Contact"],
  faq: ["GOOD QUESTIONS", "spark", "Common questions"],
  careers: ["BUILD WITH US", "spark", "Careers"],
  partners: ["GROW TOGETHER", "layers", "Partners"],
  security: ["TRUST & CONTROL", "shield", "Security"],
  privacypolicy: ["TRUST & LEGAL", "shield", "Privacy policy"],
  termsofservice: ["TRUST & LEGAL", "receipt", "Terms of service"],
  refundpolicy: ["TRUST & LEGAL", "receipt", "Refund policy"],
};

export function WebPageLayout({ title, subtitle, children, onNavigate }) {
  const activePage = publicScreen(window.location.pathname);
  const [eyebrow, icon, breadcrumb] = pageInfo[activePage] || [
    "SERVON",
    "layers",
    title,
  ];
  const documentPage = [
    "privacypolicy",
    "termsofservice",
    "refundpolicy",
  ].includes(activePage);
  const content = useRef(null);
  const [headings, setHeadings] = useState([]);
  useEffect(() => {
    if (!documentPage) return;
    const nodes = Array.from(
      content.current.querySelectorAll('[role="heading"]'),
    );
    setHeadings(
      nodes.map((node, index) => {
        node.id = `sv-document-section-${index + 1}`;
        return { id: node.id, text: node.textContent };
      }),
    );
  }, [documentPage, title]);
  return (
    <MarketingShell
      onNavigate={onNavigate}
      activePage={activePage}
      title={`${title} — Servon`}
      description={subtitle}
      path={publicPath(activePage)}
    >
      <main id="sv-main" tabIndex={-1}>
        <div className="sv-page-hero">
          <div className="sv-wrap">
            <div className="sv-breadcrumb">
              <SiteLink to="landing" onNavigate={onNavigate}>
                Home
              </SiteLink>
              <MarkIcon name="chevron" size={11} />
              <span>{breadcrumb}</span>
            </div>
            <div className="sv-page-hero-row">
              <div>
                <span className="sv-eyebrow">
                  <span className="sv-dot" />
                  {eyebrow}
                </span>
                <h1>{title}</h1>
                {subtitle && <p>{subtitle}</p>}
              </div>
              <div className="sv-page-symbol" aria-hidden="true">
                <MarkIcon name={icon} />
              </div>
            </div>
          </div>
        </div>
        <div
          className={`sv-wrap sv-page-body ${documentPage ? "sv-document-layout" : ""}`}
        >
          {documentPage && (
            <nav className="sv-document-toc" aria-label="On this page">
              <span className="sv-eyebrow">IN THIS DOCUMENT</span>
              {headings.map((heading) => (
                <a href={`#${heading.id}`} key={heading.id}>
                  {heading.text}
                </a>
              ))}
              <a href="mailto:support@servon.cloud">
                Questions? Get in touch ↗
              </a>
            </nav>
          )}
          <div
            ref={content}
            className={documentPage ? "sv-document-content" : "sv-page-content"}
          >
            {children}
          </div>
        </div>
      </main>
    </MarketingShell>
  );
}
