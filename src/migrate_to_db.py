"""
Database migration script.
Populates the database with existing GeoJSON data.
Run this once to initialize the database with current data.
"""
import sys
import logging
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.db_config import init_database
from src.db_utils import migrate_from_geojson
from src import config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """
    Main migration function.
    """
    logger.info("=" * 80)
    logger.info("DATABASE MIGRATION - Populating from GeoJSON")
    logger.info("=" * 80)
    
    # Step 1: Initialize database schema
    logger.info("\nStep 1: Initializing database schema...")
    init_database()
    logger.info("✅ Database schema created")
    
    # Step 2: Migrate data from GeoJSON
    logger.info("\nStep 2: Migrating data from GeoJSON file...")
    geojson_path = config.GEOJSON_OUTPUT
    
    if not geojson_path.exists():
        logger.error(f"❌ GeoJSON file not found: {geojson_path}")
        logger.info("\nPlease run the ML model first to generate the GeoJSON file:")
        logger.info("  python -m src.main")
        sys.exit(1)
    
    count = migrate_from_geojson(geojson_path)
    
    logger.info("\n" + "=" * 80)
    logger.info("✅ MIGRATION COMPLETE")
    logger.info("=" * 80)
    logger.info(f"Records migrated: {count}")
    logger.info("\nYou can now start the scheduler service:")
    logger.info("  python -m src.scheduler_service")
    logger.info("=" * 80)


if __name__ == "__main__":
    main()
