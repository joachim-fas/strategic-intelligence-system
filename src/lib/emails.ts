/**
 * Minimal Email-Helper fuer transactional Emails (Invites etc.).
 *
 * Zwei Versand-Wege, Reihenfolge = Bevorzugung:
 *   1. Resend HTTPS-API (wenn `RESEND_API_KEY` gesetzt) — bevorzugt, weil
 *      kein SMTP-Tunnel noetig und zuverlaessiger aus Edge/Serverless.
 *   2. Nodemailer-SMTP (wenn `EMAIL_SERVER_HOST` etc. gesetzt) — derselbe
 *      Stack wie NextAuth fuer Magic-Links nutzt.
 *
 * Wenn keine der beiden Konfigurationen greift, wird die Mail geloggt +
 * ein "dryRun"-Flag zurueckgegeben. Lokale Dev-Umgebungen ohne Email-
 * Credentials laufen damit trotzdem durch, der Admin sieht den Invite-
 * Link in der UI selbst und kann ihn manuell teilen.
 *
 * Keep it simple: keine Queue, kein Retry, kein Template-Engine. Wir
 * generieren HTML + Plain-Text inline pro Template — fuer den aktuellen
 * Bedarf (~2 Template-Typen) ist das deutlich lesbarer als ein weiteres
 * Abstraction-Level.
 */

// Node-only: no top-level `import` of nodemailer — we lazy-require so
// the Edge-runtime middleware bundle stays clean.

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface SendMailResult {
  delivered: boolean;
  provider: "resend" | "smtp" | "dryRun";
  messageId?: string;
  error?: string;
}

/** Read the canonical "from" address, falling back sensibly for dev. */
function getFromAddress(): string {
  return (
    process.env.EMAIL_FROM
    ?? process.env.RESEND_FROM
    ?? "SIS <noreply@sis.app>"
  );
}

/** Base URL used to build absolute links in email bodies. */
export function getAppUrl(): string {
  return (
    process.env.NEXTAUTH_URL
    ?? process.env.APP_URL
    ?? "http://localhost:3000"
  );
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const from = getFromAddress();

  // ── Path 1: Resend HTTPS ──────────────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Resend HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const json = await res.json().catch(() => ({} as { id?: string }));
      return { delivered: true, provider: "resend", messageId: json.id };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[email] resend failed:", err);
      // Fall through to SMTP so we don't silently drop the mail if SMTP
      // is also configured as a backup.
    }
  }

  // ── Path 2: Nodemailer SMTP ───────────────────────────────────────
  const smtpHost = process.env.EMAIL_SERVER_HOST;
  if (smtpHost) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.EMAIL_SERVER_PORT ?? "465"),
        secure: Number(process.env.EMAIL_SERVER_PORT ?? "465") === 465,
        auth: {
          user: process.env.EMAIL_SERVER_USER ?? "resend",
          pass: process.env.EMAIL_SERVER_PASSWORD ?? process.env.RESEND_API_KEY ?? "",
        },
      });
      const info = await transporter.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo,
      });
      return { delivered: true, provider: "smtp", messageId: info?.messageId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error("[email] smtp failed:", msg);
      return { delivered: false, provider: "smtp", error: msg };
    }
  }

  // ── Path 3: Dry-Run (local dev without credentials) ───────────────
  // eslint-disable-next-line no-console
  console.info("[email:dryRun] would send", {
    to: input.to,
    subject: input.subject,
    textPreview: input.text.slice(0, 200),
  });
  return { delivered: false, provider: "dryRun" };
}

// ── Templates ───────────────────────────────────────────────────────

export interface TenantInviteEmailInput {
  tenantName: string;
  role: string;
  inviteUrl: string;
  inviterName: string | null;
  locale: "de" | "en";
  expiresAt: string;
}

/**
 * Invite an email address that does NOT yet have an account. Recipient
 * clicks the URL → /invite/accept?token=… → signs in via magic link →
 * membership is created.
 */
export function renderInviteNewUserEmail(input: TenantInviteEmailInput): { subject: string; html: string; text: string } {
  const de = input.locale === "de";
  const expiry = new Date(input.expiresAt).toLocaleDateString(de ? "de-DE" : "en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
  const inviter = input.inviterName ?? (de ? "Ein Kollege" : "A colleague");

  const subject = de
    ? `Einladung zu „${input.tenantName}" im Strategic Intelligence System`
    : `You've been invited to "${input.tenantName}" in Strategic Intelligence System`;

  const preheader = de
    ? `${inviter} laedt dich zu ${input.tenantName} ein.`
    : `${inviter} is inviting you to ${input.tenantName}.`;

  const ctaLabel = de ? "Einladung annehmen" : "Accept invitation";

  const text = de
    ? `${preheader}\n\nRolle: ${input.role}\nGueltig bis: ${expiry}\n\nKlick, um anzunehmen:\n${input.inviteUrl}\n\nWenn du nicht eingeladen werden wolltest, ignoriere diese Email.`
    : `${preheader}\n\nRole: ${input.role}\nValid until: ${expiry}\n\nClick to accept:\n${input.inviteUrl}\n\nIf you weren't expecting this invite, you can safely ignore this email.`;

  const html = `<!doctype html>
<html lang="${input.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;">
<span style="display:none;visibility:hidden;color:transparent;height:0;width:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f5;padding:40px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #e8e8e8;border-radius:16px;overflow:hidden">
      <tr><td style="padding:28px 32px 8px">
        <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#bbb;margin-bottom:10px">
          ${de ? "Einladung" : "Invitation"}
        </div>
        <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;letter-spacing:-0.01em">${de ? "Du wurdest eingeladen" : "You've been invited"}</h1>
        <p style="font-size:14px;line-height:1.6;color:#555;margin:0">
          ${de
            ? `<strong>${escapeHtml(inviter)}</strong> laedt dich zu <strong>${escapeHtml(input.tenantName)}</strong> ein.`
            : `<strong>${escapeHtml(inviter)}</strong> invites you to join <strong>${escapeHtml(input.tenantName)}</strong>.`}
        </p>
      </td></tr>
      <tr><td style="padding:16px 32px 24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;border-radius:10px;padding:12px 14px">
          <tr><td style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:#555">
            <div style="margin-bottom:4px"><span style="letter-spacing:0.06em;text-transform:uppercase;color:#888">${de ? "Mandant" : "Tenant"}:</span> ${escapeHtml(input.tenantName)}</div>
            <div style="margin-bottom:4px"><span style="letter-spacing:0.06em;text-transform:uppercase;color:#888">${de ? "Rolle" : "Role"}:</span> ${escapeHtml(input.role)}</div>
            <div><span style="letter-spacing:0.06em;text-transform:uppercase;color:#888">${de ? "Gueltig bis" : "Valid until"}:</span> ${escapeHtml(expiry)}</div>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 32px 28px" align="center">
        <a href="${escapeAttr(input.inviteUrl)}" style="display:inline-block;padding:12px 20px;background:#E4FF97;color:#0a0a0a;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;border:1px solid rgba(0,0,0,0.08)">
          ${escapeHtml(ctaLabel)} →
        </a>
        <p style="font-size:11px;color:#888;margin:16px 0 0;word-break:break-all">
          ${de ? "Oder kopiere diesen Link:" : "Or copy this link:"}<br>
          <span style="color:#555">${escapeHtml(input.inviteUrl)}</span>
        </p>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #e8e8e8;font-size:11px;color:#888;line-height:1.5">
        ${de
          ? "Wenn du nicht eingeladen werden wolltest, ignoriere diese Email. Der Link verfaellt automatisch."
          : "If you weren't expecting this invite, just ignore this email. The link expires automatically."}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Notify a user that already has an account that they've been added to
 * a new tenant. No token — they're already a member. Link goes straight
 * to /canvas (or / after login) in the target tenant.
 */
export function renderMembershipAddedEmail(input: {
  tenantName: string;
  role: string;
  appUrl: string;
  inviterName: string | null;
  locale: "de" | "en";
}): { subject: string; html: string; text: string } {
  const de = input.locale === "de";
  const inviter = input.inviterName ?? (de ? "Ein Kollege" : "A colleague");

  const subject = de
    ? `„${input.tenantName}" wartet auf dich im Strategic Intelligence System`
    : `"${input.tenantName}" is ready for you in Strategic Intelligence System`;

  const text = de
    ? `${inviter} hat dich als ${input.role} zu ${input.tenantName} hinzugefuegt.\n\nSobald du dich das naechste Mal einloggst, findest du den Mandanten im Switcher oben rechts.\n\nDirekter Einstieg:\n${input.appUrl}/`
    : `${inviter} added you to ${input.tenantName} as ${input.role}.\n\nNext time you sign in you'll see the tenant in the switcher (top right).\n\nDirect link:\n${input.appUrl}/`;

  const html = `<!doctype html>
<html lang="${input.locale}">
<body style="margin:0;padding:0;background:#f7f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #e8e8e8;border-radius:16px">
      <tr><td style="padding:28px 32px">
        <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#bbb;margin-bottom:10px">
          ${de ? "Neuer Mandant" : "New tenant"}
        </div>
        <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;letter-spacing:-0.01em">
          ${de ? `Willkommen in ${escapeHtml(input.tenantName)}` : `Welcome to ${escapeHtml(input.tenantName)}`}
        </h1>
        <p style="font-size:14px;line-height:1.6;color:#555;margin:0 0 16px">
          ${de
            ? `<strong>${escapeHtml(inviter)}</strong> hat dich als <strong>${escapeHtml(input.role)}</strong> hinzugefuegt. Du siehst den Mandanten im Switcher (oben rechts), sobald du dich das naechste Mal einloggst.`
            : `<strong>${escapeHtml(inviter)}</strong> added you as <strong>${escapeHtml(input.role)}</strong>. You'll see the tenant in the switcher (top right) next time you sign in.`}
        </p>
        <a href="${escapeAttr(input.appUrl)}/" style="display:inline-block;padding:10px 18px;background:#E4FF97;color:#0a0a0a;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;border:1px solid rgba(0,0,0,0.08)">
          ${de ? "Zur App →" : "Open app →"}
        </a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}

// ── small html-escape helpers ──────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
