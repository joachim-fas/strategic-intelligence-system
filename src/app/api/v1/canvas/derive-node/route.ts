/**
 * POST /api/v1/canvas/derive-node
 *
 * Derives a new Canvas node from N selected source nodes using the
 * Notion v0.2 Section 5.3 prompt (`CANVAS_DERIVED_NODE_PROMPT_EN`).
 *
 * Request body:
 *   {
 *     sourceNodes: Array<{ title: string; content: string; type?: string }>,
 *     derivationType: "SYNTHESIS" | "IMPLICATION" | "CONTRADICTION" | "ACTION" | "QUESTION",
 *     worldModelContext?: string,
 *     locale?: "de" | "en"
 *   }
 *
 * Response body (non-streaming JSON):
 *   {
 *     type: string,
 *     title: string,
 *     content: string,
 *     derivationLogic: string,
 *     worldModelAlignment: string | null,
 *     confidence: number
 *   }
 *
 * Model: claude-sonnet-4-5, max_tokens 1500. Uses Haiku as fallback.
 *
 * This is the first route to wire the v0.2 Canvas-Prompts library into
 * a real endpoint. The Canvas UI can call it from a "derive node"
 * context-menu action without going through the full briefing pipeline.
 */

import { NextResponse } from "next/server";
import { checkRateLimit, tooManyRequests } from "@/lib/api-utils";
import { resolveEnv } from "@/lib/env";
import { requireTenantContext } from "@/lib/api-helpers";
import { buildDateContext } from "@/lib/llm";
import { CANVAS_DERIVED_NODE_PROMPT_EN } from "@/lib/canvas-prompts";

type DerivationType = "SYNTHESIS" | "IMPLICATION" | "CONTRADICTION" | "ACTION" | "QUESTION";
const VALID_DERIVATIONS: DerivationType[] = ["SYNTHESIS", "IMPLICATION", "CONTRADICTION", "ACTION", "QUESTION"];

const sanitizeForPrompt = (input: string, maxLen = 2000): string =>
  !input
    ? ""
    : input
        .slice(0, maxLen)
        .replace(/<\/?[a-zA-Z_|][^>]{0,80}>/g, "")
        .replace(/\b(system|user|assistant|human)\s*:/gi, "")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        .trim();

function extractJSON(text: string): any | null {
  if (!text) return null;
  let cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  cleaned = cleaned.slice(start);
  try { return JSON.parse(cleaned); } catch {}
  const end = cleaned.lastIndexOf("}");
  if (end > 0) {
    try { return JSON.parse(cleaned.slice(0, end + 1)); } catch {}
  }
  return null;
}

export async function POST(req: Request) {
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`canvas-derive-node:${clientIp}`, 40, 3_600_000)) {
    return tooManyRequests("Rate limit exceeded for derive-node. Try again later.");
  }

  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey || apiKey.length < 10) {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sourceNodes, derivationType, worldModelContext, locale } = body as {
    sourceNodes?: unknown;
    derivationType?: unknown;
    worldModelContext?: unknown;
    locale?: unknown;
  };

  if (!Array.isArray(sourceNodes) || sourceNodes.length === 0) {
    return NextResponse.json({ error: "sourceNodes must be a non-empty array" }, { status: 400 });
  }
  if (sourceNodes.length > 20) {
    return NextResponse.json({ error: "sourceNodes must not exceed 20 entries" }, { status: 422 });
  }

  const type = typeof derivationType === "string" ? derivationType.toUpperCase() : "";
  if (!VALID_DERIVATIONS.includes(type as DerivationType)) {
    return NextResponse.json(
      { error: `derivationType must be one of: ${VALID_DERIVATIONS.join(", ")}` },
      { status: 422 },
    );
  }

  const validLocale: "de" | "en" = locale === "en" ? "en" : "de";
  const dateBlock = buildDateContext(validLocale);

  // Format source nodes as a readable list for the prompt
  const sourceBlock = (sourceNodes as Array<any>)
    .map((n, i) => {
      if (!n || typeof n !== "object") return "";
      const nType = sanitizeForPrompt(String(n.type ?? "node"), 40);
      const nTitle = sanitizeForPrompt(String(n.title ?? "Untitled"), 200);
      const nContent = sanitizeForPrompt(String(n.content ?? ""), 2000);
      return `Node ${i + 1} [${nType}] — ${nTitle}\n${nContent}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const worldModelBlock = typeof worldModelContext === "string" && worldModelContext.length > 0
    ? sanitizeForPrompt(worldModelContext, 4000)
    : "(no world model context attached)";

  const userPrompt = CANVAS_DERIVED_NODE_PROMPT_EN
    .replace("SELECTED_NODE_CONTENTS", sourceBlock)
    .replace("RELEVANT_TRENDS_AND_EDGES", worldModelBlock)
    .replace("SYNTHESIS|IMPLICATION|CONTRADICTION|ACTION|QUESTION", type);

  const systemPrompt = `${dateBlock}

You are the Strategic Intelligence System (SIS) Canvas assistant. You derive new Canvas nodes from selected source nodes. Always return valid JSON — no markdown fences, no prose before or after the JSON. Tag every claim with [SIGNAL/TREND/REG/EDGE/LLM-KNOWLEDGE]. ${validLocale === "de" ? "Respond in German." : "Respond in English."}`;

  const MODEL_CHAIN = ["claude-sonnet-4-5", "claude-haiku-4-5"] as const;

  for (const model of MODEL_CHAIN) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!res.ok) {
        // Fall through to next model on overload / 5xx
        if (res.status === 529 || res.status >= 500) continue;
        const errText = await res.text();
        console.error(`[canvas/derive-node] Anthropic ${res.status}:`, errText.slice(0, 200));
        return NextResponse.json({ error: "Upstream model error" }, { status: 502 });
      }

      const data = await res.json();
      const text = data.content?.[0]?.text;
      if (!text) continue;
      const parsed = extractJSON(text);
      if (!parsed) continue;

      return NextResponse.json({
        ...parsed,
        _derivationType: type,
        _modelUsed: model,
      });
    } catch (err) {
      console.error(`[canvas/derive-node] model=${model} failed:`, err);
      continue;
    }
  }

  return NextResponse.json(
    { error: "All fallback models returned empty / invalid output. Please try again." },
    { status: 502 },
  );
}
