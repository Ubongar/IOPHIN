import { create } from 'zustand';
import type { HotspotsGeoJSON, Stats, RankingEntry, StateAggregation, AnomalyAlert, RiskForecast, ChangeLogEntry } from '../types';

interface DataState {
  hotspotsData: HotspotsGeoJSON | null;
  stats: Stats | null;
  rankings: RankingEntry[];
  stateAgg: StateAggregation[];
  anomalies: AnomalyAlert[];
  forecasts: RiskForecast[];
  recentChanges: ChangeLogEntry[];
  loading: boolean;
  error: string | null;
  dataSource: string;
  systemStatus: 'online' | 'offline' | 'syncing';
  setHotspotsData: (data: HotspotsGeoJSON) => void;
  setStats: (stats: Stats) => void;
  setRankings: (rankings: RankingEntry[]) => void;
  setStateAgg: (states: StateAggregation[]) => void;
  setAnomalies: (anomalies: AnomalyAlert[]) => void;
  setForecasts: (forecasts: RiskForecast[]) => void;
  setRecentChanges: (changes: ChangeLogEntry[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setDataSource: (source: string) => void;
  setSystemStatus: (status: 'online' | 'offline' | 'syncing') => void;
}

export const useDataStore = create<DataState>((set) => ({
  hotspotsData: null,
  stats: null,
  rankings: [],
  stateAgg: [],
  anomalies: [],
  forecasts: [],
  recentChanges: [],
  loading: true,
  error: null,
  dataSource: 'Connecting...',
  systemStatus: 'syncing',
  setHotspotsData: (data) => set({ hotspotsData: data }),
  setStats: (stats) => set({ stats }),
  setRankings: (rankings) => set({ rankings }),
  setStateAgg: (stateAgg) => set({ stateAgg }),
  setAnomalies: (anomalies) => set({ anomalies }),
  setForecasts: (forecasts) => set({ forecasts }),
  setRecentChanges: (recentChanges) => set({ recentChanges }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setDataSource: (dataSource) => set({ dataSource }),
  setSystemStatus: (systemStatus) => set({ systemStatus }),
}));
