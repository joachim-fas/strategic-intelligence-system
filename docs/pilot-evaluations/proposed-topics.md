# SIS Pilot-Themen — Kandidaten (2026-04-22)

Vorschlag für die drei End-to-End-Evaluations-Fragen. Jede Frage wurde
so geschnitten, dass sie eine andere Stärke / Schwäche des Systems testet,
mit EU-Fokus und mit konkret-strategischem Charakter (nicht faktisch
oder rein keyword-basiert).

## Auswahllogik

Ein gutes Pilot-Thema …

- ist **strategisch** (Was sollen wir tun?) nicht faktisch (Was ist X?)
- hat **klaren EU-Bezug** — testet explizit D5 EU-Frame
- berührt **mehrere STEEP+V-Dimensionen** — damit mehrere Trend-Cluster matchen
- ist **aktiv im Signalbild** (Connectors sollten Evidenz liefern) — sonst testen wir nur LLM-Knowledge
- hat ein **konkretes Zeitfenster** (3–10 Jahre) — testet Szenario-Disziplin

## Die drei Kandidaten

### Thema A — „Lieferketten-Fragmentierung"

> **Welche EU-Länder werden bis 2030 am stärksten von der Fragmentierung
> globaler Lieferketten betroffen sein — und welche strategischen
> Optionen hat Deutschland als industrielles Rückgrat?**

**Warum testet das SIS gut:**
- STEEP+V: E_economy (dominant), P (Geopolitik), T (Automatisierung, Re-Shoring)
- Connectors mit Evidenz: ACLED, UCDP, IMF, World Bank, Eurostat, ECFR-RSS, GDELT, Al Jazeera, UN News
- Prüft D5 hart (EU-spezifische Analyse)
- Klassisches Szenario-Terrain (Globalisierung vs. Fragmentierung vs. „Slowbalisation")

**Erwartete Schwächen:**
- Regional-Spezifik (einzelne Länder) ist schwer — LLM könnte aggregieren
- Konkrete Handelsdaten könnten veraltet sein

---

### Thema B — „KI-Agenten & Arbeitsmarkt"

> **Wie verändert sich der europäische Arbeitsmarkt durch autonome
> KI-Agenten bis 2028? Welche Branchen sind am exponiertesten, welche
> strukturellen Interventionen (Regulierung, Bildung, Sozialsysteme)
> wirken — und wo droht die größte Kluft zwischen politischem Willen und
> Realität?**

**Warum testet das SIS gut:**
- STEEP+V: T (AI dominant), S (Future of Work), P (EU AI Act), V (Akzeptanz)
- Connectors: arxiv, GitHub, HackerNews, ECFR-RSS (AI Act), NYT/Guardian (News), ILO, Eurostat, Bundestag-RSS (planned)
- Prüft D4 scharf — 3 Szenarien für AI-Adoption sind strukturell sehr verschieden (Hype-Kollaps / linearer Uplift / Agentic Disruption)
- EU AI Act + Draghi-Report als konkrete Policy-Anker

**Erwartete Schwächen:**
- arxiv-Papers sind viel, aber sehr tech-zentrisch — Sozialperspektive braucht LLM-Inferenz
- Arbeitsmarkt-Zahlen sind quarterly, nicht weekly-live

---

### Thema C — „Wärmepumpen & Heizungsgesetz"

> **Welche regulatorischen und wirtschaftlichen Kräfte prägen die Zukunft
> der Wärmepumpen-Industrie im DACH-Raum bis 2030? Wo liegen die
> Tipping-Points für Marktdurchdringung — welche Rolle spielt das
> Gebäudeenergiegesetz (GEG), EU-Gebäuderichtlinie (EPBD), und die
> Asia-vs-EU-Lieferkette?**

**Warum testet das SIS gut:**
- STEEP+V: E_environment (Klima) + E_economy (Markt) + P (Regulierung) + T (Industrialisierung)
- Connectors: EUR-Lex-RSS, Destatis, Eurostat, IEA-RSS, Carbon-Brief-RSS, Guardian, SPIEGEL-RSS
- Sehr EU/DACH-spezifisch — kein US-Fallback möglich → prüft D5 maximal
- Konkrete Tipping-Point-Frage → D6 Action-Readiness messbar
- Echte aktuelle politische Debatte → D7 Datenqualität prüfbar (wie aktuell sind die Signale?)

**Erwartete Schwächen:**
- Sehr nischig — Signal-Retrieval muss präzise greifen
- Industrielle Tiefe braucht Fachterminologie (COP, SCOP, Kältemittel)

## Gesamt-Abdeckung

| Dimension | A | B | C |
|---|---|---|---|
| S – Society            | ◌ | ● | ◌ |
| T – Technology         | ◔ | ● | ◔ |
| E_economy              | ● | ◔ | ● |
| E_environment          |   |   | ● |
| P – Politics           | ● | ◔ | ● |
| V – Values             |   | ◔ |   |
| **EU-Spezifik-Tiefe**  | ◔ | ◔ | ● |
| **Live-Signal-Dichte** | ● | ● | ◔ |
| **Szenario-Potenzial** | ● | ● | ◔ |

● dominant · ◔ moderat · ◌ sekundär

Die drei zusammen decken alle sechs STEEP+V-Achsen ab und stellen
Pipeline, Signal-Filter, Prompt-Layer und UI vor je unterschiedliche
Herausforderungen.

## Alternativen (falls einer der drei nicht passt)

**D) Demografischer Wandel + Pflege** (S+P, DACH-Fokus, Zeitfenster
2030–2040 — testet Long-Horizon-Reasoning härter)

**E) Chinesische Autoexporte + EU-Strafzölle** (P+E_economy, aktives
Policy-Thema — testet Signal-Recency und Policy-Tracking-Genauigkeit)

**F) Cybersicherheit kritischer Infrastruktur in der EU** (T+P+V —
testet ob SIS konkret genug wird, wo die Berichte sonst generisch bleiben)

## Wann fix, wann swap?

Die drei Kandidaten A/B/C sind gut — aber wenn du eines davon durch ein
Thema ersetzen willst, das du ohnehin gerade professionell bewegst (dann
ist deine Qualitäts-Bewertung schärfer), sag's. Ein schlechtes Briefing
zu einem dir fremden Thema scored schwer.
