import { buildDeclarativeConnector, matchTopicByKeywords } from "./framework";

/**
 * OpenFDA — Drug approval events.
 *
 * US Food & Drug Administration open data. Public REST API, no auth. We
 * query the drug-event endpoint for recent drug events reported in the last
 * 60 days, which surfaces newly-marketed compounds and adverse-event trends.
 *
 * Endpoint: https://api.fda.gov/drug/event.json
 * Docs:     https://open.fda.gov/apis/drug/event/
 */

interface FdaEventResult {
  receivedate?: string;
  safetyreportid?: string;
  serious?: string;
  seriousnessdeath?: string;
  patient?: {
    drug?: Array<{
      medicinalproduct?: string;
      drugindication?: string;
      drugcharacterization?: string;
    }>;
    reaction?: Array<{ reactionmeddrapt?: string }>;
  };
}

interface FdaResponse {
  results?: FdaEventResult[];
}

// Indication keyword → SIS trend topic. All indications currently subsume
// into "Health, Biotech & Longevity" until/unless the DB grows dedicated
// sub-categories (Mental Health, Cardiovascular, etc.).
const INDICATION_TOPICS: ReadonlyArray<readonly [readonly string[], string]> = [
  [["cancer", "neoplasm", "carcinoma", "lymphoma", "leukemia"], "Health, Biotech & Longevity"],
  [["diabetes", "obesity", "metabolic", "weight"],               "Health, Biotech & Longevity"],
  [["alzheimer", "dementia", "parkinson"],                       "Health, Biotech & Longevity"],
  [["depression", "anxiety", "psychiatric", "bipolar"],          "Health, Biotech & Longevity"],
  [["covid", "viral", "infection"],                              "Health, Biotech & Longevity"],
  [["cardiovascular", "heart", "hypertension"],                  "Health, Biotech & Longevity"],
  [["autoimmune", "lupus", "arthritis", "inflammatory"],         "Health, Biotech & Longevity"],
];

// Last 12 months window. OpenFDA has ~1.3M+ drug events; we take the most
// recent slice. The `[` and `]` in the date range must be URL-encoded or
// curl/fetch will reject the URL client-side — that bug cost us an entire
// smoke test before we spotted it.
function lastYearRange(): string {
  const end = new Date();
  const start = new Date(end.getTime() - 365 * 86_400_000);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `${fmt(start)}+TO+${fmt(end)}`;
}

// Build the endpoint URL fresh each time it's accessed so the date range
// is never stale (was previously computed once at module load).
const openFdaConfig = {
  name: "openfda",
  displayName: "OpenFDA (Drug Events)",
  get endpoint() {
    return (
      "https://api.fda.gov/drug/event.json" +
      `?search=receivedate:%5B${lastYearRange()}%5D` +
      "&limit=100"
    );
  },
  rowsPath: "results",
  defaultTopic: "Health, Biotech & Longevity",
  defaultSignalType: "mention" as const,
  minStrength: 0.25,
  limit: 100,
  map: (e: FdaEventResult) => {
    const drugs = e.patient?.drug ?? [];
    const reactions = e.patient?.reaction ?? [];
    if (drugs.length === 0) return null;
    const primary = drugs.find((d) => d.drugcharacterization === "1") ?? drugs[0];
    const drugName = primary?.medicinalproduct;
    if (!drugName) return null;

    const indication = primary?.drugindication ?? "";
    const reactionText = reactions.map((r) => r.reactionmeddrapt).filter(Boolean).join(", ");

    const topic = matchTopicByKeywords(
      `${indication} ${reactionText}`,
      INDICATION_TOPICS,
    );
    if (!topic) return null;

    // Seriousness → strength. Death = 1.0, serious = 0.6, non-serious = 0.3.
    let strength = 0.3;
    if (e.seriousnessdeath === "1") strength = 0.95;
    else if (e.serious === "1") strength = 0.6;

    const dateRaw = e.receivedate; // YYYYMMDD
    const detectedAt =
      dateRaw && dateRaw.length === 8
        ? new Date(`${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`)
        : new Date();

    return {
      sourceUrl: `https://api.fda.gov/drug/event.json?search=safetyreportid:${e.safetyreportid ?? ""}`,
      sourceTitle: `${drugName}${indication ? ` · ${indication}` : ""}${reactionText ? ` — ${reactionText.slice(0, 80)}` : ""}`,
      topic,
      rawStrength: strength,
      detectedAt,
      rawData: {
        reportId: e.safetyreportid,
        drugName,
        indication,
        reactions: reactionText,
        serious: e.serious === "1",
        death: e.seriousnessdeath === "1",
      },
    };
  },
};

export const openFdaConnector = buildDeclarativeConnector<FdaEventResult>(openFdaConfig);
