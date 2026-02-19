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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-orange-400">Crisis Corridor LGAs ({corridorLGAs.length})</h3>
        {corridorLGAs.length > 0 && (
          <button onClick={() => onShowOnMap?.(corridorLGAs.map(l => l.name))}
            className="text-xs bg-orange-700 hover:bg-orange-600 text-white px-2 py-1 rounded">
            Show on Map
          </button>
        )}
      </div>
      {corridorLGAs.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No crisis corridors detected.</p>
      ) : (
        <div className="overflow-auto max-h-64">
          <table className="w-full text-xs text-gray-300">
            <thead className="text-gray-400 border-b border-gray-700">
              <tr>
                <th className="text-left py-1 pr-2">LGA</th>
                <th className="text-left py-1 pr-2">State</th>
                <th className="text-center py-1 pr-2"># Dims</th>
                <th className="text-left py-1">Dimensions</th>
              </tr>
            </thead>
            <tbody>
              {corridorLGAs.map((l, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-700">
                  <td className="py-1 pr-2 font-medium text-orange-300">{l.name}</td>
                  <td className="py-1 pr-2">{l.state}</td>
                  <td className="py-1 pr-2 text-center font-bold text-orange-400">{l.badCount}</td>
                  <td className="py-1 text-gray-400">{l.dims.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
