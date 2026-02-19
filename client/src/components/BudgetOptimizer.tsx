import { useState } from 'react';
import type { HotspotFeature } from '../types';

interface Props {
  features: HotspotFeature[];
  onSelectLGA?: (name: string) => void;
}

interface Recommendation {
  name: string;
  state: string;
  score: number;
  allocated: number;
  composite: number;
  population: number;
}

export default function BudgetOptimizer({ features, onSelectLGA }: Props) {
  const [budget, setBudget] = useState(1000000);

  const ranked: Recommendation[] = features
    .map(f => {
      const p = f.properties as any;
      const composite = p.composite_poverty_score ?? 0;
      const pop = p.population_density ?? 1;
      const dist = Math.max(p.distance_to_urban_km ?? 10, 1);
      const score = (composite * pop) / dist;
      return { name: p.LGA_Name, state: p.State, score, composite, population: pop, allocated: 0 };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const totalScore = ranked.reduce((s, r) => s + r.score, 0);
  const withBudget = ranked.map(r => ({
    ...r,
    allocated: totalScore > 0 ? (r.score / totalScore) * budget : 0,
  }));

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-gray-100 mb-4">Budget Optimizer</h2>
      <div className="mb-4">
        <label className="text-xs text-gray-400 mb-1 block">Total Budget: ${budget.toLocaleString()}</label>
        <input type="range" min={100000} max={50000000} step={100000} value={budget}
          onChange={e => setBudget(Number(e.target.value))}
          className="w-full accent-blue-500" />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>$100K</span><span>$50M</span>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Ranked by: <code className="bg-gray-700 px-1 rounded">composite_score × population_density / distance_to_urban</code>
      </p>
      <div className="overflow-auto max-h-80">
        <table className="w-full text-xs text-gray-300">
          <thead className="text-gray-400 border-b border-gray-700">
            <tr>
              <th className="text-left py-1 pr-2">#</th>
              <th className="text-left py-1 pr-2">LGA</th>
              <th className="text-left py-1 pr-2">State</th>
              <th className="text-right py-1 pr-2">Score</th>
              <th className="text-right py-1">Allocated</th>
            </tr>
          </thead>
          <tbody>
            {withBudget.map((r, i) => (
              <tr key={i} className="border-b border-gray-800 hover:bg-gray-700">
                <td className="py-1 pr-2 text-gray-500">{i + 1}</td>
                <td className="py-1 pr-2">
                  <button className="text-blue-400 hover:underline" onClick={() => onSelectLGA?.(r.name)}>{r.name}</button>
                </td>
                <td className="py-1 pr-2">{r.state}</td>
                <td className="py-1 pr-2 text-right font-mono">{r.score.toFixed(2)}</td>
                <td className="py-1 text-right font-mono text-green-400">${Math.round(r.allocated).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
