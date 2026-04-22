/**
 * synthesis-only-Collapse-Detection für LLM-Responses.
 *
 * Pilot-Eval 2026-04-22 aufgedeckt: Claude Sonnet 4.5 ignoriert den
 * „Zero-Signal-Fallback"-Guard im System-Prompt nicht-deterministisch
 * und antwortet bei strategischen Fragen manchmal nur mit dem
 * `synthesis`-Feld, während alle strukturierten Felder (scenarios,
 * keyInsights, references, decisionFramework, causalChain) leer
 * bleiben.
 *
 * Diese Utility erkennt das Muster nach erfolgter LLM-Response,
 * damit die Route einen gezielten Retry mit Verstärkungs-Message
 * triggern kann. Pure function — testbar ohne Seiteneffekte.
 */

export interface CollapseCandidate {
  synthesis?: unknown;
  scenarios?: unknown;
  keyInsights?: unknown;
  references?: unknown;
  decisionFramework?: unknown;
  causalChain?: unknown;
  reasoningChains?: unknown;
  followUpQuestions?: unknown;
}

export interface CollapseDetectionResult {
  /** True wenn der Retry sinnvoll ist. */
  collapsed: boolean;
  /** Welche konkreten Felder leer sind. Für Logging + Retry-Prompt. */
  missingFields: string[];
  /** Warum kein Retry getriggert wird, wenn collapsed=false. */
  reason?: string;
}

/**
 * Ermittelt, ob die Response dem synthesis-only-Collapse-Pattern
 * entspricht — also: substantielle Synthesis-Prosa UND mindestens
 * zwei kritische Strukturfelder komplett leer.
 *
 * Die Schwelle `synthesis.length > 500` trennt strategische
 * Fragen von trivial-faktischen („Wer ist X?"-Antworten haben
 * natürlicherweise kurze Synthesis und leere Szenarien — das ist
 * kein Collapse, sondern der erwartete Zustand).
 *
 * Wir schließen `scenarios` explizit aus, weil die Empty-Object-
 * Form (`{}`) ein legitimer Escape-Hatch für faktische Queries
 * ist — die anderen Felder haben keine solche Ausnahme.
 */
export function detectSynthesisOnlyCollapse(
  result: CollapseCandidate,
): CollapseDetectionResult {
  const synthesisLen =
    typeof result.synthesis === "string" ? result.synthesis.length : 0;

  // Threshold: trivial-faktische Antworten haben typisch ≤ 300 Zeichen
  // synthesis. 500 als konservative Grenze — lieber einen Edge-Case
  // zu viel retryen als einen echten Collapse durchlassen.
  if (synthesisLen <= 500) {
    return {
      collapsed: false,
      missingFields: [],
      reason: "synthesis too short — likely trivial-factual query",
    };
  }

  const isEmpty = (v: unknown): boolean => {
    if (v === null || v === undefined) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === "object") return Object.keys(v as object).length === 0;
    if (typeof v === "string") return v.trim().length === 0;
    return false;
  };

  const checks: Array<{ field: keyof CollapseCandidate; label: string }> = [
    { field: "scenarios", label: "scenarios" },
    { field: "keyInsights", label: "keyInsights" },
    { field: "references", label: "references" },
    { field: "decisionFramework", label: "decisionFramework" },
    { field: "causalChain", label: "causalChain" },
    { field: "reasoningChains", label: "reasoningChains" },
    { field: "followUpQuestions", label: "followUpQuestions" },
  ];

  const missingFields: string[] = [];
  for (const { field, label } of checks) {
    if (isEmpty(result[field])) missingFields.push(label);
  }

  // Retry-Trigger: mindestens 3 kritische Strukturfelder leer.
  // Bei 1-2 fehlenden Feldern ist das eher domänenspezifisch (z.B.
  // faktische Frage ohne Szenarien) und kein echter Collapse.
  //
  // Die 3 wichtigsten Felder: scenarios, keyInsights, references.
  // Wenn alle drei leer sind bei langer synthesis, ist es ein Collapse.
  const criticalMissing = missingFields.filter((f) =>
    ["scenarios", "keyInsights", "references"].includes(f),
  );

  if (criticalMissing.length < 3) {
    return {
      collapsed: false,
      missingFields,
      reason: `only ${criticalMissing.length}/3 critical fields missing — not a collapse`,
    };
  }

  return {
    collapsed: true,
    missingFields,
  };
}

/**
 * Baut die Verstärkungs-User-Message für den Retry-Call. Der Text
 * ist deliberately scharf formuliert — vorherige Guard-Verletzungen
 * zeigen, dass höfliche Formulierungen („bitte…") nicht reichen.
 *
 * Der Retry ist KEINE neue Frage — wir wollen dieselbe Analyse,
 * aber mit gefüllten strukturierten Feldern. Die Message macht
 * das explizit.
 */
export function buildCollapseRetryMessage(
  missingFields: string[],
  locale: "de" | "en",
): string {
  const fieldList = missingFields.join(", ");

  if (locale === "de") {
    return `Ihre vorherige Antwort verletzt den HARD-CONTRACT aus dem System-Prompt: Sie haben nur das \`synthesis\`-Feld gefüllt und die folgenden strukturierten Pflichtfelder leer gelassen: ${fieldList}.

Wiederholen Sie dieselbe Analyse — gleiche Kernaussagen, gleiche Positionierung, gleiche Akteur-Aufzählung —, aber liefern Sie diesmal das VOLLSTÄNDIGE JSON-Schema aus dem System-Prompt. Füllen Sie:
- \`scenarios\`: drei Szenarien (optimistic/likely/pessimistic) mit probability-Werten, die in Summe ~100 ergeben, mit keyAssumptions und earlyIndicators je Szenario.
- \`keyInsights\`: mindestens drei konkrete Insights mit Provenance-Tags.
- \`references\`: mindestens drei authoritative Publikationen (nur Titel/Quelle/Datum, KEINE URLs erfinden).
- \`decisionFramework\`: 3-5 konkrete Entscheidungspunkte.
- \`causalChain\`, \`regulatoryContext\`, \`reasoningChains\`, \`followUpQuestions\`: ebenfalls befüllen.

Da die Live-Signale dünn sind, verwenden Sie \`[LLM-KNOWLEDGE]\`-Tags als Provenance. Das ist explizit erlaubt und im System-Prompt vorgesehen. Eine leere Struktur ist NICHT akzeptabel. Antworten Sie NUR mit dem kompletten JSON-Objekt, kein Freitext davor oder danach.`;
  }

  return `Your previous response violates the HARD-CONTRACT from the system prompt: you only filled the \`synthesis\` field and left the following required structured fields empty: ${fieldList}.

Repeat the same analysis — same core claims, same positioning, same actor enumeration — but this time deliver the COMPLETE JSON schema from the system prompt. Fill:
- \`scenarios\`: three scenarios (optimistic/likely/pessimistic) with probability values summing to ~100, with keyAssumptions and earlyIndicators each.
- \`keyInsights\`: at least three concrete insights with provenance tags.
- \`references\`: at least three authoritative publications (titles/source/date only, NEVER invent URLs).
- \`decisionFramework\`: 3-5 concrete decision points.
- \`causalChain\`, \`regulatoryContext\`, \`reasoningChains\`, \`followUpQuestions\`: fill these as well.

Since live signals are sparse, use \`[LLM-KNOWLEDGE]\` tags as provenance. This is explicitly allowed and provided for in the system prompt. An empty structure is NOT acceptable. Reply ONLY with the complete JSON object, no prose before or after.`;
}
