import type { HotspotFeature, RiskLevel } from '../types';

export const ABSOLUTE_THRESHOLDS: Record<RiskLevel, number> = {
  Minimal: 0.05,
  Low: 0.10,
  Medium: 0.20,
  High: 0.40,
  Critical: 1.0,
};

export function getDynamicRiskLevel(feature: HotspotFeature, mode: 'cluster' | 'absolute'): RiskLevel {
  if (mode === 'cluster') {
    return (feature.properties?.risk_level as RiskLevel) || 'Minimal';
  }

  const score = feature.properties?.composite_poverty_score;
  if (score == null || Number.isNaN(Number(score))) return (feature.properties?.risk_level as RiskLevel) || 'Minimal';
  const s = Number(score);
  if (s <= ABSOLUTE_THRESHOLDS.Minimal) return 'Minimal';
  if (s <= ABSOLUTE_THRESHOLDS.Low) return 'Low';
  if (s <= ABSOLUTE_THRESHOLDS.Medium) return 'Medium';
  if (s <= ABSOLUTE_THRESHOLDS.High) return 'High';
  return 'Critical';
}

export default getDynamicRiskLevel;
