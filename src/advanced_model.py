"""
Advanced ML Model - XGBoost/LightGBM Dynamic Composite Poverty Scoring.
Replaces the static weighted composite with a trained ML model.
Falls back to weighted composite if insufficient training data.
"""
import os
import logging
import pickle
from pathlib import Path
from typing import Tuple, Optional

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, r2_score

logger = logging.getLogger(__name__)

FEATURE_COLS = [
    'mean_nightlight_intensity', 'ndvi_mean', 'rainfall_mm',
    'health_facility_count', 'school_count', 'road_density_km',
    'population_density', 'food_price_index', 'idp_count',
]
TARGET_COL = 'MPI'
MIN_TRAINING_SAMPLES = 30

def _get_model_path() -> Path:
    try:
        from src.config import MODEL_SAVE_DIR
        return MODEL_SAVE_DIR / "xgboost_poverty_model.pkl"
    except Exception:
        models_dir = Path(__file__).parent.parent / "models"
        models_dir.mkdir(parents=True, exist_ok=True)
        return models_dir / "xgboost_poverty_model.pkl"

def train_dynamic_model(df: pd.DataFrame) -> Tuple[object, dict]:
    """Train XGBoost on ground-truth MPI. Returns (model, metrics)."""
    try:
        import xgboost as xgb
    except ImportError:
        logger.warning("xgboost not available; skipping dynamic model training")
        return None, {}

    available_features = [c for c in FEATURE_COLS if c in df.columns]
    if TARGET_COL not in df.columns or len(available_features) < 3:
        logger.warning("Insufficient columns for XGBoost training")
        return None, {}

    subset = df[available_features + [TARGET_COL]].dropna()
    if len(subset) < MIN_TRAINING_SAMPLES:
        logger.warning(f"Only {len(subset)} samples — need {MIN_TRAINING_SAMPLES} for XGBoost training")
        return None, {}

    X = subset[available_features].values
    y = subset[TARGET_COL].values
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    try:
        from src.config import XGBOOST_PARAMS
        params = XGBOOST_PARAMS
    except Exception:
        params = {'max_depth': 6, 'learning_rate': 0.1, 'n_estimators': 200,
                  'objective': 'reg:squarederror', 'eval_metric': 'rmse'}

    model = xgb.XGBRegressor(**params, random_state=42)
    model.fit(X_train_s, y_train, eval_set=[(X_test_s, y_test)], verbose=False)

    y_pred = model.predict(X_test_s)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    r2 = float(r2_score(y_test, y_pred))
    metrics = {'rmse': rmse, 'r2': r2, 'n_train': len(X_train), 'features': available_features}
    logger.info(f"XGBoost trained: RMSE={rmse:.4f}, R²={r2:.4f}")

    bundle = {'model': model, 'scaler': scaler, 'features': available_features,
              'feature_medians': dict(zip(available_features, subset[available_features].median().values))}
    model_path = _get_model_path()
    with open(model_path, 'wb') as f:
        pickle.dump(bundle, f)
    logger.info(f"Model saved to {model_path}")
    return bundle, metrics


def predict_poverty_scores(bundle, df: pd.DataFrame) -> pd.Series:
    """Predict poverty scores for all LGAs using trained model."""
    if bundle is None:
        return pd.Series(dtype=float)
    model = bundle['model']
    scaler = bundle['scaler']
    features = bundle['features']
    available = [c for c in features if c in df.columns]
    if not available:
        return pd.Series(dtype=float)
    X = df[available].fillna(df[available].median()).values
    if len(available) < len(features):
        # Pad missing features with training-time medians instead of zeros
        medians = bundle.get('feature_medians', {})
        missing = [f for f in features if f not in available]
        pad_cols = np.array([[medians.get(f, 0.0)] * X.shape[0] for f in missing]).T
        X = np.hstack([X, pad_cols])
    X_s = scaler.transform(X)
    preds = model.predict(X_s)
    return pd.Series(preds, index=df.index)


def get_shap_explanations(bundle, df: pd.DataFrame) -> Optional[pd.DataFrame]:
    """Return per-LGA SHAP values for feature importance."""
    if bundle is None:
        return None
    try:
        import shap
    except ImportError:
        logger.warning("shap not available; skipping SHAP explanations")
        return None
    model = bundle['model']
    scaler = bundle['scaler']
    features = bundle['features']
    available = [c for c in features if c in df.columns]
    if not available:
        return None
    X = df[available].fillna(df[available].median()).values
    X_s = scaler.transform(X)
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_s)
    shap_df = pd.DataFrame(shap_values, columns=available, index=df.index)
    return shap_df


def load_or_train_model(df: pd.DataFrame) -> Tuple[object, dict]:
    """Load saved model if available, otherwise train a new one."""
    model_path = _get_model_path()
    if model_path.exists():
        try:
            with open(model_path, 'rb') as f:
                bundle = pickle.load(f)
            logger.info(f"Loaded existing XGBoost model from {model_path}")
            return bundle, {}
        except Exception as e:
            logger.warning(f"Failed to load saved model: {e}; retraining")
    return train_dynamic_model(df)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # Quick self-test with synthetic data
    np.random.seed(42)
    n = 200
    test_df = pd.DataFrame({
        'mean_nightlight_intensity': np.random.exponential(5, n),
        'ndvi_mean': np.random.uniform(0.1, 0.8, n),
        'rainfall_mm': np.random.uniform(200, 1200, n),
        'health_facility_count': np.random.poisson(3, n).astype(float),
        'school_count': np.random.poisson(5, n).astype(float),
        'road_density_km': np.random.uniform(0, 50, n),
        'population_density': np.random.exponential(200, n),
        'food_price_index': np.random.uniform(80, 150, n),
        'idp_count': np.random.poisson(100, n).astype(float),
        'MPI': np.random.uniform(0.1, 0.9, n),
    })
    bundle, metrics = train_dynamic_model(test_df)
    print("Metrics:", metrics)
    if bundle:
        scores = predict_poverty_scores(bundle, test_df)
        print("Score range:", scores.min(), "–", scores.max())
