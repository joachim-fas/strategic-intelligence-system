/**
 * GET /api/v1/versions/[id] — get a single version with full result
 */
import { NextResponse } from "next/server";
import { getVersion } from "@/lib/query-versions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const version = getVersion(id);
  if (!version) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ version });
}
