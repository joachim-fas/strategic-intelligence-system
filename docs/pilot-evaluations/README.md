# Pilot-Evaluations

Hier laufen die qualitativen End-to-End-Evaluations, die bestimmen, wie
weit SIS für den produktiven Einsatz trägt. Jede Pilot-Evaluation
schreibt ein Thema durch die gesamte Pipeline (Frage → Signale → Trends
→ Kausal → Szenarien → Empfehlungen → Quellen) und bewertet das Ergebnis
gegen eine feste 7-Dimensionen-Rubrik.

## Warum

Die schnellste Art, ein Analyse-System kaputt zu machen, ist, es nur an
einfachen Queries zu testen, an denen auch ein Single-Shot-LLM-Prompt
bestanden hätte. Die Pilot-Evaluation ist das Gegenmittel: drei konkrete,
strategisch anspruchsvolle Fragen, manuell benotet, pro Dimension.
Schwächen werden auf Fix-Action-Items in Pipeline / Prompt / Connectors
/ UI heruntergebrochen.

## Workflow

```
1. Thema auswählen (siehe proposed-topics.md)
2. Scaffolding-Dokument erzeugen:
     npm run pilot:eval -- "<Frage>" --slug=<slug>
3. Query in der SIS-UI absetzen (http://localhost:3001)
4. Briefing-Output aus der UI in das Dokument einfügen
   (Alternativ: query_version in der DB → --version-id=<uuid>)
5. 7 Dimensionen scoren (1–5), Notes + Fix-Action-Items
6. Ergebnis committen → docs/pilot-evaluations/<slug>.md
```

## Dateien in diesem Ordner

- [`rubric.md`](./rubric.md) — die 7-Dimensionen-Rubrik mit Scoring-Guides
- [`proposed-topics.md`](./proposed-topics.md) — drei Kandidaten-Themen für die erste Evaluation, mit Rationale und erwarteten Schwächen
- `<slug>.md` — individuelle Evaluations-Dokumente (entstehen via Script)

## Automatisierungsgrad

Das Pipeline-Scoring selbst bleibt **manuell**. Kein Auto-LLM-Grading.
Begründung: Ein LLM, das die Qualität des Outputs eines LLMs bewertet,
entwickelt dieselben blind spots, die wir zu finden versuchen. Die
Bewertung ist ein Augen-auf-Lese-Vorgang, und die Rubrik existiert,
damit er konsistent ist.

Was das Script automatisiert:
- Scaffolding mit Rubrik-Template (vermeidet Tippfehler in den 7 Dimensions-Titeln)
- Prefill des Briefings wenn es in `query_versions` bereits gespeichert ist
- Klare Nächste-Schritte-Ausgabe im Terminal

## Was mit den Scores passiert

Jede Dimension < 4 → Action-Item im Evaluations-Dokument. Action-Items
aus allen drei Piloten werden aggregiert in einen Priorisierten Fix-
Plan. Der Fix-Plan geht nach Impact × Aufwand in den Backlog.

## Regelmäßigkeit

MVP: Pilot-Evaluation einmalig pro großem Pipeline-Release. Ideal-Zustand
später: automatischer Re-Run nach jedem Prompt-Change, mit Vergleich zum
letzten Ergebnis.
