import { SourceConnector, RawSignal } from "./types";

/**
 * Docker Hub Connector — Container image popularity
 *
 * Tracks the most-pulled official Docker images.
 * No API key required.
 *
 * API: https://hub.docker.com/
 */

export const dockerHubConnector: SourceConnector = {
  name: "docker_hub",
  displayName: "Docker Hub (Container Stats)",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      const res = await fetch(
        "https://hub.docker.com/v2/repositories/library/?page_size=20&ordering=-pull_count",
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!res.ok) return signals;

      const data = await res.json();
      const repos = data.results || [];

      for (const repo of repos) {
        const name = repo.name || "unknown";
        const pulls = repo.pull_count || 0;
        const stars = repo.star_count || 0;

        signals.push({
          sourceType: "docker_hub",
          sourceUrl: `https://hub.docker.com/_/${name}`,
          sourceTitle: `Docker Hub: ${name} (${(pulls / 1e9).toFixed(1)}B pulls)`,
          signalType: pulls > 1e9 ? "spike" : "mention",
          topic: "Cloud Native & Multi-Cloud",
          rawStrength: Math.min(1, pulls / 1e10),
          rawData: {
            name,
            pullCount: pulls,
            starCount: stars,
            description: repo.short_description?.slice(0, 200),
            lastUpdated: repo.last_updated,
          },
          detectedAt: new Date(),
        });
      }
    } catch {
      // API unavailable
    }

    return signals;
  },
};
