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
 */

export type EdgeType = "drives" | "amplifies" | "dampens" | "correlates";

export interface TrendEdge {
  from: string; // trend ID
  to: string;   // trend ID
  type: EdgeType;
  strength: number; // 0-1
  description?: string;
  bidirectional?: boolean;
}

/**
 * Curated causal relationships between mega/macro trends.
 * These represent the fundamental connections between global forces.
 */
export const TREND_EDGES: TrendEdge[] = [
  // ─── Climate drives everything ─────────────────────────────
  {
    from: "mega-climate-sustainability",
    to: "mega-energy-transition",
    type: "drives",
    strength: 0.95,
    description: "Climate urgency accelerates energy transition",
  },
  {
    from: "mega-climate-sustainability",
    to: "mega-geopolitical-fracturing",
    type: "drives",
    strength: 0.7,
    description: "Resource scarcity and climate migration fuel geopolitical tensions",
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
  },
  {
    from: "mega-ai-transformation",
    to: "macro-generative-ai",
    type: "amplifies",
    strength: 0.98,
    description: "AI research directly produces generative AI capabilities",
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
  },
  {
    from: "mega-demographic-shift",
    to: "mega-future-of-work",
    type: "drives",
    strength: 0.8,
    description: "Shrinking workforces drive automation adoption",
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
  },
  {
    from: "mega-energy-transition",
    to: "macro-autonomous-mobility",
    type: "amplifies",
    strength: 0.8,
    description: "Electrification enables autonomous vehicle adoption",
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
  {
    from: "mega-social-instability",
    to: "mega-migration-displacement",
    type: "amplifies",
    strength: 0.6,
    description: "Economic inequality and political polarization push voluntary and forced migration",
  },
  {
    from: "mega-migration-displacement",
    to: "mega-social-instability",
    type: "amplifies",
    strength: 0.5,
    description: "Large-scale migration amplifies social instability in both origin and destination regions",
  },
  {
    from: "mega-migration-displacement",
    to: "mega-demographic-shift",
    type: "correlates",
    strength: 0.55,
    description: "Migration flows reshape demographic composition in aging societies",
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
 * Get trends that DRIVE a specific trend (upstream causes)
 */
export function getDrivers(trendId: string): TrendEdge[] {
  return TREND_EDGES.filter(
    (e) => e.to === trendId && (e.type === "drives" || e.type === "amplifies")
  );
}

/**
 * Get trends that are AFFECTED BY a specific trend (downstream effects)
 */
export function getEffects(trendId: string): TrendEdge[] {
  return TREND_EDGES.filter(
    (e) => e.from === trendId && (e.type === "drives" || e.type === "amplifies")
  );
}

/**
 * Get trends that DAMPEN a specific trend (Master Spec: "dampens")
 */
export function getInhibitors(trendId: string): TrendEdge[] {
  return TREND_EDGES.filter(
    (e) => e.to === trendId && e.type === "dampens"
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

    const effects = TREND_EDGES.filter(
      (e) => e.from === current.id && e.type !== "dampens"
    );

    for (const edge of effects) {
      if (!affected.has(edge.to) && edge.to !== trendId) {
        affected.add(edge.to);
        queue.push({ id: edge.to, depth: current.depth + 1 });
      }
    }
  }

  return Array.from(affected);
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
      const outEdges = TREND_EDGES.filter((e) => e.from === current);

      for (const edge of outEdges) {
        if (edge.to === startNode && path.length > 2) {
          loops.push([...path, startNode]);
        } else if (!path.includes(edge.to)) {
          paths.push([...path, edge.to]);
        }
      }
    }
  }

  return loops;
}
