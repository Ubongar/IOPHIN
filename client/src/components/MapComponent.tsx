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
  selectedLGA?: HotspotFeature | null;
  filterKey?: string;
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

const MapComponent: React.FC<MapComponentProps> = ({ data, onFeatureClick, selectedLGA, filterKey }) => {
  const geoJsonLayerRef = useRef<GeoJSONType | null>(null);
  const mapRef = useRef<any>(null);
  const prevSelectedRef = useRef<HotspotFeature | null>(null);
  const [featureCount, setFeatureCount] = useState(0);
  const { theme } = useTheme();

  /** Compute LatLngBounds from features */
  const computeBounds = (features: HotspotFeature[]): LatLngBounds | null => {
    if (!features.length) return null;
    const bounds = new LatLngBounds([]);
    features.forEach((feature) => {
      if (feature.geometry.type === 'Polygon') {
        feature.geometry.coordinates[0].forEach((coord) => {
          if (Array.isArray(coord) && coord.length >= 2) {
            bounds.extend([coord[1] as number, coord[0] as number]);
          }
        });
      } else if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach((polygon) => {
          polygon[0].forEach((coord) => {
            if (Array.isArray(coord) && coord.length >= 2) {
              bounds.extend([coord[1] as number, coord[0] as number]);
            }
          });
        });
      }
    });
    return bounds.isValid() ? bounds : null;
  };

  useEffect(() => {
    if (data) setFeatureCount(data.features.length);
  }, [data]);

  // Zoom to selected LGA or zoom back to full bounds when cleared
  useEffect(() => {
    const wasSelected = prevSelectedRef.current !== null;
    prevSelectedRef.current = selectedLGA ?? null;

    if (!mapRef.current) return;

    // If LGA was deselected, zoom back to full data bounds
    if (!selectedLGA && wasSelected) {
      if (data) {
        const bounds = computeBounds(data.features);
        if (bounds) {
          mapRef.current.fitBounds(bounds, {
            padding: [50, 50],
            animate: true,
            duration: 0.5,
          });
        }
      }
      return;
    }

    if (!selectedLGA) return;

    const zoomToSelected = () => {
      if (!geoJsonLayerRef.current) return false;
      let found = false;
      geoJsonLayerRef.current.eachLayer((layer: any) => {
        if (found) return;
        if (layer.feature?.properties?.LGA_Name === selectedLGA.properties.LGA_Name &&
            layer.feature?.properties?.State === selectedLGA.properties.State) {
          const bounds = layer.getBounds();
          mapRef.current.fitBounds(bounds, { 
            padding: [100, 100],
            maxZoom: 10,
            animate: true,
            duration: 0.5,
          });
          // Briefly highlight the selected feature
          layer.setStyle({ weight: 3, color: '#ffffff', fillOpacity: 0.9 });
          setTimeout(() => {
            if (geoJsonLayerRef.current) geoJsonLayerRef.current.resetStyle(layer);
          }, 2000);
          found = true;
        }
      });
      return found;
    };

    // Try immediately, retry after a short delay if layers aren't ready yet
    if (!zoomToSelected()) {
      const timer = setTimeout(zoomToSelected, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedLGA]);

  /**
   * Component to capture map instance and handle resize
   */
  const MapInstanceCapture: React.FC = () => {
    const map = useMap();
    mapRef.current = map;

    // Invalidate size periodically to handle visibility changes (mobile view switches)
    useEffect(() => {
      const observer = new ResizeObserver(() => {
        map.invalidateSize();
      });
      const container = map.getContainer();
      if (container.parentElement) {
        observer.observe(container.parentElement);
      }
      // Also invalidate on initial mount and after a short delay
      setTimeout(() => map.invalidateSize(), 200);
      return () => observer.disconnect();
    }, [map]);

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
      opacity: 0.9,
      color: borderColor,
      fillOpacity: 0.8,
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
   * Bind events to each feature — lightweight tooltip & click-only selection
   */
  const onEachFeature = (feature: any, layer: any) => {
    const typedFeature = feature as HotspotFeature;
    const { LGA_Name, State, risk_level, MPI, composite_poverty_score } = typedFeature.properties;
    const riskColor = RISK_COLORS[risk_level as RiskLevel] || '#999';

    // Lightweight tooltip — just name, state, risk, and key score
    const container = document.createElement('div');
    container.className = 'map-tooltip-inner map-tooltip-compact';

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

    // One-line score summary
    const scoreLine = document.createElement('div');
    scoreLine.className = 'tooltip-score-line';
    const scoreVal = composite_poverty_score != null ? composite_poverty_score.toFixed(4) : MPI.toFixed(4);
    const scoreLabel = composite_poverty_score != null ? 'Composite' : 'MPI';
    scoreLine.textContent = `${scoreLabel}: ${scoreVal}`;
    container.appendChild(scoreLine);

    const clickHint = document.createElement('div');
    clickHint.className = 'tooltip-click-hint';
    clickHint.textContent = 'Click for details';
    container.appendChild(clickHint);

    layer.bindTooltip(container, {
      sticky: false,
      className: 'custom-tooltip custom-tooltip-compact',
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
      <TileLayer
        key={theme}
        attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url={theme === 'dark' 
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        }
        subdomains="abcd"
      />

      {/* GeoJSON risk overlay — keyed to re-render on filter changes */}
      <GeoJSON
        key={filterKey || 'all'}
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
