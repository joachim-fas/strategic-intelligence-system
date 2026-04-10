# SIS Full-Stack Audit Report v2

**Datum:** 2026-04-10
**Scope:** Komplette Codebase (60.600 LOC, 34 Routes, 75 Components, 34 API-Endpoints, 60 Connectors)
**Audit-Team:** 10 spezialisierte Agenten in 2 Runden
- Runde 1: Explorer, Code Review, UX/Design, Frontend, Security
- Runde 2 (Deep Dive): Business Logic & Data Flow, Component Interaction, Visual & UX, Security Deep Dive, Architecture & Dead Code

---

## Executive Summary

Das SIS hat eine solide konzeptionelle Basis (deklaratives Connector-Framework, STEEP+V-Taxonomie, gewichtetes Scoring), aber massive strukturelle Schulden in Sicherheit, Architektur und Datenkonsistenz. Die kritischsten Befunde sind:

1. **Prompt Injection** — Rohe Nutzereingaben fliessen ungesaeubert in Claude-Prompts, inklusive einer mehrstufigen Injektionskette (User-Query -> Synthese -> Meta-Synthese -> Canvas-Summary)
2. **Null Authentifizierung** — 28 von 34 API-Endpoints sind oeffentlich zugaenglich, darunter der Claude-API-Proxy
3. **God-File-Architektur** — `canvas/page.tsx` (6.845 Zeilen, 40 useState, 20 Effekte) ist ein Single Point of Failure fuer die gesamte Canvas-Funktionalitaet
4. **Stiller Datenverlust** — sendBeacon-Bug, localStorage-QuotaExceeded wird verschluckt, Projekt-Wechsel-Race-Condition
5. **Fake-Daten im UI** — IntelligenceFeed generiert synthetische Signale aus statischen Daten, Home/Briefing zeigen hardcodierte Statistiken
6. **~200KB tote Daten im Client-Bundle** — Statische Trend-Definitionen, Kausal-Graphen und Demo-Briefings werden an jeden Client ausgeliefert

| Schweregrad | Anzahl | Aenderung gegenueber v1 |
|-------------|--------|------------------------|
| CRITICAL    | 16     | +6 (v1: 10)            |
| HIGH        | 22     | +8 (v1: 14)            |
| MEDIUM      | 28     | +10 (v1: 18)           |
| LOW         | 18     | +6 (v1: 12)            |

---

## Cross-Impact-Ketten

Die tiefgreifendsten Probleme sind keine Einzelbefunde, sondern vernetzte Ketten:

### Kette 1: Prompt Injection -> Datenintegritaet -> weitere Prompt Injection
```
User-Query (unsanitized) -> Claude-Prompt (C11)
  -> Synthese-Antwort (wird in Canvas-Node gespeichert)
    -> Meta-Synthese-Prompt baut auf gespeicherten Synthesen auf (C15)
      -> Vergiftete Synthese fliesst in alle zukuenftigen Zusammenfassungen
```

### Kette 2: Fehlende Auth -> API-Cost-Exposure -> Datenzerstoerung
```
Kein Auth auf /api/v1/query (C1) -> Unbegrenzter Claude-API-Zugriff
Kein Auth auf /api/v1/canvas DELETE (C1) -> Jeder kann alle Canvas loeschen
Host-Header-Bypass (C2) -> Gilt auch fuer Produktion
```

### Kette 3: Scoring-Bugs -> UX-Luegen -> Fehlentscheidungen
```
TOTAL_ACTIVE_SOURCES = 10 hardcoded (H16) -> inflierte Convergence-Scores
Relevance double-counted (H16) -> Trends erhalten 2x Relevanz-Gewichtung
IntelligenceFeed generiert Fake-Signale (C14) -> User sieht erfundene Daten
Homepage zeigt "50 Quellen, 39 Trends" hardcoded (C13) -> Zahlen stimmen nicht
```

### Kette 4: Architektur-Schulden -> Performance -> UX-Brueche
```
canvas/page.tsx 6.845 Zeilen (C7) -> Jeder State-Change re-rendert alles
40 useState + 20 useEffect (C7) -> 6 Ref-Sync-Effekte pro Frame beim Panning
import * as d3 (H5) -> 4+ MB Bundle statt 400KB
~200KB statische Daten im Bundle (H19) -> Unnoetige Ladezeit
```

---

## CRITICAL (Sofort handeln)

### C1. Security: 28 von 34 API-Endpoints ohne Authentifizierung
**Quelle:** Security R1 + R2
**Dateien:** Alle `src/app/api/v1/*/route.ts` ausser `radars/`

Nur 4 Radar-Routen nutzen `requireAuth()`. Alle anderen Endpoints sind komplett oeffentlich:
- `/api/v1/query` POST — Claude-API aufrufen (Credits verbrennen)
- `/api/v1/pipeline` POST — Alle 55 Connectors triggern
- `/api/v1/frameworks/analyze` POST — Claude-API aufrufen (6 Framework-Typen)
- `/api/v1/canvas/upload` POST — Beliebige Dateien hochladen
- `/api/v1/canvas/[id]` DELETE — Jeden Canvas loeschen
- `/api/v1/projects/[id]` DELETE — Jedes Projekt loeschen
- Alle CRUD-Operationen auf Projects, Scenarios, Notes, Versions

15 der 34 Routes sind zusaetzlich vom UI gar nicht erreichbar (Dead Routes, siehe C16) — sie sind aber trotzdem live HTTP-Endpoints.

---

### C2. Security: Auth-Bypass ueber Host-Header
**Datei:** `src/middleware.ts:13-19`

```typescript
if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
  return NextResponse.next();
}
```

Der `Host`-Header ist vom Angreifer kontrollierbar. DNS-Rebinding oder ein Angreifer im selben Netzwerk kann `Host: localhost` setzen und damit die komplette Auth umgehen — auch in Produktion. Zusaetzlich prueft die Middleware nur Cookie-Praesenz, nicht Session-Validitaet.

---

### C3. Security: File-Upload ohne jede Validierung
**Datei:** `src/app/api/v1/canvas/upload/route.ts:36-54`

- Keine Auth erforderlich
- Kein Size-Limit
- Kein File-Type-Check (akzeptiert .exe, .html, .sh)
- Dateien landen in `public/uploads/` — direkt per URL aufrufbar
- `.env` steht in der `TEXT_EXTENSIONS`-Liste — Inhalt wird in der API-Response zurueckgegeben
- **Stored XSS** moeglich: HTML/SVG-Upload wird vom Browser als Seite gerendert

---

### C4. Datenverlust: sendBeacon-Bug macht Save-on-Close kaputt
**Datei:** `src/app/canvas/page.tsx:4711`

```javascript
navigator.sendBeacon(`/api/v1/canvas/${pid}`, JSON.stringify({ canvasState: state }));
```

Zwei Fehler:
1. `sendBeacon` sendet nur POST — die Route erwartet PATCH
2. `sendBeacon` setzt `Content-Type: text/plain` — `req.json()` kann es nicht parsen

Der stille `catch {}` verschluckt den Fehler. Canvas-Aenderungen gehen beim Tab-Schliessen verloren.

---

### C5. Datenverlust: localStorage-Save verschluckt QuotaExceededError
**Datei:** `src/app/canvas/page.tsx:338, 4680`

Die `saveToStorage`-Funktion hat einen blanken `catch {}`. Canvas-Daten koennen hunderte KB gross sein. Wenn localStorage voll ist, scheitert der Save stumm. Der User verliert bei Page-Reload seine Arbeit ohne jede Warnung.

---

### C6. Datenverlust: Race Condition beim Projekt-Wechsel
**Datei:** `src/app/canvas/page.tsx:4690`

Der DB-Persist-Effect hat `projectId` in seiner Dependency-Liste. Wenn der User das Projekt wechselt und `nodes` sich gleichzeitig aendert, feuert der Effekt mit der neuen `projectId` aber speichert die alten Nodes. Der Timer (2 Sekunden Debounce) des vorherigen Projekts wurde gecleaned, aber die aktuellen Nodes gehen an das falsche Projekt.

---

### C7. Architektur: canvas/page.tsx = 6.845 Zeilen Monolith
**Quelle:** Alle 10 Agenten

- ~40 `useState`-Aufrufe, 84 useState/useRef/useMemo total
- ~20 `useEffect`-Hooks (6 davon nur Ref-Sync, siehe M6)
- ~20 interne Komponenten-Definitionen (nicht lazy-loadable)
- 562 inline `style={}`-Attribute, 5 `className=`
- 207 hardcoded Hex-Farbwerte
- 57 inline Arrow-Functions + 38 useCallback + 26 named Handlers (inkonsistent gemischt)
- Null `aria-*`, null `role=`

Jede Aenderung erfordert Recompile von ~7.000 Zeilen. Jeder State-Change re-rendert alle internen Komponenten.

---

### C8. Frontend: Null Error-Boundaries, null Loading-States (Next.js)

Kein einziges `loading.tsx`, `error.tsx` oder `not-found.tsx` im gesamten `src/app/`-Baum. `ViewLoading` in verstehen ist ein leerer 400px-Container mit Text "Radar laden..." — kein Skeleton, keine Shimmer-Animation, Hoehen-Sprung beim Laden.

---

### C9. Frontend: Alle 20 Pages sind "use client" — null Server Components

Selbst statische Seiten wie `/how-to`, `/frameworks` und `/auth/verify` sind Client Components. Kein SSR, kein Streaming, kein Server-Side Data Fetching. Null `useSWR`, null React Query — alle 105 useEffect+fetch-Aufrufe ohne Caching, Deduplication oder Revalidation.

---

### C10. UX: Drei konkurrierende Component Libraries — ueberwiegend tot

| Library | Dateien | Total | Tatsaechlich benutzt |
|---------|---------|-------|---------------------|
| Volt UI | `src/components/volt/` | 17 | 7 (10 komplett tot) |
| Grain UI | `src/components/grain/` | 6 | 2 |
| VoltPrimitives | `src/components/verstehen/` | 9 | In 4 Dateien benutzt |
| shadcn/ui | `src/components/ui/` | 4 | In 2 Dateien benutzt |

Die App wird stattdessen fast komplett mit inline `style={}` gebaut. 1.662 inline Style-Objekte.

---

### C11. Security: Prompt Injection — User-Query roh in Claude-System-Prompt
**Quelle:** Security R2
**Dateien:** `src/app/api/v1/query/route.ts:205-208`, `src/lib/llm.ts:242-245`

Die User-Query wird 1:1 als User-Message an Claude uebergeben:
```typescript
let userMessage = query;
if (contextProfile) {
  userMessage += `\n\n[Kontext: ${contextProfile.role} / ${contextProfile.industry} / ${contextProfile.region}]`;
}
```

- Kein Length-Limit, kein Character-Filtering
- `contextProfile.role/industry/region` sind ebenfalls unsanitisiert (sekundaerer Injektionsvektor)
- Der System-Prompt (`llm.ts:67-231`) enthaelt ALLE 40 Trend-Namen, Scores, Regulierungen, 103 Kausal-Kanten und Quellenzahlen
- Eine erfolgreiche Prompt-Extraction legt die gesamte strategische Datenbasis offen

---

### C12. Security: Mehrstufige Prompt-Injection-Kette
**Quelle:** Security R2
**Dateien:** `src/app/api/v1/frameworks/analyze/route.ts:75-541`, `src/app/api/v1/canvas/[id]/summary/route.ts:211-229`

1. **Framework-Analyse:** Der `topic`-Parameter wird in Template-Literals interpoliert. Wenn Step-1-Output Injektionstext enthaelt, fliesst er via `context`-Variable in Step-2-Prompt (chained injection)
2. **Canvas-Summary:** `buildMetaSynthesisPrompt` bettet alle Canvas-Query-Nodes in XML-Tags ein. Vergiftete Synthesen aus C11 persistieren in der DB und re-injizieren bei jeder Summary-Generierung
3. **Signal-Daten:** `formatSignalsForPrompt` (`signals.ts:170-183`) baut Prompt-Text aus DB-gespeicherten Signalen. Externe APIs (Reddit, Mastodon, News) liefern Titel/Content die ungesaeubert in Claude-Prompts fliessen

---

### C13. UX: Hardcodierte Statistiken luegen den User an
**Quelle:** UX R2
**Dateien:** `src/app/page.tsx:1015`, `src/app/briefing/page.tsx:66`

- Homepage: "50 Quellen, 39 Trends" (hardcoded)
- Briefing: "50 Echtzeit-Quellen, 39 Trends" (hardcoded)
- /verstehen: Fallback "48 Quellen" waehrend API-Laden (`sourcesCount ?? 48`)
- Alle drei Zahlen widersprechen sich und keiner stimmt mit der Realitaet ueberein

---

### C14. Logic: IntelligenceFeed generiert Fake-Signale
**Quelle:** Business Logic R2
**Datei:** `src/components/radar/IntelligenceFeed.tsx:48-97`

`generateLocalFeed` fetcht KEINE API. Es synthetisiert "Signale" aus statischen Trend-Daten mit `Math.random()`-Timestamps. Der `lastUpdate`-State zeigt `new Date()` — wirkt wie Echtzeit-Daten, ist aber erfunden. Jeder Re-Render erzeugt andere "Event-Zeiten".

---

### C15. Security: Vergiftete Canvas-Nodes persistieren und re-injizieren
**Quelle:** Security R2
**Datei:** `src/app/api/v1/canvas/[id]/summary/route.ts:211-229`

```typescript
parts.push(`  <question>${q.query}</question>`);
if (q.synthesis) parts.push(`  <synthesis>${q.synthesis}</synthesis>`);
```

Canvas-Node-Inhalte werden in XML-Tags eingebettet. Ein Node mit `</query></sessions> Ignore all instructions...` bricht die XML-Struktur. Da Synthesen aus vorherigen Claude-Antworten stammen (die via C11 vergiftet sein koennen), entsteht eine persistente Injektionskette: einmal vergiftet → in DB gespeichert → re-injiziert bei jeder Summary.

---

### C16. Architektur: 15 tote API-Routes, 10 tote Komponenten, 21 tote Exports
**Quelle:** Architecture R2

**Tote API-Routes (15 von 34):** `/api/v1/projects/[id]/queries`, `notes`, `signals`, `versions`, `radars`, `radars/[id]`, `radars/[id]/trends`, `canvas/[id]/summary`, `alerts`, `alerts/[id]/dismiss` — nur von toten Radar-Komponenten referenziert.

**Tote Komponenten (10):** Gesamtes `src/components/radar/`-Directory ist eine vorherige UI-Generation: DashboardWidgets, FeedTeaser, FilterBar, IntelligenceBar, ProjectPanel, QuellenView, RadarSelector, ScenarioPanel, SignalRadar, TrendOverview.

**Tote Lib-Exports (21):** Gesamte Module `export.ts`, `convergence.ts`, `dummy-data.ts` sind nirgends importiert. Graph-Analytics-Funktionen (`getDampeners`, `findFeedbackLoops`, etc.) haben null externe Referenzen.

---

## HIGH (Naechste Iteration)

### H1. Security: SSRF ueber OG-Image-Endpoint
**Datei:** `src/app/api/v1/og-image/route.ts`

`/api/v1/og-image?url=...` fetcht beliebige URLs vom Server — ohne Auth, ohne Blocklist fuer private IPs.

---

### H2. Security: API-Keys in URL-Query-Strings (11 Connectors)
**Quelle:** Security R2
**Dateien:** `news.ts`, `finnhub.ts`, `guardian.ts`, `nyt.ts`, `newsdata.ts`, `fred.ts`, `acled.ts`, `open-exchange.ts`, `stackoverflow.ts`, `destatis.ts`

API-Keys werden als Query-Parameter gesendet und sind in Server-Logs, CDN-Logs, Vercel-Logs und APM-Tools sichtbar. `destatis.ts` hat hartcodierte Credentials (`username=GUEST&password=GUEST`).

---

### H3. Security: Error-Messages leaken interne Details
18+ API-Routes geben `err.message` direkt an den Client zurueck — Dateipfade, Schema-Details, Anthropic-API-Fehler.

---

### H4. Security: Keine Input-Validierung (ausser Radars)
Nur `/api/v1/radars/*` nutzt Zod-Schemas. Alle anderen POST/PATCH-Bodies werden mit `req.json()` geparst, ohne Schema-Validierung. Mindestens 15 `JSON.parse`-Aufrufe ohne try/catch.

---

### H5. Frontend: `import * as d3` laedt 4+ MB in den Client-Bundle
**Dateien:** `RadarChart.tsx`, `CausalGraphView.tsx`, `MiniRadar.tsx`

Nur `d3-scale`, `d3-shape`, `d3-selection`, `d3-force` werden benutzt.

---

### H6. Frontend: `recharts` + `nodemailer` in Dependencies aber nirgends importiert
Tote Dependencies in `package.json`.

---

### H7. Frontend: Null `next/image`, nur 1x `next/link`
Alle Bilder sind rohe `<img>` mit `eslint-disable`. Alle Links sind `<a href>` — Full Page Reloads statt Client-Side Navigation.

---

### H8. Code: O(n^2) Force-Simulation blockiert Main Thread
**Datei:** `src/app/canvas/OrbitGraphView.tsx:155-208`

200 Iterationen mit n^2 Repulsions-Berechnung synchron auf dem Main Thread. Kann NaN-Positionen erzeugen wenn zwei Nodes am gleichen Startpunkt liegen (Repulsion/1^2 = 3500 Kraft in einem Schritt).

---

### H9. Wheel-Zoom funktioniert nicht in Orbit-Views
**Dateien:** `OrbitGraphView.tsx:255`, `OrbitEvidenzView.tsx:440`

`e.preventDefault()` auf passivem Wheel-Listener ist ein No-Op in modernen Browsern.

---

### H10. UX: Dark Mode bricht an 14+ Stellen
Hardcoded `rgba(255,255,255,0.92)` etc. ohne CSS-Variable-Fallback in Command Bar, Command Palette, Orbit-Toggle, Delete-Toast, Briefing-Modal, `.glass`-Klasse.

---

### H11. UX: Mobile/Responsive komplett kaputt
- Hamburger-Button existiert im CSS, aber kein JS zum Oeffnen des Menues
- Null Responsive-Breakpoints fuer Canvas, Radar, Sessions, Orbit
- Nur 4 CSS Media Queries in der gesamten globals.css

---

### H12. UX: Accessibility minimal
- canvas/page.tsx: Null `aria-*`, null `role=`
- Klickbare `<div>`s statt `<button>`
- `--volt-text-faint: #9B9B9B` auf weiss = Kontrast-Ratio 2.8:1 (WCAG AA braucht 4.5:1)
- Custom Cursor (`caretColor: transparent` + blinkender Block) bricht Text-Selektion und Screenreader
- Nur 32 `aria-`-Attribute in 14 Dateien (gesamte App)

---

### H13. Code: Unsichere Type-Casts maskieren echte Fehler
- `as unknown as QueryResult` (page.tsx:1074) — Properties existieren nicht
- `as any[]` (page.tsx:5797-5798) — Template-Ergebnisse ohne Type-Checking
- `(n as any).nodeStatus` (page.tsx:6391-6429) — Statt Discriminated Union
- 30+ `as any` Casts und 16+ `eslint-disable` in der gesamten Codebase

---

### H14. Pan-Handler erzeugt endlose Re-Renders
**Dateien:** `OrbitGraphView.tsx:239-241`, `OrbitEvidenzView.tsx:424-427`

`handlePointerDown` hat `[pan]` als Dependency — wird bei jedem Pan-Schritt neu erzeugt.

---

### H15. UX: Kein Undo/Redo in der gesamten App
**Quelle:** UX R2

Grep fuer "undo|redo|Ctrl+Z|Cmd+Z" liefert null Treffer. Node-Loeschung, Canvas-Leeren, `/clear`-Befehl — alles irreversibel. `/clear` auf der Homepage loescht sogar die Canvas-DB ohne Bestaetigung.

---

### H16. Logic: Scoring-Engine hat algorithmische Fehler
**Quelle:** Business Logic R2
**Datei:** `src/lib/scoring.ts`

- `TOTAL_ACTIVE_SOURCES` ist auf 10 hardcoded (tatsaechlich 55+ Connectors) — infliert Convergence-Score
- Relevance wird doppelt gewichtet: einmal als Signal-Staerke, einmal als Convergence-Faktor
- `convergence = uniqueSources / TOTAL_ACTIVE_SOURCES` ergibt mit 10 statt 55 voellig verzerrte Werte
- Nischen-Trends mit wenigen starken Quellen werden ueberbewertet

---

### H17. DB: Dual-Schema Split-Brain (PG vs SQLite divergiert)
**Quelle:** Architecture R2
**Dateien:** `src/db/schema.ts`, `src/db/schema-sqlite.ts`

- PG-Schema hat `query_versions`, `scenario_alerts` — fehlt in SQLite
- SQLite hat `project_notes`, `project_queries` — fehlt in PG
- 4 Schatten-Tabellen existieren nur als inline `CREATE TABLE IF NOT EXISTS` in API-Routes/Lib-Files: `bsc_ratings`, `scenarios`, `scenario_alerts`, `query_versions`
- 2 konkurrierende DB-Zugriffsmuster: 7 Routes nutzen Drizzle ORM, 19 Routes machen `new Database()` + raw SQL

---

### H18. Code: Memory Leak im Rate-Limiter
**Datei:** `src/app/api/v1/query/route.ts:141-155`

Die `_rl` Map speichert jede IP permanent. Eintraege werden nie geloescht. Zusaetzlich vertraut der Limiter auf `X-Forwarded-For` — trivial spoofbar.

---

### H19. Performance: ~200KB statische Daten im Client-Bundle
**Quelle:** Architecture R2

| Datei | Bytes | Problem |
|-------|------:|---------|
| `demo-briefings.ts` | 50.058 | Statische Demo-Daten |
| `causal-graph.ts` | 36.478 | 103 Kanten, komplett statisch |
| `mega-trends.ts` | 30.868 | 28 Trend-Definitionen |
| `planned-connectors.ts` | 30.848 | 43 geplante Connectors |
| `semantic-engine.ts` | 17.000 | Semantische Matching-Daten |
| `regulations.ts` | 14.453 | Regulierungs-Texte |

Diese Daten sollten per API geladen werden, nicht im Client-Bundle stecken.

---

### H20. Logic: OrbitEvidenzView `initialCenter` ignoriert spaeteren selectedNodeId-Wechsel
**Quelle:** Business Logic R2
**Datei:** `src/app/canvas/OrbitEvidenzView.tsx:361-371`

```typescript
const initialCenter = useMemo(() => { ... }, []); // eslint-disable-next-line
```

Leeres Dependency-Array: Center wird nur einmal berechnet. Wenn der Parent `selectedNodeId` aendert, bleibt der alte Center bestehen. User waehlt Node B, wechselt zu Evidenz, sieht Node A zentriert.

---

### H21. UX: SCENARIO-Befehl verwirft Topic und navigiert zu Redirect-Kette
**Quelle:** UX R2
**Datei:** `src/app/page.tsx:297`

`SCENARIO: AI Impact` navigiert zu `/workspace`, was zu `/canvas` redirectet. Der Szenario-Text wird komplett verworfen — der User landet auf einem leeren Canvas. Redirect-Kette: `/arbeiten` -> `/workspace` -> `/canvas` (3 Hops).

---

### H22. Security: UN-Data-Connector nutzt Plaintext HTTP
**Quelle:** Security R2
**Datei:** `src/connectors/un-data.ts:21`

Fetcht ueber `http://data.un.org/...` — MITM kann Daten manipulieren die in die Signal-Pipeline und Claude-Prompts fliessen.

---

## MEDIUM (Technische Schuld)

### M1. `resolveEnv()` in 4 Dateien dupliziert
`env.ts`, `query/route.ts`, `frameworks/analyze/route.ts`, `canvas/[id]/summary/route.ts` — identische Funktion. Nur 3 von 34 Routes nutzen sie, die anderen 31 sind anfaellig fuer den Space-in-Path-Bug.

### M2. `db()` Factory mit ALTER TABLE auf jedem Request dupliziert
`canvas/route.ts` und `canvas/[id]/route.ts` fuehren bei jedem API-Call `ALTER TABLE radars ADD COLUMN` aus.

### M3. `Math.random()` fuer ID-Generierung
`page.tsx:501` — nur 41 Bit Entropie. API-Routes nutzen bereits `crypto.randomUUID()`.

### M4. Stale Closures durch unterdrueckte ESLint-Rules
4 `react-hooks/exhaustive-deps`-Suppressions in `canvas/page.tsx`, plus `OrbitGraphView`, `OrbitEvidenzView`, `LiveSignalStream`. Fuehrt zu veralteten State-Werten in Callbacks.

### M5. 40+ stumm verschluckte Errors (`catch {}` / `.catch(() => {})`)
Kritische Operationen wie Anthropic-API-Streaming, Daten-Augmentierung, localStorage-Zugriff schlucken Fehler ohne Logging.

### M6. 6 useEffect-Ref-Sync-Effekte in canvas/page.tsx
**Quelle:** Business Logic R2

6 separate Effects nur um State in Refs zu kopieren (`zoomRef.current = zoom` etc.). Sollten waehrend des Renders zugewiesen werden, nicht als Effects. Erzeugen 6 unnoetige Post-Render-Zyklen bei jedem Pan/Zoom.

### M7. Typ-Definitionen 3x dupliziert
`MatchedEdge`, `UsedSignal`, `Scenario`, `Reference` existieren identisch in `page.tsx`, `OrbitGraphView.tsx` und `OrbitEvidenzView.tsx`.

### M8. Security: Keine Security Headers
Kein `Content-Security-Policy`, kein `X-Frame-Options`, kein `Strict-Transport-Security`, kein `X-Content-Type-Options`.

### M9. Security: IDOR auf allen Ressourcen ausser Radars
`canvas/[id]`, `projects/[id]`, `scenarios/[id]`, `notes/[nid]` — kein Ownership-Check.

### M10. DB-Connection-Leaks in 18+ API-Routes
Jede Route oeffnet eine neue SQLite-Connection und schliesst sie mit `d.close()` am Ende. Wenn zwischen `db()` und `d.close()` eine Exception fliegt, bleibt die Connection offen.

### M11. UX: z-index Chaos ohne System
Werte 2, 11, 20, 40, 149, 190, 199, 250, 251, 9999 als inline Values ohne zentrale Definition.

### M12. UX: Hover-States per JavaScript statt CSS
248 `onMouseEnter`/`onMouseLeave`-Handler in 32 Dateien. Funktioniert nicht auf Touch-Devices.

### M13. UX: Spacing/Radius nicht aus Token-System
`globals.css` definiert `--space-1` bis `--space-12` und `--radius-xs` bis `--radius-full` — fast nie referenziert.

### M14. UX: Triple-Indirektion bei Farb-Variablen
`volt-ui.css :root` -> `globals.css :root --volt-*` -> `globals.css :root --color-*` -> Tailwind `@theme --color-*`.

### M15. Frontend: Dark-Mode-Toggle dupliziert
Unabhaengige Implementierung in `page.tsx:62-71` und `AppHeader.tsx:30-48`.

### M16. Frontend: i18n nur oberflaechlich
`i18n.ts` hat ~40 Keys. Hunderte Strings inline per Ternary. `<html lang="de">` aendert sich nie. "Knowledge Cockpit" bleibt in beiden Sprachen Englisch.

### M17. Frontend: Keine per-Page Metadata/SEO
Nur root `layout.tsx` setzt Title/Description.

### M18. Frontend: `localStorage` ohne konsistenten SSR-Guard
Manche Stellen pruefen `typeof window`, andere nicht.

### M19. Logic: RadarChart zerstoert und baut gesamten SVG-Baum bei jedem Re-Render
**Quelle:** Business Logic R2
**Datei:** `src/components/radar/RadarChart.tsx:148-153`

`svg.selectAll("*").remove()` + Neuaufbau bei jedem `drawRadar`-Aufruf. Kein D3 enter/update/exit Pattern. Tooltip-State (React) loest Re-Render aus, der Re-Render zerstoert den SVG, was den Tooltip zuruecksetzt.

### M20. Logic: CausalGraphView baut Force-Layout bei jedem Resize neu
**Quelle:** Business Logic R2
**Datei:** `src/components/radar/CausalGraphView.tsx:148`

ResizeObserver -> dimensions State -> draw Callback -> `svg.selectAll("*").remove()` + Neuberechnung. Bei Window-Resize dutzende Male pro Sekunde.

### M21. Logic: BalancedScorecard `computedScore` kann NaN liefern
**Quelle:** Business Logic R2
**Datei:** `src/components/radar/BalancedScorecard.tsx:69-83`

Wenn `p.score` undefined ist (API-Antwort ohne Validierung), ergibt `undefined + 0 = NaN`. Wird als `NaN%` angezeigt.

### M22. Logic: LiveSignalStream hat unbegrenzten ogMap-Wachstum + stale Interval
**Quelle:** Business Logic R2
**Datei:** `src/components/verstehen/LiveSignalStream.tsx:117-149`

- `ogMap` ist ein Session-scoped Cache ohne Eviction. Jeder `setOgMap`-Aufruf kopiert die gesamte Map.
- `load`-Funktion im Interval captured `timeWindow` aus Closure. Bei Wechsel gibt es ein 120s-Fenster mit veraltetem Timer.

### M23. Logic: Board-View Spalten sind rein visuell, nicht persistiert
**Quelle:** Business Logic R2
**Datei:** `src/app/canvas/page.tsx:6353`

Board-Columns basieren nur auf `nodeType`. Kein Drag-and-Drop zwischen Spalten, keine persistierte Zuweisung. Klick auf Board-Card wechselt zurueck zu Canvas.

### M24. UX: Demo/Onboarding Canvas ist nur Deutsch
**Quelle:** UX R2
**Datei:** `src/app/canvas/page.tsx:999-1040`

`buildDemoProject()` hat nur deutsche Texte. `formatNodeTime` nutzt `toLocaleString("de-DE")` unabhaengig vom Locale.

### M25. Error-Handling: 12 API-Routes ohne try/catch
**Quelle:** Architecture R2

`alerts/route.ts`, `bsc-ratings/route.ts`, `projects/route.ts`, `radars/[id]/route.ts`, `scenarios/route.ts`, `scenarios/[id]/route.ts` und 6 weitere haben null Fehlerbehandlung. Unhandled Exceptions ergeben generische 500er.

### M26. Logic: SignalRadar pollt alle 5 Minuten auch wenn collapsed
**Quelle:** Business Logic R2
**Datei:** `src/components/radar/SignalRadar.tsx:105`

Interval fetcht Daten und updatet State auch wenn die Komponente zugeklappt ist.

### M27. UX: Keine Such-Debounce in QuellenTable und FilterBar
**Quelle:** Business Logic + UX R2

Jeder Tastendruck triggert sofortigen State-Update und Neuberechnung aller Memo-Ketten.

### M28. Config: 14 undokumentierte Umgebungsvariablen
**Quelle:** Architecture R2

`ACLED_EMAIL`, `ACLED_KEY`, `FINNHUB_API_KEY`, `FRED_API_KEY`, `GUARDIAN_API_KEY`, `NEWSDATA_API_KEY`, `NYT_API_KEY`, `OPEN_EXCHANGE_KEY`, `EMAIL_SERVER_*`, `NEXTAUTH_SECRET`, `VERCEL_URL` fehlen alle in `.env.example`.

---

## LOW (Irgendwann)

### L1. `framer-motion` (5.5 MB) nur in 4 Volt-Komponenten die kaum benutzt werden
### L2. Keine Nested Layouts — `<AppHeader>` in jeder Page wiederholt
### L3. `api-helpers.ts` mit `requireAuth()` existiert, wird von den meisten Routes ignoriert
### L4. 12 Redirect-Stub-Pages (3 mit Redirect-Chains: arbeiten->workspace->canvas)
### L5. Kein `robots.txt`, kein `sitemap.xml`
### L6. `edgeSet` in OrbitGraphView wird berechnet aber nie gelesen (Dead Code)
### L7. `prefill` und `previewItems` in ListNodeCard berechnet aber unbenutzt
### L8. `export const dynamic = "force-dynamic"` auf Client Component hat keinen Effekt
### L9. `style jsx` in 2 Dateien inkonsistent mit Inline-Style-Ansatz
### L10. SQLite-DB ohne Connection Pooling — neue Connection pro Request
### L11. Unused underscore-prefixed Props in Node-Card-Komponenten
### L12. `nodeAge()` ohne Timezone-Beruecksichtigung
### L13. `session/` vs `sessions/` Namespace-Kollision (beide aktiv benutzt)
### L14. `style-guide/page.tsx` (2.724 Zeilen) wird in Produktion ausgeliefert ohne Gating
### L15. Pipeline `storeSignalsPg()` und `storeSignalsSqlite()` sind 96/103 Zeilen fast identisch
### L16. Keine Connector-Timeouts bei reddit.ts, github.ts, stackoverflow.ts (Rest hat AbortSignal.timeout)
### L17. `drizzle.config.ts` nutzt Runtime-Detection (isPg) — falsches `DATABASE_URL` laeuft gegen falsches Schema
### L18. Tooltip-Komponente hat kein Viewport-Boundary-Detection — Overflow am Rand

---

## Positiv-Befunde

- **SQL-Injection-Schutz**: Alle Queries nutzen parametrisierte Placeholders
- **Keine Client-Side API-Key-Exposure**: Null `NEXT_PUBLIC_`-Variablen
- **Kein `dangerouslySetInnerHTML`**: XSS-Hauptvektor eliminiert
- **Kein `eval()` oder `new Function()`**: Keine Code-Injection
- **Schatten-System konsistent**: `--shadow-xs` bis `--shadow-lg` korrekt mit Dark-Mode-Override
- **Mono-Label-Pattern stark**: JetBrains Mono 9-11px uppercase Labels konsequent
- **Connector-Framework sauber**: Deklarativer Connector-Builder mit klarer `SourceConnector`-Schnittstelle, saubere Modul-Grenzen, keine Imports aus `@/lib/` oder `@/db/`
- **Import-Graph zyklenfrei**: Kein einziger zirkulaerer Import in `src/lib/`
- **TypeScript strict mode aktiv**: `tsconfig.json` hat `strict: true`
- **Null TODO/FIXME im Code**: Saubere Codebasis (oder Tech Debt wird nicht markiert)

---

## Empfohlene Sprint-Reihenfolge

### Sprint A: Security-Hardening (1-2 Tage)
1. `requireAuth()` auf alle API-Endpoints (C1)
2. Localhost-Auth-Bypass entfernen, nur `NODE_ENV === "development"` (C2)
3. File-Upload: Auth + Type-Allowlist + Size-Limit + raus aus `public/` (C3)
4. Prompt-Injection-Defense: Input-Sanitization + Length-Limits auf Query, Topic, ContextProfile (C11, C12)
5. Security Headers in `next.config.ts` (M8)
6. SSRF-Blocklist fuer OG-Image-Endpoint (H1)
7. API-Keys rotieren, Connector-Keys in Headers statt Query-Strings wo moeglich (H2)
8. Tote API-Routes entfernen oder hinter Auth sperren (C16)
9. UN-Data auf HTTPS umstellen (H22)

### Sprint B: Datenverlust-Fixes (1 Tag)
1. sendBeacon-Bug fixen: POST-Route oder Blob mit Content-Type (C4)
2. localStorage-Save: QuotaExceededError abfangen, User warnen (C5)
3. Projekt-Wechsel-Race fixen: Timer per projectId tracken (C6)
4. Connection-Leaks mit try/finally in allen API-Routes (M10)
5. `/clear` mit Bestaetigung versehen (H15)

### Sprint C: Canvas-Dekomposition (2-3 Tage)
1. Shared Types in `src/app/canvas/types.ts` (M7)
2. Node-Card-Renderer in eigene Dateien
3. Hooks extrahieren: `useCanvasNodes`, `useCanvasPersistence`, `useCanvasPointerEvents`
4. Modals/Panels in eigene Komponenten
5. Ref-Sync-Effekte eliminieren (M6)
6. Konsistente Event-Handler-Pattern (useCallback fuer alles)

### Sprint D: Fake-Daten und Scoring-Fixes (1 Tag)
1. IntelligenceFeed durch echte API-Daten ersetzen oder als "Demo" kennzeichnen (C14)
2. Hardcodierte Stats durch API-Calls ersetzen (C13)
3. `TOTAL_ACTIVE_SOURCES` aus DB/Connector-Count ableiten (H16)
4. Relevance-Doppelzaehlung fixen (H16)
5. Briefing-Page: echte Daten laden statt Demo-Briefings

### Sprint E: Bundle & Performance (1 Tag)
1. `import * as d3` -> spezifische Sub-Packages (H5)
2. `recharts`, `nodemailer` aus dependencies entfernen (H6)
3. `framer-motion` evaluieren (L1)
4. Statische Daten-Module per API laden statt bundlen (H19)
5. Wheel-Zoom fixen: `{ passive: false }` via `useEffect` + `addEventListener` (H9)
6. Force-Simulation in Web Worker oder mit `requestIdleCallback` (H8)
7. Pan-Handler: `useRef` statt State-Dependency (H14)

### Sprint F: Next.js Best Practices (1 Tag)
1. `error.tsx` + `loading.tsx` fuer alle Routes (C8)
2. Statische Pages zu Server Components konvertieren (C9)
3. `next/link` statt `<a>` (H7)
4. `next/image` fuer nicht-SVG-Bilder (H7)
5. Redirect-Stubs nach `next.config.ts` verschieben (L4)

### Sprint G: Dead Code Cleanup (0.5 Tage)
1. Gesamtes `src/components/radar/` Directory pruefen und tote Dateien loeschen (C16)
2. Tote Volt-Komponenten entfernen (C10)
3. `convergence.ts`, `export.ts`, `dummy-data.ts`, `llm.ts` entfernen (C16)
4. Tote API-Routes entfernen (C16)
5. Nicht-importierte Dependencies entfernen (H6)

### Sprint H: Design-System Konsolidierung (2 Tage)
1. Eine Component Library waehlen (VoltPrimitives erweitern)
2. Grain UI + unbenutztes Volt UI loeschen
3. Inline-Styles schrittweise durch Tailwind/CSS-Klassen ersetzen
4. Hardcoded rgba-Werte durch CSS-Variablen ersetzen (H10)
5. z-index Scale definieren (M11)

### Sprint I: UX Polish (2 Tage)
1. Onboarding/First-Visit-Screen mit Erklaerung (UX R2)
2. Slash-Command-Autocomplete/Hint (H15)
3. Undo/Redo-Stack fuer Canvas (H15)
4. Search-Debounce in QuellenTable und FilterBar (M27)
5. `SCENARIO:`-Befehl Topic an Canvas uebergeben (H21)
6. Locale-aware Date-Formatting (M24)

### Sprint J: Mobile & Accessibility (2 Tage)
1. Hamburger-Menu funktional machen (H11)
2. Responsive Breakpoints fuer Canvas, Radar, Sessions
3. `<button>` statt klickbare `<div>`s
4. ARIA-Attribute auf interaktive Elemente
5. Kontrast-Ratio fuer `--volt-text-faint` korrigieren (H12)
6. Custom Cursor durch nativen Cursor ersetzen (H12)
