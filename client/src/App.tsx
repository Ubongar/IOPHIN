/**
 * IOPHIN - Poverty Hotspot Identifier System
 * Main Application Component
 * 
 * A production-grade dashboard for visualizing geospatial poverty data
 * across Nigeria's 720 Local Government Areas (LGAs)
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

  /**
   * Fetch hotspots data and statistics on component mount
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch both hotspots and stats in parallel
        const [hotspotsResponse, statsResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/hotspots`),
          axios.get(`${API_BASE_URL}/stats`),
        ]);

        setHotspotsData(hotspotsResponse.data);
        setStats(statsResponse.data);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(
          err.response?.data?.message || 
          'Failed to load data. Please ensure the backend server is running.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  /**
   * Handle LGA selection from map
   */
  const handleFeatureClick = (feature: HotspotFeature) => {
    setSelectedLGA(feature);
  };

  /**
   * Clear selected LGA
   */
  const handleCloseLGA = () => {
    setSelectedLGA(null);
  };

  /**
   * Loading state
   */
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-white mx-auto mb-6"></div>
          <h2 className="text-white text-2xl font-bold mb-2">Loading IOPHIN Dashboard</h2>
          <p className="text-white/70">Fetching poverty hotspot data...</p>
        </div>
      </div>
    );
  }

  /**
   * Error state
   */
  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-red-900 via-red-800 to-pink-900">
        <div className="glass-dark rounded-2xl p-8 max-w-md text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 text-white mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-white text-2xl font-bold mb-2">Error Loading Data</h2>
          <p className="text-white/80 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-white text-red-900 px-6 py-3 rounded-lg font-semibold hover:bg-red-50 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /**
   * Main dashboard layout
   */
  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex">
      {/* Sidebar - Analytics Panel */}
      <div className="w-96 h-full flex-shrink-0 z-10">
        <Sidebar stats={stats} selectedLGA={selectedLGA} onClose={handleCloseLGA} />
      </div>

      {/* Main Content - Map Canvas */}
      <div className="flex-1 relative">
        {/* Floating Header */}
        <div className="absolute top-6 left-6 right-6 z-[1000] glass rounded-xl shadow-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                IOPHIN Poverty Hotspot Identifier
              </h1>
              <p className="text-gray-600 text-sm">
                {stats ? `${stats.totalLGAs} LGAs Monitored across ${stats.statesCount} States` : 'Loading...'}
              </p>
            </div>
          </div>

          {/* Live Status Indicator */}
          <div className="flex items-center gap-2 bg-green-100 px-4 py-2 rounded-lg">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-800 font-semibold text-sm">Live Data</span>
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
