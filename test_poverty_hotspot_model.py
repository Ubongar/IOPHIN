"""
Unit Tests for Poverty Hotspot Model

Run with: python -m pytest test_poverty_hotspot_model.py -v
Or simply: python test_poverty_hotspot_model.py
"""

import unittest
import sys
import os
import tempfile
import shutil
import pandas as pd
import numpy as np

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from poverty_hotspot_model import PovertyHotspotModel


class TestPovertyHotspotModel(unittest.TestCase):
    """Test cases for PovertyHotspotModel class."""
    
    @classmethod
    def setUpClass(cls):
        """Set up test fixtures that are used by multiple tests."""
        # Create a temporary directory for test files
        cls.test_dir = tempfile.mkdtemp()
        
        # Create sample test data
        np.random.seed(42)
        n_samples = 100
        
        cls.test_data = pd.DataFrame({
            'state': [f'State_{i//10}' for i in range(n_samples)],
            'lga': [f'LGA_{i}' for i in range(n_samples)],
            'lga_id': range(1, n_samples + 1),
            'nutrition_score': np.random.uniform(40, 90, n_samples),
            'food_insecurity_rate': np.random.uniform(10, 60, n_samples),
            'years_of_schooling': np.random.uniform(3, 12, n_samples),
            'school_attendance_rate': np.random.uniform(50, 95, n_samples),
            'unemployment_rate': np.random.uniform(5, 40, n_samples),
            'security_shock_incidence': np.random.uniform(0, 30, n_samples),
            'electricity_access': np.random.uniform(20, 90, n_samples),
            'sanitation_access': np.random.uniform(30, 85, n_samples),
            'water_reliability': np.random.uniform(25, 80, n_samples),
            'housing_quality_index': np.random.uniform(40, 90, n_samples),
            'nightlight_intensity': np.random.uniform(0, 50, n_samples),
            'population_density': np.random.uniform(50, 5000, n_samples),
            'road_density': np.random.uniform(0.1, 5.0, n_samples),
        })
        
        # Add some missing values
        for col in cls.test_data.columns[3:]:
            mask = np.random.random(n_samples) < 0.05
            cls.test_data.loc[mask, col] = np.nan
        
        # Save test data
        cls.test_csv = os.path.join(cls.test_dir, 'test_data.csv')
        cls.test_data.to_csv(cls.test_csv, index=False)
    
    @classmethod
    def tearDownClass(cls):
        """Clean up test fixtures."""
        # Remove temporary directory
        if os.path.exists(cls.test_dir):
            shutil.rmtree(cls.test_dir)
    
    def setUp(self):
        """Set up for each test."""
        self.model = PovertyHotspotModel()
    
    def test_model_initialization(self):
        """Test that model initializes with correct default values."""
        self.assertIsNone(self.model.data)
        self.assertIsNone(self.model.cleaned_data)
        self.assertEqual(self.model.identifier_columns, ['state', 'lga', 'lga_id'])
        self.assertIsNone(self.model.scaler)
        self.assertIsNone(self.model.pca)
        self.assertIsNone(self.model.kmeans_model)
        self.assertIsNone(self.model.dbscan_model)
    
    def test_load_and_clean_data(self):
        """Test data loading and preprocessing."""
        cleaned_data = self.model.load_and_clean_data(self.test_csv)
        
        # Check that data is loaded
        self.assertIsNotNone(self.model.data)
        self.assertIsNotNone(self.model.cleaned_data)
        
        # Check shape
        self.assertEqual(cleaned_data.shape[0], 100)
        
        # Check that feature columns are identified
        self.assertIsNotNone(self.model.feature_columns)
        self.assertEqual(len(self.model.feature_columns), 13)
        
        # Check that scaler is fitted
        self.assertIsNotNone(self.model.scaler)
        
        # Check no missing values after imputation
        self.assertEqual(cleaned_data[self.model.feature_columns].isnull().sum().sum(), 0)
    
    def test_load_nonexistent_file(self):
        """Test that loading nonexistent file raises FileNotFoundError."""
        with self.assertRaises(FileNotFoundError):
            self.model.load_and_clean_data('nonexistent_file.csv')
    
    def test_reduce_dimensionality(self):
        """Test PCA dimensionality reduction."""
        # Load data first
        self.model.load_and_clean_data(self.test_csv)
        
        # Apply PCA with specific number of components
        pca_data = self.model.reduce_dimensionality(n_components=5)
        
        # Check PCA is fitted
        self.assertIsNotNone(self.model.pca)
        self.assertIsNotNone(self.model.pca_data)
        
        # Check output shape
        self.assertEqual(pca_data.shape[0], 100)
        self.assertEqual(pca_data.shape[1], 5)
        
        # Check variance explained is calculated
        self.assertEqual(len(self.model.pca.explained_variance_ratio_), 5)
    
    def test_reduce_dimensionality_without_data(self):
        """Test that PCA fails without loading data first."""
        with self.assertRaises(ValueError):
            self.model.reduce_dimensionality(n_components=5)
    
    def test_find_optimal_clusters(self):
        """Test cluster optimization."""
        # Prepare data
        self.model.load_and_clean_data(self.test_csv)
        self.model.reduce_dimensionality(n_components=5)
        
        # Find optimal clusters
        metrics = self.model.find_optimal_clusters(k_range=range(2, 6))
        
        # Check that metrics are returned
        self.assertIn('wcss', metrics)
        self.assertIn('silhouette_scores', metrics)
        
        # Check correct number of values
        self.assertEqual(len(metrics['wcss']), 4)  # range(2, 6) = 4 values
        self.assertEqual(len(metrics['silhouette_scores']), 4)
    
    def test_train_clustering_models(self):
        """Test K-Means and DBSCAN training."""
        # Prepare data
        self.model.load_and_clean_data(self.test_csv)
        self.model.reduce_dimensionality(n_components=5)
        
        # Train models
        labels = self.model.train_clustering_models(k_optimal=3)
        
        # Check models are trained
        self.assertIsNotNone(self.model.kmeans_model)
        self.assertIsNotNone(self.model.dbscan_model)
        self.assertIsNotNone(self.model.cluster_labels)
        
        # Check labels are returned
        self.assertIn('kmeans_labels', labels)
        self.assertIn('dbscan_labels', labels)
        
        # Check label shapes
        self.assertEqual(len(labels['kmeans_labels']), 100)
        self.assertEqual(len(labels['dbscan_labels']), 100)
        
        # Check K-Means has correct number of clusters
        unique_kmeans = len(set(labels['kmeans_labels']))
        self.assertEqual(unique_kmeans, 3)
    
    def test_generate_cluster_profiles(self):
        """Test cluster profile generation."""
        # Prepare and train models
        self.model.load_and_clean_data(self.test_csv)
        self.model.reduce_dimensionality(n_components=5)
        self.model.train_clustering_models(k_optimal=3)
        
        # Generate profiles
        profiles = self.model.generate_cluster_profiles()
        
        # Check profile structure
        self.assertIsInstance(profiles, pd.DataFrame)
        self.assertEqual(profiles.shape[0], 3)  # 3 clusters
        self.assertEqual(profiles.shape[1], 13)  # 13 features
    
    def test_save_results(self):
        """Test saving results and models."""
        # Prepare and train models
        self.model.load_and_clean_data(self.test_csv)
        self.model.reduce_dimensionality(n_components=5)
        self.model.train_clustering_models(k_optimal=3)
        
        # Save to temporary directory
        output_csv = os.path.join(self.test_dir, 'test_output.csv')
        model_dir = os.path.join(self.test_dir, 'test_models')
        
        paths = self.model.save_results(output_csv=output_csv, model_dir=model_dir)
        
        # Check CSV is created
        self.assertTrue(os.path.exists(output_csv))
        
        # Check model directory is created
        self.assertTrue(os.path.exists(model_dir))
        
        # Check models are saved
        self.assertIn('scaler', paths['model_paths'])
        self.assertIn('pca', paths['model_paths'])
        self.assertIn('kmeans', paths['model_paths'])
        
        # Verify CSV structure
        saved_data = pd.read_csv(output_csv)
        self.assertIn('cluster_label', saved_data.columns)
        self.assertEqual(saved_data.shape[0], 100)
    
    def test_load_and_predict(self):
        """Test model loading and prediction on new data."""
        # Train and save models
        self.model.load_and_clean_data(self.test_csv)
        self.model.reduce_dimensionality(n_components=5)
        self.model.train_clustering_models(k_optimal=3)
        
        model_dir = os.path.join(self.test_dir, 'test_models2')
        self.model.save_results(model_dir=model_dir)
        
        # Create new model and load saved models
        new_model = PovertyHotspotModel()
        new_model.load_models(model_dir=model_dir)
        
        # Set feature columns (normally would be done during load_and_clean_data)
        new_model.feature_columns = self.model.feature_columns
        
        # Create new data for prediction
        new_data = self.test_data.iloc[:5].copy()
        
        # Predict
        predictions = new_model.predict_cluster(new_data)
        
        # Check predictions
        self.assertEqual(len(predictions), 5)
        self.assertTrue(all(0 <= p < 3 for p in predictions))  # Should be in [0, 1, 2]
    
    def test_full_pipeline(self):
        """Test the complete pipeline end-to-end."""
        # Initialize model
        model = PovertyHotspotModel()
        
        # Step 1: Load data
        cleaned_data = model.load_and_clean_data(self.test_csv)
        self.assertEqual(cleaned_data.shape[0], 100)
        
        # Step 2: PCA
        pca_data = model.reduce_dimensionality(n_components=0.95)
        self.assertIsNotNone(pca_data)
        
        # Step 3: Find optimal clusters
        metrics = model.find_optimal_clusters(k_range=range(2, 5))
        self.assertEqual(len(metrics['wcss']), 3)
        
        # Step 4: Train models
        labels = model.train_clustering_models(k_optimal=3)
        self.assertEqual(len(labels['kmeans_labels']), 100)
        
        # Step 5: Generate profiles
        profiles = model.generate_cluster_profiles()
        self.assertEqual(profiles.shape[0], 3)
        
        # Step 6: Save results
        output_csv = os.path.join(self.test_dir, 'final_output.csv')
        model_dir = os.path.join(self.test_dir, 'final_models')
        paths = model.save_results(output_csv=output_csv, model_dir=model_dir)
        
        self.assertTrue(os.path.exists(output_csv))
        self.assertTrue(os.path.exists(model_dir))


if __name__ == '__main__':
    # Run tests
    unittest.main(verbosity=2)
