import Link from "next/link";
import Image from "next/image";

/**
 * Email verification pending page.
 */
export default function VerifyPage() {
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
            width: 48, height: 48, borderRadius: "var(--radius-lg)", background: "var(--color-lime)", border: "1px solid rgba(0,0,0,0.10)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 20px",
          }}>✉</div>
          <h1 className="volt-heading" style={{ color: "var(--color-text-heading)", marginBottom: 10, marginTop: 0 }}>E-Mail gesendet</h1>
          <p className="volt-body-sm" style={{ color: "var(--color-text-subtle)", lineHeight: 1.6, margin: "0 0 12px" }}>
            Ein Anmeldelink wurde an deine E-Mail-Adresse gesendet.<br />
            Klicke auf den Link in der E-Mail um die Anmeldung abzuschließen.
          </p>
          <p className="volt-body-sm" style={{ color: "var(--color-text-muted)", margin: 0 }}>
            Falls du keine E-Mail siehst, prüfe deinen Spam-Ordner.
          </p>
        </div>

        <div style={{ marginTop: 20 }}>
          <Link href="/auth/signin" style={{ fontSize: 13, color: "var(--color-text-subtle)", textDecoration: "none" }}>
            ← Zurück zur Anmeldung
          </Link>
        </div>
      </div>
    </div>
  );
}
