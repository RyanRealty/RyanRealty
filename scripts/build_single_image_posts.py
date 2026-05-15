#!/usr/bin/env python3
"""
Single-Image Post Templates · Ryan Realty
==========================================
10 single-image post designs at 1080×1350 (IG portrait), brand fonts only.

Templates:
  S1 — Just Listed         (Tumalo · single hero · "JUST LISTED" eyebrow + address + price)
  S2 — Just Sold           (Tumalo · single hero · "SOLD" Amboqia + "Above Asking · X Days")
  S3 — Open House          (Tumalo · single hero · "OPEN HOUSE" eyebrow + day + time)
  S4 — Coming Soon         (Tumalo · single hero, tighter crop · "COMING SOON" + season)
  S5 — Price Improvement   (Tumalo · single hero · old → new price slash)
  S6 — Featured Listing    (Tumalo · single hero · curated editorial "Listing of the Week")
  S7 — Agent Intro         (Matt PNG · cream BG · Amboqia name + Geist role)
  S8 — Brag Stat           (Tumalo aerial · moody scrim · single huge stat)
  S9 — Press Feature       ("As seen in Source Weekly" · masthead + photo)
  S10 — Market Data Card   (Cream BG · single Bend market stat · Amboqia + Azo Sans)

Brand fonts:
  Amboqia Boriango (display)
  Azo Sans Medium (accent / eyebrow / tracked uppercase)
  Geist would be body — we approximate w/ Azo Sans light weight via size

Output:
  /Users/matthewryan/RyanRealty/out/list-kits/19496-tumalo-reservoir/v3/single-image/
    S1-just-listed.jpg ... S10-market-data.jpg
"""

from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter
from pathlib import Path

# ── Paths ───────────────────────────────────────────────────────────────────

SRC = Path("/tmp/tumalo-src")
OUT = Path("/Users/matthewryan/RyanRealty/out/list-kits/19496-tumalo-reservoir/v3/single-image")
OUT.mkdir(parents=True, exist_ok=True)

BRAND = Path("/Users/matthewryan/RyanRealty/design_system/ryan-realty")
AMBOQIA = BRAND / "fonts" / "Amboqia_Boriango.otf"
AZO = BRAND / "fonts" / "AzoSans-Medium.ttf"
LOGO_WHITE = BRAND / "assets" / "brand" / "logo-white.png"
LOGO_BLUE = BRAND / "assets" / "brand" / "logo-blue.png"

MATT_PNG = Path("/Users/matthewryan/RyanRealty/design_system/ryan-realty/assets/team/matt-ryan.png")

# ── Canvas ──────────────────────────────────────────────────────────────────

W, H = 1080, 1350
NAVY = (16, 39, 66)
CREAM = (250, 248, 244)
CREAM_FILL = (250, 248, 244)
INK = (26, 26, 26)


def amboqia(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(AMBOQIA), size)


def azo(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(AZO), size)


# ── Image helpers ───────────────────────────────────────────────────────────

def smart_crop_to_portrait(img: Image.Image, w: int = W, h: int = H, focus_y: float = 0.5) -> Image.Image:
    """Crop+resize to portrait. focus_y in [0,1] — 0 = top, 0.5 = center, 1 = bottom."""
    sw, sh = img.size
    target_aspect = w / h
    src_aspect = sw / sh
    if src_aspect > target_aspect:
        # Source is wider — crop horizontally, focus center
        new_w = int(sh * target_aspect)
        x0 = (sw - new_w) // 2
        img = img.crop((x0, 0, x0 + new_w, sh))
    else:
        # Source is taller — crop vertically
        new_h = int(sw / target_aspect)
        y0 = int((sh - new_h) * focus_y)
        img = img.crop((0, y0, sw, y0 + new_h))
    return img.resize((w, h), Image.LANCZOS)


def gentle_polish(img: Image.Image) -> Image.Image:
    img = ImageEnhance.Color(img).enhance(1.05)
    img = ImageEnhance.Contrast(img).enhance(1.05)
    img = ImageEnhance.Brightness(img).enhance(1.02)
    return img


def top_scrim(img: Image.Image, height_pct: float = 0.30, max_alpha: int = 110) -> Image.Image:
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    h = int(img.size[1] * height_pct)
    for y in range(h):
        a = int(max_alpha * (1 - y / h))
        od.line([(0, y), (img.size[0], y)], fill=(8, 18, 32, a))
    return Image.alpha_composite(img.convert("RGBA"), overlay)


def bottom_scrim(img: Image.Image, height_pct: float = 0.40, max_alpha: int = 130) -> Image.Image:
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    h_total = img.size[1]
    h = int(h_total * height_pct)
    for y in range(h):
        a = int(max_alpha * (y / h))
        od.line([(0, h_total - h + y), (img.size[0], h_total - h + y)], fill=(8, 18, 32, a))
    return Image.alpha_composite(img.convert("RGBA"), overlay)


def shadow_text(draw, xy, text, font, fill=CREAM, shadow=(0, 0, 0, 170), offset=2):
    x, y = xy
    draw.text((x + offset, y + offset), text, font=font, fill=shadow)
    draw.text((x, y), text, font=font, fill=fill)


def tracked_text(draw, xy, text, font, fill, tracking_em: float = 0.10, shadow=False):
    """Draw text with manual letter-spacing (PIL has no native tracking)."""
    x, y = xy
    em = font.size
    spacing_px = int(em * tracking_em)
    for ch in text:
        if shadow:
            draw.text((x + 2, y + 2), ch, font=font, fill=(0, 0, 0, 170))
        draw.text((x, y), ch, font=font, fill=fill)
        bbox = draw.textbbox((0, 0), ch, font=font)
        x += (bbox[2] - bbox[0]) + spacing_px


def measure_tracked(draw, text, font, tracking_em: float = 0.10) -> int:
    em = font.size
    spacing_px = int(em * tracking_em)
    total = 0
    for ch in text:
        bbox = draw.textbbox((0, 0), ch, font=font)
        total += (bbox[2] - bbox[0])
    total += spacing_px * max(0, len(text) - 1)
    return total


def paste_logo(img: Image.Image, logo_path: Path, target_w: int, pos: tuple) -> Image.Image:
    if not logo_path.exists():
        return img
    logo = Image.open(logo_path).convert("RGBA")
    ratio = target_w / logo.size[0]
    new_h = int(logo.size[1] * ratio)
    logo = logo.resize((target_w, new_h), Image.LANCZOS)
    out = img.convert("RGBA")
    out.paste(logo, pos, logo)
    return out


# ── S1 — JUST LISTED ────────────────────────────────────────────────────────

def s1_just_listed():
    src = SRC / "AERIAL_DUSK_1.jpg"
    img = Image.open(src).convert("RGB")
    img = smart_crop_to_portrait(img, focus_y=0.45)
    img = gentle_polish(img)
    # Top scrim added so eyebrow has reliable contrast against sky
    img = top_scrim(img, height_pct=0.20, max_alpha=110)
    img = bottom_scrim(img, height_pct=0.42, max_alpha=140)

    draw = ImageDraw.Draw(img)

    # Eyebrow — top of frame, tracked
    eyebrow_font = azo(22)
    eyebrow_y = 60
    eyebrow_text = "JUST LISTED"
    tw = measure_tracked(draw, eyebrow_text, eyebrow_font, 0.20)
    tracked_text(draw, (60, eyebrow_y), eyebrow_text, eyebrow_font, fill=CREAM, tracking_em=0.20, shadow=True)
    # Hairline under eyebrow — drawn with shadow for contrast on bright sky
    draw.line([(62, eyebrow_y + 39), (62 + tw, eyebrow_y + 39)], fill=(0, 0, 0, 100), width=1)
    draw.line([(60, eyebrow_y + 38), (60 + tw, eyebrow_y + 38)], fill=CREAM, width=2)

    # Headline — bottom anchor
    h_font = amboqia(78)
    line1, line2 = "19496 Tumalo", "Reservoir Rd"
    bx, by = 60, H - 320
    shadow_text(draw, (bx, by), line1, h_font)
    bbox1 = draw.textbbox((0, 0), line1, font=h_font)
    by2 = by + (bbox1[3] - bbox1[1]) + 8
    shadow_text(draw, (bx, by2), line2, h_font)

    # Spec line + price (Azo Sans Medium)
    sub_font = azo(28)
    sub_y = by2 + 110
    spec_text = "Tumalo, Oregon  ·  $1,225,000"
    shadow_text(draw, (bx, sub_y), spec_text, sub_font)
    bedline = azo(22)
    shadow_text(draw, (bx, sub_y + 42), "3 BD  ·  3 BA  ·  2,325 SQFT  ·  2.28 acres", bedline, fill=(240, 230, 210))

    out = img.convert("RGB")
    dst = OUT / "S1-just-listed.jpg"
    out.save(dst, "JPEG", quality=92, optimize=True)
    print(f"  S1  →  {dst.name} ({dst.stat().st_size // 1024} KB)")


# ── S2 — JUST SOLD ──────────────────────────────────────────────────────────

def s2_just_sold():
    src = SRC / "HERO_PRIMARY.jpg"
    img = Image.open(src).convert("RGB")
    img = smart_crop_to_portrait(img, focus_y=0.5)
    img = gentle_polish(img)
    img = bottom_scrim(img, height_pct=0.50, max_alpha=160)

    draw = ImageDraw.Draw(img)

    # Big Amboqia "Sold" — bottom anchored, large
    sold_font = amboqia(180)
    sold_text = "Sold"
    bbox = draw.textbbox((0, 0), sold_text, font=sold_font)
    sx = 60
    sy = H - 360
    shadow_text(draw, (sx, sy), sold_text, sold_font)

    # Sub-narrative
    sub_font = azo(26)
    shadow_text(draw, (sx, sy + 200), "Above asking  ·  9 days on market", sub_font, fill=(240, 230, 210))
    addr_font = azo(22)
    shadow_text(draw, (sx, sy + 240), "19496 TUMALO RESERVOIR RD  ·  TUMALO, OREGON", addr_font, fill=(220, 210, 180))

    # Tiny eyebrow top
    eb = azo(20)
    tracked_text(draw, (60, 60), "RYAN REALTY  ·  REPRESENTED THE BUYER", eb, fill=CREAM, tracking_em=0.18, shadow=True)

    out = img.convert("RGB")
    dst = OUT / "S2-just-sold.jpg"
    out.save(dst, "JPEG", quality=92, optimize=True)
    print(f"  S2  →  {dst.name} ({dst.stat().st_size // 1024} KB)")


# ── S3 — OPEN HOUSE ─────────────────────────────────────────────────────────

def s3_open_house():
    src = SRC / "AERIAL_DUSK_2.jpg"
    img = Image.open(src).convert("RGB")
    img = smart_crop_to_portrait(img, focus_y=0.4)
    img = gentle_polish(img)
    img = bottom_scrim(img, height_pct=0.50, max_alpha=150)

    draw = ImageDraw.Draw(img)

    # Eyebrow
    eb = azo(22)
    tracked_text(draw, (60, 60), "OPEN HOUSE", eb, fill=CREAM, tracking_em=0.20, shadow=True)
    tw = measure_tracked(draw, "OPEN HOUSE", eb, 0.20)
    draw.line([(60, 100), (60 + tw, 100)], fill=CREAM, width=1)

    # Date + time — main headline area
    date_font = amboqia(88)
    shadow_text(draw, (60, H - 440), "Saturday, May 24", date_font)

    time_font = amboqia(56)
    shadow_text(draw, (60, H - 330), "11 am — 2 pm", time_font, fill=(240, 230, 210))

    # Address line
    addr = azo(24)
    shadow_text(draw, (60, H - 230), "19496 Tumalo Reservoir Rd  ·  Tumalo, Oregon", addr)
    spec = azo(20)
    shadow_text(draw, (60, H - 195), "3 BD  ·  3 BA  ·  2,325 SQFT  ·  2.28 ACRES  ·  $1,225,000", spec, fill=(225, 215, 190))

    out = img.convert("RGB")
    dst = OUT / "S3-open-house.jpg"
    out.save(dst, "JPEG", quality=92, optimize=True)
    print(f"  S3  →  {dst.name} ({dst.stat().st_size // 1024} KB)")


# ── S4 — COMING SOON ────────────────────────────────────────────────────────

def s4_coming_soon():
    src = SRC / "GROUNDS_1.jpg"
    img = Image.open(src).convert("RGB")
    img = smart_crop_to_portrait(img, focus_y=0.4)
    img = gentle_polish(img)
    # Add a subtle full-frame slight desaturation/darken for teaser mood
    img = ImageEnhance.Brightness(img).enhance(0.85)
    img = bottom_scrim(img, height_pct=0.35, max_alpha=130)
    img = top_scrim(img, height_pct=0.30, max_alpha=110)

    draw = ImageDraw.Draw(img)

    # Eyebrow top
    eb = azo(22)
    tracked_text(draw, (60, 60), "COMING SOON", eb, fill=CREAM, tracking_em=0.22, shadow=True)
    tw = measure_tracked(draw, "COMING SOON", eb, 0.22)
    draw.line([(60, 100), (60 + tw, 100)], fill=CREAM, width=1)

    # Subtitle top right corner
    sub_eb = azo(20)
    teaser_text = "TUMALO  ·  SUMMER 2026"
    tw2 = measure_tracked(draw, teaser_text, sub_eb, 0.18)
    tracked_text(draw, (W - tw2 - 60, 62), teaser_text, sub_eb, fill=CREAM, tracking_em=0.18, shadow=True)

    # Center-large Amboqia teaser
    teaser_font = amboqia(64)
    line1, line2, line3 = "A 2.28-Acre Tumalo", "Retreat with Cascade", "Views — Listing Soon"
    by = H - 360
    for line in (line1, line2, line3):
        shadow_text(draw, (60, by), line, teaser_font)
        bbox = draw.textbbox((0, 0), line, font=teaser_font)
        by += (bbox[3] - bbox[1]) + 8

    out = img.convert("RGB")
    dst = OUT / "S4-coming-soon.jpg"
    out.save(dst, "JPEG", quality=92, optimize=True)
    print(f"  S4  →  {dst.name} ({dst.stat().st_size // 1024} KB)")


# ── S5 — PRICE IMPROVEMENT ──────────────────────────────────────────────────

def s5_price_improvement():
    src = SRC / "AERIAL_DUSK_1.jpg"
    img = Image.open(src).convert("RGB")
    img = smart_crop_to_portrait(img, focus_y=0.45)
    img = gentle_polish(img)
    img = bottom_scrim(img, height_pct=0.55, max_alpha=150)

    draw = ImageDraw.Draw(img)

    # Eyebrow
    eb = azo(22)
    tracked_text(draw, (60, 60), "NEW PRICE", eb, fill=CREAM, tracking_em=0.22, shadow=True)
    tw = measure_tracked(draw, "NEW PRICE", eb, 0.22)
    draw.line([(60, 100), (60 + tw, 100)], fill=CREAM, width=1)

    # Old price strikethrough
    old_font = amboqia(56)
    old_text = "$1,295,000"
    old_y = H - 400
    # render in dim cream
    draw.text((60, old_y), old_text, font=old_font, fill=(200, 190, 175))
    # strikethrough line through middle of text
    bbox = draw.textbbox((60, old_y), old_text, font=old_font)
    mid_y = (bbox[1] + bbox[3]) // 2 + 4
    draw.line([(bbox[0] - 4, mid_y), (bbox[2] + 4, mid_y)], fill=(200, 190, 175), width=3)

    # New price — big Amboqia
    new_font = amboqia(110)
    shadow_text(draw, (60, H - 320), "$1,225,000", new_font)

    # Address + spec
    addr = azo(24)
    shadow_text(draw, (60, H - 180), "19496 Tumalo Reservoir Rd  ·  Tumalo, Oregon", addr)
    spec = azo(20)
    shadow_text(draw, (60, H - 145), "3 BD  ·  3 BA  ·  2,325 SQFT  ·  2.28 ACRES", spec, fill=(225, 215, 190))

    out = img.convert("RGB")
    dst = OUT / "S5-price-improvement.jpg"
    out.save(dst, "JPEG", quality=92, optimize=True)
    print(f"  S5  →  {dst.name} ({dst.stat().st_size // 1024} KB)")


# ── S6 — FEATURED LISTING OF THE WEEK ───────────────────────────────────────

def s6_featured_listing():
    src = SRC / "AERIAL_DUSK_1.jpg"
    img = Image.open(src).convert("RGB")
    img = smart_crop_to_portrait(img, focus_y=0.45)
    img = gentle_polish(img)
    img = top_scrim(img, height_pct=0.42, max_alpha=130)

    draw = ImageDraw.Draw(img)

    # Eyebrow — top, centered
    eb = azo(20)
    eyebrow_text = "RYAN REALTY  ·  LISTING OF THE WEEK"
    tw = measure_tracked(draw, eyebrow_text, eb, 0.20)
    ex = (W - tw) // 2
    tracked_text(draw, (ex, 70), eyebrow_text, eb, fill=CREAM, tracking_em=0.20, shadow=True)
    draw.line([(ex, 108), (ex + tw, 108)], fill=CREAM, width=1)

    # Italic-style editorial headline — top third
    h_font = amboqia(72)
    line1, line2 = "A Tumalo Retreat", "with Cascade Views"
    # left-aligned
    headline_x = 60
    headline_y = 160
    shadow_text(draw, (headline_x, headline_y), line1, h_font)
    bbox = draw.textbbox((0, 0), line1, font=h_font)
    shadow_text(draw, (headline_x, headline_y + (bbox[3] - bbox[1]) + 6), line2, h_font)

    # Price line conversational
    price_font = amboqia(36)
    shadow_text(draw, (headline_x, headline_y + 175), "Offered at $1,225,000", price_font, fill=(240, 230, 210))

    out = img.convert("RGB")
    dst = OUT / "S6-featured-listing.jpg"
    out.save(dst, "JPEG", quality=92, optimize=True)
    print(f"  S6  →  {dst.name} ({dst.stat().st_size // 1024} KB)")


# ── S7 — AGENT INTRO / SPOTLIGHT ────────────────────────────────────────────

def s7_agent_intro():
    # Cream background w/ transparent broker portrait, name block in clean lower zone
    img = Image.new("RGB", (W, H), CREAM_FILL)

    # Paste transparent Matt PNG — sized so it occupies upper 60% of frame
    # Source is 800x1200 → fit so portrait bottom lands at y=820 with no overlap into name zone
    if MATT_PNG.exists():
        portrait = Image.open(MATT_PNG).convert("RGBA")
        # Constrain by height so portrait bottom doesn't reach the name zone
        target_h = 820  # portrait fits in y=0 to y=820
        ratio = target_h / portrait.size[1]
        target_w = int(portrait.size[0] * ratio)
        portrait = portrait.resize((target_w, target_h), Image.LANCZOS)
        # Center horizontally
        px = (W - target_w) // 2
        py = 60  # small top margin, leaves eyebrow space
        img = img.convert("RGBA")
        img.paste(portrait, (px, py), portrait)
        img = img.convert("RGB")

    draw = ImageDraw.Draw(img)

    # Eyebrow top (rendered AFTER portrait so it sits cleanly over cream margin)
    eb = azo(22)
    tracked_text(draw, (60, 60), "MEET YOUR BROKER", eb, fill=NAVY, tracking_em=0.20)
    tw = measure_tracked(draw, "MEET YOUR BROKER", eb, 0.20)
    draw.line([(60, 100), (60 + tw, 100)], fill=NAVY, width=1)

    # Hairline divider separating portrait zone from name zone
    div_y = 920
    draw.line([(180, div_y), (W - 180, div_y)], fill=(16, 39, 66, 64), width=1)

    # Name — Amboqia headline, centered in lower zone
    name_font = amboqia(86)
    name_text = "Matt Ryan"
    bbox = draw.textbbox((0, 0), name_text, font=name_font)
    name_w = bbox[2] - bbox[0]
    name_y = div_y + 50
    draw.text(((W - name_w) // 2, name_y), name_text, font=name_font, fill=NAVY)

    # Role
    role_font = azo(26)
    role_text = "Principal broker  ·  Ryan Realty"
    bbox = draw.textbbox((0, 0), role_text, font=role_font)
    role_w = bbox[2] - bbox[0]
    role_y = name_y + 110
    draw.text(((W - role_w) // 2, role_y), role_text, font=role_font, fill=NAVY)

    # Sub-line
    sub_font = azo(22)
    sub_text = "Bend  ·  Tumalo  ·  Central Oregon"
    bbox = draw.textbbox((0, 0), sub_text, font=sub_font)
    sub_w = bbox[2] - bbox[0]
    draw.text(((W - sub_w) // 2, role_y + 42), sub_text, font=sub_font, fill=(80, 90, 110))

    out = img.convert("RGB")
    dst = OUT / "S7-agent-intro.jpg"
    out.save(dst, "JPEG", quality=92, optimize=True)
    print(f"  S7  →  {dst.name} ({dst.stat().st_size // 1024} KB)")


# ── S8 — BRAG STAT / BIG NUMBER ─────────────────────────────────────────────

def s8_brag_stat():
    src = SRC / "AERIAL_DUSK_2.jpg"
    img = Image.open(src).convert("RGB")
    img = smart_crop_to_portrait(img, focus_y=0.5)
    img = gentle_polish(img)
    # Heavy full-frame darken for moody wallpaper feel
    img = ImageEnhance.Brightness(img).enhance(0.65)
    img = ImageEnhance.Color(img).enhance(0.85)

    draw = ImageDraw.Draw(img)

    # Eyebrow top
    eb = azo(20)
    tracked_text(draw, (60, 60), "RYAN REALTY  ·  YEAR-TO-DATE  ·  2026", eb, fill=CREAM, tracking_em=0.18, shadow=True)

    # Huge stat — centered
    big_font = amboqia(220)
    big_text = "$42M"
    bbox = draw.textbbox((0, 0), big_text, font=big_font)
    bw = bbox[2] - bbox[0]
    bh = bbox[3] - bbox[1]
    big_x = (W - bw) // 2
    big_y = (H - bh) // 2 - 60
    shadow_text(draw, (big_x, big_y), big_text, big_font, fill=CREAM)

    # Sub-line
    sub_font = amboqia(32)
    sub_text = "in Central Oregon sales"
    bbox = draw.textbbox((0, 0), sub_text, font=sub_font)
    sw = bbox[2] - bbox[0]
    shadow_text(draw, ((W - sw) // 2, big_y + bh + 30), sub_text, sub_font, fill=(240, 230, 210))

    # Footnote bottom
    foot_font = azo(18)
    foot_text = "January — April 2026  ·  Source: Vault"
    bbox = draw.textbbox((0, 0), foot_text, font=foot_font)
    fw = bbox[2] - bbox[0]
    shadow_text(draw, ((W - fw) // 2, H - 110), foot_text, foot_font, fill=(220, 210, 190))

    out = img.convert("RGB")
    dst = OUT / "S8-brag-stat.jpg"
    out.save(dst, "JPEG", quality=92, optimize=True)
    print(f"  S8  →  {dst.name} ({dst.stat().st_size // 1024} KB)")


# ── S9 — PRESS FEATURE ──────────────────────────────────────────────────────

def s9_press_feature():
    # Cream background with newspaper-like masthead at top, photo lower, caption
    img = Image.new("RGB", (W, H), CREAM_FILL)
    draw = ImageDraw.Draw(img)

    # Masthead block — black bar
    draw.rectangle([(0, 0), (W, 180)], fill=NAVY)
    # Masthead title
    masthead_font = amboqia(54)
    masthead_text = "Source Weekly"
    bbox = draw.textbbox((0, 0), masthead_text, font=masthead_font)
    mw = bbox[2] - bbox[0]
    draw.text(((W - mw) // 2, 50), masthead_text, font=masthead_font, fill=CREAM)
    # Issue sub
    issue_font = azo(18)
    issue_text = "BEND, OREGON  ·  MAY 14, 2026"
    tw_issue = measure_tracked(draw, issue_text, issue_font, 0.20)
    tracked_text(draw, ((W - tw_issue) // 2, 130), issue_text, issue_font, fill=CREAM, tracking_em=0.20)

    # Photo of Matt's primary aerial — placed centered
    src_photo = SRC / "AERIAL_DUSK_1.jpg"
    photo = Image.open(src_photo).convert("RGB")
    # Crop to 3:2 landscape
    pw, ph = 900, 600
    photo = smart_crop_to_portrait(photo, pw, ph, focus_y=0.5)
    photo_x = (W - pw) // 2
    photo_y = 280
    img.paste(photo, (photo_x, photo_y))

    # Caption / story headline below photo
    story_eb = azo(20)
    eyebrow = "REAL ESTATE  ·  CENTRAL OREGON"
    tw_eb = measure_tracked(draw, eyebrow, story_eb, 0.18)
    tracked_text(draw, ((W - tw_eb) // 2, 950), eyebrow, story_eb, fill=NAVY, tracking_em=0.18)

    story_font = amboqia(48)
    headline = "Ryan Realty's Tumalo Listing"
    bbox = draw.textbbox((0, 0), headline, font=story_font)
    hw = bbox[2] - bbox[0]
    draw.text(((W - hw) // 2, 990), headline, font=story_font, fill=NAVY)

    headline2 = "Captures What's Drawing Buyers"
    bbox = draw.textbbox((0, 0), headline2, font=story_font)
    hw2 = bbox[2] - bbox[0]
    draw.text(((W - hw2) // 2, 1050), headline2, font=story_font, fill=NAVY)

    # Body sub
    body_font = azo(22)
    body_text = "Matt Ryan on what 2026 buyers want in Central Oregon."
    bbox = draw.textbbox((0, 0), body_text, font=body_font)
    bw = bbox[2] - bbox[0]
    draw.text(((W - bw) // 2, 1140), body_text, font=body_font, fill=(50, 60, 80))

    # Footer
    foot_font = azo(16)
    foot_text = "AS SEEN IN SOURCE WEEKLY"
    tw_f = measure_tracked(draw, foot_text, foot_font, 0.22)
    tracked_text(draw, ((W - tw_f) // 2, 1230), foot_text, foot_font, fill=(50, 60, 80), tracking_em=0.22)

    out = img.convert("RGB")
    dst = OUT / "S9-press-feature.jpg"
    out.save(dst, "JPEG", quality=92, optimize=True)
    print(f"  S9  →  {dst.name} ({dst.stat().st_size // 1024} KB)")


# ── S10 — MARKET DATA CARD ──────────────────────────────────────────────────

def s10_market_data():
    img = Image.new("RGB", (W, H), CREAM_FILL)
    draw = ImageDraw.Draw(img)

    # Top eyebrow
    eb = azo(22)
    eyebrow = "BEND MARKET  ·  APRIL 2026"
    tw = measure_tracked(draw, eyebrow, eb, 0.20)
    tracked_text(draw, ((W - tw) // 2, 120), eyebrow, eb, fill=NAVY, tracking_em=0.20)
    # Hairline
    line_y = 165
    draw.line([((W - tw) // 2, line_y), ((W + tw) // 2, line_y)], fill=NAVY, width=1)

    # Sub-context
    sub_font = amboqia(36)
    sub_text = "Median Sale Price"
    bbox = draw.textbbox((0, 0), sub_text, font=sub_font)
    sw = bbox[2] - bbox[0]
    draw.text(((W - sw) // 2, 240), sub_text, font=sub_font, fill=NAVY)

    # The big number
    big_font = amboqia(200)
    big_text = "$745K"
    bbox = draw.textbbox((0, 0), big_text, font=big_font)
    bw = bbox[2] - bbox[0]
    bh = bbox[3] - bbox[1]
    draw.text(((W - bw) // 2, 340), big_text, font=big_font, fill=NAVY)

    # YoY arrow + delta — Amboqia doesn't include U+2191 ↑ glyph,
    # so we draw the arrow as a triangle shape and render the text in Azo Sans
    # which has fuller numeral + percent glyph coverage.
    delta_font = azo(46)
    delta_text = "2.1% YoY"
    bbox = draw.textbbox((0, 0), delta_text, font=delta_font)
    dw = bbox[2] - bbox[0]
    # Arrow triangle to the left of the text
    arrow_size = 28
    arrow_gap = 18
    total_w = arrow_size + arrow_gap + dw
    arrow_x = (W - total_w) // 2
    arrow_cy = 640
    # Up-pointing triangle (filled navy)
    draw.polygon(
        [
            (arrow_x + arrow_size // 2, arrow_cy - arrow_size // 2),
            (arrow_x, arrow_cy + arrow_size // 2),
            (arrow_x + arrow_size, arrow_cy + arrow_size // 2),
        ],
        fill=NAVY,
    )
    text_x = arrow_x + arrow_size + arrow_gap
    text_y = arrow_cy - delta_font.size // 2 + 2
    draw.text((text_x, text_y), delta_text, font=delta_font, fill=NAVY)

    # Hairline
    draw.line([(W // 2 - 40, 700), (W // 2 + 40, 700)], fill=(16, 39, 66, 80), width=1)

    # Context paragraph
    ctx_font = azo(22)
    ctx_lines = [
        "188 single-family homes closed in Bend",
        "in April 2026 — eight days slower",
        "than the prior year. Inventory now sits",
        "at 3.2 months of supply.",
    ]
    cy = 760
    for line in ctx_lines:
        bbox = draw.textbbox((0, 0), line, font=ctx_font)
        lw = bbox[2] - bbox[0]
        draw.text(((W - lw) // 2, cy), line, font=ctx_font, fill=(40, 50, 70))
        cy += (bbox[3] - bbox[1]) + 8

    # Footer with source
    foot_font = azo(18)
    foot_text = "SOURCE: ORMLS · RYAN REALTY"
    tw_f = measure_tracked(draw, foot_text, foot_font, 0.20)
    tracked_text(draw, ((W - tw_f) // 2, H - 130), foot_text, foot_font, fill=(40, 50, 70), tracking_em=0.20)

    out = img.convert("RGB")
    dst = OUT / "S10-market-data.jpg"
    out.save(dst, "JPEG", quality=92, optimize=True)
    print(f"  S10  →  {dst.name} ({dst.stat().st_size // 1024} KB)")


# ── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"Output → {OUT}")
    s1_just_listed()
    s2_just_sold()
    s3_open_house()
    s4_coming_soon()
    s5_price_improvement()
    s6_featured_listing()
    s7_agent_intro()
    s8_brag_stat()
    s9_press_feature()
    s10_market_data()
    print("\nDone.")
