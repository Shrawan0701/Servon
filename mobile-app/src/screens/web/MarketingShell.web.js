import React, { useEffect, useRef, useState } from "react";
import { MarkIcon, marketingCSS } from "./MarketingTheme.web";
import { publicPath } from "./publicRoutes";
import { editionCSS } from "./MarketingEdition.web";

export function SiteLink({ to, onNavigate, children, onClick, ...props }) {
  return (
    <a
      href={publicPath(to)}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        onClick?.();
        onNavigate?.(to);
        event.currentTarget.closest(".sv-site")?.scrollTo({ top: 0, left: 0 });
      }}
      {...props}
    >
      {children}
    </a>
  );
}

export function MarketingHeader({ onNavigate, onBookDemo, activePage }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggle = useRef(null);
  useEffect(() => {
    setMenuOpen(false);
  }, [activePage]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuToggle.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);
  const navigation = [
    ["features", "Product"],
    ["pricing", "Pricing"],
    ["about", "Company"],
    ["contact", "Contact"],
  ];
  const links = navigation.map(([to, label]) => (
    <SiteLink
      key={to}
      to={to}
      onNavigate={onNavigate}
      onClick={() => setMenuOpen(false)}
      aria-current={activePage === to ? "page" : undefined}
    >
      {label}
    </SiteLink>
  ));
  return (
    <header className="sv-nav">
      <div className="sv-wrap sv-nav-inner">
        <SiteLink
          to="landing"
          onNavigate={onNavigate}
          className="sv-brand"
          aria-label="Servon home"
        >
          Servon
          <span className="sv-brand-dot" />
        </SiteLink>
        <nav className="sv-nav-links" aria-label="Main navigation">
          {links}
        </nav>
        <div className="sv-nav-actions">
          <SiteLink to="login" onNavigate={onNavigate}>
            Log in
          </SiteLink>
          <button className="sv-button" onClick={onBookDemo}>
            Book a demo <MarkIcon size={15} />
          </button>
          <button
            className="sv-menu-button"
            ref={menuToggle}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="sv-mobile-nav"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <MarkIcon name={menuOpen ? "close" : "menu"} />
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav
          className="sv-mobile-menu"
          id="sv-mobile-nav"
          aria-label="Mobile navigation"
        >
          {links}
          <button
            className="sv-button"
            onClick={() => {
              setMenuOpen(false);
              onBookDemo();
            }}
          >
            Book a demo <MarkIcon size={15} />
          </button>
        </nav>
      )}
    </header>
  );
}

export function MarketingFooter({ onNavigate }) {
  const groups = [
    [
      "Product",
      [
        ["features", "Features"],
        ["pricing", "Pricing"],
        ["faq", "FAQ"],
      ],
    ],
    [
      "Company",
      [
        ["about", "About Servon"],
        ["careers", "Careers"],
        ["partners", "Partner with us"],
        ["contact", "Contact"],
      ],
    ],
    [
      "Trust & legal",
      [
        ["privacypolicy", "Privacy policy"],
        ["termsofservice", "Terms of service"],
        ["refundpolicy", "Refund policy"],
        ["security", "Security"],
      ],
    ],
  ];
  return (
    <footer className="sv-footer">
      <div className="sv-wrap">
        <div className="sv-footer-main">
          <div className="sv-footer-brand">
            <SiteLink
              to="landing"
              onNavigate={onNavigate}
              className="sv-brand"
              aria-label="Servon home"
            >
              Servon
              <span className="sv-brand-dot" />
            </SiteLink>
            <p>
              Restaurant management software for ordering, kitchen operations,
              inventory and business reporting.
            </p>
            <a href="mailto:support@servon.cloud">
              support@servon.cloud <span aria-hidden="true">↗</span>
            </a>
          </div>
          {groups.map(([title, links]) => (
            <div key={title}>
              <h3>{title}</h3>
              <nav className="sv-footer-col" aria-label={title}>
                {links.map(([to, label]) => (
                  <SiteLink key={to} to={to} onNavigate={onNavigate}>
                    {label}
                  </SiteLink>
                ))}
              </nav>
            </div>
          ))}
        </div>
        <div className="sv-footer-bottom">
          <span>
            © {new Date().getFullYear()} Servon Labs Private Limited.
          </span>
          <span className="sv-footer-location">
            <span className="sv-dot" /> Pune, India
          </span>
        </div>
      </div>
      <div className="sv-footer-wordmark" aria-hidden="true">
        Servon.
      </div>
    </footer>
  );
}

export function MarketingMeta({
  title = "Servon | Restaurant management, inventory & billing",
  description = "Bring QR ordering, kitchen operations, inventory and AI insights together with Servon. Restaurant management software built for Indian hospitality.",
  path = "/",
}) {
  useEffect(() => {
    document.title = title;
    const touched = [];
    const set = (selector, tag, attributes) => {
      let node = document.head.querySelector(selector);
      const created = !node;
      if (!node) {
        node = document.createElement(tag);
        document.head.appendChild(node);
      }
      const previous = {};
      Object.keys(attributes).forEach((key) => {
        previous[key] = node.getAttribute(key);
        node.setAttribute(key, attributes[key]);
      });
      touched.push(() => {
        if (created) node.remove();
        else
          Object.entries(previous).forEach(([key, value]) =>
            value === null
              ? node.removeAttribute(key)
              : node.setAttribute(key, value),
          );
      });
    };
    set('meta[name="description"]', "meta", {
      name: "description",
      content: description,
    });
    set('link[rel="canonical"]', "link", {
      rel: "canonical",
      href: `https://www.servon.cloud${path}`,
    });
    set('meta[property="og:title"]', "meta", {
      property: "og:title",
      content: title,
    });
    set('meta[property="og:description"]', "meta", {
      property: "og:description",
      content: description,
    });
    set('meta[property="og:url"]', "meta", {
      property: "og:url",
      content: `https://www.servon.cloud${path}`,
    });
    set('meta[property="og:site_name"]', "meta", {
      property: "og:site_name",
      content: "Servon",
    });
    set('meta[property="og:type"]', "meta", {
      property: "og:type",
      content: "website",
    });
    set('meta[property="og:image"]', "meta", {
      property: "og:image",
      content: "https://www.servon.cloud/favicon.png",
    });
    set('meta[name="twitter:card"]', "meta", {
      name: "twitter:card",
      content: "summary_large_image",
    });
    set('meta[name="twitter:title"]', "meta", {
      name: "twitter:title",
      content: title,
    });
    set('meta[name="twitter:description"]', "meta", {
      name: "twitter:description",
      content: description,
    });
    set('meta[name="twitter:image"]', "meta", {
      name: "twitter:image",
      content: "https://www.servon.cloud/favicon.png",
    });
    return () => touched.forEach((restore) => restore());
  }, [title, description, path]);
  return null;
}

export default function MarketingShell({
  onNavigate,
  onBookDemo,
  activePage = "landing",
  children,
  title,
  description,
  path,
}) {
  const bookDemo =
    onBookDemo || (() => onNavigate("landing", { openDemo: true }));
  return (
    <div className="sv-site sv-edition">
      <style>{marketingCSS}</style>
      <style>{editionCSS}</style>
      <MarketingMeta title={title} description={description} path={path} />
      <a href="#sv-main" className="sv-skip">
        Skip to content
      </a>
      <MarketingHeader
        onNavigate={onNavigate}
        onBookDemo={bookDemo}
        activePage={activePage}
      />
      {children}
      <MarketingFooter onNavigate={onNavigate} />
    </div>
  );
}
