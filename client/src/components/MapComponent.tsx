/**
 * MapComponent - Core Interactive Map
 * Renders Nigeria's LGAs with risk-based color coding using React-Leaflet
 * Premium dark cartography with glowing risk boundaries
 */

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import { LatLngBounds } from 'leaflet';
import type { GeoJSON as GeoJSONType, PathOptions } from 'leaflet';
import { RISK_COLORS } from '../types';
import type { HotspotsGeoJSON, HotspotFeature, RiskLevel } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface MapComponentProps {
  data: HotspotsGeoJSON | null;
  onFeatureClick: (feature: HotspotFeature) => void;
}

/**
 * Custom hook to fit map bounds to Nigeria
 */
const FitBounds: React.FC<{ data: HotspotsGeoJSON | null }> = ({ data }) => {
  const map = useMap();

  useEffect(() => {
    if (data && data.features.length > 0) {
      const bounds = new LatLngBounds([]);
      data.features.forEach((feature) => {
        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach((coord) => {
            if (Array.isArray(coord) && coord.length >= 2) {
              const lng = coord[0];
              const lat = coord[1];
              bounds.extend([lat as number, lng as number]);
            }
          });
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach((polygon) => {
            polygon[0].forEach((coord) => {
              if (Array.isArray(coord) && coord.length >= 2) {
                const lng = coord[0];
                const lat = coord[1];
                bounds.extend([lat as number, lng as number]);
              }
            });
          });
        }
      });
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [data, map]);

  return null;
};

const MapComponent: React.FC<MapComponentProps> = ({ data, onFeatureClick }) => {
  const geoJsonLayerRef = useRef<GeoJSONType | null>(null);
  const mapRef = useRef<any>(null);
  const [featureCount, setFeatureCount] = useState(0);
  const { theme } = useTheme();

  useEffect(() => {
    if (data) setFeatureCount(data.features.length);
  }, [data]);

  /**
   * Component to capture map instance
   */
  const MapInstanceCapture: React.FC = () => {
    const map = useMap();
    mapRef.current = map;
    return null;
  };

  /** Darken a hex colour for borders */
  const darkenColor = (hex: string, amount: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0x00ff) - amount);
    const b = Math.max(0, (num & 0x0000ff) - amount);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  };

  /**
   * Style function: Color LGAs based on risk level with refined visuals
   */
  const styleFeature = (feature?: any): PathOptions => {
    if (!feature || !feature.properties) return {};

    const riskLevel = feature.properties.risk_level as RiskLevel;
    const color = RISK_COLORS[riskLevel] || '#999999';
    const borderColor = darkenColor(color, 40);

    return {
      fillColor: color,
      weight: 1.5,
      opacity: 0.85,
      color: borderColor,
      fillOpacity: 0.55,
      dashArray: '',
    };
  };

  /**
   * Highlight feature on hover — bright glow effect
   */
  const highlightFeature = (e: any) => {
    const layer = e.target;
    const riskLevel = layer.feature?.properties?.risk_level as RiskLevel;
    const color = RISK_COLORS[riskLevel] || '#ffffff';

    layer.setStyle({
      weight: 3,
      color: '#ffffff',
      fillOpacity: 0.85,
      fillColor: color,
    });
    layer.bringToFront();
  };

  /**
   * Reset feature style on mouse out
   */
  const resetHighlight = (e: any) => {
    if (geoJsonLayerRef.current) {
      geoJsonLayerRef.current.resetStyle(e.target);
    }
  };

  /**
   * Handle feature click: Zoom and trigger sidebar update
   */
  const clickFeature = (feature: HotspotFeature, layer: any) => {
    layer.on({
      click: () => {
        // Zoom to feature using captured map instance
        if (mapRef.current) {
          const bounds = layer.getBounds();
          mapRef.current.fitBounds(bounds, { 
            padding: [100, 100],
            maxZoom: 10 
          });
        }

        // Trigger sidebar update
        onFeatureClick(feature);
      },
    });
  };

  /**
   * Bind events to each feature — rich tooltip & interaction
   */
  const onEachFeature = (feature: any, layer: any) => {
    const typedFeature = feature as HotspotFeature;
    const { LGA_Name, State, risk_level, MPI, mean_nightlight_intensity, Headcount_Ratio, cluster_label } = typedFeature.properties;
    const riskColor = RISK_COLORS[risk_level as RiskLevel] || '#999';

    // Poverty probability (same formula as sidebar)
    const mpiScore = Math.min(MPI * 100, 100);
    const nightlightScore = Math.max(0, 100 - (mean_nightlight_intensity / 60) * 100);
    const povertyProb = Math.min(Math.max(mpiScore * 0.7 + nightlightScore * 0.3, 0), 100);

    // Build rich tooltip DOM
    const container = document.createElement('div');
    container.className = 'map-tooltip-inner';

    // Header row with risk dot
    const header = document.createElement('div');
    header.className = 'tooltip-header';

    const titleBlock = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.className = 'tooltip-title';
    titleEl.textContent = LGA_Name ?? '';
    titleBlock.appendChild(titleEl);
    const subtitleEl = document.createElement('div');
    subtitleEl.className = 'tooltip-subtitle';
    subtitleEl.textContent = `${State ?? ''} State`;
    titleBlock.appendChild(subtitleEl);
    header.appendChild(titleBlock);

    const badge = document.createElement('div');
    badge.className = 'tooltip-badge';
    badge.style.background = riskColor;
    badge.style.boxShadow = `0 0 8px ${riskColor}88`;
    badge.textContent = risk_level;
    header.appendChild(badge);

    container.appendChild(header);

    // Divider
    const divider = document.createElement('div');
    divider.className = 'tooltip-divider';
    container.appendChild(divider);

    // Metrics grid
    const grid = document.createElement('div');
    grid.className = 'tooltip-grid';

    const makeMetric = (label: string, value: string, accent: string) => {
      const cell = document.createElement('div');
      cell.className = 'tooltip-metric';
      const valEl = document.createElement('div');
      valEl.className = 'tooltip-metric-value';
      valEl.style.color = accent;
      valEl.textContent = value;
      cell.appendChild(valEl);
      const labEl = document.createElement('div');
      labEl.className = 'tooltip-metric-label';
      labEl.textContent = label;
      cell.appendChild(labEl);
      return cell;
    };

    grid.appendChild(makeMetric('MPI Score', MPI.toFixed(4), '#f59e0b'));
    grid.appendChild(makeMetric('Nightlight', mean_nightlight_intensity.toFixed(2), '#06b6d4'));
    grid.appendChild(makeMetric('Poverty Prob.', `${povertyProb.toFixed(1)}%`, riskColor));
    grid.appendChild(makeMetric('Headcount', Headcount_Ratio != null ? `${(Headcount_Ratio * 100).toFixed(1)}%` : 'N/A', '#a78bfa'));

    container.appendChild(grid);

    // Cluster label
    if (cluster_label) {
      const clusterDiv = document.createElement('div');
      clusterDiv.className = 'tooltip-cluster';
      clusterDiv.textContent = cluster_label;
      container.appendChild(clusterDiv);
    }

    // Mini progress bar for poverty probability
    const barWrap = document.createElement('div');
    barWrap.className = 'tooltip-bar-wrap';
    const barBg = document.createElement('div');
    barBg.className = 'tooltip-bar-bg';
    const barFill = document.createElement('div');
    barFill.className = 'tooltip-bar-fill';
    barFill.style.width = `${povertyProb}%`;
    barFill.style.background = `linear-gradient(90deg, ${riskColor}, ${riskColor}99)`;
    barBg.appendChild(barFill);
    barWrap.appendChild(barBg);
    container.appendChild(barWrap);

    layer.bindTooltip(container, {
      sticky: true,
      className: 'custom-tooltip',
      direction: 'top',
      offset: [0, -10],
    });

    // Event handlers
    layer.on({
      mouseover: highlightFeature,
      mouseout: resetHighlight,
    });

    // Click handler
    clickFeature(typedFeature, layer);
  };

  if (!data) {
    return (
      <div className="w-full h-full flex items-center justify-center app-bg">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-3">
            <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
          </div>
          <p className="text-white/50 text-sm font-medium">Loading map data…</p>
          <p className="text-white/25 text-xs mt-1">Fetching {featureCount || ''} LGA boundaries</p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={[9.0820, 8.6753]}
      zoom={6}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
      className="z-0 map-container"
      minZoom={5}
      maxZoom={13}
    >
      <MapInstanceCapture />

      {/* Theme-aware base layer */}
      {theme === 'dark' ? (
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />
      ) : (
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />
      )}

      {/* GeoJSON risk overlay */}
      <GeoJSON
        data={data}
        style={styleFeature}
        onEachFeature={onEachFeature}
        ref={(ref) => {
          geoJsonLayerRef.current = ref;
        }}
      />
      <FitBounds data={data} />
    </MapContainer>
  );
};

export default MapComponent;
