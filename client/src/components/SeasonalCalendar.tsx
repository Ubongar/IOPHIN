import { useState } from 'react';
import type { HotspotFeature } from '../types';

interface Props {
  features: HotspotFeature[];
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ROWS = ['Food Insecurity', 'Flood Risk', 'Drought Risk', 'Conflict Pattern'];

// Synthetic seasonal patterns (would be replaced with real data from API)
const PATTERNS: Record<string, number[]> = {
  'Food Insecurity': [0.7, 0.8, 0.9, 0.8, 0.6, 0.4, 0.3, 0.3, 0.4, 0.5, 0.6, 0.7],
  'Flood Risk':      [0.1, 0.1, 0.2, 0.4, 0.6, 0.8, 0.9, 0.9, 0.7, 0.4, 0.2, 0.1],
  'Drought Risk':    [0.8, 0.7, 0.6, 0.4, 0.2, 0.1, 0.1, 0.1, 0.2, 0.3, 0.5, 0.7],
  'Conflict Pattern':[0.4, 0.3, 0.4, 0.5, 0.6, 0.5, 0.4, 0.4, 0.5, 0.6, 0.5, 0.4],
};

function heatColor(val: number) {
  if (val >= 0.75) return 'bg-red-600';
  if (val >= 0.5) return 'bg-amber-500';
  if (val >= 0.25) return 'bg-yellow-400';
  return 'bg-green-500';
}

export default function SeasonalCalendar({ features }: Props) {
  const [selectedLGA, setSelectedLGA] = useState('');
  const lgaNames = [...new Set(features.map(f => f.properties.LGA_Name))].sort();

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-bold text-gray-100">Seasonal Vulnerability</h2>
        <select className="text-xs bg-gray-700 text-gray-200 rounded px-2 py-1 border border-gray-600"
          value={selectedLGA} onChange={e => setSelectedLGA(e.target.value)}>
          <option value="">Select LGA...</option>
          {lgaNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left py-1 pr-3 text-gray-400 w-32">Dimension</th>
              {MONTHS.map(m => <th key={m} className="text-center py-1 px-1 text-gray-400 w-10">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(row => (
              <tr key={row}>
                <td className="py-1 pr-3 text-gray-300 text-xs">{row}</td>
                {PATTERNS[row].map((val, i) => (
                  <td key={i} className="py-1 px-0.5 text-center">
                    <div className={`w-8 h-6 rounded text-white text-xs flex items-center justify-center mx-auto ${heatColor(val)}`} title={`${(val*100).toFixed(0)}%`}>
                      {(val*100).toFixed(0)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex gap-2 items-center text-xs text-gray-400">
        <span>Low</span>
        <div className="w-6 h-3 bg-green-500 rounded"></div>
        <div className="w-6 h-3 bg-yellow-400 rounded"></div>
        <div className="w-6 h-3 bg-amber-500 rounded"></div>
        <div className="w-6 h-3 bg-red-600 rounded"></div>
        <span>High</span>
      </div>
    </div>
  );
}
