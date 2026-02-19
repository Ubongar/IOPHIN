"""
Predictive Model - Risk Tier Forecasting using Prophet.
Forecasts 3 and 6 month risk trajectories for all LGAs.
Stores predictions in risk_forecasts table.
"""
import logging
from typing import Optional
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

RISK_ORDER = ['Minimal', 'Low', 'Medium', 'High', 'Critical']
RISK_ORDER_MAP = {r: i for i, r in enumerate(RISK_ORDER)}

FORECAST_HORIZONS = [3, 6]  # months


def build_forecast_model(lga_name: str, history_df: pd.DataFrame) -> dict:
    """Build Prophet model for one LGA. Returns forecast dict."""
    try:
        from prophet import Prophet
    except ImportError:
        logger.warning("prophet not available; using linear extrapolation fallback")
        return _linear_forecast(lga_name, history_df)

    if history_df.empty or len(history_df) < 3:
        return {}

    df = history_df.copy()
    date_col = 'snapshot_date' if 'snapshot_date' in df.columns else 'date'
    if date_col not in df.columns:
        return {}
    if 'mpi' not in df.columns:
        return {}

    df_prophet = pd.DataFrame({
        'ds': pd.to_datetime(df[date_col]),
        'y': df['mpi'].values,
    }).dropna()

    if len(df_prophet) < 3:
        return {}

    model = Prophet(yearly_seasonality=False, weekly_seasonality=False,
                    daily_seasonality=False, uncertainty_samples=100)
    model.fit(df_prophet)

    results = {}
    for horizon in FORECAST_HORIZONS:
        future = model.make_future_dataframe(periods=horizon, freq='MS')
        forecast = model.predict(future)
        last = forecast.iloc[-1]
        predicted_mpi = float(last['yhat'])
        predicted_mpi = np.clip(predicted_mpi, 0.0, 1.0)
        interval_width = float(last['yhat_upper'] - last['yhat_lower'])
        confidence = float(np.clip(1.0 / (1.0 + interval_width), 0.0, 1.0))
        risk_level = _mpi_to_risk(predicted_mpi)
        results[horizon] = {
            'predicted_mpi': predicted_mpi,
            'predicted_risk_level': risk_level,
            'confidence': confidence,
            'forecast_date': last['ds'].isoformat()[:10],
        }

    results['lga_name'] = lga_name
    return results


def _linear_forecast(lga_name: str, history_df: pd.DataFrame) -> dict:
    """Simple linear extrapolation fallback when Prophet is unavailable."""
    from scipy import stats as sp_stats
    date_col = 'snapshot_date' if 'snapshot_date' in history_df.columns else 'date'
    if date_col not in history_df.columns or 'mpi' not in history_df.columns:
        return {}
    df = history_df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col).dropna(subset=['mpi'])
    if len(df) < 2:
        return {}
    t = (df[date_col] - df[date_col].iloc[0]).dt.days.values
    mpi = df['mpi'].values
    slope, intercept, *_ = sp_stats.linregress(t, mpi)
    last_t = t[-1]
    results = {'lga_name': lga_name}
    for horizon in FORECAST_HORIZONS:
        future_t = last_t + horizon * 30
        predicted_mpi = float(np.clip(slope * future_t + intercept, 0.0, 1.0))
        results[horizon] = {
            'predicted_mpi': predicted_mpi,
            'predicted_risk_level': _mpi_to_risk(predicted_mpi),
            'confidence': 0.5,
            'forecast_date': (df[date_col].iloc[-1] + pd.DateOffset(months=horizon)).isoformat()[:10],
        }
    return results


def forecast_all_lgas(session=None, history_df: Optional[pd.DataFrame] = None) -> pd.DataFrame:
    """Forecast risk for all LGAs. Returns predictions DataFrame."""
    if history_df is None and session is not None:
        try:
            history_df = pd.read_sql(
                "SELECT lga_name, state, snapshot_date, mpi, composite_poverty_score, risk_level "
                "FROM hotspot_history ORDER BY lga_name, snapshot_date",
                session.bind
            )
        except Exception as e:
            logger.error(f"Failed to load history from DB: {e}")
            return pd.DataFrame()

    if history_df is None or history_df.empty:
        return pd.DataFrame()

    all_rows = []
    for lga_name, group in history_df.groupby('lga_name'):
        forecast = build_forecast_model(lga_name, group)
        if not forecast:
            continue
        state = group['state'].iloc[-1] if 'state' in group.columns else None
        current_risk = group['risk_level'].iloc[-1] if 'risk_level' in group.columns else None
        for horizon in FORECAST_HORIZONS:
            if horizon not in forecast:
                continue
            h = forecast[horizon]
            all_rows.append({
                'lga_name': lga_name,
                'state': state,
                'current_risk_level': current_risk,
                'predicted_risk_level': h['predicted_risk_level'],
                'confidence': h['confidence'],
                'predicted_composite_score': h['predicted_mpi'],
                'forecast_date': h['forecast_date'],
                'forecast_horizon_months': horizon,
                'model_version': 'prophet_v1',
            })

    return pd.DataFrame(all_rows)


def identify_escalation_candidates(forecasts_df: pd.DataFrame) -> pd.DataFrame:
    """Filter LGAs predicted to worsen by ≥1 tier in next 3 months."""
    if forecasts_df.empty:
        return pd.DataFrame()
    df = forecasts_df[forecasts_df['forecast_horizon_months'] == 3].copy()
    if df.empty:
        return pd.DataFrame()
    df['current_ord'] = df['current_risk_level'].map(RISK_ORDER_MAP)
    df['predicted_ord'] = df['predicted_risk_level'].map(RISK_ORDER_MAP)
    escalations = df[df['predicted_ord'] > df['current_ord']].copy()
    escalations['tier_jump'] = escalations['predicted_ord'] - escalations['current_ord']
    return escalations.sort_values('tier_jump', ascending=False).reset_index(drop=True)


def _mpi_to_risk(mpi: float) -> str:
    """Convert MPI score to risk level."""
    if mpi >= 0.60:
        return 'Critical'
    elif mpi >= 0.45:
        return 'High'
    elif mpi >= 0.30:
        return 'Medium'
    elif mpi >= 0.15:
        return 'Low'
    else:
        return 'Minimal'


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    dates = pd.date_range('2023-01-01', periods=12, freq='MS')
    test_hist = pd.DataFrame({
        'snapshot_date': dates,
        'lga_name': ['TestLGA'] * 12,
        'state': ['TestState'] * 12,
        'mpi': np.linspace(0.3, 0.55, 12),
        'risk_level': ['Medium'] * 8 + ['High'] * 4,
    })
    result = forecast_all_lgas(history_df=test_hist)
    print(result)
    escalations = identify_escalation_candidates(result)
    print("Escalation candidates:", escalations)
