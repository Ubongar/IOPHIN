"""
Dynamic Real-Time Monitoring Service for IOPHIN.
This scheduler continuously fetches data from APIs and updates the database.

Features:
- Conflict data listener (runs every 1 hour)
- Satellite/nightlight refresher (runs every 24 hours)
- Automatic ML model retraining
- Database updates (upsert operations)
"""
import os
from dotenv import load_dotenv

# Force load the .env file from the root directory
load_dotenv()
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
    
    def get_acled_token(self, email, password):
        """
        Helper: Authenticates with ACLED via OAuth to get a Bearer Token.
        Ref: ACLED API Documentation (OAuth Method)
        """
        token_url = "https://acleddata.com/oauth/token"
        payload = {
            'username': email,
            'password': password,
            'grant_type': 'password', # Hard-coded requirement
            'client_id': 'acled'      # Hard-coded requirement
        }
        
        try:
            # We use a POST request to exchange password for a token
            response = requests.post(token_url, data=payload, timeout=30)
            if response.status_code == 200:
                token_data = response.json()
                return token_data.get('access_token')
            else:
                logger.error(f"❌ ACLED Auth Failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            logger.error(f"❌ Error getting ACLED token: {str(e)}")
            return None

    def fetch_conflict_data(self):
        """
        Task 1: The "Shock" Listener (REAL ACLED OAUTH)
        Fetches real conflict data using the modern OAuth authentication flow.
        """
        import os
        logger.info("=" * 80)
        logger.info("🔍 CONFLICT DATA LISTENER - Connecting to ACLED API (OAuth)...")
        logger.info("=" * 80)
        
        # 1. Load Credentials
        acled_email = os.getenv('ACLED_EMAIL')
        acled_pass = os.getenv('ACLED_PASSWORD')
        if not acled_email or not acled_pass:
            logger.warning("   ⚠️ ACLED credentials missing. Add ACLED_EMAIL and ACLED_PASSWORD to .env")
            return

        # 2. Get the Access Token (The "Passport")
        access_token = self.get_acled_token(acled_email, acled_pass)
        if not access_token:
            logger.warning("   ⚠️ Could not authenticate. Skipping fetch.")
            return
        try:
            # 3. Define Request
            # We filter for Nigeria and the last 14 days
            base_url = "https://acleddata.com/api/acled/read"
            start_date = (datetime.now() - timedelta(days=14)).strftime('%Y-%m-%d')
            
            params = {
                'country': 'Nigeria',
                'event_date': start_date,
                'event_date_where': '>=',
                'limit': 0 # No limit
            }
            # IMPORTANT: The token goes in the Header, not the URL
            headers = {
                'Authorization': f'Bearer {access_token}',
                'User-Agent': 'IOPHIN-Project/1.0'
            }
            logger.info(f"   Fetching events since {start_date}...")
            # 4. Execute Request
            response = requests.get(base_url, params=params, headers=headers, timeout=45)
            if response.status_code != 200:
                logger.error(f"   ❌ API Request Failed: {response.status_code}")
                return

            data = response.json()
            events = data.get('data', [])
            logger.info(f"   📅 Found {len(events)} conflict events in Nigeria.")
            updates_count = 0
            # 5. Process Events
            for event in events:
                lga_name = event.get('admin2')
                event_type = event.get('event_type')
                fatalities = int(event.get('fatalities', 0))
                event_date = event.get('event_date')
                
                # Risk Logic
                severity = 'NORMAL'
                if fatalities > 5:
                    severity = 'CRITICAL'
                elif fatalities > 0 or event_type in ['Battles', 'Explosions/Remote violence']:
                    severity = 'HIGH'
                elif event_type in ['Riots', 'Violence against civilians']:
                    severity = 'MEDIUM'
                
                if severity != 'NORMAL':
                    logger.info(f"   ⚠️ {severity} Risk: {lga_name} ({event_type}, {fatalities} deaths)")
                    upsert_conflict_flag(lga_name, severity, event_date)
                    updates_count += 1

            if updates_count > 0:
                logger.info(f"✅ Successfully updated {updates_count} LGAs.")
            else:
                logger.info("✅ No severe conflicts found recently.")
            
            logger.info("=" * 80)
            
        except Exception as e:
            logger.error(f"❌ Error in conflict listener: {str(e)}", exc_info=True)
    
    def fetch_latest_nightlights(self):
        """
        Task 2: Infrastructure Impact Model
        Updates nightlights based on REAL conflict data.
        
        Logic:
        - Recent Conflict -> Reduce Nightlights (Simulate grid damage/curfews)
        - No Conflict -> Increase Nightlights (Simulate recovery)
        """
        logger.info("=" * 80)
        logger.info("qh  INFRASTRUCTURE MODEL - Calculating conflict impact...")
        logger.info("=" * 80)
        
        try:
            hotspots = get_all_hotspots()
            if not hotspots:
                return

            updates = []
            for lga in hotspots:
                current_light = lga.get('mean_nightlight_intensity', 0) or 0
                conflict_status = lga.get('conflict_flag', 'NORMAL')
                
                new_light = current_light
                
                # Dynamic Logic
                if conflict_status == 'CRITICAL':
                    # Severe conflict = 15% drop in light (Power outage)
                    new_light = current_light * 0.85
                    logger.warning(f"   📉 {lga['LGA_Name']}: Conflict damaging power grid (-15%)")
                elif conflict_status == 'HIGH':
                    # High conflict = 5% drop
                    new_light = current_light * 0.95
                elif conflict_status == 'NORMAL':
                    # Peace = 1% Recovery (Development)
                    # Cap at max plausible value (e.g., 63.0)
                    if current_light < 63.0:
                        new_light = current_light * 1.01
                
                # Add to updates if changed
                if abs(new_light - current_light) > 0.001:
                    updates.append({
                        'LGA_Name': lga['LGA_Name'],
                        'State': lga['State'],
                        'mean_nightlight_intensity': new_light,
                        # Preserve existing values
                        'MPI': lga.get('MPI'),
                        'Headcount_Ratio': lga.get('Headcount_Ratio'),
                        'Intensity_of_Deprivation': lga.get('Intensity_of_Deprivation'),
                        'In_Severe_Poverty': lga.get('In_Severe_Poverty'),
                        'cluster': lga.get('cluster'),
                        'cluster_label': lga.get('cluster_label'),
                        'risk_level': lga.get('risk_level')
                    })

            # Update Database
            if updates:
                df_updates = pd.DataFrame(updates)
                upsert_hotspots_from_dataframe(df_updates, data_source='INFRASTRUCTURE_MODEL')
                logger.info(f"✅ Updated infrastructure status for {len(updates)} LGAs")
            
            logger.info("=" * 80)
            
        except Exception as e:
            logger.error(f"❌ Error updating nightlights: {str(e)}", exc_info=True)
    
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
            
            logger.info("✅ Model retrained successfully")
            logger.info(f"   Silhouette Score: {models['silhouette_score']:.4f}")
            
            # Update database with new cluster assignments
            upsert_hotspots_from_dataframe(final_df, data_source='ML_MODEL')
            
            self.last_model_run = datetime.utcnow()
            logger.info("✅ Database updated with new risk classifications")
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
            logger.info("Risk Distribution:")
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
