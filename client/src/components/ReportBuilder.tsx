/**
 * ReportBuilder — Generate PDF reports of poverty analytics
 * Supports national, state, and summary scopes.
 * Uses client-side PDF generation via jsPDF when server PDF is unavailable.
 */

import { useState, useMemo } from 'react';
import axios from 'axios';
import type { StateAggregation, HotspotsGeoJSON } from '../types';
import { useAuthStore } from '../store';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Props {
  states: StateAggregation[];
  searchQuery?: string;
  hotspotsData?: HotspotsGeoJSON | null;
}

export default function ReportBuilder({ states, searchQuery = '', hotspotsData }: Props) {
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

  // Build detailed per-state LGA data from hotspotsData
  const buildStateDetailLines = (stateName: string): string[] => {
    if (!hotspotsData) return [];
    const lgas = hotspotsData.features
      .filter(f => f.properties.State === stateName)
      .sort((a, b) => (b.properties.composite_poverty_score ?? 0) - (a.properties.composite_poverty_score ?? 0));

    return lgas.map(f => {
      const p = f.properties;
      const score = p.composite_poverty_score?.toFixed(4) ?? 'N/A';
      const mpi = p.MPI?.toFixed(4) ?? 'N/A';
      return `${p.LGA_Name} | Risk: ${p.risk_level} | Score: ${score} | MPI: ${mpi}`;
    });
  };

  const generateClientPDF = async () => {
    try {
      // Use jsPDF for client-side PDF generation
      const jsPDFModule = await import('jspdf');
      if (jsPDFModule) {
        // jsPDF v4 exports as default or named
        const JsPDF = (jsPDFModule as any).default || (jsPDFModule as any).jsPDF;
        const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const now = new Date().toLocaleString();
        let y = 20;
        const pageH = 280;
        const margin = 15;
        const lineH = 6;

        const addLine = (text: string, size = 10, bold = false, color: [number, number, number] = [51, 51, 51]) => {
          if (y > pageH) { doc.addPage(); y = 20; }
          doc.setFontSize(size);
          doc.setFont('helvetica', bold ? 'bold' : 'normal');
          doc.setTextColor(...color);
          doc.text(text, margin, y);
          y += lineH;
        };

        const addSeparator = () => {
          if (y > pageH) { doc.addPage(); y = 20; }
          doc.setDrawColor(200, 200, 200);
          doc.line(margin, y, 195, y);
          y += 4;
        };

        // Header
        addLine('IOPHIN — Poverty Hotspot Intelligence Report', 16, true, [30, 58, 95]);
        addLine(`Generated: ${now}`, 9, false, [120, 120, 120]);
        addLine(`Scope: ${scope.charAt(0).toUpperCase() + scope.slice(1)}`, 9, false, [120, 120, 120]);
        y += 4;
        addSeparator();

        if (scope === 'national' || scope === 'summary') {
          addLine('NATIONAL SUMMARY', 13, true, [30, 58, 95]);
          y += 2;
          const totalLGAs = reportData.reduce((s, r) => s + r.lgaCount, 0);
          const avgScore = reportData.length > 0
            ? (reportData.reduce((s, r) => s + (r.avgCompositeScore ?? 0), 0) / reportData.length).toFixed(4)
            : '0';
          const totalHighRisk = reportData.reduce((s, r) => s + r.highRiskCount, 0);
          addLine(`Total States: ${reportData.length}`, 10);
          addLine(`Total LGAs: ${totalLGAs}`, 10);
          addLine(`Average Composite Score: ${avgScore}`, 10);
          addLine(`High/Critical Risk LGAs: ${totalHighRisk}`, 10);
          y += 4;
          addSeparator();

          // State summary table
          addLine('STATE BREAKDOWN', 12, true, [30, 58, 95]);
          y += 2;
          reportData.forEach(s => {
            if (y > pageH - 20) { doc.addPage(); y = 20; }
            addLine(`${s.state}`, 10, true, [30, 58, 95]);
            addLine(`  LGAs: ${s.lgaCount} | Avg Score: ${s.avgCompositeScore?.toFixed(4) ?? 'N/A'} | Avg MPI: ${s.avgMPI?.toFixed(4) ?? 'N/A'} | High Risk: ${s.highRiskCount}`, 9);
            y += 1;
          });
        }

        if (scope === 'state' && selectedStates.length > 0) {
          addLine('STATE-LEVEL DETAIL REPORT', 13, true, [30, 58, 95]);
          y += 2;

          selectedStates.forEach(stateName => {
            if (y > pageH - 30) { doc.addPage(); y = 20; }
            const stateData = states.find(s => s.state === stateName);
            addLine(stateName.toUpperCase(), 12, true, [30, 58, 95]);
            if (stateData) {
              addLine(`LGAs: ${stateData.lgaCount} | Avg Score: ${stateData.avgCompositeScore?.toFixed(4) ?? 'N/A'} | Avg MPI: ${stateData.avgMPI?.toFixed(4) ?? 'N/A'}`, 9);
              addLine(`High Risk Count: ${stateData.highRiskCount} | Health Facilities: ${stateData.totalHealthFacilities} | Schools: ${stateData.totalSchools}`, 9);
            }
            y += 2;

            // LGA details
            const lgaLines = buildStateDetailLines(stateName);
            if (lgaLines.length > 0) {
              addLine('LGA Rankings (by composite score):', 9, true, [80, 80, 80]);
              lgaLines.forEach((line, idx) => {
                if (y > pageH - 10) { doc.addPage(); y = 20; }
                addLine(`  ${idx + 1}. ${line}`, 8, false, [80, 80, 80]);
              });
            } else {
              addLine('  (No LGA detail data available)', 8, false, [150, 150, 150]);
            }
            y += 4;
            addSeparator();
          });
        }

        // Footer
        if (y > pageH - 15) { doc.addPage(); y = 20; }
        y = pageH + 5;
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('IOPHIN — Integrated Operational Poverty Hotspot Intelligence Network', margin, y);

        doc.save(`iophin_report_${scope}_${Date.now()}.pdf`);
        return true;
      }
    } catch (e) {
      console.warn('jsPDF not available, falling back to CSV', e);
    }

    // CSV fallback
    const headers = ['State', 'LGA Count', 'Avg Composite Score', 'Avg MPI', 'Avg Nightlight', 'High Risk Count', 'Health Facilities', 'Schools'];
    const rows = reportData.map(s => [
      s.state, s.lgaCount, s.avgCompositeScore?.toFixed(4) ?? 'N/A',
      s.avgMPI?.toFixed(4) ?? 'N/A', s.avgNightlight?.toFixed(2) ?? 'N/A',
      s.highRiskCount, s.totalHealthFacilities, s.totalSchools
    ]);

    // For state scope, add LGA detail rows
    const allRows: (string | number)[][] = [headers, ...rows];
    if (scope === 'state' && selectedStates.length > 0) {
      allRows.push([]);
      allRows.push(['--- LGA DETAILS ---']);
      selectedStates.forEach(stateName => {
        allRows.push([`State: ${stateName}`]);
        const lgaLines = buildStateDetailLines(stateName);
        lgaLines.forEach(line => allRows.push([line]));
      });
    }

    const csv = allRows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iophin_report_${scope}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return false; // indicates CSV was used
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
      // Try server PDF first
      const response = await axios.post(`${API}/v1/reports/generate`,
        { scope, states: selectedStates },
        { headers: token ? { Authorization: `Bearer ${token}` } : {}, responseType: 'blob', timeout: 30000 }
      );

      // Check if response is actually a PDF (not an error JSON)
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/pdf')) {
        const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `iophin_report_${scope}_${Date.now()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setSuccess('PDF report downloaded successfully');
      } else {
        // Server returned non-PDF (likely error), use client-side generation
        throw new Error('Server returned non-PDF response');
      }
    } catch {
      try {
        const usedPDF = await generateClientPDF();
        setSuccess(usedPDF
          ? 'PDF report generated and downloaded'
          : 'CSV report exported (install jsPDF for PDF output)');
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

  // Count LGAs in selected states from hotspotsData
  const selectedLGACount = useMemo(() => {
    if (scope !== 'state' || !hotspotsData) return 0;
    return hotspotsData.features.filter(f => selectedStates.includes(f.properties.State)).length;
  }, [scope, selectedStates, hotspotsData]);

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
              <label className="report-label">
                Select States
                {selectedStates.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--blue-light)', fontWeight: 400 }}>
                    {selectedStates.length} selected · {selectedLGACount} LGAs
                  </span>
                )}
              </label>
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
            {selectedStates.length > 0 && hotspotsData && (
              <div style={{
                marginTop: 8, padding: '8px 12px',
                background: 'var(--bg-panel)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--text-tertiary)',
              }}>
                <span style={{ color: 'var(--blue-light)', fontWeight: 600 }}>✓ LGA detail data available</span>
                {' '}— Report will include per-LGA rankings for each selected state
              </div>
            )}
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
