import { useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { CorrelationPoint, RiskLevel } from '../types';
import { RISK_COLORS } from '../types';

const METRICS = [
  { id: 'mpi', label: 'MPI' },
  { id: 'mean_nightlight_intensity', label: 'Nightlight' },
  { id: 'composite_poverty_score', label: 'Composite Score' },
  { id: 'health_facility_count', label: 'Health Facilities' },
  { id: 'school_count', label: 'Schools' },
  { id: 'road_density_km', label: 'Road Density' },
  { id: 'population_density', label: 'Population Density' },
  { id: 'ndvi_mean', label: 'NDVI' },
  { id: 'rainfall_mm', label: 'Rainfall (mm)' },
  { id: 'idp_count', label: 'IDP Count' },
  { id: 'food_price_index', label: 'Food Price Index' },
];

interface Props {
  data: CorrelationPoint[];
  onMetricChange: (m1: string, m2: string) => void;
  onSelectLGA?: (name: string) => void;
}

export default function CorrelationScatter({ data, onMetricChange, onSelectLGA }: Props) {
  const [xMetric, setXMetric] = useState('mpi');
  const [yMetric, setYMetric] = useState('mean_nightlight_intensity');

  const handleChange = (axis: 'x' | 'y', value: string) => {
    if (axis === 'x') { setXMetric(value); onMetricChange(value, yMetric); }
    else { setYMetric(value); onMetricChange(xMetric, value); }
  };

  const byRisk: Record<string, CorrelationPoint[]> = {};
  data.forEach(d => {
    if (!byRisk[d.risk_level]) byRisk[d.risk_level] = [];
    byRisk[d.risk_level].push(d);
  });

  const xLabel = METRICS.find(m => m.id === xMetric)?.label || xMetric;
  const yLabel = METRICS.find(m => m.id === yMetric)?.label || yMetric;

  return (
    <div>
      <div className="flex gap-3 mb-3 flex-wrap">
        <div>
          <label className="text-xs text-gray-400 mr-1">X:</label>
          <select className="text-xs bg-gray-700 text-gray-200 rounded px-2 py-1 border border-gray-600"
            value={xMetric} onChange={e => handleChange('x', e.target.value)}>
            {METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mr-1">Y:</label>
          <select className="text-xs bg-gray-700 text-gray-200 rounded px-2 py-1 border border-gray-600"
            value={yMetric} onChange={e => handleChange('y', e.target.value)}>
            {METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="x" name={xLabel} tick={{ fontSize: 10, fill: '#9CA3AF' }} label={{ value: xLabel, position: 'insideBottom', offset: -10, fill: '#9CA3AF', fontSize: 10 }} />
          <YAxis dataKey="y" name={yLabel} tick={{ fontSize: 10, fill: '#9CA3AF' }} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#9CA3AF', fontSize: 10 }} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload as CorrelationPoint;
              return (
                <div className="bg-gray-800 border border-gray-600 rounded p-2 text-xs">
                  <div className="font-semibold text-white">{d.lga_name}</div>
                  <div className="text-gray-400">{d.state}</div>
                  <div>{xLabel}: {typeof d.x === 'number' ? d.x.toFixed(3) : d.x}</div>
                  <div>{yLabel}: {typeof d.y === 'number' ? d.y.toFixed(3) : d.y}</div>
                </div>
              );
            }}
          />
          {Object.entries(byRisk).map(([risk, points]) => (
            <Scatter
              key={risk} name={risk} data={points}
              fill={RISK_COLORS[risk as RiskLevel] || '#888'}
              opacity={0.7}
              onClick={(d) => onSelectLGA?.(d.lga_name)}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
