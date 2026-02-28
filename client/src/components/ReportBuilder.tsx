/**
 * ReportBuilder — Generate PDF reports of poverty analytics
 * Supports national, state, and summary scopes.
 * Uses client-side PDF generation via jsPDF with rich charts, tables, and visuals.
 */

import { useState, useMemo, type ReactElement } from 'react';
import axios from 'axios';
import type { StateAggregation, HotspotsGeoJSON } from '../types';
import { useAuthStore } from '../store';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Props {
  states: StateAggregation[];
  searchQuery?: string;
  hotspotsData?: HotspotsGeoJSON | null;
}

// Risk level colors (RGB)
const RISK_RGB: Record<string, [number, number, number]> = {
  Critical: [124, 58, 237],
  High: [239, 68, 68],
  Medium: [245, 158, 11],
  Low: [16, 185, 129],
  Minimal: [59, 130, 246],
};

export default function ReportBuilder({ states, searchQuery = '', hotspotsData }: Props): ReactElement {
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

  const filteredStates = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return states;
    const term = searchQuery.toLowerCase();
    return states.filter(s => s.state.toLowerCase().includes(term));
  }, [states, searchQuery]);

  const reportData = useMemo(() => {
    if (scope === 'national' || scope === 'summary') return filteredStates;
    return filteredStates.filter(s => selectedStates.includes(s.state));
  }, [scope, filteredStates, selectedStates]);

  const buildStateDetailLines = (stateName: string) => {
    if (!hotspotsData) return [];
    return hotspotsData.features
      .filter(f => f.properties.State === stateName)
      .sort((a, b) => (b.properties.composite_poverty_score ?? 0) - (a.properties.composite_poverty_score ?? 0));
  };

  // ─── Draw a horizontal bar chart in jsPDF ────────────────────────────────
  const drawBarChart = (
    doc: any,
    x: number,
    y: number,
    width: number,
    barHeight: number,
    items: { label: string; value: number; color: [number, number, number] }[],
    maxValue: number,
    title: string
  ): number => {
    const labelWidth = 55;
    const barAreaWidth = width - labelWidth - 30;
    const gap = 4;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text(title, x, y);
    y += 6;

    items.forEach(item => {
      if (y > 270) { doc.addPage(); y = 20; }
      const barW = maxValue > 0 ? (item.value / maxValue) * barAreaWidth : 0;

      // Label
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const truncLabel = item.label.length > 14 ? item.label.slice(0, 13) + '…' : item.label;
      doc.text(truncLabel, x, y + barHeight - 1);

      // Bar background
      doc.setFillColor(230, 230, 230);
      doc.roundedRect(x + labelWidth, y - barHeight + 2, barAreaWidth, barHeight - 1, 1, 1, 'F');

      // Bar fill
      if (barW > 0) {
        doc.setFillColor(...item.color);
        doc.roundedRect(x + labelWidth, y - barHeight + 2, barW, barHeight - 1, 1, 1, 'F');
      }

      // Value label
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      doc.text(item.value.toFixed(3), x + labelWidth + barAreaWidth + 2, y + barHeight - 2);

      y += barHeight + gap;
    });
    return y + 4;
  };

  // ─── Draw a mini horizontal stacked bar (risk distribution) ──────────────
  const drawRiskBar = (
    doc: any,
    x: number,
    y: number,
    width: number,
    height: number,
    counts: { critical: number; high: number; medium: number; low: number; minimal?: number },
    total: number
  ): number => {
    const segments = [
      { key: 'critical', label: 'Critical', color: RISK_RGB.Critical, count: counts.critical },
      { key: 'high', label: 'High', color: RISK_RGB.High, count: counts.high },
      { key: 'medium', label: 'Medium', color: RISK_RGB.Medium, count: counts.medium },
      { key: 'low', label: 'Low', color: RISK_RGB.Low, count: counts.low },
      { key: 'minimal', label: 'Minimal', color: RISK_RGB.Minimal, count: counts.minimal ?? 0 },
    ];

    let cx = x;
    segments.forEach(seg => {
      if (seg.count <= 0 || total <= 0) return;
      const segW = (seg.count / total) * width;
      doc.setFillColor(...seg.color);
      doc.rect(cx, y, segW, height, 'F');
      cx += segW;
    });

    // Legend below
    let lx = x;
    const ly = y + height + 4;
    doc.setFontSize(6.5);
    segments.forEach(seg => {
      if (seg.count <= 0) return;
      doc.setFillColor(...seg.color);
      doc.rect(lx, ly, 5, 3.5, 'F');
      doc.setTextColor(60, 60, 60);
      doc.text(`${seg.label}: ${seg.count}`, lx + 6.5, ly + 3);
      lx += 32;
    });

    return ly + 8;
  };

  // ─── Draw a simple table ──────────────────────────────────────────────────
  const drawTable = (
    doc: any,
    x: number,
    y: number,
    headers: string[],
    rows: string[][],
    colWidths: number[],
    rowHeight = 6
  ): number => {
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);

    // Header row
    doc.setFillColor(30, 58, 95);
    doc.rect(x, y, tableWidth, rowHeight + 1, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    let cx = x + 2;
    headers.forEach((h, i) => {
      doc.text(h, cx, y + rowHeight - 0.5);
      cx += colWidths[i];
    });
    y += rowHeight + 1;

    // Data rows
    rows.forEach((row, ri) => {
      if (y > 272) { doc.addPage(); y = 20; }
      doc.setFillColor(ri % 2 === 0 ? 248 : 240, ri % 2 === 0 ? 249 : 242, ri % 2 === 0 ? 252 : 248);
      doc.rect(x, y, tableWidth, rowHeight, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(40, 40, 40);
      let cx2 = x + 2;
      row.forEach((cell, i) => {
        const maxChars = Math.floor(colWidths[i] / 2.2);
        const truncated = cell.length > maxChars ? cell.slice(0, maxChars - 1) + '…' : cell;
        doc.text(truncated, cx2, y + rowHeight - 1);
        cx2 += colWidths[i];
      });
      y += rowHeight;
    });

    // Bottom border
    doc.setDrawColor(200, 200, 200);
    doc.line(x, y, x + tableWidth, y);
    return y + 4;
  };

  // ─── Draw section header ──────────────────────────────────────────────────
  const drawSectionHeader = (doc: any, text: string, y: number, pageW = 195): number => {
    doc.setFillColor(30, 58, 95);
    doc.rect(15, y, pageW, 8, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(text, 18, y + 5.5);
    return y + 12;
  };

  // ─── Draw a stat card row ─────────────────────────────────────────────────
  const drawStatCards = (
    doc: any,
    x: number,
    y: number,
    cards: { label: string; value: string; color?: [number, number, number] }[]
  ): number => {
    const cardW = 42;
    const cardH = 16;
    const gap = 4;
    cards.forEach((card, i) => {
      const cx = x + i * (cardW + gap);
      doc.setFillColor(240, 244, 252);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'F');
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(card.color ?? [30, 58, 95]));
      doc.text(card.value, cx + cardW / 2, y + 9, { align: 'center' });
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(card.label, cx + cardW / 2, y + 14, { align: 'center' });
    });
    return y + cardH + 6;
  };

  const generateClientPDF = async () => {
    try {
      const jsPDFModule = await import('jspdf');
      const JsPDF = (jsPDFModule as any).default || (jsPDFModule as any).jsPDF;
      const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const now = new Date().toLocaleString();
      const margin = 15;
      const pageW = 210 - margin * 2;
      let y = 15;

      const newPage = () => { doc.addPage(); y = 15; };
      const checkPage = (needed = 20) => { if (y > 280 - needed) newPage(); };

      // ── Cover / Header ──────────────────────────────────────────────────
      doc.setFillColor(30, 58, 95);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('IOPHIN', margin, 16);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Integrated Operational Poverty Hotspot Intelligence Network', margin, 23);
      doc.setFontSize(9);
      doc.setTextColor(180, 200, 230);
      doc.text('Poverty Hotspot Intelligence Report', margin, 30);
      doc.text(`Generated: ${now}  |  Scope: ${scope.charAt(0).toUpperCase() + scope.slice(1)}`, margin, 36);
      y = 48;

      // ── Compute aggregates ──────────────────────────────────────────────
      const totalLGAs = reportData.reduce((s, r) => s + r.lgaCount, 0);
      const avgScore = reportData.length > 0
        ? reportData.reduce((s, r) => s + (r.avgCompositeScore ?? 0), 0) / reportData.length
        : 0;
      const avgMPI = reportData.length > 0
        ? reportData.reduce((s, r) => s + (r.avgMPI ?? 0), 0) / reportData.length
        : 0;
      const totalHighRisk = reportData.reduce((s, r) => s + r.highRiskCount, 0);
      const totalHealth = reportData.reduce((s, r) => s + (r.totalHealthFacilities ?? 0), 0);
      const totalSchools = reportData.reduce((s, r) => s + (r.totalSchools ?? 0), 0);

      // ── Risk distribution from hotspotsData ────────────────────────────
      let riskCounts = { critical: 0, high: 0, medium: 0, low: 0, minimal: 0 };
      if (hotspotsData) {
        const features = scope === 'state' && selectedStates.length > 0
          ? hotspotsData.features.filter(f => selectedStates.includes(f.properties.State))
          : hotspotsData.features;
        features.forEach(f => {
          const rl = (f.properties.risk_level ?? '').toLowerCase();
          if (rl === 'critical') riskCounts.critical++;
          else if (rl === 'high') riskCounts.high++;
          else if (rl === 'medium') riskCounts.medium++;
          else if (rl === 'low') riskCounts.low++;
          else riskCounts.minimal++;
        });
      } else {
        riskCounts.high = totalHighRisk;
      }
      const totalRisk = Object.values(riskCounts).reduce((a, b) => a + b, 0);

      // ── NATIONAL / SUMMARY SCOPE ────────────────────────────────────────
      if (scope === 'national' || scope === 'summary') {
        y = drawSectionHeader(doc, '1. NATIONAL OVERVIEW', y);

        // Stat cards
        y = drawStatCards(doc, margin, y, [
          { label: 'States', value: String(reportData.length) },
          { label: 'Total LGAs', value: String(totalLGAs) },
          { label: 'Avg MPI', value: avgMPI.toFixed(3) },
          { label: 'Avg Score', value: avgScore.toFixed(3) },
        ]);
        y = drawStatCards(doc, margin, y, [
          { label: 'High/Critical LGAs', value: String(totalHighRisk), color: [239, 68, 68] },
          { label: 'Health Facilities', value: String(totalHealth), color: [16, 185, 129] },
          { label: 'Schools', value: String(totalSchools), color: [59, 130, 246] },
          { label: 'Data States', value: String(reportData.length) },
        ]);

        // Risk distribution bar
        checkPage(30);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 95);
        doc.text('Risk Level Distribution Across All LGAs', margin, y);
        y += 5;
        y = drawRiskBar(doc, margin, y, pageW, 8, riskCounts, totalRisk);
        y += 4;

        // Top 10 most deprived states bar chart
        checkPage(80);
        const sortedByScore = [...reportData].sort((a, b) => (b.avgCompositeScore ?? 0) - (a.avgCompositeScore ?? 0)).slice(0, 10);
        const maxScore = sortedByScore[0]?.avgCompositeScore ?? 1;
        y = drawSectionHeader(doc, '2. TOP 10 MOST DEPRIVED STATES (by Avg Composite Score)', y);
        y = drawBarChart(doc, margin, y, pageW, 7, sortedByScore.map(s => ({
          label: s.state,
          value: s.avgCompositeScore ?? 0,
          color: RISK_RGB.High,
        })), maxScore, '');

        // Top 10 by MPI
        checkPage(80);
        const sortedByMPI = [...reportData].sort((a, b) => (b.avgMPI ?? 0) - (a.avgMPI ?? 0)).slice(0, 10);
        const maxMPI = sortedByMPI[0]?.avgMPI ?? 1;
        y = drawSectionHeader(doc, '3. TOP 10 STATES BY AVERAGE MPI', y);
        y = drawBarChart(doc, margin, y, pageW, 7, sortedByMPI.map(s => ({
          label: s.state,
          value: s.avgMPI ?? 0,
          color: RISK_RGB.Critical,
        })), maxMPI, '');

        // Full state comparison table
        checkPage(30);
        y = drawSectionHeader(doc, '4. FULL STATE COMPARISON TABLE', y);
        const stateTableHeaders = ['State', 'LGAs', 'Avg Score', 'Avg MPI', 'Avg NL', 'Hi-Risk', 'Health', 'Schools'];
        const stateColWidths = [38, 12, 22, 20, 18, 16, 16, 18];
        const stateRows = reportData.map(s => [
          s.state,
          String(s.lgaCount),
          (s.avgCompositeScore ?? 0).toFixed(4),
          (s.avgMPI ?? 0).toFixed(4),
          (s.avgNightlight ?? 0).toFixed(2),
          String(s.highRiskCount),
          String(s.totalHealthFacilities ?? 'N/A'),
          String(s.totalSchools ?? 'N/A'),
        ]);
        y = drawTable(doc, margin, y, stateTableHeaders, stateRows, stateColWidths);

        // Top 20 worst LGAs from hotspotsData
        if (hotspotsData) {
          checkPage(30);
          y = drawSectionHeader(doc, '5. TOP 20 MOST DEPRIVED LGAs (National)', y);
          const top20 = [...hotspotsData.features]
            .sort((a, b) => (b.properties.composite_poverty_score ?? 0) - (a.properties.composite_poverty_score ?? 0))
            .slice(0, 20);
          const lgaHeaders = ['#', 'LGA', 'State', 'Risk', 'Score', 'MPI', 'Pop Density', 'Health', 'Schools'];
          const lgaColWidths = [8, 38, 28, 16, 20, 18, 22, 14, 16];
          const lgaRows = top20.map((f, i) => {
            const p = f.properties;
            return [
              String(i + 1),
              p.LGA_Name ?? '',
              p.State ?? '',
              p.risk_level ?? '',
              (p.composite_poverty_score ?? 0).toFixed(4),
              (p.MPI ?? 0).toFixed(4),
              p.population_density ? p.population_density.toFixed(1) : 'N/A',
              String(p.health_facility_count ?? 'N/A'),
              String(p.school_count ?? 'N/A'),
            ];
          });
          y = drawTable(doc, margin, y, lgaHeaders, lgaRows, lgaColWidths);

          // Top 20 least deprived
          checkPage(30);
          y = drawSectionHeader(doc, '6. TOP 20 LEAST DEPRIVED LGAs (National)', y);
          const bottom20 = [...hotspotsData.features]
            .sort((a, b) => (a.properties.composite_poverty_score ?? 0) - (b.properties.composite_poverty_score ?? 0))
            .slice(0, 20);
          const bottom20Rows = bottom20.map((f, i) => {
            const p = f.properties;
            return [
              String(i + 1),
              p.LGA_Name ?? '',
              p.State ?? '',
              p.risk_level ?? '',
              (p.composite_poverty_score ?? 0).toFixed(4),
              (p.MPI ?? 0).toFixed(4),
              p.population_density ? p.population_density.toFixed(1) : 'N/A',
              String(p.health_facility_count ?? 'N/A'),
              String(p.school_count ?? 'N/A'),
            ];
          });
          y = drawTable(doc, margin, y, lgaHeaders, bottom20Rows, lgaColWidths);

          // Conflict zones
          const conflictLGAs = hotspotsData.features.filter(f =>
            f.properties.conflict_flag && f.properties.conflict_flag !== 'NORMAL'
          ).sort((a, b) => {
            const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
            return (order[a.properties.conflict_flag ?? ''] ?? 3) - (order[b.properties.conflict_flag ?? ''] ?? 3);
          });
          if (conflictLGAs.length > 0) {
            checkPage(30);
            y = drawSectionHeader(doc, `7. CONFLICT-AFFECTED LGAs (${conflictLGAs.length} total)`, y);
            const conflictHeaders = ['LGA', 'State', 'Conflict Level', 'Risk', 'Score', 'MPI'];
            const conflictColWidths = [45, 35, 28, 20, 22, 20];
            const conflictRows = conflictLGAs.slice(0, 30).map(f => {
              const p = f.properties;
              return [
                p.LGA_Name ?? '',
                p.State ?? '',
                p.conflict_flag ?? '',
                p.risk_level ?? '',
                (p.composite_poverty_score ?? 0).toFixed(4),
                (p.MPI ?? 0).toFixed(4),
              ];
            });
            y = drawTable(doc, margin, y, conflictHeaders, conflictRows, conflictColWidths);
          }
        }
      }

      // ── STATE SCOPE ─────────────────────────────────────────────────────
      if (scope === 'state' && selectedStates.length > 0) {
        y = drawSectionHeader(doc, 'STATE-LEVEL DETAIL REPORT', y);

        // Summary stat cards for selected states
        y = drawStatCards(doc, margin, y, [
          { label: 'Selected States', value: String(selectedStates.length) },
          { label: 'Total LGAs', value: String(totalLGAs) },
          { label: 'Avg Score', value: avgScore.toFixed(3) },
          { label: 'High/Critical', value: String(totalHighRisk), color: [239, 68, 68] },
        ]);

        // Risk distribution
        checkPage(30);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 95);
        doc.text('Risk Distribution — Selected States', margin, y);
        y += 5;
        y = drawRiskBar(doc, margin, y, pageW, 8, riskCounts, totalRisk);
        y += 4;

        // State comparison bar chart
        if (selectedStates.length > 1) {
          checkPage(60);
          const selData = reportData.sort((a, b) => (b.avgCompositeScore ?? 0) - (a.avgCompositeScore ?? 0));
          const maxSel = selData[0]?.avgCompositeScore ?? 1;
          y = drawSectionHeader(doc, 'STATE COMPARISON — Avg Composite Score', y);
          y = drawBarChart(doc, margin, y, pageW, 7, selData.map(s => ({
            label: s.state,
            value: s.avgCompositeScore ?? 0,
            color: RISK_RGB.High,
          })), maxSel, '');
        }

        // Per-state detail
        selectedStates.forEach((stateName, si) => {
          checkPage(40);
          const stateData = states.find(s => s.state === stateName);
          y = drawSectionHeader(doc, `${si + 1}. ${stateName.toUpperCase()}`, y);

          if (stateData) {
            y = drawStatCards(doc, margin, y, [
              { label: 'LGAs', value: String(stateData.lgaCount) },
              { label: 'Avg Score', value: (stateData.avgCompositeScore ?? 0).toFixed(3) },
              { label: 'Avg MPI', value: (stateData.avgMPI ?? 0).toFixed(3) },
              { label: 'High Risk', value: String(stateData.highRiskCount), color: [239, 68, 68] },
            ]);
            y = drawStatCards(doc, margin, y, [
              { label: 'Health Facilities', value: String(stateData.totalHealthFacilities ?? 'N/A'), color: [16, 185, 129] },
              { label: 'Schools', value: String(stateData.totalSchools ?? 'N/A'), color: [59, 130, 246] },
              { label: 'Avg Pop Density', value: (stateData.avgPopulationDensity ?? 0).toFixed(1) },
              { label: 'Avg Nightlight', value: (stateData.avgNightlight ?? 0).toFixed(2) },
            ]);
          }

          // LGA detail table
          const lgaFeatures = buildStateDetailLines(stateName);
          if (lgaFeatures.length > 0) {
            checkPage(30);
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 58, 95);
            doc.text(`LGA Rankings — ${stateName} (${lgaFeatures.length} LGAs, most deprived first)`, margin, y);
            y += 5;

            // Bar chart for top 10 LGAs
            const top10 = lgaFeatures.slice(0, 10);
            const maxLGAScore = top10[0]?.properties.composite_poverty_score ?? 1;
            y = drawBarChart(doc, margin, y, pageW, 6.5, top10.map(f => ({
              label: f.properties.LGA_Name ?? '',
              value: f.properties.composite_poverty_score ?? 0,
              color: RISK_RGB[f.properties.risk_level ?? 'Medium'] ?? RISK_RGB.Medium,
            })), maxLGAScore, `Top 10 LGAs by Composite Score`);

            // Full LGA table
            checkPage(30);
            const lgaHeaders = ['#', 'LGA Name', 'Risk', 'Score', 'MPI', 'Pop Density', 'Health', 'Schools', 'NDVI', 'Rainfall'];
            const lgaColWidths = [8, 40, 16, 20, 18, 20, 14, 14, 14, 16];
            const lgaRows = lgaFeatures.map((f, i) => {
              const p = f.properties;
              return [
                String(i + 1),
                p.LGA_Name ?? '',
                p.risk_level ?? '',
                (p.composite_poverty_score ?? 0).toFixed(4),
                (p.MPI ?? 0).toFixed(4),
                p.population_density ? p.population_density.toFixed(1) : 'N/A',
                String(p.health_facility_count ?? 'N/A'),
                String(p.school_count ?? 'N/A'),
                p.ndvi_mean ? p.ndvi_mean.toFixed(3) : 'N/A',
                p.rainfall_mm ? p.rainfall_mm.toFixed(0) + 'mm' : 'N/A',
              ];
            });
            y = drawTable(doc, margin, y, lgaHeaders, lgaRows, lgaColWidths);
          } else {
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('  (No LGA detail data available)', margin, y);
            y += 8;
          }
        });
      }

      // ── Footer on every page ────────────────────────────────────────────
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(30, 58, 95);
        doc.rect(0, 287, 210, 10, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 200, 230);
        doc.text('IOPHIN — Integrated Operational Poverty Hotspot Intelligence Network', margin, 293);
        doc.text(`Page ${p} of ${totalPages}`, 195, 293, { align: 'right' });
      }

      doc.save(`iophin_report_${scope}_${Date.now()}.pdf`);
      return true;
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
    const allRows: (string | number)[][] = [headers, ...rows];
    if (scope === 'state' && selectedStates.length > 0) {
      allRows.push([]);
      allRows.push(['--- LGA DETAILS ---']);
      selectedStates.forEach(stateName => {
        allRows.push([`State: ${stateName}`]);
        buildStateDetailLines(stateName).forEach((f, idx) => {
          const p = f.properties;
          allRows.push([`${idx + 1}. ${p.LGA_Name} | Risk: ${p.risk_level} | Score: ${(p.composite_poverty_score ?? 0).toFixed(4)} | MPI: ${(p.MPI ?? 0).toFixed(4)}`]);
        });
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
    return false;
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
    ? reportData.reduce((s, r) => s + (r.avgCompositeScore ?? 0), 0) / reportData.length
    : 0;
  const totalHighRisk = reportData.reduce((s, r) => s + r.highRiskCount, 0);

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
                {' '}— Report will include bar charts, full LGA tables with NDVI, rainfall, health & school data
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
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--blue-light)' }}>Report includes:</strong>{' '}
            {scope === 'national' || scope === 'summary'
              ? 'Stat cards · Risk distribution bar · Top 10 deprived states chart · Top 10 by MPI chart · Full state table · Top/Bottom 20 LGA tables · Conflict zones table'
              : 'Stat cards · Risk distribution · State comparison chart · Per-state bar charts · Full LGA tables with NDVI, rainfall, health & school data'}
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
