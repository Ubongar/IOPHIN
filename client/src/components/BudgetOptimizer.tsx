import { useState, useMemo } from 'react';
import type { HotspotFeature } from '../types';

interface Props {
  features: HotspotFeature[];
  onSelectLGA?: (name: string) => void;
  searchQuery?: string;
  stateFilter?: string;
  riskFilter?: string;
}

interface Recommendation {
  name: string;
  state: string;
  score: number;
  allocated: number;
  composite: number;
  population: number;
  pct: number;
  riskLevel: string;
}

const SLIDER_MIN = 100_000;
const SLIDER_MAX = 50_000_000;
const SLIDER_STEP = 100_000;

/** Parse a currency string like "$1,200,000", "1.5M", "500K", "2B", "5000000" into a number */
function parseCurrency(raw: string): number | null {
  let s = raw.trim().replace(/^\$/, '').replace(/,/g, '').trim();
  if (!s) return null;
  const multipliers: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };
  const lastChar = s.slice(-1).toLowerCase();
  if (multipliers[lastChar]) {
    const num = parseFloat(s.slice(0, -1));
    return isNaN(num) ? null : Math.round(num * multipliers[lastChar]);
  }
  const num = parseFloat(s);
  return isNaN(num) ? null : Math.round(num);
}

/** Format a number as a readable currency string for the input field */
function formatCurrencyInput(n: number): string {
  return '$' + n.toLocaleString('en-US');
}

export default function BudgetOptimizer({ features, onSelectLGA, searchQuery = '', stateFilter = '', riskFilter = '' }: Props) {
  const [budget, setBudget] = useState(1000000);
  const [budgetInputText, setBudgetInputText] = useState(formatCurrencyInput(1000000));
  const [budgetInputFocused, setBudgetInputFocused] = useState(false);
  const [selectedLGAs, setSelectedLGAs] = useState<string[]>([]);
  const [lgaSearchTerm, setLgaSearchTerm] = useState('');
  const [showLGASelector, setShowLGASelector] = useState(false);

  /** Called when slider changes — update budget + sync text input */
  const handleSliderChange = (val: number) => {
    setBudget(val);
    if (!budgetInputFocused) setBudgetInputText(formatCurrencyInput(val));
  };

  /** Called when text input is committed (blur or Enter) */
  const commitBudgetInput = () => {
    const parsed = parseCurrency(budgetInputText);
    if (parsed !== null && parsed > 0) {
      setBudget(parsed);
      setBudgetInputText(formatCurrencyInput(parsed));
    } else {
      // revert to current budget if invalid
      setBudgetInputText(formatCurrencyInput(budget));
    }
  };

  const isOutsideSliderRange = budget < SLIDER_MIN || budget > SLIDER_MAX;

  // First apply filters from the global search/filter
  const filteredFeatures = useMemo(() => {
    let list = [...features];

    // Apply state filter
    if (stateFilter) {
      list = list.filter(f => f.properties.State === stateFilter);
    }

    // Apply risk filter
    if (riskFilter) {
      list = list.filter(f => f.properties.risk_level === riskFilter);
    }

    // Apply search filter
    if (searchQuery.length >= 2) {
      const term = searchQuery.toLowerCase();
      list = list.filter(f =>
        f.properties.LGA_Name.toLowerCase().includes(term) ||
        f.properties.State.toLowerCase().includes(term)
      );
    }

    return list;
  }, [features, searchQuery, stateFilter, riskFilter]);

  // Available LGAs for selection (from filtered features)
  const availableLGAs = useMemo(() => {
    return filteredFeatures
      .map(f => ({ name: f.properties.LGA_Name, state: f.properties.State, risk: f.properties.risk_level }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredFeatures]);

  // LGAs filtered by the LGA search term in the selector
  const lgaSelectorList = useMemo(() => {
    if (!lgaSearchTerm) return availableLGAs;
    const term = lgaSearchTerm.toLowerCase();
    return availableLGAs.filter(l =>
      l.name.toLowerCase().includes(term) || l.state.toLowerCase().includes(term)
    );
  }, [availableLGAs, lgaSearchTerm]);

  const toggleLGA = (name: string) => {
    setSelectedLGAs(prev =>
      prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
    );
  };

  const clearLGASelection = () => setSelectedLGAs([]);

  // Features to use for optimization: selected LGAs or all filtered
  const optimizationFeatures = useMemo(() => {
    if (selectedLGAs.length === 0) return filteredFeatures;
    return filteredFeatures.filter(f => selectedLGAs.includes(f.properties.LGA_Name));
  }, [filteredFeatures, selectedLGAs]);

  const ranked: Recommendation[] = useMemo(() => {
    const list = optimizationFeatures
      .map(f => {
        const p = f.properties as any;
        const composite = p.composite_poverty_score ?? 0;
        const pop = p.population_density ?? 1;
        const dist = Math.max(p.distance_to_urban_km ?? 10, 1);
        const score = (composite * pop) / dist;
        return {
          name: p.LGA_Name,
          state: p.State,
          score,
          composite,
          population: pop,
          allocated: 0,
          pct: 0,
          riskLevel: p.risk_level ?? 'Unknown',
        };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, selectedLGAs.length > 0 ? selectedLGAs.length : 20);

    const totalScore = list.reduce((s, r) => s + r.score, 0);
    return list.map(r => ({
      ...r,
      allocated: totalScore > 0 ? (r.score / totalScore) * budget : 0,
      pct: totalScore > 0 ? (r.score / totalScore) * 100 : 0,
    }));
  }, [optimizationFeatures, budget, selectedLGAs]);

  const formatBudget = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  };

  const RISK_COLORS: Record<string, string> = {
    Critical: '#7C3AED',
    High: '#EF4444',
    Medium: '#F59E0B',
    Low: '#10B981',
    Minimal: '#3B82F6',
  };

  return (
    <div className="rankings-container">
      <div className="rankings-header">
        <div>
          <h2 className="rankings-title">Budget Optimizer</h2>
          <p className="rankings-subtitle">
            {selectedLGAs.length > 0
              ? `Optimizing across ${selectedLGAs.length} selected LGA${selectedLGAs.length !== 1 ? 's' : ''}`
              : `Optimal resource allocation across top 20 priority LGAs`}
          </p>
        </div>
      </div>

      {/* LGA Selector */}
      <div className="metric-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="metric-label" style={{ margin: 0 }}>Target LGAs</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {selectedLGAs.length > 0 && (
              <button
                onClick={clearLGASelection}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)',
                  color: '#f87171', cursor: 'pointer',
                }}>
                Clear ({selectedLGAs.length})
              </button>
            )}
            <button
              onClick={() => setShowLGASelector(!showLGASelector)}
              style={{
                fontSize: 11, padding: '3px 12px', borderRadius: 'var(--radius-sm)',
                background: showLGASelector ? 'var(--blue)' : 'var(--bg-panel)',
                border: `1px solid ${showLGASelector ? 'var(--blue)' : 'var(--border)'}`,
                color: showLGASelector ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}>
              {showLGASelector ? '▲ Hide' : '▼ Select LGAs'}
            </button>
          </div>
        </div>

        {/* Selected LGA chips */}
        {selectedLGAs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: showLGASelector ? 10 : 0 }}>
            {selectedLGAs.map(name => {
              const lga = availableLGAs.find(l => l.name === name);
              return (
                <span key={name} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.3)',
                  fontSize: 11, color: 'var(--blue-light)',
                }}>
                  {name}
                  {lga && <span style={{ color: 'var(--text-quaternary)', fontSize: 10 }}>· {lga.state}</span>}
                  <button
                    onClick={() => toggleLGA(name)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-quaternary)', padding: 0, lineHeight: 1, fontSize: 12 }}>
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* LGA dropdown selector */}
        {showLGASelector && (
          <div style={{
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-base)', overflow: 'hidden',
          }}>
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <input
                type="text"
                placeholder="Search LGAs..."
                value={lgaSearchTerm}
                onChange={e => setLgaSearchTerm(e.target.value)}
                style={{
                  width: '100%', padding: '5px 10px', fontSize: 12,
                  background: 'var(--bg-panel)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {lgaSelectorList.length === 0 ? (
                <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-quaternary)' }}>
                  No LGAs match your search
                </div>
              ) : (
                lgaSelectorList.map(lga => {
                  const isSelected = selectedLGAs.includes(lga.name);
                  const riskColor = RISK_COLORS[lga.risk] || '#999';
                  return (
                    <div
                      key={lga.name + lga.state}
                      onClick={() => toggleLGA(lga.name)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 14px', cursor: 'pointer', fontSize: 12,
                        background: isSelected ? 'rgba(59,130,246,.08)' : 'transparent',
                        borderLeft: isSelected ? '3px solid var(--blue)' : '3px solid transparent',
                        transition: 'background .1s',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-panel)'; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                          background: isSelected ? 'var(--blue)' : 'var(--bg-panel)',
                          border: `1px solid ${isSelected ? 'var(--blue)' : 'var(--border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isSelected && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>✓</span>}
                        </span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: isSelected ? 600 : 400 }}>{lga.name}</span>
                        <span style={{ color: 'var(--text-quaternary)', fontSize: 11 }}>{lga.state}</span>
                      </div>
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        background: riskColor + '20', color: riskColor, fontWeight: 600,
                      }}>
                        {lga.risk}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{
              padding: '6px 14px', borderTop: '1px solid var(--border)',
              fontSize: 11, color: 'var(--text-quaternary)',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>{lgaSelectorList.length} LGAs available</span>
              {selectedLGAs.length > 0 && (
                <span style={{ color: 'var(--blue-light)' }}>{selectedLGAs.length} selected</span>
              )}
            </div>
          </div>
        )}

        {selectedLGAs.length === 0 && !showLGASelector && (
          <p style={{ fontSize: 11, color: 'var(--text-quaternary)', margin: 0 }}>
            No LGAs selected — showing top 20 by priority score. Click "Select LGAs" to target specific LGAs.
          </p>
        )}
      </div>

      {/* Budget Slider + Input */}
      <div className="metric-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="metric-label" style={{ margin: 0 }}>Total Budget</span>
          <span className="metric-value" style={{ fontSize: 24, color: 'var(--blue-light)' }}>
            {formatBudget(budget)}
          </span>
        </div>

        {/* Primary: Slider */}
        <input type="range" min={SLIDER_MIN} max={SLIDER_MAX} step={SLIDER_STEP}
          value={Math.min(Math.max(budget, SLIDER_MIN), SLIDER_MAX)}
          onChange={e => handleSliderChange(Number(e.target.value))}
          className="budget-slider"
          aria-label="Total budget slider"
          title="Total budget slider" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-quaternary)', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
          <span>$100K</span><span>$50M</span>
        </div>

        {/* Secondary: Exact Amount Input */}
        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 6, fontWeight: 500 }}>
            Or enter exact amount
            <span style={{ fontWeight: 400, marginLeft: 4 }}>(e.g. $2,500,000 or 1.5M)</span>
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={budgetInputText}
              onChange={e => setBudgetInputText(e.target.value)}
              onFocus={() => setBudgetInputFocused(true)}
              onBlur={() => { setBudgetInputFocused(false); commitBudgetInput(); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitBudgetInput(); (e.target as HTMLInputElement).blur(); } }}
              aria-label="Enter exact budget amount"
              placeholder="$1,000,000"
              style={{
                flex: 1, padding: '8px 12px', fontSize: 14, fontWeight: 600,
                fontFamily: "'JetBrains Mono', monospace",
                background: 'var(--bg-base)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                outline: 'none', transition: 'border-color .15s',
                borderColor: budgetInputFocused ? 'var(--blue)' : 'var(--border)',
              }}
            />
          </div>
          {isOutsideSliderRange && (
            <p style={{ fontSize: 11, color: 'var(--amber)', marginTop: 6, marginBottom: 0 }}>
              Amount is outside the slider range ({formatBudget(SLIDER_MIN)} – {formatBudget(SLIDER_MAX)}). The optimizer will use your entered value.
            </p>
          )}
        </div>
      </div>

      {/* Formula explanation */}
      <div className="source-chip" style={{ marginBottom: 16 }}>
        <span className="source-label">Ranking Formula</span>
        <span className="source-value">composite_score × pop_density / urban_distance</span>
      </div>

      {/* Allocation Table */}
      <div className="rankings-table-wrap">
        <table className="rankings-table">
          <thead>
            <tr>
              <th>#</th>
              <th>LGA</th>
              <th>State</th>
              <th className="hide-mobile">Risk</th>
              <th className="hide-mobile">Priority Score</th>
              <th>Allocation</th>
              <th className="hide-mobile">Share</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => {
              const riskColor = RISK_COLORS[r.riskLevel] || '#999';
              return (
                <tr key={i} className="rankings-row" onClick={() => onSelectLGA?.(r.name)}>
                  <td className="rank-cell">{i + 1}</td>
                  <td className="lga-cell">
                    <button style={{ color: 'var(--blue-light)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600 }}
                      onClick={(e) => { e.stopPropagation(); onSelectLGA?.(r.name); }}>
                      {r.name}
                    </button>
                  </td>
                  <td>{r.state}</td>
                  <td className="hide-mobile">
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                      background: riskColor + '20', color: riskColor, fontWeight: 600,
                    }}>
                      {r.riskLevel}
                    </span>
                  </td>
                  <td className="mono-cell hide-mobile">{r.score.toFixed(2)}</td>
                  <td>
                    <span className="mono-cell" style={{ color: '#34d399', fontWeight: 700 }}>
                      ${Math.round(r.allocated).toLocaleString()}
                    </span>
                  </td>
                  <td className="mono-cell hide-mobile">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'var(--bg-panel)', overflow: 'hidden', minWidth: 40 }}>
                        <div style={{ width: `${r.pct}%`, height: '100%', borderRadius: 999, background: 'var(--blue-light)' }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-quaternary)', minWidth: 36, textAlign: 'right' }}>
                        {r.pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {ranked.length === 0 && (
        <div className="rankings-empty">
          <p>No data available for budget optimization.
            {selectedLGAs.length > 0 ? ' Selected LGAs may lack composite score data.' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
