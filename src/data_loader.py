"""
Data loader module for Nigeria Poverty Hotspot Identifier System.
Handles loading of shapefiles, CSV files, and existing processed data.
"""
import pandas as pd
import geopandas as gpd
from pathlib import Path
import logging

from . import config

logger = logging.getLogger(__name__)


def load_lga_shapefile():
    """
    Load the LGA boundary shapefile.
    
    Returns:
        GeoDataFrame: LGA boundaries with geometry
    """
    logger.info(f"Loading LGA shapefile from {config.SHAPEFILE_PATH}")
    
    if not config.SHAPEFILE_PATH.exists():
        raise FileNotFoundError(f"Shapefile not found: {config.SHAPEFILE_PATH}")
    
    gdf = gpd.read_file(config.SHAPEFILE_PATH)
    logger.info(f"Loaded {len(gdf)} LGA boundaries")
    logger.info(f"Shapefile CRS: {gdf.crs}")
    logger.info(f"Columns: {gdf.columns.tolist()}")
    
    return gdf


def load_state_mpi_data():
    """
    Load state-level MPI (Multidimensional Poverty Index) data.
    
    Returns:
        DataFrame: State-level poverty indicators
    """
    logger.info(f"Loading state MPI data from {config.STATE_MPI_CSV}")
    
    if not config.STATE_MPI_CSV.exists():
        logger.warning(f"State MPI file not found: {config.STATE_MPI_CSV}")
        return None
    
    # Skip the first row which contains metadata
    df = pd.read_csv(config.STATE_MPI_CSV, skiprows=1)
    logger.info(f"Loaded {len(df)} state records")
    
    return df


def load_senatorial_mpi_data():
    """
    Load senatorial district-level MPI data.
    
    Returns:
        DataFrame: Senatorial district poverty indicators
    """
    logger.info(f"Loading senatorial MPI data from {config.SENATORIAL_MPI_CSV}")
    
    if not config.SENATORIAL_MPI_CSV.exists():
        logger.warning(f"Senatorial MPI file not found: {config.SENATORIAL_MPI_CSV}")
        return None
    
    df = pd.read_csv(config.SENATORIAL_MPI_CSV)
    
    # Clean column names (remove BOM and extra characters)
    df.columns = df.columns.str.replace('ï»¿', '').str.strip()
    
    logger.info(f"Loaded {len(df)} senatorial district records")
    logger.info(f"Columns: {df.columns.tolist()}")
    
    return df


def load_processed_hotspots():
    """
    Load the existing processed hotspots CSV.
    This file contains LGA names, coordinates, and initial cluster labels.
    
    Returns:
        DataFrame: Processed LGA data with coordinates
    """
    logger.info(f"Loading processed hotspots from {config.PROCESSED_HOTSPOTS_CSV}")
    
    if not config.PROCESSED_HOTSPOTS_CSV.exists():
        raise FileNotFoundError(f"Processed hotspots file not found: {config.PROCESSED_HOTSPOTS_CSV}")
    
    df = pd.read_csv(config.PROCESSED_HOTSPOTS_CSV)
    logger.info(f"Loaded {len(df)} LGA records")
    logger.info(f"Columns: {df.columns.tolist()}")
    
    return df


def merge_poverty_data(lga_gdf, state_mpi_df, senatorial_mpi_df):
    """
    Merge poverty indicators from state and senatorial data into LGA geodataframe.
    
    Args:
        lga_gdf: GeoDataFrame with LGA boundaries
        state_mpi_df: DataFrame with state-level poverty data
        senatorial_mpi_df: DataFrame with senatorial-level poverty data
    
    Returns:
        GeoDataFrame: LGA data enriched with poverty indicators
    """
    logger.info("Merging poverty data with LGA boundaries")
    
    # Create a working copy
    result = lga_gdf.copy()
    
    # Standardize state names for matching
    # The shapefile likely has a state column - need to check actual column names
    if 'ADM1_EN' in result.columns:
        state_col = 'ADM1_EN'
    elif 'StateName' in result.columns:
        state_col = 'StateName'
    elif 'State' in result.columns:
        state_col = 'State'
    else:
        logger.warning("Could not find state column in shapefile")
        state_col = None
    
    # If we have state-level data and a state column, merge it
    if state_mpi_df is not None and state_col is not None:
        # Clean state names
        state_mpi_df = state_mpi_df.copy()
        state_mpi_df['State_Clean'] = state_mpi_df['Admin 1 Name'].str.strip()
        result['State_Clean'] = result[state_col].str.strip()
        
        # Merge state-level MPI data
        result = result.merge(
            state_mpi_df[['State_Clean', 'MPI', 'Headcount Ratio', 
                         'Intensity of Deprivation', 'In Severe Poverty']],
            on='State_Clean',
            how='left',
            suffixes=('', '_state')
        )
        logger.info("Merged state-level MPI data")
    
    return result
