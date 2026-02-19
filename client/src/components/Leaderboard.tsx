import type { ChangeLogEntry } from '../types';

interface Props {
  changes: ChangeLogEntry[];
  onSelectLGA?: (name: string) => void;
}

function formatDelta(delta: number) {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(3)}`;
}

const COL_STYLES = {
  deteriorated: { accent: '#f87171', bg: 'rgba(239,68,68,.08)', border: 'rgba(239,68,68,.18)' },
  improved:     { accent: '#4ade80', bg: 'rgba(74,222,128,.08)', border: 'rgba(74,222,128,.18)' },
};

export default function Leaderboard({ changes, onSelectLGA }: Props) {
  const deteriorated = [...changes]
    .filter(c => c.delta_composite > 0)
    .sort((a, b) => b.delta_composite - a.delta_composite)
    .slice(0, 10);
  const improved = [...changes]
    .filter(c => c.delta_composite < 0)
    .sort((a, b) => a.delta_composite - b.delta_composite)
    .slice(0, 10);

  const Column = ({ title, entries, style }: {
    title: string; entries: ChangeLogEntry[];
    style: typeof COL_STYLES.deteriorated;
  }) => (
    <div style={{ background: style.bg, border: `1px solid ${style.border}`,
      borderRadius: 'var(--radius-md)', padding: 16 }}>
      <h4 style={{ fontSize: 11, fontWeight: 700, color: style.accent,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
        {title}
      </h4>
      {entries.length === 0 ? (
        <p style={{ color: 'var(--text-quaternary)', fontSize: 12 }}>No data</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {entries.map((e, i) => (
            <div key={i} onClick={() => onSelectLGA?.(e.lga_name)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                transition: 'background .15s' }}
              onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg-panel)')}
              onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
              <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                {e.lga_name}
              </span>
              <span style={{ color: 'var(--text-quaternary)', fontSize: 11, marginLeft: 8 }}>{e.state}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: style.accent, marginLeft: 'auto', paddingLeft: 8 }}>
                {formatDelta(e.delta_composite)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Column title="Most Deteriorated" entries={deteriorated} style={COL_STYLES.deteriorated} />
      <Column title="Most Improved" entries={improved} style={COL_STYLES.improved} />
    </div>
  );
}
