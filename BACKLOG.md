# SIS Backlog

Zentrale, priorisierte Aufgabenliste für das Strategic Intelligence System.
Struktur: thematisch gruppiert, innerhalb jeder Gruppe nach Priorität.
Jede Zeile: `[Prio] Titel — Beschreibung — Aufwand — Dependencies`

Legende:
- `[🔴]` — hohe Priorität, sichtbarer User-Pain oder struktureller Blocker
- `[🟡]` — mittel, Quality-of-Life oder strategisch wertvoll
- `[🟢]` — niedrig, nice-to-have oder später

Letzte Aktualisierung: 2026-04-08 (Session-Ende nach Phase A+C+B.1).

---

## 🧭 Knowledge Cockpit

### Signale-Tab

- **[🔴] Signale als Karten mit Bild-Preview + Link** — Ersetzt die Listen-/Tabellen-Ansicht durch Karten mit Open-Graph-Image-Scraping, Titel, Source-Chip, Zeitstempel, Topic-Badge und Artikel-Link. Cards in responsive Grid.
  - Aufwand: **groß** (3-4 h)
  - Dependencies: Open-Graph-Scraping-Infrastruktur (Cache, Proxy oder Worker), Fallback-Placeholders, CORS-Handling
  - Risiko: Image-Fetching 200× pro Tab-Aufruf ist langsam → Caching-Layer in der DB oder Image-Proxy-Endpoint (`/api/v1/og-image?url=…`) nötig
  - Anmerkung: Ersetzt die aktuelle Listen-Darstellung komplett; alternativer Pfad wäre „Karten-Modus als Toggle neben Listen-Modus", aber das doppelt die Wartung

### Quellen-Tab

- **[🔴] Quellen-Tab im Sessions-Spalten-Stil neu aufbauen** — Aktuell HTML-Table ohne Header-Row. Sessions-Style: Grid-Layout mit `gridTemplateColumns`, Column-Header-Row, konsistente Hover-States, Icons für Type-Badges und Status-Badges, Farbcodierung für Kategorien.
  - Aufwand: **mittel** (90 Min)
  - Dependencies: Abgeschlossen werden mit „Datenquellen besser kategorisieren" (siehe nächstes Item)

- **[🔴] Datenquellen-Kategorisierung überarbeiten** — 25 flache Kategorien sind zu viel. Neue Struktur auf STEEP+V-Basis:
  - **Social**: gesellschaft, gesundheit, arbeit, migration, kultur, gaming, publishing, umfragen
  - **Technological**: tech, wissenschaft, cyber
  - **Economic**: makro, crypto, wetten, prognose, supply
  - **Environmental**: klima, agrar, energie, mobilitaet
  - **Political**: geopolitik, recht, news
  - **Values/Foresight**: foresight, forschung
  - Aufwand: **mittel** (60 Min)
  - Dependencies: Muss zusammen mit Quellen-Tab-Umbau gemacht werden (ein Commit)
  - Jede `PlannedConnector` und der Live-Connector-Registry bekommen einen `macroCategory`-Tag

- **[🟡] Backlog + Needs-Key Status-Badges im Quellen-Tab** — `planned-connectors.ts` hat bereits `backlog: true` und `needsKey: true` Flags gesetzt, aber die UI rendert für alle gleich `GEPLANT`. Neue StatusKind-Varianten: `"backlog"` (grau, kursiv), `"needs-key"` (butter + 🔑 Icon).
  - Aufwand: **klein** (30 Min)
  - Dependencies: Keine, kann eigenständig oder als Teil des Quellen-Tab-Umbaus laufen

### Radar-Tab

- **[🟡] Radar-Quadranten auf STEEP+V mappen** — Aktuell hartkodierte Tech-Labels („Technology & AI", „Business & Society", „Development & Engineering", „Data & Infrastructure"). Passt nicht zum STEEP+V-Versprechen der Methodik. User hat explizit vertagt.
  - Aufwand: **mittel** (60-90 Min)
  - Dependencies: Design-Entscheidung STEEP+V-Mapping (6 auf 4 reduzieren) oder andere Achsen (Zeithorizont × Reifegrad belassen)
  - Braucht User-Input vor Implementation

### Übergreifend

- **[🔴] Canvas Node View wieder einbauen** — In einer früheren Session wurde die Toggle-Ansicht `● Standard / ⊞ Canvas / ≡ Board` aus der Home-Seite entfernt und der iframe-Canvas-Embed gelöscht. Der User möchte eine Möglichkeit zurück, von einem Briefing direkt in die Node-Canvas-Darstellung zu wechseln.
  - Aufwand: **mittel** (60-90 Min)
  - Dependencies: Klären was genau zurück soll:
    - Option A: Per-Briefing „⊞ Canvas" Button in BriefingResult, navigiert zur Sessions-Canvas
    - Option B: Home-Page View-Toggle Standard/Canvas/Board zurück (der ursprüngliche Stand)
    - Option C: Inline-Canvas-Render im BriefingResult unter der Synthesis
  - Alle drei sind valide, brauchen User-Entscheidung

---

## 📚 Methodik („Banger-Version")

Der User will alle vier Ebenen gleichzeitig. Das ist ein eigenes kleines Projekt.

- **[🔴] Methodik als interaktives Live-Dokument** — Vier parallel zu implementierende Sub-Projekte:
  1. **Mehr interaktive Visualisierungen mit Live-Daten**: statt statischer Grafiken echte Live-Zahlen aus der DB. Konkret:
     - Pipeline-Diagramm (Volt Kern-Schema) mit animierten Zähler-Bubbles pro Station
     - STEEP+V-Grid mit Live-Trend-Counts pro Kategorie
     - Ring-Explainer mit Live-Breakdown wie viele Trends aktuell in Adopt/Trial/Assess/Hold
     - Konfidenz-Breakdown mit echten Trend-Beispielen die den Score erklären
  2. **Narrative Storytelling-Ebene**: neue Sektion oder ausgebaute 01-Sektion mit konkretem Fallbeispiel (wie hat das SIS die 2024er Wirecard-Signale erkannt, wie wäre es bei einem aktuellen Event vorgegangen)
  3. **Drill-Down pro Sektion**: jede der 7 Sektionen wird zu einer eigenen Unterseite unter `/verstehen/methodik/<sektion>` mit deutlich tieferen Details (Formeln, Source-Listen, Referenzpapiere)
  4. **Case-Studies „Ein Trend in 10 Schritten"**: neue Sektion, ein echter Trend aus der DB wird von Rohsignal bis zur Strategie-Empfehlung durchgespielt, mit screen-shots/mock-screenshots der jeweiligen SIS-Ansicht
  - Aufwand: **groß** (6-8 h, eigene Session)
  - Dependencies: Keine, aber braucht Konzept-Phase vor Implementation
  - Risiko: Scope-Explosion — jedes der 4 Sub-Projekte könnte allein 2-3 h brauchen

---

## 📊 Datenquellen

### Neue Live-Connectors (Welle 2 — No-Auth)

Nach dem Phase-C-Success mit CoinGecko, DeFi Llama, ClinicalTrials, OpenFDA, UNHCR, Nextstrain stehen diese Kandidaten für die nächste Welle bereit. Alle No-Auth, über das declarative Framework baubar:

- **[🔴] EUR-Lex / CELLAR** — EU-Gesetzgebung in Echtzeit. SPARQL-Endpoint, komplexer als REST. Aufwand: ~60 Min
- **[🔴] FAO FAOSTAT** — globale Nahrungsmittelpreise. Aufwand: ~45 Min
- **[🔴] Google Books Ngram Viewer** — kulturelle Makro-Trends über Jahrzehnte. Braucht Input-Keyword-Liste. Aufwand: ~45 Min
- **[🔴] Tor Metrics** — Anonymitäts-Netzwerk-Traffic. CSV-Format statt JSON, Framework braucht CSV-Parser. Aufwand: ~60 Min (Framework-Erweiterung + Connector)
- **[🔴] SteamSpy** — Gaming-Adoption ohne Auth, einfachste Shape. Aufwand: ~30 Min
- **[🟡] Ember Climate** — Stromsektor-Dekarbonisierung. CSV-Download. Aufwand: ~45 Min
- **[🟡] ECDC Surveillance Atlas** — EU-Infektionskrankheiten. Aufwand: ~45 Min
- **[🟡] WFP VAM** — Hungerkrisen-Monitor. Aufwand: ~45 Min
- **[🟢] EU JRC Megatrends Hub** — Foresight-Referenzen. Aufwand: ~30 Min
- **[🟢] OpenStreetMap Overpass** — Query-Language komplex. Aufwand: ~90 Min

### Ebene-2 Quellen (Needs-Key)

19 Quellen brauchen User-registrierte API-Keys. Per-Source-Doku in Notion schreiben:

- **[🟡] Notion-Setup-Docs für alle 19 Ebene-2-Quellen** — Jede Notion-Page bekommt einen Setup-Block mit Signup-Link, env-Variable-Name, wo-der-Key-hinkommt. Per-Source ~5 Min, 19× = 95 Min.
  - Dependencies: Notion-API-Zugriff, ich kann das in einem Batch machen

### Strategische Cluster

- **[🔴] Kultur-Cluster: TMDB + OMDb + Trakt + Last.fm** — Öffnet komplett neuen SIS-Vektor (Kultur-Seismograph aus Notion-Seite 2). Ich baue die 4 Connectors, User besorgt 4 Keys (~20 Min User-Zeit).
  - Aufwand: **groß** (2.5 h meinerseits + 20 Min User-Zeit)
  - Impact: Komplett neue Datenquelle — emotionale/kulturelle Stimmungsbilder, die heute im SIS komplett fehlen

- **[🟡] Gaming-Cluster: IGDB + Steam Web + Twitch** — Gaming als Kultur-Seismograph. Alle Free-Key nach Registrierung.
  - Aufwand: **mittel** (90-120 Min)

- **[🟡] Regulatorik-Cluster: Bundestag DIP + Congress.gov + The Odds API** — Gesetzgebung + Prediction-Markets für Policy-Frühwarnung.
  - Aufwand: **mittel** (90-120 Min)

### Ebene-3 Backlog (commercial/download-only)

12 Einträge — Crunchbase, Spotify, Betfair, GESIS/Eurobarometer, Pew Research, WVS, IMDb-Datasets, Netflix Top 10, JustWatch, Reelgood, Letterboxd, IODA. Alle brauchen entweder kommerzielle Tier oder sind bulk-download-only. Nicht für kurzfristige Arbeit geplant.

---

## 🔮 Neue Features / strategisch

- **[🟡] Alternative Trend-Map aus globalen Signalen** — Zweite Visualisierung neben dem bestehenden Radar. Nicht nur Quadranten × Ringe, sondern eine andere Dimension: z.B. Geografische Heatmap, zeitliche Signal-Dichte, oder Netzwerk-Cluster basierend auf Topic-Co-Occurrence.
  - Aufwand: **groß** (6-10 h, eigene Konzept-Phase nötig)
  - Dependencies: Design-Entscheidung — welche Dimension? Welche Datenquelle-Kombination? D3 vs. deck.gl vs. etwas anderes?
  - Muss als Projekt gescopet werden, nicht als Quick-Win

---

## 🏗 Infrastruktur / Technische Schulden

- **[🟡] Framework-CSV-Support** — Das declarative Framework kann nur JSON. CSV-Quellen (Tor Metrics, Ember Climate, Netflix Top 10) brauchen entweder einen CSV-Parser im Framework oder eigene hand-gecodete Connectors.
  - Aufwand: **mittel** (60-90 Min für generischen CSV-Support im Framework)

- **[🟡] OG-Image-Proxy-Endpoint** — Voraussetzung für Signal-Karten mit Bild-Preview. `/api/v1/og-image?url=…` fetcht die Zielseite, parsed `<meta property="og:image">`, cached das Bild in der DB oder File-System.
  - Aufwand: **mittel** (90 Min)
  - Dependencies: Blocker für „Signale als Karten mit Bild-Preview"

- **[🟢] Notion → Code Sync Automation** — Die 20 Stale-Notion-Flags am Anfang dieser Session waren manuell zu fixen. Ein Cron-Job oder Webhook könnte das regelmäßig machen.
  - Aufwand: **mittel** (2 h)

- **[🟢] Pipeline-Benchmark-Endpoint** — Nach-Session-Verifikation der Pipeline war manuell. Ein `/api/v1/debug/pipeline-health` Endpoint (nur in DEV) könnte das automatisieren.

---

## 📦 Phase-B.2 Reste (aus der aktuellen Session)

- **[🟡] VoltStatusBadge Varianten hinzufügen** — `backlog` und `needs-key` StatusKinds sind in planned-connectors.ts schon als Flags, aber nicht im UI sichtbar. Teil des Quellen-Tab-Umbau-Projekts.

---

## Sprint-Empfehlung für die nächste Session

Wenn du mit klarem Kopf zurückkommst, die logischste Reihenfolge:

**Sprint 1 (90-120 Min)**: Quellen-Tab-Umbau
- Datenquellen-Re-Kategorisierung auf STEEP+V
- Quellen-Tab im Sessions-Spalten-Stil (mit Icons + Farben)
- Backlog + Needs-Key Badges
- Alles in einem atomic commit

**Sprint 2 (2-3 h)**: Signal-Karten
- OG-Image-Proxy-Endpoint zuerst
- LiveSignalStream auf Karten-Layout umbauen
- Image-Caching-Strategie

**Sprint 3 (60-90 Min)**: Canvas Node View zurück
- Erst entscheiden welche der 3 Optionen (Per-Briefing-Button, Home-Toggle, Inline-Render)
- Dann bauen

**Sprint 4+ (große Blöcke)**: Methodik-Banger, Kultur-Cluster, Alternative Trend-Map — jedes ein eigenes Projekt.

---

## Was heute erledigt wurde (2026-04-08)

Vollständigkeitshalber der Session-Ertrag:

- ✅ Notion-Sync von 20 stale „Bereits integriert"-Flags
- ✅ Phase A Smoke-Test der 7 Batch-5 Connectors
- ✅ Phase C Reparatur: OpenFDA URL-Bug gefixt, Nextstrain Endpoint umgeschrieben (Charon/getAvailable), IDMC zu planned demotiert (needsKey), Topic-Subsumption für ClinicalTrials/OpenFDA/DeFi Llama
- ✅ Neuer Mega-Trend „Migration & Displacement" angelegt (DB + mega-trends.ts + 5 Kausal-Edges)
- ✅ Phase B.1 Signal-Diversität: Ticker-Query mit Window-Function + Round-Robin, LiveSignalStream mit „Gemischt"-Default-Sort
- ✅ Re-Verifikation: 6/6 Batch-5 Connectors liefern 360 Signale in 7.5s, alle Topics matchen DB-Trends

Commits:
- `26596ed` — Knowledge Cockpit + Sessions + 7 Connectors (vorherige Session)
- `8ca66fc` — Phase C Reparatur
- `94fec2b` — B.1 Round-Robin
