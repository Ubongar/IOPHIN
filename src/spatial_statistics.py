"""
Spatial Statistics - Moran's I, Getis-Ord Gi*, and Geographically Weighted Regression.
Provides spatial autocorrelation analysis for poverty patterns.
"""
import logging
from typing import Optional, List
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def compute_morans_i(gdf, column: str) -> dict:
    """Compute global Moran's I for spatial autocorrelation."""
    try:
        import libpysal.weights as lps_weights
        from esda.moran import Moran
    except ImportError:
        logger.warning("libpysal/esda not available; skipping Moran's I computation")
        return {'error': 'libpysal/esda not installed'}

    if column not in gdf.columns:
        return {'error': f'Column {column} not found'}

    try:
        gdf_valid = gdf[gdf[column].notna()].copy()
        if len(gdf_valid) < 4:
            return {'error': 'Insufficient features for spatial weights'}
        w = lps_weights.Queen.from_dataframe(gdf_valid, silence_warnings=True)
        w.transform = 'r'
        moran = Moran(gdf_valid[column], w)
        return {
            'moran_i': float(moran.I),
            'p_value': float(moran.p_sim),
            'z_score': float(moran.z_sim),
            'is_clustered': moran.p_sim < 0.05 and moran.I > 0,
            'interpretation': (
                'Spatially clustered' if moran.I > 0 and moran.p_sim < 0.05
                else 'Spatially dispersed' if moran.I < 0 and moran.p_sim < 0.05
                else 'Random spatial pattern'
            ),
        }
    except Exception as e:
        logger.error(f"Moran's I computation failed: {e}")
        return {'error': str(e)}


def compute_getis_ord(gdf, column: str):
    """Add Gi* z-scores and p-values to GeoDataFrame."""
    try:
        import libpysal.weights as lps_weights
        from esda.getisord import G_Local
    except ImportError:
        logger.warning("libpysal/esda not available; skipping Getis-Ord computation")
        gdf['gi_star_z_score'] = np.nan
        gdf['gi_star_p_value'] = np.nan
        gdf['is_spatial_hotspot'] = False
        return gdf

    if column not in gdf.columns:
        logger.warning(f"Column {column} not found")
        return gdf

    try:
        gdf_out = gdf.copy()
        gdf_valid = gdf_out[gdf_out[column].notna()].copy()
        if len(gdf_valid) < 4:
            gdf_out['gi_star_z_score'] = np.nan
            gdf_out['gi_star_p_value'] = np.nan
            gdf_out['is_spatial_hotspot'] = False
            return gdf_out

        w = lps_weights.Queen.from_dataframe(gdf_valid, silence_warnings=True)
        w.transform = 'r'
        g_local = G_Local(gdf_valid[column], w, star=True)

        gdf_out['gi_star_z_score'] = np.nan
        gdf_out['gi_star_p_value'] = np.nan
        gdf_out.loc[gdf_valid.index, 'gi_star_z_score'] = g_local.Zs
        gdf_out.loc[gdf_valid.index, 'gi_star_p_value'] = g_local.p_sim
        gdf_out['is_spatial_hotspot'] = (
            (gdf_out['gi_star_z_score'] > 1.96) &
            (gdf_out['gi_star_p_value'] < 0.05)
        ).fillna(False)
        return gdf_out
    except Exception as e:
        logger.error(f"Getis-Ord computation failed: {e}")
        gdf['gi_star_z_score'] = np.nan
        gdf['gi_star_p_value'] = np.nan
        gdf['is_spatial_hotspot'] = False
        return gdf


def run_gwr(gdf, target: str, features: List[str]):
    """Run GWR and add local R² and coefficients."""
    try:
        from mgwr.gwr import GWR
        from mgwr.sel_bw import Sel_BW
    except ImportError:
        logger.warning("mgwr not available; skipping GWR")
        gdf['gwr_r_squared_local'] = np.nan
        return gdf

    if target not in gdf.columns:
        logger.warning(f"Target column {target} not found")
        return gdf

    available_features = [f for f in features if f in gdf.columns]
    if len(available_features) < 1:
        logger.warning("No feature columns available for GWR")
        return gdf

    try:
        gdf_out = gdf.copy()
        gdf_valid = gdf_out[
            gdf_out[target].notna() &
            gdf_out[available_features].notna().all(axis=1)
        ].copy()

        if len(gdf_valid) < 10:
            gdf_out['gwr_r_squared_local'] = np.nan
            return gdf_out

        coords = np.array(list(zip(
            gdf_valid.geometry.centroid.x,
            gdf_valid.geometry.centroid.y
        )))
        y = gdf_valid[target].values.reshape(-1, 1)
        X = gdf_valid[available_features].values

        selector = Sel_BW(coords, y, X)
        bw = selector.search()
        model = GWR(coords, y, X, bw)
        results = model.fit()

        gdf_out['gwr_r_squared_local'] = np.nan
        gdf_out.loc[gdf_valid.index, 'gwr_r_squared_local'] = results.localR2
        return gdf_out
    except Exception as e:
        logger.error(f"GWR computation failed: {e}")
        gdf['gwr_r_squared_local'] = np.nan
        return gdf


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # Minimal self-test (no actual geo data)
    logger.info("spatial_statistics.py loaded successfully")
    result = compute_morans_i(pd.DataFrame(), 'mpi')
    print("Moran's I (empty input):", result)
