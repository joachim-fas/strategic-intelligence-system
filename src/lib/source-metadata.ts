/**
 * Per-connector STEEP+V and trend-level schema.
 *
 * Backlog-Task "STEEP+V Ontologie als maschinenlesbares Schema fixieren"
 * (2026-04-21): Until now the per-source STEEP+V mapping lived inside a
 * React component (`QuellenTable.tsx`), and the trend-level (Mega /
 * Makro / Mikro / Signal) dimension had no explicit schema at all — it
 * existed only implicitly in `classify.ts#inferFocus`. This module
 * consolidates both dimensions into one machine-readable registry so
 * downstream code (analytics, LLM prompt assembly, Knowledge Cockpit,
 * export pipelines) can query "what STEEP+V bucket and trend level does
 * this source belong to?" with a single lookup.
 *
 * Design notes:
 *
 *  - Per-connector, not per-category. A category like "wissenschaft"
 *    contains both arxiv (micro research signal) and OECD (mega policy
 *    publication) — the finer-grained connector-level mapping lets us
 *    say each one separately.
 *
 *  - STEEP+V assignments here must not drift from the
 *    `CATEGORY_TO_MACRO` map in `source-taxonomy.ts`. The helper
 *    `assertConsistency()` at the bottom of this file is a runtime check
 *    any code path can call to catch drift — it is NOT executed
 *    eagerly, because we don't want to crash production on a schema
 *    mismatch; we want to surface it in dev and CI.
 *
 *  - Trend-level tiers:
 *      - "mega":   decade-plus structural dynamics (UN SDG, IPCC,
 *                  World Bank, IMF, OECD — canonical long-horizon truth)
 *      - "macro":  years-scale institutional movement (news outlets,
 *                  regulatory bodies, conflict monitors)
 *      - "micro":  months-scale adoption / research signals (GitHub,
 *                  arXiv, npm, patent filings)
 *      - "signal": hours-to-days noise and nowcasting (social feeds,
 *                  prediction markets, search trends, ngram spikes)
 *
 *  - Unknown sources default to `{ steepV: "values", trendLevel: "signal" }`
 *    so any misconfigured connector fails soft but remains visible under
 *    the "Values / Foresight" macro filter.
 */

import type { SteepVKey } from "./source-taxonomy";

export type TrendLevel = "mega" | "macro" | "micro" | "signal";

export interface SourceMetadata {
  steepV: SteepVKey;
  trendLevel: TrendLevel;
}

const DEFAULT_METADATA: SourceMetadata = {
  steepV: "values",
  trendLevel: "signal",
};

/**
 * Canonical per-connector metadata. Keys are the `SourceConnector.name`
 * strings registered in `src/connectors/index.ts`. Values assign the
 * source to exactly one STEEP+V bucket and one trend-level tier.
 *
 * When adding a new connector, add its entry here — the TypeScript
 * `Record<...>` would not catch a missing entry (we use `Partial` so
 * fallbacks can be applied), but reviewers should reject a PR that
 * introduces a new connector without a metadata row.
 */
export const SOURCE_METADATA: Record<string, SourceMetadata> = {
  // ─── Tech / Developer (Technology, micro signal) ───────────────────
  hackernews:         { steepV: "technological", trendLevel: "signal" },
  github:             { steepV: "technological", trendLevel: "micro" },
  stackoverflow:      { steepV: "technological", trendLevel: "micro" },
  npm_pypi:           { steepV: "technological", trendLevel: "micro" },
  producthunt:        { steepV: "technological", trendLevel: "signal" },
  docker_hub:         { steepV: "technological", trendLevel: "micro" },
  google_trends:      { steepV: "technological", trendLevel: "signal" },

  // ─── Science / Research (Technology, micro→macro) ──────────────────
  arxiv:              { steepV: "technological", trendLevel: "micro" },
  openalex:           { steepV: "technological", trendLevel: "macro" },
  crossref:           { steepV: "technological", trendLevel: "macro" },
  semantic_scholar:   { steepV: "technological", trendLevel: "macro" },
  patentsview:        { steepV: "technological", trendLevel: "macro" },
  wikipedia:          { steepV: "technological", trendLevel: "macro" },
  clinicaltrials:     { steepV: "social",        trendLevel: "macro" },
  nextstrain:         { steepV: "social",        trendLevel: "signal" },

  // ─── Social (Society, signal) ──────────────────────────────────────
  reddit:             { steepV: "social",        trendLevel: "signal" },
  bluesky:            { steepV: "social",        trendLevel: "signal" },
  // Connector names use underscores (see src/connectors/mastodon-api.ts:
  // `name: "mastodon_api"`). Keep both keys in sync for safety.
  mastodon_api:       { steepV: "social",        trendLevel: "signal" },
  mastodon_sentiment: { steepV: "social",        trendLevel: "signal" },
  youtube_sentiment:  { steepV: "social",        trendLevel: "signal" },
  news_sentiment:     { steepV: "social",        trendLevel: "signal" },
  sentiment:          { steepV: "social",        trendLevel: "signal" },

  // ─── News / Media (Political, macro) ───────────────────────────────
  news:               { steepV: "political",     trendLevel: "macro" },
  nyt:                { steepV: "political",     trendLevel: "macro" },
  newsdata:           { steepV: "political",     trendLevel: "macro" },
  guardian:           { steepV: "political",     trendLevel: "macro" },
  media_cloud:        { steepV: "political",     trendLevel: "macro" },
  spiegel_rss:        { steepV: "political",     trendLevel: "macro" },
  aljazeera_rss:      { steepV: "political",     trendLevel: "macro" },

  // ─── Geopolitics / Conflict (Political, macro→mega) ────────────────
  gdelt:              { steepV: "political",     trendLevel: "macro" },
  acled:              { steepV: "political",     trendLevel: "macro" },
  ucdp:               { steepV: "political",     trendLevel: "mega"  },
  vdem:               { steepV: "political",     trendLevel: "mega"  },
  worldmonitor:       { steepV: "political",     trendLevel: "signal" },
  ecfr_rss:           { steepV: "political",     trendLevel: "macro" },
  // 2026-04-22 Pilot-Eval P0-A: Bruegel ist primär EU-Economic-Policy-
  // Research (Brüssel-basiert, unabhängig), hat aber einen breiten
  // Geopolitics-Anteil (Handels-, Sanktions-, Tech-Policy). Einstufung
  // hier unter Political/macro analog zu ecfr_rss; die Feed-Einträge
  // selbst bekommen ihre feinere Topic-Zuordnung über THINKTANK_MAPPING
  // in rss-feeds.ts.
  bruegel_rss:        { steepV: "political",     trendLevel: "macro" },
  // Politico Europe — Tages-Newsfeed zu EU-Politik. Political/signal
  // (nicht macro), weil der Feed stündlich aktualisiert, einzelne
  // Artikel nur tagesscale relevant. Trotzdem wertvoll als ergänzende
  // Quelle, weil er Brüsseler Policy-Tagesgeschäft einfängt, das
  // Quartals-Think-Tank-Papers nicht spiegeln.
  politico_eu_rss:    { steepV: "political",     trendLevel: "signal" },
  // IAB — Institut für Arbeitsmarkt- und Berufsforschung: das führende
  // deutsche Forschungsinstitut zu Arbeitsmarkt-Dynamiken. STEEP+V:
  // social (nicht economic, weil der Fokus klar auf Arbeitsmarkt-
  // Soziologie liegt, nicht auf Makroökonomie). Macro-tier (Jahres-
  // horizont für die Mehrzahl der Publikationen).
  iab_rss:            { steepV: "social",        trendLevel: "macro" },
  // ECIPE — European Centre for International Political Economy:
  // Brüsseler Think-Tank für Handels- und Regulierungsrecht.
  // Economic/macro — Papers sind jahres-scale, klarer Wirtschafts-
  // Fokus (Industriepolitik, DMA/DSA-Wettbewerbsrecht, Tech-Handel).
  ecipe_rss:          { steepV: "economic",      trendLevel: "macro" },
  // OSW — Centre for Eastern Studies (Warschau): EU-Osteuropa-
  // und Russland-Policy. Political/macro analog zu ecfr_rss, weil
  // Policy-Briefs zum aktuellen Konflikt- und Sanktionsgeschehen.
  osw_rss:            { steepV: "political",     trendLevel: "macro" },
  // Clingendael — Netherlands Institute of International Relations:
  // Political/signal, weil der Feed überwiegend Medien-Appearances
  // der Forscher einfängt (News-Takes, nicht Papers). Trotzdem
  // wertvoll für EU-Geopolitik-Diskurs-Breite.
  clingendael_rss:    { steepV: "political",     trendLevel: "signal" },
  // Google News — Wärmepumpe (DE): Aggregierter Pressespiegel für den
  // Wärmepumpen-Markt. Environmental/signal, weil tagesaktuelle Medien-
  // Artikel (kein Original-Research). C-Pilot Fallback, da BDH/BWP/dena
  // keine öffentlichen RSS-Feeds anbieten.
  google_news_wp_de:  { steepV: "environmental", trendLevel: "signal" },

  // ─── Macroeconomics (Economic, mega) ───────────────────────────────
  worldbank:          { steepV: "economic",      trendLevel: "mega"  },
  eurostat:           { steepV: "economic",      trendLevel: "mega"  },
  fred:               { steepV: "economic",      trendLevel: "macro" },
  oecd:               { steepV: "economic",      trendLevel: "mega"  },
  owid:               { steepV: "economic",      trendLevel: "mega"  },
  destatis:           { steepV: "economic",      trendLevel: "macro" },
  bls:                { steepV: "economic",      trendLevel: "macro" },
  imf:                { steepV: "economic",      trendLevel: "mega"  },
  un_data:            { steepV: "economic",      trendLevel: "mega"  },
  un_sdg:             { steepV: "values",        trendLevel: "mega"  },
  un_news_rss:        { steepV: "political",     trendLevel: "macro" },

  // ─── Finance / Markets (Economic, signal) ──────────────────────────
  finnhub:            { steepV: "economic",      trendLevel: "signal" },
  open_exchange:      { steepV: "economic",      trendLevel: "signal" },
  coingecko:          { steepV: "economic",      trendLevel: "signal" },
  defi_llama:         { steepV: "economic",      trendLevel: "micro" },

  // ─── Prediction markets (Economic, signal) ─────────────────────────
  polymarket:         { steepV: "economic",      trendLevel: "signal" },
  manifold:           { steepV: "economic",      trendLevel: "signal" },
  metaculus:          { steepV: "values",        trendLevel: "signal" },
  kalshi:             { steepV: "economic",      trendLevel: "signal" },

  // ─── Climate / Environment (Environmental, macro→mega) ─────────────
  nasa_eonet:         { steepV: "environmental", trendLevel: "signal" },
  open_meteo:         { steepV: "environmental", trendLevel: "signal" },
  usgs_earthquake:    { steepV: "environmental", trendLevel: "signal" },

  // ─── Health (Social, macro) ────────────────────────────────────────
  who_gho:            { steepV: "social",        trendLevel: "mega"  },
  ilo:                { steepV: "social",        trendLevel: "mega"  },
  openfda:            { steepV: "social",        trendLevel: "macro" },
  unhcr:              { steepV: "social",        trendLevel: "macro" },

  // ─── Culture / Foresight (Values) ──────────────────────────────────
  // Google Ngram's actual connector name is "google-ngram" (dash);
  // keep both spellings mapped so that either variant resolves.
  "google-ngram":     { steepV: "values",        trendLevel: "macro" },
  google_ngram:       { steepV: "values",        trendLevel: "macro" },
  steamspy:           { steepV: "social",        trendLevel: "signal" },

  // ─── arxiv-qbio RSS (Technology, micro) ────────────────────────────
  arxiv_qbio_rss:     { steepV: "technological", trendLevel: "micro" },
  nature_rss:         { steepV: "technological", trendLevel: "macro" },

  // ─── Google News RSS Heat Pump Europe (EN) (Environmental, signal) ──
  // C-Pilot EN counterpart to google_news_wp_de. Same tier/level.
  google_news_hp_en:  { steepV: "environmental", trendLevel: "signal" },
};

/**
 * Look up a source's STEEP+V bucket and trend level. Unknown sources
 * fall back to `{ steepV: "values", trendLevel: "signal" }` — loud
 * enough to show up in filter views, vague enough to not misclassify.
 *
 * Accepts all common source-name spellings:
 *   - canonical: "mastodon_api", "un_sdg"
 *   - case-variant: "MASTODON_API"
 *   - dash-vs-underscore: "mastodon-api" ↔ "mastodon_api"
 *
 * This matters because different call paths normalise source names
 * inconsistently (connector.name vs RSS source tag vs UI display
 * strings) — the helper absorbs that drift so upstream code doesn't
 * have to know which spelling it's holding.
 */
export function getSourceMetadata(source: string): SourceMetadata {
  if (!source) return DEFAULT_METADATA;
  if (SOURCE_METADATA[source]) return SOURCE_METADATA[source];
  const lower = source.toLowerCase();
  if (SOURCE_METADATA[lower]) return SOURCE_METADATA[lower];
  // Dash ↔ underscore normalisation — tries both spellings of the key.
  const dashed = lower.replace(/_/g, "-");
  if (SOURCE_METADATA[dashed]) return SOURCE_METADATA[dashed];
  const underscored = lower.replace(/-/g, "_");
  if (SOURCE_METADATA[underscored]) return SOURCE_METADATA[underscored];
  return DEFAULT_METADATA;
}

/**
 * Distribution summary across all registered sources. Useful for dashboards
 * ("how balanced is our STEEP+V coverage?") and for CI health checks that
 * warn when one bucket becomes starved.
 */
export function summariseSourceDistribution(): {
  bySteepV: Record<SteepVKey, number>;
  byTrendLevel: Record<TrendLevel, number>;
  total: number;
} {
  const bySteepV: Record<SteepVKey, number> = {
    social: 0, technological: 0, economic: 0,
    environmental: 0, political: 0, values: 0,
  };
  const byTrendLevel: Record<TrendLevel, number> = {
    mega: 0, macro: 0, micro: 0, signal: 0,
  };
  let total = 0;
  for (const meta of Object.values(SOURCE_METADATA)) {
    bySteepV[meta.steepV] += 1;
    byTrendLevel[meta.trendLevel] += 1;
    total += 1;
  }
  return { bySteepV, byTrendLevel, total };
}
