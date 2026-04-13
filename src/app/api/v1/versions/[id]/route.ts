/**
 * GET /api/v1/versions/[id] — get a single version with full result
 */
import { getVersion } from "@/lib/query-versions";
import { apiSuccess, apiError, CACHE_HEADERS } from "@/lib/api-helpers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const version = getVersion(id);
  if (!version) {
    return apiError("Version not found", 404, "NOT_FOUND");
  }
  return apiSuccess({ version }, 200, CACHE_HEADERS.long);
}
