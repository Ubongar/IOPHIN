"""
IOPHIN Scheduler Service (Production)
Orchestrates data fetching, modeling, and database updates.

Tasks:
  1. Conflict Listener       – ACLED API              (configurable, default 1 h)
  2. VIIRS Nightlights       – Google Earth Engine     (configurable, default 24 h)
  3. Infrastructure Model    – Conflict‑grid impact    (configurable, default 6 h)
  4. ML Retrain              – Re‑cluster + snapshot   (configurable, default 12 h)
  5. External Enrichment     – GRID3/WorldPop/OSM/DTM  (configurable, default 24 h)
  6. NDVI + Rainfall         – GEE MODIS/CHIRPS        (configurable, default 24 h)
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
from pathlib import Path
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

from src.db_utils import (
    upsert_conflict_flag,
    upsert_hotspots_from_dataframe,
    get_all_hotspots,
    save_history_snapshot,
)
from src.model_engine import build_analytical_model
from src.feature_extraction import (
    fetch_grid3_health_facilities,
    fetch_grid3_schools,
    fetch_worldpop_population,
    fetch_road_density,
    fetch_ndvi_from_gee,
    fetch_rainfall_from_gee,
    fetch_idp_data,
    fetch_food_prices,
)
from src import config as _cfg

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("scheduler_service.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# ─── GEE lazy init ───────────────────────────────────────────────────────────
_ee_initialized = False


def _init_gee():
    global _ee_initialized
    if _ee_initialized:
        return True
    try:
        import ee
        from . import config as _cfg

        project = _cfg.GEE_PROJECT
        sa_email = _cfg.GEE_SERVICE_ACCOUNT
        key_file = _cfg.GEE_KEY_FILE

        if sa_email and key_file and Path(key_file).exists():
            credentials = ee.ServiceAccountCredentials(sa_email, key_file)
            ee.Initialize(credentials, project=project)
        else:
            ee.Initialize(project=project)

        _ee_initialized = True
        logger.info("GEE: Initialised")
        return True
    except Exception as e:
        logger.warning(f"GEE init failed: {e}")
        return False


class IOPHINScheduler:
    def __init__(self):
        self.is_running = False
        self.acled_email = os.getenv("ACLED_EMAIL")
        self.acled_password = os.getenv("ACLED_PASSWORD")
        self.last_model_run = None

        # Load intervals from config (hours)
        self.intervals = _cfg.SCHEDULER_INTERVALS

    # ── Task 1: ACLED Conflict Listener ─────────────────────────────────────

    def get_acled_token(self):
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
            logger.error(f"ACLED Auth Error: {e}")
        return None

    def fetch_conflict_data(self):
        logger.info("=" * 60)
        logger.info("CONFLICT LISTENER: Connecting to ACLED API...")

        if not self.acled_email or not self.acled_password:
            logger.warning("ACLED credentials missing — skipping")
            return

        token = self.get_acled_token()
        if not token:
            return

        try:
            start_date = (datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d")
            headers = {"Authorization": f"Bearer {token}", "User-Agent": "IOPHIN/2.0"}
            params = {
                "country": "Nigeria",
                "event_date": start_date,
                "event_date_where": ">=",
                "limit": 0,
            }
            response = requests.get(
                "https://acleddata.com/api/acled/read",
                headers=headers, params=params, timeout=60,
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

                if fatalities > 5:
                    severity = "CRITICAL"
                elif fatalities > 0 or event_type in ["Battles", "Explosions/Remote violence"]:
                    severity = "HIGH"
                elif event_type in ["Riots", "Violence against civilians"]:
                    severity = "MEDIUM"
                else:
                    severity = "NORMAL"

                if severity != "NORMAL":
                    upsert_conflict_flag(lga, severity, date)
                    updates += 1

            logger.info(f"Updated conflict status for {updates} LGAs" if updates else "No new significant conflicts.")
        except Exception as e:
            logger.error(f"Conflict Fetch Error: {e}")

    # ── Task 2: VIIRS Nightlights (GEE) ────────────────────────────────────

    def fetch_viirs_nightlights(self):
        logger.info("=" * 60)
        logger.info("VIIRS NIGHTLIGHT FETCHER: Querying GEE...")

        if not _init_gee():
            logger.warning("Skipping — GEE not available")
            return

        import ee

        try:
            viirs_collection = ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG") \
                .sort('system:time_start', False)
            latest_image = viirs_collection.first()

            img_info = latest_image.getInfo()
            if not img_info or 'id' not in img_info:
                logger.warning("No VIIRS images found.")
                return

            logger.info(f"Latest composite: {img_info['id']}")
            viirs = latest_image.select("avg_rad")

            hotspots = get_all_hotspots()
            if not hotspots:
                logger.warning("No hotspots in DB.")
                return

            BATCH_SIZE = 100
            all_results = []

            for batch_start in range(0, len(hotspots), BATCH_SIZE):
                batch = hotspots[batch_start:batch_start + BATCH_SIZE]
                ee_features = []

                for lga in batch:
                    geom_str = lga.get("geometry")
                    if not geom_str:
                        continue
                    try:
                        geom_json = json.loads(geom_str) if isinstance(geom_str, str) else geom_str
                        ee_geom = ee.Geometry(geom_json)
                        ee_features.append(ee.Feature(ee_geom, {"lga_name": lga["LGA_Name"]}))
                    except Exception:
                        continue

                if not ee_features:
                    continue

                fc = ee.FeatureCollection(ee_features)
                reduced = viirs.reduceRegions(collection=fc, reducer=ee.Reducer.mean(), scale=500)
                batch_results = reduced.getInfo()

                if batch_results and "features" in batch_results:
                    all_results.extend(batch_results["features"])

                logger.info(f"  Batch {batch_start // BATCH_SIZE + 1}: {len(ee_features)} LGAs")

            if not all_results:
                logger.warning("GEE returned no results.")
                return

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
                upsert_hotspots_from_dataframe(df, data_source="VIIRS_GEE")
                logger.info(f"✅ Updated {len(updates)} LGAs with VIIRS radiance")

        except Exception as e:
            logger.error(f"VIIRS Fetch Error: {e}", exc_info=True)

    # ── Task 3: Infrastructure Impact Model ─────────────────────────────────

    def update_infrastructure_model(self):
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
                    new_light *= 0.85
                elif status == "HIGH":
                    new_light *= 0.95
                elif status == "NORMAL" and current_light < 63.0:
                    new_light *= 1.005

                if abs(new_light - current_light) > 0.001:
                    row = lga.copy()
                    row["mean_nightlight_intensity"] = new_light
                    updates.append(row)

            if updates:
                df = pd.DataFrame(updates)
                upsert_hotspots_from_dataframe(df, data_source="INFRASTRUCTURE_MODEL")
                logger.info(f"Modeled impact for {len(updates)} LGAs")
            else:
                logger.info("Grid stability maintained.")

        except Exception as e:
            logger.error(f"Infrastructure Model Error: {e}")

    # ── Task 4: ML Retrain + History Snapshot ───────────────────────────────

    def retrain_ml_model(self):
        logger.info("=" * 60)
        logger.info("ML ENGINE: Retraining model...")

        try:
            hotspots = get_all_hotspots()
            if not hotspots:
                logger.warning("No data — cannot retrain")
                return

            df = pd.DataFrame(hotspots)

            feature_cols = [
                "mean_nightlight_intensity", "MPI",
                "Headcount_Ratio", "Intensity_of_Deprivation",
                "In_Severe_Poverty", "composite_poverty_score",
                "population_density", "health_facility_count",
                "school_count", "road_density_km", "ndvi_mean",
                "rainfall_mm", "food_price_index",
            ]
            available = [c for c in feature_cols if c in df.columns and df[c].notna().sum() > 0]

            if len(available) < 2:
                logger.warning(f"Only {len(available)} valid features — need ≥ 2")
                return

            logger.info(f"Retraining: {len(df)} LGAs × {len(available)} features")

            final_df, models = build_analytical_model(df, use_pca=True)

            sil = models.get("silhouette_score", 0)
            method = models.get("clustering_method", "kmeans")
            logger.info(f"Model retrained — {method.upper()} Silhouette: {sil:.4f}")

            upsert_hotspots_from_dataframe(final_df, data_source="ML_MODEL")
            self.last_model_run = datetime.now(timezone.utc)

            # Save history snapshot for time-series analysis
            try:
                n = save_history_snapshot()
                logger.info(f"History snapshot saved: {n} records")
            except Exception as e:
                logger.warning(f"History snapshot failed: {e}")

            logger.info("Database updated with new risk classifications")

        except Exception as e:
            logger.error(f"ML Retrain Error: {e}", exc_info=True)

    # ── Task 5: External enrichment (GRID3, WorldPop, OSM, DTM, WFP) ──────

    def fetch_external_enrichment(self):
        logger.info("=" * 60)
        logger.info("EXTERNAL ENRICHMENT: Fetching GRID3 / WorldPop / OSM / DTM / WFP...")

        try:
            hotspots = get_all_hotspots()
            if not hotspots:
                logger.warning("No data — cannot enrich")
                return

            df = pd.DataFrame(hotspots)

            df = fetch_grid3_health_facilities(df)
            df = fetch_grid3_schools(df)
            df = fetch_worldpop_population(df)
            df = fetch_road_density(df)
            df = fetch_idp_data(df)
            df = fetch_food_prices(df)

            upsert_hotspots_from_dataframe(df, data_source="EXTERNAL_ENRICHMENT")
            logger.info("✅ External enrichment complete")

        except Exception as e:
            logger.error(f"External Enrichment Error: {e}", exc_info=True)

    # ── Task 6: NDVI + Rainfall via GEE ────────────────────────────────────

    def fetch_gee_environmental(self):
        logger.info("=" * 60)
        logger.info("GEE ENVIRONMENTAL: Fetching NDVI + Rainfall...")

        if not _init_gee():
            logger.warning("Skipping — GEE not available")
            return

        try:
            hotspots = get_all_hotspots()
            if not hotspots:
                return

            df = pd.DataFrame(hotspots)
            df = fetch_ndvi_from_gee(df)
            df = fetch_rainfall_from_gee(df)

            upsert_hotspots_from_dataframe(df, data_source="GEE_ENVIRONMENTAL")
            logger.info("✅ NDVI + Rainfall update complete")

        except Exception as e:
            logger.error(f"GEE Environmental Error: {e}", exc_info=True)

    # ── Task 7: Anomaly Detection ────────────────────────────────────────

    def run_anomaly_detection(self):
        logger.info("=" * 60)
        logger.info("ANOMALY DETECTION: Running nightlight + multivariate checks...")
        try:
            hotspots = get_all_hotspots()
            if not hotspots:
                logger.warning("No data — skipping anomaly detection")
                return
            current_df = pd.DataFrame(hotspots)
            from src.anomaly_detection import detect_nightlight_anomalies, detect_multivariate_anomalies
            # detect_nightlight_anomalies needs a history baseline; use current data as both
            # (a rolling baseline will be built once history table is populated)
            nl_anomalies = detect_nightlight_anomalies(current_df, current_df)
            mv_anomalies = detect_multivariate_anomalies(current_df)
            total = len(nl_anomalies) + len(mv_anomalies)
            logger.info(f"✅ Anomaly detection complete: {len(nl_anomalies)} nightlight, {len(mv_anomalies)} multivariate")
        except Exception as e:
            logger.error(f"Anomaly Detection Error: {e}", exc_info=True)

    # ── Task 8: Predictive Model ─────────────────────────────────────────

    def run_predictive_model(self):
        logger.info("=" * 60)
        logger.info("PREDICTIVE MODEL: Forecasting all LGAs...")
        try:
            hotspots = get_all_hotspots()
            if not hotspots:
                logger.warning("No data — skipping predictive model")
                return
            history_df = pd.DataFrame(hotspots)
            from src.predictive_model import forecast_all_lgas
            forecasts = forecast_all_lgas(history_df=history_df)
            if not forecasts.empty:
                logger.info(f"✅ Predictive model: {len(forecasts)} forecasts generated")
            else:
                logger.info("Predictive model: no forecasts produced (insufficient history)")
        except Exception as e:
            logger.error(f"Predictive Model Error: {e}", exc_info=True)

    # ── Task 9: Temporal Analysis ────────────────────────────────────────

    def run_temporal_analysis(self):
        logger.info("=" * 60)
        logger.info("TEMPORAL ANALYSIS: Computing trend indicators...")
        try:
            hotspots = get_all_hotspots()
            if not hotspots:
                logger.warning("No data — skipping temporal analysis")
                return
            history_df = pd.DataFrame(hotspots)
            from src.temporal_analysis import compute_temporal_trends, detect_tier_crossings
            trends = compute_temporal_trends(history_df)
            crossings = detect_tier_crossings(history_df)
            logger.info(f"✅ Temporal trends computed: {len(trends)} LGAs, {len(crossings)} tier crossings")
        except Exception as e:
            logger.error(f"Temporal Analysis Error: {e}", exc_info=True)

    # ── Scheduler entry point ──────────────────────────────────────────────

    def start(self):
        intervals = self.intervals
        logger.info("IOPHIN Scheduler Started (Production Mode)")
        logger.info(f"  ACLED credentials: {'set' if self.acled_email else 'MISSING'}")
        logger.info(f"  GEE available:     {'yes' if _init_gee() else 'NO'}")

        # Initial run
        self.fetch_conflict_data()
        self.fetch_viirs_nightlights()
        self.update_infrastructure_model()
        self.fetch_external_enrichment()
        self.fetch_gee_environmental()
        self.retrain_ml_model()
        self.run_anomaly_detection()
        self.run_predictive_model()
        self.run_temporal_analysis()

        # Schedule recurring tasks
        schedule.every(intervals['conflict']).hours.do(self.fetch_conflict_data)
        schedule.every(intervals['viirs']).hours.do(self.fetch_viirs_nightlights)
        schedule.every(intervals['infrastructure']).hours.do(self.update_infrastructure_model)
        schedule.every(intervals['ml_retrain']).hours.do(self.retrain_ml_model)
        schedule.every(intervals['external_enrichment']).hours.do(self.fetch_external_enrichment)
        schedule.every(intervals['gee_environmental']).hours.do(self.fetch_gee_environmental)
        schedule.every(6).hours.do(self.run_anomaly_detection)
        schedule.every(24).hours.do(self.run_predictive_model)
        schedule.every(12).hours.do(self.run_temporal_analysis)

        logger.info("All tasks scheduled:")
        logger.info(f"  Conflict Listener       – every {intervals['conflict']} h")
        logger.info(f"  VIIRS Nightlights       – every {intervals['viirs']} h")
        logger.info(f"  Infrastructure Model    – every {intervals['infrastructure']} h")
        logger.info(f"  ML Retrain + Snapshot   – every {intervals['ml_retrain']} h")
        logger.info(f"  External Enrichment     – every {intervals['external_enrichment']} h")
        logger.info(f"  GEE Environmental       – every {intervals['gee_environmental']} h")
        logger.info(f"  Anomaly Detection       – every 6 h")
        logger.info(f"  Predictive Model        – every 24 h")
        logger.info(f"  Temporal Analysis       – every 12 h")

        while True:
            schedule.run_pending()
            time.sleep(1)


if __name__ == "__main__":
    service = IOPHINScheduler()
    service.start()
