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
    
    VIIRS Median Masked dataset convention:
    - NaN / nodata values represent DARK areas (no detectable light = extreme poverty)
    - These are converted to 0.0 intensity, NOT discarded.
    - Only pixels outside the raster bounds are truly missing.
    Args:
        geometry: Shapely geometry of the LGA polygon
        raster_src: Open rasterio dataset
    
    Returns:
        float: Mean nightlight intensity for the LGA, or 0.0 if geometry is outside raster bounds
    """
    try:
        # Check if the geometry intersects the raster bounds at all
        from shapely.geometry import box
        raster_bounds = box(
            raster_src.bounds.left, raster_src.bounds.bottom,
            raster_src.bounds.right, raster_src.bounds.top
        )
        if not geometry.intersects(raster_bounds):
            logger.warning("Geometry is completely outside raster bounds - returning 0.0")
            return 0.0

        # Use rasterio.mask to extract only pixels within the polygon.
        # filled=False returns a numpy masked array so we can distinguish
        # between the raster's native nodata and the mask's fill area.
        out_image, out_transform = mask(
            raster_src, [geometry], crop=True, filled=False
        )
        
        # Get the first band as a masked array
        masked_data = out_image[0]  # numpy.ma.MaskedArray
        
        # Total pixels in the cropped window
        total_pixels = masked_data.size
        
        if total_pixels == 0:
            logger.warning("Cropped window has 0 pixels - geometry may be too small")
            return 0.0
        
        # --- VIIRS Median Masked handling ---
        # In this dataset NaN/nodata pixels represent DARK areas (0 light),
        # NOT missing data. Convert the masked array to a regular array
        # where masked (NaN/nodata) values become 0.0 (no light).
        data = np.where(masked_data.mask, 0.0, masked_data.data).astype(np.float64)
        # Sanitise: negative values are sensor artefacts → clamp to 0
        data = np.clip(data, 0.0, None)
        # Discard only extreme outlier values (>9999) which are sensor errors
        data[data > 9999] = 0.0
        # Compute mean over ALL pixels (including the 0s that represent darkness)
        mean_intensity = float(np.mean(data))
        # Diagnostic logging for the first few calls
        n_dark = int(np.sum(data == 0.0))
        n_lit = int(np.sum(data > 0.0))
        logger.debug(
            f"LGA pixels: {total_pixels} total, {n_lit} lit, {n_dark} dark "
            f"→ mean intensity = {mean_intensity:.4f}"
        )
        return mean_intensity
    except ValueError as ve:
        # rasterio raises ValueError when the geometry doesn't overlap the raster
        logger.warning(f"Geometry does not overlap raster: {ve}")
        return 0.0
    except Exception as e:
        logger.error(f"Error extracting nightlight data: {str(e)}")
        return 0.0


def extract_nightlight_features_from_raster(gdf, raster_path):
    """
    Extract mean nightlight intensity for all LGAs from VIIRS raster.
    Uses windowed/masked reading to handle the 10GB file without loading it all into memory.
    
    Args:
        gdf: GeoDataFrame with LGA boundaries
        raster_path: Path to VIIRS raster file (10.8GB) - can be string or Path object
    
    Returns:
        GeoDataFrame: Input GDF with added 'mean_nightlight_intensity' column
    """
    logger.info(f"Starting nightlight extraction from {raster_path}")
    logger.info("Using memory-safe windowed reading to prevent Memory Error")
    
    # Ensure raster_path is a Path object for consistent handling
    raster_path = Path(raster_path)
    
    if not raster_path.exists():
        logger.error(f"VIIRS raster file not found: {raster_path}")
        logger.warning("Generating synthetic nightlight data for testing purposes")
        return generate_synthetic_nightlight_data(gdf)
    
    # Step 1: Verify the VIIRS file path and size
    file_size_bytes = raster_path.stat().st_size
    file_size_gb = file_size_bytes / (1024 ** 3)
    logger.info(f"VIIRS file size: {file_size_gb:.2f} GB ({file_size_bytes:,} bytes)")
    
    if file_size_gb < 0.1:  # Less than 100 MB
        logger.warning(f"VIIRS file size is unusually small ({file_size_gb:.2f} GB)")
        logger.warning("Expected ~10-11 GB for full VIIRS dataset. File may be corrupted or incomplete.")
    
    # Open the raster file
    with rasterio.open(raster_path) as src:
        logger.info("Raster opened successfully")
        logger.info(f"Raster dimensions: {src.width} x {src.height}")
        logger.info(f"Raster CRS: {src.crs}")
        logger.info(f"Raster bounds: {src.bounds}")
        logger.info(f"Raster data type: {src.dtypes[0]}")
        logger.info(f"Raster nodata value: {src.nodata}")
        
        # Step 2: Print bounding boxes to verify overlap
        logger.info("=" * 80)
        logger.info("SPATIAL BOUNDS VERIFICATION")
        logger.info("=" * 80)
        logger.info(f"Shapefile bounds (Nigeria): {gdf.total_bounds}")
        logger.info(f"  Min Longitude: {gdf.total_bounds[0]:.4f}")
        logger.info(f"  Min Latitude:  {gdf.total_bounds[1]:.4f}")
        logger.info(f"  Max Longitude: {gdf.total_bounds[2]:.4f}")
        logger.info(f"  Max Latitude:  {gdf.total_bounds[3]:.4f}")
        logger.info(f"Raster bounds (Global): {src.bounds}")
        logger.info(f"  Min Longitude: {src.bounds.left:.4f}")
        logger.info(f"  Min Latitude:  {src.bounds.bottom:.4f}")
        logger.info(f"  Max Longitude: {src.bounds.right:.4f}")
        logger.info(f"  Max Latitude:  {src.bounds.top:.4f}")
        
        # Check if bounds overlap
        shapefile_minx, shapefile_miny, shapefile_maxx, shapefile_maxy = gdf.total_bounds
        raster_minx, raster_miny, raster_maxx, raster_maxy = src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top
        
        overlap_x = not (shapefile_maxx < raster_minx or shapefile_minx > raster_maxx)
        overlap_y = not (shapefile_maxy < raster_miny or shapefile_miny > raster_maxy)
        
        if overlap_x and overlap_y:
            logger.info("Bounds overlap confirmed - Shapefile and Raster intersect spatially")
        else:
            logger.error("NO SPATIAL OVERLAP DETECTED!")
            logger.error("  This likely indicates a coordinate system mismatch (lat/lon flip)")
            logger.error("  Shapefile and Raster do not intersect - extraction will fail")
        logger.info("=" * 80)
        
        # Sample a few pixels from the raster to verify data is present
        logger.info("Sampling raster data to verify content...")
        try:
            # Read a small window from the center of the raster
            if src.width >= 200 and src.height >= 200:
                center_x = src.width // 2
                center_y = src.height // 2
                window = rasterio.windows.Window(center_x - 100, center_y - 100, 200, 200)
            else:
                logger.info(
                    "Raster dimensions are smaller than 200x200 "
                    f"({src.width} x {src.height}); sampling full raster extent instead."
                )
                window = rasterio.windows.Window(0, 0, src.width, src.height)
            sample_data = src.read(1, window=window)
            
            # Count NaN/nodata pixels in the sample to show dataset characteristics
            n_nan = int(np.isnan(sample_data).sum()) if np.issubdtype(sample_data.dtype, np.floating) else 0
            n_zero = int((sample_data == 0).sum())
            n_positive = int((sample_data > 0).sum())
            logger.info(
                f"Sample window stats: {sample_data.size} pixels total, "
                f"{n_positive} positive, {n_zero} zero, {n_nan} NaN/nodata"
            )
            sample_valid = sample_data[np.isfinite(sample_data) & (sample_data > 0) & (sample_data < 9999)]
            if len(sample_valid) > 0:
                logger.info(f"Lit pixel stats: min={sample_valid.min():.2f}, max={sample_valid.max():.2f}, "
                          f"mean={sample_valid.mean():.2f}, count={len(sample_valid)}")
            else:
                logger.info("Sample window contains no lit pixels (all dark or nodata - expected for VIIRS Median Masked)")
        except Exception as e:
            logger.warning(f"Could not sample raster data: {e}")
        
        # Check and reproject shapefile if needed
        gdf_aligned = check_and_reproject_shapefile(gdf, src.crs)
        
        # Initialize list to store results
        nightlight_values = []
        
        # Iterate through each LGA polygon
        total_lgas = len(gdf_aligned)
        for idx, row in gdf_aligned.iterrows():
            if idx % 50 == 0:
                logger.info(f"Processing LGA {idx + 1}/{total_lgas}")
            
            # Log first few LGA geometries for debugging
            if idx < 3:
                logger.info(f"  LGA bounds: {row.geometry.bounds}")
            
            # Extract nightlight for this LGA
            mean_intensity = extract_nightlight_for_lga(row.geometry, src)
            nightlight_values.append(mean_intensity)
        
        # Add the nightlight values to the dataframe
        gdf_aligned['mean_nightlight_intensity'] = nightlight_values
        
        # Step 3: Handle NaN values gracefully - replace with 0.0
        nan_count = gdf_aligned['mean_nightlight_intensity'].isna().sum()
        if nan_count > 0:
            logger.warning(f"Found {nan_count} LGAs with NaN nightlight values")
            logger.info("Replacing NaN values with 0.0 to prevent downstream errors")
            gdf_aligned['mean_nightlight_intensity'] = gdf_aligned['mean_nightlight_intensity'].fillna(0.0)
        
        logger.info("Nightlight extraction complete")
        logger.info(f"Valid values: {(gdf_aligned['mean_nightlight_intensity'] > 0).sum()}/{total_lgas}")
        logger.info(f"Zero values: {(gdf_aligned['mean_nightlight_intensity'] == 0).sum()}/{total_lgas}")
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
    
    logger.info("Generated synthetic nightlight values")
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
        
        # Find state name column in shapefile using config constant
        state_col_shapefile = None
        for col in config.STATE_NAME_COLUMNS:
            if col in gdf_with_nightlight.columns:
                state_col_shapefile = col
                break
        if lga_col_shapefile:
            # Build merge columns list
            merge_cols = [lga_col_shapefile, 'mean_nightlight_intensity']
            if state_col_shapefile:
                merge_cols.append(state_col_shapefile)
            merge_data = gdf_with_nightlight[merge_cols].copy()
            # Normalize LGA names for merging (strip + lowercase)
            merge_data['LGA_Name_merge'] = (
                merge_data[lga_col_shapefile].astype(str).str.strip().str.lower()
            )
            
            result = processed_df.copy()
            result['LGA_Name_merge'] = (
                result['LGA_Name'].astype(str).str.strip().str.lower()
            )
            # Merge on BOTH LGA name AND state to avoid duplicates
            if state_col_shapefile and 'State' in result.columns:
                merge_data['State_merge'] = (
                    merge_data[state_col_shapefile].astype(str).str.strip().str.lower()
                )
                result['State_merge'] = (
                    result['State'].astype(str).str.strip().str.lower()
                )
                merge_data_final = merge_data[['LGA_Name_merge', 'State_merge', 'mean_nightlight_intensity']]
                # Drop duplicates to be safe (in case shapefile has exact dupes)
                merge_data_final = merge_data_final.drop_duplicates(
                    subset=['LGA_Name_merge', 'State_merge']
                )
                result = result.merge(
                    merge_data_final,
                    on=['LGA_Name_merge', 'State_merge'],
                    how='left'
                )
                result.drop(columns=['LGA_Name_merge', 'State_merge'], inplace=True)
            else:
                # Fallback: LGA name only, but deduplicate merge_data first
                logger.warning(
                    "State column not found in shapefile — merging on LGA name only. "
                    "Duplicates may occur for LGAs with the same name in different states."
                )
                merge_data_final = merge_data[['LGA_Name_merge', 'mean_nightlight_intensity']]
                merge_data_final = merge_data_final.drop_duplicates(subset=['LGA_Name_merge'])
                result = result.merge(merge_data_final, on='LGA_Name_merge', how='left')
                result.drop(columns=['LGA_Name_merge'], inplace=True)
            logger.info(f"Merged nightlight data: {len(result)} records (expected {len(processed_df)})")
            # Safety check: ensure no row inflation
            if len(result) != len(processed_df):
                logger.error(
                    f"Row count mismatch after merge! "
                    f"Expected {len(processed_df)}, got {len(result)}. "
                    f"Dropping duplicates to recover."
                )
                result = result.drop_duplicates(
                    subset=['LGA_Name', 'State'], keep='first'
                )
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
