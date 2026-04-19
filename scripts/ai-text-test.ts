#!/usr/bin/env tsx
/**
 * ai-text-test — unit test for the provider-fallback logic in
 * src/lib/ai-text.ts (Welle C Item 1, trimmed scope).
 *
 * Covers the routing contract by mocking global fetch + the env
 * resolver. What we want to protect:
 *   1. Anthropic-only path: ANTHROPIC_API_KEY set, Anthropic 200 →
 *      we never touch OpenRouter.
 *   2. Anthropic 5xx → OpenRouter attempted (if key set).
 *   3. Anthropic timeout (fetch throws AbortError) → OpenRouter
 *      attempted.
 *   4. Anthropic 400 → OpenRouter NOT attempted (non-recoverable).
 *   5. Anthropic 429 (rate limit) → OpenRouter attempted (recoverable).
 *   6. Neither key set → null, no network calls.
 *   7. Only OpenRouter key set → Anthropic skipped, OpenRouter
 *      used directly.
 *   8. Text normalisation: trim + whitespace collapse.
 *   9. Empty system or user returns null without hitting network.
 */

import { completeText } from "../src/lib/ai-text";

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}`);
  }
}

function section(title: string) {
  console.log(`\n▸ ${title}`);
}

// ── fetch mock ──────────────────────────────────────────────────
type FetchLog = Array<{ url: string; provider: "anthropic" | "openrouter" | "other" }>;

type ResponderEntry =
  | { kind: "json"; status: number; body: object }
  | { kind: "throw"; error: Error };

function installFetchMock(queues: {
  anthropic?: ResponderEntry[];
  openrouter?: ResponderEntry[];
}): { calls: FetchLog; restore: () => void } {
  const real = globalThis.fetch;
  const calls: FetchLog = [];

  globalThis.fetch = (async (url: unknown) => {
    const urlStr = String(url);
    const provider: "anthropic" | "openrouter" | "other" =
      urlStr.includes("api.anthropic.com") ? "anthropic"
      : urlStr.includes("openrouter.ai") ? "openrouter"
      : "other";
    calls.push({ url: urlStr, provider });

    const queue = provider === "anthropic" ? queues.anthropic : provider === "openrouter" ? queues.openrouter : undefined;
    const entry = queue?.shift();
    if (!entry) {
      throw new Error(`No mock response queued for ${provider} @ ${urlStr}`);
    }
    if (entry.kind === "throw") throw entry.error;
    return new Response(JSON.stringify(entry.body), {
      status: entry.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof globalThis.fetch;

  return { calls, restore: () => { globalThis.fetch = real; } };
}

// ── env mock ────────────────────────────────────────────────────
// resolveEnv() in src/lib/env.ts reads directly from process.env,
// so setting process.env here is a real mock — no need to patch
// the module import (which is read-only via ESM semantics anyway).
type EnvFixture = Partial<Record<"ANTHROPIC_API_KEY" | "OPENROUTER_API_KEY", string>>;

function installEnvMock(fixture: EnvFixture): () => void {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(fixture) as (keyof EnvFixture)[]) {
    saved[key] = process.env[key];
    const value = fixture[key];
    if (value) process.env[key] = value;
    else delete process.env[key];
  }
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

// Helper: Anthropic's 200 body shape.
const anthropic200 = (text: string): ResponderEntry => ({
  kind: "json",
  status: 200,
  body: { content: [{ text }] },
});

// Helper: OpenRouter's 200 body shape.
const openrouter200 = (text: string): ResponderEntry => ({
  kind: "json",
  status: 200,
  body: { choices: [{ message: { content: text } }] },
});

const httpErr = (status: number): ResponderEntry => ({ kind: "json", status, body: {} });

// Top-level `await` isn't supported in the tsx/CJS transform the
// rest of the scripts/ suite uses, so we wrap the entire test body
// in an async IIFE.
async function main() {

// ─── 1. Anthropic-only happy path ────────────────────────────────
section("1. Anthropic 200 → no OpenRouter touch");
{
  const restoreEnv = installEnvMock({ ANTHROPIC_API_KEY: "test", OPENROUTER_API_KEY: "test2" });
  const mock = installFetchMock({ anthropic: [anthropic200("hello from Anthropic")] });
  try {
    const out = await completeText({ system: "sys", user: "usr" });
    assert(out === "hello from Anthropic", `returned expected text (got "${out}")`);
    assert(mock.calls.length === 1, "exactly 1 fetch call");
    assert(mock.calls[0].provider === "anthropic", "call was to Anthropic");
  } finally { mock.restore(); restoreEnv(); }
}

// ─── 2. Anthropic 503 → OpenRouter attempted ─────────────────────
section("2. Anthropic 503 → OpenRouter attempted");
{
  const restoreEnv = installEnvMock({ ANTHROPIC_API_KEY: "test", OPENROUTER_API_KEY: "test2" });
  const mock = installFetchMock({
    anthropic: [httpErr(503)],
    openrouter: [openrouter200("via OpenRouter")],
  });
  try {
    const out = await completeText({ system: "sys", user: "usr" });
    assert(out === "via OpenRouter", `OpenRouter answered (got "${out}")`);
    assert(mock.calls.length === 2, "2 fetch calls (anthropic then openrouter)");
    assert(mock.calls[0].provider === "anthropic", "first was Anthropic");
    assert(mock.calls[1].provider === "openrouter", "second was OpenRouter");
  } finally { mock.restore(); restoreEnv(); }
}

// ─── 3. Anthropic timeout → OpenRouter attempted ─────────────────
section("3. Anthropic AbortError → OpenRouter attempted");
{
  const restoreEnv = installEnvMock({ ANTHROPIC_API_KEY: "test", OPENROUTER_API_KEY: "test2" });
  const abortErr = new Error("timeout"); abortErr.name = "AbortError";
  const mock = installFetchMock({
    anthropic: [{ kind: "throw", error: abortErr }],
    openrouter: [openrouter200("recovery")],
  });
  try {
    const out = await completeText({ system: "sys", user: "usr" });
    assert(out === "recovery", `OpenRouter saved the day (got "${out}")`);
    assert(mock.calls.length === 2, "2 calls after a timeout");
  } finally { mock.restore(); restoreEnv(); }
}

// ─── 4. Anthropic 400 → OpenRouter NOT attempted ────────────────
section("4. Anthropic 400 → no fallback (non-recoverable)");
{
  const restoreEnv = installEnvMock({ ANTHROPIC_API_KEY: "test", OPENROUTER_API_KEY: "test2" });
  const mock = installFetchMock({
    anthropic: [httpErr(400)],
    openrouter: [openrouter200("should-not-appear")],
  });
  try {
    const out = await completeText({ system: "sys", user: "usr" });
    assert(out === null, "returns null on client error");
    assert(mock.calls.length === 1, "only Anthropic was called");
    assert(mock.calls[0].provider === "anthropic", "single call was to Anthropic");
  } finally { mock.restore(); restoreEnv(); }
}

// ─── 5. Anthropic 429 → OpenRouter attempted (recoverable) ──────
section("5. Anthropic 429 → OpenRouter attempted (rate limit is recoverable)");
{
  const restoreEnv = installEnvMock({ ANTHROPIC_API_KEY: "test", OPENROUTER_API_KEY: "test2" });
  const mock = installFetchMock({
    anthropic: [httpErr(429)],
    openrouter: [openrouter200("second chance")],
  });
  try {
    const out = await completeText({ system: "sys", user: "usr" });
    assert(out === "second chance", "OpenRouter fallback on 429");
    assert(mock.calls.length === 2, "2 calls");
  } finally { mock.restore(); restoreEnv(); }
}

// ─── 6. Neither key set ─────────────────────────────────────────
section("6. No keys → null without any network calls");
{
  const restoreEnv = installEnvMock({ ANTHROPIC_API_KEY: "", OPENROUTER_API_KEY: "" });
  const mock = installFetchMock({});
  try {
    const out = await completeText({ system: "sys", user: "usr" });
    assert(out === null, "returns null");
    assert(mock.calls.length === 0, "no fetch calls");
  } finally { mock.restore(); restoreEnv(); }
}

// ─── 7. Only OpenRouter key set ─────────────────────────────────
section("7. Only OpenRouter key → Anthropic skipped, OpenRouter used");
{
  const restoreEnv = installEnvMock({ ANTHROPIC_API_KEY: "", OPENROUTER_API_KEY: "only-me" });
  const mock = installFetchMock({ openrouter: [openrouter200("or-only")] });
  try {
    const out = await completeText({ system: "sys", user: "usr" });
    assert(out === "or-only", `OpenRouter-only works (got "${out}")`);
    assert(mock.calls.length === 1, "1 fetch call");
    assert(mock.calls[0].provider === "openrouter", "call was to OpenRouter");
  } finally { mock.restore(); restoreEnv(); }
}

// ─── 8. Whitespace normalisation ────────────────────────────────
section("8. Output is trimmed + whitespace-collapsed");
{
  const restoreEnv = installEnvMock({ ANTHROPIC_API_KEY: "test" });
  const mock = installFetchMock({ anthropic: [anthropic200("   hello\n\n  world  \n")] });
  try {
    const out = await completeText({ system: "sys", user: "usr" });
    assert(out === "hello world", `normalised (got "${out}")`);
  } finally { mock.restore(); restoreEnv(); }
}

// ─── 9. Empty system/user short-circuits ────────────────────────
section("9. Empty system or user → null, no network");
{
  const restoreEnv = installEnvMock({ ANTHROPIC_API_KEY: "test" });
  const mock = installFetchMock({});
  try {
    const a = await completeText({ system: "", user: "u" });
    const b = await completeText({ system: "s", user: "" });
    assert(a === null && b === null, "both empty-field cases return null");
    assert(mock.calls.length === 0, "no fetch calls");
  } finally { mock.restore(); restoreEnv(); }
}

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);

} // end main

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
