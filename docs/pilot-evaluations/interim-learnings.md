# Pilot-Eval — Konsolidierte Erkenntnisse (Stand 2026-04-22 Abend)

Dieses Dokument aggregiert alle Erkenntnisse und Code-Änderungen aus den sechs
Pilot-Evaluationen (A/B/C × DE/EN). Es dient als Input für die Notion-
Priorisierung der nachfolgenden Fix-Arbeit.

**Tages-Kurzfassung:** 12 Commits, 5 Findings-Wellen, 3 gefixte P0-Bugs,
3 abgeschlossene P1-Bugs, 1 abgeschlossener P2, 6 neue strategische
RSS-Connectors in Produktion, 40+ neue Cross-Language-Aliase, 116+ neue
Test-Assertions — und eine publikationsreife A-DE-Bewertung (32/35).

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

## Fünf Wellen von Findings

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

### Welle 3 — nach B DE + C DE (früher Nachmittag)

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

### Welle 4 — P0-B-Fix + P1-Sprint (später Nachmittag)

Drei ungefixte P0/P1 der Welle 3 wurden im Nachmittags-Sprint abgearbeitet:

**P0-B gefixt** (Commit `13955e7`)
- Zero-Signal-Fallback-Guard in den System-Prompt eingebaut: bei leerem
  Signal-Pool MÜSSEN `scenarios`, `keyInsights`, `references`,
  `decisionFramework` trotzdem gefüllt werden, mit `[LLM-KNOWLEDGE]`-Tags
  als Anker. `scenarios: {}`-Escape-Hatch auf TRIVIALLY-FACTUAL-Fragen
  eingeschränkt.
- 18 Regression-Tests in `scripts/prompt-guard-test.ts`.
- **End-to-End-Verifikation**: C-DE-Query (0 Signale) liefert jetzt
  31 KB voll strukturiertes Briefing statt 3 KB synthesis-only.
  3 Szenarien (28/47/25), 6 authoritative References, 4 keyInsights,
  5 reasoningChains, 4 decisionFramework-Punkte.

**P1-Sprint Drei-in-Einem**
- **P1 Error-UX** (Commit `eb23bd3`) — Server-Error-Text wird jetzt
  durchgereicht statt vom Client-Fallback überschrieben. Neue
  `src/lib/error-mapping.ts` mit pure function mapAnthropicError() →
  {de, en}, differenziert Billing/Auth/Permission/RateLimit/Generic.
  39 Regression-Tests.
- **P1 Signal-Dedup** (Commit `4fb5d09`) — pure function
  `dedupSignalsBySourceTitle()` entfernt (source, normalized-title)-
  Duplikate nach Filter + vor Slice. Cross-Source-Coverage bleibt
  erhalten. Live-Wirkung A-DE: 16 matches/3 unique → 10 matches/10 unique.
  19 Regression-Tests.
- **P1 UI-Empty-State** (Commit `a26139c`) — KPI-Karten für Quellen +
  Szenarien werden immer gezeigt (mit muted subLabel bei 0 statt
  conditional-hide). Scenarios- und KeyInsights-Sections bekommen
  Empty-State-Card mit Heuristik `synthesis.length > 500` (strategische
  Fragen vs. trivial-factual), damit faktische Queries empty-state-frei
  bleiben.

**P2 Alias-Map Runde 1** (Commit `d888517`)
- CROSS_LANG_ALIASES um KI-Agent- und Arbeitsmarkt-Vokabular erweitert:
  agent/agenten, autonom(e/er/es), sprachmodell(e), generativ(e),
  assistent(en), arbeitsplatz/arbeitsplätze, fachkräfte(mangel),
  umschulung, weiterbildung, produktivität, wettbewerb. Plus `ki`
  erweitert um llm, large language model, machine learning, ml.
- **Live-Wirkung**: B-DE-Query fand vorher 0 arxiv-Papers aus 215 in
  der DB, nachher 6 arxiv-Papers (Machine Learning, AI, Computers &
  Society) + Spiegel-EuGH-Arbeitsbezug.

### Welle 5 — P0-A-Teilfix + Alias-Runde 2 (Abend)

Der P0-A-Connector-Sprint brachte das Produkt strukturell dichter an
sein Positionierungs-Versprechen.

**P0-A Runde 1** (Commit `b68fb33`) — 3 strategische EU/DACH-Connectors
- **Bruegel** (political/macro) — führendes EU-Economic-Policy-Research,
  Brüssel-basiert. Hinweis: der aktuelle Feed führt zeitweise Event-
  Agenda-Einträge („Lunch", „Coffee break"), die der Anchor-Match-Filter
  zuverlässig aussortiert.
- **POLITICO Europe** (political/signal) — EU-Tages-Newsfeed mit stünd-
  lichen Updates, füllt die Lücke zwischen Think-Tank-Quartalsrhythmus
  und echter Tagespolitik.
- **IAB** (social/macro) — Institut für Arbeitsmarkt- und Berufs-
  forschung, zentrales DACH-Arbeitsmarkt-Institut. Feed nach 2x 301-
  Redirects unter `https://iab.de/feed/` erreichbar.

**P0-A Runde 2** (Commit `93dd090`) — 3 weitere Connectors + Framework-Fix
- **ECIPE** (economic/macro) — European Centre for International
  Political Economy. Deckt EU-Handelspolitik, DMA/DSA, Industriepolitik,
  Wettbewerbsrecht, Tech-Handel ab.
- **OSW** (political/macro) — Centre for Eastern Studies (Warschau).
  Englischer Feed zu EU-Osteuropa, Russland/Ukraine, Sanktionen.
- **Clingendael** (political/signal) — Netherlands Institute of
  International Relations. Multi-sprachiger Medien-Appearance-Feed
  mit EU-Geopolitik-Diskurs-Breite.
- **Framework-Fix** in `src/connectors/rss-feed.ts`: `extractRssLink()`
  fällt bei leerem `<link>`-Tag jetzt auf `<guid>` und `<comments>`
  zurück. Generisches Upgrade — ECIPE ging dadurch von 1→30 individual-
  URL-Items, wird anderen Feeds in Zukunft auch helfen.

**P2 Alias-Map Runde 2** (Commit `8f57c92`)
- CROSS_LANG_ALIASES um 30+ EU-Policy-/Handels-Vokabular-Einträge
  erweitert: industriepolitik, handelspolitik, wettbewerbsfähigkeit,
  wettbewerbsrecht, autonomie, souveränität, abhängigkeit(en),
  sanktionen, zölle, binnenmarkt, dekarbonisierung, rohstoffe,
  halbleiter, kritisch(e/er/en), strategisch(e/er/es), plus
  EU-Institutionen (kommission, parlament, zentralbank, ezb) und
  geopolitische Akteure (ukraine, nato, verteidigungspolitik).
- **Live-Wirkung**: der ECIPE-Artikel „Nostalgia is a Broken Compass
  for Industrial Policy" ist für eine deutsche Industriepolitik-
  Query jetzt Treffer #1 (28% Relevanz).

**Signal-Pump nach allem** (Abend-Run)
- 49.7s Laufzeit, 1700 neue Signale, 105 aktive Sources, 0 Errors.
- Total-Count im 14-Tage-Fenster: 5443 (nach Dedup-Pass der Pipeline,
  die alte redundante Einträge bereinigt hat — zuvor 10 178).
- Alle heute eingebauten Connectors haben frischen Content: ECIPE 31,
  Politico 20, OSW/IAB/Clingendael je 12, Bruegel 10.
- Post-Pump-Retrieval-Wirkung: A-DE 10→16, B-DE 13→16, Industrie-
  politik 2→6 Treffer. C-DE (Wärmepumpen) bleibt bei 0 — braucht
  echte Heizungsindustrie-Connectors (BDH/BWP), die Alias-Erweiterung
  reicht hier nicht.

## Aggregierte Fix-Action-Liste nach Priorität (Stand Abend)

### ✅ Gefixt heute

| Prio | Fix | Commit |
|---|---|---|
| P0 | Reference-Verifikation via Title-Patterns | `4da3710` |
| P0 | Signal-Retrieval DE↔EN | `4da3710` |
| P0 | Language-Detection (Query-Sprache > UI-Locale) | `e575478` |
| P0-B | Zero-Signal-Fallback-Guard | `13955e7` |
| P1 | Error-UX: Server-Error durchreichen | `eb23bd3` |
| P1 | Signal-Deduplizierung auf Retrieval-Ebene | `4fb5d09` |
| P1 | UI-Empty-States + immer-sichtbare KPI-Karten | `a26139c` |
| P2 | Alias-Map DE-KI + Arbeitsmarkt | `d888517` |
| P0-A (teilweise) | 6 von 10 strategischen Connectors | `b68fb33`, `93dd090` |
| P0-A-Follow-Up | Alias-Map EU-Policy/Handel (Runde 2) | `8f57c92` |

### 🟡 Noch offen

**P0-A Rest (4 von 10 Connectors)**
- BDH (Bundesverband Deutsche Heizungsindustrie) — blockiert C-Pilot,
  RSS-Endpoint noch nicht gefunden
- BWP (Bundesverband Wärmepumpe) — dito
- Agora Energiewende — alle getesteten URLs 404, RSS vermutlich abgeschafft
- BMWK Presse — alle getesteten URLs 404
- Chatham House + Euractiv — Cloudflare-Bot-Protection, braucht
  alternative Zugriffs-Strategie (Google News, Archivdienste)
- Institut Jacques Delors — Content auf Französisch, braucht
  DE-FR-Alias-Erweiterung

Impact: C-DE/C-EN bleiben im Retrieval blockiert, bis BDH/BWP oder
äquivalente Heizungsindustrie-Quelle integriert ist.

**P2 offen**
- Folgefrage-Threading untersuchen (~2-3h, investigativ)
- Token-Budget-Review (~3-5h, größerer Task)

**Pipeline-Dedup (Fix B aus Signal-Dedup-Karte)**
- Content-Hash beim Insert + UNIQUE INDEX + Migration für bestehende
  Duplikate. Nachhaltiger als der Retrieval-Pass (Fix A, erledigt).
  ~2-3h.

## Bilanz der Pilot-Evaluation (Tagesabschluss)

**Ein voller Score (A DE 32/35), fünf deferrals**, ergänzt um einen
achtstündigen Sprint gegen die aufgedeckten Defekte:

- **4 P0-Bugs gefixt** (Refs, DE↔EN-Retrieval, Language-Detection,
  Zero-Signal-Fallback-Guard) + 1 P0 teilweise gefixt (6 von 10
  strategischen Connectors)
- **3 P1-Bugs gefixt** (Error-UX, Signal-Dedup, UI-Empty-States)
- **1 P2-Bug gefixt** (Alias-Map DE-KI + EU-Policy/Handel)
- **2 P2-Bugs bleiben offen** (Folgefrage-Threading, Token-Budget)

**12 Commits**, **116+ neue Test-Assertions** (prompt-guard 18,
error-mapping 39, signal-dedup 19, prompt-structure-Tests 40), null
Regression in bestehenden Test-Suites.

**Signal-Pool** nach Abend-Pump: 105 aktive Sources (darunter 6 neue
strategische EU/DACH-Feeds), 5 443 Signale im 14-Tage-Fenster nach
Dedup-Bereinigung. Retrieval-Qualität für die Pilot-Queries stieg
messbar: A-DE 10→16, B-DE 13→16, neue Testquery Industriepolitik 0→6.

**Der strukturelle Mismatch zwischen Produkt-Positionierung und
Signal-Pool ist damit nicht vollständig geschlossen** — C-DE
(Wärmepumpen) bleibt im Retrieval blockiert, bis BDH/BWP oder
äquivalente Heizungsindustrie-Quellen integriert sind. Aber der
generelle EU-Policy-/Handels-/Arbeitsmarkt-Fokus ist jetzt
signal-seitig belegbar.

## Nächste Schritte

1. **Re-Run-Batch der 5 deferred Pilot-Slots** (A EN, B DE+EN, C DE+EN)
   mit dem heutigen Stack (Guard + Dedup + UI-Empty-States + erweitere
   Alias-Map + breiterer Signal-Pool). Erwartung: A EN und B DE in
   publikationsreifem Bereich (30+/35), B EN + C DE/EN abhängig von
   verbliebenen Signal-Pool-Lücken.
2. **BDH/BWP oder Heizungsindustrie-Fachpresse** integrieren, um
   C-Pilot zu entsperren. Wenn kein RSS verfügbar, GDELT-Feld-Filter
   oder Google News aggregieren.
3. **P2 Folgefrage-Threading** als nächster kleinerer investigativer
   Task vor dem nächsten Sprint.
4. **Pipeline-Dedup** (Fix B aus der Dedup-Karte) in der nächsten
   Infrastruktur-Iteration — heute ist Fix A auf Retrieval-Ebene drin,
   aber die DB selbst sollte über content-hash + UNIQUE INDEX keine
   Duplikate mehr zulassen.
5. **interim-learnings.md in Notion als Projekt-Page spiegeln**
   (nicht nur im Repo) — für Stakeholder-Gespräche und cross-session
   Kontinuität.
