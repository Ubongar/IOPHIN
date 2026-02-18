/**
 * StateOverview — Aggregated state-level analytics table
 */

import type { StateAggregation } from '../types';

interface Props {
  states: StateAggregation[];
  onSelectState: (state: string) => void;
}

const fmt = (n: number, d = 2) => (n != null ? n.toFixed(d) : '—');

const StateOverview: React.FC<Props> = ({ states, onSelectState }) => {
  return (
    <div className="rankings-container">
      <div className="rankings-header">
        <div>
          <h2 className="rankings-title">State Overview</h2>
          <p className="rankings-subtitle">{states.length} states — aggregated metrics</p>
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
            {states.map((s) => (
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

      {states.length === 0 && (
        <div className="rankings-empty">
          <p>No state data available. State aggregation requires database mode.</p>
        </div>
      )}
    </div>
  );
};

export default StateOverview;
