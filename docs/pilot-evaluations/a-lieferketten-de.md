# Pilot-Evaluation — a-lieferketten-de

**Thema:** Welche EU-Länder werden bis 2030 am stärksten von der Fragmentierung globaler Lieferketten betroffen sein — und welche strategischen Optionen hat Deutschland als industrielles Rückgrat?
**Datum:** 2026-04-22
**Version-ID:** _(aus UI — nicht per DB-Lookup)_

Rubrik: [rubric.md](./rubric.md) — 7 Dimensionen · 1–5 Score · Gesamtmax 35.

---

## Briefing-Output

### KPI-Kacheln

| Metrik | Wert |
|---|---|
| Konfidenz | **6 %** (gelbes „outlined"-Badge, gering) |
| Live-Signale | **0** („0 topisch relevant, X gefiltert") |
| Quellen | **5** (alle mit `?`-Badge, nicht auf Allowlist) |
| Szenarien | **3** (22% · 53% · 25%) |

### Synthesis (gekürzt — Tags wie im Screenshot)

**P1 — Strukturelle Fiskaler Lieferketten:**
> Die Fragmentierung globaler Lieferketten beschleunigt sich seit 2022 durch den Russland-Ukraine-Krieg, US-China-Handelskonflikte und die Inflation Reduction Act deutlich `[TREND: Geopolitical Fragmentation]`. Die EU ist passiver Empfänger globalisierter Effizienzgewinne; Reshoring-Kosten, redundante Lagerhaltung und geopolitisch bedingte Handelsumlenkungen erzeugen strukturelle Kostennachläse von schätzungsweise 15–25% in betroffenen Industriesektoren `[LLM-KNOWLEDGE]`. Exponiert: EU-Länder mit hoher Abhängigkeit von kritischen Rohstoffen/Zwischenprodukten aus China und post-sowjetischem Raum — **Deutschland, Tschechische Republik, Slowakei, Ungarn, Polen**.

**P2 — Auffälligkeiten Betroffenheit:**
> Deutschland als größte Industrienation der EU mit Exportanteil >45% am stärksten exponiert `[TREND: Technological Disruption]`. Visegrád-Staaten als verlängerte Werkbänke strukturell tief verwundbar `[EDGE: mega-geopolitical-fragmentation]`. Südosteuropa (IT/ES/GR) durch Energieabhängigkeit; Baltikum + Finnland durch Russland-Proximität `[TREND: Geopolitical Fragmentation]`.

**P3 — Strategische Optionen für Deutschland:**
> Drei Pfade: (1) Diversifikation (Kanada/Australien/Lateinamerika) `[REG: EU Critical Raw Materials Act]`; (2) Tech-Souveränität (TSMC Dresden, Intel Magdeburg) `[REG: US-CHIPS Act]`; (3) EU-Industriepolitik (IPCEI, Strategische Autonomie) `[REG: EU Green Deal]`.

### Szenarien

| Typ | Prob. | Kernaussage |
|---|---|---|
| **Optimistisch (Mittellage)** | 22% | Europäische Resilienztransformation bis 2030 — EU vollendet CRMA + strat. Handelsabkommen mit Lateinamerika/Kanada/Indien |
| **Basisfall** | 53% | Fragmentierte Anpassung mit strukturellen Kosten — Muddle-through, Sektor-Diversifikation mit Kostennachläsen |
| **Pessimistisch** | 25% | Industrielle Erosion durch eskalierende Spaltung — Taiwan-Krise / US-EU-Blockbildung bis 2027/28 |

### Strategische Dimensionen (BSC)

- Lieferketten-Resilienz **28%** · Tech-Souveränität **44%** · Standort-Wettbewerbsfähigkeit **31%** · Europäische Koordination **35%**
- **Gesamt-Readiness: 34%**

### Wichtigste Erkenntnisse (4)

1. Deutschland doppelt exponiert: direkter Importeur + Anker der Zulieferketten, Schock transmittiert EU-weit. `[TREND: Geopolitical Fragmentation]`
2. Slowakei + Ungarn überproportional anfällig (>30% Auto-Vorleistungen + polit. EU-Abhängigkeit). `[LLM-KNOWLEDGE]`
3. Friendshoring (Indien/Kanada/Marokko/Brasilien) → 7–10 Jahre Vorlauf + aktive Industriepolitik. `[LLM-KNOWLEDGE, TREND: …]`
4. Predictive Supply Chain Analytics → Wettbewerbsvorteile bis 2027. `[TREND: AI & Automation]`

### Quellen (5, alle `?` = nicht auf Allowlist)

- EU Critical Raw Materials Act (2024)
- European Commission Strategic Autonomy
- BDI Study Standort Deutschland 20..
- IMF World Economic Outlook Oct..
- EU JRC Megatrends: Geopolitical Fragmentation

### Entscheidungshilfe (5 konkrete Schritte)

1. **SOFORT (2026):** Kritische Abhängigkeitskartierung; Identifikation Single-Points-of-Failure mit >3 Lieferantenabhängigkeiten.
2. **KURZFRISTIG (2026–2027):** Strategische Rohstoffpartnerschaften (Kanada, Chile, Marokko) mit KfW-Rückabsicherung (im Output „KPW-Garantien" — LLM-Typo).
3. **MITTELFRISTIG (2027–2028):** Nearshoring-Kapazitäten in Visegrád-Staaten, koordinierte EU-Industriepolitik.
4. **PARALLEL:** KI-gestützte Supply-Chain-Intelligence, Frühwarnsysteme als Pflicht ab >500 Mio. EUR Umsatz.
5. **STRUKTURELL:** High-Value-Exportmix (Qualitätsprämien-Strategie) statt Volumenverteilung.

### Weiterführende Fragen

1. Welche Branchen (Automobil, Chemie, Maschinenbau) bis 2027 substanziell betroffen?
2. Wie kann Deutschland Visegrád-Staaten als Reshoring-Partner stärken?
3. Optimale Sequenz für deutschen Maschinenbau-Mittelständler bis 2028?

---

## Rubrik-Bewertung

### 1. Claim-Provenienz

Jede faktische Aussage mit `[SIGNAL/TREND/REG/EDGE/LLM-KNOWLEDGE]` getaggt?

- **Score:** `3 / 5`
- **Notes:** Haupt-Claims solide getaggt (`[TREND: Geopolitical Fragmentation]`, `[REG: EU CRMA]`, `[REG: US-CHIPS Act]`, `[LLM-KNOWLEDGE]`). Schwäche: Länderaufzählungen und Nebenaussagen ungetaggt („Baltische Staaten geopolitisch exponiert durch Russland-Proximität" — woher? kein Tag). Der 15–25%-Zahlen­claim ist immerhin `[LLM-KNOWLEDGE]`-getaggt (honest), aber numerische Claims ohne externe Quelle sollten im Validator zusätzlich geflaggt werden. **EDGE-Tag-Format unsauber:** `[EDGE: mega-geopolitical-fragmentation]` ist ein Slug, erwartet ist `[EDGE: TrendA → TrendB]`.

### 2. Source-Qualität

Sind References real, verifiziert und relevant? URLs funktionieren? Keine LLM-Fabrikate?

- **Score:** `3 / 5`
- **Notes:** 5 thematisch exakt passende Referenzen — **alle inhaltlich real und editorially vertrauenswürdig**. Keine Halluzinationen. **Aber:** alle mit `?`-Badge. Gap in der Allowlist: BDI (`bdi.eu`), JRC Knowledge4Policy (`knowledge4policy.ec.europa.eu`), `commission.europa.eu`, `eur-lex.europa.eu` fehlen. IMF sollte drauf sein — Nicht-Match deutet auf URL-leere Refs hin (LLM nennt nur Titel).

### 3. Signal-Relevanz

Passen die gezeigten Live-Signale topisch zur Frage?

- **Score:** `5 / 5`
- **Notes:** **0 topisch relevante Signale — und das ist ehrlich.** Konsistent mit `dominantSourceType = "llm-knowledge"`. Die Synthese sagt nicht „viele Signale deuten an…" obwohl keine da sind. Der Signal-Kettenbezug-Fix greift: **keine Bluesky-Babysitter, keine UN-Fertility-Posts, keine US-Veteran-Geschichten** als Pseudo-Evidenz. Best-case-Ergebnis für Thema ohne Live-Coverage.

### 4. Szenarien-Disziplin

3 Szenarien kausal distinkt? Falsifizierbare Annahmen? Probabilities nicht-default?

- **Score:** `4 / 5`
- **Notes:** 22/53/25 summiert auf 100, **kein Default-Fingerprint** (30/40/30, 33/34/33). Basisfall-dominiert ist für strukturelle Anpassung ohne externen Schock plausibel. Mechanismen klar distinkt: Opt = aktive Industriepolitik, Base = Muddle-through, Pess = externer Schock (Taiwan). **Abzug:** keyAssumptions und earlyIndicators sind im Szenarien-Block nicht prominent sichtbar — müssten per 1-Klick-Expand kommen. Falsifizierbarkeit ist das Kernprodukt der Szenarien; das darf nicht hinter Interaktion verschwinden.

### 5. EU-Frame

Ist der europäische Blickwinkel explizit und spezifisch?

- **Score:** `5 / 5`
- **Notes:** Hervorragend. Namentlich erwähnt: Visegrád (4 Länder einzeln), Baltikum + Finnland (Russland-Proximität), südosteuropäische Peripherie, TSMC Dresden, Intel Magdeburg, EU CRMA, IPCEI, EU-Strategische-Autonomie-Agenda, KfW-Garantien. **Keine einzige US-zentrische Referenz** — US erscheint als externer Stressor (CHIPS Act, IRA), nicht als Lens. Genau was wir vom EU-zentrierten Prompt erwarten.

### 6. Action-Readiness

Sind Empfehlungen mit Akteur, Hebel, Zeitfenster, Erfolgskriterium versehen?

- **Score:** `5 / 5`
- **Notes:** Entscheidungshilfe liefert alle vier Dimensionen pro Empfehlung. Akteure namentlich („Bundesregierung", „Unternehmen >500 Mio. EUR Umsatz"), quantifizierte Kriterien („Single Points of Failure mit >3 Lieferantenabhängigkeiten"), klare Zeitfenster (SOFORT / 2026-2027 / 2027-2028 / parallel / strukturell). **Vorstands-Brief-Qualität.** Einziger Schnitzer: Typo „KPW-Garantien" statt „KfW-Garantien".

### 7. Ehrlichkeit-über-Lücken

Benennt das Briefing Coverage-Gaps und dominanten Source-Type ehrlich?

- **Score:** `5 / 5`
- **Notes:** **6% Konfidenz** ist eine ehrliche Low-Confidence-Signalisierung. Live-Signale-Kachel zeigt „0 topisch relevant". `dominantSourceType = "llm-knowledge"` konsistent mit der Prosa. Der „Aktuelle Kontext"-Absatz benennt die Situation explizit. Widerspruch Narrative↔UI gibt's nicht — das war ja genau der Bug, den wir gestern bei Wintersport gefixt haben.

---

## Gesamt-Score

- **Summe: 30 / 35**
- **Band: INTERN NUTZBAR (26–31)** — publikationsreif wäre ≥32

**Das ist ein sehr solides Ergebnis** für ein Thema ohne Live-Signal-Unterstützung. Die Strategie-Qualität (D5, D6) ist publikationsreif. Die Verankerung in nachweisbarer Evidenz (D1, D2) ist die Schwäche — genau da, wo Live-Signale fehlen.

## Konkrete Fix-Action-Items

Priorität hoch→niedrig:

### [P0] Reference-Allowlist erweitern — D2-Score zieht alle Evaluations runter

`src/lib/validation.ts` `KNOWN_DOMAINS` ergänzen um:
- `bdi.eu`, `www.bdi.eu`
- `knowledge4policy.ec.europa.eu`
- `commission.europa.eu`
- `eur-lex.europa.eu`
- `data.europa.eu`
- `imf.org` prüfen (sollte schon drauf sein; wenn ja, warum matchte es nicht?)
- Bundesregierungs-Domains: `bundesregierung.de`, `bmwk.de`, `bmk.gv.at`

### [P0] Intel-Magdeburg-Outdatedness: Signal-Retrieval für Standard-Queries stärken

Der LLM erwähnt „Intel Magdeburg" — Intel hat das Projekt Q4 2025 **abgesagt**. Würde GDELT oder SPIEGEL-RSS dieses Signal liefern, überstimmte SIGNAL das LLM-KNOWLEDGE (Source-Priority-Chain). Aktuell: 0 Live-Signale für die Query → LLM-Training-Cutoff dominiert → outdated Fakt.
- Prüfen: warum lieferte der Signal-Retrieval 0 Treffer? Query-Keywords „Lieferketten Fragmentierung Deutschland" müssten eigentlich GDELT/Guardian/SPIEGEL-Matches produzieren.
- Möglicherweise: `anchorMatched`-Schwelle (≥5-Zeichen-Keyword) zu streng für diese Query? „Deutschland" ist 10 chars, sollte passen.
- Check per smoke run: `getRelevantSignals("Welche EU-Länder...")` direkt auf sqlite — was kommt zurück, was wird gefiltert.

### [P1] Prompt-Verschärfung für Nebenaussagen-Tagging

System-Prompt `Source Rules`-Sektion: *jede* Länder-Nennung, *jede* Zahl, *jede* Branchenangabe muss getaggt sein. Aktuell rutschen ungetaggte Beobachtungssätze durch.

### [P1] EDGE-Tag-Format-Konsistenz

LLM nutzt Slug-Form `[EDGE: mega-geopolitical-fragmentation]`, erwartet ist `[EDGE: TrendA → TrendB]`. Prompt-Beispiel nachschärfen, validator-warn bei slug-Form.

### [P2] Szenario-Details prominenter anzeigen

`keyAssumptions` + `earlyIndicators` gehören standardmäßig in die Szenarien-Kachel, nicht hinter Expand-Klick. Falsifizierbarkeit ist das Kernprodukt.

### [P2] Numerische-Claim-Soft-Warning

Validator: wenn `[LLM-KNOWLEDGE]`-Tag bei Zahlen-Claim („15–25%", „>30%"), UI highlightet milder als ungetaggt. Aktuell binary getaggt-oder-nicht.

## Notizen / Überraschungen

- **Unerwartet gut:** Entscheidungshilfe-Konkretheit — KfW-Garantien, >500 Mio. EUR-Schwelle, Q1-Q4-Zeitfenster. Das klingt nach Berater, nicht nach Strategie-Sprech.
- **Unerwartet gut:** Visegrád-Granularität. Viele KI-Antworten aggregieren „Osteuropa"; hier stehen 4 Länder namentlich mit differenzierter Exposition.
- **Unerwartet schwach:** Alle 5 Refs mit `?` — erzeugt „unseriös"-Eindruck, obwohl Refs real sind. UX-Schuld untergräbt die Analyse-Qualität.
- **Übersehen (kritisch):** Intel-Magdeburg als Beispiel für Tech-Souveränität — das Projekt ist Q4 2025 abgesagt. **Genau der Fall, wo Live-Signale helfen würden**; aktuell fehlen sie, also zitiert der LLM sein Trainings-Cutoff-Wissen. Das ist ein **Fakten-Regressions-Risiko**, das direkt proportional zur Signal-Retrieval-Qualität ist.
