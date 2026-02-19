import { formatDistanceToNow } from 'date-fns';
import type { AnomalyAlert } from '../types';

interface Props {
  anomalies: AnomalyAlert[];
  onSelectLGA?: (name: string) => void;
  onAcknowledge?: (id: number) => void;
  userRole?: string;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  critical: { bg: 'rgba(124,58,237,.1)', border: 'rgba(124,58,237,.25)', color: '#a78bfa', icon: '🟣' },
  high:     { bg: 'rgba(239,68,68,.08)', border: 'rgba(239,68,68,.2)', color: '#f87171', icon: '🔴' },
  medium:   { bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.2)', color: '#fbbf24', icon: '🟡' },
  low:      { bg: 'rgba(59,130,246,.08)', border: 'rgba(59,130,246,.2)', color: '#60a5fa', icon: '🔵' },
};

export default function AnomalyPanel({ anomalies, onSelectLGA, onAcknowledge }: Props) {
  const active = anomalies.filter(a => !a.acknowledged);

  if (active.length === 0) {
    return (
      <div className="rankings-empty">
        <p style={{ fontSize: 32 }}>✅</p>
        <p>No active anomalies detected</p>
        <p style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 4 }}>
          The system is monitoring for statistical outliers in poverty indicators
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {active.map(a => {
        const sev = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.medium;
        return (
          <div key={a.id} className="metric-card" style={{
            borderColor: sev.border,
            background: sev.bg,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span className="risk-pill" style={{
                    background: sev.bg,
                    border: `1px solid ${sev.border}`,
                    color: sev.color,
                    fontSize: 9,
                  }}>
                    {sev.icon} {a.severity?.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-quaternary)' }}>
                    {formatDistanceToNow(new Date(a.detected_at), { addSuffix: true })}
                  </span>
                </div>
                <button
                  style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--blue-light)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'left', padding: 0,
                  }}
                  onClick={() => onSelectLGA?.(a.lga_name)}
                >
                  {a.lga_name}
                </button>
                <span style={{ fontSize: 11, color: 'var(--text-quaternary)', marginLeft: 6 }}>({a.state})</span>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
                  {a.description}
                </p>
                {a.deviation_pct != null && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    marginTop: 6, padding: '3px 8px', borderRadius: 6,
                    background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)',
                    fontSize: 10, fontWeight: 700, color: '#fbbf24',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    Deviation: {a.deviation_pct.toFixed(1)}%
                  </div>
                )}
              </div>
              <button
                onClick={() => onAcknowledge?.(a.id)}
                className="rankings-toggle-btn"
                style={{ borderRadius: 8, padding: '6px 12px', fontSize: 11, flexShrink: 0, border: `1px solid ${sev.border}` }}
              >
                Acknowledge
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
