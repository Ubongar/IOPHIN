import { formatDistanceToNow } from 'date-fns';
import type { HotspotFeature } from '../types';

interface Props {
  features: HotspotFeature[];
}

const TRACKED_FIELDS = ['MPI', 'mean_nightlight_intensity', 'composite_poverty_score',
  'health_facility_count', 'school_count', 'ndvi_mean', 'rainfall_mm', 'idp_count', 'food_price_index'];

function qualityColor(confidence: number) {
  if (confidence >= 0.8) return 'text-green-400';
  if (confidence >= 0.5) return 'text-amber-400';
  return 'text-red-400';
}

export default function DataQualityPanel({ features }: Props) {
  const stats = features.map(f => {
    const p = f.properties as any;
    const filled = TRACKED_FIELDS.filter(k => p[k] != null && !isNaN(p[k])).length;
    const confidence = filled / TRACKED_FIELDS.length;
    const lastUpdated = p.last_updated;
    return { name: p.LGA_Name, state: p.State, confidence, filled, lastUpdated };
  }).sort((a, b) => a.confidence - b.confidence);

  const avgConf = stats.length > 0
    ? (stats.reduce((s, r) => s + r.confidence, 0) / stats.length * 100).toFixed(1) : '0';
  const staleCount = stats.filter(s => !s.lastUpdated).length;

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-gray-100 mb-2">Data Quality</h2>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-800 rounded p-3 text-center">
          <div className="text-xl font-bold text-green-400">{avgConf}%</div>
          <div className="text-xs text-gray-400">Avg Completeness</div>
        </div>
        <div className="bg-gray-800 rounded p-3 text-center">
          <div className="text-xl font-bold text-blue-400">{stats.length}</div>
          <div className="text-xs text-gray-400">Total LGAs</div>
        </div>
        <div className="bg-gray-800 rounded p-3 text-center">
          <div className="text-xl font-bold text-amber-400">{staleCount}</div>
          <div className="text-xs text-gray-400">No Update Date</div>
        </div>
      </div>
      <div className="overflow-auto max-h-64">
        <table className="w-full text-xs text-gray-300">
          <thead className="text-gray-400 border-b border-gray-700">
            <tr>
              <th className="text-left py-1 pr-2">LGA</th>
              <th className="text-left py-1 pr-2">State</th>
              <th className="text-center py-1 pr-2">Fields</th>
              <th className="text-center py-1 pr-2">Confidence</th>
              <th className="text-left py-1">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {stats.slice(0, 50).map((s, i) => (
              <tr key={i} className="border-b border-gray-800">
                <td className="py-1 pr-2">{s.name}</td>
                <td className="py-1 pr-2">{s.state}</td>
                <td className="py-1 pr-2 text-center">{s.filled}/{TRACKED_FIELDS.length}</td>
                <td className={`py-1 pr-2 text-center font-semibold ${qualityColor(s.confidence)}`}>
                  {(s.confidence * 100).toFixed(0)}%
                </td>
                <td className="py-1 text-gray-500">
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
