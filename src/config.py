"""
Configuration module for Nigeria Poverty Hotspot Identifier System.
Defines all file paths and system parameters.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Base directory (project root)
BASE_DIR = Path(__file__).parent.parent.resolve()

# Data directories
DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"

# Input files
SHAPEFILE_DIR = RAW_DATA_DIR / "NGA_LGA_Boundaries_2_-5383648833805565856"
SHAPEFILE_PATH = SHAPEFILE_DIR / "grid3_nga_boundary_vacclgas.shp"
VIIRS_RASTER_PATH = RAW_DATA_DIR / "viirs_2024.tif"  # 10.8GB file (on local machine only)
STATE_MPI_CSV = RAW_DATA_DIR / "nga_mpi(3).csv"
SENATORIAL_MPI_CSV = RAW_DATA_DIR / "Nigeria MPI by Senatorial District.csv"
PROCESSED_HOTSPOTS_CSV = PROCESSED_DATA_DIR / "processed_hotspots.csv"

# Output files
FINAL_OUTPUT_CSV = PROCESSED_DATA_DIR / "final_model_output.csv"
GEOJSON_OUTPUT = PROCESSED_DATA_DIR / "hotspots.geojson"

# Model parameters
K_CLUSTERS = 5  # Critical, High, Medium, Low, Minimal
PCA_VARIANCE = 0.95  # Keep 95% of variance
KNN_NEIGHBORS = 5  # For imputation
USE_HDBSCAN = True  # Use HDBSCAN as primary clustering; fallback to K-Means if needed
HDBSCAN_MIN_CLUSTER_SIZE = 30  # Minimum cluster size for HDBSCAN

# Weighted composite poverty score weights
COMPOSITE_WEIGHTS = {
    'mpi': 0.30,
    'inverse_nightlight': 0.25,
    'health_access': 0.15,
    'education_access': 0.15,
    'infrastructure': 0.15,
}

# Column name mappings (for handling different naming conventions)
LGA_NAME_COLUMNS = ['lganame', 'LGA_NAME', 'ADM2_EN', 'LGAName', 'Name']
STATE_NAME_COLUMNS = ['statename', 'StateName', 'State', 'ADM1_EN']
CSV_OUTPUT_COLUMNS = ['LGA_Name', 'State', 'Latitude', 'Longitude',
                      'mean_nightlight_intensity', 'MPI', 'Headcount_Ratio',
                      'Intensity_of_Deprivation', 'In_Severe_Poverty',
                      'population_density', 'health_facility_count',
                      'school_count', 'road_density_km', 'ndvi_mean',
                      'rainfall_mm', 'distance_to_urban_km',
                      'idp_count', 'food_price_index',
                      'composite_poverty_score']
GEOJSON_OUTPUT_COLUMNS = ['LGA_Name', 'State', 'cluster_label', 'risk_level',
                          'mean_nightlight_intensity', 'MPI', 'Headcount_Ratio',
                          'population_density', 'health_facility_count',
                          'school_count', 'composite_poverty_score']

# Cluster labels mapping (based on clustering results)
CLUSTER_LABELS = {
    0: "Critical - Humanitarian Emergency",
    1: "High Risk - Severe Poverty",
    2: "Medium Risk - Poor",
    3: "Low Risk - Vulnerable",
    4: "Minimal Risk - Wealthy"
}

# Scheduler intervals (hours) from env or defaults
SCHEDULER_INTERVALS = {
    'conflict': int(os.getenv('SCHEDULER_CONFLICT_INTERVAL', 1)),
    'viirs': int(os.getenv('SCHEDULER_VIIRS_INTERVAL', 24)),
    'infrastructure': int(os.getenv('SCHEDULER_INFRASTRUCTURE_INTERVAL', 6)),
    'ml_retrain': int(os.getenv('SCHEDULER_ML_RETRAIN_INTERVAL', 12)),
    'grid3': int(os.getenv('SCHEDULER_GRID3_INTERVAL', 168)),
    'ndvi': int(os.getenv('SCHEDULER_NDVI_INTERVAL', 24)),
    'rainfall': int(os.getenv('SCHEDULER_RAINFALL_INTERVAL', 24)),
    'population': int(os.getenv('SCHEDULER_POPULATION_INTERVAL', 720)),
    'idp': int(os.getenv('SCHEDULER_IDP_INTERVAL', 168)),
    'food_price': int(os.getenv('SCHEDULER_FOOD_PRICE_INTERVAL', 168)),
    'external_enrichment': int(os.getenv('SCHEDULER_EXTERNAL_ENRICHMENT_INTERVAL', 24)),
    'gee_environmental': int(os.getenv('SCHEDULER_GEE_ENVIRONMENTAL_INTERVAL', 24)),
}

# Google Earth Engine
GEE_PROJECT = os.getenv('GEE_PROJECT', 'gen-lang-client-0206534143')
GEE_SERVICE_ACCOUNT = os.getenv('GEE_SERVICE_ACCOUNT', 'gee-api-user@gen-lang-client-0206534143.iam.gserviceaccount.com')
GEE_KEY_FILE = os.getenv('GEE_KEY_FILE', str(BASE_DIR / 'gee' / 'gen-lang-client-0206534143-b4d81af822c7.json'))

# External API URLs
HDX_API_URL = os.getenv('HDX_API_URL', 'https://data.humdata.org/api/3/action')
WORLDPOP_API_URL = os.getenv('WORLDPOP_API_URL', 'https://hub.worldpop.org/rest/data')
# DTM API v3 (primary IDP source – requires subscription key from https://dtmapi.iom.int)
DTM_API_URL = os.getenv('DTM_API_URL', 'https://dtmapi.iom.int/v3')
DTM_API_KEY = os.getenv('DTM_API_KEY', '')

# DTM IDP data via HDX fallback (public, no API key needed)
# Site-level XLSX from NE Baseline Assessment (Adamawa, Bauchi, Borno, Gombe, Taraba, Yobe)
DTM_NE_BASELINE_XLSX_URL = os.getenv(
    'DTM_NE_BASELINE_XLSX_URL',
    'https://data.humdata.org/dataset/4adf7874-ae01-46fd-a442-5fc6b3c9dff1'
    '/resource/3128e7b0-ba3f-4486-8c49-863544c92a69/download',
)
# Site-level XLSX from NC&W Baseline Assessment (Benue, Kaduna, Kano, Katsina, Nasarawa, Plateau, Sokoto, Zamfara)
DTM_NCW_BASELINE_XLSX_URL = os.getenv(
    'DTM_NCW_BASELINE_XLSX_URL',
    'https://data.humdata.org/dataset/nigeria-displacement-data-north-central-west-baeline-assessment-iom-dtm'
    '/resource/3c121436-96d1-4f64-a419-2fa437a08dbe/download',
)
# Summary CSV fallback (covers additional states: Cross River, FCT, Jigawa, Kogi, Niger)
DTM_HDX_CSV_URL = os.getenv(
    'DTM_HDX_CSV_URL',
    'https://data.humdata.org/dataset/2bec769a-7326-4a5c-83ca-7d32ffabcf5e'
    '/resource/54650b1f-d409-4ba0-b171-9206d92eded5/download',
)
WFP_API_URL = os.getenv('WFP_API_URL', 'https://data.humdata.org/api/3/action')
OVERPASS_API_URL = os.getenv('OVERPASS_API_URL', 'https://overpass-api.de/api/interpreter')

# Advanced Model
USE_XGBOOST = True
XGBOOST_PARAMS = {
    'max_depth': 6, 'learning_rate': 0.1, 'n_estimators': 200,
    'objective': 'reg:squarederror', 'eval_metric': 'rmse',
}
MODEL_SAVE_DIR = BASE_DIR / "models"
MODEL_SAVE_DIR.mkdir(parents=True, exist_ok=True)

# Anomaly Detection
NIGHTLIGHT_DROP_THRESHOLD = float(os.getenv('NIGHTLIGHT_DROP_THRESHOLD', 0.20))
ANOMALY_CONTAMINATION = float(os.getenv('ANOMALY_CONTAMINATION', 0.05))

# Forecasting
FORECAST_HORIZONS = [3, 6]  # months

# Population weighting
USE_POPULATION_WEIGHTED_MPI = True

# Risk tiering mode: 'cluster' uses the existing clustering->rank mapping.
# 'absolute' uses fixed thresholds on composite poverty score (or other chosen metric).
# Set via env var RISK_TIERING_MODE ('cluster' or 'absolute')
RISK_TIERING_MODE = os.getenv('RISK_TIERING_MODE', 'cluster')

# Absolute thresholds for mapping a numeric score to risk tiers when
# RISK_TIERING_MODE == 'absolute'. Thresholds are upper bounds for each tier
# expressed on the same scale as `composite_poverty_score` (adjust as needed).
# Example defaults are conservative and should be tuned to your data.
ABSOLUTE_RISK_THRESHOLDS = {
    'Minimal': float(os.getenv('THRESHOLD_MINIMAL', 0.05)),
    'Low': float(os.getenv('THRESHOLD_LOW', 0.10)),
    'Medium': float(os.getenv('THRESHOLD_MEDIUM', 0.20)),
    'High': float(os.getenv('THRESHOLD_HIGH', 0.40)),
    'Critical': float(os.getenv('THRESHOLD_CRITICAL', 1.0)),
}

# ACLED API credentials
ACLED_EMAIL = os.getenv('ACLED_EMAIL', '')
ACLED_API_KEY = os.getenv('ACLED_API_KEY', '')

# NASA LAADS
NASA_LAADS_TOKEN = os.getenv('NASA_LAADS_TOKEN', '')

# Redis
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')

# New scheduler intervals
SCHEDULER_INTERVALS['anomaly_detection'] = int(os.getenv('SCHEDULER_ANOMALY_DETECTION_INTERVAL', 6))
SCHEDULER_INTERVALS['predictive_model'] = int(os.getenv('SCHEDULER_PREDICTIVE_MODEL_INTERVAL', 24))

# Ensure directories exist
PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
