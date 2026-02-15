"# IOPHIN - Poverty Hotspot Identifier for Nigeria

**I**ntelligent **O**bservation of **P**overty **H**otspots **I**n **N**igeria

A machine learning system for identifying and analyzing poverty hotspots at the Local Government Area (LGA) level in Nigeria using unsupervised learning techniques.

## 🎯 Overview

This project implements a comprehensive analytical engine for poverty analysis using Nigeria's Multidimensional Poverty Index (MPI) data. The system uses advanced machine learning techniques to:

- Identify poverty hotspots and clusters across Nigerian LGAs
- Profile cluster characteristics for targeted policy interventions
- Reduce high-dimensional poverty indicators into interpretable composite indices
- Handle missing survey data using sophisticated imputation methods
- Provide reproducible, scientifically-sound analysis pipeline

## 🧠 Technical Approach

### Unsupervised Learning Pipeline

1. **Data Preprocessing**
   - K-Nearest Neighbors (KNN) Imputation for missing values
   - Standard scaling to normalize feature magnitudes

2. **Dimensionality Reduction**
   - Principal Component Analysis (PCA)
   - Creates composite poverty indices from 15+ features

3. **Clustering**
   - K-Means: General poverty level segmentation
   - DBSCAN: Geographic hotspot detection and outlier identification

4. **Cluster Profiling**
   - Mean feature analysis per cluster
   - Identification of distinguishing characteristics
   - Policy-relevant insights generation

## 📊 Data Structure

The system expects a CSV file (`nigeria_mpi_lga_data.csv`) with the following structure:

### Identifiers
- `state`: State name
- `lga`: Local Government Area name
- `lga_id`: Unique LGA identifier

### Socioeconomic Features
- `nutrition_score`: Nutrition score (0-100)
- `food_insecurity_rate`: Food insecurity rate (%)
- `years_of_schooling`: Average years of schooling
- `school_attendance_rate`: School attendance rate (%)
- `unemployment_rate`: Unemployment rate (%)
- `security_shock_incidence`: Security shock incidence (%)

### Infrastructure Features
- `electricity_access`: Electricity access rate (%)
- `sanitation_access`: Sanitation access rate (%)
- `water_reliability`: Water reliability score (%)
- `housing_quality_index`: Housing quality index (0-100)

### Geospatial Features
- `nightlight_intensity`: Nighttime light intensity (VIIRS)
- `population_density`: Population per km² (WorldPop)
- `road_density`: Road network density (km/km²)

## 🚀 Quick Start

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Ubongar/IOPHIN.git
cd IOPHIN
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

### Basic Usage

```python
from src.poverty_hotspot_model import PovertyHotspotModel

# Initialize model
model = PovertyHotspotModel()

# Load and preprocess data
model.load_and_clean_data('nigeria_mpi_lga_data.csv')

# Apply PCA (keep 95% of variance)
model.reduce_dimensionality(n_components=0.95)

# Find optimal number of clusters
model.find_optimal_clusters(k_range=range(2, 11))

# Train clustering models (use k=4 as example)
model.train_clustering_models(k_optimal=4)

# Generate cluster profiles
profiles = model.generate_cluster_profiles()

# Save results
model.save_results(
    output_csv='processed_hotspots.csv',
    model_dir='models'
)
```

### Running the Example

To run the complete pipeline with sample data:

```bash
python example_usage.py
```

This will:
1. Generate synthetic sample data (if no data file exists)
2. Execute the complete ML pipeline
3. Generate visualizations and analysis
4. Save processed results and trained models

## 📁 Project Structure

```
IOPHIN/
├── src/
│   └── poverty_hotspot_model.py    # Main model class
├── models/                          # Saved trained models (generated)
│   ├── scaler.pkl
│   ├── imputer.pkl
│   ├── pca_model.pkl
│   ├── kmeans_model.pkl
│   └── dbscan_model.pkl
├── example_usage.py                 # Usage demonstration script
├── requirements.txt                 # Python dependencies
├── README.md                        # This file
├── processed_hotspots.csv          # Output results (generated)
├── pca_variance_explained.png      # PCA visualization (generated)
└── cluster_optimization.png        # Clustering metrics (generated)
```

## 🔍 Key Features

### 1. Robust Missing Data Handling
- Uses K-Nearest Neighbors imputation instead of simple mean/median
- Preserves local data structure and patterns
- Critical for survey data with Missing At Random (MAR) patterns

### 2. Feature Scaling
- StandardScaler ensures fair contribution from all features
- Prevents high-magnitude features from dominating distance calculations
- Essential for PCA and K-Means performance

### 3. Dimensionality Reduction
- PCA creates interpretable composite poverty indices
- Reduces multicollinearity among correlated features
- Visualizes variance explained for component selection

### 4. Dual Clustering Approach
- **K-Means**: Identifies general poverty severity levels
- **DBSCAN**: Detects irregular geographic hotspots and outliers

### 5. Actionable Cluster Profiles
- Calculates mean feature values per cluster
- Identifies key distinguishing characteristics
- Provides policy-relevant insights

### 6. Model Persistence
- Saves all trained models for future inference
- Enables real-time predictions on new LGA data
- Ensures reproducible results

## 📈 Output Files

### 1. `processed_hotspots.csv`
CSV file containing original data plus cluster assignments. Ready for:
- GIS visualization
- Dashboard integration
- Further statistical analysis

### 2. `pca_variance_explained.png`
Visualization showing:
- Variance explained by each principal component
- Cumulative variance explained
- Helps justify number of components to retain

### 3. `cluster_optimization.png`
Dual plot showing:
- Elbow method (WCSS)
- Silhouette scores
- Guides selection of optimal k

### 4. `models/` Directory
Contains serialized models:
- `scaler.pkl`: StandardScaler for feature normalization
- `imputer.pkl`: KNN imputer for missing values
- `pca_model.pkl`: PCA transformation
- `kmeans_model.pkl`: K-Means clustering model
- `dbscan_model.pkl`: DBSCAN clustering model

## 🔧 Advanced Usage

### Custom Cluster Selection

```python
# Test different k values
metrics = model.find_optimal_clusters(k_range=range(2, 15))

# Inspect plots and choose optimal k
optimal_k = 5  # Based on your analysis

# Train with custom parameters
model.train_clustering_models(
    k_optimal=optimal_k,
    dbscan_eps=0.7,
    dbscan_min_samples=10
)
```

### Inference on New Data

```python
# Load trained models
model = PovertyHotspotModel()
model.load_models('models')

# Predict for new LGAs
import pandas as pd
new_data = pd.read_csv('new_lga_data.csv')
predictions = model.predict_cluster(new_data)
```

### Custom PCA Components

```python
# Option 1: Keep specific number of components
model.reduce_dimensionality(n_components=5)

# Option 2: Keep components explaining X% variance
model.reduce_dimensionality(n_components=0.90)  # 90% variance
```

## 📊 Interpreting Results

### Cluster Profiles
Each cluster represents a distinct poverty profile. Example interpretation:

**Cluster 0 - Severe Deprivation**
- Low electricity access (30%)
- High food insecurity (55%)
- Low school attendance (60%)
- **Policy Focus**: Basic infrastructure + food security programs

**Cluster 1 - Moderate Poverty**
- Medium electricity access (60%)
- Medium unemployment (25%)
- **Policy Focus**: Job creation + skill development

**Cluster 2 - Relatively Better-Off**
- High electricity access (85%)
- Low food insecurity (15%)
- High school attendance (90%)
- **Policy Focus**: Sustaining gains + targeted support

### DBSCAN Noise Points
LGAs labeled as noise (-1) are outliers:
- Unique poverty patterns not fitting any cluster
- May require special intervention strategies
- Often geographically isolated or conflict-affected areas

## 🎓 Methodology References

The methodology is based on:
- Nigeria Multidimensional Poverty Index 2022 (NBS/UNDP)
- VIIRS Nighttime Lights (Earth Observation Group)
- WorldPop Population Density data
- Standard machine learning best practices

### Key Algorithms

**K-Nearest Neighbors Imputation**
- Imputes missing values based on similar observations
- Better than mean/median for preserving local patterns

**Principal Component Analysis**
- Linear dimensionality reduction
- Captures maximum variance in lower dimensions

**K-Means Clustering**
- Partitioning method for spherical clusters
- Minimizes within-cluster sum of squares

**DBSCAN**
- Density-based clustering for arbitrary shapes
- Identifies outliers automatically

## 🤝 Contributing

This is an analytical tool for poverty research. Contributions are welcome:
- Feature enhancements
- Additional clustering algorithms
- Improved visualization
- Documentation improvements

## 📝 License

This project is for research and policy analysis purposes.

## 👥 Authors

Senior Machine Learning Engineer & Data Scientist specializing in Computational Social Science

## 📧 Contact

For questions or collaboration: [Add contact information]

## 🙏 Acknowledgments

- National Bureau of Statistics (NBS), Nigeria
- United Nations Development Programme (UNDP)
- VIIRS Earth Observation Group
- WorldPop Project

---

**Note**: This is the analytical engine only. No frontend/dashboard code is included. Integrate `processed_hotspots.csv` with your preferred visualization tool (Tableau, PowerBI, QGIS, etc.)." 
