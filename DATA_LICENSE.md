# IOPHIN — Data & License Information (v4.0)

## Data Sources & Attribution

### Primary Input Data

| Source | File / API | License | Attribution |
|--------|------------|---------|-------------|
| Nigeria MPI (Multidimensional Poverty Index) | `data/raw/nga_mpi(3).csv`, `Nigeria MPI by Senatorial District.csv` | Open Data | Oxford Poverty and Human Development Initiative (OPHI) / UNDP |
| Nigeria LGA Boundaries | `data/raw/nigeria_lga.json` | Open Data | GRID3 Nigeria / geoBoundaries |
| NGA LGA Boundaries Shapefile | `data/raw/NGA_LGA_Boundaries_2_-5383648833805565856/` | Open Data | Humanitarian Data Exchange (HDX) |

### External API Data Sources

| Source | Data Type | License / Terms | Attribution |
|--------|-----------|-----------------|-------------|
| VIIRS Nighttime Lights | Satellite nightlight intensity | Public Domain | NASA / NOAA VIIRS DNB |
| Google Earth Engine (GEE) | VIIRS, MODIS NDVI, CHIRPS Rainfall | [GEE Terms of Service](https://earthengine.google.com/terms/) | Google Earth Engine |
| ACLED (Armed Conflict Location & Event Data) | Conflict events | [ACLED Terms](https://acleddata.com/terms-of-use/) | ACLED (acleddata.com) |
| OpenStreetMap (Overpass API) | Infrastructure — health, education, roads | ODbL 1.0 | © OpenStreetMap contributors |
| WorldPop | Population density estimates | CC BY 4.0 | WorldPop (worldpop.org) |
| DTM / IOM | Internally Displaced Person (IDP) counts | [IOM Terms](https://dtm.iom.int/terms) | International Organization for Migration — Displacement Tracking Matrix |
| HDX (Humanitarian Data Exchange) | Food price index | Varies per dataset | OCHA / Humanitarian Data Exchange |
| GRID3 | Administrative boundary updates | CC BY 4.0 | GRID3 Nigeria |

### Data Processing Notes

- **MPI Data**: Raw CSV files contain subnational MPI scores by LGA and senatorial district. Values range 0-1 (higher = more deprived).
- **Nightlight Data**: VIIRS Day/Night Band (DNB) composites. Mean radiance extracted per LGA boundary. Higher values indicate more economic activity.
- **Name Normalization**: The pipeline applies 60+ name corrections to reconcile spelling variations across data sources (see `src/data_loader.py`).
- **Geometry**: All spatial data is projected to EPSG:4326 (WGS 84) for consistency.

---

## Output Data

| File | Format | Content |
|------|--------|---------|
| `data/processed/final_model_output.csv` | CSV | All 774 LGAs with features, composite scores, risk tiers |
| `data/processed/hotspots.geojson` | GeoJSON | Cluster-mode risk tiers with geometry |
| `data/processed/hotspots.absolute.geojson` | GeoJSON | Absolute-mode risk tiers with geometry |
| `data/processed/processed_hotspots.csv` | CSV | Intermediate processed data |
| PostgreSQL `poverty_hotspots` | Database | Live operational data (30+ columns per LGA) |
| PostgreSQL `hotspot_history` | Database | Historical snapshots for trend analysis |

---

## Software Licenses

### Project License
This project is released under the **MIT License**. See [license.md](license.md) for the full text.

### Key Dependency Licenses

| Package | License | Layer |
|---------|---------|-------|
| Python (CPython) | PSF License | Engine |
| pandas | BSD-3-Clause | Engine |
| scikit-learn | BSD-3-Clause | Engine |
| XGBoost | Apache-2.0 | Engine |
| LightGBM | MIT | Engine |
| Prophet | MIT | Engine |
| HDBSCAN | BSD-3-Clause | Engine |
| PyOD | BSD-2-Clause | Engine |
| GeoPandas | BSD-3-Clause | Engine |
| Rasterio | BSD-3-Clause | Engine |
| libpysal / esda / mgwr | BSD-3-Clause | Engine |
| earthengine-api | Apache-2.0 | Engine |
| SQLAlchemy | MIT | Engine |
| Node.js | MIT | Server |
| Express | MIT | Server |
| Socket.IO | MIT | Server |
| pg (node-postgres) | MIT | Server |
| ioredis | MIT | Server |
| PDFKit | MIT | Server |
| bcryptjs | MIT | Server |
| jsonwebtoken | MIT | Server |
| swagger-ui-express | MIT | Server |
| React | MIT | Client |
| Vite | MIT | Client |
| Tailwind CSS | MIT | Client |
| Leaflet | BSD-2-Clause | Client |
| MapLibre GL JS | BSD-3-Clause | Client |
| Recharts | MIT | Client |
| Zustand | MIT | Client |
| Turf.js | MIT | Client |
| jsPDF | MIT | Client |
| PostgreSQL | PostgreSQL License | Infrastructure |
| PostGIS | GPL-2.0 | Infrastructure |
| Redis | BSD-3-Clause | Infrastructure |
| Docker | Apache-2.0 | Infrastructure |

---

## Data Privacy & Ethics

- **No personally identifiable information (PII)** is collected or stored in the poverty hotspot dataset.
- All data operates at the **LGA administrative level** (774 areas), not individual or household level.
- User accounts store only email, organization, and role information.
- Audit logs record admin actions for accountability.
- Geographic scoping restricts data access by assigned regions.
- The system is designed for **humanitarian and development purposes**: identifying areas requiring intervention, tracking aid effectiveness, and allocating resources.

## Citation

If using IOPHIN or its outputs in research or reporting, please cite:

```
IOPHIN: Integrated Open Poverty Hotspot Intelligence Network (v4.0)
https://github.com/your-org/iophin
```

And include appropriate attribution for the underlying data sources listed above.
