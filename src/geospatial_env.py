"""
Geospatial runtime environment bootstrap utilities.
Ensures PROJ and GDAL data paths resolve to the active Python environment.
"""
import os
import sys
import logging
import importlib.util
from pathlib import Path


logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())


def _find_package_dir(package_name: str) -> Path | None:
    spec = importlib.util.find_spec(package_name)
    if spec is None or spec.origin is None:
        return None
    return Path(spec.origin).parent


def _candidate_proj_paths() -> list[Path]:
    """Return PROJ data directories ordered by likely compatibility.

    Rasterio bundles a newer proj.db (VERSION_MINOR >= 6) that is
    compatible with its own PROJ library, so it is preferred over the
    older proj.db shipped with pyproj.
    """
    candidates: list[Path] = []

    # Prefer rasterio's proj_data — its proj.db matches the PROJ
    # library that rasterio itself links against.
    rasterio_dir = _find_package_dir("rasterio")
    if rasterio_dir:
        candidates.append(rasterio_dir / "proj_data")

    # pyproj as fallback
    pyproj_dir = _find_package_dir("pyproj")
    if pyproj_dir:
        candidates.append(pyproj_dir / "proj_dir" / "share" / "proj")

    candidates.extend(
        [
            Path(sys.prefix) / "Library" / "share" / "proj",
            Path(sys.prefix) / "share" / "proj",
        ]
    )
    return candidates


def _candidate_gdal_paths() -> list[Path]:
    candidates: list[Path] = []
    rasterio_dir = _find_package_dir("rasterio")
    if rasterio_dir:
        candidates.append(rasterio_dir / "gdal_data")

    candidates.extend(
        [
            Path(sys.prefix) / "Library" / "share" / "gdal",
            Path(sys.prefix) / "share" / "gdal",
        ]
    )
    return candidates


def _select_existing_path(paths: list[Path]) -> str | None:
    for path in paths:
        if path.exists() and path.is_dir():
            return str(path)
    return None


def _is_bad_proj_path(value: str | None) -> bool:
    if not value:
        return True
    lowered = value.lower()
    return "postgresql" in lowered and "postgis" in lowered


def _is_bad_gdal_path(value: str | None) -> bool:
    if not value:
        return True
    lowered = value.lower()
    return "postgresql" in lowered


def configure_geospatial_env() -> None:
    current_proj = os.environ.get("PROJ_LIB")
    current_gdal = os.environ.get("GDAL_DATA")

    selected_proj = _select_existing_path(_candidate_proj_paths())
    selected_gdal = _select_existing_path(_candidate_gdal_paths())

    if selected_proj and (_is_bad_proj_path(current_proj) or not current_proj):
        os.environ["PROJ_LIB"] = selected_proj
        logger.info(f"Configured PROJ_LIB={selected_proj}")

    if selected_gdal and (_is_bad_gdal_path(current_gdal) or not current_gdal):
        os.environ["GDAL_DATA"] = selected_gdal
        logger.info(f"Configured GDAL_DATA={selected_gdal}")
