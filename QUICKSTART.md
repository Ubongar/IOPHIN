# Quick Start Guide - Nigeria Poverty Hotspot Identifier

## Overview
This analytical engine processes Nigeria's 774 LGAs using nighttime satellite imagery and poverty data to identify poverty hotspots.

## Installation & Setup

```bash
# Install dependencies
pip install -r requirements.txt
```

## Running the Pipeline

```bash
# Run the full analytical engine
python -m src.main
```

## What Happens During Execution

### Phase 1: Feature Extraction (Memory-Safe)
- Loads LGA boundaries from shapefile (774 LGAs)
- Extracts nighttime light intensity from VIIRS raster (10.8GB)
- Uses windowed reading to prevent memory errors
- Automatically handles CRS mismatches

**Note:** If VIIRS file is not present, synthetic data is generated for testing.

### Phase 2: Data Fusion
- Merges state-level poverty indicators (MPI, Headcount Ratio, etc.)
- Applies KNN imputation for missing values (k=5)
- Standardizes features using StandardScaler

### Phase 3: Machine Learning
- Applies PCA for dimensionality reduction (95% variance)
- Performs K-Means clustering (k=4)
- Validates with Silhouette Score
- Assigns risk labels:
  - High Risk - Severe Poverty
  - Medium Risk - Poor
  - Low Risk - Vulnerable
  - Minimal Risk - Wealthy

## Outputs

### 1. CSV File: `data/processed/final_model_output.csv`
Tabular data with:
- LGA name, state, coordinates
- Mean nightlight intensity
- MPI and poverty indicators
- Cluster ID and label
- Risk level

**Use case:** Backend API, data analysis, reporting

### 2. GeoJSON File: `data/processed/hotspots.geojson`
Geospatial data with:
- LGA polygon geometries
- Cluster labels and risk levels
- Key poverty indicators

**Use case:** Frontend map visualization, GIS applications

## Using with Actual VIIRS Data

To use the real 10.8GB VIIRS file:

1. Download or obtain `viirs_2024.tif`
2. Place it in: `data/raw/viirs_2024.tif`
3. Run the pipeline: `python -m src.main`

The system will automatically:
- Detect the file
- Use windowed reading to extract data safely
- Check and reproject CRS if needed
- Process all 774 LGAs without memory errors

## Expected Performance

- Processing time: ~30 seconds (with synthetic data)
- Processing time: ~5-10 minutes (with actual VIIRS file, depending on hardware)
- Memory usage: < 2GB (thanks to windowed reading)
- Output files: ~8.5MB total

## Understanding the Results

### Silhouette Score
- Measures cluster quality
- Range: -1 to 1
- > 0.5 = Good separation
- > 0.7 = Excellent separation
- Typical value: ~0.43-0.45 (moderate separation)

### Cluster Distribution
Expect approximately:
- 20-35% High Risk (Severe Poverty)
- 20-25% Medium Risk (Poor)
- 20-25% Low Risk (Vulnerable)
- 20-35% Minimal Risk (Wealthy)

## Troubleshooting

### "Shapefile not found"
- Check that shapefile exists in: `data/raw/NGA_LGA_Boundaries_2_-5383648833805565856/`

### "Memory Error"
- Ensure you're using the latest version (with windowed reading)
- Check available RAM (needs at least 2GB)

### "CRS mismatch warning"
- This is normal - the system will automatically reproject

### Different results each run
- K-Means clustering has randomness (controlled by seed)
- Small variations are expected

## Integration with Frontend

The GeoJSON output is ready for:
- Leaflet.js maps
- Mapbox GL JS
- React mapping libraries

Example usage:
```javascript
fetch('data/processed/hotspots.geojson')
  .then(response => response.json())
  .then(data => {
    // data.features contains all LGAs with:
    // - geometry (polygon)
    // - properties.cluster_label
    // - properties.risk_level
    // - properties.mean_nightlight_intensity
    // - properties.MPI
  });
```

## Next Steps

1. **Customize clustering:** Edit `src/config.py` to change K_CLUSTERS
2. **Add features:** Modify `src/model_engine.py` to include more indicators
3. **Tune PCA:** Adjust PCA_VARIANCE in `src/config.py`
4. **Change imputation:** Modify KNN_NEIGHBORS in `src/config.py`

## Support

For issues or questions:
- Check the main README.md for detailed documentation
- Review the code comments for implementation details
- Check logs in `analytical_engine.log`
