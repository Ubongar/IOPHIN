import React, { useState } from 'react';
import type { Intervention } from '../types';

interface Props {
  interventions: Intervention[];
  userRole?: string;
  onAdd?: (data: Partial<Intervention>) => void;
  onSelectLGA?: (name: string) => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'rgba(16,185,129,.12)', text: '#34d399', label: 'Active' },
  completed: { bg: 'rgba(59,130,246,.12)', text: '#60a5fa', label: 'Completed' },
  planned: { bg: 'rgba(245,158,11,.12)', text: '#fbbf24', label: 'Planned' },
};

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

  const totalBudget = filtered.reduce((s, i) => s + (i.budget_usd || 0), 0);
  const totalBeneficiaries = filtered.reduce((s, i) => s + (i.beneficiaries || 0), 0);

  return (
    <div className="rankings-container">
      <div className="rankings-header">
        <div>
          <h2 className="rankings-title">Intervention Tracker</h2>
          <p className="rankings-subtitle">
            {filtered.length === interventions.length
              ? `${interventions.length} programs tracked`
              : `${filtered.length} of ${interventions.length} programs — filtered`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="filter-select" aria-label="Filter interventions by status"
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="planned">Planned</option>
            <option value="completed">Completed</option>
          </select>
          {(userRole === 'admin' || userRole === 'government' || userRole === 'ngo' || !userRole) && (
            <button onClick={() => setShowForm(!showForm)}
              className="download-btn" style={{ width: 'auto', padding: '8px 16px', fontSize: 12 }}>
              + Add Program
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="metric-card">
          <span className="metric-label">Programs</span>
          <span className="metric-value">{filtered.length}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Total Budget</span>
          <span className="metric-value" style={{ fontSize: 18 }}>${totalBudget > 0 ? totalBudget.toLocaleString() : '—'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Beneficiaries</span>
          <span className="metric-value" style={{ fontSize: 18 }}>{totalBeneficiaries > 0 ? totalBeneficiaries.toLocaleString() : '—'}</span>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="intervention-form">
          {['program_name', 'organization', 'lga_name', 'state', 'intervention_type', 'budget_usd', 'beneficiaries'].map(f => (
            <div key={f} className="intervention-form-field">
              <label className="report-label">{f.replace(/_/g, ' ')}</label>
              <input className="intervention-input"
                value={(form as any)[f]} onChange={e => setForm(prev => ({ ...prev, [f]: e.target.value }))}
                required={['program_name', 'lga_name'].includes(f)}
                placeholder={f.replace(/_/g, ' ')} />
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={() => setShowForm(false)}
              className="rankings-toggle-btn" style={{ borderRadius: 8 }}>Cancel</button>
            <button type="submit"
              className="download-btn" style={{ width: 'auto', padding: '8px 20px', fontSize: 12 }}>Save</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="rankings-table-wrap">
        <table className="rankings-table">
          <thead>
            <tr>
              <th>Program</th>
              <th>Organization</th>
              <th>LGA</th>
              <th>State</th>
              <th>Status</th>
              <th className="hide-mobile">Budget (USD)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id} className="rankings-row">
                <td className="lga-cell">{i.program_name}</td>
                <td>{i.organization}</td>
                <td>
                  <button style={{ color: 'var(--blue-light)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                    onClick={() => onSelectLGA?.(i.lga_name)}>
                    {i.lga_name}
                  </button>
                </td>
                <td>{i.state}</td>
                <td>
                  <span className="risk-pill" style={{
                    background: STATUS_STYLES[i.status]?.bg || 'var(--bg-panel)',
                    color: STATUS_STYLES[i.status]?.text || 'var(--text-tertiary)'
                  }}>
                    {STATUS_STYLES[i.status]?.label || i.status}
                  </span>
                </td>
                <td className="mono-cell hide-mobile">{i.budget_usd ? `$${i.budget_usd.toLocaleString()}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="rankings-empty">
          <p>No interventions found.</p>
        </div>
      )}
    </div>
  );
}
