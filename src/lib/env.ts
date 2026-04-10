/**
 * ensureEnvLoaded — Server-side .env.local bootstrap
 *
 * Next.js sometimes fails to load .env.local when the project path
 * contains spaces (e.g. "Meine Ablage"). This function reads the file
 * directly and injects any missing values into process.env.
 *
 * IMPORTANT: This file uses Node.js `fs` and must ONLY be imported
 * from server-side code (API routes, server components). Never import
 * from client components or files that feed the client bundle.
 */

// TODO: ARC-05 — DB ACCESS PATTERN CONSOLIDATION
// Currently 7 routes use Drizzle ORM (radars/*), 19 routes use raw new Database() + SQL.
// FIX: Migrate all raw SQL to Drizzle, or create a unified getDb() wrapper.

// TODO: ARC-11 — resolveEnv() is duplicated in:
// - src/lib/env.ts (canonical)
// - src/app/api/v1/query/route.ts
// - src/app/api/v1/frameworks/analyze/route.ts
// - src/app/api/v1/canvas/[id]/summary/route.ts
// FIX: Import from here everywhere. Remove local copies.

import { readFileSync } from "fs";
import path from "path";

let loaded = false;

export function ensureEnvLoaded(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      // Only set if not already present (don't override real env vars)
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env.local not found — that's fine, env vars may come from elsewhere
  }
}

/**
 * resolveEnv — For server-side code that needs a specific env var.
 * Ensures .env.local is loaded first, then reads from process.env.
 */
export function resolveEnv(key: string): string | undefined {
  ensureEnvLoaded();
  return process.env[key] || undefined;
}
