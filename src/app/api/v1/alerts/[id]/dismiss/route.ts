/**
 * POST /api/v1/alerts/[id]/dismiss — dismiss a scenario alert
 */
import { NextResponse } from "next/server";
import { dismissAlert } from "@/lib/scenario-alerts";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  dismissAlert(id);
  return NextResponse.json({ ok: true });
}
