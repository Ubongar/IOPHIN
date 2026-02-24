/**
 * ReportBuilder — Generate PDF reports of poverty analytics
 * Supports national, state, and summary scopes.
 * Uses client-side CSV export as fallback when server PDF is unavailable.
 */

import { useState, useMemo } from 'react';
import axios from 'axios';
import type { StateAggregation } from '../types';
import { useAuthStore } from '../store';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Props {
  states: StateAggregation[];
  searchQuery?: string;
}

export default function ReportBuilder({ states, searchQuery = '' }: Props) {
  const token = useAuthStore(s => s.token);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [scope, setScope] = useState<'national' | 'state' | 'summary'>('national');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const toggleState = (s: string) =>
    setSelectedStates(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const selectAll = () => {
    const filteredStateNames = filteredStates.map(s => s.state);
    if (selectedStates.length === filteredStateNames.length) {
      setSelectedStates([]);
    } else {
      setSelectedStates(filteredStateNames);
    }
  };

  // Apply search filter to states list
  const filteredStates = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return states;
    const term = searchQuery.toLowerCase();
    return states.filter(s => s.state.toLowerCase().includes(term));
  }, [states, searchQuery]);

  const reportData = useMemo(() => {
    if (scope === 'national' || scope === 'summary') return filteredStates;
    return filteredStates.filter(s => selectedStates.includes(s.state));
  }, [scope, filteredStates, selectedStates]);

  const generateClientReport = () => {
    const headers = ['State', 'LGA Count', 'Avg Composite Score', 'Avg MPI', 'Avg Nightlight', 'High Risk Count', 'Health Facilities', 'Schools'];
    const rows = reportData.map(s => [
      s.state, s.lgaCount, s.avgCompositeScore?.toFixed(4) ?? 'N/A',
      s.avgMPI?.toFixed(4) ?? 'N/A', s.avgNightlight?.toFixed(2) ?? 'N/A',
      s.highRiskCount, s.totalHealthFacilities, s.totalSchools
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iophin_report_${scope}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  };

  const generate = async () => {
    if (scope === 'state' && selectedStates.length === 0) {
      setError('Please select at least one state');
      return;
    }

    setGenerating(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(`${API}/v1/reports/generate`,
        { scope, states: selectedStates },
        { headers: token ? { Authorization: `Bearer ${token}` } : {}, responseType: 'blob', timeout: 30000 }
      );
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `iophin_report_${scope}_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('PDF report downloaded successfully');
    } catch {
      try {
        generateClientReport();
        setSuccess('CSV report exported (PDF requires server connection)');
      } catch (csvErr: any) {
        setError(csvErr.message || 'Report generation failed');
      }
    } finally {
      setGenerating(false);
    }
  };

  const totalLGAs = reportData.reduce((s, r) => s + r.lgaCount, 0);
  const avgScore = reportData.length > 0
    ? (reportData.reduce((s, r) => s + (r.avgCompositeScore ?? 0), 0) / reportData.length)
    : 0;
  const totalHighRisk = reportData.reduce((s, r) => s + r.highRiskCount, 0);

  return (
    <div className="rankings-container">
      <div className="rankings-header">
        <div>
          <h2 className="rankings-title">Report Builder</h2>
          <p className="rankings-subtitle">
            {filteredStates.length === states.length
              ? `Generate analytical reports across ${states.length} states`
              : `${filteredStates.length} of ${states.length} states — filtered`}
          </p>
        </div>
      </div>

      <div className="report-config">
        <div className="report-section">
          <label className="report-label">Report Scope</label>
          <div className="report-scope-btns">
            {(['national', 'state', 'summary'] as const).map(s => (
              <button key={s} onClick={() => setScope(s)}
                className={'report-scope-btn' + (scope === s ? ' active' : '')}>
                {s === 'national' ? '🌍 National' : s === 'state' ? '📍 By State' : '📊 Summary'}
              </button>
            ))}
          </div>
        </div>

        {scope === 'state' && (
          <div className="report-section">
            <div className="report-label-row">
              <label className="report-label">Select States</label>
              <button onClick={selectAll} className="report-select-all">
                {selectedStates.length === filteredStates.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="report-state-grid">
              {filteredStates.map(s => (
                <button key={s.state} onClick={() => toggleState(s.state)}
                  className={'report-state-chip' + (selectedStates.includes(s.state) ? ' selected' : '')}>
                  <span className="report-state-name">{s.state}</span>
                  <span className="report-state-count">{s.lgaCount} LGAs</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="report-section">
          <label className="report-label">Report Preview</label>
          <div className="report-preview-grid">
            <div className="report-preview-card">
              <div className="report-preview-value">{reportData.length}</div>
              <div className="report-preview-label">States</div>
            </div>
            <div className="report-preview-card">
              <div className="report-preview-value">{totalLGAs}</div>
              <div className="report-preview-label">Total LGAs</div>
            </div>
            <div className="report-preview-card">
              <div className="report-preview-value">{avgScore.toFixed(3)}</div>
              <div className="report-preview-label">Avg Score</div>
            </div>
            <div className="report-preview-card">
              <div className="report-preview-value report-preview-danger">{totalHighRisk}</div>
              <div className="report-preview-label">High Risk</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="report-message report-message-error">
            <span>⚠</span> {error}
          </div>
        )}
        {success && (
          <div className="report-message report-message-success">
            <span>✓</span> {success}
          </div>
        )}

        <button onClick={generate} disabled={generating || states.length === 0}
          className="download-btn">
          {generating ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Generating...
            </>
          ) : (
            <>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Generate Report
            </>
          )}
        </button>

        {states.length === 0 && (
          <p className="report-hint">No state data available. Reports require database mode or loaded data.</p>
        )}
      </div>
    </div>
  );
}
