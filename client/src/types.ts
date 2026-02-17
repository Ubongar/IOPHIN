/**
 * Type definitions for IOPHIN Poverty Hotspot Identifier System v2
 */

export interface HotspotProperties {
  LGA_Name: string;
  State: string;
  cluster_label: string;
  risk_level: RiskLevel;
  mean_nightlight_intensity: number;
  MPI: number;
  Headcount_Ratio?: number;
  Intensity_of_Depravation?: number;
  In_Severe_Poverty?: number;
  conflict_flag?: 'NORMAL' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  last_conflict_event?: string;
  last_updated?: string;
  data_source?: string;
  // v2 properties
  composite_poverty_score?: number;
  population_density?: number;
  health_facility_count?: number;
  school_count?: number;
  road_density_km?: number;
  ndvi_mean?: number;
  rainfall_mm?: number;
  distance_to_urban_km?: number;
  idp_count?: number;
  food_price_index?: number;
  senatorial_mpi?: number;
  clustering_method?: string;
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
    critical: number;
    high: number;
    medium: number;
    low: number;
    minimal: number;
  };
  averageMPI: string;
  averageNightlight: string;
  averageCompositeScore?: string;
  statesCount: number;
  conflictZones?: number;
  dataSource?: string;
  timestamp: string;
}

export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Minimal';

export const RISK_COLORS: Record<RiskLevel, string> = {
  Critical: '#7C3AED',
  High: '#EF4444',
  Medium: '#F59E0B',
  Low: '#10B981',
  Minimal: '#3B82F6',
};

// ── New v2 types ──────────────────────────────────────────────────────────

export interface HistoryPoint {
  date: string;
  lgaName: string;
  state: string;
  mpi: number;
  nightlight: number;
  compositeScore: number;
  riskLevel: RiskLevel;
  conflictFlag: string;
}

export interface StateAggregation {
  state: string;
  lgaCount: number;
  avgMPI: number;
  avgNightlight: number;
  avgCompositeScore: number;
  highRiskCount: number;
  avgPopulationDensity: number;
  totalHealthFacilities: number;
  totalSchools: number;
}

export interface RankingEntry {
  rank: number;
  lgaName: string;
  state: string;
  mpi: number;
  nightlight: number;
  compositeScore: number;
  riskLevel: RiskLevel;
  clusterLabel: string;
  populationDensity: number;
  healthFacilities: number;
  schools: number;
}

export type ViewMode = 'map' | 'rankings' | 'states';
