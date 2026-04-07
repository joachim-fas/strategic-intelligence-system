/**
 * Demo Intelligence Briefings
 *
 * Pre-generated briefings that showcase SIS capabilities to new users.
 * These are real API responses, stored as static data.
 * Generated 2026-04-02.
 */

import type { HistoryEntry } from "@/components/briefing/BriefingResult";

export const DEMO_BRIEFINGS: HistoryEntry[] = [
  {
    id: "demo-ki-regulierung",
    query: "Wie entwickelt sich die KI-Regulierung in der EU?",
    briefing:
    {
        "query": "Wie entwickelt sich die KI-Regulierung in der EU?",
        "matchedTrends": [],
        "synthesis": "Der EU AI Act ist seit August 2024 in Kraft und wird schrittweise bis August 2026 vollständig anwendbar — er stellt die weltweit erste umfassende KI-Regulierung dar und prägt bereits jetzt das Investitions- und Entwicklungsklima europäischer Unternehmen erheblich. Das risikobasierte Vier-Stufen-Modell (inakzeptables Risiko, Hochrisiko, begrenztes Risiko, minimales Risiko) bestimmt, welche Anforderungen Unternehmen erfüllen müssen: Hochrisiko-KI-Systeme in Bereichen wie Personalwesen, Kreditvergabe, kritische Infrastruktur oder Strafverfolgung unterliegen strengen Konformitätspflichten, Dokumentationsanforderungen und Marktüberwachung [EU AI Act, 2024]. Für die rund 60.000 betroffenen europäischen Unternehmen, die unter die Hochrisiko-Kategorie fallen, bedeutet dies Compliance-Investitionen in Größenordnungen von schätzungsweise 50.000–350.000 EUR pro KI-System für Initial-Assessments sowie laufende Kosten [EU Impact Assessment, 2021]. Besonders kritisch ist der Wettbewerbsdruck: US-Hyperscaler wie Microsoft, Google und Amazon sowie chinesische Anbieter unterliegen den EU-Anforderungen nur dann, wenn sie ihre Systeme im EU-Markt einsetzen oder anbieten — was zu einem asymmetrischen Compliance-Burden zuungunsten europäischer Entwickler führt, die typischerweise weniger Skaleneffekte haben. Gleichzeitig schafft der AI Act Vertrauensinfrastruktur: Unternehmen, die frühzeitig konforme Systeme entwickeln, gewinnen regulatorischen First-Mover-Advantage in Märkten wie dem Öffentlichen Sektor oder dem Finanzwesen, wo Kunden zunehmend auf Zertifizierungen bestehen [PwC AI Regulation Outlook, 2024]. Die KI-Regulierungsbehörden entstehen gerade auf nationaler Ebene — Deutschland bspw. identifiziert die BNetzA und mehrere Bundesbehörden als zuständig, was regulatorische Fragmentierung riskiert. Für Foundation-Model-Anbieter (GPAI-Modelle, ab 10²³ FLOPs Training) gelten seit August 2025 zusätzliche Transparenz- und Systemic-Risk-Anforderungen, die direkt Anbieter wie Aleph Alpha, Mistral AI oder Europas aufstrebende GenAI-Startups treffen. Kritisch unsicher bleibt, wie die Enforcement-Praxis der nationalen Marktüberwachungsbehörden aussehen wird — die EU KI-Behörde (AI Office) unter der Kommission hat bisher wenig operative Guidance publiziert, was Rechtsunsicherheit für Unternehmen erzeugt. Die Datenlage zu tatsächlichen Compliance-Kosten ist dünn: Vorliegende Schätzungen stammen größtenteils aus dem EU Impact Assessment von 2021, also vor dem finalen Gesetzestext.",
        "reasoningChains": [
            "AI Act schafft risikobasiertes Stufenmodell → Hochrisiko-Kategorien treffen viele B2B-Anwendungen (HR, Kredit, Infrastruktur) → Compliance-Kosten fallen überproportional bei KMUs und europäischen Scale-ups an → Wettbewerbsnachteil gegenüber US/CN-Anbietern mit größeren Compliance-Budgets",
            "GPAI-Regulierung ab August 2025 → Foundation-Model-Anbieter wie Mistral AI (Frankreich) und Aleph Alpha (Deutschland) müssen Systemic-Risk-Assessments durchführen → erhöhte Kosten für europäische KI-Champions, die ohnehin weniger Risikokapital als US-Pendants haben",
            "Regulatorische Zertifizierungen entstehen als Qualitätsmerkmal → Öffentlicher Sektor und regulierte Industrien (Finanz, Gesundheit) bevorzugen AI-Act-konforme Systeme → First-Mover-Vorteil für Unternehmen die Compliance als Produkt-Feature positionieren",
            "AI Act + DSGVO + DORA + NIS2 bilden regulatorischen Verbundrahmen → Unternehmen müssen Compliance-Stack aufbauen → Entstehung eines neuen Dienstleistungsmarkts für RegTech/AI-Compliance-Beratung in Europa",
            "Unterschiedliche Interpretationen durch nationale Behörden → regulatorische Fragmentierung im EU-Binnenmarkt → Unternehmen lobbieren für harmonisierte EU-weite Vollzugspraxis über das AI Office"
        ],
        "keyInsights": [
            "Asymmetrischer Compliance-Burden ist das zentrale Wettbewerbsproblem: Europäische KI-Startups und KMUs tragen überproportionale Compliance-Kosten (bis 350.000 EUR/System) während US-Hyperscaler diese über Tausende Deployments amortisieren können — ohne strukturelle EU-Förderprogramme droht eine weitere Marktkonzentration zugunsten außereuropäischer Anbieter.",
            "GPAI-Regelung ist der unterschätzte Gamechanger: Mistral AI, Aleph Alpha und andere europäische Foundation-Model-Anbieter müssen ab August 2025 als erste weltweit Systemic-Risk-Assessments und Red-Teaming-Berichte vorlegen — das kann Innovation verlangsamen, schafft aber auch einen Standard-Setting-Vorteil für Europa in globalen Technologie-Governance-Verhandlungen.",
            "Compliance-Konvergenz als Geschäftsmodell: Der AI Act erzeugt einen geschätzten europäischen Markt für AI-Governance-Tools, Auditing und Zertifizierungsdienstleistungen von 1–3 Mrd. EUR bis 2027 — Unternehmen wie SGS, TÜV SÜD und spezialisierte RegTech-Startups positionieren sich bereits als Profiteure der Regulierung."
        ],
        "regulatoryContext": [
            "EU:AI Act [enforcing seit 08/2024] — Verbote für inakzeptable Risiken ab 02/2025, Hochrisiko-Pflichten ab 08/2026, GPAI ab 08/2025: direkt handlungsrelevant für alle europäischen KI-Entwickler und -Nutzer",
            "EU:GDPR [enforcing] — Synergie-Pflichten mit AI Act: Datenschutz-Folgenabschätzungen müssen mit KI-Risikoassessments koordiniert werden, erhöht Compliance-Aufwand",
            "EU:DORA [enforcing] — Finanzsektor-KI unterliegt doppelter Regulierung (AI Act + DORA), besonders relevant für Banken und Versicherungen die algorithmische Entscheidungssysteme nutzen",
            "EU:NIS2 [enforcing] — KI-Systeme in kritischer Infrastruktur unterliegen sowohl NIS2-Cybersicherheitspflichten als auch AI-Act-Hochrisiko-Anforderungen — größter Compliance-Stack entsteht hier"
        ],
        "causalChain": [
            "AI Act Hochrisiko-Anforderungen → erhöhte Dokumentations- und Testpflichten → KMUs mit begrenzten Legal/Compliance-Ressourcen verzögern KI-Deployment → Innovationsverlangsamung in europäischen Scale-up-Segmenten",
            "GPAI-Regulierung → Transparenzpflichten für Trainingsdaten → Rechteinhaber (Verlage, Künstler) gewinnen Verhandlungsmacht → mögliche Lizenzkostensteigerungen für europäische GenAI-Anbieter",
            "AI-Act-Konformität als Exportvorteil → dritte Märkte (Naher Osten, Lateinamerika, Teile Asiens) adoptieren EU-Standard als De-facto-Referenz → europäische Anbieter gewinnen regulatorischen Marktzugang-Vorteil gegenüber US/CN-Wettbewerbern ohne Zertifizierung",
            "Nationale Behördenfragmentierung → uneinheitliche Enforcement-Praxis → Rechtsunsicherheit für international operierende Unternehmen → Lobbydruck für stärkeres EU-AI-Office mit direktem Vollzugsmandat"
        ],
        "signalSummary": "",
        "confidence": 0.75,
        "dataPoints": 0,
        "scenarios": [
            {
                "type": "optimistic",
                "name": "Europa als KI-Governance-Champion",
                "description": "Das EU AI Office entwickelt bis Ende 2025 klare, praxistaugliche Guidance und harmonisierte Konformitätsprozesse. Europäische Unternehmen wie SAP, Siemens und Mistral AI positionieren AI-Act-Konformität als globales Qualitätsmerkmal und gewinnen damit Marktanteile in regulierungsaffineren Sektoren (Gesundheit, Finanz, öffentlicher Sektor). Drittstaaten — insbesondere in der MENA-Region und Indien — übernehmen den EU-Standard als Referenz, was einen Brüssel-Effekt analog zu DSGVO auslöst und europäischen Anbietern einen Exportvorteil von 2–5 Mrd. EUR im KI-Markt bis 2028 einbringt.",
                "probability": 0.2,
                "timeframe": "2025–2028",
                "keyDrivers": [
                    "Schnelle EU AI Office Guidance",
                    "Brüssel-Effekt in Drittstaaten",
                    "Vertrauensnachfrage im regulierten Sektor",
                    "Starke europäische KI-Champions"
                ]
            },
            {
                "type": "baseline",
                "name": "Regulierter Zweiklassenmarkt",
                "description": "Der AI Act wird ab 2026 schrittweise vollzogen, aber nationale Behörden entwickeln unterschiedliche Auslegungspraxen — Deutschland, Frankreich und die Niederlande etablieren de facto unterschiedliche Compliance-Standards. Große Unternehmen wie Bosch, Deutsche Bank und Volkswagen investieren in robuste Compliance-Strukturen (je 5–20 Mio. EUR), während KMUs und Startups selektiv auf nicht-regulierte KI-Anwendungen ausweichen oder Compliance-Risiken eingehen. Der europäische KI-Markt wächst weiter, aber langsamer als der US-Markt — die Lücke beim KI-Investment beträgt bis 2027 weiterhin ca. 3:1 (USA vs. EU).",
                "probability": 0.5,
                "timeframe": "2025–2028",
                "keyDrivers": [
                    "Fragmentierte nationale Umsetzung",
                    "Unterschiedliche Compliance-Kapazitäten",
                    "Moderates KI-Investitionswachstum in EU",
                    "Ongoing US/CN Technologieführerschaft"
                ]
            },
            {
                "type": "pessimistic",
                "name": "Regulierungsflucht und Innovationsverlust",
                "description": "Übermäßig restriktive Auslegung der Hochrisiko-Kategorien durch nationale Behörden — kombiniert mit unklarer GPAI-Guidance — führt dazu, dass europäische KI-Startups (insbesondere im Bereich Healthtech, HR-Tech, Legal-Tech) Entwicklungsaktivitäten in die USA oder UK verlagern. Drei bis fünf europäische KI-Scale-ups mit signifikantem Potenzial (Wachstumsphase 50–200 Mio. EUR Valuation) ziehen in den Jahren 2025–2026 ihren Firmensitz in Nicht-EU-Jurisdiktionen um, was einen Signaleffekt auf den europäischen VC-Markt hat und das KI-Ökosystem geschwächt.",
                "probability": 0.2,
                "timeframe": "2025–2026",
                "keyDrivers": [
                    "Überregulierung bei Hochrisiko-Auslegung",
                    "Unklare GPAI Enforcement",
                    "VC-Rückzug aus regulierten KI-Segmenten"
                ]
            },
            {
                "type": "wildcard",
                "name": "KI-Unfall löst Regulierungswelle aus",
                "description": "Ein hochprofiler KI-Schadensfall in der EU — etwa ein fehlerhaftes Hochrisiko-Kreditsystem einer europäischen Großbank, das systematisch bestimmte Bevölkerungsgruppen diskriminiert und zu politisch aufgeladenen Schadensfällen führt — erzeugt 2026 enormen politischen Druck für deutlich verschärfte Anforderungen. Das EU-Parlament reagiert mit einer Notfall-Revision des AI Acts, die Hochrisiko-Anforderungen deutlich ausweitet und den AI-Office-Vollzug zentralisiert. Dies verdrängt innerhalb von 18 Monaten zahlreiche KI-Produkte vom Markt und löst eine temporäre Vertrauenskrise für europäische KI-Lösungen aus — mit paradoxem Effekt: US-Anbieter ohne EU-Regulierung gewinnen kurzfristig Marktanteile.",
                "probability": 0.05,
                "timeframe": "2026–2028",
                "keyDrivers": [
                    "Hochprofiler KI-Schadensfall in der EU",
                    "Politischer Regulierungsschock",
                    "Vertrauenserosion in algorithmische Systeme"
                ]
            }
        ],
        "interpretation": "Europäische Unternehmen stehen vor fünf konkreten strategischen Handlungsoptionen: (1) AI-Act-Readiness-Assessment jetzt durchführen: Systematische Klassifikation aller KI-Systeme im Einsatz nach Risikoklassen — viele Unternehmen unterschätzen, wie viele ihrer ML-Systeme unter Hochrisiko fallen könnten (insbesondere im HR, Customer-Scoring, Predictive-Maintenance in kritischer Infrastruktur). (2) Compliance als Produktmerkmal positionieren: Statt Regulierung als Kostenfaktor zu behandeln, sollten Unternehmen im B2B-Sektor AI-Act-Konformität aktiv vermarkten — besonders im Öffentlichen-Sektor-Vertrieb wird dies ab 2026 zum De-facto-Qualifikationskriterium. (3) Europäische Konformitätsstellen (Notified Bodies) frühzeitig einbinden: TÜV SÜD, DEKRA und SGS bauen gerade Kapazitäten auf — wer früh Prüfungs-Slots sichert, vermeidet Bottlenecks bei der Zertifizierung 2026. (4) Regulatorische Unsicherheit als temporären Wettbewerbsvorteil nutzen: Wer heute Compliance-Prozesse aufbaut, wird 2026/2027 gegenüber Wettbewerbern im Vorteil sein, die den Aufwand unterschätzt haben. (5) Advocacy für praxistaugliche Guidance: Branchenverbände (Bitkom, Eurochambres) sind der effektivste Kanal, um über das AI Office konkrete technische Standards mitzugestalten — Unternehmen sollten aktiv partizipieren, nicht nur rezipieren.",
        "references": [
            {
                "title": "EU AI Act — Offizieller Gesetzestext (Regulation EU 2024/1689)",
                "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689",
                "relevance": "Primärquelle für alle rechtlichen Anforderungen, Risikoklassen und Zeitpläne"
            },
            {
                "title": "EU AI Act Impact Assessment (2021)",
                "url": "https://ec.europa.eu/newsroom/dae/redirection/document/75788",
                "relevance": "Wichtigste Quelle für Compliance-Kostenschätzungen — Caveat: vor finalem Gesetzestext erstellt"
            },
            {
                "title": "PwC AI Regulation & Compliance Outlook 2024",
                "url": "https://www.pwc.com/gx/en/issues/data-and-analytics/artificial-intelligence/ai-regulation.html",
                "relevance": "Unternehmensrelevante Einschätzungen zu Compliance-Kosten und strategischen Implikationen"
            },
            {
                "title": "EU AI Office — Offizielle Webseite",
                "url": "https://digital-strategy.ec.europa.eu/en/policies/ai-office",
                "relevance": "Laufende Guidance und technische Normen — zentrale Quelle für Enforcement-Entwicklungen"
            },
            {
                "title": "Bitkom: AI Act Praxisleitfaden für Unternehmen (2024)",
                "url": "https://www.bitkom.org/ai-act",
                "relevance": "Praktische Umsetzungshilfe für deutsche Unternehmen, Klassifikationshilfen"
            }
        ],
        "followUpQuestions": [
            "Welche konkreten KI-Anwendungsfälle in meiner Branche fallen unter die Hochrisiko-Kategorie des AI Acts und welche Konformitätspflichten entstehen daraus bis August 2026?",
            "Wie entwickelt sich der Wettbewerb zwischen europäischen KI-Anbietern und US-Hyperscalern unter dem AI Act — entsteht ein regulatorischer Burggraben oder ein Nachteil für Europa?",
            "Welche organisatorischen Strukturen (AI Governance Office, Chief AI Officer, Notified Body Partnerships) sollten Unternehmen jetzt aufbauen um AI-Act-Compliance effizient zu gewährleisten?"
        ],
        "newsContext": "Aktuelle Live-Signale aus den letzten 72 Stunden enthalten keinen direkten Bezug zum AI Act — das verfügbare Signal betrifft Kriminalstatistiken (nicht relevant). Bekannte laufende Entwicklungen (Stand Trainingsdate): Das EU AI Office hat im März 2025 erste Entwürfe für GPAI-Verhaltenskodizes veröffentlicht; Unternehmen wie Google DeepMind und Anthropic haben Konsultationsprozesse gestartet. Die ersten Verbote (Social Scoring, Echtzeit-Biometrie) sind seit Februar 2025 anwendbar. Hinweis: Für aktuellste Enforcement-Entwicklungen sollten direkt das EU AI Office und nationale Behörden-Websites konsultiert werden.",
        "decisionFramework": "1. SOFORT (Q2 2025): KI-Inventur aller im Unternehmen genutzten und entwickelten KI-Systeme — Klassifikation nach Risikoklassen mit externer Rechtsberatung. 2. BIS Q3 2025: GPAI-Prüfung für Foundation-Model-Nutzer — klären ob eigene Fine-Tuning-Aktivitäten unter GPAI-Pflichten fallen. 3. BIS Q1 2026: Hochrisiko-Compliance-Roadmap für betroffene Systeme — Technical Documentation, Logging-Systeme, Human Oversight Mechanismen aufbauen; Notified Body für Konformitätsbewertung kontaktieren. 4. KONTINUIERLICH: EU AI Office Guidance-Dokumente monitoren (erscheinen rollierend) und in interne Prozesse integrieren. 5. STRATEGISCH 2025–2027: Compliance-Zertifizierungen als Verkaufsargument in regulierten Märkten (öffentlicher Sektor, Finanz, Gesundheit) aktiv einsetzen — ROI-Kalkulation für Compliance-Investitionen auf Basis von Marktchancen, nicht nur Risikovermeidung."
    },
    timestamp: new Date("2026-04-02T10:00:00"),
  },
  {
    id: "demo-energiewende",
    query: "Energiewende und Versorgungssicherheit in Europa",
    briefing:
    {
        "query": "Energiewende und Versorgungssicherheit in Europa",
        "matchedTrends": [],
        "synthesis": "Europas Energiewende befindet sich 2026 an einem kritischen Wendepunkt: Der Anteil erneuerbarer Energien am EU-Strommix hat 2024 erstmals die 50%-Marke überschritten [Ember, 2024], angetrieben vor allem durch Wind (21%) und Solar (11%). Gleichzeitig bleibt die Versorgungssicherheit strukturell fragil — die Abhängigkeit von russischem Pipeline-Gas, die bis 2021 rund 40% des EU-Gasimports ausmachte, ist zwar auf unter 15% gesunken [IEA, 2025], wurde aber durch teurere LNG-Importe (v.a. aus den USA und Katar) und höhere Industriestrompreise substituiert, nicht eliminiert. Deutschland als Anker der EU-Industrie zahlt mit durchschnittlich 0,31 €/kWh für Gewerbestrom rund das Dreifache des US-amerikanischen Niveaus — ein handfester Wettbewerbsnachteil [Eurostat, 2025]. Der EU Green Deal und das REPowerEU-Programm haben den Ausbau von Wind- und Solarkapazitäten beschleunigt: Allein 2023 wurden in der EU 56 GW Solar neu installiert, 2024 folgte ein weiterer Rekord. Kritische Engpässe bestehen jedoch im Netzausbau — die Übertragungsnetze hinken dem Erneuerbaren-Zubau systematisch hinterher, was zu erheblichem Curtailment (Zwangsabschaltung von erneuerbaren Kapazitäten) führt. Geopolitisch hat der Ukrainekrieg eine tektonische Neuausrichtung erzwungen: Die Süd- und Ostflanke der EU (Polen, Baltikum, Slowakei) bleiben besonders exponiert, während Spanien und Portugal durch ihre iberische Sonnen-Infrastruktur und LNG-Terminals eine strategische Energiediaspora innerhalb der EU ausbilden. Die kritischen Unsicherheitsvariablen sind: Tempo des Netzausbaus, Wasserstoff-Infrastruktur (bisher weit hinter Plan), Kernkraft-Renaissance (Frankreich plant 6 neue EPR-Reaktoren bis 2035, Polen baut erstmals AKW), und die Frage, ob US-LNG unter Trumps 'America First'-Agenda zuverlässig bleibt. Die Datenlage zu tatsächlichen Speicherkapazitäten und deren saisonaler Belastbarkeit ist methodisch dünn — Eurostat-Daten zu Gasspeichern sind verlässlich, aber Prognosen zu Demand-Response und Flexibilisierung des Strommarkts basieren weitgehend auf Modellen.",
        "reasoningChains": [
            "Russland-Gas-Ausfall (2022) → Massiver LNG-Import-Push → Höhere Grenzkosten → Industriestrompreise 2–3x über US/China-Niveau → Deindustrialisierungsrisiko in energieintensiven Sektoren (Stahl, Chemie, Aluminium)",
            "Erneuerbaren-Ausbau beschleunigt → Netzausbau hinkt hinterher → Curtailment steigt → Systemeffizienz sinkt → Investitionsrisiko steigt → Verzögerungsschleife",
            "Geopolitische Fragmentierung → Energiemärkte als geopolitische Waffe → EU-Binnenmarkt-Kohäsionsdruck → Gefahr nationaler Alleingänge bei Energie-Subventionen (Beihilferecht unter Druck)",
            "Demographischer Wandel + Fachkräftemangel → Verlangsamter Handwerker-Zubau für Solar/Wärme → Installationsengpässe trotz ausreichend Kapital",
            "Wasserstoff-Hoffnungsträger → Bisher kaum kommerzielle Infrastruktur → Grüner H2 kostet 4–8 €/kg vs. 1–2 € für grauen → Wirtschaftlichkeitslücke noch 5–8 Jahre → Industrielle Dekarbonisierung verzögert"
        ],
        "keyInsights": [
            "Die EU hat das Geopolitik-Problem durch LNG-Diversifizierung gelöst, aber ein Wettbewerbsproblem geschaffen: Industriestrompreise auf dem 2–3-fachen Niveau der USA und Chinas gefährden den Industriestandort Europa strukturell — der BASF-Rückzug aus Ludwigshafen und die Salzgitter-Krise sind Vorboten, keine Ausreißer.",
            "Netzausbau ist der systemische Flaschenhals, nicht die Erneuerbaren-Kapazität: In Deutschland wurden 2024 über 10 TWh Windstrom abgeregelt (Curtailment) — die installierte Leistung ist vorhanden, die Leitungen fehlen. Genehmigungsverfahren dauern im EU-Durchschnitt 9 Jahre für Hochspannungstrassen.",
            "Die Kernkraft erlebt eine stille Renaissance: Neben Frankreichs EPR-Programm hat Belgien den Laufzeitausstieg umgekehrt, Polen baut sein erstes AKW (Westinghouse AP1000, Pommern), und Schweden will neue Reaktoren genehmigen. Diese Kapazitäten kommen frühestens 2033–2038 online — zu spät für die unmittelbare Versorgungssicherheit.",
            "Speicher und Flexibilität sind das unterschätzte Nadelöhr: Europa hat ca. 65 GW Pumpspeicher (v.a. Alpen und Skandinavien), aber Batteriespeicher skalieren langsamer als Solar. Demand-Response-Programme sind politisch schwierig, weil Haushalte und KMU kaum Flexibilitätsanreize haben."
        ],
        "regulatoryContext": [
            "EU Green Deal + REPowerEU: Ziel 42,5% Erneuerbare am Gesamtenergieverbrauch bis 2030 — ambitioniert, aber Netzausbau-Tempo reicht rechnerisch nicht aus.",
            "EU Electricity Market Reform (2024): Entkopplung von Gas- und Strompreisen durch Differenzverträge (CfD) für erneuerbare Energie — strukturell richtig, aber Umsetzung läuft schleppend.",
            "EU Hydrogen Bank: Erste Auktionen 2024 mit 3 Mrd. € — wichtig, aber gegen die Wirtschaftlichkeitslücke von grünem Wasserstoff noch unzureichend.",
            "Net-Zero Industry Act (NZIA): Zielt auf EU-Produktion von Solarmodulen, Windturbinen und Batterien — reagiert direkt auf US IRA und Chinas Dominanz in Lieferketten.",
            "EU CSRD: Verstärkt Reporting-Druck auf Unternehmen, indirekt Treiber für Corporate-PPA-Abschlüsse und Eigenerzeugung."
        ],
        "causalChain": [
            "Russland-Gas-Schock → EU-weite Gasspeicher-Auffüll-Kampagne (2023: 98% Füllstand) → Kurzfristige Sicherheit, aber dauerhafte Kostenlast durch teurere LNG-Quelle → Industrielle Margenkompression → Produktionsverlagerung in Niedriglohnenergie-Regionen",
            "Solarzubau-Boom → 80% der Module aus China → Abhängigkeit von chinesischen Lieferketten bei gleichzeitiger geopolitischer Spannung → Strategische Verwundbarkeit verschiebt sich von fossilen Brennstoffen zu Technologiekomponenten",
            "Windkraft-Ausbaustopp in Deutschland 2017–2021 → Strukturelles Defizit in Onshore-Windkapazität → Deutschland jetzt stark auf teurem Offshore-Ausbau angewiesen → 185 Mrd. € Investitionsbedarf bis 2030 allein für Netz und Speicher [McKinsey, 2024]",
            "Hohe Energiepreise → Politischer Druck auf Regierungen → Nationale Stützungsmaßnahmen (Deutschland 200 Mrd. Energiepreisbremse 2022–2023) → Fragmentation des EU-Binnenmarkts durch ungleiche Subventionsniveaus"
        ],
        "signalSummary": "",
        "confidence": 0.75,
        "dataPoints": 0,
        "scenarios": [
            {
                "type": "optimistic",
                "name": "Grüner Industriesprung gelingt",
                "description": "Bis 2030 erreicht die EU ihr 42,5%-Erneuerbaren-Ziel: Netzausbau wird durch vereinfachte Genehmigungsverfahren (EU-Richtlinie 2024) und massive IPCEI-Investitionen beschleunigt. Grüner Wasserstoff erreicht Parität bei 2,5 €/kg durch Skaleneffekte in Nordafrika und Norwegen. Deutschland stabilisiert seine Industriestrombasis durch Direktleitungen (Industriestrompreis 0,08 €/kWh für energieintensive Betriebe). Wasserstoff-Importe aus Marokko (DESERTEC-Nachfolger) und Norwegen (Langeled-Erweiterung) ergänzen das System. Europa exportiert Energietechnologie und wird bis 2035 Nettoexporteur von grünem Strom in den Wintermonaten.",
                "probability": 0.2,
                "timeframe": "2026–2032",
                "keyDrivers": [
                    "Vereinfachte Genehmigungsverfahren EU-weit",
                    "Technologiekostenreduktion bei Speichern (80% Kostenreduktion bis 2030 möglich)",
                    "Geopolitische Stabilisierung ermöglicht Wasserstoff-Partnerschaft Nordafrika"
                ]
            },
            {
                "type": "baseline",
                "name": "Holpriger Übergang mit Preisdruck",
                "description": "Europa schafft die Energiewende technisch, aber langsamer als geplant und zu hohen wirtschaftlichen Kosten. Bis 2030 erreicht die EU 38–40% Erneuerbare (statt 42,5%), Industriestrompreise bleiben mit 0,20–0,25 €/kWh doppelt so hoch wie in den USA. Energieintensive Industrien (Chemie, Stahl, Aluminium) verlagern schrittweise Kapazitäten. LNG bleibt dominant (ca. 35% der EU-Gasimporte), Versorgungssicherheit ist gewährleistet aber kostspielig. Wasserstoff spielt vor 2030 kaum eine Rolle. Die EU verpasst ihr Klimaziel 2030 um 5–8 Prozentpunkte.",
                "probability": 0.45,
                "timeframe": "2026–2031",
                "keyDrivers": [
                    "Netzausbau bleibt struktureller Flaschenhals",
                    "LNG als teures Bridging-Fuel",
                    "Politischer Widerstand gegen weitere Energiewende-Investitionen in östlichen EU-Ländern"
                ]
            },
            {
                "type": "pessimistic",
                "name": "Deindustrialisierung und Versorgungskrise",
                "description": "Ein harter Winter 2027/28 kombiniert mit US-LNG-Exportbeschränkungen unter Trump-Nachfolger (oder geopolitische Krise in Katar) führt zu Gasmangellage. Gasspeicher fallen unter 50% Füllstand, Industrieabschaltungen werden verordnet. Parallel kollabiert die politische Unterstützung für die Energiewende: In Deutschland, Frankreich und Italien gewinnen energieskeptische Parteien Parlamentsmehrheiten und stoppen Subventionen für Erneuerbare. Die EU verfehlt ihr 2030-Klimaziel um über 15 Prozentpunkte. Energieintensive Industrie verliert 400.000 Arbeitsplätze in drei Jahren, IWF mahnt strukturellen Wettbewerbsverlust an.",
                "probability": 0.25,
                "timeframe": "2026–2029",
                "keyDrivers": [
                    "LNG-Angebotsschock durch US-Politik oder Nahost-Krise",
                    "Politische Backlash-Dynamik gegen Energiewendekosten",
                    "Netzinstabilität durch zu schnellen Erneuerbaren-Zubau ohne Speicher"
                ]
            },
            {
                "type": "wildcard",
                "name": "Chinesische Solar-Embargo-Krise",
                "description": "China verhängt im Kontext einer Taiwan-Eskalation (2027) ein Exportembargo auf Solarzellen, Wechselrichter und Batteriematerialien (Lithium, seltene Erden). Da 80% der EU-Solarmodule aus China stammen, bricht der Erneuerbaren-Zubau für 18–24 Monate weitgehend zusammen. Kernkraft und Gas gewinnen als 'sichere' Alternative massiv politisches Gewicht. Die EU-Industriepolitik schwenkt radikal auf Resilienz statt Effizienz um — ähnlich der US-CHIPS-Act-Logik, aber für Energietechnologie. Das Paradoxon: Die klimapolitisch motivierte Energiewende wird durch geopolitischen Schock ihrer Lieferkettenbasis beraubt.",
                "probability": 0.1,
                "timeframe": "2027–2030",
                "keyDrivers": [
                    "Taiwan-Strait-Eskalation als Auslöseereignis",
                    "EU-Abhängigkeit von chinesischen Solar-Lieferketten (80% Modulanteil)",
                    "Strukturbruch: Energiesicherheit schlägt Klimaziele in EU-Prioritätenliste"
                ]
            }
        ],
        "interpretation": "Für europäische Unternehmen und Policymaker ergeben sich fünf konkrete Handlungslinien: 1) CORPORATE PPA JETZT ABSCHLIESSEN — langfristige Stromlieferverträge mit Erneuerbaren-Produzenten sichern Preistabilität unabhängig vom Spotmarkt; Größenordnung 10–15-Jahres-PPAs werden Standard für energieintensive Industrien. 2) LIEFERKETTEN-DIVERSIFIZIERUNG bei Energietechnologie: Solarzellen aus Vietnam, Indien und Marokko als Alternative zu China aufbauen; EU Net-Zero Industry Act konsequent nutzen. 3) DEMAND-RESPONSE INFRASTRUKTUR als Wettbewerbsvorteil: Unternehmen die Flexibilitätspotenziale (Elektrolyse, Speicher, steuerbare Lasten) aufbauen, partizipieren an Regelenergiemärkten und senken Energiekosten um 15–25%. 4) STANDORTFRAGE NEU BEWERTEN: Energieintensive Produktionen (Aluminium, grüner Stahl, Elektrolyseure) folgen zukünftig dem günstigen erneuerbaren Strom — Norwegen, Spanien, Portugal, Marokko werden zu Energiekosten-Champions. 5) POLITISCHE SZENARIOPLANUNG: Unternehmen müssen Szenarien für politischen Backlash (Szenario 3) und China-Schock (Szenario 4) in ihre Investitions-Zeitlinien einbauen — Flexibilität über maximale Optimierung stellen.",
        "references": [
            {
                "title": "Ember Global Electricity Review 2024",
                "url": "https://ember-climate.org/insights/research/global-electricity-review-2024/",
                "relevance": "Belastbare Daten zu Erneuerbaren-Anteilen im EU-Strommix und globalem Vergleich"
            },
            {
                "title": "IEA World Energy Outlook 2025",
                "url": "https://www.iea.org/reports/world-energy-outlook-2025",
                "relevance": "Szenarien zu EU-Energiesicherheit, LNG-Abhängigkeit, Gas-Importstruktur"
            },
            {
                "title": "Eurostat Energy Statistics 2025",
                "url": "https://ec.europa.eu/eurostat/statistics-explained/index.php/Energy_statistics",
                "relevance": "Industriestrompreise, Speicherfüllstände, Energiemix nach Mitgliedstaaten"
            },
            {
                "title": "EU REPowerEU Plan — Fortschrittsbericht 2025",
                "url": "https://commission.europa.eu/strategy-and-policy/priorities-2019-2024/european-green-deal/repowereu-affordable-secure-and-sustainable-energy-europe_en",
                "relevance": "Offizieller Implementierungsstand der EU-Energiesicherheitsstrategie"
            },
            {
                "title": "McKinsey Global Energy Perspective 2024",
                "url": "https://www.mckinsey.com/industries/electric-power-and-natural-gas/our-insights/global-energy-perspective",
                "relevance": "Quantifizierung des EU-Netzausbaubedarfs und Investitionsvolumina"
            }
        ],
        "followUpQuestions": [
            "Welche EU-Mitgliedstaaten sind 2026 am stärksten von Versorgungsunsicherheit betroffen und welche strategischen Unterschiede bestehen zwischen Ost- und Westeuropa?",
            "Wie verändert Grüner Wasserstoff die industrielle Wettbewerbsfähigkeit Europas — und welche Länder werden die Hauptprofiteure sein?",
            "Welche konkreten Investitionsstrategien sollte ein energieintensives Industrieunternehmen in Deutschland heute für den Zeitraum 2026–2035 wählen?"
        ],
        "newsContext": "Aktuell (April 2026) zeigen die Reddit-Signale eine verstärkte Tech-Policy-Aktivität in den USA (Zuckerberg, Ellison, Huang im PCAST), was indirekt auf eine weitere Divergenz zwischen US- und EU-Industriepolitik hindeutet. Nvidias Marktanteilsverlust in China (unter 60%) signalisiert, dass die Chip-Geopolitik sich verschärft — dies hat direkte Implikationen für KI-gestützte Energiemanagementsysteme und Smart-Grid-Technologien in Europa. Oracle-Stellenabbau deutet auf Restrukturierungsdruck in US-Tech hin, was europäische Cloud- und Energiedaten-Infrastruktur-Pläne beeinflusst.",
        "decisionFramework": "1) SOFORT (0–6 Monate): Energieaudit und Flexibilitätspotenzial-Analyse für eigene Liegenschaften/Produktion; Long-Term-PPA-Verhandlungen starten. 2) KURZFRISTIG (6–18 Monate): Lieferketten-Audit für Energietechnologie auf China-Abhängigkeit; Demand-Response-Verträge mit Netzbetreibern prüfen. 3) MITTELFRISTIG (18–36 Monate): Standortoptimierung: Produktionen mit hohem Energiebedarf in Richtung Erneuerbaren-Hubs (Spanien, Portugal, Norwegen) evaluieren. 4) STRATEGISCH (3–5 Jahre): Wasserstoff-Readiness aufbauen — noch nicht wirtschaftlich, aber Technologie-Know-how und Lieferantenbeziehungen jetzt etablieren. 5) KONTINUIERLICH: Politisches Monitoring der EU-Beihilfe- und Energiemarktregulierung — Szenarien für Backlash und Beschleunigung gleichzeitig durchspielen."
    },
    timestamp: new Date("2026-04-02T10:15:00"),
  },
  {
    id: "demo-zukunft-arbeit",
    query: "Zukunft der Arbeit durch KI-Automation",
    briefing:
    {
        "query": "Zukunft der Arbeit durch KI-Automation",
        "matchedTrends": [],
        "synthesis": "KI-Automation verändert den europäischen Arbeitsmarkt strukturell und mit historisch beispielloser Geschwindigkeit. Laut OECD (2023) sind rund 27% aller Arbeitsplätze in EU-Ländern einem 'hohen Automatisierungsrisiko' ausgesetzt — besonders betroffen sind administrative Tätigkeiten (Buchhalter, Sachbearbeiter), repetitive Fertigungsberufe, einfache Rechts- und Finanzdienstleistungen sowie Transport und Logistik. Gleichzeitig zeigt McKinsey Global Institute (2024), dass bis 2030 in Europa bis zu 12 Millionen Arbeitende eine Berufsumschulung benötigen könnten, während gleichzeitig Nachfrage nach KI-Entwicklern, Datenstrategen, Pflegekräften und Handwerkern für die Energiewende wächst. Generative KI verschärft die Disruption erheblich: Selbst wissensintensive Tätigkeiten — juristisches Recherchieren, Softwareprogrammierung, Marketingtexte, Radiologiebefundung — werden durch LLMs wie GPT-4o, Gemini Ultra oder Claude 3.5 co-performiert, was Produktivitätsgewinne bei gleichzeitiger Verdichtung von Stellenprofilen erzeugt [Semantic Scholar, 2026]. Der entscheidende europäische Unterschied zu den USA liegt im regulatorischen Rahmen: Der EU AI Act (Enforcement ab 2025/2026) schreibt für 'hochriskante KI-Systeme' im HR-Bereich Transparenz, menschliche Aufsicht und Dokumentation vor — was Automatisierungsentscheidungen verlangsamt, aber auch Vertrauen schafft. Deutschland, Frankreich und die Niederlande zeigen divergierende Pfade: Deutschland setzt auf Tarifvereinbarungen zur KI-Einführung (IG Metall-Rahmenwerk 2024), Frankreich auf staatliche Umschulungsfinanzierung (CPF-Programm), während kleine EU-Mitglieder oft strukturell unvorbereitet sind. Kritische Unsicherheit bleibt, ob die Nachfrage nach neuen Berufen schnell genug entsteht, um das Wegfallen alter Tätigkeiten zu kompensieren — historisch dauerte dieser Übergang bei früheren Technologiewellen 15–30 Jahre. Unternehmen sollten jetzt in drei Zeithorizonten denken: kurzfristig (0–18 Monate) Skill-Audits und Augmentation-Strategien, mittelfristig (2–5 Jahre) Redesign von Jobprofilen und interne Umschulungspfade, langfristig strategische Personalplanung unter Einbezug von KI-Kapazitäten als Kernressource — vergleichbar mit Kapital oder Infrastruktur.",
        "reasoningChains": [
            "Generative KI (GPT-4o, Gemini, Claude) erreicht 2024–2026 Produktivparität bei kognitiven Routinetätigkeiten → Kostenvorteil für Automatisierung steigt → Unternehmen reduzieren Einstellungsvolumen in Midlevel-Bürotätigkeiten → strukturelle Jobpolarisierung zwischen Hochqualifizierten und manuell-sozialen Berufen",
            "EU AI Act + GDPR + NIS2 erzwingen Transparenz bei KI im HR → Unternehmen müssen Entscheidungsprozesse dokumentieren → erhöhter Compliance-Aufwand verlangsamt radikale Automatisierung → Europa entwickelt Modell 'Augmentation statt Substitution' als regulatorischen Wettbewerbsvorteil",
            "Demografischer Wandel (Alterung, Fachkräftemangel) trifft Automatisierungsdruck → Paradox: Gleichzeitig zu viele Jobs in bestimmten Sektoren und zu wenige in anderen → KI kann Fachkräftemangel in Pflege, MINT und Handwerk nicht vollständig lösen, aber in Administration kompensieren → Ungleichgewicht zwischen Regionen und Qualifikationsniveaus verschärft sich",
            "Plattformökonomie + Remote Work + KI-Tools ermöglichen neue Arbeitsformen (Freelancing, Gig Economy, KI-augmentierte Kleinstunternehmen) → traditionelle Betriebsstrukturen verlieren Gravitationskraft → Sozialversicherungssysteme unter Druck, da Beitragsbasis erodiert"
        ],
        "keyInsights": [
            "Nicht Berufe, sondern Tätigkeiten verschwinden: 80% der gefährdeten Arbeitsplätze werden nicht eliminiert, sondern transformiert — wer nur Automatisierungsrisiken nach Berufsfeldern misst, plant falsch. Buchhalter werden nicht überflüssig, aber 60% ihrer Tätigkeiten verlagern sich auf KI-Kontrolle und Ausnahme-Management. Unternehmen müssen Task-Level-Analysen statt Job-Level-Analysen durchführen.",
            "Europa hat einen regulatorischen First-Mover-Vorteil, der kurzfristig als Nachteil wahrgenommen wird: Der EU AI Act zwingt Unternehmen zu erklärbarer, auditierbarer KI im HR — das kostet initially mehr, schafft aber Vertrauen bei Belegschaften und verhindert Reputationsschäden. Unternehmen, die diesen Standard früh implementieren, werden in internationalen Arbeitsmärkten als verlässlichere Arbeitgeber wahrgenommen.",
            "Das Upskilling-Gap ist das drängendste Problem der nächsten 36 Monate: Eurostat (2023) zeigt, dass nur 42% der EU-Erwerbstätigen an betrieblicher Weiterbildung teilnehmen — bei OECD-Vergleich ist das Mittelfeld. Unternehmen, die interne KI-Kompetenzprogramme (wie Amazons 'Upskilling 2025' mit 700 Mio. USD) verzögern, riskieren Kompetenz-Insolvenzen — nicht als Unternehmen, sondern als Belegschaft."
        ],
        "regulatoryContext": [
            "EU AI Act (enforcing 2025/2026): Hochriskante KI-Anwendungen im HR (Personalauswahl, Leistungsbeurteilung, Entlassungsentscheidungen) unterliegen strengen Anforderungen an Transparenz, menschliche Aufsicht und Dokumentation — Compliance-Kosten erhöhen sich, aber Missbrauchsrisiken sinken",
            "GDPR: Automatisierte Entscheidungen mit erheblicher Wirkung für Beschäftigte erfordern Widerspruchsrecht und menschliche Überprüfung (Art. 22) — direkte Einschränkung vollautomatisierter Personalprozesse",
            "EU-Richtlinie zur Plattformarbeit (2024): Erstmalige arbeitsrechtliche Klassifizierung von Gig-Economy-Arbeitenden als Arbeitnehmer — relevanter Gegengewicht zur Fragmentierung von Arbeit durch KI-Plattformen"
        ],
        "causalChain": [
            "Sinkende LLM-Kosten (GPT-4o API: ~$5/1M Tokens, 2024) → Automatisierungsschwelle sinkt für KMUs → Massenadoption in Mittelstand → strukturelle Nachfragereduktion für Midlevel-Bürostellen in Deutschland, Österreich, BeNeLux bis 2027",
            "Fachkräftemangel (Deutschland: 600.000 offene Stellen 2024) + Demografie → KI als Notlösung, nicht als Rationalisierungsinstrument → paradoxe Koexistenz von Automatisierung und Arbeitskräftemangel in verschiedenen Sektoren",
            "Automatisierung schafft Produktivitätsgewinne → bei fehlender Umverteilung → Lohnpolarisierung zwischen KI-Kompetenträgern und substituierten Tätigkeiten → soziale Instabilität, populistische Reaktionen → Regulierungsdruck steigt, was Innovationsgeschwindigkeit dämpft"
        ],
        "signalSummary": "",
        "confidence": 0.75,
        "dataPoints": 0,
        "scenarios": [
            {
                "type": "optimistic",
                "name": "Europäisches Augmentations-Modell",
                "description": "EU gelingt es bis 2028, KI-Augmentation als Standardmodell zu etablieren: Tarifverträge (nach deutschem IG-Metall-Vorbild) regeln KI-Einführung kooperativ, EU-Sozialfonds finanziert Umschulungsprogramme für 5 Millionen Beschäftigte, Produktivitätsgewinne werden über Arbeitszeitverkürzung (32-Stunden-Woche in Vorreiterunternehmen) und Lohnerhöhungen geteilt. Arbeitslosigkeit steigt nur marginal auf 7–8% EU-Schnitt, neue KI-Berufsfelder (Prompt Engineering, AI Governance, Synthetic Data Curation) absorbieren große Teile der Umgeschulten.",
                "probability": 0.25,
                "timeframe": "2025–2030",
                "keyDrivers": [
                    "Starke Sozialpartnerschaft EU-weit",
                    "EU AI Act als Qualitätsstandard",
                    "Finanzierung via EU-Kohäsionsfonds und nationaler Upskilling-Programme"
                ]
            },
            {
                "type": "baseline",
                "name": "Fragmentierte Zweiteilung",
                "description": "Europa bleibt zweigespalten: Hochqualifizierte (oberes Tertil) profitieren von KI-Produktivitätsgewinnen und steigenden Löhnen, während mittlere Qualifikationssegmente unter Druck geraten. Automationswelle trifft vor allem Osteuropäische EU-Mitglieder (Polen, Rumänien, Bulgarien) härter, da dortige Industrien stärker auf repetitive Fertigungstätigkeiten ausgerichtet sind. Umschulungsinitiativen laufen, sind aber zu fragmentiert und langsam — strukturelle Arbeitslosigkeit in bestimmten Regionen steigt auf 10–15%, soziale Spannungen nehmen zu.",
                "probability": 0.45,
                "timeframe": "2025–2030",
                "keyDrivers": [
                    "Ungleiche digitale Infrastruktur EU-intern",
                    "Langsame Reaktion nationaler Bildungssysteme",
                    "Moderate Investitionen in Upskilling"
                ]
            },
            {
                "type": "pessimistic",
                "name": "Struktureller Beschäftigungsschock",
                "description": "KI-Agenten (ab 2025/2026 produktionsreif) automatisieren breite Midlevel-Tätigkeiten schneller als erwartet — Backoffice, Kundendienst, einfache Rechts- und Finanzdienstleistungen verlieren 30–40% ihrer Stellen bis 2028. Bildungssysteme reagieren zu langsam, sozialer Sicherungsnetze geraten unter Finanzierungsdruck durch schrumpfende Lohnsteuerbasis. Populistische Bewegungen in 4–6 EU-Ländern fordern Automatisierungssteuern und KI-Moratorien, was europäische Wettbewerbsfähigkeit gegenüber USA und China schwächt. Kipppunkt: Massenentlassungen in einer symbolträchtigen Branche (z.B. deutsche Versicherungsbranche oder französische Banken) lösen politische Eskalation aus.",
                "probability": 0.2,
                "timeframe": "2025–2028",
                "keyDrivers": [
                    "Zu schnelle KI-Agenten-Reife",
                    "Politischer Stillstand bei Sozialpolitik"
                ]
            },
            {
                "type": "wildcard",
                "name": "KI-Produktivitätsstagnation",
                "description": "Entgegen aller Erwartungen stagniert die reale Produktivitätswirkung von KI in Unternehmen: 'AI Productivity Paradox' analog zum IT-Paradox der 1980er — hohe Investitionen, aber diffuse Produktivitätsgewinne, da Implementierungsprobleme, Datenmängel und Organisationswiderstände dominieren. Beschäftigung bleibt stabil, aber europäische Unternehmen verlieren Milliarden in schlecht implementierten KI-Projekten. Ausgelöst durch eine Reihe hochprofilierter KI-Implementierungsdesaster (ähnlich frühen ERP-Katastrophen) und Erkenntnisse, dass LLM-Halluzinierungen in kritischen Prozessen inakzeptable Fehlerquoten erzeugen. Europa würde dann Vorsicht nachträglich als Weitsicht bewerten.",
                "probability": 0.1,
                "timeframe": "2026–2030",
                "keyDrivers": [
                    "AI Productivity Paradox",
                    "Organisationale Trägheit und Implementierungsversagen"
                ]
            }
        ],
        "interpretation": "Europäische Unternehmen sollten entlang von fünf konkreten Handlungslinien agieren: (1) TASK AUDIT NOW: Sofortiger Audit auf Tätigkeitsebene — nicht Berufsebene — um Automatisierungspotenziale und Transformationsbedarf zu kartieren (ROI innerhalb 6 Monate messbar). (2) AUGMENTATION FIRST: KI als Werkzeug für bestehende Mitarbeitende priorisieren vor Stellenabbau — vermeidet Talent-Verlust, erhöht Akzeptanz, entspricht EU-Regulierungsgeist. (3) UPSKILLING ALS KAPITALINVESTITION: Interne KI-Akademien (nach Amazon/SAP-Vorbild) sind kein HR-Projekt, sondern strategische Infrastruktur — Budgets entsprechend dimensionieren (Benchmark: 1–2% der Personalkosten). (4) REGULATORISCHE COMPLIANCE PROAKTIV: EU AI Act-Anforderungen für HR-KI nicht als Bürde, sondern als Employer-Branding-Vorteil nutzen — Dokumentation, Erklärbarkeit und menschliche Kontrolle werden zu Wettbewerbsmerkmalen. (5) SOZIALPARTNERSCHAFT AKTIVIEREN: Frühzeitige Einbindung von Betriebsräten und Gewerkschaften bei KI-Einführung reduziert Widerstand und ist in vielen EU-Ländern rechtlich ohnehin erforderlich — macht Transformation nachhaltiger.",
        "references": [
            {
                "title": "OECD Employment Outlook 2023: AI and the Labour Market",
                "url": "https://www.oecd.org/employment/oecd-employment-outlook-2023.htm",
                "relevance": "Grundlage für Automatisierungsrisikoschätzungen (27% hohe Gefährdung) nach Tätigkeitsprofilen in OECD/EU-Ländern"
            },
            {
                "title": "McKinsey Global Institute: The Future of Work in Europe (2024)",
                "url": "https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/a-future-that-works",
                "relevance": "Schätzung von 12 Millionen Umschulungsbedarfen in Europa bis 2030 und Sektoranalysen"
            },
            {
                "title": "EU AI Act – Amtsblatt der Europäischen Union 2024",
                "url": "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024R1689",
                "relevance": "Regulatorischer Rahmen für KI im HR-Bereich, hochriskante Systeme, Compliance-Anforderungen"
            },
            {
                "title": "Semantic Scholar: Explainable AI (XAI) – Concepts, Taxonomies, Opportunities [2026-04-02]",
                "url": "https://www.semanticscholar.org/paper/530a059cb48477ad1e3d4f8f4b153274c8997332",
                "relevance": "Wissenschaftliche Grundlage für XAI-Anforderungen, die der EU AI Act im HR-Kontext vorschreibt"
            },
            {
                "title": "Eurostat Digital Economy and Society Statistics 2023",
                "url": "https://ec.europa.eu/eurostat/statistics-explained/index.php/Digital_economy_and_society_statistics",
                "relevance": "Daten zu digitalen Qualifikationen, Weiterbildungsquoten (42%) und digitalem Reifegrad der EU-Arbeitsmärkte"
            }
        ],
        "followUpQuestions": [
            "Welche konkreten KI-Augmentierungsstrategien zeigen in europäischen Unternehmen bereits messbare ROI-Ergebnisse — und welche Branchen führen dabei?",
            "Wie sollte ein mittelständisches Unternehmen (200–500 Mitarbeitende) ein internes Upskilling-Programm für KI-Kompetenz strukturieren und finanzieren?",
            "Welche Sozialpartnerschaftsmodelle (Deutschland, Niederlande, Skandinavien) eignen sich als Blaupause für KI-Tarifvereinbarungen — und wo liegen ihre Grenzen?"
        ],
        "newsContext": "Aktuelle Signale aus Semantic Scholar (2026-04-02) bestätigen intensive Forschungsaktivität zu Explainable AI (XAI) und Constitutional AI — beides direkt relevant für EU-AI-Act-Compliance im HR-Bereich. Die NVIDIA Cosmos World Foundation Model Platform signalisiert zudem Reifung von Physical-AI-Systemen, was Automatisierungspotenziale im Fertigungsbereich (besonders relevant für Deutschland, Polen, Tschechien) beschleunigt. Kein direktes Signal aus aktuellen Live-Quellen zu europäischem Arbeitsmarkt — Datenlage für kurzfristige Trendbestätigung damit begrenzt.",
        "decisionFramework": "1. ASSESSMENT (Monat 1–3): Task-Level-Audit durchführen — welche Tätigkeiten haben >60% Automatisierungspotenzial? Priorisierung nach Volumen und Risiko. 2. STRATEGIE (Monat 3–6): Augmentation vs. Substitution entscheiden — EU-Regulierungsrahmen, Betriebsratsrechte und Arbeitgebermarke als Entscheidungsparameter einbeziehen. 3. UPSKILLING DESIGN (Monat 4–9): Interne KI-Kompetenzpfade entwickeln — Partnerschaft mit Plattformen (Coursera, LinkedIn Learning, EU-Skills-Agenda-Förderprogramme) nutzen. 4. PILOTIERUNG (Monat 6–12): 2–3 Use Cases mit Augmentation-Ansatz pilotieren — Messbarkeit von Produktivitätsgewinn und Mitarbeiterzufriedenheit von Beginn an einbauen. 5. GOVERNANCE & COMPLIANCE (parallel): AI Act-konforme Dokumentation für HR-KI-Systeme aufsetzen — Legal, HR und IT gemeinsam, nicht sequenziell."
    },
    timestamp: new Date("2026-04-02T10:30:00"),
  },
];
