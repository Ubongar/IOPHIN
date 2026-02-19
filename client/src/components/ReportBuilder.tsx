import { useState } from 'react';
import axios from 'axios';
import type { StateAggregation } from '../types';
import { useAuthStore } from '../store';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Props {
  states: StateAggregation[];
}

export default function ReportBuilder({ states }: Props) {
  const token = useAuthStore(s => s.token);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [scope, setScope] = useState<'national' | 'state' | 'summary'>('national');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const toggleState = (s: string) =>
    setSelectedStates(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      const response = await axios.post(`${API}/v1/reports/generate`,
        { scope, states: selectedStates },
        { headers: token ? { Authorization: `Bearer ${token}` } : {}, responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `iophin_report_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Report generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-gray-100 mb-4">Report Builder</h2>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Scope</label>
          <div className="flex gap-2">
            {(['national', 'state', 'summary'] as const).map(s => (
              <button key={s} onClick={() => setScope(s)}
                className={`text-xs px-3 py-1 rounded ${scope === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {scope === 'state' && (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Select States</label>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
              {states.map(s => (
                <button key={s.state} onClick={() => toggleState(s.state)}
                  className={`text-xs px-2 py-0.5 rounded ${selectedStates.includes(s.state) ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {s.state}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button onClick={generate} disabled={generating}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded">
          {generating ? 'Generating...' : '⬇ Generate PDF Report'}
        </button>
      </div>
    </div>
  );
}
