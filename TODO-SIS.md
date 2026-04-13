# SIS Development Backlog

Zentrale TODO-Liste fuer das Strategic Intelligence System.
Wird nach Notion uebertragen sobald die Verbindung steht.

---

## Bugs (High Priority)

_(keine offenen)_

## Bugs (Medium Priority)

_(keine offenen)_

## Features (High Priority)

_(keine offenen)_

## i18n

- [ ] **i18n: next-intl Migration** — ~300 inline Ternaries durch structured i18n ersetzen (langfristig). Bereits als TODO FE-07/UX-19 im Code markiert

## UX / Design

_(keine offenen)_

## Performance

_(keine offenen)_

## Erledigt (zuletzt)

- [x] **PERF-08: Virtual Lists** — QuellenTable + SessionList mit @tanstack/react-virtual virtualisiert
- [x] **i18n: WorkflowPanel + GraphLightbox** — useLocale() angeschlossen, alle Strings bilingual
- [x] **Dark Mode: Framework-Karten Titel** — Titel-Farbe fest `#0A0A0A` statt `var(--volt-text)`
- [x] **Dark Mode: Canvas Card-Borders** — CSS custom property `var(--color-border)` statt hardcoded rgba
- [x] **Signal-Relevanz Fallback** — ALG-22 bigram matching + noise filter statt random Noise
- [x] **beforeunload Dirty-Flag** — `isDirtyRef.current` korrekt implementiert
- [x] **Startseite als Launcher** — Kein Auto-Load, activeProjectIdRef, Letzte Projekte, Escape-Handler
- [x] **QuellenTable: Kategorie-Pills reduzieren** — Fine-Pills nur bei aktivem STEEP+V Macro
- [x] **Derived-Card Badge Pills** — Pill-Form mit Background + Border + Padding
- [x] **Verbindungslinien sichtbarer** — 4-Tier Opacity, Zoom-adaptive Daempfung, semantische Labels
- [x] **ERKENNTNIS Body-Text Line-Clamp** — FormattedText Komponente mit dynamischem Line-Clamp
- [x] **Success-Glow einmalig** — `nc-success` Animation von `infinite` auf `1`
- [x] **Terminologie "Projekte" statt "Sessions"** — AppHeader, Sessions-Seite, SessionBar
- [x] **i18n: ~15 Seiten/Komponenten** — cockpit/szenarien/feed/historie/workspace sind Redirects; RadarView/CausalGraphView/BalancedScorecard/LiveSignalStream/SessionList/SessionsSubNav erhalten locale via Props; WorkflowPanel + GraphLightbox mit useLocale() angeschlossen
- [x] Schema-Unification: PostgreSQL + SQLite Schemas synchronisiert
- [x] CardActionsMenu + TagInlineInput auf Canvas-Karten
- [x] Source Attribution Badges auf QueryNodeCard
- [x] Analyse-Parameter Section im DetailPanel
- [x] QuellenTable Redesign: 5-Spalten sortierbar, Docs eigene Spalte
- [x] Locale-Persistenz: localStorage + html lang Update
- [x] i18n: ActivityPanel, Briefing, Auth/Signin bilingual
