import { useState } from 'react';
import type { Intervention } from '../types';

interface Props {
  interventions: Intervention[];
  userRole?: string;
  onAdd?: (data: Partial<Intervention>) => void;
  onSelectLGA?: (name: string) => void;
}

export default function InterventionTracker({ interventions, userRole, onAdd, onSelectLGA }: Props) {
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ program_name: '', organization: '', lga_name: '', state: '', intervention_type: '', status: 'active', budget_usd: '', beneficiaries: '' });

  const filtered = statusFilter ? interventions.filter(i => i.status === statusFilter) : interventions;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd?.({ ...form, status: form.status as 'active' | 'completed' | 'planned', budget_usd: form.budget_usd ? parseFloat(form.budget_usd) : undefined, beneficiaries: form.beneficiaries ? parseInt(form.beneficiaries) : undefined });
    setShowForm(false);
    setForm({ program_name: '', organization: '', lga_name: '', state: '', intervention_type: '', status: 'active', budget_usd: '', beneficiaries: '' });
  };

  const STATUS_COLORS: Record<string, string> = { active: 'text-green-400', completed: 'text-blue-400', planned: 'text-amber-400' };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-100">Intervention Tracker</h2>
        <div className="flex gap-2">
          <select className="text-xs bg-gray-700 text-gray-200 rounded px-2 py-1 border border-gray-600"
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="planned">Planned</option>
            <option value="completed">Completed</option>
          </select>
          {(userRole === 'admin' || userRole === 'government' || userRole === 'ngo') && (
            <button onClick={() => setShowForm(!showForm)}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded">
              + Add
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-800 rounded p-4 mb-4 grid grid-cols-2 gap-3 text-sm">
          {['program_name', 'organization', 'lga_name', 'state', 'intervention_type', 'budget_usd', 'beneficiaries'].map(f => (
            <div key={f}>
              <label className="text-xs text-gray-400 capitalize">{f.replace(/_/g, ' ')}</label>
              <input className="w-full bg-gray-700 text-gray-200 rounded px-2 py-1 mt-0.5 text-xs border border-gray-600"
                value={(form as any)[f]} onChange={e => setForm(prev => ({ ...prev, [f]: e.target.value }))}
                required={['program_name', 'lga_name'].includes(f)} />
            </div>
          ))}
          <div className="col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="text-xs px-3 py-1 rounded bg-gray-700 text-gray-300">Cancel</button>
            <button type="submit" className="text-xs px-3 py-1 rounded bg-blue-600 text-white">Save</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300">
          <thead className="text-gray-400 border-b border-gray-700">
            <tr>
              <th className="text-left py-2 pr-3">Program</th>
              <th className="text-left py-2 pr-3">Organization</th>
              <th className="text-left py-2 pr-3">LGA</th>
              <th className="text-left py-2 pr-3">State</th>
              <th className="text-center py-2 pr-3">Status</th>
              <th className="text-right py-2">Budget (USD)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id} className="border-b border-gray-800 hover:bg-gray-700">
                <td className="py-2 pr-3 font-medium">{i.program_name}</td>
                <td className="py-2 pr-3">{i.organization}</td>
                <td className="py-2 pr-3">
                  <button className="text-blue-400 hover:underline" onClick={() => onSelectLGA?.(i.lga_name)}>{i.lga_name}</button>
                </td>
                <td className="py-2 pr-3">{i.state}</td>
                <td className={`py-2 pr-3 text-center font-semibold ${STATUS_COLORS[i.status] || ''}`}>{i.status}</td>
                <td className="py-2 text-right">{i.budget_usd ? `$${i.budget_usd.toLocaleString()}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-gray-500 py-6 text-sm">No interventions found.</p>}
      </div>
    </div>
  );
}
