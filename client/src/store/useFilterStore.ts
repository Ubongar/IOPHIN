import { create } from 'zustand';
import type { RiskLevel, ViewMode, ChoroplethMode } from '../types';

interface FilterState {
  stateFilter: string;
  riskFilter: RiskLevel | '';
  searchQuery: string;
  activeView: ViewMode;
  choroplethMode: ChoroplethMode;
  timeSliderDate: string | null;
  setStateFilter: (state: string) => void;
  setRiskFilter: (risk: RiskLevel | '') => void;
  setSearchQuery: (query: string) => void;
  setActiveView: (view: ViewMode) => void;
  setChoroplethMode: (mode: ChoroplethMode) => void;
  setTimeSliderDate: (date: string | null) => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  stateFilter: '',
  riskFilter: '',
  searchQuery: '',
  activeView: 'map',
  choroplethMode: 'composite',
  timeSliderDate: null,
  setStateFilter: (stateFilter) => set({ stateFilter }),
  setRiskFilter: (riskFilter) => set({ riskFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setActiveView: (activeView) => set({ activeView }),
  setChoroplethMode: (choroplethMode) => set({ choroplethMode }),
  setTimeSliderDate: (timeSliderDate) => set({ timeSliderDate }),
  clearFilters: () => set({ stateFilter: '', riskFilter: '' }),
}));
