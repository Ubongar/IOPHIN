# Quick Start Guide

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/Ubongar/IOPHIN.git
cd IOPHIN
```

### 2. Set Up Python Environment (Recommended)
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

## Running the Example

### Option 1: Run the Python Script
```bash
python example_usage.py
```

This will:
- Generate sample data (if no data file exists)
- Run the complete ML pipeline
- Generate visualizations
- Save results and trained models

### Option 2: Use the Jupyter Notebook
```bash
# Install Jupyter if not already installed
pip install jupyter

# Launch Jupyter
jupyter notebook poverty_analysis_notebook.ipynb
```

Run the cells sequentially to explore the analysis interactively.

## Using Your Own Data

### 1. Prepare Your Data
Create a CSV file named `nigeria_mpi_lga_data.csv` with the following columns:

**Identifiers:**
- `state`: State name
- `lga`: Local Government Area name
- `lga_id`: Unique identifier

**Socioeconomic Features:**
- `nutrition_score`
- `food_insecurity_rate`
- `years_of_schooling`
- `school_attendance_rate`
- `unemployment_rate`
- `security_shock_incidence`

**Infrastructure Features:**
- `electricity_access`
- `sanitation_access`
- `water_reliability`
- `housing_quality_index`

**Geospatial Features:**
- `nightlight_intensity`
- `population_density`
- `road_density`

### 2. Run the Analysis
```python
from src.poverty_hotspot_model import PovertyHotspotModel

# Initialize model
model = PovertyHotspotModel()

# Load your data
model.load_and_clean_data('nigeria_mpi_lga_data.csv')

# Apply PCA
model.reduce_dimensionality(n_components=0.95)

# Find optimal clusters
model.find_optimal_clusters(k_range=range(2, 11))

# Train models (adjust k based on the plots)
model.train_clustering_models(k_optimal=4)

# Generate cluster profiles
profiles = model.generate_cluster_profiles()

# Save results
model.save_results(
    output_csv='processed_hotspots.csv',
    model_dir='models'
)
```

## Output Files

After running the analysis, you'll get:

1. **processed_hotspots.csv** - Your LGA data with cluster labels
2. **pca_variance_explained.png** - PCA analysis visualization
3. **cluster_optimization.png** - Cluster selection metrics
4. **models/** - Directory with trained models:
   - `scaler.pkl` - Feature scaler
   - `imputer.pkl` - Missing value imputer
   - `pca_model.pkl` - PCA transformation
   - `kmeans_model.pkl` - K-Means model
   - `dbscan_model.pkl` - DBSCAN model

## Using Trained Models for Predictions

```python
from src.poverty_hotspot_model import PovertyHotspotModel
import pandas as pd

# Load trained models
model = PovertyHotspotModel()
model.load_models('models')

# Prepare new data
new_lgas = pd.read_csv('new_lga_data.csv')

# Predict clusters
predictions = model.predict_cluster(new_lgas)
```

## Running Tests

```bash
# Run unit tests
python test_poverty_hotspot_model.py

# Or with pytest (if installed)
pytest test_poverty_hotspot_model.py -v
```

## Troubleshooting

### Import Errors
If you get import errors, ensure you're in the IOPHIN directory and have installed all dependencies:
```bash
pip install -r requirements.txt
```

### Missing Data
The system handles missing values automatically using KNN imputation. However, ensure your data has:
- At least 50 samples (LGAs)
- All required columns present
- Numerical values for all features

### Visualization Issues
If plots don't display:
- For scripts: Check that the PNG files are created in the working directory
- For Jupyter: Ensure `%matplotlib inline` is executed

## Next Steps

1. **Analyze Results**: Review the cluster profiles to understand poverty patterns
2. **Visualize on Map**: Load `processed_hotspots.csv` into GIS software (QGIS, ArcGIS)
3. **Design Interventions**: Use cluster characteristics to target policies
4. **Update Models**: Retrain periodically with new data

## Support

For questions or issues:
- Check the main README.md for detailed documentation
- Review the example_usage.py for working code examples
- Explore poverty_analysis_notebook.ipynb for interactive analysis

---

**Happy Analyzing! 📊**
