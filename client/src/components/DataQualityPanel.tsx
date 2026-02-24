import { formatDistanceToNow } from 'date-fns';
import { useMemo } from 'react';
import type { HotspotFeature } from '../types';

interface Props {
  features: HotspotFeature[];
  searchQuery?: string;
  stateFilter?: string;
}

const TRACKED_FIELDS = ['MPI', 'mean_nightlight_intensity', 'composite_poverty_score',
  'health_facility_count', 'school_count', 'ndvi_mean', 'rainfall_mm', 'idp_count', 'food_price_index'];

function qualityColor(confidence: number) {
  if (confidence >= 0.8) return '#4ade80';
  if (confidence >= 0.5) return '#fbbf24';
  return '#f87171';
}

export default function DataQualityPanel({ features, searchQuery = '', stateFilter = '' }: Props) {
  // First filter features based on search and state filter
  const filteredFeatures = useMemo(() => {
    let list = [...features];
    
    if (stateFilter) {
      list = list.filter(f => f.properties.State === stateFilter);
    }
    
    if (searchQuery.length >= 2) {
      const term = searchQuery.toLowerCase();
      list = list.filter(f =>
        f.properties.LGA_Name.toLowerCase().includes(term) ||
        f.properties.State.toLowerCase().includes(term)
      );
    }
    
    return list;
  }, [features, searchQuery, stateFilter]);

  const stats = useMemo(() => 
    filteredFeatures.map(f => {
      const p = f.properties as any;
      const filled = TRACKED_FIELDS.filter(k => p[k] != null && !isNaN(p[k])).length;
      const confidence = filled / TRACKED_FIELDS.length;
      const lastUpdated = p.last_updated;
      return { name: p.LGA_Name, state: p.State, confidence, filled, lastUpdated };
    }).sort((a, b) => a.confidence - b.confidence),
    [filteredFeatures]
  );

  const avgConf = stats.length > 0
    ? (stats.reduce((s, r) => s + r.confidence, 0) / stats.length * 100).toFixed(1) : '0';
  const staleCount = stats.filter(s => !s.lastUpdated).length;

  const SUMMARY = [
    { value: `${avgConf}%`, label: 'Avg Completeness', color: '#4ade80' },
    { value: stats.length, label: 'Total LGAs', color: 'var(--blue)' },
    { value: staleCount, label: 'No Update Date', color: '#fbbf24' },
  ];

  return (
    <div>
      <div className="rankings-header">
        <h2 className="rankings-title">Data Quality</h2>
        <p className="rankings-subtitle">
          Field completeness across {stats.length} LGAs
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {SUMMARY.map(s => (
          <div key={s.label} className="metric-card">
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rankings-table-wrap">
        <table className="rankings-table">
          <thead>
            <tr>
              <th>LGA</th>
              <th>State</th>
              <th style={{ textAlign: 'center' }}>Fields</th>
              <th style={{ textAlign: 'center' }}>Confidence</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {stats.slice(0, 50).map((s, i) => (
              <tr key={i} className="rankings-row">
                <td className="lga-cell">{s.name}</td>
                <td>{s.state}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className="mono-cell">{s.filled}/{TRACKED_FIELDS.length}</span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className="risk-pill" style={{
                    background: `${qualityColor(s.confidence)}18`,
                    color: qualityColor(s.confidence),
                  }}>
                    {(s.confidence * 100).toFixed(0)}%
                  </span>
                </td>
                <td style={{ color: 'var(--text-quaternary)', fontSize: 11 }}>
                  {s.lastUpdated ? formatDistanceToNow(new Date(s.lastUpdated), { addSuffix: true }) : '⚠ Unknown'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
