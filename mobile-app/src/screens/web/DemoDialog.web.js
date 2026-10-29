import React, { useEffect, useRef, useState } from "react";
import { MarkIcon } from "./MarketingTheme.web";

const initial = {
  name: "",
  phone: "",
  businessName: "",
  businessType: "",
  message: "",
};
export default function DemoDialog({ onClose }) {
  const dialog = useRef(null);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const scrollContainer = dialog.current.closest(".sv-site");
    const previousScrollOverflow = scrollContainer?.style.overflowY;
    const element = dialog.current;
    document.body.style.overflow = "hidden";
    if (scrollContainer) scrollContainer.style.overflowY = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (scrollContainer)
        scrollContainer.style.overflowY = previousScrollOverflow;
      previousFocus?.focus?.();
    };
  }, []);
  const patch = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    if (form.name.trim().length < 2 || form.businessName.trim().length < 2) {
      setError("Please enter your full name and business name.");
      return;
    }
    const phone = form.phone.trim();
    const digits = phone.replace(/\D/g, "");
    if (!/^\+?[\d\s().-]+$/.test(phone) || digits.length < 10 || digits.length > 15) {
      setError("Please enter a valid phone number, including the country code if outside India.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      // Send demo requests to the existing Web3Forms destination.
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: "e02acc71-490b-4dae-a5d2-be08862400dc",
          subject: `New Servon Demo Request - ${form.businessName.trim()}`,
          name: form.name.trim(),
          phone,
          businessName: form.businessName.trim(),
          businessType: form.businessType || "Not provided",
          message: form.message.trim() || "No additional message",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(
          result.message || "We couldn’t send your request. Please try again.",
        );
      setSent(true);
      setForm(initial);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  return (
    <dialog
      ref={dialog}
      className="sv-dialog"
      aria-labelledby="sv-demo-title"
      aria-describedby="sv-demo-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) {
          const box = dialog.current.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <div className="sv-dialog-inner">
        <header>
          <h2 id="sv-demo-title">Let’s meet your restaurant.</h2>
          <button type="button" aria-label="Close demo form" onClick={onClose}>
            <MarkIcon name="close" size={18} />
          </button>
        </header>
        {sent ? (
          <div className="sv-dialog-success" role="status">
            <span>
              <MarkIcon name="check" size={28} />
            </span>
            <h3>You’re on the list.</h3>
            <p id="sv-demo-description">
              Your demo request has been sent. The Servon team will contact you
              to arrange a walkthrough.
            </p>
            <button className="sv-button" onClick={onClose}>
              Close confirmation <MarkIcon size={16} />
            </button>
          </div>
        ) : (
          <>
            <p className="sv-dialog-intro" id="sv-demo-description">
              Submit your contact details and business name. The Servon team
              will contact you to arrange a demonstration of the product.
            </p>
            <form className="sv-demo-form" onSubmit={submit}>
              <label>
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  value={form.name}
                  onChange={patch}
                  required
                  minLength={2}
                  maxLength={150}
                  placeholder="Your full name"
                  autoFocus
                />
              </label>
                <label>
                  Phone number
                  <input
                    name="phone"
                    aria-label="Phone number"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={patch}
                    required
                    placeholder="Your contact number"
                    maxLength={30}
                  />
                </label>
              <label>
                Restaurant name
                <input
                  name="businessName"
                  autoComplete="organization"
                  value={form.businessName}
                  onChange={patch}
                  required
                  minLength={2}
                  maxLength={200}
                  placeholder="Restaurant name"
                />
              </label>
              <label>
                Business type (optional)
                <select
                  name="businessType"
                  aria-label="Business type"
                  value={form.businessType}
                  onChange={patch}
                >
                  <option value="">
                    Choose your business type (optional)
                  </option>
                  {["Hotel", "Restaurant", "Resort", "Cafe", "Other"].map(
                    (type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <details>
                <summary>
                  Anything you’d like us to know? <span>(optional)</span>
                </summary>
                <textarea
                  name="message"
                  aria-label="Additional message"
                  value={form.message}
                  onChange={patch}
                  maxLength={2000}
                  placeholder="Your setup, questions, or a good time to reach you…"
                />
              </details>
              {!!error && (
                <p role="alert" className="sv-form-error">
                  {error}
                </p>
              )}
              <button type="submit" className="sv-button" disabled={busy}>
                {busy ? "Sending your request…" : "Request a demonstration"}
                <MarkIcon name={busy ? "clock" : "arrow"} size={16} />
              </button>
            </form>
            <p className="sv-form-fine">
              By submitting, you agree to be contacted by the Servon team about
              this request.
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
