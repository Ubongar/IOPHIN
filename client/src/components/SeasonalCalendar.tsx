import { useState, useMemo } from 'react';
import type { HotspotFeature } from '../types';

interface Props {
  features: HotspotFeature[];
  searchQuery?: string;
  stateFilter?: string;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ROWS = ['Food Insecurity', 'Flood Risk', 'Drought Risk', 'Conflict Pattern'];

// Base national patterns
const BASE_PATTERNS: Record<string, number[]> = {
  'Food Insecurity': [0.7, 0.8, 0.9, 0.8, 0.6, 0.4, 0.3, 0.3, 0.4, 0.5, 0.6, 0.7],
  'Flood Risk':      [0.1, 0.1, 0.2, 0.4, 0.6, 0.8, 0.9, 0.9, 0.7, 0.4, 0.2, 0.1],
  'Drought Risk':    [0.8, 0.7, 0.6, 0.4, 0.2, 0.1, 0.1, 0.1, 0.2, 0.3, 0.5, 0.7],
  'Conflict Pattern':[0.4, 0.3, 0.4, 0.5, 0.6, 0.5, 0.4, 0.4, 0.5, 0.6, 0.5, 0.4],
};

const HEAT_STYLES: Record<string, { bg: string; border: string }> = {
  critical: { bg: 'rgba(239,68,68,.18)',  border: 'rgba(239,68,68,.35)' },
  high:     { bg: 'rgba(249,115,22,.18)', border: 'rgba(249,115,22,.35)' },
  medium:   { bg: 'rgba(234,179,8,.15)',  border: 'rgba(234,179,8,.3)' },
  low:      { bg: 'rgba(16,185,129,.15)', border: 'rgba(16,185,129,.3)' },
};

const HEAT_TEXT: Record<string, string> = {
  critical: '#f87171',
  high: '#fb923c',
  medium: '#facc15',
  low: '#34d399',
};

function heatLevel(val: number): string {
  if (val >= 0.75) return 'critical';
  if (val >= 0.5) return 'high';
  if (val >= 0.25) return 'medium';
  return 'low';
}

function clamp(v: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Derive LGA-specific seasonal patterns from its properties.
 * Adjusts base national patterns using MPI, NDVI, rainfall, conflict flag, etc.
 */
function getLGAPatterns(feature: HotspotFeature): Record<string, number[]> {
  const p = feature.properties;
  const mpi = clamp(p.MPI ?? 0.3);
  const ndvi = clamp(p.ndvi_mean ?? 0.4);
  const rainfall = clamp((p.rainfall_mm ?? 80) / 200); // normalise ~0-1
  const conflictHigh = p.conflict_flag === 'HIGH' || p.conflict_flag === 'CRITICAL';
  const conflictMed = p.conflict_flag === 'MEDIUM';
  const compositeScore = clamp(p.composite_poverty_score ?? 0.4);

  // Food insecurity: higher MPI → elevated baseline; lower NDVI → worse lean season
  const foodBase = BASE_PATTERNS['Food Insecurity'];
  const foodMod = mpi * 0.3 + (1 - ndvi) * 0.2;
  const food = foodBase.map(v => clamp(v + foodMod - 0.15));

  // Flood risk: driven by rainfall; higher rainfall → higher flood risk in wet months
  const floodBase = BASE_PATTERNS['Flood Risk'];
  const floodMod = rainfall * 0.3;
  const flood = floodBase.map(v => clamp(v + floodMod));

  // Drought risk: inverse of rainfall; low NDVI amplifies
  const droughtBase = BASE_PATTERNS['Drought Risk'];
  const droughtMod = (1 - rainfall) * 0.2 + (1 - ndvi) * 0.15;
  const drought = droughtBase.map(v => clamp(v + droughtMod - 0.1));

  // Conflict: elevated if conflict flag is set; composite score adds baseline
  const conflictBase = BASE_PATTERNS['Conflict Pattern'];
  const conflictMod = conflictHigh ? 0.35 : conflictMed ? 0.2 : compositeScore * 0.1;
  const conflict = conflictBase.map(v => clamp(v + conflictMod));

  return {
    'Food Insecurity': food,
    'Flood Risk': flood,
    'Drought Risk': drought,
    'Conflict Pattern': conflict,
  };
}

export default function SeasonalCalendar({ features, searchQuery = '', stateFilter = '' }: Props) {
  const [selectedLGA, setSelectedLGA] = useState('');

  const filteredFeatures = useMemo(() => {
    let list = [...features];

    // Apply state filter
    if (stateFilter) {
      list = list.filter(f => f.properties.State === stateFilter);
    }

    // Apply search filter
    if (searchQuery.length >= 2) {
      const term = searchQuery.toLowerCase();
      list = list.filter(f =>
        f.properties.LGA_Name.toLowerCase().includes(term) ||
        f.properties.State.toLowerCase().includes(term)
      );
    }

    return list;
  }, [features, searchQuery, stateFilter]);

  const lgaNames = useMemo(() =>
    [...new Set(filteredFeatures.map(f => f.properties.LGA_Name))].sort(),
    [filteredFeatures]
  );

  // Get patterns for selected LGA or aggregate for "All LGAs"
  const patterns = useMemo((): Record<string, number[]> => {
    if (!selectedLGA) {
      // Aggregate: average across all filtered features
      if (filteredFeatures.length === 0) return BASE_PATTERNS;
      const sums: Record<string, number[]> = {
        'Food Insecurity': new Array(12).fill(0),
        'Flood Risk': new Array(12).fill(0),
        'Drought Risk': new Array(12).fill(0),
        'Conflict Pattern': new Array(12).fill(0),
      };
      filteredFeatures.forEach(f => {
        const lgaP = getLGAPatterns(f);
        ROWS.forEach(row => {
          lgaP[row].forEach((v, i) => { sums[row][i] += v; });
        });
      });
      const n = filteredFeatures.length;
      const result: Record<string, number[]> = {};
      ROWS.forEach(row => {
        result[row] = sums[row].map(v => clamp(v / n));
      });
      return result;
    }

    // Single LGA
    const feat = filteredFeatures.find(f => f.properties.LGA_Name === selectedLGA);
    if (!feat) return BASE_PATTERNS;
    return getLGAPatterns(feat);
  }, [selectedLGA, filteredFeatures]);

  // Get selected LGA feature for metadata display
  const selectedFeature = useMemo(() =>
    selectedLGA ? filteredFeatures.find(f => f.properties.LGA_Name === selectedLGA) : null,
    [selectedLGA, filteredFeatures]
  );

  const currentMonth = new Date().getMonth();

  return (
    <div className="rankings-container">
      <div className="rankings-header">
        <div>
          <h2 className="rankings-title">Seasonal Vulnerability</h2>
          <p className="rankings-subtitle">
            {selectedLGA
              ? `${selectedLGA}${selectedFeature ? ` · ${selectedFeature.properties.State}` : ''} — LGA-specific risk patterns`
              : `Monthly risk patterns — ${filteredFeatures.length} LGA${filteredFeatures.length !== 1 ? 's' : ''} averaged`}
          </p>
        </div>
        <select
          className="filter-select"
          aria-label="Filter by LGA"
          value={selectedLGA}
          onChange={e => setSelectedLGA(e.target.value)}
          style={{ minWidth: 180 }}
        >
          <option value="">All LGAs (Aggregated)</option>
          {lgaNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* LGA metadata strip when a specific LGA is selected */}
      {selectedFeature && (
        <div style={{
          display: 'flex', gap: 16, flexWrap: 'wrap',
          padding: '10px 16px', marginBottom: 12,
          background: 'var(--bg-panel)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--text-tertiary)',
        }}>
          <span><strong style={{ color: 'var(--text-primary)' }}>Risk:</strong> {selectedFeature.properties.risk_level}</span>
          <span><strong style={{ color: 'var(--text-primary)' }}>MPI:</strong> {(selectedFeature.properties.MPI ?? 0).toFixed(4)}</span>
          {selectedFeature.properties.ndvi_mean != null && (
            <span><strong style={{ color: 'var(--text-primary)' }}>NDVI:</strong> {selectedFeature.properties.ndvi_mean.toFixed(3)}</span>
          )}
          {selectedFeature.properties.rainfall_mm != null && (
            <span><strong style={{ color: 'var(--text-primary)' }}>Rainfall:</strong> {selectedFeature.properties.rainfall_mm.toFixed(0)} mm/mo</span>
          )}
          {selectedFeature.properties.conflict_flag && selectedFeature.properties.conflict_flag !== 'NORMAL' && (
            <span style={{ color: '#f87171' }}><strong>Conflict:</strong> {selectedFeature.properties.conflict_flag}</span>
          )}
          {selectedFeature.properties.composite_poverty_score != null && (
            <span><strong style={{ color: 'var(--text-primary)' }}>Composite Score:</strong> {selectedFeature.properties.composite_poverty_score.toFixed(4)}</span>
          )}
        </div>
      )}

      <div className="rankings-table-wrap">
        <table className="rankings-table">
          <thead>
            <tr>
              <th style={{ minWidth: 140 }}>Dimension</th>
              {MONTHS.map((m, i) => (
                <th key={m} style={{
                  textAlign: 'center',
                  minWidth: 48,
                  background: i === currentMonth ? 'var(--blue)' : undefined,
                  color: i === currentMonth ? '#fff' : undefined,
                }}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(row => (
              <tr key={row}>
                <td className="lga-cell" style={{ fontSize: 12 }}>{row}</td>
                {patterns[row].map((val, i) => {
                  const level = heatLevel(val);
                  return (
                    <td key={i} style={{ padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 38, height: 28,
                        borderRadius: 'var(--radius-sm)',
                        background: HEAT_STYLES[level].bg,
                        border: `1px solid ${HEAT_STYLES[level].border}`,
                        color: HEAT_TEXT[level],
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: "'JetBrains Mono', monospace",
                        ...(i === currentMonth ? { boxShadow: '0 0 0 2px var(--blue)' } : {}),
                      }}>
                        {(val * 100).toFixed(0)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
        marginTop: 16, padding: '10px 16px',
        background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--text-tertiary)',
      }}>
        <span style={{ fontWeight: 600 }}>Risk Level:</span>
        {[
          { label: 'Low (0–25%)', level: 'low' },
          { label: 'Medium (25–50%)', level: 'medium' },
          { label: 'High (50–75%)', level: 'high' },
          { label: 'Critical (75–100%)', level: 'critical' },
        ].map(l => (
          <span key={l.level} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 14, height: 14, borderRadius: 4,
              background: HEAT_STYLES[l.level].bg,
              border: `1px solid ${HEAT_STYLES[l.level].border}`,
            }} />
            <span>{l.label}</span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontStyle: 'italic', color: 'var(--text-quaternary)' }}>
          {selectedLGA ? 'LGA-specific patterns derived from MPI, NDVI, rainfall & conflict data' : 'Aggregated across filtered LGAs · Current month highlighted'}
        </span>
      </div>
    </div>
  );
}
