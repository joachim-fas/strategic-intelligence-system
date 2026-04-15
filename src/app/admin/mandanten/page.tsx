/**
 * /admin/mandanten — System-Admin-Ansicht aller Mandanten.
 *
 * Gatekeeper: nur users.role === "admin". Nicht-Admins kriegen 403,
 * waehrend Dev-Mode (NODE_ENV=development) den Zugang offen haelt,
 * damit lokale Entwicklung ohne Login weiterlaeuft.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MandantenClient } from "./MandantenClient";

export const dynamic = "force-dynamic";

export default async function MandantenPage() {
  if (process.env.NODE_ENV !== "development") {
    const session = await auth();
    if (!session?.user) {
      redirect("/auth/signin?callbackUrl=/admin/mandanten");
    }
    if ((session.user as { role?: string }).role !== "admin") {
      redirect("/");
    }
  }
  return <MandantenClient />;
}
