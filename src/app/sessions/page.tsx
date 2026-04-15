/**
 * /sessions — legacy redirect to /projects.
 *
 * The route was renamed to match the UI label "Projekte" / "Projects" and
 * consolidated into English. Existing bookmarks and internal links pointing
 * to /sessions keep working via this redirect. Query parameters are preserved.
 */

import { redirect } from "next/navigation";

export default async function SessionsRedirect({
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
