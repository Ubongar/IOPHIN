"""
Model engine module for Nigeria Poverty Hotspot Identifier System.
Implements data fusion, imputation, PCA, and K-means clustering.
"""
import numpy as np
import pandas as pd
import geopandas as gpd
from sklearn.impute import KNNImputer
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import logging

from . import config

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def prepare_poverty_features(df, state_mpi_df=None, senatorial_mpi_df=None):
    """
    Prepare poverty-related features from available data sources.
    
    Args:
        df: DataFrame with LGA data
        state_mpi_df: Optional state-level MPI data
        senatorial_mpi_df: Optional senatorial-level MPI data
    
    Returns:
        DataFrame: Enhanced with poverty features
    """
    logger.info("Preparing poverty features")
    
    result = df.copy()
    
    # If state MPI data is available, merge it
    if state_mpi_df is not None and 'State' in result.columns:
        logger.info("Merging state-level MPI data")
        
        # Clean state names
        state_mpi_clean = state_mpi_df.copy()
        if 'Admin 1 Name' in state_mpi_clean.columns:
            state_mpi_clean['State_Clean'] = state_mpi_clean['Admin 1 Name'].str.strip()
        result['State_Clean'] = result['State'].str.strip()
        
        # Select relevant columns
        mpi_cols = ['State_Clean']
        for col in ['MPI', 'Headcount Ratio', 'Intensity of Deprivation', 
                   'Vulnerable to Poverty', 'In Severe Poverty']:
            if col in state_mpi_clean.columns:
                mpi_cols.append(col)
        
        # Merge
        result = result.merge(
            state_mpi_clean[mpi_cols],
            on='State_Clean',
            how='left',
            suffixes=('', '_state')
        )
        
        result.drop(columns=['State_Clean'], inplace=True, errors='ignore')
        logger.info(f"Merged state MPI data: {len(mpi_cols)-1} columns added")
    
    return result


def impute_missing_values(df, feature_columns, n_neighbors=5):
    """
    Use KNN Imputation to fill missing values in poverty indicators.
    
    Args:
        df: DataFrame with features
        feature_columns: List of column names to impute
        n_neighbors: Number of neighbors for KNN imputation
    
    Returns:
        DataFrame: Data with imputed values
    """
    logger.info(f"Imputing missing values using KNN (k={n_neighbors})")
    
    # Check for missing values
    missing_counts = df[feature_columns].isnull().sum()
    logger.info(f"Missing values before imputation:\n{missing_counts[missing_counts > 0]}")
    
    # Apply KNN imputation
    imputer = KNNImputer(n_neighbors=n_neighbors)
    
    # Impute
    imputed_values = imputer.fit_transform(df[feature_columns])
    
    # Update dataframe
    result = df.copy()
    result[feature_columns] = imputed_values
    
    # Check results
    missing_after = result[feature_columns].isnull().sum()
    logger.info(f"Missing values after imputation: {missing_after.sum()}")
    
    return result


def standardize_features(df, feature_columns):
    """
    Apply StandardScaler to normalize features.
    This is important because poverty scores and nightlight values have different scales.
    
    Args:
        df: DataFrame with features
        feature_columns: List of column names to standardize
    
    Returns:
        DataFrame: Data with standardized features
        StandardScaler: Fitted scaler (for potential inverse transform)
    """
    logger.info("Standardizing features using StandardScaler")
    logger.info("This normalizes Survey Poverty Scores and Nightlights to comparable scales")
    
    scaler = StandardScaler()
    
    # Fit and transform
    scaled_values = scaler.fit_transform(df[feature_columns])
    
    # Create new dataframe with scaled features
    result = df.copy()
    scaled_columns = [f"{col}_scaled" for col in feature_columns]
    result[scaled_columns] = scaled_values
    
    logger.info(f"Standardized {len(feature_columns)} features")
    
    return result, scaler, scaled_columns


def apply_pca(df, feature_columns, variance_threshold=0.95):
    """
    Apply PCA to reduce dimensionality while keeping specified variance.
    
    Args:
        df: DataFrame with features
        feature_columns: List of column names to apply PCA on
        variance_threshold: Proportion of variance to retain (default: 0.95)
    
    Returns:
        DataFrame: Data with PCA components
        PCA: Fitted PCA model
        list: Names of PCA component columns
    """
    logger.info(f"Applying PCA to reduce dimensionality (keeping {variance_threshold*100}% variance)")
    
    # Apply PCA
    pca = PCA(n_components=variance_threshold, svd_solver='full')
    pca_values = pca.fit_transform(df[feature_columns])
    
    # Create component columns
    n_components = pca_values.shape[1]
    pca_columns = [f"PC{i+1}" for i in range(n_components)]
    
    # Add to dataframe
    result = df.copy()
    result[pca_columns] = pca_values
    
    logger.info(f"PCA reduced {len(feature_columns)} features to {n_components} components")
    logger.info(f"Explained variance ratio: {pca.explained_variance_ratio_}")
    logger.info(f"Total variance explained: {pca.explained_variance_ratio_.sum():.4f}")
    
    return result, pca, pca_columns


def perform_kmeans_clustering(df, feature_columns, n_clusters=4, random_state=42):
    """
    Perform K-Means clustering to identify poverty hotspots.
    
    Logic: 
    - High Nightlights + Low Deprivation = Wealthy (Minimal Risk)
    - Low Nightlights + High Deprivation = Severe Hotspot (High Risk)
    
    Args:
        df: DataFrame with features
        feature_columns: List of columns to use for clustering
        n_clusters: Number of clusters (default: 4)
        random_state: Random seed for reproducibility
    
    Returns:
        DataFrame: Data with cluster assignments
        KMeans: Fitted clustering model
        float: Silhouette score
    """
    logger.info(f"Performing K-Means clustering with k={n_clusters}")
    
    # Fit K-Means
    kmeans = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10)
    cluster_labels = kmeans.fit_predict(df[feature_columns])
    
    # Calculate silhouette score for validation
    silhouette = silhouette_score(df[feature_columns], cluster_labels)
    
    logger.info(f"Clustering complete")
    logger.info(f"Silhouette Score: {silhouette:.4f}")
    
    # Add cluster labels to dataframe
    result = df.copy()
    result['cluster'] = cluster_labels
    
    # Analyze cluster characteristics to assign meaningful labels
    result = assign_cluster_labels(result, feature_columns)
    
    # Distribution
    cluster_dist = result['cluster'].value_counts().sort_index()
    logger.info(f"Cluster distribution:\n{cluster_dist}")
    
    return result, kmeans, silhouette


def assign_cluster_labels(df, feature_columns):
    """
    Assign meaningful labels to clusters based on their characteristics.
    
    The logic:
    - Clusters with high nightlight + low poverty indicators = Wealthy
    - Clusters with low nightlight + high poverty indicators = Severe Poverty
    
    Args:
        df: DataFrame with cluster assignments
        feature_columns: Features used for clustering
    
    Returns:
        DataFrame: With 'cluster_label' and 'risk_level' columns
    """
    logger.info("Assigning meaningful labels to clusters")
    
    result = df.copy()
    
    # Calculate cluster centroids for interpretation
    cluster_stats = []
    for cluster_id in sorted(result['cluster'].unique()):
        cluster_data = result[result['cluster'] == cluster_id]
        
        # Get mean values for key indicators
        stats = {'cluster': cluster_id}
        
        if 'mean_nightlight_intensity' in cluster_data.columns:
            stats['mean_nightlight'] = cluster_data['mean_nightlight_intensity'].mean()
        
        # Check for poverty indicators
        poverty_cols = [col for col in cluster_data.columns 
                       if any(x in col.lower() for x in ['mpi', 'poverty', 'deprivation', 'headcount'])]
        
        if poverty_cols:
            # Average across all poverty indicators
            stats['mean_poverty'] = cluster_data[poverty_cols].mean().mean()
        
        stats['count'] = len(cluster_data)
        cluster_stats.append(stats)
    
    cluster_df = pd.DataFrame(cluster_stats)
    logger.info(f"Cluster statistics:\n{cluster_df}")
    
    # Assign labels based on characteristics
    # Sort by nightlight (ascending) and poverty (descending) to identify severity
    if 'mean_nightlight' in cluster_df.columns and 'mean_poverty' in cluster_df.columns:
        # Create a composite score: high poverty + low nightlight = high risk
        cluster_df['risk_score'] = cluster_df['mean_poverty'] / (cluster_df['mean_nightlight'] + 1)
        cluster_df = cluster_df.sort_values('risk_score', ascending=False)
    elif 'mean_nightlight' in cluster_df.columns:
        # Use only nightlight (lower = higher risk)
        cluster_df = cluster_df.sort_values('mean_nightlight', ascending=True)
    else:
        # No clear ordering
        pass
    
    # Create mapping based on risk ordering
    label_mapping = {}
    risk_mapping = {}
    
    for idx, row in cluster_df.iterrows():
        cluster_id = row['cluster']
        
        if idx == 0 or (idx < len(cluster_df) * 0.25):
            # Highest risk
            label_mapping[cluster_id] = "High Risk - Severe Poverty"
            risk_mapping[cluster_id] = "High"
        elif idx < len(cluster_df) * 0.5:
            # Medium-high risk
            label_mapping[cluster_id] = "Medium Risk - Poor"
            risk_mapping[cluster_id] = "Medium"
        elif idx < len(cluster_df) * 0.75:
            # Medium-low risk
            label_mapping[cluster_id] = "Low Risk - Vulnerable"
            risk_mapping[cluster_id] = "Low"
        else:
            # Lowest risk
            label_mapping[cluster_id] = "Minimal Risk - Wealthy"
            risk_mapping[cluster_id] = "Minimal"
    
    # Apply mappings
    result['cluster_label'] = result['cluster'].map(label_mapping)
    result['risk_level'] = result['cluster'].map(risk_mapping)
    
    # Log distribution
    label_dist = result['cluster_label'].value_counts()
    logger.info(f"Cluster label distribution:\n{label_dist}")
    
    return result


def build_analytical_model(df, use_pca=True):
    """
    Complete analytical pipeline: imputation, standardization, PCA, and clustering.
    
    Args:
        df: DataFrame with all features (nightlight + poverty indicators)
        use_pca: Whether to apply PCA (default: True)
    
    Returns:
        DataFrame: Final results with cluster assignments
        dict: Dictionary with model objects and metrics
    """
    logger.info("=" * 80)
    logger.info("BUILDING ANALYTICAL ENGINE - PHASE 2 & 3")
    logger.info("=" * 80)
    
    result = df.copy()
    models = {}
    
    # Identify feature columns (numeric columns except identifiers)
    exclude_cols = ['LGA_Name', 'State', 'Latitude', 'Longitude', 'Cluster_Label', 'Risk_Level']
    feature_cols = [col for col in result.columns 
                   if result[col].dtype in ['float64', 'int64', 'float32', 'int32']
                   and col not in exclude_cols]
    
    logger.info(f"Feature columns identified: {feature_cols}")
    
    # Phase 2.1: Impute missing values
    if result[feature_cols].isnull().sum().sum() > 0:
        result = impute_missing_values(result, feature_cols, n_neighbors=config.KNN_NEIGHBORS)
    else:
        logger.info("No missing values detected - skipping imputation")
    
    # Phase 2.2: Standardize features
    result, scaler, scaled_cols = standardize_features(result, feature_cols)
    models['scaler'] = scaler
    
    # Phase 3.1: Apply PCA (optional)
    if use_pca and len(feature_cols) > 2:
        result, pca, pca_cols = apply_pca(result, scaled_cols, variance_threshold=config.PCA_VARIANCE)
        models['pca'] = pca
        clustering_features = pca_cols
    else:
        logger.info("Skipping PCA (not enough features or disabled)")
        clustering_features = scaled_cols
    
    # Phase 3.2: K-Means Clustering
    result, kmeans, silhouette = perform_kmeans_clustering(
        result, 
        clustering_features, 
        n_clusters=config.K_CLUSTERS
    )
    models['kmeans'] = kmeans
    models['silhouette_score'] = silhouette
    
    logger.info("=" * 80)
    logger.info(f"ANALYTICAL ENGINE COMPLETE - Silhouette Score: {silhouette:.4f}")
    logger.info("=" * 80)
    
    return result, models
