/**
 * PDF Report Generator for IOPHIN
 * Uses PDFKit to generate professional reports.
 * Supports national, state, and summary scopes with full LGA detail.
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

export async function generateReport(res, options = {}) {
  const { scope = 'national', states = [], lgas = [] } = options;

  try {
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="iophin_report_${scope}_${Date.now()}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).fillColor('#1e3a5f').text('IOPHIN Poverty Hotspot Intelligence Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.fontSize(10).fillColor('#666').text(`Scope: ${scope.charAt(0).toUpperCase() + scope.slice(1)}`, { align: 'center' });
    doc.moveDown(1);

    // National Summary (always included for national/summary scope)
    if (scope === 'national' || scope === 'summary') {
      await addNationalSummary(doc, pool);
    }

    // State-level detail (for state scope or when states are specified)
    if (scope === 'state' && states.length > 0) {
      await addStateSummary(doc, pool, states);
    } else if (states.length > 0) {
      // States specified alongside national scope
      await addStateSummary(doc, pool, states);
    }

    // LGA detail
    if (lgas.length > 0) {
      await addLGASummary(doc, pool, lgas);
    }

    doc.end();
  } catch (err) {
    console.error('Report generation failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Report generation failed', message: err.message });
    }
  }
}

async function addNationalSummary(doc, pool) {
  try {
    const statsResult = await pool.query(`
      SELECT COUNT(*) AS total, AVG(mpi) AS avg_mpi, AVG(composite_poverty_score) AS avg_score,
             COUNT(*) FILTER (WHERE LOWER(risk_level) = 'critical') AS critical_count,
             COUNT(*) FILTER (WHERE LOWER(risk_level) = 'high') AS high_count,
             COUNT(*) FILTER (WHERE LOWER(risk_level) = 'medium') AS medium_count,
             COUNT(*) FILTER (WHERE LOWER(risk_level) = 'low') AS low_count,
             COUNT(DISTINCT state) AS state_count
      FROM poverty_hotspots`);
    const s = statsResult.rows[0];

    doc.fontSize(14).fillColor('#1e3a5f').text('National Summary');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#333');
    doc.text(`Total States: ${s.state_count}`);
    doc.text(`Total LGAs: ${s.total}`);
    doc.text(`Average MPI: ${parseFloat(s.avg_mpi || 0).toFixed(4)}`);
    doc.text(`Average Composite Score: ${parseFloat(s.avg_score || 0).toFixed(4)}`);
    doc.text(`Risk Distribution — Critical: ${s.critical_count} | High: ${s.high_count} | Medium: ${s.medium_count} | Low: ${s.low_count}`);
    doc.moveDown(1);

    // Top 10 worst LGAs
    const rankResult = await pool.query(`
      SELECT lga_name, state, mpi, composite_poverty_score, risk_level
      FROM poverty_hotspots WHERE composite_poverty_score IS NOT NULL
      ORDER BY composite_poverty_score DESC LIMIT 10`);

    doc.fontSize(12).fillColor('#1e3a5f').text('Top 10 Most Deprived LGAs');
    doc.moveDown(0.3);
    rankResult.rows.forEach((r, i) => {
      doc.fontSize(9).fillColor('#333').text(
        `${i+1}. ${r.lga_name} (${r.state}) — ${r.risk_level} | Score: ${parseFloat(r.composite_poverty_score||0).toFixed(4)} | MPI: ${parseFloat(r.mpi||0).toFixed(4)}`
      );
    });
    doc.moveDown(0.5);

    // Top 10 least deprived LGAs
    const bestResult = await pool.query(`
      SELECT lga_name, state, mpi, composite_poverty_score, risk_level
      FROM poverty_hotspots WHERE composite_poverty_score IS NOT NULL
      ORDER BY composite_poverty_score ASC LIMIT 10`);

    doc.fontSize(12).fillColor('#1e3a5f').text('Top 10 Least Deprived LGAs');
    doc.moveDown(0.3);
    bestResult.rows.forEach((r, i) => {
      doc.fontSize(9).fillColor('#333').text(
        `${i+1}. ${r.lga_name} (${r.state}) — ${r.risk_level} | Score: ${parseFloat(r.composite_poverty_score||0).toFixed(4)} | MPI: ${parseFloat(r.mpi||0).toFixed(4)}`
      );
    });
    doc.moveDown(1);
  } catch (err) {
    doc.text(`[Summary data unavailable: ${err.message}]`);
  }
}

async function addStateSummary(doc, pool, states) {
  doc.addPage();
  doc.fontSize(14).fillColor('#1e3a5f').text('State-Level Detail Report');
  doc.moveDown(0.5);

  for (const state of states) {
    try {
      // State aggregate stats
      const aggResult = await pool.query(`
        SELECT COUNT(*) AS lga_count,
               AVG(mpi) AS avg_mpi,
               AVG(composite_poverty_score) AS avg_score,
               COUNT(*) FILTER (WHERE LOWER(risk_level) IN ('high','critical')) AS high_risk_count,
               SUM(health_facility_count) AS total_health,
               SUM(school_count) AS total_schools
        FROM poverty_hotspots WHERE LOWER(state) = LOWER($1)`, [state]);
      const agg = aggResult.rows[0];

      // Check if we need a new page
      if (doc.y > 700) doc.addPage();

      doc.fontSize(13).fillColor('#1e3a5f').text(state.toUpperCase());
      doc.moveDown(0.2);
      doc.fontSize(9).fillColor('#555');
      doc.text(`LGAs: ${agg.lga_count} | Avg Score: ${parseFloat(agg.avg_score||0).toFixed(4)} | Avg MPI: ${parseFloat(agg.avg_mpi||0).toFixed(4)}`);
      doc.text(`High/Critical Risk: ${agg.high_risk_count} | Health Facilities: ${agg.total_health || 'N/A'} | Schools: ${agg.total_schools || 'N/A'}`);
      doc.moveDown(0.3);

      // All LGAs in this state, sorted by composite score (most deprived first)
      const result = await pool.query(`
        SELECT lga_name, mpi, composite_poverty_score, risk_level,
               health_facility_count, school_count, population_density
        FROM poverty_hotspots WHERE LOWER(state) = LOWER($1)
        ORDER BY composite_poverty_score DESC NULLS LAST`, [state]);

      doc.fontSize(9).fillColor('#1e3a5f').text('LGA Rankings (most deprived first):');
      doc.moveDown(0.2);
      result.rows.forEach((r, idx) => {
        if (doc.y > 750) doc.addPage();
        doc.fontSize(8).fillColor('#333').text(
          `  ${idx+1}. ${r.lga_name} — ${r.risk_level} | Score: ${parseFloat(r.composite_poverty_score||0).toFixed(4)} | MPI: ${parseFloat(r.mpi||0).toFixed(4)}`
        );
      });
      doc.moveDown(0.8);

      // Separator line
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
      doc.moveDown(0.5);
    } catch (err) {
      doc.fontSize(9).fillColor('#999').text(`[${state}: data unavailable — ${err.message}]`);
      doc.moveDown(0.5);
    }
  }
}

async function addLGASummary(doc, pool, lgas) {
  doc.addPage();
  doc.fontSize(14).fillColor('#1e3a5f').text('LGA Detail Report');
  doc.moveDown(0.5);
  for (const lga of lgas) {
    try {
      const result = await pool.query('SELECT * FROM poverty_hotspots WHERE lga_name = $1', [lga]);
      if (result.rows.length === 0) continue;
      const r = result.rows[0];
      if (doc.y > 700) doc.addPage();
      doc.fontSize(11).fillColor('#1e3a5f').text(`${r.lga_name} (${r.state})`);
      doc.fontSize(9).fillColor('#333');
      doc.text(`Risk Level: ${r.risk_level} | MPI: ${parseFloat(r.mpi||0).toFixed(4)}`);
      doc.text(`Composite Score: ${parseFloat(r.composite_poverty_score||0).toFixed(4)}`);
      doc.text(`Health Facilities: ${r.health_facility_count || 'N/A'} | Schools: ${r.school_count || 'N/A'}`);
      doc.text(`Population Density: ${r.population_density || 'N/A'}`);
      if (r.ndvi_mean) doc.text(`NDVI: ${parseFloat(r.ndvi_mean).toFixed(3)}`);
      if (r.rainfall_mm) doc.text(`Rainfall: ${parseFloat(r.rainfall_mm).toFixed(0)} mm/month`);
      if (r.conflict_flag && r.conflict_flag !== 'NORMAL') doc.text(`Conflict Status: ${r.conflict_flag}`);
      doc.moveDown(0.5);
    } catch { /* skip */ }
  }
}
