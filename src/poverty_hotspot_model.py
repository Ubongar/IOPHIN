"""
Poverty Hotspot Identifier Model for Nigeria
==============================================

This module implements an unsupervised learning pipeline to identify and analyze
poverty hotspots at the Local Government Area (LGA) level in Nigeria using 
Multidimensional Poverty Index (MPI) data.

Author: Senior ML Engineer & Data Scientist
Purpose: Computational Social Science - Poverty Analysis
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.impute import KNNImputer
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import silhouette_score
import joblib
import warnings
warnings.filterwarnings('ignore')


class PovertyHotspotModel:
    """
    A comprehensive machine learning model for identifying and analyzing poverty hotspots
    in Nigeria using unsupervised learning techniques.
    
    This class implements a complete pipeline including:
    - Data preprocessing with KNN imputation
    - Dimensionality reduction using PCA
    - Clustering using K-Means and DBSCAN
    - Cluster profiling and analysis
    
    Attributes:
        data (pd.DataFrame): Raw input data
        cleaned_data (pd.DataFrame): Preprocessed and scaled data
        feature_columns (list): List of numerical feature column names
        identifier_columns (list): List of identifier column names
        scaler (StandardScaler): Fitted StandardScaler object
        imputer (KNNImputer): Fitted KNN imputer object
        pca (PCA): Fitted PCA object
        pca_data (np.ndarray): Transformed data after PCA
        kmeans_model (KMeans): Fitted K-Means model
        dbscan_model (DBSCAN): Fitted DBSCAN model
        cluster_labels (np.ndarray): Cluster assignments
    """
    
    def __init__(self):
        """Initialize the PovertyHotspotModel with empty attributes."""
        self.data = None
        self.cleaned_data = None
        self.feature_columns = None
        self.identifier_columns = ['state', 'lga', 'lga_id']
        self.scaler = None
        self.imputer = None
        self.pca = None
        self.pca_data = None
        self.kmeans_model = None
        self.dbscan_model = None
        self.cluster_labels = None
        
    def load_and_clean_data(self, filepath):
        """
        Load the CSV data and perform preprocessing including missing value imputation
        and feature standardization.
        
        This method implements:
        1. Data loading with error handling
        2. K-Nearest Neighbors (KNN) Imputation for missing values
           - KNN is preferred over mean/median imputation because it considers the 
             similarity between observations, preserving local data structure
           - Particularly effective for survey data with MAR (Missing At Random) patterns
        3. Standard scaling to normalize features
           - Essential to prevent high-magnitude features (e.g., population_density) 
             from dominating distance-based algorithms like K-Means and PCA
        
        Args:
            filepath (str): Path to the CSV file containing the MPI data
            
        Returns:
            pd.DataFrame: Cleaned and preprocessed data
            
        Raises:
            FileNotFoundError: If the specified file does not exist
            ValueError: If required columns are missing from the dataset
            
        Example:
            >>> model = PovertyHotspotModel()
            >>> data = model.load_and_clean_data('nigeria_mpi_lga_data.csv')
        """
        try:
            # Load the CSV file
            print(f"Loading data from {filepath}...")
            self.data = pd.read_csv(filepath)
            print(f"Data loaded successfully. Shape: {self.data.shape}")
            
            # Verify identifier columns exist
            missing_identifiers = [col for col in self.identifier_columns if col not in self.data.columns]
            if missing_identifiers:
                raise ValueError(f"Missing required identifier columns: {missing_identifiers}")
            
            # Identify feature columns (all numerical columns except identifiers)
            self.feature_columns = [col for col in self.data.columns 
                                   if col not in self.identifier_columns]
            
            if len(self.feature_columns) == 0:
                raise ValueError("No feature columns found in the dataset")
            
            print(f"Identified {len(self.feature_columns)} feature columns: {self.feature_columns}")
            
            # Separate identifiers and features
            identifiers = self.data[self.identifier_columns].copy()
            features = self.data[self.feature_columns].copy()
            
            # Check for missing values
            missing_count = features.isnull().sum().sum()
            if missing_count > 0:
                print(f"\nFound {missing_count} missing values. Applying KNN Imputation...")
                
                # Apply KNN Imputation
                # n_neighbors=5 is a good default - considers 5 nearest LGAs for imputation
                # This preserves local patterns (e.g., neighboring LGAs often have similar poverty profiles)
                self.imputer = KNNImputer(n_neighbors=5, weights='distance')
                features_imputed = self.imputer.fit_transform(features)
                features = pd.DataFrame(features_imputed, columns=self.feature_columns, index=features.index)
                print("KNN Imputation completed.")
            else:
                print("No missing values found.")
            
            # Standardize features using StandardScaler
            # StandardScaler: (X - mean) / std_dev
            # This ensures all features have mean=0 and variance=1
            # Critical for PCA (which is sensitive to variance) and K-Means (which uses Euclidean distance)
            print("\nStandardizing features...")
            self.scaler = StandardScaler()
            features_scaled = self.scaler.fit_transform(features)
            features_scaled_df = pd.DataFrame(features_scaled, 
                                             columns=self.feature_columns, 
                                             index=features.index)
            
            # Combine identifiers with scaled features
            self.cleaned_data = pd.concat([identifiers, features_scaled_df], axis=1)
            
            print(f"Data cleaning completed. Final shape: {self.cleaned_data.shape}")
            print(f"Features are now standardized (mean≈0, std≈1)")
            
            return self.cleaned_data
            
        except FileNotFoundError:
            raise FileNotFoundError(f"File not found: {filepath}. Please check the file path.")
        except Exception as e:
            raise Exception(f"Error loading and cleaning data: {str(e)}")
    
    def reduce_dimensionality(self, n_components=None):
        """
        Apply Principal Component Analysis (PCA) for dimensionality reduction.
        
        PCA transforms the original correlated features into a set of uncorrelated 
        principal components (PCs), ordered by the amount of variance they explain.
        
        Mathematical Foundation:
        - PCA finds directions (principal components) of maximum variance in the data
        - First PC captures the most variance, second PC captures the second most, etc.
        - Components are orthogonal (uncorrelated), creating a "composite poverty index"
        
        Benefits for Poverty Analysis:
        1. Reduces multicollinearity (e.g., nutrition_score and food_insecurity_rate are likely correlated)
        2. Creates interpretable composite indices (PC1 might represent "overall deprivation")
        3. Reduces noise from redundant features
        4. Speeds up clustering algorithms
        
        Args:
            n_components (int or float, optional): 
                - If int: number of components to keep
                - If float (0-1): cumulative explained variance threshold
                - If None: keep all components (for analysis)
                
        Returns:
            np.ndarray: Transformed data in PCA space
            
        Example:
            >>> model.reduce_dimensionality(n_components=0.95)  # Keep 95% variance
            >>> model.reduce_dimensionality(n_components=5)     # Keep 5 components
        """
        if self.cleaned_data is None:
            raise ValueError("Data not loaded. Please call load_and_clean_data() first.")
        
        # Extract only the feature columns for PCA
        features = self.cleaned_data[self.feature_columns].values
        
        print(f"\nApplying PCA to reduce {len(self.feature_columns)} features...")
        
        # Initialize and fit PCA
        self.pca = PCA(n_components=n_components, random_state=42)
        self.pca_data = self.pca.fit_transform(features)
        
        # Display explained variance
        explained_variance = self.pca.explained_variance_ratio_
        cumulative_variance = np.cumsum(explained_variance)
        
        print(f"\nPCA Results:")
        print(f"Number of components: {self.pca.n_components_}")
        print(f"\nExplained Variance Ratio per Component:")
        for i, (var, cum_var) in enumerate(zip(explained_variance, cumulative_variance)):
            print(f"  PC{i+1}: {var:.4f} (Cumulative: {cum_var:.4f})")
        
        print(f"\nTotal variance explained: {cumulative_variance[-1]:.4f}")
        
        # Visualization of explained variance
        plt.figure(figsize=(12, 5))
        
        # Subplot 1: Individual variance
        plt.subplot(1, 2, 1)
        plt.bar(range(1, len(explained_variance) + 1), explained_variance, alpha=0.7)
        plt.xlabel('Principal Component')
        plt.ylabel('Explained Variance Ratio')
        plt.title('Variance Explained by Each Component')
        plt.xticks(range(1, len(explained_variance) + 1))
        
        # Subplot 2: Cumulative variance
        plt.subplot(1, 2, 2)
        plt.plot(range(1, len(cumulative_variance) + 1), cumulative_variance, marker='o')
        plt.axhline(y=0.95, color='r', linestyle='--', label='95% threshold')
        plt.xlabel('Number of Components')
        plt.ylabel('Cumulative Explained Variance')
        plt.title('Cumulative Variance Explained')
        plt.legend()
        plt.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig('pca_variance_explained.png', dpi=300, bbox_inches='tight')
        print("\nPCA variance plot saved as 'pca_variance_explained.png'")
        plt.close()
        
        return self.pca_data
    
    def find_optimal_clusters(self, k_range=range(2, 11)):
        """
        Determine the optimal number of clusters using Elbow Method and Silhouette Score.
        
        This method implements two complementary techniques:
        
        1. Elbow Method (Within-Cluster Sum of Squares - WCSS):
           - WCSS = Σ(distance from each point to its cluster centroid)²
           - As k increases, WCSS decreases (points get closer to centroids)
           - The "elbow" point indicates where adding more clusters yields diminishing returns
           - Visual inspection required: look for the point where the curve bends sharply
        
        2. Silhouette Score:
           - Measures how similar a point is to its own cluster vs. other clusters
           - Range: [-1, 1] where 1 = perfect clustering, 0 = overlapping clusters
           - Formula: (b - a) / max(a, b) where:
             * a = average distance to points in same cluster
             * b = average distance to points in nearest other cluster
           - Higher silhouette score = better-defined clusters
        
        Both metrics should be considered together for robust cluster selection.
        
        Args:
            k_range (range): Range of k values to test (default: 2 to 10)
            
        Returns:
            dict: Dictionary containing 'wcss' and 'silhouette_scores' lists
            
        Example:
            >>> metrics = model.find_optimal_clusters(k_range=range(2, 8))
            >>> # Inspect plots to choose optimal k
        """
        if self.pca_data is None:
            raise ValueError("PCA not performed. Please call reduce_dimensionality() first.")
        
        print(f"\nFinding optimal number of clusters...")
        print(f"Testing k values from {min(k_range)} to {max(k_range)}...")
        
        wcss = []
        silhouette_scores = []
        
        for k in k_range:
            # Fit K-Means with current k
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            cluster_labels = kmeans.fit_predict(self.pca_data)
            
            # Calculate WCSS (inertia)
            wcss.append(kmeans.inertia_)
            
            # Calculate Silhouette Score
            silhouette_avg = silhouette_score(self.pca_data, cluster_labels)
            silhouette_scores.append(silhouette_avg)
            
            print(f"k={k}: WCSS={kmeans.inertia_:.2f}, Silhouette Score={silhouette_avg:.4f}")
        
        # Create visualization
        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        
        # Plot 1: Elbow Method (WCSS)
        axes[0].plot(list(k_range), wcss, marker='o', linewidth=2, markersize=8)
        axes[0].set_xlabel('Number of Clusters (k)', fontsize=12)
        axes[0].set_ylabel('Within-Cluster Sum of Squares (WCSS)', fontsize=12)
        axes[0].set_title('Elbow Method for Optimal k', fontsize=14, fontweight='bold')
        axes[0].grid(True, alpha=0.3)
        axes[0].set_xticks(list(k_range))
        
        # Plot 2: Silhouette Score
        axes[1].plot(list(k_range), silhouette_scores, marker='s', linewidth=2, 
                     markersize=8, color='green')
        axes[1].set_xlabel('Number of Clusters (k)', fontsize=12)
        axes[1].set_ylabel('Silhouette Score', fontsize=12)
        axes[1].set_title('Silhouette Score for Optimal k', fontsize=14, fontweight='bold')
        axes[1].grid(True, alpha=0.3)
        axes[1].set_xticks(list(k_range))
        axes[1].axhline(y=0, color='r', linestyle='--', alpha=0.5)
        
        plt.tight_layout()
        plt.savefig('cluster_optimization.png', dpi=300, bbox_inches='tight')
        print("\nCluster optimization plot saved as 'cluster_optimization.png'")
        print("\nRecommendation: Inspect the plots to select optimal k")
        print("  - Elbow Method: Look for the 'elbow' point where WCSS decrease slows")
        print("  - Silhouette Score: Higher is better (ideally > 0.5)")
        plt.close()
        
        return {'wcss': wcss, 'silhouette_scores': silhouette_scores}
    
    def train_clustering_models(self, k_optimal, dbscan_eps=0.5, dbscan_min_samples=5, 
                                use_kmeans=True):
        """
        Train clustering models (K-Means and/or DBSCAN) on the PCA-transformed data.
        
        K-Means Clustering:
        - Partitions data into k spherical clusters
        - Assumes clusters are convex and isotropic
        - Good for identifying general poverty severity levels (e.g., low, medium, high)
        - Deterministic with fixed random_state
        
        DBSCAN (Density-Based Spatial Clustering):
        - Identifies clusters of arbitrary shape based on density
        - Can detect outliers as "noise" (label = -1)
        - Excellent for finding geographical hotspots (irregular shapes)
        - Parameters:
          * eps: Maximum distance between two points to be neighbors
          * min_samples: Minimum points to form a dense region (cluster)
        
        Use Cases:
        - K-Means: General segmentation of LGAs into poverty levels
        - DBSCAN: Identify compact geographic hotspots and anomalous LGAs
        
        Args:
            k_optimal (int): Optimal number of clusters for K-Means
            dbscan_eps (float): DBSCAN eps parameter (default: 0.5)
            dbscan_min_samples (int): DBSCAN min_samples parameter (default: 5)
            use_kmeans (bool): Whether to use K-Means for final labels (default: True)
            
        Returns:
            dict: Dictionary with 'kmeans_labels' and 'dbscan_labels'
            
        Example:
            >>> labels = model.train_clustering_models(k_optimal=4)
            >>> # K-Means labels will be used for cluster profiles
        """
        if self.pca_data is None:
            raise ValueError("PCA not performed. Please call reduce_dimensionality() first.")
        
        print(f"\nTraining clustering models...")
        
        # Train K-Means
        print(f"\n1. K-Means Clustering (k={k_optimal})...")
        self.kmeans_model = KMeans(n_clusters=k_optimal, random_state=42, n_init=10)
        kmeans_labels = self.kmeans_model.fit_predict(self.pca_data)
        
        kmeans_silhouette = silhouette_score(self.pca_data, kmeans_labels)
        print(f"   K-Means trained successfully.")
        print(f"   Silhouette Score: {kmeans_silhouette:.4f}")
        print(f"   Cluster distribution: {np.bincount(kmeans_labels)}")
        
        # Train DBSCAN
        print(f"\n2. DBSCAN Clustering (eps={dbscan_eps}, min_samples={dbscan_min_samples})...")
        self.dbscan_model = DBSCAN(eps=dbscan_eps, min_samples=dbscan_min_samples)
        dbscan_labels = self.dbscan_model.fit_predict(self.pca_data)
        
        n_clusters_dbscan = len(set(dbscan_labels)) - (1 if -1 in dbscan_labels else 0)
        n_noise = list(dbscan_labels).count(-1)
        
        print(f"   DBSCAN trained successfully.")
        print(f"   Number of clusters: {n_clusters_dbscan}")
        print(f"   Number of noise points (outliers): {n_noise}")
        
        if n_clusters_dbscan > 1:
            # Only calculate silhouette if there are at least 2 clusters
            non_noise_mask = dbscan_labels != -1
            if non_noise_mask.sum() > 1:
                dbscan_silhouette = silhouette_score(
                    self.pca_data[non_noise_mask], 
                    dbscan_labels[non_noise_mask]
                )
                print(f"   Silhouette Score (excluding noise): {dbscan_silhouette:.4f}")
        
        # Set the primary cluster labels (K-Means by default for policy analysis)
        if use_kmeans:
            self.cluster_labels = kmeans_labels
            print(f"\nUsing K-Means labels as primary cluster assignments.")
        else:
            self.cluster_labels = dbscan_labels
            print(f"\nUsing DBSCAN labels as primary cluster assignments.")
        
        return {
            'kmeans_labels': kmeans_labels,
            'dbscan_labels': dbscan_labels
        }
    
    def generate_cluster_profiles(self):
        """
        Generate comprehensive cluster profiles showing the average feature values
        for each cluster.
        
        This is the most critical output for policy-making because it answers:
        - What characterizes each poverty cluster?
        - Which features distinguish high-poverty from low-poverty LGAs?
        - Where should interventions be targeted?
        
        The method calculates:
        1. Mean values of ALL original features (unstandardized) per cluster
        2. Standard deviations to show within-cluster variability
        3. Cluster sizes (number of LGAs)
        
        Interpretation Example:
        - Cluster 0: Low electricity_access (30%), high unemployment (40%)
          → Energy infrastructure + job creation programs needed
        - Cluster 1: Low school_attendance (50%), poor sanitation (20%)
          → Education + WASH interventions needed
        
        Returns:
            pd.DataFrame: Cluster profiles with mean feature values
            
        Example:
            >>> profiles = model.generate_cluster_profiles()
            >>> print(profiles)
            # Shows mean values for each feature across clusters
        """
        if self.cluster_labels is None:
            raise ValueError("Clustering not performed. Please call train_clustering_models() first.")
        
        if self.cleaned_data is None:
            raise ValueError("Data not loaded. Please call load_and_clean_data() first.")
        
        print("\nGenerating cluster profiles...")
        
        # Add cluster labels to the data
        data_with_clusters = self.cleaned_data.copy()
        data_with_clusters['cluster_label'] = self.cluster_labels
        
        # Get the original (unstandardized) feature values
        # We need to inverse transform the scaled features
        scaled_features = self.cleaned_data[self.feature_columns].values
        original_features = self.scaler.inverse_transform(scaled_features)
        
        # Create DataFrame with original features
        original_df = pd.DataFrame(original_features, columns=self.feature_columns)
        original_df['cluster_label'] = self.cluster_labels
        
        # Calculate mean values per cluster
        cluster_profiles = original_df.groupby('cluster_label')[self.feature_columns].agg(['mean', 'std', 'count'])
        
        # Flatten the multi-index columns for better readability
        cluster_profiles_mean = original_df.groupby('cluster_label')[self.feature_columns].mean()
        cluster_profiles_std = original_df.groupby('cluster_label')[self.feature_columns].std()
        cluster_sizes = original_df.groupby('cluster_label').size()
        
        print(f"\nCluster Profiles (Mean Values):")
        print("=" * 80)
        
        for cluster_id in sorted(cluster_profiles_mean.index):
            print(f"\nCluster {cluster_id} (n={cluster_sizes[cluster_id]} LGAs):")
            print("-" * 80)
            
            for feature in self.feature_columns:
                mean_val = cluster_profiles_mean.loc[cluster_id, feature]
                std_val = cluster_profiles_std.loc[cluster_id, feature]
                print(f"  {feature:35s}: {mean_val:8.4f} (±{std_val:.4f})")
        
        # Create a comparison table (useful for identifying key differentiators)
        print("\n" + "=" * 80)
        print("Cluster Comparison Table:")
        print("=" * 80)
        print(cluster_profiles_mean.to_string())
        
        # Identify top distinguishing features for each cluster
        print("\n" + "=" * 80)
        print("Key Distinguishing Features per Cluster:")
        print("=" * 80)
        
        # Calculate z-scores across clusters for each feature
        cluster_means = cluster_profiles_mean.values
        overall_mean = cluster_means.mean(axis=0)
        overall_std = cluster_means.std(axis=0)
        
        for cluster_id in sorted(cluster_profiles_mean.index):
            z_scores = (cluster_profiles_mean.loc[cluster_id] - overall_mean) / (overall_std + 1e-10)
            
            # Get top 3 positive and negative deviations
            top_positive = z_scores.nlargest(3)
            top_negative = z_scores.nsmallest(3)
            
            print(f"\nCluster {cluster_id}:")
            print(f"  Highest values (relative to other clusters):")
            for feat, score in top_positive.items():
                print(f"    - {feat}: {score:+.2f} std above mean")
            print(f"  Lowest values (relative to other clusters):")
            for feat, score in top_negative.items():
                print(f"    - {feat}: {score:+.2f} std below mean")
        
        return cluster_profiles_mean
    
    def save_results(self, output_csv='processed_hotspots.csv', 
                    model_dir='models'):
        """
        Save the final results and trained models for deployment and further analysis.
        
        This method saves:
        1. CSV file with original data + cluster labels
           - Ready for visualization in dashboards/GIS tools
           - Includes all identifiers (state, lga, lga_id) for mapping
        
        2. Trained models (using joblib for sklearn objects):
           - PCA model: For transforming new LGA data
           - K-Means model: For assigning new LGAs to clusters
           - StandardScaler: For preprocessing new data
           - KNN Imputer: For handling missing values in new data
        
        These saved models enable:
        - Real-time inference when new LGA data arrives
        - Consistent preprocessing pipeline
        - Reproducible results
        
        Args:
            output_csv (str): Filename for the output CSV (default: 'processed_hotspots.csv')
            model_dir (str): Directory to save model files (default: 'models')
            
        Returns:
            dict: Paths to saved files
            
        Example:
            >>> paths = model.save_results()
            >>> # CSV and models saved successfully
        """
        if self.cluster_labels is None:
            raise ValueError("No clustering results to save. Please train models first.")
        
        import os
        
        # Create model directory if it doesn't exist
        if not os.path.exists(model_dir):
            os.makedirs(model_dir)
            print(f"Created directory: {model_dir}")
        
        print(f"\nSaving results...")
        
        # 1. Save CSV with cluster labels
        # Get original (unstandardized) data
        scaled_features = self.cleaned_data[self.feature_columns].values
        original_features = self.scaler.inverse_transform(scaled_features)
        
        # Create final DataFrame
        final_df = self.cleaned_data[self.identifier_columns].copy()
        
        # Add original feature values
        for i, feature in enumerate(self.feature_columns):
            final_df[feature] = original_features[:, i]
        
        # Add cluster labels
        final_df['cluster_label'] = self.cluster_labels
        
        # Save to CSV
        final_df.to_csv(output_csv, index=False)
        print(f"✓ Results saved to: {output_csv}")
        print(f"  Shape: {final_df.shape}")
        print(f"  Columns: {list(final_df.columns)}")
        
        # 2. Save trained models
        model_paths = {}
        
        if self.scaler is not None:
            scaler_path = os.path.join(model_dir, 'scaler.pkl')
            joblib.dump(self.scaler, scaler_path)
            model_paths['scaler'] = scaler_path
            print(f"✓ StandardScaler saved to: {scaler_path}")
        
        if self.imputer is not None:
            imputer_path = os.path.join(model_dir, 'imputer.pkl')
            joblib.dump(self.imputer, imputer_path)
            model_paths['imputer'] = imputer_path
            print(f"✓ KNN Imputer saved to: {imputer_path}")
        
        if self.pca is not None:
            pca_path = os.path.join(model_dir, 'pca_model.pkl')
            joblib.dump(self.pca, pca_path)
            model_paths['pca'] = pca_path
            print(f"✓ PCA model saved to: {pca_path}")
        
        if self.kmeans_model is not None:
            kmeans_path = os.path.join(model_dir, 'kmeans_model.pkl')
            joblib.dump(self.kmeans_model, kmeans_path)
            model_paths['kmeans'] = kmeans_path
            print(f"✓ K-Means model saved to: {kmeans_path}")
        
        if self.dbscan_model is not None:
            dbscan_path = os.path.join(model_dir, 'dbscan_model.pkl')
            joblib.dump(self.dbscan_model, dbscan_path)
            model_paths['dbscan'] = dbscan_path
            print(f"✓ DBSCAN model saved to: {dbscan_path}")
        
        print(f"\n{'='*60}")
        print(f"All results and models saved successfully!")
        print(f"{'='*60}")
        print(f"\nNext Steps:")
        print(f"1. Load '{output_csv}' into your visualization tool/dashboard")
        print(f"2. Use saved models in '{model_dir}/' for inference on new data")
        print(f"3. Analyze cluster profiles to design targeted interventions")
        
        return {
            'csv_path': output_csv,
            'model_paths': model_paths
        }
    
    def load_models(self, model_dir='models'):
        """
        Load previously trained models for inference on new data.
        
        This method allows you to:
        - Load saved preprocessing pipeline (scaler, imputer)
        - Load saved PCA transformation
        - Load saved clustering models
        - Apply to new LGA data without retraining
        
        Args:
            model_dir (str): Directory containing saved model files
            
        Returns:
            dict: Dictionary of loaded models
            
        Example:
            >>> model = PovertyHotspotModel()
            >>> model.load_models('models')
            >>> # Now use model.predict_cluster(new_data)
        """
        import os
        
        print(f"Loading models from {model_dir}...")
        
        loaded_models = {}
        
        # Load scaler
        scaler_path = os.path.join(model_dir, 'scaler.pkl')
        if os.path.exists(scaler_path):
            self.scaler = joblib.load(scaler_path)
            loaded_models['scaler'] = self.scaler
            print(f"✓ StandardScaler loaded")
        
        # Load imputer
        imputer_path = os.path.join(model_dir, 'imputer.pkl')
        if os.path.exists(imputer_path):
            self.imputer = joblib.load(imputer_path)
            loaded_models['imputer'] = self.imputer
            print(f"✓ KNN Imputer loaded")
        
        # Load PCA
        pca_path = os.path.join(model_dir, 'pca_model.pkl')
        if os.path.exists(pca_path):
            self.pca = joblib.load(pca_path)
            loaded_models['pca'] = self.pca
            print(f"✓ PCA model loaded")
        
        # Load K-Means
        kmeans_path = os.path.join(model_dir, 'kmeans_model.pkl')
        if os.path.exists(kmeans_path):
            self.kmeans_model = joblib.load(kmeans_path)
            loaded_models['kmeans'] = self.kmeans_model
            print(f"✓ K-Means model loaded")
        
        # Load DBSCAN
        dbscan_path = os.path.join(model_dir, 'dbscan_model.pkl')
        if os.path.exists(dbscan_path):
            self.dbscan_model = joblib.load(dbscan_path)
            loaded_models['dbscan'] = self.dbscan_model
            print(f"✓ DBSCAN model loaded")
        
        print(f"\nModels loaded successfully!")
        
        return loaded_models
    
    def predict_cluster(self, new_data):
        """
        Predict cluster labels for new LGA data using trained models.
        
        This method applies the full preprocessing pipeline:
        1. Impute missing values (using fitted KNN imputer)
        2. Scale features (using fitted scaler)
        3. Transform with PCA (using fitted PCA)
        4. Predict cluster (using fitted K-Means)
        
        Args:
            new_data (pd.DataFrame): New LGA data with same features
            
        Returns:
            np.ndarray: Predicted cluster labels
            
        Example:
            >>> new_lgas = pd.read_csv('new_lga_data.csv')
            >>> predictions = model.predict_cluster(new_lgas)
        """
        if self.scaler is None or self.pca is None or self.kmeans_model is None:
            raise ValueError("Models not loaded. Please call load_models() or train models first.")
        
        # Extract features
        features = new_data[self.feature_columns].copy()
        
        # Impute if imputer is available
        if self.imputer is not None:
            features = pd.DataFrame(
                self.imputer.transform(features),
                columns=self.feature_columns
            )
        
        # Scale
        features_scaled = self.scaler.transform(features)
        
        # Apply PCA
        features_pca = self.pca.transform(features_scaled)
        
        # Predict clusters
        predictions = self.kmeans_model.predict(features_pca)
        
        return predictions
