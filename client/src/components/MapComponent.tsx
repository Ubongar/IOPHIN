/**
 * MapComponent - Core Interactive Map
 * Renders Nigeria's LGAs with risk-based color coding using React-Leaflet
 */

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import { LatLngBounds } from 'leaflet';
import type { GeoJSON as GeoJSONType, PathOptions } from 'leaflet';
import { RISK_COLORS } from '../types';
import type { HotspotsGeoJSON, HotspotFeature } from '../types';

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

  /**
   * Style function: Color LGAs based on risk level
   */
  const styleFeature = (feature?: any): PathOptions => {
    if (!feature || !feature.properties) return {};

    const riskLevel = feature.properties.risk_level;
    const color = RISK_COLORS[riskLevel as keyof typeof RISK_COLORS] || '#999999';

    return {
      fillColor: color,
      weight: 1,
      opacity: 1,
      color: 'white',
      fillOpacity: 0.7,
    };
  };

  /**
   * Highlight feature on hover
   */
  const highlightFeature = (e: any) => {
    const layer = e.target;
    layer.setStyle({
      weight: 3,
      color: '#ffffff',
      fillOpacity: 0.9,
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
        // Zoom to feature
        const bounds = layer.getBounds();
        layer._map.fitBounds(bounds, { 
          padding: [100, 100],
          maxZoom: 10 
        });

        // Trigger sidebar update
        onFeatureClick(feature);
      },
    });
  };

  /**
   * Bind events to each feature
   */
  const onEachFeature = (feature: any, layer: any) => {
    const typedFeature = feature as HotspotFeature;
    const { LGA_Name, State, risk_level, MPI, mean_nightlight_intensity } = typedFeature.properties;

    // Tooltip with LGA info (build DOM to avoid XSS from interpolated HTML)
    const container = document.createElement('div');
    container.className = 'font-sans';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'font-bold text-base mb-1';
    titleDiv.textContent = LGA_Name ?? '';
    container.appendChild(titleDiv);

    const stateDiv = document.createElement('div');
    stateDiv.className = 'text-sm text-gray-600 mb-2';
    stateDiv.textContent = `${State ?? ''} State`;
    container.appendChild(stateDiv);

    const riskRow = document.createElement('div');
    riskRow.className = 'flex items-center gap-2 mb-1';

    const riskDot = document.createElement('span');
    riskDot.className = 'inline-block w-3 h-3 rounded-full';
    riskDot.style.backgroundColor = RISK_COLORS[risk_level];
    riskRow.appendChild(riskDot);

    const riskLabel = document.createElement('span');
    riskLabel.className = 'font-semibold text-sm';
    riskLabel.textContent = `${risk_level} Risk`;
    riskRow.appendChild(riskLabel);

    container.appendChild(riskRow);

    const metricsContainer = document.createElement('div');
    metricsContainer.className = 'text-xs text-gray-700 mt-2';

    const mpiDiv = document.createElement('div');
    mpiDiv.textContent = `MPI: ${MPI.toFixed(4)}`;
    metricsContainer.appendChild(mpiDiv);

    const nightlightDiv = document.createElement('div');
    nightlightDiv.textContent = `Nightlight: ${mean_nightlight_intensity.toFixed(2)}`;
    metricsContainer.appendChild(nightlightDiv);

    container.appendChild(metricsContainer);

    layer.bindTooltip(container, {
      sticky: true,
      className: 'custom-tooltip',
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
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading map data...</p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={[9.0820, 8.6753]} // Nigeria center
      zoom={6}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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
