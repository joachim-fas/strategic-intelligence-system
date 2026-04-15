/**
 * /admin/mandanten — legacy redirect to /admin/tenants (URL moved to English).
 */

import { redirect } from "next/navigation";

export default function Page() {
  redirect("/admin/tenants");
}
