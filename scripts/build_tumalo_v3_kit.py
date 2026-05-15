#!/usr/bin/env python3
"""
Tumalo Listing Kit v3 — IG-First Build (brand-font edition)
============================================================
Pattern A: 10 unaltered (color-corrected) carousel photos, 1080x1350 portrait
Pattern B: 1 hero photo with Amboqia Boriango editorial headline overlay
Pattern C: 1 hero photo with Azo Sans Medium magazine caption + Ryan Realty mark

Fonts: design_system/ryan-realty/fonts/Amboqia_Boriango.otf (display serif)
       design_system/ryan-realty/fonts/AzoSans-Medium.ttf (accent sans)
Logo:  design_system/ryan-realty/assets/brand/logo-white.png

Output:
  /Users/matthewryan/RyanRealty/out/list-kits/19496-tumalo-reservoir/v3/
    pattern-a/01-hero.jpg ... 10-grounds.jpg
    pattern-b/hero-overlay.jpg     (Amboqia editorial headline)
    pattern-c/hero-magazine.jpg    (Azo Sans + brand mark)

Source: /tmp/tumalo-src/*.jpg  (14 photos at 2048x1366 from Spark CDN)
"""

from PIL import Image, ImageDraw, ImageFont, ImageEnhance
from pathlib import Path
import sys

SRC = Path("/tmp/tumalo-src")
OUT = Path("/Users/matthewryan/RyanRealty/out/list-kits/19496-tumalo-reservoir/v3")
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "pattern-a").mkdir(exist_ok=True)
(OUT / "pattern-b").mkdir(exist_ok=True)
(OUT / "pattern-c").mkdir(exist_ok=True)

BRAND = Path("/Users/matthewryan/RyanRealty/design_system/ryan-realty")
AMBOQIA = BRAND / "fonts" / "Amboqia_Boriango.otf"
AZO_SANS = BRAND / "fonts" / "AzoSans-Medium.ttf"
LOGO_WHITE = BRAND / "assets" / "brand" / "logo-white.png"

# IG carousel: 1080x1350 portrait (4:5)
TARGET_W, TARGET_H = 1080, 1350

# Pattern A — 10 photos in narrative order (hero → exterior progression → interior)
PATTERN_A = [
    ("01-hero-primary",     "HERO_PRIMARY",     "exterior"),
    ("02-aerial-dusk-1",    "AERIAL_DUSK_1",    "exterior"),
    ("03-aerial-1",         "AERIAL_1",         "exterior"),
    ("04-grounds-1",        "GROUNDS_1",        "exterior"),
    ("05-living",           "LIVING",           "interior"),
    ("06-kitchen",          "KITCHEN",          "interior"),
    ("07-primary-br",       "PRIMARY_BR",       "interior"),
    ("08-primary-bath",     "PRIMARY_BATH",     "interior"),
    ("09-aerial-dusk-2",    "AERIAL_DUSK_2",    "exterior"),
    ("10-aerial-3",         "AERIAL_3",         "exterior"),
]


def smart_crop_to_portrait(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """
    Crop+resize to target portrait aspect. Source is 2048x1366 (3:2 landscape).
    Target is 1080x1350 (4:5 portrait). Strategy:
      1. Compute crop region that keeps target aspect ratio at maximum height.
      2. Center horizontally; bias vertically toward the lower 60% of the frame
         (which usually holds the architecture; sky lives at top).
    """
    src_w, src_h = img.size
    src_aspect = src_w / src_h
    tgt_aspect = target_w / target_h

    if src_aspect > tgt_aspect:
        # Source wider than target → crop width (preserve full height)
        new_w = int(src_h * tgt_aspect)
        new_h = src_h
        left = (src_w - new_w) // 2
        top = 0
    else:
        # Source taller → crop height (preserve full width)
        new_w = src_w
        new_h = int(src_w / tgt_aspect)
        left = 0
        # Bias slightly down to preserve the building (subject is rarely in the sky)
        top = int((src_h - new_h) * 0.35)

    img = img.crop((left, top, left + new_w, top + new_h))
    return img.resize((target_w, target_h), Image.LANCZOS)


def gentle_polish(img: Image.Image) -> Image.Image:
    """Minor color/contrast normalization. Goal: clean, NOT filtered."""
    # Slight saturation boost for greens (Central Oregon foliage often looks flat)
    sat = ImageEnhance.Color(img)
    img = sat.enhance(1.05)
    # Marginal contrast boost
    con = ImageEnhance.Contrast(img)
    img = con.enhance(1.04)
    return img


def build_pattern_a():
    print("=== Pattern A: 10 unaltered carousel photos ===")
    for out_name, src_name, _kind in PATTERN_A:
        src_path = SRC / f"{src_name}.jpg"
        if not src_path.exists():
            print(f"  MISSING {src_path}")
            continue
        img = Image.open(src_path).convert("RGB")
        out = smart_crop_to_portrait(img, TARGET_W, TARGET_H)
        out = gentle_polish(out)
        dst = OUT / "pattern-a" / f"{out_name}.jpg"
        out.save(dst, "JPEG", quality=92, optimize=True)
        kb = dst.stat().st_size / 1024
        print(f"  {out_name}.jpg  →  {kb:.0f} KB")


# -------- Pattern B: Amboqia editorial headline overlay --------

def draw_text_with_shadow(draw, xy, text, font, fill=(255, 250, 244), shadow=(0, 0, 0, 170), shadow_offset=2):
    """Render text with a soft shadow for legibility against varied photo backgrounds."""
    x, y = xy
    draw.text((x + shadow_offset, y + shadow_offset), text, font=font, fill=shadow)
    draw.text((x, y), text, font=font, fill=fill)


def add_top_scrim(img: Image.Image, height_pct: float = 0.38, max_alpha: int = 95) -> Image.Image:
    """Add a soft top-down dark gradient so text reads cleanly on the sky."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    grad_h = int(img.size[1] * height_pct)
    for y in range(grad_h):
        alpha = int(max_alpha * (1 - y / grad_h))
        od.line([(0, y), (img.size[0], y)], fill=(8, 18, 32, alpha))
    img = img.convert("RGBA")
    return Image.alpha_composite(img, overlay)


def add_bottom_scrim(img: Image.Image, height_pct: float = 0.35, max_alpha: int = 100) -> Image.Image:
    """Add a soft bottom-up dark gradient for caption text at the bottom."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    h = img.size[1]
    grad_h = int(h * height_pct)
    for y in range(grad_h):
        # Fade from 0% at top of gradient → max_alpha at bottom
        alpha = int(max_alpha * (y / grad_h))
        od.line([(0, h - grad_h + y), (img.size[0], h - grad_h + y)], fill=(8, 18, 32, alpha))
    img = img.convert("RGBA")
    return Image.alpha_composite(img, overlay)


def build_pattern_b():
    print("\n=== Pattern B: Amboqia Boriango editorial headline overlay ===")
    src_path = SRC / "AERIAL_DUSK_1.jpg"
    if not src_path.exists():
        print(f"  MISSING {src_path}")
        return

    img = Image.open(src_path).convert("RGB")
    img = smart_crop_to_portrait(img, TARGET_W, TARGET_H)
    img = gentle_polish(img)
    img = add_top_scrim(img, height_pct=0.40, max_alpha=95)

    draw = ImageDraw.Draw(img)

    # Brand display serif for the headline (Amboqia has character + presence; no fake italic needed)
    headline = ImageFont.truetype(str(AMBOQIA), 78)
    # Tighter price line in the same family at smaller size for harmony
    price = ImageFont.truetype(str(AMBOQIA), 38)

    # 3-line composition, left-aligned at 60px margin
    lines = [
        "A 2.28-Acre",
        "Tumalo Retreat with",
        "Cascade Views",
    ]
    x = 60
    y = 80
    line_gap = 14
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=headline)
        draw_text_with_shadow(draw, (x, y), line, headline)
        y += (bbox[3] - bbox[1]) + line_gap

    y += 18  # extra spacing before the price line
    draw_text_with_shadow(draw, (x, y), "Listed at $1,225,000", price)

    out = img.convert("RGB")
    dst = OUT / "pattern-b" / "hero-overlay.jpg"
    out.save(dst, "JPEG", quality=92, optimize=True)
    kb = dst.stat().st_size / 1024
    print(f"  hero-overlay.jpg  →  {kb:.0f} KB")


# -------- Pattern C: Magazine sans + small brand mark (CB Luxury register) --------

def build_pattern_c():
    print("\n=== Pattern C: Azo Sans magazine caption + Ryan Realty brand mark ===")
    # Use the dusk shot with warm interior lighting — visually distinct from Pattern A 01
    # (daytime exterior) and Pattern B (wide dusk aerial)
    src_path = SRC / "LIVING.jpg"
    if not src_path.exists():
        print(f"  MISSING {src_path}")
        return

    img = Image.open(src_path).convert("RGB")
    img = smart_crop_to_portrait(img, TARGET_W, TARGET_H)
    img = gentle_polish(img)
    img = add_bottom_scrim(img, height_pct=0.42, max_alpha=130)

    draw = ImageDraw.Draw(img)

    # Sans-serif editorial caption (CB Luxury register)
    caption_font = ImageFont.truetype(str(AZO_SANS), 50)
    eyebrow_font = ImageFont.truetype(str(AZO_SANS), 22)

    # Caption sits in the bottom 35% of the frame on the scrim
    margin_x = 60
    bottom_y_for_caption = TARGET_H - 220  # leave room for eyebrow below
    caption_lines = [
        "A single-level Tumalo retreat",
        "where the Cascades fill every window.",
    ]
    y = bottom_y_for_caption - (len(caption_lines) * 62)
    for line in caption_lines:
        bbox = draw.textbbox((0, 0), line, font=caption_font)
        draw_text_with_shadow(draw, (margin_x, y), line, caption_font)
        y += (bbox[3] - bbox[1]) + 18

    # Tracked-uppercase eyebrow location line beneath the caption
    eyebrow_text = "TUMALO  ·  OREGON  ·  $1,225,000"
    y += 8
    # Letter-spaced manually since PIL doesn't have native letter-spacing
    spaced = "  ".join(eyebrow_text)
    # Simpler: use the text as-is with the dots already providing separation; just add subtle tracking via spaces
    draw_text_with_shadow(draw, (margin_x, y), eyebrow_text, eyebrow_font, fill=(240, 230, 210))

    # Small Ryan Realty wordmark in TOP RIGHT corner
    if LOGO_WHITE.exists():
        logo = Image.open(LOGO_WHITE).convert("RGBA")
        # Scale logo to 200px wide
        target_logo_w = 200
        ratio = target_logo_w / logo.size[0]
        target_logo_h = int(logo.size[1] * ratio)
        logo = logo.resize((target_logo_w, target_logo_h), Image.LANCZOS)
        # Paste top-right with margin
        logo_x = TARGET_W - target_logo_w - 50
        logo_y = 50
        img = img.convert("RGBA")
        img.paste(logo, (logo_x, logo_y), logo)

    out = img.convert("RGB")
    dst = OUT / "pattern-c" / "hero-magazine.jpg"
    out.save(dst, "JPEG", quality=92, optimize=True)
    kb = dst.stat().st_size / 1024
    print(f"  hero-magazine.jpg  →  {kb:.0f} KB")


if __name__ == "__main__":
    if not SRC.exists() or not any(SRC.glob("*.jpg")):
        sys.exit(f"missing source photos at {SRC}")
    build_pattern_a()
    build_pattern_b()
    build_pattern_c()
    print(f"\nDone. Output → {OUT}")
