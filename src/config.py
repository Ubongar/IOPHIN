"""
Configuration module for Nigeria Poverty Hotspot Identifier System.
Defines all file paths and system parameters.
"""
import os
from pathlib import Path

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
K_CLUSTERS = 4  # Rich, Vulnerable, Poor, Severe
PCA_VARIANCE = 0.95  # Keep 95% of variance
KNN_NEIGHBORS = 5  # For imputation

# Column name mappings (for handling different naming conventions)
LGA_NAME_COLUMNS = ['lganame', 'LGA_NAME', 'ADM2_EN', 'LGAName', 'Name']
STATE_NAME_COLUMNS = ['statename', 'StateName', 'State', 'ADM1_EN']
CSV_OUTPUT_COLUMNS = ['LGA_Name', 'State', 'Latitude', 'Longitude', 
                     'mean_nightlight_intensity', 'MPI', 'Headcount Ratio',
                     'Intensity of Deprivation', 'In Severe Poverty']
GEOJSON_OUTPUT_COLUMNS = ['LGA_Name', 'State', 'cluster_label', 'risk_level',
                         'mean_nightlight_intensity', 'MPI', 'Headcount_Ratio']

# Cluster labels mapping (based on clustering results)
# Lower cluster numbers should map to areas with:
# - High nightlight intensity + Low deprivation = Wealthy
# - Low nightlight intensity + High deprivation = Hotspot
CLUSTER_LABELS = {
    0: "High Risk - Severe Poverty",
    1: "Medium Risk - Poor",
    2: "Low Risk - Vulnerable",
    3: "Minimal Risk - Wealthy"
}

# Ensure directories exist
PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
