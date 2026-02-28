/**
 * PDF Report Generator for IOPHIN
 * Uses PDFKit to generate professional reports with static charts, tables, and visuals.
 * Supports national, state, and LGA scopes with full detail.
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Risk level colors (RGB) ──────────────────────────────────────────────────
const RISK_COLORS = {
  critical: [124, 58, 237],
  high: [239, 68, 68],
  medium: [245, 158, 11],
  low: [16, 185, 129],
  minimal: [59, 130, 246],
};

function riskColor(level) {
  const k = (level || '').toLowerCase();
  return RISK_COLORS[k] || [150, 150, 150];
}

// ── Draw a filled rectangle ──────────────────────────────────────────────────
function fillRect(doc, x, y, w, h, r, g, b) {
  // Convert RGB to hex for PDFKit compatibility
  const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  doc.save();
  doc.rect(x, y, w, h).fillColor(hex).fill();
  doc.restore();
}

// ── Draw section header bar ──────────────────────────────────────────────────
function sectionHeader(doc, text, y) {
  fillRect(doc, 50, y, 495, 14, 30, 58, 95);
  doc.save();
  doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold')
    .text(text, 55, y + 3, { width: 485 });
  doc.restore();
  return y + 18;
}

// ── Draw stat cards row ──────────────────────────────────────────────────────
function statCards(doc, y, cards) {
  const cardW = 110;
  const cardH = 30;
  const gap = 8;
  const startX = 50;
  cards.forEach((card, i) => {
    const cx = startX + i * (cardW + gap);
    fillRect(doc, cx, y, cardW, cardH, 240, 244, 252);
    doc.save();
    doc.fontSize(14).fillColor(card.color || '#1e3a5f').font('Helvetica-Bold')
      .text(String(card.value), cx, y + 5, { width: cardW, align: 'center' });
    doc.fontSize(7).fillColor('#666666').font('Helvetica')
      .text(card.label, cx, y + 21, { width: cardW, align: 'center' });
    doc.restore();
  });
  return y + cardH + 8;
}

// ── Draw horizontal bar chart ────────────────────────────────────────────────
function barChart(doc, x, y, items, maxVal, barH = 12, barAreaW = 300, labelW = 120) {
  const gap = 3;
  items.forEach(item => {
    if (y > 750) { doc.addPage(); y = 50; }
    const barW = maxVal > 0 ? (item.value / maxVal) * barAreaW : 0;

    // Label
    doc.save();
    doc.fontSize(7.5).fillColor('#333333').font('Helvetica')
      .text(item.label.length > 20 ? item.label.slice(0, 19) + '\u2026' : item.label,
        x, y + 2, { width: labelW - 4 });
    doc.restore();

    // Background track
    fillRect(doc, x + labelW, y, barAreaW, barH, 230, 230, 230);

    // Filled bar
    if (barW > 0) {
      const [r, g, b] = item.color || [30, 58, 95];
      fillRect(doc, x + labelW, y, barW, barH, r, g, b);
    }

    // Value label
    doc.save();
    doc.fontSize(7).fillColor('#555555').font('Helvetica')
      .text(typeof item.value === 'number' ? item.value.toFixed(4) : String(item.value),
        x + labelW + barAreaW + 4, y + 2);
    doc.restore();

    y += barH + gap;
  });
  return y + 4;
}

// ── Draw risk distribution stacked bar ──────────────────────────────────────
function riskDistBar(doc, x, y, counts, total, width = 495) {
  const barH = 14;
  const segments = [
    { key: 'critical', label: 'Critical', color: RISK_COLORS.critical, count: counts.critical || 0 },
    { key: 'high', label: 'High', color: RISK_COLORS.high, count: counts.high || 0 },
    { key: 'medium', label: 'Medium', color: RISK_COLORS.medium, count: counts.medium || 0 },
    { key: 'low', label: 'Low', color: RISK_COLORS.low, count: counts.low || 0 },
    { key: 'minimal', label: 'Minimal', color: RISK_COLORS.minimal, count: counts.minimal || 0 },
  ];

  let cx = x;
  segments.forEach(seg => {
    if (seg.count <= 0 || total <= 0) return;
    const segW = (seg.count / total) * width;
    fillRect(doc, cx, y, segW, barH, seg.color[0], seg.color[1], seg.color[2]);
    cx += segW;
  });

  // Legend
  let lx = x;
  const ly = y + barH + 4;
  doc.save();
  doc.fontSize(7).font('Helvetica');
  segments.forEach(seg => {
    if (seg.count <= 0) return;
    fillRect(doc, lx, ly, 8, 5, seg.color[0], seg.color[1], seg.color[2]);
    doc.fillColor('#444444').text(
      `${seg.label}: ${seg.count} (${total > 0 ? ((seg.count / total) * 100).toFixed(1) : 0}%)`,
      lx + 10, ly);
    lx += 90;
  });
  doc.restore();

  return ly + 12;
}

// ── Draw a data table ────────────────────────────────────────────────────────
function drawTable(doc, x, y, headers, rows, colWidths, rowH = 12) {
  const tableW = colWidths.reduce((a, b) => a + b, 0);

  // Header
  fillRect(doc, x, y, tableW, rowH + 2, 30, 58, 95);
  doc.save();
  doc.fontSize(7.5).fillColor('#ffffff').font('Helvetica-Bold');
  let cx = x + 2;
  headers.forEach((h, i) => {
    doc.text(h, cx, y + 3, { width: colWidths[i] - 3 });
    cx += colWidths[i];
  });
  doc.restore();
  y += rowH + 2;

  // Rows
  rows.forEach((row, ri) => {
    if (y > 760) { doc.addPage(); y = 50; }
    const bg = ri % 2 === 0 ? [248, 249, 252] : [240, 242, 248];
    fillRect(doc, x, y, tableW, rowH, bg[0], bg[1], bg[2]);
    doc.save();
    doc.fontSize(7).fillColor('#222222').font('Helvetica');
    let cx2 = x + 2;
    row.forEach((cell, i) => {
      const maxChars = Math.floor(colWidths[i] / 4.5);
      const txt = String(cell ?? 'N/A');
      const truncated = txt.length > maxChars ? txt.slice(0, maxChars - 1) + '\u2026' : txt;
      doc.text(truncated, cx2, y + 3, { width: colWidths[i] - 3 });
      cx2 += colWidths[i];
    });
    doc.restore();
    y += rowH;
  });

  // Bottom border
  doc.moveTo(x, y).lineTo(x + tableW, y).strokeColor('#cccccc').lineWidth(0.5).stroke();
  return y + 6;
}

// ── Page footer ──────────────────────────────────────────────────────────────
function addFooter(doc, pageNum, totalPages) {
  fillRect(doc, 0, 820, 595, 22, 30, 58, 95);
  doc.save();
  doc.fontSize(7).fillColor('#b4c8e6').font('Helvetica')
    .text('IOPHIN — Integrated Operational Poverty Hotspot Intelligence Network', 50, 826);
  doc.text(`Page ${pageNum} of ${totalPages}`, 50, 826, { width: 495, align: 'right' });
  doc.restore();
}

// ── Main export ──────────────────────────────────────────────────────────────
export async function generateReport(res, options = {}) {
  const { scope = 'national', states = [], lgas = [] } = options;

  try {
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="iophin_report_${scope}_${Date.now()}.pdf"`);
    doc.pipe(res);

    // ── Cover page ──────────────────────────────────────────────────────
    fillRect(doc, 0, 0, 595, 120, 30, 58, 95);
    doc.save();
    doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold')
      .text('IOPHIN', 50, 30);
    doc.fontSize(12).fillColor('#b4c8e6').font('Helvetica')
      .text('Integrated Operational Poverty Hotspot Intelligence Network', 50, 58);
    doc.fontSize(10).fillColor('#dce6f5')
      .text('Poverty Hotspot Intelligence Report', 50, 76);
    doc.fontSize(9).fillColor('#a0b9dc')
      .text(`Generated: ${new Date().toLocaleString()}   |   Scope: ${scope.charAt(0).toUpperCase() + scope.slice(1)}`, 50, 92);
    doc.restore();

    let y = 135;

    // ── National Summary ────────────────────────────────────────────────
    if (scope === 'national' || scope === 'summary') {
      y = await addNationalSummary(doc, pool, y);
    }

    // ── State-level detail ──────────────────────────────────────────────
    if (scope === 'state' && states.length > 0) {
      y = await addStateSummary(doc, pool, states, y);
    } else if (states.length > 0) {
      y = await addStateSummary(doc, pool, states, y);
    }

    // ── LGA detail ──────────────────────────────────────────────────────
    if (lgas.length > 0) {
      y = await addLGASummary(doc, pool, lgas, y);
    }

    // ── Finalize with footers ───────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      addFooter(doc, i + 1, range.count);
    }

    doc.end();
  } catch (err) {
    console.error('Report generation failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Report generation failed', message: err.message });
    }
  }
}

// ── National Summary ─────────────────────────────────────────────────────────
async function addNationalSummary(doc, pool, y) {
  try {
    // Aggregate stats
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) AS total,
        AVG(mpi) AS avg_mpi,
        AVG(composite_poverty_score) AS avg_score,
        AVG(mean_nightlight_intensity) AS avg_nightlight,
        AVG(population_density) AS avg_pop_density,
        SUM(health_facility_count) AS total_health,
        SUM(school_count) AS total_schools,
        COUNT(*) FILTER (WHERE LOWER(risk_level) = 'critical') AS critical_count,
        COUNT(*) FILTER (WHERE LOWER(risk_level) = 'high') AS high_count,
        COUNT(*) FILTER (WHERE LOWER(risk_level) = 'medium') AS medium_count,
        COUNT(*) FILTER (WHERE LOWER(risk_level) = 'low') AS low_count,
        COUNT(*) FILTER (WHERE LOWER(risk_level) = 'minimal') AS minimal_count,
        COUNT(DISTINCT state) AS state_count,
        COUNT(*) FILTER (WHERE conflict_flag IS NOT NULL AND conflict_flag != 'NORMAL') AS conflict_count
      FROM poverty_hotspots`);
    const s = statsResult.rows[0];
    const total = parseInt(s.total) || 0;
    const riskCounts = {
      critical: parseInt(s.critical_count) || 0,
      high: parseInt(s.high_count) || 0,
      medium: parseInt(s.medium_count) || 0,
      low: parseInt(s.low_count) || 0,
      minimal: parseInt(s.minimal_count) || 0,
    };
    const totalRisk = Object.values(riskCounts).reduce((a, b) => a + b, 0);

    // Section header
    y = sectionHeader(doc, '1. NATIONAL OVERVIEW', y);

    // Stat cards row 1
    y = statCards(doc, y, [
      { label: 'States', value: s.state_count },
      { label: 'Total LGAs', value: total },
      { label: 'Avg MPI', value: parseFloat(s.avg_mpi || 0).toFixed(4) },
      { label: 'Avg Composite Score', value: parseFloat(s.avg_score || 0).toFixed(4) },
    ]);

    // Stat cards row 2
    y = statCards(doc, y, [
      { label: 'Critical LGAs', value: riskCounts.critical, color: '#7c3aed' },
      { label: 'High Risk LGAs', value: riskCounts.high, color: '#ef4444' },
      { label: 'Health Facilities', value: s.total_health || 'N/A', color: '#10b981' },
      { label: 'Schools', value: s.total_schools || 'N/A', color: '#3b82f6' },
    ]);

    // Stat cards row 3
    y = statCards(doc, y, [
      { label: 'Conflict-Affected LGAs', value: s.conflict_count || 0, color: '#ef4444' },
      { label: 'Avg Pop Density', value: parseFloat(s.avg_pop_density || 0).toFixed(1) },
      { label: 'Avg Nightlight', value: parseFloat(s.avg_nightlight || 0).toFixed(3) },
      { label: 'Medium Risk LGAs', value: riskCounts.medium, color: '#f59e0b' },
    ]);

    // Risk distribution bar
    if (y > 700) { doc.addPage(); y = 50; }
    doc.save();
    doc.fontSize(9).fillColor('#1e3a5f').font('Helvetica-Bold')
      .text('Risk Level Distribution Across All LGAs', 50, y);
    doc.restore();
    y += 8;
    y = riskDistBar(doc, 50, y, riskCounts, totalRisk, 495);
    y += 6;

    // ── Top 10 most deprived states bar chart ──────────────────────────
    const topStatesResult = await pool.query(`
      SELECT state,
             COUNT(*) AS lga_count,
             AVG(composite_poverty_score) AS avg_score,
             AVG(mpi) AS avg_mpi,
             COUNT(*) FILTER (WHERE LOWER(risk_level) IN ('high','critical')) AS high_risk
      FROM poverty_hotspots
      GROUP BY state
      ORDER BY avg_score DESC NULLS LAST
      LIMIT 10`);

    if (y > 650) { doc.addPage(); y = 50; }
    y = sectionHeader(doc, '2. TOP 10 MOST DEPRIVED STATES (by Avg Composite Score)', y);
    const maxStateScore = parseFloat(topStatesResult.rows[0]?.avg_score || 1);
    y = barChart(doc, 50, y,
      topStatesResult.rows.map(r => ({
        label: r.state,
        value: parseFloat(r.avg_score || 0),
        color: [...RISK_COLORS.high],
      })),
      maxStateScore, 12, 300, 130
    );

    // ── Top 10 states by MPI ───────────────────────────────────────────
    const topMPIResult = await pool.query(`
      SELECT state, AVG(mpi) AS avg_mpi
      FROM poverty_hotspots
      GROUP BY state
      ORDER BY avg_mpi DESC NULLS LAST
      LIMIT 10`);

    if (y > 650) { doc.addPage(); y = 50; }
    y = sectionHeader(doc, '3. TOP 10 STATES BY AVERAGE MPI', y);
    const maxMPI = parseFloat(topMPIResult.rows[0]?.avg_mpi || 1);
    y = barChart(doc, 50, y,
      topMPIResult.rows.map(r => ({
        label: r.state,
        value: parseFloat(r.avg_mpi || 0),
        color: [...RISK_COLORS.critical],
      })),
      maxMPI, 12, 300, 130
    );

    // ── Full state comparison table ────────────────────────────────────
    const allStatesResult = await pool.query(`
      SELECT state,
             COUNT(*) AS lga_count,
             AVG(composite_poverty_score) AS avg_score,
             AVG(mpi) AS avg_mpi,
             AVG(mean_nightlight_intensity) AS avg_nl,
             AVG(population_density) AS avg_pop,
             SUM(health_facility_count) AS total_health,
             SUM(school_count) AS total_schools,
             COUNT(*) FILTER (WHERE LOWER(risk_level) IN ('high','critical')) AS high_risk,
             COUNT(*) FILTER (WHERE conflict_flag IS NOT NULL AND conflict_flag != 'NORMAL') AS conflict_lgas
      FROM poverty_hotspots
      GROUP BY state
      ORDER BY avg_score DESC NULLS LAST`);

    if (y > 600) { doc.addPage(); y = 50; }
    y = sectionHeader(doc, '4. FULL STATE COMPARISON TABLE', y);
    const stateHeaders = ['State', 'LGAs', 'Avg Score', 'Avg MPI', 'Avg NL', 'Avg Pop', 'Health', 'Schools', 'Hi-Risk', 'Conflict'];
    const stateColW = [90, 28, 48, 44, 38, 38, 36, 40, 40, 43];
    const stateRows = allStatesResult.rows.map(r => [
      r.state,
      r.lga_count,
      parseFloat(r.avg_score || 0).toFixed(4),
      parseFloat(r.avg_mpi || 0).toFixed(4),
      parseFloat(r.avg_nl || 0).toFixed(3),
      parseFloat(r.avg_pop || 0).toFixed(1),
      r.total_health || 'N/A',
      r.total_schools || 'N/A',
      r.high_risk,
      r.conflict_lgas,
    ]);
    y = drawTable(doc, 50, y, stateHeaders, stateRows, stateColW);

    // ── Top 20 most deprived LGAs ──────────────────────────────────────
    const top20Result = await pool.query(`
      SELECT lga_name, state, mpi, composite_poverty_score, risk_level,
             population_density, health_facility_count, school_count,
             ndvi_mean, rainfall_mm, conflict_flag, mean_nightlight_intensity
      FROM poverty_hotspots
      WHERE composite_poverty_score IS NOT NULL
      ORDER BY composite_poverty_score DESC
      LIMIT 20`);

    if (y > 600) { doc.addPage(); y = 50; }
    y = sectionHeader(doc, '5. TOP 20 MOST DEPRIVED LGAs (National)', y);
    const lgaHeaders = ['#', 'LGA', 'State', 'Risk', 'Score', 'MPI', 'Pop Density', 'Health', 'Schools', 'NDVI', 'Rainfall'];
    const lgaColW = [18, 80, 65, 40, 46, 42, 44, 34, 36, 34, 46];
    const top20Rows = top20Result.rows.map((r, i) => [
      i + 1,
      r.lga_name,
      r.state,
      r.risk_level,
      parseFloat(r.composite_poverty_score || 0).toFixed(4),
      parseFloat(r.mpi || 0).toFixed(4),
      r.population_density ? parseFloat(r.population_density).toFixed(1) : 'N/A',
      r.health_facility_count ?? 'N/A',
      r.school_count ?? 'N/A',
      r.ndvi_mean ? parseFloat(r.ndvi_mean).toFixed(3) : 'N/A',
      r.rainfall_mm ? parseFloat(r.rainfall_mm).toFixed(0) + 'mm' : 'N/A',
    ]);
    y = drawTable(doc, 50, y, lgaHeaders, top20Rows, lgaColW);

    // ── Top 20 least deprived LGAs ─────────────────────────────────────
    const bottom20Result = await pool.query(`
      SELECT lga_name, state, mpi, composite_poverty_score, risk_level,
             population_density, health_facility_count, school_count,
             ndvi_mean, rainfall_mm
      FROM poverty_hotspots
      WHERE composite_poverty_score IS NOT NULL
      ORDER BY composite_poverty_score ASC
      LIMIT 20`);

    if (y > 600) { doc.addPage(); y = 50; }
    y = sectionHeader(doc, '6. TOP 20 LEAST DEPRIVED LGAs (National)', y);
    const bottom20Rows = bottom20Result.rows.map((r, i) => [
      i + 1,
      r.lga_name,
      r.state,
      r.risk_level,
      parseFloat(r.composite_poverty_score || 0).toFixed(4),
      parseFloat(r.mpi || 0).toFixed(4),
      r.population_density ? parseFloat(r.population_density).toFixed(1) : 'N/A',
      r.health_facility_count ?? 'N/A',
      r.school_count ?? 'N/A',
      r.ndvi_mean ? parseFloat(r.ndvi_mean).toFixed(3) : 'N/A',
      r.rainfall_mm ? parseFloat(r.rainfall_mm).toFixed(0) + 'mm' : 'N/A',
    ]);
    y = drawTable(doc, 50, y, lgaHeaders, bottom20Rows, lgaColW);

    // ── Conflict-affected LGAs ─────────────────────────────────────────
    const conflictResult = await pool.query(`
      SELECT lga_name, state, conflict_flag, risk_level,
             composite_poverty_score, mpi, population_density
      FROM poverty_hotspots
      WHERE conflict_flag IS NOT NULL AND conflict_flag != 'NORMAL'
      ORDER BY
        CASE conflict_flag WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        composite_poverty_score DESC NULLS LAST
      LIMIT 30`);

    if (conflictResult.rows.length > 0) {
      if (y > 600) { doc.addPage(); y = 50; }
      y = sectionHeader(doc, `7. CONFLICT-AFFECTED LGAs (${conflictResult.rows.length} shown)`, y);
      const conflictHeaders = ['LGA', 'State', 'Conflict Level', 'Risk', 'Score', 'MPI', 'Pop Density'];
      const conflictColW = [100, 80, 70, 50, 55, 50, 60];
      const conflictRows = conflictResult.rows.map(r => [
        r.lga_name,
        r.state,
        r.conflict_flag,
        r.risk_level,
        parseFloat(r.composite_poverty_score || 0).toFixed(4),
        parseFloat(r.mpi || 0).toFixed(4),
        r.population_density ? parseFloat(r.population_density).toFixed(1) : 'N/A',
      ]);
      y = drawTable(doc, 50, y, conflictHeaders, conflictRows, conflictColW);
    }

  } catch (err) {
    doc.save();
    doc.fontSize(9).fillColor('#999999').text(`[National summary unavailable: ${err.message}]`, 50, y);
    doc.restore();
    y += 20;
  }
  return y;
}

// ── State-Level Summary ──────────────────────────────────────────────────────
async function addStateSummary(doc, pool, states, y) {
  if (y > 700) { doc.addPage(); y = 50; }
  y = sectionHeader(doc, 'STATE-LEVEL DETAIL REPORT', y);

  for (const state of states) {
    try {
      // State aggregate
      const aggResult = await pool.query(`
        SELECT
          COUNT(*) AS lga_count,
          AVG(mpi) AS avg_mpi,
          AVG(composite_poverty_score) AS avg_score,
          AVG(mean_nightlight_intensity) AS avg_nl,
          AVG(population_density) AS avg_pop,
          SUM(health_facility_count) AS total_health,
          SUM(school_count) AS total_schools,
          COUNT(*) FILTER (WHERE LOWER(risk_level) = 'critical') AS critical_count,
          COUNT(*) FILTER (WHERE LOWER(risk_level) = 'high') AS high_count,
          COUNT(*) FILTER (WHERE LOWER(risk_level) = 'medium') AS medium_count,
          COUNT(*) FILTER (WHERE LOWER(risk_level) = 'low') AS low_count,
          COUNT(*) FILTER (WHERE LOWER(risk_level) = 'minimal') AS minimal_count,
          COUNT(*) FILTER (WHERE conflict_flag IS NOT NULL AND conflict_flag != 'NORMAL') AS conflict_count,
          AVG(ndvi_mean) AS avg_ndvi,
          AVG(rainfall_mm) AS avg_rainfall
        FROM poverty_hotspots WHERE LOWER(state) = LOWER($1)`, [state]);
      const agg = aggResult.rows[0];
      const riskCounts = {
        critical: parseInt(agg.critical_count) || 0,
        high: parseInt(agg.high_count) || 0,
        medium: parseInt(agg.medium_count) || 0,
        low: parseInt(agg.low_count) || 0,
        minimal: parseInt(agg.minimal_count) || 0,
      };
      const totalRisk = Object.values(riskCounts).reduce((a, b) => a + b, 0);

      if (y > 680) { doc.addPage(); y = 50; }
      y = sectionHeader(doc, state.toUpperCase(), y);

      // Stat cards
      y = statCards(doc, y, [
        { label: 'LGAs', value: agg.lga_count },
        { label: 'Avg Score', value: parseFloat(agg.avg_score || 0).toFixed(4) },
        { label: 'Avg MPI', value: parseFloat(agg.avg_mpi || 0).toFixed(4) },
        { label: 'Avg Nightlight', value: parseFloat(agg.avg_nl || 0).toFixed(3) },
      ]);
      y = statCards(doc, y, [
        { label: 'Critical LGAs', value: riskCounts.critical, color: '#7c3aed' },
        { label: 'High Risk LGAs', value: riskCounts.high, color: '#ef4444' },
        { label: 'Health Facilities', value: agg.total_health || 'N/A', color: '#10b981' },
        { label: 'Schools', value: agg.total_schools || 'N/A', color: '#3b82f6' },
      ]);
      y = statCards(doc, y, [
        { label: 'Conflict LGAs', value: agg.conflict_count || 0, color: '#ef4444' },
        { label: 'Avg Pop Density', value: parseFloat(agg.avg_pop || 0).toFixed(1) },
        { label: 'Avg NDVI', value: agg.avg_ndvi ? parseFloat(agg.avg_ndvi).toFixed(3) : 'N/A' },
        { label: 'Avg Rainfall', value: agg.avg_rainfall ? parseFloat(agg.avg_rainfall).toFixed(0) + 'mm' : 'N/A' },
      ]);

      // Risk distribution bar
      if (y > 700) { doc.addPage(); y = 50; }
      doc.save();
      doc.fontSize(8.5).fillColor('#1e3a5f').font('Helvetica-Bold')
        .text(`Risk Distribution \u2014 ${state}`, 50, y);
      doc.restore();
      y += 7;
      y = riskDistBar(doc, 50, y, riskCounts, totalRisk, 495);
      y += 4;

      // All LGAs sorted by composite score
      const lgaResult = await pool.query(`
        SELECT lga_name, mpi, composite_poverty_score, risk_level,
               health_facility_count, school_count, population_density,
               ndvi_mean, rainfall_mm, conflict_flag, mean_nightlight_intensity,
               distance_to_urban_km, road_density_km
        FROM poverty_hotspots WHERE LOWER(state) = LOWER($1)
        ORDER BY composite_poverty_score DESC NULLS LAST`, [state]);

      // Bar chart for top 10 LGAs
      if (lgaResult.rows.length > 0) {
        if (y > 650) { doc.addPage(); y = 50; }
        doc.save();
        doc.fontSize(8.5).fillColor('#1e3a5f').font('Helvetica-Bold')
          .text(`Top 10 LGAs by Composite Score \u2014 ${state}`, 50, y);
        doc.restore();
        y += 6;
        const top10 = lgaResult.rows.slice(0, 10);
        const maxScore = parseFloat(top10[0]?.composite_poverty_score || 1);
        y = barChart(doc, 50, y,
          top10.map(r => ({
            label: r.lga_name,
            value: parseFloat(r.composite_poverty_score || 0),
            color: [...riskColor(r.risk_level)],
          })),
          maxScore, 11, 290, 130
        );

        // Full LGA table
        if (y > 650) { doc.addPage(); y = 50; }
        doc.save();
        doc.fontSize(8.5).fillColor('#1e3a5f').font('Helvetica-Bold')
          .text(`All LGAs \u2014 ${state} (${lgaResult.rows.length} total, most deprived first)`, 50, y);
        doc.restore();
        y += 6;
        const lgaHeaders = ['#', 'LGA Name', 'Risk', 'Score', 'MPI', 'Pop Density', 'Health', 'Schools', 'NDVI', 'Rainfall', 'Conflict'];
        const lgaColW = [18, 80, 40, 46, 42, 44, 34, 36, 34, 44, 47];
        const lgaRows = lgaResult.rows.map((r, i) => [
          i + 1,
          r.lga_name,
          r.risk_level,
          parseFloat(r.composite_poverty_score || 0).toFixed(4),
          parseFloat(r.mpi || 0).toFixed(4),
          r.population_density ? parseFloat(r.population_density).toFixed(1) : 'N/A',
          r.health_facility_count ?? 'N/A',
          r.school_count ?? 'N/A',
          r.ndvi_mean ? parseFloat(r.ndvi_mean).toFixed(3) : 'N/A',
          r.rainfall_mm ? parseFloat(r.rainfall_mm).toFixed(0) + 'mm' : 'N/A',
          r.conflict_flag && r.conflict_flag !== 'NORMAL' ? r.conflict_flag : '—',
        ]);
        y = drawTable(doc, 50, y, lgaHeaders, lgaRows, lgaColW);
      }

      // Separator
      if (y > 750) { doc.addPage(); y = 50; }
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#dddddd').lineWidth(0.5).stroke();
      y += 8;

    } catch (err) {
      doc.save();
      doc.fontSize(9).fillColor('#999999').text(`[${state}: data unavailable \u2014 ${err.message}]`, 50, y);
      doc.restore();
      y += 12;
    }
  }
  return y;
}

// ── LGA Detail ───────────────────────────────────────────────────────────────
async function addLGASummary(doc, pool, lgas, y) {
  if (y > 700) { doc.addPage(); y = 50; }
  y = sectionHeader(doc, 'LGA DETAIL REPORT', y);

  for (const lga of lgas) {
    try {
      const result = await pool.query(`
        SELECT * FROM poverty_hotspots WHERE lga_name = $1`, [lga]);
      if (result.rows.length === 0) continue;
      const r = result.rows[0];

      if (y > 680) { doc.addPage(); y = 50; }

      // LGA header
      fillRect(doc, 50, y, 495, 18, 240, 244, 252);
      doc.save();
      doc.fontSize(11).fillColor('#1e3a5f').font('Helvetica-Bold')
        .text(`${r.lga_name}  (${r.state})`, 55, y + 4);
      const [rc, gc, bc] = riskColor(r.risk_level);
      fillRect(doc, 430, y + 3, 60, 12, rc, gc, bc);
      doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold')
        .text(r.risk_level || 'N/A', 430, y + 6, { width: 60, align: 'center' });
      doc.restore();
      y += 22;

      // Stat cards
      y = statCards(doc, y, [
        { label: 'Composite Score', value: parseFloat(r.composite_poverty_score || 0).toFixed(4) },
        { label: 'MPI', value: parseFloat(r.mpi || 0).toFixed(4) },
        { label: 'Nightlight', value: parseFloat(r.mean_nightlight_intensity || 0).toFixed(3) },
        { label: 'Pop Density', value: r.population_density ? parseFloat(r.population_density).toFixed(1) : 'N/A' },
      ]);
      y = statCards(doc, y, [
        { label: 'Health Facilities', value: r.health_facility_count ?? 'N/A', color: '#10b981' },
        { label: 'Schools', value: r.school_count ?? 'N/A', color: '#3b82f6' },
        { label: 'NDVI', value: r.ndvi_mean ? parseFloat(r.ndvi_mean).toFixed(3) : 'N/A' },
        { label: 'Rainfall', value: r.rainfall_mm ? parseFloat(r.rainfall_mm).toFixed(0) + 'mm' : 'N/A' },
      ]);

      // Additional detail table
      const detailRows = [
        ['Distance to Urban (km)', r.distance_to_urban_km ? parseFloat(r.distance_to_urban_km).toFixed(1) : 'N/A',
          'Road Density (km)', r.road_density_km ? parseFloat(r.road_density_km).toFixed(2) : 'N/A'],
        ['IDP Count', r.idp_count ?? 'N/A',
          'Food Price Index', r.food_price_index ? parseFloat(r.food_price_index).toFixed(2) : 'N/A'],
        ['Conflict Flag', r.conflict_flag || 'NORMAL',
          'Senatorial MPI', r.senatorial_mpi ? parseFloat(r.senatorial_mpi).toFixed(4) : 'N/A'],
        ['Headcount Ratio', r.headcount_ratio ? parseFloat(r.headcount_ratio).toFixed(4) : 'N/A',
          'Intensity of Deprivation', r.intensity_of_depravation ? parseFloat(r.intensity_of_depravation).toFixed(4) : 'N/A'],
        ['In Severe Poverty', r.in_severe_poverty ? parseFloat(r.in_severe_poverty).toFixed(4) : 'N/A',
          'Cluster Label', r.cluster_label || 'N/A'],
        ['Last Updated', r.last_updated ? new Date(r.last_updated).toLocaleDateString() : 'N/A',
          'Data Source', r.data_source || 'N/A'],
      ];

      const detailHeaders = ['Indicator', 'Value', 'Indicator', 'Value'];
      const detailColW = [130, 100, 130, 100];
      y = drawTable(doc, 50, y, detailHeaders, detailRows.map(row => row), detailColW, 11);

      // Separator
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#dddddd').lineWidth(0.5).stroke();
      y += 8;
    } catch { /* skip */ }
  }
  return y;
}
