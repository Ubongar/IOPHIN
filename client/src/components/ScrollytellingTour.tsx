import { useState, useEffect } from 'react';
import type { HotspotFeature } from '../types';
import { RISK_COLORS } from '../types';

interface Props {
  features: HotspotFeature[];
  onSelectLGA?: (feature: HotspotFeature) => void;
  onClose?: () => void;
}

export default function ScrollytellingTour({ features, onSelectLGA, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  const top5 = [...features]
    .filter(f => f.properties.composite_poverty_score != null)
    .sort((a, b) => (b.properties.composite_poverty_score ?? 0) - (a.properties.composite_poverty_score ?? 0))
    .slice(0, 5);

  const current = top5[step];

  useEffect(() => {
    if (!current) return;
    onSelectLGA?.(current);
  }, [step, current]);

  useEffect(() => {
    if (!playing || top5.length === 0) return;
    const timer = setTimeout(() => {
      if (step < top5.length - 1) setStep(s => s + 1);
      else setPlaying(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [playing, step, top5.length]);

  if (top5.length === 0) return null;

  const p = current.properties as any;
  const riskColor = RISK_COLORS[p.risk_level as keyof typeof RISK_COLORS] || '#888';

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 border border-gray-600 rounded-xl shadow-2xl p-5 w-80 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
          🗺 Field Briefing {step + 1} of {top5.length}
        </span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
      </div>
      <h3 className="text-base font-bold text-white mb-0.5">
        {p.LGA_Name}, {p.State}
      </h3>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: riskColor + '33', color: riskColor }}>
          {p.risk_level}
        </span>
        {p.composite_poverty_score != null && (
          <span className="text-xs text-gray-400">Score: {p.composite_poverty_score.toFixed(3)}</span>
        )}
      </div>
      {p.MPI != null && <p className="text-xs text-gray-400 mb-1">MPI: {p.MPI.toFixed(4)}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => { setPlaying(false); if (step > 0) setStep(s => s - 1); }}
          disabled={step === 0}
          className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 disabled:opacity-40">‹ Prev</button>
        <button onClick={() => setPlaying(!playing)}
          className="text-xs px-2 py-1 rounded bg-blue-600 text-white">
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={() => { setPlaying(false); if (step < top5.length - 1) setStep(s => s + 1); }}
          disabled={step === top5.length - 1}
          className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 disabled:opacity-40">Next ›</button>
      </div>
      <div className="mt-2 flex gap-1">
        {top5.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i === step ? 'bg-blue-500' : 'bg-gray-600'}`} />
        ))}
      </div>
    </div>
  );
}
