import { buildDeclarativeConnector } from "./framework";

/**
 * SteamSpy — Top 100 Steam games by peak concurrent players (2 weeks).
 *
 * Gaming as cultural seismograph. SteamSpy scrapes public Steam data and
 * exposes it through a free no-auth endpoint. We pull the top 100 most-
 * played games of the last two weeks and treat the 2-week average-playtime
 * delta vs. the forever average as our signal:
 *
 *   - A game with `average_2weeks` much higher than `average_forever`
 *     is undergoing a current engagement spike (new update, seasonal
 *     event, going viral on TikTok, price drop, sale, tournament).
 *   - A game with `average_2weeks ≈ average_forever` is coasting on
 *     its long-term baseline and isn't a trending signal.
 *
 * Signal strength = clamped ratio of `average_2weeks` to `average_forever`,
 * bucketed so a 2× spike saturates to ~0.5 and a 5× spike hits 1.0.
 *
 * Endpoint shape surprise: the API returns an OBJECT keyed by appid, not
 * an array. We use the framework's `transformResponse` hook to convert
 * `{ "730": {...}, "1172470": {...} }` → `Object.values(...)` before the
 * usual row-extraction pass.
 *
 * Topic: subsumed under "Gaming & Interactive Media" (generic cultural
 * signal) — granularity is kept in rawData for downstream analysis.
 *
 * Endpoint: https://steamspy.com/api.php?request=top100in2weeks
 * Rate limit: 4 req/sec, 1 req/60sec per "big" request like top100. We
 * call once per pipeline run, well within budget.
 */

interface SteamSpyGame {
  appid: number;
  name: string;
  developer: string;
  publisher: string;
  score_rank: string | number;
  positive: number;
  negative: number;
  userscore: number;
  owners: string; // range string like "100,000,000 .. 200,000,000"
  average_forever: number;
  average_2weeks: number;
  median_forever: number;
  median_2weeks: number;
  price: string;
  initialprice: string;
  discount: string;
  ccu: number; // current concurrent users
}

export const steamspyConnector = buildDeclarativeConnector<SteamSpyGame>({
  name: "steamspy",
  displayName: "SteamSpy (Gaming Pulse)",
  endpoint: "https://steamspy.com/api.php?request=top100in2weeks",
  defaultTopic: "Gaming & Interactive Media",
  defaultSignalType: "spike",
  minStrength: 0.1,
  limit: 100,
  // The response is an object keyed by appid — flatten to the array the
  // framework's row walker expects.
  transformResponse: (data) => {
    if (data == null || typeof data !== "object") return [];
    return Object.values(data as Record<string, unknown>);
  },
  map: (game) => {
    if (!game.name || !Number.isFinite(game.average_2weeks)) return null;
    const fore = game.average_forever;
    const two = game.average_2weeks;
    // Guard against zero-forever / brand-new releases — use raw 2-week
    // playtime scaled against a hand-picked "high engagement" ceiling
    // of 2000 minutes (≈ 33h played per user in two weeks).
    let strength: number;
    if (fore == null || fore < 60) {
      strength = Math.min(1, two / 2000);
    } else {
      // Ratio-based: 5× the all-time average saturates.
      const ratio = two / fore;
      strength = Math.min(1, ratio / 5);
    }
    if (!Number.isFinite(strength) || strength <= 0) return null;
    const ccuStr = game.ccu?.toLocaleString?.("en-US") ?? String(game.ccu ?? 0);
    const ratioStr = fore > 0 ? ` · ${(two / fore).toFixed(1)}× base` : "";
    return {
      sourceUrl: `https://steamcommunity.com/app/${game.appid}/`,
      sourceTitle: `${game.name}: ${ccuStr} concurrent · ${two} min/2w${ratioStr}`,
      rawStrength: strength,
      rawData: {
        appid: game.appid,
        name: game.name,
        developer: game.developer,
        publisher: game.publisher,
        ccu: game.ccu,
        average_forever: fore,
        average_2weeks: two,
        positive: game.positive,
        negative: game.negative,
        owners: game.owners,
      },
    };
  },
});
