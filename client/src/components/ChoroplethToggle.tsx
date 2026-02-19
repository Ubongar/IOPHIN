import type { ChoroplethMode } from '../types';

const MODES: { id: ChoroplethMode; label: string }[] = [
  { id: 'composite', label: 'Composite' },
  { id: 'mpi', label: 'MPI' },
  { id: 'nightlight', label: 'Nightlight' },
  { id: 'conflict', label: 'Conflict' },
  { id: 'rainfall', label: 'Rainfall' },
  { id: 'ndvi', label: 'NDVI' },
];

interface Props {
  mode: ChoroplethMode;
  onChange: (mode: ChoroplethMode) => void;
}

export default function ChoroplethToggle({ mode, onChange }: Props) {
  return (
    <div className="flex gap-1 flex-wrap">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`px-3 py-1 rounded text-xs font-medium transition-all ${
            mode === m.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
