#!/usr/bin/env tsx
/**
 * openapi-spec-test — shape validation for the hand-curated
 * OpenAPI 3.1 spec (API-19).
 *
 * Not a full JSON-schema validator — just checks the basics that
 * would break integrators if they regress:
 *   1. Every documented path references paths that actually exist
 *      in the routing tree.
 *   2. Every $ref points to a schema in components.schemas.
 *   3. Every feature-flagged path documents its 404 behaviour.
 *   4. info.version is semver-ish.
 *   5. HTTP methods only come from the allowed set.
 *
 * Run: `tsx scripts/openapi-spec-test.ts`
 */

import fs from "fs";
import path from "path";
import { OPENAPI_DOC } from "../src/lib/openapi-spec";

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.log(`  ✗ ${label}`); }
}

function section(title: string) { console.log(`\n▸ ${title}`); }

// ─── 1. Root document shape ────────────────────────────────────
section("1. Root document shape");
assert(OPENAPI_DOC.openapi === "3.1.0", "openapi version is 3.1.0");
assert(typeof OPENAPI_DOC.info?.title === "string", "info.title present");
assert(/^\d+\.\d+\.\d+/.test(OPENAPI_DOC.info.version), `info.version is semver-ish (got "${OPENAPI_DOC.info.version}")`);
assert(Array.isArray(OPENAPI_DOC.servers) && OPENAPI_DOC.servers.length > 0, "at least one server entry");
assert(typeof OPENAPI_DOC.paths === "object", "paths object present");
assert(Object.keys(OPENAPI_DOC.paths).length > 0, `at least one path (got ${Object.keys(OPENAPI_DOC.paths).length})`);

// ─── 2. HTTP method whitelist ──────────────────────────────────
section("2. All methods are standard HTTP verbs");
const ALLOWED_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);
let badMethods = 0;
for (const [pathKey, ops] of Object.entries(OPENAPI_DOC.paths)) {
  for (const method of Object.keys(ops)) {
    if (!ALLOWED_METHODS.has(method)) {
      console.log(`    ! ${pathKey} has non-standard method: ${method}`);
      badMethods += 1;
    }
  }
}
assert(badMethods === 0, `all methods are standard (${badMethods} violations)`);

// ─── 3. Every path has at least one operation ──────────────────
section("3. Every path has ≥1 operation");
let emptyPaths = 0;
for (const [pathKey, ops] of Object.entries(OPENAPI_DOC.paths)) {
  if (Object.keys(ops).length === 0) {
    console.log(`    ! ${pathKey} has zero operations`);
    emptyPaths += 1;
  }
}
assert(emptyPaths === 0, "no empty path objects");

// ─── 4. Every documented path corresponds to a real route ──────
section("4. Documented paths have matching route.ts files");
const apiDir = path.join(process.cwd(), "src/app/api/v1");
function routeExists(apiPath: string): boolean {
  // Strip leading slash, drop query params, convert {param} to [param].
  const normalised = apiPath.replace(/^\//, "").replace(/\{(\w+)\}/g, "[$1]");
  const candidate = path.join(apiDir, normalised, "route.ts");
  return fs.existsSync(candidate);
}
let missingRoutes = 0;
for (const pathKey of Object.keys(OPENAPI_DOC.paths)) {
  if (!routeExists(pathKey)) {
    console.log(`    ! ${pathKey} has no matching route.ts`);
    missingRoutes += 1;
  }
}
assert(missingRoutes === 0, `all ${Object.keys(OPENAPI_DOC.paths).length} documented paths exist (${missingRoutes} missing)`);

// ─── 5. All $refs point to components.schemas ──────────────────
section("5. All $refs resolve within components.schemas");
const schemaKeys = new Set(Object.keys(OPENAPI_DOC.components.schemas));

function collectRefs(obj: unknown, refs: string[] = []): string[] {
  if (obj == null || typeof obj !== "object") return refs;
  if (Array.isArray(obj)) {
    for (const item of obj) collectRefs(item, refs);
    return refs;
  }
  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (key === "$ref" && typeof value === "string") refs.push(value);
    else collectRefs(value, refs);
  }
  return refs;
}

const allRefs = collectRefs(OPENAPI_DOC);
let badRefs = 0;
for (const ref of allRefs) {
  const m = ref.match(/^#\/components\/schemas\/(.+)$/);
  if (!m) { console.log(`    ! unrecognised ref shape: ${ref}`); badRefs += 1; continue; }
  if (!schemaKeys.has(m[1])) { console.log(`    ! ${ref} → schema "${m[1]}" missing`); badRefs += 1; }
}
assert(badRefs === 0, `${allRefs.length} refs, all resolve (${badRefs} broken)`);

// ─── 6. Feature-flagged endpoints document the 404 response ────
section("6. Feature-flagged paths document 404");
const featureFlaggedPaths = Object.keys(OPENAPI_DOC.paths).filter(
  (p) => p.startsWith("/forecasts"),
);
let missing404 = 0;
for (const pathKey of featureFlaggedPaths) {
  const ops = OPENAPI_DOC.paths[pathKey];
  for (const [method, op] of Object.entries(ops)) {
    if (!op.responses) {
      console.log(`    ! ${method.toUpperCase()} ${pathKey}: no responses`);
      missing404 += 1;
      continue;
    }
    // Either documents 404 explicitly OR has a description mentioning
    // the feature flag. Not every GET needs a 404 (calibration
    // subpath returns 200 with empty data when no history).
    const has404 = "404" in op.responses;
    const mentionsFlag = (op.description ?? "").toLowerCase().includes("flag") ||
                         (op.description ?? "").includes("FORECASTS_ENABLED");
    if (!has404 && !mentionsFlag) {
      console.log(`    ! ${method.toUpperCase()} ${pathKey}: neither 404 nor flag mention`);
      missing404 += 1;
    }
  }
}
assert(missing404 === 0, `all ${featureFlaggedPaths.length} forecasts paths document flag behaviour`);

// ─── 7. Every operation has a summary ──────────────────────────
section("7. Every operation has a non-empty summary");
let noSummary = 0;
for (const [pathKey, ops] of Object.entries(OPENAPI_DOC.paths)) {
  for (const [method, op] of Object.entries(ops)) {
    if (!op.summary || op.summary.length < 5) {
      console.log(`    ! ${method.toUpperCase()} ${pathKey}: missing/short summary`);
      noSummary += 1;
    }
  }
}
assert(noSummary === 0, "all operations have summaries");

// ─── 8. Every operation has at least one response ──────────────
section("8. Every operation has ≥1 response");
let noResponse = 0;
for (const [pathKey, ops] of Object.entries(OPENAPI_DOC.paths)) {
  for (const [method, op] of Object.entries(ops)) {
    if (!op.responses || Object.keys(op.responses).length === 0) {
      console.log(`    ! ${method.toUpperCase()} ${pathKey}: no responses`);
      noResponse += 1;
    }
  }
}
assert(noResponse === 0, "all operations have responses");

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
