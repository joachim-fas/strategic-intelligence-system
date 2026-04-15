/**
 * Connector-Konfigurations-Registry
 * ──────────────────────────────────
 *
 * Jeder Connector wird aktuell unbedingt gelaufen — auch wenn ein
 * erforderlicher API-Key fehlt. Der Connector selbst loggt dann "no key,
 * skipping" und liefert 0 Signale, aber das ist in der Monitor-Oberflaeche
 * nicht erkennbar: eine Quelle ohne Key sieht aus wie eine Quelle, die
 * einfach keine Treffer hatte.
 *
 * Diese Registry bildet die Key-Abhaengigkeiten aus .env.example ab, damit
 * der `/api/v1/sources/status`-Endpoint sagen kann: "Diese Quelle laeuft
 * nicht, weil GUARDIAN_API_KEY fehlt — registriere dich hier".
 *
 * Kategorien:
 *   - "required": Connector ist ohne Key komplett stumm
 *   - "optional": Connector laeuft auch ohne Key, wird aber stark
 *     ratelimitiert (z.B. GitHub: 60 req/h statt 5000 req/h)
 */

export interface ConnectorConfig {
  /** Interner Connector-Name (match zu connectors[i].name) */
  name: string;
  /** ENV-Variablen, die fuer Live-Signale erforderlich sind. */
  requiredEnvVars?: string[];
  /** ENV-Variablen, die den Connector nur *verbessern* (Rate-Limit etc.). */
  optionalEnvVars?: string[];
  /** URL zum Registrieren / Key holen — wird im Monitor verlinkt. */
  registerUrl?: string;
  /** Freitext-Notiz fuer den Monitor (z.B. "Free Tier: 100 req/day"). */
  note?: string;
}

export const CONNECTOR_CONFIG: ConnectorConfig[] = [
  {
    name: "guardian",
    requiredEnvVars: ["GUARDIAN_API_KEY"],
    registerUrl: "https://open-platform.theguardian.com/access/",
    note: "Free developer key — unbegrenzt fuer nicht-kommerzielle Nutzung.",
  },
  {
    name: "finnhub",
    requiredEnvVars: ["FINNHUB_API_KEY"],
    registerUrl: "https://finnhub.io/register",
    note: "Free Tier: 60 API calls/minute.",
  },
  {
    name: "fred",
    requiredEnvVars: ["FRED_API_KEY"],
    registerUrl: "https://fred.stlouisfed.org/docs/api/api_key.html",
    note: "Free — unbegrenzte Federal-Reserve-Wirtschaftsdaten.",
  },
  {
    name: "news",
    requiredEnvVars: ["NEWS_API_KEY"],
    registerUrl: "https://newsapi.org/register",
    note: "Free Tier: 100 requests/day, nur Entwicklung erlaubt.",
  },
  {
    name: "newsdata",
    requiredEnvVars: ["NEWSDATA_API_KEY"],
    registerUrl: "https://newsdata.io/register",
    note: "Free Tier: 200 credits/day.",
  },
  {
    name: "nyt",
    requiredEnvVars: ["NYT_API_KEY"],
    registerUrl: "https://developer.nytimes.com/get-started",
    note: "Free — 4000 requests/day, 10 requests/min.",
  },
  {
    name: "acled",
    requiredEnvVars: ["ACLED_EMAIL", "ACLED_KEY"],
    registerUrl: "https://acleddata.com/register/",
    note: "Beide Variablen (Email + Key) muessen gesetzt sein.",
  },
  {
    name: "open_exchange",
    requiredEnvVars: ["OPEN_EXCHANGE_KEY"],
    registerUrl: "https://openexchangerates.org/signup/free",
    note: "Free Tier: 1000 requests/month, nur USD base.",
  },
  {
    name: "github",
    optionalEnvVars: ["GITHUB_TOKEN"],
    registerUrl: "https://github.com/settings/tokens",
    note: "Optional. Ohne Token: 60 req/h. Mit Token: 5000 req/h.",
  },
  {
    name: "stackoverflow",
    optionalEnvVars: ["SO_API_KEY"],
    registerUrl: "https://stackapps.com/apps/oauth/register",
    note: "Optional. Ohne Key sinkt das Rate-Limit merklich.",
  },
];

/**
 * Berechne den Konfigurations-Status fuer einen Connector.
 * - "ok": Kein Key erforderlich, oder alle erforderlichen Keys sind gesetzt
 * - "missing-required": Mindestens ein erforderlicher Key fehlt — Quelle ist stumm
 * - "missing-optional": Erforderliche Keys sind da, aber optionale fehlen (Rate-Limit)
 */
export function getConnectorConfigStatus(connectorName: string): {
  status: "ok" | "missing-required" | "missing-optional";
  missing: string[];
  config: ConnectorConfig | null;
} {
  const cfg = CONNECTOR_CONFIG.find((c) => c.name === connectorName) ?? null;
  if (!cfg) {
    return { status: "ok", missing: [], config: null };
  }

  const missingRequired = (cfg.requiredEnvVars ?? []).filter(
    (v) => !process.env[v] || process.env[v]?.trim() === "",
  );
  if (missingRequired.length > 0) {
    return { status: "missing-required", missing: missingRequired, config: cfg };
  }

  const missingOptional = (cfg.optionalEnvVars ?? []).filter(
    (v) => !process.env[v] || process.env[v]?.trim() === "",
  );
  if (missingOptional.length > 0) {
    return { status: "missing-optional", missing: missingOptional, config: cfg };
  }

  return { status: "ok", missing: [], config: cfg };
}
