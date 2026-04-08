import { buildDeclarativeConnector, matchTopicByKeywords } from "./framework";

/**
 * ClinicalTrials.gov v2 API — Currently recruiting interventional studies.
 *
 * Public, no-auth REST API run by the US National Library of Medicine.
 * We fetch recently-posted trials that are RECRUITING, sort them by last
 * updated, and treat each one as a single mention signal. High-phase trials
 * (Phase 3, Phase 4) get a higher raw strength because they're closer to
 * real-world impact than Phase 1 safety studies.
 *
 * Endpoint: https://clinicaltrials.gov/api/v2/studies
 * Docs:     https://clinicaltrials.gov/data-api/api
 */

interface CtStudyProtocolSection {
  identificationModule?: {
    nctId?: string;
    briefTitle?: string;
    officialTitle?: string;
  };
  statusModule?: {
    overallStatus?: string;
    lastUpdatePostDateStruct?: { date?: string };
    startDateStruct?: { date?: string };
  };
  conditionsModule?: {
    conditions?: string[];
    keywords?: string[];
  };
  designModule?: {
    phases?: string[];
    studyType?: string;
  };
  descriptionModule?: {
    briefSummary?: string;
  };
}

interface CtStudy {
  protocolSection?: CtStudyProtocolSection;
}

interface CtResponse {
  studies: CtStudy[];
  nextPageToken?: string;
}

// Map condition keywords to SIS trend topics.
const CONDITION_TOPICS: ReadonlyArray<readonly [readonly string[], string]> = [
  [["cancer", "tumor", "oncolog", "lymphoma", "leukemia", "melanoma"], "Health, Biotech & Longevity"],
  [["alzheimer", "dementia", "parkinson", "neurodegener"],               "Health, Biotech & Longevity"],
  [["obesity", "diabet", "metabolic"],                                    "Health, Biotech & Longevity"],
  [["covid", "sars-cov", "influenza", "pandemic", "virus", "outbreak"],   "Health, Biotech & Longevity"],
  [["gene therapy", "crispr", "mrna", "stem cell"],                       "Health, Biotech & Longevity"],
  [["mental", "depression", "anxiety", "psychiatric"],                    "Mental Health"],
  [["vaccine", "immuniz"],                                                "Health, Biotech & Longevity"],
  [["longevity", "aging", "senolytic"],                                   "Health, Biotech & Longevity"],
];

// Phase → strength boost. A Phase 3 trial is operationally more meaningful
// than a Phase 1 safety study; a Phase 4 post-market study often reflects
// regulatory shifts.
function phaseStrength(phases: string[] | undefined): number {
  if (!phases || phases.length === 0) return 0.25;
  const joined = phases.join(" ").toUpperCase();
  if (joined.includes("PHASE4") || joined.includes("PHASE 4")) return 0.9;
  if (joined.includes("PHASE3") || joined.includes("PHASE 3")) return 0.75;
  if (joined.includes("PHASE2") || joined.includes("PHASE 2")) return 0.5;
  if (joined.includes("PHASE1") || joined.includes("PHASE 1")) return 0.35;
  return 0.3;
}

interface Row {
  nctId: string;
  title: string;
  conditions: string;
  phases?: string[];
  updatedAt?: string;
  signalTitle: string;
  phaseStrength: number;
  rawData: Record<string, unknown>;
}

// Use a POST-style JSON fetch against the v2 search endpoint.
const ENDPOINT =
  "https://clinicaltrials.gov/api/v2/studies" +
  "?filter.overallStatus=RECRUITING" +
  "&sort=LastUpdatePostDate:desc" +
  "&pageSize=100" +
  "&format=json";

// Wrap with a pre-processing step: the raw response is { studies: [...] }.
// We extract studies via rowsPath="studies" and then map each study.
export const clinicaltrialsConnector = buildDeclarativeConnector<CtStudy>({
  name: "clinicaltrials",
  displayName: "ClinicalTrials.gov",
  endpoint: ENDPOINT,
  rowsPath: "studies",
  defaultTopic: "Health, Biotech & Longevity",
  defaultSignalType: "mention",
  minStrength: 0.3,
  limit: 100,
  map: (study) => {
    const ps = study.protocolSection;
    if (!ps) return null;
    const id = ps.identificationModule?.nctId;
    const title = ps.identificationModule?.briefTitle ?? ps.identificationModule?.officialTitle;
    if (!id || !title) return null;

    const conditions = ps.conditionsModule?.conditions ?? [];
    const keywords = ps.conditionsModule?.keywords ?? [];
    const phases = ps.designModule?.phases;
    const updatedAt = ps.statusModule?.lastUpdatePostDateStruct?.date;

    const searchable = [title, conditions.join(" "), keywords.join(" "), ps.descriptionModule?.briefSummary ?? ""].join(" ");
    const topic = matchTopicByKeywords(searchable, CONDITION_TOPICS);
    if (!topic) return null; // Skip trials outside our SIS trend mapping

    const strength = phaseStrength(phases);
    const phaseLabel = phases && phases.length > 0 ? phases.join("/") : "N/A";

    return {
      sourceUrl: `https://clinicaltrials.gov/study/${id}`,
      sourceTitle: `[${phaseLabel}] ${title}${conditions.length > 0 ? ` — ${conditions.slice(0, 2).join(", ")}` : ""}`,
      topic,
      rawStrength: strength,
      detectedAt: updatedAt ? new Date(updatedAt) : new Date(),
      rawData: {
        nctId: id,
        phases,
        conditions,
        studyType: ps.designModule?.studyType,
      },
    };
  },
});
