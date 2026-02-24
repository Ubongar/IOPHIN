/**
 * Legend — Clean Floating Risk Level Key
 * True-black theme, risk colors are data-viz (multicolor stays).
 */

import { useState, useMemo } from 'react';
import { RISK_COLORS } from '../types';
import type { RiskLevel } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useDataStore, useFilterStore } from '../store';
import { getDynamicRiskLevel, ABSOLUTE_THRESHOLDS } from '../utils/riskTiers';

const Legend: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { theme } = useTheme();

  const tieringMode = useFilterStore((s) => s.tieringMode);
  const hotspots = useDataStore((s) => s.hotspotsData);

  const riskLevels = useMemo(() => {
    if (tieringMode === 'absolute') {
      return [
        { level: 'Critical' as RiskLevel, label: 'Extreme Deprivation', mpiRange: `MPI > ${ABSOLUTE_THRESHOLDS.Critical}` },
        { level: 'High' as RiskLevel, label: 'Severe Poverty', mpiRange: `MPI ${ABSOLUTE_THRESHOLDS.Medium}–${ABSOLUTE_THRESHOLDS.High}` },
        { level: 'Medium' as RiskLevel, label: 'Significant Deprivation', mpiRange: `MPI ${ABSOLUTE_THRESHOLDS.Low}–${ABSOLUTE_THRESHOLDS.Medium}` },
        { level: 'Low' as RiskLevel, label: 'Moderate Vulnerability', mpiRange: `MPI ${ABSOLUTE_THRESHOLDS.Minimal}–${ABSOLUTE_THRESHOLDS.Low}` },
        { level: 'Minimal' as RiskLevel, label: 'Relatively Stable', mpiRange: `MPI < ${ABSOLUTE_THRESHOLDS.Minimal}` },
      ];
    }
    return [
      { level: 'Critical' as RiskLevel, label: 'Extreme Deprivation', mpiRange: 'Cluster top-tier' },
      { level: 'High' as RiskLevel, label: 'Severe Poverty', mpiRange: 'Cluster high-tier' },
      { level: 'Medium' as RiskLevel, label: 'Significant Deprivation', mpiRange: 'Cluster mid-tier' },
      { level: 'Low' as RiskLevel, label: 'Moderate Vulnerability', mpiRange: 'Cluster low-tier' },
      { level: 'Minimal' as RiskLevel, label: 'Relatively Stable', mpiRange: 'Cluster minimal-tier' },
    ];
  }, [tieringMode]);

  const distribution = useMemo(() => {
    const counts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0, Minimal: 0 };
    if (!hotspots || !hotspots.features) return counts;
    hotspots.features.forEach((f) => {
      const r = getDynamicRiskLevel(f as any, tieringMode);
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [hotspots, tieringMode]);

  return (
    <div data-testid="legend-container"
      className="absolute bottom-5 right-5 z-[1000] rounded-xl overflow-hidden transition-all duration-300 shadow-xl"
      style={{
        width: collapsed ? '44px' : '250px',
        background: theme === 'dark' 
          ? 'rgba(19, 19, 26, 0.95)' 
          : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: theme === 'dark'
          ? '1px solid rgba(255, 255, 255, 0.1)'
          : '1px solid rgba(15, 23, 42, 0.1)',
        boxShadow: theme === 'dark'
          ? '0 12px 40px rgba(0, 0, 0, 0.5)'
          : '0 12px 40px rgba(0, 0, 0, 0.12)',
      }}
    >
      {/* Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-2.5 right-2.5 w-5 h-5 rounded-md flex items-center justify-center transition-all z-10"
        style={{
          background: 'var(--bg-panel)',
          color: 'var(--text-quaternary)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-panel-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-panel)'}
        aria-label={collapsed ? 'Expand legend' : 'Collapse legend'}
      >
        <svg className={`w-2.5 h-2.5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="p-4">
          {/* Header */}
          <div className="mb-3 pb-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="font-bold text-[11px] tracking-wide" style={{ color: 'var(--text-secondary)' }}>Risk Classification</h3>
            <p data-testid="legend-mode-desc" className="text-[10px] mt-0.5" style={{ color: 'var(--text-quaternary)' }}>{tieringMode === 'absolute' ? 'Absolute thresholds' : 'Cluster-relative tiers (HDBSCAN + Composite)'} </p>
          </div>

          {/* Risk items */}
          <div className="space-y-2.5">
            {riskLevels.map(({ level, label, mpiRange }) => (
              <div key={level} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: RISK_COLORS[level] }} />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold block" style={{ color: 'var(--text-secondary)' }}>{label} — <span data-testid={`legend-count-${level}`} style={{ opacity: 0.8 }}>{distribution[level] ?? 0} LGAs</span></span>
                  <span className="text-[10px] font-mono block" style={{ color: 'var(--text-quaternary)' }}>{mpiRange}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-3 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-[10px]" style={{ color: 'var(--text-quaternary)', opacity: 0.5 }}>Multi-source composite poverty model</p>
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
