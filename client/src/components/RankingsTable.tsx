/**
 * RankingsTable — Top-N worst/best LGAs by composite poverty score
 */

import { useState } from 'react';
import { RISK_COLORS } from '../types';
import type { RankingEntry, RiskLevel } from '../types';

interface Props {
  rankings: RankingEntry[];
  onSelectLGA: (lgaName: string) => void;
}

const fmt = (n: number, d = 2) => (n != null ? n.toFixed(d) : '—');

const RankingsTable: React.FC<Props> = ({ rankings, onSelectLGA }) => {
  const [order, setOrder] = useState<'worst' | 'best'>('worst');

  const sorted = order === 'best'
    ? [...rankings].sort((a, b) => a.compositeScore - b.compositeScore)
    : [...rankings].sort((a, b) => b.compositeScore - a.compositeScore);

  return (
    <div className="rankings-container">
      <div className="rankings-header">
        <div>
          <h2 className="rankings-title">LGA Poverty Rankings</h2>
          <p className="rankings-subtitle">Ranked by composite poverty score</p>
        </div>
        <div className="rankings-toggle">
          <button
            onClick={() => setOrder('worst')}
            className={'rankings-toggle-btn' + (order === 'worst' ? ' active' : '')}
          >
            Most Deprived
          </button>
          <button
            onClick={() => setOrder('best')}
            className={'rankings-toggle-btn' + (order === 'best' ? ' active' : '')}
          >
            Least Deprived
          </button>
        </div>
      </div>

      <div className="rankings-table-wrap">
        <table className="rankings-table">
          <thead>
            <tr>
              <th>#</th>
              <th>LGA</th>
              <th>State</th>
              <th>Composite</th>
              <th>MPI</th>
              <th>Nightlight</th>
              <th>Risk</th>
              <th>Health Fac.</th>
              <th>Schools</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={r.lgaName + r.state}
                className="rankings-row"
                onClick={() => onSelectLGA(r.lgaName)}
              >
                <td className="rank-cell">{i + 1}</td>
                <td className="lga-cell">{r.lgaName}</td>
                <td>{r.state}</td>
                <td className="mono-cell">{fmt(r.compositeScore, 4)}</td>
                <td className="mono-cell">{fmt(r.mpi, 4)}</td>
                <td className="mono-cell">{fmt(r.nightlight)}</td>
                <td>
                  <span
                    className="risk-pill"
                    style={{ background: (RISK_COLORS[r.riskLevel as RiskLevel] || '#999') + '30',
                             color: RISK_COLORS[r.riskLevel as RiskLevel] || '#999' }}
                  >
                    {r.riskLevel}
                  </span>
                </td>
                <td className="mono-cell">{r.healthFacilities}</td>
                <td className="mono-cell">{r.schools}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rankings.length === 0 && (
        <div className="rankings-empty">
          <p>No ranking data available. Rankings require database mode.</p>
        </div>
      )}
    </div>
  );
};

export default RankingsTable;
