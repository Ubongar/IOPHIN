#!/usr/bin/env python3
"""
Benchmark ML retraining compute duration for IOPHIN.

This script measures the model-building path (KNN/PCA/HDBSCAN-or-KMeans)
without database upsert overhead, so results focus on computational cost.
"""

from __future__ import annotations

import argparse
import csv
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from src.model_engine import build_analytical_model


def _pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = max(0, min(len(ordered) - 1, int(round((p / 100.0) * (len(ordered) - 1)))))
    return ordered[idx]


def _load_input_df(input_csv: Path) -> pd.DataFrame:
    if not input_csv.exists():
        raise FileNotFoundError(f"Input CSV not found: {input_csv}")
    df = pd.read_csv(input_csv)
    if df.empty:
        raise ValueError(f"Input CSV is empty: {input_csv}")
    return df


def run_benchmark(iterations: int, warmup: int, out_csv: Path, input_csv: Path) -> dict:
    source_df = _load_input_df(input_csv)

    if warmup > 0:
        print(f"Running warmup cycles: {warmup}")
        for i in range(warmup):
            t0 = time.perf_counter()
            build_analytical_model(source_df.copy(), use_pca=True)
            t1 = time.perf_counter()
            print(f"  Warmup {i + 1}/{warmup}: {t1 - t0:.3f}s")

    durations: list[float] = []
    rows: list[dict] = []

    print(f"Running measured cycles: {iterations}")
    for i in range(iterations):
        started_at = datetime.now(timezone.utc).isoformat()
        t0 = time.perf_counter()
        build_analytical_model(source_df.copy(), use_pca=True)
        t1 = time.perf_counter()
        elapsed = t1 - t0
        durations.append(elapsed)
        rows.append(
            {
                "run": i + 1,
                "started_at_utc": started_at,
                "duration_seconds": f"{elapsed:.6f}",
            }
        )
        print(f"  Run {i + 1}/{iterations}: {elapsed:.3f}s")

    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with out_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["run", "started_at_utc", "duration_seconds"])
        writer.writeheader()
        writer.writerows(rows)

    summary = {
        "iterations": iterations,
        "input_rows": len(source_df),
        "avg": statistics.mean(durations) if durations else 0.0,
        "min": min(durations) if durations else 0.0,
        "max": max(durations) if durations else 0.0,
        "p50": _pct(durations, 50),
        "p95": _pct(durations, 95),
        "csv": str(out_csv),
    }
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark IOPHIN ML retraining compute runtime")
    parser.add_argument("--iterations", type=int, default=10, help="Measured retrain runs")
    parser.add_argument("--warmup", type=int, default=2, help="Warmup retrain runs")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("results/perf/retrain_runs.csv"),
        help="Output CSV path",
    )
    parser.add_argument(
        "--input-csv",
        type=Path,
        default=Path("data/processed/final_model_output.csv"),
        help="Input dataset CSV for retraining compute benchmark",
    )
    args = parser.parse_args()

    summary = run_benchmark(args.iterations, args.warmup, args.out, args.input_csv)

    print("\n=== Retrain Performance Summary ===")
    print(f"Iterations: {summary['iterations']}")
    print(f"Input rows:  {summary['input_rows']}")
    print(f"Average:    {summary['avg']:.3f}s")
    print(f"Min:        {summary['min']:.3f}s")
    print(f"Max:        {summary['max']:.3f}s")
    print(f"P50:        {summary['p50']:.3f}s")
    print(f"P95:        {summary['p95']:.3f}s")
    print(f"CSV:        {summary['csv']}")


if __name__ == "__main__":
    main()
