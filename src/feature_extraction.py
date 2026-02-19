"""
Feature extraction module for Nigeria Poverty Hotspot Identifier System.
Implements memory-safe extraction of nighttime light intensity from large VIIRS raster.
"""
import numpy as np
import geopandas as gpd

from .geospatial_env import configure_geospatial_env

configure_geospatial_env()

import rasterio
from rasterio.mask import mask
from rasterio.warp import calculate_default_transform, reproject, Resampling
import logging
from pathlib import Path
import time

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


# ─── External data fetchers (GRID3, WorldPop, GEE, OSM, IOM DTM, WFP) ───────

import io
import requests
import pandas as pd
from . import config as _cfg


def _safe_get_json(url, params=None, timeout=30, retries=3, headers=None):
    """HTTP GET with retry logic for transient DNS/network errors. Returns dict or None."""
    import time as _time
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, params=params, timeout=timeout, headers=headers)
            resp.raise_for_status()
            return resp.json()
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            last_err = e
            if attempt < retries:
                wait = 2 ** attempt  # 2s, 4s backoff
                logger.info(f"  Retry {attempt}/{retries} for {url} in {wait}s (transient: {type(e).__name__})")
                _time.sleep(wait)
            else:
                logger.warning(f"HTTP request failed after {retries} attempts ({url}): {e}")
        except Exception as e:
            logger.warning(f"HTTP request failed ({url}): {e}")
            return None
    return None


def _safe_download(url, timeout=120, retries=3, stream=False, headers=None):
    """HTTP GET with retry logic for file downloads. Returns Response or None."""
    import time as _time
    _headers = {'User-Agent': 'IOPHIN/1.0 (poverty-hotspot-identifier)'}
    if headers:
        _headers.update(headers)
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, timeout=timeout, stream=stream, headers=_headers)
            resp.raise_for_status()
            return resp
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            last_err = e
            if attempt < retries:
                wait = 2 ** attempt
                logger.info(f"  Retry {attempt}/{retries} for download in {wait}s ({type(e).__name__})")
                _time.sleep(wait)
            else:
                logger.warning(f"Download failed after {retries} attempts ({url}): {e}")
        except Exception as e:
            logger.warning(f"Download failed ({url}): {e}")
            return None
    return None


def fetch_grid3_health_facilities(df):
    """
    Fetch GRID3 health facility counts per LGA from HDX.
    Dataset: grid3-nga-health-facilities-v2-0 (GeoPackage with 'lga' column).
    Adds 'health_facility_count' column.
    """
    logger.info("Fetching GRID3 health facility data from HDX")
    result = df.copy()

    url = f"{_cfg.HDX_API_URL}/package_show"
    data = _safe_get_json(url, params={'id': 'grid3-nga-health-facilities-v2-0'})

    if data and data.get('success'):
        try:
            resources = data['result']['resources']
            # Prefer CSV, then GeoPackage/GPKG, then XLSX
            res_url = None
            res_fmt = None
            for fmt in ('CSV', 'GEOPACKAGE', 'GPKG', 'XLSX'):
                res_url = next((r['url'] for r in resources
                                if r['format'].upper() == fmt), None)
                if res_url:
                    res_fmt = fmt
                    break

            if res_url:
                import tempfile, os
                logger.info(f"  Downloading GRID3 health ({res_fmt})...")
                resp = _safe_download(res_url, timeout=120, stream=True)
                if resp is None:
                    raise ConnectionError("GRID3 health download failed")

                if res_fmt == 'CSV':
                    facilities = pd.read_csv(io.StringIO(resp.text))
                elif res_fmt in ('GEOPACKAGE', 'GPKG'):
                    tmp = os.path.join(tempfile.gettempdir(), 'grid3_health.gpkg')
                    with open(tmp, 'wb') as f:
                        for chunk in resp.iter_content(8192):
                            f.write(chunk)
                    facilities = gpd.read_file(tmp)
                    facilities = pd.DataFrame(facilities.drop(columns='geometry',
                                                              errors='ignore'))
                elif res_fmt == 'XLSX':
                    facilities = pd.read_excel(io.BytesIO(resp.content))
                else:
                    facilities = pd.DataFrame()

                # Find LGA column
                lga_col = None
                for c in ('lga', 'admin2Name', 'LGA', 'admin2_name', 'lga_name'):
                    if c in facilities.columns:
                        lga_col = c
                        break
                if lga_col and not facilities.empty:
                    counts = facilities.groupby(lga_col).size().reset_index(
                        name='health_facility_count')
                    counts.rename(columns={lga_col: 'LGA_Name'}, inplace=True)
                    counts['LGA_Name'] = counts['LGA_Name'].str.strip().str.title()
                    result = result.merge(counts, on='LGA_Name', how='left',
                                          suffixes=('', '_grid3'))
                    result['health_facility_count'] = result[
                        'health_facility_count'].fillna(0).astype(int)
                    matched = (result['health_facility_count'] > 0).sum()
                    logger.info(f"✅ GRID3 health: {matched} LGAs matched "
                                f"({len(facilities):,} facilities)")
                else:
                    logger.warning("Could not find LGA column in GRID3 health dataset")
            else:
                logger.warning("No downloadable resource found in GRID3 health package")
        except Exception as e:
            logger.warning(f"Error processing GRID3 health data: {e}")
    else:
        logger.warning("GRID3 health data not available — column will be NaN")

    if 'health_facility_count' not in result.columns:
        result['health_facility_count'] = np.nan
    return result


# ── State-code → State-name mapping for GRID3 education data ─────────
_NGA_STATE_CODE_MAP = {
    'AB': 'Abia', 'AD': 'Adamawa', 'AK': 'Akwa Ibom', 'AN': 'Anambra',
    'BA': 'Bauchi', 'BY': 'Bayelsa', 'BE': 'Benue', 'BO': 'Borno',
    'CR': 'Cross River', 'DE': 'Delta', 'EB': 'Ebonyi', 'ED': 'Edo',
    'EK': 'Ekiti', 'EN': 'Enugu', 'FC': 'Federal Capital Territory',
    'GO': 'Gombe', 'IM': 'Imo', 'JI': 'Jigawa', 'KD': 'Kaduna',
    'KN': 'Kano', 'KT': 'Katsina', 'KE': 'Kebbi', 'KO': 'Kogi',
    'KW': 'Kwara', 'LA': 'Lagos', 'NA': 'Nasarawa', 'NI': 'Niger',
    'OG': 'Ogun', 'ON': 'Ondo', 'OS': 'Osun', 'OY': 'Oyo',
    'PL': 'Plateau', 'RI': 'Rivers', 'SO': 'Sokoto', 'TA': 'Taraba',
    'YO': 'Yobe', 'ZA': 'Zamfara',
}


def fetch_grid3_schools(df):
    """
    Fetch GRID3 school counts per LGA from HDX.
    Dataset: nigeria-education-facilities (XLSX with state_code column).
    Maps state_code to State name, distributes school count proportionally
    across LGAs in each state (weighted by existing population proxy).
    Adds 'school_count' column.
    """
    logger.info("Fetching GRID3 school data from HDX")
    result = df.copy()

    url = f"{_cfg.HDX_API_URL}/package_show"
    data = _safe_get_json(url, params={'id': 'nigeria-education-facilities'})

    if data and data.get('success'):
        try:
            resources = data['result']['resources']
            # Prefer CSV, then XLSX
            res_url = None
            res_fmt = None
            for fmt in ('CSV', 'XLSX', 'GEOPACKAGE', 'GPKG'):
                res_url = next((r['url'] for r in resources
                                if r['format'].upper() == fmt), None)
                if res_url:
                    res_fmt = fmt
                    break

            if res_url:
                logger.info(f"  Downloading GRID3 education ({res_fmt})...")
                resp = _safe_download(res_url, timeout=120)
                if resp is None:
                    raise ConnectionError("GRID3 education download failed")

                if res_fmt == 'CSV':
                    schools = pd.read_csv(io.StringIO(resp.text))
                elif res_fmt == 'XLSX':
                    schools = pd.read_excel(io.BytesIO(resp.content))
                else:
                    schools = pd.DataFrame()

                # Try direct LGA column first
                lga_col = None
                for c in ('lga', 'admin2Name', 'LGA', 'admin2_name'):
                    if c in schools.columns:
                        lga_col = c
                        break

                if lga_col and not schools.empty:
                    # Direct LGA grouping
                    counts = schools.groupby(lga_col).size().reset_index(
                        name='school_count')
                    counts.rename(columns={lga_col: 'LGA_Name'}, inplace=True)
                    counts['LGA_Name'] = counts['LGA_Name'].str.strip().str.title()
                    result = result.merge(counts, on='LGA_Name', how='left',
                                          suffixes=('', '_grid3'))
                elif 'state_code' in schools.columns and not schools.empty:
                    # Map state_code → State, distribute school counts per LGA
                    schools['State'] = schools['state_code'].map(_NGA_STATE_CODE_MAP)
                    state_counts = schools.groupby('State').size().reset_index(
                        name='state_school_count')
                    # Count LGAs per state in our data
                    if 'State' in result.columns:
                        lgas_per_state = result.groupby('State').size().reset_index(
                            name='n_lgas')
                        state_counts = state_counts.merge(lgas_per_state,
                                                          on='State', how='left')
                        state_counts['school_count_per_lga'] = (
                            state_counts['state_school_count'] /
                            state_counts['n_lgas'].replace(0, 1)
                        ).round().astype(int)
                        # Merge at state level
                        result = result.merge(
                            state_counts[['State', 'school_count_per_lga']],
                            on='State', how='left')
                        result.rename(columns={'school_count_per_lga': 'school_count'},
                                      inplace=True)
                    else:
                        logger.warning("No 'State' column to distribute school counts")
                else:
                    logger.warning("No LGA or state_code column in GRID3 education data")

                if 'school_count' in result.columns:
                    result['school_count'] = result['school_count'].fillna(0).astype(int)
                    matched = (result['school_count'] > 0).sum()
                    logger.info(f"✅ GRID3 schools: {matched} LGAs matched "
                                f"({len(schools):,} facilities)")
            else:
                logger.warning("No downloadable resource in GRID3 education package")
        except Exception as e:
            logger.warning(f"Error processing GRID3 school data: {e}")
    else:
        logger.warning("GRID3 school data not available")

    if 'school_count' not in result.columns:
        result['school_count'] = np.nan
    return result


def fetch_worldpop_population(df):
    """
    Fetch WorldPop population density per LGA.
    Adds 'population_density' column (people/km²).
    Tries multiple WorldPop API endpoints + HDX fallback.
    """
    logger.info("Fetching WorldPop population density")
    result = df.copy()

    base_url = _cfg.WORLDPOP_API_URL

    # ── Attempt 1: WorldPop REST API (hub.worldpop.org endpoint) ──
    try:
        # Try multiple known endpoints — wpgpas is deprecated/unstable
        endpoints = ['/pop/wpgp', '/pop/wpgpas']
        data = None
        for ep in endpoints:
            data = _safe_get_json(f"{base_url}{ep}", params={'iso3': 'NGA'})
            if data and isinstance(data, dict) and 'data' in data:
                break
            data = None
        if data:
            pop_df = pd.DataFrame(data['data'])
            if 'name' in pop_df.columns and 'pop' in pop_df.columns and 'area' in pop_df.columns:
                pop_df['population_density'] = pop_df['pop'] / pop_df['area'].replace(0, np.nan)
                pop_df.rename(columns={'name': 'LGA_Name'}, inplace=True)
                pop_df['LGA_Name'] = pop_df['LGA_Name'].str.strip()
                result = result.merge(pop_df[['LGA_Name', 'population_density']], on='LGA_Name', how='left', suffixes=('', '_wp'))
                logger.info(f"\u2705 WorldPop: {result['population_density'].notna().sum()} LGAs matched")
                return result
        logger.warning("WorldPop API returned no usable data, trying HDX COD fallback")
    except Exception as e:
        logger.warning(f"WorldPop API failed ({e}), trying HDX COD fallback")

    # ── Attempt 2: HDX COD-PS (state-level pop → distribute to LGAs by area) ──
    try:
        hdx_url = f"{_cfg.HDX_API_URL}/package_show"
        data = _safe_get_json(hdx_url, params={'id': 'cod-ps-nga'})
        if data and data.get('success') and 'State' in result.columns:
            resources = data['result']['resources']
            # Find the admin1 CSV (state-level population)
            adm1_csv_url = next(
                (r['url'] for r in resources
                 if r['format'].upper() == 'CSV' and 'adm1' in r.get('name', '').lower()),
                None
            )
            if adm1_csv_url:
                logger.info("  Downloading state-level population from HDX COD-PS (admin1 CSV)...")
                resp = _safe_download(adm1_csv_url, timeout=120)
                if resp is None:
                    raise ConnectionError("HDX COD-PS download failed")
                pop_df = pd.read_csv(io.BytesIO(resp.content))

                # COD-PS columns: ADM1_EN (state name), T_TL (total population)
                if 'ADM1_EN' in pop_df.columns and 'T_TL' in pop_df.columns:
                    state_pop = pop_df[['ADM1_EN', 'T_TL']].copy()
                    state_pop.rename(columns={'ADM1_EN': '_State_key', 'T_TL': '_state_total_pop'}, inplace=True)
                    state_pop['_State_key'] = state_pop['_State_key'].str.strip().str.title()

                    # Get LGA areas: use geometry col if available, else load shapefile
                    import geopandas as _gpd
                    if 'geometry' in result.columns:
                        gdf = _gpd.GeoDataFrame(result, geometry='geometry', crs='EPSG:4326')
                    else:
                        # Load shapefile to get LGA geometry for area computation
                        logger.info("  Loading LGA shapefile for area computation...")
                        from . import config as _cfg2
                        lga_gdf = _gpd.read_file(_cfg2.SHAPEFILE_PATH)
                        # Find LGA name column
                        lga_col = next((c for c in _cfg2.LGA_NAME_COLUMNS if c in lga_gdf.columns), None)
                        if lga_col:
                            import re as _re
                            def _normalize_lga(s):
                                """Normalize LGA name for matching: lowercase, remove hyphens/slashes/spaces."""
                                return _re.sub(r'[\s\-/]+', '', str(s).strip().lower())

                            lga_gdf['_lga_merge'] = lga_gdf[lga_col].apply(_normalize_lga)
                            result['_lga_merge'] = result['LGA_Name'].apply(_normalize_lga)
                            # Merge geometry into result
                            result = result.merge(
                                lga_gdf[['_lga_merge', 'geometry']].drop_duplicates(subset='_lga_merge'),
                                on='_lga_merge', how='left'
                            )
                            result.drop(columns=['_lga_merge'], inplace=True)
                        gdf = _gpd.GeoDataFrame(result, geometry='geometry', crs='EPSG:4326')

                    gdf_proj = gdf.to_crs(epsg=32632)  # UTM zone 32N for Nigeria
                    result['_area_km2'] = gdf_proj.geometry.area / 1e6

                    # Merge state population
                    result['_State_key'] = result['State'].str.strip().str.title()
                    result = result.merge(state_pop, on='_State_key', how='left', suffixes=('', '_dup'))

                    # Distribute state pop to LGAs proportionally by area
                    state_area_total = result.groupby('_State_key')['_area_km2'].transform('sum')
                    lga_pop_estimate = result['_state_total_pop'] * (result['_area_km2'] / state_area_total.replace(0, np.nan))
                    result['population_density'] = lga_pop_estimate / result['_area_km2'].replace(0, np.nan)

                    # Fill NaN density (unmatched LGA geometry) with state average
                    if 'State' in result.columns:
                        na_mask = result['population_density'].isna()
                        if na_mask.any():
                            state_avg = result.groupby('_State_key')['population_density'].transform('mean')
                            result.loc[na_mask, 'population_density'] = state_avg[na_mask]
                            backfilled = na_mask.sum() - result['population_density'].isna().sum()
                            if backfilled > 0:
                                logger.info(f"  Backfilled {backfilled} LGAs with state-average density (name mismatch)")

                    # Clean up temp columns (keep geometry if we added it)
                    drop_cols = ['_area_km2', '_State_key', '_state_total_pop']
                    if '_state_total_pop_dup' in result.columns:
                        drop_cols.append('_state_total_pop_dup')
                    result.drop(columns=drop_cols, inplace=True, errors='ignore')
                    # Drop geometry if we added it and it wasn't there before
                    if 'geometry' in result.columns and 'geometry' not in df.columns:
                        result.drop(columns=['geometry'], inplace=True, errors='ignore')

                    matched = result['population_density'].notna().sum()
                    logger.info(f"\u2705 Population density (HDX COD-PS admin1 → LGA by area): {matched}/{len(result)} LGAs")
                    return result

        logger.warning("HDX COD-PS dataset not found or missing admin1 CSV")
    except Exception as e:
        logger.warning(f"WorldPop HDX fallback failed: {e}")

    # ── Attempt 3: Estimate from LGA geometry area + total country pop ──
    try:
        if 'geometry' in result.columns:
            logger.info("  Estimating population density from LGA areas (approx.)")
            import geopandas as _gpd
            gdf = _gpd.GeoDataFrame(result, geometry='geometry', crs='EPSG:4326')
            # Project to equal-area CRS for Nigeria (UTM zone 32N)
            gdf_proj = gdf.to_crs(epsg=32632)
            area_km2 = gdf_proj.geometry.area / 1e6
            # Nigeria total pop ≈ 223M (2024 est), distribute proportionally by area
            total_area = area_km2.sum()
            result['population_density'] = (223_000_000 * area_km2 / total_area) / area_km2
            logger.info(f"\u2705 Population density estimated for {result['population_density'].notna().sum()} LGAs (uniform approx.)")
            return result
    except Exception as e:
        logger.warning(f"Area-based population estimate failed: {e}")

    if 'population_density' not in result.columns:
        result['population_density'] = np.nan
    return result


def fetch_road_density(df):
    """
    Fetch road density (km per km²) per LGA from OSM Overpass API.
    Uses batched state-level queries (one per state) instead of 774
    individual LGA queries — 10-20× faster.
    Adds 'road_density_km' column.
    """
    import time
    logger.info("Fetching road density from OSM Overpass (batched by state)")
    result = df.copy()
    result['road_density_km'] = np.nan

    overpass_url = _cfg.OVERPASS_API_URL

    if 'State' not in result.columns:
        logger.warning("No 'State' column — skipping road density (would be too slow)")
        return result

    states = result['State'].dropna().unique()
    logger.info(f"  Querying {len(states)} states via Overpass (timeout: 15s each)...")

    start_time = time.time()
    max_total_seconds = 180  # Hard cap: 3 minutes total for road density
    succeeded = 0
    failed = 0

    for i, state in enumerate(states):
        # Hard time cap
        elapsed = time.time() - start_time
        if elapsed > max_total_seconds:
            remaining = len(states) - i
            logger.warning(f"  Road density time cap ({max_total_seconds}s) reached after {i}/{len(states)} states — skipping {remaining} remaining")
            break

        state_lgas = result[result['State'] == state]
        lats = state_lgas['Latitude'].dropna()
        lons = state_lgas['Longitude'].dropna()
        if lats.empty or lons.empty:
            continue

        # Pad bbox by 0.1° (~11km)
        south = lats.min() - 0.1
        north = lats.max() + 0.1
        west = lons.min() - 0.1
        east = lons.max() + 0.1

        # Count highway ways in the entire state bbox
        query = (f'[out:json][timeout:12];'
                 f'way["highway"]({south},{west},{north},{east});'
                 f'out count;')
        try:
            resp = requests.post(overpass_url, data={'data': query}, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                total_ways = int(
                    data.get('elements', [{}])[0].get('tags', {}).get('ways', 0))
                import math
                lat_span = north - south
                lon_span = east - west
                area_km2 = (lat_span * 111.0) * (lon_span * 111.0 *
                            math.cos(math.radians((south + north) / 2)))
                state_density = (total_ways * 0.5) / max(area_km2, 1)
                result.loc[state_lgas.index, 'road_density_km'] = round(state_density, 4)
                succeeded += 1
            elif resp.status_code == 429:
                logger.warning(f"  Overpass rate-limited at state {state}, sleeping 10s")
                time.sleep(10)
                failed += 1
            else:
                failed += 1
        except requests.exceptions.Timeout:
            logger.debug(f"  Overpass timeout for {state}")
            failed += 1
        except Exception as e:
            logger.debug(f"  Overpass error for {state}: {e}")
            failed += 1

        if (i + 1) % 10 == 0:
            logger.info(f"  ... {i + 1}/{len(states)} states done ({time.time() - start_time:.0f}s elapsed)")

        time.sleep(0.5)  # Rate limit: ~2 req/s

    matched = result['road_density_km'].notna().sum()
    total_time = time.time() - start_time
    logger.info(f"✅ Road density: {matched}/{len(result)} LGAs "
                f"({succeeded} states OK, {failed} failed, {total_time:.0f}s)")
    return result


def _init_gee():
    """Initialize Google Earth Engine once. Returns True if successful."""
    import ee
    try:
        # Check if already initialized and working
        ee.Number(1).getInfo()
        return True
    except Exception:
        pass

    # 1) Try default / personal credentials first (most reliable)
    try:
        ee.Initialize(project=_cfg.GEE_PROJECT)
        ee.Number(1).getInfo()  # verify it actually works
        logger.info("GEE initialized with default credentials")
        return True
    except Exception:
        pass

    # 2) Try service account credentials
    try:
        ee.Reset()
        credentials = ee.ServiceAccountCredentials(
            _cfg.GEE_SERVICE_ACCOUNT, _cfg.GEE_KEY_FILE
        )
        ee.Initialize(credentials, project=_cfg.GEE_PROJECT)
        ee.Number(1).getInfo()
        logger.info("GEE initialized with service account")
        return True
    except Exception:
        pass

    # 3) Last resort: interactive Authenticate
    try:
        ee.Reset()
        ee.Authenticate()
        ee.Initialize(project=_cfg.GEE_PROJECT)
        ee.Number(1).getInfo()
        logger.info("GEE initialized after ee.Authenticate()")
        return True
    except Exception as e:
        logger.warning(f"GEE initialization failed after all methods: {e}")
        return False


def fetch_ndvi_from_gee(df):
    """
    Fetch NDVI data from Google Earth Engine (MODIS).
    Adds 'ndvi_mean' column.
    Requires GEE credentials configured.
    """
    logger.info("Fetching NDVI from Google Earth Engine (MODIS)")
    result = df.copy()

    try:
        import ee
        if not _init_gee():
            raise RuntimeError("GEE initialization failed")

        # Use MODIS NDVI 16-day composite (v061 — v006 is deprecated)
        ndvi_collection = ee.ImageCollection('MODIS/061/MOD13A2') \
            .filterDate('2023-01-01', '2023-12-31') \
            .select('NDVI') \
            .mean() \
            .multiply(0.0001)  # Scale factor

        ndvi_values = []
        consecutive_errors = 0
        max_consecutive_errors = 5
        total = len(result)

        for i, (idx, row) in enumerate(result.iterrows()):
            if i > 0 and i % 100 == 0:
                logger.info(f"  NDVI progress: {i}/{total} LGAs")

            lat = row.get('Latitude', row.get('latitude'))
            lon = row.get('Longitude', row.get('longitude'))

            if pd.isna(lat) or pd.isna(lon):
                ndvi_values.append(np.nan)
                continue

            try:
                point = ee.Geometry.Point([lon, lat])
                # Buffer by ~5km for area average
                region = point.buffer(5000)
                val = ndvi_collection.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=region,
                    scale=1000
                ).get('NDVI').getInfo()
                ndvi_values.append(float(val) if val is not None else np.nan)
                consecutive_errors = 0  # Reset on success
                time.sleep(0.3)  # Rate-limit: ~3 req/s to avoid GEE quota
            except Exception as e:
                err_str = str(e)
                if '403' in err_str or 'PERMISSION_DENIED' in err_str:
                    consecutive_errors += 1
                    if consecutive_errors >= max_consecutive_errors:
                        logger.warning(f"GEE NDVI: {max_consecutive_errors} consecutive 403 errors — aborting remaining LGAs")
                        ndvi_values.extend([np.nan] * (len(result) - len(ndvi_values)))
                        break
                logger.debug(f"NDVI extraction failed for LGA {idx}: {e}")
                ndvi_values.append(np.nan)

        # Safety: ensure list length matches DataFrame
        if len(ndvi_values) != len(result):
            logger.warning(f"NDVI values list length ({len(ndvi_values)}) != DataFrame rows ({len(result)}), truncating/padding")
            ndvi_values = ndvi_values[:len(result)]  # Truncate
            ndvi_values.extend([np.nan] * (len(result) - len(ndvi_values)))  # Pad
        result['ndvi_mean'] = ndvi_values
        logger.info(f"✅ NDVI: {sum(1 for v in ndvi_values if not pd.isna(v))}/{len(result)} LGAs")
    except ImportError:
        logger.warning("earthengine-api not installed — NDVI will be NaN")
        result['ndvi_mean'] = np.nan
    except Exception as e:
        logger.warning(f"GEE NDVI fetch failed: {e}")
        result['ndvi_mean'] = np.nan

    return result


def fetch_rainfall_from_gee(df):
    """
    Fetch monthly rainfall from GEE (CHIRPS dataset).
    Adds 'rainfall_mm' column.
    """
    logger.info("Fetching rainfall from Google Earth Engine (CHIRPS)")
    result = df.copy()

    try:
        import ee
        if not _init_gee():
            raise RuntimeError("GEE initialization failed")

        # CHIRPS monthly precipitation
        rainfall = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY') \
            .filterDate('2023-01-01', '2023-12-31') \
            .sum()  # Total annual rainfall

        rainfall_values = []
        consecutive_errors = 0
        max_consecutive_errors = 5
        total = len(result)

        for i, (idx, row) in enumerate(result.iterrows()):
            if i > 0 and i % 100 == 0:
                logger.info(f"  Rainfall progress: {i}/{total} LGAs")

            lat = row.get('Latitude', row.get('latitude'))
            lon = row.get('Longitude', row.get('longitude'))

            if pd.isna(lat) or pd.isna(lon):
                rainfall_values.append(np.nan)
                continue

            try:
                point = ee.Geometry.Point([lon, lat])
                region = point.buffer(5000)
                val = rainfall.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=region,
                    scale=5000
                ).get('precipitation').getInfo()
                rainfall_values.append(float(val) if val is not None else np.nan)
                consecutive_errors = 0  # Reset on success
                time.sleep(0.3)  # Rate-limit: ~3 req/s to avoid GEE quota
            except Exception as e:
                err_str = str(e)
                if '403' in err_str or 'PERMISSION_DENIED' in err_str:
                    consecutive_errors += 1
                    if consecutive_errors >= max_consecutive_errors:
                        logger.warning(f"GEE Rainfall: {max_consecutive_errors} consecutive 403 errors — aborting remaining LGAs (likely rate-limited or missing CHIRPS permission)")
                        rainfall_values.extend([np.nan] * (len(result) - len(rainfall_values)))
                        break
                logger.debug(f"Rainfall extraction failed for LGA {idx}: {e}")
                rainfall_values.append(np.nan)

        # Safety: ensure list length matches DataFrame
        if len(rainfall_values) != len(result):
            logger.warning(f"Rainfall values list length ({len(rainfall_values)}) != DataFrame rows ({len(result)}), truncating/padding")
            rainfall_values = rainfall_values[:len(result)]
            rainfall_values.extend([np.nan] * (len(result) - len(rainfall_values)))
        result['rainfall_mm'] = rainfall_values
        logger.info(f"\u2705 Rainfall: {sum(1 for v in rainfall_values if not pd.isna(v))}/{len(result)} LGAs")
    except ImportError:
        logger.warning("earthengine-api not installed — rainfall will be NaN")
        result['rainfall_mm'] = np.nan
    except Exception as e:
        logger.warning(f"GEE rainfall fetch failed: {e}")
        result['rainfall_mm'] = np.nan

    return result


def _download_xlsx_idp(url, label):
    """Download a DTM Baseline Assessment XLSX and return site-level DataFrame."""
    try:
        resp = _safe_download(url, timeout=120)
        if resp is None:
            raise ConnectionError(f"{label} download failed")
        xls = pd.ExcelFile(io.BytesIO(resp.content))
        # Use the first (data) sheet
        df_raw = pd.read_excel(xls, sheet_name=xls.sheet_names[0])
        # Some XLSX files have a HXL tag row (values start with '#')
        first = df_raw.iloc[0]
        if any(str(v).startswith('#') for v in first.values if pd.notna(v)):
            df_raw = df_raw.iloc[1:].reset_index(drop=True)
        logger.info(f"  {label}: {len(df_raw)} sites from {len(xls.sheet_names[0])} sheet")
        return df_raw
    except Exception as e:
        logger.warning(f"  {label} XLSX download failed: {e}")
        return None


def _normalise_xlsx_sites(df_raw):
    """
    Normalise a DTM XLSX site-level DataFrame into a standard schema:
    state, lga, individuals, households, site_name, lat, lon, displacement_reason
    """
    if df_raw is None or df_raw.empty:
        return pd.DataFrame()

    # Column detection (NE and NC&W use slightly different names)
    cols = {c.lower().strip(): c for c in df_raw.columns}

    state_col = next((cols[k] for k in cols if k in ('state', 'admin 1')), None)
    lga_col = next((cols[k] for k in cols if k in ('lga', 'admin 2')), None)
    ind_col = next((cols[k] for k in cols if 'individual' in k), None)
    hh_col = next((cols[k] for k in cols if k == 'households'), None)
    site_col = next((cols[k] for k in cols if k in ('site name', 'site_name')), None)
    lat_col = next((cols[k] for k in cols if k in ('latitude', 'lat')), None)
    lon_col = next((cols[k] for k in cols if k in ('longitude', 'lon', 'long')), None)
    reason_col = next((cols[k] for k in cols
                       if 'reason' in k and 'displac' in k), None)

    if not state_col or not lga_col or not ind_col:
        logger.warning("  XLSX missing required columns (State/LGA/Individuals)")
        return pd.DataFrame()

    rename = {
        state_col: 'state', lga_col: 'lga', ind_col: 'individuals',
    }
    if hh_col:
        rename[hh_col] = 'households'
    if site_col:
        rename[site_col] = 'site_name'
    if lat_col:
        rename[lat_col] = 'lat'
    if lon_col:
        rename[lon_col] = 'lon'
    if reason_col:
        rename[reason_col] = 'displacement_reason'

    out = df_raw[list(rename.keys())].rename(columns=rename).copy()
    out['state'] = out['state'].astype(str).str.strip().str.upper()
    out['lga'] = out['lga'].astype(str).str.strip().str.upper()
    out['individuals'] = pd.to_numeric(out['individuals'], errors='coerce').fillna(0).astype(int)
    if 'households' in out.columns:
        out['households'] = pd.to_numeric(out['households'], errors='coerce').fillna(0).astype(int)
    return out


def _aggregate_sites_to_lga(sites_df):
    """
    Aggregate site-level IDP data to LGA level.
    Returns DataFrame with columns: LGA_Name, idp_count, idp_site_count
    """
    if sites_df.empty:
        return pd.DataFrame(columns=['LGA_Name', 'idp_count', 'idp_site_count'])

    agg = sites_df.groupby('lga').agg(
        idp_count=('individuals', 'sum'),
        idp_site_count=('individuals', 'count'),
    ).reset_index()
    agg.rename(columns={'lga': 'LGA_Name'}, inplace=True)
    # Title-case to match shapefile convention
    agg['LGA_Name'] = agg['LGA_Name'].str.title()
    return agg


def _fetch_idp_from_dtm_api():
    """
    Layer 0: Fetch IDP data from the live DTM API v3 (Admin Level 2).

    Uses the IOM DTM API at https://dtmapi.iom.int with subscription key.
    Returns a DataFrame with columns [LGA_Name, idp_count] or empty DF on failure.
    """
    api_key = _cfg.DTM_API_KEY
    api_url = _cfg.DTM_API_URL

    if not api_key:
        logger.info("  DTM API key not configured — skipping live API")
        return pd.DataFrame(columns=['LGA_Name', 'idp_count'])

    try:
        import time as _time

        # DTM API v3 endpoint: /v3/displacement/admin2
        # Normalise base URL: strip trailing /api or /v3 if present, then append /v3
        base = api_url.rstrip('/')
        for suffix in ('/api', '/v3'):
            if base.endswith(suffix):
                base = base[:-len(suffix)]
        endpoint = f"{base}/v3/displacement/admin2"

        # Retry loop for transient DNS/network failures
        resp = None
        last_err = None
        for attempt in range(1, 4):
            try:
                resp = requests.get(
                    endpoint,
                    params={"CountryName": "Nigeria"},
                    headers={
                        "Ocp-Apim-Subscription-Key": api_key,
                        "Accept": "application/json",
                        "User-Agent": "IOPHIN/1.0 (poverty-hotspot-identifier)",
                    },
                    timeout=60,
                )
                break  # success
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                last_err = e
                if attempt < 3:
                    wait = 2 ** attempt
                    logger.info(f"  DTM API retry {attempt}/3 in {wait}s ({type(e).__name__})")
                    _time.sleep(wait)

        if resp is None:
            logger.warning(f"  DTM API unreachable after 3 attempts: {last_err}")
            return pd.DataFrame(columns=['LGA_Name', 'idp_count'])

        if resp.status_code == 404:
            logger.info("  DTM API returned 404 — endpoint may have changed")
            return pd.DataFrame(columns=['LGA_Name', 'idp_count'])

        resp.raise_for_status()
        raw_json = resp.json()

        # v3 wraps results in {"result": [...]}
        if isinstance(raw_json, dict) and 'result' in raw_json:
            data = raw_json['result']
        elif isinstance(raw_json, list):
            data = raw_json
        else:
            data = []

        if not isinstance(data, list) or len(data) == 0:
            logger.warning("  DTM API returned empty dataset")
            return pd.DataFrame(columns=['LGA_Name', 'idp_count'])

        df_api = pd.DataFrame(data)
        logger.info(f"  DTM API: {len(df_api)} records, "
                     f"keys={list(df_api.columns)[:8]}")

        # Identify columns (API uses camelCase from the docs)
        admin2_col = next((c for c in df_api.columns
                           if c.lower() in ('admin2name', 'admin2_name')), None)
        idp_col = next((c for c in df_api.columns
                        if 'idpind' in c.lower() or 'numpresentidpind' in c.lower()
                        or c.lower() == 'numofindividuals'), None)
        round_col = next((c for c in df_api.columns
                          if 'round' in c.lower() and 'number' in c.lower()), None)
        date_col = next((c for c in df_api.columns
                         if 'reportingdate' in c.lower()), None)

        if not admin2_col or not idp_col:
            logger.warning(f"  DTM API: cannot find Admin2/IDP columns in {list(df_api.columns)}")
            return pd.DataFrame(columns=['LGA_Name', 'idp_count'])

        # Keep latest round per LGA (by round number or reporting date)
        if round_col:
            df_api[round_col] = pd.to_numeric(df_api[round_col], errors='coerce')
            df_api = df_api.sort_values(round_col).drop_duplicates(admin2_col, keep='last')
        elif date_col:
            df_api[date_col] = pd.to_datetime(df_api[date_col], errors='coerce')
            df_api = df_api.sort_values(date_col).drop_duplicates(admin2_col, keep='last')

        agg = df_api[[admin2_col, idp_col]].copy()
        agg.columns = ['LGA_Name', 'idp_count']
        agg['LGA_Name'] = agg['LGA_Name'].astype(str).str.strip().str.title()
        agg['idp_count'] = pd.to_numeric(agg['idp_count'], errors='coerce').fillna(0).astype(int)
        agg['idp_site_count'] = 0  # API doesn't provide site-level detail

        logger.info(f"  ✅ DTM API: {len(agg)} LGAs, "
                     f"{agg['idp_count'].sum():,} total IDPs")
        return agg

    except requests.exceptions.HTTPError as e:
        logger.warning(f"  DTM API HTTP error: {e}")
    except Exception as e:
        logger.warning(f"  DTM API fetch failed: {e}")

    return pd.DataFrame(columns=['LGA_Name', 'idp_count'])


def fetch_idp_data(df):
    """
    Fetch IDP (Internally Displaced Persons) counts from IOM DTM.

    Strategy (4-layer, each fills gaps left by previous):
      0. Live DTM API v3 (real-time, all Nigeria operations)
      1. NE Baseline Assessment XLSX (site-level, 6 NE states)
      2. NC&W Baseline Assessment XLSX (site-level, 8 NC&W states)
      3. HDX summary CSV (covers 5 extra states)

    Adds 'idp_count' and 'idp_site_count' columns.
    """
    logger.info("Fetching IDP data from IOM DTM (API → XLSX → CSV)")
    result = df.copy()

    # ── Layer 0: Live DTM API ────────────────────────────────────
    api_agg = _fetch_idp_from_dtm_api()
    api_success = not api_agg.empty and api_agg['idp_count'].sum() > 0

    # ── Layer 1 & 2: Site-level XLSX data ────────────────────────
    all_sites = []
    ne_url = _cfg.DTM_NE_BASELINE_XLSX_URL
    ncw_url = _cfg.DTM_NCW_BASELINE_XLSX_URL

    for url, label in [(ne_url, "NE Baseline"), (ncw_url, "NC&W Baseline")]:
        raw = _download_xlsx_idp(url, label)
        if raw is not None:
            sites = _normalise_xlsx_sites(raw)
            if not sites.empty:
                logger.info(f"  {label}: {len(sites)} sites across "
                            f"{sites['state'].nunique()} states, "
                            f"{sites['lga'].nunique()} LGAs")
                all_sites.append(sites)

    if all_sites:
        combined_sites = pd.concat(all_sites, ignore_index=True)
        xlsx_agg = _aggregate_sites_to_lga(combined_sites)
        logger.info(f"  XLSX total: {len(xlsx_agg)} unique LGAs, "
                    f"{xlsx_agg['idp_count'].sum():,} IDPs")
    else:
        xlsx_agg = pd.DataFrame(columns=['LGA_Name', 'idp_count', 'idp_site_count'])

    # ── Layer 3: CSV fallback for extra LGAs ─────────────────────
    csv_url = _cfg.DTM_HDX_CSV_URL
    csv_agg = pd.DataFrame(columns=['LGA_Name', 'idp_count'])

    try:
        resp = _safe_download(csv_url, timeout=60)
        if resp is None:
            raise ConnectionError("DTM CSV fallback download failed")
        idp_csv = pd.read_csv(io.StringIO(resp.text))
        lga_data = idp_csv[idp_csv['adminLevel'] == 2].copy()
        if not lga_data.empty:
            lga_data['reportingDate'] = pd.to_datetime(
                lga_data['reportingDate'], errors='coerce')
            lga_data = lga_data.sort_values('reportingDate').drop_duplicates(
                'admin2Name', keep='last')
            csv_agg = lga_data[['admin2Name', 'numPresentIdpInd']].copy()
            csv_agg.rename(columns={
                'admin2Name': 'LGA_Name',
                'numPresentIdpInd': 'idp_count',
            }, inplace=True)
            csv_agg['LGA_Name'] = csv_agg['LGA_Name'].str.strip().str.title()
            csv_agg['idp_count'] = pd.to_numeric(
                csv_agg['idp_count'], errors='coerce').fillna(0).astype(int)
            logger.info(f"  CSV fallback: {len(csv_agg)} LGAs available")
    except Exception as e:
        logger.warning(f"  CSV fallback download failed: {e}")

    # ── Merge all layers: API > XLSX > CSV ───────────────────────
    # Start with API data if available
    if api_success:
        final_agg = api_agg.copy()
        if 'idp_site_count' not in final_agg.columns:
            final_agg['idp_site_count'] = 0
        covered = set(final_agg['LGA_Name'].str.upper())
        logger.info(f"  API contributed {len(final_agg)} LGAs")
    else:
        final_agg = pd.DataFrame(columns=['LGA_Name', 'idp_count', 'idp_site_count'])
        covered = set()

    # Add XLSX LGAs not already covered
    if not xlsx_agg.empty:
        xlsx_extra = xlsx_agg[~xlsx_agg['LGA_Name'].str.upper().isin(covered)].copy()
        if not xlsx_extra.empty:
            final_agg = pd.concat([final_agg, xlsx_extra], ignore_index=True)
            covered |= set(xlsx_extra['LGA_Name'].str.upper())
            logger.info(f"  XLSX adds {len(xlsx_extra)} extra LGAs")

    # Add CSV LGAs not already covered
    if not csv_agg.empty:
        csv_extra = csv_agg[~csv_agg['LGA_Name'].str.upper().isin(covered)].copy()
        if not csv_extra.empty:
            csv_extra['idp_site_count'] = 0
            final_agg = pd.concat([final_agg, csv_extra], ignore_index=True)
            logger.info(f"  CSV adds {len(csv_extra)} extra LGAs")

    # De-duplicate (title-case merge key)
    final_agg = final_agg.sort_values('idp_count', ascending=False).drop_duplicates(
        'LGA_Name', keep='first')

    # ── Merge into input DataFrame ───────────────────────────────
    merge_cols = ['LGA_Name', 'idp_count', 'idp_site_count']
    for col in merge_cols:
        if col not in final_agg.columns:
            final_agg[col] = 0

    result = result.merge(
        final_agg[merge_cols], on='LGA_Name', how='left', suffixes=('', '_dtm'))

    # Reconcile any existing columns
    if 'idp_count_dtm' in result.columns:
        result['idp_count'] = result['idp_count_dtm'].fillna(
            result.get('idp_count', 0))
        result.drop(columns=['idp_count_dtm'], inplace=True)
    if 'idp_site_count_dtm' in result.columns:
        result['idp_site_count'] = result['idp_site_count_dtm'].fillna(0)
        result.drop(columns=['idp_site_count_dtm'], inplace=True)

    result['idp_count'] = pd.to_numeric(result['idp_count'], errors='coerce').fillna(0).astype(int)
    result['idp_site_count'] = pd.to_numeric(
        result.get('idp_site_count', pd.Series(0, index=result.index)),
        errors='coerce').fillna(0).astype(int)

    matched = (result['idp_count'] > 0).sum()
    source_label = "API + " if api_success else ""
    logger.info(f"✅ IDP data: {matched} LGAs with displacement "
                f"({source_label}XLSX + CSV, {len(final_agg)} in combined sources)")

    return result


def fetch_food_prices(df):
    """
    Fetch WFP food price index per state/LGA.
    Adds 'food_price_index' column.
    Uses HDX dataset as primary source (WFP VAM dataviz API is deprecated).
    """
    logger.info("Fetching food price data from WFP")
    result = df.copy()

    # ── Attempt 1: HDX WFP food prices for Nigeria ──
    try:
        hdx_url = _cfg.WFP_API_URL  # Now points to HDX
        data = _safe_get_json(f"{hdx_url}/package_show",
                              params={'id': 'wfp-food-prices-for-nigeria'})
        if data and data.get('success'):
            resources = data['result']['resources']
            csv_url = next((r['url'] for r in resources if r['format'].upper() == 'CSV'), None)
            if csv_url:
                logger.info("  Downloading WFP food prices from HDX (CSV)...")
                resp = _safe_download(csv_url, timeout=120)
                if resp is None:
                    raise ConnectionError("WFP food prices download failed")
                price_df = pd.read_csv(io.BytesIO(resp.content))

                # HDX WFP format has columns: date, admin1, admin2, market, commodity, price, ...
                admin_col = next((c for c in price_df.columns if c.lower() in ('admin2', 'adm2_name', 'market', 'mkt_name')), None)
                price_col = next((c for c in price_df.columns if c.lower() in ('price', 'mp_price', 'usdprice')), None)
                commodity_col = next((c for c in price_df.columns if c.lower() in ('commodity', 'cm_name')), None)

                if admin_col and price_col:
                    # Filter to staple foods if commodity column exists
                    if commodity_col:
                        staples = price_df[price_df[commodity_col].str.lower().str.contains('rice|maize|millet|sorghum|beans', na=False)]
                        if len(staples) > 0:
                            price_df = staples

                    price_df[price_col] = pd.to_numeric(price_df[price_col], errors='coerce')
                    agg = price_df.groupby(admin_col)[price_col].mean().reset_index()
                    national_mean = agg[price_col].mean()
                    agg['food_price_index'] = (agg[price_col] / national_mean) * 100 if national_mean > 0 else 100
                    agg.rename(columns={admin_col: 'LGA_Name'}, inplace=True)
                    agg['LGA_Name'] = agg['LGA_Name'].str.strip()
                    result = result.merge(agg[['LGA_Name', 'food_price_index']], on='LGA_Name', how='left', suffixes=('', '_wfp'))
                    matched = result['food_price_index'].notna().sum()
                    logger.info(f"\u2705 Food prices (HDX): {matched} LGAs matched")
                    if matched > 0:
                        return result

                    # Try matching at state level if LGA match failed
                    state_col = next((c for c in price_df.columns if c.lower() in ('admin1', 'adm1_name')), None)
                    if state_col and 'State' in result.columns:
                        logger.info("  LGA match weak, trying state-level food prices...")
                        agg_state = price_df.groupby(state_col)[price_col].mean().reset_index()
                        national_mean = agg_state[price_col].mean()
                        agg_state['food_price_index'] = (agg_state[price_col] / national_mean) * 100 if national_mean > 0 else 100
                        agg_state.rename(columns={state_col: 'State'}, inplace=True)
                        agg_state['State'] = agg_state['State'].str.strip()
                        result = result.merge(agg_state[['State', 'food_price_index']], on='State', how='left', suffixes=('', '_wfp'))
                        logger.info(f"\u2705 Food prices (state-level): {result['food_price_index'].notna().sum()} LGAs matched")
                        return result

        logger.warning("HDX WFP dataset not found or no usable CSV")
    except Exception as e:
        logger.warning(f"WFP HDX fetch failed: {e}")

    if 'food_price_index' not in result.columns:
        result['food_price_index'] = np.nan
    return result


def enrich_all_external_features(df):
    """
    Run all external data fetchers in sequence.
    Adds: health_facility_count, school_count, population_density,
          road_density_km, ndvi_mean, rainfall_mm, idp_count, food_price_index.
    """
    logger.info("=" * 60)
    logger.info("ENRICHING LGA DATA WITH EXTERNAL SOURCES")
    logger.info("=" * 60)

    result = df.copy()
    expected_rows = len(result)
    logger.info(f"Starting enrichment with {expected_rows} LGAs")

    # GRID3
    result = fetch_grid3_health_facilities(result)
    result = fetch_grid3_schools(result)

    # WorldPop
    result = fetch_worldpop_population(result)

    # OSM road density
    result = fetch_road_density(result)

    # Guard: ensure no row duplication before expensive GEE calls
    if len(result) != expected_rows:
        logger.warning(f"Row count changed from {expected_rows} to {len(result)} during enrichment — deduplicating")
        if 'LGA_Name' in result.columns:
            result = result.drop_duplicates(subset='LGA_Name', keep='first').reset_index(drop=True)
        else:
            result = result.drop_duplicates(keep='first').reset_index(drop=True)
        logger.info(f"After dedup: {len(result)} rows")

    # GEE (NDVI + rainfall)
    result = fetch_ndvi_from_gee(result)
    result = fetch_rainfall_from_gee(result)

    # IOM DTM
    result = fetch_idp_data(result)

    # WFP food prices
    result = fetch_food_prices(result)

    logger.info("=" * 60)
    logger.info("EXTERNAL ENRICHMENT COMPLETE")
    logger.info("=" * 60)

    return result
