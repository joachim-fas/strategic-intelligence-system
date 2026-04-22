# Pilot-Evaluation — b-ki-arbeitsmarkt-de

**Thema:** Wie verändert sich der europäische Arbeitsmarkt durch autonome KI-Agenten bis 2028? Welche Branchen sind am exponiertesten, welche strukturellen Interventionen (Regulierung, Bildung, Sozialsysteme) wirken — und wo droht die größte Kluft zwischen politischem Willen und Realität?
**Datum:** 2026-04-22
**Version-ID:** project_queries.id=`903b6117-a40f-48a9-8afa-db269efa9734`
**Status:** Teilbewertung — synthesis-only-Collapse erkannt, Rubrik-Scoring deferred bis Fix.

Rubrik: [rubric.md](./rubric.md) — 7 Dimensionen · 1–5 Score · Gesamtmax 35.

---

## 🔴 Was dieser Run aufgedeckt hat (zusammen mit C DE)

Der B-DE-Run lief technisch durch (Status 200), lieferte aber **dasselbe strukturelle Defektmuster wie C DE**: nur das narrative `synthesis`-Feld gefüllt, alle flachen JSON-Felder leer.

**Auszug aus `project_queries.result_json` (ID `903b6117…`):**
```
synthesis: str[3147]     ← Freitext mit 3 Absätzen vorhanden
scenarios: list[0]       ← leer
references: list[0]      ← leer
keyInsights: list[0]     ← leer
causalChain: list[0]     ← leer
regulatoryContext: list[0] ← leer
matchedTrends: list[0]   ← leer
usedSignals: list[0]     ← leer
followUpQuestions: list[0] ← leer
```

**Signal-Retrieval-Diagnose:**
- `getRelevantSignals(query, 16)` → 16 Treffer nominal
- Davon **2 Unique-Sources** (ecfr_rss „Fast energy" + un_sdg „SDG 8"), jeweils dupliziert
- Top-Topic-Relevanz: 22-24%

Das ist die identische Root-Cause wie C DE — nur mit 2 schwachen Signal-Proxies statt 0. Das Ergebnis für den LLM ist funktional gleich: zu wenig konkrete Anker, um die strukturierten Felder zu füllen.

**Die ausführliche Root-Cause-Analyse + Fix-Action-Liste steht in [c-waermepumpen-de.md](./c-waermepumpen-de.md#was-dieser-run-aufgedeckt-hat).** Sie gilt vollinhaltlich für B DE ebenso.

## Auswirkung für Score-Lesung

Die vollständige Rubrik-Bewertung dieses Runs wird **deferred** — gleiche Begründung wie C DE: bei fehlenden strukturierten Feldern sind D2/D3/D4/D6 nicht fair bewertbar.

Der synthesis-Text alleine zeigt allerdings, dass der LLM auch für dieses Thema ein kompetentes narratives Briefing liefern würde, wenn die Pipeline strukturierte Felder erzwingen würde. Das erneut bestätigt: das Problem liegt in der Pipeline, nicht im LLM-Kern-Output.

---

## Briefing-Output

_3 147 Zeichen synthesis-Text — Inhalt im Screenshot vom 22.04.2026. Alle flachen Felder leer (siehe DB-Auszug oben)._

## Rubrik-Bewertung

**Deferred** — siehe [c-waermepumpen-de.md Rubrik-Notizen](./c-waermepumpen-de.md#rubrik-bewertung), analog für B DE.

## Konkrete Fix-Action-Items

Siehe [c-waermepumpen-de.md Fix-Liste](./c-waermepumpen-de.md#konkrete-fix-action-items). Für B DE zusätzlich relevant:

**B-spezifisch P0-A Signal-Connectors (Arbeitsmarkt-Focus):**
- IAB (Institut für Arbeitsmarkt- und Berufsforschung) — DE-Arbeitsmarkt-Daten/Presse
- Eurofound — EU-Arbeits/Soziales
- ETUC (European Trade Union Confederation) — Gewerkschafts-Sicht
- OECD Employment Outlook — internationale Arbeitsmarkt-Analyse
- Bruegel Future-of-Work-Dossier — speziell für KI × Jobs

---

## Notizen / Überraschungen

- **Unerwartet schwach**: Für ein Thema mit so viel aktueller Medienpräsenz (KI-Agenten, Automatisierung, Jobdisplacement) sollte der Signal-Pool sehr dicht sein. Dass nur ECFR-Energy-Artikel und SDG-8-Proxies matchen zeigt, wie weit das Connector-Portfolio vom zentralen Use-Case abweicht.
- **Signal-Intuition-Miss**: Erwartet wären mindestens arxiv-Papers zu LLM/Agent-Automatisierung (sind in der DB mit 215 Einträgen!), Hackernews-Threads zu AI-Layoffs (309 in der DB), Eurofound oder IAB-Pressemeldungen (nicht in der DB). Die arxiv/HN-Daten sind also da, aber die Keyword-Matching-Logik verbindet sie nicht mit dieser DE-Query — möglicherweise wegen Term-Mismatch (DE „KI-Agenten" ↔ EN „autonomous agents / LLM agents"). **Action:** Alias-Map-Erweiterung: ki-agenten → autonomous agents, llm agents, agentic ai.
