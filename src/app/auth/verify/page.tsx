/**
 * Email verification pending page.
 */
export default function VerifyPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA" }}>
      <div style={{ maxWidth: 420, width: "100%", padding: "40px 32px", textAlign: "center" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "#E4FF97", border: "1.5px solid rgba(0,0,0,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: "#0A0A0A", letterSpacing: "0.05em",
          }}>SIS</div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>Strategic Intelligence System</div>
            <div style={{ fontSize: 11, color: "#9B9B9B" }}>Zugang nur für autorisierte Nutzer</div>
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 16, padding: "28px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: "#E4FF97", border: "1px solid rgba(0,0,0,0.10)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 20px",
          }}>✉</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1A1A", marginBottom: 10, marginTop: 0 }}>E-Mail gesendet</h1>
          <p style={{ fontSize: 14, color: "#6B6B6B", lineHeight: 1.6, margin: "0 0 12px" }}>
            Ein Anmeldelink wurde an deine E-Mail-Adresse gesendet.<br />
            Klicke auf den Link in der E-Mail um die Anmeldung abzuschließen.
          </p>
          <p style={{ fontSize: 12, color: "#9B9B9B", margin: 0 }}>
            Falls du keine E-Mail siehst, prüfe deinen Spam-Ordner.
          </p>
        </div>

        <div style={{ marginTop: 20 }}>
          <a href="/auth/signin" style={{ fontSize: 13, color: "#6B6B6B", textDecoration: "none" }}>
            ← Zurück zur Anmeldung
          </a>
        </div>
      </div>
    </div>
  );
}
