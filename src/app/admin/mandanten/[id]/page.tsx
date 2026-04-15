/**
 * /admin/mandanten/[id] — Mandant-Detail + Mitglieder-Verwaltung.
 *
 * System-admin only. Das Routing-Pattern ist identisch zu
 * /admin/mandanten/page.tsx: Server guardet, Client rendert.
 *
 * Phase 2 hatte in der Tenant-Liste nur "Bearbeiten" und "Archivieren"
 * pro Zeile. Hier kommt jetzt die Mitglieder-/Invite-Verwaltung dazu.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TenantDetailClient } from "./TenantDetailClient";

export const dynamic = "force-dynamic";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (process.env.NODE_ENV !== "development") {
    const session = await auth();
    if (!session?.user) {
      redirect(`/auth/signin?callbackUrl=/admin/mandanten/${id}`);
    }
    if ((session.user as { role?: string }).role !== "admin") {
      redirect("/");
    }
  }
  return <TenantDetailClient tenantId={id} />;
}
