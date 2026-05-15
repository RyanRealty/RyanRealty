#!/usr/bin/env python3
"""
Beaumont — UNDER CONTRACT post + Pattern A carousel
====================================================
Adapter of build_single_image_posts.py for 20702 Beaumont Dr — went pending
2026-05-14 per Matt. $525,000 · 3 BD / 2 BA / 1,803 sqft · Northpointe · built 2004.

MLS photos pulled from Spark CDN (1535×1024 source) — cropped to 1080×1350
in out/proof/2026-05-14/photos/beaumont_carousel/.

Layout follows the approved S2 pattern but rebrands the moment to "Under Contract"
with a custom eyebrow and detail line. Pattern A is bare-photo carousel.

Outputs at out/proof/2026-05-14/rendered/beaumont-v3/:
  single-image/under-contract.jpg
  pattern-a/01..08.jpg
  pattern-b/hero-overlay.jpg
"""

from PIL import Image, ImageDraw, ImageFont, ImageEnhance
from pathlib import Path

W, H = 1080, 1350
NAVY = (16, 39, 66)
CREAM = (250, 248, 244)

BRAND = Path("/Users/matthewryan/RyanRealty/design_system/ryan-realty")
AMBOQIA = BRAND / "fonts" / "Amboqia_Boriango.otf"
AZO = BRAND / "fonts" / "AzoSans-Medium.ttf"

SRC = Path("/Users/matthewryan/RyanRealty/out/proof/2026-05-14/photos/beaumont_carousel")
OUT = Path("/Users/matthewryan/RyanRealty/out/proof/2026-05-14/rendered/beaumont-v3")
(OUT / "single-image").mkdir(parents=True, exist_ok=True)
(OUT / "pattern-a").mkdir(parents=True, exist_ok=True)
(OUT / "pattern-b").mkdir(parents=True, exist_ok=True)


def amboqia(size): return ImageFont.truetype(str(AMBOQIA), size)
def azo(size): return ImageFont.truetype(str(AZO), size)


def smart_crop_to_portrait(img, w=W, h=H, focus_y=0.5):
    sw, sh = img.size
    if sw == w and sh == h:
        return img
    target_aspect = w / h
    src_aspect = sw / sh
    if src_aspect > target_aspect:
        new_w = int(sh * target_aspect)
        x0 = (sw - new_w) // 2
        img = img.crop((x0, 0, x0 + new_w, sh))
    elif src_aspect < target_aspect:
        new_h = int(sw / target_aspect)
        y0 = int((sh - new_h) * focus_y)
        img = img.crop((0, y0, sw, y0 + new_h))
    return img.resize((w, h), Image.LANCZOS)


def gentle_polish(img):
    img = ImageEnhance.Color(img).enhance(1.05)
    img = ImageEnhance.Contrast(img).enhance(1.04)
    return img


def top_scrim(img, height_pct=0.30, max_alpha=110):
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    h = int(img.size[1] * height_pct)
    for y in range(h):
        a = int(max_alpha * (1 - y / h))
        od.line([(0, y), (img.size[0], y)], fill=(8, 18, 32, a))
    return Image.alpha_composite(img.convert("RGBA"), overlay)


def bottom_scrim(img, height_pct=0.50, max_alpha=160):
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    h_total = img.size[1]
    h = int(h_total * height_pct)
    for y in range(h):
        a = int(max_alpha * (y / h))
        od.line([(0, h_total - h + y), (img.size[0], h_total - h + y)], fill=(8, 18, 32, a))
    return Image.alpha_composite(img.convert("RGBA"), overlay)


def shadow_text(draw, xy, text, font, fill=CREAM, offset=2):
    x, y = xy
    draw.text((x + offset, y + offset), text, font=font, fill=(0, 0, 0, 170))
    draw.text((x, y), text, font=font, fill=fill)


def tracked_text(draw, xy, text, font, fill, tracking_em=0.18, shadow=True):
    x, y = xy
    em = font.size
    spacing_px = int(em * tracking_em)
    for ch in text:
        if shadow:
            draw.text((x + 2, y + 2), ch, font=font, fill=(0, 0, 0, 170))
        draw.text((x, y), ch, font=font, fill=fill)
        bbox = draw.textbbox((0, 0), ch, font=font)
        x += (bbox[2] - bbox[0]) + spacing_px


# ─── Under Contract (S2-style) ──────────────────────────────────────────────

def under_contract_post():
    # Use the drone-with-Cascades hero (best context shot)
    src = SRC / "06-drone-cascades.jpg"
    img = Image.open(src).convert("RGB")
    img = smart_crop_to_portrait(img)
    img = gentle_polish(img)
    img = bottom_scrim(img, height_pct=0.50, max_alpha=160)
    img = top_scrim(img, height_pct=0.18, max_alpha=100)

    draw = ImageDraw.Draw(img)

    # Top eyebrow
    eb = azo(20)
    tracked_text(draw, (60, 60), "RYAN REALTY  ·  REPRESENTED THE SELLER", eb,
                 fill=CREAM, tracking_em=0.18)

    # Big "Under Contract" — Amboqia, bottom anchored, 2 lines
    big_font = amboqia(110)
    sx, sy = 60, H - 420
    shadow_text(draw, (sx, sy), "Under", big_font)
    bbox = draw.textbbox((0, 0), "Under", font=big_font)
    sy2 = sy + (bbox[3] - bbox[1]) + 4
    shadow_text(draw, (sx, sy2), "Contract", big_font)

    # Sub-narrative
    sub_font = azo(26)
    bbox2 = draw.textbbox((0, 0), "Contract", font=big_font)
    sy3 = sy2 + (bbox2[3] - bbox2[1]) + 28
    shadow_text(draw, (sx, sy3), "$525,000  ·  3 BD  ·  2 BA  ·  1,803 SQFT",
                sub_font, fill=(240, 230, 210))
    addr_font = azo(20)
    shadow_text(draw, (sx, sy3 + 38),
                "20702 BEAUMONT DR  ·  NORTHPOINTE  ·  BEND, OREGON",
                addr_font, fill=(220, 210, 180))

    dst = OUT / "single-image" / "under-contract.jpg"
    img.convert("RGB").save(dst, "JPEG", quality=92, optimize=True)
    print(f"  S2-uc  →  under-contract.jpg ({dst.stat().st_size // 1024} KB)")


# ─── Pattern A — bare carousel ──────────────────────────────────────────────

def build_pattern_a():
    """Per Matt 2026-05-14: 5 slides total. Exterior first, then aerials,
    then a couple of interiors (living, kitchen) and an upstairs bedroom.
    Old 8-slide order started with interiors — wrong. New arc:
      1. Front exterior · 2. Aerial w/ Cascades · 3. Living · 4. Kitchen · 5. Primary"""
    photos = [
        "01-front-exterior.jpg",
        "06-drone-cascades.jpg",
        "02-living.jpg",
        "03-kitchen.jpg",
        "04-primary.jpg",
    ]
    # Wipe old Pattern A renders so the 5-slide set is clean
    for old in (OUT / "pattern-a").glob("*.jpg"):
        old.unlink()
    for idx, src_name in enumerate(photos, start=1):
        src_path = SRC / src_name
        img = Image.open(src_path).convert("RGB")
        img = smart_crop_to_portrait(img)
        img = gentle_polish(img)
        # Rename by slide number for clarity
        out_name = f"{idx:02d}-{src_name.split('-', 1)[1]}"
        dst = OUT / "pattern-a" / out_name
        img.save(dst, "JPEG", quality=92, optimize=True)
        print(f"  A {out_name} → {dst.stat().st_size // 1024} KB")


# ─── Pattern B — editorial overlay ──────────────────────────────────────────

def build_pattern_b():
    src = SRC / "06-drone-cascades.jpg"
    img = Image.open(src).convert("RGB")
    img = smart_crop_to_portrait(img)
    img = gentle_polish(img)
    img = top_scrim(img, height_pct=0.40, max_alpha=130)

    draw = ImageDraw.Draw(img)

    eb = azo(18)
    tracked_text(draw, (60, 60), "UNDER CONTRACT", eb,
                 fill=CREAM, tracking_em=0.22)

    h_font = amboqia(68)
    hx, hy = 60, 130
    for line in ["A single-family home", "in Northpointe", "with Cascade views"]:
        shadow_text(draw, (hx, hy), line, h_font)
        bbox = draw.textbbox((0, 0), line, font=h_font)
        hy += (bbox[3] - bbox[1]) + 12

    price_font = amboqia(34)
    shadow_text(draw, (hx, hy + 12), "Listed at $525,000.", price_font, fill=(240, 230, 210))

    dst = OUT / "pattern-b" / "hero-overlay.jpg"
    img.convert("RGB").save(dst, "JPEG", quality=92, optimize=True)
    print(f"  B  hero-overlay → {dst.stat().st_size // 1024} KB")


if __name__ == "__main__":
    print(f"=== Beaumont UNDER CONTRACT posts — output: {OUT} ===\n")
    print("Pattern A — bare carousel")
    build_pattern_a()
    print("\nUnder Contract static")
    under_contract_post()
    print("\nPattern B — editorial overlay")
    build_pattern_b()
    print("\nDone.")
