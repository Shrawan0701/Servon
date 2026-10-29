# Servon public website refresh

The Expo web build uses `LandingPage.web.js` and `WebPageLayout.web.js`. Metro selects these files for the website; the native app retains its existing landing/layout implementation. Shared presentation lives in `MarketingShell.web.js`, `MarketingTheme.web.js`, `ProductScene.web.js` and `DemoDialog.web.js`.

The direction is warm ivory, forest green and lime, with editorial typography and a lightweight CSS 3D scene. The product scene responds to a mouse pointer; floating and scanning details respect the system's reduced-motion preference. There is no new rendering library, runtime dependency, external model or raster image download. Sample product numbers and conversations are labelled as illustrative. No investor endorsement, customer count or rating is added.

The landing page has no pricing section or price offer schema. The existing standalone `/pricing` page remains linked from the navigation and footer; its plan prices are retained.

The shared shell covers Product, Pricing, About, Contact, FAQ, Careers, Partners, Security, Privacy, Terms and Refund Policy. Existing page content and policies are retained, with updated surfaces, typography, spacing and accessible section headings. The document pages gain section navigation. The About page replaces numerical reliability/setup claims with product categories. The Features page now also describes the existing inventory scanner and shared/bulk recipe setup.

`publicRoutes.js` supplies public paths and screen names. `App.js` initializes the public screen from the URL and listens for browser back/forward navigation. Its authenticated and native app gates remain in place. Existing Vercel SPA rewrites already support these paths.

Demo booking uses the existing public Web3Forms destination, access key and field contract. The form now includes the required email field, browser validation, an optional message, duplicate-submit protection, visible error/success states, modal focus handling and Escape dismissal. Success is shown only after a successful provider response. QA must intercept this request; do not send test leads to the real service.

No backend, database, payment, customer ordering or authenticated restaurant workflow is changed by this redesign. This is a local code change; the user retains deployment responsibility.

Validation: Expo web and Android exports, the existing translation checks, and a browser smoke check covering public routes, responsive layouts, product tabs/keyboard interaction, FAQ search, demo validation/success/error, history navigation and reduced motion. Browser demo submissions are mocked. Preview screenshots are local QA artifacts, not deployed assets.

## Product-led visual revision

The landing page now uses the additional `MarketingEdition.web.js` styling, a large product statement and a wide interactive workspace in `ProductScene.web.js`. The earlier terminal/QR-stand illustration, floating stickers, decorative slogans and repeated short headlines have been removed from the rendered page. The workspace switches between dining-room tables, kitchen tickets and inventory, with sample records clearly identified. Landing content describes order handling, recipe consumption and reporting directly; pricing remains excluded from the landing page.

Web sign-in renders `LoginWebView.web.js`, a dark architectural brand panel and a restrained form. `LoginScreen.js` still owns the existing API request, token handling, error/loading state and forgot-password navigation. Native sign-in retains its existing presentation through the platform fallback.
