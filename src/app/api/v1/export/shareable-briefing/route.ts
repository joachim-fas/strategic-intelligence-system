/**
 * POST /api/v1/export/shareable-briefing
 *
 * Turns a full briefing into a short shareable email/Slack snippet
 * (Notion v0.2 Section 6.2). Uses `SHAREABLE_BRIEFING_PROMPT_EN`.
 *
 * Request body:
 *   {
 *     briefing: object,            // full briefing / framework payload (JSON)
 *     locale?: "de" | "en"
 *   }
 *
 * Response body:
 *   {
 *     text: string,                // ready-to-paste plain text
 *     modelUsed: string
 *   }
 *
 * Model: claude-haiku-4-5, max_tokens 1200, Sonnet fallback for
 * structured richness when Haiku drops quality.
 */

import { NextResponse } from "next/server";
import { checkRateLimit, tooManyRequests } from "@/lib/api-utils";
import { resolveEnv } from "@/lib/env";
import { requireTenantContext } from "@/lib/api-helpers";
import { buildDateContext } from "@/lib/llm";
import { SHAREABLE_BRIEFING_PROMPT_EN } from "@/lib/briefing-export";

export async function POST(req: Request) {
  const ctx = await requireTenantContext(req);
  if (ctx.errorResponse) return ctx.errorResponse;

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`export-share:${clientIp}`, 60, 3_600_000)) {
    return tooManyRequests("Rate limit exceeded for shareable-briefing. Try again later.");
  }

  const apiKey = resolveEnv("ANTHROPIC_API_KEY");
  if (!apiKey || apiKey.length < 10) {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { briefing, locale } = body as { briefing?: unknown; locale?: unknown };
  if (!briefing || typeof briefing !== "object") {
    return NextResponse.json({ error: "briefing must be an object" }, { status: 400 });
  }

  const validLocale: "de" | "en" = locale === "en" ? "en" : "de";

  const briefingJson = JSON.stringify(briefing, null, 2).slice(0, 12000);
  const safeBriefing = briefingJson
    .replace(/<\/?[a-zA-Z_|][^>]{0,80}>/g, "")
    .replace(/\b(system|user|assistant|human)\s*:/gi, "");

  const userPrompt = SHAREABLE_BRIEFING_PROMPT_EN.replace("BRIEFING", safeBriefing);

  const dateBlock = buildDateContext(validLocale);
  const systemPrompt = `${dateBlock}

You are the SIS Shareable-Briefing writer. You produce short plain-text snippets that read well in email or Slack, comprehensible without prior context. ${validLocale === "de" ? "Respond in German." : "Respond in English."} Return plain text only — no JSON envelope, no code fences.`;

  const MODEL_CHAIN = ["claude-haiku-4-5", "claude-sonnet-4-5"] as const;

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
          max_tokens: 1200,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!res.ok) {
        if (res.status === 529 || res.status >= 500) continue;
        const errText = await res.text();
        console.error(`[export/share] Anthropic ${res.status}:`, errText.slice(0, 200));
        return NextResponse.json({ error: "Upstream model error" }, { status: 502 });
      }

      const data = await res.json();
      const text: string | undefined = data.content?.[0]?.text;
      if (!text || text.trim().length < 30) continue;

      return NextResponse.json({ text: text.trim(), modelUsed: model });
    } catch (err) {
      console.error(`[export/share] model=${model} failed:`, err);
      continue;
    }
  }

  return NextResponse.json(
    { error: "All fallback models returned empty output. Please try again." },
    { status: 502 },
  );
}
