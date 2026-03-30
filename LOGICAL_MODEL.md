# Strategic Intelligence System — Logisches Modell

## 1. Grundprinzip

Das SIS ist kein Dashboard. Es ist eine **Denkmaschine**.

Der Kern ist ein Kreislauf:

```
WELT → SIGNALE → VERSTEHEN → VERNETZEN → ANTIZIPIEREN → HANDELN → WELT
```

Der User betritt diesen Kreislauf an jedem beliebigen Punkt durch einen Dialog.

---

## 2. Die fünf Schichten

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│   5. DIALOG-SCHICHT                                      │
│      Der User fragt. Das System antwortet.               │
│      Jede Interaktion verfeinert das Modell.             │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   4. ANTIZIPATIONS-SCHICHT                               │
│      Szenarien, Prediction Markets, Kausalketten.        │
│      "Was passiert WENN...?"                             │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   3. VERNETZUNGS-SCHICHT                                 │
│      Kausal-Graph, Regulierung, Abhängigkeiten.          │
│      "WARUM bewegt sich das und WAS folgt daraus?"       │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   2. VERSTEHENS-SCHICHT                                  │
│      Klassifizierung, Scoring, Normalisierung.           │
│      "WAS ist das und WIE relevant ist es?"              │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   1. SIGNAL-SCHICHT                                      │
│      Rohdaten aus 42+ Quellen, 11+ Connectors.           │
│      "Was passiert GERADE in der Welt?"                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Schicht 1: SIGNAL — "Was passiert?"

### Eingabe
Rohdaten aus heterogenen Quellen. Unstrukturiert, unterschiedliche Formate, Frequenzen, Verlässlichkeiten.

### Quellen-Taxonomie

```
AUTORITATIVE FORSCHUNG (42+)
├── Beratungen (McKinsey, BCG, PwC, EY, Deloitte, Roland Berger, ...)
├── Tech Research (Gartner, Forrester, IDC, CB Insights, MIT Tech Review, ...)
├── Intergovernmental (WEF, OECD, UN, IEA, World Bank, IMF, ...)
├── Think Tanks (RAND, Brookings, Chatham House, Club of Rome, ...)
├── Government Foresight (EU ESPAS, US NIC, Singapore CSF, Japan NISTEP, ...)
├── Academic (Stanford HAI, ...)
└── Market Research (Euromonitor, Ipsos, ...)

ECHTZEIT-CONNECTORS (11+)
├── Tech-Signale (Hacker News, GitHub, Stack Overflow, npm/PyPI, arXiv)
├── Öffentlicher Diskurs (Reddit, News API, Wikipedia Pageviews, Product Hunt)
├── Globale Intelligence (World Monitor: 22 Domains)
└── Crowd Wisdom (Polymarket Prediction Markets)

THOUGHT LEADERS (45+)
├── Tech Futuristen (Webb, Kurzweil, Suleyman, Kai-Fu Lee, Azhar, ...)
├── Geostrategen (Bremmer, Zeihan, Khanna, Friedman, ...)
├── Sustainability (Figueres, Rockström, Raworth, ...)
└── ... (9 Kategorien)
```

### Verarbeitungslogik

```
Rohsignal
  → Quellen-Validierung (ist die Quelle bekannt und verlässlich?)
  → Topic-Extraktion (worum geht es?)
  → Normalisierung (Signal-Stärke auf 0-1 skalieren)
  → Deduplizierung (gleiches Signal aus mehreren Quellen = 1 Signal, höhere Confidence)
  → Zeitstempel + Quellenangabe (jedes Signal ist nachvollziehbar)
```

### Ausgabe
Normalisierte Signale mit: Topic, Stärke, Quelle, Zeitpunkt, Rohdaten-Referenz.

---

## 4. Schicht 2: VERSTEHEN — "Was ist das?"

### Eingabe
Normalisierte Signale aus Schicht 1.

### Verarbeitungslogik

**A. Trend-Zuordnung**
```
Signal
  → Matching gegen bekannte Trends (exakt, fuzzy, semantisch)
  → WENN Match: Signal dem Trend zuordnen, Scores aktualisieren
  → WENN kein Match UND Signal-Stärke > Schwellenwert:
      → Neuen Trend-Kandidaten erstellen
      → WENN Kandidat Signale aus ≥3 Quellen in ≤7 Tagen:
          → Auto-Promotion zu bestätigtem Trend
```

**B. Klassifizierung (3 Dimensionen)**
```
Jeder Trend wird klassifiziert nach:

1. DAUER & REICHWEITE
   ├── Hype/Mode (0-2 Jahre, schnell aufsteigend, schnell fallend)
   ├── Trend (3-10 Jahre, spürbare Veränderung, klare Richtung)
   └── Megatrend (30+ Jahre, transformativ, kaum aufzuhalten)

2. VERÄNDERUNGSRICHTUNG
   ├── Aufwärts (wachsend, beschleunigend)
   ├── Seitwärts (stabil, kein signifikanter Wandel)
   ├── Abwärts (abnehmend, verblassend)
   └── Zyklisch (saisonal, wiederkehrend)

3. FOKUS (Mehrfach möglich)
   ├── Technologisch
   ├── Markt/Wirtschaftlich
   ├── Gesellschaftlich
   ├── Ökologisch
   ├── Politisch/Regulatorisch
   └── Ökonomisch
```

**C. Scoring (4 Dimensionen)**
```
RELEVANZ = Σ(Signal-Stärke × Quellen-Gewicht × Zeit-Decay) / Normalisierer
  → Wie wichtig ist dieser Trend JETZT?

CONFIDENCE = Anzahl_verschiedener_Quellen / Gesamtquellen
  → Wie sicher sind wir, dass das real ist?

IMPACT = (Magnitude × 0.6) + (Breite × 0.4)
  → Wie gross ist die potenzielle Auswirkung?

MOMENTUM = (Signale_letzte_7_Tage - Signale_vorherige_7_Tage) / Normalisierung
  → Beschleunigt oder verlangsamt sich der Trend?
```

**D. Ring-Zuordnung**
```
Gewichteter Score = R × w_r + C × w_c + I × w_i + M × w_m

  ≥ 0.60 → ADOPT    (handeln, übernehmen)
  ≥ 0.40 → TRIAL    (testen, experimentieren)
  ≥ 0.20 → ASSESS   (bewerten, beobachten)
  < 0.20 → HOLD     (parken, nicht ignorieren)

Gewichte (w_r, w_c, w_i, w_m) sind PRO RADAR konfigurierbar.
→ Dasselbe Signal, verschiedene Radare, verschiedene Bewertungen.
```

### Ausgabe
Klassifizierte, bewertete Trends mit Scores, Ring, Momentum, Fokus.

---

## 5. Schicht 3: VERNETZEN — "Warum und was folgt?"

### Eingabe
Bewertete Trends aus Schicht 2.

### Verarbeitungslogik

**A. Kausal-Graph**
```
Trend A ──drives──→ Trend B (Stärke 0.85)
Trend A ──enables──→ Trend C (Stärke 0.70)
Trend D ──inhibits──→ Trend A (Stärke 0.60)
Trend B ←─correlates─→ Trend E (Stärke 0.50)

Beziehungstypen:
  DRIVES    = A verursacht/beschleunigt B direkt
  ENABLES   = A schafft die Voraussetzung für B
  INHIBITS  = A bremst/verhindert B
  CORRELATES = A und B bewegen sich zusammen (ohne klare Kausalität)
```

**B. Kaskaden-Analyse**
```
WENN Trend A sich signifikant verändert:
  → Berechne: Welche Trends werden über 1, 2, 3 Ebenen beeinflusst?
  → Jede Ebene dämpft den Effekt (Stärke × 0.4 pro Ebene)
  → Ergebnis: "Systemische Reichweite" = Anzahl betroffener Trends
```

**C. Regulatorisches Overlay**
```
Jede Regulierung hat:
  - Jurisdiktion (EU, US, China, UK, Global, ...)
  - Status (geplant, verabschiedet, durchgesetzt)
  - Betroffene Trends + Effekt (beschleunigt/bremst/formt um)
  - Stärke des Effekts (0-1)

→ "Regulatorischer Druck" = Summe aller Regulierungen die einen Trend betreffen
→ Regulierung IST ein Signal (aus der politischen Sphäre)
```

**D. Signalkonvergenz (noch nicht implementiert)**
```
WENN ≥3 unkorrelierte Quellen gleichzeitig dasselbe Signal verstärken:
  → CONVERGENCE EVENT
  → Confidence-Boost für den betroffenen Trend
  → Alert an den User
  → Beispiel: World Monitor Konfliktdaten + Rohstoffpreise + Regulierung
              zeigen gleichzeitig in Richtung "Geopolitische Eskalation"
              → Das ist mehr als die Summe der Einzelsignale
```

### Ausgabe
Vernetztes Trendmodell mit Kausalitäten, Kaskaden, regulatorischem Kontext.

---

## 6. Schicht 4: ANTIZIPIEREN — "Was passiert wenn?"

### Eingabe
Vernetztes Trendmodell aus Schicht 3 + Prediction Market Daten.

### Verarbeitungslogik

**A. Szenarien**
```
Ein Szenario = eine hypothetische Veränderung:
  "Was passiert wenn [Ereignis X] eintritt?"

Bestandteile:
  - Name + Beschreibung
  - Wahrscheinlichkeit (aus Prediction Markets oder User-Schätzung)
  - Direkte Auswirkungen: Welche Trends, wie stark, welche Richtung
  - Kaskaden-Effekte: Über den Kausal-Graph propagiert
  - Regulatorische Implikationen: Welche Regulierung wird beschleunigt/gebremst

Ergebnis:
  - Anzahl betroffener Trends
  - Ring-Wechsel (Trend springt von "Assess" zu "Adopt")
  - Netto-Veränderung des gesamten Radars
```

**B. Prediction Markets als Wahrscheinlichkeitsanker**
```
Polymarket / Prognosemärkte:
  → Echtes Geld = echter Anreiz für korrekte Vorhersagen
  → Probability als Eingabe für Szenario-Gewichtung
  → "Taiwan Strait Crisis: 12%" → Niedrig, aber kaskadierend: 11 Trends betroffen
  → "EU AI Act Enforcement: 75%" → Hoch und bereits eskomptiert
```

**C. Trendpfad-Projektion (Zukunft)**
```
Historische Score-Verläufe + aktuelle Dynamik → Projektion
  → "Wo steht dieser Trend in 12/24/36 Monaten?"
  → Signal-Fingerprint-Matching: "Dieser Trend sieht aus wie [X] vor [N] Jahren"
```

### Ausgabe
Szenario-bewertetes Modell mit Wahrscheinlichkeiten, Kaskaden, Projektionen.

---

## 7. Schicht 5: DIALOG — "Der User fragt"

### Grundprinzip
```
Jede Interaktion beginnt mit einer Frage oder einem Stichwort.
Das System entscheidet, welche Tiefe und Breite die Antwort hat.
Der User entscheidet, ob er vertiefen will.
```

### Interaktions-Typologie

```
EBENE 0: STICHWORT
  Input:  "Taiwan"
  Output: Synthese aus allen Schichten
          → Welche Trends sind betroffen?
          → Welche Regulierungen relevant?
          → Welche Kaskaden möglich?
          → Welche Szenarien denkbar?
  Aktion: Klick auf Trend → Detail. /radar → Visualisierung.

EBENE 1: FRAGE
  Input:  "Wie beeinflusst der Taiwan-Konflikt die europäische Chipindustrie?"
  Output: Kausalketten + Regulierung + Szenario-Analyse
          → Taiwan → Semiconductor → CHIPS Act → Geopolitik → ...
  Aktion: Vertiefung in einzelne Ketten, Szenarien durchspielen.

EBENE 2: KONTEXT-FRAGE
  Input:  "Was bedeutet das für einen Mittelständler in der Automobilzulieferung?"
  Output: Kontextualisierte Analyse
          → Branche: Automotive
          → Betroffene Trends: Autonomous Mobility, Supply Chain, Semiconductor
          → Regulierung: EU-spezifisch
          → Handlungsempfehlung: Diversifizierung der Lieferkette
  Aktion: Szenario simulieren, Export für Vorstandspräsentation.

EBENE 3: SZENARIO-DIALOG
  Input:  "Spiel das Taiwan-Szenario durch. Was muss ich als CTO vorbereiten?"
  Output: Vollständige Szenario-Analyse mit Handlungsmatrix
          → Sofortmaßnahmen (Ring: Adopt)
          → Mittelfristige Anpassungen (Ring: Trial)
          → Zu beobachten (Ring: Assess)
  Aktion: Export, Notion-Sync, Alarm-Konfiguration.
```

### Befehle (progressive Komplexität)

```
BASIC
  [Stichwort]     → Synthese-Briefing
  /help            → Befehlsübersicht
  /radar           → Radar-Visualisierung öffnen
  /live            → Live-Daten laden

VERTIEFUNG
  /trend [Name]    → Deep-Dive in einen spezifischen Trend
  /compare A vs B  → Zwei Trends vergleichen
  /scenario [Name] → Szenario durchspielen
  /regulate [Land] → Regulatorisches Umfeld eines Landes

KONFIGURATION
  /context         → Eigenen Kontext definieren (Branche, Rolle, Region)
  /weights         → Quellen-Gewichtungen anpassen
  /alert           → Benachrichtigungen konfigurieren

EXPORT
  /export csv      → Trends als CSV
  /export pdf      → Briefing als PDF
  /export radar    → Radar als PNG

ERWEITERT
  /map             → Live World Map (World Monitor Integration)
  /graph           → Kausal-Graph Visualisierung
  /timeline        → Trend-Zeitverlauf
```

### Progressive Disclosure

```
Start:           Ein Eingabefeld. Nichts sonst.
Erste Frage:     Synthese + klickbare Trend-Chips.
Vertiefung:      Detail-Panel mit Scores, Quellen, Regulierung.
/radar:          Interaktives Radar erscheint.
/scenario:       Szenario-Panel erscheint.
/map:            Weltkarte mit Live-Daten erscheint.
/graph:          Kausal-Graph als Netzwerk-Visualisierung.

Jede Ebene wird nur geladen wenn der User sie braucht.
Das System merkt sich den Kontext über Interaktionen hinweg.
```

---

## 8. Feedback-Loop: Das System lernt

```
USER AKTION                          → SYSTEM LERNT
─────────────────────────────────────────────────────
User verschiebt Trend manuell        → Gewichtung passt sich an
User fragt oft nach "X"              → X bekommt höhere Relevanz
User ignoriert Trend-Vorschläge      → Schwellenwert anpassen
User bestätigt Szenario-Ergebnis     → Kausale Stärke verstärken
User widerspricht Klassifizierung    → Heuristik verfeinern
User definiert Kontext               → Alle Scores rekalibrieren
```

---

## 9. Datenfluss (End-to-End)

```
                    ┌──────────────┐
                    │   42+ Quellen │
                    │   11+ Connect.│
                    │   45+ Denker  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   SIGNAL     │  Fetch, Validate, Normalize
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  VERSTEHEN   │  Classify, Score, Ring
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  VERNETZEN   │  Kausal-Graph, Regulierung, Konvergenz
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ ANTIZIPIEREN │  Szenarien, Prediction Markets, Projektion
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   DIALOG     │  User fragt, System antwortet
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  FEEDBACK    │  System lernt aus User-Interaktion
                    └──────┘───────┘
                           │
                           └──→ zurück zu SIGNAL (Kreislauf)
```

---

## 10. Was das Modell NICHT ist

- Kein Orakel. Es behauptet nicht die Zukunft zu kennen.
- Kein Ersatz für menschliches Urteil. Es informiert Entscheidungen, trifft sie nicht.
- Keine Black Box. Jede Aussage ist auf Quellen zurückführbar.
- Kein statischer Report. Es lebt und verändert sich in Echtzeit.

## Was es IST

Eine **Denkmaschine**, die einem Menschen hilft, die Komplexität der Welt
zu durchdringen, ohne sich in ihr zu verlieren.

Beginnt mit einem leeren Prompt.
Endet mit einer fundierten Entscheidung.
