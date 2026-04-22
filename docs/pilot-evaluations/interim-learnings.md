# Pilot-Eval — Konsolidierte Erkenntnisse (Stand 2026-04-22 Nachmittag)

Dieses Dokument aggregiert alle Erkenntnisse und Code-Änderungen aus den sechs
Pilot-Evaluationen (A/B/C × DE/EN). Es dient als Input für die Notion-
Priorisierung der nachfolgenden Fix-Arbeit.

## Kurz-Status der sechs Slots

| Slot | Thema | Status | Score | Deferral-Grund |
|---|---|---|---|---|
| A DE | Lieferketten | ✅ voll bewertet (post-fix) | **32/35** (publishable) | — |
| A EN | Lieferketten (EN) | 🟠 deferred | — | Language-Detection-Bug aufgedeckt + gefixt (Commit `e575478`) |
| B DE | KI-Arbeitsmarkt | 🔴 deferred | — | synthesis-only-Collapse (P0-B) bei 2 schwachen Signalen |
| B EN | KI-Arbeitsmarkt (EN) | 🔴 deferred | — | gleiche Root-Cause wie B DE, nicht ausgeführt |
| C DE | Wärmepumpen | 🔴 deferred | — | 0 Signale (P0-A) + synthesis-only-Collapse (P0-B) |
| C EN | Wärmepumpen (EN) | 🔴 deferred | — | gleiche Root-Cause wie C DE, nicht ausgeführt |

**Erklärungsstatus:** Ein voller Score (32/35, publishable), fünf deferrals
mit klar benannter strukturierter Ursache. Pilot-Eval-Ziel „Defekte finden"
ist maximal erfüllt — **drei P0-Defekte + drei P1-Defekte** aufgedeckt, davon
zwei schon gefixt.

## Drei Wellen von Findings

### Welle 1 — nach A DE (Vormittag)

Zwei P0-Bugs, beide gefixt:

**P0-1: Reference-Verifikation** (Commit `4da3710`)
- Alle A-DE-References (IMF WEO, EU CRMA, BDI-Studie, EC Strategic
  Autonomy, JRC Megatrends) waren real und seriös, aber als `?`-unverified
  markiert. Grund: der System-Prompt verbietet URL-Erfindung — Refs kommen
  routinemäßig title-only. Der Verifier prüfte nur URLs.
- Fix: `TRUSTED_TITLE_PATTERNS` (40+ Regex für authoritative Publikations-
  familien), Allowlist um 16 Domains erweitert.
- 18 Regression-Tests in `scripts/reference-verification-test.ts`.
- Score-Delta: D2 Source-Qualität sprang von 3/5 auf 5/5 → A DE 30→32.

**P0-2: Signal-Retrieval DE↔EN** (Commit `4da3710`)
- 10 098 Signale in DB, DE-Strategie-Query fand 0. News-Connectors sind
  überwiegend englisch, Key-Terms wie „lieferketten", „fragmentierung"
  matchen nicht in EN-Content.
- Fix: `CROSS_LANG_ALIASES` erweitert, Keyword-Cap 14→24, Top-3-Strict-
  Anchor statt „irgendein ≥5-Zeichen", Source-Branding-Präfix-Strip vor
  Overlap, Tier-Schwellen angepasst.
- Debug-Tool `scripts/signal-retrieval-debug.ts` neu.

### Welle 2 — nach A EN (Mittag)

Ein P0-Bug, gefixt:

**P0-3: UI-Locale-Switch überschreibt Query-Sprache** (Commit `e575478`)
- EN-Query bei DE-UI-Locale kam als DE-Briefing zurück. Mehrsprachigkeit
  im selben Workspace kaputt.
- Fix: `detectQueryLanguage()` via Stopword-Zählung + Umlaut-Check.
  `buildSystemPrompt()` akzeptiert optional Query-Text, dessen detektierte
  Sprache den UI-Locale-Parameter überschreibt.
- 15 Regression-Tests in `scripts/language-detection-test.ts`.

### Welle 3 — nach B DE + C DE (Nachmittag) — NEU, ungefixt

Zwei schwerwiegende P0-Defekte plus zwei P1-Defekte:

**P0-A: Signal-Pool-Drought für strategische DACH/EU-Queries**

Die Pipeline-Connectors liefern kein strategisches DACH/EU-Material:

```
Top 12 Sources (14-Tage-Fenster, 10 098 Signale gesamt):
  polymarket       1354   Prediction Markets
  unhcr             670   Flüchtlingsdaten
  usgs-earthquake   600   Erdbeben
  news              571   generisch
  github            402   Code-Repos
  reddit            391   social
  hackernews        309   tech
  clinicaltrials    288   Medizinstudien
  coingecko         283   Crypto
  manifold          282   Prediction Markets
  nextstrain        245   Virus-Phylogenetik
  arxiv             215   Academic
```

Das Produkt positioniert sich als „EU-Strategic-Intelligence". Die DB ist
ein Mix aus Prediction-Markets und Naturkatastrophen-Feeds.

Konsequenz: Für strategische DACH/EU-Queries findet `getRelevantSignals()`
routinemäßig 0-2 Unique-Sources, meist bei Topic-Relevanzen von 20-25%.
Für C DE (Wärmepumpen) exakt **0 Signale** — kein einziges Connector deckt
die Heizungs-Industrie ab.

**Root-Cause:** Fehlende Connectors für das angestrebte Use-Case-Feld.
Keine BDH, BWP, Bruegel, DIW, ifo, Agora Energiewende, EU-Lex, Handelsblatt,
BMWK, Politico Europe, Eurofound, IAB, ETUC.

**Fix-Ansatz:**
- 10 neue strategische Connectors in die Pipeline aufnehmen
- Jeder ≈ 1-3h Arbeit (RSS-Parse + `source-metadata.ts`-Eintrag +
  STEEP+V-Klassifikation)
- Priorisierte Reihenfolge nach den Pilot-Themen:
  - Energie/Bau: Agora Energiewende, BDH, BWP, BMWK
  - EU-Policy: Bruegel, EU-Lex, Politico Europe, EC Press
  - Wirtschaft: DIW, ifo, Handelsblatt Morning Briefing
  - Arbeitsmarkt: IAB, Eurofound, ETUC, OECD Employment Outlook

**P0-B: LLM-synthesis-only-Collapse bei leerem Signal-Pool**

**Beweis-Tabelle (project_queries.result_json):**

| Run | Thema | synthesis | scenarios | references | signals | JSON-Gesamt |
|---|---|---|---|---|---|---|
| A EN | Lieferketten | 2 524 | 3 | 5 | 17 | 26 026 B |
| B DE | KI-Arbeitsmarkt | 3 147 | 0 | 0 | 0 | 3 356 B |
| C DE | Wärmepumpen | 2 774 | 0 | 0 | 0 | 2 983 B |

Bei leerem/dünnem Signal-Pool liefert der LLM nur das narrative `synthesis`-
Feld (mit Markdown-Überschriften als verkappter Strukturierung) und lässt
alle flachen JSON-Felder leer. Die Pipeline persistiert das, der UI-Render-
Code versteckt dann die Sections conditional — das Briefing wirkt
„halbfertig" statt „ehrlich leer".

**Prompt-Entscheidung, die das auslöst:** Das Schema erlaubt in `synthesis`
Markdown-Überschriften (`## Titel`). Der LLM interpretiert das bei fehlenden
Signal-Ankern als „Erlaubnis, die gesamte Analyse als Prosa zu liefern".

**Fix-Ansatz:** System-Prompt erweitern um expliziten Guard:

> Auch bei ≤5 Signalen MÜSSEN `scenarios`, `keyInsights`, `references`,
> `decisionFramework` gefüllt sein. Verwende `[LLM-KNOWLEDGE]`-Tags, wo
> Signale fehlen — niemals das Feld leer lassen. Leere strukturierte
> Felder sind ein Bug.

Alternativ / zusätzlich: wenn `signalsMeta.count === 0`, inject der Route
einen expliziten `<cold_signals>true</cold_signals>`-Hinweis in den Prompt
mit Pflicht zur strukturierten Antwort aus LLM-Knowledge.

**P1: UI zeigt kein Empty-State**

Wenn strukturierte Felder leer zurückkommen, blendet `BriefingResult.tsx`
die entsprechenden Sections komplett aus (Zeilen 533, 576, 588, 606 etc.).
Der User sieht deshalb ein Briefing ohne Szenarien/Referenzen und weiß
nicht, ob die Pipeline keine erzeugen konnte oder ob sie sie erzeugt hat
und die UI sie versteckt.

**Fix-Ansatz:** Empty-State-Karte pro fehlender Section mit klarem Hinweis:

> „Keine [Szenarien/Quellen/Signale] für diese Query. Erwäge einen
> breiteren Signal-Pool oder eine andere Query-Formulierung."

**P1: Server-Error-Text wird nicht zum Client durchgereicht**

Während der Credit-Balance-Phase schickte der Server via SSE:
`{type: "error", error: "Unable to process your request."}`.

Das Frontend überschreibt das mit dem generischen Empty-Stream-Fallback:
`„Die KI-Analyse hat keine verwertbare Antwort geliefert. Möglicherweise
ist die Anfrage zu kurz oder das System überlastet."`

Das ist irreführend — der User wird in die falsche Richtung geschickt
(Query-Länge, Timeouts), während die eigentliche Ursache Billing oder
Authentication ist.

**Fix-Stellen:**
- `HomeClient.tsx:1299` — Server-Error-Text bevorzugt anzeigen, wenn SSE
  ein Error-Event geliefert hat.
- `route.ts:495-501` — HTTP 400 differenzierter mappen. Aktuell fallen alle
  non-429/non-5xx-Fehler in den generischen „Unable to process"-Zweig.

**P2: Folgefrage-Threading-Leak**

Der erste C-DE-Versuch zeigte im UI-Header „↳ FOLGEFRAGE ZU" mit einer
B-Session-Query. Ein neuer Workspace wurde erwartet, tatsächlich wurde an
den vorherigen Thread angekettet. Untersuchung pending — mögliche Ursache:
Workspace-State-Leak im Client nach Canvas-Switch.

## Aggregierte Fix-Action-Liste nach Priorität

### P0 (Produkt-blockierend, für publishable Output nötig)

1. **Signal-Pool-Pipeline um 10 strategische DACH/EU-Connectors erweitern**
   - ~15-30h Arbeit gesamt (je Connector 1-3h)
   - Blockiert: alle deferred Pilot-Slots (B DE, B EN, C DE, C EN)
   - Teilfix möglich: 3-5 Connectors (Bruegel, DIW, ifo, Agora, Politico)
     würden A-B-Szenarien signifikant verbessern

2. **Prompt-Guard gegen synthesis-only-Collapse**
   - ~2h Arbeit (Prompt-Edit + 2-3 Regression-Test-Queries die mit wenig
     Signalen laufen, Output muss strukturiert sein)
   - Blockiert: Re-Run-Wert der deferred Slots

### P1 (UX-Regression, nach P0 fixbar)

3. **UI-Empty-States** für fehlende scenarios/references/signals/
   keyInsights/decisionFramework — je 1 `VoltEmptyStateCard`-Render
   statt conditional-hide. ~2-3h.

4. **Server-Error-Text durchreichen** statt generic Fallback.
   `HomeClient.tsx:1299` + `route.ts:495-501`. ~1h.

5. **Signal-Deduplizierung** auf Retrieval-Ebene — 16 matches für A DE
   waren effektiv 1-2 unique titles. Add `DISTINCT` oder Dedup-Pass
   basierend auf title-hash. ~2h.

### P2 (Nice-to-have, niedrige Dringlichkeit)

6. **Folgefrage-Threading** untersuchen — warum C-Query an B-Thread
   angekettet wurde. ~2-3h für Diagnose + Fix.

7. **Alias-Map-Erweiterung für DE-KI-Terminologie** — „ki-agenten" soll
   zu „autonomous agents", „llm agents", „agentic ai" aliasen.
   In `src/lib/signals.ts` CROSS_LANG_ALIASES. ~30min.

8. **Token-Budget-Review**: C-DE-Run war 201 Sekunden für 3 KB Output.
   Die Pipeline stopft viel Budget in nicht-persistierte Zwischenschritte
   (Contradiction-Check, Assumption-Extraktion), bevor das dünne Ergebnis
   gespeichert wird. Budget-Splitting auditieren. ~3-5h.

## Bilanz der Pilot-Evaluation

**Ein einziger erfolgreicher Run (A DE 32/35) und fünf deferrals** ergaben
in Summe:

- **3 P0-Bugs gefixt** (Refs, Retrieval DE↔EN, Language-Detection) —
  33 neue Regression-Tests, Code in Produktion
- **2 P0-Bugs ungefixt identifiziert** (Signal-Pool-Drought,
  synthesis-only-Collapse) — beide produkt-blockierend
- **3 P1-Bugs identifiziert** (UI-Empty-State, Error-UX, Dedup)
- **2 P2-Bugs identifiziert** (Folgefrage-Threading, Token-Budget)

Das ist **genau, was eine Pilot-Eval liefern soll**: nicht Noten sammeln,
sondern strukturierte Defekte aufdecken, bevor echte Nutzer sie finden.
Die Tatsache, dass fünf von sechs Slots deferred sind, ist **nicht** ein
Evaluations-Versagen — es ist der harte, ehrliche Spiegel, dass das System
für seine eigene Positionierung („EU-Strategic-Intelligence") einen
fundamentalen Infrastruktur-Gap hat: der Signal-Pool matcht den Use-Case
nicht, und die LLM-Pipeline reagiert auf diesen Gap mit struktureller
Kapitulation statt expliziter Kommunikation.

## Nächste Schritte

1. Dieses Dokument als Notion-Backlog-Aggregat veröffentlichen
2. P0-A + P0-B als Sprint-Kandidaten für den kommenden Sprint setzen
3. Nach P0-Fixes: die fünf deferred Slots in einem gemeinsamen Re-Run-
   Batch nachholen — wenn alle strukturell ähnlich scoren, wissen wir,
   dass die Fixes greifen. Wenn individuelle Slots weiterhin schwach
   sind, zeigt das die query-spezifischen Reste.
4. Die Pilot-Eval-Infrastruktur (`pilot:eval`, `signal-retrieval-debug`,
   Rubrik-Files) für die kommenden Themen wiederverwenden — sie hat sich
   als leistungsfähiges Debug-Werkzeug bewährt.
