/**
 * IOPHIN - Poverty Hotspot Intelligence System
 * Main application with live polling, status indicators, and clean layout.
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';
import Legend from './components/Legend';
import SearchBar from './components/SearchBar';
import { useTheme } from './contexts/ThemeContext';
import type { HotspotsGeoJSON, HotspotFeature, Stats } from './types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const NAV_ITEMS = [
  { id: 'home', label: 'Dashboard', d: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  { id: 'globe', label: 'Map View', d: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];

function App() {
  const [hotspotsData, setHotspotsData] = useState<HotspotsGeoJSON | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedLGA, setSelectedLGA] = useState<HotspotFeature | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState<'online' | 'offline' | 'syncing'>('syncing');
  const [dataSource, setDataSource] = useState<string>('Connecting...');
  const [activeNav, setActiveNav] = useState('home');
  const { theme, toggleTheme } = useTheme();

  /* -- Data fetcher (initial + background polling) -- */
  const fetchData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      setSystemStatus('syncing');

      const [hotspotsRes, statsRes] = await Promise.all([
        axios.get(API + '/hotspots'),
        axios.get(API + '/stats'),
      ]);

      setHotspotsData(hotspotsRes.data);
      setStats(statsRes.data);

      const src = hotspotsRes.headers['x-data-source'];
      setDataSource(src === 'database' ? 'Live Database' : 'Cached Mode');
      setSystemStatus('online');
    } catch (err) {
      console.error('Fetch failed:', err);
      setSystemStatus('offline');
      if (!isBackground) setDataSource('Connection Failed');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(id);
  }, []);

  const handleFeatureClick = (f: HotspotFeature) => setSelectedLGA(f);
  const handleCloseLGA = () => setSelectedLGA(null);
  const handleSearchSelect = (f: HotspotFeature | null) => setSelectedLGA(f);

  /* -- Status helpers -- */
  const statusDot = systemStatus === 'online' ? 'bg-emerald-500' : systemStatus === 'syncing' ? 'bg-blue-500' : 'bg-red-500';
  const statusPing = systemStatus === 'online' ? 'bg-emerald-400' : systemStatus === 'syncing' ? 'bg-blue-400' : 'bg-red-400';
  const statusText = systemStatus === 'online' ? 'System Live' : systemStatus === 'syncing' ? 'Syncing...' : 'Offline';
  const statusColor = systemStatus === 'online' ? 'text-emerald-400' : systemStatus === 'syncing' ? 'text-blue-400' : 'text-red-400';

  /* -- Loading screen -- */
  if (loading) {
    return (
      <div className="app-bg h-screen w-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mb-5" />
          <p style={{ color: 'var(--text-quaternary)', fontSize: 13 }}>Initializing IOPHIN Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg h-screen w-screen overflow-hidden flex">
      {/* ---- Icon Rail ---- */}
      <div className="icon-rail">
        <div className="rail-brand">
          <span className="rail-brand-letter">P</span>
        </div>
        <div className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={'nav-icon-btn' + (activeNav === item.id ? ' active' : '')}
              title={item.label}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.d} />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* ---- Sidebar ---- */}
      <div className="sidebar-panel">
        <Sidebar stats={stats} selectedLGA={selectedLGA} onClose={handleCloseLGA} />
      </div>

      {/* ---- Map Area ---- */}
      <div className="flex-1 relative">
        {/* Search */}
        <div className="map-search-wrapper">
          <SearchBar data={hotspotsData?.features || null} onSelectLGA={handleSearchSelect} />
        </div>

        {/* Status chips */}
        <div className="map-status-strip">
          {/* Data source */}
          <div className="status-chip">
            <span className="status-chip-label">Source:</span>
            <span className={'status-chip-value ' + (dataSource === 'Live Database' ? 'text-blue-400' : 'text-amber-400')}>
              {dataSource}
            </span>
          </div>

          {/* Conflict zones */}
          {stats?.conflictZones != null && stats.conflictZones > 0 && (
            <div className="status-chip status-chip-danger">
              <span>{stats.conflictZones} Conflict Zone{stats.conflictZones > 1 ? 's' : ''}</span>
            </div>
          )}

          {/* System status */}
          <div className="status-chip">
            <span className="status-pulse-wrap">
              <span className={'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ' + statusPing} />
              <span className={'relative inline-flex rounded-full h-1.5 w-1.5 ' + statusDot} />
            </span>
            <span className={statusColor + ' font-semibold'}>{statusText}</span>
          </div>
        </div>

        {/* Theme toggle */}
        <div className="map-theme-toggle">
          <button onClick={toggleTheme} className="theme-btn" title="Toggle theme">
            {theme === 'dark' ? '\u{1F319}' : '\u{2600}\u{FE0F}'}
          </button>
        </div>

        <MapComponent data={hotspotsData} onFeatureClick={handleFeatureClick} selectedLGA={selectedLGA} />
        <Legend />
      </div>
    </div>
  );
}

export default App;
