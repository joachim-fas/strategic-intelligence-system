# Pilot-Evaluation — c-waermepumpen-de

**Thema:** Welche regulatorischen und wirtschaftlichen Kräfte prägen die Zukunft der Wärmepumpen-Industrie im DACH-Raum bis 2030? Wo liegen die Tipping-Points für Marktdurchdringung — welche Rolle spielt das Gebäudeenergiegesetz (GEG), die EU-Gebäuderichtlinie (EPBD), und die Asia-vs-EU-Lieferkette?
**Datum:** 2026-04-22
**Version-ID:** project_queries.id=`38f0e291-260e-421e-86c3-7da82ebabffa`
**Status:** Teilbewertung — zwei P0-Bugs aufgedeckt, Rubrik-Scoring deferred.

Rubrik: [rubric.md](./rubric.md) — 7 Dimensionen · 1–5 Score · Gesamtmax 35.

---

## 🔴 Was dieser Run aufgedeckt hat

Der C-DE-Run sollte die Komplexitäts-Grenzen des Systems testen (Regulatorik × Supply-Chain × DACH × Markt-Tipping-Points). Er deckte stattdessen zwei **strukturelle P0-Defekte** auf, die das Scoring dieses Runs entwerten — aber weit wichtigere Produkt-Findings sind als eine Rubrik-Note.

### P0-A: Signal-Pool-Drought für strategische DACH/EU-Queries

**Befund aus `signal-retrieval-debug.ts`:**

| Query | getRelevantSignals | Unique Sources | Top-Relevanz |
|---|---|---|---|
| A DE „Lieferketten" | 16 | 1 (ecfr_rss, dupliziert) | 25% |
| B DE „Arbeitsmarkt KI" | 16 | 2 (ecfr_rss + un_sdg, dupliziert) | 22-24% |
| **C DE „Wärmepumpen"** | **0** | **—** | **—** |

Der DB-Pool (10 098 Signale) besteht fast ausschließlich aus **non-strategischen Connectors**: polymarket (1 354), unhcr (670), usgs-earthquake (600), news (571), github (402), reddit (391), hackernews (309), clinicaltrials (288), coingecko (283), manifold (282), nextstrain (245), arxiv (215). Keine BDH, BWP, Bruegel, DIW, ifo, Agora Energiewende, EU-Lex, Handelsblatt, BMWK, BAFA. Das Produkt positioniert sich als „EU-Strategic-Intelligence" — die DB ist ein Mix aus Prediction-Markets und Naturkatastrophen-Feeds.

Für eine DACH-Wärmepumpen-Query existieren in der DB schlicht **keine matchbaren Signale**.

### P0-B: LLM degeneriert zu synthesis-only bei leerem/dünnem Signal-Pool

**Beweis aus der Query-DB (project_queries.result_json):**

| Run | synthesis | scenarios | references | usedSignals | JSON-Gesamt |
|---|---|---|---|---|---|
| A EN (12:20, Lieferketten) | 2 524 | **3** | **5** | **17** | **26 026 B** |
| B DE (12:48, KI-Arbeitsmarkt) | 3 147 | 0 | 0 | 0 | 3 356 B |
| **C DE (13:19, Wärmepumpen)** | **2 774** | **0** | **0** | **0** | **2 983 B** |

Wenn Signale fehlen, liefert der LLM **nur** das Freitext-Feld `synthesis` (mit Markdown-Überschriften als verkappte Strukturierung) und lässt alle flachen JSON-Felder leer. Das ist partiell ehrliches Verhalten (keine konkreten Quellen zum Ankern), aber UX-katastrophal: die KPI-Karten Live-Signale/Quellen/Szenarien werden dann conditional ausgeblendet, die Szenarien-Sektion fehlt komplett, das Briefing wirkt „halbfertig" statt „ehrlich leer".

### Was der synthesis-Text trotzdem zeigt

Der narrative Teil ist qualitativ auf Niveau eines guten Think-Tank-Briefings:
- Korrekte EDGE-Syntax `[EDGE: TrendA → TrendB]` (Fortschritt gegenüber A DE)
- Konkrete Zahlen (356 000 Einheiten Absatz 2023, 500 000 Ziel)
- Konkrete Akteure (Midea, Gree, Viessmann, Vaillant, Bosch Thermotechnik, Daikin Europe)
- Konkrete Policies (GEG, BEG, Raus-aus-Öl, EPBD 2024)
- Drei identifizierte Tipping-Points
- Asia-vs-EU-Fragmentierungs-Dimension erfasst

Aber ohne Signal-Anker und ohne die flachen JSON-Felder ist das kein strukturiertes Briefing, sondern ein guter Essay.

### Kollateralfund

**P1 „↳ Folgefrage zu"-Bug**: Der erste Versuch nach dem Credit-Topup zeigte im UI-Header „Folgefrage zu…" mit einer der B-Session-Queries — die C-Frage wurde unerwartet an den vorherigen Thread angekettet, obwohl ein neuer Workspace erwartet war. Untersuchung pending.

**P1 Error-UX**: Während der Credit-Balance-Phase schickte der Server `"Unable to process your request."` — das Frontend zeigte stattdessen den generischen Fallback `„Die KI-Analyse hat keine verwertbare Antwort geliefert. Möglicherweise ist die Anfrage zu kurz oder das System überlastet."` Der Server-Error-Text wird im Client nicht durchgereicht. Datei: `src/components/briefing/BriefingResult.tsx` + `src/app/api/v1/query/route.ts:495-501`.

## Auswirkung für Score-Lesung

Die vollständige Rubrik-Bewertung dieses spezifischen Runs wird **deferred**. Zwei Gründe:

1. Bei 0 Signalen ist D3 (Signal-Relevanz) nicht fair bewertbar — es gibt keine Signale zu bewerten.
2. Bei fehlenden Szenarien-, Referenzen-, und Entscheidungshilfe-Sections sind D2/D4/D6 strukturell leer — jede Note wäre ein Urteil über ein Artefakt, das die Pipeline gar nicht versucht hat zu erzeugen.

Diese Evaluation hat den **strukturellen Defekt** als Output geliefert — nicht die Bewertung einer Antwort, sondern die Diagnose warum diese Antwort-Klasse in diesem System nicht entstehen kann. Das ist für die Produkt-Roadmap wertvoller als ein 15/35-Score.

---

## Briefing-Output

Synthesis-Text (2 774 Zeichen, 3 Absätze mit H2-Überschriften):

> **Regulatorischer Rückenwind mit Umsetzungsfriktionen**
> Die Wärmepumpen-Industrie im DACH-Raum steht 2026 an einem kritischen Übergang: Der regulatorische Rahmen ist ehrgeizig — das deutsche Gebäudeenergiegesetz (GEG, in Kraft seit 01.01.2024) schreibt 65% erneuerbare Energie bei neuen Heizungsanlagen vor `[LLM-KNOWLEDGE]`, die überarbeitete EU-Gebäuderichtlinie (EPBD 2024) verlangt bis 2030 eine schrittweise Abkehr von fossilen Heizsystemen und bis 2035 Null-Emissionsstandards für Neubauten `[REG: EU:Green Deal]` — doch die Marktdynamik blieb 2024–2025 hinter den Erwartungen zurück. In Deutschland sank der Wärmepumpenabsatz 2023 auf rund 356.000 Einheiten nach einem Rekordjahr 2022, und 2024 setzte sich dieser Rückgang fort `[LLM-KNOWLEDGE]`. Ursachen: Verunsicherung durch die GEG-Debatte, hohe Zinsen und gestiegene Installationskosten.
>
> **Strukturelle Treiber und asiatischer Wettbewerbsdruck**
> Mittelfristig (2026–2030) konvergieren mehrere strukturelle Kräfte hin zu einer Marktbeschleunigung. `[EDGE: mega-climate-sustainability → mega-energy-transition]` treibt politischen Druck, `[EDGE: mega-energy-transition → macro-green-energy]` übersetzt sich in Förderinstrumente wie die BEG (Bundesförderung effiziente Gebäude) und österreichische Raus-aus-Öl-Programme `[LLM-KNOWLEDGE]`. Gleichzeitig drängen asiatische Hersteller — insbesondere chinesische Anbieter wie Midea, Gree und die Stiebel-Eltron-Rivalen aus dem Fernost-Segment — mit aggressiven Preisen in den EU-Markt `[LLM-KNOWLEDGE]`. Dies komprimiert die Margen europäischer OEMs (Viessmann, Vaillant, Bosch Thermotechnik, Daikin Europe) und erzwingt eine Entscheidung: Volumenspiel via Outsourcing oder Differenzierung via systemische Integration (SmartGrid, PV-Kopplung, Wärmespeicher) `[TREND: Renewable Energy & Green Tech]`.
>
> **Tipping-Points und strategische Unsicherheiten**
> Drei identifizierbare Tipping-Points bestimmen, ob die DACH-Wärmepumpenquote bis 2030 die ambitionierten Ziele (Deutschland: 500.000 Einheiten/Jahr; Österreich: Vollverbot fossiler Heizungen im Neubau ab 2025) erreicht `[LLM-KNOWLEDGE]`: (1) Parität der Betriebskosten gegenüber Gasheizungen — abhängig vom Strompreisniveau, das in Deutschland strukturell hoch bleibt `[TREND: Energy Transition & Decarbonization]`; (2) Handwerkerkapazität — der Fachkräftemangel im SHK-Gewerk ist akut und limitiert Installationsgeschwindigkeit unabhängig von Nachfrage `[TREND: Skills Gap & Upskilling]`; (3) EU-Importschutz gegenüber asiatischen Billigangeboten — Antidumping-Prüfungen laufen, Ausgang offen `[LLM-KNOWLEDGE]`. Die geopolitische Fragmentierung `[TREND: Geopolitical Fragmentation]` wirkt doppelt: Sie beschleunigt den Wunsch nach Lieferkettenunabhängigkeit (EU-Fertigung), erhöht aber gleichzeitig Inputkosten für Kompressoren und Kältemittel.

Alle anderen JSON-Felder (`scenarios`, `references`, `keyInsights`, `causalChain`, `regulatoryContext`, `matchedTrends`, `usedSignals`, `followUpQuestions`) sind leer.

---

## Rubrik-Bewertung

**Deferred** — Scoring nach Fix der zwei P0-Defekte, wenn strukturelle Felder wieder vorhanden sind. Notizen pro Dimension für den Re-Run:

### 1. Claim-Provenienz
Im synthesis-Teil gut: `[REG: EU:Green Deal]`, `[LLM-KNOWLEDGE]`, `[EDGE: TrendA → TrendB]` (Fortschritt!), `[TREND: X]`. Aber: zahlreiche numerische Claims nur mit `[LLM-KNOWLEDGE]` ohne Signal-Rückkoppelung — weil es keine Signale gibt.

### 2. Source-Qualität
`references: []` — keine Quellen auflistbar. Nicht bewertbar.

### 3. Signal-Relevanz
`usedSignals: []` — keine Signale auflistbar. Direkt 0/5 bei strengem Scoring, oder „nicht bewertbar" bei deferral.

### 4. Szenarien-Disziplin
`scenarios: []` — keine Szenarien geliefert. Nicht bewertbar.

### 5. EU-Frame
Im synthesis-Teil explizit: EPBD, Green Deal, EU-Importschutz, EU-Fertigung. DACH sauber differenziert (DE GEG, AT Raus-aus-Öl). Stark, aber ohne strukturierten Kontext schwer zu messen.

### 6. Action-Readiness
`decisionFramework: nicht vorhanden`, Entscheidungshilfe-Block fehlt. Nicht bewertbar.

### 7. Ehrlichkeit-über-Lücken
Konfidenz 5%, Warnbalken „Keine externen Quellen zitiert" — die Ehrlichkeit-Kalibrierung funktioniert korrekt. Das ist das einzige System-Verhalten, das hier Vollpunktzahl verdient.

---

## Konkrete Fix-Action-Items

**P0-A — Signal-Pool-Pipeline um strategische DACH/EU-Connectors erweitern:**
1. Bruegel RSS — EU-Policy-Analyse
2. DIW Wochenbericht — DE-Makroökonomie
3. ifo Institut Presse — DE-Ökonomie
4. Agora Energiewende — Klima/Energie-Policy-Briefs
5. BDH (Bundesverband der Deutschen Heizungsindustrie) — Heizungsmarkt-Statistik
6. BWP (Bundesverband Wärmepumpe) — Wärmepumpen-Branchenpresse
7. EU-Lex neue Rechtsakte — Regulatorik
8. BMWK Pressemitteilungen — DE-Wirtschaftspolitik
9. Handelsblatt Morning Briefing / IT-Finanzen — DE-Wirtschaft
10. Politico Europe — EU-Politik

Jeder Connector ≈ 1-3 Stunden Arbeit (RSS-Parser + `source_metadata.ts`-Eintrag + normalisierung).

**P0-B — Prompt-Fix gegen synthesis-only-Collapse:**
- `buildSystemPrompt()` um expliziten Guard ergänzen: „Auch bei ≤5 Signalen MÜSSEN `scenarios`, `keyInsights`, `references`, `decisionFramework` gefüllt sein. Verwende `[LLM-KNOWLEDGE]`-Tags wo Signale fehlen — niemals das Feld leer lassen. Leere strukturierte Felder sind ein Bug."
- Alternativ: Wenn die DB für eine Query 0 matches liefert, sollte die Route einen expliziten „cold_signals: true"-Hinweis in den Prompt injizieren mit der Aufforderung, trotzdem strukturiert zu antworten.

**P1 UI-Empty-State:**
- `BriefingResult.tsx:533, 576, 588` — statt Section komplett auszublenden, Empty-State-Card mit Hinweis „Keine strukturierten [Szenarien/Quellen/Signale] für diese Query" zeigen.
- So sieht der User, dass etwas erwartet wurde und warum es fehlt, statt zu denken das Briefing wäre „halbfertig".

**P1 Error-UX:**
- `HomeClient.tsx:1299` — Server-Error-Text statt generischen Fallback anzeigen, wenn das SSE-Stream einen Error-Event geliefert hat.
- `route.ts:495-501` — HTTP 400 mit `credit_balance_too_low` differenziert mappen: „AI-Service: Authentifizierung/Abrechnung — bitte Administrator kontaktieren."

**P2 Folgefrage-Threading:**
- Untersuchung: Warum C-Query als Follow-up zur B-Session gekettet wurde, obwohl ein neuer Workspace erwartet war. Mögliche Ursache: Workspace-State-Leak im Client nach Canvas-Switch.

---

## Notizen / Überraschungen

- **Unerwartet gut**: Synthesis-Qualität war trotz 0 Signale bemerkenswert. Die LLM-Knowledge-Basis zu Wärmepumpen-Markt ist offenbar gut — GEG/EPBD/BEG-Timeline, Hersteller-Namen, 356 000-Absatz-Zahl, alles korrekt. Zeigt, dass der LLM allein via Weltwissen bei einem gut dokumentierten Thema überraschend tragfähige Inhalte liefert, sofern er die strukturierten Felder füllen würde.

- **Unerwartet schwach**: Der 201-Sekunden-Run-Dauer steht in keinem Verhältnis zum 3 KB Output. Die Pipeline scheint viel Token-Budget in nicht-persistierte Zwischenschritte zu stecken (Contradiction-Check, Assumption-Extraktion etc.), bevor sie das dünne Ergebnis speichert. Ein Token-Budget-Review wäre sinnvoll.

- **Signal-Intuition-Miss**: Ich hätte intuitiv erwartet, dass das System mindestens das BDH-Jahresabsatz-Update oder eine Handelsblatt/Spiegel-Schlagzeile zu „Wärmepumpe Zuschüsse" findet — beide Typen von Nachrichten sind in der deutschen Medienlandschaft wöchentlich präsent. Dass die Pipeline-Connectors keine davon abdecken, war der eigentliche Aha-Moment dieses Runs.
