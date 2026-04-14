import { SourceConnector, RawSignal } from "./types";
import { computeSignalStrength } from "@/lib/signal-strength";

/**
 * WHO Global Health Observatory Connector — free, no API key
 *
 * Official WHO health indicators including life expectancy,
 * mortality rates, disease prevalence, and health system data.
 *
 * API: https://www.who.int/data/gho/info/gho-odata-api
 */

export const whoGhoConnector: SourceConnector = {
  name: "who_gho",
  displayName: "WHO GHO (Global Health Observatory)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      // TODO: CON-12 — This connector fetches indicator metadata (names/codes),
      // not actual health data values. To fix: use the GHO OData API endpoint
      // /api/GHO/{indicatorCode}?$filter=... to fetch actual data points for
      // specific indicators.
      const url = `https://ghoapi.azureedge.net/api/Indicator?$filter=contains(IndicatorName,'life expectancy') or contains(IndicatorName,'mortality')&$top=20`;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) return signals;

      const data = await res.json();
      const indicators = data.value || [];

      for (const indicator of indicators) {
        const name = indicator.IndicatorName || "Unknown indicator";
        const code = indicator.IndicatorCode || "";
        const language = indicator.Language || "EN";

        // Only include English entries
        if (language !== "EN") continue;

        // CON-12: Improve title to be more descriptive about what this data represents
        const descriptiveTitle = `WHO GHO Indicator Definition: ${name} [${code}]`;

        const signal: RawSignal = {
          sourceType: "who_gho",
          sourceUrl: `https://www.who.int/data/gho/data/indicators/indicator-details/GHO/${code}`,
          sourceTitle: descriptiveTitle,
          signalType: "mention",
          topic: "Health, Biotech & Longevity",
          rawStrength: 0, // computed below
          rawData: {
            indicatorCode: code,
            indicatorName: name,
            language,
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
