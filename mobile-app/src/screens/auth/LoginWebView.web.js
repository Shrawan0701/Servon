import React, { useState } from "react";
import { MarkIcon } from "../web/MarketingTheme.web";

const css = `
.sl-login{min-height:100dvh;height:100%;width:100%;display:grid;grid-template-columns:minmax(400px,43%) minmax(0,1fr);background:#fff;color:#1b2821;font-family:Arial,Helvetica,sans-serif;overflow-y:auto}.sl-login *{box-sizing:border-box}.sl-login button,.sl-login input{font:inherit}.sl-login button,.sl-login a{-webkit-tap-highlight-color:transparent}.sl-login a{color:inherit;text-decoration:none}.sl-login button{cursor:pointer}.sl-login :focus-visible{outline:2px solid #387c56;outline-offset:4px}.sl-aside{background:#14231b;color:#e7ede8;position:relative;overflow:hidden;padding:48px;display:flex;flex-direction:column;min-height:800px}.sl-aside-top{display:flex;align-items:center;justify-content:space-between;gap:25px;font-size:10px;letter-spacing:.5px;color:#8ea294}.sl-logo{font-size:29px;font-weight:600;letter-spacing:-1.8px;line-height:1}.sl-aside-top>a{color:#e9efea}.sl-aside-top>a span{color:#76ae8b}.sl-aside-identity{margin-top:85px;position:relative;z-index:1}.sl-aside-identity h2{font-size:clamp(80px,11vw,160px);font-weight:400;letter-spacing:-9px;line-height:1;margin:0 0 23px}.sl-aside-identity p{font-size:13px;line-height:1.9;color:#99aca0;max-width:290px;margin:0}.sl-plan{position:relative;flex:1;min-height:265px;margin:44px -15px 25px;opacity:.75;transform:perspective(1200px) rotateX(18deg) rotateZ(-12deg);transform-origin:center}.sl-plan svg{height:100%;min-height:265px;max-height:330px;width:100%;display:block;overflow:visible}.sl-aside-foot{border-top:1px solid #3c4f42;padding-top:22px;display:flex;justify-content:space-between;gap:20px;align-items:flex-end;position:relative;z-index:1}.sl-aside-foot p{font-size:10px;line-height:1.8;color:#829a89;max-width:255px;margin:0}.sl-aside-foot>span{font:9px Consolas,monospace;color:#7c9584;white-space:nowrap}.sl-form-panel{display:flex;flex-direction:column;padding:38px 55px;min-height:800px}.sl-form-top{display:flex;justify-content:space-between;gap:20px;align-items:center;font-size:11px;color:#8c9790}.sl-back{display:inline-flex;align-items:center;gap:8px;color:#69766c!important}.sl-back svg{transform:rotate(180deg)}.sl-mobile-brand{display:none}.sl-form-content{width:100%;max-width:385px;margin:auto; padding:65px 0}.sl-form-kicker{font:10px Consolas,monospace;letter-spacing:1px;color:#7c8a80;margin:0 0 20px}.sl-form-content h1{font-size:37px;font-weight:400;letter-spacing:-1.5px;line-height:1.15;margin:0 0 14px}.sl-form-description{font-size:13px;line-height:1.8;color:#89958c;margin:0 0 35px}.sl-form{display:flex;flex-direction:column;gap:23px}.sl-field{display:flex;flex-direction:column;gap:10px;font-size:12px;color:#425347}.sl-field input{min-height:49px;padding:13px 14px;background:#fff;border:1px solid #cfd9d1;border-radius:4px;width:100%;min-width:0;font-size:14px;color:#26382b}.sl-field input::placeholder{color:#a1aba3}.sl-field input:focus{outline:1px solid #3e7651;outline-offset:0;border-color:#3e7651}.sl-password{display:flex;position:relative}.sl-password input{padding-right:60px}.sl-password button{position:absolute;right:4px;top:4px;bottom:4px;border:0;background:none;font-size:10px;color:#718675;min-width:49px;border-radius:3px}.sl-password button:hover{background:#f2f5ef}.sl-forgot{align-self:flex-end;margin-top:-8px;background:none;border:0;padding:4px 0;font-size:11px;color:#557c60}.sl-submit{width:100%;display:flex;align-items:center;justify-content:space-between;gap:20px;border:1px solid #13281b;background:#13281b;color:#fff;min-height:50px;border-radius:4px;padding:13px 17px;font-size:13px;margin-top:1px}.sl-submit:hover{background:#245537}.sl-submit:disabled{opacity:.6;cursor:wait}.sl-form-error{font-size:12px;line-height:1.7;border-left:2px solid #b26857;background:#fbf3ef;padding:12px 14px;color:#975540;margin:0 0 24px}.sl-demo-link{border-top:1px solid #e5ebe3;margin-top:29px;padding-top:24px;font-size:11px;line-height:1.9;color:#939d95}.sl-demo-link button{background:none;border:0;padding:0;color:#406f4e;font-size:11px;text-decoration:underline;text-underline-offset:3px}.sl-form-footer{border-top:1px solid #edf0eb;padding-top:20px;display:flex;justify-content:space-between;gap:15px;font-size:9px;color:#a1aaa2}.sl-form-footer a:hover{color:#456950}
@media(min-width:1700px){.sl-aside{padding:65px 70px}.sl-aside-identity{margin-top:100px}.sl-form-panel{padding:50px 75px}.sl-form-content{max-width:420px}.sl-form-content h1{font-size:42px}.sl-field input{min-height:54px}.sl-submit{min-height:54px}.sl-plan svg{max-height:400px}.sl-aside-foot p{font-size:11px;max-width:310px}}
@media(max-width:1000px){.sl-login{grid-template-columns:38% 1fr}.sl-aside{padding:35px 28px}.sl-aside-top>span{display:none}.sl-aside-identity h2{font-size:90px;letter-spacing:-5px}.sl-aside-identity{margin-top:100px}.sl-aside-identity p{font-size:12px}.sl-form-panel{padding:35px}.sl-plan{margin-left:-20px;margin-right:-20px}.sl-aside-foot>span{display:none}.sl-form-content h1{font-size:32px}}
@media(max-width:760px){.sl-login{grid-template-columns:1fr;min-height:100dvh}.sl-aside{display:none}.sl-form-panel{min-height:100dvh;padding:28px 26px 22px}.sl-form-top{font-size:10px}.sl-form-top>span{display:none}.sl-mobile-brand{display:block;font-size:24px;font-weight:600;letter-spacing:-1.3px;color:#203c28!important}.sl-form-content{max-width:400px;padding:60px 0 65px}.sl-form-content h1{font-size:35px}.sl-form-kicker{font-size:9px}.sl-form-description{font-size:13px;margin-bottom:30px}.sl-form-footer{font-size:8px;line-height:1.8}.sl-demo-link{font-size:11px}.sl-form-footer>span{max-width:170px}}
@media(max-width:380px){.sl-form-panel{padding:24px 21px 20px}.sl-form-content h1{font-size:31px}.sl-form-content{padding:45px 0}.sl-back{font-size:10px}}
`;

export function AuthWebLayout({ children, onNavigate }) {
  const follow = (screen, params) => (event) => {
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey
    )
      return;
    event.preventDefault();
    onNavigate?.(screen, params);
  };
  return (
    <div className="sl-login">
      <style>{css}</style>
      <aside className="sl-aside">
        <div className="sl-aside-top">
          <a
            className="sl-logo"
            href="/"
            onClick={follow("landing")}
            aria-label="Servon home"
          >
            Servon<span>.</span>
          </a>
          <span>RESTAURANT MANAGEMENT</span>
        </div>
        <div className="sl-aside-identity">
          <h2>Servon</h2>
          <p>
            Access your restaurant’s ordering, kitchen, inventory and financial
            information through a single account.
          </p>
        </div>
        <div className="sl-plan" aria-hidden="true">
          <svg viewBox="0 0 500 330" fill="none">
            <g stroke="#6d8c76" strokeWidth="1">
              <path d="M32 29H467V285H32V29Z M42 39H457V275H42V39Z" />
              <path d="M32 196H111M161 196H275V285M275 29V125M275 170V196H467M351 29V196M275 85H351M275 95H351M32 205H111M161 205H265V285" />
              <path
                d="M111 196a50 50 0 0 1 50 50M111 196v50M275 125a45 45 0 0 1 45 45M275 170h45"
                strokeDasharray="3 3"
              />
              <path
                d="M6 29H21M6 285H21M13 29V285M32 301V317M467 301V317M32 310H467"
                opacity=".5"
              />
              <g stroke="#8aab93">
                {[73, 160].map((x) =>
                  [68, 132].map((y) => (
                    <g key={`${x}-${y}`}>
                      <rect x={x} y={y} width="53" height="34" rx="2" />
                      <path
                        d={`M${x + 10} ${y - 5}h12M${x + 31} ${y - 5}h12M${x + 10} ${y + 39}h12M${x + 31} ${y + 39}h12`}
                      />
                    </g>
                  )),
                )}
                <rect x="364" y="53" width="76" height="31" />
                <rect x="364" y="99" width="76" height="31" />
                <rect x="364" y="145" width="76" height="31" />
                <path d="M64 225H226V251H64Z" />
                <path d="M300 218h130v30H300Z" />
              </g>
              <g stroke="#405f49" strokeDasharray="2 7">
                <path d="M-8 98H500M-8 167H500M-8 238H500M96 5V330M223 5V330M390 5V330" />
              </g>
            </g>
          </svg>
        </div>
        <div className="sl-aside-foot">
          <p>
            Servon Labs Private Limited
            <br />
            Pune, India
          </p>
          <span>WEB APPLICATION / {new Date().getFullYear()}</span>
        </div>
      </aside>
      <section className="sl-form-panel">
        <div className="sl-form-top">
          <a className="sl-back" href="/" onClick={follow("landing")}>
            <MarkIcon size={13} />
            Back to website
          </a>
          <span>Servon business account</span>
          <a className="sl-mobile-brand" href="/" onClick={follow("landing")}>
            Servon.
          </a>
        </div>
        {children}
        <footer className="sl-form-footer">
          <span>© {new Date().getFullYear()} Servon Labs Private Limited</span>
          <a href="/privacy" onClick={follow("privacypolicy")}>
            Privacy policy
          </a>
        </footer>
      </section>
    </div>
  );
}

export default function LoginWebView({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  loading,
  error,
  onSubmit,
  onForgot,
  onNavigate,
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <AuthWebLayout onNavigate={onNavigate}>
        <main className="sl-form-content">
          <p className="sl-form-kicker">ACCOUNT ACCESS</p>
          <h1>
            Sign in to your
            <br />
            Servon account.
          </h1>
          <p className="sl-form-description">
            Use the email address registered with your restaurant.
          </p>
          {error && (
            <p className="sl-form-error" role="alert">
              {error}
            </p>
          )}
          <form
            className="sl-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!loading) onSubmit();
            }}
          >
            <label className="sl-field">
              Email address
              <input
                type="email"
                name="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                autoComplete="username"
                placeholder="you@restaurant.com"
                required
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
            <label className="sl-field">
              Password
              <span className="sl-password">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>
            <button type="button" className="sl-forgot" onClick={onForgot}>
              Forgot password?
            </button>
            <button type="submit" className="sl-submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
              <MarkIcon name={loading ? "clock" : "arrow"} size={17} />
            </button>
          </form>
          <div className="sl-demo-link">
            Need an account for your restaurant?
            <br />
            <button onClick={() => onNavigate?.("landing", { openDemo: true })}>
              Contact the team to arrange a demonstration
            </button>
          </div>
        </main>
    </AuthWebLayout>
  );
}
