"""Convert the generated SVG to PNG using CairoSVG.
Usage: python scripts/convert_svg_to_png.py
"""
import os
import sys

SVG = os.path.join("results", "perf", "cache_stats.svg")
PNG = os.path.join("results", "perf", "cache_stats.png")

def main():
    try:
        import cairosvg
    except Exception as e:
        print("cairosvg is not available:", e)
        sys.exit(2)

    if not os.path.exists(SVG):
        print("SVG not found:", SVG)
        sys.exit(3)

    try:
        cairosvg.svg2png(url=SVG, write_to=PNG)
        print("Wrote PNG:", PNG)
    except Exception as e:
        print("Conversion failed:", e)
        sys.exit(1)

if __name__ == '__main__':
    main()
