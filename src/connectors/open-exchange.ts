import { SourceConnector, RawSignal } from "./types";
import { computeSignalStrength } from "@/lib/signal-strength";

/**
 * Open Exchange Rates Connector — Currency exchange rates
 *
 * Latest exchange rates against USD.
 * Requires a free API key from https://openexchangerates.org/
 *
 * Env: OPEN_EXCHANGE_KEY
 */

const KEY_CURRENCIES = ["EUR", "GBP", "JPY", "CNY", "CHF", "BRL", "INR"];

export const openExchangeConnector: SourceConnector = {
  name: "open_exchange",
  displayName: "Open Exchange Rates (FX)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const key = process.env.OPEN_EXCHANGE_KEY;
    if (!key) return signals;

    try {
      // NOTE: API key in URL - required by Open Exchange Rates API's design
      const res = await fetch(
        `https://openexchangerates.org/api/latest.json?app_id=${key}`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const rates = data.rates || {};

      for (const currency of KEY_CURRENCIES) {
        const rate = rates[currency];
        if (rate === undefined) continue;

        const signal: RawSignal = {
          sourceType: "open_exchange",
          sourceUrl: "https://openexchangerates.org/",
          sourceTitle: `FX: USD/${currency} = ${rate.toFixed(4)}`,
          signalType: "mention",
          topic: "Economic Trends",
          rawStrength: 0, // computed below
          rawData: {
            base: "USD",
            currency,
            rate,
            timestamp: data.timestamp,
          },
          detectedAt: new Date(),
        };
        signal.rawStrength = computeSignalStrength(signal);
        signals.push(signal);
      }
    } catch {
      // API unavailable
    }

    return signals;
  },
};
