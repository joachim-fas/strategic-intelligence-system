# Pilot-Evaluation — c-waermepumpen-en

**Thema:** What regulatory and economic forces will shape the future of the heat pump industry in the DACH region through 2030? Where are the tipping points for market penetration — what role do the German Building Energy Act (GEG), the EU Energy Performance of Buildings Directive (EPBD), and the Asia-vs-EU supply chain play?
**Datum:** 2026-04-22 (deferred) → 2026-04-23 (Re-Run vollständig)
**Version-ID:** Re-Run-Query in `project_queries`
**Status:** ✅ **Re-Run vollständig bewertet — 33/35 (94%) — BESTER RUN aller sechs Slots**

---

## ✅ Re-Run-Ergebnis (2026-04-23) — Best-Score 94%

Nach kompletter Pipeline-Reform plus zwei UI-Layer-Sync-Fixes ist C-EN
nicht nur unblocked, sondern der bestbewertete Run der gesamten Pilot-
Evaluation.

**Live-Numbers:**
- 36% Konfidenz (LLM-Selbstbewertung)
- 30 Live-Signale (UI-Tile, real, nicht mehr unter Threshold versteckt)
- 14 Signale in Orbit-Chain (über 3 Buckets: arxiv_econ_rss + ecipe_rss + google_news_hp_en)
- 5 Quellen referenziert
- 3 Szenarien: 20% / 52% / 28% = 100% ✓

| Dim | Score | Begründung |
|---|---|---|
| D1 Provenienz | 4/5 | Konsequente Tags: `[SIGNAL: GOOGLE_NEWS_HP_EN]`, `[REGS: EU CBAM]`, `[REGS: ETS2]`, `[REGS: EPBD]`, `[TREND]`, `[LLM-KNOWLEDGE]` |
| D2 Source-Qualität | 5/5 | **European Heat Pump Association** (DIE Industrie-Autorität), **IEA Tracking Clean Energy Progress**, **European Commission REPowerEU**, plus zwei Industrie-Reports |
| D3 Signal-Relevanz | 5/5 | **30 Live-Signale, 14 in Orbit-Chain.** Beste Signal-Abdeckung aller Runs. `google_news_hp_en` stellt 11 Chain-Signale (Adoption-slower, Market-Forecast, Air-Source/Geothermal Market Size, Daikin restructure). ECIPE liefert Regulatory-Lock-in-Framing. |
| D4 Szenarien | 5/5 | „Policy Convergence Drives Acceleration" / „Fragmented Progress, Structural Underperformance" / „Policy Backlash Freezes Market…". Policy-spezifische Namen, asymmetrische Realität (52% Basefall) |
| D5 EU-Frame | 5/5 | EU AI Act, **CBAM**, **ETS2**, GEG, **BEG**, **EPBD 2033 Zero-Emission-Mandate**, REPowerEU. Geographische Differenzierung (Skandinavien führt, CEE hinkt). OEM-spezifisch (Bosch, Viessmann, Daikin Europe vs. LG, Midea) |
| D6 Action-Readiness | 5/5 | MONITOR (Q1-Q3 2026 ETS2 Policy-Watch) / NEAR-TERM (2026-27 Technology decision) / STRUCTURAL — mit Akteuren (member states, contractors, OEMs) und quantifizierten Policy-Schwellen |
| D7 Ehrlichkeit-über-Lücken | 4/5 | 36% Konfidenz transparent. „5 referenziert / 3 verifiziert / 4 unverifiziert" macht Verifikation sichtbar. Acknowledges „slower-than-expected adoption" explizit |

**Total: 33/35 = 94%** — **bester Score aller sechs Slots.**

**Was geändert wurde** (chronologisch identisch zu C DE plus):
- Beide UI-Display-Fixes (`80288e2` Live-Signale-Tile, `a6bb7cb` Orbit-Threshold)
  zeigen für diesen Run die volle Wirkung — die Orbit-Chain visualisiert die
  14 Signale tatsächlich, was bei früheren Runs verborgen war.

**Empirische Bestätigung der Smoke-Test-Vorhersage:** Der
`signals-retrieval-smoketest.ts` hatte 30 Signale (21× google_news_hp_en
+ 7× ECIPE + arxiv) prognostiziert. Im Live-Run: 30 Live-Signale, 14
in Orbit-Chain, mit genau den vorhergesagten Quell-Buckets. **Smoke-Test-
Predictivity: 100%.**

---

## 🔴 Initial-Status (zur Historie behalten)

**Status (2026-04-22):** Deferred — identische Root Cause wie C DE, Re-Run erst nach Signal-Pool-Pipeline-Erweiterung sinnvoll.

Rubrik: [rubric.md](./rubric.md) — 7 Dimensionen · 1–5 Score · Gesamtmax 35.

---

## 🟠 Warum dieser Run nicht gefahren wurde

Der parallele C-DE-Run ([c-waermepumpen-de.md](./c-waermepumpen-de.md)) hat zwei strukturelle P0-Defekte aufgedeckt:

1. **Signal-Pool-Drought** — für DACH-Wärmepumpen-Queries findet das System 0 matchbaren Live-Signale in der DB. Die Signal-Connectors decken das Thema nicht ab.
2. **LLM synthesis-only-Collapse** — bei leerem Signal-Pool degeneriert die Pipeline zu Freitext-Only-Output ohne Szenarien/Referenzen/Entscheidungshilfe.

Ein EN-Re-Run hätte exakt dieselben Probleme — die Signal-Pool-Drought betrifft die DB, nicht die Query-Sprache, und der synthesis-only-Collapse ist strukturell. Der Kostennutzen für einen weiteren Anthropic-Call mit garantiert leerem Output ist negativ.

Die C-EN-Evaluation wird nach P0-Fixes nachgeholt — dann auch als Härtetest für den Language-Detection-Fix (`e575478`), damit EN-Queries sauber EN-Antworten produzieren.

## Was dieser Slot trotzdem beiträgt

Die C-EN-Lücke ist **selbst ein Befund**: Sie macht sichtbar, dass Mehrsprachigkeit erst wertvoll ist, wenn der Signal-Pool beide Sprach-Räume abdeckt. Solange die DB fast ausschließlich englische Non-Strategy-Connectors enthält und keine DE-Strategie-Quellen, ist jede DE-Query benachteiligt. Eine EN-Version derselben Query würde beim aktuellen Pool marginal mehr Treffer liefern (englische News-Feeds statt null), aber auf einem Themenfeld mit 0 strategischen Quellen trotzdem in den synthesis-only-Fallback kippen.

**Erwartete Score-Projektion nach Fix (P0-A + P0-B):**
- D1-D7 analog zu C DE nach Fix
- Zusätzlich D5 EU-Frame-Härtetest auf EN: Rutscht der LLM bei englischer Query in US-Perspektive ab, selbst wenn das Thema DACH-spezifisch ist? (Erwartet: sauber EU/DACH, wegen expliziter DACH-Framing in der Query.)

---

## Briefing-Output

_Nicht ausgeführt — siehe Deferral-Begründung oben._

## Rubrik-Bewertung

**Deferred** — Re-Run nach P0-A (Signal-Connectors) + P0-B (Prompt-Fix).

## Konkrete Fix-Action-Items

Siehe [c-waermepumpen-de.md](./c-waermepumpen-de.md#konkrete-fix-action-items) — identische Fix-Liste.
