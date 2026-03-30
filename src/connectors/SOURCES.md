# SIS Signal Sources

Complete list of data sources integrated into the SIS live-signal layer.
Signals are fetched every 6 hours and stored in `live_signals` for RAG context.

## Overview

| Connector | Source | Free | Auth | Update freq | Reliability |
|-----------|--------|------|------|-------------|-------------|
| `hackernews` | Hacker News Firebase API | Yes | None | Real-time | High |
| `github` | GitHub Search API | Yes | None (anon rate limit) | Real-time | High |
| `reddit` | Reddit JSON API | Yes | None | Real-time | Medium |
| `arxiv` | arXiv API | Yes | None | Daily | High |
| `stackoverflow` | Stack Exchange API | Yes | None | Real-time | High |
| `npm-pypi` | npm + PyPI registries | Yes | None | Real-time | High |
| `producthunt` | Product Hunt API | Yes | None | Daily | Medium |
| `wikipedia` | Wikipedia Trending API | Yes | None | Daily | Medium |
| `news` | News RSS feeds | Yes | None | Hourly | Medium |
| `google_trends` | Google Trends RSS | Yes | None | Daily | Low (unofficial) |
| `sentiment` | YouTube / Mastodon / RSS | Yes | None | Variable | Low–Medium |
| `worldmonitor` | World Monitor / event feeds | Yes | None | Real-time | Medium |
| `polymarket` | Polymarket CLOB API | Yes | None | Real-time | High |
| `manifold` | Manifold Markets API | Yes | None | Real-time | High |
| `openalex` | OpenAlex research index | Yes | None (polite pool) | Daily | High |
| `gdelt` | GDELT Project API v2 | Yes | None | 15 min | High |
| `nasa_eonet` | NASA EONET API | Yes | None | Real-time | High |
| `worldbank` | World Bank + IMF APIs | Yes | None | Annual/Quarterly | High |
| `eurostat` | Eurostat REST API | Yes | None | Monthly | High |
| `oecd` | OECD.Stat SDMX-JSON | Yes | None | Quarterly | Medium |
| `fred` | FRED (Federal Reserve) | Yes | API key (env var) | Real-time | High |
| `owid` | Our World in Data | Yes | None | Annual | High |
| `destatis` | Destatis GENESIS-Online | Yes | GUEST credentials | Monthly | Medium |

---

## Official Statistics & Government Data

### Eurostat

- **File:** `src/connectors/eurostat.ts`
- **Source:** European Union's official statistics office
- **API:** `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{datasetCode}?format=JSON&lang=EN`
- **Auth:** None — completely free
- **License:** Free reuse under EC open data policy (CC BY 4.0 equivalent)
- **Rate limit:** None documented; use politely
- **Timeout:** 10 seconds per request
- **Update frequency:** Monthly (most indicators), annual (some structural indicators)
- **Reliability:** High — official EU data, stable API, long history
- **Datasets tracked:**
  - `une_rt_m` — EU Unemployment Rate (monthly) → "Future of Work"
  - `prc_hicp_manr` — EU Inflation HICP (annual rate) → "Economic Trends"
  - `nrg_ind_ren` — EU Renewable Energy Share → "Energy Transition & Decarbonization"
  - `demo_gind` — EU Population Growth Indicators → "Demographic Shifts & Aging"
  - `isoc_ci_in_h` — EU Internet Access (Households) → "Connectivity & Digital Networks"
- **Signal format:** Latest value + YoY change; spike if change >15%
- **Notes:** `lastTimePeriod=2` param returns the two most recent observations for trend calculation

### OECD

- **File:** `src/connectors/oecd.ts`
- **Source:** OECD (Organisation for Economic Co-operation and Development)
- **API:** `https://stats.oecd.org/SDMX-JSON/data/{dataset}/{filter}/OECD?lastNObservations={n}&format=jsondata`
- **Auth:** None — completely free
- **License:** OECD Terms & Conditions (free for non-commercial research and analysis)
- **Rate limit:** 60 downloads/hour
- **Timeout:** 12 seconds per request
- **Update frequency:** Quarterly (GDP, unemployment), monthly (CPI)
- **Reliability:** Medium — API is stable but occasionally slow; older SDMX endpoint
- **Indicators tracked:**
  - `QNA` — GDP quarterly growth for DEU, USA, FRA, GBR → "Economic Trends"
  - `STLABOUR` — Unemployment rate (OECD aggregate + G4) → "Future of Work"
  - `PRICES_CPI` — CPI inflation YoY → "Economic Trends"
- **Signal format:** Aggregates across all series keys in SDMX response; spike if change >15%
- **Notes:** SDMX-JSON structure: `dataSets[0].series[key].observations[obsKey][0]` for values. The older `.Stat` endpoint is used as it is more stable than the newer SDMX 2.1 endpoint.

### World Bank & IMF

- **File:** `src/connectors/worldbank.ts`
- **Source:** World Bank Open Data + IMF Data Mapper API
- **APIs:**
  - World Bank: `https://api.worldbank.org/v2/country/WLD/indicator/{id}?format=json&per_page=5`
  - IMF: `https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH`
- **Auth:** None — completely free
- **License:** Creative Commons Attribution 4.0 (World Bank); IMF public data
- **Rate limit:** None documented (World Bank); be polite
- **Timeout:** 8–10 seconds per request
- **Update frequency:** Annual (most WB indicators), quarterly/continuous (IMF projections)
- **Reliability:** High — authoritative global data, well-maintained APIs
- **Indicators tracked:** GDP growth, inflation (CPI), unemployment, internet users, renewable energy share, urban population %, population 65+, IMF GDP projections for G8
- **Signal format:** Latest value + % change; spike if change >20%

### FRED (Federal Reserve Economic Data)

- **File:** `src/connectors/fred.ts`
- **Source:** Federal Reserve Bank of St. Louis
- **API:** `https://api.stlouisfed.org/fred/series/observations?series_id={id}&api_key={key}&limit=5&sort_order=desc&file_type=json`
- **Auth:** Free API key required — register at https://fred.stlouisfed.org/docs/api/api_key.html; set `FRED_API_KEY` in `.env.local`
- **License:** Public domain (US government data)
- **Rate limit:** 120 requests per minute
- **Timeout:** 10 seconds per request
- **Update frequency:** Real-time (some series updated within minutes of release)
- **Reliability:** High — definitive US economic data source, very stable API
- **Series tracked:**
  - `FEDFUNDS` — Federal Funds Rate → "Economic Trends"
  - `UNRATE` — US Unemployment Rate → "Future of Work"
  - `CPIAUCSL` — US Consumer Price Index → "Economic Trends"
  - `DGS10` — 10-Year Treasury Yield → "Economic Trends"
  - `INDPRO` — Industrial Production Index → "Economic Trends"
  - `HOUST` — Housing Starts → "Economic Trends"
- **Signal format:** Latest value with observation date + change vs prior observation; spike if change >10%
- **Notes:** Connector returns empty array gracefully if `FRED_API_KEY` is not set. Missing values (`.`) are filtered out from observations.

### Destatis (German Federal Statistics)

- **File:** `src/connectors/destatis.ts`
- **Source:** Statistisches Bundesamt (German Federal Statistical Office)
- **API:** `https://www-genesis.destatis.de/genesisWS/rest/2020/data/tablefile?name={code}&format=ffcsv&username=GUEST&password=GUEST`
- **Auth:** GUEST/GUEST — free public access tier
- **License:** Data Licence Germany – Attribution – Version 2.0
- **Rate limit:** Not documented for GUEST; throttle to avoid bans
- **Timeout:** 15 seconds per request (API can be slow)
- **Update frequency:** Monthly (CPI, unemployment), quarterly (industrial production)
- **Reliability:** Medium — GENESIS API can be slow and occasionally returns errors; ffcsv parsing is brittle
- **Tables tracked:**
  - `61111-0002` — Germany Consumer Prices (CPI) → "Economic Trends"
  - `13211-0001` — Germany Unemployment Rate → "Future of Work"
  - `42153-0001` — Germany Industrial Production Index → "Economic Trends"
- **Signal format:** Latest value + % change vs prior row; spike if change >10%
- **Notes:** ffcsv (semicolon-separated) format used. Metadata header lines (quoted) are skipped. Particularly relevant for SIS given German-first focus.

### Our World in Data

- **File:** `src/connectors/owid.ts`
- **Source:** Our World in Data (Oxford-affiliated non-profit)
- **API:** `https://ourworldindata.org/grapher/{slug}.csv?time=latest`
- **Auth:** None — completely free
- **License:** Creative Commons BY 4.0
- **Rate limit:** None documented; be respectful
- **Timeout:** 12 seconds per request
- **Update frequency:** Annual (most indicators), some more frequent
- **Reliability:** High — well-maintained, stable CSV endpoints, long history
- **Indicators tracked:**
  - `share-electricity-renewables` — Global Renewable Electricity Share → "Energy Transition & Decarbonization"
  - `internet-users-by-technology` — Global Internet Users → "Connectivity & Digital Networks"
  - `life-expectancy` — Global Life Expectancy → "Health, Biotech & Longevity"
  - `co2-emissions-per-capita` — CO₂ Emissions Per Capita → "Climate Change & Sustainability"
  - `urban-and-rural-population` — World Urban Population → "Urbanization & Smart Cities"
- **Signal format:** Latest world-level value with year; fixed strength 0.5 (long-term structural data)
- **Notes:** World row identified by "World," prefix or "OWID_WRL" code column. CSV columns: Entity, Code, Year, {metric}.

---

## Research & Academia

### OpenAlex

- **File:** `src/connectors/openalex.ts`
- **Source:** OpenAlex — open catalog of scholarly papers, authors, institutions
- **API:** `https://api.openalex.org/works?filter=publication_year:{year},concept.id:{id}&per_page=1`
- **Auth:** None — free, 100K requests/day (polite pool with User-Agent header)
- **License:** CC0 (public domain)
- **Rate limit:** 10 requests/second (polite pool); 100K/day
- **Timeout:** 8 seconds per request
- **Update frequency:** Daily
- **Reliability:** High — well-funded, comprehensive, reliable API
- **Topics tracked:** AI, Machine Learning, Computer Science, Quantum Mechanics, Biotechnology, Genetics, Environmental Science, Renewable Energy, Computer Security, Internet, Urban Planning, Economics
- **Signal format:** Paper count for current year vs prior year; spike if YoY growth >20%

### arXiv

- **File:** `src/connectors/arxiv.ts`
- **Source:** arXiv preprint server (Cornell University)
- **API:** arXiv API (Atom feed)
- **Auth:** None
- **License:** arXiv submissions are open access; API is public
- **Reliability:** High — canonical source for CS/Physics/Math preprints

---

## Tech & Developer Signals

### Hacker News

- **File:** `src/connectors/hackernews.ts`
- **Source:** Y Combinator's Hacker News
- **API:** `https://hacker-news.firebaseio.com/v0/` (Firebase REST)
- **Auth:** None — completely free
- **License:** Public
- **Rate limit:** None documented; Firebase REST is fast
- **Update frequency:** Real-time
- **Reliability:** High — very stable API, years of uptime
- **Signal format:** Top stories with score + comment count; strength based on score

### GitHub

- **File:** `src/connectors/github.ts`
- **Source:** GitHub repository search and trending
- **API:** GitHub Search API (`api.github.com/search/repositories`)
- **Auth:** None (anonymous — lower rate limit: 10 req/min); optional `GITHUB_TOKEN` env var for higher limits
- **License:** Public API
- **Rate limit:** 10 requests/minute unauthenticated; 30/min with token
- **Update frequency:** Real-time
- **Reliability:** High

### Stack Overflow

- **File:** `src/connectors/stackoverflow.ts`
- **Source:** Stack Exchange network (Stack Overflow)
- **API:** Stack Exchange API v2.3
- **Auth:** None (anonymous)
- **Reliability:** High

### npm / PyPI

- **File:** `src/connectors/npm-pypi.ts`
- **Source:** npm registry (Node.js packages) + PyPI (Python packages)
- **APIs:** npm search API + PyPI JSON API
- **Auth:** None
- **Reliability:** High — official package registry APIs

### Product Hunt

- **File:** `src/connectors/producthunt.ts`
- **Source:** Product Hunt daily launches
- **API:** Product Hunt API
- **Auth:** None (public endpoints)
- **Reliability:** Medium — API occasionally changes

---

## News & Media Intelligence

### GDELT

- **File:** `src/connectors/gdelt.ts`
- **Source:** GDELT Project — monitors world news media globally
- **API:** `https://api.gdeltproject.org/api/v2/doc/doc`
- **Auth:** None — completely free
- **License:** Public domain
- **Rate limit:** None documented; updates every 15 minutes
- **Update frequency:** 15 minutes
- **Reliability:** High — massive scale, very stable
- **Topics tracked:** AI, Climate, Cybersecurity, Geopolitics, Energy, and more
- **Notes:** Returns article counts and tone scores per query. Strong signal for narrative intensity.

### News RSS

- **File:** `src/connectors/news.ts`
- **Source:** Various news RSS feeds (BBC, Reuters, etc.)
- **Auth:** None
- **Reliability:** Medium — dependent on individual feed availability

### Sentiment (YouTube / Mastodon / RSS)

- **File:** `src/connectors/sentiment.ts`
- **Source:** YouTube trending, Mastodon public timeline, RSS feeds
- **Auth:** None (public APIs)
- **Reliability:** Low–Medium — social APIs frequently change or rate-limit

---

## Prediction Markets

### Polymarket

- **File:** `src/connectors/polymarket.ts`
- **Source:** Polymarket — real-money prediction market
- **API:** `https://clob.polymarket.com` (CLOB API)
- **Auth:** None — public read access
- **License:** Public
- **Rate limit:** Standard REST limits
- **Update frequency:** Real-time
- **Reliability:** High — well-maintained API
- **Notes:** Prediction market prices represent crowd-aggregated probability estimates backed by real money — a qualitatively different signal from opinion polls or expert forecasts.

### Manifold

- **File:** `src/connectors/manifold.ts`
- **Source:** Manifold Markets — play-money prediction market
- **API:** Manifold public API
- **Auth:** None
- **Reliability:** High
- **Notes:** Play-money platform with a large active community; complements Polymarket for non-financial/niche questions.

---

## Real-Time Global Signals

### Wikipedia (Trending)

- **File:** `src/connectors/wikipedia.ts`
- **Source:** Wikipedia Pageviews API
- **API:** Wikimedia REST API
- **Auth:** None
- **Reliability:** Medium — good proxy for public awareness spikes

### World Monitor

- **File:** `src/connectors/worldmonitor.ts`
- **Source:** World Monitor / global event feeds
- **Auth:** None
- **Reliability:** Medium

### NASA EONET (Natural Events)

- **File:** `src/connectors/nasa-eonet.ts`
- **Source:** NASA Earth Observatory Natural Event Tracker
- **API:** `https://eonet.gsfc.nasa.gov/api/v3/events`
- **Auth:** None — free NASA public API
- **License:** US Government public domain
- **Rate limit:** None documented
- **Update frequency:** Real-time (event-driven)
- **Reliability:** High — NASA-maintained, stable
- **Notes:** Tracks natural events (wildfires, storms, floods, volcanoes) that are often leading indicators for supply chain, insurance, and climate-related trends.

---

## Search Interest

### Google Trends

- **File:** `src/connectors/google-trends.ts`
- **Source:** Google Trends RSS feed (`trends.google.com/trending/rss?geo=US`)
- **Auth:** None (unofficial RSS feed)
- **Rate limit:** Unofficial; subject to blocking
- **Update frequency:** Daily
- **Reliability:** Low — unofficial endpoint, frequently blocked or returns no data
- **Notes:** Google has no official public Trends API. The RSS feed is used when available and matched against topic keywords. **Synthetic fallback data was removed** — if the RSS feed is unavailable or returns no matched items, the connector returns an empty array. Do not re-add synthetic fallbacks.

---

## Adding New Connectors

1. Create `src/connectors/{name}.ts` implementing `SourceConnector` from `./types`
2. Export a named `{name}Connector` constant
3. Register in `src/connectors/index.ts` (import + add to `connectors` array)
4. Document here with: data source, API URL, license, rate limits, reliability notes
5. Test with `curl` before integrating to verify the API shape
6. Never emit synthetic or fabricated signals — return empty array on any failure

## Data Quality Rules

- **No synthetic data:** All signals must come from real API responses, never from hardcoded fallbacks or static lists
- **Graceful degradation:** Every connector must handle errors with `try/catch` and return a partial or empty array — never throw
- **Meaningful `rawStrength`:** Should reflect actual signal magnitude (e.g., rate of change, volume, score), not a fixed baseline
- **Accurate `sourceUrl`:** Must point to the actual data page, not just the provider homepage
- **Valid `topic`:** Must match one of the SIS trend categories (e.g., "Economic Trends", "Future of Work", "Energy Transition & Decarbonization")
- **Timeouts:** Max 15 seconds per individual request; use `AbortSignal.timeout()`
- **User-Agent:** Include `SIS/1.0 (mailto:sis@strategic-intelligence.app)` header on all requests to APIs that benefit from identification
- **API keys via env vars only:** Never hardcode credentials; document required env vars in connector JSDoc
