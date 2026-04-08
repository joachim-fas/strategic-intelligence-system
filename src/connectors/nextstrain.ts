import { buildDeclarativeConnector, matchTopicByKeywords } from "./framework";

/**
 * Nextstrain — Pathogen phylogenetics catalog.
 *
 * Nextstrain hosts real-time phylogenetic analyses of viral pathogens
 * (SARS-CoV-2, avian flu, mpox, measles, …). The public Charon API lists
 * all available datasets. Each dataset represents an actively-tracked
 * pathogen or a sub-clade.
 *
 * The correct listing endpoint (discovered 2026-04-08 during a smoke test
 * that caught the previously-assumed `data.nextstrain.org/datasets.json`
 * returning 404):
 *
 *   https://nextstrain.org/charon/getAvailable?prefix=/
 *
 * Response shape:
 *   { datasets: [{ request: "ncov/open/global/6m", snapshots, secondTreeOptions, buildUrl }, ...] }
 *
 * The top-level listing does NOT include last-updated timestamps — for that
 * we would need to call `getDataset?prefix=<path>` per entry, which is
 * expensive. We instead treat each listed dataset as a "mention" signal with
 * a flat strength based on the pathogen type (high-impact clades get
 * slightly higher strength).
 */

interface CharonDataset {
  request: string;                // e.g. "ncov/open/global/6m"
  snapshots?: unknown;
  secondTreeOptions?: string[];
  buildUrl?: string | null;
}

type CharonResponse = { datasets?: CharonDataset[] };

// Pathogen keyword → SIS trend topic. All pathogens currently subsume into
// "Health, Biotech & Longevity" — the DB does not yet distinguish specific
// outbreak trends. The pathogen family is preserved in rawData for
// downstream analysis.
const PATHOGEN_KEYWORDS: ReadonlyArray<readonly [readonly string[], string]> = [
  [["ncov", "sars-cov", "coronavirus", "covid"],           "Health, Biotech & Longevity"],
  [["avian-flu", "h5n1", "h1n1", "influenza", "flu"],      "Health, Biotech & Longevity"],
  [["mpox", "monkeypox", "measles", "ebola", "zika"],      "Health, Biotech & Longevity"],
  [["dengue", "yellow-fever", "chikungunya"],              "Health, Biotech & Longevity"],
  [["tb", "tuberculosis", "malaria", "cholera"],           "Health, Biotech & Longevity"],
  [["rsv", "norovirus", "rotavirus"],                      "Health, Biotech & Longevity"],
  [["oropouche", "west-nile", "rabies"],                   "Health, Biotech & Longevity"],
];

// High-concern clade patterns → boost strength. The rest get a baseline of 0.35.
function pathogenStrength(path: string): number {
  const p = path.toLowerCase();
  if (p.includes("h5n1") || p.includes("cattle-outbreak")) return 0.85; // active zoonotic
  if (p.includes("ncov")) return 0.7;                                     // ongoing global
  if (p.includes("mpox")) return 0.65;                                    // recent outbreak
  if (p.includes("avian")) return 0.6;                                    // influenza surveillance
  if (p.includes("measles")) return 0.5;                                  // vaccination gap indicator
  if (p.includes("dengue") || p.includes("zika")) return 0.45;
  return 0.35;
}

// Pretty-print the Charon dataset path as a human-readable title.
//   "ncov/open/global/6m" → "SARS-CoV-2 · global · 6 months"
//   "avian-flu/h5n1-cattle-outbreak/genome" → "Avian Flu · H5N1 cattle outbreak · genome"
function prettyTitle(path: string): string {
  const parts = path.replace(/^\//, "").split("/");
  const headMap: Record<string, string> = {
    "ncov": "SARS-CoV-2",
    "avian-flu": "Avian Flu",
    "mpox": "Mpox",
    "measles": "Measles",
    "dengue": "Dengue",
    "zika": "Zika",
    "ebola": "Ebola",
    "tb": "Tuberculosis",
    "flu": "Influenza",
    "rsv": "RSV",
    "oropouche": "Oropouche",
    "yellow-fever": "Yellow Fever",
  };
  const head = headMap[parts[0]] ?? parts[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const rest = parts.slice(1).map((p) => p.replace(/-/g, " ")).join(" · ");
  return rest ? `Nextstrain: ${head} · ${rest}` : `Nextstrain: ${head}`;
}

export const nextstrainConnector = buildDeclarativeConnector<CharonDataset>({
  name: "nextstrain",
  displayName: "Nextstrain (Pathogen Tracking)",
  endpoint: "https://nextstrain.org/charon/getAvailable?prefix=/",
  rowsPath: "datasets",
  defaultTopic: "Health, Biotech & Longevity",
  defaultSignalType: "mention",
  minStrength: 0.3,
  limit: 120,
  map: (ds) => {
    const path = ds.request;
    if (!path || typeof path !== "string") return null;

    // Skip sub-segments (e.g. the individual gene trees of a cattle outbreak
    // build) — we only want the parent genome entry. Heuristic: keep paths
    // that end in "/genome", "/6m", "/2y", "/global", or are one segment.
    const segments = path.split("/");
    const tail = segments[segments.length - 1];
    const isAggregate =
      segments.length === 1 ||
      tail === "genome" ||
      tail === "global" ||
      /^\d+[mwy]$/.test(tail); // "6m", "2y", etc.
    if (!isAggregate && segments.length > 2) return null;

    const topic = matchTopicByKeywords(path, PATHOGEN_KEYWORDS);
    if (!topic) return null;

    return {
      sourceUrl: `https://nextstrain.org/${path}`,
      sourceTitle: prettyTitle(path),
      topic,
      rawStrength: pathogenStrength(path),
      detectedAt: new Date(),
      rawData: {
        path,
        segments,
        buildUrl: ds.buildUrl ?? null,
      },
    };
  },
});
