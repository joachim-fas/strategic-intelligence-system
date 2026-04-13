/**
 * Sign-in page — email magic link authentication.
 */
"use client";

// TODO: FE-01 — Remove "use client". Extract interactive parts into Client Components.
// This page should be a Server Component with only interactive islands as "use client".

import { useState } from "react";
import Image from "next/image";
import { useLocale } from "@/lib/locale-context";

export default function SignInPage() {
  const { locale } = useLocale();
  const de = locale === "de";
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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent" }}>
        <div style={{ maxWidth: 420, width: "100%", padding: "40px 32px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", background: "var(--pastel-mint)", border: "1px solid var(--pastel-mint-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 20px" }}>
            ✓
          </div>
          <h1 className="volt-heading" style={{ color: "var(--color-text-heading)", marginBottom: 10 }}>{de ? "E-Mail gesendet" : "Email sent"}</h1>
          <p className="volt-body-sm" style={{ color: "var(--color-text-subtle)", lineHeight: 1.6 }}>
            {de
              ? <>Ein Anmeldelink wurde an <strong style={{ color: "var(--color-text-primary)" }}>{email}</strong> gesendet. Klicke auf den Link in der E-Mail um die Anmeldung abzuschließen.</>
              : <>A sign-in link has been sent to <strong style={{ color: "var(--color-text-primary)" }}>{email}</strong>. Click the link in the email to complete sign-in.</>
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent" }}>
      <div style={{ maxWidth: 420, width: "100%", padding: "40px 32px" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <Image src="/icons/volt-signet.svg" alt="SIS" width={32} height={21} />
          <div>
            <div className="volt-heading" style={{ color: "var(--color-text-heading)" }}>Strategic Intelligence System</div>
            <div className="volt-body-sm" style={{ color: "var(--color-text-muted)" }}>{de ? "Zugang nur für autorisierte Nutzer" : "Access for authorized users only"}</div>
          </div>
        </div>

        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-2xl)", padding: "28px 24px", boxShadow: "var(--shadow-sm)" }}>
          <h1 className="volt-heading" style={{ color: "var(--color-text-heading)", margin: "0 0 6px" }}>{de ? "Anmelden" : "Sign In"}</h1>
          <p className="volt-body-sm" style={{ color: "var(--color-text-muted)", margin: "0 0 24px" }}>
            {de ? "Gib deine E-Mail ein — du erhältst einen Magic Link." : "Enter your email — you'll receive a magic link."}
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label htmlFor="email" className="volt-label-text" style={{ display: "block", color: "var(--color-text-subtle)", marginBottom: 6 }}>
                {de ? "E-Mail-Adresse" : "Email address"}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={de ? "du@beispiel.de" : "you@example.com"}
                className="volt-input"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", background: "var(--signal-negative-light)", border: "1px solid var(--signal-negative-border)" }}>
                <p className="volt-error-text" style={{ margin: 0 }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="volt-btn volt-btn-solid"
              style={{ width: "100%" }}
            >
              {de ? "Magic Link senden →" : "Send Magic Link →"}
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
