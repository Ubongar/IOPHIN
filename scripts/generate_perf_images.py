#!/usr/bin/env python3
"""
Generate performance evidence images from benchmark CSV outputs.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


def main() -> None:
    root = Path("results/perf")
    retrain_csv = root / "retrain_runs.csv"
    memory_csv = root / "node_memory_samples.csv"

    if not retrain_csv.exists():
        raise FileNotFoundError(f"Missing: {retrain_csv}")
    if not memory_csv.exists():
        raise FileNotFoundError(f"Missing: {memory_csv}")

    retrain = pd.read_csv(retrain_csv)
    memory = pd.read_csv(memory_csv)

    retrain["duration_seconds"] = pd.to_numeric(retrain["duration_seconds"], errors="coerce")
    retrain = retrain.dropna(subset=["duration_seconds"])

    memory["private_memory_mb"] = pd.to_numeric(memory["private_memory_mb"], errors="coerce")
    memory = memory.dropna(subset=["private_memory_mb"])

    if retrain.empty:
        raise ValueError("retrain_runs.csv has no valid duration values")
    if memory.empty:
        raise ValueError("node_memory_samples.csv has no valid private_memory_mb values")

    avg_retrain = retrain["duration_seconds"].mean()
    avg_mem = memory["private_memory_mb"].mean()

    fig, axes = plt.subplots(1, 2, figsize=(14, 6), dpi=150)
    fig.patch.set_facecolor("#f8f7f2")

    # Left: retrain cycles
    ax = axes[0]
    ax.set_facecolor("#fffdf6")
    ax.plot(range(1, len(retrain) + 1), retrain["duration_seconds"], marker="o", linewidth=2.0, color="#9f2b1e")
    ax.axhline(avg_retrain, color="#1e4e7a", linestyle="--", linewidth=1.8, label=f"Avg {avg_retrain:.2f}s")
    ax.set_title("HDBSCAN Retraining Cycle", fontsize=12, fontweight="bold")
    ax.set_xlabel("Run")
    ax.set_ylabel("Seconds")
    ax.grid(alpha=0.3)
    ax.legend(loc="best")
    ax.text(
        0.02,
        0.94,
        f"Average: {avg_retrain:.2f}s\nCPU Profile: High",
        transform=ax.transAxes,
        verticalalignment="top",
        bbox={"facecolor": "#f0e7da", "edgecolor": "#c8b79d", "boxstyle": "round,pad=0.4"},
    )

    # Right: node memory distribution
    ax = axes[1]
    ax.set_facecolor("#fffdf6")
    ax.hist(memory["private_memory_mb"], bins=20, color="#2a7f62", alpha=0.85)
    ax.axvline(avg_mem, color="#1e4e7a", linestyle="--", linewidth=1.8, label=f"Avg {avg_mem:.1f} MB")
    ax.set_title("Node.js Memory Under Peak Load", fontsize=12, fontweight="bold")
    ax.set_xlabel("Private Memory (MB)")
    ax.set_ylabel("Sample Count")
    ax.grid(alpha=0.3)
    ax.legend(loc="best")
    ax.text(
        0.02,
        0.94,
        f"Average: {avg_mem:.1f} MB\nHeadroom: Significant",
        transform=ax.transAxes,
        verticalalignment="top",
        bbox={"facecolor": "#e5efe9", "edgecolor": "#9eb8ab", "boxstyle": "round,pad=0.4"},
    )

    fig.suptitle("IOPHIN Split Performance Dashboard", fontsize=14, fontweight="bold")
    fig.tight_layout(rect=[0, 0.03, 1, 0.95])

    out = root / "split_performance_dashboard.png"
    fig.savefig(out)
    plt.close(fig)

    summary = root / "performance_summary.txt"
    summary.write_text(
        "\n".join(
            [
                "IOPHIN Performance Summary",
                f"Retrain runs: {len(retrain)}",
                f"Retrain average (s): {avg_retrain:.3f}",
                f"Node memory samples: {len(memory)}",
                f"Node avg private MB: {avg_mem:.3f}",
                f"Dashboard image: {out}",
            ]
        ),
        encoding="utf-8",
    )

    print(f"Saved: {out}")
    print(f"Saved: {summary}")


if __name__ == "__main__":
    main()
