import { SourceConnector } from "./types";
import { hackernewsConnector } from "./hackernews";
import { githubConnector } from "./github";
import { newsConnector } from "./news";
import { redditConnector } from "./reddit";
import { arxivConnector } from "./arxiv";
import { stackoverflowConnector } from "./stackoverflow";
import { npmPypiConnector } from "./npm-pypi";
import { producthuntConnector } from "./producthunt";
import { wikipediaConnector } from "./wikipedia";
import { worldmonitorConnector } from "./worldmonitor";
import { polymarketConnector } from "./polymarket";
import { googleTrendsConnector } from "./google-trends";
import { sentimentConnector } from "./sentiment";
// New connectors — verified working 2026-03-27
import { openalexConnector } from "./openalex";
import { gdeltConnector } from "./gdelt";
import { nasaEonetConnector } from "./nasa-eonet";
import { manifoldConnector } from "./manifold";
import { worldbankConnector } from "./worldbank";
// Official statistics & economic data
import { eurostatConnector } from "./eurostat";
import { oecdConnector } from "./oecd";
import { fredConnector } from "./fred";
import { owidConnector } from "./owid";
import { destatisConnector } from "./destatis";
// Global intelligence & forecasting
import { guardianConnector } from "./guardian";
import { acledConnector } from "./acled";
import { finnhubConnector } from "./finnhub";
import { metaculusConnector } from "./metaculus";
import { whoGhoConnector } from "./who-gho";
import { iloConnector } from "./ilo";
// Batch 2: Conflict, academic, UN & IMF data
import { ucdpConnector } from "./ucdp";
import { crossrefConnector } from "./crossref";
import { semanticScholarConnector } from "./semantic-scholar";
import { unDataConnector } from "./un-data";
import { unSdgConnector } from "./un-sdg";
import { imfConnector } from "./imf";
// Batch 3: News, climate, labor & FX
import { nytConnector } from "./nyt";
import { newsdataConnector } from "./newsdata";
import { openMeteoConnector } from "./open-meteo";
import { blsConnector } from "./bls";
import { openExchangeConnector } from "./open-exchange";
import { mediaCloudConnector } from "./media-cloud";
// Batch 4: Social, containers, patents & prediction markets
import { blueskyConnector } from "./bluesky";
import { mastodonApiConnector } from "./mastodon-api";
import { dockerHubConnector } from "./docker-hub";
import { vdemConnector } from "./vdem";
import { patentsviewConnector } from "./patentsview";
import { kalshiConnector } from "./kalshi";
// Batch 5: Declarative-framework connectors (2026-04) —
// Crypto/DeFi, clinical research, migration, pathogen tracking.
import { coingeckoConnector } from "./coingecko";
import { defiLlamaConnector } from "./defi-llama";
import { clinicaltrialsConnector } from "./clinicaltrials";
import { openFdaConnector } from "./openfda";
import { unhcrConnector } from "./unhcr";
import { nextstrainConnector } from "./nextstrain";
// NOTE: idmcConnector was removed here after the Phase-A smoke test revealed
// that the IDMC Helix API requires client registration ("Client is not
// registered." on every public-looking endpoint). IDMC is back in the
// planned-connectors list with needsKey: true until someone registers.
// Bonus sprint (2026-04): Gaming pulse, cultural macro-trends, seismic hazard.
// FAOSTAT was planned as the third bonus but all public JSON endpoints are
// either gated (Missing Authorization Header) or bulk-only (CSV zip). USGS
// Earthquake took its slot and also closes the seismic gap vs NASA EONET.
import { steamspyConnector } from "./steamspy";
import { googleNgramConnector } from "./google-ngram";
import { usgsEarthquakeConnector } from "./usgs-earthquake";
// RSS / Atom feeds — curated key-free sources from the Notion RSS registry
// (2026-04). Each feed gets its own SourceConnector via buildRssFeedConnector.
import { buildRssFeedConnector } from "./rss-feed";
import { RSS_FEED_CONFIGS } from "./rss-feeds";

const rssConnectors: SourceConnector[] = RSS_FEED_CONFIGS.map(buildRssFeedConnector);

export const connectors: SourceConnector[] = [
  // Tech & Developer signals
  hackernewsConnector,
  githubConnector,
  redditConnector,
  arxivConnector,
  stackoverflowConnector,
  npmPypiConnector,
  producthuntConnector,
  wikipediaConnector,
  newsConnector,
  // Search interest & sentiment
  googleTrendsConnector,
  sentimentConnector,
  // Real-time global intelligence
  worldmonitorConnector,
  // Prediction markets (crowd wisdom)
  polymarketConnector,
  manifoldConnector,
  // Research & academia
  openalexConnector,
  // Geopolitical & news intelligence
  gdeltConnector,
  // Climate & natural events
  nasaEonetConnector,
  // Macroeconomic data
  worldbankConnector,
  // Official statistics & economic data
  eurostatConnector,
  fredConnector,
  oecdConnector,
  owidConnector,
  destatisConnector,
  // Global intelligence & forecasting
  guardianConnector,
  acledConnector,
  finnhubConnector,
  metaculusConnector,
  // Health & labour
  whoGhoConnector,
  iloConnector,
  // Conflict & geopolitics
  ucdpConnector,
  vdemConnector,
  // Academic & research
  crossrefConnector,
  semanticScholarConnector,
  // UN & international organizations
  unDataConnector,
  unSdgConnector,
  imfConnector,
  // News sources
  nytConnector,
  newsdataConnector,
  mediaCloudConnector,
  // Climate & environment
  openMeteoConnector,
  // Labor & economics
  blsConnector,
  openExchangeConnector,
  // Social & community
  blueskyConnector,
  mastodonApiConnector,
  // Infrastructure & tech
  dockerHubConnector,
  patentsviewConnector,
  // Prediction markets
  kalshiConnector,
  // Batch 5: Crypto / DeFi
  coingeckoConnector,
  defiLlamaConnector,
  // Batch 5: Clinical research & drug events
  clinicaltrialsConnector,
  openFdaConnector,
  // Batch 5: Pathogen tracking
  nextstrainConnector,
  // Batch 5: Migration & displacement
  unhcrConnector,
  // Bonus sprint: Gaming, cultural macro, seismic hazard
  steamspyConnector,
  googleNgramConnector,
  usgsEarthquakeConnector,
  // Curated RSS / Atom feeds (key-free). ~36 sources across news, science,
  // institutions, think tanks, tech, and humanitarian crises.
  ...rssConnectors,
];

export function getConnector(name: string): SourceConnector | undefined {
  return connectors.find((c) => c.name === name);
}

export { type RawSignal, type SourceConnector } from "./types";
