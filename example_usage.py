"""
Example Usage Script for Poverty Hotspot Identifier
====================================================

This script demonstrates how to use the PovertyHotspotModel class
to analyze poverty data and identify hotspots in Nigeria.

Usage:
    python example_usage.py

Author: Senior ML Engineer & Data Scientist
"""

import sys
import os

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from poverty_hotspot_model import PovertyHotspotModel
import pandas as pd
import numpy as np


def create_sample_data(n_lgas=300, output_file='nigeria_mpi_lga_data.csv'):
    """
    Create synthetic sample data for demonstration purposes.
    
    In production, replace this with actual Nigeria MPI data.
    
    Args:
        n_lgas (int): Number of LGAs to simulate
        output_file (str): Output CSV filename
    """
    print(f"Creating sample data with {n_lgas} LGAs...")
    
    np.random.seed(42)
    
    # Generate synthetic data
    data = {
        # Identifiers
        'state': [f'State_{i//10}' for i in range(n_lgas)],
        'lga': [f'LGA_{i}' for i in range(n_lgas)],
        'lga_id': range(1, n_lgas + 1),
        
        # Socioeconomic Features (percentages/rates)
        'nutrition_score': np.random.uniform(40, 90, n_lgas),
        'food_insecurity_rate': np.random.uniform(10, 60, n_lgas),
        'years_of_schooling': np.random.uniform(3, 12, n_lgas),
        'school_attendance_rate': np.random.uniform(50, 95, n_lgas),
        'unemployment_rate': np.random.uniform(5, 40, n_lgas),
        'security_shock_incidence': np.random.uniform(0, 30, n_lgas),
        
        # Infrastructure Features (percentages/indices)
        'electricity_access': np.random.uniform(20, 90, n_lgas),
        'sanitation_access': np.random.uniform(30, 85, n_lgas),
        'water_reliability': np.random.uniform(25, 80, n_lgas),
        'housing_quality_index': np.random.uniform(40, 90, n_lgas),
        
        # Geospatial Features
        'nightlight_intensity': np.random.uniform(0, 50, n_lgas),
        'population_density': np.random.uniform(50, 5000, n_lgas),
        'road_density': np.random.uniform(0.1, 5.0, n_lgas),
    }
    
    # Create DataFrame
    df = pd.DataFrame(data)
    
    # Introduce some missing values (5% missing rate)
    for col in df.columns[3:]:  # Only in feature columns
        mask = np.random.random(n_lgas) < 0.05
        df.loc[mask, col] = np.nan
    
    # Add some correlations to make clusters more realistic
    # High poverty cluster
    high_poverty_mask = df['food_insecurity_rate'] > 45
    df.loc[high_poverty_mask, 'electricity_access'] *= 0.6
    df.loc[high_poverty_mask, 'school_attendance_rate'] *= 0.7
    df.loc[high_poverty_mask, 'nightlight_intensity'] *= 0.5
    
    # Low poverty cluster
    low_poverty_mask = df['food_insecurity_rate'] < 25
    df.loc[low_poverty_mask, 'electricity_access'] *= 1.2
    df.loc[low_poverty_mask, 'school_attendance_rate'] = np.minimum(
        df.loc[low_poverty_mask, 'school_attendance_rate'] * 1.1, 95
    )
    df.loc[low_poverty_mask, 'nightlight_intensity'] *= 1.3
    
    # Save to CSV
    df.to_csv(output_file, index=False)
    print(f"Sample data saved to: {output_file}")
    print(f"Shape: {df.shape}")
    print(f"Missing values: {df.isnull().sum().sum()}")
    
    return df


def main():
    """
    Main execution function demonstrating the complete pipeline.
    """
    print("="*80)
    print("POVERTY HOTSPOT IDENTIFIER - EXAMPLE USAGE")
    print("="*80)
    
    # Step 1: Create or load data
    data_file = 'nigeria_mpi_lga_data.csv'
    
    if not os.path.exists(data_file):
        print("\nNo data file found. Creating sample data...")
        create_sample_data(n_lgas=300, output_file=data_file)
    else:
        print(f"\nUsing existing data file: {data_file}")
    
    # Step 2: Initialize the model
    print("\n" + "="*80)
    print("STEP 1: INITIALIZE MODEL")
    print("="*80)
    model = PovertyHotspotModel()
    
    # Step 3: Load and clean data
    print("\n" + "="*80)
    print("STEP 2: LOAD AND CLEAN DATA")
    print("="*80)
    cleaned_data = model.load_and_clean_data(data_file)
    
    # Step 4: Reduce dimensionality with PCA
    print("\n" + "="*80)
    print("STEP 3: DIMENSIONALITY REDUCTION (PCA)")
    print("="*80)
    print("\nOption A: Keep components that explain 95% variance")
    pca_data = model.reduce_dimensionality(n_components=0.95)
    
    # Alternative: Specify exact number of components
    # print("\nOption B: Keep exactly 5 components")
    # pca_data = model.reduce_dimensionality(n_components=5)
    
    # Step 5: Find optimal number of clusters
    print("\n" + "="*80)
    print("STEP 4: FIND OPTIMAL NUMBER OF CLUSTERS")
    print("="*80)
    metrics = model.find_optimal_clusters(k_range=range(2, 11))
    
    print("\nPlease inspect 'cluster_optimization.png' to select optimal k.")
    print("Recommendation: Choose k where:")
    print("  - Elbow curve bends (diminishing returns in WCSS)")
    print("  - Silhouette score is maximized")
    
    # Step 6: Train clustering models
    print("\n" + "="*80)
    print("STEP 5: TRAIN CLUSTERING MODELS")
    print("="*80)
    
    # For this example, we'll use k=4 (you should adjust based on the plots)
    k_optimal = 4
    print(f"\nUsing k={k_optimal} (adjust this based on cluster_optimization.png)")
    
    labels = model.train_clustering_models(
        k_optimal=k_optimal,
        dbscan_eps=0.5,
        dbscan_min_samples=5,
        use_kmeans=True
    )
    
    # Step 7: Generate cluster profiles
    print("\n" + "="*80)
    print("STEP 6: GENERATE CLUSTER PROFILES")
    print("="*80)
    cluster_profiles = model.generate_cluster_profiles()
    
    # Step 8: Save results
    print("\n" + "="*80)
    print("STEP 7: SAVE RESULTS")
    print("="*80)
    saved_paths = model.save_results(
        output_csv='processed_hotspots.csv',
        model_dir='models'
    )
    
    # Summary
    print("\n" + "="*80)
    print("PIPELINE EXECUTION COMPLETE!")
    print("="*80)
    print("\nGenerated Files:")
    print(f"  1. processed_hotspots.csv - LGA data with cluster labels")
    print(f"  2. pca_variance_explained.png - PCA analysis visualization")
    print(f"  3. cluster_optimization.png - Cluster selection visualization")
    print(f"  4. models/ - Trained models (scaler, PCA, K-Means, DBSCAN)")
    
    print("\nNext Steps:")
    print("  1. Review cluster_optimization.png to validate k selection")
    print("  2. Analyze cluster profiles to understand poverty patterns")
    print("  3. Load processed_hotspots.csv into GIS/dashboard for visualization")
    print("  4. Design targeted interventions based on cluster characteristics")
    
    print("\n" + "="*80)
    
    # Optional: Demonstrate inference on new data
    print("\nDEMONSTRATION: Predicting clusters for new LGAs")
    print("="*80)
    
    # Create a few new LGA samples
    new_lga_data = pd.DataFrame({
        'state': ['NewState'] * 3,
        'lga': ['NewLGA_1', 'NewLGA_2', 'NewLGA_3'],
        'lga_id': [9001, 9002, 9003],
        'nutrition_score': [60, 75, 45],
        'food_insecurity_rate': [35, 20, 50],
        'years_of_schooling': [6, 9, 4],
        'school_attendance_rate': [65, 85, 55],
        'unemployment_rate': [25, 15, 35],
        'security_shock_incidence': [15, 5, 25],
        'electricity_access': [45, 75, 30],
        'sanitation_access': [50, 70, 35],
        'water_reliability': [40, 65, 30],
        'housing_quality_index': [55, 80, 45],
        'nightlight_intensity': [15, 35, 8],
        'population_density': [800, 2500, 500],
        'road_density': [1.2, 3.5, 0.8],
    })
    
    print("\nNew LGA data:")
    print(new_lga_data[['lga', 'food_insecurity_rate', 'electricity_access']].to_string())
    
    predictions = model.predict_cluster(new_lga_data)
    print(f"\nPredicted clusters: {predictions}")
    print(f"  NewLGA_1 → Cluster {predictions[0]}")
    print(f"  NewLGA_2 → Cluster {predictions[1]}")
    print(f"  NewLGA_3 → Cluster {predictions[2]}")
    
    print("\n" + "="*80)
    print("ALL DONE! ✓")
    print("="*80)


if __name__ == "__main__":
    main()
