"""
IOPHIN Scheduler Service (Production)
Orchestrates data fetching, modeling, and database updates.

Tasks:
  1. Conflict Listener       - ACLED API           (every 1 hour)
  2. VIIRS Nightlights       - Google Earth Engine  (every 24 hours)
  3. Infrastructure Model    - Conflict grid impact (every 6 hours)
  4. ML Retrain              - Re-cluster with fresh data (every 12 hours)
"""
import os
import sys
import time
import json
import logging
import schedule
import numpy as np
import pandas as pd
import requests
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Import database utilities
from src.db_utils import (
    upsert_conflict_flag,
    upsert_hotspots_from_dataframe,
    get_all_hotspots,
)
from src.model_engine import build_analytical_model

# Load environment variables
load_dotenv()

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("scheduler_service.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)


# -- Google Earth Engine lazy initialisation ---------------------------------
_ee_initialized = False


def _init_gee():
    """Initialise Google Earth Engine once.  Returns True on success."""
    global _ee_initialized
    if _ee_initialized:
        return True
    try:
        import ee

        sa_email = os.getenv("GEE_SERVICE_ACCOUNT")
        key_file = os.getenv("GEE_KEY_FILE")

        if sa_email and key_file:
            credentials = ee.ServiceAccountCredentials(sa_email, key_file)
            ee.Initialize(credentials)
        else:
            # Fall back to default credentials
            # (user must have run `earthengine authenticate`)
            ee.Initialize()

        _ee_initialized = True
        logger.info("GEE: Google Earth Engine initialised")
        return True
    except Exception as e:
        logger.warning(f"GEE init failed: {e}")
        logger.warning("   VIIRS nightlight updates will be unavailable.")
        logger.warning(
            "   Set GEE_SERVICE_ACCOUNT + GEE_KEY_FILE in .env, "
            "or run: earthengine authenticate"
        )
        return False


class IOPHINScheduler:
    def __init__(self):
        self.is_running = False
        self.acled_email = os.getenv("ACLED_EMAIL")
        self.acled_password = os.getenv("ACLED_PASSWORD")
        self.last_model_run = None

    # == Task 1: ACLED Conflict Listener =====================================

    def get_acled_token(self):
        """Authenticate with ACLED to get a session token."""
        token_url = "https://acleddata.com/oauth/token"
        payload = {
            "username": self.acled_email,
            "password": self.acled_password,
            "grant_type": "password",
            "client_id": "acled",
        }
        try:
            response = requests.post(token_url, data=payload, timeout=30)
            if response.status_code == 200:
                return response.json().get("access_token")
            logger.error(f"ACLED Auth Failed: {response.status_code}")
        except Exception as e:
            logger.error(f"ACLED Auth Error: {str(e)}")
        return None

    def fetch_conflict_data(self):
        """
        Task 1: Real Conflict Listener
        Fetches live conflict data from ACLED and updates risk flags.
        """
        logger.info("=" * 60)
        logger.info("CONFLICT LISTENER: Connecting to ACLED API...")

        if not self.acled_email or not self.acled_password:
            logger.warning("ACLED credentials missing in .env - skipping")
            return

        token = self.get_acled_token()
        if not token:
            return

        try:
            start_date = (datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d")
            headers = {
                "Authorization": f"Bearer {token}",
                "User-Agent": "IOPHIN/1.0",
            }
            params = {
                "country": "Nigeria",
                "event_date": start_date,
                "event_date_where": ">=",
                "limit": 0,
            }
            response = requests.get(
                "https://acleddata.com/api/acled/read",
                headers=headers,
                params=params,
                timeout=60,
            )
            response.raise_for_status()
            data = response.json().get("data", [])

            logger.info(f"Analysing {len(data)} events since {start_date}...")

            updates = 0
            for event in data:
                lga = event.get("admin2")
                if not lga:
                    continue
                fatalities = int(event.get("fatalities", 0))
                event_type = event.get("event_type", "")
                date = datetime.strptime(event.get("event_date"), "%Y-%m-%d")

                severity = "NORMAL"
                if fatalities > 5:
                    severity = "CRITICAL"
                elif fatalities > 0 or event_type in [
                    "Battles",
                    "Explosions/Remote violence",
                ]:
                    severity = "HIGH"
                elif event_type in ["Riots", "Violence against civilians"]:
                    severity = "MEDIUM"

                if severity != "NORMAL":
                    upsert_conflict_flag(lga, severity, date)
                    updates += 1

            if updates > 0:
                logger.info(f"Updated conflict status for {updates} LGAs")
            else:
                logger.info("No new significant conflicts detected.")
        except Exception as e:
            logger.error(f"Conflict Fetch Error: {str(e)}")

    # == Task 2: VIIRS Nightlight Fetcher (Google Earth Engine) ==============

    def fetch_viirs_nightlights(self):
        """
        Task 2: Real Satellite Nightlight Fetcher
        Uses Google Earth Engine to pull the latest available VIIRS monthly composite.
        Computes mean radiance per LGA polygon.
        """
        logger.info("=" * 60)
        logger.info("VIIRS NIGHTLIGHT FETCHER: Querying Google Earth Engine...")

        if not _init_gee():
            logger.warning("Skipping nightlight fetch - GEE not available")
            return

        import ee

        try:
            # FIX: Get the single most recent available image in the collection.
            # This avoids the "no bands" error caused by the 2-4 month lag in data availability.
            viirs_collection = ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG") \
                                 .sort('system:time_start', False)

            latest_image = viirs_collection.first()

            # Verify the image exists and retrieve its metadata
            img_info = latest_image.getInfo()
            if not img_info or 'id' not in img_info:
                logger.warning("No VIIRS images found in the Earth Engine collection.")
                return

            logger.info(f"   Success: Found latest available composite: {img_info['id']}")

            # Select the average radiance band ('avg_rad')
            viirs = latest_image.select("avg_rad")

            # Load LGA polygons from the database
            hotspots = get_all_hotspots()
            if not hotspots:
                logger.warning("No hotspots found in DB - ensure migration has run.")
                return

            # Process in batches of 100 to stay within GEE payload and memory limits
            BATCH_SIZE = 100
            all_results = []

            for batch_start in range(0, len(hotspots), BATCH_SIZE):
                batch = hotspots[batch_start : batch_start + BATCH_SIZE]
                ee_features = []

                for lga in batch:
                    geom_str = lga.get("geometry")
                    if not geom_str:
                        continue
                    try:
                        # Ensure geometry is valid JSON before converting to EE Geometry
                        geom_json = (
                            json.loads(geom_str)
                            if isinstance(geom_str, str)
                            else geom_str
                        )
                        ee_geom = ee.Geometry(geom_json)
                        ee_feat = ee.Feature(
                            ee_geom, {"lga_name": lga["LGA_Name"]}
                        )
                        ee_features.append(ee_feat)
                    except Exception:
                        continue

                if not ee_features:
                    continue

                # Execute the spatial reduction (Mean radiance per LGA polygon)
                fc = ee.FeatureCollection(ee_features)
                reduced = viirs.reduceRegions(
                    collection=fc,
                    reducer=ee.Reducer.mean(),
                    scale=500,
                )
                batch_results = reduced.getInfo()

                if batch_results and "features" in batch_results:
                    all_results.extend(batch_results["features"])

                logger.info(
                    f"   Batch {batch_start // BATCH_SIZE + 1}: "
                    f"{len(ee_features)} LGAs processed"
                )

            if not all_results:
                logger.warning("GEE returned no results for the specified regions.")
                return

            # Map results back to database row format
            lga_lookup = {h["LGA_Name"]: h for h in hotspots}
            updates = []

            for feat in all_results:
                props = feat.get("properties", {})
                lga_name = props.get("lga_name")
                mean_rad = props.get("mean")
                if lga_name and mean_rad is not None:
                    match = lga_lookup.get(lga_name)
                    if match:
                        row = match.copy()
                        row["mean_nightlight_intensity"] = float(mean_rad)
                        updates.append(row)

            if updates:
                df = pd.DataFrame(updates)
                # Persist real satellite values to the PostgreSQL database
                upsert_hotspots_from_dataframe(df, data_source="VIIRS_GEE")
                logger.info(
                    f"✅ Successfully updated {len(updates)} LGAs with real VIIRS radiance"
                )
            else:
                logger.info("No nightlight updates were necessary.")

        except Exception as e:
            logger.error(f"❌ VIIRS Fetch Error: {str(e)}", exc_info=True)

    # == Task 3: Infrastructure Impact Model =================================

    def update_infrastructure_model(self):
        """
        Task 3: Infrastructure Impact Model
        Adjusts nightlight estimates based on conflict severity.
        Runs between satellite fetches to model grid damage / recovery.
        """
        logger.info("=" * 60)
        logger.info("INFRASTRUCTURE MODEL: Calculating grid impact...")

        try:
            hotspots = get_all_hotspots()
            updates = []

            for lga in hotspots:
                current_light = lga.get("mean_nightlight_intensity") or 0.0
                status = lga.get("conflict_flag", "NORMAL")

                new_light = current_light
                if status == "CRITICAL":
                    new_light *= 0.85  # 15% drop (grid damage)
                elif status == "HIGH":
                    new_light *= 0.95  # 5% drop
                elif status == "NORMAL":
                    if current_light < 63.0:
                        new_light *= 1.005  # Slow recovery toward baseline

                if abs(new_light - current_light) > 0.001:
                    row = lga.copy()
                    row["mean_nightlight_intensity"] = new_light
                    updates.append(row)

            if updates:
                df = pd.DataFrame(updates)
                upsert_hotspots_from_dataframe(
                    df, data_source="INFRASTRUCTURE_MODEL"
                )
                logger.info(f"Modeled impact for {len(updates)} LGAs")
            else:
                logger.info("Grid stability maintained.")

        except Exception as e:
            logger.error(f"Infrastructure Model Error: {str(e)}")

    # == Task 4: ML Model Retrain ============================================

    def retrain_ml_model(self):
        """
        Task 4: Re-cluster all LGAs using the latest data in the database.
        Recalculates risk_level and cluster_label.
        """
        logger.info("=" * 60)
        logger.info("ML ENGINE: Retraining model with latest data...")

        try:
            hotspots = get_all_hotspots()
            if not hotspots:
                logger.warning("No data in database - cannot retrain")
                return

            df = pd.DataFrame(hotspots)

            feature_cols = [
                "mean_nightlight_intensity",
                "MPI",
                "Headcount_Ratio",
                "Intensity_of_Deprivation",
                "In_Severe_Poverty",
            ]
            available = [
                c
                for c in feature_cols
                if c in df.columns and df[c].notna().sum() > 0
            ]

            if len(available) < 2:
                logger.warning(
                    f"Only {len(available)} valid feature columns - need >= 2"
                )
                return

            logger.info(
                f"Retraining with {len(df)} LGAs x {len(available)} features"
            )

            final_df, models = build_analytical_model(df, use_pca=True)

            sil = models.get("silhouette_score", 0)
            logger.info(f"Model retrained - Silhouette Score: {sil:.4f}")

            upsert_hotspots_from_dataframe(final_df, data_source="ML_MODEL")
            self.last_model_run = datetime.utcnow()
            logger.info("Database updated with new risk classifications")

        except Exception as e:
            logger.error(f"ML Retrain Error: {str(e)}", exc_info=True)

    # == Scheduler Entry Point ===============================================

    def start(self):
        logger.info("IOPHIN Scheduler Started (Production Mode)")
        logger.info(
            f"   ACLED credentials: {'set' if self.acled_email else 'MISSING'}"
        )
        logger.info(
            f"   GEE available:     {'yes' if _init_gee() else 'NO'}"
        )

        # Initial run of all tasks
        self.fetch_conflict_data()
        self.fetch_viirs_nightlights()
        self.update_infrastructure_model()
        self.retrain_ml_model()

        # Schedule recurring tasks
        schedule.every(1).hours.do(self.fetch_conflict_data)
        schedule.every(24).hours.do(self.fetch_viirs_nightlights)
        schedule.every(6).hours.do(self.update_infrastructure_model)
        schedule.every(12).hours.do(self.retrain_ml_model)

        logger.info("All tasks scheduled:")
        logger.info("   Conflict Listener       - every 1 hour")
        logger.info("   VIIRS Nightlights       - every 24 hours")
        logger.info("   Infrastructure Model    - every 6 hours")
        logger.info("   ML Retrain              - every 12 hours")

        while True:
            schedule.run_pending()
            time.sleep(1)


if __name__ == "__main__":
    service = IOPHINScheduler()
    service.start()
