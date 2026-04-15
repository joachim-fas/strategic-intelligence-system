"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLocale } from "@/lib/locale-context";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

interface InviteInfo {
  email: string;
  role: "owner" | "admin" | "member" | "viewer";
  tenant: { id: string; name: string; slug: string };
  expiresAt: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "ok"; invite: InviteInfo }
  | { status: "error"; code: string; message: string };

function roleLabel(role: string, de: boolean): string {
  if (de) return role === "owner" ? "Inhaber" : role === "admin" ? "Admin" : role === "member" ? "Mitglied" : "Leser";
  return role === "owner" ? "Owner" : role === "admin" ? "Admin" : role === "member" ? "Member" : "Viewer";
}

export function AcceptInviteClient({ token }: { token: string | null }) {
  const { locale } = useLocale();
  const de = locale === "de";

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setState({ status: "error", code: "NO_TOKEN", message: de ? "Kein Token in der URL." : "No token in URL." });
      return;
    }
    setState({ status: "loading" });
    try {
      const res = await fetchWithTimeout(`/api/v1/invites/accept?token=${encodeURIComponent(token)}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const code = json?.error?.code ?? "UNKNOWN";
        const message = json?.error?.message ?? `HTTP ${res.status}`;
        setState({ status: "error", code, message });
        return;
      }
      setState({ status: "ok", invite: json.data as InviteInfo });
    } catch (e) {
      setState({ status: "error", code: "NETWORK", message: e instanceof Error ? e.message : String(e) });
    }
  }, [token, de]);
  useEffect(() => { load(); }, [load]);

  const accept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      const res = await fetchWithTimeout("/api/v1/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        alert(json?.error?.message ?? (de ? "Annahme fehlgeschlagen." : "Accept failed."));
        return;
      }
      setAccepted(true);
      // Kurze Pause fuers Feedback, dann Reload, damit die Session die
      // neue Membership mitnimmt. Hart-reload, damit Server-Hydration
      // mit dem neuen Active-Tenant greift.
      setTimeout(() => { window.location.href = "/"; }, 800);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--volt-surface, #fff)", display: "flex", flexDirection: "column" }}>
      <AppHeader />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{
          maxWidth: 480, width: "100%",
          background: "var(--volt-surface-raised, #fff)",
          border: "1px solid var(--color-border, #E8E8E8)",
          borderRadius: 16,
          padding: "32px 28px",
          fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
        }}>
          <div style={{
            fontFamily: "var(--volt-font-mono)", fontSize: 10, fontWeight: 700,
            letterSpacing: "0.10em", textTransform: "uppercase" as const,
            color: "var(--volt-text-faint, #BBB)", marginBottom: 8,
          }}>
            {de ? "Einladung" : "Invitation"}
          </div>

          {state.status === "loading" && (
            <div style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
              {de ? "Pruefe Einladung…" : "Checking invitation…"}
            </div>
          )}

          {state.status === "error" && (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--volt-text, #0A0A0A)" }}>
                {de ? "Einladung nicht gueltig" : "Invitation not valid"}
              </h1>
              <p style={{ fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.55, margin: "0 0 16px" }}>
                {state.code === "NOT_FOUND" ? (de
                  ? "Diese Einladung existiert nicht oder wurde widerrufen."
                  : "This invitation does not exist or was revoked.")
                : state.code === "EXPIRED" ? (de
                  ? "Diese Einladung ist abgelaufen (14 Tage ab Versand). Bitte eine neue Einladung anfordern."
                  : "This invitation has expired (14 days since issue). Please request a new one.")
                : state.code === "ALREADY_ACCEPTED" ? (de
                  ? "Diese Einladung wurde bereits angenommen."
                  : "This invitation has already been accepted.")
                : state.message}
              </p>
              <a href="/" style={{
                display: "inline-block",
                padding: "8px 14px",
                fontSize: 13, fontWeight: 600,
                borderRadius: 8, textDecoration: "none",
                border: "1px solid var(--color-border)",
                color: "var(--volt-text, #0A0A0A)",
                background: "transparent",
              }}>
                ← {de ? "Zur Startseite" : "Go home"}
              </a>
            </>
          )}

          {state.status === "ok" && !accepted && (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 12px", color: "var(--volt-text, #0A0A0A)", letterSpacing: "-0.01em" }}>
                {de ? "Du wurdest eingeladen" : "You've been invited"}
              </h1>
              <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6, margin: "0 0 20px" }}>
                {de
                  ? <>Der Mandant <strong>{state.invite.tenant.name}</strong> laedt <strong>{state.invite.email}</strong> als <strong>{roleLabel(state.invite.role, true)}</strong> ein.</>
                  : <>Tenant <strong>{state.invite.tenant.name}</strong> invites <strong>{state.invite.email}</strong> to join as <strong>{roleLabel(state.invite.role, false)}</strong>.</>}
              </p>
              <div style={{
                display: "flex", flexDirection: "column", gap: 6,
                padding: "10px 14px", borderRadius: 10,
                background: "var(--color-surface-2, #F5F5F5)",
                marginBottom: 20,
              }}>
                <Row label={de ? "Mandant" : "Tenant"} value={state.invite.tenant.name} />
                <Row label={de ? "Email" : "Email"} value={state.invite.email} />
                <Row label={de ? "Rolle" : "Role"} value={roleLabel(state.invite.role, de)} />
                <Row
                  label={de ? "Gueltig bis" : "Valid until"}
                  value={new Date(state.invite.expiresAt).toLocaleDateString(de ? "de-DE" : "en-US", {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                />
              </div>
              <button
                onClick={accept}
                disabled={accepting}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "var(--volt-lime, #E4FF97)",
                  color: "var(--volt-text, #0A0A0A)",
                  fontFamily: "var(--volt-font-ui)",
                  fontSize: 14, fontWeight: 600,
                  cursor: accepting ? "wait" : "pointer",
                }}
              >
                {accepting
                  ? (de ? "Einen Moment…" : "One moment…")
                  : (de ? "Einladung annehmen →" : "Accept invitation →")}
              </button>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 12, lineHeight: 1.5 }}>
                {de
                  ? "Du musst unter dieser Email eingeloggt sein. Ist das nicht der Fall, wirst du zum Login weitergeleitet."
                  : "You must be signed in with this email. If you aren't, you'll be redirected to sign-in."}
              </p>
            </>
          )}

          {accepted && (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--volt-text, #0A0A0A)" }}>
                {de ? "Willkommen an Bord" : "Welcome aboard"}
              </h1>
              <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
                {de ? "Du wirst weitergeleitet…" : "Redirecting you…"}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
      <span style={{ color: "var(--color-text-muted)", fontFamily: "var(--volt-font-mono)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
        {label}
      </span>
      <span style={{ fontWeight: 500, color: "var(--color-text-primary)", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}
