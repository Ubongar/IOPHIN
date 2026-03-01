/**
 * ScrollytellingTour — Enhanced narrative field-briefing overlay
 *
 * Features:
 *  • Intro chapter + per-LGA narrative slides
 *  • Rich data cards (MPI, nightlight, population, conflict, health, schools)
 *  • Animated countdown progress bar
 *  • Keyboard navigation (← → Space Esc)
 *  • Smooth slide-in/out transitions
 *  • Risk-level colour accents
 *  • Expandable detail panel
 *  • "Explore on Map" CTA
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { HotspotFeature } from '../types';
import { RISK_COLORS } from '../types';

// ─── helpers ────────────────────────────────────────────────────────────────

const SLIDE_DURATION_MS = 7000; // auto-advance interval

function fmt(n: number | undefined | null, decimals = 3): string {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

function fmtInt(n: number | undefined | null): string {
  if (n == null) return '—';
  return Math.round(n).toLocaleString();
}

/** Generate a short narrative sentence for a given LGA */
function buildNarrative(p: HotspotFeature['properties']): string {
  const parts: string[] = [];

  if (p.risk_level === 'Critical' || p.risk_level === 'High') {
    parts.push(`${p.LGA_Name} is among the most severely deprived areas in ${p.State}.`);
  } else if (p.risk_level === 'Medium') {
    parts.push(`${p.LGA_Name} faces moderate poverty pressures in ${p.State}.`);
  } else {
    parts.push(`${p.LGA_Name} shows relatively lower deprivation levels in ${p.State}.`);
  }

  if (p.MPI != null && p.MPI > 0.5) {
    parts.push('Multidimensional poverty is acute, with over half the population deprived across multiple dimensions.');
  } else if (p.MPI != null && p.MPI > 0.3) {
    parts.push('A significant share of residents experience overlapping deprivations in health, education, and living standards.');
  }

  if (p.conflict_flag === 'CRITICAL' || p.conflict_flag === 'HIGH') {
    parts.push('Active conflict events compound humanitarian needs and restrict service delivery.');
  }

  if (p.health_facility_count != null && p.health_facility_count < 5) {
    parts.push('Healthcare infrastructure is critically sparse.');
  }

  if (p.idp_count != null && p.idp_count > 1000) {
    parts.push(`An estimated ${fmtInt(p.idp_count)} internally displaced persons are present.`);
  }

  return parts.join(' ');
}

// ─── metric row ─────────────────────────────────────────────────────────────

interface MetricRowProps {
  label: string;
  value: string;
  icon: string;
  accent?: string;
}

function MetricRow({ label, value, icon, accent }: MetricRowProps) {
  return (
    <div className="flex items-center gap-2 py-1 border-b border-white/5 last:border-0">
      <span className="text-base w-5 text-center flex-shrink-0">{icon}</span>
      <span className="text-xs text-gray-400 flex-1 min-w-0 truncate">{label}</span>
      <span className="text-xs font-semibold tabular-nums" style={{ color: accent || '#e2e8f0' }}>{value}</span>
    </div>
  );
}

// ─── conflict badge ──────────────────────────────────────────────────────────

const CONFLICT_COLORS: Record<string, string> = {
  CRITICAL: '#7C3AED',
  HIGH: '#EF4444',
  MEDIUM: '#F59E0B',
  NORMAL: '#10B981',
};

function ConflictBadge({ flag }: { flag?: string }) {
  if (!flag || flag === 'NORMAL') return null;
  const color = CONFLICT_COLORS[flag] || '#888';
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
      style={{ background: color + '22', color, border: `1px solid ${color}55` }}
    >
      ⚔ {flag} Conflict
    </span>
  );
}

// ─── progress bar ────────────────────────────────────────────────────────────

interface ProgressBarProps {
  playing: boolean;
  duration: number;
  stepKey: number; // changes on each step to reset animation
}

function ProgressBar({ playing, duration, stepKey }: ProgressBarProps) {
  return (
    <div className="h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
      <div
        key={stepKey}
        className="h-full rounded-full"
        style={{
          background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
          width: playing ? '100%' : '0%',
          transition: playing ? `width ${duration}ms linear` : 'none',
        }}
      />
    </div>
  );
}

// ─── intro slide ─────────────────────────────────────────────────────────────

interface IntroSlideProps {
  count: number;
  onStart: () => void;
}

function IntroSlide({ count, onStart }: IntroSlideProps) {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-2">
      <div className="text-4xl">🗺️</div>
      <div>
        <h2 className="text-white font-bold text-base mb-1">Field Intelligence Briefing</h2>
        <p className="text-gray-400 text-xs leading-relaxed">
          A guided tour of the <span className="text-purple-400 font-semibold">{count} highest-risk</span> LGAs
          in the current dataset. Each slide surfaces key deprivation indicators, conflict status,
          and infrastructure gaps to support rapid situational awareness.
        </p>
      </div>
      <div className="flex gap-2 text-[10px] text-gray-500">
        <span className="bg-white/5 px-2 py-1 rounded">← → Navigate</span>
        <span className="bg-white/5 px-2 py-1 rounded">Space Pause</span>
        <span className="bg-white/5 px-2 py-1 rounded">Esc Close</span>
      </div>
      <button
        onClick={onStart}
        className="mt-1 px-5 py-2 rounded-lg text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
      >
        Begin Briefing →
      </button>
    </div>
  );
}

// ─── LGA slide ───────────────────────────────────────────────────────────────

interface LGASlideProps {
  feature: HotspotFeature;
  index: number;
  total: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onExplore: () => void;
}

function LGASlide({ feature, index, total, expanded, onToggleExpand, onExplore }: LGASlideProps) {
  const p = feature.properties;
  const riskColor = RISK_COLORS[p.risk_level] || '#888';
  const narrative = buildNarrative(p);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={{ background: riskColor + '22', color: riskColor, border: `1px solid ${riskColor}55` }}
            >
              {p.risk_level}
            </span>
            <ConflictBadge flag={p.conflict_flag} />
            <span className="text-[10px] text-gray-500">#{index + 1} of {total}</span>
          </div>
          <h3 className="text-white font-bold text-sm leading-tight truncate">{p.LGA_Name}</h3>
          <p className="text-gray-400 text-xs">{p.State} State</p>
        </div>
        {/* Composite score ring */}
        {p.composite_poverty_score != null && (
          <div
            className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: `conic-gradient(${riskColor} ${Math.min(p.composite_poverty_score * 100, 100)}%, #1f2937 0%)`,
              boxShadow: `0 0 0 2px #111827, 0 0 0 3px ${riskColor}55`,
            }}
          >
            <span className="bg-gray-900 rounded-full w-9 h-9 flex items-center justify-center text-[10px] font-bold" style={{ color: riskColor }}>
              {(p.composite_poverty_score * 100).toFixed(0)}
            </span>
          </div>
        )}
      </div>

      {/* Narrative */}
      <p className="text-xs text-gray-300 leading-relaxed border-l-2 pl-2" style={{ borderColor: riskColor + '88' }}>
        {narrative}
      </p>

      {/* Core metrics */}
      <div className="bg-white/5 rounded-lg px-3 py-1">
        <MetricRow label="MPI Score" value={fmt(p.MPI, 4)} icon="📊" accent={p.MPI != null && p.MPI > 0.4 ? '#EF4444' : '#10B981'} />
        <MetricRow label="Nightlight Intensity" value={fmt(p.mean_nightlight_intensity, 2)} icon="💡" />
        {p.composite_poverty_score != null && (
          <MetricRow label="Composite Score" value={fmt(p.composite_poverty_score, 4)} icon="🎯" accent={riskColor} />
        )}
        {p.population_density != null && (
          <MetricRow label="Population Density" value={`${fmtInt(p.population_density)} /km²`} icon="👥" />
        )}
      </div>

      {/* Expandable extra metrics */}
      {expanded && (
        <div className="bg-white/5 rounded-lg px-3 py-1 animate-[fadeIn_0.2s_ease]">
          {p.health_facility_count != null && (
            <MetricRow label="Health Facilities" value={fmtInt(p.health_facility_count)} icon="🏥"
              accent={p.health_facility_count < 5 ? '#EF4444' : '#10B981'} />
          )}
          {p.school_count != null && (
            <MetricRow label="Schools" value={fmtInt(p.school_count)} icon="🏫"
              accent={p.school_count < 10 ? '#F59E0B' : '#10B981'} />
          )}
          {p.road_density_km != null && (
            <MetricRow label="Road Density" value={`${fmt(p.road_density_km, 1)} km`} icon="🛣️" />
          )}
          {p.rainfall_mm != null && (
            <MetricRow label="Rainfall" value={`${fmtInt(p.rainfall_mm)} mm`} icon="🌧️" />
          )}
          {p.ndvi_mean != null && (
            <MetricRow label="NDVI (Vegetation)" value={fmt(p.ndvi_mean, 3)} icon="🌿" />
          )}
          {p.distance_to_urban_km != null && (
            <MetricRow label="Distance to Urban" value={`${fmt(p.distance_to_urban_km, 1)} km`} icon="🏙️" />
          )}
          {p.idp_count != null && p.idp_count > 0 && (
            <MetricRow label="IDP Count" value={fmtInt(p.idp_count)} icon="🏕️" accent="#F59E0B" />
          )}
          {p.food_price_index != null && (
            <MetricRow label="Food Price Index" value={fmt(p.food_price_index, 2)} icon="🌾" />
          )}
          {p.senatorial_mpi != null && (
            <MetricRow label="Senatorial MPI" value={fmt(p.senatorial_mpi, 4)} icon="🏛️" />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={onExplore}
          className="flex-1 text-xs py-1.5 rounded-lg font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${riskColor}cc, ${riskColor}88)` }}
        >
          🗺 Explore on Map
        </button>
        <button
          onClick={onToggleExpand}
          className="text-xs px-3 py-1.5 rounded-lg font-medium text-gray-300 bg-white/5 hover:bg-white/10 transition-colors"
        >
          {expanded ? '▲ Less' : '▼ More'}
        </button>
      </div>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

interface Props {
  features: HotspotFeature[];
  onSelectLGA?: (feature: HotspotFeature) => void;
  onClose?: () => void;
}

export default function ScrollytellingTour({ features, onSelectLGA, onClose }: Props) {
  // -1 = intro slide, 0..N-1 = LGA slides
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const containerRef = useRef<HTMLDivElement>(null);

  const top = [...features]
    .filter(f => f.properties.composite_poverty_score != null)
    .sort((a, b) => (b.properties.composite_poverty_score ?? 0) - (a.properties.composite_poverty_score ?? 0))
    .slice(0, 8);

  const isIntro = step === -1;
  const isLast = step === top.length - 1;
  const current = isIntro ? null : top[step];

  // Notify parent when LGA changes
  useEffect(() => {
    if (current) onSelectLGA?.(current);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance
  useEffect(() => {
    if (!playing || top.length === 0) return;
    const timer = setTimeout(() => {
      if (isLast) {
        setPlaying(false);
      } else {
        setDirection('forward');
        setStep(s => s + 1);
        setExpanded(false);
      }
    }, SLIDE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [playing, step, isLast, top.length]);

  const goNext = useCallback(() => {
    if (step < top.length - 1) {
      setDirection('forward');
      setStep(s => s + 1);
      setExpanded(false);
    }
  }, [step, top.length]);

  const goPrev = useCallback(() => {
    if (step > -1) {
      setDirection('back');
      setStep(s => s - 1);
      setExpanded(false);
    }
  }, [step]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { setPlaying(false); goNext(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { setPlaying(false); goPrev(); }
      else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
      else if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onClose]);

  if (top.length === 0) return null;

  const handleStart = () => {
    setDirection('forward');
    setStep(0);
    setPlaying(true);
  };

  const handleExplore = () => {
    if (current) {
      onSelectLGA?.(current);
      onClose?.();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Card */}
      <div
        ref={containerRef}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[360px] max-w-[calc(100vw-24px)]"
        style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.6))' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
            border: '1px solid rgba(99,102,241,0.3)',
          }}
        >
          {/* Top bar */}
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-purple-400 text-sm">📡</span>
              <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-widest">
                Field Briefing
              </span>
              {!isIntro && (
                <span className="text-[10px] text-gray-500 ml-1">
                  {step + 1} / {top.length}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 transition-colors w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
              aria-label="Close briefing"
            >
              ✕
            </button>
          </div>

          {/* Progress bar (only during LGA slides) */}
          {!isIntro && (
            <div className="px-4 pt-2">
              <ProgressBar playing={playing} duration={SLIDE_DURATION_MS} stepKey={step} />
            </div>
          )}

          {/* Dot indicators */}
          {!isIntro && (
            <div className="flex gap-1 justify-center pt-2 px-4">
              {top.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setPlaying(false); setDirection(i > step ? 'forward' : 'back'); setStep(i); setExpanded(false); }}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: i === step ? 16 : 6,
                    height: 6,
                    background: i === step ? '#6366f1' : i < step ? '#4f46e5' : 'rgba(255,255,255,0.15)',
                  }}
                  aria-label={`Go to LGA ${i + 1}`}
                />
              ))}
            </div>
          )}

          {/* Slide content */}
          <div
            className="px-4 pb-4 pt-3"
            key={`slide-${step}-${direction}`}
            style={{
              animation: `slideIn${direction === 'forward' ? 'Right' : 'Left'} 0.25s ease`,
            }}
          >
            {isIntro ? (
              <IntroSlide count={top.length} onStart={handleStart} />
            ) : current ? (
              <LGASlide
                feature={current}
                index={step}
                total={top.length}
                expanded={expanded}
                onToggleExpand={() => setExpanded(e => !e)}
                onExplore={handleExplore}
              />
            ) : null}
          </div>

          {/* Bottom controls (LGA slides only) */}
          {!isIntro && (
            <div
              className="flex items-center justify-between px-4 py-2.5 gap-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <button
                onClick={() => { setPlaying(false); goPrev(); }}
                disabled={step <= 0}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
              >
                ‹ Prev
              </button>

              <button
                onClick={() => setPlaying(p => !p)}
                className="text-xs px-4 py-1.5 rounded-lg font-semibold text-white transition-colors"
                style={{ background: playing ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.7)' }}
              >
                {playing ? '⏸ Pause' : '▶ Play'}
              </button>

              <button
                onClick={() => { setPlaying(false); goNext(); }}
                disabled={isLast}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Next ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Keyframe animations injected once */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
