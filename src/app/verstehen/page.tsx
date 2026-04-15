/**
 * /verstehen — legacy redirect to /cockpit.
 *
 * The route was renamed to match the UI label "Knowledge Cockpit". Existing
 * bookmarks, deep links and documents pointing to /verstehen keep working
 * via this redirect. Query parameters (e.g. ?tab=signale) are preserved.
 */

import { redirect } from "next/navigation";

export default async function VerstehenRedirect({
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
  redirect(qs ? `/cockpit?${qs}` : "/cockpit");
}
