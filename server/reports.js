/**
 * PDF Report Generator for IOPHIN
 * Uses PDFKit to generate professional reports.
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

export async function generateReport(res, options = {}) {
  const { scope = 'national', states = [], lgas = [], metrics = [] } = options;

  try {
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="iophin_report_${Date.now()}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).fillColor('#1e3a5f').text('IOPHIN Poverty Hotspot Intelligence Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    // National Summary
    if (scope === 'national' || scope === 'summary') {
      await addNationalSummary(doc, pool);
    }

    if (states.length > 0) {
      await addStateSummary(doc, pool, states);
    }

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
             COUNT(*) FILTER (WHERE risk_level = 'Critical') AS critical_count,
             COUNT(*) FILTER (WHERE risk_level = 'High') AS high_count,
             COUNT(*) FILTER (WHERE risk_level = 'Medium') AS medium_count
      FROM poverty_hotspots`);
    const s = statsResult.rows[0];

    doc.fontSize(14).fillColor('#1e3a5f').text('National Summary');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#333');
    doc.text(`Total LGAs: ${s.total}`);
    doc.text(`Average MPI: ${parseFloat(s.avg_mpi || 0).toFixed(4)}`);
    doc.text(`Average Composite Score: ${parseFloat(s.avg_score || 0).toFixed(4)}`);
    doc.text(`Critical: ${s.critical_count} | High: ${s.high_count} | Medium: ${s.medium_count}`);
    doc.moveDown(1);

    // Top 10 worst LGAs
    const rankResult = await pool.query(`
      SELECT lga_name, state, mpi, composite_poverty_score, risk_level
      FROM poverty_hotspots WHERE composite_poverty_score IS NOT NULL
      ORDER BY composite_poverty_score DESC LIMIT 10`);

    doc.fontSize(12).fillColor('#1e3a5f').text('Top 10 Highest Risk LGAs');
    doc.moveDown(0.3);
    rankResult.rows.forEach((r, i) => {
      doc.fontSize(9).fillColor('#333').text(
        `${i+1}. ${r.lga_name} (${r.state}) — ${r.risk_level} | MPI: ${parseFloat(r.mpi||0).toFixed(3)}`
      );
    });
    doc.moveDown(1);
  } catch (err) {
    doc.text(`[Summary data unavailable: ${err.message}]`);
  }
}

async function addStateSummary(doc, pool, states) {
  doc.addPage();
  doc.fontSize(14).fillColor('#1e3a5f').text('State-Level Summary');
  doc.moveDown(0.5);
  for (const state of states) {
    try {
      const result = await pool.query(`
        SELECT lga_name, mpi, composite_poverty_score, risk_level
        FROM poverty_hotspots WHERE LOWER(state) = LOWER($1)
        ORDER BY composite_poverty_score DESC NULLS LAST LIMIT 20`, [state]);
      doc.fontSize(11).fillColor('#1e3a5f').text(state);
      doc.fontSize(9).fillColor('#333');
      result.rows.forEach(r => {
        doc.text(`  ${r.lga_name}: ${r.risk_level} | Score: ${parseFloat(r.composite_poverty_score||0).toFixed(3)}`);
      });
      doc.moveDown(0.5);
    } catch { /* skip */ }
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
      doc.fontSize(11).fillColor('#1e3a5f').text(`${r.lga_name} (${r.state})`);
      doc.fontSize(9).fillColor('#333');
      doc.text(`Risk Level: ${r.risk_level} | MPI: ${parseFloat(r.mpi||0).toFixed(4)}`);
      doc.text(`Composite Score: ${parseFloat(r.composite_poverty_score||0).toFixed(4)}`);
      doc.text(`Health Facilities: ${r.health_facility_count || 'N/A'} | Schools: ${r.school_count || 'N/A'}`);
      doc.text(`Population Density: ${r.population_density || 'N/A'}`);
      doc.moveDown(0.5);
    } catch { /* skip */ }
  }
}
