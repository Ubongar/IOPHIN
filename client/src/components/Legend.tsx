/**
 * Legend Component — Floating Risk Level Key
 */

import { RISK_COLORS } from '../types';
import type { RiskLevel } from '../types';

const Legend: React.FC = () => {
  const riskLevels: { level: RiskLevel; label: string; short: string }[] = [
    { level: 'High', label: 'Severe Poverty', short: 'Immediate intervention' },
    { level: 'Medium', label: 'Poor', short: 'Targeted support' },
    { level: 'Low', label: 'Vulnerable', short: 'Monitoring needed' },
    { level: 'Minimal', label: 'Wealthy', short: 'Stable' },
  ];

  return (
    <div
      className="absolute bottom-5 right-5 z-[1000] rounded-2xl shadow-2xl shadow-black/30 p-4 w-56"
      style={{
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-white/10">
        <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <h3 className="text-white/90 font-bold text-xs tracking-wide">Risk Levels</h3>
      </div>

      <div className="space-y-2.5">
        {riskLevels.map(({ level, label, short }) => (
          <div key={level} className="flex items-center gap-2.5">
            <div
              className="w-4 h-4 rounded-md flex-shrink-0 shadow-sm"
              style={{
                backgroundColor: RISK_COLORS[level],
                boxShadow: `0 0 6px ${RISK_COLORS[level]}44`,
              }}
            />
            <div className="min-w-0">
              <div className="text-white/85 text-[11px] font-semibold leading-tight">{label}</div>
              <div className="text-white/30 text-[9px] leading-tight">{short}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-2.5 border-t border-white/10">
        <p className="text-white/25 text-[9px] leading-relaxed">
          Nightlight + MPI driven K-Means clustering
        </p>
      </div>
    </div>
  );
};

export default Legend;
