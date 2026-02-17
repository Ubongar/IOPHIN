/**
 * Database Module - PostgreSQL Version (v2)
 * Connects to the live iophin_db to serve real-time data.
 * Supports: filtering, state aggregation, history, rankings.
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("❌ Error: DATABASE_URL is missing from .env file");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

let isConnected = false;

// ── Helpers ────────────────────────────────────────────────────────────────

function parseGeometry(geom) {
  if (!geom) return null;
  try {
    return typeof geom === 'string' ? JSON.parse(geom) : geom;
  } catch { return null; }
}

function rowToProperties(row) {
  return {
    id: row.id,
    LGA_Name: row.lga_name,
    State: row.state,
    MPI: row.mpi,
    mean_nightlight_intensity: row.mean_nightlight_intensity,
    risk_level: row.risk_level,
    cluster_label: row.cluster_label,
    Headcount_Ratio: row.headcount_ratio,
    Intensity_of_Deprivation: row.intensity_of_deprivation,
    In_Severe_Poverty: row.in_severe_poverty,
    conflict_flag: row.conflict_flag,
    last_conflict_event: row.last_conflict_event,
    last_updated: row.last_updated,
    data_source: row.data_source,
    // New v2 properties
    composite_poverty_score: row.composite_poverty_score,
    population_density: row.population_density,
    health_facility_count: row.health_facility_count,
    school_count: row.school_count,
    road_density_km: row.road_density_km,
    ndvi_mean: row.ndvi_mean,
    rainfall_mm: row.rainfall_mm,
    distance_to_urban_km: row.distance_to_urban_km,
    idp_count: row.idp_count,
    food_price_index: row.food_price_index,
    senatorial_mpi: row.senatorial_mpi,
    clustering_method: row.clustering_method,
  };
}

function rowToFeature(row) {
  const geometry = parseGeometry(row.geometry);
  if (!geometry) return null;
  return { type: "Feature", properties: rowToProperties(row), geometry };
}

// ── Init / Close ───────────────────────────────────────────────────────────

export async function initDatabase() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database successfully');
    isConnected = true;
    client.release();
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL:', error.message);
    isConnected = false;
  }
}

export function isDatabaseAvailable() {
  return isConnected;
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    console.log('✅ PostgreSQL connection closed.');
  }
}

// ── GeoJSON (with optional state / risk filters) ──────────────────────────

export async function getHotspotsAsGeoJSON(state = null, riskLevel = null) {
  if (!isConnected) return null;
  try {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (state) {
      conditions.push(`LOWER(state) = LOWER($${idx++})`);
      params.push(state);
    }
    if (riskLevel) {
      conditions.push(`LOWER(risk_level) = LOWER($${idx++})`);
      params.push(riskLevel);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(`SELECT * FROM poverty_hotspots ${where}`, params);

    const features = result.rows.map(rowToFeature).filter(Boolean);
    return { type: "FeatureCollection", features };
  } catch (error) {
    console.error('Error fetching hotspots:', error);
    return null;
  }
}

// ── Statistics ─────────────────────────────────────────────────────────────

export async function getStatistics() {
  if (!isConnected) return null;
  try {
    const statsResult = await pool.query(`
      SELECT
        COUNT(*)                              AS total_lgas,
        AVG(mpi)                              AS avg_mpi,
        AVG(mean_nightlight_intensity)        AS avg_nightlight,
        AVG(composite_poverty_score)          AS avg_composite,
        COUNT(DISTINCT state)                 AS states_count
      FROM poverty_hotspots
    `);
    const s = statsResult.rows[0];

    const riskResult = await pool.query(`
      SELECT risk_level, COUNT(*) AS count
      FROM poverty_hotspots GROUP BY risk_level
    `);
    const riskDist = { critical: 0, high: 0, medium: 0, low: 0, minimal: 0 };
    riskResult.rows.forEach(r => {
      const key = (r.risk_level || '').toLowerCase();
      if (key in riskDist) riskDist[key] = parseInt(r.count);
    });

    const conflictResult = await pool.query(`
      SELECT COUNT(*) AS count FROM poverty_hotspots
      WHERE conflict_flag IN ('HIGH', 'CRITICAL')
    `);

    return {
      totalLGAs: parseInt(s.total_lgas),
      riskDistribution: riskDist,
      averageMPI: parseFloat(s.avg_mpi || 0).toFixed(4),
      averageNightlight: parseFloat(s.avg_nightlight || 0).toFixed(2),
      averageCompositeScore: parseFloat(s.avg_composite || 0).toFixed(4),
      conflictZones: parseInt(conflictResult.rows[0].count),
      statesCount: parseInt(s.states_count),
      timestamp: new Date().toISOString(),
      dataSource: 'database (PostgreSQL)',
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return null;
  }
}

// ── Single LGA lookup ─────────────────────────────────────────────────────

export async function getLGAByName(lgaName) {
  if (!isConnected) return null;
  try {
    const result = await pool.query(
      'SELECT * FROM poverty_hotspots WHERE lga_name = $1', [lgaName]
    );
    if (result.rows.length === 0) return null;
    return rowToFeature(result.rows[0]);
  } catch (error) {
    console.error('Error fetching LGA:', error);
    return null;
  }
}

// ── State aggregation ─────────────────────────────────────────────────────

export async function getStateAggregation() {
  if (!isConnected) return null;
  try {
    const result = await pool.query(`
      SELECT
        state,
        COUNT(*)                              AS lga_count,
        AVG(mpi)                              AS avg_mpi,
        AVG(mean_nightlight_intensity)        AS avg_nightlight,
        AVG(composite_poverty_score)          AS avg_composite,
        SUM(CASE WHEN LOWER(risk_level) IN ('high','critical') THEN 1 ELSE 0 END) AS high_risk_count,
        AVG(population_density)               AS avg_population_density,
        SUM(health_facility_count)            AS total_health_facilities,
        SUM(school_count)                     AS total_schools
      FROM poverty_hotspots
      GROUP BY state
      ORDER BY avg_composite DESC NULLS LAST
    `);
    return result.rows.map(r => ({
      state: r.state,
      lgaCount: parseInt(r.lga_count),
      avgMPI: parseFloat(r.avg_mpi || 0),
      avgNightlight: parseFloat(r.avg_nightlight || 0),
      avgCompositeScore: parseFloat(r.avg_composite || 0),
      highRiskCount: parseInt(r.high_risk_count),
      avgPopulationDensity: parseFloat(r.avg_population_density || 0),
      totalHealthFacilities: parseInt(r.total_health_facilities || 0),
      totalSchools: parseInt(r.total_schools || 0),
    }));
  } catch (error) {
    console.error('Error fetching state aggregation:', error);
    return null;
  }
}

// ── History for an LGA (time-series) ──────────────────────────────────────

export async function getHistoryForLGA(lgaName, limit = 30) {
  if (!isConnected) return null;
  try {
    const result = await pool.query(`
      SELECT snapshot_date, lga_name, state, mpi,
             mean_nightlight_intensity, composite_poverty_score,
             risk_level, conflict_flag
      FROM hotspot_history
      WHERE lga_name = $1
      ORDER BY snapshot_date DESC
      LIMIT $2
    `, [lgaName, limit]);
    return result.rows.map(r => ({
      date: r.snapshot_date,
      lgaName: r.lga_name,
      state: r.state,
      mpi: parseFloat(r.mpi || 0),
      nightlight: parseFloat(r.mean_nightlight_intensity || 0),
      compositeScore: parseFloat(r.composite_poverty_score || 0),
      riskLevel: r.risk_level,
      conflictFlag: r.conflict_flag,
    }));
  } catch (error) {
    console.error('Error fetching history:', error);
    return null;
  }
}

// ── Rankings (top-N worst or best LGAs) ───────────────────────────────────

export async function getRankings(order = 'worst', limit = 20) {
  if (!isConnected) return null;
  try {
    const dir = order === 'best' ? 'ASC' : 'DESC';
    const result = await pool.query(`
      SELECT lga_name, state, mpi, mean_nightlight_intensity,
             composite_poverty_score, risk_level, cluster_label,
             population_density, health_facility_count, school_count
      FROM poverty_hotspots
      WHERE composite_poverty_score IS NOT NULL
      ORDER BY composite_poverty_score ${dir}
      LIMIT $1
    `, [limit]);
    return result.rows.map((r, i) => ({
      rank: i + 1,
      lgaName: r.lga_name,
      state: r.state,
      mpi: parseFloat(r.mpi || 0),
      nightlight: parseFloat(r.mean_nightlight_intensity || 0),
      compositeScore: parseFloat(r.composite_poverty_score || 0),
      riskLevel: r.risk_level,
      clusterLabel: r.cluster_label,
      populationDensity: parseFloat(r.population_density || 0),
      healthFacilities: parseInt(r.health_facility_count || 0),
      schools: parseInt(r.school_count || 0),
    }));
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return null;
  }
}