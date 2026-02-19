import type { HotspotFeature } from '../types';

interface Props {
  features: HotspotFeature[];
  onShowOnMap?: (names: string[]) => void;
}

const DIMENSIONS = [
  { key: 'composite_poverty_score', label: 'Composite Score' },
  { key: 'MPI', label: 'MPI' },
  { key: 'idp_count', label: 'IDP Count' },
  { key: 'food_price_index', label: 'Food Price' },
];

function getWorstQuartileCutoff(values: number[]) {
  const sorted = [...values].sort((a, b) => b - a);
  return sorted[Math.floor(sorted.length * 0.25)] ?? Infinity;
}

export default function CrisisCorridor({ features, onShowOnMap }: Props) {
  const props = features.map(f => f.properties);

  const cutoffs: Record<string, number> = {};
  DIMENSIONS.forEach(d => {
    const vals = props.map(p => (p as any)[d.key]).filter((v): v is number => typeof v === 'number' && !isNaN(v));
    cutoffs[d.key] = getWorstQuartileCutoff(vals);
  });

  const corridorLGAs = features
    .map(f => {
      const p = f.properties as any;
      const badDimensions = DIMENSIONS.filter(d => {
        const v = p[d.key];
        return typeof v === 'number' && v >= cutoffs[d.key];
      });
      return { name: f.properties.LGA_Name, state: f.properties.State,
        badCount: badDimensions.length, dims: badDimensions.map(d => d.label),
        composite: p.composite_poverty_score ?? 0 };
    })
    .filter(l => l.badCount >= 3)
    .sort((a, b) => b.badCount - a.badCount || b.composite - a.composite);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fb923c', marginBottom: 2 }}>
            Crisis Corridor LGAs
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
            {corridorLGAs.length} LGAs in worst quartile across 3+ dimensions
          </p>
        </div>
        {corridorLGAs.length > 0 && (
          <button onClick={() => onShowOnMap?.(corridorLGAs.map(l => l.name))}
            className="download-btn" style={{ width: 'auto', padding: '8px 16px', fontSize: 11, background: 'linear-gradient(135deg, #ea580c, #f97316)' }}>
            Show on Map
          </button>
        )}
      </div>
      {corridorLGAs.length === 0 ? (
        <div className="rankings-empty">
          <p>No crisis corridors detected.</p>
        </div>
      ) : (
        <div className="rankings-table-wrap">
          <table className="rankings-table">
            <thead>
              <tr>
                <th>LGA</th>
                <th>State</th>
                <th style={{ textAlign: 'center' }}># Dims</th>
                <th>Affected Dimensions</th>
              </tr>
            </thead>
            <tbody>
              {corridorLGAs.map((l, i) => (
                <tr key={i} className="rankings-row">
                  <td className="lga-cell" style={{ color: '#fb923c' }}>{l.name}</td>
                  <td>{l.state}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="risk-pill" style={{
                      background: l.badCount >= 4 ? 'rgba(239,68,68,.15)' : 'rgba(245,158,11,.15)',
                      color: l.badCount >= 4 ? '#f87171' : '#fbbf24',
                    }}>
                      {l.badCount}/{DIMENSIONS.length}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {l.dims.map(d => (
                        <span key={d} style={{
                          padding: '2px 8px', borderRadius: 6,
                          background: 'var(--bg-panel)', border: '1px solid var(--border)',
                          fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500,
                        }}>
                          {d}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
