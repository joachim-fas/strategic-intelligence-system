# Pilot-Eval — Zwischenstand nach Thema A DE

Dieses Dokument aggregiert Erkenntnisse und Code-Änderungen, die durch
die Pilot-Evaluationen bereits ausgelöst wurden. Es wächst, während
wir die restlichen fünf Runs durchgehen (A EN · B DE+EN · C DE+EN).
Ziel: am Ende ein klarer Priorisierungs-Plan für die verbleibenden
Fixes, plus eine ehrliche Baseline, wie nah SIS am Produktionsstand ist.

## Stand 2026-04-22 · nach Thema A DE

### Was funktioniert

- **Signal-Kettenbezug-Filter hält stand.** Wintersport-Query (der
  ursprüngliche Bug-Fall) liefert weiterhin 0 topisch relevante
  Signale, obwohl die Alias-Expansion jetzt 24 Keywords erlaubt.
  Der neu eingeführte Top-3-Strict-Anchor fängt Alias-Drift ab.
- **EU-Frame** war bei einer DE-Strategie-Query perfekt
  ausgeprägt: Visegrád einzeln, Baltikum, TSMC Dresden, KfW-Garantien.
  Keine US-Lens.
- **Action-Readiness** erreichte Vorstands-Qualität — alle vier
  Dimensionen (Akteur/Hebel/Zeit/Kriterium) abgedeckt.
- **Ehrlichkeits-Kalibrierung** pre-fix: Konfidenz 6% bei 0 Signalen,
  konsistent mit `dominantSourceType = "llm-knowledge"`. Kein
  Narrativ↔UI-Widerspruch.

### Was wir nebenher gefixt haben (Commit `4da3710`)

**P0-1: Reference-Verifikation**
- Alle 5 Pilot-A-Refs (IMF WEO, EU CRMA, BDI-Studie, EC Strategic
  Autonomy, JRC Megatrends) sind real und seriös, wurden aber als
  `?`-unverified angezeigt. Grund: der System-Prompt verbietet
  explizit URL-Erfindung („NEVER invent URLs"), also kommen Refs
  routinemäßig title-only. Der Verifier prüfte aber nur URLs.
- Fix: TRUSTED_TITLE_PATTERNS — 40+ Regex für authoritative
  Publikationsfamilien (EU-Institutionen, International Orgs, DACH
  Research, Think-Tanks, Consultancies-Research, Tech/Industry).
  Title-Match triggert `verified: true` wenn URL fehlt.
- Allowlist zusätzlich um 16+ Domains erweitert (bdi.eu, diw.de,
  ifo.de, knowledge4policy.ec.europa.eu, eur-lex.europa.eu, …).
- Test: `scripts/reference-verification-test.ts` — 18 Tests.

**P0-2: Signal-Retrieval DE↔EN**
- 10.098 Signale in der DB, aber DE-Strategie-Query fand 0 davon:
  News-Connectors sind überwiegend englisch (Guardian, NYT, Al
  Jazeera), Key-Terms wie „lieferketten", „fragmentierung"
  matchen nicht in EN-Content.
- Fix: CROSS_LANG_ALIASES erweitert um Strategie-Vokabular plus
  EU-Länder-Paare. Keyword-Cap 14→24. `computeKeywordStats`
  akzeptiert Alias-Varianten pro Base-Keyword ohne Nenner-
  Verwässerung. Top-3-Strict-Anchor ersetzt „irgendein ≥5-Zeichen"
  (verhindert Alias-Drift). Source-Branding-Präfix wird gestrippt
  bevor overlap gerechnet wird. Tier-Schwellen an breiteren
  Keyword-Satz angepasst.
- Debug-Tool: `scripts/signal-retrieval-debug.ts` — zeigt für eine
  Query direkt SQL-Treffer + Filter-Entscheidungen mit Begründung.

### Was offen bleibt (P1/P2)

| Prio | Dim | Finding | Fix-Richtung |
|---|---|---|---|
| P1 | D1 | Länderaufzählungen / numerische Claims / Nebenaussagen rutschen ungetaggt durch | System-Prompt-Schärfung („jede Zahl, jede Länder-Nennung muss getaggt sein") + Validator-Check |
| P1 | D1 | EDGE-Tag-Format unsauber: LLM nutzt `[EDGE: slug]`, erwartet ist `[EDGE: TrendA → TrendB]` | Prompt-Beispiel verschärfen + Validator-Warning |
| P2 | D4 | keyAssumptions + earlyIndicators verstecken sich hinter Expand-Klick, werden nicht prominent gezeigt | ScenarioSelector.tsx erweitern — Assumption-Bullets direkt in der Karte |
| P2 | D1 | Numerische Claims mit nur `[LLM-KNOWLEDGE]` sollten milder highlighted werden | Validator erkennt „Zahl + nur LLM-KNOWLEDGE" → Soft-Warning |
| P2 | D3 | Intel-Magdeburg-Outdatedness (LLM zitiert Trainings-Cutoff) | Nur durch besseren Signal-Retrieval lösbar — inkrementell |

## Fortschritt pro Thema

- [x] **A DE** — 32/35 nach Post-Fix (Score-Delta +2 durch D2-Fix)
- [ ] **A EN** — Locale-Drift-Check, als Nächstes
- [ ] **B DE** — KI-Arbeitsmarkt
- [ ] **B EN**
- [ ] **C DE** — Wärmepumpen
- [ ] **C EN**

## Zwischenbilanz

**Was wir aus einem einzigen Eval gelernt haben:** zwei konkrete P0-Bugs
gefunden, gefixt, durch 18 neue Regression-Tests abgesichert. A DE sprang
von 30/35 auf 32/35 (publikationsreif). Das ist das beste mögliche
Ergebnis aus einer qualitativen Pilot-Eval — nicht nur Benotung, sondern
konkrete, eingebaute Fixes.

**Projiziert:** die verbleibenden 5 Runs werden wahrscheinlich weitere
spezifische Findings produzieren (Locale-Drift bei EN, Signal-Pool bei
Wärmepumpen-Terminologie, Szenarien-Disziplin bei KI-Thema). Jede
davon eine kleine Iteration.
