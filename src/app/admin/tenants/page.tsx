/**
 * /admin/tenants — System-Admin-Ansicht aller Mandanten.
 *
 * Gatekeeper: nur users.role === "admin". Nicht-Admins kriegen 403,
 * waehrend Dev-Mode (NODE_ENV=development) den Zugang offen haelt,
 * damit lokale Entwicklung ohne Login weiterlaeuft.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TenantsClient } from "./TenantsClient";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  if (process.env.NODE_ENV !== "development") {
    const session = await auth();
    if (!session?.user) {
      redirect("/auth/signin?callbackUrl=/admin/tenants");
    }
    if ((session.user as { role?: string }).role !== "admin") {
      redirect("/");
    }
  }
  return <TenantsClient />;
}
