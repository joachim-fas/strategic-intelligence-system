import { buildDeclarativeConnector, matchTopicByKeywords } from "./framework";

/**
 * Nextstrain — Pathogen phylogenetics + outbreak snapshots.
 *
 * Open-source, no-auth. Nextstrain publishes real-time phylogenetic
 * analyses of viral pathogens (SARS-CoV-2, flu, mpox, measles, …). Each
 * "dataset" tracks a pathogen over time. We fetch the dataset index and
 * treat each active dataset as a mention signal; recently-updated datasets
 * score higher.
 *
 * Endpoint: https://data.nextstrain.org/datasets.json
 * Docs:     https://docs.nextstrain.org/
 */

interface NextstrainDataset {
  name: string;
  url?: string;
  lastUpdated?: string; // ISO
  lastModified?: string;
  narrative?: string;
  groups?: string[];
  description?: string;
}

type NextstrainIndex = NextstrainDataset[] | { datasets?: NextstrainDataset[] };

const PATHOGEN_TOPICS: ReadonlyArray<readonly [readonly string[], string]> = [
  [["ncov", "sars-cov-2", "coronavirus", "covid"], "Health, Biotech & Longevity"],
  [["flu", "h5n1", "h1n1", "influenza", "bird flu", "avian"], "Health, Biotech & Longevity"],
  [["measles", "mpox", "monkeypox", "ebola", "zika", "dengue"], "Health, Biotech & Longevity"],
  [["tb", "tuberculosis", "malaria", "cholera"], "Health, Biotech & Longevity"],
  [["rsv", "norovirus", "rotavirus"], "Health, Biotech & Longevity"],
];

function ageBoostStrength(iso: string | undefined): number {
  if (!iso) return 0.3;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return 0.3;
  const days = (Date.now() - ts) / 86_400_000;
  if (days < 7) return 0.9;
  if (days < 30) return 0.7;
  if (days < 90) return 0.5;
  if (days < 180) return 0.35;
  return 0.2;
}

export const nextstrainConnector = buildDeclarativeConnector<NextstrainDataset>({
  name: "nextstrain",
  displayName: "Nextstrain (Pathogen Tracking)",
  endpoint: "https://data.nextstrain.org/datasets.json",
  // The response is either a top-level array OR an object with a "datasets" key —
  // we point rowsPath at the object case and the framework's extractRows falls
  // back to the top-level array when "datasets" is missing.
  rowsPath: "datasets",
  defaultTopic: "Health, Biotech & Longevity",
  defaultSignalType: "mention",
  minStrength: 0.3,
  limit: 80,
  map: (ds) => {
    if (!ds.name) return null;
    const haystack = [ds.name, ds.description ?? "", (ds.groups ?? []).join(" ")].join(" ");
    const topic = matchTopicByKeywords(haystack, PATHOGEN_TOPICS);
    if (!topic) return null;

    const strength = ageBoostStrength(ds.lastUpdated ?? ds.lastModified);

    return {
      sourceUrl: ds.url ?? `https://nextstrain.org/${ds.name.replace(/^\//, "")}`,
      sourceTitle: `Nextstrain: ${ds.name}${ds.description ? ` — ${ds.description.slice(0, 80)}` : ""}`,
      topic,
      rawStrength: strength,
      detectedAt: ds.lastUpdated ? new Date(ds.lastUpdated) : new Date(),
      rawData: {
        dataset: ds.name,
        groups: ds.groups,
        lastUpdated: ds.lastUpdated,
      },
    };
  },
});
