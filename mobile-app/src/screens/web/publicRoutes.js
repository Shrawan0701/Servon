const paths = {
  landing: "/",
  login: "/login",
  signup: "/signup",
  admin: "/admin",
  features: "/features",
  pricing: "/pricing",
  about: "/about",
  contact: "/contact",
  faq: "/faq",
  careers: "/careers",
  partners: "/partners",
  security: "/security",
  privacypolicy: "/privacy",
  privacy: "/privacy",
  termsofservice: "/terms",
  terms: "/terms",
  refundpolicy: "/refundpolicy",
};
export const publicPath = (screen) =>
  paths[String(screen).toLowerCase()] || "/";
export function publicScreen(pathname) {
  const path = pathname.replace(/\/+$/, "").toLowerCase() || "/";
  return (
    Object.keys(paths).find((screen) => paths[screen] === path) || "landing"
  );
}
