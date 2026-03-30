# Strategic Intelligence System — Master Source Registry

> Comprehensive registry of all data sources, APIs, and intelligence feeds for the Strategic Intelligence System (SIS). Each entry is classified, scored, and prioritized for connector development.
>
> **Total Sources:** 127
> **Last Updated:** 2026-03-27

---

## Table of Contents

1. [Priority Matrix (P0-P3)](#priority-matrix)
2. [Summary Dashboard](#summary-dashboard)
3. [Full Registry](#full-registry)
   - [1. Authoritative Trend Reports](#cat-1-authoritative-trend-reports)
   - [2. Prediction Markets](#cat-2-prediction-markets)
   - [3. Economic / Financial](#cat-3-economic--financial)
   - [4. Technology / Innovation](#cat-4-technology--innovation)
   - [5. Geopolitical / Security](#cat-5-geopolitical--security)
   - [6. Climate / Environment](#cat-6-climate--environment)
   - [7. Social / Demographic](#cat-7-social--demographic)
   - [8. Regulatory / Policy](#cat-8-regulatory--policy)
   - [9. Health](#cat-9-health)
   - [10. Think Tanks](#cat-10-think-tanks)
   - [11. News / Media](#cat-11-news--media)
   - [12. Startup / VC](#cat-12-startup--vc)
   - [13. Supply Chain](#cat-13-supply-chain)
   - [14. Thought Leaders](#cat-14-thought-leaders)
4. [Coverage Analysis](#coverage-analysis)
5. [Connector Development Roadmap](#connector-development-roadmap)

---

<a id="priority-matrix"></a>
## Priority Matrix

| Priority | Definition | Count | Action |
|----------|-----------|-------|--------|
| **P0** | Active connectors — already integrated and pulling signals | 13 | Maintain, monitor uptime |
| **P1** | High value, free/freemium API, structured data — build next | 28 | Develop connector Q2 2026 |
| **P2** | High value but requires scraping, paid access, or manual ingest | 42 | Schedule for Q3-Q4 2026 |
| **P3** | Niche, infrequent, or supplementary — monitor manually | 44 | Watch list, manual review |

---

<a id="summary-dashboard"></a>
## Summary Dashboard

### By Category

| # | Category | Sources | P0 | P1 | P2 | P3 |
|---|----------|---------|----|----|----|----|
| 1 | Authoritative Trend Reports | 20 | 0 | 7 | 9 | 4 |
| 2 | Prediction Markets | 5 | 1 | 2 | 1 | 1 |
| 3 | Economic / Financial | 12 | 0 | 4 | 5 | 3 |
| 4 | Technology / Innovation | 18 | 5 | 5 | 5 | 3 |
| 5 | Geopolitical / Security | 10 | 1 | 2 | 4 | 3 |
| 6 | Climate / Environment | 8 | 1 | 2 | 3 | 2 |
| 7 | Social / Demographic | 7 | 1 | 1 | 3 | 2 |
| 8 | Regulatory / Policy | 6 | 1 | 2 | 2 | 1 |
| 9 | Health | 5 | 0 | 1 | 2 | 2 |
| 10 | Think Tanks | 11 | 0 | 1 | 5 | 5 |
| 11 | News / Media | 9 | 2 | 1 | 3 | 3 |
| 12 | Startup / VC | 8 | 1 | 3 | 3 | 1 |
| 13 | Supply Chain | 4 | 0 | 1 | 2 | 1 |
| 14 | Thought Leaders | 4 | 0 | 1 | 1 | 2 |
| | **TOTAL** | **127** | **13** | **33** | **48** | **33** |

### By Access Type

| Access | Count | Notes |
|--------|-------|-------|
| Free / Open API | 52 | No auth or free API key |
| Freemium | 34 | Summary free, full data paid |
| Paid | 22 | Subscription required |
| Restricted | 19 | Government/internal or scrape-only |

### By Integration Status

| Status | Count |
|--------|-------|
| Active (connector running) | 13 |
| Planned (P1, development scheduled) | 33 |
| Candidate (P2, evaluated) | 48 |
| Watch (P3, monitor) | 33 |

---

<a id="full-registry"></a>
## Full Registry

### Format Key

Each entry follows this structure:

```
ID | Name | URL | API Endpoint | Category | Signal Type | Data Format
Auth | Cost | Update Frequency | Coverage | Reliability | Integration Status | Notes
```

**Reliability:** 1-5 stars (methodology rigor, track record, data quality)
**Signal Type:** trend_report | prediction | economic_data | tech_signal | geopolitical | climate_data | social_data | regulatory | health_data | analysis | news | startup_data | supply_chain | thought_leadership

---

<a id="cat-1-authoritative-trend-reports"></a>
### CAT 1: Authoritative Trend Reports

#### SRC-001 | EU ESPAS (European Strategy and Policy Analysis System)
| Field | Value |
|-------|-------|
| **URL** | https://espas.eu |
| **API Endpoint** | None (PDF reports) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Every 5 years |
| **Coverage** | EU / Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Original 6 source. "Global Trends to 2030" flagship. Produced by EU institutions jointly. Next major edition expected ~2028. Manual PDF ingest required. |

#### SRC-002 | Zukunftsinstitut
| Field | Value |
|-------|-------|
| **URL** | https://www.zukunftsinstitut.de |
| **API Endpoint** | None (web content) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | HTML / PDF |
| **Auth** | None |
| **Cost** | Freemium |
| **Update Frequency** | Continuous |
| **Coverage** | DACH / Europe |
| **Reliability** | ★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Original 6 source. Matthias Horx. 12 Megatrends model. Strong German-language foresight. Megatrend Map is a widely used visualization. |

#### SRC-003 | PwC Global Megatrends
| Field | Value |
|-------|-------|
| **URL** | https://www.pwc.com/gx/en/issues/megatrends.html |
| **API Endpoint** | None (web/PDF) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | HTML / PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Original 6 source. Five Megatrends framework. Strong quantitative backing from PwC's global client base. |

#### SRC-004 | EY Megatrends
| Field | Value |
|-------|-------|
| **URL** | https://www.ey.com/en_gl/megatrends |
| **API Endpoint** | None (web/PDF) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | HTML / PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual |
| **Coverage** | Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Original 6 source. Megatrends 2026+ with sector-specific breakdowns. |

#### SRC-005 | TRENDONE Trend Universe
| Field | Value |
|-------|-------|
| **URL** | https://www.trendone.com |
| **API Endpoint** | None (platform) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | Platform / PDF |
| **Auth** | Login required |
| **Cost** | Paid |
| **Update Frequency** | Continuous |
| **Coverage** | Global / DACH |
| **Reliability** | ★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Original 6 source. 18 Mega-Trends, Trend Universe 2026. Proprietary trend database with micro-trend tracking. |

#### SRC-006 | Roland Berger Trend Compendium 2050
| Field | Value |
|-------|-------|
| **URL** | https://www.rolandberger.com/en/Insights/Global-Topics/Trend-Compendium/ |
| **API Endpoint** | None (PDF) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Periodic (multi-year) |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Original 6 source. 7 megatrends to 2050. 200+ pages of quantitative projections. One of the longest time horizons in consulting foresight. |

#### SRC-007 | McKinsey Global Institute (MGI)
| Field | Value |
|-------|-------|
| **URL** | https://www.mckinsey.com/mgi/overview |
| **API Endpoint** | None (web/PDF) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | HTML / PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Tech Trends Outlook (annual, 13+ trends). 18 Arenas of Competition ($29-48T by 2040). RSS feed available for new publications. |

#### SRC-008 | BCG — Ten Forces
| Field | Value |
|-------|-------|
| **URL** | https://www.bcg.com/publications |
| **API Endpoint** | None (web/PDF) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | HTML / PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Ten Forces Reshaping Global Business. Strong AI adoption surveys (10,000+ employees). |

#### SRC-009 | Deloitte Tech Trends
| Field | Value |
|-------|-------|
| **URL** | https://www.deloitte.com/us/en/insights/topics/technology-management/tech-trends.html |
| **API Endpoint** | None (web/PDF) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | HTML / PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual (January) |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | 17th edition in 2026. 5 major trends + 8 emerging signals. TMT Predictions (December). 17-year track record. |

#### SRC-010 | Accenture Technology Vision
| Field | Value |
|-------|-------|
| **URL** | https://www.accenture.com/us-en/insights/technology/technology-trends-index |
| **API Endpoint** | None (web/PDF) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | HTML / PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual + Quarterly (Pulse of Change) |
| **Coverage** | Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | 25th edition. Pulse of Change = quarterly executive confidence tracker. Industry vertical breakdowns. |

#### SRC-011 | KPMG Futures Report
| Field | Value |
|-------|-------|
| **URL** | https://kpmg.com/us/en/articles/2025/kpmg-2025-futures-report.html |
| **API Endpoint** | None (web/PDF) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | HTML / PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual |
| **Coverage** | Global (27 countries) |
| **Reliability** | ★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | 7 pivotal innovation areas. 2,500 tech executive survey. Covers space economy, quantum. |

#### SRC-012 | Capgemini Research Institute
| Field | Value |
|-------|-------|
| **URL** | https://www.capgemini.com/us-en/insights/research-library/ |
| **API Endpoint** | None (web/PDF) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | HTML / PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual |
| **Coverage** | Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Dual-lens: 1,500 execs + 500 investors. TechnoVision mid-year. |

#### SRC-013 | Frost & Sullivan Visionary Innovation
| Field | Value |
|-------|-------|
| **URL** | https://www.frost.com/analytics/visionary-innovation/megatrends/ |
| **API Endpoint** | None (web/reports) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | PDF / Webinar |
| **Auth** | Registration |
| **Cost** | Freemium |
| **Update Frequency** | Annual + Continuous |
| **Coverage** | Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | 13 megatrends framework. Transformational growth opportunities. Deep industry verticals. |

#### SRC-014 | Bain & Company Macro Trends
| Field | Value |
|-------|-------|
| **URL** | https://www.bain.com/insights/topics/macro-trends/ |
| **API Endpoint** | None (web/PDF) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | HTML / PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Three Great Forces framework. Strongest on investment flows and M&A trends. |

#### SRC-015 | WEF Global Risks Report
| Field | Value |
|-------|-------|
| **URL** | https://www.weforum.org/publications/global-risks-report-2026/ |
| **API Endpoint** | None (PDF, some data via API) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | PDF / Interactive web |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual (January, Davos) |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | 1,300+ experts + 11,000 business leaders. Risk interconnection matrix. 2-year and 10-year horizons. Co-produced with Marsh McLennan. |

#### SRC-016 | US NIC Global Trends
| Field | Value |
|-------|-------|
| **URL** | https://www.dni.gov/index.php/gt2040-home |
| **API Endpoint** | None (PDF) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Every 4 years |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | 18 US intelligence agencies. 5 scenario narratives. Global Trends 2045 expected soon. Most authoritative government foresight product globally. |

#### SRC-017 | OECD Strategic Foresight
| Field | Value |
|-------|-------|
| **URL** | https://www.oecd.org/en/about/programmes/strategic-foresight.html |
| **API Endpoint** | OECD.Stat API: https://stats.oecd.org/restsdmx/sdmx.ashx |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | PDF / SDMX API |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | 38 OECD nations + Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Global Scenarios 2035. Government Foresight Community links 38+ national foresight units. SDMX API for statistical data. |

#### SRC-018 | Japan NISTEP S&T Foresight
| Field | Value |
|-------|-------|
| **URL** | https://www.nistep.go.jp/en/?page_id=56 |
| **API Endpoint** | None (PDF) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Every 5 years |
| **Coverage** | Japan / Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Running since 1971. 12th Delphi survey. 702 S&T topics across 32 themes. 30-year horizon. |

#### SRC-019 | Singapore CSF Foresight
| Field | Value |
|-------|-------|
| **URL** | https://www.csf.gov.sg/ |
| **API Endpoint** | None (PDF) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Biennial |
| **Coverage** | Global / ASEAN |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | World-leading government foresight unit. Scenario Planning Plus (SP+) methodology. |

#### SRC-020 | CSIRO Our Future World
| Field | Value |
|-------|-------|
| **URL** | https://www.csiro.au/en/research/technology-space/data/our-future-world |
| **API Endpoint** | None (PDF) |
| **Category** | 1 - Authoritative Trend Reports |
| **Signal Type** | trend_report |
| **Data Format** | PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Every 10 years |
| **Coverage** | Australia / Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | 7 global megatrends. National science agency lens. Indo-Pacific perspective. Next edition ~2032. |

---

<a id="cat-2-prediction-markets"></a>
### CAT 2: Prediction Markets

#### SRC-021 | Polymarket
| Field | Value |
|-------|-------|
| **URL** | https://polymarket.com |
| **API Endpoint** | https://gamma-api.polymarket.com + https://clob.polymarket.com |
| **Category** | 2 - Prediction Markets |
| **Signal Type** | prediction |
| **Data Format** | JSON REST API |
| **Auth** | None (public API) |
| **Cost** | Free |
| **Update Frequency** | Real-time |
| **Coverage** | Global (politics, tech, crypto, macro) |
| **Reliability** | ★★★★ |
| **Integration Status** | **Active (P0)** |
| **Notes** | Active connector in `src/connectors/polymarket.ts`. Real money at stake = high-quality crowd wisdom signal. CLOB API for orderbook data. |

#### SRC-022 | Metaculus
| Field | Value |
|-------|-------|
| **URL** | https://www.metaculus.com |
| **API Endpoint** | https://www.metaculus.com/api2/ |
| **Category** | 2 - Prediction Markets |
| **Signal Type** | prediction |
| **Data Format** | JSON REST API |
| **Auth** | API key (free) |
| **Cost** | Free |
| **Update Frequency** | Real-time |
| **Coverage** | Global (science, tech, geopolitics, AI) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Calibrated forecasters. Strongest on AI timelines and existential risk. Community predictions + Metaculus prediction. API well-documented. |

#### SRC-023 | Manifold Markets
| Field | Value |
|-------|-------|
| **URL** | https://manifold.markets |
| **API Endpoint** | https://api.manifold.markets/v0/ |
| **Category** | 2 - Prediction Markets |
| **Signal Type** | prediction |
| **Data Format** | JSON REST API |
| **Auth** | API key (free) |
| **Cost** | Free |
| **Update Frequency** | Real-time |
| **Coverage** | Global (broad topic coverage) |
| **Reliability** | ★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Play-money market but large active community. Easy to create markets on any topic. Good for niche/emerging signals. Open-source. |

#### SRC-024 | PredictIt
| Field | Value |
|-------|-------|
| **URL** | https://www.predictit.org |
| **API Endpoint** | https://www.predictit.org/api/marketdata/all/ |
| **Category** | 2 - Prediction Markets |
| **Signal Type** | prediction |
| **Data Format** | JSON REST API |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Real-time |
| **Coverage** | US politics primarily |
| **Reliability** | ★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | US political prediction market. CFTC-regulated. Narrow focus but high quality for US political signals. |

#### SRC-025 | RAND Forecasting Initiative
| Field | Value |
|-------|-------|
| **URL** | https://www.rand.org/international/centers/foresight.html |
| **API Endpoint** | None (reports) |
| **Category** | 2 - Prediction Markets |
| **Signal Type** | prediction |
| **Data Format** | PDF / web |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | Global (defense, policy) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Crowdsourced policy-relevant predictions. Aims to be the leading prediction platform for policy questions. |

---

<a id="cat-3-economic--financial"></a>
### CAT 3: Economic / Financial

#### SRC-026 | IMF World Economic Outlook
| Field | Value |
|-------|-------|
| **URL** | https://www.imf.org/en/publications/weo |
| **API Endpoint** | https://www.imf.org/external/datamapper/api/v1/ |
| **Category** | 3 - Economic / Financial |
| **Signal Type** | economic_data |
| **Data Format** | JSON API / PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Biannual (April & October) + quarterly updates |
| **Coverage** | Global (190 countries) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Gold standard for macroeconomic forecasting. DataMapper API provides structured access to GDP, inflation, trade data. |

#### SRC-027 | World Bank Open Data
| Field | Value |
|-------|-------|
| **URL** | https://data.worldbank.org |
| **API Endpoint** | https://api.worldbank.org/v2/ |
| **Category** | 3 - Economic / Financial |
| **Signal Type** | economic_data |
| **Data Format** | JSON / XML REST API |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | Global (189 countries) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Development indicators, poverty data, climate-development nexus. Excellent REST API. 16,000+ indicators. |

#### SRC-028 | FRED (Federal Reserve Economic Data)
| Field | Value |
|-------|-------|
| **URL** | https://fred.stlouisfed.org |
| **API Endpoint** | https://api.stlouisfed.org/fred/ |
| **Category** | 3 - Economic / Financial |
| **Signal Type** | economic_data |
| **Data Format** | JSON REST API |
| **Auth** | API key (free) |
| **Cost** | Free |
| **Update Frequency** | Daily to monthly |
| **Coverage** | US + International macro |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | 800,000+ economic time series. Interest rates, employment, GDP, inflation. Essential for US macro signals. |

#### SRC-029 | BIS (Bank for International Settlements)
| Field | Value |
|-------|-------|
| **URL** | https://www.bis.org/statistics/ |
| **API Endpoint** | https://stats.bis.org/api/v1/ |
| **Category** | 3 - Economic / Financial |
| **Signal Type** | economic_data |
| **Data Format** | SDMX API / CSV |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Quarterly |
| **Coverage** | Global (central bank data) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Central bank of central banks. Cross-border capital flows, credit, derivatives data. Innovation Hub reports on CBDC, fintech. |

#### SRC-030 | Bloomberg Terminal
| Field | Value |
|-------|-------|
| **URL** | https://www.bloomberg.com/professional/solution/bloomberg-terminal/ |
| **API Endpoint** | Bloomberg API (B-PIPE, SAPI) |
| **Category** | 3 - Economic / Financial |
| **Signal Type** | economic_data |
| **Data Format** | Proprietary API |
| **Auth** | Terminal subscription |
| **Cost** | Paid (~$24,000/yr) |
| **Update Frequency** | Real-time |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Gold standard financial data. Too expensive for initial phase but aspirational. Alternative: Bloomberg Economics free articles. |

#### SRC-031 | Yahoo Finance API
| Field | Value |
|-------|-------|
| **URL** | https://finance.yahoo.com |
| **API Endpoint** | https://query1.finance.yahoo.com/v8/finance/ (unofficial) |
| **Category** | 3 - Economic / Financial |
| **Signal Type** | economic_data |
| **Data Format** | JSON |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Real-time |
| **Coverage** | Global markets |
| **Reliability** | ★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Unofficial API but widely used. Stock prices, sector performance, crypto. Rate limits apply. |

#### SRC-032 | Eurostat
| Field | Value |
|-------|-------|
| **URL** | https://ec.europa.eu/eurostat |
| **API Endpoint** | https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/ |
| **Category** | 3 - Economic / Financial |
| **Signal Type** | economic_data |
| **Data Format** | SDMX / JSON API |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Monthly to annual |
| **Coverage** | EU-27 + EFTA |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | EU statistical office. Demographics, economy, trade, energy data. SDMX REST API. Essential for European analysis. |

#### SRC-033 | Marsh McLennan Global Risk
| Field | Value |
|-------|-------|
| **URL** | https://www.marsh.com/en/risks/global-risk.html |
| **API Endpoint** | None (reports) |
| **Category** | 3 - Economic / Financial |
| **Signal Type** | economic_data |
| **Data Format** | PDF / web |
| **Auth** | None |
| **Cost** | Freemium |
| **Update Frequency** | Annual |
| **Coverage** | Global (130 countries) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Co-produces WEF Global Risks. Insurance risk pricing data = where risk is actually monetized. Oliver Wyman 300,000 Voices Project. |

#### SRC-034 | OECD.Stat
| Field | Value |
|-------|-------|
| **URL** | https://stats.oecd.org |
| **API Endpoint** | https://stats.oecd.org/restsdmx/sdmx.ashx |
| **Category** | 3 - Economic / Financial |
| **Signal Type** | economic_data |
| **Data Format** | SDMX / JSON API |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Monthly to annual |
| **Coverage** | 38 OECD countries |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Comprehensive OECD statistical data. Trade, productivity, employment, innovation. SDMX standard. |

#### SRC-035 | Trading Economics
| Field | Value |
|-------|-------|
| **URL** | https://tradingeconomics.com |
| **API Endpoint** | https://api.tradingeconomics.com/ |
| **Category** | 3 - Economic / Financial |
| **Signal Type** | economic_data |
| **Data Format** | JSON REST API |
| **Auth** | API key |
| **Cost** | Freemium ($49-499/mo) |
| **Update Frequency** | Real-time |
| **Coverage** | Global (196 countries) |
| **Reliability** | ★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | 20M+ indicators. Forecasts, economic calendar, country comparisons. Good mid-tier alternative to Bloomberg. |

#### SRC-036 | Our World in Data
| Field | Value |
|-------|-------|
| **URL** | https://ourworldindata.org |
| **API Endpoint** | https://github.com/owid/owid-datasets (GitHub) |
| **Category** | 3 - Economic / Financial |
| **Signal Type** | economic_data |
| **Data Format** | CSV / GitHub datasets |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Open-source datasets on every major global issue. GitHub-hosted. Excellent for historical trend context. Oxford University. |

#### SRC-037 | Bruegel Economic Think Tank
| Field | Value |
|-------|-------|
| **URL** | https://www.bruegel.org |
| **API Endpoint** | None (web/PDF) |
| **Category** | 3 - Economic / Financial |
| **Signal Type** | economic_data |
| **Data Format** | HTML / PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Weekly |
| **Coverage** | EU / Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Leading EU economic policy think tank. Strong on EU digital economy, trade, energy transition. |

---

<a id="cat-4-technology--innovation"></a>
### CAT 4: Technology / Innovation

#### SRC-038 | Hacker News
| Field | Value |
|-------|-------|
| **URL** | https://news.ycombinator.com |
| **API Endpoint** | https://hacker-news.firebaseio.com/v0/ |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | JSON REST API |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Real-time |
| **Coverage** | Global (tech community) |
| **Reliability** | ★★★★ |
| **Integration Status** | **Active (P0)** |
| **Notes** | Active connector: `src/connectors/hackernews.ts`. Y Combinator community. Early signal for developer trends. |

#### SRC-039 | GitHub Trending
| Field | Value |
|-------|-------|
| **URL** | https://github.com |
| **API Endpoint** | https://api.github.com/ |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | JSON REST API |
| **Auth** | PAT (free) |
| **Cost** | Free |
| **Update Frequency** | Real-time |
| **Coverage** | Global (developers) |
| **Reliability** | ★★★★ |
| **Integration Status** | **Active (P0)** |
| **Notes** | Active connector: `src/connectors/github.ts`. Trending repos, star velocity. Leading indicator for OSS technology adoption. |

#### SRC-040 | arXiv
| Field | Value |
|-------|-------|
| **URL** | https://arxiv.org |
| **API Endpoint** | https://export.arxiv.org/api/query |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | XML (Atom) |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Daily |
| **Coverage** | Global (academic research) |
| **Reliability** | ★★★★★ |
| **Integration Status** | **Active (P0)** |
| **Notes** | Active connector: `src/connectors/arxiv.ts`. Pre-prints in CS, AI, physics. Earliest signal for research breakthroughs. |

#### SRC-041 | Stack Overflow
| Field | Value |
|-------|-------|
| **URL** | https://stackoverflow.com |
| **API Endpoint** | https://api.stackexchange.com/2.3/ |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | JSON REST API |
| **Auth** | API key (free) |
| **Cost** | Free |
| **Update Frequency** | Real-time |
| **Coverage** | Global (developers) |
| **Reliability** | ★★★★ |
| **Integration Status** | **Active (P0)** |
| **Notes** | Active connector: `src/connectors/stackoverflow.ts`. Tag trending = technology adoption velocity. Developer Survey (annual). |

#### SRC-042 | npm / PyPI Package Registries
| Field | Value |
|-------|-------|
| **URL** | https://www.npmjs.com / https://pypi.org |
| **API Endpoint** | https://api.npmjs.org/ / https://pypistats.org/api/ |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | JSON REST API |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Daily |
| **Coverage** | Global (JS/Python ecosystems) |
| **Reliability** | ★★★★ |
| **Integration Status** | **Active (P0)** |
| **Notes** | Active connector: `src/connectors/npm-pypi.ts`. Download spikes = adoption signals. Covers the two largest package ecosystems. |

#### SRC-043 | Gartner Hype Cycles
| Field | Value |
|-------|-------|
| **URL** | https://www.gartner.com/en/research/methodologies/gartner-hype-cycle |
| **API Endpoint** | None (paid platform) |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | PDF / Platform |
| **Auth** | Subscription |
| **Cost** | Paid |
| **Update Frequency** | Annual (90+ hype cycles) |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Industry-standard tech maturity methodology. Top 10 Strategic Technology Trends (October). Press summaries available free. |

#### SRC-044 | Forrester Predictions
| Field | Value |
|-------|-------|
| **URL** | https://www.forrester.com/predictions/ |
| **API Endpoint** | None (paid platform) |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | PDF / Platform |
| **Auth** | Subscription |
| **Cost** | Paid |
| **Update Frequency** | Annual (October) |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Highly specific, falsifiable predictions. Tracks own accuracy. 10+ domain reports. Headlines often available free. |

#### SRC-045 | IDC FutureScape
| Field | Value |
|-------|-------|
| **URL** | https://www.idc.com/resource-center/futurescape/ |
| **API Endpoint** | None (paid platform) |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | PDF / Platform |
| **Auth** | Subscription |
| **Cost** | Paid |
| **Update Frequency** | Annual (October) |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | 35+ domain reports. 100+ individual predictions. Strongest on IT spending forecasts and market sizing. |

#### SRC-046 | CB Insights
| Field | Value |
|-------|-------|
| **URL** | https://www.cbinsights.com |
| **API Endpoint** | None (platform) |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | Web / PDF |
| **Auth** | Registration |
| **Cost** | Freemium |
| **Update Frequency** | Continuous |
| **Coverage** | Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | 14 emerging trends. Signal-based: company fundamentals + patents + hiring + VC flows. State of Venture (quarterly). |

#### SRC-047 | MIT Technology Review
| Field | Value |
|-------|-------|
| **URL** | https://www.technologyreview.com |
| **API Endpoint** | None (web) |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | HTML |
| **Auth** | None |
| **Cost** | Freemium |
| **Update Frequency** | Annual (10 Breakthroughs in Jan) |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | 10 Breakthrough Technologies. 25-year track record. Hard-science breakthroughs. RSS available. |

#### SRC-048 | StartUs Insights Discovery Platform
| Field | Value |
|-------|-------|
| **URL** | https://www.startus-insights.com |
| **API Endpoint** | None (platform) |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | Platform / PDF |
| **Auth** | Subscription |
| **Cost** | Paid |
| **Update Frequency** | Continuous |
| **Coverage** | Global (7M+ companies, 20K+ technologies) |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | AI-powered startup scouting. Technology Radar with adopt/trial/assess/hold. |

#### SRC-049 | Google Trends
| Field | Value |
|-------|-------|
| **URL** | https://trends.google.com |
| **API Endpoint** | Unofficial (pytrends / SerpAPI) |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | JSON (via wrapper) |
| **Auth** | None / API key |
| **Cost** | Free / Paid (SerpAPI) |
| **Update Frequency** | Real-time |
| **Coverage** | Global |
| **Reliability** | ★★★★ |
| **Integration Status** | **Active (P0)** |
| **Notes** | Active connector: `src/connectors/google-trends.ts`. Search interest as proxy for public attention. No official API, uses pytrends or SerpAPI. |

#### SRC-050 | Product Hunt
| Field | Value |
|-------|-------|
| **URL** | https://www.producthunt.com |
| **API Endpoint** | https://api.producthunt.com/v2/api/graphql |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | GraphQL API |
| **Auth** | OAuth token |
| **Cost** | Free |
| **Update Frequency** | Daily |
| **Coverage** | Global (product launches) |
| **Reliability** | ★★★ |
| **Integration Status** | **Active (P0)** |
| **Notes** | Active connector: `src/connectors/producthunt.ts`. New product launches. Early signal for consumer tech trends. |

#### SRC-051 | Stanford HAI AI Index
| Field | Value |
|-------|-------|
| **URL** | https://hai.stanford.edu/ai-index-report |
| **API Endpoint** | None (PDF + data tables) |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | PDF / CSV / interactive charts |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual (April) |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Most comprehensive AI state-of-field. Benchmark tracking, investment, policy, responsible AI. Data tables downloadable. |

#### SRC-052 | Semantic Scholar API
| Field | Value |
|-------|-------|
| **URL** | https://www.semanticscholar.org |
| **API Endpoint** | https://api.semanticscholar.org/graph/v1/ |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | JSON REST API |
| **Auth** | API key (free) |
| **Cost** | Free |
| **Update Frequency** | Daily |
| **Coverage** | Global (200M+ papers) |
| **Reliability** | ★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | AI-powered academic search. Citation velocity = research trend signal. Paper recommendation. Allen Institute for AI. |

#### SRC-053 | Patent APIs (Google Patents / Lens.org)
| Field | Value |
|-------|-------|
| **URL** | https://patents.google.com / https://www.lens.org |
| **API Endpoint** | https://api.lens.org/patent/search |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | JSON REST API |
| **Auth** | API key (free tier) |
| **Cost** | Freemium |
| **Update Frequency** | Weekly |
| **Coverage** | Global (130M+ patents) |
| **Reliability** | ★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Patent filing velocity = innovation signal 3-5 years ahead of market. Lens.org free scholarly API. |

#### SRC-054 | AlphaSignal AI Newsletter
| Field | Value |
|-------|-------|
| **URL** | https://alphasignal.ai |
| **API Endpoint** | None (newsletter/RSS) |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | HTML / RSS |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Weekly |
| **Coverage** | Global (AI/ML) |
| **Reliability** | ★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Curated AI research highlights. Good signal amplifier for top papers. RSS ingestible. |

#### SRC-055 | Wikipedia Trending
| Field | Value |
|-------|-------|
| **URL** | https://en.wikipedia.org |
| **API Endpoint** | https://wikimedia.org/api/rest_v1/ |
| **Category** | 4 - Technology / Innovation |
| **Signal Type** | tech_signal |
| **Data Format** | JSON REST API |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Daily |
| **Coverage** | Global |
| **Reliability** | ★★★ |
| **Integration Status** | **Active (P0)** |
| **Notes** | Active connector: `src/connectors/wikipedia.ts`. Page view spikes = public attention signal. Pageviews API. |

---

<a id="cat-5-geopolitical--security"></a>
### CAT 5: Geopolitical / Security

#### SRC-056 | World Monitor
| Field | Value |
|-------|-------|
| **URL** | https://www.worldmonitor.app |
| **API Endpoint** | https://api.worldmonitor.app/api/{domain}/v1/{endpoint} |
| **Category** | 5 - Geopolitical / Security |
| **Signal Type** | geopolitical |
| **Data Format** | JSON REST API |
| **Auth** | None (public) |
| **Cost** | Free |
| **Update Frequency** | Real-time |
| **Coverage** | Global (22 domains) |
| **Reliability** | ★★★★ |
| **Integration Status** | **Active (P0)** |
| **Notes** | Active connector: `src/connectors/worldmonitor.ts`. 22 domains: conflict, military, market, crypto, climate, cyber, disaster, displacement, regulation, intelligence, prediction, tech, news. CII (Country Instability Index). |

#### SRC-057 | ACLED (Armed Conflict Location & Event Data)
| Field | Value |
|-------|-------|
| **URL** | https://acleddata.com |
| **API Endpoint** | https://api.acleddata.com/acled/read |
| **Category** | 5 - Geopolitical / Security |
| **Signal Type** | geopolitical |
| **Data Format** | JSON / CSV API |
| **Auth** | API key (free for researchers) |
| **Cost** | Free (academic) / Paid (commercial) |
| **Update Frequency** | Weekly |
| **Coverage** | Global (conflict events) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Gold standard for conflict event data. Geo-coded events. Used by UN, World Bank, governments. Free access for research. |

#### SRC-058 | Eurasia Group
| Field | Value |
|-------|-------|
| **URL** | https://www.eurasiagroup.net |
| **API Endpoint** | None (reports) |
| **Category** | 5 - Geopolitical / Security |
| **Signal Type** | geopolitical |
| **Data Format** | PDF / web |
| **Auth** | Subscription |
| **Cost** | Paid |
| **Update Frequency** | Annual (Top Risks in Jan) + continuous |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Ian Bremmer. Top Risks report = most-read geopolitical forecast. GZERO Media free content available. |

#### SRC-059 | SIPRI (Stockholm International Peace Research Institute)
| Field | Value |
|-------|-------|
| **URL** | https://www.sipri.org |
| **API Endpoint** | https://www.sipri.org/databases (downloadable) |
| **Category** | 5 - Geopolitical / Security |
| **Signal Type** | geopolitical |
| **Data Format** | CSV / Excel |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual |
| **Coverage** | Global (arms, military, conflict) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Military expenditure database. Arms transfers. Multilateral peace operations. Essential for security trend analysis. |

#### SRC-060 | Global Conflict Tracker (CFR)
| Field | Value |
|-------|-------|
| **URL** | https://www.cfr.org/global-conflict-tracker |
| **API Endpoint** | None (web) |
| **Category** | 5 - Geopolitical / Security |
| **Signal Type** | geopolitical |
| **Data Format** | HTML / interactive |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Council on Foreign Relations. Visual conflict tracker with severity and US interest assessment. |

#### SRC-061 | NATO ACT Strategic Foresight
| Field | Value |
|-------|-------|
| **URL** | https://www.act.nato.int/activities/allied-command-transformation-strategic-foresight-work/ |
| **API Endpoint** | None (PDF) |
| **Category** | 5 - Geopolitical / Security |
| **Signal Type** | geopolitical |
| **Data Format** | PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Every 5-6 years |
| **Coverage** | Euro-Atlantic + Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | 170 trends across 7 drivers. 800+ Allied defense experts. Military/security-oriented megatrend analysis. |

#### SRC-062 | Fragile States Index (Fund for Peace)
| Field | Value |
|-------|-------|
| **URL** | https://fragilestatesindex.org |
| **API Endpoint** | https://fragilestatesindex.org/excel/ (downloadable) |
| **Category** | 5 - Geopolitical / Security |
| **Signal Type** | geopolitical |
| **Data Format** | Excel / CSV |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual |
| **Coverage** | Global (179 countries) |
| **Reliability** | ★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | 12 conflict risk indicators. 179 countries ranked. Trend analysis over 15+ years. Good complement to World Monitor CII. |

#### SRC-063 | Geopolitical Futures
| Field | Value |
|-------|-------|
| **URL** | https://geopoliticalfutures.com |
| **API Endpoint** | None (web) |
| **Category** | 5 - Geopolitical / Security |
| **Signal Type** | geopolitical |
| **Data Format** | HTML |
| **Auth** | Subscription |
| **Cost** | Paid |
| **Update Frequency** | Weekly |
| **Coverage** | Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | George Friedman. Long-cycle geopolitical forecasting. Some free content available. |

#### SRC-064 | International Crisis Group
| Field | Value |
|-------|-------|
| **URL** | https://www.crisisgroup.org |
| **API Endpoint** | None (web/RSS) |
| **Category** | 5 - Geopolitical / Security |
| **Signal Type** | geopolitical |
| **Data Format** | HTML / RSS |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | Global (conflict zones) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | CrisisWatch monthly bulletin. 10 Conflicts to Watch (annual). Field-based conflict analysis. RSS feed. |

#### SRC-065 | V-Dem (Varieties of Democracy)
| Field | Value |
|-------|-------|
| **URL** | https://www.v-dem.net |
| **API Endpoint** | https://v-dem.net/data_analysis/onlineAnalysis/ (downloadable) |
| **Category** | 5 - Geopolitical / Security |
| **Signal Type** | geopolitical |
| **Data Format** | CSV / R datasets |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual |
| **Coverage** | Global (202 countries, since 1789) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Democracy indices. Autocratization tracking. 450+ indicators. Essential for democratic backsliding analysis. |

---

<a id="cat-6-climate--environment"></a>
### CAT 6: Climate / Environment

#### SRC-066 | IEA (International Energy Agency)
| Field | Value |
|-------|-------|
| **URL** | https://www.iea.org |
| **API Endpoint** | https://api.iea.org/ (limited) |
| **Category** | 6 - Climate / Environment |
| **Signal Type** | climate_data |
| **Data Format** | PDF / CSV / API |
| **Auth** | API key |
| **Cost** | Freemium |
| **Update Frequency** | Annual (WEO in Oct) + monthly |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | World Energy Outlook. Net-zero pathway modeling. State of Energy Innovation (new 2026). Monthly oil/gas/coal/renewables reports. |

#### SRC-067 | NASA GISS (Goddard Institute for Space Studies)
| Field | Value |
|-------|-------|
| **URL** | https://data.giss.nasa.gov |
| **API Endpoint** | https://data.giss.nasa.gov/gistemp/ (direct download) |
| **Category** | 6 - Climate / Environment |
| **Signal Type** | climate_data |
| **Data Format** | CSV / NetCDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Monthly |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Global temperature anomaly data. GISTEMP dataset. Direct download CSV. Essential for climate trend verification. |

#### SRC-068 | NOAA Climate Data
| Field | Value |
|-------|-------|
| **URL** | https://www.ncei.noaa.gov |
| **API Endpoint** | https://www.ncei.noaa.gov/cdo-web/api/v2/ |
| **Category** | 6 - Climate / Environment |
| **Signal Type** | climate_data |
| **Data Format** | JSON REST API |
| **Auth** | API key (free) |
| **Cost** | Free |
| **Update Frequency** | Daily to monthly |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Most comprehensive US climate data. Global Historical Climatology Network. Free API key via token request. |

#### SRC-069 | Copernicus Climate Change Service (C3S)
| Field | Value |
|-------|-------|
| **URL** | https://climate.copernicus.eu |
| **API Endpoint** | https://cds.climate.copernicus.eu/api/v2 |
| **Category** | 6 - Climate / Environment |
| **Signal Type** | climate_data |
| **Data Format** | NetCDF / GRIB / API |
| **Auth** | Registration (free) |
| **Cost** | Free |
| **Update Frequency** | Real-time to monthly |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | EU's climate data service. ERA5 reanalysis. Monthly climate bulletins. CDS API for programmatic access. |

#### SRC-070 | Global Carbon Project
| Field | Value |
|-------|-------|
| **URL** | https://www.globalcarbonproject.org |
| **API Endpoint** | None (downloadable datasets) |
| **Category** | 6 - Climate / Environment |
| **Signal Type** | climate_data |
| **Data Format** | CSV / Excel |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Global Carbon Budget. CO2 emissions by country and sector. Essential for decarbonization tracking. |

#### SRC-071 | Climate Action Tracker
| Field | Value |
|-------|-------|
| **URL** | https://climateactiontracker.org |
| **API Endpoint** | None (web / downloadable) |
| **Category** | 6 - Climate / Environment |
| **Signal Type** | climate_data |
| **Data Format** | HTML / CSV |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | Global (40+ countries) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Tracks government climate pledges vs. action. Country ratings. Warming projections. NewClimate Institute + Climate Analytics. |

#### SRC-072 | UNEP (UN Environment Programme)
| Field | Value |
|-------|-------|
| **URL** | https://www.unep.org |
| **API Endpoint** | None (reports) |
| **Category** | 6 - Climate / Environment |
| **Signal Type** | climate_data |
| **Data Format** | PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Emissions Gap Report (annual). Frontiers Report (emerging environmental issues). Adaptation Gap Report. |

#### SRC-073 | IRENA (International Renewable Energy Agency)
| Field | Value |
|-------|-------|
| **URL** | https://www.irena.org |
| **API Endpoint** | https://pxweb.irena.org/pxweb/en/IRENASTAT (SDMX-like) |
| **Category** | 6 - Climate / Environment |
| **Signal Type** | climate_data |
| **Data Format** | PxWeb API / CSV |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Renewable energy capacity statistics. World Energy Transitions Outlook. Cost data for solar, wind, etc. |

---

<a id="cat-7-social--demographic"></a>
### CAT 7: Social / Demographic

#### SRC-074 | Reddit
| Field | Value |
|-------|-------|
| **URL** | https://www.reddit.com |
| **API Endpoint** | https://oauth.reddit.com/api/ |
| **Category** | 7 - Social / Demographic |
| **Signal Type** | social_data |
| **Data Format** | JSON REST API |
| **Auth** | OAuth |
| **Cost** | Free (rate-limited) |
| **Update Frequency** | Real-time |
| **Coverage** | Global (English-dominant) |
| **Reliability** | ★★★ |
| **Integration Status** | **Active (P0)** |
| **Notes** | Active connector: `src/connectors/reddit.ts`. Subreddit trending as community sentiment signal. Rate limits apply. |

#### SRC-075 | UN Population Division
| Field | Value |
|-------|-------|
| **URL** | https://population.un.org/wpp/ |
| **API Endpoint** | https://population.un.org/dataportalapi/api/v1/ |
| **Category** | 7 - Social / Demographic |
| **Signal Type** | social_data |
| **Data Format** | JSON API / CSV |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Biennial |
| **Coverage** | Global (237 countries) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | World Population Prospects. Age pyramids. Fertility, mortality, migration projections to 2100. REST API available. |

#### SRC-076 | Ipsos Global Trends
| Field | Value |
|-------|-------|
| **URL** | https://www.ipsos.com/en/global-trends |
| **API Endpoint** | None (PDF) |
| **Category** | 7 - Social / Demographic |
| **Signal Type** | social_data |
| **Data Format** | PDF / Interactive web |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual (Predictions) + Biennial (Global Trends) |
| **Coverage** | Global (50 markets) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | 52,000+ people surveyed across 50 markets. What citizens BELIEVE will happen. 13-year longitudinal data since 2013. |

#### SRC-077 | Euromonitor Consumer Trends
| Field | Value |
|-------|-------|
| **URL** | https://www.euromonitor.com |
| **API Endpoint** | None (platform) |
| **Category** | 7 - Social / Demographic |
| **Signal Type** | social_data |
| **Data Format** | Platform / PDF |
| **Auth** | Subscription |
| **Cost** | Paid |
| **Update Frequency** | Annual + continuous |
| **Coverage** | Global (100+ countries) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Consumer behavior trends. Megatrend-to-purchasing-behavior mapping. Emerging market coverage others underweight. |

#### SRC-078 | ILO (International Labour Organization)
| Field | Value |
|-------|-------|
| **URL** | https://www.ilo.org |
| **API Endpoint** | https://ilostat.ilo.org/resources/sdmx-tools/ |
| **Category** | 7 - Social / Demographic |
| **Signal Type** | social_data |
| **Data Format** | SDMX API / CSV |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual |
| **Coverage** | Global (187 states) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | ILOSTAT database. Employment projections. Automation impact. Future of Work reports. SDMX API. |

#### SRC-079 | Pew Research Center
| Field | Value |
|-------|-------|
| **URL** | https://www.pewresearch.org |
| **API Endpoint** | None (web/PDF) |
| **Category** | 7 - Social / Demographic |
| **Signal Type** | social_data |
| **Data Format** | HTML / PDF / datasets |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | US + Global (select surveys) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Public opinion, social trends, demographics, internet/tech adoption. Global Attitudes survey. Datasets downloadable. |

#### SRC-080 | Gallup World Poll
| Field | Value |
|-------|-------|
| **URL** | https://www.gallup.com/analytics/318875/global-research.aspx |
| **API Endpoint** | None (platform) |
| **Category** | 7 - Social / Demographic |
| **Signal Type** | social_data |
| **Data Format** | Platform / PDF |
| **Auth** | Subscription |
| **Cost** | Paid |
| **Update Frequency** | Annual |
| **Coverage** | Global (140+ countries) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Wellbeing, employment, safety, institutions trust. 140+ countries. World Happiness Report data source. |

---

<a id="cat-8-regulatory--policy"></a>
### CAT 8: Regulatory / Policy

#### SRC-081 | World Monitor — Regulation Domain
| Field | Value |
|-------|-------|
| **URL** | https://www.worldmonitor.app |
| **API Endpoint** | https://api.worldmonitor.app/api/regulation/v1/policies |
| **Category** | 8 - Regulatory / Policy |
| **Signal Type** | regulatory |
| **Data Format** | JSON REST API |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Real-time |
| **Coverage** | Global |
| **Reliability** | ★★★★ |
| **Integration Status** | **Active (P0)** (via World Monitor connector) |
| **Notes** | Part of World Monitor 22-domain coverage. AI regulation, tech policy, trade regulation tracking. |

#### SRC-082 | OECD AI Policy Observatory
| Field | Value |
|-------|-------|
| **URL** | https://oecd.ai |
| **API Endpoint** | https://oecd.ai/en/dashboards (embeddable data) |
| **Category** | 8 - Regulatory / Policy |
| **Signal Type** | regulatory |
| **Data Format** | HTML / CSV |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | 70+ countries |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Tracks 800+ AI policy initiatives across 70+ countries. AI incidents monitor. National AI strategies database. |

#### SRC-083 | EUR-Lex (EU Law)
| Field | Value |
|-------|-------|
| **URL** | https://eur-lex.europa.eu |
| **API Endpoint** | https://eur-lex.europa.eu/eurlex-ws |
| **Category** | 8 - Regulatory / Policy |
| **Signal Type** | regulatory |
| **Data Format** | XML / JSON SPARQL |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Daily |
| **Coverage** | EU |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | EU AI Act, Digital Services Act, GDPR, Green Deal legislation. SPARQL endpoint. CELLAR API. Essential for EU regulatory tracking. |

#### SRC-084 | Congressional Research Service (CRS)
| Field | Value |
|-------|-------|
| **URL** | https://crsreports.congress.gov |
| **API Endpoint** | https://www.everycrsreport.com/api/ (unofficial mirror) |
| **Category** | 8 - Regulatory / Policy |
| **Signal Type** | regulatory |
| **Data Format** | PDF / HTML |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | US |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Non-partisan policy analysis for US Congress. Covers every major policy area. everycrsreport.com provides API access. |

#### SRC-085 | AI Incident Database (AIID)
| Field | Value |
|-------|-------|
| **URL** | https://incidentdatabase.ai |
| **API Endpoint** | https://incidentdatabase.ai/api/ (GraphQL) |
| **Category** | 8 - Regulatory / Policy |
| **Signal Type** | regulatory |
| **Data Format** | GraphQL API |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Tracks AI harms and failures. Managed by Responsible AI Collaborative. Pattern recognition for regulatory signals. |

#### SRC-086 | Regulatory Horizon Scanner (UK Gov)
| Field | Value |
|-------|-------|
| **URL** | https://www.gov.uk/government/groups/regulatory-horizons-council |
| **API Endpoint** | None (reports) |
| **Category** | 8 - Regulatory / Policy |
| **Signal Type** | regulatory |
| **Data Format** | PDF / HTML |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Periodic |
| **Coverage** | UK |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | UK Regulatory Horizons Council. Identifies regulatory gaps from emerging tech. Reports on AI, biotech, autonomous vehicles. |

---

<a id="cat-9-health"></a>
### CAT 9: Health

#### SRC-087 | WHO Global Health Observatory
| Field | Value |
|-------|-------|
| **URL** | https://www.who.int/data/gho |
| **API Endpoint** | https://ghoapi.azureedge.net/api/ |
| **Category** | 9 - Health |
| **Signal Type** | health_data |
| **Data Format** | JSON REST API |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual |
| **Coverage** | Global (194 member states) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | 2,000+ health indicators. Disease surveillance. Health system data. REST API well-documented. |

#### SRC-088 | IHME Global Burden of Disease
| Field | Value |
|-------|-------|
| **URL** | https://www.healthdata.org/research-analysis/gbd |
| **API Endpoint** | https://vizhub.healthdata.org/gbd-results/ (data download) |
| **Category** | 9 - Health |
| **Signal Type** | health_data |
| **Data Format** | CSV / interactive |
| **Auth** | Registration |
| **Cost** | Free |
| **Update Frequency** | Annual |
| **Coverage** | Global (204 countries) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Most comprehensive disease burden data. Projections to 2050. University of Washington. Used by 190+ governments. |

#### SRC-089 | ProMED (Program for Monitoring Emerging Diseases)
| Field | Value |
|-------|-------|
| **URL** | https://promedmail.org |
| **API Endpoint** | RSS feed |
| **Category** | 9 - Health |
| **Signal Type** | health_data |
| **Data Format** | RSS / HTML |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Real-time |
| **Coverage** | Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Early warning for disease outbreaks. First to report SARS, MERS, COVID. ISID-operated. RSS ingestible. |

#### SRC-090 | Lancet Countdown on Health and Climate Change
| Field | Value |
|-------|-------|
| **URL** | https://www.lancetcountdown.org |
| **API Endpoint** | None (datasets downloadable) |
| **Category** | 9 - Health |
| **Signal Type** | health_data |
| **Data Format** | CSV / PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | 44 indicators tracking climate-health nexus. Bridges climate and health categories. |

#### SRC-091 | Global Health Security Index
| Field | Value |
|-------|-------|
| **URL** | https://www.ghsindex.org |
| **API Endpoint** | None (downloadable) |
| **Category** | 9 - Health |
| **Signal Type** | health_data |
| **Data Format** | Excel / PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Periodic (2019, 2021) |
| **Coverage** | Global (195 countries) |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | NTI + Johns Hopkins. Pandemic preparedness scoring. 195 countries across 6 categories. |

---

<a id="cat-10-think-tanks"></a>
### CAT 10: Think Tanks

#### SRC-092 | RAND Corporation
| Field | Value |
|-------|-------|
| **URL** | https://www.rand.org |
| **API Endpoint** | None (web/PDF) |
| **Category** | 10 - Think Tanks |
| **Signal Type** | analysis |
| **Data Format** | PDF / HTML |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Forward 2045. Defense scenario studies. Technology assessment for government. RSS feeds available. |

#### SRC-093 | Brookings Institution
| Field | Value |
|-------|-------|
| **URL** | https://www.brookings.edu |
| **API Endpoint** | None (web/PDF) |
| **Category** | 10 - Think Tanks |
| **Signal Type** | analysis |
| **Data Format** | PDF / HTML |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | Global / Africa focus |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Foresight Africa (annual). Workforce of the Future. AI governance. Most influential US think tank. |

#### SRC-094 | Chatham House
| Field | Value |
|-------|-------|
| **URL** | https://www.chathamhouse.org |
| **API Endpoint** | None (web/PDF) |
| **Category** | 10 - Think Tanks |
| **Signal Type** | analysis |
| **Data Format** | PDF / HTML |
| **Auth** | None (some require membership) |
| **Cost** | Freemium |
| **Update Frequency** | Continuous |
| **Coverage** | Global (UK/European lens) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Geopolitical risk, trade, climate-tech intersection. Most influential international affairs think tank. |

#### SRC-095 | Club of Rome — Earth4All
| Field | Value |
|-------|-------|
| **URL** | https://www.clubofrome.org |
| **API Endpoint** | None (reports) |
| **Category** | 10 - Think Tanks |
| **Signal Type** | analysis |
| **Data Format** | PDF / web |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | Global (planetary systems) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Legacy of "Limits to Growth." Earth4All system dynamics model. Two-scenario framework. |

#### SRC-096 | Carnegie Endowment for International Peace
| Field | Value |
|-------|-------|
| **URL** | https://carnegieendowment.org |
| **API Endpoint** | None (web/RSS) |
| **Category** | 10 - Think Tanks |
| **Signal Type** | analysis |
| **Data Format** | HTML / RSS |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Technology and international affairs. Global order research. AI and democracy program. |

#### SRC-097 | Atlantic Council
| Field | Value |
|-------|-------|
| **URL** | https://www.atlanticcouncil.org |
| **API Endpoint** | None (web/RSS) |
| **Category** | 10 - Think Tanks |
| **Signal Type** | analysis |
| **Data Format** | HTML / RSS |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | Transatlantic + Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | GeoTech Center. Digital Forensic Research Lab. Freedom and Prosperity Indexes. |

#### SRC-098 | Bruegel
| Field | Value |
|-------|-------|
| **URL** | https://www.bruegel.org |
| **API Endpoint** | None (web) |
| **Category** | 10 - Think Tanks |
| **Signal Type** | analysis |
| **Data Format** | HTML / PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Weekly |
| **Coverage** | EU / Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Leading EU economic policy. Digital economy, trade, energy transition. |

#### SRC-099 | Mercator Institute (MERICS)
| Field | Value |
|-------|-------|
| **URL** | https://merics.org |
| **API Endpoint** | None (web/RSS) |
| **Category** | 10 - Think Tanks |
| **Signal Type** | analysis |
| **Data Format** | HTML / RSS |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | China / Europe-China relations |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Europe's leading China research institute. China tech policy, economic strategy, EU-China dynamics. |

#### SRC-100 | Center for a New American Security (CNAS)
| Field | Value |
|-------|-------|
| **URL** | https://www.cnas.org |
| **API Endpoint** | None (web/RSS) |
| **Category** | 10 - Think Tanks |
| **Signal Type** | analysis |
| **Data Format** | HTML / RSS |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Continuous |
| **Coverage** | US / Global security |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Technology and national security. AI and autonomy. Indo-Pacific strategy. Defense innovation. |

#### SRC-101 | Future Today Institute (FTI)
| Field | Value |
|-------|-------|
| **URL** | https://futuretodayinstitute.com |
| **API Endpoint** | None (web/PDF) |
| **Category** | 10 - Think Tanks |
| **Signal Type** | analysis |
| **Data Format** | PDF / web |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual (March, SXSW) |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Amy Webb's FTI. Annual Emerging Tech Trends Report. CIPHER framework. Gold standard for tech trend methodology. |

#### SRC-102 | Singularity University / Hub
| Field | Value |
|-------|-------|
| **URL** | https://singularityhub.com |
| **API Endpoint** | RSS feed |
| **Category** | 10 - Think Tanks |
| **Signal Type** | analysis |
| **Data Format** | RSS / HTML |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Daily |
| **Coverage** | Global |
| **Reliability** | ★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Peter Diamandis. Exponential technology convergence. 20 Metatrends. Abundance-oriented framework. |

---

<a id="cat-11-news--media"></a>
### CAT 11: News / Media

#### SRC-103 | News API (via connector)
| Field | Value |
|-------|-------|
| **URL** | https://newsapi.org |
| **API Endpoint** | https://newsapi.org/v2/ |
| **Category** | 11 - News / Media |
| **Signal Type** | news |
| **Data Format** | JSON REST API |
| **Auth** | API key |
| **Cost** | Freemium |
| **Update Frequency** | Real-time |
| **Coverage** | Global (80,000+ sources) |
| **Reliability** | ★★★ |
| **Integration Status** | **Active (P0)** |
| **Notes** | Active connector: `src/connectors/news.ts`. Headlines, everything search, sources. 100 req/day free. |

#### SRC-104 | Sentiment Analysis (via connector)
| Field | Value |
|-------|-------|
| **URL** | Multiple sources |
| **API Endpoint** | Custom aggregation |
| **Category** | 11 - News / Media |
| **Signal Type** | news |
| **Data Format** | JSON |
| **Auth** | Varies |
| **Cost** | Free |
| **Update Frequency** | Real-time |
| **Coverage** | Global |
| **Reliability** | ★★★ |
| **Integration Status** | **Active (P0)** |
| **Notes** | Active connector: `src/connectors/sentiment.ts`. Cross-source sentiment aggregation. |

#### SRC-105 | GDELT Project
| Field | Value |
|-------|-------|
| **URL** | https://www.gdeltproject.org |
| **API Endpoint** | https://api.gdeltproject.org/api/v2/ |
| **Category** | 11 - News / Media |
| **Signal Type** | news |
| **Data Format** | JSON / CSV API |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Every 15 minutes |
| **Coverage** | Global (100+ languages) |
| **Reliability** | ★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Monitors print, broadcast, web news worldwide. Event database, tone, themes. 100+ languages. BigQuery access. Extremely powerful for narrative tracking. |

#### SRC-106 | Media Cloud
| Field | Value |
|-------|-------|
| **URL** | https://mediacloud.org |
| **API Endpoint** | https://api.mediacloud.org/ |
| **Category** | 11 - News / Media |
| **Signal Type** | news |
| **Data Format** | JSON REST API |
| **Auth** | API key (free) |
| **Cost** | Free |
| **Update Frequency** | Daily |
| **Coverage** | Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Open-source media analysis platform. Narrative tracking across media ecosystems. MIT + university consortium. |

#### SRC-107 | Event Registry
| Field | Value |
|-------|-------|
| **URL** | https://eventregistry.org |
| **API Endpoint** | https://eventregistry.org/api/v1/ |
| **Category** | 11 - News / Media |
| **Signal Type** | news |
| **Data Format** | JSON REST API |
| **Auth** | API key |
| **Cost** | Freemium |
| **Update Frequency** | Real-time |
| **Coverage** | Global (100K+ sources) |
| **Reliability** | ★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | AI-powered news event extraction. Clusters articles into events. Trends analysis. 100K+ news sources. |

#### SRC-108 | Financial Times
| Field | Value |
|-------|-------|
| **URL** | https://www.ft.com |
| **API Endpoint** | None (web) |
| **Category** | 11 - News / Media |
| **Signal Type** | news |
| **Data Format** | HTML |
| **Auth** | Subscription |
| **Cost** | Paid |
| **Update Frequency** | Real-time |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Premium global business/geopolitics coverage. Gideon Rachman, Martin Wolf columns. Aspirational integration. |

#### SRC-109 | The Economist
| Field | Value |
|-------|-------|
| **URL** | https://www.economist.com |
| **API Endpoint** | None (web) |
| **Category** | 11 - News / Media |
| **Signal Type** | news |
| **Data Format** | HTML |
| **Auth** | Subscription |
| **Cost** | Paid |
| **Update Frequency** | Weekly |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | The World Ahead (annual forecasts). Economist Intelligence Unit. Premium analysis. |

#### SRC-110 | Reuters / AP News Feeds
| Field | Value |
|-------|-------|
| **URL** | https://www.reuters.com / https://apnews.com |
| **API Endpoint** | Commercial feed APIs |
| **Category** | 11 - News / Media |
| **Signal Type** | news |
| **Data Format** | XML / JSON feeds |
| **Auth** | Commercial license |
| **Cost** | Paid |
| **Update Frequency** | Real-time |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Wire services. Fastest breaking news. Factual reporting baseline. Commercial pricing. |

#### SRC-111 | Axios
| Field | Value |
|-------|-------|
| **URL** | https://www.axios.com |
| **API Endpoint** | RSS feeds |
| **Category** | 11 - News / Media |
| **Signal Type** | news |
| **Data Format** | RSS / HTML |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Daily |
| **Coverage** | US + Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Concise format. Strong on tech, policy, AI. Axios Pro newsletters. RSS ingestible. |

---

<a id="cat-12-startup--vc"></a>
### CAT 12: Startup / VC

#### SRC-112 | Crunchbase
| Field | Value |
|-------|-------|
| **URL** | https://www.crunchbase.com |
| **API Endpoint** | https://api.crunchbase.com/v4/ |
| **Category** | 12 - Startup / VC |
| **Signal Type** | startup_data |
| **Data Format** | JSON REST API |
| **Auth** | API key |
| **Cost** | Freemium ($29-49/mo for API) |
| **Update Frequency** | Daily |
| **Coverage** | Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Funding rounds, company data, investor profiles. Leading startup database. VC flow = forward-looking innovation signal. |

#### SRC-113 | PitchBook
| Field | Value |
|-------|-------|
| **URL** | https://pitchbook.com |
| **API Endpoint** | Platform API (enterprise) |
| **Category** | 12 - Startup / VC |
| **Signal Type** | startup_data |
| **Data Format** | Platform / API |
| **Auth** | Enterprise subscription |
| **Cost** | Paid (enterprise) |
| **Update Frequency** | Daily |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Most comprehensive PE/VC/M&A data. Morningstar subsidiary. VC-NVCA Venture Monitor (free quarterly). |

#### SRC-114 | Product Hunt (detailed)
| Field | Value |
|-------|-------|
| **URL** | https://www.producthunt.com |
| **API Endpoint** | https://api.producthunt.com/v2/api/graphql |
| **Category** | 12 - Startup / VC |
| **Signal Type** | startup_data |
| **Data Format** | GraphQL API |
| **Auth** | OAuth |
| **Cost** | Free |
| **Update Frequency** | Daily |
| **Coverage** | Global |
| **Reliability** | ★★★ |
| **Integration Status** | **Active (P0)** — see SRC-050 |
| **Notes** | Cross-listed with Technology (SRC-050). Product launches as startup ecosystem signal. |

#### SRC-115 | AngelList / Wellfound
| Field | Value |
|-------|-------|
| **URL** | https://wellfound.com |
| **API Endpoint** | Limited public API |
| **Category** | 12 - Startup / VC |
| **Signal Type** | startup_data |
| **Data Format** | JSON |
| **Auth** | API key |
| **Cost** | Freemium |
| **Update Frequency** | Continuous |
| **Coverage** | Global (US-focused) |
| **Reliability** | ★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Startup job market data as hiring signal. Rolling fund data. |

#### SRC-116 | Y Combinator Directory
| Field | Value |
|-------|-------|
| **URL** | https://www.ycombinator.com/companies |
| **API Endpoint** | Algolia search API (unofficial) |
| **Category** | 12 - Startup / VC |
| **Signal Type** | startup_data |
| **Data Format** | JSON |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Batch (per cohort) |
| **Coverage** | Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | YC batch composition = strongest early signal for startup sector trends. 4,000+ companies. Searchable. |

#### SRC-117 | State of AI Report (Nathan Benaich)
| Field | Value |
|-------|-------|
| **URL** | https://www.stateof.ai |
| **API Endpoint** | None (slides/PDF) |
| **Category** | 12 - Startup / VC |
| **Signal Type** | startup_data |
| **Data Format** | PDF / Slides |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Annual (October) |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Air Street Capital. Comprehensive AI industry analysis. Research, industry, politics, safety, predictions. Highly cited. |

#### SRC-118 | NVCA Venture Monitor
| Field | Value |
|-------|-------|
| **URL** | https://nvca.org/research/venture-monitor/ |
| **API Endpoint** | None (PDF) |
| **Category** | 12 - Startup / VC |
| **Signal Type** | startup_data |
| **Data Format** | PDF |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Quarterly |
| **Coverage** | US |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | PitchBook-NVCA partnership. US VC deal activity, fundraising, exits. Quarterly data. |

#### SRC-119 | Dealroom
| Field | Value |
|-------|-------|
| **URL** | https://dealroom.co |
| **API Endpoint** | Platform API |
| **Category** | 12 - Startup / VC |
| **Signal Type** | startup_data |
| **Data Format** | Platform / API |
| **Auth** | Subscription |
| **Cost** | Paid |
| **Update Frequency** | Continuous |
| **Coverage** | Global (strongest Europe) |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | European VC data leader. Used by European Commission, national governments. Startup ecosystem mapping. |

---

<a id="cat-13-supply-chain"></a>
### CAT 13: Supply Chain

#### SRC-120 | Freightos Baltic Index (FBX)
| Field | Value |
|-------|-------|
| **URL** | https://fbx.freightos.com |
| **API Endpoint** | https://fbx.freightos.com/api/ |
| **Category** | 13 - Supply Chain |
| **Signal Type** | supply_chain |
| **Data Format** | JSON API |
| **Auth** | API key |
| **Cost** | Freemium |
| **Update Frequency** | Weekly |
| **Coverage** | Global (shipping routes) |
| **Reliability** | ★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Container shipping price index. 12 trade routes. Early signal for supply chain disruption and trade patterns. |

#### SRC-121 | UN Comtrade (Trade Data)
| Field | Value |
|-------|-------|
| **URL** | https://comtrade.un.org |
| **API Endpoint** | https://comtrade.un.org/api/ |
| **Category** | 13 - Supply Chain |
| **Signal Type** | supply_chain |
| **Data Format** | JSON / CSV API |
| **Auth** | API key (free) |
| **Cost** | Free |
| **Update Frequency** | Monthly to annual |
| **Coverage** | Global (200+ countries) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Definitive global trade data. Bilateral trade flows. HS commodity codes. Restructuring patterns visible here. |

#### SRC-122 | S&P Global Supply Chain Risk
| Field | Value |
|-------|-------|
| **URL** | https://www.spglobal.com/marketintelligence/en/mi/products/supply-chain-risk.html |
| **API Endpoint** | Platform API (enterprise) |
| **Category** | 13 - Supply Chain |
| **Signal Type** | supply_chain |
| **Data Format** | Platform |
| **Auth** | Enterprise subscription |
| **Cost** | Paid |
| **Update Frequency** | Real-time |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | PMI data. Supplier risk scoring. Trade flow analytics. Premium but gold standard. |

#### SRC-123 | Flexport Ocean Timeliness Indicator
| Field | Value |
|-------|-------|
| **URL** | https://www.flexport.com/research/ocean-timeliness-indicator/ |
| **API Endpoint** | None (web) |
| **Category** | 13 - Supply Chain |
| **Signal Type** | supply_chain |
| **Data Format** | HTML / embedded data |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Weekly |
| **Coverage** | Global shipping |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Measures average days to ship a container. Simple but powerful disruption indicator. |

---

<a id="cat-14-thought-leaders"></a>
### CAT 14: Thought Leaders

#### SRC-124 | Exponential View (Azeem Azhar)
| Field | Value |
|-------|-------|
| **URL** | https://www.exponentialview.co |
| **API Endpoint** | RSS / Substack API |
| **Category** | 14 - Thought Leaders |
| **Signal Type** | thought_leadership |
| **Data Format** | RSS / HTML |
| **Auth** | None (free tier) |
| **Cost** | Freemium |
| **Update Frequency** | Weekly |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Planned (P1) |
| **Notes** | Azeem Azhar. Exponential gap thesis. One of the most widely read tech analysts. RSS ingestible for signal tracking. |

#### SRC-125 | Stratechery (Ben Thompson)
| Field | Value |
|-------|-------|
| **URL** | https://stratechery.com |
| **API Endpoint** | RSS (paid subscribers) |
| **Category** | 14 - Thought Leaders |
| **Signal Type** | thought_leadership |
| **Data Format** | RSS / HTML |
| **Auth** | Subscription |
| **Cost** | Paid ($12/mo) |
| **Update Frequency** | Daily |
| **Coverage** | Global (tech industry) |
| **Reliability** | ★★★★★ |
| **Integration Status** | Candidate (P2) |
| **Notes** | Ben Thompson. Aggregation Theory. Most influential independent tech analyst. Daily updates. |

#### SRC-126 | Zeihan on Geopolitics
| Field | Value |
|-------|-------|
| **URL** | https://zeihan.com |
| **API Endpoint** | YouTube API / RSS |
| **Category** | 14 - Thought Leaders |
| **Signal Type** | thought_leadership |
| **Data Format** | Video / RSS |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Daily |
| **Coverage** | Global |
| **Reliability** | ★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Peter Zeihan. Demographic/geographic determinism. Daily video analysis. YouTube transcript extraction possible. |

#### SRC-127 | GZERO Media (Ian Bremmer)
| Field | Value |
|-------|-------|
| **URL** | https://www.gzeromedia.com |
| **API Endpoint** | RSS / Newsletter |
| **Category** | 14 - Thought Leaders |
| **Signal Type** | thought_leadership |
| **Data Format** | RSS / HTML / Video |
| **Auth** | None |
| **Cost** | Free |
| **Update Frequency** | Daily |
| **Coverage** | Global |
| **Reliability** | ★★★★★ |
| **Integration Status** | Watch (P3) |
| **Notes** | Ian Bremmer / Eurasia Group public arm. Signal newsletter. Puppet Regime (geopolitical satire). RSS ingestible. |

---

<a id="coverage-analysis"></a>
## Coverage Analysis

### Geographic Coverage Matrix

| Region | Primary Sources | Count |
|--------|----------------|-------|
| **Global** | IMF, World Bank, WEF, OECD, UN, IEA, WHO, McKinsey, BCG, Deloitte, Gartner | 85+ |
| **Europe / EU** | ESPAS, Eurostat, EUR-Lex, Bruegel, MERICS, Chatham House, Copernicus | 12 |
| **North America / US** | FRED, NIC, CRS, NVCA, PredictIt, Pew | 10 |
| **Asia-Pacific** | NISTEP (Japan), Singapore CSF, CSIRO (Australia) | 5 |
| **Africa** | Brookings Foresight Africa, ACLED | 3 |
| **China** | MERICS, Kai-Fu Lee / Sinovation | 2 |
| **DACH (DE/AT/CH)** | Zukunftsinstitut, TRENDONE, Roland Berger, Gerd Leonhard | 4 |

### Signal Type Coverage

| Signal Type | Sources | Latency |
|-------------|---------|---------|
| Real-time events | World Monitor, ACLED, GDELT, news APIs | Minutes |
| Market signals | Polymarket, Yahoo Finance, Freightos | Minutes to hours |
| Developer signals | HN, GitHub, npm/PyPI, SO, arXiv | Hours |
| Search/sentiment | Google Trends, Reddit, sentiment connector | Hours |
| Weekly intelligence | Think tank RSS, newsletters, thought leaders | Days |
| Periodic reports | Consulting firms, WEF, IEA, Stanford HAI | Months |
| Long-range foresight | NIC, NISTEP, CSIRO, NATO, ESPAS | Years |

### Temporal Coverage

| Horizon | Sources | Purpose |
|---------|---------|---------|
| **Now** (real-time to daily) | World Monitor, Polymarket, HN, GitHub, news, Reddit | Signal detection |
| **Near** (weekly to monthly) | Google Trends, think tanks, newsletters, FRED | Trend confirmation |
| **Medium** (quarterly to annual) | WEF, McKinsey, Gartner, IEA, IMF, Stanford HAI | Trend classification |
| **Long** (multi-year to decade) | NIC, NISTEP, CSIRO, NATO, ESPAS, Roland Berger | Megatrend framing |

---

<a id="connector-development-roadmap"></a>
## Connector Development Roadmap

### Phase 0 — Active (13 connectors, operational)

| ID | Source | Connector File | Status |
|----|--------|---------------|--------|
| SRC-038 | Hacker News | `src/connectors/hackernews.ts` | Running |
| SRC-039 | GitHub | `src/connectors/github.ts` | Running |
| SRC-040 | arXiv | `src/connectors/arxiv.ts` | Running |
| SRC-041 | Stack Overflow | `src/connectors/stackoverflow.ts` | Running |
| SRC-042 | npm / PyPI | `src/connectors/npm-pypi.ts` | Running |
| SRC-049 | Google Trends | `src/connectors/google-trends.ts` | Running |
| SRC-050 | Product Hunt | `src/connectors/producthunt.ts` | Running |
| SRC-055 | Wikipedia | `src/connectors/wikipedia.ts` | Running |
| SRC-103 | News API | `src/connectors/news.ts` | Running |
| SRC-104 | Sentiment | `src/connectors/sentiment.ts` | Running |
| SRC-056 | World Monitor | `src/connectors/worldmonitor.ts` | Running |
| SRC-021 | Polymarket | `src/connectors/polymarket.ts` | Running |
| SRC-074 | Reddit | `src/connectors/reddit.ts` | Running |

### Phase 1 — High Priority (P1, target Q2 2026)

**Prediction & Forecasting:**
| ID | Source | API Available | Effort |
|----|--------|--------------|--------|
| SRC-022 | Metaculus | REST API (documented) | Low |
| SRC-023 | Manifold Markets | REST API (documented) | Low |

**Economic & Financial Data:**
| ID | Source | API Available | Effort |
|----|--------|--------------|--------|
| SRC-026 | IMF DataMapper | REST API | Medium |
| SRC-027 | World Bank | REST API | Low |
| SRC-028 | FRED | REST API | Low |
| SRC-032 | Eurostat | SDMX API | Medium |

**Technology & Innovation:**
| ID | Source | API Available | Effort |
|----|--------|--------------|--------|
| SRC-046 | CB Insights | Scrape (free summaries) | Medium |
| SRC-047 | MIT Tech Review | RSS | Low |
| SRC-051 | Stanford HAI | Data tables (CSV) | Medium |
| SRC-052 | Semantic Scholar | REST API | Low |
| SRC-053 | Patent APIs (Lens.org) | REST API | Medium |

**Geopolitical & Security:**
| ID | Source | API Available | Effort |
|----|--------|--------------|--------|
| SRC-057 | ACLED | REST API | Medium |
| SRC-062 | Fragile States Index | Download | Low |

**Climate / Environment:**
| ID | Source | API Available | Effort |
|----|--------|--------------|--------|
| SRC-066 | IEA | Limited API | High |
| SRC-067 | NASA GISS | Direct CSV | Low |

**News / Media:**
| ID | Source | API Available | Effort |
|----|--------|--------------|--------|
| SRC-105 | GDELT | REST API | Medium |

**Regulatory:**
| ID | Source | API Available | Effort |
|----|--------|--------------|--------|
| SRC-082 | OECD AI Observatory | Web scrape | Medium |
| SRC-083 | EUR-Lex | SPARQL/CELLAR | High |

**Health:**
| ID | Source | API Available | Effort |
|----|--------|--------------|--------|
| SRC-087 | WHO GHO | REST API | Low |

**Social / Demographic:**
| ID | Source | API Available | Effort |
|----|--------|--------------|--------|
| SRC-075 | UN Population | REST API | Low |

**Startup / VC:**
| ID | Source | API Available | Effort |
|----|--------|--------------|--------|
| SRC-112 | Crunchbase | REST API (paid tier) | Medium |
| SRC-116 | YC Directory | Algolia (unofficial) | Low |
| SRC-117 | State of AI Report | PDF (annual) | Low |

**Supply Chain:**
| ID | Source | API Available | Effort |
|----|--------|--------------|--------|
| SRC-120 | Freightos Baltic Index | API | Medium |

**Trend Reports (RSS-based ingest):**
| ID | Source | API Available | Effort |
|----|--------|--------------|--------|
| SRC-007 | McKinsey (MGI) | RSS | Low |
| SRC-008 | BCG | RSS | Low |
| SRC-009 | Deloitte | RSS | Low |
| SRC-010 | Accenture | RSS | Low |
| SRC-014 | Bain | RSS | Low |
| SRC-015 | WEF | RSS | Low |
| SRC-017 | OECD Foresight | RSS + SDMX | Medium |

**Think Tanks:**
| ID | Source | API Available | Effort |
|----|--------|--------------|--------|
| SRC-101 | Future Today Institute | PDF / RSS | Low |

**Thought Leaders:**
| ID | Source | API Available | Effort |
|----|--------|--------------|--------|
| SRC-124 | Exponential View | RSS / Substack | Low |

### Phase 2 — Candidate (P2, target Q3-Q4 2026)

48 sources requiring scraping, paid access, manual ingest, or specialized parsing. See individual entries above for details.

### Phase 3 — Watch List (P3)

33 sources for manual monitoring. Low-frequency or niche. Review quarterly for promotion to P2.

---

## Quick Reference: All 127 Sources

| ID | Name | Cat | Priority | Status | API? |
|----|------|-----|----------|--------|------|
| SRC-001 | EU ESPAS | 1 | P2 | Candidate | No |
| SRC-002 | Zukunftsinstitut | 1 | P2 | Candidate | No |
| SRC-003 | PwC Megatrends | 1 | P2 | Candidate | No |
| SRC-004 | EY Megatrends | 1 | P2 | Candidate | No |
| SRC-005 | TRENDONE | 1 | P2 | Candidate | No |
| SRC-006 | Roland Berger | 1 | P2 | Candidate | No |
| SRC-007 | McKinsey (MGI) | 1 | P1 | Planned | RSS |
| SRC-008 | BCG | 1 | P1 | Planned | RSS |
| SRC-009 | Deloitte Tech Trends | 1 | P1 | Planned | RSS |
| SRC-010 | Accenture Tech Vision | 1 | P1 | Planned | RSS |
| SRC-011 | KPMG Futures | 1 | P2 | Candidate | No |
| SRC-012 | Capgemini | 1 | P3 | Watch | No |
| SRC-013 | Frost & Sullivan | 1 | P3 | Watch | No |
| SRC-014 | Bain Macro Trends | 1 | P1 | Planned | RSS |
| SRC-015 | WEF Global Risks | 1 | P1 | Planned | RSS |
| SRC-016 | US NIC Global Trends | 1 | P2 | Candidate | No |
| SRC-017 | OECD Foresight | 1 | P1 | Planned | SDMX |
| SRC-018 | Japan NISTEP | 1 | P3 | Watch | No |
| SRC-019 | Singapore CSF | 1 | P3 | Watch | No |
| SRC-020 | CSIRO | 1 | P3 | Watch | No |
| SRC-021 | Polymarket | 2 | **P0** | **Active** | REST |
| SRC-022 | Metaculus | 2 | P1 | Planned | REST |
| SRC-023 | Manifold Markets | 2 | P1 | Planned | REST |
| SRC-024 | PredictIt | 2 | P2 | Candidate | REST |
| SRC-025 | RAND Forecasting | 2 | P3 | Watch | No |
| SRC-026 | IMF WEO | 3 | P1 | Planned | REST |
| SRC-027 | World Bank | 3 | P1 | Planned | REST |
| SRC-028 | FRED | 3 | P1 | Planned | REST |
| SRC-029 | BIS | 3 | P2 | Candidate | SDMX |
| SRC-030 | Bloomberg | 3 | P3 | Watch | Prop. |
| SRC-031 | Yahoo Finance | 3 | P2 | Candidate | Unoff. |
| SRC-032 | Eurostat | 3 | P1 | Planned | SDMX |
| SRC-033 | Marsh McLennan | 3 | P2 | Candidate | No |
| SRC-034 | OECD.Stat | 3 | P2 | Candidate | SDMX |
| SRC-035 | Trading Economics | 3 | P2 | Candidate | REST |
| SRC-036 | Our World in Data | 3 | P2 | Candidate | GitHub |
| SRC-037 | Bruegel | 3 | P3 | Watch | No |
| SRC-038 | Hacker News | 4 | **P0** | **Active** | REST |
| SRC-039 | GitHub | 4 | **P0** | **Active** | REST |
| SRC-040 | arXiv | 4 | **P0** | **Active** | XML |
| SRC-041 | Stack Overflow | 4 | **P0** | **Active** | REST |
| SRC-042 | npm / PyPI | 4 | **P0** | **Active** | REST |
| SRC-043 | Gartner | 4 | P2 | Candidate | No |
| SRC-044 | Forrester | 4 | P2 | Candidate | No |
| SRC-045 | IDC FutureScape | 4 | P2 | Candidate | No |
| SRC-046 | CB Insights | 4 | P1 | Planned | Scrape |
| SRC-047 | MIT Tech Review | 4 | P1 | Planned | RSS |
| SRC-048 | StartUs Insights | 4 | P3 | Watch | No |
| SRC-049 | Google Trends | 4 | **P0** | **Active** | Unoff. |
| SRC-050 | Product Hunt | 4 | **P0** | **Active** | GQL |
| SRC-051 | Stanford HAI | 4 | P1 | Planned | CSV |
| SRC-052 | Semantic Scholar | 4 | P1 | Planned | REST |
| SRC-053 | Patent APIs | 4 | P1 | Planned | REST |
| SRC-054 | AlphaSignal AI | 4 | P3 | Watch | RSS |
| SRC-055 | Wikipedia | 4 | **P0** | **Active** | REST |
| SRC-056 | World Monitor | 5 | **P0** | **Active** | REST |
| SRC-057 | ACLED | 5 | P1 | Planned | REST |
| SRC-058 | Eurasia Group | 5 | P2 | Candidate | No |
| SRC-059 | SIPRI | 5 | P2 | Candidate | DL |
| SRC-060 | CFR Conflict Tracker | 5 | P2 | Candidate | No |
| SRC-061 | NATO ACT | 5 | P3 | Watch | No |
| SRC-062 | Fragile States Index | 5 | P1 | Planned | DL |
| SRC-063 | Geopolitical Futures | 5 | P3 | Watch | No |
| SRC-064 | Intl Crisis Group | 5 | P2 | Candidate | RSS |
| SRC-065 | V-Dem | 5 | P3 | Watch | DL |
| SRC-066 | IEA | 6 | P1 | Planned | Ltd. |
| SRC-067 | NASA GISS | 6 | P1 | Planned | CSV |
| SRC-068 | NOAA Climate | 6 | P2 | Candidate | REST |
| SRC-069 | Copernicus C3S | 6 | P2 | Candidate | REST |
| SRC-070 | Global Carbon Project | 6 | P2 | Candidate | DL |
| SRC-071 | Climate Action Tracker | 6 | P3 | Watch | No |
| SRC-072 | UNEP | 6 | P3 | Watch | No |
| SRC-073 | IRENA | 6 | P2 | Candidate | PxWeb |
| SRC-074 | Reddit | 7 | **P0** | **Active** | REST |
| SRC-075 | UN Population | 7 | P1 | Planned | REST |
| SRC-076 | Ipsos Global Trends | 7 | P2 | Candidate | No |
| SRC-077 | Euromonitor | 7 | P2 | Candidate | No |
| SRC-078 | ILO / ILOSTAT | 7 | P2 | Candidate | SDMX |
| SRC-079 | Pew Research | 7 | P3 | Watch | No |
| SRC-080 | Gallup World Poll | 7 | P3 | Watch | No |
| SRC-081 | WM Regulation | 8 | **P0** | **Active** | REST |
| SRC-082 | OECD AI Observatory | 8 | P1 | Planned | Scrape |
| SRC-083 | EUR-Lex | 8 | P1 | Planned | SPARQL |
| SRC-084 | CRS Reports | 8 | P2 | Candidate | Unoff. |
| SRC-085 | AI Incident Database | 8 | P2 | Candidate | GQL |
| SRC-086 | UK Reg. Horizons | 8 | P3 | Watch | No |
| SRC-087 | WHO GHO | 9 | P1 | Planned | REST |
| SRC-088 | IHME GBD | 9 | P2 | Candidate | DL |
| SRC-089 | ProMED | 9 | P2 | Candidate | RSS |
| SRC-090 | Lancet Countdown | 9 | P3 | Watch | DL |
| SRC-091 | GHS Index | 9 | P3 | Watch | DL |
| SRC-092 | RAND | 10 | P2 | Candidate | RSS |
| SRC-093 | Brookings | 10 | P2 | Candidate | RSS |
| SRC-094 | Chatham House | 10 | P2 | Candidate | RSS |
| SRC-095 | Club of Rome | 10 | P3 | Watch | No |
| SRC-096 | Carnegie | 10 | P3 | Watch | RSS |
| SRC-097 | Atlantic Council | 10 | P3 | Watch | RSS |
| SRC-098 | Bruegel | 10 | P3 | Watch | No |
| SRC-099 | MERICS | 10 | P2 | Candidate | RSS |
| SRC-100 | CNAS | 10 | P3 | Watch | RSS |
| SRC-101 | Future Today Inst. | 10 | P1 | Planned | PDF |
| SRC-102 | Singularity Hub | 10 | P2 | Candidate | RSS |
| SRC-103 | News API | 11 | **P0** | **Active** | REST |
| SRC-104 | Sentiment | 11 | **P0** | **Active** | Custom |
| SRC-105 | GDELT | 11 | P1 | Planned | REST |
| SRC-106 | Media Cloud | 11 | P2 | Candidate | REST |
| SRC-107 | Event Registry | 11 | P2 | Candidate | REST |
| SRC-108 | Financial Times | 11 | P3 | Watch | No |
| SRC-109 | The Economist | 11 | P3 | Watch | No |
| SRC-110 | Reuters / AP | 11 | P2 | Candidate | Feed |
| SRC-111 | Axios | 11 | P3 | Watch | RSS |
| SRC-112 | Crunchbase | 12 | P1 | Planned | REST |
| SRC-113 | PitchBook | 12 | P2 | Candidate | Prop. |
| SRC-114 | Product Hunt | 12 | **P0** | **Active** | GQL |
| SRC-115 | AngelList/Wellfound | 12 | P2 | Candidate | Ltd. |
| SRC-116 | YC Directory | 12 | P1 | Planned | Unoff. |
| SRC-117 | State of AI Report | 12 | P1 | Planned | PDF |
| SRC-118 | NVCA Venture Monitor | 12 | P2 | Candidate | PDF |
| SRC-119 | Dealroom | 12 | P3 | Watch | Prop. |
| SRC-120 | Freightos (FBX) | 13 | P1 | Planned | REST |
| SRC-121 | UN Comtrade | 13 | P2 | Candidate | REST |
| SRC-122 | S&P Supply Chain | 13 | P2 | Candidate | Prop. |
| SRC-123 | Flexport OTI | 13 | P3 | Watch | No |
| SRC-124 | Exponential View | 14 | P1 | Planned | RSS |
| SRC-125 | Stratechery | 14 | P2 | Candidate | RSS |
| SRC-126 | Zeihan Geopolitics | 14 | P3 | Watch | YT |
| SRC-127 | GZERO Media | 14 | P3 | Watch | RSS |

---

## Appendix: 44 Thought Leaders (Cross-Reference)

The full directory of 44+ thought leaders is maintained in `GLOBAL_THOUGHT_LEADERS.md`. Key individuals whose outputs should be tracked as signal sources:

| Name | Organization | Primary Signal | Frequency |
|------|-------------|---------------|-----------|
| Amy Webb | Future Today Institute | Annual Tech Trends Report | Annual (March) |
| Ian Bremmer | Eurasia Group / GZERO | Top Risks Report | Annual (Jan) + daily |
| Azeem Azhar | Exponential View | Newsletter + podcast | Weekly |
| Ben Thompson | Stratechery | Newsletter + podcast | Daily |
| Benedict Evans | Independent | Annual macro tech preso | Annual |
| Peter Zeihan | Zeihan on Geopolitics | Video + newsletter | Daily |
| Scott Galloway | NYU Stern | Prof G podcast + newsletter | Weekly |
| John Maeda | Independent | Design in Tech Report | Annual (March) |
| George Friedman | Geopolitical Futures | Weekly analysis | Weekly |
| Christiana Figueres | Global Optimism | Outrage + Optimism podcast | Weekly |

---

*This registry is a living document. Review quarterly. Promote sources from P3 to P2 to P1 as strategic needs evolve and API access becomes available.*
