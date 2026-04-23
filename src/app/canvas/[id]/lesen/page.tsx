"use client";

/**
 * /canvas/[id]/lesen — linear long-form read view of a project.
 *
 * Renders every saved briefing of the project using the FULL
 * BriefingResult component (KPI tiles, Coverage-Health-Box, Live-Signale,
 * Szenarien-Cards, Erkenntnisse, Quellen, Live-Signale — alles).
 *
 * 2026-04-23 user-request: "Man kommt, wenn man in den Canvas gewechselt
 * hat, nie wieder zu dieser Ansicht. Ich fände es ganz praktisch, wenn
 * man sich auch das komplette Projekt in diesem Layout wieder ansehen
 * könnte." Plus eine kleine TOC-Navigation für lange Dokumente.
 *
 * Unterscheidet sich von /canvas/[id]/zusammenfassung — letzteres ist
 * die kompakte Plain-Text-Stack-Ansicht. /lesen ist die voll-feature-
 * reiche Ansicht.
 */

import { use } from "react";
import ReadView from "@/components/sessions/ReadView";

export default function LesenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ReadView projectId={id} />;
}
