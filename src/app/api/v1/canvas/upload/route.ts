/**
 * POST /api/v1/canvas/upload — upload a file for a canvas FileNode
 *
 * Accepts multipart/form-data with a "file" field.
 * Stores the file in public/uploads/ and returns metadata including
 * the public URL and extracted text content (for text-based files).
 */

import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

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
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Ensure uploads directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    const id    = crypto.randomUUID();
    const ext   = path.extname(file.name).toLowerCase();
    const saved = `${id}${ext}`;
    const dest  = path.join(UPLOAD_DIR, saved);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(dest, buffer);

    // Try to extract text content
    let textContent: string | undefined;
    const mime = (file.type || "").toLowerCase();

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

    return NextResponse.json({
      fileId:      id,
      fileName:    file.name,
      fileSize:    file.size,
      fileType:    file.type || "application/octet-stream",
      fileUrl:     `/uploads/${saved}`,
      textContent,
    });
  } catch (e) {
    console.error("[canvas/upload]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
