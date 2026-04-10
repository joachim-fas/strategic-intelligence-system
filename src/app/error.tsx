"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "50vh", gap: "16px", padding: "40px" }}>
      <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--foreground, #111)" }}>Etwas ist schiefgelaufen</h2>
      <p style={{ color: "var(--muted-foreground, #666)", maxWidth: "400px", textAlign: "center" }}>
        Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.
      </p>
      <button
        onClick={reset}
        style={{ padding: "8px 20px", borderRadius: "8px", border: "1px solid var(--color-border, #ddd)", background: "var(--card, #fff)", cursor: "pointer", fontSize: "14px" }}
      >
        Erneut versuchen
      </button>
    </div>
  );
}
