# Pilot-Evaluation — a-lieferketten-en

**Thema:** Which EU countries will be most affected by the fragmentation of global supply chains by 2030 — and what strategic options does Germany have as Europe's industrial backbone?
**Datum:** 2026-04-22
**Version-ID:** _(not set)_
**Status:** Teilbewertung — Bug aufgedeckt und gefixt, volle Re-Run-Bewertung deferred.

Rubrik: [rubric.md](./rubric.md) — 7 Dimensionen · 1–5 Score · Gesamtmax 35.

---

## 🟠 Was dieser Run aufgedeckt hat (Commit `e575478`)

Der erste A-EN-Run lieferte eine **komplett deutsche Antwort** auf die
englische Query. Grund: `buildSystemPrompt()` nutzte den UI-Locale-
Switch (DE) statt der tatsächlichen Query-Sprache.

Fix eingebaut: `detectQueryLanguage()` — reine Stopword-Zählung +
Umlaut-Check. `buildSystemPrompt()` akzeptiert jetzt optional den
Query-Text und nutzt die detektierte Sprache für den Response-Hint.
Die UI-Locale-Einstellung ist nur noch Fallback.

Getriggerter Bug-Fix:
- [Commit `e575478`](../../) — `fix(llm): Query-Sprache dominiert den Output, nicht UI-Locale`
- Test: `scripts/language-detection-test.ts` (15 Tests, deckt alle 6 Pilot-Queries + Edge-Cases ab)
- Effekt: Mehrsprachiges Arbeiten im selben Workspace stabil — User kann DE-UI nutzen und EN-Frage stellen, Antwort kommt EN; und umgekehrt.

## Auswirkung für Score-Lesung

Die vollständige Rubrik-Bewertung dieses spezifischen Runs wurde
**deferred** — der Run bestätigte nur den UI-Locale-Leak, lieferte
aber keine inhaltliche Info, die nicht auch A DE schon zeigte (die
Analyse war ja eine deutsche Version von A DE, in Qualität ähnlich).

Bei Re-Run nach Fix wäre zu erwarten:
- D1–D7 analog zu A DE (32/35 nach Fixes)
- Zusätzlich D5 EU-Frame-Härtetest auf EN: Rutscht der LLM bei
  englischer Query in US-Perspektive ab, auch mit dem EU-Referenz-
  Frame-Prompt? (Wenn ja: Prompt-Verschärfung nötig.)

Die B- und C-Runs werden die Mehrsprachigkeit parallel mitprüfen
(B EN nach B DE, C EN nach C DE) — das deckt den Re-Test implizit
ab, ohne den A-EN-Slot extra nachzufahren.

---

## Briefing-Output

_(Briefing hier einfügen oder mit `--version-id=<id>` vorbefüllen lassen)_

---

## Rubrik-Bewertung

### 1. Claim-Provenienz

Jede faktische Aussage mit `[SIGNAL/TREND/REG/EDGE/LLM-KNOWLEDGE]` getaggt?

- **Score:** `_ / 5`
- **Notes:** 

### 2. Source-Qualität

Sind References real, verifiziert und relevant? URLs funktionieren? Keine LLM-Fabrikate?

- **Score:** `_ / 5`
- **Notes:** 

### 3. Signal-Relevanz

Passen die gezeigten Live-Signale topisch zur Frage?

- **Score:** `_ / 5`
- **Notes:** 

### 4. Szenarien-Disziplin

3 Szenarien kausal distinkt? Falsifizierbare Annahmen? Probabilities nicht-default?

- **Score:** `_ / 5`
- **Notes:** 

### 5. EU-Frame

Ist der europäische Blickwinkel explizit und spezifisch?

- **Score:** `_ / 5`
- **Notes:** 

### 6. Action-Readiness

Sind Empfehlungen mit Akteur, Hebel, Zeitfenster, Erfolgskriterium versehen?

- **Score:** `_ / 5`
- **Notes:** 

### 7. Ehrlichkeit-über-Lücken

Benennt das Briefing Coverage-Gaps und dominanten Source-Type ehrlich?

- **Score:** `_ / 5`
- **Notes:** 

---

## Gesamt-Score

- **Summe:** `_ / 35`
- **Band:** _(publishable ≥32 · intern 26–31 · schwach 20–25 · stop <20)_

## Konkrete Fix-Action-Items

Pro schwachem Dimension-Score (< 4) hier einen Action-Item notieren:

1. _…_
2. _…_
3. _…_

## Notizen / Überraschungen

- _Was war unerwartet gut?_
- _Was war unerwartet schwach?_
- _Welche Signale hat das System übersehen, die du intuitiv erwartet hättest?_
