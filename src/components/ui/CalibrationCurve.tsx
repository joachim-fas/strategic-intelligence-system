"use client";

/**
 * CalibrationCurve — decile-bucketed calibration chart.
 *
 * Welle C Item 3 follow-up. Renders the shape
 * `GET /api/v1/forecasts/calibration/[userId]` returns: 10 decile
 * buckets of (bucketMid, observedRate, count) against the y=x
 * reference diagonal. Deviation from the diagonal = calibration
 * error.
 *
 * Pure SVG, no D3. Sized via props so callers control layout; the
 * default 220×220 is the minimum that keeps the axis labels legible
 * without getting in the way of a two-pane layout.
 *
 * Didactic copy strategy (Manifold-verified lesson from the Deep-
 * Dive): calibration is abstract, so we render:
 *   - The y=x diagonal in a muted grey.
 *   - The user's points sized by count (bigger dot = more
 *     predictions in that bucket = higher weight in the mean Brier).
 *   - A short subtitle under the chart explaining what the distance
 *     to the diagonal means.
 * Without those three pieces, the chart is too abstract to be
 * useful on its own.
 */

import React from "react";
import { t as translate, type Locale, type TranslationKey } from "@/lib/i18n";

export interface CalibrationBucketDto {
  bucketMid: number;
  count: number;
  observedRate: number | null;
}

export interface CalibrationCurveProps {
  /** The `getCalibrationSummary` return shape minus the summary
   *  wrapper — just the buckets and the total count. */
  buckets: CalibrationBucketDto[];
  totalResolved: number;
  meanBrier: number | null;
  /** Whether to render in German. Defaults to true. */
  de?: boolean;
  /** Pixel dimensions. Minimum is ~200 before axis labels collide. */
  size?: number;
}

export function CalibrationCurve({
  buckets,
  totalResolved,
  meanBrier,
  de = true,
  size = 220,
}: CalibrationCurveProps) {
  const locale: Locale = de ? "de" : "en";
  const tl = (key: TranslationKey) => translate(locale, key);

  const pad = 32;
  const chartSize = size - pad * 2;

  // Points that actually have data (null observedRate = empty bucket
  // we still reserve visually but don't plot).
  const pts = buckets
    .filter((b) => b.observedRate != null && b.count > 0)
    .map((b) => ({
      x: b.bucketMid,
      y: b.observedRate as number,
      count: b.count,
    }));

  const maxCount = pts.reduce((m, p) => Math.max(m, p.count), 1);
  // Bubble radius scaled 3–9 px by log(count) so a bucket with 20
  // predictions doesn't completely dwarf one with 3.
  const radius = (count: number) => {
    if (maxCount <= 1) return 4;
    const t = Math.log(1 + count) / Math.log(1 + maxCount);
    return 3 + t * 6;
  };

  const toSvgX = (x: number) => pad + x * chartSize;
  const toSvgY = (y: number) => size - pad - y * chartSize;

  if (totalResolved === 0) {
    return (
      <div style={{
        padding: "24px 20px", textAlign: "center" as const,
        fontSize: 12, color: "var(--color-text-muted)",
        border: "1px dashed var(--color-border)", borderRadius: 8,
      }}>
        {tl("calibration.noPredictions")}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)" }}>
      {/* Summary header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        fontSize: 12, marginBottom: 8,
      }}>
        <span style={{ color: "var(--color-text-muted)" }}>
          {tl("calibration.predictions")}
        </span>
        <strong>{totalResolved}</strong>
        <span style={{ color: "var(--color-text-muted)", marginLeft: 8 }}>
          {tl("calibration.meanBrier")}
        </span>
        <strong>{meanBrier != null ? meanBrier.toFixed(3) : "—"}</strong>
      </div>

      <svg width={size} height={size} style={{ display: "block" }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line
              x1={toSvgX(g)} y1={toSvgY(0)}
              x2={toSvgX(g)} y2={toSvgY(1)}
              stroke="var(--color-border, #E8E8E8)" strokeWidth={0.5}
            />
            <line
              x1={toSvgX(0)} y1={toSvgY(g)}
              x2={toSvgX(1)} y2={toSvgY(g)}
              stroke="var(--color-border, #E8E8E8)" strokeWidth={0.5}
            />
          </g>
        ))}

        {/* y=x reference diagonal — perfectly-calibrated predictor */}
        <line
          x1={toSvgX(0)} y1={toSvgY(0)}
          x2={toSvgX(1)} y2={toSvgY(1)}
          stroke="var(--color-text-muted, #737373)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />

        {/* Axis labels */}
        <text
          x={pad - 8} y={toSvgY(0.5)}
          fontSize={9} fontFamily="var(--volt-font-mono, 'JetBrains Mono')"
          fill="var(--color-text-muted)"
          textAnchor="end" dominantBaseline="middle"
          transform={`rotate(-90 ${pad - 8} ${toSvgY(0.5)})`}
        >
          {tl("calibration.axisObserved")}
        </text>
        <text
          x={toSvgX(0.5)} y={size - 6}
          fontSize={9} fontFamily="var(--volt-font-mono, 'JetBrains Mono')"
          fill="var(--color-text-muted)"
          textAnchor="middle"
        >
          {tl("calibration.axisPredicted")}
        </text>

        {/* Corner labels */}
        {[0, 0.5, 1].map((v) => (
          <React.Fragment key={v}>
            <text
              x={toSvgX(v)} y={size - pad + 11}
              fontSize={8} fontFamily="var(--volt-font-mono, 'JetBrains Mono')"
              fill="var(--color-text-faint)" textAnchor="middle"
            >
              {v.toFixed(1)}
            </text>
            <text
              x={pad - 3} y={toSvgY(v) + 3}
              fontSize={8} fontFamily="var(--volt-font-mono, 'JetBrains Mono')"
              fill="var(--color-text-faint)" textAnchor="end"
            >
              {v.toFixed(1)}
            </text>
          </React.Fragment>
        ))}

        {/* Connecting polyline in predicted-order to hint at the
             curve shape. Only when ≥2 points. */}
        {pts.length >= 2 && (
          <polyline
            points={pts.sort((a, b) => a.x - b.x)
              .map((p) => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(" ")}
            fill="none"
            stroke="var(--volt-text, #0A0A0A)"
            strokeWidth={1.5}
            strokeOpacity={0.5}
          />
        )}

        {/* Data points — bubble size scales with bucket count. */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle
              cx={toSvgX(p.x)} cy={toSvgY(p.y)}
              r={radius(p.count)}
              fill="#E4FF97"
              stroke="var(--volt-text, #0A0A0A)"
              strokeWidth={1}
            >
              <title>
                {de
                  ? `Bucket ${(p.x * 100).toFixed(0)}%: ${p.count} Vorhersagen, ${(p.y * 100).toFixed(0)}% tatsächlich YES`
                  : `Bucket ${(p.x * 100).toFixed(0)}%: ${p.count} predictions, ${(p.y * 100).toFixed(0)}% actual YES`}
              </title>
            </circle>
          </g>
        ))}
      </svg>

      {/* Didactic caption */}
      <p style={{
        fontSize: 11, lineHeight: 1.5, margin: "10px 0 0",
        color: "var(--color-text-muted)",
      }}>
        {de
          ? "Perfekt kalibriert = Punkte liegen auf der Diagonale. Über der Linie: zu pessimistisch. Darunter: zu optimistisch. Punktgröße = Anzahl Vorhersagen im Bucket."
          : "Perfectly calibrated = points sit on the diagonal. Above the line: under-confident. Below: over-confident. Bubble size = number of predictions in that bucket."}
      </p>
    </div>
  );
}

export default CalibrationCurve;
