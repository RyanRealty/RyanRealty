#!/usr/bin/env python3
"""Generate grayscale mask PNGs for cinemagraph regions in v5.3.

Output: 1080x1920 PNG masks under public/images/v5_library/masks/.
White (255) = motion shows through; black (0) = static base shows.

Each mask is built with a soft gradient transition so the cinemagraph
edge is invisible.
"""
import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    print("PIL not available. Run: pip install --user Pillow", file=sys.stderr)
    sys.exit(1)

W, H = 1080, 1920
OUT = Path(__file__).resolve().parent.parent / "public" / "images" / "v5_library" / "masks"
OUT.mkdir(parents=True, exist_ok=True)


def smooth(mask: Image.Image, radius: int = 24) -> Image.Image:
    return mask.filter(ImageFilter.GaussianBlur(radius=radius))


def horizontal_band(top_pct: float, bottom_pct: float, peak_pct: float = None,
                     fade: int = 80, blur: int = 28) -> Image.Image:
    """White band between top_pct and bottom_pct of frame height, gradient at edges."""
    img = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(img)
    top_y = int(top_pct * H)
    bot_y = int(bottom_pct * H)
    # Full white between top_y+fade and bot_y-fade, gradient on the edges
    for y in range(top_y, bot_y):
        if y < top_y + fade:
            v = int(255 * ((y - top_y) / fade))
        elif y > bot_y - fade:
            v = int(255 * ((bot_y - y) / fade))
        else:
            v = 255
        draw.line([(0, y), (W, y)], fill=v)
    return smooth(img, radius=blur)


def vertical_band(left_pct: float, right_pct: float, fade: int = 60,
                  top_pct: float = 0.0, bottom_pct: float = 1.0,
                  blur: int = 24) -> Image.Image:
    """White vertical band, used for fireplace on right side."""
    img = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(img)
    lx = int(left_pct * W)
    rx = int(right_pct * W)
    ty = int(top_pct * H)
    by = int(bottom_pct * H)
    for x in range(lx, rx):
        if x < lx + fade:
            v = int(255 * ((x - lx) / fade))
        elif x > rx - fade:
            v = int(255 * ((rx - x) / fade))
        else:
            v = 255
        draw.line([(x, ty), (x, by)], fill=v)
    return smooth(img, radius=blur)


def ellipse_region(cx_pct: float, cy_pct: float, rx_pct: float, ry_pct: float,
                   blur: int = 36) -> Image.Image:
    """White ellipse for localized motion (fireplace, pond surface)."""
    img = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(img)
    cx = cx_pct * W
    cy = cy_pct * H
    rx = rx_pct * W
    ry = ry_pct * H
    draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    return smooth(img, radius=blur)


def main() -> int:
    masks = {
        # Bottom ~55% = water under footbridge. Strong band; soft edge fades into the bridge structure.
        "mask_footbridge_water.png": horizontal_band(0.45, 1.0, fade=140, blur=42),

        # Middle horizontal band where the Little Deschutes runs (kids' transcribed: river surface).
        # Visually: river runs roughly 35–60% from top in this photo.
        "mask_elk_river.png": horizontal_band(0.32, 0.62, fade=110, blur=36),

        # Top ~30% sky region above the barn.
        "mask_barn_sky.png": horizontal_band(0.0, 0.32, fade=120, blur=42),

        # Sky region through the window on #11. Sky is in the upper ~32% of frame.
        # Mountain is roughly 22–35% from top (mountain stays static if mask cuts above).
        # Use top 0–24% so only sky drifts, mountain doesn't.
        "mask_window_sky.png": horizontal_band(0.0, 0.24, fade=90, blur=36),

        # Fireplace on the RIGHT side of #52 fire patio. Right ~28% of frame width,
        # vertically centered in the middle band where the fire is.
        "mask_fire_patio.png": ellipse_region(0.84, 0.56, 0.20, 0.32, blur=40),
    }

    for name, mask in masks.items():
        path = OUT / name
        mask.save(path, "PNG", optimize=True)
        print(f"wrote {path} ({mask.size[0]}x{mask.size[1]})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
