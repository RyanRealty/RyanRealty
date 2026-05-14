#!/usr/bin/env python3
"""
Broker Contact Card · NEW SKILL · locked 2026-05-14
====================================================
Buyer-side last tile for IG sequences. Replaces the multi-photo Pattern A
carousel for any post where Ryan Realty represented the BUYERS (not the
listing). The listing isn't ours to sell; our service is. So the brand +
broker IS the message.

Matt's directive 2026-05-14:
  "For buyer side listing stuff, we're going to do the single tiles, and
   that last tile will be the broker photo and the broker branding
   essentially. We'll remove all of the longer property carousels."

Output: 1080×1350 IG slide — cream background, Ryan Realty wordmark top,
broker portrait centered, name + role + contact at bottom.

Usage:
  python3 scripts/build_broker_contact_card.py <broker-slug> <output-path> [moment]

  broker-slug: matt-ryan | paul-stevenson | rebecca-peterson
  moment:      buyer | seller | generic  (changes the tagline)
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import sys

W, H = 1080, 1350
NAVY = (16, 39, 66)
CREAM = (250, 248, 244)
SAND = (232, 226, 212)

BRAND = Path("/Users/matthewryan/RyanRealty/design_system/ryan-realty")
AMBOQIA = BRAND / "fonts" / "Amboqia_Boriango.otf"
AZO = BRAND / "fonts" / "AzoSans-Medium.ttf"

LOGO_BLUE = BRAND / "assets" / "brand" / "logo-blue.png"
TEAM = BRAND / "assets" / "team"

# Broker registry — locked contact info, single source of truth.
# Roles per CLAUDE.md "Design system v2 / Broker headshots" + Matt's
# correction 2026-05-14 (Rebecca is Broker, not Principal Broker).
# Licenses sourced from Spark API agent fields + CLAUDE.md memory.
BROKERS = {
    "matt-ryan": {
        "name": "Matt Ryan",
        "role": "Principal Broker",
        "phone": "541.213.6706",
        "email": "matt@ryan-realty.com",
        "license": "OR Lic. #201206613",
        "portrait": TEAM / "matt-ryan.png",
    },
    "paul-stevenson": {
        "name": "Paul Stevenson",
        "role": "Broker",
        "phone": "541.213.6706",
        "email": "paul@ryan-realty.com",
        "license": None,  # placeholder until verified — surface to Matt if used
        "portrait": TEAM / "paul-stevenson.png",
    },
    "rebecca-peterson": {
        "name": "Rebecca Peterson",
        "role": "Broker",
        "phone": "415.308.9087",
        "email": "rebeccapeterson@ryan-realty.com",
        "license": "OR Lic. #201254727",
        "portrait": TEAM / "rebecca-peterson.png",
    },
}

# Service-line by moment — short, single line under the name block
SERVICE_LINES = {
    "buyer":   "Buyer Representation · Bend & Central Oregon",
    "seller":  "Seller Representation · Bend & Central Oregon",
    "generic": "Real Estate · Bend & Central Oregon",
    # buyer-sold = closing celebration for a buyer-side deal; gratitude tone per Matt's voice
    "buyer-sold": "Buyer Representation · Bend & Central Oregon",
}

# Gratitude line — Matt's voice (from GBP corpus): genuinely, honored, privilege,
# trust, finish line, mean the world. Keep it short, never gushy.
GRATITUDE_LINES = {
    "buyer":       "Grateful for the trust of these buyers.",
    "buyer-sold":  "Honored to have represented the buyers in this transaction.",
    "seller":      "Grateful for the trust of these sellers.",
    "seller-sold": "Honored to have represented the sellers in this transaction.",
    "generic":     None,
}

# Call-to-action — every buyer-side or seller-side card carries one. Direct + warm,
# no hype, no fake-urgency words. Per voice_guidelines.md.
CTA_LINES = {
    "buyer":       "CONSIDERING A HOME IN BEND  ·  REACH OUT ANYTIME",
    "buyer-sold":  "CONSIDERING A HOME IN BEND  ·  REACH OUT ANYTIME",
    "seller":      "CONSIDERING SELLING IN BEND  ·  REACH OUT ANYTIME",
    "seller-sold": "CONSIDERING SELLING IN BEND  ·  REACH OUT ANYTIME",
    "generic":     None,
}

def amboqia(s): return ImageFont.truetype(str(AMBOQIA), s)
def azo(s):     return ImageFont.truetype(str(AZO), s)


def paste_centered(canvas, img, x_center, y_top, target_h=None):
    """Paste an RGBA image onto canvas centered horizontally; img scaled to target_h if given."""
    if target_h:
        scale = target_h / img.size[1]
        new_w = int(img.size[0] * scale)
        img = img.resize((new_w, target_h), Image.LANCZOS)
    x = x_center - img.size[0] // 2
    canvas.paste(img, (x, y_top), img)


def measure_tracked(draw, text, font, tracking_em=0.10):
    spacing = int(font.size * tracking_em)
    total = 0
    for ch in text:
        bbox = draw.textbbox((0, 0), ch, font=font)
        total += (bbox[2] - bbox[0])
    total += spacing * max(0, len(text) - 1)
    return total


def tracked_text(d, xy, text, font, fill, tracking_em=0.16):
    x, y = xy
    spacing = int(font.size * tracking_em)
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        bbox = d.textbbox((0, 0), ch, font=font)
        x += (bbox[2] - bbox[0]) + spacing


def build_card(broker_slug, output_path, moment="buyer"):
    """
    Broker Contact Card v3 — locked 2026-05-14.
    DERIVED FROM the approved S7 Agent Intro layout in build_single_image_posts.py.
    Matt approved S7 2026-05-12. This card extends S7 by adding a compact
    contact block in the bottom 200 px (license, phone, email).

    DO NOT re-implement layout. DO NOT shuffle elements. If the S7 spec
    changes (e.g. portrait height, name size, divider position), update both
    s7_agent_intro() in build_single_image_posts.py AND this function together.

    S7-derived layout (1080×1350):
      • Cream background.
      • Tracked-uppercase eyebrow top-left (y=60), Azo Sans 22, hairline under at y=100.
        Eyebrow varies by moment: buyer → "YOUR BUYER'S AGENT", seller → "YOUR LISTING AGENT",
        generic → "MEET YOUR BROKER".
      • Transparent broker portrait centered, 820 px tall, top at y=60.
      • Hairline divider centered (180 px from each edge) at y=920.
      • Name centered Amboqia 86 at y=970.
      • Role centered "Broker · Ryan Realty" Azo Sans 26 at y=1080.
      • Sub-line centered "Bend · Tumalo · Central Oregon" Azo Sans 22 muted at y=1122.
      • License # centered tracked Azo Sans 14 navy 55% at y=1170 (NEW vs S7).
      • Phone centered Azo Sans 24 navy at y=1210 (NEW vs S7).
      • Email centered Azo Sans 16 navy 70% at y=1252 (NEW vs S7).
    """
    if broker_slug not in BROKERS:
        raise ValueError(f"Unknown broker '{broker_slug}'. Known: {list(BROKERS)}")
    b = BROKERS[broker_slug]

    # Moment → eyebrow mapping
    eyebrow_text = {
        "buyer":       "YOUR BUYER'S AGENT",
        "buyer-sold":  "REPRESENTED THE BUYERS",
        "seller":      "YOUR LISTING AGENT",
        "seller-sold": "REPRESENTED THE SELLERS",
        "generic":     "MEET YOUR BROKER",
    }.get(moment, "MEET YOUR BROKER")

    # ─── Canvas ─────────────────────────────────────────────────────────────
    img = Image.new("RGB", (W, H), CREAM)

    # ─── Portrait first (paste before drawing eyebrow so eyebrow sits on top) ─
    if not b["portrait"].exists():
        raise FileNotFoundError(f"Broker portrait not found: {b['portrait']}")
    portrait = Image.open(b["portrait"]).convert("RGBA")
    target_h = 820  # IDENTICAL TO S7
    ratio = target_h / portrait.size[1]
    target_w = int(portrait.size[0] * ratio)
    portrait = portrait.resize((target_w, target_h), Image.LANCZOS)
    img_rgba = img.convert("RGBA")
    img_rgba.paste(portrait, ((W - target_w) // 2, 60), portrait)
    img = img_rgba.convert("RGB")

    draw = ImageDraw.Draw(img)

    # ─── Eyebrow top-left (S7 spec) ─────────────────────────────────────────
    eb_font = azo(22)
    tracked_text(draw, (60, 60), eyebrow_text, eb_font, fill=NAVY, tracking_em=0.20)
    eb_w = measure_tracked(draw, eyebrow_text, eb_font, 0.20)
    draw.line([(60, 100), (60 + eb_w, 100)], fill=NAVY, width=1)

    # ─── Hairline divider centered (S7 spec) ────────────────────────────────
    div_y = 920
    draw.line([(180, div_y), (W - 180, div_y)], fill=(16, 39, 66), width=1)

    # ─── Name centered Amboqia (S7 spec) ────────────────────────────────────
    name_font = amboqia(86)
    name_bbox = draw.textbbox((0, 0), b["name"], font=name_font)
    name_w = name_bbox[2] - name_bbox[0]
    name_y = div_y + 50
    draw.text(((W - name_w) // 2, name_y), b["name"], font=name_font, fill=NAVY)

    # ─── Role centered (S7 spec, adapted) ───────────────────────────────────
    role_font = azo(26)
    role_text = f"{b['role']}  ·  Ryan Realty"
    role_bbox = draw.textbbox((0, 0), role_text, font=role_font)
    role_w = role_bbox[2] - role_bbox[0]
    role_y = name_y + 110
    draw.text(((W - role_w) // 2, role_y), role_text, font=role_font, fill=NAVY)

    # ─── Sub-line "Bend · Tumalo · Central Oregon" only on generic moment ────
    # Buyer/seller moments use the bottom budget for license + phone + email +
    # gratitude + CTA, so the geography sub-line gets dropped (it's already
    # implied by the role line "Broker · Ryan Realty").
    if moment == "generic":
        sub_font = azo(22)
        sub_text = "Bend  ·  Tumalo  ·  Central Oregon"
        sub_bbox = draw.textbbox((0, 0), sub_text, font=sub_font)
        sub_w = sub_bbox[2] - sub_bbox[0]
        sub_y = role_y + 42
        draw.text(((W - sub_w) // 2, sub_y), sub_text, font=sub_font, fill=(80, 90, 110))
        last_y = sub_y + 22
    else:
        last_y = role_y + 30

    # ─── Contact + gratitude + CTA block (locked layout) ────────────────────
    # Budget: from last_y + 32 down to H - 60. ~190 px for 5 lines, ~38 px each.
    license_str = b.get("license") or ""
    grat = GRATITUDE_LINES.get(moment)
    cta = CTA_LINES.get(moment)

    y = last_y + 36

    # License # (small tracked)
    if license_str:
        lic_font = azo(13)
        lic_w = measure_tracked(draw, license_str.upper(), lic_font, 0.18)
        tracked_text(draw, ((W - lic_w) // 2, y), license_str.upper(), lic_font,
                     fill=(80, 90, 110), tracking_em=0.18)
        y += 32

    # Phone (medium)
    phone_font = azo(24)
    phone_bbox = draw.textbbox((0, 0), b["phone"], font=phone_font)
    phone_w = phone_bbox[2] - phone_bbox[0]
    draw.text(((W - phone_w) // 2, y), b["phone"], font=phone_font, fill=NAVY)
    y += 38

    # Email (small slate)
    email_font = azo(16)
    email_bbox = draw.textbbox((0, 0), b["email"], font=email_font)
    email_w = email_bbox[2] - email_bbox[0]
    draw.text(((W - email_w) // 2, y), b["email"], font=email_font, fill=(80, 90, 110))
    y += 38

    # Gratitude (Amboqia, softer Matt-voice line)
    if grat:
        grat_font = amboqia(18)
        grat_bbox = draw.textbbox((0, 0), grat, font=grat_font)
        grat_w = grat_bbox[2] - grat_bbox[0]
        if grat_w > W - 80:
            grat_font = amboqia(16)
            grat_bbox = draw.textbbox((0, 0), grat, font=grat_font)
            grat_w = grat_bbox[2] - grat_bbox[0]
        draw.text(((W - grat_w) // 2, y), grat, font=grat_font, fill=NAVY)
        y += 32

    # CTA (tracked uppercase, small, brand stamp at the bottom)
    if cta:
        cta_font = azo(12)
        cta_w = measure_tracked(draw, cta, cta_font, 0.20)
        if cta_w > W - 80:
            tracking = 0.14
            cta_w = measure_tracked(draw, cta, cta_font, tracking)
        else:
            tracking = 0.20
        tracked_text(draw, ((W - cta_w) // 2, y), cta, cta_font,
                     fill=NAVY, tracking_em=tracking)

    # ─── Save ───────────────────────────────────────────────────────────────
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "JPEG", quality=92, optimize=True)
    print(f"  Wrote {output_path} ({Path(output_path).stat().st_size // 1024} KB)")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: build_broker_contact_card.py <broker-slug> <output.jpg> [moment]")
        print(f"brokers: {list(BROKERS)}")
        print(f"moments: buyer | buyer-sold | seller | seller-sold | generic")
        sys.exit(1)
    broker = sys.argv[1]
    out = sys.argv[2]
    moment = sys.argv[3] if len(sys.argv) > 3 else "buyer"
    build_card(broker, out, moment)
