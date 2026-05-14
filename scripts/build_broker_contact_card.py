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

# Broker registry — locked contact info, single source of truth
BROKERS = {
    "matt-ryan": {
        "name": "Matt Ryan",
        "role": "Owner · Principal Broker",
        "phone": "541.213.6706",
        "phone_label": "direct",
        "email": "matt@ryan-realty.com",
        "license": "OR #201206613",
        "portrait": TEAM / "matt-ryan.png",
    },
    "paul-stevenson": {
        "name": "Paul Stevenson",
        "role": "Principal Broker",
        "phone": "541.213.6706",
        "phone_label": "office",
        "email": "paul@ryan-realty.com",
        "license": "OR",
        "portrait": TEAM / "paul-stevenson.png",
    },
    "rebecca-peterson": {
        "name": "Rebecca Peterson",
        "role": "Principal Broker",
        "phone": "415.308.9087",
        "phone_label": "direct",
        "email": "rebeccapeterson@ryan-realty.com",
        "license": "OR #201254727",
        "portrait": TEAM / "rebecca-peterson.png",
    },
}

# Tagline by moment
TAGLINES = {
    "buyer":   "Looking for the right home in Bend?",
    "seller":  "Considering selling your home in Bend?",
    "generic": "Real estate done right — in Bend, Oregon.",
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
    if broker_slug not in BROKERS:
        raise ValueError(f"Unknown broker '{broker_slug}'. Known: {list(BROKERS)}")
    b = BROKERS[broker_slug]
    tagline = TAGLINES.get(moment, TAGLINES["generic"])

    # Canvas
    img = Image.new("RGBA", (W, H), CREAM + (255,))
    draw = ImageDraw.Draw(img)

    # ─── Top: Ryan Realty wordmark ───────────────────────────────────────────
    logo = Image.open(LOGO_BLUE).convert("RGBA")
    logo_w = 420
    logo_h = int(logo.size[1] * (logo_w / logo.size[0]))
    logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
    img.paste(logo, ((W - logo_w) // 2, 80), logo)
    logo_bottom_y = 80 + logo_h

    # ─── Hairline divider under logo ─────────────────────────────────────────
    div_y = logo_bottom_y + 36
    draw.line([(W // 2 - 60, div_y), (W // 2 + 60, div_y)], fill=NAVY + (60,), width=1)

    # ─── Tagline (Azo Sans Medium tracked uppercase) ─────────────────────────
    tag_font = azo(18)
    tag_w = measure_tracked(draw, tagline.upper(), tag_font, tracking_em=0.16)
    tracked_text(draw, ((W - tag_w) // 2, div_y + 28), tagline.upper(), tag_font,
                 fill=NAVY + (180,), tracking_em=0.16)

    # ─── Broker portrait (transparent PNG, centered) ─────────────────────────
    if not b["portrait"].exists():
        raise FileNotFoundError(f"Broker portrait not found: {b['portrait']}")
    portrait = Image.open(b["portrait"]).convert("RGBA")
    portrait_h = 580
    scale = portrait_h / portrait.size[1]
    portrait_w = int(portrait.size[0] * scale)
    portrait = portrait.resize((portrait_w, portrait_h), Image.LANCZOS)
    portrait_y = div_y + 72
    img.paste(portrait, ((W - portrait_w) // 2, portrait_y), portrait)

    # ─── Broker name (Amboqia) ───────────────────────────────────────────────
    name_y = portrait_y + portrait_h + 24
    name_font = amboqia(72)
    name_bbox = draw.textbbox((0, 0), b["name"], font=name_font)
    name_w = name_bbox[2] - name_bbox[0]
    draw.text(((W - name_w) // 2, name_y), b["name"], font=name_font, fill=NAVY)

    # ─── Role (Geist-style via Azo Sans Medium small) ────────────────────────
    role_y = name_y + 90
    role_font = azo(20)
    role_w = measure_tracked(draw, b["role"].upper(), role_font, 0.14)
    tracked_text(draw, ((W - role_w) // 2, role_y), b["role"].upper(), role_font,
                 fill=NAVY + (150,), tracking_em=0.14)

    # ─── Contact line: phone · email ─────────────────────────────────────────
    contact_y = role_y + 56
    contact_font = azo(22)
    phone_str = b["phone"]
    email_str = b["email"]
    # Phone on its own line
    phone_bbox = draw.textbbox((0, 0), phone_str, font=contact_font)
    phone_w = phone_bbox[2] - phone_bbox[0]
    draw.text(((W - phone_w) // 2, contact_y), phone_str, font=contact_font, fill=NAVY)

    # Email on the next line, smaller
    email_font = azo(18)
    email_bbox = draw.textbbox((0, 0), email_str, font=email_font)
    email_w = email_bbox[2] - email_bbox[0]
    draw.text(((W - email_w) // 2, contact_y + 36), email_str, font=email_font, fill=NAVY + (180,))

    # ─── Save ────────────────────────────────────────────────────────────────
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(output_path, "JPEG", quality=92, optimize=True)
    print(f"  Wrote {output_path} ({Path(output_path).stat().st_size // 1024} KB)")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: build_broker_contact_card.py <broker-slug> <output.jpg> [moment]")
        print(f"brokers: {list(BROKERS)}")
        print(f"moments: {list(TAGLINES)}")
        sys.exit(1)
    broker = sys.argv[1]
    out = sys.argv[2]
    moment = sys.argv[3] if len(sys.argv) > 3 else "buyer"
    build_card(broker, out, moment)
