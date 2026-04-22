#!/usr/bin/env python3
"""Color-grade Washington Option 1 for the closing card.

Lighter touch than the opener: Washington already has moody stormlight and a
dramatic silhouette. Goal is palette consistency with the Jefferson opener, not
another scroll-stopper on its own.

  - Minor shadow lift (keep the silhouette but rescue crushed blacks).
  - Gentler S-curve (strength 0.20 vs opener's 0.30).
  - Saturation +18% (vs +30% on opener).
  - Same split-tone (cool shadows, warm highlights) for palette match.
  - Clarity pass tuned lighter.
  - Subtle vignette.
"""

from pathlib import Path
import sys

# Reuse grading primitives from grade_opener.
sys.path.insert(0, "/sessions/stoic-sweet-dirac/work/cascade_peaks")
from grade_opener import s_curve, split_tone, vignette_v2, fit_with_blurred_fill
from PIL import Image, ImageEnhance, ImageFilter

SRC = Path("/sessions/stoic-sweet-dirac/mnt/RyanRealty/peak_options/washington_unsplash_1.jpg")
OUT_DIR = Path("/sessions/stoic-sweet-dirac/mnt/RyanRealty/peak_options/graded")
OUT_DIR.mkdir(exist_ok=True)


def grade(src: Path) -> Image.Image:
    img = Image.open(src).convert("RGB")

    # 1. Shadow lift — gentler than the opener.
    lift_lut = []
    for i in range(256):
        x = i / 255.0
        if x < 0.38:
            blend = (0.38 - x) / 0.38
            lifted = x ** 0.88
            y = x * (1 - blend * 0.42) + lifted * (blend * 0.42)
        else:
            y = x
        lift_lut.append(int(max(0, min(255, round(y * 255)))))
    img = img.point(lift_lut * 3)

    # 2. Gentle S-curve.
    img = s_curve(img, strength=0.20)

    # 3. Modest saturation boost.
    img = ImageEnhance.Color(img).enhance(1.18)

    # 4. Same split-tone as opener for palette match.
    img = split_tone(img, shadow_color=(22, 44, 72), highlight_color=(255, 196, 138), shadow_mix=0.14, hi_mix=0.18)

    # 5. Clarity.
    img = img.filter(ImageFilter.UnsharpMask(radius=2.8, percent=40, threshold=3))

    # 6. Mild global contrast.
    img = ImageEnhance.Contrast(img).enhance(1.04)

    # 7. Vignette.
    img = vignette_v2(img, strength=0.22)

    return img


def main() -> int:
    if not SRC.exists():
        print(f"missing: {SRC}", file=sys.stderr)
        return 2

    graded = grade(SRC)

    native = OUT_DIR / "washington_closer_graded.jpg"
    graded.save(native, quality=94, subsampling=1, optimize=True, progressive=True)
    print(f"wrote {native} ({graded.size[0]}x{graded.size[1]})")

    reels = fit_with_blurred_fill(graded, 1080, 1920)
    reels_path = OUT_DIR / "washington_closer_1080x1920.jpg"
    reels.save(reels_path, quality=92, subsampling=1, optimize=True, progressive=True)
    print(f"wrote {reels_path}")

    feed = fit_with_blurred_fill(graded, 1080, 1350)
    feed_path = OUT_DIR / "washington_closer_1080x1350.jpg"
    feed.save(feed_path, quality=92, subsampling=1, optimize=True, progressive=True)
    print(f"wrote {feed_path}")

    cw = min(graded.size)
    left = (graded.size[0] - cw) // 2
    top = (graded.size[1] - cw) // 2
    sq = graded.crop((left, top, left + cw, top + cw)).resize((1080, 1080), Image.LANCZOS)
    sq_path = OUT_DIR / "washington_closer_1080x1080.jpg"
    sq.save(sq_path, quality=92, subsampling=1, optimize=True, progressive=True)
    print(f"wrote {sq_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
