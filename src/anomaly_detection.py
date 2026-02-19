"""
Anomaly Detection - Nightlight Drop Detection and Multivariate Anomalies.
Uses PyOD Isolation Forest for multivariate anomaly detection.
Stores results in anomaly_alerts table.
"""
import logging
from typing import Optional
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

FEATURE_COLS = [
    'mean_nightlight_intensity', 'mpi', 'composite_poverty_score',
    'health_facility_count', 'school_count', 'road_density_km',
    'ndvi_mean', 'rainfall_mm', 'idp_count', 'food_price_index',
]


def detect_nightlight_anomalies(
    current_df: pd.DataFrame,
    history_df: pd.DataFrame,
    threshold: float = 0.20
) -> pd.DataFrame:
    """Flag LGAs with nightlight drop > threshold vs 30-day avg."""
    if current_df.empty or history_df.empty:
        return pd.DataFrame()

    if 'lga_name' not in current_df.columns or 'mean_nightlight_intensity' not in current_df.columns:
        return pd.DataFrame()

    # Compute 30-day rolling average from history
    hist = history_df.copy()
    date_col = 'snapshot_date' if 'snapshot_date' in hist.columns else 'date'
    if date_col not in hist.columns:
        return pd.DataFrame()

    hist[date_col] = pd.to_datetime(hist[date_col])
    recent_cutoff = hist[date_col].max() - pd.Timedelta(days=30)
    recent_hist = hist[hist[date_col] >= recent_cutoff]

    if recent_hist.empty or 'mean_nightlight_intensity' not in recent_hist.columns:
        return pd.DataFrame()

    baseline = recent_hist.groupby('lga_name')['mean_nightlight_intensity'].mean()

    anomalies = []
    for _, row in current_df.iterrows():
        lga = row.get('lga_name') or row.get('LGA_Name')
        if lga is None or lga not in baseline.index:
            continue
        current_nl = row.get('mean_nightlight_intensity', np.nan)
        expected_nl = baseline[lga]
        if pd.isna(current_nl) or pd.isna(expected_nl) or expected_nl == 0:
            continue
        drop = (expected_nl - current_nl) / expected_nl
        if drop > threshold:
            anomalies.append({
                'lga_name': lga,
                'state': row.get('State') or row.get('state', ''),
                'anomaly_type': 'nightlight_drop',
                'severity': 'critical' if drop > 0.5 else 'high' if drop > 0.35 else 'medium',
                'description': f"Nightlight intensity dropped {drop*100:.1f}% vs 30-day average",
                'metric_name': 'mean_nightlight_intensity',
                'expected_value': float(expected_nl),
                'actual_value': float(current_nl),
                'deviation_pct': float(drop * 100),
            })

    return pd.DataFrame(anomalies)


def detect_multivariate_anomalies(df: pd.DataFrame, contamination: float = 0.05) -> pd.DataFrame:
    """Use Isolation Forest to flag outliers across all dimensions."""
    try:
        from pyod.models.iforest import IForest
        use_pyod = True
    except ImportError:
        logger.warning("pyod not available; using sklearn IsolationForest")
        use_pyod = False

    available_features = [c for c in FEATURE_COLS if c in df.columns]
    if len(available_features) < 3:
        logger.warning("Not enough feature columns for multivariate anomaly detection")
        return pd.DataFrame()

    X = df[available_features].fillna(df[available_features].median()).values

    try:
        if use_pyod:
            clf = IForest(contamination=contamination, random_state=42)
            clf.fit(X)
            labels = clf.labels_  # 0 = normal, 1 = anomaly
            scores = clf.decision_scores_
        else:
            from sklearn.ensemble import IsolationForest
            clf = IsolationForest(contamination=contamination, random_state=42)
            preds = clf.fit_predict(X)
            labels = (preds == -1).astype(int)
            scores = -clf.score_samples(X)
    except Exception as e:
        logger.error(f"Anomaly detection failed: {e}")
        return pd.DataFrame()

    result_df = df.copy()
    result_df['is_anomaly'] = labels
    result_df['anomaly_score'] = scores

    anomaly_rows = result_df[result_df['is_anomaly'] == 1].copy()
    if anomaly_rows.empty:
        return pd.DataFrame()

    output = []
    for _, row in anomaly_rows.iterrows():
        lga = row.get('lga_name') or row.get('LGA_Name', 'Unknown')
        # Find the most deviant feature
        row_vals = row[available_features].fillna(0)
        medians = df[available_features].median()
        stds = df[available_features].std().replace(0, 1)
        z_scores = ((row_vals - medians) / stds).abs()
        top_feature = z_scores.idxmax()
        output.append({
            'lga_name': lga,
            'state': row.get('State') or row.get('state', ''),
            'anomaly_type': 'multivariate',
            'severity': 'high' if row['anomaly_score'] > 0.7 else 'medium',
            'description': f"Multivariate anomaly detected; top deviating feature: {top_feature}",
            'metric_name': top_feature,
            'expected_value': float(medians.get(top_feature, 0)),
            'actual_value': float(row.get(top_feature, 0)),
            'deviation_pct': float(z_scores.get(top_feature, 0) * 100),
        })

    return pd.DataFrame(output)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    np.random.seed(42)
    n = 100
    curr = pd.DataFrame({
        'lga_name': [f'LGA_{i}' for i in range(n)],
        'state': ['StateX'] * n,
        'mean_nightlight_intensity': np.random.exponential(5, n),
        'mpi': np.random.uniform(0.2, 0.8, n),
        'composite_poverty_score': np.random.uniform(0.2, 0.8, n),
        'health_facility_count': np.random.poisson(3, n).astype(float),
        'school_count': np.random.poisson(5, n).astype(float),
        'road_density_km': np.random.uniform(0, 50, n),
        'ndvi_mean': np.random.uniform(0.1, 0.8, n),
        'rainfall_mm': np.random.uniform(200, 1200, n),
        'idp_count': np.random.poisson(100, n).astype(float),
        'food_price_index': np.random.uniform(80, 150, n),
    })
    # Inject an anomaly in nightlight
    curr.loc[5, 'mean_nightlight_intensity'] = 0.01
    dates = pd.date_range('2023-09-01', periods=5, freq='W')
    hist_rows = []
    for d in dates:
        for i in range(n):
            hist_rows.append({'snapshot_date': d, 'lga_name': f'LGA_{i}',
                               'mean_nightlight_intensity': np.random.exponential(5)})
    hist = pd.DataFrame(hist_rows)
    nl_anom = detect_nightlight_anomalies(curr, hist, threshold=0.20)
    print("Nightlight anomalies:", nl_anom[['lga_name', 'deviation_pct']].head())
    mv_anom = detect_multivariate_anomalies(curr)
    print("Multivariate anomalies:", len(mv_anom))
