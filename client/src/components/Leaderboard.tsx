import type { ChangeLogEntry } from '../types';

interface Props {
  changes: ChangeLogEntry[];
  onSelectLGA?: (name: string) => void;
}

function formatDelta(delta: number) {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(3)}`;
}

export default function Leaderboard({ changes, onSelectLGA }: Props) {
  const deteriorated = [...changes]
    .filter(c => c.delta_composite > 0)
    .sort((a, b) => b.delta_composite - a.delta_composite)
    .slice(0, 10);
  const improved = [...changes]
    .filter(c => c.delta_composite < 0)
    .sort((a, b) => a.delta_composite - b.delta_composite)
    .slice(0, 10);

  const Row = ({ entry, color }: { entry: ChangeLogEntry; color: string }) => (
    <div
      className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-700 cursor-pointer text-sm"
      onClick={() => onSelectLGA?.(entry.lga_name)}
    >
      <span className="text-gray-200 truncate max-w-[120px]">{entry.lga_name}</span>
      <span className="text-gray-400 text-xs">{entry.state}</span>
      <span className={`font-mono text-xs font-bold ${color}`}>{formatDelta(entry.delta_composite)}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h4 className="text-xs font-semibold text-red-400 mb-2 uppercase tracking-wide">Most Deteriorated</h4>
        {deteriorated.length === 0 ? (
          <p className="text-gray-500 text-xs">No data</p>
        ) : (
          deteriorated.map((e, i) => <Row key={i} entry={e} color="text-red-400" />)
        )}
      </div>
      <div>
        <h4 className="text-xs font-semibold text-green-400 mb-2 uppercase tracking-wide">Most Improved</h4>
        {improved.length === 0 ? (
          <p className="text-gray-500 text-xs">No data</p>
        ) : (
          improved.map((e, i) => <Row key={i} entry={e} color="text-green-400" />)
        )}
      </div>
    </div>
  );
}
