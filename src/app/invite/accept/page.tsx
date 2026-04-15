/**
 * /invite/accept?token=… — Landing-Page fuer Tenant-Einladungen.
 *
 * Der Link kommt aus der Admin-UI (/admin/tenants/[id]/mitglieder)
 * oder einer Invite-Email. Die Seite laedt den Invite-Status ueber
 * /api/v1/invites/accept?token=… und zeigt dem Besucher:
 *
 *   - Bei gueltigem Token: Tenant-Name + Rolle + Annahmebutton
 *   - Bei abgelaufenem/bereits angenommenem Invite: Freundlicher Hinweis
 *   - Bei Login-Mismatch: Hinweis, dass man sich unter der eingeladenen
 *     Email einloggen muss (Magic-Link-Link hinterlegt)
 */

import { AcceptInviteClient } from "./AcceptInviteClient";

export const dynamic = "force-dynamic";

export default async function InviteAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? null;
  return <AcceptInviteClient token={token} />;
}
