"""
Temporal Analysis - MPI Trajectory Analysis using hotspot_history table.
Computes trends, classifies trajectories, and flags tier crossings.
"""
import logging
from typing import Optional
import numpy as np
import pandas as pd
from scipy import stats

logger = logging.getLogger(__name__)

SLOPE_THRESHOLDS = {
    'fast_deteriorating': 0.005,
    'deteriorating': 0.001,
    'improving': -0.001,
    'fast_improving': -0.005,
}

RISK_ORDER = {'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1, 'Minimal': 0}


def compute_temporal_trends(history_df: pd.DataFrame) -> pd.DataFrame:
    """Compute MPI slope, acceleration, and classify trajectories."""
    if history_df.empty:
        return pd.DataFrame()

    history_df = history_df.copy()
    # Normalize column names
    col_map = {
        'snapshot_date': 'date',
        'Snapshot_Date': 'date',
        'snapshotDate': 'date',
        'SnapshotDate': 'date',
        'lga_name': 'lga_name',
        'LGA_Name': 'lga_name',
        'state': 'state',
        'State': 'state',
        'mpi': 'mpi',
        'MPI': 'mpi',
        'composite_poverty_score': 'composite_score',
        'risk_level': 'risk_level',
        'Risk_Level': 'risk_level',
    }
    for src, dst in col_map.items():
        if src in history_df.columns and dst not in history_df.columns:
            history_df[dst] = history_df[src]

    if 'date' not in history_df.columns:
        # Fallback: pick any column containing 'date' in case of schema drift.
        date_like = [c for c in history_df.columns if 'date' in c.lower()]
        if date_like:
            history_df['date'] = history_df[date_like[0]]
        else:
            logger.warning("No date column found in history data")
            return pd.DataFrame()

    history_df['date'] = pd.to_datetime(history_df['date'])
    history_df = history_df.sort_values('date')

    results = []
    for lga_name, group in history_df.groupby('lga_name'):
        group = group.sort_values('date').reset_index(drop=True)
        if len(group) < 2:
            continue
        # Convert dates to numeric (months since first record)
        t = (group['date'] - group['date'].iloc[0]).dt.days / 30.0
        mpi_vals = group['mpi'].values if 'mpi' in group.columns else None
        if mpi_vals is None or np.all(np.isnan(mpi_vals)):
            continue

        # Linear trend
        valid_mask = ~np.isnan(mpi_vals)
        if valid_mask.sum() < 2:
            continue
        slope, intercept, r_value, p_value, std_err = stats.linregress(
            t[valid_mask], mpi_vals[valid_mask]
        )
        # Acceleration (2nd derivative proxy via second-half vs first-half slope)
        t_valid = t[valid_mask]
        mpi_valid = mpi_vals[valid_mask]
        mid = len(mpi_valid) // 2
        if mid > 1 and len(mpi_valid) - mid > 1:
            s1, *_ = stats.linregress(t_valid[:mid], mpi_valid[:mid])
            s2, *_ = stats.linregress(t_valid[mid:], mpi_valid[mid:])
            acceleration = s2 - s1
        else:
            acceleration = 0.0

        volatility = float(np.std(mpi_vals[valid_mask]))

        # Trajectory classification
        if slope >= SLOPE_THRESHOLDS['fast_deteriorating']:
            trend_class = 'Deteriorating Fast'
        elif slope >= SLOPE_THRESHOLDS['deteriorating']:
            trend_class = 'Deteriorating'
        elif slope <= SLOPE_THRESHOLDS['fast_improving']:
            trend_class = 'Improving Fast'
        elif slope <= SLOPE_THRESHOLDS['improving']:
            trend_class = 'Improving'
        else:
            trend_class = 'Stable'

        # Months at current tier
        current_risk = group['risk_level'].iloc[-1] if 'risk_level' in group.columns else None
        if current_risk:
            same_tier = group[group['risk_level'] == current_risk]
            months_at_tier = len(same_tier)
        else:
            months_at_tier = len(group)

        results.append({
            'lga_name': lga_name,
            'state': group['state'].iloc[-1] if 'state' in group.columns else None,
            'trend_slope': float(slope),
            'trend_acceleration': float(acceleration),
            'trend_volatility': float(volatility),
            'trend_r_squared': float(r_value ** 2),
            'trend_class': trend_class,
            'months_at_current_tier': months_at_tier,
            'current_mpi': float(mpi_vals[valid_mask][-1]),
        })

    return pd.DataFrame(results)


def detect_tier_crossings(history_df: pd.DataFrame, window_days: int = 30) -> pd.DataFrame:
    """Flag LGAs that changed risk tier recently."""
    if history_df.empty:
        return pd.DataFrame()

    history_df = history_df.copy()
    if 'snapshot_date' in history_df.columns:
        history_df['date'] = pd.to_datetime(history_df['snapshot_date'])
    elif 'date' in history_df.columns:
        history_df['date'] = pd.to_datetime(history_df['date'])
    else:
        return pd.DataFrame()

    if 'lga_name' not in history_df.columns or 'risk_level' not in history_df.columns:
        return pd.DataFrame()

    cutoff = history_df['date'].max() - pd.Timedelta(days=window_days)
    crossings = []

    for lga_name, group in history_df.groupby('lga_name'):
        group = group.sort_values('date').reset_index(drop=True)
        recent = group[group['date'] >= cutoff]
        older = group[group['date'] < cutoff]
        if recent.empty or older.empty:
            continue

        old_risk = older['risk_level'].iloc[-1]
        new_risk = recent['risk_level'].iloc[-1]
        if old_risk != new_risk:
            old_ord = RISK_ORDER.get(old_risk, -1)
            new_ord = RISK_ORDER.get(new_risk, -1)
            direction = 'worsened' if new_ord > old_ord else 'improved'
            crossings.append({
                'lga_name': lga_name,
                'state': group['state'].iloc[-1] if 'state' in group.columns else None,
                'old_risk_level': old_risk,
                'new_risk_level': new_risk,
                'direction': direction,
                'crossed_at': recent['date'].iloc[0].isoformat(),
                'tier_delta': abs(new_ord - old_ord),
            })

    df = pd.DataFrame(crossings)
    if not df.empty:
        df = df.sort_values('tier_delta', ascending=False).reset_index(drop=True)
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # Synthetic test
    import datetime
    dates = pd.date_range('2023-01-01', periods=12, freq='MS')
    test_hist = pd.DataFrame({
        'snapshot_date': list(dates) * 2,
        'lga_name': ['LGA_A'] * 12 + ['LGA_B'] * 12,
        'state': ['StateX'] * 24,
        'mpi': list(np.linspace(0.3, 0.7, 12)) + list(np.linspace(0.6, 0.4, 12)),
        'risk_level': ['High'] * 6 + ['Critical'] * 6 + ['High'] * 12,
    })
    trends = compute_temporal_trends(test_hist)
    print(trends[['lga_name', 'trend_slope', 'trend_class']])
    crossings = detect_tier_crossings(test_hist, window_days=60)
    print(crossings)
