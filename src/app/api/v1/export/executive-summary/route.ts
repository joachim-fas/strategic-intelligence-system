/**
 * POST /api/v1/export/executive-summary
 *
 * Polishes a full briefing or framework result into a C-level
 * executive summary (Notion v0.2 Section 6.1). Uses
 * `EXECUTIVE_SUMMARY_PROMPT_EN`.
 *
 * Request body:
 *   {
 *     briefing: object,            // full briefing / framework payload (JSON)
 *     locale?: "de" | "en"
 *   }
 *
 * Response body:
 *   {
 *     markdown: string,            // ready-to-copy Markdown
 *     wordCount: number,
 *     modelUsed: string
 *   }
 *
 * Model: claude-sonnet-4-5, max_tokens 1500, Haiku fallback.
 *
 * The endpoint returns Markdown plain text (not JSON with text inside)
 * so the frontend can render it directly or trigger a download.
 */

import { checkRateLimit, tooManyRequests } from "@/lib/api-utils";
import { resolveEnv } from "@/lib/env";
import { requireTenantContext, apiSuccess, apiError } from "@/lib/api-helpers";
import { buildDateContext } from "@/lib/llm";
import { EXECUTIVE_SUMMARY_PROMPT_EN } from "@/lib/briefing-export";

export async function POST(req: Request) {
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`export-exec:${clientIp}`, 30, 3_600_000)) {
    return tooManyRequests("Rate limit exceeded for executive-summary. Try again later.");
  }

  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey || apiKey.length < 10) {
    return apiError("Service temporarily unavailable", 503, "SERVICE_UNAVAILABLE");
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return apiError("Invalid JSON body", 400, "BAD_REQUEST");
  }

  const { briefing, locale } = body as { briefing?: unknown; locale?: unknown };
  if (!briefing || typeof briefing !== "object") {
    return apiError("briefing must be an object", 400, "BAD_REQUEST");
  }

  const validLocale: "de" | "en" = locale === "en" ? "en" : "de";

  // Serialise the briefing into the prompt. Cap at 16 000 chars so
  // the prompt stays within a single Claude request even for very
  // rich framework outputs. Longer briefings get truncated — the
  // summary still works because the most important fields (synthesis,
  // keyInsights, scenarios, confidence) are emitted first by the
  // briefing pipeline.
  const briefingJson = JSON.stringify(briefing, null, 2).slice(0, 16000);
  const safeBriefing = briefingJson
    .replace(/<\/?[a-zA-Z_|][^>]{0,80}>/g, "")
    .replace(/\b(system|user|assistant|human)\s*:/gi, "");

  const userPrompt = EXECUTIVE_SUMMARY_PROMPT_EN.replace(
    "BRIEFING_OR_FRAMEWORK_OUTPUT",
    safeBriefing,
  );

  const dateBlock = buildDateContext(validLocale);
  const systemPrompt = `${dateBlock}

You are the SIS Executive Summary writer. You compress strategic briefings for C-level audiences without losing the causal core. ${validLocale === "de" ? "Respond in German." : "Respond in English."} Return plain Markdown only — no JSON envelope, no code fences.`;

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
        if (res.status === 529 || res.status >= 500) continue;
        const errText = await res.text();
        console.error(`[export/exec] Anthropic ${res.status}:`, errText.slice(0, 200));
        return apiError("Upstream model error", 502, "UPSTREAM_ERROR");
      }

      const data = await res.json();
      const text: string | undefined = data.content?.[0]?.text;
      if (!text || text.trim().length < 30) continue;

      const markdown = text.trim();
      const wordCount = markdown.split(/\s+/).filter(Boolean).length;

      return apiSuccess({ markdown, wordCount, modelUsed: model });
    } catch (err) {
      console.error(`[export/exec] model=${model} failed:`, err);
      continue;
    }
  }

  return apiError(
    "All fallback models returned empty output. Please try again.",
    502,
    "UPSTREAM_EMPTY",
  );
}
