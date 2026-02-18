"""
Database utilities for IOPHIN system.
Handles data insertion, updates, queries, history snapshots,
filtered queries, rankings, and state aggregation.
"""
import pandas as pd
import logging
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text, func, desc, asc
import json

from .db_config import SessionLocal, PovertyHotspot, HotspotHistory, engine

logger = logging.getLogger(__name__)

# ─── Column mapping helpers ─────────────────────────────────────────────────
# Maps DataFrame column names (various case conventions) → ORM attribute names

_COL_MAP = {
    'lga_name':      ('LGA_Name', 'lganame', 'LGA_NAME'),
    'state':         ('State', 'state'),
    'latitude':      ('Latitude', 'latitude', 'lat'),
    'longitude':     ('Longitude', 'longitude', 'lng', 'lon'),
    'mean_nightlight_intensity': ('mean_nightlight_intensity',),
    'mpi':           ('MPI', 'mpi'),
    'headcount_ratio': ('Headcount_Ratio', 'headcount_ratio'),
    'intensity_of_deprivation': ('Intensity_of_Deprivation', 'intensity_of_deprivation'),
    'in_severe_poverty': ('In_Severe_Poverty', 'in_severe_poverty'),
    'vulnerable_to_poverty': ('Vulnerable_to_Poverty', 'vulnerable_to_poverty'),
    'senatorial_mpi': ('senatorial_mpi',),
    'senatorial_headcount': ('senatorial_headcount',),
    'senatorial_intensity': ('senatorial_intensity',),
    'population_density': ('population_density',),
    'health_facility_count': ('health_facility_count',),
    'school_count': ('school_count',),
    'road_density_km': ('road_density_km',),
    'ndvi_mean': ('ndvi_mean',),
    'rainfall_mm': ('rainfall_mm',),
    'distance_to_urban_km': ('distance_to_urban_km',),
    'idp_count': ('idp_count',),
    'food_price_index': ('food_price_index',),
    'composite_poverty_score': ('composite_poverty_score',),
    'cluster': ('cluster',),
    'cluster_label': ('cluster_label',),
    'risk_level': ('risk_level',),
    'clustering_method': ('clustering_method',),
    'conflict_flag': ('conflict_flag',),
    'geometry': ('geometry',),
}

_INT_COLS = {'cluster', 'health_facility_count', 'school_count', 'idp_count'}


def _resolve(row, aliases):
    """Pick the first non-None value from a row using a list of possible column names."""
    for alias in aliases:
        v = row.get(alias)
        if v is not None:
            return v
    return None


# ─── Upsert ──────────────────────────────────────────────────────────────────

def upsert_hotspots_from_dataframe(df, data_source='ML_MODEL', batch_size=50):
    """
    Insert or update poverty hotspot data from a DataFrame.
    Uses batch commits for efficiency while maintaining error isolation.

    Args:
        df: DataFrame with poverty hotspot data
        data_source: Source identifier (ML_MODEL, API_REFRESH, CONFLICT_API)
        batch_size: Number of records to commit in each batch (default: 50)

    Returns:
        int: Number of records upserted
    """
    logger.info(f"Upserting {len(df)} records from {data_source} (batch size: {batch_size})")

    session = SessionLocal()
    upserted_count = 0
    errors = 0
    batch_count = 0

    try:
        for idx, row in df.iterrows():
            lga_name = None
            try:
                lga_name = _resolve(row, ('LGA_Name', 'lganame', 'LGA_NAME'))

                if not lga_name:
                    logger.warning(f"Skipping row {idx}: No LGA name found")
                    continue

                state_val = _resolve(row, ('State', 'state'))
                if state_val:
                    existing = session.query(PovertyHotspot).filter_by(lga_name=lga_name, state=state_val).first()
                else:
                    existing = session.query(PovertyHotspot).filter_by(lga_name=lga_name).first()

                # Build data dict from column map
                data = {}
                for orm_col, aliases in _COL_MAP.items():
                    data[orm_col] = _resolve(row, aliases)

                # Overwrite identifiers
                data['lga_name'] = lga_name
                data['last_updated'] = datetime.now(timezone.utc)
                data['data_source'] = data_source
                data.setdefault('conflict_flag', 'NORMAL')

                # Clean None / numpy types
                cleaned = {}
                for k, v in data.items():
                    if v is None or (isinstance(v, float) and pd.isna(v)):
                        cleaned[k] = None
                    elif k in _INT_COLS:
                        try:
                            cleaned[k] = int(v)
                        except (ValueError, TypeError):
                            cleaned[k] = None
                    elif isinstance(v, (int, float)) and k not in ('last_updated', 'data_source', 'lga_name',
                                                                     'state', 'cluster_label', 'risk_level',
                                                                     'conflict_flag', 'geometry', 'clustering_method'):
                        cleaned[k] = float(v)
                    else:
                        cleaned[k] = v

                if existing:
                    for key, value in cleaned.items():
                        if key != 'lga_name':
                            setattr(existing, key, value)
                    logger.debug(f"Updated: {lga_name}")
                else:
                    new_record = PovertyHotspot(**cleaned)
                    session.add(new_record)
                    logger.debug(f"Inserted: {lga_name}")

                upserted_count += 1
                batch_count += 1

                if batch_count >= batch_size:
                    session.commit()
                    logger.debug(f"Committed batch of {batch_count} records")
                    batch_count = 0

            except Exception as e:
                session.rollback()
                errors += 1
                logger.warning(f"Error upserting {lga_name or f'row {idx}'}: {str(e)}")
                batch_count = 0
                continue

        if batch_count > 0:
            session.commit()
            logger.debug(f"Committed final batch of {batch_count} records")

        if errors > 0:
            logger.warning(f"⚠️  {errors} records had errors and were skipped")

        logger.info(f"✅ Successfully upserted {upserted_count} records")

    except Exception as e:
        session.rollback()
        logger.error(f"Error upserting data: {str(e)}", exc_info=True)
        raise
    finally:
        session.close()

    return upserted_count


# ─── Conflict flags ──────────────────────────────────────────────────────────

def upsert_conflict_flag(lga_name, conflict_flag='CRITICAL', last_conflict_event=None):
    """
    Update conflict flag for a specific LGA.
    Levels: NORMAL → MEDIUM → HIGH → CRITICAL
    """
    logger.info(f"Updating conflict flag for {lga_name}: {conflict_flag}")
    session = SessionLocal()

    try:
        lga = session.query(PovertyHotspot).filter_by(lga_name=lga_name).first()

        if lga:
            lga.conflict_flag = conflict_flag
            lga.last_conflict_event = last_conflict_event or datetime.now(timezone.utc)
            lga.last_updated = datetime.now(timezone.utc)
            lga.data_source = 'CONFLICT_API'

            # Elevate risk level for critical conflict zones
            if conflict_flag == 'CRITICAL' and lga.risk_level not in ('Critical', 'High'):
                logger.warning(f"Elevating risk level for {lga_name} due to conflict")
                lga.risk_level = 'Critical'
                lga.cluster_label = 'Critical - Humanitarian Emergency'

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


# ─── Queries ──────────────────────────────────────────────────────────────────

def get_all_hotspots():
    """Retrieve all poverty hotspots from database."""
    session = SessionLocal()
    try:
        hotspots = session.query(PovertyHotspot).all()
        return [h.to_dict() for h in hotspots]
    finally:
        session.close()


def get_hotspots_filtered(state=None, risk_level=None):
    """
    Retrieve hotspots with optional filters.

    Args:
        state: Filter by state name (case-insensitive partial match)
        risk_level: Filter by risk_level (exact match)

    Returns:
        list[dict]
    """
    session = SessionLocal()
    try:
        query = session.query(PovertyHotspot)

        if state:
            query = query.filter(func.lower(PovertyHotspot.state) == state.lower())
        if risk_level:
            query = query.filter(PovertyHotspot.risk_level == risk_level)

        return [h.to_dict() for h in query.all()]
    finally:
        session.close()


def _build_geojson_feature(h):
    """Build a single GeoJSON Feature dict from a PovertyHotspot row."""
    geometry = None
    if h.geometry:
        try:
            geometry = json.loads(h.geometry) if isinstance(h.geometry, str) else h.geometry
        except (json.JSONDecodeError, TypeError):
            if h.latitude and h.longitude:
                geometry = {'type': 'Point', 'coordinates': [h.longitude, h.latitude]}
    elif h.latitude and h.longitude:
        geometry = {'type': 'Point', 'coordinates': [h.longitude, h.latitude]}

    if not geometry:
        return None

    return {
        'type': 'Feature',
        'properties': {
            'LGA_Name': h.lga_name,
            'State': h.state,
            'risk_level': h.risk_level,
            'cluster_label': h.cluster_label,
            'mean_nightlight_intensity': h.mean_nightlight_intensity,
            'MPI': h.mpi,
            'Headcount_Ratio': h.headcount_ratio,
            'composite_poverty_score': h.composite_poverty_score,
            'population_density': h.population_density,
            'health_facility_count': h.health_facility_count,
            'school_count': h.school_count,
            'ndvi_mean': h.ndvi_mean,
            'rainfall_mm': h.rainfall_mm,
            'food_price_index': h.food_price_index,
            'idp_count': h.idp_count,
            'conflict_flag': h.conflict_flag,
            'clustering_method': h.clustering_method,
            'last_updated': h.last_updated.isoformat() if h.last_updated else None,
        },
        'geometry': geometry,
    }


def get_hotspots_as_geojson(state=None, risk_level=None):
    """
    Retrieve poverty hotspots as GeoJSON FeatureCollection.
    Supports optional state / risk_level filters.
    """
    session = SessionLocal()
    try:
        query = session.query(PovertyHotspot)
        if state:
            query = query.filter(func.lower(PovertyHotspot.state) == state.lower())
        if risk_level:
            query = query.filter(PovertyHotspot.risk_level == risk_level)

        features = []
        for h in query.all():
            f = _build_geojson_feature(h)
            if f:
                features.append(f)

        return {'type': 'FeatureCollection', 'features': features}
    finally:
        session.close()


def get_statistics():
    """
    Calculate statistics from database.
    Includes statesCount and new enrichment averages.
    """
    session = SessionLocal()
    try:
        total = session.query(PovertyHotspot).count()

        # Count by risk level (include Critical tier)
        risk_counts = {}
        for rl in ['Critical', 'High', 'Medium', 'Low', 'Minimal']:
            count = session.query(PovertyHotspot).filter_by(risk_level=rl).count()
            risk_counts[rl.lower()] = count

        # Calculate averages
        result = session.execute(text("""
            SELECT
                AVG(mpi) as avg_mpi,
                AVG(mean_nightlight_intensity) as avg_nightlight,
                AVG(composite_poverty_score) as avg_composite,
                COUNT(DISTINCT state) as states_count
            FROM poverty_hotspots
        """))
        row = result.fetchone()

        # Count conflict zones
        conflict_count = session.query(PovertyHotspot).filter(
            PovertyHotspot.conflict_flag.in_(['MEDIUM', 'HIGH', 'CRITICAL'])
        ).count()

        return {
            'totalLGAs': total,
            'statesCount': row[3] if row[3] else 0,
            'riskDistribution': risk_counts,
            'averageMPI': f"{row[0]:.4f}" if row[0] else '0',
            'averageNightlight': f"{row[1]:.2f}" if row[1] else '0',
            'averageCompositeScore': f"{row[2]:.4f}" if row[2] else '0',
            'conflictZones': conflict_count,
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }
    finally:
        session.close()


# ─── State aggregation ────────────────────────────────────────────────────────

def get_state_aggregation():
    """
    Aggregate hotspot data per state.
    Returns list of {state, lga_count, avg_mpi, avg_composite, risk_distribution}.
    """
    session = SessionLocal()
    try:
        states_raw = session.execute(text("""
            SELECT
                state,
                COUNT(*) as lga_count,
                AVG(mpi) as avg_mpi,
                AVG(composite_poverty_score) as avg_composite,
                AVG(mean_nightlight_intensity) as avg_nightlight,
                SUM(CASE WHEN risk_level = 'Critical' THEN 1 ELSE 0 END) as critical_count,
                SUM(CASE WHEN risk_level = 'High' THEN 1 ELSE 0 END) as high_count,
                SUM(CASE WHEN risk_level = 'Medium' THEN 1 ELSE 0 END) as medium_count,
                SUM(CASE WHEN risk_level = 'Low' THEN 1 ELSE 0 END) as low_count,
                SUM(CASE WHEN risk_level = 'Minimal' THEN 1 ELSE 0 END) as minimal_count
            FROM poverty_hotspots
            WHERE state IS NOT NULL
            GROUP BY state
            ORDER BY avg_composite DESC
        """))

        results = []
        for r in states_raw:
            results.append({
                'state': r[0],
                'lgaCount': r[1],
                'averageMPI': round(r[2], 4) if r[2] else 0,
                'averageCompositeScore': round(r[3], 4) if r[3] else 0,
                'averageNightlight': round(r[4], 2) if r[4] else 0,
                'riskDistribution': {
                    'critical': r[5] or 0,
                    'high': r[6] or 0,
                    'medium': r[7] or 0,
                    'low': r[8] or 0,
                    'minimal': r[9] or 0,
                },
            })
        return results
    finally:
        session.close()


# ─── Rankings ─────────────────────────────────────────────────────────────────

def get_rankings(order='worst', limit=10):
    """
    Return top-N LGAs ranked by composite poverty score.

    Args:
        order: 'worst' (highest poverty) or 'best' (lowest poverty)
        limit: number of results

    Returns:
        list[dict]
    """
    session = SessionLocal()
    try:
        query = session.query(PovertyHotspot).filter(
            PovertyHotspot.composite_poverty_score.isnot(None)
        )

        if order == 'worst':
            query = query.order_by(desc(PovertyHotspot.composite_poverty_score))
        else:
            query = query.order_by(asc(PovertyHotspot.composite_poverty_score))

        results = []
        for rank, h in enumerate(query.limit(limit).all(), start=1):
            results.append({
                'rank': rank,
                'LGA_Name': h.lga_name,
                'State': h.state,
                'composite_poverty_score': h.composite_poverty_score,
                'risk_level': h.risk_level,
                'MPI': h.mpi,
                'mean_nightlight_intensity': h.mean_nightlight_intensity,
                'conflict_flag': h.conflict_flag,
            })
        return results
    finally:
        session.close()


# ─── History / Snapshots ──────────────────────────────────────────────────────

def save_history_snapshot():
    """
    Take a snapshot of all current hotspot data and store in history table.
    Call this after each ML retrain cycle.
    """
    session = SessionLocal()
    now = datetime.now(timezone.utc)
    inserted = 0

    try:
        hotspots = session.query(PovertyHotspot).all()

        for h in hotspots:
            snapshot = HotspotHistory(
                snapshot_date=now,
                lga_name=h.lga_name,
                state=h.state,
                mean_nightlight_intensity=h.mean_nightlight_intensity,
                mpi=h.mpi,
                composite_poverty_score=h.composite_poverty_score,
                risk_level=h.risk_level,
                cluster_label=h.cluster_label,
                conflict_flag=h.conflict_flag,
                population_density=h.population_density,
                health_facility_count=h.health_facility_count,
                school_count=h.school_count,
                ndvi_mean=h.ndvi_mean,
                rainfall_mm=h.rainfall_mm,
                food_price_index=h.food_price_index,
                idp_count=h.idp_count,
                data_source=h.data_source,
            )
            session.add(snapshot)
            inserted += 1

        session.commit()
        logger.info(f"✅ History snapshot saved: {inserted} records at {now.isoformat()}")
    except Exception as e:
        session.rollback()
        logger.error(f"Error saving history snapshot: {str(e)}", exc_info=True)
        raise
    finally:
        session.close()

    return inserted


def get_history_for_lga(lga_name, limit=50):
    """
    Get historical snapshots for a specific LGA.

    Args:
        lga_name: LGA name (exact match)
        limit: max records to return

    Returns:
        list[dict]: Snapshots ordered by date descending
    """
    session = SessionLocal()
    try:
        query = (
            session.query(HotspotHistory)
            .filter_by(lga_name=lga_name)
            .order_by(desc(HotspotHistory.snapshot_date))
            .limit(limit)
        )
        return [s.to_dict() for s in query.all()]
    finally:
        session.close()


# ─── Migration ────────────────────────────────────────────────────────────────

def migrate_from_geojson(geojson_path):
    """
    Migrate existing GeoJSON data to the database.
    One-time operation to populate database from static files.
    """
    import geopandas as gpd

    logger.info(f"Migrating data from {geojson_path}")

    gdf = gpd.read_file(geojson_path)

    df = pd.DataFrame(gdf.drop(columns='geometry'))
    df['geometry'] = gdf['geometry'].apply(lambda x: json.dumps(x.__geo_interface__) if x else None)

    count = upsert_hotspots_from_dataframe(df, data_source='MIGRATION')
    logger.info(f"✅ Migration complete: {count} records")
    return count


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    from .db_config import init_database
    init_database()

    stats = get_statistics()
    print(f"Database statistics: {stats}")
