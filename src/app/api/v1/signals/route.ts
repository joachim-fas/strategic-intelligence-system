import { NextResponse } from "next/server";
import { ensureEnvLoaded } from "@/lib/env";
import { storeSignals, pruneOldSignals, getSignalAge } from "@/lib/signals";
import { checkRateLimit, tooManyRequests } from "@/lib/api-utils";

// Bootstrap .env.local for paths with spaces (e.g. "Meine Ablage")
ensureEnvLoaded();

// GET — signal store status
export async function GET(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(clientIp, 60, 60000)) {
    return tooManyRequests();
  }
  const age = getSignalAge();
  return NextResponse.json({
    signalCount: age.count,
    newestAgeHours: age.newestHours,
    oldestAgeHours: age.oldestHours,
    stale: age.newestHours > 6,
  });
}

// POST — run connectors and persist signals
export async function POST(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(clientIp, 60, 60000)) {
    return tooManyRequests();
  }
  const { connectors } = await import("@/connectors");

  // Prune signals older than 48h before adding new ones
  pruneOldSignals(48);

  let totalStored = 0;
  const results: Record<string, { stored: number; error?: string }> = {};

  // Run connectors concurrently with a timeout guard
  await Promise.allSettled(
    connectors.map(async (connector) => {
      try {
        const signals = await Promise.race([
          connector.fetchSignals(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 15000)
          ),
        ]);

        if (signals.length === 0) {
          results[connector.name] = { stored: 0 };
          return;
        }

        // Convert RawSignal → live_signals format
        const toStore = signals.map((s) => ({
          title: s.sourceTitle,
          content: s.rawData
            ? Object.entries(s.rawData)
                .filter(([k]) => ["summary", "description", "excerpt", "text", "trailText", "snippet", "abstract", "lead_paragraph", "content"].includes(k))
                .map(([, v]) => String(v).slice(0, 400))
                .join(" | ")
                .slice(0, 600) || undefined
            : undefined,
          url: s.sourceUrl || undefined,
          topic: s.topic || undefined,
          tags: s.topic ? [s.topic] : [],
          signalType: s.signalType,
          strength: s.rawStrength,
          rawData: s.rawData,
        }));

        storeSignals(connector.name, toStore);
        results[connector.name] = { stored: toStore.length };
        totalStored += toStore.length;
      } catch (err) {
        results[connector.name] = { stored: 0, error: String(err).slice(0, 100) };
      }
    })
  );

  return NextResponse.json({
    ok: true,
    totalStored,
    connectors: results,
    refreshedAt: new Date().toISOString(),
  });
}
