"""
Nigeria Poverty Hotspot Identifier System - Analytical Engine
"""
import importlib

__version__ = "1.0.0"

__all__ = [
    "config",
    "data_loader",
    "feature_extraction",
    "model_engine",
    "__version__",
]

def __getattr__(name):
    """
    Lazily import heavy submodules on first access to keep package import lightweight.
    """
    if name in {"config", "data_loader", "feature_extraction", "model_engine"}:
        module = importlib.import_module(f"{__name__}.{name}")
        globals()[name] = module
        return module
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
