#!/usr/bin/env tsx
/**
 * error-mapping-test — pinn für mapAnthropicError.
 *
 * Pilot-Eval-Fix 2026-04-22: Anthropic-API-Fehler wurden generisch gemappt,
 * Billing- und Auth-Probleme landeten beim User als „Anfrage zu kurz oder
 * System überlastet". Fix differenziert die 400er anhand des Response-
 * Body-Contents.
 *
 * Dieser Test füttert realistische Anthropic-Error-Payloads in das
 * Mapping und prüft, dass die User-facing-Meldung in der richtigen
 * Kategorie landet (Billing / Auth / Permission / RateLimit / Generic).
 *
 * Run: `npx tsx scripts/error-mapping-test.ts`
 */

import { mapAnthropicError } from "../src/lib/error-mapping";

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.log(`  ✗ ${label}`); }
}

function section(title: string) {
  console.log(`\n▸ ${title}`);
}

// ═══════════════════════════════════════════════════════════════════════
//  Credit Balance — der Auslöser aus dem Pilot-Eval-Nachmittag
// ═══════════════════════════════════════════════════════════════════════
section("Credit Balance (HTTP 400)");

{
  const body = JSON.stringify({
    type: "error",
    error: {
      type: "invalid_request_error",
      message: "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
    },
  });
  const mapped = mapAnthropicError(400, body);
  assert(/Abrechnung/i.test(mapped.de), "DE: 'Abrechnung' in Message");
  assert(/billing/i.test(mapped.en), "EN: 'billing' in Message");
  assert(/Administrator kontaktieren/i.test(mapped.de), "DE: verweist auf Administrator");
  assert(/contact administrator/i.test(mapped.en), "EN: verweist auf Administrator");
  assert(!/Anfrage zu kurz/.test(mapped.de), "DE: NICHT mehr der alte 'Anfrage zu kurz'-Fallback");
}

// Varianten: snake_case, unterschiedliche Formulierungen
{
  const variants = [
    "Your credit_balance is too low",
    "credit balance is too low",
    "billing is not configured",
    "payment method billing error",
  ];
  for (const msg of variants) {
    const body = JSON.stringify({ error: { type: "invalid_request_error", message: msg } });
    const mapped = mapAnthropicError(400, body);
    assert(/Abrechnung|billing/i.test(mapped.de), `Variante '${msg.slice(0, 30)}…' → Billing`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Authentication Errors
// ═══════════════════════════════════════════════════════════════════════
section("Authentication (HTTP 401 + typed 400)");

{
  const body = JSON.stringify({
    error: {
      type: "authentication_error",
      message: "invalid x-api-key",
    },
  });
  const mapped = mapAnthropicError(401, body);
  assert(/Authentifizierung/i.test(mapped.de), "DE: 'Authentifizierung' bei 401");
  assert(/authentication/i.test(mapped.en), "EN: 'authentication' bei 401");
}

{
  // Auth error im 400-Body (Anthropic ist da manchmal inkonsistent)
  const body = JSON.stringify({
    error: {
      type: "authentication_error",
      message: "API key not found",
    },
  });
  const mapped = mapAnthropicError(400, body);
  assert(/Authentifizierung/i.test(mapped.de),
    "400 mit authentication_error-Type → Authentifizierungsmeldung");
}

// ═══════════════════════════════════════════════════════════════════════
//  Permission / Forbidden
// ═══════════════════════════════════════════════════════════════════════
section("Permission (HTTP 403)");

{
  const body = JSON.stringify({
    error: {
      type: "permission_error",
      message: "Your organization does not have access to this model",
    },
  });
  const mapped = mapAnthropicError(403, body);
  assert(/Zugriff verweigert/i.test(mapped.de), "DE: 'Zugriff verweigert' bei 403");
  assert(/permission denied/i.test(mapped.en), "EN: 'permission denied' bei 403");
}

// ═══════════════════════════════════════════════════════════════════════
//  Rate Limit
// ═══════════════════════════════════════════════════════════════════════
section("Rate Limit");

{
  // Primär-Pfad: HTTP 429
  const mapped = mapAnthropicError(429, "");
  assert(/überlastet/i.test(mapped.de), "429 → 'überlastet' (DE)");
  assert(/overloaded/i.test(mapped.en), "429 → 'overloaded' (EN)");
}

{
  // Secondary-Pfad: rate-limit-Hinweis im 400-Body
  const body = JSON.stringify({ error: { message: "daily rate limit exceeded" } });
  const mapped = mapAnthropicError(400, body);
  assert(/Rate-Limit/i.test(mapped.de), "400 mit rate-limit-Text → Rate-Limit-Meldung");
}

// ═══════════════════════════════════════════════════════════════════════
//  5xx — Unavailability
// ═══════════════════════════════════════════════════════════════════════
section("5xx Server-Side");

{
  for (const status of [500, 502, 503, 504]) {
    const mapped = mapAnthropicError(status, "");
    assert(/nicht erreichbar/i.test(mapped.de), `${status} → 'nicht erreichbar' (DE)`);
    assert(/unavailable/i.test(mapped.en), `${status} → 'unavailable' (EN)`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Generic Bad Request
// ═══════════════════════════════════════════════════════════════════════
section("Generic 400");

{
  // Malformed body, nichts spezifisch Identifizierbares
  const body = JSON.stringify({
    error: { type: "invalid_request_error", message: "messages: field required" },
  });
  const mapped = mapAnthropicError(400, body);
  assert(/Anfrage konnte nicht verarbeitet werden/i.test(mapped.de),
    "DE: generische Fehlermeldung ohne spezifisches Billing/Auth-Signal");
  assert(/Unable to process/i.test(mapped.en), "EN: generic fallback");
}

// ═══════════════════════════════════════════════════════════════════════
//  Robustheit: Nicht-JSON-Bodies
// ═══════════════════════════════════════════════════════════════════════
section("Non-JSON Bodies");

{
  // Plain-Text-Body mit Billing-Hinweis
  const mapped = mapAnthropicError(400, "credit balance too low");
  assert(/Abrechnung|billing/i.test(mapped.de),
    "Plain-Text 'credit balance' → Billing-Mapping");
}

{
  // Völlig leerer Body
  const mapped = mapAnthropicError(400, "");
  assert(/Anfrage konnte nicht verarbeitet werden/i.test(mapped.de),
    "Leerer Body → generic fallback (kein Crash)");
}

{
  // HTML-Error-Seite (z.B. Cloudflare-Interrupt)
  const mapped = mapAnthropicError(502, "<html>502 Bad Gateway</html>");
  assert(/nicht erreichbar/i.test(mapped.de), "HTML-502 → unavailable");
}

// ═══════════════════════════════════════════════════════════════════════
//  Locale-Symmetrie
// ═══════════════════════════════════════════════════════════════════════
section("Locale-Symmetrie (jede Mapping hat DE+EN)");

{
  const testCases = [
    [400, '{"error":{"message":"credit balance too low"}}'],
    [400, '{"error":{"type":"authentication_error"}}'],
    [400, '{"error":{"message":"rate limit"}}'],
    [400, '{"error":{"message":"generic bad request"}}'],
    [401, '{}'],
    [403, '{}'],
    [429, ''],
    [500, ''],
    [502, ''],
  ] as const;
  for (const [status, body] of testCases) {
    const mapped = mapAnthropicError(status, body);
    assert(
      typeof mapped.de === "string" && mapped.de.length > 10 &&
      typeof mapped.en === "string" && mapped.en.length > 10,
      `Status ${status}: DE+EN beide gesetzt und nicht-leer`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════════════
console.log(`\n─────────────────────────────────────────`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log(`─────────────────────────────────────────`);
if (failed > 0) process.exit(1);
