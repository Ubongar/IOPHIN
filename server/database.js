/**
 * Database module for Node.js API
 * Provides functions to query the SQLite database
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path - using SQLite for easy setup
const DB_PATH = process.env.DATABASE_PATH || join(__dirname, '../poverty_hotspots.db');

let db = null;

/**
 * Initialize database connection
 */
export function initDatabase() {
  if (!existsSync(DB_PATH)) {
    console.warn(`⚠️  Database not found at ${DB_PATH}`);
    console.warn('   Please run the migration script first: python -m src.migrate_to_db');
    return null;
  }
  
  try {
    db = new Database(DB_PATH, { readonly: true });
    console.log(`✅ Connected to database: ${DB_PATH}`);
    return db;
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    return null;
  }
}

/**
 * Get all poverty hotspots from database
 */
export function getAllHotspots() {
  if (!db) return null;
  
  try {
    const stmt = db.prepare(`
      SELECT 
        id, lga_name, state, latitude, longitude,
        mean_nightlight_intensity, mpi, headcount_ratio,
        intensity_of_deprivation, in_severe_poverty,
        cluster, cluster_label, risk_level,
        conflict_flag, last_conflict_event,
        geometry, last_updated, data_source
      FROM poverty_hotspots
      ORDER BY lga_name
    `);
    
    return stmt.all();
  } catch (error) {
    console.error('Error querying database:', error);
    return null;
  }
}

/**
 * Get hotspots as GeoJSON
 */
export function getHotspotsAsGeoJSON() {
  const hotspots = getAllHotspots();
  
  if (!hotspots) return null;
  
  const features = hotspots.map(h => {
    // Parse geometry if it exists
    let geometry = null;
    
    if (h.geometry) {
      try {
        geometry = JSON.parse(h.geometry);
      } catch (e) {
        // If geometry parsing fails, create point from lat/lon
        if (h.latitude && h.longitude) {
          geometry = {
            type: 'Point',
            coordinates: [h.longitude, h.latitude]
          };
        }
      }
    } else if (h.latitude && h.longitude) {
      // Create point geometry from coordinates
      geometry = {
        type: 'Point',
        coordinates: [h.longitude, h.latitude]
      };
    }
    
    return {
      type: 'Feature',
      properties: {
        id: h.id,
        LGA_Name: h.lga_name,
        State: h.state,
        risk_level: h.risk_level,
        cluster_label: h.cluster_label,
        mean_nightlight_intensity: h.mean_nightlight_intensity,
        MPI: h.mpi,
        Headcount_Ratio: h.headcount_ratio,
        Intensity_of_Deprivation: h.intensity_of_deprivation,
        In_Severe_Poverty: h.in_severe_poverty,
        conflict_flag: h.conflict_flag,
        last_conflict_event: h.last_conflict_event,
        last_updated: h.last_updated,
        data_source: h.data_source
      },
      geometry: geometry
    };
  }).filter(f => f.geometry !== null);  // Only include features with valid geometry
  
  return {
    type: 'FeatureCollection',
    features: features
  };
}

/**
 * Get statistics from database
 */
export function getStatistics() {
  if (!db) return null;
  
  try {
    // Get total count
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM poverty_hotspots');
    const total = totalStmt.get();
    
    // Get risk distribution
    const riskStmt = db.prepare(`
      SELECT 
        risk_level,
        COUNT(*) as count
      FROM poverty_hotspots
      GROUP BY risk_level
    `);
    const riskData = riskStmt.all();
    
    const riskDistribution = {
      high: 0,
      medium: 0,
      low: 0,
      minimal: 0
    };
    
    riskData.forEach(row => {
      const level = (row.risk_level || '').toLowerCase();
      if (riskDistribution.hasOwnProperty(level)) {
        riskDistribution[level] = row.count;
      }
    });
    
    // Get averages
    const avgStmt = db.prepare(`
      SELECT 
        AVG(mpi) as avg_mpi,
        AVG(mean_nightlight_intensity) as avg_nightlight
      FROM poverty_hotspots
    `);
    const averages = avgStmt.get();
    
    // Get conflict count
    const conflictStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM poverty_hotspots 
      WHERE conflict_flag IN ('ALERT', 'CRITICAL')
    `);
    const conflictData = conflictStmt.get();
    
    // Get unique states count
    const statesStmt = db.prepare(`
      SELECT COUNT(DISTINCT state) as count 
      FROM poverty_hotspots
    `);
    const statesData = statesStmt.get();
    
    return {
      totalLGAs: total.count,
      riskDistribution: riskDistribution,
      averageMPI: averages.avg_mpi ? averages.avg_mpi.toFixed(4) : '0',
      averageNightlight: averages.avg_nightlight ? averages.avg_nightlight.toFixed(2) : '0',
      conflictZones: conflictData.count,
      statesCount: statesData.count,
      timestamp: new Date().toISOString(),
      dataSource: 'database'
    };
  } catch (error) {
    console.error('Error calculating statistics:', error);
    return null;
  }
}

/**
 * Get LGA by name
 */
export function getLGAByName(lgaName) {
  if (!db) return null;
  
  try {
    const stmt = db.prepare(`
      SELECT 
        id, lga_name, state, latitude, longitude,
        mean_nightlight_intensity, mpi, headcount_ratio,
        intensity_of_deprivation, in_severe_poverty,
        cluster, cluster_label, risk_level,
        conflict_flag, last_conflict_event,
        geometry, last_updated, data_source
      FROM poverty_hotspots
      WHERE lga_name = ?
    `);
    
    const result = stmt.get(lgaName);
    
    if (!result) return null;
    
    // Parse geometry if exists
    let geometry = null;
    if (result.geometry) {
      try {
        geometry = JSON.parse(result.geometry);
      } catch (e) {
        if (result.latitude && result.longitude) {
          geometry = {
            type: 'Point',
            coordinates: [result.longitude, result.latitude]
          };
        }
      }
    } else if (result.latitude && result.longitude) {
      geometry = {
        type: 'Point',
        coordinates: [result.longitude, result.latitude]
      };
    }
    
    return {
      type: 'Feature',
      properties: {
        id: result.id,
        LGA_Name: result.lga_name,
        State: result.state,
        risk_level: result.risk_level,
        cluster_label: result.cluster_label,
        mean_nightlight_intensity: result.mean_nightlight_intensity,
        MPI: result.mpi,
        Headcount_Ratio: result.headcount_ratio,
        Intensity_of_Deprivation: result.intensity_of_deprivation,
        In_Severe_Poverty: result.in_severe_poverty,
        conflict_flag: result.conflict_flag,
        last_conflict_event: result.last_conflict_event,
        last_updated: result.last_updated,
        data_source: result.data_source
      },
      geometry: geometry
    };
  } catch (error) {
    console.error('Error querying LGA:', error);
    return null;
  }
}

/**
 * Check if database is available
 */
export function isDatabaseAvailable() {
  return db !== null && existsSync(DB_PATH);
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (db) {
    db.close();
    console.log('✅ Database connection closed');
  }
}
