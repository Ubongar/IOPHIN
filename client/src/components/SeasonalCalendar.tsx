import { useState, useMemo } from 'react';
import type { HotspotFeature } from '../types';

interface Props {
  features: HotspotFeature[];
  searchQuery?: string;
  stateFilter?: string;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ROWS = ['Food Insecurity', 'Flood Risk', 'Drought Risk', 'Conflict Pattern'];

const PATTERNS: Record<string, number[]> = {
  'Food Insecurity': [0.7, 0.8, 0.9, 0.8, 0.6, 0.4, 0.3, 0.3, 0.4, 0.5, 0.6, 0.7],
  'Flood Risk':      [0.1, 0.1, 0.2, 0.4, 0.6, 0.8, 0.9, 0.9, 0.7, 0.4, 0.2, 0.1],
  'Drought Risk':    [0.8, 0.7, 0.6, 0.4, 0.2, 0.1, 0.1, 0.1, 0.2, 0.3, 0.5, 0.7],
  'Conflict Pattern':[0.4, 0.3, 0.4, 0.5, 0.6, 0.5, 0.4, 0.4, 0.5, 0.6, 0.5, 0.4],
};

const HEAT_STYLES: Record<string, { bg: string; border: string }> = {
  critical: { bg: 'rgba(239,68,68,.18)', border: 'rgba(239,68,68,.35)' },
  high:     { bg: 'rgba(245,158,11,.18)', border: 'rgba(245,158,11,.35)' },
  medium:   { bg: 'rgba(234,179,8,.15)',  border: 'rgba(234,179,8,.3)' },
  low:      { bg: 'rgba(16,185,129,.15)', border: 'rgba(16,185,129,.3)' },
};

const HEAT_TEXT: Record<string, string> = {
  critical: '#f87171',
  high: '#fbbf24',
  medium: '#facc15',
  low: '#34d399',
};

function heatLevel(val: number): string {
  if (val >= 0.75) return 'critical';
  if (val >= 0.5) return 'high';
  if (val >= 0.25) return 'medium';
  return 'low';
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

  const currentMonth = new Date().getMonth();

  return (
    <div className="rankings-container">
      <div className="rankings-header">
        <div>
          <h2 className="rankings-title">Seasonal Vulnerability</h2>
          <p className="rankings-subtitle">
            Monthly risk patterns across key dimensions
          </p>
        </div>
        <select
          className="filter-select"
          aria-label="Filter by LGA"
          value={selectedLGA}
          onChange={e => setSelectedLGA(e.target.value)}
        >
          <option value="">All LGAs (National)</option>
          {lgaNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

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
                {PATTERNS[row].map((val, i) => {
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
        display: 'flex', gap: 16, alignItems: 'center',
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
          Current month highlighted
        </span>
      </div>
    </div>
  );
}
