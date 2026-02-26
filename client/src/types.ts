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
  dynamic_risk?: RiskLevel;
}

import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';

export type HotspotFeature = Feature<Polygon | MultiPolygon, HotspotProperties>;
export type HotspotsGeoJSON = FeatureCollection<Polygon | MultiPolygon, HotspotProperties>;

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

// ── New upgrade types ────────────────────────────────────────────────────

export type ChoroplethMode = 'composite' | 'mpi' | 'nightlight' | 'conflict' | 'rainfall' | 'ndvi';
export type BasemapStyle = 'dark' | 'light' | 'satellite';

export interface TemporalTrend {
  lga_name: string;
  state: string;
  trend_slope: number;
  trend_class: 'Deteriorating Fast' | 'Deteriorating' | 'Stable' | 'Improving' | 'Improving Fast';
  months_at_current_tier: number;
  tier_crossings_6m: number;
}

export interface RiskForecast {
  id?: number;
  lga_name: string;
  state: string;
  forecast_date: string;
  current_risk_level: RiskLevel;
  predicted_risk_level: RiskLevel;
  confidence: number;
  forecast_horizon_months: number;
  predicted_composite_score?: number;
}

export interface AnomalyAlert {
  id: number;
  lga_name: string;
  state: string;
  anomaly_type: string;
  severity: string;
  description: string;
  metric_name: string;
  deviation_pct: number;
  detected_at: string;
  acknowledged: boolean;
}

export interface Intervention {
  id: number;
  lga_name: string;
  state: string;
  program_name: string;
  organization: string;
  intervention_type: string;
  start_date: string;
  end_date?: string;
  budget_usd?: number;
  beneficiaries?: number;
  status: 'active' | 'completed' | 'planned';
  mpi_before?: number;
  mpi_after?: number;
  impact_score?: number;
}

export interface CorrelationPoint {
  lga_name: string;
  state: string;
  x: number;
  y: number;
  risk_level: RiskLevel;
}

export interface SavedView {
  id: number;
  name: string;
  view_config: object;
  share_token: string;
  is_public: boolean;
  created_at: string;
}

export interface ChangeLogEntry {
  lga_name: string;
  state: string;
  old_risk_level: RiskLevel;
  new_risk_level: RiskLevel;
  delta_composite: number;
  changed_at: string;
}

export interface SeasonalVulnerability {
  month: number;
  month_name: string;
  food_insecurity_risk: number;
  flood_risk: number;
  drought_risk: number;
  overall_vulnerability: number;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'super_admin' | 'admin' | 'government' | 'ngo' | 'public' | 'user';
  organization?: string;
}

// ── RBAC Types ─────────────────────────────────────────────────────────────

export interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  is_system_role: boolean;
  created_at: string;
}

export interface Permission {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  module: string;
}

export interface GeographicScope {
  state: string;
  lga_name?: string;
}

export interface UserWithRBAC {
  id: number;
  username?: string;
  email: string;
  full_name: string;
  organization?: string;
  is_active: boolean;
  last_active?: string;
  last_login?: string;
  created_at: string;
  role_id: number;
  role_name: string;
  role_display_name: string;
  assigned_states?: string[];
  geographic_scopes?: GeographicScope[];
  permissions?: Permission[];
}

export interface UsersListResponse {
  users: UserWithRBAC[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  details: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
  performed_by_email?: string;
  performed_by_name?: string;
  target_email?: string;
  target_name?: string;
}

export type ViewMode = 'map' | 'rankings' | 'states' | 'interventions' | 'conflict' | 'seasonal' | 'budget' | 'reports' | 'alerts' | 'settings' | 'users';
