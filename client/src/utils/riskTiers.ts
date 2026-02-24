import type { HotspotFeature, RiskLevel } from '../types';

// Absolute thresholds based on MPI (Multidimensional Poverty Index) values
// MPI ranges from 0-1, with higher values indicating more severe poverty
// These thresholds create meaningful differentiation from cluster-relative mode
export const ABSOLUTE_THRESHOLDS = {
  Minimal: 0.10,   // MPI < 0.10: Relatively stable
  Low: 0.20,       // MPI 0.10-0.20: Moderate vulnerability
  Medium: 0.30,    // MPI 0.20-0.30: Significant deprivation
  High: 0.40,      // MPI 0.30-0.40: Severe poverty
  Critical: 0.40,  // MPI > 0.40: Critical - Humanitarian emergency
};

// Alternative thresholds using composite_poverty_score (normalized 0-1 scale)
export const COMPOSITE_THRESHOLDS = {
  Minimal: 0.08,
  Low: 0.15,
  Medium: 0.25,
  High: 0.35,
  Critical: 0.35,
};

export function getDynamicRiskLevel(feature: HotspotFeature, mode: 'cluster' | 'absolute'): RiskLevel {
  if (mode === 'cluster') {
    return (feature.properties?.risk_level as RiskLevel) || 'Minimal';
  }

  // In absolute mode, use MPI directly for more meaningful absolute thresholds
  // MPI has a well-defined 0-1 scale with established poverty interpretations
  const mpi = feature.properties?.MPI;
  const compositeScore = feature.properties?.composite_poverty_score;
  
  // Prefer MPI for absolute thresholds as it has a standard 0-1 scale
  // Fall back to composite_poverty_score if MPI is not available
  let score: number | null = null;
  
  if (mpi != null && !Number.isNaN(Number(mpi))) {
    score = Number(mpi);
  } else if (compositeScore != null && !Number.isNaN(Number(compositeScore))) {
    score = Number(compositeScore);
    // Use composite thresholds when using composite score
    if (score <= COMPOSITE_THRESHOLDS.Minimal) return 'Minimal';
    if (score <= COMPOSITE_THRESHOLDS.Low) return 'Low';
    if (score <= COMPOSITE_THRESHOLDS.Medium) return 'Medium';
    if (score <= COMPOSITE_THRESHOLDS.High) return 'High';
    return 'Critical';
  }
  
  if (score == null) return (feature.properties?.risk_level as RiskLevel) || 'Minimal';
  
  // Use MPI-based absolute thresholds
  if (score < ABSOLUTE_THRESHOLDS.Minimal) return 'Minimal';
  if (score < ABSOLUTE_THRESHOLDS.Low) return 'Low';
  if (score < ABSOLUTE_THRESHOLDS.Medium) return 'Medium';
  if (score < ABSOLUTE_THRESHOLDS.High) return 'High';
  return 'Critical';
}

export default getDynamicRiskLevel;
