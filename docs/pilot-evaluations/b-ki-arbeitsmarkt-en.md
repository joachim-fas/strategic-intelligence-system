# Pilot-Evaluation — b-ki-arbeitsmarkt-en

**Thema:** How will the European labor market change through autonomous AI agents by 2028? Which sectors are most exposed, which structural interventions (regulation, education, social systems) are effective — and where is the biggest gap looming between political will and reality?
**Datum:** 2026-04-22
**Version-ID:** _(not executed)_
**Status:** Deferred — identische Root Cause wie B DE, Re-Run erst nach Fix der P0-Defekte sinnvoll.

Rubrik: [rubric.md](./rubric.md) — 7 Dimensionen · 1–5 Score · Gesamtmax 35.

---

## 🟠 Warum dieser Run nicht gefahren wurde

Der parallele B-DE-Run ([b-ki-arbeitsmarkt-de.md](./b-ki-arbeitsmarkt-de.md)) lief in denselben strukturellen synthesis-only-Collapse wie C DE. Die Root-Cause ist pipeline-strukturell (Signal-Pool-Drought + LLM-Fallback-Pattern), nicht query-spezifisch oder sprachspezifisch. Ein EN-Re-Run würde beim aktuellen Stand:

- **Leicht mehr Signale** liefern (arxiv/HN/Reddit sind in der DB mit ~900 Einträgen und könnten bei EN-Keywords besser matchen)
- Aber **dieselbe Collapse-Mechanik** hinsichtlich Szenarien/Referenzen/Entscheidungshilfe zeigen, wenn die Signal-Schwelle unterschritten wird
- Und wie A EN potentiell das Language-Detection-Verhalten quertesten (wurde der `e575478`-Fix für EN-Queries bei DE-UI-Locale korrekt aktiviert?)

Der Kostennutzen war für jetzt nicht ausreichend — B-DE-Diagnose ist bereits abgeschlossen, und der Sprachtest wird zuverlässiger, wenn die strukturierten Felder nach P0-B-Fix wieder konsistent gefüllt werden.

## Was nach Fix geprüft werden sollte

Wenn P0-A (Signal-Connectors) + P0-B (synthesis-only-Guard) eingebaut sind:

- **D5 EU-Frame-Härtetest auf EN**: Rutscht der LLM bei englischer Query in US-Perspektive ab? (Erwartet bei gutem EU-Signal-Anker: nein. Bei leerem Anker: ja, wahrscheinlich.)
- **D3 Signal-Relevanz-Delta zu DE**: Liefern EN-Arbeitsmarkt-Queries systematisch dichtere Signal-Pools als DE-Pendants? (Wenn ja: ein weiteres Argument für DE-Connector-Priorisierung.)
- **D1 Provenienz-Tag-Konsistenz**: Nutzt der LLM englische Trend-Namen (aus `<trends>`) oder übersetzt er sie in den Output? Inkonsistente Tags sind ein Prompt-Following-Problem.

---

## Briefing-Output

_Nicht ausgeführt — siehe Deferral-Begründung oben._

## Rubrik-Bewertung

**Deferred** — Re-Run nach P0-A + P0-B-Fixes.

## Konkrete Fix-Action-Items

Siehe [c-waermepumpen-de.md Fix-Liste](./c-waermepumpen-de.md#konkrete-fix-action-items) — übergreifend für alle deferred-Slots.
