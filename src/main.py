"""
Main pipeline script for Nigeria Poverty Hotspot Identifier System.
Orchestrates the complete analytical workflow.
"""
import re
import sys
import logging
import pandas as pd
import geopandas as gpd

from src import config
from src.data_loader import (
    load_lga_shapefile,
    load_state_mpi_data,
    load_senatorial_mpi_data,
    load_processed_hotspots,
)
from src.feature_extraction import (
    extract_nightlight_from_processed_csv,
    enrich_all_external_features,
)
from src.model_engine import prepare_poverty_features, build_analytical_model
from src.db_utils import (
    upsert_hotspots_from_dataframe,
    save_history_snapshot,
    migrate_from_geojson,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('analytical_engine.log')
    ]
)
logger = logging.getLogger(__name__)


def save_csv_output(df, output_path):
    """
    Save final results as CSV file.
    
    Args:
        df: DataFrame to save
        output_path: Path to output CSV file
    """
    logger.info(f"Saving CSV output to {output_path}")
    
    # Select relevant columns for output (use config constants)
    output_cols = config.CSV_OUTPUT_COLUMNS.copy()
    
    # Add model outputs
    output_cols.extend(['cluster', 'cluster_label', 'risk_level'])
    
    # Filter to available columns
    available_cols = [col for col in output_cols if col in df.columns]
    
    # Save
    df[available_cols].to_csv(output_path, index=False)
    logger.info(f"Saved {len(df)} records to {output_path}")


def save_geojson_output(df, gdf, output_path):
    """
    Save results as GeoJSON file with geometry for frontend visualization.
    Uses comprehensive name normalisation + an explicit correction table so
    that every one of the 774 LGAs gets a polygon.

    Args:
        df: DataFrame with cluster results (must have LGA_Name, State)
        gdf: GeoDataFrame with LGA geometries (must have lganame, statename)
        output_path: Path to output GeoJSON file
    """
    logger.info(f"Saving GeoJSON output to {output_path}")

    # ------------------------------------------------------------------
    # 1.  Explicit name corrections  (csv_name → shapefile_name)
    #     Both sides are **lowercase / stripped** already.
    # ------------------------------------------------------------------
    CSV_TO_SHP: dict[str, str] = {
        "aboh mbaise":          "aboh-mbaise",
        "abua-odual":           "abua/odual",
        "abuja":                "municipal area council",
        "ado-odo/ota":          "ado odo/ota",
        "ahiazu mbaise":        "ahiazu-mbaise",
        "aiyedire":             "ayedire",
        "ajeromi-ifelodun":     "ajeromi/ifelodun",
        "akoko edo":            "akoko-edo",
        "akuku-toru":           "akuku toru",
        "aliero":               "aleiro",
        "amuwo-odofin":         "amuwo odofin",
        "ardo kola":            "ardo-kola",
        "askira/uba":           "askira uba",
        "ayedaade":             "ayedade",
        "bagudo":               "bagudu",
        "birnin magaji/kiyaw":  "birnin magaji-kiyaw",
        "damban":               "dambam",
        "dange/shuni":          "dange shuni",
        "danko-wasagu":         "wasagu-danko",
        "dutsin-ma":            "dutsin ma",
        "ehime mbano":          "ehime-mbano",
        "ekiti south west":     "ekiti south-west",
        "emohua":               "emuoha",
        "esan north east":      "esan north-east",
        "esan south east":      "esan south-east",
        "eti-osa":              "eti osa",
        "ezinihitte mbaise":    "ezinihitte",
        "ibeju-lekki":          "ibeju lekki",
        "ifako-ijaiye":         "ifako/ijaye",
        "igalamela odolu":      "igalamela-odolu",
        "igbo etiti":           "igbo-etiti",
        "igbo eze north":       "igbo-eze north",
        "igbo eze south":       "igbo-eze-south",
        "igueben":              "iguegben",
        "ikpoba okha":          "ikpoba-okha",
        "ilesa east":           "ilesha east",
        "ilesa west":           "ilesha west",
        "isiala ngwa north":    "isiala-ngwa north",
        "isiala ngwa south":    "isiala-ngwa south",
        "kala/balge":           "kala balge",
        "katsina ala":          "katsina-ala",
        "koko/besse":           "koko-besse",
        "mayo belwa":           "mayo-belwa",
        "mbaitoli":             "mbatoli",
        "ngor okpala":          "ngor-okpala",
        "obi ngwa":             "obi nwga",
        "odo-otin":             "odo otin",
        "ogu/bolo":             "ogu bolo",
        "oke-ero":              "oke ero",
        "ola-oluwa":            "ola oluwa",
        "omuma":                "omumma",
        "oorelope":             "orelope",
        "oshodi-isolo":         "oshodi/isolo",
        "osisioma":             "osisioma ngwa",
        "otukpo":               "oturkpo",
        "ovia north east":      "ovia north-east",
        "ovia south west":      "ovia south-west",
        "port harcourt":        "port-harcourt",
        "shongom":              "shomgom",
        "somolu":               "shomolu",
        "tafawa balewa":        "tafawa-balewa",
        "wamako":               "wamakko",
        "warri south west":     "warri south-west",
        "yenagoa":              "yenegoa",
    }

    # Also handle CSV "nassarawa" → shapefile "nassarawa" (already same)
    # No explicit entry needed; only genuine mismatches above.

    # State name normalisation (csv_state → shapefile_state)
    STATE_NORM: dict[str, str] = {
        "federal capital territory": "fct",
        "nasarawa": "nassarawa",
    }

    # ------------------------------------------------------------------
    # 2.  Find LGA name column in shapefile
    # ------------------------------------------------------------------
    lga_col = None
    for col in config.LGA_NAME_COLUMNS:
        if col in gdf.columns:
            lga_col = col
            break

    state_col = None
    for col in config.STATE_NAME_COLUMNS:
        if col in gdf.columns:
            state_col = col
            break

    if lga_col is None:
        logger.error("Could not find LGA name column in shapefile")
        if 'Latitude' in df.columns and 'Longitude' in df.columns:
            from shapely.geometry import Point
            geometry = [Point(xy) for xy in zip(df['Longitude'], df['Latitude'])]
            geo_df = gpd.GeoDataFrame(df, geometry=geometry, crs='EPSG:4326')
        else:
            logger.error("Cannot create GeoJSON without coordinates")
            return
    else:
        # ------------------------------------------------------------------
        # 3.  Build normalised merge keys on shapefile side
        # ------------------------------------------------------------------
        gdf_copy = gdf[[lga_col, state_col, 'geometry']].copy() if state_col else gdf[[lga_col, 'geometry']].copy()
        gdf_copy['_shp_lga'] = gdf_copy[lga_col].str.strip().str.lower()
        if state_col:
            gdf_copy['_shp_state'] = gdf_copy[state_col].str.strip().str.lower()

        # ------------------------------------------------------------------
        # 4.  Build normalised merge keys on CSV side, applying corrections
        # ------------------------------------------------------------------
        df_copy = df.copy()
        raw_csv = df_copy['LGA_Name'].str.strip().str.lower()
        df_copy['_csv_lga'] = raw_csv.map(lambda n: CSV_TO_SHP.get(n, n))
        if 'State' in df_copy.columns and state_col:
            df_copy['_csv_state'] = df_copy['State'].str.strip().str.lower().map(
                lambda s: STATE_NORM.get(s, s)
            )

        # ------------------------------------------------------------------
        # 5.  Merge — prefer state+lga composite key for accuracy
        # ------------------------------------------------------------------
        if state_col and 'State' in df_copy.columns:
            # Composite key merge (handles duplicates like Bassa, Surulere, etc.)
            gdf_copy['_merge_key'] = gdf_copy['_shp_state'] + '|' + gdf_copy['_shp_lga']
            df_copy['_merge_key'] = df_copy['_csv_state'] + '|' + df_copy['_csv_lga']
            geo_df = gdf_copy.merge(df_copy, on='_merge_key', how='right')
        else:
            geo_df = gdf_copy.merge(df_copy, left_on='_shp_lga', right_on='_csv_lga', how='right')

        geo_df = gpd.GeoDataFrame(geo_df, geometry='geometry', crs='EPSG:4326')

        # ------------------------------------------------------------------
        # 6.  Ultra-normalised fallback for any still-unmatched rows
        #     Strip ALL punctuation so "aboh-mbaise" == "abohmraise" etc.
        # ------------------------------------------------------------------
        _strip = lambda s: re.sub(r'[^a-z0-9]', '', str(s))
        missing_mask = geo_df['geometry'].isna()
        n_missing = missing_mask.sum()

        if n_missing > 0:
            logger.warning(f"{n_missing} LGAs still missing geometry after primary merge — trying fuzzy fallback")
            # Build a lookup from ultra-stripped shapefile name → geometry
            shp_lookup: dict[str, object] = {}
            for _, row in gdf.iterrows():
                key = _strip(row[lga_col].lower())
                shp_lookup.setdefault(key, row['geometry'])

            for idx in geo_df[missing_mask].index:
                csv_name = str(geo_df.loc[idx, 'LGA_Name']).lower()
                key = _strip(csv_name)
                if key in shp_lookup:
                    geo_df.at[idx, 'geometry'] = shp_lookup[key]

            still_missing = geo_df['geometry'].isna().sum()
            if still_missing > 0:
                logger.warning(f"{still_missing} LGAs could not be matched to any geometry — creating point features")
                from shapely.geometry import Point
                for idx in geo_df[geo_df['geometry'].isna()].index:
                    lat = geo_df.loc[idx, 'Latitude'] if 'Latitude' in geo_df.columns else 9.0
                    lon = geo_df.loc[idx, 'Longitude'] if 'Longitude' in geo_df.columns else 7.5
                    geo_df.at[idx, 'geometry'] = Point(float(lon), float(lat))

        matched_polys = (~geo_df['geometry'].isna()).sum()
        logger.info(f"Merged {matched_polys} / {len(df)} LGAs with geometries")

    # ------------------------------------------------------------------
    # 7.  Select output columns & write
    # ------------------------------------------------------------------
    geojson_cols = config.GEOJSON_OUTPUT_COLUMNS.copy()
    geojson_cols.append('geometry')
    available_cols = [col for col in geojson_cols if col in geo_df.columns]

    geo_df[available_cols].to_file(output_path, driver='GeoJSON')
    logger.info(f"Saved GeoJSON with {len(geo_df)} features to {output_path}")


def main():
    """
    Main execution function.
    """
    logger.info("=" * 100)
    logger.info("NIGERIA POVERTY HOTSPOT IDENTIFIER - ANALYTICAL ENGINE v2.0")
    logger.info("=" * 100)
    logger.info("")
    
    try:
        # ===================================================================
        # PHASE 1: BIG DATA FEATURE EXTRACTION (Memory Safe)
        # ===================================================================
        logger.info("PHASE 1: BIG DATA FEATURE EXTRACTION")
        logger.info("-" * 100)
        
        # Load LGA shapefile
        logger.info("Step 1.1: Loading LGA boundaries")
        lga_gdf = load_lga_shapefile()
        
        # Load existing processed hotspots CSV
        logger.info("Step 1.2: Loading processed hotspots data")
        processed_df = load_processed_hotspots()
        
        # Extract nightlight features (memory-safe)
        logger.info("Step 1.3: Extracting nightlight intensity (Memory-Safe Windowed Reading)")
        df_with_nightlight = extract_nightlight_from_processed_csv(processed_df, lga_gdf)
        
        logger.info(f"Phase 1 complete: {len(df_with_nightlight)} LGAs with nightlight data")
        logger.info("")
        
        # ===================================================================
        # PHASE 2: DATA FUSION & HARMONIZATION
        # ===================================================================
        logger.info("PHASE 2: DATA FUSION & HARMONIZATION")
        logger.info("-" * 100)
        
        # Load poverty data
        logger.info("Step 2.1: Loading poverty indicators")
        state_mpi = load_state_mpi_data()
        senatorial_mpi = load_senatorial_mpi_data()
        
        # Merge poverty features (includes senatorial MPI fuzzy matching)
        logger.info("Step 2.2: Merging poverty data (state + senatorial MPI)")
        df_enriched = prepare_poverty_features(df_with_nightlight, state_mpi, senatorial_mpi)
        
        logger.info(f"Phase 2 complete: {len(df_enriched)} LGAs with enriched features")
        logger.info("")
        
        # ===================================================================
        # PHASE 2.5: EXTERNAL DATA ENRICHMENT
        # ===================================================================
        logger.info("PHASE 2.5: EXTERNAL DATA ENRICHMENT")
        logger.info("-" * 100)
        logger.info("Fetching: GRID3 health/education, WorldPop, OSM roads, IDP, food prices")
        
        df_enriched = enrich_all_external_features(df_enriched)
        
        ext_cols = [
            "health_facility_count", "school_count", "population_density",
            "road_density_km", "idp_count", "food_price_index",
        ]
        available_ext = [c for c in ext_cols if c in df_enriched.columns and df_enriched[c].notna().sum() > 0]
        logger.info(f"Phase 2.5 complete: {len(available_ext)} external features available")
        logger.info("")
        
        # ===================================================================
        # PHASE 3: UNSUPERVISED MACHINE LEARNING MODEL
        # ===================================================================
        logger.info("PHASE 3: UNSUPERVISED MACHINE LEARNING")
        logger.info("-" * 100)
        
        # Build the analytical model (KNN Imputation, Composite Score, PCA, K-Means + HDBSCAN)
        final_df, models = build_analytical_model(df_enriched, use_pca=True)
        
        logger.info("")
        logger.info("=" * 100)
        logger.info("MODEL VALIDATION METRICS")
        logger.info("=" * 100)
        logger.info(f"Clustering Method: {models.get('clustering_method', 'kmeans').upper()}")
        logger.info(f"Silhouette Score: {models['silhouette_score']:.4f}")
        logger.info("Interpretation: Scores > 0.5 indicate good cluster separation")
        logger.info("")
        
        # ===================================================================
        # OUTPUT GENERATION
        # ===================================================================
        logger.info("GENERATING OUTPUTS")
        logger.info("-" * 100)
        
        # Save CSV output
        save_csv_output(final_df, config.FINAL_OUTPUT_CSV)
        
        # Save GeoJSON output
        save_geojson_output(final_df, lga_gdf, config.GEOJSON_OUTPUT)
        
        # ===================================================================
        # DATABASE PERSISTENCE
        # ===================================================================
        logger.info("PERSISTING TO DATABASE")
        logger.info("-" * 100)
        
        try:
            upsert_hotspots_from_dataframe(final_df, data_source="INITIAL_PIPELINE")
            logger.info(f"Upserted {len(final_df)} records to database")
            
            n = save_history_snapshot()
            logger.info(f"History snapshot saved: {n} records")
        except Exception as db_err:
            logger.warning(f"Database write skipped: {db_err}")
            logger.warning("Run 'python -m src.migrate_to_db' to initialise the database")
        
        logger.info("")
        logger.info("=" * 100)
        logger.info("ANALYTICAL ENGINE EXECUTION COMPLETE")
        logger.info("=" * 100)
        logger.info(f"CSV Output: {config.FINAL_OUTPUT_CSV}")
        logger.info(f"GeoJSON Output: {config.GEOJSON_OUTPUT}")
        logger.info("")
        
        # Print summary statistics
        logger.info("SUMMARY STATISTICS")
        logger.info("-" * 100)
        logger.info(f"Total LGAs processed: {len(final_df)}")
        
        if 'cluster_label' in final_df.columns:
            logger.info("\nCluster Distribution:")
            for label, count in final_df['cluster_label'].value_counts().items():
                logger.info(f"  {label}: {count} LGAs ({count/len(final_df)*100:.1f}%)")
        
        if 'composite_poverty_score' in final_df.columns:
            logger.info(f"\nComposite Poverty Score: {final_df['composite_poverty_score'].mean():.4f} (mean)")
        
        if 'mean_nightlight_intensity' in final_df.columns:
            logger.info(f"Nightlight Intensity: {final_df['mean_nightlight_intensity'].mean():.2f} (mean)")
        
        return final_df, models
        
    except Exception as e:
        logger.error(f"ERROR: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    main()
