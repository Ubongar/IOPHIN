"""
Model engine module for Nigeria Poverty Hotspot Identifier System.
Implements data fusion, imputation, PCA, K-means and HDBSCAN clustering,
and a weighted composite poverty score.
"""
import numpy as np
import pandas as pd
import geopandas as gpd
from sklearn.impute import KNNImputer
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import logging

from . import config

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Try importing HDBSCAN — optional dependency
try:
    import hdbscan as _hdbscan
    HDBSCAN_AVAILABLE = True
except ImportError:
    HDBSCAN_AVAILABLE = False
    logger.info("hdbscan not installed — will use K-Means only. pip install hdbscan")


# ─── Feature preparation ─────────────────────────────────────────────────────

def prepare_poverty_features(df, state_mpi_df=None, senatorial_mpi_df=None):
    """
    Prepare poverty-related features from available data sources.
    Now also accounts for senatorial MPI columns if already merged by data_loader.

    Args:
        df: DataFrame with LGA data (may already have senatorial_* columns)
        state_mpi_df: Optional state-level MPI data
        senatorial_mpi_df: Optional senatorial-level MPI data (unused if already merged)

    Returns:
        DataFrame: Enhanced with poverty features
    """
    logger.info("Preparing poverty features")

    result = df.copy()

    # ── Merge state MPI if not already present ──────────────────────────────
    if state_mpi_df is not None and 'State' in result.columns and 'MPI' not in result.columns:
        logger.info("Merging state-level MPI data")

        state_mpi_clean = state_mpi_df.copy()

        state_col = None
        for cn in ('Admin 1 Name', '#adm1+name'):
            if cn in state_mpi_clean.columns:
                state_col = cn
                break

        if state_col:
            state_mpi_clean['State_Clean'] = state_mpi_clean[state_col].str.strip()
            result['State_Clean'] = result['State'].str.strip()

            mpi_cols = ['State_Clean']
            col_mapping = {
                'MPI': ['MPI', '#indicator+mpi'],
                'Headcount_Ratio': ['Headcount Ratio', '#indicator+headcount_ratio'],
                'Intensity_of_Deprivation': ['Intensity of Deprivation', '#indicator+intensity_of_deprivation'],
                'Vulnerable_to_Poverty': ['Vulnerable to Poverty', '#indicator+vulnerable_to_poverty'],
                'In_Severe_Poverty': ['In Severe Poverty', '#indicator+in_severe_poverty'],
            }

            rename_dict = {}
            for friendly_name, possible_cols in col_mapping.items():
                for col in possible_cols:
                    if col in state_mpi_clean.columns:
                        mpi_cols.append(col)
                        rename_dict[col] = friendly_name
                        break

            if len(mpi_cols) > 1:
                merge_df = state_mpi_clean[mpi_cols].rename(columns=rename_dict)
                result = result.merge(merge_df, on='State_Clean', how='left', suffixes=('', '_state'))
                result.drop(columns=['State_Clean'], inplace=True, errors='ignore')
                logger.info(f"Merged state MPI data: {len(mpi_cols) - 1} columns added")

    # ── Use senatorial MPI as primary source if available ────────────────────
    # If senatorial_mpi column exists (from data_loader fuzzy merge), prefer it
    if 'senatorial_mpi' in result.columns and 'MPI' in result.columns:
        # Where senatorial MPI is available, replace coarse state MPI
        mask = result['senatorial_mpi'].notna()
        n_upgraded = mask.sum()
        result.loc[mask, 'MPI'] = result.loc[mask, 'senatorial_mpi']
        if 'senatorial_headcount' in result.columns:
            result.loc[mask, 'Headcount_Ratio'] = result.loc[mask, 'senatorial_headcount']
        if 'senatorial_intensity' in result.columns:
            result.loc[mask, 'Intensity_of_Deprivation'] = result.loc[mask, 'senatorial_intensity']
        logger.info(f"Upgraded {n_upgraded} LGAs to senatorial-level MPI (3× resolution)")

    return result


# ─── Imputation ───────────────────────────────────────────────────────────────

def impute_missing_values(df, feature_columns, n_neighbors=5):
    """KNN Imputation for missing values."""
    logger.info(f"Imputing missing values using KNN (k={n_neighbors})")

    missing_counts = df[feature_columns].isnull().sum()
    logger.info(f"Missing values before imputation:\n{missing_counts[missing_counts > 0]}")

    result = df.copy()

    # Separate columns that are entirely NaN (KNNImputer drops them)
    all_nan_cols = [c for c in feature_columns if result[c].isnull().all()]
    imputable_cols = [c for c in feature_columns if c not in all_nan_cols]

    if all_nan_cols:
        logger.warning(f"Columns entirely NaN (filled with 0): {all_nan_cols}")
        result[all_nan_cols] = 0.0

    if imputable_cols:
        imputer = KNNImputer(n_neighbors=n_neighbors)
        imputed_values = imputer.fit_transform(result[imputable_cols])
        result[imputable_cols] = imputed_values

    missing_after = result[feature_columns].isnull().sum()
    logger.info(f"Missing values after imputation: {missing_after.sum()}")

    return result


# ─── Standardisation ──────────────────────────────────────────────────────────

def standardize_features(df, feature_columns):
    """Apply StandardScaler to normalise features."""
    logger.info("Standardizing features using StandardScaler")

    scaler = StandardScaler()
    scaled_values = scaler.fit_transform(df[feature_columns])

    result = df.copy()
    scaled_columns = [f"{col}_scaled" for col in feature_columns]
    result[scaled_columns] = scaled_values

    logger.info(f"Standardized {len(feature_columns)} features")
    return result, scaler, scaled_columns


# ─── PCA ──────────────────────────────────────────────────────────────────────

def apply_pca(df, feature_columns, variance_threshold=0.95):
    """Apply PCA for dimensionality reduction."""
    logger.info(f"Applying PCA (keeping {variance_threshold * 100}% variance)")

    pca = PCA(n_components=variance_threshold, svd_solver='full')
    pca_values = pca.fit_transform(df[feature_columns])

    n_components = pca_values.shape[1]
    pca_columns = [f"PC{i + 1}" for i in range(n_components)]

    result = df.copy()
    result[pca_columns] = pca_values

    logger.info(f"PCA: {len(feature_columns)} features → {n_components} components")
    logger.info(f"Explained variance: {pca.explained_variance_ratio_.sum():.4f}")

    return result, pca, pca_columns


# ─── Composite poverty score ─────────────────────────────────────────────────

def compute_composite_poverty_score(df):
    """
    Compute a weighted composite poverty score per LGA.
    Uses weights from config.COMPOSITE_WEIGHTS.  Each sub-indicator is
    MinMax-scaled to [0, 1] before weighting so that the final score is
    also on a 0-1 scale (1 = worst poverty).

    Indicators:
        - mpi                       (higher = worse)
        - inverse_nightlight        (lower nightlight = worse)
        - health_access             (fewer facilities per person = worse)
        - education_access          (fewer schools per person = worse)
        - infrastructure            (lower road density = worse)

    Missing indicators get weight 0, and the remaining weights are renormalised.
    """
    logger.info("Computing composite poverty score")

    result = df.copy()
    weights = config.COMPOSITE_WEIGHTS.copy()
    scaler = MinMaxScaler()

    components = {}

    # MPI (already 0-1 scale, higher is worse)
    if 'MPI' in result.columns or 'mpi' in result.columns:
        col = 'MPI' if 'MPI' in result.columns else 'mpi'
        vals = result[col].fillna(result[col].median()).values.reshape(-1, 1)
        components['mpi'] = scaler.fit_transform(vals).flatten()
    else:
        weights.pop('mpi', None)

    # Inverse nightlight (lower nightlight = more poverty)
    if 'mean_nightlight_intensity' in result.columns:
        vals = result['mean_nightlight_intensity'].fillna(result['mean_nightlight_intensity'].median()).values.reshape(-1, 1)
        scaled = scaler.fit_transform(vals).flatten()
        components['inverse_nightlight'] = 1.0 - scaled  # invert: low nightlight → high score
    else:
        weights.pop('inverse_nightlight', None)

    # Health access (fewer facilities = worse)
    if 'health_facility_count' in result.columns:
        vals = result['health_facility_count'].fillna(0).values.reshape(-1, 1)
        scaled = scaler.fit_transform(vals).flatten()
        components['health_access'] = 1.0 - scaled  # invert: fewer = higher score
    else:
        weights.pop('health_access', None)

    # Education access
    if 'school_count' in result.columns:
        vals = result['school_count'].fillna(0).values.reshape(-1, 1)
        scaled = scaler.fit_transform(vals).flatten()
        components['education_access'] = 1.0 - scaled
    else:
        weights.pop('education_access', None)

    # Infrastructure (road density)
    if 'road_density_km' in result.columns:
        vals = result['road_density_km'].fillna(0).values.reshape(-1, 1)
        scaled = scaler.fit_transform(vals).flatten()
        components['infrastructure'] = 1.0 - scaled
    else:
        weights.pop('infrastructure', None)

    if not components:
        logger.warning("No components available for composite score")
        result['composite_poverty_score'] = np.nan
        return result

    # Renormalise weights
    total_weight = sum(weights.values())
    norm_weights = {k: v / total_weight for k, v in weights.items()}

    composite = np.zeros(len(result))
    for key, values in components.items():
        w = norm_weights.get(key, 0)
        composite += w * values
        logger.info(f"  component '{key}' weight={w:.3f} mean={values.mean():.3f}")

    result['composite_poverty_score'] = composite
    logger.info(f"Composite poverty score: mean={composite.mean():.4f}, std={composite.std():.4f}")

    return result


# ─── Clustering ───────────────────────────────────────────────────────────────

def perform_kmeans_clustering(df, feature_columns, n_clusters=None, random_state=42):
    """K-Means clustering."""
    n_clusters = n_clusters or config.K_CLUSTERS
    logger.info(f"Performing K-Means clustering with k={n_clusters}")

    kmeans = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10)
    cluster_labels = kmeans.fit_predict(df[feature_columns])

    silhouette = silhouette_score(df[feature_columns], cluster_labels)
    logger.info(f"K-Means silhouette score: {silhouette:.4f}")

    result = df.copy()
    result['cluster'] = cluster_labels

    return result, kmeans, silhouette


def perform_hdbscan_clustering(df, feature_columns, min_cluster_size=None):
    """
    HDBSCAN density-based clustering (no need to pre-specify k).
    Noise points (label -1) are assigned to the nearest cluster centroid.
    """
    if not HDBSCAN_AVAILABLE:
        logger.warning("HDBSCAN not available — falling back to K-Means")
        return None, None, -1.0

    min_cluster_size = min_cluster_size or config.HDBSCAN_MIN_CLUSTER_SIZE
    logger.info(f"Performing HDBSCAN clustering (min_cluster_size={min_cluster_size})")

    clusterer = _hdbscan.HDBSCAN(min_cluster_size=min_cluster_size, prediction_data=True)
    labels = clusterer.fit_predict(df[feature_columns].values)

    # Handle noise: reassign -1 labels to nearest non-noise cluster centroid
    unique_labels = set(labels)
    if -1 in unique_labels and len(unique_labels) > 1:
        non_noise_mask = labels != -1
        centroids = {}
        for lbl in unique_labels - {-1}:
            centroids[lbl] = df[feature_columns].values[labels == lbl].mean(axis=0)

        noise_indices = np.where(labels == -1)[0]
        for idx in noise_indices:
            point = df[feature_columns].values[idx]
            best_lbl = min(centroids, key=lambda l: np.linalg.norm(point - centroids[l]))
            labels[idx] = best_lbl

        logger.info(f"Reassigned {len(noise_indices)} noise points to nearest cluster")

    n_unique = len(set(labels))
    if n_unique < 2:
        logger.warning(f"HDBSCAN found only {n_unique} cluster(s) — not useful")
        return None, None, -1.0

    silhouette = silhouette_score(df[feature_columns], labels)
    logger.info(f"HDBSCAN silhouette score: {silhouette:.4f} ({n_unique} clusters)")

    result = df.copy()
    result['cluster'] = labels

    return result, clusterer, silhouette


def assign_cluster_labels(df, feature_columns):
    """
    Assign meaningful labels to clusters based on their characteristics.
    Supports 5 tiers: Critical / High / Medium / Low / Minimal.
    """
    logger.info("Assigning meaningful labels to clusters")

    result = df.copy()
    n_clusters = result['cluster'].nunique()

    # Calculate cluster centroids
    cluster_stats = []
    for cluster_id in sorted(result['cluster'].unique()):
        cluster_data = result[result['cluster'] == cluster_id]

        stats = {'cluster': cluster_id, 'count': len(cluster_data)}

        if 'mean_nightlight_intensity' in cluster_data.columns:
            stats['mean_nightlight'] = cluster_data['mean_nightlight_intensity'].mean()

        poverty_cols = [c for c in cluster_data.columns
                        if any(x in c.lower() for x in ['mpi', 'poverty', 'deprivation', 'headcount', 'composite'])]
        if poverty_cols:
            stats['mean_poverty'] = cluster_data[poverty_cols].mean().mean()

        cluster_stats.append(stats)

    cluster_df = pd.DataFrame(cluster_stats)
    logger.info(f"Cluster statistics:\n{cluster_df}")

    # Create risk score for ordering
    if 'mean_nightlight' in cluster_df.columns and 'mean_poverty' in cluster_df.columns:
        cluster_df['risk_score'] = cluster_df['mean_poverty'] / (cluster_df['mean_nightlight'] + 1e-6)
        cluster_df = cluster_df.sort_values('risk_score', ascending=False)
    elif 'mean_nightlight' in cluster_df.columns:
        cluster_df = cluster_df.sort_values('mean_nightlight', ascending=True)

    # 5-tier labelling from config.CLUSTER_LABELS
    labels_list = list(config.CLUSTER_LABELS.values())  # ordered 0..4
    risks_list = ['Critical', 'High', 'Medium', 'Low', 'Minimal']

    label_mapping = {}
    risk_mapping = {}

    sorted_clusters = cluster_df['cluster'].tolist()

    for rank, cluster_id in enumerate(sorted_clusters):
        if n_clusters <= len(labels_list):
            tier_idx = min(rank, len(labels_list) - 1)
        else:
            # More clusters than tiers — bucket proportionally
            tier_idx = min(int(rank / n_clusters * len(labels_list)), len(labels_list) - 1)
        label_mapping[cluster_id] = labels_list[tier_idx]
        risk_mapping[cluster_id] = risks_list[tier_idx]

    result['cluster_label'] = result['cluster'].map(label_mapping)
    result['risk_level'] = result['cluster'].map(risk_mapping)

    label_dist = result['cluster_label'].value_counts()
    logger.info(f"Cluster label distribution:\n{label_dist}")

    return result


# ─── Main pipeline ────────────────────────────────────────────────────────────

def build_analytical_model(df, use_pca=True):
    """
    Complete analytical pipeline:
        1. Imputation
        2. Composite poverty score
        3. Standardisation
        4. PCA
        5. K-Means *and* HDBSCAN (pick best silhouette)
        6. Label assignment

    Returns:
        DataFrame: Final results with cluster assignments
        dict: Model objects and metrics
    """
    logger.info("=" * 80)
    logger.info("BUILDING ANALYTICAL ENGINE")
    logger.info("=" * 80)

    result = df.copy()
    models = {}

    # Identify numeric feature columns
    exclude_cols = {'LGA_Name', 'State', 'Latitude', 'Longitude', 'Cluster_Label',
                    'Risk_Level', 'geometry', 'State_Clean', 'senatorial_district',
                    '_state_norm', 'conflict_flag', 'last_conflict_event',
                    'data_source', 'last_updated', 'clustering_method'}
    feature_cols = [col for col in result.columns
                    if result[col].dtype in ('float64', 'int64', 'float32', 'int32')
                    and col not in exclude_cols]

    logger.info(f"Feature columns: {feature_cols}")

    # ── Phase 2.1: Imputation ────────────────────────────────────────────
    if result[feature_cols].isnull().sum().sum() > 0:
        result = impute_missing_values(result, feature_cols, n_neighbors=config.KNN_NEIGHBORS)
    else:
        logger.info("No missing values — skipping imputation")

    # ── Phase 2.2: Composite poverty score ───────────────────────────────
    result = compute_composite_poverty_score(result)

    # Add composite to feature cols if not already there
    if 'composite_poverty_score' in result.columns and 'composite_poverty_score' not in feature_cols:
        feature_cols.append('composite_poverty_score')

    # ── Phase 2.3: Standardisation ───────────────────────────────────────
    result, scaler, scaled_cols = standardize_features(result, feature_cols)
    models['scaler'] = scaler

    # ── Phase 3.1: PCA ───────────────────────────────────────────────────
    if use_pca and len(feature_cols) > 2:
        result, pca, pca_cols = apply_pca(result, scaled_cols, variance_threshold=config.PCA_VARIANCE)
        models['pca'] = pca
        clustering_features = pca_cols
    else:
        logger.info("Skipping PCA (not enough features or disabled)")
        clustering_features = scaled_cols

    # ── Phase 3.2: Clustering — K-Means ──────────────────────────────────
    km_result, kmeans, km_silhouette = perform_kmeans_clustering(
        result, clustering_features, n_clusters=config.K_CLUSTERS
    )
    models['kmeans'] = kmeans
    models['kmeans_silhouette'] = km_silhouette

    best_result = km_result
    best_silhouette = km_silhouette
    best_method = 'kmeans'

    # ── Phase 3.3: Clustering — HDBSCAN (if enabled) ────────────────────
    if config.USE_HDBSCAN and HDBSCAN_AVAILABLE:
        hdb_result, hdb_model, hdb_silhouette = perform_hdbscan_clustering(
            result, clustering_features, min_cluster_size=config.HDBSCAN_MIN_CLUSTER_SIZE
        )
        if hdb_result is not None and hdb_silhouette > best_silhouette:
            logger.info(f"HDBSCAN wins: {hdb_silhouette:.4f} vs K-Means {km_silhouette:.4f}")
            best_result = hdb_result
            best_silhouette = hdb_silhouette
            best_method = 'hdbscan'
            models['hdbscan'] = hdb_model
            models['hdbscan_silhouette'] = hdb_silhouette
        else:
            logger.info(f"K-Means wins: {km_silhouette:.4f} vs HDBSCAN {hdb_silhouette:.4f}")

    # ── Phase 3.4: Label assignment ──────────────────────────────────────
    result = assign_cluster_labels(best_result, clustering_features)
    result['clustering_method'] = best_method

    models['silhouette_score'] = best_silhouette
    models['clustering_method'] = best_method

    # Distribution
    cluster_dist = result['cluster'].value_counts().sort_index()
    logger.info(f"Final cluster distribution:\n{cluster_dist}")

    logger.info("=" * 80)
    logger.info(f"ANALYTICAL ENGINE COMPLETE — {best_method.upper()} — Silhouette: {best_silhouette:.4f}")
    logger.info("=" * 80)

    return result, models
