# Pilot-Evaluation — c-waermepumpen-en

**Thema:** What regulatory and economic forces will shape the future of the heat pump industry in the DACH region through 2030? Where are the tipping points for market penetration — what role do the German Building Energy Act (GEG), the EU Energy Performance of Buildings Directive (EPBD), and the Asia-vs-EU supply chain play?
**Datum:** 2026-04-22
**Version-ID:** _(not executed)_
**Status:** Deferred — identische Root Cause wie C DE, Re-Run erst nach Signal-Pool-Pipeline-Erweiterung sinnvoll.

Rubrik: [rubric.md](./rubric.md) — 7 Dimensionen · 1–5 Score · Gesamtmax 35.

---

## 🟠 Warum dieser Run nicht gefahren wurde

Der parallele C-DE-Run ([c-waermepumpen-de.md](./c-waermepumpen-de.md)) hat zwei strukturelle P0-Defekte aufgedeckt:

1. **Signal-Pool-Drought** — für DACH-Wärmepumpen-Queries findet das System 0 matchbaren Live-Signale in der DB. Die Signal-Connectors decken das Thema nicht ab.
2. **LLM synthesis-only-Collapse** — bei leerem Signal-Pool degeneriert die Pipeline zu Freitext-Only-Output ohne Szenarien/Referenzen/Entscheidungshilfe.

Ein EN-Re-Run hätte exakt dieselben Probleme — die Signal-Pool-Drought betrifft die DB, nicht die Query-Sprache, und der synthesis-only-Collapse ist strukturell. Der Kostennutzen für einen weiteren Anthropic-Call mit garantiert leerem Output ist negativ.

Die C-EN-Evaluation wird nach P0-Fixes nachgeholt — dann auch als Härtetest für den Language-Detection-Fix (`e575478`), damit EN-Queries sauber EN-Antworten produzieren.

## Was dieser Slot trotzdem beiträgt

Die C-EN-Lücke ist **selbst ein Befund**: Sie macht sichtbar, dass Mehrsprachigkeit erst wertvoll ist, wenn der Signal-Pool beide Sprach-Räume abdeckt. Solange die DB fast ausschließlich englische Non-Strategy-Connectors enthält und keine DE-Strategie-Quellen, ist jede DE-Query benachteiligt. Eine EN-Version derselben Query würde beim aktuellen Pool marginal mehr Treffer liefern (englische News-Feeds statt null), aber auf einem Themenfeld mit 0 strategischen Quellen trotzdem in den synthesis-only-Fallback kippen.

**Erwartete Score-Projektion nach Fix (P0-A + P0-B):**
- D1-D7 analog zu C DE nach Fix
- Zusätzlich D5 EU-Frame-Härtetest auf EN: Rutscht der LLM bei englischer Query in US-Perspektive ab, selbst wenn das Thema DACH-spezifisch ist? (Erwartet: sauber EU/DACH, wegen expliziter DACH-Framing in der Query.)

---

## Briefing-Output

_Nicht ausgeführt — siehe Deferral-Begründung oben._

## Rubrik-Bewertung

**Deferred** — Re-Run nach P0-A (Signal-Connectors) + P0-B (Prompt-Fix).

## Konkrete Fix-Action-Items

Siehe [c-waermepumpen-de.md](./c-waermepumpen-de.md#konkrete-fix-action-items) — identische Fix-Liste.
