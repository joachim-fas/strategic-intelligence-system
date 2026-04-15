/**
 * /projekte/archiv — legacy redirect to /projects/archive (URL moved to English).
 */

import { redirect } from "next/navigation";

export default function Page() {
  redirect("/projects/archive");
}
