/**
 * /settings/mandant — legacy redirect to /settings/tenant (URL moved to English).
 */

import { redirect } from "next/navigation";

export default function Page() {
  redirect("/settings/tenant");
}
