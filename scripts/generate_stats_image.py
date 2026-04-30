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

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    USE_MATPLOTLIB = True
except Exception:
    USE_MATPLOTLIB = False
    HAVE_PIL = False
    try:
        from PIL import Image, ImageDraw, ImageFont
        HAVE_PIL = True
    except Exception:
        HAVE_PIL = False

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

    os.makedirs(os.path.dirname(outpath) or '.', exist_ok=True)

    if USE_MATPLOTLIB:
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
        fig.savefig(outpath, dpi=150)
        print(f'Wrote chart to: {outpath}')
    else:
        if HAVE_PIL:
            # Fallback: create a simple text image using Pillow
            text_lines = ["Cache vs DB Response Times"]
            for e, f_ms, c_ms in zip(endpoints, first, cached):
                speed = f_ms / c_ms if c_ms and c_ms > 0 else 0
                text_lines.append(f"{e.capitalize()}: first={f_ms:.0f}ms, cached={c_ms:.0f}ms, {speed:.1f}x")

            # Image sizing
            width = 800
            line_height = 24
            height = line_height * (len(text_lines) + 2)
            img = Image.new('RGB', (width, height), color='white')
            draw = ImageDraw.Draw(img)
            try:
                font = ImageFont.truetype('arial.ttf', 14)
            except Exception:
                font = ImageFont.load_default()

            y = 10
            for line in text_lines:
                draw.text((10, y), line, fill='black', font=font)
                y += line_height

            img.save(outpath)
            print(f'Wrote fallback text image to: {outpath}')
        else:
            # Final fallback: write a simple SVG
            svg_lines = [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200">',
                '<rect width="100%" height="100%" fill="white"/>',
                '<g font-family="Arial, Helvetica, sans-serif" font-size="14" fill="black">',
                '<text x="10" y="24">Cache vs DB Response Times</text>'
            ]
            y = 48
            for e, f_ms, c_ms in zip(endpoints, first, cached):
                speed = f_ms / c_ms if c_ms and c_ms > 0 else 0
                svg_lines.append(f'<text x="10" y="{y}">{e.capitalize()}: first={f_ms:.0f}ms, cached={c_ms:.0f}ms, {speed:.1f}x</text>')
                y += 24
            svg_lines.append('</g>')
            svg_lines.append('</svg>')
            with open(outpath, 'w', encoding='utf-8') as f:
                f.write('\n'.join(svg_lines))
            print(f'Wrote fallback SVG to: {outpath}')


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
