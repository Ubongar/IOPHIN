/**
 * Legend — Clean Floating Risk Level Key
 * True-black theme, risk colors are data-viz (multicolor stays).
 */

import { useState } from 'react';
import { RISK_COLORS } from '../types';
import type { RiskLevel } from '../types';

const Legend: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  const riskLevels: { level: RiskLevel; label: string; mpiRange: string }[] = [
    { level: 'High', label: 'Severe Poverty', mpiRange: 'MPI > 0.35' },
    { level: 'Medium', label: 'Significant Deprivation', mpiRange: 'MPI 0.20–0.35' },
    { level: 'Low', label: 'Moderate Vulnerability', mpiRange: 'MPI 0.10–0.20' },
    { level: 'Minimal', label: 'Relatively Stable', mpiRange: 'MPI < 0.10' },
  ];

  return (
    <div
      className="absolute bottom-5 right-5 z-[1000] rounded-xl overflow-hidden transition-all duration-300"
      style={{
        width: collapsed ? '44px' : '250px',
        background: 'rgba(13, 13, 13, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-2.5 right-2.5 w-5 h-5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-all z-10"
        aria-label={collapsed ? 'Expand legend' : 'Collapse legend'}
      >
        <svg className={`w-2.5 h-2.5 text-white/40 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="p-4">
          {/* Header */}
          <div className="mb-3 pb-2.5 border-b border-white/[0.07]">
            <h3 className="text-white/80 font-bold text-[11px] tracking-wide">Risk Classification</h3>
            <p className="text-white/30 text-[9px] mt-0.5">K-Means poverty clustering</p>
          </div>

          {/* Risk items */}
          <div className="space-y-2.5">
            {riskLevels.map(({ level, label, mpiRange }) => (
              <div key={level} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: RISK_COLORS[level] }} />
                <div className="flex-1 min-w-0">
                  <span className="text-white/70 text-[10px] font-semibold block">{label}</span>
                  <span className="text-white/30 text-[9px] font-mono block">{mpiRange}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-3 pt-2.5 border-t border-white/[0.05]">
            <p className="text-white/20 text-[8px]">VIIRS Nightlight + MPI clustering</p>
          </div>
        </div>
      )}

      {collapsed && (
        <div className="p-2 pt-9 space-y-1.5">
          {riskLevels.map(({ level }) => (
            <div key={level} className="w-4 h-4 rounded mx-auto" style={{ backgroundColor: RISK_COLORS[level] }} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Legend;
