/**
 * Sidebar Component — Premium Analytics Panel
 * Displays national summary with rich visuals, or detailed LGA analytics.
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { RISK_COLORS } from '../types';
import type { HotspotFeature, Stats, RiskLevel } from '../types';

interface SidebarProps {
  stats: Stats | null;
  selectedLGA: HotspotFeature | null;
  onClose?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Small coloured icon per risk level */
const riskIcon = (level: string) => {
  const icons: Record<string, string> = {
    High: '🔴',
    Medium: '🟡',
    Low: '🟢',
    Minimal: '🔵',
  };
  return icons[level] ?? '⚪';
};

/** Human-friendly risk description */
const riskDescription = (level: string) => {
  const desc: Record<string, string> = {
    High: 'Severe poverty indicators. Immediate intervention required.',
    Medium: 'Significant deprivation. Targeted support recommended.',
    Low: 'Moderate vulnerability. Monitoring & prevention needed.',
    Minimal: 'Relatively stable. Maintenance programs in place.',
  };
  return desc[level] ?? '';
};

const Sidebar: React.FC<SidebarProps> = ({ stats, selectedLGA, onClose }) => {
  /* ---------- Pie data ---------- */
  const getPieData = () => {
    if (!stats) return [];
    return [
      { name: 'High Risk', value: stats.riskDistribution.high, color: RISK_COLORS.High },
      { name: 'Medium Risk', value: stats.riskDistribution.medium, color: RISK_COLORS.Medium },
      { name: 'Low Risk', value: stats.riskDistribution.low, color: RISK_COLORS.Low },
      { name: 'Minimal Risk', value: stats.riskDistribution.minimal, color: RISK_COLORS.Minimal },
    ];
  };

  /** Pie chart custom label — short, inside-safe */
  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: {
    cx: number;
    cy: number;
    midAngle?: number;
    innerRadius: number;
    outerRadius: number;
    percent?: number;
  }) => {
    if (midAngle === undefined) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if ((percent ?? 0) < 0.05) return null; // hide tiny slices

    return (
      <text
        x={x}
        y={y}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontWeight={700}
        fontSize={13}
        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
      >
        {`${((percent ?? 0) * 100).toFixed(0)}%`}
      </text>
    );
  };

  /** Poverty probability gauge */
  const calculatePovertyProbability = (mpi: number, nightlight: number): number => {
    const mpiScore = Math.min(mpi * 100, 100);
    const nightlightScore = Math.max(0, 100 - (nightlight / 60) * 100);
    const probability = mpiScore * 0.7 + nightlightScore * 0.3;
    return Math.min(Math.max(probability, 0), 100);
  };

  /* ---------- Gauge colour helper ---------- */
  const gaugeColor = (p: number) => {
    if (p >= 70) return '#ef4444';
    if (p >= 45) return '#f59e0b';
    if (p >= 20) return '#10b981';
    return '#3b82f6';
  };

  /* ================================================================ */
  /*  National Summary                                                 */
  /* ================================================================ */
  const renderNationalSummary = () => {
    if (!stats) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mx-auto mb-4" />
            <p className="text-white/60 text-sm">Loading statistics…</p>
          </div>
        </div>
      );
    }

    const pieData = getPieData();
    const total = stats.totalLGAs;

    return (
      <div className="space-y-5 fade-in-up">
        {/* ── Header ── */}
        <div className="pb-4 border-b border-indigo-500/15">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/30 ring-1 ring-white/10">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold gradient-text tracking-tight">National Overview</h2>
              <p className="text-white/40 text-xs font-medium tracking-wide uppercase">
                Poverty Hotspot Distribution — Nigeria
              </p>
            </div>
          </div>
        </div>

        {/* ── Key Metrics Grid ── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total LGAs */}
          <div className="glass-card rounded-2xl p-4 shimmer ring-1 ring-indigo-500/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/30 to-indigo-600/10 flex items-center justify-center ring-1 ring-indigo-400/20">
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-white/50 text-[10px] font-semibold uppercase tracking-widest">LGAs</span>
            </div>
            <div className="text-2xl font-extrabold text-white animate-count">{stats.totalLGAs}</div>
            <div className="text-white/30 text-[10px] mt-1">Local Govt. Areas tracked</div>
          </div>

          {/* States */}
          <div className="glass-card rounded-2xl p-4 shimmer ring-1 ring-cyan-500/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/30 to-cyan-600/10 flex items-center justify-center ring-1 ring-cyan-400/20">
                <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span className="text-white/50 text-[10px] font-semibold uppercase tracking-widest">States</span>
            </div>
            <div className="text-2xl font-extrabold text-white animate-count">{stats.statesCount}</div>
            <div className="text-white/30 text-[10px] mt-1">Federal states covered</div>
          </div>

          {/* Avg MPI */}
          <div className="glass-card rounded-2xl p-4 shimmer ring-1 ring-amber-500/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/30 to-amber-600/10 flex items-center justify-center ring-1 ring-amber-400/20">
                <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-white/50 text-[10px] font-semibold uppercase tracking-widest">Avg MPI</span>
            </div>
            <div className="text-2xl font-extrabold text-white animate-count">{stats.averageMPI}</div>
            <div className="text-white/30 text-[10px] mt-1">Multidimensional Poverty Index</div>
          </div>

          {/* Avg Nightlight */}
          <div className="glass-card rounded-2xl p-4 shimmer ring-1 ring-emerald-500/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/30 to-emerald-600/10 flex items-center justify-center ring-1 ring-emerald-400/20">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="text-white/50 text-[10px] font-semibold uppercase tracking-widest">Nightlight</span>
            </div>
            <div className="text-2xl font-extrabold text-white animate-count">{stats.averageNightlight}</div>
            <div className="text-white/30 text-[10px] mt-1">VIIRS mean radiance</div>
          </div>
        </div>

        {/* ── Risk Distribution — Pie ── */}
        <div className="glass-card rounded-2xl p-5 ring-1 ring-indigo-500/10">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-indigo-200 tracking-wide">Risk Distribution</h3>
            <span className="text-[10px] text-white/30 font-mono">{total} total</span>
          </div>
          <p className="text-white/30 text-[10px] mb-4">
            K-Means clustering based on nightlight intensity &amp; MPI score
          </p>

          <div className="flex items-center gap-4">
            {/* Donut chart — fixed width prevents overflow */}
            <div className="w-[140px] h-[140px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={64}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                    labelLine={false}
                    label={renderCustomLabel}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15,23,42,0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      color: '#f1f5f9',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                    itemStyle={{ color: '#f1f5f9' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend beside chart */}
            <div className="flex-1 space-y-2">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-white/70 text-[11px] truncate flex-1">{item.name}</span>
                  <span className="text-white font-bold text-xs tabular-nums">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Detailed Breakdown — Bars ── */}
        <div className="glass-card rounded-2xl p-5 ring-1 ring-purple-500/10">
          <h3 className="text-sm font-bold text-purple-200 tracking-wide mb-1">Detailed Breakdown</h3>
          <p className="text-white/30 text-[10px] mb-4">LGA count per risk category with relative share</p>

          <div className="space-y-4">
            {getPieData().map((item) => {
              const pct = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{riskIcon(item.name.split(' ')[0])}</span>
                      <span className="text-white/80 text-xs font-semibold">{item.name}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-white font-extrabold text-sm tabular-nums">{item.value}</span>
                      <span className="text-white/40 text-[10px] font-mono">({pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${item.color}, ${item.color}cc)`,
                        boxShadow: `0 0 8px ${item.color}66`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Data Source Footer ── */}
        <div className="glass-card rounded-2xl p-4 ring-1 ring-cyan-500/10">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="text-white/80 text-xs font-semibold mb-1">Data Sources</h4>
              <p className="text-white/35 text-[10px] leading-relaxed">
                VIIRS Nighttime Lights 2024 · Nigeria MPI Survey ·
                GRID3 LGA Boundaries · Senatorial District Poverty Data
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ================================================================ */
  /*  LGA Profile Card                                                 */
  /* ================================================================ */
  const renderLGAProfile = () => {
    if (!selectedLGA) return null;

    const { LGA_Name, State, risk_level, MPI, mean_nightlight_intensity, cluster_label } =
      selectedLGA.properties;
    const povertyProbability = calculatePovertyProbability(MPI, mean_nightlight_intensity);
    const riskColor = RISK_COLORS[risk_level as RiskLevel] ?? '#999';

    return (
      <div className="space-y-5 fade-in-up">
        {/* ── Header ── */}
        <div className="flex justify-between items-start pb-4 border-b border-purple-500/15">
          <div>
            <h2 className="text-xl font-extrabold gradient-text tracking-tight leading-tight">
              {LGA_Name}
            </h2>
            <p className="text-white/40 text-xs font-medium mt-1">{State} State, Nigeria</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="glass-card rounded-xl p-2 hover:bg-white/10 transition-all"
              aria-label="Close"
            >
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* ── Risk Badge ── */}
        <div
          className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full font-bold text-sm text-white shadow-lg ring-1 ring-white/20"
          style={{
            background: `linear-gradient(135deg, ${riskColor}ee, ${riskColor}99)`,
            boxShadow: `0 4px 24px ${riskColor}55, 0 0 60px ${riskColor}22`,
          }}
        >
          <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse shadow-sm" />
          {cluster_label}
        </div>

        {/* ── Key Indicators ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-white/50 text-[10px] font-semibold uppercase tracking-widest">MPI</span>
            </div>
            <div className="text-2xl font-extrabold text-white">{MPI.toFixed(4)}</div>
            <div className="text-white/30 text-[10px] mt-1">Poverty Index Score</div>
          </div>

          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="text-white/50 text-[10px] font-semibold uppercase tracking-widest">Light</span>
            </div>
            <div className="text-2xl font-extrabold text-white">{mean_nightlight_intensity.toFixed(2)}</div>
            <div className="text-white/30 text-[10px] mt-1">VIIRS radiance</div>
          </div>
        </div>

        {/* ── Poverty Probability Gauge ── */}
        <div className="glass-card rounded-2xl p-5 ring-1 ring-amber-500/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-amber-200">Poverty Probability</h3>
            <span
              className="text-lg font-extrabold tabular-nums"
              style={{ color: gaugeColor(povertyProbability) }}
            >
              {povertyProbability.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${povertyProbability}%`,
                background: `linear-gradient(90deg, ${gaugeColor(povertyProbability)}, ${gaugeColor(povertyProbability)}cc)`,
                boxShadow: `0 0 12px ${gaugeColor(povertyProbability)}55`,
              }}
            />
          </div>
          <p className="text-white/30 text-[10px] mt-2">
            Composite of MPI score (70%) and inverse nightlight intensity (30%)
          </p>
        </div>

        {/* ── Risk Description ── */}
        <div className="glass-card rounded-2xl p-4 ring-1 ring-white/5">
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ring-1 ring-white/10"
              style={{ backgroundColor: `${riskColor}22` }}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: riskColor }} />
            </div>
            <div>
              <h4 className="text-white/80 text-xs font-semibold mb-1">Risk Assessment</h4>
              <p className="text-white/40 text-[11px] leading-relaxed">
                {riskDescription(risk_level)}
              </p>
            </div>
          </div>
        </div>

        {/* ── Comparative Analysis ── */}
        <div className="glass-card rounded-2xl p-5 ring-1 ring-emerald-500/10">
          <h3 className="text-sm font-bold text-emerald-200 mb-1">Comparative Analysis</h3>
          <p className="text-white/30 text-[10px] mb-4">vs. national average</p>
          <div className="space-y-4">
            {/* MPI vs National */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/60 font-medium">MPI Score</span>
                <span className="text-white font-bold tabular-nums">
                  {stats ? `${((MPI / parseFloat(stats.averageMPI)) * 100).toFixed(0)}%` : '—'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stats ? Math.min((MPI / parseFloat(stats.averageMPI)) * 100, 100) : 0}%`,
                  }}
                />
              </div>
            </div>
            {/* Nightlight vs National */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/60 font-medium">Nightlight Intensity</span>
                <span className="text-white font-bold tabular-nums">
                  {stats
                    ? `${((mean_nightlight_intensity / parseFloat(stats.averageNightlight)) * 100).toFixed(0)}%`
                    : '—'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stats ? Math.min((mean_nightlight_intensity / parseFloat(stats.averageNightlight)) * 100, 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Download ── */}
        <button className="w-full rounded-2xl px-5 py-3.5 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2.5 group bg-gradient-to-r from-indigo-600/80 via-purple-600/80 to-fuchsia-600/80 hover:from-indigo-500 hover:via-purple-500 hover:to-fuchsia-500 shadow-lg shadow-indigo-500/20 hover:shadow-purple-500/30 ring-1 ring-white/10 hover:ring-white/20">
          <svg
            className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Download LGA Report
        </button>
      </div>
    );
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */
  return (
    <div className="h-full relative overflow-hidden">
      {/* ── Vibrant layered background ── */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(165deg, #0c1222 0%, #1a1145 22%, #1e1b4b 40%, #182346 58%, #0f2027 80%, #0c1222 100%)',
        }}
      />
      {/* Ambient glow orbs */}
      <div className="sidebar-orb sidebar-orb-1" />
      <div className="sidebar-orb sidebar-orb-2" />
      <div className="sidebar-orb sidebar-orb-3" />

      {/* ── Content layer ── */}
      <div className="relative z-10 h-full overflow-y-auto">
        {/* Branded top banner */}
        <div className="sidebar-banner px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/40 ring-2 ring-white/10">
              <svg className="w-5 h-5 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight">IOPHIN</h1>
              <p className="text-[10px] font-medium text-indigo-300/70 tracking-widest uppercase">Analytics Panel</p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          {selectedLGA ? renderLGAProfile() : renderNationalSummary()}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
