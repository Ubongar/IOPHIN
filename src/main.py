"""
Main pipeline script for Nigeria Poverty Hotspot Identifier System.
Orchestrates the complete analytical workflow.
"""
import sys
import logging
import pandas as pd
import geopandas as gpd
import json

from src import config
from src.data_loader import (
    load_lga_shapefile,
    load_state_mpi_data,
    load_senatorial_mpi_data,
    load_processed_hotspots
)
from src.feature_extraction import extract_nightlight_from_processed_csv
from src.model_engine import prepare_poverty_features, build_analytical_model

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
    
    # Select relevant columns for output
    output_cols = ['LGA_Name', 'State', 'Latitude', 'Longitude']
    
    # Add feature columns
    for col in ['mean_nightlight_intensity', 'MPI', 'Headcount Ratio', 
               'Intensity of Deprivation', 'In Severe Poverty']:
        if col in df.columns:
            output_cols.append(col)
    
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
    
    Args:
        df: DataFrame with cluster results
        gdf: GeoDataFrame with LGA geometries
        output_path: Path to output GeoJSON file
    """
    logger.info(f"Saving GeoJSON output to {output_path}")
    
    # Find LGA name column in shapefile
    lga_col = None
    for col in ['LGA_NAME', 'ADM2_EN', 'LGAName', 'Name']:
        if col in gdf.columns:
            lga_col = col
            break
    
    if lga_col is None:
        logger.error("Could not find LGA name column in shapefile")
        logger.warning("Creating simplified GeoJSON without geometries")
        
        # Create point geometries from lat/lon
        if 'Latitude' in df.columns and 'Longitude' in df.columns:
            from shapely.geometry import Point
            geometry = [Point(xy) for xy in zip(df['Longitude'], df['Latitude'])]
            geo_df = gpd.GeoDataFrame(df, geometry=geometry, crs='EPSG:4326')
        else:
            logger.error("Cannot create GeoJSON without coordinates")
            return
    else:
        # Merge results with geometries
        logger.info(f"Merging results with geometries using column: {lga_col}")
        
        # Prepare merge
        gdf_copy = gdf[[lga_col, 'geometry']].copy()
        gdf_copy['LGA_Name_merge'] = gdf_copy[lga_col].str.strip()
        
        df_copy = df.copy()
        df_copy['LGA_Name_merge'] = df_copy['LGA_Name'].str.strip()
        
        # Merge
        geo_df = gdf_copy.merge(df_copy, on='LGA_Name_merge', how='inner')
        geo_df = gpd.GeoDataFrame(geo_df, geometry='geometry')
        
        logger.info(f"Merged {len(geo_df)} LGAs with geometries")
    
    # Select columns for GeoJSON
    geojson_cols = ['LGA_Name', 'State', 'cluster_label', 'risk_level']
    
    # Add numeric features if available
    for col in ['mean_nightlight_intensity', 'MPI', 'Headcount Ratio']:
        if col in geo_df.columns:
            geojson_cols.append(col)
    
    # Add geometry
    geojson_cols.append('geometry')
    
    # Filter to available
    available_cols = [col for col in geojson_cols if col in geo_df.columns]
    
    # Save as GeoJSON
    geo_df[available_cols].to_file(output_path, driver='GeoJSON')
    logger.info(f"Saved GeoJSON with {len(geo_df)} features to {output_path}")


def main():
    """
    Main execution function.
    """
    logger.info("=" * 100)
    logger.info("NIGERIA POVERTY HOTSPOT IDENTIFIER - ANALYTICAL ENGINE")
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
        
        # Merge poverty features
        logger.info("Step 2.2: Merging poverty data")
        df_enriched = prepare_poverty_features(df_with_nightlight, state_mpi, senatorial_mpi)
        
        logger.info(f"Phase 2 complete: {len(df_enriched)} LGAs with enriched features")
        logger.info("")
        
        # ===================================================================
        # PHASE 3: UNSUPERVISED MACHINE LEARNING MODEL
        # ===================================================================
        logger.info("PHASE 3: UNSUPERVISED MACHINE LEARNING")
        logger.info("-" * 100)
        
        # Build the analytical model (KNN Imputation, Standardization, PCA, K-Means)
        final_df, models = build_analytical_model(df_enriched, use_pca=True)
        
        logger.info("")
        logger.info("=" * 100)
        logger.info("MODEL VALIDATION METRICS")
        logger.info("=" * 100)
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
        
        if 'mean_nightlight_intensity' in final_df.columns:
            logger.info(f"\nNightlight Intensity: {final_df['mean_nightlight_intensity'].mean():.2f} (mean)")
        
        return final_df, models
        
    except Exception as e:
        logger.error(f"ERROR: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    main()
