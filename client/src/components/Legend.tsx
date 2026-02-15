/**
 * Legend Component
 * A floating control displaying the color-coded risk levels
 */

import { RISK_COLORS } from '../types';
import type { RiskLevel } from '../types';

const Legend: React.FC = () => {
  const riskLevels: { level: RiskLevel; label: string }[] = [
    { level: 'High', label: 'High Risk - Severe Poverty' },
    { level: 'Medium', label: 'Medium Risk - Poor' },
    { level: 'Low', label: 'Low Risk - Vulnerable' },
    { level: 'Minimal', label: 'Minimal Risk - Wealthy' },
  ];

  return (
    <div className="absolute bottom-6 right-6 z-[1000] glass-dark rounded-xl shadow-2xl p-4 max-w-xs">
      <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        Poverty Risk Levels
      </h3>
      <div className="space-y-2">
        {riskLevels.map(({ level, label }) => (
          <div key={level} className="flex items-center gap-3">
            <div
              className="w-6 h-6 rounded-md shadow-md border-2 border-white/30"
              style={{ backgroundColor: RISK_COLORS[level] }}
            />
            <span className="text-white/90 text-xs font-medium">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-white/20">
        <p className="text-white/70 text-xs">
          Based on nightlight intensity and Multidimensional Poverty Index (MPI)
        </p>
      </div>
    </div>
  );
};

export default Legend;
