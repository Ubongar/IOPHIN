"# IOPHIN - Nigeria Poverty Hotspot Identifier

A geospatial machine learning system for identifying poverty hotspots across Nigeria's Local Government Areas (LGAs) using nighttime satellite imagery and multidimensional poverty indicators.

**Note:** Nigeria has 774 official LGAs, but the current dataset contains 720 LGAs with complete data for analysis.

## Overview

This system combines:
- **VIIRS Nighttime Lights Data** (10.8GB GeoTIFF) - Proxy for economic activity
- **State-level MPI Data** - Multidimensional Poverty Index indicators
- **LGA Boundary Shapefiles** - Geospatial boundaries (720 LGAs with complete data)

The analytical engine uses unsupervised machine learning to classify LGAs into 4 risk categories:
- **High Risk - Severe Poverty**: Low nightlights + High poverty indicators
- **Medium Risk - Poor**: Moderate indicators
- **Low Risk - Vulnerable**: Improving indicators
- **Minimal Risk - Wealthy**: High nightlights + Low poverty indicators

## Project Structure

```
IOPHIN/
├── data/
│   ├── raw/
│   │   ├── viirs_2024.tif                    (10.8GB - Not in repo, local only)
│   │   ├── NGA_LGA_Boundaries_2_.../         (Shapefile directory)
│   │   ├── nga_mpi(3).csv                     (State MPI data)
│   │   └── Nigeria MPI by Senatorial District.csv
│   └── processed/
│       ├── processed_hotspots.csv             (Input: LGA coordinates)
│       ├── final_model_output.csv             (Output: Model results)
│       └── hotspots.geojson                   (Output: GeoJSON for frontend)
├── src/                                       (Python ML Engine)
│   ├── config.py                              (Configuration & paths)
│   ├── data_loader.py                         (Data loading utilities)
│   ├── feature_extraction.py                  (Memory-safe raster processing)
│   ├── model_engine.py                        (ML pipeline: KNN, PCA, K-means)
│   └── main.py                                (Main orchestration script)
├── server/                                    (Node.js Backend API)
│   ├── index.js                               (Express server with endpoints)
│   ├── package.json                           (Dependencies)
│   └── .env                                   (Configuration)
├── client/                                    (React Frontend Dashboard)
│   ├── src/
│   │   ├── components/                        (React components)
│   │   │   ├── MapComponent.tsx               (Interactive Leaflet map)
│   │   │   ├── Sidebar.tsx                    (Analytics panel)
│   │   │   └── Legend.tsx                     (Risk level legend)
│   │   ├── App.tsx                            (Main layout)
│   │   ├── types.ts                           (TypeScript definitions)
│   │   └── index.css                          (Tailwind styles)
│   ├── package.json                           (Dependencies)
│   └── .env                                   (Configuration)
└── requirements.txt                           (Python dependencies)
```

## Installation

```bash
# Install dependencies
pip install -r requirements.txt
```

## Usage

```bash
# Run the analytical engine
python -m src.main
```

The pipeline executes in 3 phases:

### Phase 1: Feature Extraction (Memory-Safe)
- Loads LGA shapefiles and boundaries
- Extracts mean nightlight intensity from VIIRS raster
- **Memory-safe**: Uses rasterio's windowed/masked reading to handle the 10GB file without loading it all into RAM
- **CRS Check**: Automatically reprojects shapefile if CRS doesn't match raster

### Phase 2: Data Fusion & Harmonization
- Merges poverty indicators from state-level data
- **KNN Imputation**: Fills missing poverty values using k=5 neighbors
- **Standardization**: Normalizes features (poverty scores vs nightlights 0-60)

### Phase 3: Machine Learning
- **PCA**: Reduces dimensionality while keeping 95% variance
- **K-Means Clustering**: Groups LGAs into 4 poverty risk categories
- **Validation**: Calculates Silhouette Score to assess cluster quality

## Key Features

### Memory-Safe Raster Processing
```python
# Uses rasterio.mask to extract only pixels within each polygon
# Prevents memory errors with large (10GB+) raster files
out_image, out_transform = mask(raster_src, [geometry], crop=True)
```

### Automatic CRS Handling
```python
# Checks and reprojects if necessary
if shapefile.crs != raster.crs:
    shapefile = shapefile.to_crs(raster.crs)
```

### Synthetic Data Fallback
When the VIIRS file is not available (e.g., on GitHub), the system generates synthetic nightlight data for testing purposes.

## Outputs

### 1. CSV Output (`final_model_output.csv`)
```csv
LGA_Name,State,Latitude,Longitude,mean_nightlight_intensity,MPI,cluster,cluster_label,risk_level
Aba North,Abia,5.33,7.32,23.36,0.0419,0,High Risk - Severe Poverty,High
```

### 2. GeoJSON Output (`hotspots.geojson`)
```json
{
  "type": "Feature",
  "properties": {
    "LGA_Name": "Aba North",
    "State": "Abia",
    "cluster_label": "High Risk - Severe Poverty",
    "risk_level": "High",
    "mean_nightlight_intensity": 23.36,
    "MPI": 0.0419
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [...]
  }
}
```

## Model Validation

The system reports a **Silhouette Score** to measure cluster quality:
- Scores > 0.5 indicate good separation
- Scores > 0.7 indicate excellent separation
- Example run: 0.4350 (moderate separation)

Note: The actual score varies depending on the data and clustering iteration.

## Dependencies

### Python (ML Engine)
- **numpy** - Numerical computations
- **pandas** - Data manipulation
- **scikit-learn** - Machine learning (KNN, PCA, K-Means)
- **geopandas** - Geospatial data handling
- **rasterio** - Memory-safe raster processing
- **shapely** - Geometric operations
- **fiona** - Vector file I/O
- **pyproj** - CRS transformations

### Node.js (Backend API)
- **express** - Web server framework
- **cors** - Cross-origin resource sharing
- **compression** - GZIP compression for large files
- **dotenv** - Environment variable management

### React (Frontend Dashboard)
- **react** & **react-dom** - UI framework
- **typescript** - Type safety
- **vite** - Build tool
- **tailwindcss** - Utility-first CSS
- **react-leaflet** & **leaflet** - Interactive maps
- **recharts** - Chart library
- **axios** - HTTP client

## Web Dashboard

The IOPHIN system now includes a production-grade web dashboard for visualizing poverty hotspots.

### Quick Start

1. **Start the Backend API**:
```bash
cd server
npm install
npm start
```

2. **Start the Frontend Dashboard**:
```bash
cd client
npm install
npm run dev
```

3. **Access the Dashboard**:
Open http://localhost:5173 in your browser

### Features

- 🗺️ Interactive map with 720 LGAs color-coded by risk level
- 📊 National statistics dashboard with pie charts
- 🔍 Click any LGA to view detailed analytics
- 💾 Poverty probability gauge and comparative analysis
- 🎨 Modern glassmorphism UI design

### Screenshots

**National Overview**
![Dashboard](https://github.com/user-attachments/assets/7d11dbbb-6c3f-4dc3-a1f9-34ee8b877f7f)

**LGA Detail View**
![LGA Detail](https://github.com/user-attachments/assets/d24b580a-db24-4d4a-89a1-53779ca1ac0a)

## Notes

- The VIIRS raster file (10.8GB) is **not included in the repository** due to size
- The system generates synthetic nightlight data when VIIRS is unavailable
- For production use with actual VIIRS data, place `viirs_2024.tif` in `data/raw/`

## Troubleshooting

If you encounter the **"No valid pixels found for geometry"** error, the system now includes comprehensive diagnostics to help identify the root cause:

- ✅ Automatic file size verification
- ✅ Spatial bounds overlap detection
- ✅ Sample pixel data inspection
- ✅ Coordinate system validation
- ✅ Enhanced error messages

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for a complete guide on diagnosing and fixing extraction issues.

## License

This project is part of the IOPHIN (Integrated Optimization Platform for Health Information in Nigeria) initiative.
" 
