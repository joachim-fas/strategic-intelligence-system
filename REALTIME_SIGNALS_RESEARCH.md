# Real-Time & Near-Real-Time Data Feeds for Strategic Intelligence

> Research Date: 2026-03-27
> Purpose: Early warning signal sources for the Strategic Intelligence System (SIS)
> Criteria: Minimum daily updates, programmatic access required

---

## Table of Contents

1. [Early Technology Signals](#1-early-technology-signals)
2. [Market & Economic Signals](#2-market--economic-signals)
3. [Geopolitical Signals](#3-geopolitical-signals)
4. [Social Signals](#4-social-signals)
5. [Regulatory Signals](#5-regulatory-signals)
6. [Climate & Environment Signals](#6-climate--environment-signals)
7. [Health Signals](#7-health-signals)
8. [Implementation Priority Matrix](#8-implementation-priority-matrix)
9. [Architecture Notes](#9-architecture-notes)

---

## 1. Early Technology Signals

### 1.1 GitHub API (Repository & Star Velocity)

| Field | Details |
|-------|---------|
| **URL** | https://api.github.com |
| **Signals** | New repo creation rates by language/topic, star velocity (trending repos), fork acceleration, commit frequency, contributor growth |
| **Latency** | Real-time (events API), hourly (search index) |
| **Auth** | Personal Access Token or GitHub App (OAuth) |
| **Rate Limits** | 5,000 req/hr (authenticated), 60 req/hr (unauthenticated) |
| **Cost** | Free |
| **Signal Quality** | HIGH -- direct signal of developer adoption and interest |
| **Priority** | 1 (Critical) |

**Key Endpoints:**

```bash
# Search trending repos (created in last 7 days, sorted by stars)
curl -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/search/repositories?q=created:>2026-03-20&sort=stars&order=desc&per_page=30"

# Search repos by topic with star threshold
curl -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/search/repositories?q=topic:ai+stars:>100+created:>2026-03-01&sort=stars"

# Public events firehose (real-time activity)
curl -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/events?per_page=100"

# Repository star history (via stargazers with timestamps)
curl -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.star+json" \
  "https://api.github.com/repos/{owner}/{repo}/stargazers?per_page=100"
```

**Signal Extraction Strategy:**
- Poll `search/repositories` daily for repos created in last 7 days sorted by stars
- Track star velocity: compare star counts over 24h/7d windows
- Monitor `events` endpoint for WatchEvents (stars) and CreateEvents (new repos) by language
- Use topic tags (`ai`, `llm`, `blockchain`, etc.) for category filtering

---

### 1.2 Hacker News (Algolia + Firebase APIs)

| Field | Details |
|-------|---------|
| **URL** | https://hn.algolia.com/api/v1 (search), https://hacker-news.firebaseio.com/v0 (live) |
| **Signals** | Front page velocity, comment sentiment, topic emergence, upvote acceleration |
| **Latency** | Real-time (Firebase SSE), minutes (Algolia indexing) |
| **Auth** | None required |
| **Rate Limits** | Algolia: 10,000 req/hr. Firebase: generous, undocumented |
| **Cost** | Free |
| **Signal Quality** | HIGH -- curated tech community, strong leading indicator for tech trends |
| **Priority** | 1 (Critical) |

**Key Endpoints:**

```bash
# Algolia: Search stories by date (most recent first)
curl "https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=50"

# Algolia: Search for specific topics
curl "https://hn.algolia.com/api/v1/search?query=artificial+intelligence&tags=story&hitsPerPage=20"

# Algolia: Front page stories (currently on HN front page)
curl "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30"

# Firebase: Top stories (current front page IDs)
curl "https://hacker-news.firebaseio.com/v0/topstories.json"

# Firebase: New stories (latest submissions)
curl "https://hacker-news.firebaseio.com/v0/newstories.json"

# Firebase: Best stories
curl "https://hacker-news.firebaseio.com/v0/beststories.json"

# Firebase: Single item detail
curl "https://hacker-news.firebaseio.com/v0/item/12345.json"
```

**Signal Extraction Strategy:**
- Track front page velocity: how fast items reach front page (time between submission and first appearance)
- Monitor comment volume acceleration on specific topics
- Detect new topics by clustering titles from `search_by_date`
- Use Firebase SSE for real-time front page changes: `curl -H "Accept: text/event-stream" "https://hacker-news.firebaseio.com/v0/topstories.json"`

---

### 1.3 Product Hunt API

| Field | Details |
|-------|---------|
| **URL** | https://api.producthunt.com/v2/api/graphql |
| **Signals** | New product launches by category, upvote velocity, maker activity, category growth |
| **Latency** | Daily (launches), hourly (votes) |
| **Auth** | OAuth2 (Developer Token from producthunt.com/v2/oauth/applications) |
| **Rate Limits** | 450 req/15min (authenticated), 900 for partners |
| **Cost** | Free |
| **Signal Quality** | MEDIUM-HIGH -- strong signal for consumer tech and SaaS trends |
| **Priority** | 2 (Important) |

**Key Endpoints:**

```graphql
# GraphQL query: Get today's featured posts
{
  posts(order: RANKING, postedAfter: "2026-03-27T00:00:00Z") {
    edges {
      node {
        id
        name
        tagline
        votesCount
        commentsCount
        topics {
          edges {
            node {
              name
            }
          }
        }
        createdAt
      }
    }
  }
}
```

```bash
# cURL example
curl -X POST "https://api.producthunt.com/v2/api/graphql" \
  -H "Authorization: Bearer $PH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ posts(order: RANKING, first: 20) { edges { node { name tagline votesCount topics { edges { node { name } } } } } } }"}'
```

---

### 1.4 arXiv API (Academic Papers)

| Field | Details |
|-------|---------|
| **URL** | https://export.arxiv.org/api/query |
| **Signals** | Paper submission rates by category, new research topics, citation velocity (via OpenAlex/Semantic Scholar) |
| **Latency** | Daily (new submissions), weekly (classification updates) |
| **Auth** | None required |
| **Rate Limits** | 1 request per 3 seconds recommended; bulk access via OAI-PMH |
| **Cost** | Free |
| **Signal Quality** | HIGH -- leading indicator for technology breakthroughs (6-24 months ahead) |
| **Priority** | 1 (Critical) |

**Key Endpoints:**

```bash
# Search recent AI papers
curl "https://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=50"

# Search by keyword in title/abstract
curl "https://export.arxiv.org/api/query?search_query=ti:transformer+AND+abs:efficiency&sortBy=submittedDate&sortOrder=descending&max_results=25"

# OAI-PMH for bulk harvesting (all new papers since a date)
curl "https://export.arxiv.org/oai2?verb=ListRecords&from=2026-03-20&metadataPrefix=arXiv"

# RSS feed for specific category (daily new submissions)
# https://rss.arxiv.org/rss/cs.AI
# https://rss.arxiv.org/rss/cs.LG
```

**Complement with OpenAlex for citation data:**

```bash
# OpenAlex: Search recent works with citation counts
curl "https://api.openalex.org/works?filter=from_publication_date:2026-03-01,concepts.id:C154945302&sort=cited_by_count:desc&per_page=25"
```

**OpenAlex Details:**
- URL: https://api.openalex.org
- Free, no auth required (polite pool with email in User-Agent gets higher limits)
- 100,000 req/day with email, 10 req/sec
- 250M+ works indexed with citation data

---

### 1.5 npm Registry / PyPI (Package Ecosystem)

| Field | Details |
|-------|---------|
| **npm URL** | https://registry.npmjs.org, https://api.npmjs.org |
| **PyPI URL** | https://pypi.org/simple/, https://pypistats.org/api |
| **Signals** | New package creation rates, download acceleration, dependency adoption |
| **Latency** | Daily (download stats), real-time (registry updates) |
| **Auth** | None required |
| **Rate Limits** | npm: undocumented but generous. PyPI Stats: 30 req/min |
| **Cost** | Free |
| **Signal Quality** | HIGH -- direct signal of developer tool adoption |
| **Priority** | 2 (Important) |

**Key Endpoints:**

```bash
# npm: Package download counts (last day/week/month)
curl "https://api.npmjs.org/downloads/point/last-week/react"

# npm: Download counts for a date range
curl "https://api.npmjs.org/downloads/range/2026-03-01:2026-03-27/openai"

# npm: Search for new packages
curl "https://registry.npmjs.org/-/v1/search?text=keywords:llm&size=20&quality=0.5&popularity=0.5&maintenance=0.0"

# PyPI: Package metadata
curl "https://pypi.org/pypi/langchain/json"

# PyPI Stats: Download history
curl "https://pypistats.org/api/packages/langchain/recent"

# PyPI Stats: Downloads by Python version
curl "https://pypistats.org/api/packages/langchain/python_minor"

# PyPI: RSS feed of new releases
# https://pypi.org/rss/updates.xml
# https://pypi.org/rss/packages.xml (brand new packages)
```

**Signal Extraction Strategy:**
- Track download acceleration: compare week-over-week download growth rates
- Monitor new package creation in AI/ML/LLM categories
- Detect emerging frameworks by watching dependency graph changes
- PyPI new packages RSS for real-time new package alerts

---

### 1.6 Stack Overflow / Stack Exchange API

| Field | Details |
|-------|---------|
| **URL** | https://api.stackexchange.com/2.3 |
| **Signals** | New tag creation, question volume by technology, answer patterns, tag co-occurrence |
| **Latency** | Near-real-time (minutes) |
| **Auth** | Optional (API key for higher limits) |
| **Rate Limits** | 300 req/day (anonymous), 10,000 req/day (with key) |
| **Cost** | Free |
| **Signal Quality** | MEDIUM-HIGH -- signal of developer adoption challenges and learning curves |
| **Priority** | 3 (Nice-to-have) |

**Key Endpoints:**

```bash
# Questions tagged with a specific technology, sorted by creation date
curl "https://api.stackexchange.com/2.3/questions?order=desc&sort=creation&tagged=langchain&site=stackoverflow&pagesize=20&filter=withbody"

# Tag information (question count, growth)
curl "https://api.stackexchange.com/2.3/tags?order=desc&sort=popular&site=stackoverflow&pagesize=30&inname=ai"

# New tags (recently created)
curl "https://api.stackexchange.com/2.3/tags?order=desc&sort=name&site=stackoverflow&pagesize=50&fromdate=$(date -d '7 days ago' +%s)"

# Trending tags (by question activity)
# https://trends.stackoverflow.co/ (web interface, no direct API)
```

---

## 2. Market & Economic Signals

### 2.1 Polymarket (Prediction Markets)

| Field | Details |
|-------|---------|
| **URL** | https://gamma-api.polymarket.com (discovery), https://clob.polymarket.com (trading/prices) |
| **Signals** | Event probability shifts, volume spikes on geopolitical/tech/regulatory events, new market creation |
| **Latency** | Real-time (WebSocket), seconds (REST) |
| **Auth** | None for read endpoints; API key for trading |
| **Rate Limits** | Generous for read endpoints (undocumented specific limits) |
| **Cost** | Free (read access) |
| **Signal Quality** | HIGH -- money-weighted probability signals, strong leading indicator |
| **Priority** | 1 (Critical) |

**Key Endpoints:**

```bash
# List all active events
curl "https://gamma-api.polymarket.com/events?active=true&limit=50"

# List all active markets
curl "https://gamma-api.polymarket.com/markets?active=true&limit=50"

# Get specific event with markets
curl "https://gamma-api.polymarket.com/events/{event_id}"

# CLOB: Get market price/orderbook
curl "https://clob.polymarket.com/book?token_id={token_id}"

# CLOB: Price history
curl "https://clob.polymarket.com/prices-history?market={token_id}&interval=1d&fidelity=60"
```

**Python Client:**
```bash
pip install polymarket-apis  # Unified client: CLOB, Gamma, Data, WebSocket
pip install py-clob-client    # Official CLOB client
```

**WebSocket for real-time:**
```
wss://ws-subscriptions-clob.polymarket.com/ws/market
```

---

### 2.2 Manifold Markets (Prediction Markets)

| Field | Details |
|-------|---------|
| **URL** | https://api.manifold.markets |
| **Signals** | Broad prediction coverage including tech, policy, culture; community-driven probability estimates |
| **Latency** | Real-time (WebSocket), seconds (REST) |
| **Auth** | API key from profile (for write operations); read is public |
| **Rate Limits** | 500 req/min per IP |
| **Cost** | Free |
| **Signal Quality** | MEDIUM -- play-money market, but large and diverse question set |
| **Priority** | 2 (Important) |

**Key Endpoints:**

```bash
# List markets sorted by most recent activity
curl "https://api.manifold.markets/v0/markets?sort=updated-time&limit=50"

# Search markets by query
curl "https://api.manifold.markets/v0/search-markets?term=AI+regulation&sort=liquidity&limit=20"

# Get specific market
curl "https://api.manifold.markets/v0/market/{marketId}"

# Get market positions
curl "https://api.manifold.markets/v0/market/{marketId}/positions"
```

**WebSocket:** `wss://api.manifold.markets/ws`

---

### 2.3 Metaculus (Forecasting Platform)

| Field | Details |
|-------|---------|
| **URL** | https://www.metaculus.com/api2 |
| **Signals** | Expert forecasts on AI timelines, geopolitical events, scientific breakthroughs; community prediction shifts |
| **Latency** | Hourly (predictions update continuously) |
| **Auth** | None for read; account token for write |
| **Rate Limits** | Undocumented, moderate |
| **Cost** | Free |
| **Signal Quality** | HIGH -- calibrated forecasters, rigorous question resolution criteria |
| **Priority** | 1 (Critical) |

**Key Endpoints:**

```bash
# List questions, most recently active
curl "https://www.metaculus.com/api2/questions/?order_by=-activity&limit=20&status=open"

# Search questions
curl "https://www.metaculus.com/api2/questions/?search=artificial+intelligence&status=open&limit=20"

# Get specific question with prediction history
curl "https://www.metaculus.com/api2/questions/{question_id}/"

# Get predictions for a question
curl "https://www.metaculus.com/api2/questions/{question_id}/predictions/"
```

---

### 2.4 FRED (Federal Reserve Economic Data)

| Field | Details |
|-------|---------|
| **URL** | https://api.stlouisfed.org/fred |
| **Signals** | 765,000+ economic time series: GDP, CPI, unemployment, interest rates, money supply, yield curves |
| **Latency** | Daily to monthly (depends on series) |
| **Auth** | Free API key (register at https://fred.stlouisfed.org/docs/api/api_key.html) |
| **Rate Limits** | 120 req/min |
| **Cost** | Free |
| **Signal Quality** | HIGH -- authoritative government economic data |
| **Priority** | 1 (Critical) |

**Key Endpoints:**

```bash
# Get observations for a series (e.g., VIX)
curl "https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=$FRED_KEY&file_type=json&sort_order=desc&limit=30"

# Search for series
curl "https://api.stlouisfed.org/fred/series/search?search_text=consumer+price+index&api_key=$FRED_KEY&file_type=json"

# Recently updated series (detect new data releases)
curl "https://api.stlouisfed.org/fred/series/updates?api_key=$FRED_KEY&file_type=json&limit=50"

# Key series IDs for monitoring:
# VIXCLS - VIX (Fear Index)
# UNRATE - Unemployment Rate
# CPIAUCSL - Consumer Price Index
# GDP - Gross Domestic Product
# DGS10 - 10-Year Treasury Rate
# T10Y2Y - 10Y-2Y Spread (recession indicator)
# BAMLH0A0HYM2 - High Yield Bond Spread
# ICSA - Initial Jobless Claims (weekly)
```

**Python Client:**
```bash
pip install fredapi
```

---

### 2.5 Baltic Dry Index (Shipping/Trade)

| Field | Details |
|-------|---------|
| **Official URL** | https://api.balticexchange.com (subscription) |
| **Free Proxy** | Via FRED: series ID `DBDI` or Trading Economics |
| **Signals** | Global trade volume, commodity demand, supply chain stress |
| **Latency** | Daily |
| **Auth** | FRED API key (free proxy), Baltic Exchange subscription (official) |
| **Rate Limits** | FRED: 120 req/min |
| **Cost** | Free via FRED; paid subscription for official Baltic Exchange API |
| **Signal Quality** | HIGH -- leading indicator for global trade and economic activity |
| **Priority** | 2 (Important) |

**Key Endpoints:**

```bash
# Via FRED (free, delayed)
curl "https://api.stlouisfed.org/fred/series/observations?series_id=DBDI&api_key=$FRED_KEY&file_type=json&sort_order=desc&limit=30"
```

---

### 2.6 Fear & Greed Index

| Field | Details |
|-------|---------|
| **URL** | https://production.dataviz.cnn.io/index/fearandgreed/graphdata (unofficial) |
| **Alternative** | https://api.alternative.me/fng/ (Crypto Fear & Greed) |
| **Signals** | Market sentiment composite: volatility, momentum, safe haven demand, junk bond demand, market breadth, put/call ratio |
| **Latency** | Daily |
| **Auth** | None |
| **Rate Limits** | Undocumented |
| **Cost** | Free |
| **Signal Quality** | MEDIUM-HIGH -- useful contrarian indicator |
| **Priority** | 2 (Important) |

**Key Endpoints:**

```bash
# CNN Fear & Greed (unofficial, may break)
curl "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"

# Crypto Fear & Greed Index (stable API)
curl "https://api.alternative.me/fng/?limit=30&format=json"
```

---

## 3. Geopolitical Signals

### 3.1 GDELT (Global Database of Events, Language, and Tone)

| Field | Details |
|-------|---------|
| **URL** | https://api.gdeltproject.org, BigQuery: `gdelt-bq` |
| **Signals** | 300+ categories of political events globally, sentiment analysis, media tone, conflict escalation, protest tracking |
| **Latency** | 15 minutes (all three data streams) |
| **Auth** | None (API), Google Cloud account (BigQuery) |
| **Rate Limits** | API: generous. BigQuery: 1TB/month free |
| **Cost** | Free (API + BigQuery free tier) |
| **Signal Quality** | VERY HIGH -- most comprehensive global events database, near-real-time |
| **Priority** | 1 (Critical) |

**Key Endpoints:**

```bash
# DOC 2.0 API: Full-text search (rolling 3-month window)
curl "https://api.gdeltproject.org/api/v2/doc/doc?query=conflict%20ukraine&mode=artlist&maxrecords=50&format=json"

# DOC API: Timeline of article volume for a theme
curl "https://api.gdeltproject.org/api/v2/doc/doc?query=climate%20change&mode=timelinevol&format=json"

# DOC API: Tone analysis
curl "https://api.gdeltproject.org/api/v2/doc/doc?query=trade%20war&mode=tonechart&format=json"

# GEO API: Geographic heatmap of events
curl "https://api.gdeltproject.org/api/v2/geo/geo?query=protest&format=geojson"

# TV API: Television mentions
curl "https://api.gdeltproject.org/api/v2/tv/tv?query=inflation&mode=timelinevol&format=json"

# Raw data files (updated every 15 minutes)
# http://data.gdeltproject.org/gdeltv2/lastupdate.txt
curl "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"
```

**BigQuery (for complex analytics):**

```sql
-- Recent high-impact events by country
SELECT SQLDATE, Actor1Name, Actor2Name, EventCode, GoldsteinScale, NumMentions, AvgTone, ActionGeo_FullName
FROM `gdelt-bq.gdeltv2.events`
WHERE SQLDATE >= '20260320'
  AND GoldsteinScale < -5
ORDER BY NumMentions DESC
LIMIT 100
```

**Python Client:**
```bash
pip install gdeltPyR
```

---

### 3.2 ACLED (Armed Conflict Location & Event Data)

| Field | Details |
|-------|---------|
| **URL** | https://api.acleddata.com/acled/read |
| **Signals** | Political violence events, protests, riots, battles, explosions; georeferenced and timestamped |
| **Latency** | Weekly updates (real-time for major events) |
| **Auth** | API key + registered email (free registration at acleddata.com) |
| **Rate Limits** | 5,000 rows per request (paginate for more) |
| **Cost** | Free (academic/non-commercial); paid for commercial |
| **Signal Quality** | VERY HIGH -- gold standard for conflict data, human-coded events |
| **Priority** | 1 (Critical) |

**Key Endpoints:**

```bash
# Get recent events (JSON)
curl "https://api.acleddata.com/acled/read?key=$ACLED_KEY&email=$ACLED_EMAIL&event_date=2026-03-20|2026-03-27&event_date_where=BETWEEN&limit=500"

# Filter by country
curl "https://api.acleddata.com/acled/read?key=$ACLED_KEY&email=$ACLED_EMAIL&country=Ukraine&event_date=2026-03-01|2026-03-27&event_date_where=BETWEEN&limit=1000"

# Filter by event type
curl "https://api.acleddata.com/acled/read?key=$ACLED_KEY&email=$ACLED_EMAIL&event_type=Protests&event_date=2026-03-01|2026-03-27&event_date_where=BETWEEN&limit=500"

# Filter by region (numeric codes)
# 1=Western Africa, 2=Middle Africa, 3=Eastern Africa, etc.
curl "https://api.acleddata.com/acled/read?key=$ACLED_KEY&email=$ACLED_EMAIL&region=11&limit=500"
```

**Python Client:**
```bash
pip install acled
```

---

### 3.3 Flight Tracking (ADS-B Exchange / Flightradar24)

| Field | Details |
|-------|---------|
| **ADS-B Exchange URL** | https://adsbexchange.com/data/ (community API) |
| **Flightradar24 URL** | https://fr24api.flightradar24.com |
| **Signals** | Military aircraft movements, government flights, airspace closures, route anomalies |
| **Latency** | Real-time (seconds) |
| **Auth** | ADS-B Exchange: API key. FR24: OAuth token |
| **Rate Limits** | Varies by plan |
| **Cost** | ADS-B Exchange: free tier available. FR24: paid (tiered pricing) |
| **Signal Quality** | HIGH for geopolitical signals (military movements, airspace anomalies) |
| **Priority** | 3 (Nice-to-have) |

**Note:** ADS-B Exchange is unfiltered (shows military/government aircraft that other services hide), making it more valuable for geopolitical intelligence.

---

### 3.4 OFAC Sanctions Lists (US Treasury)

| Field | Details |
|-------|---------|
| **URL** | https://sanctionslistservice.ofac.treas.gov/api |
| **Signals** | New sanctions designations, removals, program changes; geopolitical posture shifts |
| **Latency** | Daily (when updates occur) |
| **Auth** | None |
| **Rate Limits** | Undocumented, reasonable |
| **Cost** | Free |
| **Signal Quality** | HIGH -- direct signal of US foreign policy actions |
| **Priority** | 2 (Important) |

**Key Endpoints:**

```bash
# Download SDN list (XML)
curl "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML"

# Download consolidated list (CSV)
curl "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/CONS_PRIM.CSV"

# Check last update timestamp
curl "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_XML.zip"

# Email notifications signup for updates:
# https://service.govdelivery.com/service/multi_subscribe.html?code=USTREAS
```

**EU Sanctions:**
```bash
# EU consolidated financial sanctions list (XML)
curl "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw"
```

---

### 3.5 USGS Earthquake Feed (as geopolitical/economic disruption signal)

| Field | Details |
|-------|---------|
| **URL** | https://earthquake.usgs.gov/earthquakes/feed/v1.0 |
| **Signals** | Seismic events globally with magnitude, location, depth; economic disruption potential |
| **Latency** | Real-time (minutes) |
| **Auth** | None |
| **Rate Limits** | None specified |
| **Cost** | Free |
| **Signal Quality** | HIGH -- authoritative seismic data |
| **Priority** | 2 (Important) |

**Key Endpoints:**

```bash
# All earthquakes, past hour
curl "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson"

# Significant earthquakes, past day
curl "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson"

# M4.5+ earthquakes, past week
curl "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson"

# Custom query
curl "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2026-03-20&minmagnitude=5&orderby=time"
```

---

## 4. Social Signals

### 4.1 Google Trends

| Field | Details |
|-------|---------|
| **Official API** | Launched 2025 (alpha), limited access |
| **Pytrends URL** | https://github.com/GeneralMills/pytrends |
| **SerpApi URL** | https://serpapi.com/google-trends-api |
| **Signals** | Search interest over time, trending searches, related queries, geographic interest, breakout topics |
| **Latency** | Real-time (trending searches), daily (interest over time) |
| **Auth** | Pytrends: Google login recommended. SerpApi: API key |
| **Rate Limits** | Pytrends: ~1,400 requests before throttling (60s cooldown). SerpApi: plan-dependent |
| **Cost** | Pytrends: free. SerpApi: from $75/mo |
| **Signal Quality** | VERY HIGH -- reflects genuine population interest; best early mass-adoption signal |
| **Priority** | 1 (Critical) |

**Pytrends Example (Python):**

```python
from pytrends.request import TrendReq

pytrends = TrendReq(hl='en-US', tz=360)

# Interest over time
pytrends.build_payload(['artificial intelligence', 'machine learning'], timeframe='now 7-d')
df = pytrends.interest_over_time()

# Real-time trending searches
trending = pytrends.trending_searches(pn='united_states')

# Related queries (rising = emerging)
pytrends.build_payload(['ChatGPT'])
related = pytrends.related_queries()
# related['ChatGPT']['rising'] -- shows breakout queries
```

**RSS Feeds for Daily Trends:**
```
https://trends.google.com/trending/rss?geo=US
https://trends.google.com/trending/rss?geo=DE
```

---

### 4.2 Reddit API

| Field | Details |
|-------|---------|
| **URL** | https://oauth.reddit.com |
| **Signals** | Subreddit growth, post velocity, comment sentiment, emerging communities, viral content |
| **Latency** | Real-time |
| **Auth** | OAuth2 (register app at https://www.reddit.com/prefs/apps) |
| **Rate Limits** | 100 req/min (OAuth), 10 req/min (unauthenticated) |
| **Cost** | Free tier available; paid Enterprise API for commercial use |
| **Signal Quality** | HIGH -- strong signal for grassroots movements, tech adoption, cultural shifts |
| **Priority** | 2 (Important) |

**Key Endpoints:**

```bash
# Subreddit hot posts
curl -H "Authorization: Bearer $REDDIT_TOKEN" \
  "https://oauth.reddit.com/r/technology/hot?limit=25"

# New posts in a subreddit
curl -H "Authorization: Bearer $REDDIT_TOKEN" \
  "https://oauth.reddit.com/r/artificial/new?limit=25"

# Subreddit about (subscriber count, growth)
curl -H "Authorization: Bearer $REDDIT_TOKEN" \
  "https://oauth.reddit.com/r/LocalLLaMA/about"

# Search across Reddit
curl -H "Authorization: Bearer $REDDIT_TOKEN" \
  "https://oauth.reddit.com/search?q=AI+regulation&sort=new&limit=25"

# Trending subreddits (unofficial)
curl "https://www.reddit.com/subreddits/popular.json?limit=25"
```

**Signal Extraction Strategy:**
- Track subscriber growth rate for key subreddits (r/artificial, r/LocalLLaMA, r/MachineLearning, r/technology, r/geopolitics, r/economics)
- Monitor post volume velocity in niche subreddits
- Detect new subreddit creation as a signal of emerging communities

---

### 4.3 Wikipedia Pageviews API

| Field | Details |
|-------|---------|
| **URL** | https://wikimedia.org/api/rest_v1/metrics/pageviews |
| **Signals** | Pageview spikes (breaking events), trending topics, public attention shifts |
| **Latency** | Daily (with 1-2 day lag for complete data) |
| **Auth** | None (User-Agent header required) |
| **Rate Limits** | 200 req/sec |
| **Cost** | Free |
| **Signal Quality** | HIGH -- pageview spikes are strong signals of public attention/breaking events |
| **Priority** | 2 (Important) |

**Key Endpoints:**

```bash
# Top viewed articles for a specific day
curl -H "User-Agent: TrendRadar/1.0 (contact@example.com)" \
  "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/2026/03/26"

# Pageviews for a specific article (daily granularity)
curl -H "User-Agent: TrendRadar/1.0" \
  "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Artificial_intelligence/daily/20260301/20260327"

# Aggregate pageviews for all of Wikipedia
curl -H "User-Agent: TrendRadar/1.0" \
  "https://wikimedia.org/api/rest_v1/metrics/pageviews/aggregate/en.wikipedia/all-access/all-agents/daily/20260301/20260327"
```

**Signal Extraction Strategy:**
- Daily top-viewed articles scan for anomalous entries (events, people, topics not normally in top 1000)
- Track pageview velocity for watchlist articles (geopolitical hotspots, emerging technologies)
- Compare current pageviews to historical baseline for spike detection

---

### 4.4 Twitter/X API

| Field | Details |
|-------|---------|
| **URL** | https://api.x.com/2 (formerly api.twitter.com) |
| **Signals** | Trending topics, viral content, real-time event detection, sentiment |
| **Latency** | Real-time |
| **Auth** | OAuth 2.0 (Bearer Token) |
| **Rate Limits** | Basic: 10,000 tweets/month read. Pro: 1M tweets/month |
| **Cost** | Basic: $200/mo. Pro: $5,000/mo. Enterprise: custom |
| **Signal Quality** | HIGH -- fastest signal for breaking events; EXPENSIVE for programmatic use |
| **Priority** | 3 (Nice-to-have, due to cost) |

**Key Endpoints:**

```bash
# Search recent tweets
curl -H "Authorization: Bearer $X_TOKEN" \
  "https://api.x.com/2/tweets/search/recent?query=AI%20regulation&max_results=100&tweet.fields=created_at,public_metrics"

# Trending topics for a WOEID location
curl -H "Authorization: Bearer $X_TOKEN" \
  "https://api.x.com/1.1/trends/place.json?id=1"   # 1 = Worldwide

# Counts endpoint (volume over time)
curl -H "Authorization: Bearer $X_TOKEN" \
  "https://api.x.com/2/tweets/counts/recent?query=supply+chain+disruption&granularity=day"
```

**Alternative (Free):** Use Nitter instances or social listening tools like BrandWatch.

---

## 5. Regulatory Signals

### 5.1 Federal Register API (US Regulations)

| Field | Details |
|-------|---------|
| **URL** | https://www.federalregister.gov/api/v1 |
| **Signals** | New proposed rules, final rules, executive orders, agency notices; regulatory direction |
| **Latency** | Daily (published each business day) |
| **Auth** | None required |
| **Rate Limits** | None specified (no API key needed) |
| **Cost** | Free |
| **Signal Quality** | VERY HIGH -- authoritative US regulatory data |
| **Priority** | 1 (Critical) |

**Key Endpoints:**

```bash
# Search recent documents
curl "https://www.federalregister.gov/api/v1/documents.json?conditions[publication_date][gte]=2026-03-20&per_page=20&order=newest"

# Search by agency
curl "https://www.federalregister.gov/api/v1/documents.json?conditions[agencies][]=environmental-protection-agency&conditions[type][]=RULE&per_page=20"

# Search by keyword
curl "https://www.federalregister.gov/api/v1/documents.json?conditions[term]=artificial+intelligence&per_page=20&order=relevance"

# Get specific document
curl "https://www.federalregister.gov/api/v1/documents/2026-05678.json"

# Public inspection documents (upcoming publications)
curl "https://www.federalregister.gov/api/v1/public-inspection-documents.json?conditions[available_on]=2026-03-27"
```

**Regulations.gov API (v4) for comments and dockets:**
```bash
# Search documents
curl "https://api.regulations.gov/v4/documents?filter[searchTerm]=artificial+intelligence&api_key=DEMO_KEY&page[size]=20"

# Get comments on a regulation
curl "https://api.regulations.gov/v4/comments?filter[commentOnId]={docketId}&api_key=DEMO_KEY"
```

---

### 5.2 EUR-Lex (EU Legislation)

| Field | Details |
|-------|---------|
| **URL** | https://eur-lex.europa.eu |
| **SPARQL** | https://publications.europa.eu/webapi/rdf/sparql |
| **Signals** | New EU regulations, directives, decisions; AI Act updates, GDPR enforcement, trade policy |
| **Latency** | Daily |
| **Auth** | None |
| **Rate Limits** | Moderate |
| **Cost** | Free |
| **Signal Quality** | VERY HIGH -- authoritative EU regulatory data |
| **Priority** | 1 (Critical) |

**Key Endpoints:**

```bash
# RSS feed: New legislation
# https://eur-lex.europa.eu/EN/display-feed.html (configure and generate RSS)

# CELLAR SPARQL endpoint for structured queries
curl -X POST "https://publications.europa.eu/webapi/rdf/sparql" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/json" \
  --data-urlencode "query=PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
    SELECT ?work ?title ?date WHERE {
      ?work cdm:work_date_document ?date .
      ?work cdm:work_is_about_concept_eurovoc <http://eurovoc.europa.eu/4306> .
      ?expr cdm:expression_belongs_to_work ?work .
      ?expr cdm:expression_title ?title .
      FILTER(lang(?title) = 'en')
      FILTER(?date >= '2026-03-01'^^xsd:date)
    } ORDER BY DESC(?date) LIMIT 20"

# REST API for document search
curl "https://eur-lex.europa.eu/api/search?text=artificial+intelligence&type=REGULATION&dateFrom=2026-01-01&language=EN"
```

**RSS Feeds:**
```
# New Official Journal publications
https://eur-lex.europa.eu/rss/oj-l.xml
https://eur-lex.europa.eu/rss/oj-c.xml
```

---

### 5.3 SEC EDGAR (Securities Filings)

| Field | Details |
|-------|---------|
| **URL** | https://efts.sec.gov/LATEST, https://data.sec.gov |
| **Signals** | Company filings (10-K, 10-Q, 8-K), insider trading (Form 4), new IPOs (S-1), risk factor changes |
| **Latency** | Real-time (filings appear within minutes of submission) |
| **Auth** | None (User-Agent header with company name and email required) |
| **Rate Limits** | 10 req/sec |
| **Cost** | Free |
| **Signal Quality** | VERY HIGH -- mandated disclosures, earliest signal of corporate changes |
| **Priority** | 2 (Important) |

**Key Endpoints:**

```bash
# Full-text search across all filings
curl -H "User-Agent: TrendRadar research@example.com" \
  "https://efts.sec.gov/LATEST/search-index?q=%22artificial+intelligence%22&dateRange=custom&startdt=2026-03-01&enddt=2026-03-27&forms=10-K,8-K"

# Recent filings RSS
curl "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&dateb=&owner=include&count=40&search_text=&start=0&output=atom"

# Company filings by CIK
curl -H "User-Agent: TrendRadar research@example.com" \
  "https://data.sec.gov/submissions/CIK0000320193.json"  # Apple

# XBRL company facts (structured financial data)
curl -H "User-Agent: TrendRadar research@example.com" \
  "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json"
```

**RSS Feeds:**
```
# Recent 8-K filings (material events)
https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&dateb=&owner=include&count=40&output=atom

# Recent S-1 filings (new IPOs)
https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=S-1&dateb=&owner=include&count=40&output=atom
```

---

### 5.4 AI Incident Database (AIID)

| Field | Details |
|-------|---------|
| **URL** | https://incidentdatabase.ai |
| **API** | MongoDB Realm / GraphQL at https://realm.mongodb.com/api/client/v2.0/app/aiidstitch2-aewms |
| **Signals** | AI system failures, safety incidents, harm reports; regulatory trigger events |
| **Latency** | Days to weeks (community-reported) |
| **Auth** | Anonymous login to MongoDB Realm |
| **Rate Limits** | Undocumented |
| **Cost** | Free |
| **Signal Quality** | MEDIUM -- community-curated, may lag real events |
| **Priority** | 3 (Nice-to-have) |

---

### 5.5 GDPR Enforcement Tracker

| Field | Details |
|-------|---------|
| **URL** | https://www.enforcementtracker.com |
| **Signals** | GDPR fines, enforcement actions, regulatory precedents |
| **Latency** | Days (after enforcement actions are published) |
| **Auth** | Web scraping required (no official API) |
| **Rate Limits** | N/A |
| **Cost** | Free (web access) |
| **Signal Quality** | HIGH -- comprehensive GDPR enforcement database |
| **Priority** | 3 (Nice-to-have) |

---

## 6. Climate & Environment Signals

### 6.1 NASA EONET (Earth Observatory Natural Event Tracker)

| Field | Details |
|-------|---------|
| **URL** | https://eonet.gsfc.nasa.gov/api/v3 |
| **Signals** | Natural events globally: wildfires, volcanic eruptions, severe storms, icebergs, drought |
| **Latency** | Near-real-time (hours) |
| **Auth** | None |
| **Rate Limits** | None specified |
| **Cost** | Free |
| **Signal Quality** | HIGH -- satellite-verified natural events with geographic coordinates |
| **Priority** | 1 (Critical) |

**Key Endpoints:**

```bash
# All open (active) events
curl "https://eonet.gsfc.nasa.gov/api/v3/events?status=open"

# Events by category (wildfires)
curl "https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open"

# Events in date range
curl "https://eonet.gsfc.nasa.gov/api/v3/events?start=2026-03-01&end=2026-03-27"

# List all event categories
curl "https://eonet.gsfc.nasa.gov/api/v3/categories"

# Categories include:
# drought, dustHaze, earthquakes, floods, landslides, manmade,
# seaLakeIce, severeStorms, snow, tempExtremes, volcanoes, waterColor, wildfires
```

---

### 6.2 NOAA Weather Alerts API

| Field | Details |
|-------|---------|
| **URL** | https://api.weather.gov |
| **Signals** | Severe weather alerts, warnings, watches; hurricanes, tornadoes, floods, winter storms |
| **Latency** | Real-time (minutes) |
| **Auth** | None (User-Agent header required) |
| **Rate Limits** | Reasonable (not strictly documented; avoid >60 req/min) |
| **Cost** | Free |
| **Signal Quality** | VERY HIGH -- official NWS alerts |
| **Priority** | 1 (Critical) |

**Key Endpoints:**

```bash
# All active alerts in the US
curl -H "User-Agent: TrendRadar (contact@example.com)" \
  "https://api.weather.gov/alerts/active"

# Active alerts by state
curl -H "User-Agent: TrendRadar" \
  "https://api.weather.gov/alerts/active?area=CA"

# Active alerts by severity
curl -H "User-Agent: TrendRadar" \
  "https://api.weather.gov/alerts/active?severity=Extreme,Severe"

# Active alerts by event type
curl -H "User-Agent: TrendRadar" \
  "https://api.weather.gov/alerts/active?event=Tornado%20Warning"

# Alerts for a specific point
curl -H "User-Agent: TrendRadar" \
  "https://api.weather.gov/alerts/active?point=38.9807,-76.9373"

# API specification
curl "https://api.weather.gov/openapi.json"
```

**ATOM/RSS Feed:**
```
https://alerts.weather.gov/cap/us.php?x=0
```

---

### 6.3 Global Climate Monitoring

| Field | Details |
|-------|---------|
| **NOAA Climate URL** | https://www.ncdc.noaa.gov/cdo-web/api/v2 |
| **NASA GISS URL** | https://data.giss.nasa.gov |
| **Signals** | Temperature anomalies, sea level changes, ice extent, CO2 levels |
| **Latency** | Daily to monthly |
| **Auth** | NOAA CDO: free API token |
| **Rate Limits** | NOAA CDO: 5 req/sec, 1,000 req/day |
| **Cost** | Free |
| **Signal Quality** | HIGH -- authoritative climate science data |
| **Priority** | 3 (Nice-to-have) |

**Key Endpoints:**

```bash
# NOAA Climate Data Online: Temperature data
curl -H "token: $NOAA_TOKEN" \
  "https://www.ncdc.noaa.gov/cdo-web/api/v2/data?datasetid=GHCND&locationid=FIPS:US&startdate=2026-03-01&enddate=2026-03-27&datatypeid=TAVG&limit=25"

# NASA GISS global temperature anomalies (CSV)
curl "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv"

# NOAA sea level data
# https://tidesandcurrents.noaa.gov/api/
curl "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=8518750&product=water_level&datum=MLLW&units=metric&time_zone=gmt&application=TrendRadar&format=json"
```

---

## 7. Health Signals

### 7.1 WHO Disease Outbreak News

| Field | Details |
|-------|---------|
| **URL** | https://www.who.int/emergencies/disease-outbreak-news |
| **RSS** | https://www.who.int/feeds/entity/don/en/rss.xml |
| **Signals** | Disease outbreaks globally, pandemic early warnings, emerging infectious diseases |
| **Latency** | Days (after WHO verification) |
| **Auth** | None |
| **Rate Limits** | N/A (RSS) |
| **Cost** | Free |
| **Signal Quality** | VERY HIGH -- gold standard for global health alerts |
| **Priority** | 1 (Critical) |

**Key Endpoints:**

```bash
# RSS feed for Disease Outbreak News
curl "https://www.who.int/feeds/entity/don/en/rss.xml"

# WHO Events (broader health emergencies)
# https://www.who.int/emergencies/disease-outbreak-news/rss.xml

# WHO GHO (Global Health Observatory) OData API
curl "https://ghoapi.azureedge.net/api/Indicator?$filter=contains(IndicatorName,'outbreak')"
```

---

### 7.2 ProMED (Program for Monitoring Emerging Diseases)

| Field | Details |
|-------|---------|
| **URL** | https://promedmail.org |
| **RSS** | https://promedmail.org/feed/ |
| **Signals** | Early disease outbreak reports, often before official WHO confirmation; zoonotic events, food safety |
| **Latency** | Hours to days (faster than WHO) |
| **Auth** | None (RSS), free registration for full access |
| **Rate Limits** | N/A (RSS) |
| **Cost** | Free |
| **Signal Quality** | VERY HIGH -- historically first to report many outbreaks (SARS, Ebola, COVID-19) |
| **Priority** | 1 (Critical) |

**Key Endpoints:**

```bash
# RSS feed (all alerts)
curl "https://promedmail.org/feed/"

# ProMED also provides email alerts via subscription
# Register at https://promedmail.org to receive alerts
```

**Note:** ProMED was historically part of ISID (International Society for Infectious Diseases). It may have limited programmatic API access, but the RSS feed provides reliable outbreak notifications.

---

### 7.3 CDC NWSS Wastewater Surveillance

| Field | Details |
|-------|---------|
| **URL** | https://data.cdc.gov |
| **Dataset** | https://data.cdc.gov/resource/2ew6-ywp6 (SARS-CoV-2 wastewater metrics) |
| **Signals** | Pathogen levels in wastewater: COVID-19, Influenza, RSV; population-level infection trends before clinical cases |
| **Latency** | Weekly (updated Fridays) |
| **Auth** | None (app token recommended to avoid throttling) |
| **Rate Limits** | Generous with app token; throttled without |
| **Cost** | Free |
| **Signal Quality** | HIGH -- leading indicator for disease waves (1-2 weeks ahead of clinical data) |
| **Priority** | 2 (Important) |

**Key Endpoints (Socrata SODA API):**

```bash
# Recent wastewater data (JSON)
curl "https://data.cdc.gov/resource/2ew6-ywp6.json?\$limit=50&\$order=date_end DESC"

# Filter by state
curl "https://data.cdc.gov/resource/2ew6-ywp6.json?\$where=state='California'&\$limit=50&\$order=date_end DESC"

# Filter by date range
curl "https://data.cdc.gov/resource/2ew6-ywp6.json?\$where=date_end>'2026-03-01'&\$limit=100"

# With app token (higher rate limits)
curl "https://data.cdc.gov/resource/2ew6-ywp6.json?\$\$app_token=$CDC_APP_TOKEN&\$limit=50"
```

**GitHub Repository:** https://github.com/CDCgov/NWSS (code, validation schemas, data pipelines)

---

## 8. Implementation Priority Matrix

### Priority 1 -- Critical (Implement First)

These provide the highest signal-to-noise ratio and are easiest to integrate:

| # | Source | Category | Update Freq | Cost | Effort |
|---|--------|----------|-------------|------|--------|
| 1 | **GDELT** | Geopolitical | 15 min | Free | Medium |
| 2 | **Hacker News** (Algolia + Firebase) | Technology | Real-time | Free | Low |
| 3 | **GitHub API** | Technology | Real-time | Free | Low |
| 4 | **arXiv + OpenAlex** | Technology | Daily | Free | Medium |
| 5 | **Polymarket** | Market/Predictions | Real-time | Free | Low |
| 6 | **Metaculus** | Predictions | Hourly | Free | Low |
| 7 | **FRED** | Economic | Daily | Free | Low |
| 8 | **Google Trends** (Pytrends) | Social | Daily | Free | Medium |
| 9 | **Federal Register** | Regulatory | Daily | Free | Low |
| 10 | **EUR-Lex** | Regulatory | Daily | Free | Medium |
| 11 | **NASA EONET** | Climate | Hours | Free | Low |
| 12 | **NOAA Alerts** | Climate | Real-time | Free | Low |
| 13 | **WHO DON** | Health | Days | Free | Low |
| 14 | **ProMED** | Health | Hours | Free | Low |
| 15 | **ACLED** | Geopolitical | Weekly | Free | Medium |

### Priority 2 -- Important (Implement Second)

| # | Source | Category | Update Freq | Cost | Effort |
|---|--------|----------|-------------|------|--------|
| 16 | **Manifold Markets** | Predictions | Real-time | Free | Low |
| 17 | **Reddit API** | Social | Real-time | Free | Medium |
| 18 | **Wikipedia Pageviews** | Social | Daily | Free | Low |
| 19 | **npm / PyPI** | Technology | Daily | Free | Medium |
| 20 | **Product Hunt** | Technology | Daily | Free | Medium |
| 21 | **SEC EDGAR** | Regulatory/Market | Real-time | Free | Medium |
| 22 | **OFAC Sanctions** | Geopolitical | Daily | Free | Low |
| 23 | **Baltic Dry Index** (via FRED) | Economic | Daily | Free | Low |
| 24 | **Fear & Greed Index** | Market | Daily | Free | Low |
| 25 | **CDC Wastewater** | Health | Weekly | Free | Low |
| 26 | **USGS Earthquakes** | Climate/Geopolitical | Real-time | Free | Low |

### Priority 3 -- Nice-to-Have (Implement Later)

| # | Source | Category | Update Freq | Cost | Effort |
|---|--------|----------|-------------|------|--------|
| 27 | **Stack Overflow** | Technology | Daily | Free | Medium |
| 28 | **Twitter/X API** | Social | Real-time | $200+/mo | High |
| 29 | **Flight Tracking** (ADS-B Exchange) | Geopolitical | Real-time | Varies | High |
| 30 | **AI Incident Database** | Regulatory | Days | Free | Medium |
| 31 | **GDPR Enforcement Tracker** | Regulatory | Days | Free | High (scraping) |
| 32 | **NOAA Climate Data Online** | Climate | Monthly | Free | Medium |

---

## 9. Architecture Notes

### 9.1 Recommended Ingestion Architecture

```
                    +-----------------+
                    |   Scheduler     |
                    |  (cron / queue) |
                    +--------+--------+
                             |
              +--------------+--------------+
              |              |              |
    +---------v---+  +-------v-----+  +----v--------+
    | Real-Time   |  | Hourly      |  | Daily       |
    | Collectors  |  | Collectors  |  | Collectors  |
    | (WebSocket, |  | (REST poll) |  | (REST poll) |
    |  SSE, RSS)  |  |             |  |             |
    +------+------+  +------+------+  +------+------+
           |                |                |
           +--------+-------+--------+-------+
                    |                |
           +--------v--------+  +---v-----------+
           | Event Queue     |  | Raw Storage   |
           | (Redis/BullMQ)  |  | (S3/SQLite)   |
           +--------+--------+  +---+-----------+
                    |                |
           +--------v----------------v--------+
           |       Signal Processing          |
           |  - Anomaly detection             |
           |  - Trend velocity calculation    |
           |  - Cross-source correlation      |
           |  - NLP topic extraction          |
           +----------------+-----------------+
                            |
                   +--------v--------+
                   |  Signals DB     |
                   |  (PostgreSQL)   |
                   +--------+--------+
                            |
                   +--------v--------+
                   |  Dashboard /    |
                   |  Alert System   |
                   +-----------------+
```

### 9.2 Signal Processing Strategies

1. **Velocity Detection:** Track rate of change for all numeric signals (stars, upvotes, mentions, pageviews). Alert on acceleration (second derivative) not just growth.

2. **Cross-Source Correlation:** When the same topic appears in 3+ independent sources within 48 hours, it signals genuine emergence. Example: new AI technique appears on arXiv, then HN front page, then GitHub stars spike.

3. **Anomaly Detection:** For each signal, maintain a rolling baseline (30-day moving average). Flag values exceeding 2 standard deviations.

4. **Topic Clustering:** Use NLP to cluster signals across sources by topic. A technology that appears simultaneously in arXiv papers, GitHub repos, and HN discussions is more significant than one appearing in a single source.

5. **Prediction Market Calibration:** Use Polymarket/Metaculus probabilities as calibration signals for other data. If prediction markets assign high probability to an event, weight related signals more heavily.

### 9.3 API Key Requirements Summary

| Service | Key Required | Registration URL |
|---------|-------------|-----------------|
| GitHub | Yes (recommended) | https://github.com/settings/tokens |
| Hacker News | No | -- |
| Product Hunt | Yes | https://www.producthunt.com/v2/oauth/applications |
| arXiv | No | -- |
| OpenAlex | No (email recommended) | -- |
| npm/PyPI | No | -- |
| Stack Exchange | Yes (recommended) | https://stackapps.com/apps/oauth/register |
| Polymarket | No (read) | -- |
| Manifold | No (read) | -- |
| Metaculus | No (read) | -- |
| FRED | Yes | https://fred.stlouisfed.org/docs/api/api_key.html |
| GDELT | No | -- |
| ACLED | Yes | https://acleddata.com/register/ |
| OFAC | No | -- |
| Google Trends | No (Pytrends) | -- |
| Reddit | Yes | https://www.reddit.com/prefs/apps |
| Wikipedia | No | -- |
| Twitter/X | Yes | https://developer.x.com |
| Federal Register | No | -- |
| EUR-Lex | No | -- |
| SEC EDGAR | No | -- |
| Regulations.gov | Yes | https://api.data.gov/signup/ |
| NASA EONET | No | -- |
| NOAA Weather | No | -- |
| NOAA CDO | Yes | https://www.ncdc.noaa.gov/cdo-web/token |
| CDC (SODA) | Recommended | https://data.cdc.gov/profile/edit/developer_settings |

### 9.4 Total Estimated Monthly Cost

| Tier | Sources Covered | Monthly Cost |
|------|----------------|-------------|
| **Free Tier** | 28 of 32 sources | $0 |
| **With SerpApi** (Google Trends) | +1 | $75/mo |
| **With Twitter/X Basic** | +1 | $200/mo |
| **With Flight Tracking** | +1 | ~$50-200/mo |
| **Full Suite** | All 32 | ~$325-475/mo |

The core intelligence system (Priority 1 + 2) can be built entirely on free APIs.

---

## 10. Quick Start: First 5 Sources to Implement

For a minimum viable signal system, start with these five free sources that cover the broadest range of intelligence needs:

1. **GDELT** -- 15-min global events coverage (geopolitical, conflict, sentiment)
2. **Hacker News + GitHub** -- real-time technology emergence
3. **Google Trends** (Pytrends RSS) -- mass public interest shifts
4. **FRED** -- macroeconomic indicators
5. **NASA EONET + NOAA** -- environmental disruption events

These five cover all seven signal categories and can be operational within a single development sprint.
