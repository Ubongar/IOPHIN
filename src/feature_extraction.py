"""
Feature extraction module for Nigeria Poverty Hotspot Identifier System.
Implements memory-safe extraction of nighttime light intensity from large VIIRS raster.
"""
import numpy as np
import geopandas as gpd
import rasterio
from rasterio.mask import mask
from rasterio.warp import calculate_default_transform, reproject, Resampling
import logging
from pathlib import Path

from . import config

# Module-level logger; configuration is handled by the application entrypoint.
logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())


def check_and_reproject_shapefile(gdf, raster_crs):
    """
    Check if shapefile and raster have the same CRS.
    If not, reproject the shapefile to match the raster.
    
    Args:
        gdf: GeoDataFrame to check/reproject
        raster_crs: CRS of the raster file
    
    Returns:
        GeoDataFrame: Reprojected if necessary
    """
    logger.info(f"Shapefile CRS: {gdf.crs}")
    logger.info(f"Raster CRS: {raster_crs}")
    
    if gdf.crs != raster_crs:
        logger.warning(f"CRS mismatch detected. Reprojecting shapefile from {gdf.crs} to {raster_crs}")
        gdf = gdf.to_crs(raster_crs)
        logger.info("Reprojection complete")
    else:
        logger.info("CRS match confirmed - no reprojection needed")
    
    return gdf


def extract_nightlight_for_lga(geometry, raster_src):
    """
    Extract mean nightlight intensity for a single LGA polygon using masked reading.
    This method reads only the pixels within the polygon, not the entire raster.
    
    Args:
        geometry: Shapely geometry of the LGA polygon
        raster_src: Open rasterio dataset
    
    Returns:
        float: Mean nightlight intensity for the LGA, or NaN if extraction fails
    """
    try:
        # Use rasterio.mask to extract only pixels within the polygon
        # This is memory-efficient as it only reads the windowed area
        out_image, out_transform = mask(raster_src, [geometry], crop=True, nodata=0)
        
        # Get the first band (VIIRS typically has a single band)
        data = out_image[0]
        
        # Filter out nodata values (usually 0 or negative values in nightlight data)
        valid_data = data[(data > 0) & (data < 9999)]  # Filter outliers
        
        if len(valid_data) > 0:
            mean_intensity = float(np.mean(valid_data))
            return mean_intensity
        else:
            logger.warning(f"No valid pixels found for geometry")
            return np.nan
            
    except Exception as e:
        logger.error(f"Error extracting nightlight data: {str(e)}")
        return np.nan


def extract_nightlight_features_from_raster(gdf, raster_path):
    """
    Extract mean nightlight intensity for all LGAs from VIIRS raster.
    Uses windowed/masked reading to handle the 10GB file without loading it all into memory.
    
    Args:
        gdf: GeoDataFrame with LGA boundaries
        raster_path: Path to VIIRS raster file (10.8GB)
    
    Returns:
        GeoDataFrame: Input GDF with added 'mean_nightlight_intensity' column
    """
    logger.info(f"Starting nightlight extraction from {raster_path}")
    logger.info("Using memory-safe windowed reading to prevent Memory Error")
    
    if not raster_path.exists():
        logger.error(f"VIIRS raster file not found: {raster_path}")
        logger.warning("Generating synthetic nightlight data for testing purposes")
        return generate_synthetic_nightlight_data(gdf)
    
    # Open the raster file
    with rasterio.open(raster_path) as src:
        logger.info(f"Raster opened successfully")
        logger.info(f"Raster dimensions: {src.width} x {src.height}")
        logger.info(f"Raster CRS: {src.crs}")
        logger.info(f"Raster bounds: {src.bounds}")
        
        # Check and reproject shapefile if needed
        gdf_aligned = check_and_reproject_shapefile(gdf, src.crs)
        
        # Initialize list to store results
        nightlight_values = []
        
        # Iterate through each LGA polygon
        total_lgas = len(gdf_aligned)
        for idx, row in gdf_aligned.iterrows():
            if idx % 50 == 0:
                logger.info(f"Processing LGA {idx + 1}/{total_lgas}")
            
            # Extract nightlight for this LGA
            mean_intensity = extract_nightlight_for_lga(row.geometry, src)
            nightlight_values.append(mean_intensity)
        
        # Add the nightlight values to the dataframe
        gdf_aligned['mean_nightlight_intensity'] = nightlight_values
        
        logger.info(f"Nightlight extraction complete")
        logger.info(f"Valid values: {gdf_aligned['mean_nightlight_intensity'].notna().sum()}/{total_lgas}")
        logger.info(f"Mean nightlight intensity: {gdf_aligned['mean_nightlight_intensity'].mean():.2f}")
        logger.info(f"Range: {gdf_aligned['mean_nightlight_intensity'].min():.2f} - {gdf_aligned['mean_nightlight_intensity'].max():.2f}")
    
    return gdf_aligned


def generate_synthetic_nightlight_data(gdf):
    """
    Generate synthetic nightlight data for testing when actual VIIRS file is not available.
    Creates realistic-looking values based on a simple model.
    
    Args:
        gdf: GeoDataFrame with LGA boundaries
    
    Returns:
        GeoDataFrame: Input GDF with added 'mean_nightlight_intensity' column
    """
    logger.info("Generating synthetic nightlight data (VIIRS file not available)")
    
    # Create a copy to avoid modifying original
    result = gdf.copy()
    
    # Generate synthetic values
    # Urban areas (Lagos, Abuja, Port Harcourt, Kano) typically have higher values (20-60)
    # Rural areas have lower values (0-15)
    np.random.seed(42)  # For reproducibility
    
    # Base value from latitude (lower latitudes tend to be more developed in Nigeria)
    if 'Latitude' in result.columns:
        base_value = (result['Latitude'].max() - result['Latitude']) * 2
    else:
        base_value = 10
    
    # Add random variation
    random_component = np.random.normal(5, 3, len(result))
    
    # Combine
    synthetic_values = base_value + random_component
    
    # Clip to reasonable range (0-60 for nightlights)
    synthetic_values = np.clip(synthetic_values, 0, 60)
    
    result['mean_nightlight_intensity'] = synthetic_values
    
    logger.info(f"Generated synthetic nightlight values")
    logger.info(f"Mean: {result['mean_nightlight_intensity'].mean():.2f}")
    logger.info(f"Range: {result['mean_nightlight_intensity'].min():.2f} - {result['mean_nightlight_intensity'].max():.2f}")
    
    return result


def extract_nightlight_from_processed_csv(processed_df, gdf):
    """
    Alternative method: Extract nightlight features by joining with shapefile,
    then use synthetic data if VIIRS is not available.
    
    Args:
        processed_df: DataFrame from processed_hotspots.csv
        gdf: GeoDataFrame with LGA boundaries
    
    Returns:
        DataFrame: processed_df with nightlight intensity added
    """
    logger.info("Extracting nightlight features for processed hotspots CSV")
    
    # Check if VIIRS file exists
    if config.VIIRS_RASTER_PATH.exists():
        # Extract from actual raster
        gdf_with_nightlight = extract_nightlight_features_from_raster(gdf, config.VIIRS_RASTER_PATH)
        
        # Prepare merge key - find LGA name column using config constant
        lga_col_shapefile = None
        for col in config.LGA_NAME_COLUMNS:
            if col in gdf_with_nightlight.columns:
                lga_col_shapefile = col
                break
        
        if lga_col_shapefile:
            # Merge nightlight data into processed_df
            merge_data = gdf_with_nightlight[[lga_col_shapefile, 'mean_nightlight_intensity']].copy()
            # Normalize LGA names for merging (strip + lowercase) to match CSV processing
            merge_data['LGA_Name_merge'] = (
                merge_data[lga_col_shapefile].astype(str).str.strip().str.lower()
            )
            merge_data = merge_data[['LGA_Name_merge', 'mean_nightlight_intensity']]
            
            # Try to match on LGA name
            result = processed_df.copy()
            result['LGA_Name_merge'] = (
                result['LGA_Name'].astype(str).str.strip().str.lower()
            )
            result = result.merge(merge_data, on='LGA_Name_merge', how='left')
            result.drop(columns=['LGA_Name_merge'], inplace=True)
        else:
            logger.warning("Could not find LGA name column for merging")
            result = processed_df.copy()
            result['mean_nightlight_intensity'] = np.nan
    else:
        # Use synthetic data
        logger.info("VIIRS file not found, using synthetic nightlight data")
        result = processed_df.copy()
        
        # Generate synthetic based on lat/lon if available
        if 'Latitude' in result.columns and 'Longitude' in result.columns:
            np.random.seed(42)
            base_value = (result['Latitude'].max() - result['Latitude']) * 2
            random_component = np.random.normal(5, 3, len(result))
            synthetic_values = np.clip(base_value + random_component, 0, 60)
            result['mean_nightlight_intensity'] = synthetic_values
        else:
            # Random values
            result['mean_nightlight_intensity'] = np.random.uniform(5, 30, len(result))
    
    logger.info(f"Nightlight extraction complete for {len(result)} LGAs")
    
    return result
