import { SourceConnector, RawSignal } from "./types";

// Track download trends for key packages that indicate technology adoption
const TRACKED_PACKAGES: { npm?: string; pypi?: string; topic: string }[] = [
  { npm: "react", topic: "React" },
  { npm: "next", topic: "Next.js" },
  { npm: "svelte", topic: "Svelte" },
  { npm: "vue", topic: "Vue" },
  { npm: "@angular/core", topic: "Angular" },
  { npm: "htmx.org", topic: "HTMX" },
  { npm: "tailwindcss", topic: "Tailwind CSS" },
  { npm: "typescript", topic: "TypeScript" },
  { npm: "langchain", topic: "LangChain" },
  { npm: "@anthropic-ai/sdk", topic: "Claude/Anthropic" },
  { npm: "openai", topic: "OpenAI" },
  { pypi: "torch", topic: "PyTorch" },
  { pypi: "tensorflow", topic: "TensorFlow" },
  { pypi: "langchain", topic: "LangChain" },
  { pypi: "fastapi", topic: "FastAPI" },
  { pypi: "transformers", topic: "Transformers" },
  { pypi: "pandas", topic: "Data Science" },
  { pypi: "anthropic", topic: "Claude/Anthropic" },
  { pypi: "openai", topic: "OpenAI" },
];

export const npmPypiConnector: SourceConnector = {
  name: "npm_pypi",
  displayName: "npm & PyPI",

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // npm downloads (last week)
    const npmPackages = TRACKED_PACKAGES.filter((p) => p.npm);
    const npmNames = npmPackages.map((p) => p.npm!).join(",");

    try {
      const res = await fetch(
        `https://api.npmjs.org/downloads/point/last-week/${npmNames}`
      );
      if (res.ok) {
        const data = await res.json();
        // Data comes back as object keyed by package name
        for (const pkg of npmPackages) {
          const pkgData = data[pkg.npm!] || data;
          const downloads = pkgData?.downloads;
          if (!downloads) continue;

          // Normalize: 1M+ downloads/week is max strength
          const strength = Math.min(1, downloads / 1_000_000);

          signals.push({
            sourceType: "npm_pypi",
            sourceUrl: `https://www.npmjs.com/package/${pkg.npm}`,
            sourceTitle: `${pkg.npm} — ${downloads.toLocaleString()} downloads/week`,
            signalType: strength > 0.5 ? "spike" : "mention",
            topic: pkg.topic,
            rawStrength: strength,
            rawData: { package: pkg.npm, registry: "npm", downloads },
            detectedAt: new Date(),
          });
        }
      }
    } catch {
      // npm API issue
    }

    // PyPI downloads (use pypistats.org)
    for (const pkg of TRACKED_PACKAGES.filter((p) => p.pypi)) {
      try {
        const res = await fetch(
          `https://pypistats.org/api/packages/${pkg.pypi}/recent`
        );
        if (!res.ok) continue;

        const data = await res.json();
        const downloads = data?.data?.last_week;
        if (!downloads) continue;

        const strength = Math.min(1, downloads / 5_000_000);

        signals.push({
          sourceType: "npm_pypi",
          sourceUrl: `https://pypi.org/project/${pkg.pypi}/`,
          sourceTitle: `${pkg.pypi} — ${downloads.toLocaleString()} downloads/week`,
          signalType: strength > 0.5 ? "spike" : "mention",
          topic: pkg.topic,
          rawStrength: strength,
          rawData: { package: pkg.pypi, registry: "pypi", downloads },
          detectedAt: new Date(),
        });

        await new Promise((r) => setTimeout(r, 200)); // Rate limit
      } catch {
        // Skip
      }
    }

    return signals;
  },
};
