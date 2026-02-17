"""
Database configuration for the IOPHIN system.
Handles PostgreSQL/PostGIS connection and table schema.
"""
import os
from pathlib import Path
from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, Text, Index, text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

# Database URL from environment variable or default to SQLite for testing
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'sqlite:///./poverty_hotspots.db'  # Fallback to SQLite for easy setup
)

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL, echo=False)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for ORM models
Base = declarative_base()


class PovertyHotspot(Base):
    """
    ORM Model for poverty hotspots table.
    Stores the latest state of each LGA's poverty indicators.
    """
    __tablename__ = "poverty_hotspots"
    
    id = Column(Integer, primary_key=True, index=True)
    lga_name = Column(String(255), unique=True, index=True, nullable=False)
    state = Column(String(100), index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    
    # Nightlight data
    mean_nightlight_intensity = Column(Float)
    
    # Poverty indicators (state-level)
    mpi = Column(Float)
    headcount_ratio = Column(Float)
    intensity_of_deprivation = Column(Float)
    in_severe_poverty = Column(Float)
    vulnerable_to_poverty = Column(Float)
    
    # Senatorial-level poverty (more granular)
    senatorial_mpi = Column(Float)
    senatorial_headcount = Column(Float)
    senatorial_intensity = Column(Float)
    
    # New enrichment features
    population_density = Column(Float)          # WorldPop people/km²
    health_facility_count = Column(Integer)     # GRID3 count per LGA
    school_count = Column(Integer)              # GRID3 count per LGA
    road_density_km = Column(Float)             # OSM km of road per km²
    ndvi_mean = Column(Float)                   # MODIS vegetation index
    rainfall_mm = Column(Float)                 # CHIRPS monthly rainfall
    distance_to_urban_km = Column(Float)        # GHS-SMOD remoteness
    idp_count = Column(Integer)                 # IOM DTM displaced persons
    food_price_index = Column(Float)            # WFP food price index
    
    # Composite score (weighted combination of all indicators)
    composite_poverty_score = Column(Float)
    
    # Cluster analysis results
    cluster = Column(Integer)
    cluster_label = Column(String(100))
    risk_level = Column(String(50), index=True)
    clustering_method = Column(String(50), default='kmeans')  # kmeans or hdbscan
    
    # Conflict/shock indicators
    conflict_flag = Column(String(50), default='NORMAL')  # NORMAL, MEDIUM, HIGH, CRITICAL
    last_conflict_event = Column(DateTime, nullable=True)
    
    # GeoJSON geometry (stored as text)
    geometry = Column(Text, nullable=True)
    
    # Metadata
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    data_source = Column(String(100), default='ML_MODEL')
    
    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            'id': self.id,
            'LGA_Name': self.lga_name,
            'State': self.state,
            'Latitude': self.latitude,
            'Longitude': self.longitude,
            'mean_nightlight_intensity': self.mean_nightlight_intensity,
            'MPI': self.mpi,
            'Headcount_Ratio': self.headcount_ratio,
            'Intensity_of_Deprivation': self.intensity_of_deprivation,
            'In_Severe_Poverty': self.in_severe_poverty,
            'Vulnerable_to_Poverty': self.vulnerable_to_poverty,
            'senatorial_mpi': self.senatorial_mpi,
            'senatorial_headcount': self.senatorial_headcount,
            'senatorial_intensity': self.senatorial_intensity,
            'population_density': self.population_density,
            'health_facility_count': self.health_facility_count,
            'school_count': self.school_count,
            'road_density_km': self.road_density_km,
            'ndvi_mean': self.ndvi_mean,
            'rainfall_mm': self.rainfall_mm,
            'distance_to_urban_km': self.distance_to_urban_km,
            'idp_count': self.idp_count,
            'food_price_index': self.food_price_index,
            'composite_poverty_score': self.composite_poverty_score,
            'cluster': self.cluster,
            'cluster_label': self.cluster_label,
            'risk_level': self.risk_level,
            'clustering_method': self.clustering_method,
            'conflict_flag': self.conflict_flag,
            'last_conflict_event': self.last_conflict_event.isoformat() if self.last_conflict_event else None,
            'geometry': self.geometry,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None,
            'data_source': self.data_source
        }


class HotspotHistory(Base):
    """
    Historical snapshots of poverty hotspot data.
    A new row is inserted for each LGA on every ML retrain cycle.
    Enables time-series analysis and trend detection.
    """
    __tablename__ = "hotspot_history"
    
    id = Column(Integer, primary_key=True, index=True)
    snapshot_date = Column(DateTime, nullable=False, index=True)
    lga_name = Column(String(255), nullable=False, index=True)
    state = Column(String(100))
    
    mean_nightlight_intensity = Column(Float)
    mpi = Column(Float)
    composite_poverty_score = Column(Float)
    risk_level = Column(String(50))
    cluster_label = Column(String(100))
    conflict_flag = Column(String(50))
    population_density = Column(Float)
    health_facility_count = Column(Integer)
    school_count = Column(Integer)
    ndvi_mean = Column(Float)
    rainfall_mm = Column(Float)
    food_price_index = Column(Float)
    idp_count = Column(Integer)
    data_source = Column(String(100))
    
    __table_args__ = (
        Index('ix_history_lga_date', 'lga_name', 'snapshot_date'),
    )
    
    def to_dict(self):
        return {
            'snapshot_date': self.snapshot_date.isoformat() if self.snapshot_date else None,
            'LGA_Name': self.lga_name,
            'State': self.state,
            'mean_nightlight_intensity': self.mean_nightlight_intensity,
            'MPI': self.mpi,
            'composite_poverty_score': self.composite_poverty_score,
            'risk_level': self.risk_level,
            'cluster_label': self.cluster_label,
            'conflict_flag': self.conflict_flag,
            'population_density': self.population_density,
            'health_facility_count': self.health_facility_count,
            'school_count': self.school_count,
            'ndvi_mean': self.ndvi_mean,
            'rainfall_mm': self.rainfall_mm,
            'food_price_index': self.food_price_index,
            'idp_count': self.idp_count,
            'data_source': self.data_source,
        }


def init_database():
    """
    Initialize the database schema.
    Creates all tables if they don't exist.
    Also adds any columns that exist in the ORM model but are missing
    from the live database (handles schema evolution without Alembic).
    """
    from sqlalchemy import inspect as sa_inspect

    logger.info(f"Initializing database: {DATABASE_URL}")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")

    # ── Auto-add missing columns to existing tables ──────────────────────
    inspector = sa_inspect(engine)
    for table_name, table_obj in Base.metadata.tables.items():
        if not inspector.has_table(table_name):
            continue
        existing_cols = {c['name'] for c in inspector.get_columns(table_name)}
        for col in table_obj.columns:
            if col.name not in existing_cols:
                col_type = col.type.compile(engine.dialect)
                alter_sql = f'ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}'
                logger.info(f"Adding missing column: {table_name}.{col.name} ({col_type})")
                try:
                    with engine.begin() as conn:
                        conn.execute(text(alter_sql))
                except Exception as e:
                    logger.warning(f"Could not add column {col.name}: {e}")


def get_db_session():
    """
    Get a database session.
    Use with context manager: with get_db_session() as session:
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    # Initialize database when run directly
    logging.basicConfig(level=logging.INFO)
    init_database()
    print(f"✅ Database initialized at: {DATABASE_URL}")
