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

const INDICATION_TOPICS: ReadonlyArray<readonly [readonly string[], string]> = [
  [["cancer", "neoplasm", "carcinoma", "lymphoma", "leukemia"], "Health, Biotech & Longevity"],
  [["diabetes", "obesity", "metabolic", "weight"],               "Health, Biotech & Longevity"],
  [["alzheimer", "dementia", "parkinson"],                       "Health, Biotech & Longevity"],
  [["depression", "anxiety", "psychiatric", "bipolar"],          "Mental Health"],
  [["covid", "viral", "infection"],                              "Health, Biotech & Longevity"],
  [["cardiovascular", "heart", "hypertension"],                  "Health, Biotech & Longevity"],
  [["autoimmune", "lupus", "arthritis", "inflammatory"],         "Health, Biotech & Longevity"],
];

export const openFdaConnector = buildDeclarativeConnector<FdaEventResult>({
  name: "openfda",
  displayName: "OpenFDA (Drug Events)",
  endpoint:
    "https://api.fda.gov/drug/event.json" +
    "?search=receivedate:[20260201+TO+20270101]" +
    "&limit=100",
  rowsPath: "results",
  defaultTopic: "Health, Biotech & Longevity",
  defaultSignalType: "mention",
  minStrength: 0.25,
  limit: 100,
  map: (e) => {
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
});
