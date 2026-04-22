#!/usr/bin/env python3
"""Color-grade Jefferson Option 2 for the IG timeline hero frame.

Matt brief: "Apply filters/color grading to make it really pop on the Instagram
timeline. Think vibrant, eye-catching — the kind of image that stops the scroll.
Boost the colors, add some contrast, make that mountain look dramatic. This is
the first thing people see on his grid."

Approach (conservative, reversible):
  - Mild shadow lift so the lower peak silhouette doesn't disappear on small
    phone screens.
  - Contrast boost via S-curve tone map.
  - Saturation +30% (richer alpenglow oranges, deeper sky navy).
  - Subtle warm split-tone: shadows cooler (teal bias), highlights warmer
    (amber bias) — the cinematic real-estate-reel look.
  - Light clarity pass via unsharp mask (mid-frequency contrast).
  - Final vignette to draw the eye toward the double-summit alpenglow.

Output the graded hero at 1080x1920 (IG Reels / Story) and 1080x1350 (IG feed
portrait 4:5) so the same frame works as video opener AND as the static feed
thumbnail. No crops: center-fill with blurred-fill bars.
"""

from pathlib import Path
import sys

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageChops

SRC = Path("/sessions/stoic-sweet-dirac/mnt/RyanRealty/peak_options/jefferson_unsplash_2.jpg")
OUT_DIR = Path("/sessions/stoic-sweet-dirac/mnt/RyanRealty/peak_options/graded")
OUT_DIR.mkdir(exist_ok=True)


def s_curve(img: Image.Image, strength: float = 0.35) -> Image.Image:
    """Apply an S-curve to boost midtone contrast without crushing blacks or
    blowing highlights. `strength` in roughly [0, 1]."""
    lut = []
    for i in range(256):
        x = i / 255.0
        # Smooth s-curve: 3x^2 - 2x^3 blended with linear.
        s = 3 * x * x - 2 * x * x * x
        y = x * (1 - strength) + s * strength
        lut.append(int(max(0, min(255, round(y * 255)))))
    # Apply the same LUT per channel.
    return img.point(lut * 3 if img.mode == "RGB" else lut)


def split_tone(img: Image.Image, shadow_color=(24, 46, 70), highlight_color=(255, 198, 140), shadow_mix=0.18, hi_mix=0.22) -> Image.Image:
    """Split-tone: tint shadows cooler, highlights warmer. Uses a luminance
    mask to decide how strongly each pixel leans toward shadow/highlight tint."""
    rgb = img.convert("RGB")
    # Per-pixel luminance using Rec. 709 weights, packed as an L image.
    lum = rgb.convert("L")
    # Highlight mask: luminance squared to bias toward bright areas.
    hi_mask = lum.point(lambda v: int((v / 255) ** 2 * 255))
    # Shadow mask: inverted luminance squared.
    sh_mask = lum.point(lambda v: int(((255 - v) / 255) ** 2 * 255))

    shadow_layer = Image.new("RGB", rgb.size, shadow_color)
    hi_layer = Image.new("RGB", rgb.size, highlight_color)

    # Composite cool shadows.
    cooled = Image.composite(
        Image.blend(rgb, shadow_layer, shadow_mix),
        rgb,
        sh_mask,
    )
    # Composite warm highlights on top.
    warmed = Image.composite(
        Image.blend(cooled, hi_layer, hi_mix),
        cooled,
        hi_mask,
    )
    return warmed


def vignette(img: Image.Image, strength: float = 0.35) -> Image.Image:
    """Radial darken toward the corners using a gaussian-blurred circle mask."""
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    # Draw a bright ellipse centered — dark edges.
    from PIL import ImageDraw
    d = ImageDraw.Draw(mask)
    # Ellipse sized to extend slightly beyond corners to avoid sharp falloff.
    inset_x = int(-w * 0.08)
    inset_y = int(-h * 0.08)
    d.ellipse((inset_x, inset_y, w - inset_x, h - inset_y), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=min(w, h) * 0.25))
    dark = Image.new("RGB", img.size, (0, 0, 0))
    return Image.composite(img, dark, mask.point(lambda v: int(v * (1 - strength) + 255 * (1 - strength) * 0)))


def vignette_v2(img: Image.Image, strength: float = 0.35) -> Image.Image:
    """Cleaner vignette: darken linearly by (1 - mask * strength)."""
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    from PIL import ImageDraw
    d = ImageDraw.Draw(mask)
    inset_x = int(-w * 0.10)
    inset_y = int(-h * 0.10)
    d.ellipse((inset_x, inset_y, w - inset_x, h - inset_y), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=min(w, h) * 0.28))
    # Scale mask so center = 1.0 brightness, edges = (1 - strength).
    scaled = mask.point(lambda v: int((1 - strength) * 255 + v * strength))
    rgb = img.convert("RGB")
    darkened = ImageChops.multiply(rgb, Image.merge("RGB", (scaled, scaled, scaled)))
    return darkened


def grade(src_path: Path) -> Image.Image:
    img = Image.open(src_path).convert("RGB")

    # 1. Mild shadow lift (gamma on darks only).
    lift_lut = []
    for i in range(256):
        x = i / 255.0
        # Below 0.35 luminance, apply a gentle gamma lift (0.88).
        if x < 0.4:
            blend = (0.4 - x) / 0.4  # weight 1.0 at 0, 0 at 0.4
            lifted = x ** 0.85
            y = x * (1 - blend * 0.55) + lifted * (blend * 0.55)
        else:
            y = x
        lift_lut.append(int(max(0, min(255, round(y * 255)))))
    img = img.point(lift_lut * 3)

    # 2. S-curve contrast.
    img = s_curve(img, strength=0.30)

    # 3. Saturation boost (+30%).
    img = ImageEnhance.Color(img).enhance(1.30)

    # 4. Split-tone.
    img = split_tone(img, shadow_color=(22, 44, 72), highlight_color=(255, 196, 138), shadow_mix=0.15, hi_mix=0.22)

    # 5. Mid-frequency clarity (unsharp mask tuned for structure, not grain).
    img = img.filter(ImageFilter.UnsharpMask(radius=3.2, percent=55, threshold=3))

    # 6. Subtle global contrast bump on the final graded image.
    img = ImageEnhance.Contrast(img).enhance(1.06)

    # 7. Vignette.
    img = vignette_v2(img, strength=0.28)

    return img


def fit_with_blurred_fill(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Fit `img` inside target WxH without cropping; fill bars with blurred
    stretched copy of the original (common IG Reels move)."""
    sw, sh = img.size
    target_ratio = target_w / target_h
    src_ratio = sw / sh

    # Base: blurred fill canvas.
    fill = img.copy().resize((target_w, target_h), Image.LANCZOS)
    fill = fill.filter(ImageFilter.GaussianBlur(radius=55))
    fill = ImageEnhance.Brightness(fill).enhance(0.6)
    fill = ImageEnhance.Color(fill).enhance(1.15)

    # Fit main image into target preserving aspect.
    if src_ratio > target_ratio:
        # Source wider: fit width, pillarbox vertically.
        new_w = target_w
        new_h = int(round(target_w / src_ratio))
    else:
        new_h = target_h
        new_w = int(round(target_h * src_ratio))
    main = img.resize((new_w, new_h), Image.LANCZOS)
    x = (target_w - new_w) // 2
    y = (target_h - new_h) // 2
    fill.paste(main, (x, y))
    return fill


def main() -> int:
    if not SRC.exists():
        print(f"missing source: {SRC}", file=sys.stderr)
        return 2

    graded = grade(SRC)

    # Save the 1:1 graded version at original resolution for re-use.
    native = OUT_DIR / "jefferson_opener_graded.jpg"
    graded.save(native, quality=94, subsampling=1, optimize=True, progressive=True)
    print(f"wrote {native} ({graded.size[0]}x{graded.size[1]})")

    # IG Reels / Story / TikTok — 1080x1920 portrait.
    reels = fit_with_blurred_fill(graded, 1080, 1920)
    reels_path = OUT_DIR / "jefferson_opener_1080x1920.jpg"
    reels.save(reels_path, quality=92, subsampling=1, optimize=True, progressive=True)
    print(f"wrote {reels_path} (1080x1920)")

    # IG feed portrait — 1080x1350.
    feed = fit_with_blurred_fill(graded, 1080, 1350)
    feed_path = OUT_DIR / "jefferson_opener_1080x1350.jpg"
    feed.save(feed_path, quality=92, subsampling=1, optimize=True, progressive=True)
    print(f"wrote {feed_path} (1080x1350)")

    # Grid thumbnail — 1080x1080 square crop from center.
    cw = min(graded.size)
    left = (graded.size[0] - cw) // 2
    top = (graded.size[1] - cw) // 2
    sq = graded.crop((left, top, left + cw, top + cw)).resize((1080, 1080), Image.LANCZOS)
    sq_path = OUT_DIR / "jefferson_opener_1080x1080.jpg"
    sq.save(sq_path, quality=92, subsampling=1, optimize=True, progressive=True)
    print(f"wrote {sq_path} (1080x1080)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
