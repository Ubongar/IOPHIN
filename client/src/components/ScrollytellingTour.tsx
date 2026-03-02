/**
 * ScrollytellingTour — Field Intelligence Briefing
 * Renders as a sidebar panel (not overlay) when inSidebar=true.
 * Each slide highlights the corresponding LGA on the map via onSelectLGA.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { HotspotFeature } from '../types';
import { RISK_COLORS } from '../types';

const SLIDE_DURATION_MS = 7000;

function fmt(n: number | undefined | null, decimals = 3): string {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

function fmtInt(n: number | undefined | null): string {
  if (n == null) return '—';
  return Math.round(n).toLocaleString();
}

function buildNarrative(p: HotspotFeature['properties']): string {
  const parts: string[] = [];
  if (p.risk_level === 'Critical' || p.risk_level === 'High') {
    parts.push(`${p.LGA_Name} is among the most severely deprived areas in ${p.State}.`);
  } else if (p.risk_level === 'Medium') {
    parts.push(`${p.LGA_Name} faces moderate poverty pressures in ${p.State}.`);
  } else {
    parts.push(`${p.LGA_Name} shows relatively lower deprivation levels in ${p.State}.`);
  }
  if (p.MPI != null && p.MPI > 0.5) parts.push('Multidimensional poverty is acute.');
  else if (p.MPI != null && p.MPI > 0.3) parts.push('Significant overlapping deprivations exist.');
  if (p.conflict_flag === 'CRITICAL' || p.conflict_flag === 'HIGH') parts.push('Active conflict compounds humanitarian needs.');
  if (p.health_facility_count != null && p.health_facility_count < 5) parts.push('Healthcare infrastructure is critically sparse.');
  if (p.idp_count != null && p.idp_count > 1000) parts.push(`Est. ${fmtInt(p.idp_count)} IDPs present.`);
  return parts.join(' ');
}

interface MetricRowProps { label: string; value: string; icon: string; accent?: string; }
function MetricRow({ label, value, icon, accent }: MetricRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12, color: '#94a3b8', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: accent || '#e2e8f0' }}>{value}</span>
    </div>
  );
}

const CONFLICT_COLORS: Record<string, string> = { CRITICAL: '#7C3AED', HIGH: '#EF4444', MEDIUM: '#F59E0B', NORMAL: '#10B981' };

function ConflictBadge({ flag }: { flag?: string }) {
  if (!flag || flag === 'NORMAL') return null;
  const color = CONFLICT_COLORS[flag] || '#888';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' as const, letterSpacing: '0.04em', background: color + '22', color, border: `1px solid ${color}55` }}>
      {flag} Conflict
    </span>
  );
}

function ProgressBar({ playing, duration, stepKey }: { playing: boolean; duration: number; stepKey: number }) {
  return (
    <div style={{ height: 2, width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
      <div key={stepKey} style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', width: playing ? '100%' : '0%', transition: playing ? `width ${duration}ms linear` : 'none' }} />
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

interface Props {
  features: HotspotFeature[];
  onSelectLGA?: (feature: HotspotFeature) => void;
  onClose?: () => void;
  inSidebar?: boolean;
}

export default function ScrollytellingTour({ features, onSelectLGA, onClose, inSidebar = false }: Props) {
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

  // Fly to + highlight LGA on map when step changes
  useEffect(() => {
    if (current) onSelectLGA?.(current);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance
  useEffect(() => {
    if (!playing || top.length === 0) return;
    const timer = setTimeout(() => {
      if (isLast) { setPlaying(false); }
      else { setDirection('forward'); setStep(s => s + 1); setExpanded(false); }
    }, SLIDE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [playing, step, isLast, top.length]);

  const goNext = useCallback(() => {
    if (step < top.length - 1) { setDirection('forward'); setStep(s => s + 1); setExpanded(false); }
  }, [step, top.length]);

  const goPrev = useCallback(() => {
    if (step > -1) { setDirection('back'); setStep(s => s - 1); setExpanded(false); }
  }, [step]);

  // Keyboard
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

  const handleStart = () => { setDirection('forward'); setStep(0); setPlaying(true); };

  const handleExplore = () => {
    if (current) { onSelectLGA?.(current); onClose?.(); }
  };

  // ─── Sidebar layout ───
  const renderContent = () => {
    const p = current?.properties;
    const riskColor = p ? RISK_COLORS[p.risk_level] || '#888' : '#6366f1';

    return (
      <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#a78bfa', fontSize: 14 }}>📡</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Field Briefing</span>
            {!isIntro && <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 4 }}>{step + 1} / {top.length}</span>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 16 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            aria-label="Close briefing">✕</button>
        </div>

        {/* Progress bar */}
        {!isIntro && (
          <div style={{ padding: '10px 18px 0' }}>
            <ProgressBar playing={playing} duration={SLIDE_DURATION_MS} stepKey={step} />
          </div>
        )}

        {/* Dot indicators */}
        {!isIntro && (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', padding: '10px 18px 0' }}>
            {top.map((_, i) => (
              <button key={i} onClick={() => { setPlaying(false); setDirection(i > step ? 'forward' : 'back'); setStep(i); setExpanded(false); }}
                style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 99, border: 'none', cursor: 'pointer', background: i === step ? '#6366f1' : i < step ? '#4f46e5' : 'rgba(255,255,255,0.15)', transition: 'all .2s' }}
                aria-label={`Go to LGA ${i + 1}`} />
            ))}
          </div>
        )}

        {/* Scrollable slide content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px', minHeight: 0 }}
          key={`slide-${step}-${direction}`}>

          {isIntro ? (
            /* Intro slide */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20, paddingTop: 40 }}>
              <div style={{ fontSize: 48 }}>🗺️</div>
              <div>
                <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Field Intelligence Briefing</h2>
                <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
                  A guided tour of the <span style={{ color: '#a78bfa', fontWeight: 600 }}>{top.length} highest-risk</span> LGAs.
                  Each slide surfaces key deprivation indicators, conflict status, and infrastructure gaps.
                  The map will highlight and fly to each LGA automatically.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#6b7280' }}>
                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 6 }}>← → Navigate</span>
                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 6 }}>Space Pause</span>
                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 6 }}>Esc Close</span>
              </div>
              <button onClick={handleStart}
                style={{ marginTop: 8, padding: '10px 28px', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', cursor: 'pointer' }}>
                Begin Briefing →
              </button>
            </div>
          ) : p ? (
            /* LGA slide */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Slide header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' as const, letterSpacing: '0.04em', background: riskColor + '22', color: riskColor, border: `1px solid ${riskColor}55` }}>{p.risk_level}</span>
                    <ConflictBadge flag={p.conflict_flag} />
                    <span style={{ fontSize: 10, color: '#6b7280' }}>#{step + 1} of {top.length}</span>
                  </div>
                  <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p.LGA_Name}</h3>
                  <p style={{ color: '#94a3b8', fontSize: 12, margin: '2px 0 0' }}>{p.State} State</p>
                </div>
                {p.composite_poverty_score != null && (
                  <div style={{ flexShrink: 0, width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `conic-gradient(${riskColor} ${Math.min(p.composite_poverty_score * 100, 100)}%, #1f2937 0%)`, boxShadow: `0 0 0 2px #111827, 0 0 0 3px ${riskColor}55` }}>
                    <span style={{ background: '#111827', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: riskColor }}>{(p.composite_poverty_score * 100).toFixed(0)}</span>
                  </div>
                )}
              </div>

              {/* Narrative */}
              <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, borderLeft: `2px solid ${riskColor}88`, paddingLeft: 10, margin: 0 }}>
                {buildNarrative(p)}
              </p>

              {/* Core metrics */}
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '4px 14px' }}>
                <MetricRow label="MPI Score" value={fmt(p.MPI, 4)} icon="📊" accent={p.MPI != null && p.MPI > 0.4 ? '#EF4444' : '#10B981'} />
                <MetricRow label="Nightlight Intensity" value={fmt(p.mean_nightlight_intensity, 2)} icon="💡" />
                {p.composite_poverty_score != null && <MetricRow label="Composite Score" value={fmt(p.composite_poverty_score, 4)} icon="🎯" accent={riskColor} />}
                {p.population_density != null && <MetricRow label="Pop. Density" value={`${fmtInt(p.population_density)} /km²`} icon="👥" />}
              </div>

              {/* Expanded metrics */}
              {expanded && (
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '4px 14px' }}>
                  {p.health_facility_count != null && <MetricRow label="Health Facilities" value={fmtInt(p.health_facility_count)} icon="🏥" accent={p.health_facility_count < 5 ? '#EF4444' : '#10B981'} />}
                  {p.school_count != null && <MetricRow label="Schools" value={fmtInt(p.school_count)} icon="🏫" accent={p.school_count < 10 ? '#F59E0B' : '#10B981'} />}
                  {p.road_density_km != null && <MetricRow label="Road Density" value={`${fmt(p.road_density_km, 1)} km`} icon="🛣️" />}
                  {p.rainfall_mm != null && <MetricRow label="Rainfall" value={`${fmtInt(p.rainfall_mm)} mm`} icon="🌧️" />}
                  {p.ndvi_mean != null && <MetricRow label="NDVI" value={fmt(p.ndvi_mean, 3)} icon="🌿" />}
                  {p.distance_to_urban_km != null && <MetricRow label="Dist. to Urban" value={`${fmt(p.distance_to_urban_km, 1)} km`} icon="🏙️" />}
                  {p.idp_count != null && p.idp_count > 0 && <MetricRow label="IDP Count" value={fmtInt(p.idp_count)} icon="🏕️" accent="#F59E0B" />}
                  {p.food_price_index != null && <MetricRow label="Food Price Index" value={fmt(p.food_price_index, 2)} icon="🌾" />}
                  {p.senatorial_mpi != null && <MetricRow label="Senatorial MPI" value={fmt(p.senatorial_mpi, 4)} icon="🏛️" />}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleExplore}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', background: `linear-gradient(135deg, ${riskColor}cc, ${riskColor}88)`, border: 'none', cursor: 'pointer' }}>
                  🗺 Explore on Map
                </button>
                <button onClick={() => setExpanded(e => !e)}
                  style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, color: '#cbd5e1', background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer' }}>
                  {expanded ? '▲ Less' : '▼ More'}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Bottom controls */}
        {!isIntro && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <button onClick={() => { setPlaying(false); goPrev(); }} disabled={step <= 0}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: step <= 0 ? '#374151' : '#d1d5db', border: 'none', cursor: step <= 0 ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
              ‹ Prev
            </button>
            <button onClick={() => setPlaying(p => !p)}
              style={{ fontSize: 12, padding: '6px 20px', borderRadius: 8, fontWeight: 600, color: '#fff', background: playing ? 'rgba(99,102,241,.3)' : 'rgba(99,102,241,.7)', border: 'none', cursor: 'pointer' }}>
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
            <button onClick={() => { setPlaying(false); goNext(); }} disabled={isLast}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: isLast ? '#374151' : '#d1d5db', border: 'none', cursor: isLast ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
              Next ›
            </button>
          </div>
        )}
      </div>
    );
  };

  // If rendering in sidebar mode, just return the content (parent provides the panel)
  if (inSidebar) {
    return renderContent();
  }

  // Legacy overlay mode (fallback)
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[360px] max-w-[calc(100vw-24px)]"
        style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.6))' }} onClick={e => e.stopPropagation()}>
        <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)', border: '1px solid rgba(99,102,241,0.3)', maxHeight: '70vh', overflowY: 'auto' }}>
          {renderContent()}
        </div>
      </div>
      <style>{`
        @keyframes slideInRight { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-18px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );
}
