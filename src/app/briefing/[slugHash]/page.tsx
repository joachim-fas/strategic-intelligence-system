"use client";

/**
 * /briefing/{slug}-{hash} — canonical shareable URL for a briefing.
 *
 * Welle A Item 3 of the 4-app Deep-Dive (Theia-pattern). Looks up a
 * demo briefing by matching the content hash against every entry in
 * the registry — slug is informational and for URL readability, the
 * hash is the actual identity.
 *
 * If the hash doesn't match any briefing, we fall back to matching by
 * slug (in case someone has a stale URL after content was rewritten).
 * That gives a graceful-degradation path: the user still lands on a
 * page that makes sense, just with a note that the URL is stale. For
 * now we keep it silent and just render the best match — a proper
 * "content has changed since you bookmarked this" banner is out of
 * scope for the MVP routing change.
 */

import { Suspense, useMemo } from "react";
import { useParams } from "next/navigation";
import { DEMO_BRIEFINGS } from "@/lib/demo-briefings";
import { briefingHash, parseBriefingSlugHash } from "@/lib/briefing-url";
import { useLocale } from "@/lib/locale-context";
import { BriefingView } from "../BriefingView";

function BriefingSlugHashContent() {
  const { locale } = useLocale();
  const de = locale === "de";
  const params = useParams<{ slugHash: string }>();
  const raw = typeof params?.slugHash === "string" ? params.slugHash : "";

  const match = useMemo(() => {
    const parsed = parseBriefingSlugHash(raw);
    if (!parsed) return null;

    // Primary lookup: find the briefing whose content hash matches.
    // This is the source of truth — slug is decorative.
    const byHash = DEMO_BRIEFINGS.find(
      (b) => briefingHash(b.query, (b.briefing as any).synthesis ?? "") === parsed.hash,
    );
    if (byHash) return byHash;

    // Fallback: if the hash doesn't match any entry (e.g. the URL was
    // shared before content was rewritten), try matching by id. This
    // keeps old links working on a best-effort basis.
    return DEMO_BRIEFINGS.find((b) => b.id === parsed.slug) ?? null;
  }, [raw]);

  if (!match) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>
          {de ? "Briefing nicht gefunden" : "Briefing not found"}
        </h1>
        <p style={{ color: "var(--color-text-muted)", marginBottom: 16 }}>
          {de
            ? "Der URL-Hash passt zu keinem bekannten Briefing. Vielleicht wurde der Inhalt überarbeitet."
            : "The URL hash doesn't match any known briefing. The content may have been rewritten."}
        </p>
        <a
          href="/briefing"
          style={{
            fontSize: 13, padding: "8px 16px", borderRadius: 8,
            border: "1px solid var(--volt-border, #E8E8E8)",
            color: "var(--volt-text, #0A0A0A)", textDecoration: "none",
            fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
          }}
        >
          {de ? "← Zu allen Briefings" : "← Back to all briefings"}
        </a>
      </div>
    );
  }

  return <BriefingView entry={match} siblings={DEMO_BRIEFINGS} />;
}

export default function BriefingSlugHashPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading…</div>}>
      <BriefingSlugHashContent />
    </Suspense>
  );
}
