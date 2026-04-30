#!/usr/bin/env python3
"""Generate a PNG summarizing cache vs. DB timings.

Usage:
  python scripts/generate_stats_image.py --input results/perf/redis_cache_test.json --output results/perf/cache_stats.png

If the input JSON is missing, the script will use embedded sample data.
"""
import argparse
import json
import os
import math

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

SAMPLE = {
    "stats": {"first_ms": 66.28, "cached_ms": 9.52},
    "rankings": {"first_ms": 39.11, "cached_ms": 15.94},
    "hotspots": {"first_ms": 805.39, "cached_ms": 568.00}
}


def load_metrics(path):
    if not path or not os.path.exists(path):
        return SAMPLE
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # Expect structure like {"stats": {"first_ms":.., "cached_ms":..}, ...}
    return data


def make_chart(metrics, outpath):
    endpoints = list(metrics.keys())
    first = [metrics[e].get('first_ms', 0) for e in endpoints]
    cached = [metrics[e].get('cached_ms', 0) for e in endpoints]

    x = range(len(endpoints))
    width = 0.35

    fig, ax = plt.subplots(figsize=(9,5))
    bars1 = ax.bar([i - width/2 for i in x], first, width, label='First call (DB)')
    bars2 = ax.bar([i + width/2 for i in x], cached, width, label='Cached (Redis)')

    ax.set_ylabel('Response time (ms)')
    ax.set_title('Cache vs DB Response Times')
    ax.set_xticks(list(x))
    ax.set_xticklabels([e.capitalize() for e in endpoints])
    ax.legend()

    # Annotate bars and show speedup
    for i, (b1, b2) in enumerate(zip(bars1, bars2)):
        h1 = b1.get_height()
        h2 = b2.get_height()
        ax.annotate(f'{h1:.0f} ms', xy=(b1.get_x()+b1.get_width()/2, h1), xytext=(0,3), textcoords='offset points', ha='center', va='bottom', fontsize=8)
        ax.annotate(f'{h2:.0f} ms', xy=(b2.get_x()+b2.get_width()/2, h2), xytext=(0,3), textcoords='offset points', ha='center', va='bottom', fontsize=8)
        if h2 > 0 and h1 > 0:
            speedup = h1 / h2
            ax.annotate(f'{speedup:.1f}x', xy=(i, max(h1,h2)*1.05), ha='center', fontsize=9, color='green')

    plt.tight_layout()
    os.makedirs(os.path.dirname(outpath) or '.', exist_ok=True)
    fig.savefig(outpath, dpi=150)
    print(f'Wrote chart to: {outpath}')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--input', '-i', help='Input JSON results file', default='results/perf/redis_cache_test.json')
    p.add_argument('--output', '-o', help='Output PNG path', default='results/perf/cache_stats.png')
    args = p.parse_args()

    metrics = load_metrics(args.input)
    # normalize keys to expected names if possible
    expected_keys = ['stats', 'rankings', 'hotspots']
    use = {k: metrics.get(k, SAMPLE[k]) for k in expected_keys}

    make_chart(use, args.output)


if __name__ == '__main__':
    main()
