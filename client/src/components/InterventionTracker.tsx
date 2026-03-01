import React, { useState, useMemo } from 'react';
import type { Intervention, HotspotsGeoJSON } from '../types';

interface Props {
  interventions: Intervention[];
  userRole?: string;
  onAdd?: (data: Partial<Intervention>) => Promise<{ success: boolean; error?: string }>;
  onSelectLGA?: (name: string) => void;
  searchQuery?: string;
  stateFilter?: string;
  hotspotsData?: HotspotsGeoJSON | null;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'rgba(16,185,129,.12)', text: '#34d399', label: 'Active' },
  completed: { bg: 'rgba(59,130,246,.12)', text: '#60a5fa', label: 'Completed' },
  planned: { bg: 'rgba(245,158,11,.12)', text: '#fbbf24', label: 'Planned' },
};

const INTERVENTION_TYPES = [
  'Cash Transfer', 'Food Aid', 'Education Support', 'Healthcare', 'Agricultural Support',
  'Skills Training', 'Infrastructure', 'Water & Sanitation', 'Microfinance', 'Other'
];

export default function InterventionTracker({ interventions, userRole, onAdd, onSelectLGA, searchQuery = '', stateFilter = '', hotspotsData }: Props) {
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ program_name: '', organization: '', lga_name: '', state: '', intervention_type: '', status: 'active', budget_usd: '', beneficiaries: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  /* Build LGA→State lookup and sorted lists from hotspotsData */
  const { lgaToState, lgaList, stateList } = useMemo(() => {
    const map = new Map<string, string>();
    if (hotspotsData?.features) {
      hotspotsData.features.forEach(f => {
        const lga = f.properties.LGA_Name;
        const st = f.properties.State;
        if (lga && st) map.set(lga, st);
      });
    }
    const lgaList = [...map.keys()].sort();
    const stateList = [...new Set(map.values())].sort();
    return { lgaToState: map, lgaList, stateList };
  }, [hotspotsData]);

  const filtered = useMemo(() => {
    let list = [...interventions];
    
    // Apply search filter
    if (searchQuery.length >= 2) {
      const term = searchQuery.toLowerCase();
      list = list.filter(i =>
        i.program_name.toLowerCase().includes(term) ||
        i.lga_name.toLowerCase().includes(term) ||
        i.state.toLowerCase().includes(term) ||
        (i.organization && i.organization.toLowerCase().includes(term))
      );
    }
    
    // Apply state filter
    if (stateFilter) {
      list = list.filter(i => i.state === stateFilter);
    }
    
    // Apply status filter
    if (statusFilter) {
      list = list.filter(i => i.status === statusFilter);
    }
    
    return list;
  }, [interventions, searchQuery, stateFilter, statusFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSaving(true);
    const result = await onAdd?.({ ...form, status: form.status as 'active' | 'completed' | 'planned', budget_usd: form.budget_usd ? parseFloat(form.budget_usd) : undefined, beneficiaries: form.beneficiaries ? parseInt(form.beneficiaries) : undefined });
    setSaving(false);
    if (result?.success) {
      setFormSuccess('Intervention saved successfully!');
      setForm({ program_name: '', organization: '', lga_name: '', state: '', intervention_type: '', status: 'active', budget_usd: '', beneficiaries: '' });
      setTimeout(() => { setShowForm(false); setFormSuccess(''); }, 1500);
    } else {
      setFormError(result?.error || 'Failed to save intervention.');
    }
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
          {/* Error / Success Messages */}
          {formError && (
            <div style={{ gridColumn: '1 / -1', padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.12)', color: '#f87171', fontSize: 13, fontWeight: 500 }}>
              {formError}
            </div>
          )}
          {formSuccess && (
            <div style={{ gridColumn: '1 / -1', padding: '10px 14px', borderRadius: 8, background: 'rgba(16,185,129,.12)', color: '#34d399', fontSize: 13, fontWeight: 500 }}>
              {formSuccess}
            </div>
          )}

          {/* Program Name */}
          <div className="intervention-form-field">
            <label className="report-label">Program Name</label>
            <input className="intervention-input" value={form.program_name} required
              onChange={e => setForm(p => ({ ...p, program_name: e.target.value }))} placeholder="Program name" />
          </div>

          {/* Organization */}
          <div className="intervention-form-field">
            <label className="report-label">Organization</label>
            <input className="intervention-input" value={form.organization}
              onChange={e => setForm(p => ({ ...p, organization: e.target.value }))} placeholder="Organization" />
          </div>

          {/* LGA Dropdown */}
          <div className="intervention-form-field">
            <label className="report-label">LGA</label>
            <select className="intervention-input" value={form.lga_name} required aria-label="Select LGA"
              onChange={e => {
                const lga = e.target.value;
                const autoState = lgaToState.get(lga) || '';
                setForm(p => ({ ...p, lga_name: lga, state: autoState }));
              }}>
              <option value="">Select LGA</option>
              {lgaList.map(lga => <option key={lga} value={lga}>{lga}</option>)}
            </select>
          </div>

          {/* State (auto-populated, also a dropdown for override) */}
          <div className="intervention-form-field">
            <label className="report-label">State {form.state && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>(auto-filled)</span>}</label>
            <select className="intervention-input" value={form.state} required aria-label="Select State"
              onChange={e => setForm(p => ({ ...p, state: e.target.value }))}>
              <option value="">Select State</option>
              {stateList.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>

          {/* Intervention Type Dropdown */}
          <div className="intervention-form-field">
            <label className="report-label">Intervention Type</label>
            <select className="intervention-input" value={form.intervention_type} required aria-label="Select intervention type"
              onChange={e => setForm(p => ({ ...p, intervention_type: e.target.value }))}>
              <option value="">Select Type</option>
              {INTERVENTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="intervention-form-field">
            <label className="report-label">Status</label>
            <select className="intervention-input" value={form.status} aria-label="Select status"
              onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Budget */}
          <div className="intervention-form-field">
            <label className="report-label">Budget (USD)</label>
            <input className="intervention-input" type="number" min="0" value={form.budget_usd}
              onChange={e => setForm(p => ({ ...p, budget_usd: e.target.value }))} placeholder="Budget in USD" />
          </div>

          {/* Beneficiaries */}
          <div className="intervention-form-field">
            <label className="report-label">Beneficiaries</label>
            <input className="intervention-input" type="number" min="0" value={form.beneficiaries}
              onChange={e => setForm(p => ({ ...p, beneficiaries: e.target.value }))} placeholder="Number of beneficiaries" />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={() => { setShowForm(false); setFormError(''); setFormSuccess(''); }}
              className="rankings-toggle-btn" style={{ borderRadius: 8 }}>Cancel</button>
            <button type="submit" disabled={saving}
              className="download-btn" style={{ width: 'auto', padding: '8px 20px', fontSize: 12, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
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
