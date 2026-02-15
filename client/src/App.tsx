/**
 * IOPHIN - Poverty Hotspot Identifier System
 * Main Application Component
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';
import Legend from './components/Legend';
import type { HotspotsGeoJSON, HotspotFeature, Stats } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function App() {
  const [hotspotsData, setHotspotsData] = useState<HotspotsGeoJSON | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedLGA, setSelectedLGA] = useState<HotspotFeature | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  /* Loading */
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-400 animate-spin" />
            <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
          </div>
          <h2 className="text-white text-xl font-bold mb-2 tracking-tight">Loading IOPHIN Dashboard</h2>
          <p className="text-white/40 text-sm">Fetching poverty hotspot data…</p>
        </div>
      </div>
    );
  }

  /* Error */
  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-red-950 to-slate-900">
        <div className="glass-card rounded-3xl p-10 max-w-md text-center border-red-500/20">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Connection Error</h2>
          <p className="text-white/50 text-sm mb-6 leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-8 py-3 rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-red-500/30 transition-all"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  /* Main Layout */
  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-900 flex">
      {/* Sidebar */}
      <div className="w-[380px] h-full flex-shrink-0 z-10 shadow-2xl shadow-black/40">
        <Sidebar stats={stats} selectedLGA={selectedLGA} onClose={handleCloseLGA} />
      </div>

      {/* Map area */}
      <div className="flex-1 relative">
        {/* ── Floating Header ── */}
        <div className="absolute top-4 left-4 right-4 z-[1000]">
          <div
            className="rounded-2xl shadow-2xl shadow-black/10 px-5 py-3 flex items-center justify-between"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.92))',
              backdropFilter: 'blur(24px) saturate(2)',
              WebkitBackdropFilter: 'blur(24px) saturate(2)',
              border: '1px solid rgba(255,255,255,0.6)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex items-center gap-3.5">
              {/* Brand icon */}
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 ring-2 ring-white/50">
                <svg className="w-5 h-5 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-slate-800 tracking-tight leading-tight">
                  IOPHIN Poverty Hotspot Identifier
                </h1>
                <p className="text-slate-500 text-[11px] font-medium">
                  {stats
                    ? `${stats.totalLGAs} LGAs Monitored across ${stats.statesCount} States · Nigeria`
                    : 'Loading…'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Stat pills */}
              {stats && (
                <div className="hidden md:flex items-center gap-2">
                  <div className="bg-amber-50 border border-amber-200/60 px-3 py-1 rounded-full">
                    <span className="text-amber-700 font-semibold text-[10px] tracking-wide">MPI {stats.averageMPI}</span>
                  </div>
                  <div className="bg-cyan-50 border border-cyan-200/60 px-3 py-1 rounded-full">
                    <span className="text-cyan-700 font-semibold text-[10px] tracking-wide">☄ {stats.averageNightlight}</span>
                  </div>
                </div>
              )}

              {/* Live pill */}
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/60 px-3.5 py-1.5 rounded-full">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-emerald-700 font-semibold text-[11px] tracking-wide">LIVE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Map attribution overlay (bottom-left) */}
        <div className="absolute bottom-5 left-5 z-[1000]">
          <div
            className="rounded-xl px-3.5 py-2 flex items-center gap-2"
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-white/50 text-[10px] font-medium">
              {stats ? `${stats.totalLGAs} regions` : '…'} · Click any LGA for details
            </span>
          </div>
        </div>

        {/* Map */}
        <MapComponent data={hotspotsData} onFeatureClick={handleFeatureClick} />

        {/* Legend */}
        <Legend />
      </div>
    </div>
  );
}

export default App;
