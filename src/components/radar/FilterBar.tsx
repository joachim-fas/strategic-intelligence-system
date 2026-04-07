"use client";

import { Ring } from "@/types";
import { useLocale } from "@/lib/locale-context";
import { t, getRingLabel } from "@/lib/i18n";

export interface Filters {
  timeHorizon: "short" | "mid" | "long" | "all";
  ring: Ring | "all";
  trendType: "all" | "Mega-Trend" | "Makro-Trend" | "other";
  minConfidence: number;
  searchQuery: string;
  category: string;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  categories: string[];
  trendCount: number;
}

const selectStyle: React.CSSProperties = {
  background: "var(--color-surface, #FAFAFA)",
  border: "1px solid var(--volt-border, #E8E8E8)",
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 13,
  color: "var(--volt-text, #1A1A1A)",
  outline: "none",
  cursor: "pointer",
};

export default function FilterBar({ filters, onChange, categories, trendCount }: FilterBarProps) {
  const { locale } = useLocale();
  const update = (partial: Partial<Filters>) => onChange({ ...filters, ...partial });

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
      padding: "10px 16px",
      background: "var(--volt-surface, #FFFFFF)",
      border: "1px solid var(--volt-border, #E8E8E8)",
      borderRadius: 12,
    }}>
      <input
        type="text"
        placeholder={t(locale, "searchTrends")}
        value={filters.searchQuery}
        onChange={(e) => update({ searchQuery: e.target.value })}
        style={{
          ...selectStyle,
          width: 192,
          boxSizing: "border-box",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--volt-text, #1A1A1A)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--volt-border, #E8E8E8)"; }}
      />

      <select
        value={filters.timeHorizon}
        onChange={(e) => update({ timeHorizon: e.target.value as Filters["timeHorizon"] })}
        style={selectStyle}
      >
        <option value="all">{t(locale, "allHorizons")}</option>
        <option value="short">{t(locale, "shortTerm")}</option>
        <option value="mid">{t(locale, "midTerm")}</option>
        <option value="long">{t(locale, "longTerm")}</option>
      </select>

      <select
        value={filters.ring}
        onChange={(e) => update({ ring: e.target.value as Ring | "all" })}
        style={selectStyle}
      >
        <option value="all">{t(locale, "allRings")}</option>
        {(["adopt", "trial", "assess", "hold"] as Ring[]).map((r) => (
          <option key={r} value={r}>{getRingLabel(locale, r)}</option>
        ))}
      </select>

      <select
        value={filters.trendType}
        onChange={(e) => update({ trendType: e.target.value as Filters["trendType"] })}
        style={selectStyle}
      >
        <option value="all">{locale === "de" ? "Alle Typen" : "All Types"}</option>
        <option value="Mega-Trend">Mega-Trends</option>
        <option value="Makro-Trend">Makro-Trends</option>
        <option value="other">{locale === "de" ? "Spezifische Trends" : "Specific Trends"}</option>
      </select>

      <select
        value={filters.category}
        onChange={(e) => update({ category: e.target.value })}
        style={selectStyle}
      >
        <option value="all">{t(locale, "allCategories")}</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "var(--volt-text-faint, #9B9B9B)" }}>{t(locale, "minConfidence")}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={filters.minConfidence * 100}
          onChange={(e) => update({ minConfidence: Number(e.target.value) / 100 })}
          style={{ width: 80, accentColor: "var(--volt-text, #0A0A0A)" }}
        />
        <span style={{ fontSize: 11, color: "var(--volt-text-muted, #6B6B6B)", width: 32 }}>{(filters.minConfidence * 100).toFixed(0)}%</span>
      </div>

      <button
        onClick={() =>
          onChange({
            timeHorizon: "all",
            ring: "all",
            trendType: "all",
            minConfidence: 0,
            searchQuery: "",
            category: "all",
          })
        }
        style={{
          marginLeft: "auto", fontSize: 12, color: "var(--volt-text-faint, #9B9B9B)",
          background: "none", border: "none", cursor: "pointer", padding: 0,
        }}
        onMouseOver={(e) => { e.currentTarget.style.color = "var(--volt-text, #1A1A1A)"; }}
        onMouseOut={(e) => { e.currentTarget.style.color = "var(--volt-text-faint, #9B9B9B)"; }}
      >
        {t(locale, "reset")}
      </button>

      <span style={{ fontSize: 11, color: "var(--volt-text-faint, #9B9B9B)" }}>
        {trendCount} {t(locale, "trends")}
      </span>
    </div>
  );
}
