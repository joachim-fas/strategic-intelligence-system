# Pilot-Runs — Anleitung für den gemeinsamen Durchgang

Sechs Evaluations-Dokumente sind angelegt (3 Themen × 2 Sprachen). Dieser
Text beschreibt den Ablauf pro Briefing — wir gehen eines nach dem anderen
durch und bewerten gemeinsam.

## Pro Briefing (≈ 10 Minuten)

1. **Query starten**
   Die URL unten in neuem Browser-Tab öffnen — `autostart=1` triggert die
   Analyse direkt in der UI.

2. **Briefing lesen und ausklappen**
   - Synthesis zu Ende lesen (alle Absätze aufklappen)
   - Live-Signale ausklappen und einzeln die Topic-Relevance-Badges prüfen
   - Szenarien öffnen (alle drei)
   - Quellen auf ✓/?-Verifikation prüfen
   - STEEP+V-Dimensionen scannen

3. **In das Evaluations-Dokument eintragen**
   `docs/pilot-evaluations/<slug>.md` öffnen:
   - **Briefing-Output**-Sektion: Synthesis + Key-Insights + Scenarios
     + References als Markdown einfügen (oder nur die 3–4 stärksten
     Absätze, reicht für die Bewertung)
   - 7 Dimensionen scoren (1–5) + je 1 Satz Notes
   - Summe + Action-Items notieren

4. **Gemeinsam abstimmen**
   Wenn du für eine Dimension unsicher bist, kopiere die betreffende Stelle
   hier ins Chat — ich bewerte mit. Kontrolle gegen die Rubrik.

## Die 6 URLs

Copy-paste-bereit, alle starten automatisch.

### Thema A — Lieferketten-Fragmentierung

**DE:**
```
http://localhost:3000/?q=Welche%20EU-L%C3%A4nder%20werden%20bis%202030%20am%20st%C3%A4rksten%20von%20der%20Fragmentierung%20globaler%20Lieferketten%20betroffen%20sein%20%E2%80%94%20und%20welche%20strategischen%20Optionen%20hat%20Deutschland%20als%20industrielles%20R%C3%BCckgrat%3F&autostart=1
```
→ Doc: `docs/pilot-evaluations/a-lieferketten-de.md`

**EN:**
```
http://localhost:3000/?q=Which%20EU%20countries%20will%20be%20most%20affected%20by%20the%20fragmentation%20of%20global%20supply%20chains%20by%202030%20%E2%80%94%20and%20what%20strategic%20options%20does%20Germany%20have%20as%20Europe%27s%20industrial%20backbone%3F&autostart=1
```
→ Doc: `docs/pilot-evaluations/a-lieferketten-en.md`

### Thema B — KI-Agenten & Arbeitsmarkt

**DE:**
```
http://localhost:3000/?q=Wie%20ver%C3%A4ndert%20sich%20der%20europ%C3%A4ische%20Arbeitsmarkt%20durch%20autonome%20KI-Agenten%20bis%202028%3F%20Welche%20Branchen%20sind%20am%20exponiertesten%2C%20welche%20strukturellen%20Interventionen%20%28Regulierung%2C%20Bildung%2C%20Sozialsysteme%29%20wirken%20%E2%80%94%20und%20wo%20droht%20die%20gr%C3%B6%C3%9Fte%20Kluft%20zwischen%20politischem%20Willen%20und%20Realit%C3%A4t%3F&autostart=1
```
→ Doc: `docs/pilot-evaluations/b-ki-arbeitsmarkt-de.md`

**EN:**
```
http://localhost:3000/?q=How%20will%20the%20European%20labor%20market%20change%20through%20autonomous%20AI%20agents%20by%202028%3F%20Which%20sectors%20are%20most%20exposed%2C%20which%20structural%20interventions%20%28regulation%2C%20education%2C%20social%20systems%29%20are%20effective%20%E2%80%94%20and%20where%20is%20the%20biggest%20gap%20looming%20between%20political%20will%20and%20reality%3F&autostart=1
```
→ Doc: `docs/pilot-evaluations/b-ki-arbeitsmarkt-en.md`

### Thema C — Wärmepumpen & GEG/EPBD

**DE:**
```
http://localhost:3000/?q=Welche%20regulatorischen%20und%20wirtschaftlichen%20Kr%C3%A4fte%20pr%C3%A4gen%20die%20Zukunft%20der%20W%C3%A4rmepumpen-Industrie%20im%20DACH-Raum%20bis%202030%3F%20Wo%20liegen%20die%20Tipping-Points%20f%C3%BCr%20Marktdurchdringung%20%E2%80%94%20welche%20Rolle%20spielt%20das%20Geb%C3%A4udeenergiegesetz%20%28GEG%29%2C%20die%20EU-Geb%C3%A4uderichtlinie%20%28EPBD%29%2C%20und%20die%20Asia-vs-EU-Lieferkette%3F&autostart=1
```
→ Doc: `docs/pilot-evaluations/c-waermepumpen-de.md`

**EN:**
```
http://localhost:3000/?q=What%20regulatory%20and%20economic%20forces%20will%20shape%20the%20future%20of%20the%20heat%20pump%20industry%20in%20the%20DACH%20region%20through%202030%3F%20Where%20are%20the%20tipping%20points%20for%20market%20penetration%20%E2%80%94%20what%20role%20do%20the%20German%20Building%20Energy%20Act%20%28GEG%29%2C%20the%20EU%20Energy%20Performance%20of%20Buildings%20Directive%20%28EPBD%29%2C%20and%20the%20Asia-vs-EU%20supply%20chain%20play%3F&autostart=1
```
→ Doc: `docs/pilot-evaluations/c-waermepumpen-en.md`

## Reihenfolge-Empfehlung

Ich würde **Thema A DE zuerst** laufen lassen — die Frage ist am
strategisch-klassischsten, die Signal-Abdeckung am reichsten, und die
Bewertung liefert die schärfste Baseline für die anderen beiden Themen.

Danach direkt **A EN** (gleiches Thema zweisprachig deckt auf, wenn
der Prompt locale-sensitiv unterschiedlich antwortet — häufiger
Regressions-Vektor).

Dann B und C analog. Bei B und C ist die Vergleichbarkeit wichtiger
als die Reihenfolge DE↔EN — ob zuerst DE oder EN ist gleich.

## Was wir dabei sehen wollen

- **Regressionen des alten Signal-Kettenbezug-Bugs** — sollten durch unsere
  Fixes weg sein (Wien-Bezirk-Muster würde bei A auftauchen, wenn wir
  rückfällig sind)
- **Szenarien-Default-Smell** — 30/40/30-Probabilities würden von der
  Validierung geflaggt, aber der User sollte prüfen, ob die Szenarios
  kausal distinkt sind (nicht nur „mehr Fragmentierung / gleich / weniger")
- **EU-Frame im EN-Lauf** — bei EN-Queries rutscht der LLM gern in
  US-Perspektive ab. Der Prompt adressiert das, aber wir wollen sehen ob's hält.
- **Zitierbare Quellen** — `?`-Badges bei Refs sind OK, aber wenn die
  Synthesis Claims mit Zahlen macht (z.B. „70% der Skigebiete unter
  1500m"), MUSS eine verifizierbare Quelle dranhängen.

## Nach allen 6 Runs

Ich aggregiere die Action-Items aus allen sechs Dokumenten zu einem
**konsolidierten Fix-Plan** und pushe die Top-Items in den Notion-
Backlog als neue Entries.
