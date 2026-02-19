import { useState } from 'react';
import * as turf from '@turf/turf';
import type { HotspotFeature } from '../types';
import { RISK_COLORS } from '../types';

interface Props {
  features: HotspotFeature[];
  onSelectLGA?: (f: HotspotFeature) => void;
}

interface GeoPos { lat: number; lon: number; }

export default function FieldView({ features, onSelectLGA }: Props) {
  const [pos, setPos] = useState<GeoPos | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const locate = () => {
    setLoading(true);
    navigator.geolocation?.getCurrentPosition(
      p => { setPos({ lat: p.coords.latitude, lon: p.coords.longitude }); setLoading(false); },
      () => { setError('Geolocation unavailable'); setLoading(false); }
    );
  };

  const nearby = pos
    ? features
      .map(f => {
        const p = f.properties as any;
        const lat = p.Latitude ?? f.geometry.coordinates?.[0]?.[0]?.[1] ?? 0;
        const lon = p.Longitude ?? f.geometry.coordinates?.[0]?.[0]?.[0] ?? 0;
        const dist = turf.distance(
          turf.point([pos.lon, pos.lat]),
          turf.point([lon, lat]),
          { units: 'kilometers' }
        );
        return { feature: f, dist };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10)
    : features.slice(0, 10).map(f => ({ feature: f, dist: null }));

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-100">📱 Field View</h2>
        <button onClick={locate} disabled={loading}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-50">
          {loading ? 'Locating...' : '📍 My Location'}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      {pos && <p className="text-xs text-gray-400 mb-3">📍 {pos.lat.toFixed(4)}, {pos.lon.toFixed(4)}</p>}
      <div className="space-y-2">
        {nearby.map(({ feature: f, dist }, i) => {
          const p = f.properties as any;
          const color = RISK_COLORS[p.risk_level as keyof typeof RISK_COLORS] || '#888';
          return (
            <div key={i}
              className="flex items-center justify-between bg-gray-800 rounded p-3 cursor-pointer hover:bg-gray-700"
              onClick={() => onSelectLGA?.(f)}>
              <div>
                <div className="font-semibold text-sm text-white">{p.LGA_Name}</div>
                <div className="text-xs text-gray-400">{p.State}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold px-2 py-0.5 rounded mb-0.5" style={{ background: color + '33', color }}>
                  {p.risk_level}
                </div>
                {dist != null && <div className="text-xs text-gray-500">{dist.toFixed(0)} km</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
