/**
 * Sidebar — Clean Professional Analytics Panel
 * Solid dark background, white text, blue accent only for interactive elements.
 * Pie chart + breakdown bars keep multicolor (data viz).
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { RISK_COLORS } from '../types';
import type { HotspotFeature, Stats, RiskLevel } from '../types';

interface SidebarProps {
  stats: Stats | null;
  selectedLGA: HotspotFeature | null;
  onClose?: () => void;
}

/* ── Helpers ── */

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
  /* ── Pie data ── */
  const getPieData = () => {
    if (!stats) return [];
    return [
      { name: 'High Risk', value: stats.riskDistribution.high, color: RISK_COLORS.High },
      { name: 'Medium Risk', value: stats.riskDistribution.medium, color: RISK_COLORS.Medium },
      { name: 'Low Risk', value: stats.riskDistribution.low, color: RISK_COLORS.Low },
      { name: 'Minimal Risk', value: stats.riskDistribution.minimal, color: RISK_COLORS.Minimal },
    ];
  };

  const renderCustomLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent,
  }: {
    cx: number; cy: number; midAngle?: number; innerRadius: number; outerRadius: number; percent?: number;
  }) => {
    if (midAngle === undefined) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if ((percent ?? 0) < 0.05) return null;
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
        fontWeight={700} fontSize={12} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
        {`${((percent ?? 0) * 100).toFixed(0)}%`}
      </text>
    );
  };

  const calculatePovertyProbability = (mpi: number, nightlight: number): number => {
    const mpiScore = Math.min(mpi * 100, 100);
    const nightlightScore = Math.max(0, 100 - (nightlight / 60) * 100);
    return Math.min(Math.max(mpiScore * 0.7 + nightlightScore * 0.3, 0), 100);
  };

  const gaugeColor = (p: number) => {
    if (p >= 70) return '#ef4444';
    if (p >= 45) return '#f59e0b';
    if (p >= 20) return '#10b981';
    return '#3b82f6';
  };

  /* ================================================================
     National Summary
     ================================================================ */
  const renderNationalSummary = () => {
    if (!stats) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500/30 border-t-blue-400 mx-auto mb-4" />
            <p className="text-white/50 text-sm">Loading statistics…</p>
          </div>
        </div>
      );
    }

    const pieData = getPieData();
    const total = stats.totalLGAs;

    return (
      <div className="space-y-5 fade-in-up">
        {/* Section header — clean white text */}
        <div>
          <h2 className="text-[15px] font-bold text-white tracking-tight">National Overview</h2>
          <p className="text-white/40 text-[11px] mt-0.5 uppercase tracking-wider font-medium">
            Poverty Hotspot Distribution — Nigeria
          </p>
        </div>

        {/* Key Metrics — 2x2 grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'LGAs', value: stats.totalLGAs, sub: 'Local Govt. Areas tracked' },
            { label: 'States', value: stats.statesCount, sub: 'Federal states covered' },
            { label: 'Avg MPI', value: stats.averageMPI, sub: 'Multidimensional Poverty Index' },
            { label: 'Nightlight', value: stats.averageNightlight, sub: 'VIIRS mean radiance' },
          ].map((m) => (
            <div key={m.label} className="panel p-4">
              <span className="text-white/45 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">{m.label}</span>
              <div className="text-[22px] font-bold text-white leading-none">{m.value}</div>
              <div className="text-white/30 text-[9px] mt-1">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Risk Distribution — Donut (multicolor OK) */}
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[13px] font-bold text-white">Risk Distribution</h3>
            <span className="text-[10px] text-white/30 font-mono">{total} total</span>
          </div>
          <p className="text-white/35 text-[10px] mb-4">
            K-Means clustering — nightlight intensity &amp; MPI score
          </p>

          <div className="flex items-center gap-4">
            <div className="w-[140px] h-[140px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={36} outerRadius={64}
                    paddingAngle={3} dataKey="value" strokeWidth={0} labelLine={false} label={renderCustomLabel}>
                    {pieData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#111827', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10, color: '#f1f5f9', fontSize: 12, fontWeight: 600,
                    }}
                    itemStyle={{ color: '#f1f5f9' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 space-y-2">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-white/60 text-[11px] truncate flex-1">{item.name}</span>
                  <span className="text-white font-bold text-[12px] tabular-nums">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Breakdown — Bars (multicolor OK) */}
        <div className="panel p-5">
          <h3 className="text-[13px] font-bold text-white mb-1">Detailed Breakdown</h3>
          <p className="text-white/35 text-[10px] mb-4">LGA count per risk category with relative share</p>

          <div className="space-y-3.5">
            {pieData.map((item) => {
              const pct = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-white/70 text-[11px] font-medium">{item.name}</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-white font-bold text-[13px] tabular-nums">{item.value}</span>
                      <span className="text-white/35 text-[10px] font-mono">({pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Data Sources */}
        <div className="panel p-4">
          <h4 className="text-white/60 text-[10px] font-semibold mb-1 uppercase tracking-wider">Data Sources</h4>
          <p className="text-white/35 text-[10px] leading-relaxed">
            VIIRS Nighttime Lights 2024 · Nigeria MPI Survey ·
            GRID3 LGA Boundaries · Senatorial District Poverty Data
          </p>
        </div>
      </div>
    );
  };

  /* ================================================================
     LGA Profile
     ================================================================ */
  const renderLGAProfile = () => {
    if (!selectedLGA) return null;

    const { LGA_Name, State, risk_level, MPI, mean_nightlight_intensity, cluster_label } =
      selectedLGA.properties;
    const povertyProbability = calculatePovertyProbability(MPI, mean_nightlight_intensity);
    const riskColor = RISK_COLORS[risk_level as RiskLevel] ?? '#999';

    return (
      <div className="space-y-5 fade-in-up">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-[17px] font-bold text-white tracking-tight leading-tight">
              {LGA_Name}
            </h2>
            <p className="text-white/45 text-[11px] font-medium mt-0.5">{State} State, Nigeria</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="panel rounded-lg p-1.5 hover:bg-white/10 transition-colors" aria-label="Close">
              <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Risk Badge (multicolor OK) */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs text-white"
          style={{ background: `linear-gradient(135deg, ${riskColor}dd, ${riskColor}88)`, boxShadow: `0 4px 16px ${riskColor}40` }}>
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          {cluster_label}
        </div>

        {/* Key Indicators */}
        <div className="grid grid-cols-2 gap-3">
          <div className="panel p-4">
            <span className="text-white/45 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">MPI</span>
            <div className="text-[22px] font-bold text-white leading-none">{MPI.toFixed(4)}</div>
            <div className="text-white/30 text-[9px] mt-1">Poverty Index Score</div>
          </div>
          <div className="panel p-4">
            <span className="text-white/45 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">Light</span>
            <div className="text-[22px] font-bold text-white leading-none">{mean_nightlight_intensity.toFixed(2)}</div>
            <div className="text-white/30 text-[9px] mt-1">VIIRS radiance</div>
          </div>
        </div>

        {/* Poverty Probability Gauge */}
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-bold text-white">Poverty Probability</h3>
            <span className="text-[16px] font-bold tabular-nums" style={{ color: gaugeColor(povertyProbability) }}>
              {povertyProbability.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${povertyProbability}%`, backgroundColor: gaugeColor(povertyProbability) }} />
          </div>
          <p className="text-white/35 text-[10px] mt-2">
            Composite of MPI (70%) and inverse nightlight (30%)
          </p>
        </div>

        {/* Risk Description */}
        <div className="panel p-4">
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: riskColor }} />
            <div>
              <h4 className="text-white/70 text-[11px] font-semibold mb-0.5">Risk Assessment</h4>
              <p className="text-white/45 text-[10px] leading-relaxed">{riskDescription(risk_level)}</p>
            </div>
          </div>
        </div>

        {/* Comparative Analysis */}
        <div className="panel p-5">
          <h3 className="text-[13px] font-bold text-white mb-0.5">Comparative Analysis</h3>
          <p className="text-white/35 text-[10px] mb-3">vs. national average</p>
          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-white/60 font-medium">MPI Score</span>
                <span className="text-white font-bold tabular-nums">
                  {stats ? `${((MPI / parseFloat(stats.averageMPI)) * 100).toFixed(0)}%` : '—'}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats ? Math.min((MPI / parseFloat(stats.averageMPI)) * 100, 100) : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-white/60 font-medium">Nightlight Intensity</span>
                <span className="text-white font-bold tabular-nums">
                  {stats ? `${((mean_nightlight_intensity / parseFloat(stats.averageNightlight)) * 100).toFixed(0)}%` : '—'}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="bg-blue-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats ? Math.min((mean_nightlight_intensity / parseFloat(stats.averageNightlight)) * 100, 100) : 0}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Download */}
        <button className="w-full rounded-xl px-4 py-3 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download LGA Report
        </button>
      </div>
    );
  };

  /* ================================================================
     Render
     ================================================================ */
  return (
    <div className="h-full overflow-y-auto sidebar-surface">
      {/* Brand header */}
      <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
        <h1 className="text-base font-bold text-white tracking-tight">IOPHIN</h1>
        <p className="text-[10px] font-medium text-white/35 tracking-widest uppercase mt-0.5">Analytics Panel</p>
      </div>

      {/* Content */}
      <div className="px-6 py-5">
        {selectedLGA ? renderLGAProfile() : renderNationalSummary()}
      </div>
    </div>
  );
};

export default Sidebar;
