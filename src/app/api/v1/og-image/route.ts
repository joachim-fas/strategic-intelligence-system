/**
 * GET /api/v1/og-image?url=...
 *
 * Resolves the Open-Graph image for a given URL, with a SQLite-backed
 * TTL cache in `og_image_cache`. Used by the Signale-Tab card grid to
 * show link previews without hammering target sites on every mount.
 *
 * Cache contract:
 *   - Cache HIT with unexpired row → return cached entry, `cached: true`
 *   - Cache MISS or expired row    → fetch, parse, upsert, return fresh
 *
 * TTL (deliberately asymmetric):
 *   - status=ok        → 7 days  (OG images basically never change)
 *   - status=no-image  → 7 days  (publishers rarely add OG tags later)
 *   - status=error     → 1 day   (transient failures should retry sooner)
 *
 * Non-goals:
 *   - We do NOT proxy the image bytes. The client renders the URL
 *     directly via `<img src=>`. Most publishers' CDNs set permissive
 *     CORS for images, and the few that don't will just fall back to
 *     the placeholder. If that becomes a real problem, v2 can add a
 *     byte-proxy mode behind a second endpoint.
 */

import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { fetchOgImage, type OgImageStatus } from "@/lib/og-image";

export const dynamic = "force-dynamic";

interface CacheRow {
  url: string;
  image_url: string | null;
  status: OgImageStatus;
  fetched_at: string;
  expires_at: string;
}

function openDb() {
  const dbPath = path.join(process.cwd(), "local.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  return db;
}

function ttlMs(status: OgImageStatus): number {
  // Successes and no-image lookups are long-lived; errors retry daily.
  if (status === "error") return 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get("url");

  if (!target) {
    return NextResponse.json(
      { error: "missing-url-param" },
      { status: 400 },
    );
  }

  // ── SEC-08: SSRF blocklist — reject URLs targeting private/internal IPs ──
  function isPrivateUrl(urlStr: string): boolean {
    try {
      const u = new URL(urlStr);
      const hostname = u.hostname.toLowerCase();

      // IPv6 loopback and private ranges
      if (hostname === "[::1]" || hostname === "::1") return true;
      if (hostname.startsWith("[fd") || hostname.startsWith("fd")) return true;
      if (hostname.startsWith("[fe80") || hostname.startsWith("fe80")) return true;

      // Localhost variations
      if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;

      // IPv4 private and reserved ranges
      const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      if (ipv4Match) {
        const [, a, b] = ipv4Match.map(Number);
        if (a === 127) return true;                          // 127.0.0.0/8 loopback
        if (a === 10) return true;                           // 10.0.0.0/8 private
        if (a === 172 && b >= 16 && b <= 31) return true;    // 172.16.0.0/12 private
        if (a === 192 && b === 168) return true;             // 192.168.0.0/16 private
        if (a === 169 && b === 254) return true;             // 169.254.0.0/16 link-local
        if (a === 0) return true;                            // 0.0.0.0/8
      }

      return false;
    } catch {
      return true; // If we can't parse it, reject it
    }
  }

  // Normalise before hashing into the cache key: protocol + host stay
  // lowercase, the path stays case-sensitive. Query string is kept —
  // many CMSs serve different previews per query param (e.g. ?amp=1).
  let normalised: string;
  try {
    const u = new URL(target);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return NextResponse.json(
        { error: "unsupported-protocol" },
        { status: 400 },
      );
    }
    // Block requests to private/internal addresses
    if (isPrivateUrl(target)) {
      return NextResponse.json(
        { error: "url-not-allowed" },
        { status: 400 },
      );
    }
    // Strip the hash — it's client-side only and bloats the cache.
    u.hash = "";
    normalised = u.toString();
  } catch {
    return NextResponse.json({ error: "invalid-url" }, { status: 400 });
  }

  const db = openDb();

  try {
    const now = Date.now();

    // ── Cache lookup ───────────────────────────────────────────────
    const row = db
      .prepare(
        `SELECT url, image_url, status, fetched_at, expires_at
         FROM og_image_cache
         WHERE url = ?`,
      )
      .get(normalised) as CacheRow | undefined;

    if (row) {
      const expiresMs = new Date(row.expires_at).getTime();
      if (expiresMs > now) {
        return NextResponse.json(
          {
            imageUrl: row.image_url,
            status: row.status,
            cached: true,
            fetchedAt: row.fetched_at,
          },
          {
            headers: {
              // Small client-side cache too — the browser can skip the
              // round-trip entirely on refresh.
              "Cache-Control": "public, max-age=3600",
            },
          },
        );
      }
    }

    // ── Miss or expired — refetch ──────────────────────────────────
    const result = await fetchOgImage(normalised);
    const expiresAt = new Date(now + ttlMs(result.status)).toISOString();

    db.prepare(
      `INSERT INTO og_image_cache (url, image_url, status, fetched_at, expires_at)
       VALUES (?, ?, ?, datetime('now'), ?)
       ON CONFLICT(url) DO UPDATE SET
         image_url = excluded.image_url,
         status = excluded.status,
         fetched_at = excluded.fetched_at,
         expires_at = excluded.expires_at`,
    ).run(normalised, result.imageUrl, result.status, expiresAt);

    return NextResponse.json(
      {
        imageUrl: result.imageUrl,
        status: result.status,
        cached: false,
        reason: result.reason || undefined,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=3600",
        },
      },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/v1/og-image]", msg);
    return NextResponse.json(
      { imageUrl: null, status: "error", cached: false, reason: msg },
      { status: 500 },
    );
  } finally {
    db.close();
  }
}
