# SIS Development Backlog

Zentrale TODO-Liste fuer das Strategic Intelligence System.
Wird nach Notion uebertragen sobald die Verbindung steht.

---

## Bugs (High Priority)

- [ ] **Dark Mode: Framework-Karten Titel** — `var(--volt-text)` wird weiss auf Pastell-Hintergrund. Fix: Titel-Farbe fest `#0A0A0A`, Beschreibung fest `#555`. Datei: `src/app/page.tsx` ~Zeile 1061
- [ ] **Dark Mode: Canvas Card-Borders** — `rgba(0,0,0,0.09)` unsichtbar auf dunklem Hintergrund. Fix: `var(--color-border, rgba(0,0,0,0.09))`. Datei: `src/app/canvas/page.tsx` (~6 Stellen)
- [ ] **Signal-Relevanz Fallback** — leeres Array statt random Noise wenn keine Keywords matchen. Datei: `src/lib/signals.ts` Zeile 209

## Bugs (Medium Priority)

- [ ] **beforeunload Dirty-Flag** — `isDirtyRef` statt `nodesRef.current.length > 0` verwenden. Datei: `src/app/canvas/page.tsx`

## Features (High Priority)

- [ ] **Startseite als Launcher** — Kein Auto-Load von History/Canvas aus localStorage. `activeProjectIdRef` statt localStorage fuer syncToCanvasDb. "Letzte Projekte" Karten-Bereich auf Welcome-Screen. Escape-Handler fuer Framework-Modal. Datei: `src/app/page.tsx`

## i18n

- [ ] **i18n: ~15 Seiten/Komponenten an useLocale() anschliessen** — cockpit, szenarien, feed, historie, workspace, RadarView, CausalGraphView, BalancedScorecard, SessionList, LiveSignalStream, MethodikContent, TrendOverview, WorkflowPanel, GraphLightbox, SessionsSubNav
- [ ] **i18n: next-intl Migration** — ~300 inline Ternaries durch structured i18n ersetzen (langfristig). Bereits als TODO FE-07/UX-19 im Code markiert

## UX / Design

- [ ] **QuellenTable: Kategorie-Pills reduzieren** — 24 Fine-Pills auf einmal sind overwhelming wenn "Alle" aktiv. Nur anzeigen wenn ein STEEP+V Macro gewaehlt ist
- [ ] **Derived-Card Badge Pills** — ERKENNTNIS/EMPFEHLUNG/FOLGEFRAGE Badges mit farbigem Hintergrund + Border + Padding (Pill-Form) nach GrainUI Node Canvas Spec. Datei: `src/app/canvas/page.tsx`
- [ ] **Verbindungslinien sichtbarer** — `rgba(0,0,0,0.25)` bei 1.2px statt aktuell 0.16/1px. Datei: `src/app/canvas/page.tsx` CONN_STYLES
- [ ] **ERKENNTNIS Body-Text Line-Clamp** — DerivedNodeCard Body-Text hat kein Line-Clamp, kann ueberlaufen. Fix: dynamisches `-webkit-line-clamp`. Datei: `src/app/canvas/page.tsx`
- [ ] **Success-Glow einmalig** — `nc-success` Animation von `infinite` auf `1`. Datei: `src/app/globals.css` Zeile 697
- [ ] **Terminologie "Projekte" statt "Sessions"** — AppHeader, Sessions-Seite, SessionBar, Archiv-Seite. Dateien: AppHeader.tsx, sessions/*.tsx, SessionBar.tsx, SessionList.tsx, SessionsSubNav.tsx

## Performance

- [ ] **PERF-08: Virtual Lists** — QuellenTable + SessionList bei 500+ Eintraegen sluggish. Fix: react-virtual oder react-window fuer Listen mit >50 Items

## Erledigt (zuletzt)

- [x] Schema-Unification: PostgreSQL + SQLite Schemas synchronisiert
- [x] CardActionsMenu + TagInlineInput auf Canvas-Karten
- [x] Source Attribution Badges auf QueryNodeCard
- [x] Analyse-Parameter Section im DetailPanel
- [x] QuellenTable Redesign: 5-Spalten sortierbar, Docs eigene Spalte
- [x] Locale-Persistenz: localStorage + html lang Update
- [x] i18n: ActivityPanel, Briefing, Auth/Signin bilingual
