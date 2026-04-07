# SIS — Anwendungskonzept v2.0
## Strategic Intelligence System — Interaction Architecture

Version: 2.0
Date: 2026-04-08
Status: Konzept zur Freigabe


---

## 0. DESIGN-AXIOM

SIS ist ein **Denk-Instrument fuer strategische Zukunftsarbeit**.

Nicht ein Dashboard. Nicht ein News-Aggregator. Nicht ein Chatbot mit Quellenangaben.

Es ist ein Werkzeug das einem Strategen hilft, **bessere Entscheidungen zu treffen** —
durch belegbare Analysen, systematische Szenarien und einen visuellen Denkprozess.

Jede Designentscheidung muss diesen Test bestehen:
**Hilft das einem Strategen, schneller zu einer fundierteren Entscheidung zu kommen?**


---

## 1. NAVIGATION — DIE 3 RAEUME

### 1.1 Grundstruktur

```
[>_ Logo]          Cockpit          Werkstatt          Archiv          [Dark] [DE]
   |                  |                  |                 |
   Home               Beobachten        Denken+Bauen      Belegen
```

**Logo-Klick = Home (/)**. Kein eigener Nav-Punkt. Home ist die Frage-Eingabe.

**3 Raeume. Nicht mehr. Nicht weniger.**

| Raum | Route | Frage die er beantwortet | Metapher |
|------|-------|--------------------------|----------|
| **Cockpit** | /cockpit | "Was passiert da draussen?" | Kontrollzentrum — Ueberwachung, Fruehwarnung, Lagebild |
| **Werkstatt** | /werkstatt | "Was mache ich damit?" | Denkwerkstatt — Analysieren, Szenarien bauen, Entscheidungen treffen |
| **Archiv** | /archiv | "Woher wissen wir das?" | Quellenarchiv — Datenquellen, Methodik, Vertrauensbasis |

### 1.2 Warum diese 3?

Die 3 Raeume bilden den natuerlichen Denkfluss eines Strategen ab:

1. **Beobachten** (Cockpit): Was veraendert sich in meinem Umfeld?
2. **Verarbeiten** (Werkstatt): Was bedeutet das fuer meine Strategie?
3. **Belegen** (Archiv): Kann ich dem vertrauen? Woher kommt die Einschaetzung?

Fruehere Bezeichnungen "Verstehen/Arbeiten" waren zu abstrakt. "Cockpit/Werkstatt/Archiv" sind **Orte** — man weiss sofort was man dort findet.

### 1.3 Header-Konsistenz — EINE einzige Quelle

**Kritisches Problem heute:** Home und Canvas haben eigene Inline-Header. AppHeader wird nur von 4 Seiten verwendet. Canvas hat keinen Dark-Mode-Toggle, keinen Language-Switch, und linkt zu /wissen statt /verstehen.

**Loesung:** EIN zentraler Header. ALLE Seiten verwenden ihn.

```
┌─────────────────────────────────────────────────────────────────────┐
│ [>_ SIS]   Cockpit   Werkstatt   Archiv           [☾] [DE]        │
│            ~~~~~~~~                                                 │
│            (aktiver Raum = Unterstrichen, Lime)                     │
└─────────────────────────────────────────────────────────────────────┘
```

Auf Home (/): Kein Nav-Punkt unterstrichen.
Auf /cockpit: "Cockpit" unterstrichen.
Auf /werkstatt oder /werkstatt/canvas: "Werkstatt" unterstrichen.
Auf /archiv: "Archiv" unterstrichen.

Dark Mode Toggle und Sprach-Toggle sind IMMER sichtbar. Ueberall. Auch im Canvas.

### 1.4 Was mit den alten Routen passiert

| Alte Route | Neue Route | Typ |
|------------|-----------|-----|
| /verstehen | /cockpit | Redirect |
| /arbeiten | /werkstatt | Redirect |
| /quellen | /archiv | Redirect |
| /wissen | /cockpit | Redirect |
| /szenarien | /werkstatt (Szenarien sind Projekt-gebunden) | Redirect |
| /canvas | /werkstatt/canvas | Redirect oder Embed |
| /feed, /trends, /sources, /historie, /beispiele, /projects | Alle loeschen/redirecten | Cleanup |
| / | / (unveraendert, gesperrt) | Bleibt |
| /briefing | /briefing (Print-Export, kein Nav-Punkt) | Bleibt |


---

## 2. HOME (/) — DER FRAGE-EINSTIEG

### 2.1 Zweck
"Ich habe eine strategische Frage. Gib mir eine fundierte Antwort."

Home ist NICHT der Arbeitsplatz. Home ist der **Einstiegspunkt**. Der Stratege kommt, stellt eine Frage, bekommt eine Analyse. Von dort geht es weiter.

### 2.2 Was Home zeigt

**Erstbesuch:**
- Headline: "Welche strategische Frage beschaeftigt dich?"
- Suchleiste mit blinkendem Cursor
- Vorschlags-Chips (KI-Regulierung EU, Energiewende 2030, etc.)
- Framework-Cards (Marktanalyse, War-Gaming, Pre-Mortem, etc.)

**Nach einer Analyse:**
- Briefing-Ergebnis: Synthese, Szenarien, Kausalketten, Quellen, Folgefragen
- "Im Canvas oeffnen" Button → Wechsel zum Canvas-Tab INNERHALB derselben Seite
- "Zum Projekt speichern" → Speichert in aktives Projekt

### 2.3 Der View-Switcher auf Home

Home hat 3 Ansichtsmodi auf dieselben Daten:

```
● Standard    ⊞ Canvas    ☰ Board
```

Das sind **KEINE separaten Seiten oder Menue-Punkte**. Es sind Tabs/Ansichten desselben Arbeitsbereichs. Wie in einer IDE: Code-View, Visual-View, Outline-View — gleiche Daten, andere Darstellung.

| Ansicht | Zweck | Was man sieht |
|---------|-------|---------------|
| **Standard** | Lesen + Verstehen | Briefing-Ergebnis als strukturierter Text (Synthese, Szenarien, Quellen) |
| **Canvas** | Denken + Strukturieren | Nodes auf raeumlicher Arbeitsflaeche — frei positionierbar, verbindbar |
| **Board** | Ordnen + Priorisieren | Kanban-Spalten nach Denkphase (Fragen → Erkenntnisse → Szenarien → Entscheidungen) |

**Wichtig:** Jede Analyse die in Standard-Ansicht entsteht, erzeugt automatisch Nodes im Canvas und Karten im Board. Die 3 Ansichten sind **synchron**.

### 2.4 Folgefragen — Der Denkfluss

Jede Analyse generiert 3-5 Folgefragen. **Diese muessen funktionieren** — Klick auf eine Folgefrage stellt sie als neue Analyse, verknuepft mit der Eltern-Analyse.

Folgefragen sind kein Dekoelement. Sie sind der Kern des "Denk-Instruments": Jede Antwort oeffnet neue Fragen. Der Stratege folgt dem Gedankenfluss tiefer.

### 2.5 Was Home NICHT ist

- Kein Trend-Radar (das ist Cockpit)
- Kein Projektmanagement (das ist Werkstatt)
- Kein Quellenregister (das ist Archiv)

Home wird NICHT mehr veraendert (gesperrt). Aenderungen nur auf explizite Aufforderung.


---

## 3. COCKPIT (/cockpit) — DAS LAGEBILD

### 3.1 Zweck
"Was passiert in meinem strategischen Umfeld? Wo ist Bewegung? Was verbindet sich?"

Der Stratege kommt ins Cockpit nicht mit einer konkreten Frage, sondern mit dem Beduerfnis **die Landschaft zu ueberblicken**. Wie ein Pilot der seine Instrumente checkt bevor er fliegt.

### 3.2 Drei Linsen (nicht Tabs)

Das Cockpit zeigt **eine Datenbasis** (39 Trends, ihre Signale, ihre Beziehungen) durch **drei optische Linsen**:

| Linse | Icon | Was man sieht | Frage die sie beantwortet |
|-------|------|---------------|---------------------------|
| **Radar** | ◎ | Ring-Chart (adopt/trial/assess/hold) mit Trend-Dots | "Wo steht jeder Trend im Reifezyklus?" |
| **Netzwerk** | ⬡ | D3 Force-Graph der Kausalbeziehungen | "Was treibt was? Wo gibt es Verstaerkungsschleifen?" |
| **Trends** | ≡ | Suchbare Karten-Liste, gruppiert nach Cluster oder Ring | "Welche konkreten Trends gibt es und wie performen sie?" |

**Linsen-Wechsel** ist ein Perspektivwechsel, kein Seitenwechsel. Der ausgewaehlte Trend bleibt ausgewaehlt wenn man die Linse wechselt.

### 3.3 Was aus dem alten /verstehen eliminiert wird

- **Signale-Tab**: Wird KEIN eigener Tab. Signale erscheinen als Evidenz innerhalb des Trend-Detail-Panels. Signale sind Belege FUER Trends, nicht eine parallele Kategorie.
- **Quellen-Tab**: War fast leer (nur ein Link). Quellen haben ihren eigenen Raum: Archiv.

### 3.4 Progressive Disclosure im Cockpit

**L1 — Cockpit-Header (immer sichtbar):**
- Linsen-Switcher (Radar | Netzwerk | Trends)
- System-Stats: "39 Trends · 19 steigend · 968 Signale · Letzte Aktualisierung: vor 2h"
- Quick-Search innerhalb der Landschaft

**L2 — Linsen-Inhalt (Hauptansicht):**
- Radar: SVG Ring-Chart, volle Breite, Sidebar mit sortierbarer Trend-Liste
- Netzwerk: D3 Force-Graph, volle Breite, interaktiv (drag, zoom, focus)
- Trends: Card-Grid mit Suche, Sort, Group-By Toggle (Cluster vs. Ring)

**L3 — Trend-Detail (Slide-In Panel):**
Klick auf einen Trend (in jeder Linse) oeffnet ein Panel von rechts (400px):
1. Trend-Header: Name, Ring-Badge, Velocity-Arrow, STEEP+V Kategorie
2. Score-Block: Relevanz, Impact, Konfidenz als horizontale Balken
3. Cluster-Zugehoerigkeit
4. Kausale Verbindungen: "Treibt X", "Verstaerkt durch Y", "Gedaempft durch Z"
5. Letzte 5-10 Signale mit Quelle, Titel, Timestamp
6. **Aktionen:** "Frage stellen ueber [Trend]" → Home mit Pre-Fill. "Zum Projekt" → Werkstatt.

**L4 — Trend-Dossier (Full Page):**
/cockpit/[trendId] — Vollstaendige Trend-Seite mit:
- Alles aus L3 plus:
- Zeitverlauf-Chart (Trend-Score ueber Zeit)
- Vollstaendige Signal-Historie
- Mini-Kausalnetz (1-Hop Nachbarn)
- Regulatorischer Kontext (EU AI Act, etc.)

### 3.5 Interaktionsmodell

| Aktion | Ergebnis | Kontext |
|--------|----------|---------|
| Linse wechseln | Ueberblendung, selber Trend bleibt selektiert | Erhalten |
| Trend klicken | Panel slides in von rechts | Erhalten — Linse bleibt sichtbar |
| In Panel: Kausale Verbindung klicken | Panel wechselt zum verlinkten Trend | Erhalten — Breadcrumb |
| In Panel: "Frage stellen" | Navigation zu / mit Pre-Fill | Teilweise — Browser-Back kehrt zurueck |
| In Panel: "Vertiefen" | Navigation zu /cockpit/[trendId] | Teilweise — Breadcrumb |
| In Panel: "Zum Projekt" | Trend wird im aktiven Projekt gespeichert | Erhalten |
| Radar: Hover auf Trend-Dot | Tooltip mit Name, Ring, Velocity, Signalanzahl | Transient |
| Netzwerk: Hover auf Node | Connected Edges hervorgehoben | Transient |
| Netzwerk: Klick auf Node | Panel oeffnet + Node fokussiert (dimmt Rest) | Erhalten |


---

## 4. WERKSTATT (/werkstatt) — DER DENKARBEITSPLATZ

### 4.1 Zweck
"Ich habe Informationen gesammelt. Jetzt denke ich, strukturiere, entscheide."

Die Werkstatt ist der Ort wo aus Beobachtungen (Cockpit) und Analysen (Home) **eigene Strategie** wird. Hier wird nicht gelesen, sondern **gebaut**.

### 4.2 Das Projekt als Container

Alles in der Werkstatt existiert innerhalb eines **Projekts**. Es gibt keine losgeloesten Szenarien, keinen losgeloesten Canvas. Ein Projekt ist:

```
PROJEKT: "Markteintritt Asien 2027"
├── Analysen (gespeicherte Fragen+Antworten von Home)
├── Szenarien (generiert oder manuell erstellt)
├── Notizen (eigene Gedanken, Markdown)
├── Canvas (raeumliche Arbeitflaeche mit Nodes)
└── Briefing (exportierbares Summary)
```

### 4.3 Die 4 Ansichtsmodi des Arbeitsplatzes

Innerhalb eines Projekts gibt es **4 Ansichten auf dieselben Daten**:

```
⊞ Canvas    ☰ Board    ⏱ Timeline    ⬡ Orbit
```

| Modus | Zweck | Wann nutzt man ihn? |
|-------|-------|---------------------|
| **Canvas ⊞** | Raeumliches Denken — Nodes frei positionieren, verbinden, annotieren | Wenn man den Ueberblick braucht, Zusammenhaenge visuell erforschen |
| **Board ☰** | Strukturiertes Ordnen — Kanban-Spalten nach Denkphase | Wenn man priorisieren will: "Was habe ich? Was fehlt? Was ist entschieden?" |
| **Timeline ⏱** | Chronologisches Nachvollziehen — Gedankenverlauf in zeitlicher Reihenfolge | Wenn man den Denkprozess dokumentieren oder uebergeben will |
| **Orbit ⬡** | Systemisches Denken — Kausal-Netzwerk der Analyse-Trends | Wenn man Wechselwirkungen zwischen den analysierten Themen verstehen will |

**Alle 4 Modi zeigen dieselben Nodes.** Erstelle ich einen Insight-Node im Canvas, erscheint er als Karte im Board, als Eintrag in der Timeline, und als Node im Orbit.

### 4.4 Node-Typen und Farbcodierung

**KRITISCH: Farben muessen ueber ALLE Ansichten konsistent sein.**

| Node-Typ | Farbe | Icon | Entsteht durch |
|----------|-------|------|----------------|
| **Query** (Frage) | Mint (#1A9E5A) | ? | Analyse auf Home stellen |
| **Insight** (Erkenntnis) | Lime (#6B7A00) | ✦ | LLM-Extraktion aus Analyse |
| **Scenario** (Szenario) | Sky (#1D4ED8) | ◇ | LLM-generiert oder manuell |
| **Decision** (Entscheidung) | Mint-Dark (#1A9E5A) | ✓ | User markiert als Entscheidung |
| **Follow-Up** (Folgefrage) | Grau (#6B7280) | → | LLM-generiert, klickbar |
| **Analysis** (Dimensionen/Kausal) | Blue (#3B82F6) | ◈ | LLM-generierte Analyse-Bausteine |
| **Note** (Notiz) | Amber (#F5A623) | ✏ | User erstellt manuell |

Diese Farben gelten:
- Im Canvas (Node-Rahmen + Dot)
- Im Board (Spalten-Header-Dot + Karten-Rahmen)
- In der Timeline (Zeitpunkt-Dot)
- Im Orbit (Node-Farbe)
- In Tags (Offen/Aktiv/Entschieden/Gepinnt)
- Im Standard-Briefing (Section-Labels)

### 4.5 Kanban-Board Spalten

Die Board-Ansicht organisiert Nodes in 7 Spalten nach Denkphase:

```
│ FRAGEN │ ERKENNTNISSE │ SZENARIEN │ ENTSCHEIDUNGEN │ FOLGEFRAGEN │ ANALYSE │ NOTIZEN │
│ (Mint) │   (Lime)     │  (Sky)    │    (Mint-D)    │   (Grau)    │ (Blue)  │ (Amber) │
│        │              │           │                │             │         │         │
│ Card   │ Card         │ Card      │ Card           │ Card        │ Card    │ Card    │
│ Card   │ Card         │           │                │ Card        │         │ Card    │
│        │ Card         │           │                │             │         │         │
```

Spalten-Count oben rechts zeigt Anzahl. Leere Spalten signalisieren Luecken:
"Ich habe 5 Fragen und 9 Erkenntnisse aber 0 Entscheidungen → ich muss Entscheidungen treffen."

### 4.6 Canvas — Raeumliche Arbeitflaeche

**Bekannte Probleme die geloest werden muessen:**

1. **Karten-Ueberlappung:** Nodes duerfen sich NICHT ueberlappen. Bei neuen Nodes:
   - Auto-Layout-Funktion die Nodes intelligent platziert (Spalten nach Typ, Reihen nach Zeit)
   - "Sortieren" Button der alle Nodes in ein sauberes Grid bringt
   - Snap-to-Grid Option

2. **Punkte-Grid im Hintergrund:** Muss bei Zoom mitskalieren. Aktuell statisch.

3. **Abstands-Regeln:** Minimaler Abstand zwischen Nodes = 20px. Beim Drag: Magnetisches Snapping an Grid-Linien.

### 4.7 Tags und Status-System

Jeder Node hat einen Status-Tag:

| Tag | Icon | Farbe | Bedeutung |
|-----|------|-------|-----------|
| **Offen** | ▫ | Grau | Noch nicht bearbeitet |
| **Aktiv** | ● | Blau | Wird gerade bearbeitet |
| **Entschieden** | ✓ | Gruen | Abgeschlossen, Entscheidung getroffen |
| **Gepinnt** | ★ | Gelb | Wichtig, soll nicht untergehen |

**Diese Tags funktionieren in ALLEN 4 Ansichtsmodi identisch:**
- Canvas: Badge auf dem Node
- Board: Badge auf der Karte + filterbarer Quick-Filter oben
- Timeline: Status-Icon neben dem Zeitpunkt
- Orbit: Node-Ring-Farbe aendert sich

### 4.8 Werkstatt ohne Projekt

Wenn kein Projekt aktiv ist, zeigt /werkstatt:
- Projekt-Liste (Cards mit Name, letztes Update, Anzahl Analysen/Notizen)
- "Neues Projekt" Button
- Leerer Zustand mit Erklaerung

### 4.9 Was mit /szenarien passiert

Die eigenstaendige /szenarien Seite wird **aufgeloest**. Szenarien existieren nur noch im Projekt-Kontext.

Begruendung: Ein Szenario ohne Kontext ist bedeutungslos. "Optimistisches KI-Szenario" — fuer welches Projekt? Welche Frage? Szenarien gehoeren zu einer Analyse, nicht in ein globales Register.

Was erhalten bleibt:
- Szenario-Cards mit Typ-Badge (Optimistisch/Basis/Pessimistisch)
- What-If Simulation (Szenario anwenden → Trend-Verschiebungen sehen)
- Vergleichs-Modus (2-3 Szenarien nebeneinander)
- "Vertiefen/Was-wenn/Angreifen/Strategie" Aktionen

Aber alles innerhalb des Projekts, nicht als freistehende Seite.

### 4.10 Interaktionsmodell

| Aktion | Ergebnis | Kontext |
|--------|----------|---------|
| Projekt oeffnen | 4-Modi-Arbeitsplatz mit allen Nodes | Projekt wird "aktiv" (global sichtbar) |
| Modus wechseln (Canvas/Board/Timeline/Orbit) | Gleiche Nodes, andere Darstellung | Erhalten — selektierter Node bleibt selektiert |
| Node klicken | Detail-Panel rechts oder Modal | Erhalten |
| Node Doppelklick im Board | Wechsel zu Canvas, zentriert auf diesen Node | Erhalten |
| "Frage stellen" in Node-Detail | Navigation zu / mit Pre-Fill + Projekt-Kontext | Aktives Projekt erhalten |
| "Briefing exportieren" | /briefing oeffnet in neuem Tab | Neuer Tab |
| Folgefrage klicken | Wird als NEUE Analyse ausgefuehrt, neuer Query-Node entsteht | Erhalten — verknuepft mit Eltern-Node |
| Tag aendern (Offen→Aktiv→Entschieden) | Sofortige Aktualisierung in allen 4 Modi | Erhalten |


---

## 5. ARCHIV (/archiv) — DIE VERTRAUENSBASIS

### 5.1 Zweck
"Woher kommen die Daten? Kann ich dem vertrauen? Wie funktioniert das System?"

Das Archiv ist der Ort fuer Transparenz. Ein Strategieberater muss seinem Klienten erklaeren koennen: "Diese Einschaetzung basiert auf X Quellen mit Y Methodik."

### 5.2 Was das Archiv zeigt

**Die existierende /quellen Seite ist gut.** Sie wird zum Archiv mit 3 Bereichen:

**Bereich 1: Datenquellen (bereits gebaut)**
- 64 Quellen mit Status (Integriert/Neu/Geplant/Deaktiviert)
- Filter nach Kategorie, Status, Auth-Typ
- Live-Stats: Aktive Connectors, Signal-Count, letzte Aktualisierung

**Bereich 2: Methodik (neu)**
- Wie werden Trends klassifiziert? (Ring-Zuordnung, STEEP+V)
- Wie wird Konfidenz berechnet? (Quellengewichtung, Signal-Staerke)
- Wie funktioniert die Kausalanalyse?
- Wie werden Szenarien generiert?

**Bereich 3: Datenqualitaet (neu)**
- Welche Quellen sind aktuell erreichbar?
- Wann war die letzte Aktualisierung pro Quelle?
- Welche Quellen haben die meisten Signale geliefert?
- Fehlende API-Keys / deaktivierte Connectors

### 5.3 Interaktionsmodell

| Aktion | Ergebnis |
|--------|----------|
| Quelle klicken | Detail-Ansicht: Beschreibung, API-Status, letzte Signale, welche Trends diese Quelle fuettert |
| "Welche Trends nutzen diese Quelle?" | Filter-Link zu /cockpit mit Quellen-Filter |
| Methodik-Section oeffnen | Erklaerende Texte mit Diagrammen |


---

## 6. TOOLTIPS — DURCHGEHEND

### 6.1 Prinzip
Jedes UI-Element das nicht selbsterklaerend ist, bekommt einen Tooltip. Tooltips sind NICHT optional — sie sind Teil des Interface-Designs.

### 6.2 Wo Tooltips fehlen (aktuell)

- Konfidenz-Wert: Was bedeutet 72%? → "72% Konfidenz: Basiert auf 12 Quellen. 3 Trends haben < 60% Einzel-Konfidenz."
- Ring-Labels (Adopt/Trial/Assess/Hold): Was bedeuten sie? → "Adopt: Trend ist reif fuer den Einsatz"
- Velocity-Pfeile (↑/→/↓): → "Steigend: Relevanz hat in den letzten 30 Tagen zugenommen"
- STEEP+V Kategorien: → "S = Social, T = Technological, E = Economic, ..."
- Szenario-Typ-Badges: → "Optimistisch: Bestes realistisches Ergebnis (Wahrscheinlichkeit: 25%)"
- Canvas-Toolbar Buttons
- Board-Spalten-Headers
- Node-Typ-Icons
- Score-Balken in Trend-Details
- Signal-Quellen-Badges

### 6.3 Tooltip-Design

Volt-konform:
- Background: var(--volt-text) (dunkel auf hell, hell auf dunkel)
- Text: var(--volt-surface) (invertiert)
- Font: var(--volt-font-ui), 12px
- Padding: 6px 10px
- Border-Radius: var(--volt-radius-sm)
- Delay: 400ms (nicht sofort, nicht zu spaet)
- Position: Bevorzugt unten, Fallback oben


---

## 7. FARBCODIERUNG — KONSISTENZ UEBER ALLE ANSICHTEN

### 7.1 Das Problem heute

Farben sind inkonsistent:
- Scenario-Typen haben in ScenarioSelector andere Farben als auf der Szenarien-Seite
- Node-Typen im Canvas haben keine direkte Entsprechung zu den Farben im Standard-Briefing
- Signal-Quellen-Badges nutzen Brand-Farben die nicht ins Pastel-System passen
- Gelbe Hintergruende auf dem Signale-Tab passen nicht zum Rest

### 7.2 Das einheitliche Farbsystem

**Semantische Farben (Status/Bewertung):**
| Semantik | Token | Hex (Light) | Verwendung |
|----------|-------|-------------|------------|
| Positiv/Steigend | --signal-positive | #1A9E5A | Rising-Arrows, Adopt-Ring, Positive Szenarien |
| Negativ/Fallend | --signal-negative | #E8402A | Falling-Arrows, Pessimistische Szenarien, Warnungen |
| Neutral/Stabil | --signal-neutral | #6B7280 | Stabile Trends, Hold-Ring |
| Warnung/Aufmerksamkeit | --pastel-butter-text | #7A5C00 | Assess-Ring, Wildcard-Szenarien |

**Szenario-Farben (immer gleich, ueberall):**
| Szenario-Typ | Background | Text | Border |
|--------------|------------|------|--------|
| Optimistisch | --pastel-mint | --pastel-mint-text | --pastel-mint-border |
| Basis | --pastel-sky | --pastel-sky-text | --pastel-sky-border |
| Pessimistisch | --pastel-rose | --signal-negative | --pastel-rose-border |
| Wildcard | --pastel-butter | --pastel-butter-text | --pastel-butter-border |

**Node-Typ-Farben (Canvas/Board/Timeline/Orbit):**
Siehe Abschnitt 4.4 — eine Tabelle die fuer ALLE Ansichten gilt.

**Ring-Farben (Radar/Cockpit):**
| Ring | Farbe | Token |
|------|-------|-------|
| Adopt | Gruen | Eigener Token, bereits in RING_COLORS |
| Trial | Blau | Eigener Token |
| Assess | Gelb/Amber | Eigener Token |
| Hold | Grau | Eigener Token |

### 7.3 Keine Hintergrund-Flaechen-Faerbung

Grosse farbige Hintergruende (wie die gelben Felder im Signale-Tab) sind verboten. Farbe wird eingesetzt als:
- Badges (kleine Pillen mit Hintergrund)
- Border-Left (3px Akzentlinie)
- Dots (kleine Kreise als Status-Indikator)
- Icons/Text-Farbe

NICHT als:
- Ganzseitige Hintergruende
- Karten-Hintergruende (ausser subtile Hover-States)
- Tabellen-Zeilen-Hintergruende


---

## 8. UEBERGAENGE ZWISCHEN RAEUMEN

### 8.1 Der Denkfluss

```
Home (Frage stellen)
  │
  ├─→ Ergebnis lesen (Standard)
  │     ├─→ Trend-Chip klicken → Cockpit /cockpit/[trendId]
  │     ├─→ "Im Canvas oeffnen" → Home wechselt zu Canvas-Tab
  │     ├─→ "Zum Projekt" → Speichert in Werkstatt
  │     └─→ Folgefrage klicken → Neue Analyse auf Home
  │
  ├─→ Canvas-Ansicht (Home)
  │     ├─→ Node doppelklicken → Detail-Modal
  │     └─→ "In Werkstatt oeffnen" → /werkstatt mit diesem Projekt
  │
  └─→ Board-Ansicht (Home)
        └─→ Karte klicken → Detail-Modal

Cockpit (Lagebild)
  │
  ├─→ Trend klicken → Slide-In Panel
  │     ├─→ "Frage stellen" → Home mit Pre-Fill
  │     ├─→ "Zum Projekt" → Werkstatt
  │     └─→ "Vertiefen" → /cockpit/[trendId]
  │
  └─→ Linse wechseln → Gleiche Daten, andere Darstellung

Werkstatt (Denkarbeitsplatz)
  │
  ├─→ Projekt oeffnen → 4-Modi Arbeitsplatz
  │     ├─→ Canvas/Board/Timeline/Orbit wechseln → Gleiche Nodes
  │     ├─→ Node-Detail → Modal mit Inhalt + Aktionen
  │     ├─→ "Frage stellen" → Home mit Projekt-Kontext
  │     ├─→ What-If Simulation → Cockpit mit Szenario-Overlay
  │     └─→ "Briefing" → /briefing in neuem Tab
  │
  └─→ Projekt-Liste → Neues Projekt / Projekt wechseln

Archiv (Quellenregister)
  │
  ├─→ Quelle klicken → Detail mit Signalen
  │     └─→ "Welche Trends?" → Cockpit mit Filter
  └─→ Methodik → Erklaerende Sektion
```

### 8.2 Kontext-Erhaltung

**Regel 1:** Slide-In Panels navigieren NIE weg. Die Seite bleibt im Hintergrund.
**Regel 2:** Full-Page Navigation zeigt Breadcrumb: "Cockpit > Trend: AI Governance"
**Regel 3:** Aktives Projekt ist global sichtbar (kleiner Badge im Header)
**Regel 4:** Browser-Back funktioniert immer und kehrt zum vorherigen Zustand zurueck


---

## 9. IMPLEMENTATION — REIHENFOLGE

### Phase 1: Navigation + Konsolidierung
1. Neuen Header bauen: Cockpit | Werkstatt | Archiv (EINE Komponente fuer ALLE Seiten)
2. Routes umbenennen: /verstehen → /cockpit, /arbeiten → /werkstatt, /quellen → /archiv
3. Alte Routen als Redirects behalten
4. Canvas-Header durch globalen Header ersetzen
5. /szenarien in Werkstatt integrieren, Route als Redirect

### Phase 2: Cockpit bereinigen
6. Verstehen-Seite auf 3 Linsen reduzieren (Signale-Tab + Quellen-Tab entfernen)
7. Intelligence Feed nur als Evidenz im Trend-Detail-Panel
8. Trend-Detail Panel: Aktionen hinzufuegen ("Frage stellen", "Zum Projekt")

### Phase 3: Werkstatt stabilisieren
9. Canvas: Auto-Layout Funktion (Nodes nicht ueberlappen)
10. Canvas: Grid-Skalierung bei Zoom
11. Folgefragen: Bug fixen — muessen als neue Analyse funktionieren
12. Tags: Konsistente Funktionalitaet ueber alle 4 Modi
13. Board-Spalten: Farben konsistent mit Node-Typ-System

### Phase 4: Tooltips + Farbkonsistenz
14. Tooltip-System implementieren (Volt-konform)
15. Farbkodierung vereinheitlichen (eine Quelle der Wahrheit)
16. Gelbe Hintergruende eliminieren
17. Design-Audit aller Ansichten

### Phase 5: Archiv + Trust
18. /archiv mit Methodik-Sektion
19. Konfidenz-Tooltips ("Warum nicht hoeher?")
20. Quellen-Provenance in Analyse-Ergebnissen


---

## 10. OFFENE FRAGEN

1. Soll der View-Switcher (Standard/Canvas/Board) auf Home bleiben oder in die Werkstatt wandern?
2. Braucht das Cockpit eine "Was ist neu seit meinem letzten Besuch?" Funktion?
3. Soll es eine Command-Bar (Cmd+K) geben fuer Power-User?
4. Wie wird das aktive Projekt visuell im Header angezeigt?
5. Braucht der Signal-Ticker (unteres Laufband) eine Klick-Funktion?
