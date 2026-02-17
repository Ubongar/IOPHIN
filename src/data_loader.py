"""
Data loader module for Nigeria Poverty Hotspot Identifier System.
Handles loading of shapefiles, CSV files, existing processed data,
and senatorial-to-LGA mapping via fuzzy matching.
"""
import pandas as pd
import geopandas as gpd
import numpy as np
from pathlib import Path
import logging
import re

from . import config

logger = logging.getLogger(__name__)

# ─── Shapefile / CSV loaders ─────────────────────────────────────────────────


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

    df = pd.read_csv(config.STATE_MPI_CSV, skiprows=1)
    logger.info(f"Loaded {len(df)} state records")

    return df


def load_senatorial_mpi_data():
    """
    Load senatorial district-level MPI data.
    Columns: Senatorial District, MPI Value, Incidence (H, %), Intensity (A, %), Number of Poor (Thousand)

    Returns:
        DataFrame: Senatorial district poverty indicators (109 rows)
    """
    logger.info(f"Loading senatorial MPI data from {config.SENATORIAL_MPI_CSV}")

    if not config.SENATORIAL_MPI_CSV.exists():
        logger.warning(f"Senatorial MPI file not found: {config.SENATORIAL_MPI_CSV}")
        return None

    df = pd.read_csv(config.SENATORIAL_MPI_CSV)

    # Clean column names (BOM, whitespace)
    df.columns = df.columns.str.replace('\ufeff', '').str.replace('ï»¿', '').str.strip()

    # Standardise column names for downstream use
    rename_map = {
        'Senatorial District': 'senatorial_district',
        'MPI Value': 'senatorial_mpi',
        'Incidence (H, %)': 'senatorial_headcount',
        'Intensity (A, %)': 'senatorial_intensity',
        'Number of Poor (Thousand)': 'senatorial_poor_thousands',
    }
    df.rename(columns=rename_map, inplace=True)

    # Extract state name from district (e.g. "Abia Central" → "Abia")
    df['state_from_district'] = df['senatorial_district'].apply(
        lambda x: ' '.join(x.strip().split()[:-1])  # drop last word (Central/North/South/East/West)
    )

    logger.info(f"Loaded {len(df)} senatorial district records")
    return df


def load_processed_hotspots():
    """
    Load the existing processed hotspots CSV.
    """
    logger.info(f"Loading processed hotspots from {config.PROCESSED_HOTSPOTS_CSV}")

    if not config.PROCESSED_HOTSPOTS_CSV.exists():
        raise FileNotFoundError(f"Processed hotspots file not found: {config.PROCESSED_HOTSPOTS_CSV}")

    df = pd.read_csv(config.PROCESSED_HOTSPOTS_CSV)
    logger.info(f"Loaded {len(df)} LGA records")
    logger.info(f"Columns: {df.columns.tolist()}")

    return df


# ─── Senatorial → LGA fuzzy mapping ──────────────────────────────────────────

# Hard-coded state aliases to handle naming differences between datasets
_STATE_ALIASES = {
    'fct': 'Federal Capital Territory',
    'abuja': 'Federal Capital Territory',
    'nassarawa': 'Nasarawa',
}


def _normalise_state(name):
    """Lowercase, strip, apply aliases."""
    if not name:
        return ''
    n = name.strip().lower()
    return _STATE_ALIASES.get(n, name.strip())


def build_senatorial_lga_mapping(lga_df, senatorial_df):
    """
    Build a mapping from each LGA to its senatorial district using fuzzy matching.

    Strategy:
    1. Match on state first (exact after normalisation).
    2. For each LGA within a state, find the best senatorial district using
       thefuzz (Levenshtein) partial ratio — this handles cases like
       "Aba North" → "Abia North" or LGA naming variations.
    3. If fuzzy score < 50, assign the senatorial district with the highest MPI
       in that state (conservative fallback that preserves poverty signal).

    Args:
        lga_df: DataFrame with at least 'LGA_Name' and 'State' columns
        senatorial_df: DataFrame from load_senatorial_mpi_data()

    Returns:
        DataFrame: lga_df with senatorial columns merged in
    """
    try:
        from thefuzz import fuzz
    except ImportError:
        logger.warning("thefuzz not installed — skipping senatorial merge. pip install thefuzz python-Levenshtein")
        return lga_df

    if senatorial_df is None or senatorial_df.empty:
        logger.warning("No senatorial data — skipping merge")
        return lga_df

    logger.info("Building senatorial → LGA mapping via fuzzy matching...")

    # Normalise state names in both datasets
    lga_work = lga_df.copy()
    lga_work['_state_norm'] = lga_work['State'].apply(_normalise_state)

    senatorial_df = senatorial_df.copy()
    senatorial_df['_state_norm'] = senatorial_df['state_from_district'].apply(_normalise_state)

    # Group senatorial districts by state
    sen_by_state = {}
    for _, row in senatorial_df.iterrows():
        sn = row['_state_norm'].lower()
        sen_by_state.setdefault(sn, []).append(row)

    # For each LGA, find best matching senatorial district
    mapping = []
    for idx, lga_row in lga_work.iterrows():
        state_norm = lga_row['_state_norm'].lower()
        lga_name = str(lga_row.get('LGA_Name', '')).strip()
        candidates = sen_by_state.get(state_norm, [])

        if not candidates:
            # Try partial state match
            for sn_key, sn_rows in sen_by_state.items():
                if sn_key in state_norm or state_norm in sn_key:
                    candidates = sn_rows
                    break

        best_score = 0
        best_match = None
        for c in candidates:
            district_name = str(c['senatorial_district']).strip()
            score = fuzz.partial_ratio(lga_name.lower(), district_name.lower())
            if score > best_score:
                best_score = score
                best_match = c

        if best_score < 50 and candidates:
            # Fallback: pick the district with the highest MPI in the state
            best_match = max(candidates, key=lambda c: c.get('senatorial_mpi', 0))
            logger.debug(f"Low fuzzy score for {lga_name} ({best_score}), using fallback: {best_match['senatorial_district']}")

        if best_match is not None:
            mapping.append({
                'LGA_Name': lga_name,
                'senatorial_district': best_match['senatorial_district'],
                'senatorial_mpi': best_match.get('senatorial_mpi'),
                'senatorial_headcount': best_match.get('senatorial_headcount'),
                'senatorial_intensity': best_match.get('senatorial_intensity'),
            })
        else:
            mapping.append({
                'LGA_Name': lga_name,
                'senatorial_district': None,
                'senatorial_mpi': None,
                'senatorial_headcount': None,
                'senatorial_intensity': None,
            })

    mapping_df = pd.DataFrame(mapping)
    matched_count = mapping_df['senatorial_district'].notna().sum()
    logger.info(f"✅ Senatorial mapping: {matched_count}/{len(mapping_df)} LGAs matched")

    # Merge back
    result = lga_df.merge(mapping_df, on='LGA_Name', how='left', suffixes=('', '_sen'))
    return result


# ─── Original merge function (state-level) ───────────────────────────────────

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

    result = lga_gdf.copy()

    # Detect state column
    state_col = None
    for col_name in ('ADM1_EN', 'StateName', 'State', 'state'):
        if col_name in result.columns:
            state_col = col_name
            break

    # Merge state-level MPI
    if state_mpi_df is not None and state_col is not None:
        state_mpi_df = state_mpi_df.copy()
        state_mpi_df['State_Clean'] = state_mpi_df['Admin 1 Name'].str.strip()
        result['State_Clean'] = result[state_col].str.strip()

        result = result.merge(
            state_mpi_df[['State_Clean', 'MPI', 'Headcount Ratio',
                          'Intensity of Deprivation', 'In Severe Poverty']],
            on='State_Clean',
            how='left',
            suffixes=('', '_state'),
        )
        logger.info("Merged state-level MPI data")

    # Merge senatorial-level MPI (more granular: 109 zones vs 37 states)
    if senatorial_mpi_df is not None:
        # Ensure we have LGA_Name column
        lga_name_col = None
        for cn in ('LGA_Name', 'lganame', 'LGA_NAME', 'ADM2_EN'):
            if cn in result.columns:
                lga_name_col = cn
                break

        if lga_name_col:
            # Temporarily rename to standard
            if lga_name_col != 'LGA_Name':
                result = result.rename(columns={lga_name_col: 'LGA_Name'})

            # Ensure State column exists
            if 'State' not in result.columns and state_col and state_col != 'State':
                result['State'] = result[state_col]

            result = build_senatorial_lga_mapping(result, senatorial_mpi_df)
            logger.info("Merged senatorial-level MPI data via fuzzy matching")
        else:
            logger.warning("Cannot find LGA name column for senatorial merge")

    return result
