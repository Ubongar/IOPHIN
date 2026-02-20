/**
 * MapComponent - 3D Interactive Map
 * Renders Nigeria's LGAs with risk-based 3D extruded polygons using MapLibre GL
 * Risk areas rise from the map proportional to their severity score
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Map, { Source, Layer, NavigationControl, Popup } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RISK_COLORS } from '../types';
import type { HotspotsGeoJSON, HotspotFeature, RiskLevel } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface MapComponentProps {
  data: HotspotsGeoJSON | null;
  onFeatureClick: (feature: HotspotFeature) => void;
  selectedLGA?: HotspotFeature | null;
  filterKey?: string;
}

/** Map the risk_level string → fill color for MapLibre expression */
const RISK_MATCH_EXPR: any = [
  'match',
  ['get', 'risk_level'],
  'Critical', RISK_COLORS.Critical,
  'High', RISK_COLORS.High,
  'Medium', RISK_COLORS.Medium,
  'Low', RISK_COLORS.Low,
  'Minimal', RISK_COLORS.Minimal,
  '#999999',
];

/** Map risk_level → extrusion height (meters). Higher risk = taller. */
const RISK_HEIGHT_EXPR: any = [
  'match',
  ['get', 'risk_level'],
  'Critical', 45000,
  'High', 35000,
  'Medium', 22000,
  'Low', 12000,
  'Minimal', 5000,
  3000,
];

/** Darken a hex colour by a fixed amount */
const darkenColor = (hex: string, amount: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0x00ff) - amount);
  const b = Math.max(0, (num & 0x0000ff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

const RISK_BORDER_EXPR: any = [
  'match',
  ['get', 'risk_level'],
  'Critical', darkenColor(RISK_COLORS.Critical, 40),
  'High', darkenColor(RISK_COLORS.High, 40),
  'Medium', darkenColor(RISK_COLORS.Medium, 40),
  'Low', darkenColor(RISK_COLORS.Low, 40),
  'Minimal', darkenColor(RISK_COLORS.Minimal, 40),
  '#666666',
];

/** Dark and light base map styles (free, no token needed) */
const MAP_STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};

/** Compute bounding box from GeoJSON features */
const computeBBox = (features: HotspotFeature[]): [[number, number], [number, number]] | null => {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const processCoords = (coords: number[][]) => {
    coords.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    });
  };
  features.forEach((f) => {
    if (f.geometry.type === 'Polygon') {
      (f.geometry.coordinates as number[][][]).forEach(processCoords);
    } else if (f.geometry.type === 'MultiPolygon') {
      (f.geometry.coordinates as number[][][][]).forEach((poly) => poly.forEach(processCoords));
    }
  });
  return minLng !== Infinity ? [[minLng, minLat], [maxLng, maxLat]] : null;
};

const MapComponent: React.FC<MapComponentProps> = ({ data, onFeatureClick, selectedLGA, filterKey }) => {
  const mapRef = useRef<any>(null);
  const [hoveredFeature, setHoveredFeature] = useState<HotspotFeature | null>(null);
  const [popupCoords, setPopupCoords] = useState<[number, number] | null>(null);
  const [featureCount, setFeatureCount] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const prevSelectedRef = useRef<HotspotFeature | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (data) setFeatureCount(data.features.length);
  }, [data]);

  /** Fit map to Nigeria bounds on data load */
  useEffect(() => {
    if (!data || !mapRef.current || !mapLoaded) return;
    const map = mapRef.current.getMap();
    const bbox = computeBBox(data.features);
    if (bbox) {
      map.fitBounds(bbox, { padding: 50, duration: 1000 });
    }
  }, [data, mapLoaded]);

  /** Fly to selected LGA or reset view */
  useEffect(() => {
    const wasSelected = prevSelectedRef.current !== null;
    prevSelectedRef.current = selectedLGA ?? null;

    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current.getMap();

    if (!selectedLGA) {
      // Reset to Nigeria bounds when deselected
      if (wasSelected && data) {
        const bbox = computeBBox(data.features);
        if (bbox) {
          map.fitBounds(bbox, { padding: 50, duration: 800 });
        }
      }
      return;
    }

    // Fly to selected feature bounds
    const bbox = computeBBox([selectedLGA]);
    if (bbox) {
      map.fitBounds(bbox, { padding: 100, maxZoom: 10, duration: 800 });
    }
  }, [selectedLGA, data, mapLoaded]);

  /** Handle hover — highlight feature + tooltip */
  const onHover = useCallback((e: any) => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    const features = map.queryRenderedFeatures(e.point, { layers: ['lga-extrusion', 'lga-fill'] });

    if (features.length > 0) {
      map.getCanvas().style.cursor = 'pointer';
      const f = features[0];
      setHoveredFeature(f as unknown as HotspotFeature);
      setPopupCoords([e.lngLat.lng, e.lngLat.lat]);

      // Highlight: set filter on highlight layer
      map.setFilter('lga-highlight', [
        'all',
        ['==', ['get', 'LGA_Name'], f.properties.LGA_Name],
        ['==', ['get', 'State'], f.properties.State],
      ]);
    } else {
      map.getCanvas().style.cursor = '';
      setHoveredFeature(null);
      setPopupCoords(null);
      map.setFilter('lga-highlight', ['==', ['get', 'LGA_Name'], '']);
    }
  }, []);

  /** Handle click — trigger sidebar detail */
  const onClick = useCallback((e: any) => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    const features = map.queryRenderedFeatures(e.point, { layers: ['lga-extrusion', 'lga-fill'] });

    if (features.length > 0) {
      const props = features[0].properties;
      // Find matching feature from original data (has full geometry)
      if (data) {
        const match = data.features.find(
          (f) => f.properties.LGA_Name === props.LGA_Name && f.properties.State === props.State
        );
        if (match) onFeatureClick(match);
      }
    }
  }, [data, onFeatureClick]);

  const onMapLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

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

  const riskColor = hoveredFeature
    ? RISK_COLORS[(hoveredFeature.properties?.risk_level as RiskLevel)] || '#999'
    : '#999';

  return (
    <Map
      ref={mapRef}
      mapLib={maplibregl}
      key={theme}
      initialViewState={{
        longitude: 8.6753,
        latitude: 9.0820,
        zoom: 5.8,
        pitch: 45,
        bearing: -10,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLES[theme as 'dark' | 'light'] || MAP_STYLES.dark}
      onMouseMove={onHover}
      onClick={onClick}
      onLoad={onMapLoad}
      maxPitch={70}
      minZoom={5}
      maxZoom={13}
    >
      <NavigationControl position="top-right" visualizePitch showCompass />

      <Source id="lga-data" type="geojson" data={data} key={filterKey || 'all'}>
        {/* 3D extruded fill — the main visual */}
        <Layer
          id="lga-extrusion"
          type="fill-extrusion"
          paint={{
            'fill-extrusion-color': RISK_MATCH_EXPR,
            'fill-extrusion-height': RISK_HEIGHT_EXPR,
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.82,
          }}
        />

        {/* Flat fill for picking (invisible under extrusions but helps with click detection) */}
        <Layer
          id="lga-fill"
          type="fill"
          paint={{
            'fill-color': RISK_MATCH_EXPR,
            'fill-opacity': 0,
          }}
        />

        {/* Border lines on top of extrusions */}
        <Layer
          id="lga-borders"
          type="line"
          paint={{
            'line-color': RISK_BORDER_EXPR,
            'line-width': 0.8,
            'line-opacity': 0.6,
          }}
        />

        {/* Hover highlight line */}
        <Layer
          id="lga-highlight"
          type="line"
          filter={['==', ['get', 'LGA_Name'], '']}
          paint={{
            'line-color': '#ffffff',
            'line-width': 2.5,
            'line-opacity': 0.9,
          }}
        />
      </Source>

      {/* Hover popup */}
      {hoveredFeature && popupCoords && (
        <Popup
          longitude={popupCoords[0]}
          latitude={popupCoords[1]}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={15}
          className="map-3d-popup"
        >
          <div className="map-tooltip-inner map-tooltip-compact">
            <div className="tooltip-header">
              <div>
                <div className="tooltip-title">{hoveredFeature.properties?.LGA_Name}</div>
                <div className="tooltip-subtitle">{hoveredFeature.properties?.State} State</div>
              </div>
              <div
                className="tooltip-badge"
                style={{ background: riskColor, boxShadow: `0 0 8px ${riskColor}88` }}
              >
                {hoveredFeature.properties?.risk_level}
              </div>
            </div>
            <div className="tooltip-score-line">
              {hoveredFeature.properties?.composite_poverty_score != null
                ? `Composite: ${Number(hoveredFeature.properties.composite_poverty_score).toFixed(4)}`
                : `MPI: ${Number(hoveredFeature.properties?.MPI || 0).toFixed(4)}`}
            </div>
            <div className="tooltip-click-hint">Click for details</div>
          </div>
        </Popup>
      )}
    </Map>
  );
};

export default MapComponent;
