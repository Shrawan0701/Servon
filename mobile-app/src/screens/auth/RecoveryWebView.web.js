import React from "react";
import { AuthWebLayout } from "./LoginWebView.web";
import { MarkIcon } from "../web/MarketingTheme.web";

const css = `
.sr-progress{display:flex;gap:16px;margin:0 0 32px;padding:0;list-style:none}.sr-progress li{flex:1;border-top:2px solid #e4eae5;padding-top:10px;font-size:10px;color:#929d95;line-height:1.6}.sr-progress li[data-active=true]{border-color:#387c56;color:#2b6841}.sr-progress li span{margin-right:6px;font-family:Consolas,monospace}.sr-email{display:block;color:#425347;overflow-wrap:anywhere}.sr-code{font-size:25px!important;letter-spacing:10px;font-variant-numeric:tabular-nums}.sr-resend{font-size:12px;color:#89958c;line-height:1.8}.sr-resend button,.sr-back{border:0;background:none;padding:0;color:#406f4e;font-size:12px}.sr-resend button{text-decoration:underline;text-underline-offset:3px}.sr-resend button:disabled{color:#89958c;cursor:default;text-decoration:none}.sr-back{display:inline-flex;align-items:center;gap:8px;margin-top:27px}.sr-back svg{transform:rotate(180deg)}.sr-success{width:45px;height:45px;display:grid;place-items:center;background:#e9f2eb;color:#387c56;border:1px solid #d7e5db;border-radius:4px;margin-bottom:24px}.sr-hint{font-size:11px;line-height:1.7;color:#89958c;margin-top:-12px}.sl-login .sr-back:hover{color:#174f34}
`;

export default function RecoveryWebView({
  step, email, otp, newPassword, showPassword, loading, error, success, timer,
  onEmailChange, onOtpChange, onPasswordChange, onTogglePassword,
  onSendCode, onVerifyCode, onResetPassword, onLogin, onNavigate,
}) {
  const submit = step === 1 ? onSendCode : step === 2 ? onVerifyCode : onResetPassword;
  const titles = ["Reset your password.", "Check your email.", "Choose a new password."];
  const actions = ["Send verification code", "Verify code", "Update password"];
  return (
    <AuthWebLayout onNavigate={onNavigate}>
      <style>{css}</style>
      <main className="sl-form-content">
        <p className="sl-form-kicker">ACCOUNT RECOVERY</p>
        {!success && (
          <ol className="sr-progress" aria-label="Password reset progress">
            {["Email", "Verification", "New password"].map((label, index) => (
              <li key={label} data-active={step >= index + 1} aria-current={step === index + 1 ? "step" : undefined}>
                <span>{String(index + 1).padStart(2, "0")}</span>{label}
              </li>
            ))}
          </ol>
        )}
        {success ? (
          <>
            <div className="sr-success" aria-hidden="true"><MarkIcon name="check" size={23} /></div>
            <h1>Password updated.</h1>
            <p className="sl-form-description" role="status">Your new password is ready. Sign in to continue to your restaurant workspace.</p>
            <button className="sl-submit" onClick={onLogin}>Back to sign in <MarkIcon size={17} /></button>
          </>
        ) : (
          <>
            <h1>{titles[step - 1]}</h1>
            <p className="sl-form-description">
              {step === 1 && "Enter your registered email address to receive a six-digit verification code."}
              {step === 2 && <>Enter the six-digit code sent to <span className="sr-email">{email}</span></>}
              {step === 3 && "Set a new password for your Servon account."}
            </p>
            {error && <p className="sl-form-error" role="alert">{error}</p>}
            <form key={step} className="sl-form" onSubmit={(event) => { event.preventDefault(); if (!loading) submit(); }}>
              {step === 1 && (
                <label className="sl-field">Email address
                  <input type="email" name="email" value={email} onChange={(event) => onEmailChange(event.target.value)} autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@restaurant.com" required autoFocus />
                </label>
              )}
              {step === 2 && (
                <label className="sl-field">Verification code
                  <input className="sr-code" type="text" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => onOtpChange(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required autoFocus />
                </label>
              )}
              {step === 3 && (
                <>
                  <label className="sl-field">New password
                    <span className="sl-password">
                      <input type={showPassword ? "text" : "password"} name="new-password" value={newPassword} onChange={(event) => onPasswordChange(event.target.value)} autoComplete="new-password" placeholder="Enter your new password" minLength={6} required autoFocus />
                      <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={onTogglePassword}>{showPassword ? "Hide" : "Show"}</button>
                    </span>
                  </label>
                  <p className="sr-hint">Use at least 6 characters.</p>
                </>
              )}
              <button type="submit" className="sl-submit" disabled={loading}>
                {loading ? "Please wait..." : actions[step - 1]}<MarkIcon name={loading ? "clock" : "arrow"} size={17} />
              </button>
              {step === 2 && (
                <div className="sr-resend">No code in your inbox? Check your spam folder, or <button type="button" disabled={timer > 0 || loading} onClick={onSendCode}>{timer > 0 ? `resend in ${timer}s` : "send another code"}</button>.</div>
              )}
            </form>
            <button className="sr-back" onClick={onLogin}><MarkIcon size={13} />Back to sign in</button>
          </>
        )}
      </main>
    </AuthWebLayout>
  );
}
