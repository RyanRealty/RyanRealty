#!/usr/bin/env python3
"""
Schoolhouse — SOLD post + Pattern A carousel + Pattern B hero
=============================================================
Adapter of build_single_image_posts.py / build_tumalo_v3_kit.py for
56111 School House Rd · Vandevert Ranch · sold off-market for $3,025,000
(both sides represented by Ryan Realty).

Source photos: video-frame crops from listing_video_v4/public/v5_library/
schoolhouse_v5_delivery.mp4 — 2022 MLS photos are 640×480, too small for IG;
frames are 1080×1920 portrait, already cropped to 1080×1350 in
out/proof/2026-05-14/photos/schoolhouse_carousel/.

Outputs at out/proof/2026-05-14/rendered/schoolhouse-v3/:
  single-image/S2-just-sold.jpg
  pattern-a/01..10.jpg  (Pattern A bare-photo carousel)
  pattern-b/hero-overlay.jpg  (Amboqia editorial JUST SOLD headline)
"""

from PIL import Image, ImageDraw, ImageFont, ImageEnhance
from pathlib import Path

# Canvas
W, H = 1080, 1350
NAVY = (16, 39, 66)
CREAM = (250, 248, 244)

# Fonts
BRAND = Path("/Users/matthewryan/RyanRealty/design_system/ryan-realty")
AMBOQIA = BRAND / "fonts" / "Amboqia_Boriango.otf"
AZO = BRAND / "fonts" / "AzoSans-Medium.ttf"

# Source photos — already 1080×1350 cropped video frames (carousel set)
# AND the schoolhouse_fine set for Pattern A v2 frame selection
SRC = Path("/Users/matthewryan/RyanRealty/out/proof/2026-05-14/photos/schoolhouse_carousel")
SRC_FINE = Path("/Users/matthewryan/RyanRealty/out/proof/2026-05-14/photos/schoolhouse_fine")
SRC_PICKS = Path("/Users/matthewryan/RyanRealty/out/proof/2026-05-14/photos/schoolhouse_picks")

# Output
OUT = Path("/Users/matthewryan/RyanRealty/out/proof/2026-05-14/rendered/schoolhouse-v3")
(OUT / "single-image").mkdir(parents=True, exist_ok=True)
(OUT / "pattern-a").mkdir(parents=True, exist_ok=True)
(OUT / "pattern-b").mkdir(parents=True, exist_ok=True)


def amboqia(size): return ImageFont.truetype(str(AMBOQIA), size)
def azo(size): return ImageFont.truetype(str(AZO), size)


def smart_crop_to_portrait(img, w=W, h=H, focus_y=0.5):
    sw, sh = img.size
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
    return img.resize((w, h), Image.LANCZOS) if img.size != (w, h) else img


def gentle_polish(img, brighten=1.0):
    img = ImageEnhance.Color(img).enhance(1.05)
    img = ImageEnhance.Contrast(img).enhance(1.04)
    if brighten != 1.0:
        img = ImageEnhance.Brightness(img).enhance(brighten)
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


def measure_tracked(draw, text, font, tracking_em=0.18):
    spacing_px = int(font.size * tracking_em)
    total = sum((draw.textbbox((0, 0), ch, font=font)[2] - draw.textbbox((0, 0), ch, font=font)[0]) for ch in text)
    return total + spacing_px * max(0, len(text) - 1)


# ─── S2 — JUST SOLD ─────────────────────────────────────────────────────────

def s2_just_sold():
    """S2 — Just Sold. Per Matt 2026-05-14: NO top eyebrow. Text bigger."""
    src = SRC / "01-exterior-hero.jpg"
    img = Image.open(src).convert("RGB")
    img = smart_crop_to_portrait(img)
    img = gentle_polish(img)
    img = bottom_scrim(img, height_pct=0.55, max_alpha=170)
    # No top scrim — no eyebrow at top

    draw = ImageDraw.Draw(img)

    # Big "Sold" — Amboqia, bottom anchored, BIGGER per Matt
    sold_font = amboqia(240)
    sx, sy = 60, H - 480
    shadow_text(draw, (sx, sy), "Sold", sold_font)

    # Sub-narrative — bigger
    sub_font = azo(34)
    shadow_text(draw, (sx, sy + 260), "Off-market  ·  $3,025,000", sub_font,
                fill=CREAM)
    addr_font = azo(24)
    shadow_text(draw, (sx, sy + 308),
                "56111 SCHOOL HOUSE RD  ·  VANDEVERT RANCH  ·  BEND, OREGON",
                addr_font, fill=(225, 215, 195))

    dst = OUT / "single-image" / "S2-just-sold.jpg"
    img.convert("RGB").save(dst, "JPEG", quality=92, optimize=True)
    print(f"  S2  →  {dst.relative_to(OUT.parent.parent.parent.parent)} ({dst.stat().st_size // 1024} KB)")


# ─── Pattern A — bare-photo carousel ────────────────────────────────────────

def build_pattern_a():
    """6-slide bare carousel. Photos only. No overlay. No logo. No numeral.
    Per Matt 2026-05-14 (revision 4 — locked): slides 4 and 6 swapped from
    Brightness(0.85)-baked video frames to actual MLS photos (Spark API,
    listing 220149378, ListingKey 20220704181420090429000000). Slide 4 is the
    bedroom-with-view photo (lifestyle "wake up to the view" beat). Slide 6 is
    the show-stopping primary suite with fireplace + reclaimed-wood feature
    wall (per public_remarks "expansive main level primary master retreat w/
    show stopping fireplace"). MLS photos are 640×480 — smart_crop upscales to
    1080×1350, but they read brighter and sharper than the dim video frames
    Matt rejected six times.

    Slides 1, 2, 3, 5 remain video frames — exteriors and great-room interior
    are bright enough at brighten <= 1.18 from the video pipeline."""
    # Wipe old Pattern A renders so the new set is clean
    for old in (OUT / "pattern-a").glob("*.jpg"):
        old.unlink()
    photos = [
        # (out_name, source_set, source_filename, focus_y, brighten)
        # Slides 1-3, 5: video frames (acceptable at brighten <= 1.18)
        # Slides 4, 6: MLS photos at 1.00 brighten (properly exposed at source)
        ("01-front-exterior",        SRC_FINE,  "frame-45.jpg",                       0.45, 1.05),
        ("02-back-exterior",         SRC_FINE,  "frame-90.jpg",                       0.50, 1.05),
        ("03-hallway-to-great-room", SRC_PICKS, "hallway-into-great-room.jpg",        0.50, 1.18),
        ("04-bedroom-view",          SRC_PICKS, "mls-30-bedroom-window-view.jpg",     0.50, 1.00),
        ("05-kitchen-direct",        SRC_PICKS, "kitchen-direct.jpg",                 0.50, 1.15),
        ("06-primary-suite",         SRC_PICKS, "mls-27-primary-suite-fireplace.jpg", 0.50, 1.00),
    ]
    for out_name, src_dir, src_name, focus_y, brighten in photos:
        src_path = src_dir / src_name
        img = Image.open(src_path).convert("RGB")
        img = smart_crop_to_portrait(img, focus_y=focus_y)
        img = gentle_polish(img, brighten=brighten)
        dst = OUT / "pattern-a" / f"{out_name}.jpg"
        img.save(dst, "JPEG", quality=92, optimize=True)
        print(f"  A {out_name} → {dst.stat().st_size // 1024} KB (brighten {brighten:.2f})")


# ─── Pattern B — Amboqia editorial headline overlay ─────────────────────────

def build_pattern_b():
    """Pattern B — Tumalo v3 layout. Per Matt 2026-05-14: NO eyebrow.
    Headline + price line in same CREAM color (not different tints).
    Match the approved Tumalo hero-overlay.jpg exactly: headline top-left
    Amboqia, conversational price line below in same color."""
    src = SRC / "01-exterior-hero.jpg"
    img = Image.open(src).convert("RGB")
    img = smart_crop_to_portrait(img)
    img = gentle_polish(img)
    # Top scrim only — covers sky region where headline lands
    img = top_scrim(img, height_pct=0.42, max_alpha=140)

    draw = ImageDraw.Draw(img)

    # Headline — Amboqia, 3 lines, top-left (no eyebrow above)
    h_font = amboqia(78)
    hx, hy = 60, 90
    for line in ["A Jerry Locati Design", "on the Little Deschutes", "in Vandevert Ranch"]:
        shadow_text(draw, (hx, hy), line, h_font, fill=CREAM)
        bbox = draw.textbbox((0, 0), line, font=h_font)
        hy += (bbox[3] - bbox[1]) + 10

    # Sold price — SAME color as headline (CREAM), Amboqia smaller, below headline
    price_font = amboqia(38)
    shadow_text(draw, (hx, hy + 16), "Sold for $3,025,000.", price_font, fill=CREAM)

    dst = OUT / "pattern-b" / "hero-overlay.jpg"
    img.convert("RGB").save(dst, "JPEG", quality=92, optimize=True)
    print(f"  B  hero-overlay → {dst.stat().st_size // 1024} KB")


if __name__ == "__main__":
    print(f"=== Schoolhouse SOLD posts — output: {OUT} ===")
    print()
    print("Pattern A — bare carousel")
    build_pattern_a()
    print()
    print("S2 — Just Sold static")
    s2_just_sold()
    print()
    print("Pattern B — editorial overlay")
    build_pattern_b()
    print()
    print("Done.")
