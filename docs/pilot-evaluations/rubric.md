# SIS Pilot-Evaluation — Rubrik

Backlog-Task (🔴 Hoch-Prio, 2026-04): *"3 Pilot-Themen End-to-End
durcharbeiten und bewerten — sind Quellen korrekt? Szenarien realistisch?
EU-Fokus vorhanden? Wo ist die Analyse schwach?"*

Diese Rubrik ist das Bewertungsinstrument. Für jedes Pilot-Thema wird
ein Briefing erzeugt (via `scripts/pilot-eval-run.ts`) und gegen die
sieben Dimensionen unten bewertet. Pro Dimension wird ein Score
1–5 vergeben **plus** eine freie Bemerkung (was war gut, was schwach).
Am Ende ergibt sich ein Gesamt-Score und eine Liste konkreter Fix-
Action-Items für die Pipeline, Prompt-Layer, Connector-Pool oder UI.

---

## Die sieben Dimensionen

### 1. Claim-Provenienz

Ist jede faktische Aussage im Synthese-Text mit einem Provenienz-Tag
belegt (`[SIGNAL: …]`, `[TREND: …]`, `[REG: …]`, `[EDGE: …]` oder
`[LLM-KNOWLEDGE]`)?

| Score | Kriterium |
|---|---|
| **5** | Jede einzelne Behauptung ist getaggt; keine ungesourcte Zeile. Besonders LLM-KNOWLEDGE ist transparent markiert. |
| **4** | ≥90% getaggt, maximal 1–2 ungetaggte Nebensätze. |
| **3** | Hauptbehauptungen getaggt, aber Nebenaussagen hängen untagged drin. |
| **2** | Tags auftauchen vereinzelt, aber systematische Lücken. |
| **1** | Fließtext ohne Tags — LLM-Output im Freihandlauf. |

**Was zu prüfen:** Kopiere die Synthesis in einen Editor, zähle Sätze und Tags. Ideal ≥1 Tag pro Satz.

---

### 2. Source-Qualität

Sind die in `references[]` gelisteten Quellen real, zugänglich und
inhaltlich relevant — oder hat der LLM URLs/Titel fabriziert?

| Score | Kriterium |
|---|---|
| **5** | Alle Refs sind verifizierte Autoritäts-Quellen (`verified: true` mit ✓-Indikator), URLs funktionieren, Titel passen zum Inhalt. |
| **4** | ≥80% verifiziert, Rest plausibel unverifiziert (kleine oder niche-domains). |
| **3** | Mix aus verifiziert/unverifiziert; 1–2 Refs fragwürdig aber keine Halluzinationen. |
| **2** | Mehrere unverifizierte oder generische URLs (Wikipedia-Links statt Primärquelle). |
| **1** | Fabricated URLs, erfundene Studien, dead links. |

**Was zu prüfen:** Klicke jeden Ref-Link im Briefing an. Prüfe das ✓/?-Badge. Google ggf. den Titel.

---

### 3. Signal-Relevanz

Passen die gezeigten Live-Signale topisch zur Frage? (Der post-2026-04-21
Relevanz-Filter sollte Off-Topic-Signale bereits rausfiltern.)

| Score | Kriterium |
|---|---|
| **5** | Alle gezeigten Signale sind spezifisch zum Thema. Keine Bluesky-Babysitter-Posts, keine Fertilitäts-UN-News bei einer Wien-Bezirk-Frage. |
| **4** | 1 Signal ist tangential, der Rest trifft. |
| **3** | ~70% passen, ein paar randständige. |
| **2** | Überwiegend tangential/noise. |
| **1** | Signale absurd off-topic (das ist der alte Bug-Zustand). |

**Was zu prüfen:** „Live-Signale"-Sektion im Briefing öffnen, jedes Signal bewerten. Der angezeigte Topic-Score (LLM/Keyword-Badge) sollte mit dem eigenen Gefühl übereinstimmen.

---

### 4. Szenarien-Disziplin

Sind die 3 primären Szenarien kausal distinkt, haben falsifizierbare
Annahmen und unterschiedliche Probabilities (nicht 33/33/33)?

| Score | Kriterium |
|---|---|
| **5** | Jedes Szenario fährt einen anderen kausalen Mechanismus. Probabilities sind aus der Analyse abgeleitet (nicht 30/40/30-Default). Jedes hat 2–3 falsifizierbare Assumptions. |
| **4** | Scenarios distinkt, Probs ok, Assumptions spezifisch. |
| **3** | Scenarios unterscheiden sich, aber Mechanismus nicht ganz scharf. Probs plausibel aber generisch. |
| **2** | Szenarios sind „mehr / weniger / gleich viel vom Gleichen" statt strukturell anders. |
| **1** | Alle drei Szenarios klingen identisch mit anderem Adjektiv. Probs = Default. |

**Was zu prüfen:** Jedes Szenario lesen. Frage: „Was muss real anders sein, damit DIESES statt JENEM eintritt?" Wenn du das nicht klar beantworten kannst, ist die Disziplin schwach.

---

### 5. EU-Frame

Ist eine europäische Perspektive explizit und spezifisch — oder wurde
die Frage generisch / global / US-zentriert beantwortet?

| Score | Kriterium |
|---|---|
| **5** | EU-spezifische Regulierung, Akteure, Unterschiede zu US/Asien sind namentlich adressiert. Deutschland/Österreich/DACH als eigene Ebene sichtbar. |
| **4** | EU ist präsent, aber Tiefe fehlt an 1–2 Stellen. |
| **3** | EU wird erwähnt, bleibt aber auf Oberflächen-Niveau. |
| **2** | „EU" nur als Einzelwort, faktisch US-Perspektive. |
| **1** | Kein EU-Bezug; komplett US-zentrische Analyse. |

**Was zu prüfen:** Suche im Briefing nach „EU", „Europa", „Germany", „Austria". Zähle erwähnte europäische Institutionen, Regulierungen, Firmen.

---

### 6. Action-Readiness

Sind die Empfehlungen in `decisionFramework` + `interpretation`
konkret und umsetzbar — oder Platitüden?

| Score | Kriterium |
|---|---|
| **5** | Jede Empfehlung hat (a) Akteur, (b) Hebel, (c) Zeitfenster, (d) Erfolgskriterium. „CTO X sollte bis Q3 2026 …" |
| **4** | Konkret mit 1–2 fehlenden Dimensionen. |
| **3** | Richtige Themen, aber allgemein („Beobachten", „Strategisch positionieren"). |
| **2** | Generische Platitüden („agil bleiben", „Chancen nutzen"). |
| **1** | Leer oder banal. |

**Was zu prüfen:** Lies nur den Entscheidungshilfe-Block. Wären diese Punkte in einem Vorstands-Slidedeck verwendbar?

---

### 7. Ehrlichkeit-über-Lücken

Admit das Briefing, wo Daten dünn sind, oder tut es so als hätte es
überall volle Abdeckung?

| Score | Kriterium |
|---|---|
| **5** | `dataQuality.coverageGaps` benennt konkrete Lücken. `dominantSourceType` ist ehrlich. Wenn keine Live-Signale verfügbar, sagt's das im Text explizit. |
| **4** | Gaps benannt, aber 1 versteckter Lücken-Bereich. |
| **3** | Datenqualität-Badge zeigt was, aber der Text tut „volle Abdeckung". |
| **2** | Text wirkt selbstbewusst, obwohl `signalCount=0`. |
| **1** | Selbstbewusst-wirkendes Fabrizieren ohne Lückenhinweis. |

**Was zu prüfen:** `dataQuality`-Sektion öffnen + Synthesis-Text abgleichen. Passt die Tonlage zur realen Datenlage?

---

## Gesamtscore

- **≥ 32 / 35** — publishable; kleine Anpassungen
- **26–31** — nutzbar intern, öffentlich noch zu grün
- **20–25** — strukturelle Schwächen; welche Dimension ist der Flaschenhals?
- **< 20** — stopp, bevor einer das zitiert

---

## Was aus schwachen Scores passiert

| Schwachstelle | Fix-Pfad |
|---|---|
| D1 Provenienz | System-Prompt verschärfen, Validator-Warning anzeigen |
| D2 Source-Qualität | `validation.ts` Reference-Allowlist erweitern, URL-Check strenger |
| D3 Signal-Relevanz | `signals.ts` per-Tier-Schwellen tunen, Trend-Enrichment-Pass zügeln |
| D4 Szenario-Disziplin | Prompt „Scenario Divergence"-Self-Check verschärfen |
| D5 EU-Frame | Prompt-Preamble um expliziten EU-Fokus erweitern |
| D6 Action-Readiness | `decisionFramework`-Schema auf Akteur/Hebel/Zeit/Kriterium strukturieren |
| D7 Ehrlichkeit | `dataQuality.coverageGaps` Pflicht-Feld; UI prominenter darstellen |

---

*Diese Rubrik wird pro Pilot-Thema einmal ausgefüllt. Template:
`docs/pilot-evaluations/<slug>.md` (wird vom Eval-Runner automatisch
angelegt).*
