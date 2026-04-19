# MVP Smoke-Test — Checkliste (20.04.2026)

**Zweck:** Manueller Browser-Durchlauf bevor der MVP freigegeben wird.
Ziel ist: jedes der drei Primär-Flows einmal durchlaufen, Screenshots
machen, keine offensichtlichen Brüche übersehen.

**Voraussetzungen**
- `npm run dev` läuft auf `http://localhost:3001`
- Dev-Mode-Auth aktiviert (keine Magic-Link-Hürden)
- Neueste `local.db` (aus Gdrive-Sync auto-vorhanden)

---

## ✅ Automatisch verifiziert (Stand: 19.04.2026 Abend)

Diese Punkte wurden per API-Test + curl-Roundtrip bereits bestätigt —
du musst morgen nur noch visuell + UX-seitig draufschauen, nicht die
Funktionalität selbst testen.

| Item | Status | Nachweis |
|---|---|---|
| TypeScript | ✅ clean | `npx tsc --noEmit` |
| Offline-Tests | ✅ 315/315 passed | 12 Suites, tenants/briefing-url/baseline/cluster-snapshots/ai-text/foresight-parser/forecasts/stream/sse-client/pipeline-store/pagination/openapi-spec |
| Live-API-Tests | ✅ 37/37 passed | `test:api` gegen live Server |
| `/api/v1/health` | ✅ 200, `ok=true` | curl |
| `/api/v1/monitor` | ✅ 99 Connectors, 40 Trends, 102 Edges, 1684 Signals | curl |
| `/api/v1/feed/ticker` | ✅ frische Signale (Bluesky, MemeCore, Eurostat) | curl |
| `/api/v1/openapi.json` | ✅ 9 paths dokumentiert | curl |
| Canvas CRUD | ✅ Create → Get → Rename → Delete → 404 | curl-Roundtrip |
| Forecasts Flag-Gating | ✅ 404 wenn `FORECASTS_ENABLED` ungesetzt | curl |
| Alle Core-Routes | ✅ HTTP 200 | / /cockpit /canvas /projects /admin /monitor /how-to /frameworks /clusters /forecasts /briefing |
| Tenant-Liste | ✅ "Default Workspace" mit 8 Canvases | curl |

---

## 🔍 Flow 1 — Landing → Query → Briefing

**Ziel:** Der zentrale Happy Path: Besucher stellt eine Frage, bekommt
strukturierte Antwort mit Szenarien, Quellen, Empfehlungen.

- [ ] Öffne `http://localhost:3001/`
- [ ] Landing rendert ohne JS-Errors in der Console
- [ ] Sprache-Toggle DE/EN funktioniert, wechselt auch Placeholder im Suchfeld
- [ ] Tippe eine Frage ein, z.B. „AI Agents 2025" oder „DORA für Finanzdienstleister"
- [ ] Enter oder „Analyze" klicken
- [ ] Streaming-Indikator erscheint (6 Phasen: Signale lesen → Synthese → Kausalketten → Szenarien → Erkenntnisse → Abschliessen)
- [ ] Ergebnis-Briefing erscheint mit mindestens: Synthesis, Scenarios, Key Insights, Decision Framework
- [ ] Confidence-Badge wird angezeigt (grün/amber/rot)
- [ ] „Als PDF exportieren (Cmd+P)" Button im Briefing-Footer vorhanden
- [ ] **Screenshot:** `01-landing-query-briefing.png`

**Acceptance:** Briefing ist lesbar, Szenarien haben Prozente, Quellen
sind verlinkt. Keine „undefined" oder englische Labels im DE-Mode (oder
umgekehrt).

---

## 🔍 Flow 2 — Canvas als Workspace

**Ziel:** Der Strategische Denkraum. Jede Query = Node, Follow-ups
branchen ab, alles persistent in der Tenant-DB.

- [ ] `http://localhost:3001/canvas` öffnen
- [ ] Bestehendes Projekt laden oder „Neues Projekt" anlegen
- [ ] Query-Bar unten: Frage eingeben, Enter → Query-Node erscheint
- [ ] Node zeigt während Streaming die Phase-Indikator
- [ ] Nach Completion: derived nodes (Insight, Scenario, Decision, Follow-up) automatisch angelegt
- [ ] Card-Actions-Menü (⋯) öffnet: „Folgefrage stellen", Status setzen, Tag hinzufügen
- [ ] Zoom per Scroll-Wheel, Pan per Hintergrund-Drag
- [ ] View-Mode umschalten: Canvas → Board → Timeline → Orbit
- [ ] Save-Status oben zeigt „✓ Gespeichert" (nicht „! Fehler beim Speichern")
- [ ] **Screenshot:** `02-canvas-workspace.png`

**Acceptance:** Nodes persistieren nach Page-Reload. View-Wechsel
bricht nichts. Keine verwaisten Deutsch-Strings, wenn DE-Mode aktiv.

---

## 🔍 Flow 3 — Knowledge Cockpit & Navigation

**Ziel:** Die Stamm-Datenlandschaft: Radar, Netzwerk, Live-Signale,
Quellen. Plus Multi-Tenant-Switcher.

- [ ] `http://localhost:3001/cockpit` öffnen
- [ ] Hero zeigt: `40 Trends · 102 Kausal-Edges · N Quellen · N Adopt-Ring`
- [ ] Tab „Radar": D3-Visualisierung rendert, Trends klickbar → TrendDetailPanel öffnet rechts
- [ ] Tab „Netzwerk": Causal-Graph rendert, Node-Click → Detail
- [ ] Tab „Signale": LiveSignalStream läuft, frische Einträge sichtbar
- [ ] Tab „Quellen": QuellenTable zeigt Connectors (aktiv/geplant/backlog-Badges)
- [ ] Hero-Link „Methodik" → `/cockpit/methodik` rendert die 7-Sektionen
- [ ] **Screenshot:** `03-cockpit-radar.png`, `04-cockpit-sources.png`

**Acceptance:** Zahlen sind live (nicht hardcoded). Radar interaktiv.
Stale-Banner erscheint NUR wenn Signale > 24h alt.

---

## 🔍 Flow 4 — Tenant-Isolation (wenn Multi-User)

**Optional, nur wenn der MVP mit mehreren Mandanten live geht.**

- [ ] `/admin/tenants` als System-Admin öffnen
- [ ] Neuen Tenant anlegen (z.B. „Test-Org")
- [ ] Member einladen → Invite-Link kopieren
- [ ] Als Member einloggen → Tenant-Switcher oben zeigt beide
- [ ] In Test-Org: Canvas anlegen
- [ ] Zu Default zurückswitchen → Test-Org-Canvas NICHT sichtbar
- [ ] **Screenshot:** `05-tenant-isolation.png`

**Acceptance:** Canvases tauchen im falschen Tenant nicht auf.
`tenant_id` im DB-Insert korrekt gesetzt (kann per
`sqlite3 local.db "SELECT tenant_id, name FROM canvases"` verifiziert
werden).

---

## 🔍 Flow 5 — Forecasts (wenn Flag aktiv)

**Optional, nur wenn `FORECASTS_ENABLED=true` gesetzt ist.**

- [ ] `FORECASTS_ENABLED=true` in `.env.local` setzen, `npm run dev` neustarten
- [ ] `/forecasts` öffnen → sollte kein „feature not yet enabled" Splash zeigen
- [ ] „+ New forecast" → Frage eingeben, Create
- [ ] Staten: Slider auf z.B. 60%, Rationale, „Stake"
- [ ] Als zweiter User: gleich staten mit anderem Wert (z.B. 30%)
- [ ] Team Consensus Badge aktualisiert sich (derivedYesProbability)
- [ ] „Propose resolution" → YES/NO/PARTIAL wählen, Rationale, Submit
- [ ] Als anderer User: „Approve" klicken → Status wechselt auf RESOLVED
- [ ] Calibration-Chip auf Position-Row zeigt Brier-Score
- [ ] **Screenshot:** `06-forecasts-resolved.png`

**Acceptance:** Peer-Signoff (Proposer ≠ Approver) wird erzwungen.
Calibration-Curve-Panel öffnet auf Chip-Klick.

---

## 🚦 MVP-Freigabe-Kriterien

Alle drei Haupt-Flows (1, 2, 3) laufen sauber durch, Screenshots
gemacht, keine Console-Errors. Dann: **MVP live**.

Flow 4 und 5 sind Nice-to-haves und können später verifiziert werden,
wenn Multi-Tenant / Forecasts aktiv im Produktbetrieb sind.

---

## 📋 Post-MVP TODOs (nicht blockend)

- MethodikContent.tsx i18n-migrieren (~90 Strings, content-heavy)
- Docs-Seiten `/dokumentation` + `/komponenten` in co-located
  `content.ts` wenn dritte Sprache kommt
- Playwright E2E für die 3 Haupt-Flows automatisieren (deferred ticket)
- Session-Summary als shareable URL
- OrbitDerivationView / QuellenTable: Daten-Field-Lookup-Refactor
- Cluster-Snapshot-Changelog mit `CLUSTER_DIFF_LLM_ENABLED=true`
  einmal live laufen lassen

---

*Erstellt: 19.04.2026 Abend. Checkliste basiert auf dem Stand nach
Commit `d3d5eaf` (docs: MVP-prep). Für den Freigabe-Durchlauf morgen
früh: einfach die Boxen abhaken.*