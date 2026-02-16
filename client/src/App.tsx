/**
 * IOPHIN — Poverty Hotspot Identifier
 * Professional dark dashboard layout inspired by mappn / mapserve
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';
import Legend from './components/Legend';
import SearchBar from './components/SearchBar';
import { useTheme } from './contexts/ThemeContext';
import type { HotspotsGeoJSON, HotspotFeature, Stats } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/* ── Narrow icon rail (like mappn's left-hand icon strip) ── */
const NAV_ICONS = [
  { id: 'home', label: 'Dashboard', d: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  { id: 'globe', label: 'Map', d: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'chart', label: 'Analytics', d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'light', label: 'Nightlight', d: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  { id: 'data', label: 'Data', d: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
];

function App() {
  const [hotspotsData, setHotspotsData] = useState<HotspotsGeoJSON | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedLGA, setSelectedLGA] = useState<HotspotFeature | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState('home');
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [hotspotsResponse, statsResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/hotspots`),
          axios.get(`${API_BASE_URL}/stats`),
        ]);
        setHotspotsData(hotspotsResponse.data);
        setStats(statsResponse.data);
      } catch (err) {
        const error = err instanceof axios.AxiosError ? err : new Error(String(err));
        console.error('Error fetching data:', error);
        setError(
          (error instanceof axios.AxiosError && error.response?.data?.message) ||
          'Failed to load data. Please ensure the backend server is running.'
        );
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleFeatureClick = (feature: HotspotFeature) => setSelectedLGA(feature);
  const handleCloseLGA = () => setSelectedLGA(null);

  const handleSearchSelect = (feature: HotspotFeature | null) => {
    setSelectedLGA(feature);
  };

  /* ── Loading screen ── */
  if (loading) {
    return (
      <div className="app-bg h-screen w-screen flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-blue-500/10" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-sm">P</span>
            </div>
          </div>
          <h2 className="text-white text-lg font-bold mb-2 tracking-tight">Loading PHIS</h2>
          <p className="text-white/40 text-xs font-medium">Fetching poverty intelligence data…</p>
        </div>
      </div>
    );
  }

  /* ── Error screen ── */
  if (error) {
    return (
      <div className="app-bg h-screen w-screen flex items-center justify-center">
        <div className="panel rounded-2xl p-10 max-w-md text-center shadow-2xl">
          <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-5 shadow-md">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-white text-lg font-bold mb-3 tracking-tight">Connection Error</h2>
          <p className="text-white/50 text-sm mb-6 leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-7 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg hover:shadow-xl"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     Main Layout: [Icon Rail] [Sidebar Panel] [Map]
     ══════════════════════════════════════════════════════════════ */
  return (
    <div className="app-bg h-screen w-screen overflow-hidden flex">
      {/* ── Left Icon Rail ── */}
      <div className="icon-rail">
        {/* Brand mark - PHIS */}
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center mb-6 flex-shrink-0 shadow-lg">
          <span className="text-white font-black text-xs tracking-tight">P</span>
        </div>

        {/* Nav icons */}
        <div className="flex flex-col gap-1 flex-1">
          {NAV_ICONS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`nav-icon-btn ${activeNav === item.id ? 'active' : ''}`}
              title={item.label}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.d} />
              </svg>
            </button>
          ))}
        </div>

        {/* Bottom power icon (decorative) */}
        <button className="nav-icon-btn mt-auto flex-shrink-0" title="Settings">
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* ── Sidebar Panel ── */}
      <div className="sidebar-panel">
        <Sidebar stats={stats} selectedLGA={selectedLGA} onClose={handleCloseLGA} />
      </div>

      {/* ── Map Area ── */}
      <div className="flex-1 relative">
        {/* Search bar at the top center */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] w-full max-w-md px-4">
          <SearchBar 
            data={hotspotsData?.features || null} 
            onSelectLGA={handleSearchSelect}
          />
        </div>

        {/* Compact top-right info strip */}
        <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2">
          {stats && (
            <div className="info-chip shadow-lg">
              <span className="text-white/60">Engine:</span>&ensp;
              <span className="text-emerald-400 font-semibold">Online</span>
            </div>
          )}
          <div className="info-chip shadow-lg">
            <span className="relative flex h-1.5 w-1.5 mr-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-emerald-400 font-semibold text-[10px] uppercase tracking-wide">System Live</span>
          </div>
        </div>

        {/* Top-left toggles (dark/light icons) */}
        <div className="absolute top-4 left-4 z-[1000] flex items-center gap-1.5">
          <button 
            title={theme === 'dark' ? 'Dark mode (active)' : 'Switch to dark mode'}
            onClick={toggleTheme} 
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              theme === 'dark' 
                ? 'bg-blue-600 text-white hover:bg-blue-500' 
                : 'theme-toggle-inactive'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
          <button 
            title={theme === 'light' ? 'Light mode (active)' : 'Switch to light mode'}
            onClick={toggleTheme} 
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              theme === 'light' 
                ? 'bg-blue-600 text-white hover:bg-blue-500' 
                : 'theme-toggle-inactive'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
        </div>

        {/* Map */}
        <MapComponent 
          data={hotspotsData} 
          onFeatureClick={handleFeatureClick}
          selectedLGA={selectedLGA}
        />

        {/* Legend */}
        <Legend />
      </div>
    </div>
  );
}

export default App;
