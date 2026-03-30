import { TrendDot } from "@/types";

/**
 * Export trends as CSV
 */
export function exportCSV(trends: TrendDot[], filename = "sis-export.csv") {
  const headers = [
    "Name", "Category", "Ring", "Relevance", "Confidence", "Impact",
    "Time Horizon", "Velocity", "Signal Count", "Top Sources", "Tags",
  ];

  const rows = trends.map((t) => [
    `"${t.name}"`,
    `"${t.category}"`,
    t.ring,
    (t.relevance * 100).toFixed(1),
    (t.confidence * 100).toFixed(1),
    (t.impact * 100).toFixed(1),
    t.timeHorizon,
    t.velocity,
    t.signalCount.toString(),
    `"${t.topSources.join(", ")}"`,
    `"${t.tags.join(", ")}"`,
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadFile(csv, filename, "text/csv");
}

/**
 * Export trends as JSON
 */
export function exportJSON(trends: TrendDot[], filename = "sis-export.json") {
  const json = JSON.stringify(trends, null, 2);
  downloadFile(json, filename, "application/json");
}

/**
 * Export the radar SVG as a file
 */
export function exportSVG(svgElement: SVGSVGElement | null, filename = "sis.svg") {
  if (!svgElement) return;

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const svgWithHeader = `<?xml version="1.0" encoding="UTF-8"?>\n${svgString}`;
  downloadFile(svgWithHeader, filename, "image/svg+xml");
}

/**
 * Export radar as PNG
 */
export function exportPNG(svgElement: SVGSVGElement | null, filename = "sis.png") {
  if (!svgElement) return;

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const img = new Image();
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    canvas.width = img.width * 2; // 2x for retina
    canvas.height = img.height * 2;
    ctx.scale(2, 2);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  };
  img.src = url;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
