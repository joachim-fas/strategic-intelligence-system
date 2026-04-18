/**
 * seedData — hand-crafted canvas fixtures for demo mode and the
 * `test` command-line shortcut.
 *
 *   - `buildTestDataset()` is triggered when the user types "test" in
 *     the canvas command-line and produces a full reference canvas
 *     with every card type, two connected query trees, and annotated
 *     notes that explain what each card is for.
 *   - `buildDemoProject()` is currently unreferenced (never called as
 *     of 2026-04-18; likely a leftover from an earlier onboarding
 *     prototype). Kept for now so the intention is preserved in git
 *     history, but it's a candidate for removal in a follow-up pass.
 *
 * Extracted from `page.tsx` as part of the canvas-decomposition work
 * that began with slices 1–4 of the 18.04.2026 audit (A5-H7).
 */

"use client";

import {
  DERIVED_COL_GAP,
  DERIVED_COL_GAP_X,
  DERIVED_W,
  QUERY_NODE_W,
} from "./constants";
import type {
  CanvasNode,
  Connection,
  DerivedNode,
  NoteNode,
  QueryNode,
} from "./types";
import type {
  DimensionEntry,
  MatchedEdge,
  QueryResult,
  UsedSignal,
} from "@/types";

// ── Test Dataset ──────────────────────────────────────────────────────────
//
// Aufruf: Einfach "test" in die Command-Line eingeben.
// Erzeugt einen vollständigen Beispiel-Datensatz mit allen Kartentypen,
// zwei verbundenen Abfrage-Bäumen und annotierten Karten die erklären
// was jeder Kartentyp ist und warum er existiert.
//
export function buildTestDataset(): { nodes: CanvasNode[]; conns: Connection[] } {
  const now = Date.now();

  // Feste IDs damit der Datensatz reproduzierbar bleibt
  const Q1 = "test-q1", Q2 = "test-q2";
  const I1 = "test-i1", I2 = "test-i2";
  const DEC1 = "test-dec1";
  const FQ1 = "test-fq1";
  const S_OPT = "test-s-opt", S_BASE = "test-s-base", S_PESS = "test-s-pess", S_WILD = "test-s-wild";
  const I3 = "test-i3", DEC2 = "test-dec2", S2 = "test-s2", FQ2 = "test-fq2";
  const NOTE1 = "test-note1", IDEA1 = "test-idea1", LIST1 = "test-list1";

  // Layout: Q1 oben-links, Q2 darunter (gleiche X-Spalte, vertieft)
  // Derived-Karten rechts davon in zwei Spalten (wie computeDerivedNodes)
  const Q1X = 80,  Q1Y = 80;
  const Q2X = 80,  Q2Y = 700;
  const CAX = Q1X + QUERY_NODE_W + DERIVED_COL_GAP_X; // = 572
  const CBX = CAX + DERIVED_W + DERIVED_COL_GAP;       // = 844

  const nodes: CanvasNode[] = [

    // ══════════════════════════════════════════════════════════════════════
    // ABFRAGE 1 — Haupt-Query
    // Erklärt: Was ist eine Abfrage-Karte? Wie sieht eine fertige Analyse aus?
    // ══════════════════════════════════════════════════════════════════════
    {
      id: Q1, nodeType: "query",
      x: Q1X, y: Q1Y,
      query: "KI-Automatisierung: Wie verändert sich die Arbeitswelt bis 2030?",
      locale: "de", status: "done", collapsed: false,
      synthesis:
        "ABFRAGE-KARTE — Status: ✓ Abgeschlossen. " +
        "Diese Karte ist der Startpunkt einer vollständigen KI-Analyse. " +
        "Der grüne Balken oben zeigt: Analyse fertig. " +
        "Klicken → Detail-Panel öffnet sich rechts. " +
        "'+' Button → Iteration / Folgefrage starten. " +
        "Die Kinder-Karten rechts (Erkenntnisse, Szenarien, Empfehlung, Folgefragen) " +
        "wurden automatisch aus dem Analyse-Ergebnis generiert.",
      result: {
        synthesis:
          "KI wird bis 2030 ca. 30–40% aller Routinetätigkeiten automatisieren. " +
          "Gleichzeitig entstehen neue Berufsfelder rund um KI-Koordination, Ethikprüfung und Mensch-Maschine-Kollaboration. " +
          "Der Nettoeffekt hängt entscheidend von der Geschwindigkeit der Umschulungssysteme ab.",
        confidence: 0.82,
        keyInsights: [
          "30–40% aller Bürotätigkeiten bis 2030 automatisierbar",
          "Neue Berufe: KI-Trainer, Ethik-Prüfer, Human-AI-Koordinatoren",
          "Umschulungsgeschwindigkeit ist der kritische Engpass",
        ],
      },
      createdAt: now - 3_600_000,
    },

    // ══════════════════════════════════════════════════════════════════════
    // ERKENNTNIS-KARTEN (linke Spalte / ColA) — generiert aus Q1
    // Erklärt: Was ist eine Erkenntnis? Wo erscheint sie? Wie nutzt man sie?
    // ══════════════════════════════════════════════════════════════════════
    {
      id: I1, nodeType: "insight",
      x: CAX, y: Q1Y,
      parentId: Q1, queryText: "KI und Arbeitswelt",
      content:
        "ERKENNTNIS-KARTE — Extrahiert eine Kernaussage aus der Analyse. " +
        "Erscheint immer in der linken Spalte direkt rechts neben der Abfrage. " +
        "→ 30–40% aller Bürotätigkeiten (Buchhaltung, Datenerfassung, einfache Texterstellung) " +
        "sind bis 2030 durch LLMs + Robotik ersetzbar. " +
        "Betroffen: mittlere Qualifikationsstufen ohne Spezialisierung.",
      createdAt: now - 3_590_000,
    } as DerivedNode,

    {
      id: I2, nodeType: "insight",
      x: CAX, y: Q1Y + 100,
      parentId: Q1, queryText: "KI und Arbeitswelt",
      content:
        "ERKENNTNIS-KARTE (zweite) — Eine Abfrage erzeugt typisch 2–4 Erkenntnisse, " +
        "die vertikal gestapelt erscheinen. " +
        "→ Gleichzeitig entstehen 12–18M neue Jobs bis 2030 in KI-nahen Bereichen. " +
        "Netto-Jobeffekt in DE: -800K bis +300K je nach Szenario (McKinsey 2024).",
      createdAt: now - 3_589_000,
    } as DerivedNode,

    // ══════════════════════════════════════════════════════════════════════
    // EMPFEHLUNG (linke Spalte, unter Erkenntnissen) — generiert aus Q1
    // Erklärt: Wozu dient eine Empfehlungs-Karte?
    // ══════════════════════════════════════════════════════════════════════
    {
      id: DEC1, nodeType: "decision",
      x: CAX, y: Q1Y + 212,
      parentId: Q1, queryText: "KI und Arbeitswelt",
      content:
        "EMPFEHLUNG-KARTE — Leitet konkrete Handlungsschritte aus der Analyse ab. " +
        "Erscheint nach den Erkenntnissen in der linken Spalte. " +
        "→ Sofortmaßnahmen: (1) Weiterbildungsbudget um 40% erhöhen, " +
        "(2) Interne KI-Champions in allen Abteilungen benennen, " +
        "(3) Pilotprojekt für KI-Assistenz in Sachbearbeitung starten. Zeithorizont: 12 Monate.",
      createdAt: now - 3_588_000,
    } as DerivedNode,

    // ══════════════════════════════════════════════════════════════════════
    // FOLGEFRAGE (linke Spalte, unterste) — generiert aus Q1
    // Erklärt: Wie funktioniert die Folgefrage → neue Abfrage?
    // ══════════════════════════════════════════════════════════════════════
    {
      id: FQ1, nodeType: "followup",
      x: CAX, y: Q1Y + 324,
      parentId: Q1, queryText: "Welche Berufe und Branchen verschwinden bis 2030?",
      content:
        "FOLGEFRAGE-KARTE — KI schlägt die nächste logische Vertiefung vor. " +
        "'+' klicken → neue Abfrage mit diesem Text vorausfüllen. " +
        "→ Welche Berufe und Branchen verschwinden bis 2030? " +
        "(Diese Frage wurde bereits vertieft — siehe Abfrage 2 unten!)",
      createdAt: now - 3_587_000,
    } as DerivedNode,

    // ══════════════════════════════════════════════════════════════════════
    // SZENARIEN (rechte Spalte / ColB) — generiert aus Q1
    // Erklärt: Vier Szenario-Typen mit Farben und Wahrscheinlichkeiten
    // ══════════════════════════════════════════════════════════════════════
    {
      id: S_OPT, nodeType: "scenario", colorKey: "optimistic",
      x: CBX, y: Q1Y,
      parentId: Q1, queryText: "KI und Arbeitswelt",
      probability: 0.25,
      label: "Soft Landing",
      content:
        "OPTIMISTISCH-SZENARIO (25%) — Grün, beste realistische Entwicklung. " +
        "→ Weiterbildungssysteme skalieren rechtzeitig. Neue Jobs entstehen schneller als alte wegfallen. " +
        "Reallöhne steigen durch Produktivitätsgewinne. Europa führt bei KI-Ethikstandards.",
      createdAt: now - 3_586_000,
    } as DerivedNode,

    {
      id: S_BASE, nodeType: "scenario", colorKey: "baseline",
      x: CBX, y: Q1Y + 100,
      parentId: Q1, queryText: "KI und Arbeitswelt",
      probability: 0.45,
      label: "Graduelle Transformation",
      content:
        "BASISFALL-SZENARIO (45%) — Blau, wahrscheinlichstes Outcome. " +
        "→ Langsame, ungleichmäßige Anpassung über 8–12 Jahre. " +
        "Fachkräftemangel in KI-Berufen parallel zu Überangebot in Routinetätigkeiten. " +
        "Staat muss aktiv mit Umschulungsprogrammen moderieren.",
      createdAt: now - 3_585_000,
    } as DerivedNode,

    {
      id: S_PESS, nodeType: "scenario", colorKey: "pessimistic",
      x: CBX, y: Q1Y + 212,
      parentId: Q1, queryText: "KI und Arbeitswelt",
      probability: 0.22,
      label: "Strukturkrise",
      content:
        "PESSIMISTISCH-SZENARIO (22%) — Rot, ungünstigste realistische Entwicklung. " +
        "→ Automatisierungsgeschwindigkeit überholt Anpassungsfähigkeit. " +
        "Strukturelle Arbeitslosigkeit bei 45–60-Jährigen ohne MINT-Hintergrund. " +
        "Soziale Spannungen steigen, politischer Backlash gegen KI.",
      createdAt: now - 3_584_000,
    } as DerivedNode,

    {
      id: S_WILD, nodeType: "scenario", colorKey: "wildcard",
      x: CBX, y: Q1Y + 324,
      parentId: Q1, queryText: "KI und Arbeitswelt",
      probability: 0.08,
      label: "EU-Regulierungsschock",
      content:
        "WILDCARD-SZENARIO (8%) — Gelb, unwahrscheinlich aber wirkungsmächtig. " +
        "→ EU verabschiedet nach KI-Skandal strikte Verbote für KI in Entscheidungsprozessen. " +
        "Temporäre Job-Stabilisierung, aber massiver Wettbewerbsnachteil gegenüber USA und Asien.",
      createdAt: now - 3_583_000,
    } as DerivedNode,

    // ══════════════════════════════════════════════════════════════════════
    // ABFRAGE 2 — Kind-Abfrage (Vertiefung von Q1)
    // Erklärt: Wie sieht eine verknüpfte Folge-Abfrage aus?
    // ══════════════════════════════════════════════════════════════════════
    {
      id: Q2, nodeType: "query",
      x: Q2X, y: Q2Y,
      parentId: Q1,
      query: "Welche Berufe und Branchen verschwinden konkret bis 2030?",
      locale: "de", status: "done", collapsed: false,
      synthesis:
        "ABFRAGE-KARTE (Kind-Abfrage) — Diese Analyse wurde durch die Folgefrage aus Abfrage 1 angestoßen. " +
        "Die gestrichelte Verbindungslinie zeigt die Eltern-Kind-Beziehung. " +
        "Vertiefungen ermöglichen mehrschichtige Analyse (bis zu 5+ Ebenen möglich). " +
        "'+' klicken → weitere Vertiefung starten.",
      result: {
        synthesis:
          "Besonders gefährdet: Sachbearbeitung (70% Automatisierungsgrad), Transport/Logistik (autonome Fahrzeuge), " +
          "Kassierer & Lagerarbeiter (Robotik), Einstiegs-Juristentätigkeiten und Diagnoseassistenz. " +
          "Weniger gefährdet: Sozialberufe, Handwerk, kreative Tätigkeiten.",
        confidence: 0.79,
      },
      createdAt: now - 1_800_000,
    },

    // Q2 Derived nodes
    {
      id: I3, nodeType: "insight",
      x: CAX, y: Q2Y,
      parentId: Q2, queryText: "Berufe und KI 2030",
      content:
        "ERKENNTNIS zu Kind-Abfrage — Jede Abfrage hat eigene Kinder-Karten. " +
        "Erkenntnisse beider Abfragen erscheinen in denselben Spalten, aber bei unterschiedlicher Y-Position. " +
        "→ Top-3 gefährdete Berufsgruppen: Sachbearbeitung (-45%), Logistik (-38%), Finanzdienstleistungen (-31%). " +
        "Wachstum: Pflege (+22%), Handwerk (+14%), KI-Ops (+67%).",
      createdAt: now - 1_790_000,
    } as DerivedNode,

    {
      id: DEC2, nodeType: "decision",
      x: CAX, y: Q2Y + 100,
      parentId: Q2, queryText: "Berufe und KI 2030",
      content:
        "EMPFEHLUNG zu Kind-Abfrage — Jede Analyseebene erzeugt eigene Handlungsempfehlungen. " +
        "Konkreter und spezifischer als die Empfehlung der Eltern-Abfrage. " +
        "→ Sofortprogramm für Sachbearbeiter: 18-monatige Umschulung zu 'KI-Koordinatoren'. " +
        "Priorisierung: 45+ Jahrgang. Fördervolumen: €50M/Jahr.",
      createdAt: now - 1_788_000,
    } as DerivedNode,

    {
      id: S2, nodeType: "scenario", colorKey: "baseline",
      x: CBX, y: Q2Y,
      parentId: Q2, queryText: "Berufe und KI 2030",
      probability: 0.55,
      label: "Sektoraler Umbau",
      content:
        "SZENARIO zu Kind-Abfrage — Auch Vertiefungsabfragen generieren Szenarien in der rechten Spalte. " +
        "→ Sektorialer Jobverlust wird durch Wachstum in Pflege, Handwerk und KI-nahen Berufen ausgeglichen — " +
        "aber mit 5–10 Jahren Verzögerung und signifikanter regionaler Ungleichverteilung.",
      createdAt: now - 1_789_000,
    } as DerivedNode,

    {
      id: FQ2, nodeType: "followup",
      x: CBX, y: Q2Y + 100,
      parentId: Q2, queryText: "Wie kann die Politik KI-Arbeitslosigkeit abfedern?",
      content:
        "FOLGEFRAGE zu Kind-Abfrage — Öffnet eine weitere Analyseebene (Ebene 3). " +
        "'+' klicken um diese Frage als neue Abfrage zu starten. " +
        "→ Wie kann die Politik konkret KI-bedingte Arbeitslosigkeit abfedern? " +
        "(Hier könntest du den Test-Canvas weiter vertiefen!)",
      createdAt: now - 1_787_000,
    } as DerivedNode,

    // ══════════════════════════════════════════════════════════════════════
    // MANUELLE KARTEN — Note, Idea, List
    // Erklärt: Selbst erstellte Karten ohne KI-Analyse
    // ══════════════════════════════════════════════════════════════════════
    {
      id: NOTE1, nodeType: "note",
      x: 80, y: 1060,
      content:
        "NOTIZ-KARTE — Selbst erstellt, kein KI-Output. " +
        "Ideal für eigene Beobachtungen, Quellen und Kontext-Infos. " +
        "Erstellen: '+' auf einer Karte → Notiz wählen. Oder: Leeres Canvas → '+Hinzufügen'. " +
        "Bearbeiten: Karte anklicken → Detail-Panel → Text direkt bearbeiten. " +
        "Löschen: Karte anklicken (Rahmen erscheint) → Backspace → Enter.",
      customWidth: 340, customHeight: 110,
      createdAt: now - 900_000,
    },

    {
      id: IDEA1, nodeType: "idea",
      x: 470, y: 1060,
      title: "Weiterbildungsplattform für KI-Betroffene",
      content:
        "IDEE-KARTE — Für eigene Hypothesen und Konzepte. " +
        "Hat einen Titel (Kurzform, sichtbar beim Zoom-Out) und eine Beschreibung. " +
        "'+' klicken → Idee als Basis für KI-Analyse verwenden. " +
        "→ Staatliche Plattform die KI-gefährdete Berufsgruppen mit Umschulungsangeboten vernetzt. " +
        "Geschätztes Potenzial: 800K Betroffene bis 2027.",
      customWidth: 300, customHeight: 130,
      createdAt: now - 890_000,
    },

    {
      id: LIST1, nodeType: "list",
      x: 820, y: 1060,
      title: "Alle Canvas-Kartentypen",
      items: [
        "⌕ Abfrage — KI-Vollanalyse (blauer Rand = aktiv)",
        "◉ Erkenntnis — Kernaussage (linke Spalte, Grün)",
        "◆ Empfehlung — Handlungsrahmen (linke Spalte, Mint)",
        "◈ Szenario — Opt. / Basis / Pess. / Wildcard (rechts)",
        "◎ Folgefrage — Nächste Ebene (gestrichelt, rechts)",
        "✎ Notiz — Eigener Freitext (Butter-Gelb)",
        "◇ Idee — Hypothese oder These (Peach-Orange)",
        "≡ Liste — Strukturierte Aufzählung (Mint-Grün)",
        "📎 Datei — Dokument hochladen & analysieren (Blau)",
      ],
      customWidth: 320, customHeight: 210,
      createdAt: now - 880_000,
    },
  ];

  const conns: Connection[] = [
    // Q1 → alle abgeleiteten Karten
    { from: Q1, to: I1,    derived: true },
    { from: Q1, to: I2,    derived: true },
    { from: Q1, to: DEC1,  derived: true },
    { from: Q1, to: FQ1,   derived: true },
    { from: Q1, to: S_OPT, derived: true },
    { from: Q1, to: S_BASE,derived: true },
    { from: Q1, to: S_PESS,derived: true },
    { from: Q1, to: S_WILD,derived: true },
    // Q1 → Q2 (Vertiefungskette)
    { from: Q1, to: Q2,    derived: false },
    // Q2 → abgeleitete Karten
    { from: Q2, to: I3,    derived: true },
    { from: Q2, to: DEC2,  derived: true },
    { from: Q2, to: S2,    derived: true },
    { from: Q2, to: FQ2,   derived: true },
    // Manuelle Karten mit Q2 verknüpft
    { from: Q2, to: NOTE1, derived: true },
    { from: Q2, to: IDEA1, derived: true },
  ];

  return { nodes, conns };
}

// ── Demo Project (Onboarding) ──────────────────────────────────────────────

// NOTE: `buildDemoProject` is exported but currently unreferenced.
// See the file-level JSDoc for the removal candidate note.
export function buildDemoProject(): { nodes: CanvasNode[]; conns: Connection[] } {
  const now = Date.now();
  // IDs
  const W = "demo-welcome", B = "demo-bedienung", T = "demo-tipps";
  const Q = "demo-query";
  const I1 = "demo-insight-1", I2 = "demo-insight-2";
  const SC1 = "demo-sc-opt", SC2 = "demo-sc-base", SC3 = "demo-sc-pess";
  const DEC = "demo-decision", FQ = "demo-followup";
  const DIM = "demo-dimensions", CG = "demo-causalgraph";

  // Layout constants
  const NX = 60;     // Notes column X
  const QX = 480;    // Query column X
  const DX = 1020;   // Derived column X
  const D2X = 1350;  // Second derived column (scenarios)
  const D3X = 1020;  // Third column (analysis cards)

  // Demo signals for sparkline
  const demoSignals: UsedSignal[] = [
    { source: "hackernews", title: "GPT-5 training costs exceed $1B — scaling laws plateau", date: new Date(now - 6 * 3600000).toISOString(), strength: 0.9 },
    { source: "arxiv", title: "EU AI Act compliance costs for SMEs: first empirical study", date: new Date(now - 18 * 3600000).toISOString(), strength: 0.7 },
    { source: "news", title: "Volkswagen nutzt KI-Copiloten in der Produktion — 2000 Stellen umgeschichtet", date: new Date(now - 30 * 3600000).toISOString(), strength: 0.8 },
    { source: "reddit", title: "r/cscareerquestions: Junior dev jobs disappearing in EU?", date: new Date(now - 48 * 3600000).toISOString(), strength: 0.5 },
    { source: "github", title: "Trending: open-source AI governance toolkit for EU compliance", date: new Date(now - 60 * 3600000).toISOString(), strength: 0.6 },
  ];

  // Demo causal edges for CausalGraph + Orbit
  const causalEdges: MatchedEdge[] = [
    { from: "mega-ai", to: "mega-future-of-work", type: "drives", strength: 0.95, description: "KI-Automatisierung verändert Jobprofile und Qualifikationsanforderungen" },
    { from: "mega-ai", to: "mega-digital-transformation", type: "amplifies", strength: 0.88, description: "KI beschleunigt digitale Transformation in allen Sektoren" },
    { from: "mega-geopolitics", to: "mega-ai", type: "dampens", strength: 0.65, description: "Tech-Exportkontrollen bremsen KI-Fortschritt" },
    { from: "mega-future-of-work", to: "mega-demographics", type: "correlates", strength: 0.55, description: "Arbeitsmarktveränderungen verstärken demografische Trends" },
    { from: "mega-digital-transformation", to: "mega-cybersecurity", type: "drives", strength: 0.78, description: "Mehr Digitalisierung erhöht Angriffsfläche" },
    { from: "mega-regulation", to: "mega-ai", type: "dampens", strength: 0.72, description: "EU AI Act verlangsamt Innovation, erhöht aber Vertrauen" },
  ];
  const causalTrendNames: Record<string, string> = {
    "mega-ai": "Künstliche Intelligenz",
    "mega-future-of-work": "Zukunft der Arbeit",
    "mega-digital-transformation": "Digitale Transformation",
    "mega-geopolitics": "Geopolitik & Konflikte",
    "mega-demographics": "Demografie & Alterung",
    "mega-cybersecurity": "Cybersicherheit",
    "mega-regulation": "Regulierung & Governance",
  };

  // Demo dimension data
  const dimData: DimensionEntry[] = [
    { label: "Technologie & Innovation", key: "technology", trends: [], avgConfidence: 0.82, direction: "up", color: "#3b82f6" },
    { label: "Gesellschaft & Arbeit", key: "society", trends: [], avgConfidence: 0.61, direction: "down", color: "#f59e0b" },
    { label: "Wirtschaft & Märkte", key: "market_economic", trends: [], avgConfidence: 0.54, direction: "neutral", color: "#22c55e" },
    { label: "Geopolitik & Regulierung", key: "political_environment", trends: [], avgConfidence: 0.73, direction: "up", color: "#6366f1" },
  ];

  const nodes: CanvasNode[] = [
    // ── Erklärungs-Notizen (links) ──
    {
      id: W, nodeType: "note", x: NX, y: 60, createdAt: now,
      customWidth: 320, customHeight: 260,
      content:
        "WILLKOMMEN IM SIS CANVAS\n\n" +
        "Das Strategic Intelligence System analysiert Trends, Signale und Zusammenhänge — und verwandelt sie in strategische Erkenntnisse.\n\n" +
        "DIESER CANVAS ZEIGT DIR, WIE ALLES FUNKTIONIERT:\n\n" +
        "→ Klicke auf eine Karte um Details zu sehen\n" +
        "→ Ziehe am rechten Punkt um Verbindungen zu erstellen\n" +
        "→ Nutze die Toolbar oben für Views, Export und mehr\n" +
        "→ Tippe in die Command-Line unten um Analysen zu starten",
      tags: ["onboarding", "start"],
    } as NoteNode,
    {
      id: B, nodeType: "note", x: NX, y: 360, createdAt: now,
      customWidth: 320, customHeight: 280,
      content:
        "CANVAS-BEDIENUNG\n\n" +
        "KARTEN BEWEGEN: Header anfassen und ziehen\n" +
        "VERBINDEN: Am rechten Port ziehen → zu einer anderen Karte\n" +
        "ZOOM: Mausrad oder Toolbar (⊙ = Reset)\n" +
        "VIEWS: Canvas | Board | Zeitlinie | Orbit\n" +
        "LÖSCHEN: Karte auswählen → Delete → Enter\n" +
        "TAGS: Karte anklicken → unten Tags eingeben → Enter\n" +
        "EXPORT: ⬇ .md oder ⬇ .json in der Toolbar\n" +
        "VOLLBILD: ⤢ Icon auf Grafiken klicken → Lightbox",
      tags: ["onboarding"],
    } as NoteNode,
    {
      id: T, nodeType: "note", x: NX, y: 680, createdAt: now,
      customWidth: 320, customHeight: 240,
      content:
        "FUNKTIONEN ENTDECKEN\n\n" +
        "⬡ ORBIT: Alle Trends als Kausal-Netzwerk\n" +
        "📄 BRIEFING: Strategisches Memo generieren\n" +
        "🔍 TOOLTIPS: Maus über jeden Button halten\n" +
        "PROJEKTE: Dropdown oben → Neues Projekt\n" +
        "VERBINDUNGEN: Grün = bestätigt, Rot = Widerspruch\n" +
        "SPARKLINE: Mini-Zeitreihe der Signale auf Query-Karten",
      tags: ["onboarding"],
    } as NoteNode,

    // ── Beispiel-Query (Mitte) ──
    {
      id: Q, nodeType: "query", x: QX, y: 80, createdAt: now,
      query: "Wie verändert KI die Arbeitswelt in Europa bis 2030?",
      locale: "de",
      status: "done",
      synthesis:
        "Künstliche Intelligenz transformiert die europäische Arbeitswelt tiefgreifend: Bis 2030 werden laut McKinsey 30% aller Arbeitsstunden in der EU automatisierbar sein. " +
        "Der Effekt ist asymmetrisch — administrative und analytische Berufe sind stärker betroffen als handwerkliche. " +
        "Gleichzeitig entstehen neue Berufsfelder in KI-Governance, Prompt Engineering und Human-AI-Collaboration. " +
        "Die EU AI Act setzt einen globalen Regulierungsstandard, der sowohl Innovation bremst als auch Vertrauen schafft.",
      result: {
        synthesis: "KI transformiert die EU-Arbeitswelt: 30% Automatisierungspotenzial bis 2030, asymmetrisch nach Qualifikation.",
        keyInsights: [
          "30% der EU-Arbeitsstunden automatisierbar — Augmentation vor Substitution",
          "EU AI Act schafft Dreiklassen-Markt für KI-Anwendungen",
        ],
        scenarios: [
          { type: "optimistic", name: "KI-Augmentations-Boom", description: "Co-Pilot-Modelle steigern Produktivität um 40%+", probability: 0.25, keyDrivers: ["Weiterbildungsinvestition", "AI Act Klarheit"] },
          { type: "baseline", name: "Duale Arbeitswelt 2030", description: "Hochqualifizierte KI-Wissensarbeiter neben wachsendem Care-Sektor", probability: 0.45, keyDrivers: ["AI Act Regulierung", "Fachkräftemangel", "Remote-Work"] },
          { type: "pessimistic", name: "Verdrängungskrise", description: "Schnelle Automatisierung ohne ausreichende Umschulung", probability: 0.22, keyDrivers: ["Kostendruck", "Mangelnde Regulierung"] },
        ],
        decisionFramework: "1. KI-Kompetenzoffensive starten. 2. Human-AI-Collaboration pilotieren. 3. EU AI Act Compliance sicherstellen. 4. Change-Management aufsetzen.",
        followUpQuestions: ["Welche Branchen profitieren am stärksten?", "Wie wirkt sich der AI Act auf Startups aus?", "Welche Umschulungsprogramme funktionieren?"],
        confidence: 0.72,
        usedSignals: demoSignals,
        matchedTrends: [],
        matchedEdges: causalEdges,
        reasoningChains: ["KI-Automatisierung → Jobverlagerung → Qualifikationslücke → Weiterbildungsbedarf"],
        causalChain: ["Hohe Automatisierbarkeit → Produktivitätsgewinne → Arbeitskräfteverschiebung → Sozialpolitischer Anpassungsbedarf"],
        regulatoryContext: ["EU AI Act (2026)", "DSGVO-Erweiterung für KI-Entscheidungen"],
        newsContext: "Aktuelle Signale zeigen beschleunigte KI-Adoption in der EU bei gleichzeitig steigenden Compliance-Anforderungen.",
      } as unknown as QueryResult,
      collapsed: false,
      customWidth: 440,
    } as QueryNode,

    // ── Insights (rechts oben) ──
    { id: I1, nodeType: "insight", x: DX, y: 80, parentId: Q, createdAt: now, content: "30% der EU-Arbeitsstunden sind bis 2030 automatisierbar — aber Augmentation dominiert vor Substitution. KI-Co-Piloten steigern Produktivität um 40% (BCG 2025).", queryText: "Automatisierungspotenzial", sources: demoSignals.slice(0, 2), tags: ["ki-arbeit"] } as DerivedNode,
    { id: I2, nodeType: "insight", x: DX, y: 260, parentId: Q, createdAt: now, content: "Der EU AI Act schafft einen Dreiklassen-Markt: Hochrisiko-KI mit Zertifizierung, General-Purpose AI mit Transparenz, Low-Risk ohne Auflagen.", queryText: "EU AI Act Impact", sources: demoSignals.slice(1, 3), tags: ["regulierung"] } as DerivedNode,

    // ── Szenarien (rechts Mitte) ──
    { id: SC1, nodeType: "scenario", x: D2X, y: 80, parentId: Q, createdAt: now, label: "KI-Augmentations-Boom", content: "Co-Pilot-Modelle dominieren. Produktivitätssprung von 40%+. Neue Berufsfelder überwiegen Jobverluste.", queryText: "Optimistisches KI-Szenario", colorKey: "optimistic", probability: 0.25, keyDrivers: ["Weiterbildung", "AI Act Klarheit"], tags: ["szenario"] } as DerivedNode,
    { id: SC2, nodeType: "scenario", x: D2X, y: 300, parentId: Q, createdAt: now, label: "Duale Arbeitswelt 2030", content: "Hochqualifizierte KI-Wissensarbeiter koexistieren mit wachsendem Care-Sektor. Die Mitte schrumpft.", queryText: "Basis-Szenario", colorKey: "baseline", probability: 0.45, keyDrivers: ["AI Act", "Fachkräftemangel", "Remote-Work"], tags: ["szenario"] } as DerivedNode,
    { id: SC3, nodeType: "scenario", x: D2X, y: 520, parentId: Q, createdAt: now, label: "Verdrängungskrise", content: "Schnelle Automatisierung ohne Umschulung führt zu struktureller Arbeitslosigkeit in Büroberufen.", queryText: "Pessimistisches KI-Szenario", colorKey: "pessimistic", probability: 0.22, keyDrivers: ["Kostendruck", "Regulierungslücke"], tags: ["szenario", "risiko"] } as DerivedNode,

    // ── Decision + FollowUp ──
    { id: DEC, nodeType: "decision", x: DX, y: 440, parentId: Q, createdAt: now, content: "1. KI-Kompetenzoffensive starten (Budget ×2). 2. Human-AI-Collaboration in 2-3 Prozessen pilotieren. 3. EU AI Act Audit durchführen. 4. Change-Management für betroffene Abteilungen.", queryText: "KI-Transformations-Maßnahmen", tags: ["massnahme", "ki-arbeit"] } as DerivedNode,
    { id: FQ, nodeType: "followup", x: DX, y: 630, parentId: Q, createdAt: now, content: "Welche europäischen Branchen profitieren am stärksten von KI-Augmentation — und welche verlieren am meisten?", queryText: "Branchen-Analyse" } as DerivedNode,

    // ── Dimensions Card ──
    { id: DIM, nodeType: "dimensions", x: D3X, y: 800, parentId: Q, createdAt: now, content: "Strategische Dimensionen", queryText: "Dimensionen", dimensionData: dimData } as DerivedNode,

    // ── CausalGraph Card ──
    { id: CG, nodeType: "causalgraph", x: D2X, y: 740, parentId: Q, createdAt: now, content: "Kausalnetz", queryText: "Kausalanalyse", causalEdges, causalTrendNames } as DerivedNode,
  ];

  const conns: Connection[] = [
    { from: W, to: Q, connectionType: "builds-on" },
    { from: Q, to: I1, derived: true, connectionType: "derived" },
    { from: Q, to: I2, derived: true, connectionType: "derived" },
    { from: Q, to: SC1, derived: true, connectionType: "derived" },
    { from: Q, to: SC2, derived: true, connectionType: "derived" },
    { from: Q, to: SC3, derived: true, connectionType: "derived" },
    { from: Q, to: DEC, derived: true, connectionType: "derived" },
    { from: Q, to: FQ, derived: true, connectionType: "derived" },
    { from: Q, to: DIM, derived: true, connectionType: "derived" },
    { from: Q, to: CG, derived: true, connectionType: "derived" },
    { from: I1, to: DEC, connectionType: "validates" },
    { from: SC3, to: DEC, connectionType: "contradicts" },
  ];

  return { nodes, conns };
}
