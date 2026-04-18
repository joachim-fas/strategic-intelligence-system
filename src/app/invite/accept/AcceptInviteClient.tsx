"use client";

/**
 * Landing page for /invite/accept?token=…
 *
 * Verifies the invite token via GET /api/v1/invites/accept, shows
 * tenant/role summary, and posts the same endpoint to consume it.
 * Hard-reloads on success so the session picks up the new membership.
 *
 * 2026-04-18 audit A5-H9: migrated from `de ? ... : ...` ternaries to
 * `useT()` + the `invite.*` namespace. The role label lookup reuses
 * `admin.roleOwner` / `admin.roleAdmin` / … from the admin migration.
 */

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useT } from "@/lib/locale-context";
import { t as translate, localeTag, type Locale, type TranslationKey } from "@/lib/i18n";
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

const ROLE_KEY: Record<InviteInfo["role"], TranslationKey> = {
  owner: "admin.roleOwner",
  admin: "admin.roleAdmin",
  member: "admin.roleMember",
  viewer: "admin.roleViewer",
};

function roleLabel(role: InviteInfo["role"], locale: Locale): string {
  return translate(locale, ROLE_KEY[role]);
}

export function AcceptInviteClient({ token }: { token: string | null }) {
  const { t, locale } = useT();

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setState({ status: "error", code: "NO_TOKEN", message: t("invite.noTokenError") });
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
  }, [token, t]);
  useEffect(() => { load(); }, [load]);

  // Audit A4-H2 (18.04.2026): error state for the POST-accept call.
  // Previously we rendered `alert(json?.error?.message)` which left the
  // user on a modal dialog with no recovery — especially bad for the
  // 401 UNAUTHORIZED case (user not signed in) and the 403
  // EMAIL_MISMATCH case (logged in under the wrong email). Now both
  // get inline copy + an actionable link.
  const [acceptError, setAcceptError] = useState<{ code: string; message: string } | null>(null);

  const accept = async () => {
    if (!token) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await fetchWithTimeout("/api/v1/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const code = json?.error?.code ?? (res.status === 401 ? "UNAUTHORIZED" : "UNKNOWN");
        const message = json?.error?.message ?? t("invite.acceptFailedGeneric");
        // 401 → redirect straight to sign-in so the user can come back.
        if (code === "UNAUTHORIZED" || res.status === 401) {
          const callback = encodeURIComponent(window.location.href);
          window.location.href = `/auth/signin?callbackUrl=${callback}`;
          return;
        }
        setAcceptError({ code, message });
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
            {t("invite.caption")}
          </div>

          {state.status === "loading" && (
            <div style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
              {t("invite.checking")}
            </div>
          )}

          {state.status === "error" && (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--volt-text, #0A0A0A)" }}>
                {t("invite.invalidHeading")}
              </h1>
              <p style={{ fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.55, margin: "0 0 16px" }}>
                {state.code === "NOT_FOUND" ? t("invite.notFoundBody")
                : state.code === "EXPIRED" ? t("invite.expiredBody")
                : state.code === "ALREADY_ACCEPTED" ? t("invite.alreadyAcceptedBody")
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
                ← {t("invite.goHomeLink")}
              </a>
            </>
          )}

          {state.status === "ok" && !accepted && (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 12px", color: "var(--volt-text, #0A0A0A)", letterSpacing: "-0.01em" }}>
                {t("invite.invitedHeading")}
              </h1>
              <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6, margin: "0 0 20px" }}>
                {t("invite.invitedBodyPrefix")} <strong>{state.invite.tenant.name}</strong>{" "}
                {t("invite.invitedBodyInvites")} <strong>{state.invite.email}</strong>{" "}
                {t("invite.invitedBodyAsJoin")} <strong>{roleLabel(state.invite.role, locale)}</strong>.
              </p>
              <div style={{
                display: "flex", flexDirection: "column", gap: 6,
                padding: "10px 14px", borderRadius: 10,
                background: "var(--color-surface-2, #F5F5F5)",
                marginBottom: 20,
              }}>
                <Row label={t("invite.rowTenant")} value={state.invite.tenant.name} />
                <Row label={t("invite.rowEmail")} value={state.invite.email} />
                <Row label={t("invite.rowRole")} value={roleLabel(state.invite.role, locale)} />
                <Row
                  label={t("invite.rowValidUntil")}
                  value={new Date(state.invite.expiresAt).toLocaleDateString(localeTag(locale), {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                />
              </div>
              {/* Inline error banner — audit A4-H2. EMAIL_MISMATCH is
                   the common 403 where a logged-in user has the wrong
                   email for this token. We tell them which email was
                   invited (from state.invite.email) and link to sign
                   out so they can sign back in under the right one. */}
              {acceptError && (
                <div
                  role="alert"
                  style={{
                    marginBottom: 12,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--signal-negative, #C0341D)",
                    background: "var(--signal-negative-light, #FDEDEA)",
                    color: "var(--signal-negative, #C0341D)",
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {acceptError.code === "EMAIL_MISMATCH"
                      ? t("invite.wrongAccountHeading")
                      : t("invite.acceptFailedHeading")}
                  </div>
                  <div style={{ marginBottom: 6 }}>{acceptError.message}</div>
                  {acceptError.code === "EMAIL_MISMATCH" && (
                    <div style={{ fontSize: 12, opacity: 0.9 }}>
                      {t("invite.emailMismatchPrefix")} <strong>{state.invite.email}</strong>{" "}
                      {t("invite.emailMismatchSuffix")}{" "}
                      <a
                        href={`/auth/signin?callbackUrl=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
                        style={{ color: "inherit", fontWeight: 600, textDecoration: "underline" }}
                      >
                        {t("invite.emailMismatchSignInCta")}
                      </a>
                    </div>
                  )}
                </div>
              )}
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
                {accepting ? t("invite.acceptingCta") : t("invite.acceptInviteCta")}
              </button>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 12, lineHeight: 1.5 }}>
                {t("invite.acceptHint")}
              </p>
            </>
          )}

          {accepted && (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--volt-text, #0A0A0A)" }}>
                {t("invite.acceptedHeading")}
              </h1>
              <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
                {t("invite.acceptedBody")}
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
