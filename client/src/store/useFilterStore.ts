import { create } from 'zustand';
import type { RiskLevel, ViewMode, ChoroplethMode } from '../types';

interface FilterState {
  stateFilter: string;
  riskFilter: RiskLevel | '';
  searchQuery: string;
  activeView: ViewMode;
  choroplethMode: ChoroplethMode;
  timeSliderDate: string | null;
  tieringMode: 'cluster' | 'absolute';
  setStateFilter: (state: string) => void;
  setRiskFilter: (risk: RiskLevel | '') => void;
  setSearchQuery: (query: string) => void;
  setActiveView: (view: ViewMode) => void;
  setChoroplethMode: (mode: ChoroplethMode) => void;
  setTimeSliderDate: (date: string | null) => void;
  setTieringMode: (mode: 'cluster' | 'absolute') => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  stateFilter: '',
  riskFilter: '',
  searchQuery: '',
  activeView: 'map',
  choroplethMode: 'composite',
  timeSliderDate: null,
  tieringMode: (localStorage.getItem('RISK_TIERING_MODE') as 'cluster' | 'absolute') || 'cluster',
  setStateFilter: (stateFilter) => set({ stateFilter }),
  setRiskFilter: (riskFilter) => set({ riskFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setActiveView: (activeView) => set({ activeView }),
  setChoroplethMode: (choroplethMode) => set({ choroplethMode }),
  setTimeSliderDate: (timeSliderDate) => set({ timeSliderDate }),
  setTieringMode: (tieringMode) => { localStorage.setItem('RISK_TIERING_MODE', tieringMode); set({ tieringMode }); },
  clearFilters: () => set({ stateFilter: '', riskFilter: '' }),
}));
