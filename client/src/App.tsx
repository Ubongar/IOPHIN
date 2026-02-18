/**
 * IOPHIN - Poverty Hotspot Intelligence System v2
 * State/risk filters, rankings view, enhanced analytics.
 */

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';
import Legend from './components/Legend';
import SearchBar from './components/SearchBar';
import RankingsTable from './components/RankingsTable';
import StateOverview from './components/StateOverview';
import { useTheme } from './contexts/ThemeContext';
import type { HotspotsGeoJSON, HotspotFeature, Stats, RankingEntry, StateAggregation, RiskLevel, ViewMode } from './types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const RISK_LEVELS: RiskLevel[] = ['Critical', 'High', 'Medium', 'Low', 'Minimal'];

const NAV_ITEMS = [
  { id: 'map' as ViewMode, label: 'Map View', d: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'rankings' as ViewMode, label: 'Rankings', d: 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12' },
  { id: 'states' as ViewMode, label: 'State Overview', d: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
];

function App() {
  const [hotspotsData, setHotspotsData] = useState<HotspotsGeoJSON | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [stateAgg, setStateAgg] = useState<StateAggregation[]>([]);
  const [selectedLGA, setSelectedLGA] = useState<HotspotFeature | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState<'online' | 'offline' | 'syncing'>('syncing');
  const [dataSource, setDataSource] = useState<string>('Connecting...');
  const [activeView, setActiveView] = useState<ViewMode>('map');
  const [stateFilter, setStateFilter] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | ''>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  /* -- Distinct states for the dropdown -- */
  const stateList = useMemo(() => {
    if (!hotspotsData) return [];
    const set = new Set<string>();
    hotspotsData.features.forEach(f => { if (f.properties.State) set.add(f.properties.State); });
    return Array.from(set).sort();
  }, [hotspotsData]);

  /* -- Filtered data for the map -- */
  const filteredData = useMemo<HotspotsGeoJSON | null>(() => {
    if (!hotspotsData) return null;
    if (!stateFilter && !riskFilter) return hotspotsData;
    const features = hotspotsData.features.filter(f => {
      if (stateFilter && f.properties.State !== stateFilter) return false;
      if (riskFilter && f.properties.risk_level !== riskFilter) return false;
      return true;
    });
    return { ...hotspotsData, features };
  }, [hotspotsData, stateFilter, riskFilter]);

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

      // Fetch rankings + state aggregation in background
      Promise.all([
        axios.get(API + '/rankings?order=worst&limit=50').catch(() => null),
        axios.get(API + '/states').catch(() => null),
      ]).then(([rankRes, stateRes]) => {
        if (rankRes?.data) setRankings(rankRes.data);
        if (stateRes?.data) setStateAgg(stateRes.data);
      });
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

  const handleFeatureClick = (f: HotspotFeature) => { setSelectedLGA(f); setSidebarOpen(true); };
  const handleCloseLGA = () => { setSelectedLGA(null); setSidebarOpen(false); };
  const handleSearchSelect = (f: HotspotFeature | null) => {
    if (f) {
      setSelectedLGA(f);
      setActiveView('map');
      setSidebarOpen(true);
    } else {
      setSelectedLGA(null);
    }
  };

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
      {/* ---- Mobile hamburger button ---- */}
      <button
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarOpen
            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          }
        </svg>
      </button>

      {/* ---- Mobile backdrop ---- */}
      <div
        className={'sidebar-backdrop' + (sidebarOpen ? ' visible' : '')}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ---- Icon Rail ---- */}
      <div className="icon-rail">
        <div className="rail-brand">
          <span className="rail-brand-letter">P</span>
        </div>
        <div className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
              className={'nav-icon-btn' + (activeView === item.id ? ' active' : '')}
              title={item.label}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.d} />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* ---- Sidebar (drawer on mobile) ---- */}
      <div className={'sidebar-panel' + (sidebarOpen ? ' sidebar-open' : '')}>
        <button
          className="sidebar-close-mobile"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <Sidebar stats={stats} selectedLGA={selectedLGA} onClose={handleCloseLGA} />
      </div>

      {/* ---- Main Content Area ---- */}
      <div className="flex-1 relative">

        {/* Unified top toolbar */}
        <div className="top-toolbar">
          <button onClick={toggleTheme} className="theme-btn-sm" title="Toggle theme">
            {theme === 'dark' ? '\u{1F319}' : '\u{2600}\u{FE0F}'}
          </button>

          <div className="toolbar-search">
            <SearchBar data={hotspotsData?.features || null} onSelectLGA={handleSearchSelect} />
          </div>

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="filter-select"
            title="Filter by state"
          >
            <option value="">All States</option>
            {stateList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as RiskLevel | '')}
            className="filter-select"
            title="Filter by risk level"
          >
            <option value="">All Risks</option>
            {RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          {(stateFilter || riskFilter) && (
            <button
              onClick={() => { setStateFilter(''); setRiskFilter(''); }}
              className="filter-clear-btn"
              title="Clear filters"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          <div className="toolbar-spacer" />

          <div className="toolbar-status">
            <div className="status-chip">
              <span className="status-chip-label">Source:</span>
              <span className={'status-chip-value ' + (dataSource === 'Live Database' ? 'text-blue-400' : 'text-amber-400')}>
                {dataSource}
              </span>
            </div>

            {(stateFilter || riskFilter) && (
              <div className="status-chip">
                <span className="status-chip-label">Filter:</span>
                <span className="status-chip-value text-purple-400">
                  {[stateFilter, riskFilter].filter(Boolean).join(' · ')}
                  {filteredData && ` (${filteredData.features.length})`}
                </span>
              </div>
            )}

            {stats?.conflictZones != null && stats.conflictZones > 0 && (
              <div className="status-chip status-chip-danger">
                <span>{stats.conflictZones} Conflict Zone{stats.conflictZones > 1 ? 's' : ''}</span>
              </div>
            )}

            <div className="status-chip">
              <span className="status-pulse-wrap">
                <span className={'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ' + statusPing} />
                <span className={'relative inline-flex rounded-full h-1.5 w-1.5 ' + statusDot} />
              </span>
              <span className={statusColor + ' font-semibold'}>{statusText}</span>
            </div>
          </div>
        </div>

        {/* View content — Map is always mounted (hidden via CSS) for zoom-on-navigate */}
        <div className={'map-view-wrapper' + (activeView !== 'map' ? ' hidden' : '')}>
          <MapComponent data={filteredData} onFeatureClick={handleFeatureClick} selectedLGA={selectedLGA} filterKey={stateFilter + '|' + riskFilter} />
          <Legend />
        </div>

        {activeView === 'rankings' && (
          <div className="view-panel">
            <RankingsTable rankings={rankings} onSelectLGA={(name: string) => {
              const feat = hotspotsData?.features.find(f => f.properties.LGA_Name === name);
              if (feat) { setSelectedLGA(feat); setActiveView('map'); setSidebarOpen(true); }
            }} />
          </div>
        )}

        {activeView === 'states' && (
          <div className="view-panel">
            <StateOverview states={stateAgg} onSelectState={(s: string) => { setStateFilter(s); setActiveView('map'); }} />
          </div>
        )}

        {/* Mobile bottom navigation */}
        <nav className="mobile-bottom-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
              className={'bottom-nav-btn' + (activeView === item.id ? ' active' : '')}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.d} />
              </svg>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default App;
