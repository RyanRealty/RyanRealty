#!/usr/bin/env python3
# @producer-guard-exempt: one-off JUST-SOLD carousel render for a single property (20702 Beaumont Dr); outputs to out/ draft only, not a brain-callable producer (not in REGISTRY).
"""
Beaumont — JUST SOLD carousel ads (V1 photo-led + V2 editorial)
================================================================
Adapter of the approved build_beaumont_pending_posts.py layout system
(S2 overlay pattern, scrims, Amboqia/Azo, tracked eyebrows) plus the
approved build_testimonial_card.py review-tile layout, for the CLOSED
sale of 20702 Beaumont Dr, Bend (Northpointe).

Verified data (Supabase listings, ListingKey=20260209175423826097000000,
pulled 2026-07-10): ClosePrice $519,000 · CloseDate 2026-07-08 ·
3 BD · 2 BA · 1,803 sqft · ListAgent Matt Ryan / Ryan Realty LLC.

Review tile (renders VERBATIM, reviews are exempt from voice laws):
latest GBP review — MJB · 5 stars · 2026-07-10, re-ingested via
scripts/ingest-gbp-reviews.mjs --apply --replace on 2026-07-10.

Photos: Spark CDN via listings.details->'Photos' (listing_photos table
had no rows for this closed listing) → out/beaumont-sold-carousel/photos/.

Outputs: out/beaumont-sold-carousel/v1/*.jpg, v2/*.jpg + citations.json
"""

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageEnhance

W, H = 1080, 1350
NAVY = (16, 39, 66)
CREAM = (250, 248, 244)

REPO = Path("/Users/matthewryan/RyanRealty")
BRAND = REPO / "design_system" / "ryan-realty"
AMBOQIA = BRAND / "fonts" / "Amboqia_Boriango.otf"
AZO = BRAND / "fonts" / "AzoSans-Medium.ttf"

BASE = REPO / "out" / "beaumont-sold-carousel"
SRC = BASE / "photos"
V1 = BASE / "v1"
V2 = BASE / "v2"
V1.mkdir(parents=True, exist_ok=True)
V2.mkdir(parents=True, exist_ok=True)

PRICE = "$519,000"
SPECS = f"{PRICE}  ·  3 BD  ·  2 BA  ·  1,803 SQFT"
ADDR = "20702 BEAUMONT DR  ·  NORTHPOINTE  ·  BEND, OREGON"

REVIEW_QUOTE = ("“As a California resident, selling my house in Bend was "
                "more difficult and complicated than I had ever anticipated - "
                "but Matt was always available to make the process as smooth "
                "as possible.”")
REVIEW_ATTR = "MJB  ·  GOOGLE REVIEW  ·  JULY 2026"

BANNED = ["stunning", "breathtaking", "gorgeous", "charming", "pristine",
          "nestled", "boasts", "must-see", "dream home", "meticulously",
          "truly", "luxurious", "immaculate", "captivating", "exquisite",
          "delve", "tapestry", "robust", "seamless", "elevate", "unlock",
          "hidden gem", "tucked away", "act fast", "won't last"]


def amboqia(size):
    return ImageFont.truetype(str(AMBOQIA), size)


def azo(size):
    return ImageFont.truetype(str(AZO), size)


def voice_check(*texts):
    # Review quote is verbatim-exempt; this guards OUR copy only.
    for t in texts:
        low = t.lower()
        hits = [b for b in BANNED if b in low]
        assert not hits, f"Banned words in copy: {hits} in {t!r}"
        assert "—" not in t and ";" not in t, f"Banned punctuation in {t!r}"


def smart_crop_to_portrait(img, w=W, h=H, focus_y=0.5, focus_x=0.5):
    sw, sh = img.size
    if sw == w and sh == h:
        return img
    target_aspect = w / h
    src_aspect = sw / sh
    if src_aspect > target_aspect:
        new_w = int(sh * target_aspect)
        x0 = min(max(int((sw - new_w) * focus_x), 0), sw - new_w)
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
        od.line([(0, h_total - h + y), (img.size[0], h_total - h + y)],
                fill=(8, 18, 32, a))
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


def tracked_width(draw, text, font, tracking_em=0.18):
    em = font.size
    spacing_px = int(em * tracking_em)
    w = 0
    for ch in text:
        bbox = draw.textbbox((0, 0), ch, font=font)
        w += (bbox[2] - bbox[0]) + spacing_px
    return w - spacing_px if text else 0


def wrap_text(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for word in words:
        trial = f"{cur} {word}".strip()
        bbox = draw.textbbox((0, 0), trial, font=font)
        if bbox[2] - bbox[0] <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def star(draw, cx, cy, r, fill):
    pts = []
    for i in range(10):
        ang = math.pi / 2 + i * math.pi / 5
        rad = r if i % 2 == 0 else r * 0.42
        pts.append((cx + rad * math.cos(ang), cy - rad * math.sin(ang)))
    draw.polygon(pts, fill=fill)


def load(src_name, focus_y=0.5, focus_x=0.5):
    img = Image.open(SRC / src_name).convert("RGB")
    img = smart_crop_to_portrait(img, focus_y=focus_y, focus_x=focus_x)
    return gentle_polish(img)


def save(img, path):
    img.convert("RGB").save(path, "JPEG", quality=92, optimize=True)
    print(f"  {path.relative_to(BASE)}  ({path.stat().st_size // 1024} KB)")


# ── V1 tile 1 — Sold hook (approved S2 pattern) ─────────────────────────────

def v1_hook():
    img = bottom_scrim(top_scrim(load("23.jpg"), 0.18, 100), 0.50, 160)
    draw = ImageDraw.Draw(img)
    eyebrow = "RYAN REALTY  ·  REPRESENTED THE SELLER"
    voice_check(eyebrow, SPECS, ADDR)
    tracked_text(draw, (60, 60), eyebrow, azo(20), fill=CREAM)
    big = amboqia(120)
    sx, sy = 60, H - 340
    shadow_text(draw, (sx, sy), "Sold", big)
    bbox = draw.textbbox((0, 0), "Sold", font=big)
    sy2 = sy + (bbox[3] - bbox[1]) + 30
    shadow_text(draw, (sx, sy2), SPECS, azo(26), fill=(240, 230, 210))
    shadow_text(draw, (sx, sy2 + 40), ADDR, azo(20), fill=(220, 210, 180))
    save(img, V1 / "01-hook-sold.jpg")


# ── V2 tile 1 — editorial hook (approved pattern-B) ─────────────────────────

def v2_hook():
    img = top_scrim(load("24.jpg"), 0.40, 130)
    draw = ImageDraw.Draw(img)
    eyebrow = "SOLD  ·  REPRESENTED THE SELLER"
    lines = ["A single-family home", "in Northpointe,", "closed at $519,000."]
    voice_check(eyebrow, *lines)
    tracked_text(draw, (60, 60), eyebrow, azo(18), fill=CREAM, tracking_em=0.22)
    h_font = amboqia(68)
    hx, hy = 60, 130
    for line in lines:
        shadow_text(draw, (hx, hy), line, h_font)
        bbox = draw.textbbox((0, 0), line, font=h_font)
        hy += (bbox[3] - bbox[1]) + 12
    shadow_text(draw, (hx, hy + 12), "3 BD  ·  2 BA  ·  1,803 SQFT  ·  BEND, OREGON",
                azo(24), fill=(240, 230, 210))
    save(img, V2 / "01-hook-editorial.jpg")


# ── Bare photo tiles (approved pattern-A) ───────────────────────────────────

def bare(version_dir, idx, src_name, label, focus_y=0.5, focus_x=0.5):
    img = load(src_name, focus_y=focus_y, focus_x=focus_x)
    save(img, version_dir / f"{idx:02d}-{label}.jpg")


# ── Review closer tile (approved testimonial_card layout) ───────────────────

def review_tile(version_dir, inverse=False):
    bg, fg = (NAVY, CREAM) if inverse else (CREAM, NAVY)
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)

    eyebrow = "THE LATEST REVIEW ON GOOGLE"
    voice_check(eyebrow)
    eb_font = azo(20)
    ex = (W - tracked_width(d, eyebrow, eb_font, 0.22)) // 2
    tracked_text(d, (ex, 130), eyebrow, eb_font, fill=fg, tracking_em=0.22,
                 shadow=False)

    for i in range(5):
        star(d, W // 2 + (i - 2) * 64, 240, 22, fg)

    quote_font = amboqia(44)
    lines = wrap_text(d, REVIEW_QUOTE, quote_font, W - 240)
    line_h = quote_font.size + 18
    start_y = 340
    for i, ln in enumerate(lines):
        bbox = d.textbbox((0, 0), ln, font=quote_font)
        d.text(((W - (bbox[2] - bbox[0])) // 2, start_y + i * line_h),
               ln, font=quote_font, fill=fg)

    attr_font = azo(22)
    attr_y = start_y + len(lines) * line_h + 44
    bbox = d.textbbox((0, 0), REVIEW_ATTR, font=attr_font)
    d.text(((W - (bbox[2] - bbox[0])) // 2, attr_y), REVIEW_ATTR,
           font=attr_font, fill=fg)

    d.line([(W // 2 - 36, H - 150), (W // 2 + 36, H - 150)], fill=fg, width=2)
    f1, f2 = azo(18), azo(15)
    b1 = d.textbbox((0, 0), "RYAN REALTY", font=f1)
    d.text(((W - (b1[2] - b1[0])) // 2, H - 118), "RYAN REALTY", font=f1, fill=fg)
    place = "BEND  ·  OREGON  ·  541.213.6706"
    b2 = d.textbbox((0, 0), place, font=f2)
    d.text(((W - (b2[2] - b2[0])) // 2, H - 86), place, font=f2, fill=fg)

    save(img, version_dir / "06-review.jpg")


def citations():
    payload = [
        {"figure": "$519,000 close price / 3 BD / 2 BA / 1,803 sqft",
         "source": "Supabase listings, ListingKey=20260209175423826097000000, "
                   "ClosePrice=519000, BedroomsTotal=3, BathroomsTotal=2, "
                   "TotalLivingAreaSqFt=1803, CloseDate=2026-07-08, "
                   "ListAgentName=Matt Ryan, ListOfficeName=Ryan Realty LLC",
         "fetched_at": "2026-07-10"},
        {"figure": "Review quote, verbatim contiguous excerpt",
         "source": "GBP live re-ingest 2026-07-10 (ingest-gbp-reviews.mjs "
                   "--apply --replace): reviewer MJB, rating 5, "
                   "review_date 2026-07-10, source google",
         "fetched_at": "2026-07-10"},
    ]
    (BASE / "citations.json").write_text(json.dumps(payload, indent=2))
    print("  citations.json")


if __name__ == "__main__":
    print(f"=== Beaumont JUST SOLD carousels — {BASE} ===\n")
    print("V1 — photo-led")
    v1_hook()
    bare(V1, 2, "20.jpg", "front-exterior")
    bare(V1, 3, "06.jpg", "kitchen")
    bare(V1, 4, "01.jpg", "living-fireplace", focus_x=0.78)
    bare(V1, 5, "32.jpg", "aerial-cascades", focus_y=0.35)
    review_tile(V1, inverse=False)
    print("\nV2 — editorial")
    v2_hook()
    bare(V2, 2, "21.jpg", "front-straight")
    bare(V2, 3, "05.jpg", "living-fireplace")
    bare(V2, 4, "22.jpg", "deck-view")
    bare(V2, 5, "31.jpg", "aerial-horizon", focus_y=0.35)
    review_tile(V2, inverse=True)
    print()
    citations()
    print("\nDone.")
