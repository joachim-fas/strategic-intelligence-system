/**
 * POST /api/v1/canvas/upload — upload a file for a canvas FileNode
 *
 * Accepts multipart/form-data with a "file" field.
 * Stores the file in public/uploads/ and returns metadata including
 * the public URL and extracted text content (for text-based files).
 *
 * SECURITY NOTE: Files are stored in public/uploads/ which is directly
 * served by Next.js. This means uploaded files are publicly accessible
 * without authentication. For production, consider using a private storage
 * backend (S3, GCS) with signed URLs and serving files through an
 * authenticated API route instead.
 */

import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/api-helpers";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/** Maximum upload size: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Allowed image MIME types */
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

/** Allowed image file extensions */
const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
]);

const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/xml",
  "application/json",
  "application/xml",
  "application/x-yaml",
]);

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".markdown", ".csv", ".json",
  ".yaml", ".yml", ".xml", ".html", ".htm",
  ".log", ".env", ".sh", ".ts", ".tsx", ".js",
  ".jsx", ".py", ".rs", ".go", ".java", ".sql",
  ".toml", ".ini", ".cfg",
]);

const MAX_TEXT_BYTES = 50_000; // 50 KB of text extracted for AI analysis

export async function POST(req: Request) {
  // ── Authentication ──────────────────────────────────────────────────
  const { errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // ── File size limit ─────────────────────────────────────────────
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB.` },
        { status: 422 },
      );
    }

    // ── File type allowlist ─────────────────────────────────────────
    const ext = path.extname(file.name).toLowerCase();
    const mime = (file.type || "").toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(ext) || (!ALLOWED_MIMES.has(mime) && mime !== "")) {
      return NextResponse.json(
        { error: `File type not allowed. Accepted types: ${[...ALLOWED_EXTENSIONS].join(", ")}` },
        { status: 422 },
      );
    }

    // Ensure uploads directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    const id    = crypto.randomUUID();
    const saved = `${id}${ext}`;
    const dest  = path.join(UPLOAD_DIR, saved);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(dest, buffer);

    // Try to extract text content (for text-based files that also pass the allowlist)
    let textContent: string | undefined;

    if (TEXT_MIMES.has(mime) || TEXT_EXTENSIONS.has(ext)) {
      try {
        const raw = buffer.toString("utf-8");
        // Limit to MAX_TEXT_BYTES characters for AI context
        textContent = raw.slice(0, MAX_TEXT_BYTES);
        // Remove null bytes that can appear in binary-ish files
        if (textContent.includes("\x00")) textContent = undefined;
      } catch {
        textContent = undefined;
      }
    }

    // API-18: POST creating a resource should return 201
    return NextResponse.json({
      fileId:      id,
      fileName:    file.name,
      fileSize:    file.size,
      fileType:    file.type || "application/octet-stream",
      fileUrl:     `/uploads/${saved}`,
      textContent,
    }, { status: 201 });
  } catch (e) {
    console.error("[canvas/upload]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
