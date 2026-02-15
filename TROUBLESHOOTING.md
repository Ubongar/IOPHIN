# Troubleshooting Guide: "No Valid Pixels" Error

This guide helps you diagnose and fix the "No valid pixels found for geometry" error when extracting nightlight data from VIIRS raster files.

## Understanding the Error

The error message `"No valid pixels found for geometry"` means the system looked at your LGA boundary in the shapefile but couldn't find any corresponding satellite data in the VIIRS raster file. This results in 0.00 Nightlight Intensity for affected LGAs.

## Diagnostic Features

The system now includes comprehensive diagnostics that run automatically when you execute the pipeline. Look for these sections in your logs:

### 1. File Size Verification

```
VIIRS file size: 10.82 GB (11,615,309,824 bytes)
```

**What to check:**
- If size is less than 100 MB: Your download failed or the file is corrupted
- Expected size: ~10-11 GB for full VIIRS dataset
- Fix: Re-download the VIIRS file

### 2. Spatial Bounds Verification

```
================================================================================
SPATIAL BOUNDS VERIFICATION
================================================================================
Shapefile bounds (Nigeria): [ 2.6926  4.2702 14.6780 13.8857]
  Min Longitude: 2.6926
  Min Latitude:  4.2702
  Max Longitude: 14.6780
  Max Latitude:  13.8857
Raster bounds (Global): BoundingBox(left=-180.0021, bottom=-65.0021, right=180.0021, top=75.0021)
  Min Longitude: -180.0021
  Min Latitude:  -65.0021
  Max Longitude: 180.0021
  Max Latitude:  75.0021
✓ Bounds overlap confirmed - Shapefile and Raster intersect spatially
================================================================================
```

**What to check:**
- ✓ Green checkmark means spatial overlap is confirmed - good!
- ✗ Red X means no overlap - coordinate system mismatch
- Nigeria should be roughly: Longitude 2.6° to 14.6°E, Latitude 4.2° to 13.8°N
- If bounds look swapped or wrong, you likely have a lat/lon coordinate flip

### 3. Raster Metadata

```
Raster opened successfully
Raster dimensions: 86401 x 33601
Raster CRS: EPSG:4326
Raster data type: float32
Raster nodata value: -999.0
```

**What to check:**
- CRS should match shapefile (EPSG:4326 for WGS84)
- Dimensions should be large (10+ GB files have dimensions in tens of thousands)
- Data type should be float32 or similar
- Nodata value is used to filter out invalid pixels

### 4. Sample Pixel Inspection

```
Sampling raster data to verify content...
Sample pixels: min=0.05, max=245.67, mean=12.34, count=15234
```

**What to check:**
- If you see valid pixel statistics: Raster contains data - good!
- If you see "Sample window contains no valid pixel values": Raster might be empty or masked
- Typical nightlight values range from 0 to ~100 nW/cm²/sr

### 5. Extraction Results

```
Nightlight extraction complete
Valid values: 727/774
Zero values: 47/774
Mean nightlight intensity: 15.23
Range: 0.00 - 58.45
```

**What to check:**
- Valid values: Number of LGAs with nightlight data > 0
- Zero values: Rural LGAs or areas with genuinely no lights
- Mean should be 10-30 for Nigeria (mix of urban and rural)
- If mean is < 5: Possible data quality issue
- If all values are 0: Spatial mismatch or corrupted file

## Common Issues and Solutions

### Issue 1: Processing Too Fast (3 seconds for 10GB file)

**Symptoms:**
- Logs show processing finished in 2-5 seconds
- Mean nightlight < 5
- Many zero values

**Diagnosis:**
- Check file size: Should be ~10 GB
- Check if file is a shortcut/link

**Solution:**
- Verify file is actually 10GB: `ls -lh data/raw/viirs_2024.tif`
- Re-download VIIRS file if corrupted
- Ensure you're using the actual file, not a symbolic link

### Issue 2: Spatial Mismatch (Coordinate Flip)

**Symptoms:**
- Log shows: "✗ NO SPATIAL OVERLAP DETECTED!"
- All or most LGAs return 0.00
- Bounds look incorrect

**Diagnosis:**
- Compare shapefile bounds to raster bounds
- Nigeria should be: Lon 2.6-14.6, Lat 4.2-13.8
- If numbers are swapped, you have a lat/lon flip

**Solution:**
Option A - Check your shapefile:
```python
import geopandas as gpd
gdf = gpd.read_file('path/to/shapefile.shp')
print(gdf.crs)  # Should be EPSG:4326
print(gdf.total_bounds)  # Should match Nigeria bounds
```

Option B - Check your raster:
```python
import rasterio
with rasterio.open('path/to/viirs_2024.tif') as src:
    print(src.crs)  # Should be EPSG:4326
    print(src.bounds)  # Should cover Nigeria
```

### Issue 3: Masked Data (No Data in Rural Areas)

**Symptoms:**
- Urban LGAs (Lagos, Abuja) work fine
- Rural LGAs return 0.00
- Mean nightlight is reasonable (10-30)

**Diagnosis:**
- This is expected behavior for the "median_masked" VIIRS version
- Masked files set dark pixels to NaN/0

**Solution:**
- No fix needed - system now returns 0.0 instead of NaN
- Rural areas genuinely have low nightlight intensity
- This is valid data for poverty analysis

### Issue 4: All Zero Values

**Symptoms:**
- All 774 LGAs return 0.00
- Spatial bounds show overlap
- File size is correct

**Diagnosis:**
- Raster might be in wrong format
- Coordinate reference system mismatch despite same EPSG code

**Solution:**
Check raster projection:
```bash
gdalinfo data/raw/viirs_2024.tif
```

Look for axis order issues in EPSG:4326. Sometimes rasters use (lat, lon) while shapefiles use (lon, lat) even with same CRS code.

## Expected Output

For a successful run, you should see:
- ✓ File size: ~10-11 GB
- ✓ Bounds overlap confirmed
- ✓ Sample pixels show valid data
- ✓ Valid values: 650-750 out of 774 LGAs
- ✓ Mean nightlight: 10-30 for Nigeria
- ✓ Range: 0 to 50-100

Urban LGAs (Lagos, Kano, Abuja, Port Harcourt) should have values of 20-60, while rural areas typically have 0-15.

## Getting Help

If you've checked all the above and still have issues:

1. Share the complete diagnostic output from your logs
2. Include the file size of your VIIRS file
3. Include the bounds verification section
4. Note which specific LGAs are failing (all, urban only, rural only, etc.)

## New Features in This Version

- 🆕 Automatic file size verification
- 🆕 Spatial overlap detection
- 🆕 Sample pixel inspection
- 🆕 NaN values automatically replaced with 0.0
- 🆕 Enhanced error messages with context
- 🆕 Separate reporting of zero vs. valid values
