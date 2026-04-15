/**
 * /projekte — legacy redirect to /projects (URL moved to English).
 * Query parameters are preserved.
 */

import { redirect } from "next/navigation";

export default async function ProjekteRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = Object.entries(sp)
    .flatMap(([k, v]) =>
      v === undefined
        ? []
        : Array.isArray(v)
          ? v.map((vi) => [k, vi] as const)
          : [[k, v] as const],
    )
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  redirect(qs ? `/projects?${qs}` : "/projects");
}
