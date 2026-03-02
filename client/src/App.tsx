/**
 * IOPHIN - Poverty Hotspot Intelligence System v3
 * Full upgrade: Zustand, new views, anomalies, forecasts, real-time alerts.
 */

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';
import Legend from './components/Legend';
import SearchBar from './components/SearchBar';
import RankingsTable from './components/RankingsTable';
import StateOverview from './components/StateOverview';
import AnomalyPanel from './components/AnomalyPanel';
import InterventionTracker from './components/InterventionTracker';
import SeasonalCalendar from './components/SeasonalCalendar';
import BudgetOptimizer from './components/BudgetOptimizer';
import ReportBuilder from './components/ReportBuilder';
import AlertsManager from './components/AlertsManager';
import ScrollytellingTour from './components/ScrollytellingTour';
import CrisisCorridor from './components/CrisisCorridor';
import Leaderboard from './components/Leaderboard';
import DataQualityPanel from './components/DataQualityPanel';
import UserManagementPanel from './components/UserManagementPanel';
import ProfilePanel from './components/ProfilePanel';
import AuthModal from './components/AuthModal';
import { useTheme } from './contexts/ThemeContext';
import { useDataStore, useFilterStore, useMapStore, useAlertStore, useAuthStore } from './store';
import { useWebSocket } from './hooks/useWebSocket';
import { getDynamicRiskLevel } from './utils/riskTiers';
import type { HotspotFeature, RiskLevel, ViewMode, Intervention, ChangeLogEntry } from './types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const RISK_LEVELS: RiskLevel[] = ['Critical', 'High', 'Medium', 'Low', 'Minimal'];

const NAV_ITEMS = [
  { id: 'map' as ViewMode, label: 'Map View', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'rankings' as ViewMode, label: 'Rankings', icon: 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12' },
  { id: 'states' as ViewMode, label: 'State Overview', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { id: 'interventions' as ViewMode, label: 'Interventions', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { id: 'seasonal' as ViewMode, label: 'Seasonal', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'budget' as ViewMode, label: 'Budget Optimizer', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'reports' as ViewMode, label: 'Reports', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'alerts' as ViewMode, label: 'Alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { id: 'settings' as ViewMode, label: 'Data Quality', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'users' as ViewMode, label: 'User Management', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'profile' as ViewMode, label: 'My Profile', icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
];

function App() {
  // Zustand stores
  const { hotspotsData, stats, rankings, stateAgg, anomalies, loading, systemStatus, dataSource,
    setHotspotsData, setStats, setRankings, setStateAgg, setAnomalies, setRecentChanges,
    setLoading, setSystemStatus, setDataSource } = useDataStore();
  const { stateFilter, riskFilter, searchQuery, activeView,
    setStateFilter, setRiskFilter, setSearchQuery, setActiveView, clearFilters } = useFilterStore();
  const { selectedLGA, sidebarOpen, setSelectedLGA, setSidebarOpen } = useMapStore();
  const { unreadCount: alertCount } = useAlertStore();
  const { isAuthenticated, user, logout: authLogout, fetchProfile } = useAuthStore();

  // Tiering mode - must be declared before filteredData
  const tieringMode = useFilterStore((s) => s.tieringMode);
  const setTieringMode = useFilterStore((s) => s.setTieringMode);

  // Local state
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [recentChangesLocal, setRecentChangesLocal] = useState<ChangeLogEntry[]>([]);
  const [tourActive, setTourActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'anomalies' | 'corridor' | 'leaderboard' | 'subscriptions'>('anomalies');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // WebSocket for real-time alerts
  useWebSocket();

  // Auto-fetch user profile when token exists (on page load/refresh)
  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Distinct states for dropdown
  const stateList = useMemo(() => {
    if (!hotspotsData) return [];
    const set = new Set<string>();
    hotspotsData.features.forEach(f => { if (f.properties.State) set.add(f.properties.State); });
    return Array.from(set).sort();
  }, [hotspotsData]);

  // Filtered data for map - uses dynamic risk levels based on tiering mode
  const filteredData = useMemo(() => {
    if (!hotspotsData) return null;
    if (!stateFilter && !riskFilter) return hotspotsData;
    const features = hotspotsData.features.filter(f => {
      if (stateFilter && f.properties.State !== stateFilter) return false;
      // Use dynamic risk level based on tiering mode for filtering
      if (riskFilter) {
        const dynamicRisk = getDynamicRiskLevel(f, tieringMode);
        if (dynamicRisk !== riskFilter) return false;
      }
      return true;
    });
    return { ...hotspotsData, features };
  }, [hotspotsData, stateFilter, riskFilter, tieringMode]);

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
      setDataSource(src === 'database' ? 'Live Database' : src === 'cache' ? 'Cached' : 'Cached Mode');
      setSystemStatus('online');

      // Background fetches
      Promise.all([
        axios.get(API + '/rankings?order=worst&limit=50').catch(() => null),
        axios.get(API + '/states').catch(() => null),
        axios.get(API + '/v1/anomalies').catch(() => null),
        axios.get(API + '/v1/changes?days=7').catch(() => null),
        axios.get(API + '/v1/interventions').catch(() => null),
      ]).then(([rankRes, stateRes, anomRes, changesRes, intRes]) => {
        if (rankRes?.data) setRankings(rankRes.data);
        if (stateRes?.data) setStateAgg(stateRes.data);
        if (anomRes?.data) setAnomalies(anomRes.data);
        if (changesRes?.data) { setRecentChanges(changesRes.data); setRecentChangesLocal(changesRes.data); }
        if (intRes?.data) setInterventions(intRes.data);
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
    // Load server runtime config if available
    axios.get(API + '/config').then(res => {
      const mode = res.data?.RISK_TIERING_MODE || 'cluster';
      setTieringMode((localStorage.getItem('RISK_TIERING_MODE') as 'cluster' | 'absolute') || mode);
    }).catch(() => { /* ignore */ });
  }, []);

  const toggleRiskMode = async () => {
    const next = tieringMode === 'cluster' ? 'absolute' : 'cluster';
    setTieringMode(next);
    // Try to persist to server (admin only; ignore errors)
    axios.post(API + '/config', { RISK_TIERING_MODE: next }).catch(() => null);
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(id);
  }, []);

  const handleFeatureClick = (f: HotspotFeature) => { setSelectedLGA(f); setSidebarOpen(true); };
  const handleCloseLGA = () => { setSelectedLGA(null); setSidebarOpen(false); };
  const handleSearchSelect = (f: HotspotFeature | null) => {
    if (f) { setSelectedLGA(f); setActiveView('map'); setSidebarOpen(true); }
    else setSelectedLGA(null);
  };

  const addIntervention = async (data: Partial<Intervention>): Promise<{ success: boolean; error?: string }> => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'You must be logged in to add interventions.' };
    try {
      const res = await axios.post(API + '/v1/interventions', data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInterventions(prev => [res.data, ...prev]);
      return { success: true };
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to save intervention. Check your role permissions.';
      return { success: false, error: msg };
    }
  };

  const acknowledgeAnomaly = async (id: number) => {
    try {
      await axios.patch(`${API}/v1/anomalies/${id}/acknowledge`);
      setAnomalies(anomalies.filter(a => a.id !== id));
    } catch { /* silent */ }
  };

  const statusDot = systemStatus === 'online' ? 'bg-emerald-500' : systemStatus === 'syncing' ? 'bg-blue-500' : 'bg-red-500';
  const statusPing = systemStatus === 'online' ? 'bg-emerald-400' : systemStatus === 'syncing' ? 'bg-blue-400' : 'bg-red-400';
  const statusText = systemStatus === 'online' ? 'System Live' : systemStatus === 'syncing' ? 'Syncing...' : 'Offline';
  const statusColor = systemStatus === 'online' ? 'text-emerald-400' : systemStatus === 'syncing' ? 'text-blue-400' : 'text-red-400';

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
      {/* Mobile hamburger */}
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarOpen
            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>

      {/* Mobile backdrop */}
      <div className={'sidebar-backdrop' + (sidebarOpen ? ' visible' : '')} onClick={() => setSidebarOpen(false)} />

      {/* Icon Rail */}
      <div className="icon-rail">
        <div className="rail-brand"><span className="rail-brand-letter">P</span></div>
        <div className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <button key={item.id}
              onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
              className={'nav-icon-btn' + (activeView === item.id ? ' active' : '')}
              title={item.label}>
              <div className="relative">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                </svg>
                {item.id === 'alerts' && alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Sidebar panel */}
      <div className={'sidebar-panel' + (sidebarOpen ? ' sidebar-open' : '')}>
        <button className="sidebar-close-mobile" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <Sidebar stats={stats} selectedLGA={selectedLGA} onClose={handleCloseLGA} hotspotsData={hotspotsData} />
      </div>

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Top toolbar */}
        <div className="top-toolbar">
          <button onClick={toggleTheme} className="theme-btn-sm" title="Toggle theme">
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
          <div className="toolbar-search">
            <SearchBar
              data={hotspotsData?.features || null}
              onSelectLGA={handleSearchSelect}
              onSearchTermChange={setSearchQuery}
              placeholder={activeView === 'rankings' ? 'Filter LGAs...' : activeView === 'states' ? 'Filter states...' : 'Search LGAs...'}
            />
          </div>
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="filter-select" title="Filter by state">
            <option value="">All States</option>
            {stateList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as RiskLevel | '')} className="filter-select" title="Filter by risk level">
            <option value="">All Risks</option>
            {RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {(stateFilter || riskFilter) && (
            <button onClick={clearFilters} className="filter-clear-btn" title="Clear filters">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <div className="toolbar-spacer" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text-quaternary)' }}>Risk Mode</label>
            <button data-testid="risk-mode-toggle" onClick={toggleRiskMode} className="risk-mode-btn" title={`Toggle risk tiering mode (current: ${tieringMode})`}>
              {tieringMode === 'cluster' ? 'Relative' : 'Absolute'}
            </button>
          </div>
          {activeView === 'map' && hotspotsData && (
            <button onClick={() => setTourActive(true)}
              className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-3 py-1 rounded mr-2">
              🗺 Briefing
            </button>
          )}
          <div className="toolbar-status">
            {isAuthenticated ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {user?.role && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                    background: user.role === 'super_admin' ? '#7C3AED' : user.role === 'admin' ? '#2563EB' : '#6B7280',
                    color: '#fff',
                  }}>
                    {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                )}
                <button onClick={() => { setActiveView('profile' as ViewMode); setSidebarOpen(false); }} className="rankings-toggle-btn" style={{ fontSize: 11, padding: '4px 10px' }}
                  title="View Profile">
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: 4 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {user?.full_name?.split(' ')[0] || 'Account'}
                </button>
                <button onClick={authLogout} className="rankings-toggle-btn" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--text-quaternary)' }}
                  title="Sign Out">
                  Sign Out
                </button>
              </div>
            ) : (
              <button onClick={() => setShowAuthModal(true)} className="download-btn"
                style={{ width: 'auto', padding: '5px 14px', fontSize: 11 }}>
                Sign In
              </button>
            )}
            <div className="status-chip">
              <span className="status-chip-label">Source:</span>
              <span className={'status-chip-value ' + (dataSource === 'Live Database' ? 'text-blue-400' : 'text-amber-400')}>{dataSource}</span>
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
            {anomalies.filter(a => !a.acknowledged).length > 0 && (
              <div className="status-chip status-chip-danger">
                <span>⚠ {anomalies.filter(a => !a.acknowledged).length} Anomaly</span>
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

        {/* Map view */}
        <div className={'map-view-wrapper' + (activeView !== 'map' ? ' hidden' : '')}>
          <MapComponent data={filteredData} onFeatureClick={handleFeatureClick} selectedLGA={selectedLGA} filterKey={stateFilter + '|' + riskFilter} />
          <Legend />
        </div>

        {/* Rankings view */}
        {activeView === 'rankings' && (
          <div className="view-panel">
            <RankingsTable rankings={rankings} searchQuery={searchQuery} stateFilter={stateFilter} riskFilter={riskFilter}
              hotspotsData={hotspotsData}
              onSelectLGA={(name: string) => {
                const feat = hotspotsData?.features.find(f => f.properties.LGA_Name === name);
                if (feat) { setSelectedLGA(feat); setActiveView('map'); setSidebarOpen(true); }
              }} />
          </div>
        )}

        {/* States view */}
        {activeView === 'states' && (
          <div className="view-panel">
            <StateOverview states={stateAgg} searchQuery={searchQuery}
              onSelectState={(s: string) => { setStateFilter(s); setActiveView('map'); }} />
          </div>
        )}

        {/* Interventions view */}
        {activeView === 'interventions' && (
          <div className="view-panel">
            <InterventionTracker interventions={interventions} onAdd={addIntervention}
              searchQuery={searchQuery} stateFilter={stateFilter}
              hotspotsData={hotspotsData}
              onSelectLGA={(name) => {
                const feat = hotspotsData?.features.find(f => f.properties.LGA_Name === name);
                if (feat) { setSelectedLGA(feat); setActiveView('map'); setSidebarOpen(true); }
              }} />
          </div>
        )}

        {/* Seasonal view */}
        {activeView === 'seasonal' && (
          <div className="view-panel">
            <SeasonalCalendar features={hotspotsData?.features || []}
              searchQuery={searchQuery} stateFilter={stateFilter} />
          </div>
        )}

        {/* Budget optimizer view */}
        {activeView === 'budget' && (
          <div className="view-panel">
            <BudgetOptimizer features={hotspotsData?.features || []}
              searchQuery={searchQuery} stateFilter={stateFilter} riskFilter={riskFilter}
              onSelectLGA={(name) => {
                const feat = hotspotsData?.features.find(f => f.properties.LGA_Name === name);
                if (feat) { setSelectedLGA(feat); setActiveView('map'); setSidebarOpen(true); }
              }} />
          </div>
        )}

        {/* Reports view */}
        {activeView === 'reports' && (
          <div className="view-panel">
            <ReportBuilder states={stateAgg} searchQuery={searchQuery} hotspotsData={hotspotsData} />
          </div>
        )}

        {/* Alerts view */}
        {activeView === 'alerts' && (
          <div className="view-panel">
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                {(['anomalies', 'corridor', 'leaderboard', 'subscriptions'] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)}
                    className="rankings-toggle-btn"
                    style={activeTab === t ? { background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' } : {}}>
                    {t === 'corridor' ? 'Crisis Corridor' : t === 'subscriptions' ? 'Subscriptions' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              {activeTab === 'anomalies' && (
                <AnomalyPanel anomalies={anomalies} onAcknowledge={acknowledgeAnomaly}
                  searchQuery={searchQuery} stateFilter={stateFilter}
                  onSelectLGA={(name) => {
                    const feat = hotspotsData?.features.find(f => f.properties.LGA_Name === name);
                    if (feat) { setSelectedLGA(feat); setActiveView('map'); setSidebarOpen(true); }
                  }} />
              )}
              {activeTab === 'corridor' && (
                <CrisisCorridor features={hotspotsData?.features || []}
                  searchQuery={searchQuery} stateFilter={stateFilter} />
              )}
              {activeTab === 'leaderboard' && (
                <Leaderboard changes={recentChangesLocal}
                  searchQuery={searchQuery} stateFilter={stateFilter}
                  onSelectLGA={(name) => {
                    const feat = hotspotsData?.features.find(f => f.properties.LGA_Name === name);
                    if (feat) { setSelectedLGA(feat); setActiveView('map'); setSidebarOpen(true); }
                  }} />
              )}
              {activeTab === 'subscriptions' && (
                <AlertsManager features={hotspotsData?.features || []}
                  searchQuery={searchQuery} stateFilter={stateFilter}
                  onRefresh={() => fetchData(true)} />
              )}
            </div>
          </div>
        )}

        {/* Settings / Data Quality view */}
        {activeView === 'settings' && (
          <div className="view-panel">
            <DataQualityPanel features={hotspotsData?.features || []}
              searchQuery={searchQuery} stateFilter={stateFilter} />
          </div>
        )}

        {/* User Management view */}
        {activeView === 'users' && (
          <div className="view-panel">
            <UserManagementPanel />
          </div>
        )}

        {/* Profile view */}
        {activeView === 'profile' && (
          <div className="view-panel">
            <ProfilePanel />
          </div>
        )}

        {/* Scrollytelling tour in sidebar panel — not an overlay */}
        {tourActive && hotspotsData && (
          <div className="briefing-sidebar-panel">
            <ScrollytellingTour
              features={hotspotsData.features}
              onSelectLGA={(f) => { setSelectedLGA(f); }}
              onClose={() => { setTourActive(false); setSelectedLGA(null); }}
              inSidebar
            />
          </div>
        )}

        {/* Mobile bottom nav */}
        <nav className="mobile-bottom-nav">
          {NAV_ITEMS.slice(0, 5).map((item) => (
            <button key={item.id}
              onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
              className={'bottom-nav-btn' + (activeView === item.id ? ' active' : '')}>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
              </svg>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Auth modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}

export default App;
