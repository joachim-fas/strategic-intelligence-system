import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "50vh", gap: "16px", padding: "40px" }}>
      <h2 style={{ fontSize: "48px", fontWeight: 700, color: "var(--foreground, #111)" }}>404</h2>
      <p style={{ color: "var(--muted-foreground, #666)" }}>Diese Seite wurde nicht gefunden.</p>
      <Link href="/" style={{ padding: "8px 20px", borderRadius: "8px", border: "1px solid var(--color-border, #ddd)", textDecoration: "none", color: "var(--foreground, #111)" }}>
        Zurück zur Startseite
      </Link>
    </div>
  );
}
