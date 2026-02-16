"""
Dynamic Real-Time Monitoring Service for IOPHIN.
This scheduler continuously fetches data from APIs and updates the database.

Features:
- Conflict data listener (runs every 1 hour)
- Satellite/nightlight refresher (runs every 24 hours)
- Automatic ML model retraining
- Database updates (upsert operations)
"""
import sys
import time
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import requests
import random
import pandas as pd
import numpy as np

# Import existing IOPHIN modules
from src.db_config import init_database
from src.db_utils import (
    upsert_hotspots_from_dataframe,
    upsert_conflict_flag,
    get_all_hotspots,
    get_statistics
)
from src.model_engine import build_analytical_model

# Configure logging only if no handlers are already configured for the root logger
if not logging.getLogger().handlers:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('scheduler_service.log')
        ]
    )
logger = logging.getLogger(__name__)


class DataPipeline:
    """
    Main data pipeline orchestrator.
    Manages scheduled tasks for data fetching and model retraining.
    """
    
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.last_model_run = None
        logger.info("🚀 Initializing Dynamic Monitoring Service")
        
        # Initialize database
        init_database()
    
    def fetch_conflict_data(self):
        """
        Task 1: The "Shock" Listener
        Fetches conflict/crisis data from external APIs (e.g., ACLED, GDELT).
        
        In production, this would connect to:
        - ACLED API: https://acleddata.com/
        - GDELT: https://www.gdeltproject.org/
        
        For now, we simulate conflict detection.
        """
        logger.info("=" * 80)
        logger.info("🔍 CONFLICT DATA LISTENER - Checking for crisis events...")
        logger.info("=" * 80)
        
        try:
            # Simulated API call (replace with actual API in production)
            # Example: response = requests.get('https://api.acleddata.com/acled/read?...')
            
            # Simulate conflict detection (10% chance of detecting a conflict)
            if random.random() < 0.1:
                # Simulate conflict in a random LGA.
                # NOTE: These LGA names are placeholders used to exercise the pipeline.
                # In production, replace this list with valid LGA names sourced from the
                # database or from real ACLED/GDELT responses to avoid creating entries
                # for non-existent LGAs.
                conflict_lgas = [
                    "Zamfara North",
                    "Borno South",
                    "Yobe East",
                    "Kaduna Central",
                    "Katsina North",
                ]
                
                affected_lga = random.choice(conflict_lgas)
                
                logger.warning(f"⚠️  CONFLICT DETECTED in {affected_lga}")
                logger.warning(f"   Event Type: Armed Clash / Violence Against Civilians")
                logger.warning(f"   Severity: HIGH")
                logger.warning(f"   Action: Flagging LGA as CRITICAL")
                
                # Update database with conflict flag
                upsert_conflict_flag(
                    lga_name=affected_lga,
                    conflict_flag='CRITICAL',
                    last_conflict_event=datetime.utcnow()
                )
                
                logger.info(f"✅ Database updated: {affected_lga} marked as CRITICAL")
            else:
                logger.info("✅ No new conflict events detected")
            
            logger.info("=" * 80)
            
        except Exception as e:
            logger.error(f"❌ Error fetching conflict data: {str(e)}", exc_info=True)
    
    def fetch_latest_nightlights(self):
        """
        Task 2: The "Satellite" Refresher
        Fetches latest nighttime lights data from NASA GIBS or Google Earth Engine.
        
        In production, this would connect to:
        - NASA GIBS API: https://gibs.earthdata.nasa.gov/
        - Google Earth Engine: https://earthengine.google.com/
        - VIIRS Daily Data: https://ladsweb.modaps.eosdis.nasa.gov/
        
        For now, we simulate satellite data updates.
        """
        logger.info("=" * 80)
        logger.info("🛰️  SATELLITE REFRESHER - Fetching latest nightlight data...")
        logger.info("=" * 80)
        
        try:
            # Simulated API call (replace with actual API in production)
            # Example: 
            # import ee
            # ee.Initialize()
            # image = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG').filterDate(...)
            
            # Get current hotspots from database
            hotspots = get_all_hotspots()
            
            if not hotspots:
                logger.warning("No hotspots in database. Run ML model first.")
                return
            
            # Simulate nightlight updates (5-10 random LGAs experience changes)
            num_updates = random.randint(5, 10)
            updated_lgas = random.sample(hotspots, min(num_updates, len(hotspots)))
            
            logger.info(f"📊 Simulating nightlight changes for {num_updates} LGAs...")
            
            updates = []
            for lga in updated_lgas:
                # Simulate change in nightlight intensity
                old_value = lga.get('mean_nightlight_intensity', 0)
                
                # Simulate various scenarios:
                # - Power outage: -30% to -50%
                # - Development: +10% to +30%
                # - Normal variation: -5% to +5%
                scenario = random.choice(['outage', 'development', 'normal', 'normal', 'normal'])
                
                if scenario == 'outage':
                    change_factor = random.uniform(0.5, 0.7)  # 30-50% decrease
                    new_value = old_value * change_factor
                    logger.warning(f"   ⚡ {lga['LGA_Name']}: POWER OUTAGE detected")
                    logger.warning(f"      Nightlight: {old_value:.2f} → {new_value:.2f} ({(change_factor-1)*100:.1f}%)")
                elif scenario == 'development':
                    change_factor = random.uniform(1.1, 1.3)  # 10-30% increase
                    new_value = old_value * change_factor
                    logger.info(f"   📈 {lga['LGA_Name']}: Economic activity increasing")
                    logger.info(f"      Nightlight: {old_value:.2f} → {new_value:.2f} (+{(change_factor-1)*100:.1f}%)")
                else:
                    change_factor = random.uniform(0.95, 1.05)  # ±5% normal variation
                    new_value = old_value * change_factor
                    logger.debug(f"   {lga['LGA_Name']}: Normal variation {old_value:.2f} → {new_value:.2f}")
                
                updates.append({
                    'LGA_Name': lga['LGA_Name'],
                    'State': lga['State'],
                    'Latitude': lga['Latitude'],
                    'Longitude': lga['Longitude'],
                    'mean_nightlight_intensity': new_value,
                    'MPI': lga.get('MPI'),
                    'Headcount_Ratio': lga.get('Headcount_Ratio'),
                    'Intensity_of_Deprivation': lga.get('Intensity_of_Deprivation'),
                    'In_Severe_Poverty': lga.get('In_Severe_Poverty'),
                    'cluster': lga.get('cluster'),
                    'cluster_label': lga.get('cluster_label'),
                    'risk_level': lga.get('risk_level')
                })
            
            # Update database
            if updates:
                df_updates = pd.DataFrame(updates)
                upsert_hotspots_from_dataframe(df_updates, data_source='API_REFRESH')
                logger.info(f"✅ Updated {len(updates)} LGAs with new nightlight data")
            
            logger.info("=" * 80)
            
        except Exception as e:
            logger.error(f"❌ Error fetching nightlight data: {str(e)}", exc_info=True)
    
    def run_ml_engine(self):
        """
        Task 3: ML Model Retraining
        Re-runs the K-Means clustering model on updated data.
        
        This is called after new data is fetched to recalculate risk levels.
        """
        logger.info("=" * 80)
        logger.info("🤖 ML ENGINE - Retraining model with latest data...")
        logger.info("=" * 80)
        
        try:
            # Get all current hotspots from database
            hotspots = get_all_hotspots()
            
            if not hotspots:
                logger.warning("No data in database. Cannot retrain model.")
                return
            
            # Convert to DataFrame
            df = pd.DataFrame(hotspots)
            
            # Prepare features for model
            feature_cols = ['mean_nightlight_intensity', 'MPI', 'Headcount_Ratio', 
                          'Intensity_of_Deprivation', 'In_Severe_Poverty']
            
            # Check if we have the necessary columns
            available_features = [col for col in feature_cols if col in df.columns]
            
            if len(available_features) < 2:
                logger.warning("Insufficient features for model retraining")
                return
            
            logger.info(f"📊 Retraining model with {len(df)} LGAs and {len(available_features)} features")
            
            # Run the analytical model
            final_df, models = build_analytical_model(df, use_pca=True)
            
            logger.info(f"✅ Model retrained successfully")
            logger.info(f"   Silhouette Score: {models['silhouette_score']:.4f}")
            
            # Update database with new cluster assignments
            upsert_hotspots_from_dataframe(final_df, data_source='ML_MODEL')
            
            self.last_model_run = datetime.utcnow()
            logger.info(f"✅ Database updated with new risk classifications")
            logger.info("=" * 80)
            
        except Exception as e:
            logger.error(f"❌ Error retraining ML model: {str(e)}", exc_info=True)
    
    def display_status(self):
        """
        Display current system status and statistics.
        """
        logger.info("=" * 80)
        logger.info("📊 SYSTEM STATUS")
        logger.info("=" * 80)
        
        try:
            stats = get_statistics()
            
            logger.info(f"Total LGAs monitored: {stats['totalLGAs']}")
            logger.info(f"Risk Distribution:")
            logger.info(f"  - High Risk: {stats['riskDistribution'].get('high', 0)} LGAs")
            logger.info(f"  - Medium Risk: {stats['riskDistribution'].get('medium', 0)} LGAs")
            logger.info(f"  - Low Risk: {stats['riskDistribution'].get('low', 0)} LGAs")
            logger.info(f"  - Minimal Risk: {stats['riskDistribution'].get('minimal', 0)} LGAs")
            logger.info(f"Conflict Zones: {stats['conflictZones']} LGAs")
            logger.info(f"Average MPI: {stats['averageMPI']}")
            logger.info(f"Average Nightlight: {stats['averageNightlight']}")
            logger.info(f"Last Model Run: {self.last_model_run or 'Never'}")
            logger.info(f"Timestamp: {stats['timestamp']}")
            logger.info("=" * 80)
            
        except Exception as e:
            logger.error(f"Error displaying status: {str(e)}")
    
    def start(self):
        """
        Start the scheduler service.
        Runs tasks at specified intervals indefinitely.
        """
        logger.info("=" * 80)
        logger.info("🚀 STARTING DYNAMIC MONITORING SERVICE")
        logger.info("=" * 80)
        
        # Display initial status
        self.display_status()
        
        # Schedule Task 1: Conflict Listener (every 1 hour)
        self.scheduler.add_job(
            self.fetch_conflict_data,
            trigger=IntervalTrigger(hours=1),
            id='conflict_listener',
            name='Conflict Data Listener',
            replace_existing=True
        )
        logger.info("✅ Scheduled: Conflict Listener (every 1 hour)")
        
        # Schedule Task 2: Satellite Refresher (every 24 hours)
        self.scheduler.add_job(
            self.fetch_latest_nightlights,
            trigger=IntervalTrigger(hours=24),
            id='satellite_refresher',
            name='Satellite Data Refresher',
            replace_existing=True
        )
        logger.info("✅ Scheduled: Satellite Refresher (every 24 hours)")
        
        # Schedule Task 3: ML Model Retraining (every 6 hours, after data updates)
        self.scheduler.add_job(
            self.run_ml_engine,
            trigger=IntervalTrigger(hours=6),
            id='ml_retraining',
            name='ML Model Retraining',
            replace_existing=True
        )
        logger.info("✅ Scheduled: ML Model Retraining (every 6 hours)")
        
        # Schedule status display (every 1 hour)
        self.scheduler.add_job(
            self.display_status,
            trigger=IntervalTrigger(hours=1),
            id='status_display',
            name='Status Display',
            replace_existing=True
        )
        logger.info("✅ Scheduled: Status Display (every 1 hour)")
        
        # Run initial tasks immediately
        logger.info("\n🔄 Running initial data fetch...")
        self.fetch_conflict_data()
        self.fetch_latest_nightlights()
        
        # Start the scheduler
        self.scheduler.start()
        
        logger.info("\n" + "=" * 80)
        logger.info("✅ SCHEDULER SERVICE IS NOW RUNNING")
        logger.info("=" * 80)
        logger.info("Press Ctrl+C to stop the service")
        logger.info("=" * 80 + "\n")
        
        try:
            # Keep the main thread alive
            while True:
                time.sleep(1)
        except (KeyboardInterrupt, SystemExit):
            logger.info("\n🛑 Shutting down scheduler service...")
            self.scheduler.shutdown()
            logger.info("✅ Service stopped gracefully")


def main():
    """
    Main entry point for the scheduler service.
    """
    pipeline = DataPipeline()
    pipeline.start()


if __name__ == "__main__":
    main()
