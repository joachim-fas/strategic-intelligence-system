"use client";

/**
 * /briefing — briefing landing with optional ?id= query param.
 *
 * Post-Welle-A-Item-3, the canonical shareable URL is
 * `/briefing/{slug}-{hash}` (see `./[slugHash]/page.tsx`). This route
 * stays for two reasons:
 *   1. Backward compat for existing `?id=N` links shared in documents.
 *      We transparently redirect (via `router.replace`) to the new
 *      canonical URL on mount, so the visible URL cleans itself up.
 *   2. A canonical landing without a specific briefing selected:
 *      `/briefing` on its own renders the first demo briefing with
 *      the full navigator listing every other one.
 *
 * The rendering itself lives in `./BriefingView.tsx` — this file is
 * now just the URL-parsing + redirect shim.
 */

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEMO_BRIEFINGS } from "@/lib/demo-briefings";
import { briefingUrl } from "@/lib/briefing-url";
import { useLocale } from "@/lib/locale-context";
import { BriefingView } from "./BriefingView";

function BriefingIndexContent() {
  const { locale } = useLocale();
  const de = locale === "de";
  const router = useRouter();
  const params = useSearchParams();

  const idx = parseInt(params.get("id") ?? "0", 10);
  const clampedIdx = Number.isNaN(idx) ? 0 : Math.min(Math.max(0, idx), DEMO_BRIEFINGS.length - 1);
  const entry = DEMO_BRIEFINGS[clampedIdx];

  // If a legacy `?id=N` URL was used, promote to the new canonical
  // slug-hash URL on mount. `router.replace` — no extra history entry,
  // no page reload. We only redirect when the query param is actually
  // present; a bare `/briefing` lands here and renders the first entry
  // without ever changing the URL.
  useEffect(() => {
    if (!entry) return;
    if (params.get("id") == null) return;
    const href = briefingUrl(entry);
    router.replace(href);
  }, [entry, params, router]);

  if (!entry) {
    return (
      <div style={{ padding: 40 }}>
        {de ? "Kein Briefing verfügbar" : "No briefing available"}
      </div>
    );
  }

  return <BriefingView entry={entry} siblings={DEMO_BRIEFINGS} />;
}

export default function BriefingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading…</div>}>
      <BriefingIndexContent />
    </Suspense>
  );
}
