"""
Database configuration for the IOPHIN system.
Handles PostgreSQL/PostGIS connection and table schema.
"""
import os
from pathlib import Path
from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
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
    
    # Poverty indicators
    mpi = Column(Float)
    headcount_ratio = Column(Float)
    intensity_of_deprivation = Column(Float)
    in_severe_poverty = Column(Float)
    vulnerable_to_poverty = Column(Float)
    
    # Cluster analysis results
    cluster = Column(Integer)
    cluster_label = Column(String(100))
    risk_level = Column(String(50), index=True)
    
    # Conflict/shock indicators
    conflict_flag = Column(String(50), default='NORMAL')  # NORMAL, CRITICAL, ALERT
    last_conflict_event = Column(DateTime, nullable=True)
    
    # GeoJSON geometry (stored as text)
    geometry = Column(Text, nullable=True)
    
    # Metadata
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    data_source = Column(String(100), default='ML_MODEL')  # ML_MODEL, API_REFRESH, CONFLICT_API
    
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
            'cluster': self.cluster,
            'cluster_label': self.cluster_label,
            'risk_level': self.risk_level,
            'conflict_flag': self.conflict_flag,
            'last_conflict_event': self.last_conflict_event.isoformat() if self.last_conflict_event else None,
            'geometry': self.geometry,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None,
            'data_source': self.data_source
        }


def init_database():
    """
    Initialize the database schema.
    Creates all tables if they don't exist.
    """
    logger.info(f"Initializing database: {DATABASE_URL}")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")


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
