/**
 * Sidebar  Production Analytics Panel
 * Clean hierarchy, consistent spacing, working report download.
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { RISK_COLORS } from '../types';
import type { HotspotFeature, Stats, RiskLevel } from '../types';
import { useFilterStore } from '../store';
import { getDynamicRiskLevel } from '../utils/riskTiers';

interface SidebarProps {
  stats: Stats | null;
  selectedLGA: HotspotFeature | null;
  onClose?: () => void;
}

/* -- Helpers -- */

const fmt = (n: number, d = 2) => n.toFixed(d);

const riskDescription: Record<string, string> = {
  Critical: 'Extreme multi-dimensional deprivation. Immediate large-scale humanitarian intervention required.',
  High: 'Severe poverty indicators with critical deprivation levels. Immediate humanitarian intervention required.',
  Medium: 'Significant deprivation across multiple dimensions. Targeted support programs recommended.',
  Low: 'Moderate vulnerability with emerging risk factors. Continued monitoring and prevention needed.',
  Minimal: 'Relatively stable conditions. Maintenance programs and early-warning systems in place.',
};

/* -- Section divider -- */
const Divider = () => <div className="sidebar-divider" />;

/* -- Stat card -- */
const MetricCard = ({ label, value, sub }: { label: string; value: string | number; sub: string }) => (
  <div className="metric-card">
    <span className="metric-label">{label}</span>
    <div className="metric-value">{value}</div>
    <span className="metric-sub">{sub}</span>
  </div>
);

/* -- PDF / Report Generation -- */
const generateReport = (selectedLGA: HotspotFeature | null, stats: Stats | null) => {
  const now = new Date().toLocaleString();
  const isLGA = !!selectedLGA;

  let content = '';
  const line = '='.repeat(64);
  const thin = '-'.repeat(64);

  content += line + '\n';
  content += '  IOPHIN  -  Poverty Hotspot Intelligence Report\n';
  content += '  Generated: ' + now + '\n';
  content += line + '\n\n';

  if (isLGA) {
    const p = selectedLGA!.properties;
    const mpiScore = Math.min(p.MPI * 100, 100);
    const nlScore = Math.max(0, 100 - (p.mean_nightlight_intensity / 60) * 100);
    const prob = Math.min(Math.max(mpiScore * 0.7 + nlScore * 0.3, 0), 100);

    content += '  LGA PROFILE\n';
    content += thin + '\n';
    content += '  Name:            ' + p.LGA_Name + '\n';
    content += '  State:           ' + p.State + '\n';
    content += '  Risk Level:      ' + p.risk_level + ' (' + p.cluster_label + ')\n';
    content += '  MPI Score:       ' + p.MPI.toFixed(4) + '\n';
    content += '  Nightlight:      ' + p.mean_nightlight_intensity.toFixed(2) + ' (VIIRS radiance)\n';
    content += '  Poverty Prob.:   ' + prob.toFixed(1) + '%\n';
    if (p.composite_poverty_score != null)
      content += '  Composite Score: ' + p.composite_poverty_score.toFixed(4) + '\n';
    if (p.Headcount_Ratio != null)
      content += '  Headcount Ratio: ' + (p.Headcount_Ratio * 100).toFixed(1) + '%\n';
    if (p.senatorial_mpi != null)
      content += '  Senatorial MPI:  ' + p.senatorial_mpi.toFixed(4) + '\n';
    if (p.conflict_flag && p.conflict_flag !== 'NORMAL') {
      content += '  Conflict Status: ' + p.conflict_flag + '\n';
      if (p.last_conflict_event) content += '  Last Event:      ' + p.last_conflict_event + '\n';
    }
    if (p.last_updated) content += '  Last Updated:    ' + new Date(p.last_updated).toLocaleDateString() + '\n';

    // Infrastructure
    if (p.health_facility_count != null || p.school_count != null || p.road_density_km != null) {
      content += '\n  INFRASTRUCTURE\n';
      content += thin + '\n';
      if (p.health_facility_count != null) content += '  Health Facilities: ' + p.health_facility_count + '\n';
      if (p.school_count != null)          content += '  Schools:           ' + p.school_count + '\n';
      if (p.road_density_km != null)       content += '  Road Density:      ' + p.road_density_km.toFixed(1) + ' km/km²\n';
    }

    // Environmental & Displacement
    if (p.ndvi_mean != null || p.rainfall_mm != null || p.idp_count != null || p.food_price_index != null) {
      content += '\n  ENVIRONMENT & DISPLACEMENT\n';
      content += thin + '\n';
      if (p.ndvi_mean != null)        content += '  NDVI:             ' + p.ndvi_mean.toFixed(3) + '\n';
      if (p.rainfall_mm != null)      content += '  Rainfall:         ' + p.rainfall_mm.toFixed(0) + ' mm/month\n';
      if (p.population_density != null) content += '  Population Dens.: ' + p.population_density.toFixed(0) + ' per km²\n';
      if (p.idp_count != null && p.idp_count > 0) content += '  IDPs:             ' + p.idp_count + '\n';
      if (p.food_price_index != null) content += '  Food Price Index: ' + p.food_price_index.toFixed(0) + '\n';
    }

    content += '\n  RISK ASSESSMENT\n';
    content += thin + '\n';
    content += '  ' + (riskDescription[p.risk_level] || 'N/A') + '\n';

    if (stats) {
      const mpiPct = ((p.MPI / parseFloat(stats.averageMPI)) * 100).toFixed(0);
      const nlPct = ((p.mean_nightlight_intensity / parseFloat(stats.averageNightlight)) * 100).toFixed(0);
      content += '\n  COMPARATIVE ANALYSIS (vs. National Average)\n';
      content += thin + '\n';
      content += '  MPI Score:       ' + mpiPct + '% of national average (' + stats.averageMPI + ')\n';
      content += '  Nightlight:      ' + nlPct + '% of national average (' + stats.averageNightlight + ')\n';
      if (p.composite_poverty_score != null && stats.averageCompositeScore)
        content += '  Composite:       ' + ((p.composite_poverty_score / parseFloat(stats.averageCompositeScore)) * 100).toFixed(0) + '% of national average (' + stats.averageCompositeScore + ')\n';
    }
  }

  if (stats) {
    content += '\n  NATIONAL SUMMARY\n';
    content += thin + '\n';
    content += '  Total LGAs:      ' + stats.totalLGAs + '\n';
    content += '  States Covered:  ' + stats.statesCount + '\n';
    content += '  Average MPI:     ' + stats.averageMPI + '\n';
    content += '  Avg Nightlight:  ' + stats.averageNightlight + '\n';
    if (stats.conflictZones) content += '  Conflict Zones:  ' + stats.conflictZones + '\n';
    const rd = stats.riskDistribution;
    const total = stats.totalLGAs || 1;
    content += '\n  RISK DISTRIBUTION\n';
    content += thin + '\n';
    if (rd.critical != null && rd.critical > 0)
      content += '  Critical Risk:   ' + rd.critical + ' LGAs (' + ((rd.critical / total) * 100).toFixed(1) + '%)\n';
    content += '  High Risk:       ' + rd.high + ' LGAs (' + ((rd.high / total) * 100).toFixed(1) + '%)\n';
    content += '  Medium Risk:     ' + rd.medium + ' LGAs (' + ((rd.medium / total) * 100).toFixed(1) + '%)\n';
    content += '  Low Risk:        ' + rd.low + ' LGAs (' + ((rd.low / total) * 100).toFixed(1) + '%)\n';
    content += '  Minimal Risk:    ' + rd.minimal + ' LGAs (' + ((rd.minimal / total) * 100).toFixed(1) + '%)\n';
  }

  content += '\n  DATA SOURCES\n';
  content += thin + '\n';
  content += '  * VIIRS Nighttime Lights (NOAA) 2024\n';
  content += '  * Nigeria Multidimensional Poverty Index Survey\n';
  content += '  * Senatorial District Poverty Data\n';
  content += '  * GRID3 LGA Boundaries, Health Facilities & Schools\n';
  content += '  * WorldPop Population Estimates\n';
  content += '  * ACLED Conflict Events Database\n';
  content += '  * IOM Displacement Tracking Matrix\n';
  content += '  * WFP VAM Food Prices\n';
  content += '  * Google Earth Engine (MODIS NDVI, CHIRPS Rainfall)\n';
  content += '  * OpenStreetMap Road Network\n';
  content += '\n' + line + '\n';
  content += '  IOPHIN Poverty Hotspot Intelligence System v2.0\n';
  content += '  Classification: UNCLASSIFIED // FOR OFFICIAL USE\n';
  content += line + '\n';

  const filename = isLGA
    ? 'IOPHIN_Report_' + selectedLGA!.properties.LGA_Name + '_' + selectedLGA!.properties.State + '.txt'
    : 'IOPHIN_National_Report_' + new Date().toISOString().slice(0, 10) + '.txt';

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/* ============================================================ */

const Sidebar: React.FC<SidebarProps> = ({ stats, selectedLGA, onClose }) => {

  /* -- Pie data helper -- */
  const getPieData = () => {
    if (!stats) return [];
    return [
      { name: 'Critical', value: stats.riskDistribution.critical ?? 0, color: RISK_COLORS.Critical },
      { name: 'High', value: stats.riskDistribution.high, color: RISK_COLORS.High },
      { name: 'Medium', value: stats.riskDistribution.medium, color: RISK_COLORS.Medium },
      { name: 'Low', value: stats.riskDistribution.low, color: RISK_COLORS.Low },
      { name: 'Minimal', value: stats.riskDistribution.minimal, color: RISK_COLORS.Minimal },
    ];
  };

  const povertyProb = (mpi: number, nl: number) => {
    const s1 = Math.min(mpi * 100, 100);
    const s2 = Math.max(0, 100 - (nl / 60) * 100);
    return Math.min(Math.max(s1 * 0.7 + s2 * 0.3, 0), 100);
  };

  const probColor = (p: number) =>
    p >= 70 ? '#ef4444' : p >= 45 ? '#f59e0b' : p >= 20 ? '#10b981' : '#3b82f6';

  /* ================================================================
     NATIONAL SUMMARY
     ================================================================ */
  const renderNationalSummary = () => {
    if (!stats) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="spinner mx-auto mb-4" />
            <p style={{ color: 'var(--text-quaternary)', fontSize: 14 }}>Loading statistics...</p>
          </div>
        </div>
      );
    }

    const pieData = getPieData();
    const total = stats.totalLGAs;

    return (
      <div className="sidebar-content fade-in-up">
        {/* Section title */}
        <div className="sidebar-section-header">
          <h2 className="sidebar-title">National Overview</h2>
          <p className="sidebar-subtitle">Poverty Hotspot Distribution - Nigeria</p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-2.5">
          <MetricCard label="LGAs" value={stats.totalLGAs} sub="Areas tracked" />
          <MetricCard label="States" value={stats.statesCount} sub="States covered" />
          <MetricCard label="Avg MPI" value={stats.averageMPI} sub="Poverty Index" />
          <MetricCard label="Nightlight" value={stats.averageNightlight} sub="VIIRS radiance" />
        </div>

        {/* Conflict alert */}
        {stats.conflictZones != null && stats.conflictZones > 0 && (
          <div className="alert-banner alert-danger">
            <div className="alert-icon danger">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <div className="alert-title">{stats.conflictZones} Active Conflict Zone{stats.conflictZones > 1 ? 's' : ''}</div>
              <div className="alert-sub">ACLED verified incidents</div>
            </div>
          </div>
        )}

        <Divider />

        {/* Risk Distribution Donut */}
        <div className="sidebar-section-header">
          <h3 className="sidebar-section-title">Risk Distribution</h3>
          <span className="sidebar-section-count">{total} LGAs</span>
        </div>

        <div className="flex items-center gap-3">
          <div style={{ width: 120, height: 120, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData} cx="50%" cy="50%"
                  innerRadius={32} outerRadius={56}
                  paddingAngle={2} dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-sidebar)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    boxShadow: '0 8px 24px rgba(0,0,0,.25)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 space-y-1.5">
            {pieData.map((item) => {
              const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
              return (
                <div key={item.name} className="pie-legend-row">
                  <span className="pie-dot" style={{ background: item.color }} />
                  <span className="pie-label">{item.name}</span>
                  <span className="pie-value">{item.value}</span>
                  <span className="pie-pct">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <Divider />

        {/* Breakdown bars */}
        <div className="sidebar-section-header">
          <h3 className="sidebar-section-title">Detailed Breakdown</h3>
        </div>

        <div className="space-y-3">
          {pieData.map((item) => {
            const pct = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <div key={item.name}>
                <div className="bar-header">
                  <span className="bar-label">{item.name} Risk</span>
                  <span className="bar-stats">
                    <strong>{item.value}</strong> <span className="bar-pct">({pct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: pct + '%', background: item.color }} />
                </div>
              </div>
            );
          })}
        </div>

        <Divider />

        {/* Data source footer */}
        <div className="sidebar-footer">
          <h4 className="sidebar-footer-title">Data Sources</h4>
          <p className="sidebar-footer-text">
            VIIRS Nighttime Lights &middot; Nigeria MPI &middot; Senatorial MPI &middot; GRID3 &middot;
            WorldPop &middot; ACLED &middot; IOM DTM &middot; WFP &middot; GEE (NDVI/Rainfall) &middot; OSM
          </p>
          {stats.dataSource && (
            <div className="source-chip">
              <span className="source-label">Source</span>
              <span className="source-value">{stats.dataSource}</span>
            </div>
          )}
        </div>

        {/* Download */}
        <button className="download-btn" onClick={() => generateReport(null, stats)}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download National Report
        </button>
      </div>
    );
  };

  /* ================================================================
     LGA PROFILE
     ================================================================ */
  const renderLGAProfile = () => {
    if (!selectedLGA) return null;

    const p = selectedLGA.properties;
    const prob = povertyProb(p.MPI, p.mean_nightlight_intensity);
    const pColor = probColor(prob);
    const tieringMode = useFilterStore((s) => s.tieringMode);
    const dynamicRisk = getDynamicRiskLevel(selectedLGA as HotspotFeature, tieringMode);
    const riskColor = RISK_COLORS[dynamicRisk as RiskLevel] ?? '#999';

    return (
      <div className="sidebar-content fade-in-up">
        {/* Header with close */}
        <div className="lga-header">
          <div className="flex-1 min-w-0">
            <h2 className="lga-name">{p.LGA_Name}</h2>
            <p className="lga-state">{p.State} State, Nigeria</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="close-btn" aria-label="Close profile">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Risk badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="risk-badge" style={{ background: riskColor + 'cc', boxShadow: '0 4px 14px ' + riskColor + '30' }}>
            <span className="risk-dot-white" />
            <span>{p.cluster_label} · {dynamicRisk}</span>
          </div>
          <span className="risk-tooltip" title={"Risk tiers are relative by default (cluster-ranked using composite poverty score, nightlights and other indicators). You can enable absolute thresholds via config.RISK_TIERING_MODE='absolute'."} style={{ color: '#bbb', fontSize: 12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </span>
        </div>

        {/* Conflict alert */}
        {p.conflict_flag && p.conflict_flag !== 'NORMAL' && (
          <div className="alert-banner alert-danger">
            <div className="alert-icon danger">
              <span className="conflict-pulse" />
            </div>
            <div className="flex-1">
              <div className="alert-title">Active Conflict Zone</div>
              {p.last_conflict_event && (
                <div className="alert-sub">Latest: {p.last_conflict_event}</div>
              )}
            </div>
            <span className="conflict-severity">{p.conflict_flag}</span>
          </div>
        )}

        {/* Key indicators */}
        <div className="grid grid-cols-2 gap-2.5">
          <MetricCard label="MPI" value={fmt(p.MPI, 4)} sub="Poverty Index" />
          <MetricCard label="Nightlight" value={fmt(p.mean_nightlight_intensity)} sub="VIIRS radiance" />
          {p.composite_poverty_score != null && (
            <MetricCard label="Composite" value={fmt(p.composite_poverty_score, 4)} sub="Poverty Score" />
          )}
          {p.population_density != null && (
            <MetricCard label="Pop. Density" value={fmt(p.population_density, 0)} sub="per km²" />
          )}
          {p.Headcount_Ratio != null && (
            <MetricCard label="Headcount" value={fmt(p.Headcount_Ratio * 100, 1) + '%'} sub="Poverty Rate" />
          )}
          {p.Intensity_of_Depravation != null && (
            <MetricCard label="Intensity" value={fmt(p.Intensity_of_Depravation, 3)} sub="Deprivation" />
          )}
        </div>

        {/* Poverty depth indicators */}
        {(p.In_Severe_Poverty != null || p.senatorial_mpi != null || p.distance_to_urban_km != null) && (
          <>
            <Divider />
            <div className="sidebar-section-header">
              <h3 className="sidebar-section-title">Poverty Depth</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {p.In_Severe_Poverty != null && (
                <MetricCard label="Severe Poverty" value={fmt(p.In_Severe_Poverty, 1) + '%'} sub="in severe deprivation" />
              )}
              {p.senatorial_mpi != null && (
                <MetricCard label="Senatorial MPI" value={fmt(p.senatorial_mpi, 4)} sub="district-level" />
              )}
              {p.distance_to_urban_km != null && (
                <MetricCard label="Urban Dist." value={fmt(p.distance_to_urban_km, 1) + ' km'} sub="to nearest urban" />
              )}
            </div>
          </>
        )}

        {/* Infrastructure indicators */}
        {(p.health_facility_count != null || p.school_count != null || p.road_density_km != null) && (
          <>
            <Divider />
            <div className="sidebar-section-header">
              <h3 className="sidebar-section-title">Infrastructure</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {p.health_facility_count != null && (
                <MetricCard label="Health" value={p.health_facility_count} sub="facilities" />
              )}
              {p.school_count != null && (
                <MetricCard label="Schools" value={p.school_count} sub="count" />
              )}
              {p.road_density_km != null && (
                <MetricCard label="Roads" value={fmt(p.road_density_km, 1)} sub="km/km²" />
              )}
            </div>
          </>
        )}

        {/* Environmental + displacement */}
        {(p.ndvi_mean != null || p.rainfall_mm != null || p.idp_count != null || p.food_price_index != null) && (
          <>
            <Divider />
            <div className="sidebar-section-header">
              <h3 className="sidebar-section-title">Environment &amp; Displacement</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {p.ndvi_mean != null && <MetricCard label="NDVI" value={fmt(p.ndvi_mean, 3)} sub="vegetation" />}
              {p.rainfall_mm != null && <MetricCard label="Rainfall" value={fmt(p.rainfall_mm, 0)} sub="mm/month" />}
              {p.idp_count != null && p.idp_count > 0 && <MetricCard label="IDPs" value={p.idp_count} sub="displaced" />}
              {p.food_price_index != null && <MetricCard label="Food Price" value={fmt(p.food_price_index, 0)} sub="index" />}
            </div>
          </>
        )}

        {/* Freshness */}
        {p.last_updated && (
          <div className="source-chip">
            <span className="source-label">Updated</span>
            <span className="source-value">{new Date(p.last_updated).toLocaleDateString()}</span>
          </div>
        )}

        <Divider />

        {/* Poverty probability gauge */}
        <div className="sidebar-section-header">
          <h3 className="sidebar-section-title">Poverty Probability</h3>
          <span className="prob-value" style={{ color: pColor }}>{prob.toFixed(1)}%</span>
        </div>

        <div className="gauge-track">
          <div className="gauge-fill" style={{ width: prob + '%', background: pColor }} />
        </div>
        <p className="gauge-caption">Composite of MPI (70%) and inverse nightlight (30%)</p>

        <Divider />

        {/* Risk assessment */}
        <div className="risk-assessment">
          <span className="risk-assessment-dot" style={{ background: riskColor }} />
          <div>
            <h4 className="risk-assessment-title">Risk Assessment</h4>
            <p className="risk-assessment-text">{riskDescription[dynamicRisk] || ''}</p>
          </div>
        </div>

        <Divider />

        {/* Comparative analysis */}
        <div className="sidebar-section-header">
          <h3 className="sidebar-section-title">Comparative Analysis</h3>
          <span className="sidebar-section-count">vs. national avg</span>
        </div>

        <div className="space-y-3">
          {[
            {
              label: 'MPI Score',
              value: p.MPI,
              avg: stats ? parseFloat(stats.averageMPI) : 0,
              color: '#6366f1',
            },
            {
              label: 'Nightlight',
              value: p.mean_nightlight_intensity,
              avg: stats ? parseFloat(stats.averageNightlight) : 0,
              color: '#06b6d4',
            },
            ...(p.composite_poverty_score != null && stats?.averageCompositeScore
              ? [{
                  label: 'Composite Score',
                  value: p.composite_poverty_score,
                  avg: parseFloat(stats.averageCompositeScore),
                  color: '#8b5cf6',
                }]
              : []),
          ].map((m) => {
            const pct = m.avg > 0 ? (m.value / m.avg) * 100 : 0;
            return (
              <div key={m.label}>
                <div className="bar-header">
                  <span className="bar-label">{m.label}</span>
                  <span className="bar-stats"><strong>{pct.toFixed(0)}%</strong></span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: Math.min(pct, 100) + '%', background: m.color }} />
                </div>
              </div>
            );
          })}
        </div>

        <Divider />

        {/* Download */}
        <button className="download-btn" onClick={() => generateReport(selectedLGA, stats)}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download LGA Report
        </button>
      </div>
    );
  };

  /* ================================================================
     RENDER
     ================================================================ */
  return (
    <div className="sidebar-root">
      {/* Brand header */}
      <div className="sidebar-brand">
        <div className="brand-logo">
          <span className="brand-letter">P</span>
        </div>
        <div>
          <h1 className="brand-name">PHIS</h1>
          <p className="brand-sub">National Intelligence</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="sidebar-scroll">
        {selectedLGA ? renderLGAProfile() : renderNationalSummary()}
      </div>
    </div>
  );
};

export default Sidebar;
