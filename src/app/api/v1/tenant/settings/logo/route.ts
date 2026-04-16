/**
 * POST   /api/v1/tenant/settings/logo — upload a logo for the active tenant
 * DELETE /api/v1/tenant/settings/logo — remove the currently stored logo
 *
 * Storage abstraction
 * ───────────────────
 * In production the expected target is Vercel Blob (or any similar
 * object store). We keep a thin storage shim right here so the route
 * signature stays stable even once the real blob integration lands:
 *
 *   - If `BLOB_READ_WRITE_TOKEN` is set → use Vercel Blob via
 *     @vercel/blob (lazy-required so the package stays optional).
 *   - Otherwise → write to `public/uploads/tenants/<tenantId>/` and
 *     serve from the static /uploads path. Perfectly fine for self-
 *     hosted deployments and for local dev.
 *
 * The tenant's `settings.logoUrl` is updated with the resulting public
 * URL. Readers (AppHeader, Switcher) just render the URL — they don't
 * need to know whether it lives on Blob or on disk.
 *
 * Role gate: requireTenantRole("admin") — owners + admins only.
 * Max size: 512 KB. Allowed types: PNG, JPEG, SVG, WebP.
 */

import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { getSqliteHandle } from "@/db";
import { apiSuccess, apiError, requireTenantRole } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 512 * 1024; // 512 KB — logos are tiny; bigger = mistake
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

interface UploadResult {
  url: string;
  provider: "blob" | "filesystem";
}

async function storeFile(tenantId: string, buffer: Buffer, mime: string): Promise<UploadResult> {
  const ext = MIME_TO_EXT[mime] ?? "bin";
  const filename = `logo-${Date.now()}.${ext}`;

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const blob = require("@vercel/blob") as { put: (key: string, body: Buffer, opts: unknown) => Promise<{ url: string }> };
      const key = `tenants/${tenantId}/${filename}`;
      const result = await blob.put(key, buffer, {
        access: "public",
        contentType: mime,
        token: blobToken,
      });
      return { url: result.url, provider: "blob" };
    } catch (err) {
      // If @vercel/blob isn't installed or fails, fall through to FS
      // instead of erroring out — dev setups shouldn't need the
      // dependency just to test the flow.
      // eslint-disable-next-line no-console
      console.warn("[logo-upload] Vercel Blob unavailable, falling back to filesystem:", err);
    }
  }

  // Filesystem: write under public/uploads/tenants/<id>/ so Next can
  // serve it statically at /uploads/tenants/<id>/<filename>.
  const dir = path.join(process.cwd(), "public", "uploads", "tenants", tenantId);
  await fs.mkdir(dir, { recursive: true });
  // Clean up old logo files for this tenant (keep disk bounded). We
  // don't track individual old filenames — wipe the whole folder and
  // re-drop the new file. That's safe: the folder is dedicated to
  // this tenant's logo, nothing else.
  try {
    const existing = await fs.readdir(dir);
    await Promise.all(existing.map((f) => fs.rm(path.join(dir, f), { force: true })));
  } catch { /* first upload for this tenant */ }
  await fs.writeFile(path.join(dir, filename), buffer);
  return {
    url: `/uploads/tenants/${tenantId}/${filename}`,
    provider: "filesystem",
  };
}

export async function POST(request: Request) {
  const ctx = await requireTenantRole(request, "admin");
  if (ctx.errorResponse) return ctx.errorResponse;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Expected multipart/form-data", 400, "VALIDATION_ERROR");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return apiError("Missing file field", 400, "VALIDATION_ERROR");
  }
  if (file.size === 0) {
    return apiError("Empty file", 400, "VALIDATION_ERROR");
  }
  if (file.size > MAX_BYTES) {
    return apiError(`Logo too large (max ${MAX_BYTES / 1024} KB)`, 413, "TOO_LARGE");
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return apiError(`Unsupported file type: ${file.type}`, 415, "UNSUPPORTED_TYPE");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await storeFile(ctx.tenantId, buffer, file.type);

  // Persist the public URL into tenants.settings.logoUrl. Read the
  // current settings first so we merge non-destructively.
  const d = getSqliteHandle();
  const row = d.prepare("SELECT settings FROM tenants WHERE id = ?").get(ctx.tenantId) as { settings: string } | undefined;
  const currentSettings = row?.settings ? safeParse(row.settings) : {};
  const nextSettings = { ...currentSettings, logoUrl: result.url };
  d.prepare("UPDATE tenants SET settings = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(nextSettings), ctx.tenantId);

  d.prepare(`
    INSERT INTO tenant_audit_log (id, tenant_id, actor_user_id, action, target)
    VALUES (?, ?, ?, 'logo.uploaded', ?)
  `).run(
    crypto.randomUUID(),
    ctx.tenantId,
    ctx.user.id || null,
    JSON.stringify({ url: result.url, size: file.size, type: file.type, provider: result.provider }),
  );

  return apiSuccess({ url: result.url, provider: result.provider });
}

export async function DELETE(request: Request) {
  const ctx = await requireTenantRole(request, "admin");
  if (ctx.errorResponse) return ctx.errorResponse;

  const d = getSqliteHandle();
  const row = d.prepare("SELECT settings FROM tenants WHERE id = ?").get(ctx.tenantId) as { settings: string } | undefined;
  const currentSettings = row?.settings ? safeParse(row.settings) : {};
  if (!currentSettings.logoUrl) {
    return apiSuccess({ url: null });
  }

  // Filesystem cleanup (safe no-op for Blob-stored URLs).
  if (String(currentSettings.logoUrl).startsWith("/uploads/")) {
    try {
      const abs = path.join(process.cwd(), "public", currentSettings.logoUrl as string);
      await fs.rm(abs, { force: true });
    } catch { /* best effort */ }
  }

  const nextSettings = { ...currentSettings, logoUrl: null };
  d.prepare("UPDATE tenants SET settings = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(nextSettings), ctx.tenantId);

  d.prepare(`
    INSERT INTO tenant_audit_log (id, tenant_id, actor_user_id, action, target)
    VALUES (?, ?, ?, 'logo.removed', '{}')
  `).run(crypto.randomUUID(), ctx.tenantId, ctx.user.id || null);

  return new NextResponse(null, { status: 204 });
}

interface TenantSettingsShape {
  logoUrl?: string | null;
  [k: string]: unknown;
}

function safeParse(s: string): TenantSettingsShape {
  try { return JSON.parse(s) as TenantSettingsShape; } catch { return {}; }
}
