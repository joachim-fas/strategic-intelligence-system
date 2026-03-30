"use client";

import { RadarInstance } from "@/lib/radar-store";
import { useLocale } from "@/lib/locale-context";

interface RadarSelectorProps {
  radars: RadarInstance[];
  activeRadarId: string;
  onSelect: (id: string) => void;
  onCreate: (presetId: string) => void;
  onDelete: (id: string) => void;
  presets: { id: string; name: string; description: string }[];
}

export default function RadarSelector({
  radars,
  activeRadarId,
  onSelect,
  onCreate,
  onDelete,
  presets,
}: RadarSelectorProps) {
  const { locale } = useLocale();
  const availablePresets = presets.filter(
    (p) => !radars.some((r) => r.id === p.id)
  );

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {/* Existing radars as tabs */}
      {radars.map((radar) => (
        <div key={radar.id} className="flex items-center gap-0 flex-shrink-0">
          <button
            onClick={() => onSelect(radar.id)}
            className={`px-3 py-1.5 rounded-l text-xs font-medium transition-colors whitespace-nowrap ${
              activeRadarId === radar.id
                ? "bg-blue-600 text-white"
                : "bg-[#1a1a1a] text-[#888] hover:text-white hover:bg-[#222]"
            }`}
          >
            {radar.name}
            <span className="ml-1.5 text-[10px] opacity-60">
              ({radar.trends.length})
            </span>
          </button>
          {radar.id !== "default" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(radar.id);
              }}
              className={`px-1.5 py-1.5 rounded-r text-xs transition-colors ${
                activeRadarId === radar.id
                  ? "bg-blue-700 text-blue-200 hover:text-white"
                  : "bg-[#1a1a1a] text-[#555] hover:text-red-400 hover:bg-[#222]"
              }`}
              title={locale === "de" ? "Radar entfernen" : "Remove radar"}
            >
              &times;
            </button>
          )}
        </div>
      ))}

      {/* Add new radar from presets */}
      {availablePresets.length > 0 && (
        <div className="relative group flex-shrink-0">
          <button className="px-3 py-1.5 rounded text-xs font-medium bg-[#111] border border-dashed border-[#333] text-[#555] hover:text-white hover:border-[#555] transition-colors">
            + {locale === "de" ? "Radar" : "Radar"}
          </button>
          <div className="absolute left-0 top-full mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl z-50 py-1 min-w-[240px] hidden group-hover:block">
            {availablePresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onCreate(preset.id)}
                className="w-full px-4 py-2.5 text-left hover:bg-[#222] transition-colors"
              >
                <div className="text-xs text-[#ccc] font-medium">{preset.name}</div>
                <div className="text-[10px] text-[#555] mt-0.5">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
