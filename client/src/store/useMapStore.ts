import { create } from 'zustand';
import type { HotspotFeature, ChoroplethMode, BasemapStyle } from '../types';

interface MapState {
  selectedLGA: HotspotFeature | null;
  mapMode: ChoroplethMode;
  basemap: BasemapStyle;
  sidebarOpen: boolean;
  timeSliderPosition: number;
  is3D: boolean;
  setSelectedLGA: (lga: HotspotFeature | null) => void;
  setMapMode: (mode: ChoroplethMode) => void;
  setBasemap: (basemap: BasemapStyle) => void;
  setSidebarOpen: (open: boolean) => void;
  setTimeSliderPosition: (pos: number) => void;
  setIs3D: (is3D: boolean) => void;
}

export const useMapStore = create<MapState>((set) => ({
  selectedLGA: null,
  mapMode: 'composite',
  basemap: 'dark',
  sidebarOpen: false,
  timeSliderPosition: 100,
  is3D: false,
  setSelectedLGA: (selectedLGA) => set({ selectedLGA }),
  setMapMode: (mapMode) => set({ mapMode }),
  setBasemap: (basemap) => set({ basemap }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setTimeSliderPosition: (timeSliderPosition) => set({ timeSliderPosition }),
  setIs3D: (is3D) => set({ is3D }),
}));
