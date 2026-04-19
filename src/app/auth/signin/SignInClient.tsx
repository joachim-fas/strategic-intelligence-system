"use client";

import { useState } from "react";
import Image from "next/image";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { useT } from "@/lib/locale-context";

export default function SignInClient() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetchWithTimeout("/api/auth/signin/email", {
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
        // Audit A5-M3 (18.04.2026): sign-in error strings were the
        // only untranslated copy on the auth surface. Now routed
        // through the shared dictionary (signin namespace).
        setError(t("signin.signinFailed"));
      }
    } catch {
      setError(t("signin.networkError"));
    }
  }

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent" }}>
        <div style={{ maxWidth: 420, width: "100%", padding: "40px 32px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", background: "var(--pastel-mint)", border: "1px solid var(--pastel-mint-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 20px" }}>
            ✓
          </div>
          <h1 className="volt-heading" style={{ color: "var(--color-text-heading)", marginBottom: 10 }}>{t("signin.emailSentHeading")}</h1>
          <p className="volt-body-sm" style={{ color: "var(--color-text-subtle)", lineHeight: 1.6 }}>
            {t("signin.emailSentBodyPrefix")}
            <strong style={{ color: "var(--color-text-primary)" }}>{email}</strong>
            {t("signin.emailSentBodySuffix")}
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
            <div className="volt-body-sm" style={{ color: "var(--color-text-muted)" }}>{t("signin.tagline")}</div>
          </div>
        </div>

        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-2xl)", padding: "28px 24px", boxShadow: "var(--shadow-sm)" }}>
          <h1 className="volt-heading" style={{ color: "var(--color-text-heading)", margin: "0 0 6px" }}>{t("signin.heading")}</h1>
          <p className="volt-body-sm" style={{ color: "var(--color-text-muted)", margin: "0 0 24px" }}>
            {t("signin.subheading")}
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label htmlFor="email" className="volt-label-text" style={{ display: "block", color: "var(--color-text-subtle)", marginBottom: 6 }}>
                {t("signin.emailLabel")}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t("signin.emailPlaceholder")}
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
              {t("signin.submitButton")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

async function getCsrfToken(): Promise<string> {
  const res = await fetchWithTimeout("/api/auth/csrf");
  const data = await res.json();
  return data.csrfToken;
}
