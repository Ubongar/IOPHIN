import { useState, useMemo } from 'react';
import type { HotspotFeature } from '../types';

interface Props {
  features: HotspotFeature[];
  onSelectLGA?: (name: string) => void;
  searchQuery?: string;
  stateFilter?: string;
  riskFilter?: string;
}

interface Recommendation {
  name: string;
  state: string;
  score: number;
  allocated: number;
  composite: number;
  population: number;
  pct: number;
}

export default function BudgetOptimizer({ features, onSelectLGA, searchQuery = '', stateFilter = '', riskFilter = '' }: Props) {
  const [budget, setBudget] = useState(1000000);

  // First apply filters from the global search/filter
  const filteredFeatures = useMemo(() => {
    let list = [...features];
    
    // Apply state filter
    if (stateFilter) {
      list = list.filter(f => f.properties.State === stateFilter);
    }
    
    // Apply risk filter
    if (riskFilter) {
      list = list.filter(f => f.properties.risk_level === riskFilter);
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
  }, [features, searchQuery, stateFilter, riskFilter]);

  const ranked: Recommendation[] = useMemo(() => {
    const list = filteredFeatures
      .map(f => {
        const p = f.properties as any;
        const composite = p.composite_poverty_score ?? 0;
        const pop = p.population_density ?? 1;
        const dist = Math.max(p.distance_to_urban_km ?? 10, 1);
        const score = (composite * pop) / dist;
        return { name: p.LGA_Name, state: p.State, score, composite, population: pop, allocated: 0, pct: 0 };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    const totalScore = list.reduce((s, r) => s + r.score, 0);
    return list.map(r => ({
      ...r,
      allocated: totalScore > 0 ? (r.score / totalScore) * budget : 0,
      pct: totalScore > 0 ? (r.score / totalScore) * 100 : 0,
    }));
  }, [filteredFeatures, budget]);

  const formatBudget = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  };

  return (
    <div className="rankings-container">
      <div className="rankings-header">
        <div>
          <h2 className="rankings-title">Budget Optimizer</h2>
          <p className="rankings-subtitle">
            Optimal resource allocation across top 20 priority LGAs
          </p>
        </div>
      </div>

      {/* Budget Slider */}
      <div className="metric-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="metric-label" style={{ margin: 0 }}>Total Budget</span>
          <span className="metric-value" style={{ fontSize: 24, color: 'var(--blue-light)' }}>
            {formatBudget(budget)}
          </span>
        </div>
        <input type="range" min={100000} max={50000000} step={100000} value={budget}
          onChange={e => setBudget(Number(e.target.value))}
          className="budget-slider" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-quaternary)', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
          <span>$100K</span><span>$50M</span>
        </div>
      </div>

      {/* Formula explanation */}
      <div className="source-chip" style={{ marginBottom: 16 }}>
        <span className="source-label">Ranking Formula</span>
        <span className="source-value">score × pop_density / urban_distance</span>
      </div>

      {/* Allocation Table */}
      <div className="rankings-table-wrap">
        <table className="rankings-table">
          <thead>
            <tr>
              <th>#</th>
              <th>LGA</th>
              <th>State</th>
              <th className="hide-mobile">Priority Score</th>
              <th>Allocation</th>
              <th className="hide-mobile">Share</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => (
              <tr key={i} className="rankings-row" onClick={() => onSelectLGA?.(r.name)}>
                <td className="rank-cell">{i + 1}</td>
                <td className="lga-cell">
                  <button style={{ color: 'var(--blue-light)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600 }}
                    onClick={(e) => { e.stopPropagation(); onSelectLGA?.(r.name); }}>
                    {r.name}
                  </button>
                </td>
                <td>{r.state}</td>
                <td className="mono-cell hide-mobile">{r.score.toFixed(2)}</td>
                <td>
                  <span className="mono-cell" style={{ color: '#34d399', fontWeight: 700 }}>
                    ${Math.round(r.allocated).toLocaleString()}
                  </span>
                </td>
                <td className="mono-cell hide-mobile">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'var(--bg-panel)', overflow: 'hidden', minWidth: 40 }}>
                      <div style={{ width: `${r.pct}%`, height: '100%', borderRadius: 999, background: 'var(--blue-light)' }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-quaternary)', minWidth: 36, textAlign: 'right' }}>
                      {r.pct.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ranked.length === 0 && (
        <div className="rankings-empty">
          <p>No data available for budget optimization.</p>
        </div>
      )}
    </div>
  );
}
