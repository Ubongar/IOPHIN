/**
 * Legend Component — Premium Floating Risk Level Key
 * Enhanced with colour-coded indicators, progress hints, and better visual hierarchy
 */

import { useState } from 'react';
import { RISK_COLORS } from '../types';
import type { RiskLevel } from '../types';

const Legend: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  const riskLevels: { level: RiskLevel; label: string; short: string; mpiRange: string; icon: string }[] = [
    { level: 'High', label: 'Severe Poverty', short: 'Immediate intervention', mpiRange: 'MPI > 0.35', icon: '🔴' },
    { level: 'Medium', label: 'Significant Deprivation', short: 'Targeted support', mpiRange: 'MPI 0.20–0.35', icon: '🟡' },
    { level: 'Low', label: 'Moderate Vulnerability', short: 'Monitoring needed', mpiRange: 'MPI 0.10–0.20', icon: '🟢' },
    { level: 'Minimal', label: 'Relatively Stable', short: 'Maintenance programs', mpiRange: 'MPI < 0.10', icon: '🔵' },
  ];

  return (
    <div
      className="absolute bottom-5 right-5 z-[1000] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden transition-all duration-300"
      style={{
        width: collapsed ? '48px' : '280px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 27, 75, 0.92))',
        backdropFilter: 'blur(20px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
      }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-3 right-3 w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all z-10"
        aria-label={collapsed ? 'Expand legend' : 'Collapse legend'}
      >
        <svg
          className={`w-3 h-3 text-white/60 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-3.5 pb-3 border-b border-white/10">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center ring-1 ring-indigo-400/20">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-white/90 font-bold text-xs tracking-wide">Risk Classification</h3>
              <p className="text-white/30 text-[9px]">K-Means poverty clustering</p>
            </div>
          </div>

          {/* Risk items */}
          <div className="space-y-2.5">
            {riskLevels.map(({ level, label, short, mpiRange, icon }) => (
              <div
                key={level}
                className="group flex items-start gap-3 p-2 rounded-xl hover:bg-white/[0.05] transition-all cursor-default"
              >
                {/* Coloured swatch with glow */}
                <div className="flex-shrink-0 mt-0.5">
                  <div
                    className="w-5 h-5 rounded-md shadow-sm ring-1 ring-white/10"
                    style={{
                      backgroundColor: RISK_COLORS[level],
                      boxShadow: `0 0 10px ${RISK_COLORS[level]}55, inset 0 1px 0 rgba(255,255,255,0.15)`,
                    }}
                  />
                </div>
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]">{icon}</span>
                    <span className="text-white/90 text-[11px] font-semibold leading-tight">{label}</span>
                  </div>
                  <div className="text-white/35 text-[9px] leading-tight mt-0.5">{short}</div>
                  <div
                    className="text-[8px] font-mono mt-1 px-1.5 py-0.5 rounded-md inline-block"
                    style={{
                      background: `${RISK_COLORS[level]}15`,
                      color: RISK_COLORS[level],
                      border: `1px solid ${RISK_COLORS[level]}25`,
                    }}
                  >
                    {mpiRange}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-3.5 pt-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1">
                {Object.values(RISK_COLORS).map((c, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full ring-1 ring-slate-900"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <p className="text-white/25 text-[9px] leading-relaxed flex-1">
                VIIRS Nightlight + MPI driven clustering
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed state */}
      {collapsed && (
        <div className="p-2.5 pt-10 space-y-2">
          {riskLevels.map(({ level }) => (
            <div
              key={level}
              className="w-5 h-5 rounded-md mx-auto"
              style={{
                backgroundColor: RISK_COLORS[level],
                boxShadow: `0 0 8px ${RISK_COLORS[level]}44`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Legend;
