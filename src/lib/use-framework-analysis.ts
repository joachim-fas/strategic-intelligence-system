"use client";

import { useState, useCallback } from "react";
import { FrameworkId } from "@/types/frameworks";
import { consumeSSE } from "@/lib/sse-client";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export interface StepResult {
  status: "idle" | "running" | "done" | "error";
  data: any | null;
  rawText: string;
  error?: string;
  statusMessage?: string;
  modelUsed?: string;
}

/**
 * Framework-Analyse-Hook.
 *
 * Der optionale `projectId`-Parameter (User-Regel 2026-04-19: jede
 * Framework-Eingabe definiert sofort ein Projekt) aktiviert die
 * Step-Persistierung: sobald ein Step den Status `done` erreicht,
 * wird das Ergebnis als Row in `project_queries` des Projekts
 * gespeichert. Ohne projectId läuft der Hook wie bisher — rein im
 * lokalen State ohne DB-Writes.
 *
 * Persistierung ist fire-and-forget: ein fehlschlagender Write
 * blockiert die UI nicht, und das nächste Step-done führt einen neuen
 * Versuch. Der Server-Handler ist idempotent genug (neuer Query-Row
 * mit derselben Step-Bezeichnung ist ok — die Zusammenfassung
 * dedupliziert später bei Bedarf).
 */
export function useFrameworkAnalysis(
  frameworkId: FrameworkId,
  projectId?: string | null,
) {
  const [steps, setSteps] = useState<Record<string, StepResult>>({});

  const runStep = useCallback(async (
    stepId: string,
    topic: string,
    locale: string,
    previousStepResults?: Record<string, any>,
  ) => {
    setSteps(prev => ({ ...prev, [stepId]: { status: "running", data: null, rawText: "" } }));

    let context = "";
    if (previousStepResults) {
      const parts = Object.entries(previousStepResults)
        .filter(([, v]) => v && (v.synthesis || typeof v === "object"))
        .map(([k, v]) => {
          const summary = v.synthesis || JSON.stringify(v).slice(0, 1500);
          return `[${k}]: ${summary}`;
        });
      if (parts.length > 0) context = parts.join("\n\n");
    }

    try {
      const res = await fetch("/api/v1/frameworks/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frameworkId, topic, step: stepId, context, locale }),
      });

      if (!res.ok) {
        const err = await res.text();
        setSteps(prev => ({ ...prev, [stepId]: { status: "error", data: null, rawText: "", error: err } }));
        return;
      }

      // Shared SSE client — see src/lib/sse-client.ts (API-09). This
      // was previously a bespoke parser that split on "\n\n"
      // (spec-correct) but shared no code with the other two SSE
      // consumers. Now they all use consumeSSE.
      let fullText = "";
      let result: any = null;
      let gotComplete = false;
      let gotError = false;
      let errorMsg = "";
      let modelUsed: string | undefined;

      await consumeSSE(res, {
        onEvent(event) {
          if (event.type === "delta" && typeof event.text === "string") {
            fullText += event.text;
            setSteps(prev => ({
              ...prev,
              [stepId]: { ...prev[stepId], rawText: fullText, status: "running" },
            }));
          } else if (event.type === "status") {
            setSteps(prev => ({
              ...prev,
              [stepId]: { ...prev[stepId], statusMessage: event.message as string, status: "running" },
            }));
          } else if (event.type === "complete") {
            result = (event as { result?: unknown }).result;
            modelUsed = (event as { modelUsed?: string }).modelUsed;
            gotComplete = true;
          } else if (event.type === "error") {
            gotError = true;
            errorMsg = (event.error as string) || "Unknown error";
          }
        },
      });

      if (gotError) {
        setSteps(prev => ({
          ...prev,
          [stepId]: { status: "error", data: null, rawText: fullText, error: errorMsg },
        }));
        return;
      }

      if (!gotComplete || !result) {
        setSteps(prev => ({
          ...prev,
          [stepId]: {
            status: "error", data: null, rawText: fullText,
            error: "Keine Antwort vom Modell erhalten. Bitte erneut versuchen.",
          },
        }));
        return;
      }

      // Check if result is meaningfully empty
      const resultKeys = Object.keys(result).filter(k => !k.startsWith("_"));
      const hasContent = resultKeys.length > 0 && resultKeys.some(k => {
        const v = result[k];
        if (typeof v === "string") return v.trim().length > 0;
        if (Array.isArray(v)) return v.length > 0;
        if (v && typeof v === "object") return Object.keys(v).length > 0;
        return v != null;
      });

      if (!hasContent) {
        setSteps(prev => ({
          ...prev,
          [stepId]: {
            status: "error", data: null, rawText: fullText,
            error: "Leeres Ergebnis. Modell überlastet? Bitte erneut versuchen.",
          },
        }));
        return;
      }

      setSteps(prev => ({
        ...prev,
        [stepId]: { status: "done", data: result, rawText: fullText, modelUsed },
      }));

      // Persistierung (User-Regel 2026-04-19): das fertige Step-
      // Ergebnis landet als Query-Row im Projekt, damit die spätere
      // Zusammenfassung ALLE Framework-Outputs merged — nicht nur das
      // Bootstrap-Topic aus der FrameworkShell. Wir verwenden
      // `query = "<frameworkId>/<stepId>"` als stabile, sprechende
      // Kennung (z.B. `"pre-mortem/risks"`). Fire-and-forget: ein
      // Netzwerkfehler blockiert die UI nicht, der User sieht das
      // Ergebnis sofort.
      if (projectId) {
        const persistQuery = `${frameworkId}/${stepId}`;
        const synthesisField = typeof result?.synthesis === "string" && result.synthesis.length > 0
          ? result.synthesis
          : `Framework ${frameworkId} · Step ${stepId} · Topic: ${topic}`;
        fetchWithTimeout(`/api/v1/projects/${projectId}/queries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: persistQuery,
            result: {
              ...result,
              synthesis: synthesisField,
              _framework: frameworkId,
              _step: stepId,
              _topic: topic,
              _modelUsed: modelUsed,
              _persistedAt: new Date().toISOString(),
            },
            locale,
          }),
        }, 60_000).catch((e) => {
          console.warn(`[framework] step-persist ${frameworkId}/${stepId} failed`, e);
        });
      }
    } catch (err: any) {
      setSteps(prev => ({
        ...prev,
        [stepId]: { status: "error", data: null, rawText: "", error: err.message },
      }));
    }
  }, [frameworkId, projectId]);

  const reset = useCallback(() => setSteps({}), []);

  return { steps, runStep, reset };
}
