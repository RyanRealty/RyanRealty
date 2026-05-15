#!/usr/bin/env python3
"""
Simpson — SOLD content (Rebecca buyer-side closed 2026-03-16)
=============================================================
19571 SW Simpson Avenue · Broken Top · Bend OR 97702
MLS 220202576 · Closed 2026-03-16 · Sold $735,000 (listed $775,000)
3 BD / 3 BA / 2,116 sqft / 0.13 acres · Built 2000
Single-level Broken Top townhome with 18th fairway views
List agent: Lisa Cole, Berkshire Hathaway HomeService
Rebecca Ryser Peterson represented the BUYERS for Ryan Realty.

Adapts the approved Tumalo v3 S2 layout per Matt's Schoolhouse direction
(no top eyebrow → wait, Schoolhouse was both-sides; Rebecca buyer-side
deserves the eyebrow). KEEPING the eyebrow here because Rebecca's buyer-side
role is the story.
"""

from PIL import Image, ImageDraw, ImageFont, ImageEnhance
from pathlib import Path

W, H = 1080, 1350
NAVY = (16, 39, 66)
CREAM = (250, 248, 244)

BRAND = Path("/Users/matthewryan/RyanRealty/design_system/ryan-realty")
AMBOQIA = BRAND / "fonts" / "Amboqia_Boriango.otf"
AZO = BRAND / "fonts" / "AzoSans-Medium.ttf"

SRC = Path("/Users/matthewryan/RyanRealty/out/proof/2026-05-14/photos/simpson_src")
OUT = Path("/Users/matthewryan/RyanRealty/out/proof/2026-05-14/rendered/simpson-v3")
(OUT / "single-image").mkdir(parents=True, exist_ok=True)
(OUT / "pattern-a").mkdir(parents=True, exist_ok=True)
(OUT / "pattern-b").mkdir(parents=True, exist_ok=True)


def amboqia(s): return ImageFont.truetype(str(AMBOQIA), s)
def azo(s):     return ImageFont.truetype(str(AZO), s)


def smart_crop_to_portrait(img, w=W, h=H, focus_y=0.5):
    sw, sh = img.size
    if sw == w and sh == h: return img
    ta, sa = w / h, sw / sh
    if sa > ta:
        new_w = int(sh * ta); x0 = (sw - new_w) // 2
        img = img.crop((x0, 0, x0 + new_w, sh))
    elif sa < ta:
        new_h = int(sw / ta); y0 = int((sh - new_h) * focus_y)
        img = img.crop((0, y0, sw, y0 + new_h))
    return img.resize((w, h), Image.LANCZOS)


def gentle_polish(img):
    img = ImageEnhance.Color(img).enhance(1.05)
    img = ImageEnhance.Contrast(img).enhance(1.04)
    return img


def top_scrim(img, height_pct=0.18, max_alpha=100):
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    h = int(img.size[1] * height_pct)
    for y in range(h):
        a = int(max_alpha * (1 - y / h))
        od.line([(0, y), (img.size[0], y)], fill=(8, 18, 32, a))
    return Image.alpha_composite(img.convert("RGBA"), overlay)


def bottom_scrim(img, height_pct=0.55, max_alpha=170):
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    ht = img.size[1]; h = int(ht * height_pct)
    for y in range(h):
        a = int(max_alpha * (y / h))
        od.line([(0, ht - h + y), (img.size[0], ht - h + y)], fill=(8, 18, 32, a))
    return Image.alpha_composite(img.convert("RGBA"), overlay)


def shadow_text(d, xy, t, f, fill=CREAM, offset=2):
    x, y = xy
    d.text((x + offset, y + offset), t, font=f, fill=(0, 0, 0, 170))
    d.text((x, y), t, font=f, fill=fill)


def tracked_text(d, xy, t, f, fill=CREAM, tracking_em=0.18, shadow=True):
    x, y = xy
    spacing = int(f.size * tracking_em)
    for ch in t:
        if shadow:
            d.text((x + 2, y + 2), ch, font=f, fill=(0, 0, 0, 170))
        d.text((x, y), ch, font=f, fill=fill)
        bbox = d.textbbox((0, 0), ch, font=f)
        x += (bbox[2] - bbox[0]) + spacing


# ─── S2 — Just Sold (buyer-side) ────────────────────────────────────────────

def s2_just_sold():
    """Approved Tumalo v3 S2 layout adapted for buyer-side close."""
    src = SRC / "03.jpg"  # front entry — character exterior
    img = Image.open(src).convert("RGB")
    img = smart_crop_to_portrait(img, focus_y=0.55)
    img = gentle_polish(img)
    img = bottom_scrim(img, height_pct=0.55, max_alpha=170)
    img = top_scrim(img, height_pct=0.18, max_alpha=100)

    draw = ImageDraw.Draw(img)
    # Eyebrow — Rebecca buyer-side
    eb = azo(20)
    tracked_text(draw, (60, 60), "RYAN REALTY  ·  REPRESENTED THE BUYERS", eb,
                 fill=CREAM, tracking_em=0.18)

    # Big "Sold" — Amboqia 240px (same as Schoolhouse v2)
    sold_font = amboqia(240)
    sx, sy = 60, H - 480
    shadow_text(draw, (sx, sy), "Sold", sold_font)

    sub_font = azo(34)
    shadow_text(draw, (sx, sy + 260), "Broken Top  ·  $735,000", sub_font, fill=CREAM)
    addr_font = azo(24)
    shadow_text(draw, (sx, sy + 308),
                "19571 SW SIMPSON AVENUE  ·  BEND, OREGON",
                addr_font, fill=(225, 215, 195))

    dst = OUT / "single-image" / "S2-just-sold.jpg"
    img.convert("RGB").save(dst, "JPEG", quality=92, optimize=True)
    print(f"  S2  →  S2-just-sold.jpg ({dst.stat().st_size // 1024} KB)")


# ─── Pattern A — bare carousel ──────────────────────────────────────────────

def build_pattern_a():
    """Pattern A 6 slides: exterior, great room, dining/kitchen, primary, etc."""
    for old in (OUT / "pattern-a").glob("*.jpg"):
        old.unlink()
    photos = [
        ("01-front-entry",      "03.jpg", 0.50),
        ("02-great-room",       "01.jpg", 0.50),
        ("03-living-dining",    "05.jpg", 0.50),
        ("04-kitchen",          "02.jpg", 0.50),
        ("05-bedroom",          "06.jpg", 0.50),
        ("06-back-exterior",    "07.jpg", 0.50),
    ]
    for out_name, src_name, fy in photos:
        src_path = SRC / src_name
        if not src_path.exists():
            print(f"  ⚠ skip {src_name} — not found")
            continue
        img = Image.open(src_path).convert("RGB")
        img = smart_crop_to_portrait(img, focus_y=fy)
        img = gentle_polish(img)
        dst = OUT / "pattern-a" / f"{out_name}.jpg"
        img.save(dst, "JPEG", quality=92, optimize=True)
        print(f"  A {out_name} → {dst.stat().st_size // 1024} KB")


# ─── Pattern B — editorial overlay ──────────────────────────────────────────

def build_pattern_b():
    src = SRC / "01.jpg"  # great room interior — best frame for headline
    img = Image.open(src).convert("RGB")
    img = smart_crop_to_portrait(img, focus_y=0.55)
    img = gentle_polish(img)
    img = top_scrim(img, height_pct=0.42, max_alpha=140)

    draw = ImageDraw.Draw(img)
    h_font = amboqia(70)
    hx, hy = 60, 90
    for line in ["A Single-Level Townhome", "on the 18th Fairway", "at Broken Top"]:
        shadow_text(draw, (hx, hy), line, h_font, fill=CREAM)
        bbox = draw.textbbox((0, 0), line, font=h_font)
        hy += (bbox[3] - bbox[1]) + 10

    price_font = amboqia(36)
    shadow_text(draw, (hx, hy + 16), "Sold for $735,000.", price_font, fill=CREAM)

    dst = OUT / "pattern-b" / "hero-overlay.jpg"
    img.convert("RGB").save(dst, "JPEG", quality=92, optimize=True)
    print(f"  B  hero-overlay → {dst.stat().st_size // 1024} KB")


if __name__ == "__main__":
    print(f"=== Simpson / Broken Top — Rebecca buyer-side SOLD ===")
    print("Pattern A — bare carousel")
    build_pattern_a()
    print("\nS2 — Just Sold static")
    s2_just_sold()
    print("\nPattern B — editorial overlay")
    build_pattern_b()
    print("\nDone.")
