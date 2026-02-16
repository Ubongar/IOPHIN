/**
 * Type definitions for IOPHIN Poverty Hotspot Identifier System
 */

export interface HotspotProperties {
  LGA_Name: string;
  State: string;
  cluster_label: string;
  risk_level: 'High' | 'Medium' | 'Low' | 'Minimal';
  mean_nightlight_intensity: number;
  MPI: number;
  Headcount_Ratio?: number;
  Intensity_of_Deprivation?: number;
  In_Severe_Poverty?: number;
  conflict_flag?: 'NORMAL' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  last_conflict_event?: string;
  last_updated?: string;
  data_source?: string;
}

export interface HotspotFeature {
  type: 'Feature';
  properties: HotspotProperties;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface HotspotsGeoJSON {
  type: 'FeatureCollection';
  name?: string;
  crs?: any;
  features: HotspotFeature[];
}

export interface Stats {
  totalLGAs: number;
  riskDistribution: {
    high: number;
    medium: number;
    low: number;
    minimal: number;
  };
  averageMPI: string;
  averageNightlight: string;
  statesCount: number;
  conflictZones?: number;
  dataSource?: string;
  timestamp: string;
}

export type RiskLevel = 'High' | 'Medium' | 'Low' | 'Minimal';

export const RISK_COLORS: Record<RiskLevel, string> = {
  High: '#EF4444',
  Medium: '#F59E0B',
  Low: '#10B981',
  Minimal: '#3B82F6',
};
