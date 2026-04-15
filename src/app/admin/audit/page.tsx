/**
 * /admin/audit — global audit-log viewer (system-admin).
 *
 * Cross-tenant view of every administrative action. Filter by
 * tenant, action type, or actor user; infinite scroll for history.
 *
 * Per-tenant preview lives in /admin/tenants/[id] (last 20). This
 * page is the full log with paging + filters.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuditClient } from "./AuditClient";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  if (process.env.NODE_ENV !== "development") {
    const session = await auth();
    if (!session?.user) {
      redirect("/auth/signin?callbackUrl=/admin/audit");
    }
    if ((session.user as { role?: string }).role !== "admin") {
      redirect("/");
    }
  }
  return <AuditClient />;
}
