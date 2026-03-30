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
// fredConnector — US-only data, redundant with Eurostat/OECD/WorldBank for EU focus
import { owidConnector } from "./owid";
import { destatisConnector } from "./destatis";

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
  oecdConnector,
  owidConnector,
  destatisConnector,
];

export function getConnector(name: string): SourceConnector | undefined {
  return connectors.find((c) => c.name === name);
}

export { type RawSignal, type SourceConnector } from "./types";
