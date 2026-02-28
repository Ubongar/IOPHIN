/**
 * RankingsTable — Top-N worst/best LGAs by composite poverty score
 * Supports search text & state/risk filter props for cross-view filtering.
 * Shows dynamic risk levels based on tiering mode (absolute vs relative)
 * Uses full hotspots dataset for accurate Most/Least Deprived rankings.
 */

import { useState, useMemo } from 'react';
import { RISK_COLORS } from '../types';
import type { RankingEntry, RiskLevel, HotspotsGeoJSON } from '../types';
import { useFilterStore } from '../store';
import { getDynamicRiskLevel } from '../utils/riskTiers';

interface Props {
  rankings: RankingEntry[];
  onSelectLGA: (lgaName: string) => void;
  searchQuery?: string;
  stateFilter?: string;
  riskFilter?: string;
  hotspotsData?: HotspotsGeoJSON | null;
}

const fmt = (n: number, d = 2) => (n != null ? n.toFixed(d) : '—');

// Helper to compute dynamic risk level from ranking entry using hotspots data
const getDynamicRiskFromRanking = (
  ranking: RankingEntry,
  hotspotsData: HotspotsGeoJSON | null | undefined,
  tieringMode: 'cluster' | 'absolute'
): RiskLevel => {
  if (!hotspotsData) {
    return ranking.riskLevel as RiskLevel;
  }

  // Find the matching feature in hotspots data
  const feature = hotspotsData.features.find(
    f => f.properties.LGA_Name === ranking.lgaName && f.properties.State === ranking.state
  );

  if (!feature) {
    return ranking.riskLevel as RiskLevel;
  }

  return getDynamicRiskLevel(feature, tieringMode);
};

const RankingsTable: React.FC<Props> = ({ rankings, onSelectLGA, searchQuery = '', stateFilter = '', riskFilter = '', hotspotsData }) => {
  const [order, setOrder] = useState<'worst' | 'best'>('worst');
  const tieringMode = useFilterStore((s) => s.tieringMode);

  // Build a complete ranking list from hotspotsData when available
  // This ensures "Least Deprived" shows truly least deprived LGAs (not just least-worst from top-50)
  const allRankings = useMemo((): RankingEntry[] => {
    if (!hotspotsData || hotspotsData.features.length === 0) return rankings;

    return hotspotsData.features
      .filter(f => f.properties.composite_poverty_score != null)
      .map((f, i) => ({
        rank: i + 1,
        lgaName: f.properties.LGA_Name,
        state: f.properties.State,
        mpi: f.properties.MPI ?? 0,
        nightlight: f.properties.mean_nightlight_intensity ?? 0,
        compositeScore: f.properties.composite_poverty_score ?? 0,
        riskLevel: f.properties.risk_level as RiskLevel,
        clusterLabel: f.properties.cluster_label ?? '',
        populationDensity: f.properties.population_density ?? 0,
        healthFacilities: f.properties.health_facility_count ?? 0,
        schools: f.properties.school_count ?? 0,
      }));
  }, [hotspotsData, rankings]);

  const sorted = useMemo(() => {
    let list = [...allRankings];

    // Apply search filter
    if (searchQuery.length >= 2) {
      const term = searchQuery.toLowerCase();
      list = list.filter(r =>
        r.lgaName.toLowerCase().includes(term) ||
        r.state.toLowerCase().includes(term)
      );
    }

    // Apply state filter
    if (stateFilter) {
      list = list.filter(r => r.state === stateFilter);
    }

    // Apply risk filter using dynamic risk levels
    if (riskFilter) {
      list = list.filter(r => {
        const dynamicRisk = getDynamicRiskFromRanking(r, hotspotsData, tieringMode);
        return dynamicRisk === riskFilter;
      });
    }

    // Sort by composite score:
    // Most Deprived (worst) = highest composite score first
    // Least Deprived (best) = lowest composite score first
    list.sort((a, b) =>
      order === 'best'
        ? a.compositeScore - b.compositeScore
        : b.compositeScore - a.compositeScore
    );

    return list;
  }, [allRankings, order, searchQuery, stateFilter, riskFilter, hotspotsData, tieringMode]);

  const totalCount = allRankings.length || rankings.length;

  return (
    <div className="rankings-container">
      <div className="rankings-header">
        <div>
          <h2 className="rankings-title">LGA Poverty Rankings</h2>
          <p className="rankings-subtitle">
            {sorted.length === totalCount
              ? `${totalCount} LGAs ranked by composite poverty score`
              : `${sorted.length} of ${totalCount} LGAs — filtered`}
          </p>
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
              <th className="hide-mobile">Nightlight</th>
              <th>Risk</th>
              <th className="hide-mobile">Health Fac.</th>
              <th className="hide-mobile">Schools</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const dynamicRisk = getDynamicRiskFromRanking(r, hotspotsData, tieringMode);
              return (
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
                  <td className="mono-cell hide-mobile">{fmt(r.nightlight)}</td>
                  <td>
                    <span
                      className="risk-pill"
                      style={{ background: (RISK_COLORS[dynamicRisk] || '#999') + '30',
                               color: RISK_COLORS[dynamicRisk] || '#999' }}
                    >
                      {dynamicRisk}
                    </span>
                  </td>
                  <td className="mono-cell hide-mobile">{r.healthFacilities}</td>
                  <td className="mono-cell hide-mobile">{r.schools}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && totalCount > 0 && (
        <div className="rankings-empty">
          <p>No LGAs match your search or filters. Try broadening your criteria.</p>
        </div>
      )}

      {totalCount === 0 && (
        <div className="rankings-empty">
          <p>No ranking data available. Rankings require database mode.</p>
        </div>
      )}
    </div>
  );
};

export default RankingsTable;
