"""
Database utilities for IOPHIN system.
Handles data insertion, updates, and queries.
"""
import pandas as pd
import logging
from datetime import datetime
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
import json

from .db_config import SessionLocal, PovertyHotspot, engine

logger = logging.getLogger(__name__)


def upsert_hotspots_from_dataframe(df, data_source='ML_MODEL'):
    """
    Insert or update poverty hotspot data from a DataFrame.
    
    Args:
        df: DataFrame with poverty hotspot data
        data_source: Source identifier (ML_MODEL, API_REFRESH, CONFLICT_API)
    
    Returns:
        int: Number of records upserted
    """
    logger.info(f"Upserting {len(df)} records from {data_source}")
    
    session = SessionLocal()
    upserted_count = 0
    
    try:
        for idx, row in df.iterrows():
            # Extract LGA name
            lga_name = row.get('LGA_Name', row.get('lganame', row.get('LGA_NAME')))
            
            if not lga_name:
                logger.warning(f"Skipping row {idx}: No LGA name found")
                continue
            
            # Check if record exists
            existing = session.query(PovertyHotspot).filter_by(lga_name=lga_name).first()
            
            # Prepare data
            data = {
                'lga_name': lga_name,
                'state': row.get('State', row.get('state')),
                'latitude': row.get('Latitude', row.get('latitude')),
                'longitude': row.get('Longitude', row.get('longitude')),
                'mean_nightlight_intensity': row.get('mean_nightlight_intensity'),
                'mpi': row.get('MPI', row.get('mpi')),
                'headcount_ratio': row.get('Headcount_Ratio', row.get('headcount_ratio')),
                'intensity_of_deprivation': row.get('Intensity_of_Deprivation', row.get('intensity_of_deprivation')),
                'in_severe_poverty': row.get('In_Severe_Poverty', row.get('in_severe_poverty')),
                'vulnerable_to_poverty': row.get('Vulnerable_to_Poverty', row.get('vulnerable_to_poverty')),
                'cluster': int(row.get('cluster')) if pd.notna(row.get('cluster')) else None,
                'cluster_label': row.get('cluster_label'),
                'risk_level': row.get('risk_level'),
                'conflict_flag': row.get('conflict_flag', 'NORMAL'),
                'geometry': row.get('geometry'),
                'last_updated': datetime.utcnow(),
                'data_source': data_source
            }
            
            # Clean None values and convert numpy types
            data = {k: (None if pd.isna(v) else float(v) if isinstance(v, (int, float)) and k != 'cluster' else v) 
                   for k, v in data.items()}
            
            if existing:
                # Update existing record
                for key, value in data.items():
                    if key != 'lga_name':  # Don't update the primary key
                        setattr(existing, key, value)
                logger.debug(f"Updated: {lga_name}")
            else:
                # Insert new record
                new_record = PovertyHotspot(**data)
                session.add(new_record)
                logger.debug(f"Inserted: {lga_name}")
            
            upserted_count += 1
        
        # Commit all changes
        session.commit()
        logger.info(f"✅ Successfully upserted {upserted_count} records")
        
    except Exception as e:
        session.rollback()
        logger.error(f"Error upserting data: {str(e)}", exc_info=True)
        raise
    finally:
        session.close()
    
    return upserted_count


def upsert_conflict_flag(lga_name, conflict_flag='CRITICAL', last_conflict_event=None):
    """
    Update conflict flag for a specific LGA.
    Used when conflict/shock events are detected.
    
    Args:
        lga_name: Name of the LGA
        conflict_flag: Status (NORMAL, ALERT, CRITICAL)
        last_conflict_event: DateTime of the event
    """
    logger.info(f"Updating conflict flag for {lga_name}: {conflict_flag}")
    
    session = SessionLocal()
    
    try:
        # Find the LGA
        lga = session.query(PovertyHotspot).filter_by(lga_name=lga_name).first()
        
        if lga:
            lga.conflict_flag = conflict_flag
            lga.last_conflict_event = last_conflict_event or datetime.utcnow()
            lga.last_updated = datetime.utcnow()
            lga.data_source = 'CONFLICT_API'
            
            # If conflict is critical, elevate risk level
            if conflict_flag == 'CRITICAL' and lga.risk_level != 'High':
                logger.warning(f"Elevating risk level for {lga_name} due to conflict")
                lga.risk_level = 'High'
                lga.cluster_label = 'High Risk - Conflict Zone'
            
            session.commit()
            logger.info(f"✅ Updated conflict flag for {lga_name}")
        else:
            logger.warning(f"LGA not found: {lga_name}")
    
    except Exception as e:
        session.rollback()
        logger.error(f"Error updating conflict flag: {str(e)}", exc_info=True)
        raise
    finally:
        session.close()


def get_all_hotspots():
    """
    Retrieve all poverty hotspots from database.
    
    Returns:
        list: List of dictionaries with hotspot data
    """
    session = SessionLocal()
    
    try:
        hotspots = session.query(PovertyHotspot).all()
        return [h.to_dict() for h in hotspots]
    finally:
        session.close()


def get_hotspots_as_geojson():
    """
    Retrieve all poverty hotspots as GeoJSON format.
    
    Returns:
        dict: GeoJSON FeatureCollection
    """
    session = SessionLocal()
    
    try:
        hotspots = session.query(PovertyHotspot).all()
        
        features = []
        for h in hotspots:
            # Parse geometry if it exists
            geometry = None
            if h.geometry:
                try:
                    geometry = json.loads(h.geometry) if isinstance(h.geometry, str) else h.geometry
                except:
                    # If geometry is not valid JSON, create a point from lat/lon
                    if h.latitude and h.longitude:
                        geometry = {
                            'type': 'Point',
                            'coordinates': [h.longitude, h.latitude]
                        }
            elif h.latitude and h.longitude:
                # Create point geometry from coordinates
                geometry = {
                    'type': 'Point',
                    'coordinates': [h.longitude, h.latitude]
                }
            
            if geometry:
                feature = {
                    'type': 'Feature',
                    'properties': {
                        'LGA_Name': h.lga_name,
                        'State': h.state,
                        'risk_level': h.risk_level,
                        'cluster_label': h.cluster_label,
                        'mean_nightlight_intensity': h.mean_nightlight_intensity,
                        'MPI': h.mpi,
                        'Headcount_Ratio': h.headcount_ratio,
                        'conflict_flag': h.conflict_flag,
                        'last_updated': h.last_updated.isoformat() if h.last_updated else None
                    },
                    'geometry': geometry
                }
                features.append(feature)
        
        return {
            'type': 'FeatureCollection',
            'features': features
        }
    finally:
        session.close()


def get_statistics():
    """
    Calculate statistics from database.
    
    Returns:
        dict: Statistics summary
    """
    session = SessionLocal()
    
    try:
        total = session.query(PovertyHotspot).count()
        
        # Count by risk level
        risk_counts = {}
        for risk_level in ['High', 'Medium', 'Low', 'Minimal']:
            count = session.query(PovertyHotspot).filter_by(risk_level=risk_level).count()
            risk_counts[risk_level.lower()] = count
        
        # Calculate averages
        result = session.execute(text("""
            SELECT 
                AVG(mpi) as avg_mpi,
                AVG(mean_nightlight_intensity) as avg_nightlight
            FROM poverty_hotspots
        """))
        row = result.fetchone()
        
        # Count conflict zones
        conflict_count = session.query(PovertyHotspot).filter(
            PovertyHotspot.conflict_flag.in_(['ALERT', 'CRITICAL'])
        ).count()
        
        return {
            'totalLGAs': total,
            'riskDistribution': risk_counts,
            'averageMPI': f"{row[0]:.4f}" if row[0] else '0',
            'averageNightlight': f"{row[1]:.2f}" if row[1] else '0',
            'conflictZones': conflict_count,
            'timestamp': datetime.utcnow().isoformat()
        }
    finally:
        session.close()


def migrate_from_geojson(geojson_path):
    """
    Migrate existing GeoJSON data to the database.
    One-time operation to populate database from static files.
    
    Args:
        geojson_path: Path to the GeoJSON file
    """
    import geopandas as gpd
    
    logger.info(f"Migrating data from {geojson_path}")
    
    # Read GeoJSON
    gdf = gpd.read_file(geojson_path)
    
    # Convert to DataFrame and add geometry as text
    df = pd.DataFrame(gdf.drop(columns='geometry'))
    df['geometry'] = gdf['geometry'].apply(lambda x: json.dumps(x.__geo_interface__) if x else None)
    
    # Upsert to database
    count = upsert_hotspots_from_dataframe(df, data_source='MIGRATION')
    
    logger.info(f"✅ Migration complete: {count} records")
    return count


if __name__ == "__main__":
    # Test database operations
    logging.basicConfig(level=logging.INFO)
    
    # Initialize database
    from .db_config import init_database
    init_database()
    
    # Test query
    stats = get_statistics()
    print(f"Database statistics: {stats}")
