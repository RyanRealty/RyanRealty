#!/usr/bin/env python3
"""
Pattern D — Panorama-across-slides IG post
==========================================
Take a wide aerial of 19496 Tumalo Reservoir Rd, slice it into 3 portrait tiles
(1080×1350 each) that flow seamlessly when swiped across an IG carousel.

When the viewer swipes through slides 1→2→3, the panorama extends as
a single continuous image — the Cascade horizon stretching across all three.

Output:
  /Users/matthewryan/RyanRealty/out/list-kits/19496-tumalo-reservoir/v3/pattern-d/
    panorama-1.jpg
    panorama-2.jpg
    panorama-3.jpg

Source: AERIAL_DUSK_1.jpg (dusk aerial with Cascade horizon)
"""

from PIL import Image, ImageEnhance
from pathlib import Path

SRC = Path("/tmp/tumalo-src/AERIAL_DUSK_1.jpg")
OUT = Path("/Users/matthewryan/RyanRealty/out/list-kits/19496-tumalo-reservoir/v3/pattern-d")
OUT.mkdir(parents=True, exist_ok=True)

TILE_W, TILE_H = 1080, 1350
N_TILES = 3
TOTAL_W = TILE_W * N_TILES  # 3240
TARGET_ASPECT = TOTAL_W / TILE_H  # 2.4

def gentle_polish(img: Image.Image) -> Image.Image:
    """Very subtle color polish so the panorama reads on a phone."""
    img = ImageEnhance.Color(img).enhance(1.04)
    img = ImageEnhance.Contrast(img).enhance(1.04)
    img = ImageEnhance.Brightness(img).enhance(1.01)
    return img


def build_panorama():
    print(f"Source: {SRC}")
    src = Image.open(SRC).convert("RGB")
    print(f"  size: {src.size}, aspect: {src.size[0] / src.size[1]:.3f}")

    # Crop source to TARGET_ASPECT (2.4:1) centered vertically
    src_w, src_h = src.size
    crop_h = int(src_w / TARGET_ASPECT)  # 2048 / 2.4 = 853
    if crop_h > src_h:
        # Source isn't tall enough — crop width instead (rare)
        crop_w = int(src_h * TARGET_ASPECT)
        x0 = (src_w - crop_w) // 2
        cropped = src.crop((x0, 0, x0 + crop_w, src_h))
    else:
        # Center-crop vertically — keeps the property + horizon centered
        # but shift slightly downward to keep more sky+mountain (the panorama story)
        y0 = max(0, (src_h - crop_h) // 2 - 60)
        cropped = src.crop((0, y0, src_w, y0 + crop_h))
    print(f"  cropped to: {cropped.size}, aspect: {cropped.size[0] / cropped.size[1]:.3f}")

    # Resize to full panorama dimensions (3240×1350)
    panorama = cropped.resize((TOTAL_W, TILE_H), Image.LANCZOS)
    panorama = gentle_polish(panorama)
    print(f"  panorama resized to: {panorama.size}")

    # Slice into 3 tiles
    for i in range(N_TILES):
        x0 = i * TILE_W
        tile = panorama.crop((x0, 0, x0 + TILE_W, TILE_H))
        dst = OUT / f"panorama-{i + 1}.jpg"
        tile.save(dst, "JPEG", quality=92, optimize=True)
        kb = dst.stat().st_size / 1024
        print(f"  panorama-{i + 1}.jpg ({tile.size})  →  {kb:.0f} KB")

    # Also save the full preview at half-size for the state page reference
    preview = panorama.resize((TOTAL_W // 2, TILE_H // 2), Image.LANCZOS)
    preview.save(OUT / "panorama-full-preview.jpg", "JPEG", quality=88)
    print(f"  panorama-full-preview.jpg ({preview.size})  →  preview")


if __name__ == "__main__":
    build_panorama()
    print(f"\nDone. Output → {OUT}")
