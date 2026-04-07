"use client";

import { TrendDot, RING_COLORS, TIME_HORIZON_COLORS, DURATION_CONFIG, DIRECTION_CONFIG, FOCUS_CONFIG, TrendClassification } from "@/types";
import { useLocale } from "@/lib/locale-context";
import { Locale } from "@/lib/i18n";
import { t, getRingLabel } from "@/lib/i18n";
import { getTrendSources, resolveSource, getTotalSourceCount, TrendSourceRef } from "@/lib/trend-sources";
import { autoClassify } from "@/lib/classify";
import { getDrivers, getEffects, getInhibitors, calculateCascadeDepth, TrendEdge } from "@/lib/causal-graph";
import { getRegulationsForTrend, getRegulatoryPressure } from "@/lib/regulations";
import { getClusterForTrend } from "@/lib/trend-clusters";
import { Tooltip } from "@/components/ui/Tooltip";

// ─── Grain pastel palette ──────────────────────────────────────────────
const RING_PASTEL: Record<string, { color: string; background: string }> = {
  adopt:  { color: "var(--pastel-mint-text, #0F6038)", background: "var(--pastel-mint, #C3F4D3)" },
  trial:  { color: "var(--pastel-sky-text, #1A4A8A)", background: "var(--pastel-sky, #D4E8FF)" },
  assess: { color: "var(--pastel-butter-text, #7A5C00)", background: "var(--pastel-butter, #FFF5BA)" },
  hold:   { color: "var(--volt-text-muted, #3A4560)", background: "var(--color-surface-2, #F0F2F7)" },
};

const SOURCE_CONTEXT: Record<string, { label: string; description: string }> = {
  hackernews:    { label: "Hacker News",    description: "Tech community discussions & project launches" },
  github:        { label: "GitHub",         description: "Repository activity, stars & contributor growth" },
  arxiv:         { label: "arXiv",          description: "Academic preprints & research publications" },
  news:          { label: "News",           description: "Mainstream media & industry press coverage" },
  reddit:        { label: "Reddit",         description: "Community sentiment & grassroots adoption signals" },
  producthunt:   { label: "Product Hunt",   description: "New product launches & early adopter interest" },
  stackoverflow: { label: "Stack Overflow", description: "Developer adoption & tooling questions" },
  google_trends: { label: "Google Trends",  description: "Search volume & regional interest patterns" },
  wikipedia:     { label: "Wikipedia",      description: "Reference depth & edit frequency as proxy for relevance" },
  npm_pypi:      { label: "npm / PyPI",     description: "Package downloads & dependency adoption" },
};

const SOURCE_ICONS: Record<string, string> = {
  hackernews: "🟠", github: "⚫", arxiv: "📄", news: "📰",
  reddit: "🔴", producthunt: "🟧", stackoverflow: "🟡",
  google_trends: "📈", wikipedia: "📚", npm_pypi: "📦",
  PwC: "🏢", EY: "🏢", "Roland Berger": "🏢", TRENDONE: "🔮",
  Zukunftsinstitut: "🔮", "EU ESPAS": "🇪🇺",
};

interface TrendDetailPanelProps {
  trend: TrendDot;
  onClose: () => void;
}

// ─── ScoreBar ─────────────────────────────────────────────────────────
function ScoreBar({ label, value, fillColor, trackColor, tooltip }: {
  label: string; value: number; fillColor: string; trackColor: string; tooltip?: string;
}) {
  const bar = (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[var(--volt-text-muted,#6B6B6B)] w-24 cursor-help">{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: trackColor }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value * 100}%`, background: fillColor }}
        />
      </div>
      <span className="text-xs font-mono w-10 text-right text-[var(--volt-text,#3A3A3A)]">{(value * 100).toFixed(0)}%</span>
    </div>
  );
  if (tooltip) return <Tooltip content={tooltip} placement="top">{bar}</Tooltip>;
  return bar;
}

// ─── RegulatorySection ────────────────────────────────────────────────
function RegulatorySection({ trendId, locale }: { trendId: string; locale: Locale }) {
  const regulations = getRegulationsForTrend(trendId);
  const pressure = getRegulatoryPressure(trendId);
  if (regulations.length === 0) return null;

  const effectStyle = {
    accelerates: { bg: "var(--pastel-mint, #C3F4D3)", color: "var(--pastel-mint-text, #0F6038)" },
    constrains:  { bg: "var(--pastel-rose, #FDEEE9)", color: "var(--signal-negative, #C0341D)" },
    reshapes:    { bg: "var(--pastel-butter, #FFF5BA)", color: "var(--pastel-butter-text, #7A5C00)" },
  };
  const effectLabels = {
    accelerates: { de: "beschleunigt", en: "accelerates" },
    constrains:  { de: "bremst",       en: "constrains" },
    reshapes:    { de: "formt um",     en: "reshapes" },
  };

  return (
    <div className="px-6 py-5 border-b border-[var(--volt-border,#E8E8E8)]">
      <h3 className="text-[10px] font-semibold text-[var(--volt-text-faint,#9B9B9B)] uppercase tracking-wider mb-3">
        {locale === "de" ? "⚖️ Regulatorisches Umfeld" : "⚖️ Regulatory Landscape"} ({regulations.length})
      </h3>

      <div className="flex gap-2 mb-3 flex-wrap">
        {pressure.accelerating > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "var(--pastel-mint, #C3F4D3)", color: "var(--pastel-mint-text, #0F6038)" }}>
            {locale === "de" ? "Beschleunigend" : "Accelerating"} {pressure.accelerating.toFixed(1)}
          </span>
        )}
        {pressure.constraining > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "var(--pastel-rose, #FDEEE9)", color: "var(--signal-negative, #C0341D)" }}>
            {locale === "de" ? "Bremsend" : "Constraining"} {pressure.constraining.toFixed(1)}
          </span>
        )}
        {pressure.reshaping > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "var(--pastel-butter, #FFF5BA)", color: "var(--pastel-butter-text, #7A5C00)" }}>
            {locale === "de" ? "Umformend" : "Reshaping"} {pressure.reshaping.toFixed(1)}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {regulations.map((reg) => {
          const impact = reg.impactedTrends.find((it) => it.trendId === trendId)!;
          const style = effectStyle[impact.effect];
          return (
            <div key={reg.id} className="flex items-start gap-2 text-xs">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-2,#F0F2F7)] text-[#3A4560] font-mono flex-shrink-0 mt-0.5">
                {reg.jurisdiction}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[var(--volt-text,#1A1A1A)] truncate">{reg.shortName}</div>
                <div className="text-[var(--volt-text-faint,#9B9B9B)] text-[10px] truncate">{reg.name}</div>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium"
                style={{ background: style.bg, color: style.color }}>
                {effectLabels[impact.effect][locale]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CausalGraphSection ───────────────────────────────────────────────
function CausalGraphSection({ trendId, locale }: { trendId: string; locale: Locale }) {
  const drivers    = getDrivers(trendId);
  const effects    = getEffects(trendId);
  const inhibitors = getInhibitors(trendId);
  const cascadeIds = calculateCascadeDepth(trendId);
  if (drivers.length === 0 && effects.length === 0 && inhibitors.length === 0) return null;

  const edgeStyle: Record<string, { dot: string; bg: string; text: string }> = {
    drives:     { dot: "var(--pastel-mint-text, #0F6038)", bg: "var(--pastel-mint, #C3F4D3)", text: "var(--pastel-mint-text, #0F6038)" },
    amplifies:  { dot: "var(--pastel-sky-text, #1A4A8A)", bg: "var(--pastel-sky, #D4E8FF)", text: "var(--pastel-sky-text, #1A4A8A)" },
    dampens:    { dot: "var(--signal-negative, #C0341D)", bg: "var(--pastel-rose, #FDEEE9)", text: "var(--signal-negative, #C0341D)" },
    correlates: { dot: "var(--pastel-butter-text, #7A5C00)", bg: "var(--pastel-butter, #FFF5BA)", text: "var(--pastel-butter-text, #7A5C00)" },
  };
  const edgeLabels: Record<string, Record<string, string>> = {
    drives:     { de: "treibt",        en: "drives" },
    amplifies:  { de: "verstärkt",     en: "amplifies" },
    dampens:    { de: "dämpft",        en: "dampens" },
    correlates: { de: "korreliert mit",en: "correlates with" },
  };

  function EdgeItem({ edge, direction }: { edge: TrendEdge; direction: "in" | "out" }) {
    const targetId = direction === "in" ? edge.from : edge.to;
    const label = targetId
      .replace(/^mega-/, "").replace(/^macro-/, "")
      .replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const s = edgeStyle[edge.type] ?? { dot: "var(--volt-text-faint, #9B9B9B)", bg: "var(--color-surface-2, #F0F2F7)", text: "var(--volt-text-muted, #6B6B6B)" };

    return (
      <div className="flex items-center gap-2 text-xs py-1">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
        <span className="text-[var(--volt-text,#3A3A3A)] flex-1 truncate">{label}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={{ background: s.bg, color: s.text }}>
          {edgeLabels[edge.type]?.[locale] || edge.type}
        </span>
        <span className="text-[10px] text-[var(--volt-text-faint,#9B9B9B)] w-8 text-right">
          {(edge.strength * 100).toFixed(0)}%
        </span>
      </div>
    );
  }

  return (
    <div className="px-6 py-5 border-b border-[var(--volt-border,#E8E8E8)]">
      <h3 className="text-[10px] font-semibold text-[var(--volt-text-faint,#9B9B9B)] uppercase tracking-wider mb-3">
        {locale === "de" ? "Vernetzung" : "Connections"}
      </h3>

      {cascadeIds.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg text-[11px]"
          style={{ background: "var(--pastel-sky, #EFF6FF)", color: "var(--pastel-sky-text, #1A4A8A)" }}>
          {locale === "de"
            ? `Systemische Reichweite: Beeinflusst ${cascadeIds.length} weitere Trends über bis zu 3 Ebenen`
            : `Systemic reach: Affects ${cascadeIds.length} other trends across up to 3 levels`}
        </div>
      )}

      {drivers.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] text-[var(--volt-text-faint,#9B9B9B)] uppercase tracking-wider mb-1">
            {locale === "de" ? "↑ Getrieben von" : "↑ Driven by"}
          </div>
          {drivers.map((e, i) => <EdgeItem key={i} edge={e} direction="in" />)}
        </div>
      )}

      {effects.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] text-[var(--volt-text-faint,#9B9B9B)] uppercase tracking-wider mb-1">
            {locale === "de" ? "↓ Beeinflusst" : "↓ Affects"}
          </div>
          {effects.map((e, i) => <EdgeItem key={i} edge={e} direction="out" />)}
        </div>
      )}

      {inhibitors.length > 0 && (
        <div>
          <div className="text-[10px] text-[var(--volt-text-faint,#9B9B9B)] uppercase tracking-wider mb-1">
            {locale === "de" ? "⊘ Gebremst von" : "⊘ Inhibited by"}
          </div>
          {inhibitors.map((e, i) => <EdgeItem key={i} edge={e} direction="in" />)}
        </div>
      )}
    </div>
  );
}

// ─── ClassificationSection ────────────────────────────────────────────
function ClassificationSection({ classification, locale }: { classification: TrendClassification; locale: Locale }) {
  const dur = DURATION_CONFIG[classification.duration];
  const dir = DIRECTION_CONFIG[classification.direction];

  return (
    <div className="px-6 py-5 border-b border-[var(--volt-border,#E8E8E8)]">
      <h3 className="text-[10px] font-semibold text-[var(--volt-text-faint,#9B9B9B)] uppercase tracking-wider mb-3">
        {locale === "de" ? "Klassifizierung" : "Classification"}
      </h3>

      <div className="space-y-3">
        {/* Duration & Reach */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--volt-text-muted,#6B6B6B)]">{locale === "de" ? "Dauer & Reichweite" : "Duration & Reach"}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
            style={{ background: dur.color + "18", color: dur.color }}>
            {dur.icon} {dur.label[locale]} · {classification.durationYears} {locale === "de" ? "J." : "yr"}
          </span>
        </div>

        {/* Direction */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--volt-text-muted,#6B6B6B)]">{locale === "de" ? "Veränderungsrichtung" : "Direction"}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
            style={{ background: dir.color + "18", color: dir.color }}>
            {dir.icon} {dir.label[locale]}
          </span>
        </div>

        {/* Momentum bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--volt-text-muted,#6B6B6B)] w-20">{locale === "de" ? "Momentum" : "Momentum"}</span>
          <div className="flex-1 h-1.5 bg-[var(--volt-border,#F0F0F0)] rounded-full overflow-hidden relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[var(--volt-border,#D0D0D0)]" />
            {classification.momentum >= 0 ? (
              <div className="absolute top-0 bottom-0 rounded-r-full"
                style={{ left: "50%", width: `${classification.momentum * 50}%`, background: "var(--pastel-mint-text, #0F6038)" }} />
            ) : (
              <div className="absolute top-0 bottom-0 rounded-l-full"
                style={{ right: "50%", width: `${Math.abs(classification.momentum) * 50}%`, background: "var(--signal-negative, #C0341D)" }} />
            )}
          </div>
          <span className="text-[10px] text-[var(--volt-text-faint,#9B9B9B)] w-8 text-right">
            {classification.momentum > 0 ? "+" : ""}{(classification.momentum * 100).toFixed(0)}
          </span>
        </div>

        {/* Focus areas */}
        <div>
          <span className="text-xs text-[var(--volt-text-muted,#6B6B6B)] block mb-1.5">{locale === "de" ? "Fokus" : "Focus"}</span>
          <div className="flex flex-wrap gap-1.5">
            {classification.focus.map((f) => {
              const fc = FOCUS_CONFIG[f];
              return (
                <span key={f} className="px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1"
                  style={{ background: fc.color + "15", color: fc.color }}>
                  {fc.icon} {fc.label[locale]}
                </span>
              );
            })}
          </div>
        </div>

        {/* Analysis Method */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--volt-text-muted,#6B6B6B)]">{locale === "de" ? "Analyse" : "Analysis"}</span>
          <div className="flex gap-1.5 ml-auto">
            {classification.analysisMethod.map((m) => (
              <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-2,#F0F2F7)] text-[#3A4560]">
                {m === "quantitative"
                  ? (locale === "de" ? "Quantitativ" : "Quantitative")
                  : m === "qualitative"
                  ? (locale === "de" ? "Qualitativ" : "Qualitative")
                  : (locale === "de" ? "Visuell" : "Visual")}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────
export default function TrendDetailPanel({ trend, onClose }: TrendDetailPanelProps) {
  const { locale } = useLocale();

  const authoritativeSources = getTrendSources(trend.tags);
  const isMegaMacro = trend.category === "Mega-Trend" || trend.category === "Makro-Trend";
  const classification = trend.classification || autoClassify(trend);
  const liveSources = (trend.topSources ?? []).filter((s) => !resolveSource(s));

  // Category badge style
  const categoryStyle =
    trend.category === "Mega-Trend" ? { bg: "var(--pastel-orchid-light, #FDE2FF)", color: "var(--pastel-orchid-text, #7C1A9E)" } :
    trend.category === "Makro-Trend" ? { bg: "var(--pastel-sky, #D4E8FF)", color: "var(--pastel-sky-text, #1A4A8A)" } :
    { bg: "var(--color-surface-2, #F0F2F7)", color: "var(--volt-text-muted, #3A4560)" };

  // Ring style
  const ringPastel = RING_PASTEL[trend.ring] ?? { color: "var(--volt-text-muted, #3A4560)", background: "var(--color-surface-2, #F0F2F7)" };

  return (
    <div
      className="fixed right-0 top-0 h-full w-[440px] border-l shadow-xl z-40 overflow-y-auto"
      style={{ background: "var(--color-surface, #FAFAFA)", borderColor: "var(--volt-border, #E8E8E8)" }}
    >
      {/* ── Sticky Header ── */}
      <div
        className="sticky top-0 z-10 px-6 py-4 border-b"
        style={{ background: "var(--volt-surface, #FFFFFF)", borderColor: "var(--volt-border, #E8E8E8)" }}
      >
        {/* Nav row */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs text-[var(--volt-text-muted,#6B6B6B)] hover:text-[var(--volt-text,#1A1A1A)] transition-colors"
          >
            ← {t(locale, "back")}
          </button>
          <div className="flex gap-1.5">
            <button className="px-3 py-1 text-xs rounded-full border border-[var(--volt-border,#E0E0E0)] text-[var(--volt-text-muted,#6B6B6B)] hover:border-[var(--volt-text,#1A1A1A)] hover:text-[var(--volt-text,#1A1A1A)] transition-colors bg-white">
              {t(locale, "edit")}
            </button>
            <button className="px-3 py-1 text-xs rounded-full border border-[var(--volt-border,#E0E0E0)] text-[var(--volt-text-muted,#6B6B6B)] hover:border-[var(--volt-text,#1A1A1A)] hover:text-[var(--volt-text,#1A1A1A)] transition-colors bg-white">
              {t(locale, "pin")}
            </button>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-lg font-semibold text-[var(--volt-text,#1A1A1A)] leading-tight">{trend.name}</h2>

        {/* Badge row */}
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          {/* Ring — with Volt tooltip */}
          <Tooltip content={locale === "de"
            ? trend.ring === "adopt" ? "Adopt: Sofort relevant, aktiv beobachten und einsetzen."
              : trend.ring === "trial" ? "Trial: Vielversprechend, erste Pilotprojekte sinnvoll."
              : trend.ring === "assess" ? "Assess: Beobachten, Relevanz fuer eigenen Kontext pruefen."
              : "Hold: Langfristig relevant, aber noch nicht handlungsrelevant."
            : trend.ring === "adopt" ? "Adopt: Immediately relevant, actively monitor and apply."
              : trend.ring === "trial" ? "Trial: Promising, pilot projects recommended."
              : trend.ring === "assess" ? "Assess: Monitor, evaluate relevance for own context."
              : "Hold: Long-term relevant, not yet actionable."
          } placement="bottom">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold cursor-help"
              style={{ background: ringPastel.background, color: ringPastel.color }}
            >
              {getRingLabel(locale, trend.ring)}
            </span>
          </Tooltip>

          {/* Category */}
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: categoryStyle.bg, color: categoryStyle.color }}
          >
            {trend.category}
          </span>

          {/* Cluster */}
          {(() => {
            const cluster = getClusterForTrend(trend.id);
            if (!cluster) return null;
            return (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: cluster.color + "18", color: cluster.color }}
              >
                {cluster.icon} {locale === "de" ? cluster.nameDe : cluster.name}
              </span>
            );
          })()}

          {/* Velocity with tooltip */}
          {trend.velocity === "rising" && (
            <Tooltip content={locale === "de" ? "Steigend: Relevanz hat in den letzten 30 Tagen zugenommen" : "Rising: Relevance increased over the last 30 days"} placement="bottom">
              <span className="text-xs font-medium cursor-help" style={{ color: "var(--pastel-mint-text, #0F6038)" }}>▲ {t(locale, "velocityRising")}</span>
            </Tooltip>
          )}
          {trend.velocity === "falling" && (
            <Tooltip content={locale === "de" ? "Fallend: Relevanz hat in den letzten 30 Tagen abgenommen" : "Falling: Relevance decreased over the last 30 days"} placement="bottom">
              <span className="text-xs font-medium cursor-help" style={{ color: "var(--signal-negative, #C0341D)" }}>▼ {t(locale, "velocityFalling")}</span>
            </Tooltip>
          )}
          {trend.velocity === "stable" && (
            <Tooltip content={locale === "de" ? "Stabil: Keine wesentliche Veraenderung in 30 Tagen" : "Stable: No significant change in 30 days"} placement="bottom">
              <span className="text-xs cursor-help text-[var(--volt-text-faint,#9B9B9B)]">— {t(locale, "stable")}</span>
            </Tooltip>
          )}
          {trend.userOverride && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: "var(--pastel-butter, #FFF5BA)", color: "var(--pastel-butter-text, #7A5C00)" }}>
              {t(locale, "manualOverride")}
            </span>
          )}
        </div>
      </div>

      {/* ── Description ── */}
      {trend.description && (
        <div className="px-6 py-4 border-b" style={{ borderColor: "var(--volt-border, #E8E8E8)" }}>
          <p className="text-sm text-[var(--volt-text,#3A3A3A)] leading-relaxed">{trend.description}</p>
        </div>
      )}

      {/* ── Scores ── */}
      <div className="px-6 py-5 border-b" style={{ borderColor: "var(--volt-border, #E8E8E8)" }}>
        <h3 className="text-[10px] font-semibold text-[var(--volt-text-faint,#9B9B9B)] uppercase tracking-wider mb-4">
          {t(locale, "scores")}
        </h3>
        <div className="space-y-3">
          <ScoreBar label={t(locale, "relevance")} value={trend.relevance} fillColor="var(--pastel-sky-border, #80B8F0)" trackColor="var(--pastel-sky-light, #EBF3FF)"
            tooltip={locale === "de" ? "Relevanz: Wie wichtig ist dieser Trend fuer strategische Entscheidungen (0-100%)" : "Relevance: How important is this trend for strategic decisions (0-100%)"} />
          <ScoreBar label={t(locale, "confidence")} value={trend.confidence} fillColor="var(--pastel-mint-border, #6FD99A)" trackColor="var(--pastel-mint-light, #E8FAF0)"
            tooltip={locale === "de" ? "Konfidenz: Wie sicher ist die Einschaetzung, basierend auf Quellenlage und Signalstaerke (0-100%)" : "Confidence: How certain is the assessment, based on source coverage and signal strength (0-100%)"} />
          <ScoreBar label={t(locale, "impact")} value={trend.impact} fillColor="var(--pastel-butter-border, #E0C840)" trackColor="var(--pastel-butter-light, #FFFAE5)"
            tooltip={locale === "de" ? "Impact: Potenzielle Auswirkung auf Wirtschaft, Gesellschaft oder Technologie (0-100%)" : "Impact: Potential effect on economy, society, or technology (0-100%)"} />
        </div>
        <div className="mt-4 flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--volt-border, #F0F0F0)" }}>
          <span className="text-xs text-[var(--volt-text-muted,#6B6B6B)]">{t(locale, "timeHorizon")}</span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              background: TIME_HORIZON_COLORS[trend.timeHorizon] + "18",
              color: TIME_HORIZON_COLORS[trend.timeHorizon],
            }}
          >
            {trend.timeHorizon === "short"
              ? t(locale, "horizonShort")
              : trend.timeHorizon === "mid"
              ? t(locale, "horizonMid")
              : t(locale, "horizonLong")}
          </span>
        </div>
      </div>

      {/* ── Classification ── */}
      <ClassificationSection classification={classification} locale={locale} />

      {/* ── Connections ── */}
      <CausalGraphSection trendId={trend.id} locale={locale} />

      {/* ── Research Sources ── */}
      {isMegaMacro && authoritativeSources.length > 0 && (
        <div className="px-6 py-5 border-b" style={{ borderColor: "var(--volt-border, #E8E8E8)" }}>
          <h3 className="text-[10px] font-semibold text-[var(--volt-text-faint,#9B9B9B)] uppercase tracking-wider mb-3">
            {locale === "de" ? "Forschungsquellen" : "Research Sources"} ({authoritativeSources.length}/{getTotalSourceCount()})
          </h3>
          <div className="space-y-1">
            {authoritativeSources.map((src: TrendSourceRef) => (
              <a
                key={src.url}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 text-sm group rounded-lg p-2 -mx-2 transition-colors hover:bg-[var(--volt-border,#F0F0F0)]"
              >
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5"
                  style={{ background: "var(--pastel-sky, #D4E8FF)", color: "var(--pastel-sky-text, #1A4A8A)" }}
                >
                  {src.shortName}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[var(--volt-text,#1A1A1A)] text-xs font-medium truncate group-hover:text-[var(--pastel-sky-text,#1A4A8A)] transition-colors">
                    {src.name}
                  </div>
                  <div className="text-[var(--volt-text-faint,#9B9B9B)] text-[10px] mt-0.5">{src.description}</div>
                </div>
                <span className="text-[var(--volt-text-faint,#C0C0C0)] text-sm ml-auto flex-shrink-0 group-hover:text-[var(--pastel-sky-text,#1A4A8A)] transition-colors">↗</span>
              </a>
            ))}
          </div>
          <div className="mt-3 px-3 py-2 rounded-lg text-[11px]" style={{ background: "var(--pastel-sky, #EFF6FF)", color: "var(--pastel-sky-text, #1A4A8A)" }}>
            {locale === "de"
              ? `Belegt durch ${authoritativeSources.length} von ${getTotalSourceCount()} autoritativen Quellen — mehr Abdeckung erhöht das Vertrauen.`
              : `Cited by ${authoritativeSources.length} of ${getTotalSourceCount()} authoritative sources — broader coverage increases confidence.`}
          </div>
        </div>
      )}

      {/* ── Regulatory Landscape ── */}
      <RegulatorySection trendId={trend.id} locale={locale} />

      {/* ── Live Signals ── */}
      <div className="px-6 py-5 border-b" style={{ borderColor: "var(--volt-border, #E8E8E8)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-semibold text-[var(--volt-text-faint,#9B9B9B)] uppercase tracking-wider">
            {locale === "de" ? "Live-Signale" : "Live Signals"}
          </h3>
          {trend.signalCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "var(--volt-lime, #E4FF97)", color: "var(--volt-text, #0A0A0A)" }}>
              {trend.signalCount.toLocaleString()} {t(locale, "signals")}
            </span>
          )}
        </div>

        {liveSources.length > 0 ? (
          <div className="space-y-2.5">
            {liveSources.map((source) => {
              const ctx = SOURCE_CONTEXT[source];
              const icon = SOURCE_ICONS[source] || "📊";
              return (
                <div key={source} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: "var(--color-surface-2, #F5F5F5)" }}>
                  <span className="text-base leading-none mt-0.5 flex-shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[var(--volt-text,#1A1A1A)]">
                      {ctx?.label ?? source.charAt(0).toUpperCase() + source.slice(1)}
                    </div>
                    {ctx?.description && (
                      <div className="text-[10px] text-[var(--volt-text-faint,#9B9B9B)] mt-0.5 leading-relaxed">{ctx.description}</div>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--volt-text-faint,#9B9B9B)] flex-shrink-0 mt-0.5">aktiv</span>
                </div>
              );
            })}
          </div>
        ) : (
          /* Derive relevant connectors from category + tags */
          <div>
            {(() => {
              // Map trend category & tags to relevant live connectors
              const tagSet = new Set(trend.tags.map((t) => t.toLowerCase()));
              const cat = trend.category;
              const suggestedConnectors: string[] = [];

              if (tagSet.has("technology") || tagSet.has("frontier-tech") || tagSet.has("ai") || tagSet.has("software") || cat === "Mega-Trend") {
                suggestedConnectors.push("hackernews", "github", "arxiv");
              }
              if (tagSet.has("climate") || tagSet.has("energy") || tagSet.has("sustainability") || tagSet.has("net-zero")) {
                suggestedConnectors.push("news", "google_trends");
              }
              if (tagSet.has("geopolitics") || tagSet.has("policy") || tagSet.has("economy") || tagSet.has("social")) {
                suggestedConnectors.push("news", "reddit");
              }
              if (tagSet.has("software") || tagSet.has("developer") || tagSet.has("programming")) {
                suggestedConnectors.push("stackoverflow", "npm_pypi");
              }
              if (suggestedConnectors.length === 0) {
                suggestedConnectors.push("news", "google_trends");
              }
              const unique = [...new Set(suggestedConnectors)].slice(0, 4);

              return (
                <div className="space-y-2.5">
                  {unique.map((source) => {
                    const ctx = SOURCE_CONTEXT[source];
                    const icon = SOURCE_ICONS[source] || "📊";
                    return (
                      <div key={source} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: "var(--color-surface-2, #F5F5F5)" }}>
                        <span className="text-base leading-none mt-0.5 flex-shrink-0">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-[var(--volt-text,#1A1A1A)]">
                            {ctx?.label ?? source}
                          </div>
                          {ctx?.description && (
                            <div className="text-[10px] text-[var(--volt-text-faint,#9B9B9B)] mt-0.5 leading-relaxed">{ctx.description}</div>
                          )}
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: "var(--color-surface-2, #F0F2F7)", color: "var(--volt-text-faint, #9B9B9B)" }}>
                          {locale === "de" ? "verfügbar" : "available"}
                        </span>
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-[var(--volt-text-faint,#9B9B9B)] pt-1 leading-relaxed">
                    {locale === "de"
                      ? "Live-Daten werden beim nächsten Connector-Lauf geladen. Starte mit /live."
                      : "Live data loads on the next connector run. Trigger with /live."}
                  </p>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Tags ── */}
      <div className="px-6 py-5 border-b" style={{ borderColor: "var(--volt-border, #E8E8E8)" }}>
        <h3 className="text-[10px] font-semibold text-[var(--volt-text-faint,#9B9B9B)] uppercase tracking-wider mb-3">
          {t(locale, "tags")}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {trend.tags
            .filter((tag) => !resolveSource(tag))
            .map((tag) => {
              const style =
                tag === "mega-trend"  ? { bg: "var(--pastel-orchid-light, #FDE2FF)", color: "var(--pastel-orchid-text, #7C1A9E)", border: "var(--pastel-orchid-border, #D4A0F0)" } :
                tag === "makro-trend" ? { bg: "var(--pastel-sky, #D4E8FF)", color: "var(--pastel-sky-text, #1A4A8A)", border: "var(--pastel-sky-border, #80B8F0)" } :
                                        { bg: "var(--color-surface-2, #F0F2F7)", color: "var(--volt-text-muted, #6B6B6B)", border: "var(--volt-border, #E0E0E0)" };
              // STEEP+V tooltip explanations
              const steepTooltips: Record<string, string> = locale === "de" ? {
                technology: "Technological: Technologische Entwicklungen und Innovationen",
                social: "Social: Gesellschaftliche und demografische Veraenderungen",
                economic: "Economic: Wirtschaftliche Dynamiken und Marktverschiebungen",
                environmental: "Environmental: Umwelt, Klima und Ressourcen",
                political: "Political: Regulierung, Governance und geopolitische Entwicklungen",
                values: "Values: Wertewandel und kulturelle Verschiebungen",
                "frontier-tech": "Frontier Tech: Emerging Technologies an der Grenze des Machbaren",
                "net-zero": "Net Zero: Dekarbonisierung und Klimaneutralitaet",
                geopolitics: "Geopolitik: Internationale Machtverschiebungen",
              } : {
                technology: "Technological: Tech developments and innovations",
                social: "Social: Societal and demographic changes",
                economic: "Economic: Market dynamics and economic shifts",
                environmental: "Environmental: Climate, resources, sustainability",
                political: "Political: Regulation, governance, geopolitics",
                values: "Values: Cultural shifts and changing value systems",
                "frontier-tech": "Frontier Tech: Emerging technologies at the edge",
                "net-zero": "Net Zero: Decarbonization and climate neutrality",
                geopolitics: "Geopolitics: International power shifts",
              };
              const tip = steepTooltips[tag.toLowerCase()];
              const badge = (
                <span
                  key={tag}
                  className={`px-2.5 py-0.5 rounded-full text-xs border ${tip ? "cursor-help" : ""}`}
                  style={{ background: style.bg, color: style.color, borderColor: style.border }}
                >
                  {tag}
                </span>
              );
              return tip ? <Tooltip key={tag} content={tip} placement="top">{badge}</Tooltip> : badge;
            })}
        </div>
      </div>

      {/* ── L3: Actions Bar ── */}
      <div className="px-6 py-5">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Primary: Ask about this trend */}
          <a
            href={`/?q=${encodeURIComponent(locale === "de" ? `Deep Dive: ${trend.name} — Treiber, Signale, Szenarien` : `Deep dive: ${trend.name} — drivers, signals, scenarios`)}`}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              width: "100%", padding: "10px 16px",
              borderRadius: 10,
              background: "var(--volt-lime, #E4FF97)", color: "var(--volt-text, #0A0A0A)",
              fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
              fontSize: 13, fontWeight: 600,
              textDecoration: "none",
              transition: "transform 150ms ease",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            {locale === "de" ? "Frage stellen" : "Ask question"} →
          </a>

          {/* Secondary row */}
          <div style={{ display: "flex", gap: 8 }}>
            {/* Deep dive */}
            <a
              href={`/cockpit/${trend.id}`}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                padding: "8px 12px", borderRadius: 8,
                border: "1px solid var(--volt-border, #E8E8E8)",
                background: "var(--volt-surface, #FFFFFF)",
                color: "var(--volt-text, #0A0A0A)",
                fontSize: 12, fontWeight: 500, textDecoration: "none",
                fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                transition: "all 150ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--volt-text, #0A0A0A)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--volt-border, #E8E8E8)"; }}
            >
              ↓ {locale === "de" ? "Vertiefen" : "Deep dive"}
            </a>

            {/* Save to project */}
            <button
              onClick={() => {
                const projectId = typeof window !== "undefined" ? localStorage.getItem("sis-active-project") : null;
                if (projectId) {
                  fetch(`/api/v1/projects/${projectId}/queries`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: `Trend: ${trend.name}`, result: { synthesis: `${trend.name} — ${trend.category}, ${trend.ring}, Relevanz ${Math.round(trend.relevance * 100)}%` } }),
                  });
                } else {
                  window.location.href = "/werkstatt";
                }
              }}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                padding: "8px 12px", borderRadius: 8,
                border: "1px solid var(--volt-border, #E8E8E8)",
                background: "var(--volt-surface, #FFFFFF)",
                color: "var(--volt-text, #0A0A0A)",
                fontSize: 12, fontWeight: 500, cursor: "pointer",
                fontFamily: "var(--volt-font-ui, 'DM Sans', sans-serif)",
                transition: "all 150ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--volt-text, #0A0A0A)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--volt-border, #E8E8E8)"; }}
            >
              📁 {locale === "de" ? "Zum Projekt" : "To project"}
            </button>
          </div>
        </div>

        {/* All authoritative sources with links */}
        {authoritativeSources.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4 className="text-[10px] font-semibold text-[var(--volt-text-faint,#9B9B9B)] uppercase tracking-wider mb-2">
              {locale === "de" ? "Alle Quellen" : "All Sources"} ({authoritativeSources.length})
            </h4>
            <div className="space-y-1">
              {authoritativeSources.map((src) => (
                <a
                  key={src.shortName}
                  href={src.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs py-1 hover:underline"
                  style={{ color: src.url ? "var(--pastel-sky-text, #1A4A8A)" : "var(--volt-text-faint, #9B9B9B)", textDecoration: "none" }}
                >
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: src.url ? "var(--pastel-sky-text, #1A4A8A)" : "var(--volt-border, #D0D0D0)", flexShrink: 0 }} />
                  {src.shortName}
                  {src.url && <span style={{ fontSize: 9, color: "var(--volt-text-faint, #C0C0C0)" }}>↗</span>}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
