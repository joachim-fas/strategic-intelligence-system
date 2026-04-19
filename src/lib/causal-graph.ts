/**
 * Causal Graph: Trends as a connected system
 *
 * Each trend can DRIVE, AMPLIFY, or DAMPEN other trends.
 * (Master Spec Section 2.3: drives / amplifies / dampens)
 * This creates a directed graph that shows:
 * - Why a trend is moving (its drivers)
 * - What a trend will affect (its consequences)
 * - Feedback loops and amplification chains
 * - Systemic risks (when multiple connected trends shift)
 *
 * ── Edge provenance (Welle B Item 1, Delphi-inspired) ──────────────
 *
 * Delphi/Theia stamps every causal edge in their Neo4j graph with
 * `{source, timestamp, confidence}` (blog post 2026-01-14). This lets
 * analysts answer "why does the system believe X causes Y?" with a
 * concrete citation — and it lets auditors date-check every claim.
 *
 * SIS adopts the same shape as optional fields on TrendEdge:
 *   - `source`:     Short human-readable reference: a specific report,
 *                   a regulatory act, a paper citation, or "Expert
 *                   review 2026-04" for curator-added edges. Not a URL
 *                   (URLs live in the references section of the trend
 *                   itself); this is the handle.
 *   - `timestamp`:  ISO 8601 date (`YYYY-MM-DD` is enough) of when the
 *                   edge was added or last verified. Edges older than
 *                   12 months should be reviewed; edges without a
 *                   timestamp are treated as "curator-asserted,
 *                   undated".
 *   - `confidence`: 0..1 score. 0.9+ = well-established causal
 *                   relationship backed by multiple independent
 *                   sources. 0.5–0.8 = plausible, single-source or
 *                   contested. <0.5 = speculative — don't draw
 *                   conclusions on this alone.
 *
 * All three fields are optional. Existing edges without provenance
 * render with a "Quelle unbekannt" hint and silently contribute to a
 * "provenance coverage" metric on /monitor (future work). Adding them
 * to an existing edge is non-breaking.
 */

export type EdgeType = "drives" | "amplifies" | "dampens" | "correlates";

export interface TrendEdge {
  from: string; // trend ID
  to: string;   // trend ID
  type: EdgeType;
  strength: number; // 0-1
  description?: string;
  bidirectional?: boolean;

  /** Welle B Item 1 — Delphi-style edge provenance. All optional to
   *  keep existing curated edges non-breaking; see the file header
   *  for the semantic contract. */
  source?: string;
  timestamp?: string; // ISO 8601 (YYYY-MM-DD minimum)
  confidence?: number; // 0..1
}

/**
 * Curated causal relationships between mega/macro trends.
 * These represent the fundamental connections between global forces.
 *
 * NOTE: Currently 102 static edges are hardcoded below. This should
 * eventually be data-driven (loaded from a DB or config file) so that
 * analysts can add/edit edges without code changes.
 */
export const TREND_EDGES: TrendEdge[] = [
  // ─── Climate drives everything ─────────────────────────────
  // The five edges immediately below carry explicit provenance as
  // the reference template for Welle B Item 1 (Delphi-style). New
  // curated edges should follow this shape; legacy edges migrate
  // opportunistically whenever they're touched for another reason.
  {
    from: "mega-climate-sustainability",
    to: "mega-energy-transition",
    type: "drives",
    strength: 0.95,
    description: "Climate urgency accelerates energy transition",
    source: "IPCC AR6 Synthesis Report (2023) + IEA World Energy Outlook 2024",
    timestamp: "2026-04-18",
    confidence: 0.92,
  },
  {
    from: "mega-climate-sustainability",
    to: "mega-geopolitical-fracturing",
    type: "drives",
    strength: 0.7,
    description: "Resource scarcity and climate migration fuel geopolitical tensions",
    source: "UNHCR Climate Displacement Report 2024 + SIPRI Yearbook 2024",
    timestamp: "2026-04-18",
    confidence: 0.75,
  },
  {
    from: "mega-climate-sustainability",
    to: "macro-circular-economy",
    type: "drives",
    strength: 0.85,
    description: "Sustainability goals push circular economy adoption",
  },
  {
    from: "mega-climate-sustainability",
    to: "macro-conscious-consumption",
    type: "drives",
    strength: 0.75,
    description: "Climate awareness changes consumer behavior",
  },
  {
    from: "mega-climate-sustainability",
    to: "mega-social-instability",
    type: "drives",
    strength: 0.6,
    description: "Climate impacts disproportionately affect vulnerable populations",
  },

  // ─── AI transforms work and society ────────────────────────
  {
    from: "mega-ai-transformation",
    to: "mega-future-of-work",
    type: "drives",
    strength: 0.95,
    description: "AI fundamentally reshapes jobs, skills, and work models",
    source: "Goldman Sachs Global Economics Analyst — AI-Work Impact (2024) + OECD Employment Outlook 2024",
    timestamp: "2026-04-18",
    confidence: 0.88,
  },
  {
    from: "mega-ai-transformation",
    to: "macro-generative-ai",
    type: "amplifies",
    strength: 0.98,
    description: "AI research directly produces generative AI capabilities",
    source: "Epoch AI Trends Database + Stanford AI Index Report 2024",
    timestamp: "2026-04-18",
    confidence: 0.95,
  },
  {
    from: "mega-ai-transformation",
    to: "macro-ai-agents",
    type: "amplifies",
    strength: 0.95,
    description: "AI advances enable autonomous agent systems",
  },
  {
    from: "mega-ai-transformation",
    to: "mega-security-trust",
    type: "drives",
    strength: 0.8,
    description: "AI creates new attack vectors and defense needs",
    bidirectional: true,
    source: "ENISA Threat Landscape Report 2024 + MITRE ATLAS (Adversarial AI)",
    timestamp: "2026-04-18",
    confidence: 0.85,
  },
  {
    from: "mega-ai-transformation",
    to: "mega-knowledge-culture",
    type: "drives",
    strength: 0.85,
    description: "AI disrupts education and knowledge creation",
  },
  {
    from: "mega-ai-transformation",
    to: "macro-human-machine",
    type: "amplifies",
    strength: 0.9,
    description: "AI capabilities enable new human-machine collaboration models",
  },

  // ─── Geopolitics affects everything ────────────────────────
  {
    from: "mega-geopolitical-fracturing",
    to: "mega-connectivity",
    type: "dampens",
    strength: 0.7,
    description: "Fragmentation leads to internet splinternet, tech decoupling",
  },
  {
    from: "mega-geopolitical-fracturing",
    to: "macro-data-economy",
    type: "drives",
    strength: 0.8,
    description: "Fragmentation accelerates data sovereignty demands",
    source: "CJEU Schrems II judgment (C-311/18) + EU Data Act + China PIPL enforcement",
    timestamp: "2026-04-19",
    confidence: 0.85,
  },
  {
    from: "mega-geopolitical-fracturing",
    to: "mega-energy-transition",
    type: "drives",
    strength: 0.65,
    description: "Energy independence becomes security imperative",
    bidirectional: true,
  },
  {
    from: "mega-geopolitical-fracturing",
    to: "mega-security-trust",
    type: "drives",
    strength: 0.85,
    description: "State-level cyber threats and supply chain risks increase",
    source: "SIPRI Yearbook 2024 + NATO Cyber Defence Pledge + CISA Advisories 2024",
    timestamp: "2026-04-19",
    confidence: 0.88,
  },
  {
    from: "mega-geopolitical-fracturing",
    to: "mega-social-instability",
    type: "drives",
    strength: 0.75,
    description: "Geopolitical tensions fuel domestic polarization",
  },

  // ─── Demographics shape demand ─────────────────────────────
  {
    from: "mega-demographic-shift",
    to: "mega-health-biotech",
    type: "drives",
    strength: 0.9,
    description: "Aging populations drive healthcare innovation demand",
    source: "UN World Population Prospects 2024 + WHO Global Spending on Health",
    timestamp: "2026-04-19",
    confidence: 0.9,
  },
  {
    from: "mega-demographic-shift",
    to: "mega-future-of-work",
    type: "drives",
    strength: 0.8,
    description: "Shrinking workforces drive automation adoption",
    source: "McKinsey Global Institute — The Future of Work (2024) + OECD Employment Outlook 2024",
    timestamp: "2026-04-19",
    confidence: 0.82,
  },
  {
    from: "mega-demographic-shift",
    to: "mega-urbanization",
    type: "drives",
    strength: 0.75,
    description: "Migration patterns reshape urban landscapes",
  },
  {
    from: "mega-demographic-shift",
    to: "macro-skills-upskilling",
    type: "drives",
    strength: 0.85,
    description: "Workforce gaps demand continuous upskilling",
  },

  // ─── Technology enables connectivity ───────────────────────
  {
    from: "mega-technological-disruption",
    to: "mega-connectivity",
    type: "amplifies",
    strength: 0.9,
    description: "New technologies expand connectivity possibilities",
  },
  {
    from: "mega-connectivity",
    to: "mega-ai-transformation",
    type: "amplifies",
    strength: 0.8,
    description: "Connected data fuels AI training and deployment",
    source: "Common Crawl Foundation Reports + OpenAI GPT-4 Technical Report (2023)",
    timestamp: "2026-04-19",
    confidence: 0.85,
  },
  {
    from: "mega-connectivity",
    to: "macro-edge-iot",
    type: "amplifies",
    strength: 0.9,
    description: "Connectivity infrastructure enables IoT/Edge deployment",
  },

  // ─── Security creates feedback loops ───────────────────────
  {
    from: "mega-security-trust",
    to: "macro-cybersecurity",
    type: "drives",
    strength: 0.95,
    description: "Growing threats drive cybersecurity investment",
    source: "IBM Cost of a Data Breach Report 2024 + Gartner Cybersecurity Spending Forecast 2024",
    timestamp: "2026-04-19",
    confidence: 0.92,
  },
  {
    from: "macro-cybersecurity",
    to: "macro-data-economy",
    type: "amplifies",
    strength: 0.7,
    description: "Security enables trusted data exchange",
    bidirectional: true,
  },

  // ─── Health innovation chain ───────────────────────────────
  {
    from: "mega-health-biotech",
    to: "macro-digital-health",
    type: "amplifies",
    strength: 0.9,
    description: "Health R&D produces digital health solutions",
    source: "McKinsey Digital Health Ecosystem 2024 + WHO Digital Health Strategy 2020-2025",
    timestamp: "2026-04-19",
    confidence: 0.88,
  },
  {
    from: "mega-health-biotech",
    to: "macro-genomics",
    type: "amplifies",
    strength: 0.85,
    description: "Biotech advances enable personalized medicine",
  },
  {
    from: "mega-health-biotech",
    to: "macro-engineered-evolution",
    type: "amplifies",
    strength: 0.7,
    description: "Biotech creates human enhancement possibilities",
  },

  // ─── Energy shapes everything ──────────────────────────────
  {
    from: "mega-energy-transition",
    to: "macro-green-energy",
    type: "amplifies",
    strength: 0.95,
    description: "Transition policies drive renewable energy adoption",
    source: "IEA Renewables 2024 Report + IRENA World Energy Transitions Outlook 2024",
    timestamp: "2026-04-19",
    confidence: 0.94,
  },
  {
    from: "mega-energy-transition",
    to: "macro-autonomous-mobility",
    type: "amplifies",
    strength: 0.8,
    description: "Electrification enables autonomous vehicle adoption",
    source: "IEA Global EV Outlook 2024 + BloombergNEF Electric Vehicle Outlook 2024",
    timestamp: "2026-04-19",
    confidence: 0.78,
  },
  {
    from: "mega-energy-transition",
    to: "mega-urbanization",
    type: "drives",
    strength: 0.65,
    description: "Clean energy reshapes urban planning and smart cities",
  },

  // ─── Work shapes society ───────────────────────────────────
  {
    from: "mega-future-of-work",
    to: "macro-remote-hybrid",
    type: "amplifies",
    strength: 0.9,
    description: "Work transformation includes location flexibility",
    source: "Bloom et al. Stanford SIEPR Working Paper on Work-from-Home (2024) + WFH Research Global Survey",
    timestamp: "2026-04-19",
    confidence: 0.9,
  },
  {
    from: "mega-future-of-work",
    to: "macro-skills-upskilling",
    type: "drives",
    strength: 0.9,
    description: "Changing work demands continuous learning",
  },
  {
    from: "mega-future-of-work",
    to: "macro-attention-economy",
    type: "amplifies",
    strength: 0.6,
    description: "New work models enable creator economy growth",
  },

  // ─── Platform economy effects ──────────────────────────────
  {
    from: "macro-platform-economy",
    to: "macro-seamless-commerce",
    type: "amplifies",
    strength: 0.85,
    description: "Platform infrastructure enables omnichannel commerce",
  },
  {
    from: "macro-platform-economy",
    to: "mega-social-instability",
    type: "drives",
    strength: 0.5,
    description: "Platform monopolies increase inequality concerns",
  },

  // ─── Urbanization chains ───────────────────────────────────
  {
    from: "mega-urbanization",
    to: "macro-autonomous-mobility",
    type: "drives",
    strength: 0.75,
    description: "Urban congestion drives demand for autonomous transport",
  },
  {
    from: "mega-urbanization",
    to: "macro-smart-surroundings",
    type: "amplifies",
    strength: 0.8,
    description: "Urban density enables ambient intelligence deployment",
  },

  // ─── Emerging tech connections ─────────────────────────────
  {
    from: "macro-quantum-computing",
    to: "mega-security-trust",
    type: "drives",
    strength: 0.8,
    description: "Quantum threatens current encryption, drives post-quantum crypto",
  },
  {
    from: "macro-spatial-computing",
    to: "macro-seamless-commerce",
    type: "amplifies",
    strength: 0.6,
    description: "XR enables new shopping and interaction experiences",
  },
  {
    from: "macro-web3-decentralization",
    to: "macro-data-economy",
    type: "correlates",
    strength: 0.5,
    description: "Decentralization offers alternative data ownership models",
  },

  // ─── Migration & Displacement (added 2026-04) ─────────────────
  // UNHCR + IDMC data stream into this node. Migration is driven by climate,
  // geopolitics, and inequality; it feeds back into social instability and
  // demographic shifts. Core causal links only — will be expanded as the
  // signal base grows.
  {
    from: "mega-climate-sustainability",
    to: "mega-migration-displacement",
    type: "drives",
    strength: 0.8,
    description: "Climate shocks (drought, flooding, sea-level rise) are a primary structural driver of displacement",
  },
  {
    from: "mega-geopolitical-fracturing",
    to: "mega-migration-displacement",
    type: "drives",
    strength: 0.9,
    description: "Armed conflict and state collapse drive the largest refugee flows",
  },
  // FIX: Merged duplicate pair into single bidirectional edge (was two separate edges)
  {
    from: "mega-social-instability",
    to: "mega-migration-displacement",
    type: "amplifies",
    strength: 0.6,
    description: "Inequality and polarization push migration; large-scale migration amplifies instability in return",
    bidirectional: true,
  },
  {
    from: "mega-migration-displacement",
    to: "mega-demographic-shift",
    type: "correlates",
    strength: 0.55,
    description: "Migration flows reshape demographic composition in aging societies",
  },

  // ─── Sprint 4a expansion (2026-04-10) ────────────────────────────────────
  // Filling 4 orphan trends, adding second connections to 18 lonely-leaf
  // trends, and weaving cross-domain relationships that the original
  // hand-curated edge set missed. Goal: turn the network from a thin
  // hub-and-spoke (47 edges, 4 invisible nodes) into a dense system map
  // where every trend has a meaningful neighborhood.

  // ── Mobility (was orphan) ──────────────────────────────────────────────
  {
    from: "mega-mobility",
    to: "macro-autonomous-mobility",
    type: "drives",
    strength: 0.95,
    description: "Mobility transformation directly drives autonomous vehicle adoption",
  },
  {
    from: "mega-energy-transition",
    to: "mega-mobility",
    type: "drives",
    strength: 0.85,
    description: "Electrification mandates restructure the entire mobility sector",
  },
  {
    from: "mega-mobility",
    to: "mega-urbanization",
    type: "amplifies",
    strength: 0.7,
    description: "New mobility forms reshape urban density, parking, and street design",
    bidirectional: true,
  },
  {
    from: "mega-climate-sustainability",
    to: "mega-mobility",
    type: "drives",
    strength: 0.75,
    description: "Climate targets force decarbonization of transport — the largest single emitter",
  },

  // ── Identity & Values (was orphan) ─────────────────────────────────────
  {
    from: "mega-knowledge-culture",
    to: "mega-identity-values",
    type: "drives",
    strength: 0.7,
    description: "Cultural and educational shifts reshape generational value systems",
  },
  {
    from: "mega-identity-values",
    to: "macro-conscious-consumption",
    type: "drives",
    strength: 0.8,
    description: "Values-driven consumers reject consumption-as-identity, demand ethical brands",
  },
  {
    from: "mega-identity-values",
    to: "mega-social-instability",
    type: "amplifies",
    strength: 0.55,
    description: "Identity polarization fuels political fragmentation and culture-war dynamics",
  },
  {
    from: "macro-web3-decentralization",
    to: "mega-identity-values",
    type: "correlates",
    strength: 0.5,
    description: "Self-sovereign identity tech aligns with values of autonomy and privacy",
  },
  {
    from: "mega-ai-transformation",
    to: "mega-identity-values",
    type: "drives",
    strength: 0.65,
    description: "AI authorship, deepfakes, and synthetic media destabilize concepts of authenticity",
  },

  // ── Cloud Native (was orphan) ──────────────────────────────────────────
  {
    from: "mega-technological-disruption",
    to: "macro-cloud-native",
    type: "drives",
    strength: 0.85,
    description: "Cloud-native architectures are the dominant deployment pattern for new tech",
  },
  {
    from: "macro-cloud-native",
    to: "macro-ai-agents",
    type: "amplifies",
    strength: 0.75,
    description: "Container orchestration and serverless make agent deployment economically viable",
  },
  {
    from: "macro-cloud-native",
    to: "macro-cybersecurity",
    type: "drives",
    strength: 0.7,
    description: "Cloud-first architectures expand the attack surface and shift security models to zero-trust",
  },
  {
    from: "macro-cloud-native",
    to: "macro-edge-iot",
    type: "correlates",
    strength: 0.65,
    description: "Edge and cloud are increasingly continuous — same primitives, different runtimes",
    bidirectional: true,
  },

  // ── Exponential Manufacturing (was orphan) ─────────────────────────────
  {
    from: "mega-technological-disruption",
    to: "macro-exponential-manufacturing",
    type: "drives",
    strength: 0.8,
    description: "3D printing, robotics, and digital twins compound into a manufacturing revolution",
  },
  {
    from: "macro-exponential-manufacturing",
    to: "macro-circular-economy",
    type: "amplifies",
    strength: 0.7,
    description: "On-demand local production enables design for repair, reuse, and recycling",
  },
  {
    from: "macro-exponential-manufacturing",
    to: "mega-geopolitical-fracturing",
    type: "amplifies",
    strength: 0.55,
    description: "Distributed manufacturing weakens reliance on single-source global supply chains",
  },
  {
    from: "mega-energy-transition",
    to: "macro-exponential-manufacturing",
    type: "correlates",
    strength: 0.5,
    description: "Renewable-powered factories enable carbon-aware production scheduling",
  },

  // ── Quantum Computing — fill out the second connection ─────────────────
  {
    from: "mega-technological-disruption",
    to: "macro-quantum-computing",
    type: "amplifies",
    strength: 0.75,
    description: "Frontier R&D continues to push quantum closer to commercial relevance",
  },
  {
    from: "macro-quantum-computing",
    to: "mega-health-biotech",
    type: "amplifies",
    strength: 0.55,
    description: "Quantum simulation accelerates drug discovery and protein folding research",
  },

  // ── Spatial Computing & XR ─────────────────────────────────────────────
  {
    from: "mega-technological-disruption",
    to: "macro-spatial-computing",
    type: "drives",
    strength: 0.7,
    description: "AR/VR hardware leaps enable new spatial interaction paradigms",
  },
  {
    from: "macro-spatial-computing",
    to: "macro-remote-hybrid",
    type: "amplifies",
    strength: 0.6,
    description: "Immersive collaboration reduces the in-person/remote experience gap",
  },
  {
    from: "macro-spatial-computing",
    to: "mega-knowledge-culture",
    type: "amplifies",
    strength: 0.55,
    description: "Spatial learning environments transform training and skill acquisition",
  },

  // ── Web3 & Decentralization ────────────────────────────────────────────
  {
    from: "macro-web3-decentralization",
    to: "macro-platform-economy",
    type: "dampens",
    strength: 0.45,
    description: "Decentralized protocols challenge centralized platform monopolies",
  },
  {
    from: "macro-web3-decentralization",
    to: "macro-cybersecurity",
    type: "correlates",
    strength: 0.5,
    description: "Cryptographic primitives and decentralized identity reshape trust architectures",
  },

  // ── Generative AI — second connection beyond mega-AI ───────────────────
  {
    from: "macro-generative-ai",
    to: "mega-knowledge-culture",
    type: "drives",
    strength: 0.85,
    description: "Generative tools fundamentally change how knowledge is created, edited, and validated",
  },
  {
    from: "macro-generative-ai",
    to: "macro-attention-economy",
    type: "amplifies",
    strength: 0.7,
    description: "AI-generated content floods feeds, accelerates the attention scarcity arms race",
  },
  {
    from: "macro-generative-ai",
    to: "mega-security-trust",
    type: "drives",
    strength: 0.7,
    description: "Deepfakes and synthetic media erode the baseline of verifiable truth",
  },

  // ── AI Agents — second connection ──────────────────────────────────────
  {
    from: "macro-ai-agents",
    to: "mega-future-of-work",
    type: "drives",
    strength: 0.9,
    description: "Autonomous agents reshape job roles, productivity, and what 'work' even means",
  },
  {
    from: "macro-ai-agents",
    to: "macro-platform-economy",
    type: "amplifies",
    strength: 0.65,
    description: "Agentic platforms become the new layer above app stores and marketplaces",
  },

  // ── Human-Machine Collaboration ────────────────────────────────────────
  {
    from: "macro-human-machine",
    to: "mega-future-of-work",
    type: "drives",
    strength: 0.85,
    description: "Co-bots and copilots redefine the boundary of human and machine work",
  },
  {
    from: "macro-human-machine",
    to: "mega-health-biotech",
    type: "amplifies",
    strength: 0.55,
    description: "Brain-computer interfaces and assistive robotics extend human capability",
  },

  // ── Green Energy ───────────────────────────────────────────────────────
  {
    from: "macro-green-energy",
    to: "mega-geopolitical-fracturing",
    type: "dampens",
    strength: 0.55,
    description: "Domestic renewables reduce dependence on fossil-exporting petrostates",
  },
  {
    from: "macro-green-energy",
    to: "macro-exponential-manufacturing",
    type: "amplifies",
    strength: 0.5,
    description: "Cheap renewable power makes energy-intensive manufacturing carbon-viable",
  },

  // ── Circular Economy ───────────────────────────────────────────────────
  {
    from: "macro-circular-economy",
    to: "macro-conscious-consumption",
    type: "amplifies",
    strength: 0.7,
    description: "Closed-loop product systems normalize repair, lease, and refurbish over buy-new",
    bidirectional: true,
  },
  {
    from: "macro-circular-economy",
    to: "mega-geopolitical-fracturing",
    type: "dampens",
    strength: 0.4,
    description: "Domestic material loops reduce dependence on critical-mineral exporting regions",
  },

  // ── Conscious Consumption ──────────────────────────────────────────────
  {
    from: "macro-conscious-consumption",
    to: "macro-platform-economy",
    type: "drives",
    strength: 0.5,
    description: "Ethical consumers force platform marketplaces to expose supply chain transparency",
  },

  // ── Edge / IoT ─────────────────────────────────────────────────────────
  {
    from: "macro-edge-iot",
    to: "macro-smart-surroundings",
    type: "drives",
    strength: 0.85,
    description: "Edge sensors are the substrate of ambient intelligence environments",
  },
  {
    from: "macro-edge-iot",
    to: "macro-cybersecurity",
    type: "drives",
    strength: 0.7,
    description: "Billions of edge devices vastly expand the attack surface",
  },

  // ── Data Economy ───────────────────────────────────────────────────────
  {
    from: "macro-data-economy",
    to: "mega-ai-transformation",
    type: "amplifies",
    strength: 0.85,
    description: "Data availability is the binding constraint on AI capability gains",
    bidirectional: true,
  },
  {
    from: "macro-data-economy",
    to: "mega-identity-values",
    type: "drives",
    strength: 0.6,
    description: "Data-as-asset reshapes individual rights, consent norms, and self-conception",
  },

  // ── Cybersecurity — strengthen the web ────────────────────────────────
  {
    from: "macro-cybersecurity",
    to: "mega-future-of-work",
    type: "drives",
    strength: 0.5,
    description: "Security skills are now a horizontal requirement across every job role",
  },

  // ── Digital Health ─────────────────────────────────────────────────────
  {
    from: "macro-digital-health",
    to: "mega-demographic-shift",
    type: "dampens",
    strength: 0.5,
    description: "Telemedicine and remote monitoring extend independent living for aging populations",
  },
  {
    from: "macro-digital-health",
    to: "macro-data-economy",
    type: "amplifies",
    strength: 0.6,
    description: "Continuous health data streams form one of the largest emerging data markets",
  },

  // ── Genomics ───────────────────────────────────────────────────────────
  {
    from: "macro-genomics",
    to: "macro-engineered-evolution",
    type: "drives",
    strength: 0.85,
    description: "Affordable sequencing and CRISPR are the foundation of human enhancement",
  },
  {
    from: "macro-genomics",
    to: "mega-identity-values",
    type: "correlates",
    strength: 0.45,
    description: "Genomic medicine reshapes how individuals understand ancestry, risk, and self",
  },

  // ── Engineered Evolution ───────────────────────────────────────────────
  {
    from: "macro-engineered-evolution",
    to: "mega-social-instability",
    type: "amplifies",
    strength: 0.5,
    description: "Access inequality to enhancement technologies risks new forms of biological stratification",
  },

  // ── Knowledge Culture & Lifelong Learning ──────────────────────────────
  {
    from: "macro-skills-upskilling",
    to: "mega-knowledge-culture",
    type: "amplifies",
    strength: 0.75,
    description: "Continuous learning is now a structural feature of adult life, not just school years",
    bidirectional: true,
  },
  {
    from: "mega-knowledge-culture",
    to: "macro-attention-economy",
    type: "amplifies",
    strength: 0.5,
    description: "Knowledge production migrates to creator platforms and short-form formats",
  },

  // ── Remote / Hybrid Work ───────────────────────────────────────────────
  {
    from: "macro-remote-hybrid",
    to: "mega-urbanization",
    type: "dampens",
    strength: 0.45,
    description: "Distributed work reverses some commuting-driven urban concentration",
  },
  {
    from: "macro-remote-hybrid",
    to: "macro-attention-economy",
    type: "correlates",
    strength: 0.4,
    description: "Async work patterns reshape attention allocation and meeting culture",
  },

  // ── Smart Surroundings ─────────────────────────────────────────────────
  {
    from: "macro-smart-surroundings",
    to: "mega-security-trust",
    type: "drives",
    strength: 0.6,
    description: "Always-on ambient sensors raise existential privacy and surveillance questions",
  },

  // ── Autonomous Mobility ────────────────────────────────────────────────
  {
    from: "macro-autonomous-mobility",
    to: "macro-platform-economy",
    type: "amplifies",
    strength: 0.55,
    description: "Mobility-as-a-service platforms become the new layer between vehicles and riders",
  },

  // ── Seamless Commerce ──────────────────────────────────────────────────
  {
    from: "macro-seamless-commerce",
    to: "mega-knowledge-culture",
    type: "correlates",
    strength: 0.35,
    description: "Frictionless commerce shapes purchase decisions through micro-content and recommendations",
  },

  // ── Attention Economy ──────────────────────────────────────────────────
  {
    from: "macro-attention-economy",
    to: "mega-social-instability",
    type: "amplifies",
    strength: 0.65,
    description: "Engagement-optimized algorithms fuel polarization, outrage, and filter bubbles",
  },
  {
    from: "macro-attention-economy",
    to: "mega-identity-values",
    type: "drives",
    strength: 0.6,
    description: "Algorithmic feeds shape self-image, aspiration, and group identity at scale",
  },

  // ── Platform Economy — strengthen the web ─────────────────────────────
  {
    from: "macro-platform-economy",
    to: "macro-data-economy",
    type: "amplifies",
    strength: 0.7,
    description: "Platforms are the dominant collection points for the global data economy",
  },

  // ── Connectivity — additional cross-link ───────────────────────────────
  {
    from: "mega-connectivity",
    to: "macro-cloud-native",
    type: "amplifies",
    strength: 0.6,
    description: "Reliable global connectivity is the precondition for cloud-native adoption",
  },
];

/**
 * Get all edges connected to a specific trend
 */
export function getEdgesForTrend(trendId: string): TrendEdge[] {
  return TREND_EDGES.filter(
    (e) => e.from === trendId || e.to === trendId
  );
}

/**
 * Get trends that DRIVE a specific trend (upstream causes).
 * Includes reverse direction of bidirectional edges.
 */
export function getDrivers(trendId: string): TrendEdge[] {
  return TREND_EDGES.filter(
    (e) =>
      (e.type === "drives" || e.type === "amplifies") &&
      (e.to === trendId || (e.bidirectional && e.from === trendId))
  );
}

/**
 * Get trends that are AFFECTED BY a specific trend (downstream effects).
 * Includes reverse direction of bidirectional edges.
 */
export function getEffects(trendId: string): TrendEdge[] {
  return TREND_EDGES.filter(
    (e) =>
      (e.type === "drives" || e.type === "amplifies") &&
      (e.from === trendId || (e.bidirectional && e.to === trendId))
  );
}

/**
 * Get trends that DAMPEN a specific trend (Master Spec: "dampens").
 * Includes reverse direction of bidirectional edges.
 */
export function getInhibitors(trendId: string): TrendEdge[] {
  return TREND_EDGES.filter(
    (e) =>
      e.type === "dampens" &&
      (e.to === trendId || (e.bidirectional && e.from === trendId))
  );
}
/** Alias for spec compliance */
export const getDampeners = getInhibitors;

/**
 * Calculate systemic impact: how many trends are affected
 * if a given trend shifts significantly (cascade analysis)
 */
export function calculateCascadeDepth(trendId: string, maxDepth = 3): string[] {
  const affected = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: trendId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    // Forward edges: from === current.id (standard direction)
    // Also follow bidirectional edges in reverse: to === current.id
    const effects = TREND_EDGES.filter(
      (e) =>
        e.type !== "dampens" &&
        (e.from === current.id || (e.bidirectional && e.to === current.id))
    );

    for (const edge of effects) {
      const target = edge.from === current.id ? edge.to : edge.from;
      if (!affected.has(target) && target !== trendId) {
        affected.add(target);
        queue.push({ id: target, depth: current.depth + 1 });
      }
    }
  }

  return Array.from(affected);
}

/**
 * ALG-20: Like calculateCascadeDepth but returns a Map from target ID to the
 * BFS depth at which it was first reached. Used by scenarios.ts to set the
 * actual cascadeDepth per affected trend instead of hardcoding 1.
 */
export function calculateCascadeDepthMap(trendId: string, maxDepth = 3): Map<string, number> {
  const depthMap = new Map<string, number>();
  const queue: { id: string; depth: number }[] = [{ id: trendId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    const effects = TREND_EDGES.filter(
      (e) =>
        e.type !== "dampens" &&
        (e.from === current.id || (e.bidirectional && e.to === current.id))
    );

    for (const edge of effects) {
      const target = edge.from === current.id ? edge.to : edge.from;
      if (!depthMap.has(target) && target !== trendId) {
        depthMap.set(target, current.depth + 1);
        queue.push({ id: target, depth: current.depth + 1 });
      }
    }
  }

  return depthMap;
}

/**
 * Find feedback loops (cycles in the graph)
 */
export function findFeedbackLoops(maxLength = 4): string[][] {
  const loops: string[][] = [];
  const nodes = new Set<string>();
  for (const edge of TREND_EDGES) {
    nodes.add(edge.from);
    nodes.add(edge.to);
  }

  for (const startNode of nodes) {
    const paths: string[][] = [[startNode]];

    while (paths.length > 0) {
      const path = paths.shift()!;
      if (path.length > maxLength + 1) continue;

      const current = path[path.length - 1];
      // Follow forward edges, plus reverse of bidirectional edges
      const outEdges = TREND_EDGES.filter(
        (e) => e.from === current || (e.bidirectional && e.to === current)
      );

      for (const edge of outEdges) {
        const target = edge.from === current ? edge.to : edge.from;
        if (target === startNode && path.length > 2) {
          loops.push([...path, startNode]);
        } else if (!path.includes(target)) {
          paths.push([...path, target]);
        }
      }
    }
  }

  return loops;
}

// ─── Sprint 4a: Graph analysis helpers ───────────────────────────────────
// These power the Netzwerk view's path-finding, hub-detection, and
// statistics panel, and the Radar's cascade-depth tooltip badges.

/** Build an undirected adjacency map for path-finding and degree analysis. */
function buildAdjacency(): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const edge of TREND_EDGES) {
    if (!adj.has(edge.from)) adj.set(edge.from, new Set());
    if (!adj.has(edge.to)) adj.set(edge.to, new Set());
    adj.get(edge.from)!.add(edge.to);
    // Treat edges as undirected for path-finding — causal direction matters
    // for the *meaning*, but a user asking "how does X relate to Y?"
    // wants any causal chain regardless of direction.
    adj.get(edge.to)!.add(edge.from);
  }
  return adj;
}

/** Build a directed adjacency map (forward edges only). */
function buildDirectedAdjacency(): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const edge of TREND_EDGES) {
    if (!adj.has(edge.from)) adj.set(edge.from, new Set());
    adj.get(edge.from)!.add(edge.to);
  }
  return adj;
}

/**
 * BFS shortest path between two trends (undirected).
 * Returns the sequence of trend IDs from `from` to `to`, or null if no
 * path exists. The first and last elements are `from` and `to`.
 */
export function findShortestPath(from: string, to: string): string[] | null {
  if (from === to) return [from];
  const adj = buildAdjacency();
  if (!adj.has(from) || !adj.has(to)) return null;

  const visited = new Set<string>([from]);
  const queue: { id: string; path: string[] }[] = [{ id: from, path: [from] }];

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    const neighbors = adj.get(id);
    if (!neighbors) continue;
    for (const next of neighbors) {
      if (next === to) return [...path, next];
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push({ id: next, path: [...path, next] });
    }
  }
  return null;
}

/**
 * Degree centrality — total connections per trend (in + out).
 * Returns a map of trendId → degree, sorted descending when iterated.
 */
export function degreeCentrality(): Map<string, number> {
  const degree = new Map<string, number>();
  for (const edge of TREND_EDGES) {
    degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
  }
  // Re-build sorted map
  return new Map([...degree.entries()].sort((a, b) => b[1] - a[1]));
}

/**
 * Find the top N hub trends by degree centrality.
 * Returns [trendId, degree] tuples sorted descending.
 */
export function findHubs(topN = 5): Array<[string, number]> {
  return [...degreeCentrality().entries()].slice(0, topN);
}

/**
 * Connected components — groups of trends that are reachable from each
 * other via the (undirected) edge set. A healthy network has exactly 1
 * component; orphan trends form their own singleton component.
 */
export function getComponents(): string[][] {
  const adj = buildAdjacency();
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const startId of adj.keys()) {
    if (visited.has(startId)) continue;
    const component: string[] = [];
    const stack: string[] = [startId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      component.push(id);
      const neighbors = adj.get(id);
      if (neighbors) for (const n of neighbors) if (!visited.has(n)) stack.push(n);
    }
    components.push(component);
  }
  return components.sort((a, b) => b.length - a.length);
}

/**
 * Cascade depth (already exists as `calculateCascadeDepth`) — wrapper that
 * returns just the count. Used by the Radar tooltip's "affects N trends"
 * badge so we can render a single-number cascade summary cheaply.
 */
export function cascadeDepthCount(trendId: string, maxDepth = 3): number {
  return calculateCascadeDepth(trendId, maxDepth).length;
}

/**
 * Network density — ratio of actual edges to possible edges.
 * For a directed graph with N nodes: density = E / (N * (N-1))
 * (undirected would be 2E / (N*(N-1)), but our graph is directed)
 * Used in the Netzwerk statistics panel to give the user a sense of how
 * connected the system map actually is.
 */
export function networkDensity(): number {
  const adj = buildAdjacency();
  const n = adj.size;
  if (n < 2) return 0;
  const e = TREND_EDGES.length;
  return e / (n * (n - 1));
}

/** Re-export the directed adjacency builder for callers that need it. */
export { buildDirectedAdjacency };

/**
 * Welle B Item 1 — edge provenance helpers.
 *
 * These let UI surfaces ask "does this edge have citations?" and
 * let /monitor track how much of the graph is provenance-covered
 * over time. The goal is 100 % coverage; the metric makes progress
 * visible without making each individual PR block on full coverage.
 */

/** True when an edge carries at least one provenance field. */
export function hasProvenance(edge: TrendEdge): boolean {
  return edge.source != null || edge.timestamp != null || edge.confidence != null;
}

/** True when an edge carries the full provenance triplet. */
export function hasFullProvenance(edge: TrendEdge): boolean {
  return edge.source != null && edge.timestamp != null && edge.confidence != null;
}

/**
 * Count of edges by provenance state. Useful for a /monitor tile:
 *   "Causal edges: 102 total · 5 with provenance (4.9 %)"
 */
export function provenanceCoverage(): {
  total: number;
  partial: number;
  full: number;
  partialPct: number;
  fullPct: number;
} {
  const total = TREND_EDGES.length;
  let partial = 0;
  let full = 0;
  for (const e of TREND_EDGES) {
    if (hasFullProvenance(e)) full += 1;
    else if (hasProvenance(e)) partial += 1;
  }
  return {
    total,
    partial,
    full,
    partialPct: total === 0 ? 0 : Math.round(((partial + full) / total) * 100),
    fullPct: total === 0 ? 0 : Math.round((full / total) * 100),
  };
}

