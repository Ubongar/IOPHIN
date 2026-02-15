# Example Output: What Users Will See

This document shows what the enhanced diagnostic output looks like when running the pipeline with the VIIRS file.

## Scenario 1: Successful Run (VIIRS file present and valid)

```
2026-02-15 14:19:00 - INFO - Starting nightlight extraction from data/raw/viirs_2024.tif
2026-02-15 14:19:00 - INFO - Using memory-safe windowed reading to prevent Memory Error
2026-02-15 14:19:00 - INFO - VIIRS file size: 10.82 GB (11,615,309,824 bytes)
2026-02-15 14:19:00 - INFO - Raster opened successfully
2026-02-15 14:19:00 - INFO - Raster dimensions: 86401 x 33601
2026-02-15 14:19:00 - INFO - Raster CRS: EPSG:4326
2026-02-15 14:19:00 - INFO - Raster bounds: BoundingBox(left=-180.0021, bottom=-65.0021, right=180.0021, top=75.0021)
2026-02-15 14:19:00 - INFO - Raster data type: float32
2026-02-15 14:19:00 - INFO - Raster nodata value: -999.0
2026-02-15 14:19:00 - INFO - ================================================================================
2026-02-15 14:19:00 - INFO - SPATIAL BOUNDS VERIFICATION
2026-02-15 14:19:00 - INFO - ================================================================================
2026-02-15 14:19:00 - INFO - Shapefile bounds (Nigeria): [ 2.6926  4.2702 14.6780 13.8857]
2026-02-15 14:19:00 - INFO -   Min Longitude: 2.6926
2026-02-15 14:19:00 - INFO -   Min Latitude:  4.2702
2026-02-15 14:19:00 - INFO -   Max Longitude: 14.6780
2026-02-15 14:19:00 - INFO -   Max Latitude:  13.8857
2026-02-15 14:19:00 - INFO - Raster bounds (Global): BoundingBox(left=-180.0021, bottom=-65.0021, right=180.0021, top=75.0021)
2026-02-15 14:19:00 - INFO -   Min Longitude: -180.0021
2026-02-15 14:19:00 - INFO -   Min Latitude:  -65.0021
2026-02-15 14:19:00 - INFO -   Max Longitude: 180.0021
2026-02-15 14:19:00 - INFO -   Max Latitude:  75.0021
2026-02-15 14:19:00 - INFO - ✓ Bounds overlap confirmed - Shapefile and Raster intersect spatially
2026-02-15 14:19:00 - INFO - ================================================================================
2026-02-15 14:19:00 - INFO - Sampling raster data to verify content...
2026-02-15 14:19:00 - INFO - Sample pixels: min=0.05, max=245.67, mean=12.34, count=15234
2026-02-15 14:19:00 - INFO - Shapefile CRS: EPSG:4326
2026-02-15 14:19:00 - INFO - Raster CRS: EPSG:4326
2026-02-15 14:19:00 - INFO - CRS match confirmed - no reprojection needed
2026-02-15 14:19:00 - INFO - Processing LGA 1/774
2026-02-15 14:19:00 - INFO -   LGA bounds: (3.1234, 6.4567, 3.8901, 6.9012)
2026-02-15 14:19:01 - INFO -   LGA bounds: (7.2345, 9.1234, 7.6789, 9.5678)
2026-02-15 14:19:02 - INFO -   LGA bounds: (5.6789, 7.8901, 6.1234, 8.2345)
... processing continues ...
2026-02-15 14:20:45 - INFO - Nightlight extraction complete
2026-02-15 14:20:45 - INFO - Valid values: 720/774
2026-02-15 14:20:45 - INFO - Zero values: 54/774
2026-02-15 14:20:45 - INFO - Mean nightlight intensity: 18.45
2026-02-15 14:20:45 - INFO - Range: 0.00 - 58.92
```

**✓ SUCCESS**: File size correct, bounds overlap, good data extraction

---

## Scenario 2: Corrupted File (File too small)

```
2026-02-15 14:19:00 - INFO - Starting nightlight extraction from data/raw/viirs_2024.tif
2026-02-15 14:19:00 - INFO - Using memory-safe windowed reading to prevent Memory Error
2026-02-15 14:19:00 - INFO - VIIRS file size: 0.05 GB (53,687,091 bytes)
2026-02-15 14:19:00 - WARNING - VIIRS file size is unusually small (0.05 GB)
2026-02-15 14:19:00 - WARNING - Expected ~10-11 GB for full VIIRS dataset. File may be corrupted or incomplete.
```

**✗ PROBLEM DETECTED**: File is too small - download failed or corrupted
**ACTION**: Re-download the VIIRS file

---

## Scenario 3: Spatial Mismatch (Coordinate flip)

```
2026-02-15 14:19:00 - INFO - Starting nightlight extraction from data/raw/viirs_2024.tif
2026-02-15 14:19:00 - INFO - Using memory-safe windowed reading to prevent Memory Error
2026-02-15 14:19:00 - INFO - VIIRS file size: 10.82 GB (11,615,309,824 bytes)
2026-02-15 14:19:00 - INFO - Raster opened successfully
2026-02-15 14:19:00 - INFO - Raster dimensions: 86401 x 33601
2026-02-15 14:19:00 - INFO - Raster CRS: EPSG:4326
2026-02-15 14:19:00 - INFO - Raster bounds: BoundingBox(left=-180.0021, bottom=-65.0021, right=180.0021, top=75.0021)
2026-02-15 14:19:00 - INFO - ================================================================================
2026-02-15 14:19:00 - INFO - SPATIAL BOUNDS VERIFICATION
2026-02-15 14:19:00 - INFO - ================================================================================
2026-02-15 14:19:00 - INFO - Shapefile bounds (Nigeria): [13.8857  2.6926 4.2702 14.6780]
2026-02-15 14:19:00 - INFO -   Min Longitude: 13.8857
2026-02-15 14:19:00 - INFO -   Min Latitude:  2.6926
2026-02-15 14:19:00 - INFO -   Max Longitude: 4.2702
2026-02-15 14:19:00 - INFO -   Max Latitude:  14.6780
2026-02-15 14:19:00 - INFO - Raster bounds (Global): BoundingBox(left=-180.0021, bottom=-65.0021, right=180.0021, top=75.0021)
2026-02-15 14:19:00 - INFO -   Min Longitude: -180.0021
2026-02-15 14:19:00 - INFO -   Min Latitude:  -65.0021
2026-02-15 14:19:00 - INFO -   Max Longitude: 180.0021
2026-02-15 14:19:00 - INFO -   Max Latitude:  75.0021
2026-02-15 14:19:00 - ERROR - ✗ NO SPATIAL OVERLAP DETECTED!
2026-02-15 14:19:00 - ERROR -   This likely indicates a coordinate system mismatch (lat/lon flip)
2026-02-15 14:19:00 - ERROR -   Shapefile and Raster do not intersect - extraction will fail
2026-02-15 14:19:00 - INFO - ================================================================================
```

**✗ PROBLEM DETECTED**: Shapefile bounds are swapped (lat/lon flip)
**ACTION**: Check shapefile projection or reload with correct coordinate order

---

## Scenario 4: Empty Raster Data

```
2026-02-15 14:19:00 - INFO - Starting nightlight extraction from data/raw/viirs_2024.tif
2026-02-15 14:19:00 - INFO - Using memory-safe windowed reading to prevent Memory Error
2026-02-15 14:19:00 - INFO - VIIRS file size: 10.82 GB (11,615,309,824 bytes)
2026-02-15 14:19:00 - INFO - Raster opened successfully
... bounds verification successful ...
2026-02-15 14:19:00 - INFO - Sampling raster data to verify content...
2026-02-15 14:19:00 - WARNING - Sample window contains no valid pixel values
... processing continues ...
2026-02-15 14:19:03 - WARNING - No valid pixels found for geometry (extracted 1234 pixels, all invalid)
2026-02-15 14:19:03 - WARNING - No valid pixels found for geometry (extracted 987 pixels, all invalid)
... many warnings ...
2026-02-15 14:19:05 - INFO - Nightlight extraction complete
2026-02-15 14:19:05 - INFO - Valid values: 0/774
2026-02-15 14:19:05 - INFO - Zero values: 774/774
2026-02-15 14:19:05 - INFO - Mean nightlight intensity: 0.00
2026-02-15 14:19:05 - INFO - Range: 0.00 - 0.00
```

**✗ PROBLEM DETECTED**: Raster file is empty or all masked
**ACTION**: Check if you downloaded the correct VIIRS product (median vs mean, masked vs unmasked)

---

## Scenario 5: VIIRS File Not Found (Fallback to Synthetic Data)

```
2026-02-15 14:19:00 - INFO - Starting nightlight extraction from data/raw/viirs_2024.tif
2026-02-15 14:19:00 - INFO - Using memory-safe windowed reading to prevent Memory Error
2026-02-15 14:19:00 - ERROR - VIIRS raster file not found: data/raw/viirs_2024.tif
2026-02-15 14:19:00 - WARNING - Generating synthetic nightlight data for testing purposes
2026-02-15 14:19:00 - INFO - Generating synthetic nightlight data (VIIRS file not available)
2026-02-15 14:19:00 - INFO - Generated synthetic nightlight values
2026-02-15 14:19:00 - INFO - Mean: 14.98
2026-02-15 14:19:00 - INFO - Range: 5.28 - 26.56
```

**ℹ INFO**: VIIRS file not found, using synthetic data for testing
**ACTION**: For production use, download VIIRS file and place in data/raw/

---

## Key Diagnostic Indicators

| Indicator | Good ✓ | Problem ✗ |
|-----------|--------|-----------|
| File size | 10-11 GB | < 100 MB |
| Bounds overlap | ✓ confirmed | ✗ NO SPATIAL OVERLAP |
| Sample pixels | Valid data present | No valid values |
| Valid LGAs | 650-750 / 774 | < 100 / 774 |
| Mean nightlight | 10-30 | < 5 or > 100 |
| Processing time | 15-45 minutes | < 5 seconds |

## Next Steps

When you see diagnostic output:
1. Check file size first - ensures complete download
2. Check spatial overlap - ensures coordinate systems match
3. Check sample pixels - ensures data is present
4. Monitor processing time - should take 15-45 minutes for full dataset
5. Review final statistics - mean should be 10-30 for Nigeria

For detailed troubleshooting, see [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
