# Pre-Frage / Pre-Question Framework — Spec

**Status:** v0.2 (Founder-Korrektur, 2026-04-23 Abend)
**Wiring:** wired (`POST /api/v1/frameworks/analyze` mit `frameworkId=pre-frage`)
**UI:** `/frameworks/pre-frage`
**Vorgänger:** v0.1 (Commit `485546d`) ist im git, aber im Code retired

---

## Mission Statement

Pre-Frage ist das **einzige SIS-Framework mit Themenfeld als Input und ohne Antwort als Output.** Statt eine Frage zu beantworten, **entwickelt** es die richtigen Fragen für ein Themenfeld.

Adressiert den Use-Case **„neuer Beratungsauftrag, Themenfeld noch unbekannt"**: ein Berater bekommt ein Mandat „wir wollen X verstehen", weiß aber nicht was zu X eigentlich gefragt werden muss. Pre-Frage liefert die Karte: Topic-Mapping → Question-Atlas → Starter-Sequenz.

---

## v0.1 → v0.2 — Was sich geändert hat

**v0.1 (RETIRED):** „Question-Coaching"
- Input: vage User-Frage
- Prozess: Reframing, Decomposition, Inversion, Critical Synthesis
- Output: dieselbe Frage in besser
- Use-Case: User hat eine schlechte Frage → System schärft sie

**v0.2 (CURRENT):** „Question-Atlas für Themen"
- Input: ein TOPIC (3-15 Wörter, KEINE Frage)
- Prozess: Topic-Mapping, Question-Generation+Curation, Starter-Sequenz
- Output: kuratierter Frage-Atlas, kein Antwort
- Use-Case: User kennt ein Themenfeld noch nicht → System entwickelt was zu fragen ist

**Founder-Korrektur:**
> „Es sollen keine Fragen gestellt werden, sondern Fragen zu komplexen Themen entwickelt werden."

v0.1 hatte den fundamentalen Use-Case missverstanden. v0.2 ist eine strukturelle Neuausrichtung, kein Refactor.

---

## Methodische Inspiration

| Quelle | Beitrag |
|---|---|
| **Edgar Morin** (Komplexitätstheorie) | Multiple Linsen auf komplexe Systeme — Topic-Mapping als strukturelle Vorarbeit |
| **McKinsey Issue-Trees** | MECE-Decomposition als Strukturwerkzeug |
| **Hal Gregersen** (MIT, Question-Burst) | „Intern viele generieren, extern wenige zeigen" — Curation IST der Wert |
| **Cynefin** (Snowden) | Welche Klasse von Fragen lässt das Domäne überhaupt zu? |
| **Foresight-Methode** | „Welche Fragen werden in 10 Jahren wichtig?" → Time-Horizon-Bewusstsein |
| **Strategic Foresight Institute / RAND** | Topic-Scanning als Methode |
| **Charlie Munger** | Inversion als Provokations-Werkzeug |

---

## Drei-Schritte-Pipeline

### Schritt 1 — Topic-Mapping

**Frage an das System:** „Was IST dieses Thema eigentlich? Welche Facetten, welche Stakeholder, welche SIS-Welt-Modell-Verbindungen, welche Grenzen?"

**Output-Schema:**
```json
{
  "topic": "Verbatim user input",
  "topicReformulation": "More precise statement in one sentence",
  "facets": [
    {
      "name": "Concrete facet name (5-10 words)",
      "scope": "What concretely belongs here (10-25 words)",
      "stakeholders": ["Specific actor 1", "Specific actor 2"],
      "connectedTrends": ["Trend names verbatim from world model"],
      "connectedRegulations": ["Regulation names verbatim from world model"]
    }
  ],
  "boundaries": {
    "inScope": ["Aspect clearly in"],
    "outOfScope": ["Adjacent area NOT covered"],
    "rationale": "Why these boundaries (1 sentence)"
  },
  "synthesis": "2-3 sentences"
}
```

**Mindest-Output:** 5 Facetten (jede mit ≥2 Stakeholdern + ≥1 Welt-Modell-Anker), 3 inScope, 3 outOfScope.

**Kritische Bedingung:** Jede Facette muss themen-spezifisch sein. Generic-Facetten („Stakeholder", „Drivers") werden im Prompt explizit abgelehnt.

### Schritt 2 — Question Atlas

**Frage an das System:** „Generiere intern 30-50 Kandidaten-Fragen, kuratiere auf 7-9 Core-Fragen + 2-3 Provokante + 1-3 Open-Research."

**Output-Schema:**
```json
{
  "coreQuestions": [
    {
      "rank": 1,
      "class": "status | kausal | prognostisch | normativ | strategisch | definitorisch | strukturell | cross-domain",
      "question": "Themen-spezifische Frage [SIGNAL/TREND/EDGE: ...]",
      "whyMatters": "1-2 Satz Begründung",
      "addressableBy": {
        "framework": "marktanalyse | trend-deep-dive | pre-mortem | post-mortem | war-gaming | stakeholder | design-thinking",
        "rationale": "Warum dieses Framework"
      },
      "dataAvailability": "live-signals | partial | research-needed",
      "facetReference": "Welche Facette aus Schritt 1"
    }
  ],
  "provocativeQuestions": [
    {
      "type": "tabu | inversion | blind-spot",
      "question": "Die unbequeme Frage",
      "whyProvocative": "Warum normalerweise nicht gestellt"
    }
  ],
  "openResearch": [
    {
      "topic": "Was dieses Item adressiert",
      "wouldNeed": "Welche Art von Arbeit (z.B. Interviews, philosophische Analyse)",
      "whyNoFramework": "Warum kein SIS-Framework passt"
    }
  ],
  "synthesis": "2-3 sentences"
}
```

**Constraints:**
- coreQuestions: EXAKT 7-9 Einträge, gerankt, mind. 4 verschiedene Klassen vertreten
- provocativeQuestions: 2-3 Einträge, mind. 2 verschiedene Typen
- openResearch: 1-3 Einträge
- Jede Core-Question hat zwingend ein Framework-Handoff mit Rationale
- Jede Frage MUSS themen-spezifisch sein (austauschbare Generika werden abgelehnt)

**Curation-Prinzip:** Lange Listen sind Listen-Tyrannei. Der Wert ist die ruthlessly short, ranked, gerechtfertigte Top-Auswahl.

### Schritt 3 — Starter-Sequenz

**Frage an das System:** „Welche 3 Fragen zuerst, in welcher Reihenfolge, warum?"

**Output-Schema:**
```json
{
  "starterSequence": [
    {
      "order": 1,
      "questionRef": "Core #N or Provocative Pn",
      "question": "Verbatim repeated for clarity",
      "framework": "Specific SIS framework",
      "rationale": "Why this is the right first/second/third (2-3 sentences)",
      "expectedOutput": "Concrete artifact user gets",
      "enables": "What downstream becomes answerable"
    }
  ],
  "alternativeStarters": [
    {
      "scenario": "If priority is X (e.g. crisis-response vs strategic planning)",
      "alternativeFirstQuestion": "Core #N",
      "rationale": "Why this would be better starting point under that scenario"
    }
  ],
  "honestStateOfKnowledge": "2-4 sentences: what we know, what we don't, where the highest uncertainty sits, what would shift our recommendation",
  "synthesis": "Executive summary, one paragraph"
}
```

**Constraints:**
- starterSequence: EXAKT 3 Einträge in execution order
- alternativeStarters: 1-2 Einträge mit unterschiedlichen Prioritäts-Szenarien
- `honestStateOfKnowledge` MUSS mindestens eine spezifische Limitation nennen (nicht generisches „wir wissen nicht alles")

---

## Architektonische Verortung im SIS

Pre-Frage ist die **Vor-Stufe** zu allen anderen Frameworks. Der Output (Step 3) ist explizit eine Roadmap zu welchem nächsten Framework laufen sollte. Das macht Pre-Frage zum **Funnel-Eingang** in die Antwort-Frameworks.

```
                   ┌────────────────────────────┐
                   │  Pre-Frage (Topic → Atlas) │
                   │                            │
                   │  Step 1: Topic-Mapping     │
                   │  Step 2: Question-Atlas    │
                   │  Step 3: Starter-Sequence  │
                   └──────────────┬─────────────┘
                                  │
                                  ▼ (per Question)
            ┌─────────────────┬─────────────────┬──────────────────┐
            │  Marktanalyse   │  Trend-Deep-Dive │  Pre/Post-Mortem │
            │  Stakeholder    │  War-Gaming      │  Design-Thinking │
            │  → ANSWERS      │  → ANSWERS       │  → ANSWERS       │
            └─────────────────┴─────────────────┴──────────────────┘
```

---

## SIS-spezifische Verankerung

Pre-Frage nutzt drei SIS-Assets, die generische Frage-Generierung-Tools nicht haben:

1. **Live-Trend-Graph** — Topic-Mapping verbindet Facetten mit konkreten existierenden Trends, nicht generische Kategorien
2. **Regulatorischer Kontext** — Verbindung zu vorhandenen Regulierungen im SIS-Welt-Modell macht Fragen jurisdiktionell konkret
3. **Framework-Roadmap** — jede generierte Frage hat einen sofortigen Anschluss-Pfad in ein SIS-Antwort-Framework, nicht nur „research weiter"

---

## UI-Pattern

**Visueller Stil:** bewusst KEINE Charts/Matrizen — nur ruhige, lesbare Karten-Listen. Frage-Hierarchien lesen sich besser als Text als als Diagramm. Der visuelle Unterschied signalisiert dass dieses Framework kognitiv anders ist.

**Schritt-Indikatoren:**
- Schritt 1 zeigt Topic-Reformulation prominent als „Schärfung", danach Facetten als Karten mit Tag-Pills für Trends/Regs
- Schritt 2 zeigt Core-Questions in Listen-Form mit Rank-Badge, Klasse-Tag, whyMatters, und Framework-Handoff-Box
- Schritt 3 zeigt Starter-Sequenz mit großen 1/2/3-Badges, Framework-Tag, ehrlicher Knowledge-State als gelbe Callout-Box

**Anschluss-Brücke (geplant v0.3):** „Framework starten"-Button neben jedem Starter-Sequenz-Item, der direkt das nächste Framework mit der Frage als Topic vorbefüllt.

---

## Modell-Konfiguration

- **LLM:** `claude-sonnet-4-5`
- **max_tokens:** 8000 pro Schritt
- **Schritte:** 3 (sequentiell)
- **Cost-Schätzung:** ~$0.10-0.15 pro vollständige Pre-Frage-Session
- **Latenz:** ~30-60s pro Schritt

---

## Differenzierungs-These

| Tool | Primärer Output |
|---|---|
| Perigon | Antworten (Search-driven) |
| Sokosumi | Antworten (Agent-driven) |
| Inno-Verse | Antworten (Trend-driven) |
| ChatGPT/Claude (vanilla) | Antworten (Conversational) |
| **SIS Pre-Frage** | **Themen-spezifischer Frage-Atlas (Discovery-driven)** |

Im Stakeholder-Pitch positioniert: **„Strategy als Question Generation"** — McKinsey/BCG-Vokabular. Der Wert ist nicht eine bessere Antwort, sondern dass jemand am Anfang eines neuen Mandats nicht in zwei Wochen Recherche verschwendet, sondern in einer Stunde weiß was zu fragen ist.

---

## Bekannte Limitationen (v0.2)

1. **Live-Signal-Konsultation noch nicht im Prompt:** World-Model-Block (Trends + Edges + Regulations) wird injiziert, aber Live-Signale werden noch nicht als Frage-Provokation in den Prompt gereicht. Geplant v0.3.

2. **„Framework starten"-Button noch nicht in UI:** Die `frameworkRoadmap` aus Step 3 enthält Framework-Empfehlungen, aber der direkte Sprung in das nächste Framework mit der Frage als Topic ist v0.3-Feature.

3. **Frage-Hierarchie als Karten-Listen:** keine Tree-Visualisierung. Geplant v0.4 mit D3 collapsible tree.

4. **Kein Self-Critique-Pass innerhalb von Pre-Frage:** wenn das LLM zu generische Fragen produziert, gibt es aktuell keinen automatischen Refinement-Pass. Geplant v0.5.

5. **Nur Sonnet 4.5 als Modell:** Opus könnte tiefere Topic-Mappings und schärfere Provokationen liefern. Cost-vs-Quality-Trade-off in einer späteren Iteration.

---

## Test-Empfehlung

Als erste Live-Validierung empfohlen — komplexe Themenfelder (NICHT Fragen):

- *„Klimawandel und europäischer Tourismus"*
- *„Public-Service-Medien im KI-Zeitalter"*
- *„Wärmepumpen-Transformation in DACH"*
- *„Demografischer Wandel und Pflegesystem"*
- *„Generative KI in der Wissensarbeit"*

Erwartetes Verhalten:
- Schritt 1 sollte 5+ konkrete Facetten mit echten Trend-/Reg-Verbindungen liefern
- Schritt 2 sollte 7-9 Fragen liefern, die NICHT austauschbar wären (Topic-Word swap → Frage funktioniert nicht mehr)
- Schritt 3 sollte Top-3 in Reihenfolge mit konkretem Framework-Anschluss + ehrliche Wissens-State-Aussage

---

## Files

| File | Zweck |
|---|---|
| `src/types/frameworks.ts` | `FrameworkId` + `FRAMEWORK_META`-Eintrag |
| `src/app/api/v1/frameworks/analyze/route.ts` | 3 Step-Prompts in `FRAMEWORK_PROMPTS["pre-frage"]` + `VALID_STEPS["pre-frage"] = ["topic-mapping", "question-atlas", "starter-sequence"]` |
| `src/lib/system-prompts-registry.ts` | Registry-Eintrag für die Doku-Seite (v0.2) |
| `src/lib/i18n.ts` | DE + EN Strings unter `preFrage.*` (v0.2) |
| `src/app/frameworks/pre-frage/page.tsx` | UI-Page mit 3 StepCards + Visualizers für TopicMapping / QuestionAtlas / StarterSequence |
| `src/app/HomeClient.tsx` | Tile auf Home-Seite mit korrigiertem Tooltip („Themenfeld, kein Frage") |
| `docs/frameworks/pre-frage-spec.md` | Diese Spec |

---

## Roadmap

| Version | Feature |
|---|---|
| **v0.3** | „Framework starten"-Button + Live-Signal-Konsultation im Topic-Mapping |
| **v0.4** | Tree-Visualisierung der Frage-Hierarchie + Workshop-Briefing-PDF-Export |
| **v0.5** | Self-Critique-Pass innerhalb Pre-Frage (Refinement bei zu generischen Fragen) |

---

## Lesson aus v0.1 → v0.2

Die v0.1-Iteration hat ~1200 Zeilen Code produziert auf Basis eines fundamental falsch verstandenen Use-Cases. Founder-Korrektur kam schnell (innerhalb von Stunden), aber zeigt: bei konzeptionellen Frameworks ist der **konkrete Use-Case-Sketch VOR dem Build** unbezahlbar wertvoll.

Die v0.2-Iteration begann mit einem **manuellen Concept-Sketch im Chat** für ein Beispiel-Thema („Klimawandel und europäischer Tourismus"). Dieser Sketch hat in 10 Minuten Klarheit geschaffen, die der v0.1-Build in 45 Minuten nicht erreichen konnte. **Sketches vor Code, immer.**
