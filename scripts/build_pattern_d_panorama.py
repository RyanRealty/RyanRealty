#!/usr/bin/env python3
"""
Pattern D — Panorama-across-slides IG post (parameterized)
==========================================================
Generalized version of build_tumalo_panorama_post.py — accepts source + output
paths so the same approved generator runs against any listing without rewriting
the layout logic.

Take a wide aerial, slice into 3 portrait tiles (1080×1350 each) that flow
seamlessly when swiped across an IG carousel.

Usage:
  python3 scripts/build_pattern_d_panorama.py <source-aerial.jpg> <output-dir>

Source ideally 2.4:1 or wider. If 4:3, center-crops vertically (some quality
loss). If <2.4:1 ratio and not tall enough, surfaces a warning.
"""

from PIL import Image, ImageEnhance
from pathlib import Path
import sys

TILE_W, TILE_H = 1080, 1350
N_TILES = 3
TOTAL_W = TILE_W * N_TILES  # 3240
TARGET_ASPECT = TOTAL_W / TILE_H  # 2.4


def gentle_polish(img: Image.Image) -> Image.Image:
    img = ImageEnhance.Color(img).enhance(1.04)
    img = ImageEnhance.Contrast(img).enhance(1.04)
    img = ImageEnhance.Brightness(img).enhance(1.01)
    return img


def build_panorama(src_path: Path, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"Source: {src_path}")
    src = Image.open(src_path).convert("RGB")
    print(f"  size: {src.size}, aspect: {src.size[0] / src.size[1]:.3f}")

    src_w, src_h = src.size
    src_aspect = src_w / src_h

    # Always crop top/bottom to extract a 2.4:1 horizontal strip at full source width.
    # We NEVER widen the source — that would pad with black bars.
    crop_h = int(src_w / TARGET_ASPECT)
    if crop_h > src_h:
        # Source is portrait or square — can't make a 2.4:1 strip at full width.
        # Crop width to make a 2.4:1 strip at full height instead (loses sides).
        crop_w = int(src_h * TARGET_ASPECT)
        if crop_w > src_w:
            print(f"  ✗ source too narrow AND too short for 2.4:1 panorama. Need at least {int(src_h * TARGET_ASPECT)}px wide OR {int(src_w / TARGET_ASPECT)}px tall.")
            sys.exit(3)
        x0 = (src_w - crop_w) // 2
        cropped = src.crop((x0, 0, x0 + crop_w, src_h))
    else:
        y0 = max(0, (src_h - crop_h) // 2 - 30)  # slight upward bias preserves sky/mountain
        cropped = src.crop((0, y0, src_w, y0 + crop_h))
    print(f"  cropped to: {cropped.size}, aspect: {cropped.size[0] / cropped.size[1]:.3f}")

    # Quality warning if heavy upscale required
    upscale_factor = TOTAL_W / cropped.size[0]
    if upscale_factor > 2.0:
        print(f"  ⚠ {upscale_factor:.1f}x upscale will soften detail — consider a wider source")

    panorama = cropped.resize((TOTAL_W, TILE_H), Image.LANCZOS)
    panorama = gentle_polish(panorama)
    print(f"  panorama resized to: {panorama.size}")

    for i in range(N_TILES):
        x0 = i * TILE_W
        tile = panorama.crop((x0, 0, x0 + TILE_W, TILE_H))
        dst = out_dir / f"panorama-{i + 1}.jpg"
        tile.save(dst, "JPEG", quality=92, optimize=True)
        kb = dst.stat().st_size / 1024
        print(f"  panorama-{i + 1}.jpg ({tile.size})  →  {kb:.0f} KB")

    preview = panorama.resize((TOTAL_W // 2, TILE_H // 2), Image.LANCZOS)
    preview.save(out_dir / "panorama-full-preview.jpg", "JPEG", quality=88)
    print(f"  panorama-full-preview.jpg ({preview.size})  →  preview")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("usage: build_pattern_d_panorama.py <source-aerial.jpg> <output-dir>")
        sys.exit(1)
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    if not src.exists():
        print(f"ERROR: source not found: {src}")
        sys.exit(2)
    build_panorama(src, dst)
    print(f"\nDone. Output → {dst}")
