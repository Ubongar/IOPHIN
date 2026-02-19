import { useState } from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { StateAggregation } from '../types';

const COLORS = ['#3B82F6', '#EF4444', '#10B981'];

interface Props {
  states: StateAggregation[];
}

function normalize(val: number, max: number) {
  return max > 0 ? (val / max) * 100 : 0;
}

export default function RadarComparison({ states }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  const stateNames = states.map(s => s.state).sort();
  const selectedStates = states.filter(s => selected.includes(s.state));

  const maxMpi = Math.max(...states.map(s => s.avgMPI || 0), 1);
  const maxComposite = Math.max(...states.map(s => s.avgCompositeScore || 0), 1);
  const maxHighRisk = Math.max(...states.map(s => s.highRiskCount || 0), 1);
  const maxHealth = Math.max(...states.map(s => s.totalHealthFacilities || 0), 1);
  const maxSchools = Math.max(...states.map(s => s.totalSchools || 0), 1);
  const maxPop = Math.max(...states.map(s => s.avgPopulationDensity || 0), 1);

  const dimensions = ['MPI', 'Composite Score', 'High Risk LGAs', 'Health Facilities', 'Schools', 'Pop Density'];

  const radarData = dimensions.map(dim => {
    const entry: Record<string, any> = { dimension: dim };
    selectedStates.forEach(s => {
      const val = dim === 'MPI' ? normalize(s.avgMPI, maxMpi)
        : dim === 'Composite Score' ? normalize(s.avgCompositeScore, maxComposite)
        : dim === 'High Risk LGAs' ? normalize(s.highRiskCount, maxHighRisk)
        : dim === 'Health Facilities' ? normalize(s.totalHealthFacilities, maxHealth)
        : dim === 'Schools' ? normalize(s.totalSchools, maxSchools)
        : normalize(s.avgPopulationDensity, maxPop);
      entry[s.state] = val;
    });
    return entry;
  });

  const toggleState = (s: string) => {
    setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev.slice(-2), s]);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-3">
        {stateNames.map(s => (
          <button key={s} onClick={() => toggleState(s)}
            className={`text-xs px-2 py-0.5 rounded ${selected.includes(s) ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            {s}
          </button>
        ))}
      </div>
      {selectedStates.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">Select 2–3 states to compare</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
            <Tooltip contentStyle={{ background: '#1F2937', border: '1px solid #374151', fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {selectedStates.map((s, i) => (
              <Radar key={s.state} name={s.state} dataKey={s.state}
                stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
