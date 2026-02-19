import { useState, useRef, useEffect } from 'react';
import { addMonths } from 'date-fns';

interface Props {
  min: number; // Unix timestamp ms
  max: number; // Unix timestamp ms
  value: number; // Unix timestamp ms
  onChange: (value: number) => void;
}

function formatMonthYear(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function TimeSlider({ min, max, value, onChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playing) {
      timer.current = setInterval(() => {
        const next = addMonths(new Date(value), 1).getTime();
        if (next > max) { setPlaying(false); onChange(max); }
        else onChange(next);
      }, 600);
    } else if (timer.current) clearInterval(timer.current);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, max, value, onChange]);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 rounded-lg border border-gray-700">
      <button
        onClick={() => setPlaying(!playing)}
        className="w-7 h-7 flex items-center justify-center rounded bg-blue-600 hover:bg-blue-500 text-white text-xs"
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-blue-500"
      step={30 * 24 * 60 * 60 * 1000}
      />
      <span className="text-xs text-gray-400 w-20 text-right">{formatMonthYear(value)}</span>
    </div>
  );
}
