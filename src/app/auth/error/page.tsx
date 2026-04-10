/**
 * Auth error page.
 */
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const messages: Record<string, string> = {
    Configuration: "Server configuration error. Contact the administrator.",
    AccessDenied: "Zugang verweigert. Deine E-Mail ist nicht auf der Zulassungsliste.",
    Verification: "Der Anmeldelink ist abgelaufen oder wurde bereits verwendet.",
    Default: "Ein Authentifizierungsfehler ist aufgetreten.",
  };

  const message = messages[error ?? ""] ?? messages.Default;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent" }}>
      <div style={{ maxWidth: 420, width: "100%", padding: "40px 32px", textAlign: "center" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 32 }}>
          <Image src="/icons/volt-signet.svg" alt="SIS" width={32} height={21} />
          <div style={{ textAlign: "left" }}>
            <div className="volt-heading" style={{ color: "var(--color-text-heading)" }}>Strategic Intelligence System</div>
            <div className="volt-body-sm" style={{ color: "var(--color-text-muted)" }}>Zugang nur für autorisierte Nutzer</div>
          </div>
        </div>

        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-2xl)", padding: "28px 24px", boxShadow: "var(--shadow-sm)" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "var(--radius-lg)", background: "var(--signal-negative-light)", border: "1px solid var(--signal-negative-border)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 20px",
          }}>⚠</div>
          <h1 className="volt-heading" style={{ color: "var(--color-text-heading)", marginBottom: 10, marginTop: 0 }}>Authentifizierungsfehler</h1>
          <p className="volt-body" style={{ color: "var(--color-text-subtle)", lineHeight: 1.6, margin: "0 0 24px" }}>{message}</p>
          <a
            href="/auth/signin"
            className="volt-btn volt-btn-outline"
            style={{ display: "inline-block", textDecoration: "none" }}
          >
            Erneut versuchen
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent" }}>
          <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Lädt…</p>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
