# Pre-Frage / Pre-Question Framework — Spec

**Status:** v0.1 draft (initial implementation 2026-04-23)
**Wiring:** wired (`POST /api/v1/frameworks/analyze` with `frameworkId=pre-frage`)
**UI:** `/frameworks/pre-frage`

---

## Mission Statement

Pre-Frage ist das **einzige SIS-Framework, das keine Antworten liefert**.
Statt eine gestellte Frage zu beantworten, identifiziert es die richtigen
Fragen — bevor irgendeine Analyse beginnt.

Das adressiert den häufigsten strategischen Fehler: **die falsche Frage
perfekt zu beantworten.** Pre-Frage ist die intellektuelle Vorarbeit, die
in der Praxis fast immer übersprungen wird.

## Methodische Inspiration

| Quelle | Beitrag |
|---|---|
| **Hal Gregersen** (MIT, *Questions Are the Answer*) | „Question Burst" als Methode strukturierter Frage-Generierung |
| **Charlie Munger** | „Invert, always invert" — Inversion als Erkenntnis-Werkzeug |
| **Phil Tetlock** (Superforecaster-Forschung) | Decomposition in MECE-Sub-Fragen als Schlüsselskill |
| **Edgar Schein** (*Humble Inquiry*) | Antwort-vor-Frage als häufigster Beratungsfehler |
| **Toyota** (5 Whys) | Iteratives Vertiefen als strukturierte Praxis |
| **Right Question Institute** (RQI) | Frage-Formulierung als eigenständige Disziplin |
| **Pre-Mortem-Methode** (Gary Klein) | Rückwärts denken vom Failure-Szenario |

## Architektonische Verortung im SIS

Pre-Frage steht in **architektonischer Symmetrie** zur Iteration-Loop
Pass 2 (`src/lib/signal-relevance-llm.ts`, eingeführt 2026-04-23 in
Commit `e7f9699`):

- **Pass 2** ist Self-Critique auf der **Output-Seite** (das System
  validiert seine Antworten — sind die Signale wirklich relevant für
  die Frage?)
- **Pre-Frage** ist Self-Critique auf der **Input-Seite** (das System
  validiert die Frage — ist das wirklich die richtige Frage?)

Beide zusammen bilden einen vollständigen Reflection-Loop:

```
Input (Question)  →  Pre-Frage (Self-Critique Input)  →  Refined Question
                                                              ↓
                                            Pass 1 (mechanical retrieval)
                                                              ↓
                                            Pass 2 (LLM-Relevance, Self-Critique Output)
                                                              ↓
                                                       Synthesis (LLM)
                                                              ↓
                                                       Output (Answer)
```

## Vier-Schritte-Pipeline

### Schritt 1 — Reframing

**Frage:** „Welche Frage steckt HINTER dieser Frage?"

**Output-Schema:**
```json
{
  "originalQuestion": "Verbatim user input",
  "implicitAssumptions": [
    {"assumption": "X is the right unit of analysis",
     "whyMatters": "If X is wrong, every answer is wrong [SIGNAL/TREND: …]"}
  ],
  "reframings": [
    {"frame": "Stakeholder lens (e.g. regulator, user, employee)",
     "reformulated": "Same topic phrased through this lens",
     "whyDifferent": "What this surfaces that the original misses"}
  ],
  "deeperQuestion": {
    "candidate": "The question behind the question (one sentence)",
    "reasoning": "Why this is more fundamental than what was asked"
  },
  "synthesis": "2-3 sentences"
}
```

**Mindest-Output:** 4 implizite Annahmen, 4 Reframings (verschiedene Linsen),
1 deeperQuestion-Kandidat. Jede Eintrag muss mindestens ein
`[SIGNAL/TREND/EDGE]`-Tag referenzieren wo anwendbar — Reframings müssen in
beobachtbarer Realität geerdet sein, nicht vibe-basiert.

### Schritt 2 — Decomposition + STEEP+V Linsen

**Frage:** „Welche MECE-Sub-Fragen muss man beantworten? Was sagt jede
STEEP+V-Dimension?"

**Output-Schema:**
```json
{
  "mainQuestion": "Refined main question",
  "subQuestions": [
    {"question": "MECE sub-question",
     "type": "definitional|factual|normative|prognostic|causal|hypothetical",
     "whyEssential": "Why this must be answered before the main one",
     "addressableBy": "framework-name | live-signals | external-research"}
  ],
  "lensQuestions": {
    "social": [{"question": "…", "rationale": "…"}],
    "technological": [{"question": "…", "rationale": "…"}],
    "economic": [{"question": "…", "rationale": "…"}],
    "environmental": [{"question": "…", "rationale": "…"}],
    "political": [{"question": "…", "rationale": "…"}],
    "values": [{"question": "What unstated values / ethics are at play?", "rationale": "…"}]
  },
  "timeHorizonQuestions": [
    {"horizon": "now (0-12 months)", "question": "…"},
    {"horizon": "mid (1-5 years)", "question": "…"},
    {"horizon": "long (5-15 years)", "question": "…"},
    {"horizon": "structural (15+ years)", "question": "…"}
  ],
  "synthesis": "2-3 sentences"
}
```

**Mindest-Output:** 5 Sub-Fragen (kein Overlap, kollektiv erschöpfend),
mindestens 1 Frage pro STEEP+V-Dimension, 4 Time-Horizon-Fragen.

### Schritt 3 — Inversion + Provokation

**Frage:** „Was wäre die unbequemste Frage? Welche Frage wollen wir nicht
stellen?"

**Output-Schema:**
```json
{
  "inversionQuestions": [
    {"question": "What would have to be true for X to NOT matter?",
     "uncomfortableBecause": "Why people don't usually ask this"}
  ],
  "tabooQuestions": [
    {"question": "The question nobody in the room wants to voice",
     "tabooReason": "Political, ethical, status-related, etc.",
     "whyImportant": "What it would surface"}
  ],
  "premortemQuestion": {
    "scenario": "Brief sketch of how the strategy fails in 5 years",
    "missedQuestion": "The exact question that would have prevented this if asked now",
    "earlyWarningSignals": ["Observable signal 1", "Signal 2", "Signal 3"]
  },
  "blindSpotQuestions": [
    {"question": "Question about something invisible from current vantage point",
     "vantagePointShift": "What perspective makes this visible"}
  ],
  "synthesis": "2-3 sentences"
}
```

**Mindest-Output:** 3 Inversions, 3 Tabu-Fragen, 1 Pre-Mortem-Szenario mit
verpasster Frage + 3 Early-Warning-Signals, 3 Blind-Spot-Fragen.

### Schritt 4 — Kritische Fragen + Knowledge-Gap + Framework-Anschluss

**Frage:** „Was sind die TOP-3 kritischen Fragen? Welche Daten fehlen?
Welches Framework adressiert was?"

**Output-Schema:**
```json
{
  "criticalQuestions": [
    {
      "rank": 1,
      "question": "The single most important question to answer first",
      "whyCritical": "What hinges on the answer",
      "ifNotAnswered": "What goes wrong if we proceed without this answer",
      "addressableBy": {
        "framework": "marktanalyse | trend-deep-dive | pre-mortem | post-mortem | war-gaming | stakeholder | design-thinking | (none)",
        "rationale": "Why this framework is the right next tool"
      }
    }
  ],
  "knowledgeGaps": [
    {"gap": "What data we don't have",
     "couldComeFrom": "SIS connector OR external source category",
     "currentlyAvailable": true,
     "decisiveFor": "Which critical question this would resolve"}
  ],
  "frameworkRoadmap": [
    {"order": 1,
     "framework": "Specific SIS framework",
     "questionItAddresses": "Which sub-question this answers",
     "estimatedEffort": "low | medium | high",
     "dependsOn": "What must be known first"}
  ],
  "explicitAssumptionsToTest": [
    {"assumption": "Bracketed for now",
     "testHow": "How we'd validate later"}
  ],
  "honestStateOfKnowledge": "2-4 sentences: what we know, don't know, most uncertain",
  "synthesis": "Short executive summary"
}
```

**Mindest-Output:** 3 kritische Fragen (Top-3 ranked, jede mit Framework-
Handoff), 4 Wissens-Lücken, 2-3 Framework-Roadmap-Einträge, 2 explizite
Annahmen zum späteren Test. **Jede kritische Frage MUSS** ein konkretes
nächstes Framework oder eine externe Recherche-Kategorie referenzieren —
keine Sackgassen.

## SIS-spezifische Verankerung

Andere Tools können auch nach Methode Fragen generieren lassen. Pre-Frage
nutzt **drei SIS-spezifische Assets**, die das Framework einzigartig
machen:

1. **Live-Signal-Pool als Frage-Provokateur:** Implizite Annahmen können
   gegen aktuelle Signale geprüft werden („Du nimmst X an — diese 8
   Signale legen das Gegenteil nahe")
2. **Trend-Graph als Implikations-Erweiterer:** Eine Frage tangiert
   möglicherweise mehrere Trends mit kausalen Verbindungen, die der User
   nicht mitgedacht hat
3. **Szenarien-Engine als Stress-Test:** „In welchem zukünftigen Szenario
   wäre deine Frage irrelevant?" — Pre-Mortem-Schritt nutzt das

## Modell-Konfiguration

- **LLM:** `claude-sonnet-4-5` (gleiches Modell wie andere Frameworks)
- **max_tokens:** 8000 pro Schritt
- **Schritte:** 4 (sequentiell, jeder Schritt nutzt Vor-Schritt-Kontext)
- **Cost-Schätzung:** ähnlich anderen 4-Schritt-Frameworks (~$0.10-0.15
  pro vollständige Pre-Frage-Session)
- **Latenz:** ähnlich (~30-60s pro Schritt, abhängig von Output-Reichtum)

## UX-Pattern

**Modus-Setzung:** Beim Eintritt ins Framework wird klar kommuniziert —
„Dieses Framework liefert KEINE Antworten. Es identifiziert die richtigen
Fragen, die du dann mit anderen Frameworks beantworten kannst."

**Anschluss-Brücke:** Der Output von Schritt 4 enthält explizit
`frameworkRoadmap` — eine geordnete Empfehlung welches SIS-Framework als
Nächstes laufen sollte. Geplant: ein „Framework starten"-Button neben
jedem Roadmap-Eintrag, der direkt das nächste Framework mit der
empfohlenen Frage als Topic vorbefüllt.

**Visuelles Signal:** Anders als andere Frameworks (Charts, Matrices)
nutzt Pre-Frage **keine Diagramme** — nur ruhige, lesbare Karten-Listen
pro Frage-Klasse. Das Output ist fundamental anders (Hierarchie von
Fragen statt Antwort-Strukturen) und sollte sich auch visuell anders
anfühlen.

## Differenzierungs-These

| Tool | Primärer Output |
|---|---|
| Perigon | Antworten (Search-driven) |
| Sokosumi | Antworten (Agent-driven) |
| Inno-Verse | Antworten (Trend-driven) |
| ChatGPT/Claude (vanilla) | Antworten (Conversational) |
| **SIS Pre-Frage** | **Fragen (Reflection-driven)** |

Im Stakeholder-Gespräch positioniert: „Strategie-Beratung als Question
Generation" — McKinsey/BCG-Vokabular, das in Workshop-Vorbereitung,
Board-Meeting-Agenda-Findung und Investitions-Entscheidungs-Prep
sofortigen Wert liefert.

## Bekannte Limitationen (v0.1)

1. **Keine Verbindung zu Live-Signal-Pool im Prompt:** Der World-Model-
   Block (Trends + Edges + Regulations) wird injiziert, aber Live-Signale
   werden in dieser ersten Version NICHT explizit für Frage-Generierung
   konsultiert. Geplant: zweite Iteration die Live-Signale in den Prompt
   reicht und das LLM auffordert „diese Signale legen folgende Fragen
   nahe, die nicht in der Original-Frage sind".

2. **Keine Pass-2-Integration:** Pre-Frage produziert Fragen-Output, der
   nicht durch Pass 2 (LLM-Relevance) gefiltert wird — andere Klasse von
   Output. Falls in der Praxis dennoch Off-Topic-Fragen generiert werden,
   sollte ein leichter Self-Critique-Pass im Schritt 4 ergänzt werden.

3. **UI-Visualisierungen sind minimal:** Karten-Listen reichen für v0.1;
   spätere Iterationen könnten Frage-Trees als Tree-Visualisierung
   rendern (D3 collapsible tree o.ä.).

4. **„Framework starten"-Button noch nicht implementiert:** Die Roadmap-
   Einträge in Schritt 4 verweisen auf konkrete Frameworks, aber der
   direkte Sprung von dort in das nächste Framework ist v0.2-Feature.

5. **Nur Sonnet 4.5 als Modell:** Pre-Frage könnte mit Opus betrieben
   werden für tiefere Reframings. Cost-vs-Quality-Trade-off in einer
   späteren Iteration zu entscheiden.

## Files

| File | Zweck |
|---|---|
| `src/types/frameworks.ts` | `FrameworkId` + `FRAMEWORK_META`-Eintrag |
| `src/app/api/v1/frameworks/analyze/route.ts` | 4 Step-Prompts in `FRAMEWORK_PROMPTS["pre-frage"]` + Validation in `VALID_STEPS` |
| `src/lib/system-prompts-registry.ts` | Registry-Eintrag für die Doku-Seite |
| `src/lib/i18n.ts` | DE + EN Strings unter `preFrage.*` |
| `src/app/frameworks/pre-frage/page.tsx` | UI-Page mit 4 StepCards |
| `src/app/HomeClient.tsx` | Tile auf Home-Seite (Tooltip + Link) |
| `docs/frameworks/pre-frage-spec.md` | Diese Spec |

## Nächste Iterationen

1. **v0.2:** „Framework starten"-Button, der direkt in das nächste
   Framework navigiert mit der empfohlenen Frage
2. **v0.2:** Live-Signal-Konsultation im Reframing-Schritt (Pass 1
   Retrieval auf die Original-Frage, Signale werden als Provokation in
   den Prompt gereicht)
3. **v0.3:** Tree-Visualisierung der Frage-Hierarchie (collapsible D3)
4. **v0.3:** Export-Pfad „Workshop-Briefing-PDF" mit den Top-3 kritischen
   Fragen als Diskussions-Vorlage für Strategie-Workshops
5. **v0.4:** Iteration-Loop innerhalb von Pre-Frage selbst — wenn die
   generierten Fragen zu generisch sind, automatisch Refinement-Pass

## Anschluss zur Iteration-Loop-Architektur

Mit Pre-Frage besteht das vollständige System nun aus:

```
[INPUT-SIDE Self-Critique]   Pre-Frage (this framework)
[RETRIEVAL]                  Pass 1 (multi-evidence-gate, ff19ba5)
[OUTPUT-SIDE Self-Critique]  Pass 2a + Pass 2b (LLM-relevance, e7f9699)
[SYNTHESIS]                  Sonnet (existing pipeline)
```

Pre-Frage und Pass 2 sind die zwei Self-Critique-Schichten — der erste
schützt davor die falsche Frage zu beantworten, der zweite schützt
davor irrelevante Daten als Evidenz zu nutzen. Zusammen: ein
Reflection-Loop, der mit jeder Schicht honester wird.
