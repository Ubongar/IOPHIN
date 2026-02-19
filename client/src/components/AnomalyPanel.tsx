import { formatDistanceToNow } from 'date-fns';
import type { AnomalyAlert } from '../types';

interface Props {
  anomalies: AnomalyAlert[];
  onSelectLGA?: (name: string) => void;
  onAcknowledge?: (id: number) => void;
  userRole?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-purple-400', high: 'text-red-400', medium: 'text-amber-400', low: 'text-blue-400',
};

export default function AnomalyPanel({ anomalies, onSelectLGA, onAcknowledge, userRole }: Props) {
  const active = anomalies.filter(a => !a.acknowledged);

  if (active.length === 0) {
    return <div className="text-gray-500 text-sm text-center py-6">✅ No active anomalies</div>;
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {active.map(a => (
        <div key={a.id} className="bg-gray-800 rounded p-3 border border-gray-700">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <span className={`text-sm font-bold ${SEVERITY_COLORS[a.severity] || 'text-gray-300'}`}>
                  ⚠ {a.severity?.toUpperCase()}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(a.detected_at), { addSuffix: true })}
                </span>
              </div>
              <button
                className="text-sm font-semibold text-blue-400 hover:underline text-left"
                onClick={() => onSelectLGA?.(a.lga_name)}
              >
                {a.lga_name}
              </button>
              <span className="text-xs text-gray-400 ml-1">({a.state})</span>
              <p className="text-xs text-gray-400 mt-0.5">{a.description}</p>
              {a.deviation_pct != null && (
                <p className="text-xs text-amber-400">Deviation: {a.deviation_pct.toFixed(1)}%</p>
              )}
            </div>
            {(userRole === 'admin' || userRole === 'government') && (
              <button
                onClick={() => onAcknowledge?.(a.id)}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded shrink-0"
              >
                Ack
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
