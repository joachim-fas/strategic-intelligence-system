/**
 * Sign-in page — email magic link authentication.
 */
"use client";

import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/auth/signin/email", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email,
          csrfToken: await getCsrfToken(),
          callbackUrl: window.location.origin,
        }),
      });

      if (res.ok || res.redirected) {
        setSubmitted(true);
      } else {
        setError("Sign-in failed. Your email may not be on the allowlist.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
  }

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA" }}>
        <div style={{ maxWidth: 420, width: "100%", padding: "40px 32px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#C3F4D3", border: "1px solid #6FD99A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 20px" }}>
            ✓
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A1A1A", marginBottom: 10 }}>E-Mail gesendet</h1>
          <p style={{ fontSize: 14, color: "#6B6B6B", lineHeight: 1.6 }}>
            Ein Anmeldelink wurde an <strong style={{ color: "#1A1A1A" }}>{email}</strong> gesendet.
            Klicke auf den Link in der E-Mail um die Anmeldung abzuschließen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA" }}>
      <div style={{ maxWidth: 420, width: "100%", padding: "40px 32px" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "#E4FF97", border: "1.5px solid rgba(0,0,0,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: "#0A0A0A", letterSpacing: "0.05em",
          }}>SIS</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>Strategic Intelligence System</div>
            <div style={{ fontSize: 11, color: "#9B9B9B" }}>Zugang nur für autorisierte Nutzer</div>
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 16, padding: "28px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1A1A", margin: "0 0 6px" }}>Anmelden</h1>
          <p style={{ fontSize: 13, color: "#9B9B9B", margin: "0 0 24px" }}>
            Gib deine E-Mail ein — du erhältst einen Magic Link.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label htmlFor="email" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B6B6B", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                E-Mail-Adresse
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="du@beispiel.de"
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "10px 14px", borderRadius: 10, fontSize: 14,
                  border: "1px solid #E8E8E8", background: "#FAFAFA", color: "#1A1A1A",
                  outline: "none", transition: "border-color 0.15s",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#1A1A1A"; e.currentTarget.style.background = "#FFFFFF"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E8E8E8"; e.currentTarget.style.background = "#FAFAFA"; }}
              />
            </div>

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#FDEEE9", border: "1px solid #F4A090" }}>
                <p style={{ fontSize: 13, color: "#C0341D", margin: 0 }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              style={{
                width: "100%", padding: "11px 16px", borderRadius: 10,
                background: "#0A0A0A", color: "white", fontSize: 14, fontWeight: 600,
                border: "none", cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "#1A1A1A"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "#0A0A0A"; }}
            >
              Magic Link senden →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch("/api/auth/csrf");
  const data = await res.json();
  return data.csrfToken;
}
