/**
 * StateOverview — Aggregated state-level analytics table
 * Supports search text filtering for cross-view search.
 */

import { useMemo } from 'react';
import type { StateAggregation } from '../types';

interface Props {
  states: StateAggregation[];
  onSelectState: (state: string) => void;
  searchQuery?: string;
}

const fmt = (n: number, d = 2) => (n != null ? n.toFixed(d) : '—');

const StateOverview: React.FC<Props> = ({ states, onSelectState, searchQuery = '' }) => {
  const filtered = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return states;
    const term = searchQuery.toLowerCase();
    return states.filter(s => s.state.toLowerCase().includes(term));
  }, [states, searchQuery]);
  return (
    <div className="rankings-container">
      <div className="rankings-header">
        <div>
          <h2 className="rankings-title">State Overview</h2>
          <p className="rankings-subtitle">
            {filtered.length === states.length
              ? `${states.length} states — aggregated metrics`
              : `${filtered.length} of ${states.length} states — filtered`}
          </p>
        </div>
      </div>

      <div className="rankings-table-wrap">
        <table className="rankings-table">
          <thead>
            <tr>
              <th>State</th>
              <th>LGAs</th>
              <th>Avg Composite</th>
              <th className="hide-mobile">Avg MPI</th>
              <th className="hide-mobile">Avg Nightlight</th>
              <th>High Risk</th>
              <th className="hide-mobile">Health Fac.</th>
              <th className="hide-mobile">Schools</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr
                key={s.state}
                className="rankings-row"
                onClick={() => onSelectState(s.state)}
              >
                <td className="lga-cell">{s.state}</td>
                <td className="mono-cell">{s.lgaCount}</td>
                <td className="mono-cell">{fmt(s.avgCompositeScore, 4)}</td>
                <td className="mono-cell hide-mobile">{fmt(s.avgMPI, 4)}</td>
                <td className="mono-cell hide-mobile">{fmt(s.avgNightlight)}</td>
                <td className="mono-cell">
                  <span className={s.highRiskCount > 0 ? 'text-red-400 font-semibold' : ''}>
                    {s.highRiskCount}
                  </span>
                </td>
                <td className="mono-cell hide-mobile">{s.totalHealthFacilities}</td>
                <td className="mono-cell hide-mobile">{s.totalSchools}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && states.length > 0 && (
        <div className="rankings-empty">
          <p>No states match your search. Try a different term.</p>
        </div>
      )}

      {states.length === 0 && (
        <div className="rankings-empty">
          <p>No state data available. State aggregation requires database mode.</p>
        </div>
      )}
    </div>
  );
};

export default StateOverview;
