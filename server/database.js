/**
 * Database Module - PostgreSQL Version
 * Connects to the live iophin_db to serve real-time data.
 */
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { Pool } = pg;

// Database connection configuration
// checks if DATABASE_URL is set, otherwise warns the user
if (!process.env.DATABASE_URL) {
  console.error("❌ Error: DATABASE_URL is missing from .env file");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL is usually needed for production cloud DBs, but often disabled for local
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

let isConnected = false;

/**
 * Initialize the database connection
 */
export async function initDatabase() {
  try {
    // Test the connection
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database successfully');
    isConnected = true;
    client.release();
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL:', error.message);
    isConnected = false;
  }
}

/**
 * Check if database is currently available
 */
export function isDatabaseAvailable() {
  return isConnected;
}

/**
 * Helper to parse geometry safely
 */
function parseGeometry(geom) {
  if (!geom) return null;
  try {
    // If it's already an object, return it. If string, parse it.
    return typeof geom === 'string' ? JSON.parse(geom) : geom;
  } catch (e) {
    return null;
  }
}

/**
 * Get all hotspots and convert to GeoJSON format
 */
export async function getHotspotsAsGeoJSON() {
  if (!isConnected) return null;

  try {
    const client = await pool.connect();
    // Fetch all rows
    const result = await client.query('SELECT * FROM poverty_hotspots');
    client.release();

    // Convert SQL rows to GeoJSON Features
    const features = result.rows.map(row => {
      const geometry = parseGeometry(row.geometry);

      // Only include if geometry is valid
      if (!geometry) return null;

      return {
        type: "Feature",
        properties: {
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
          data_source: row.data_source
        },
        geometry: geometry
      };
    }).filter(f => f !== null);

    return {
      type: "FeatureCollection",
      features: features
    };

  } catch (error) {
    console.error('Error fetching hotspots:', error);
    return null;
  }
}

/**
 * Get summary statistics directly from SQL
 */
export async function getStatistics() {
  if (!isConnected) return null;

  try {
    const client = await pool.connect();
    
    // 1. Get basic counts and averages
    // We use LOWER() on risk_level to match your previous logic
    const statsQuery = `
      SELECT 
        COUNT(*) as total_lgas,
        AVG(mpi) as avg_mpi,
        AVG(mean_nightlight_intensity) as avg_nightlight,
        COUNT(DISTINCT state) as states_count
      FROM poverty_hotspots
    `;
    const statsResult = await client.query(statsQuery);
    const stats = statsResult.rows[0];

    // 2. Get Risk Distribution
    const riskQuery = `
    SELECT risk_level, COUNT(*) as count
    FROM poverty_hotspots
    GROUP BY risk_level
    `;
    const riskResult = await client.query(riskQuery);
    
    const riskDist = { high: 0, medium: 0, low: 0, minimal: 0 };
    riskResult.rows.forEach(row => {
      const level = (row.risk_level || '').toLowerCase();
      if (riskDist.hasOwnProperty(level)) {
        riskDist[level] = parseInt(row.count);
      }
    });

    // 3. Get Conflict Zones count
    const conflictQuery = `
      SELECT COUNT(*) as count 
      FROM poverty_hotspots 
      WHERE conflict_flag IN ('ALERT', 'CRITICAL')
    `;
    const conflictResult = await client.query(conflictQuery);

    client.release();

    return {
      totalLGAs: parseInt(stats.total_lgas),
      riskDistribution: riskDist,
      averageMPI: parseFloat(stats.avg_mpi || 0).toFixed(4),
      averageNightlight: parseFloat(stats.avg_nightlight || 0).toFixed(2),
      conflictZones: parseInt(conflictResult.rows[0].count),
      statesCount: parseInt(stats.states_count),
      timestamp: new Date().toISOString(),
      dataSource: 'database (PostgreSQL)'
    };

  } catch (error) {
    console.error('Error fetching stats:', error);
    return null;
  }
}

/**
 * Get a specific LGA by name
 */
export async function getLGAByName(lgaName) {
  if (!isConnected) return null;

  try {
    const client = await pool.connect();
    // Use parameterized query ($1) to prevent SQL Injection
    const result = await client.query('SELECT * FROM poverty_hotspots WHERE lga_name = $1', [lgaName]);
    client.release();

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const geometry = parseGeometry(row.geometry);

    return {
      type: "Feature",
      properties: {
        id: row.id,
        LGA_Name: row.lga_name,
        State: row.state,
        risk_level: row.risk_level,
        cluster_label: row.cluster_label,
        mean_nightlight_intensity: row.mean_nightlight_intensity,
        MPI: row.mpi,
        Headcount_Ratio: row.headcount_ratio,
        Intensity_of_Deprivation: row.intensity_of_deprivation,
        In_Severe_Poverty: row.in_severe_poverty,
        conflict_flag: row.conflict_flag,
        last_conflict_event: row.last_conflict_event,
        last_updated: row.last_updated,
        data_source: row.data_source
      },
      geometry: geometry
    };

  } catch (error) {
    console.error('Error fetching LGA:', error);
    return null;
  }
}

/**
 * Close the database pool
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    console.log('✅ PostgreSQL connection closed.');
  }
}