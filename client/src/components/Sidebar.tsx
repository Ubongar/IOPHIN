/**
 * Sidebar Component - Analytics Panel
 * Displays national summary or detailed LGA analytics
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { RISK_COLORS } from '../types';
import type { HotspotFeature, Stats } from '../types';

interface SidebarProps {
  stats: Stats | null;
  selectedLGA: HotspotFeature | null;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ stats, selectedLGA, onClose }) => {
  // Prepare pie chart data
  const getPieData = () => {
    if (!stats) return [];
    return [
      { name: 'High Risk', value: stats.riskDistribution.high, color: RISK_COLORS.High },
      { name: 'Medium Risk', value: stats.riskDistribution.medium, color: RISK_COLORS.Medium },
      { name: 'Low Risk', value: stats.riskDistribution.low, color: RISK_COLORS.Low },
      { name: 'Minimal Risk', value: stats.riskDistribution.minimal, color: RISK_COLORS.Minimal },
    ];
  };

  /**
   * Calculate poverty probability gauge (0-100%)
   * Based on MPI score and inverse nightlight intensity
   */
  const calculatePovertyProbability = (mpi: number, nightlight: number): number => {
    // Normalize MPI (typically 0-1 range)
    const mpiScore = Math.min(mpi * 100, 100);
    
    // Normalize nightlight (inverse - lower is worse)
    // Assuming nightlight range 0-60, invert it
    const nightlightScore = Math.max(0, 100 - (nightlight / 60) * 100);
    
    // Weighted average: MPI has more weight
    const probability = (mpiScore * 0.7) + (nightlightScore * 0.3);
    
    return Math.min(Math.max(probability, 0), 100);
  };

  /**
   * Render National Summary
   */
  const renderNationalSummary = () => {
    if (!stats) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white/80">Loading statistics...</p>
          </div>
        </div>
      );
    }

    const pieData = getPieData();

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">National Overview</h2>
          <p className="text-white/70 text-sm">Poverty hotspot distribution across Nigeria</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-dark rounded-lg p-4">
            <div className="text-white/60 text-xs uppercase tracking-wide mb-1">Total LGAs</div>
            <div className="text-3xl font-bold text-white">{stats.totalLGAs}</div>
          </div>
          <div className="glass-dark rounded-lg p-4">
            <div className="text-white/60 text-xs uppercase tracking-wide mb-1">States</div>
            <div className="text-3xl font-bold text-white">{stats.statesCount}</div>
          </div>
          <div className="glass-dark rounded-lg p-4">
            <div className="text-white/60 text-xs uppercase tracking-wide mb-1">Avg MPI</div>
            <div className="text-3xl font-bold text-white">{stats.averageMPI}</div>
          </div>
          <div className="glass-dark rounded-lg p-4">
            <div className="text-white/60 text-xs uppercase tracking-wide mb-1">Avg Nightlight</div>
            <div className="text-3xl font-bold text-white">{stats.averageNightlight}</div>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="glass-dark rounded-lg p-4">
          <h3 className="text-white font-semibold mb-4">Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value} (${((percent || 0) * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Breakdown */}
        <div className="glass-dark rounded-lg p-4">
          <h3 className="text-white font-semibold mb-3">Detailed Breakdown</h3>
          <div className="space-y-3">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-white/90 text-sm">{item.name}</span>
                </div>
                <span className="text-white font-semibold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /**
   * Render LGA Profile Card
   */
  const renderLGAProfile = () => {
    if (!selectedLGA) return null;

    const { LGA_Name, State, risk_level, MPI, mean_nightlight_intensity, cluster_label } = selectedLGA.properties;
    const povertyProbability = calculatePovertyProbability(MPI, mean_nightlight_intensity);

    return (
      <div className="space-y-6">
        {/* Header with close button */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{LGA_Name}</h2>
            <p className="text-white/70 text-sm">{State} State</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="glass-dark rounded-lg p-2 hover:bg-white/20 transition-all"
              aria-label="Close"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Risk Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white font-semibold shadow-lg"
          style={{ backgroundColor: RISK_COLORS[risk_level] }}
        >
          <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
          {cluster_label}
        </div>

        {/* Key Indicators */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-dark rounded-lg p-4">
            <div className="text-white/60 text-xs uppercase tracking-wide mb-1">MPI Score</div>
            <div className="text-3xl font-bold text-white">{MPI.toFixed(4)}</div>
            <div className="text-white/50 text-xs mt-1">Multidimensional Poverty Index</div>
          </div>
          <div className="glass-dark rounded-lg p-4">
            <div className="text-white/60 text-xs uppercase tracking-wide mb-1">Nightlight</div>
            <div className="text-3xl font-bold text-white">{mean_nightlight_intensity.toFixed(2)}</div>
            <div className="text-white/50 text-xs mt-1">Mean Intensity</div>
          </div>
        </div>

        {/* Poverty Probability Gauge */}
        <div className="glass-dark rounded-lg p-6">
          <h3 className="text-white font-semibold mb-4">Poverty Probability</h3>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block text-white">
                  {povertyProbability.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-white/20">
              <div
                style={{ width: `${povertyProbability}%`, backgroundColor: RISK_COLORS[risk_level] }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500"
              />
            </div>
            <p className="text-white/60 text-xs">
              Calculated from MPI score and nightlight intensity
            </p>
          </div>
        </div>

        {/* Comparative Analysis */}
        <div className="glass-dark rounded-lg p-4">
          <h3 className="text-white font-semibold mb-3">Comparative Analysis</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/70">MPI vs National Avg</span>
                <span className="text-white font-medium">
                  {stats ? ((MPI / parseFloat(stats.averageMPI)) * 100).toFixed(0) : '--'}%
                </span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${stats ? Math.min((MPI / parseFloat(stats.averageMPI)) * 100, 100) : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/70">Nightlight vs National Avg</span>
                <span className="text-white font-medium">
                  {stats ? ((mean_nightlight_intensity / parseFloat(stats.averageNightlight)) * 100).toFixed(0) : '--'}%
                </span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${stats ? Math.min((mean_nightlight_intensity / parseFloat(stats.averageNightlight)) * 100, 100) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Download Report Button */}
        <button className="w-full glass-dark rounded-lg px-6 py-3 text-white font-semibold hover:bg-white/20 transition-all flex items-center justify-center gap-2 shadow-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Report
        </button>
      </div>
    );
  };

  return (
    <div className="h-full glass-dark rounded-r-2xl shadow-2xl overflow-y-auto p-6">
      {selectedLGA ? renderLGAProfile() : renderNationalSummary()}
    </div>
  );
};

export default Sidebar;
