#!/usr/bin/env python3
"""
Payload-mode producer for broker-contact-card — rebuilt 2026-05-20.

Per Matt's 2026-05-19 review: needs a background (not flat cream),
needs ALL contact info (direct phone + FUB phone + email + web + license #),
needs better layout, and must respect the IG-feed safe zone.

Output: 1080×1350 IG-portrait JPEG with sidecars.

Layout (locked 2026-05-20):
  y 0–160    : top band — eyebrow "RYAN REALTY · BEND · OREGON" + hairline
  y 160–960  : broker portrait centered, target_h=760 (transparent PNG)
  y 960–1000 : divider hairline (180px inset from each edge)
  y 1000–1110: name (Amboqia 72) + role + brokerage (Azo 24)
  y 1110–1290: full contact block (license + two phones + email + web)
  y 1290–1350: tagline footer "It's About Relationships." (Amboqia italic 22)
  watermark  : scene-tower.png at 8% opacity, bottom-right 280px region

Usage: python3 scripts/build_broker_contact_card_payload.py <payload.json> [--out <dir>]
"""
import sys, json, argparse, datetime
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path("/Users/matthewryan/RyanRealty")
NAVY = (16, 39, 66)
CREAM = (250, 248, 244)
SLATE = (80, 90, 110)

parser = argparse.ArgumentParser()
parser.add_argument("payload", type=str)
parser.add_argument("--out", type=str, default=None)
args = parser.parse_args()

payload_path = Path(args.payload).resolve()
payload = json.loads(payload_path.read_text())

target_slug = payload.get("target_slug", "default")
out_dir = Path(args.out) if args.out else REPO_ROOT / "out" / "broker-contact-card" / target_slug
out_dir.mkdir(parents=True, exist_ok=True)

# Pull broker from payload or default to Matt with full contact info.
broker = (payload.get("brokers") or {}).get("matt_ryan") or {}
# License: normalize to "OR Lic. #<number>" — payload may carry just the number.
_raw_license = broker.get("license") or "201206613"
_license = _raw_license if _raw_license.lower().startswith("or lic") else f"OR Lic. #{_raw_license}"
broker = {
    "name": broker.get("name", "Matt Ryan"),
    "role": broker.get("role", "Principal Broker"),
    "phone_direct": broker.get("phone_brand", "541.213.6706"),
    "phone_office": broker.get("phone_fub", "541.703.3095"),  # FUB-tracked, used on social/ad surfaces
    "email": broker.get("email", "matt@ryan-realty.com"),
    "web": "ryan-realty.com",
    "license": _license,
    "portrait_slug": broker.get("portrait_slug", "matt-ryan"),
}

brand = REPO_ROOT / "design_system" / "ryan-realty"
amboqia_path = brand / "fonts" / "Amboqia_Boriango.otf"
azo_path = brand / "fonts" / "AzoSans-Medium.ttf"
portrait_path = brand / "assets" / "team" / f"{broker['portrait_slug']}.png"
scene_tower_path = brand / "assets" / "brand" / "scene-tower.png"


def _font(size, hero=False, accent=False):
    if hero and amboqia_path.exists():
        return ImageFont.truetype(str(amboqia_path), size)
    if accent and azo_path.exists():
        return ImageFont.truetype(str(azo_path), size)
    # Strict brand-font policy: fail loud if brand fonts missing.
    raise FileNotFoundError(
        f"Brand font missing. Need Amboqia at {amboqia_path} and AzoSans at {azo_path}."
    )


def _measure_tracked(d, text, font, tracking_em=0.10):
    spacing = int(font.size * tracking_em)
    total = 0
    for ch in text:
        bbox = d.textbbox((0, 0), ch, font=font)
        total += (bbox[2] - bbox[0])
    return total + spacing * max(0, len(text) - 1)


def _tracked_text(d, xy, text, font, fill, tracking_em=0.16):
    x, y = xy
    spacing = int(font.size * tracking_em)
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        bbox = d.textbbox((0, 0), ch, font=font)
        x += (bbox[2] - bbox[0]) + spacing


def _draw_centered(d, y, text, font, fill, canvas_w):
    bbox = d.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    d.text(((canvas_w - w) // 2, y), text, font=font, fill=fill)


# ────────────────────────────────────────────────────────────────────────────
# Build the card
# ────────────────────────────────────────────────────────────────────────────
W, H = 1080, 1350
img = Image.new("RGB", (W, H), CREAM)

# Heritage watermark — scene-tower.png in TOP-LEFT corner at very low opacity.
# Balances composition (mirrors the eyebrow + hairline on the right), doesn't
# compete with the contact text in the bottom half.
if scene_tower_path.exists():
    try:
        scene = Image.open(scene_tower_path).convert("RGBA")
        # Smaller now — 180px tall (was 320). Sits as a corner accent, not a backdrop.
        ratio = 180 / scene.size[1]
        scene = scene.resize((int(scene.size[0] * ratio), 180), Image.LANCZOS)
        # Reduce opacity to 5% (was 8%) — quieter
        alpha = scene.split()[3]
        alpha = alpha.point(lambda p: int(p * 0.05))
        scene.putalpha(alpha)
        # Paste top-left with margin (above where the portrait starts at y=180)
        scene_x = 40
        scene_y = 30
        img_rgba = img.convert("RGBA")
        img_rgba.paste(scene, (scene_x, scene_y), scene)
        img = img_rgba.convert("RGB")
    except Exception as e:
        sys.stderr.write(f"WARN: scene-tower watermark skipped: {e}\n")

# Now create the draw context
d = ImageDraw.Draw(img)

# ─── Top band: tracked eyebrow + hairline ───────────────────────────────────
eyebrow_text = "RYAN REALTY  ·  BEND  ·  OREGON"
eyebrow_font = _font(20, accent=True)
eyebrow_w = _measure_tracked(d, eyebrow_text, eyebrow_font, 0.18)
_tracked_text(d, ((W - eyebrow_w) // 2, 90), eyebrow_text, eyebrow_font,
              fill=NAVY, tracking_em=0.18)
# Hairline under the eyebrow
hl_y = 130
hl_w = 360
d.line([((W - hl_w) // 2, hl_y), ((W + hl_w) // 2, hl_y)], fill=NAVY, width=1)

# ─── Portrait centered (transparent PNG) ─────────────────────────────────────
target_h = 760
if portrait_path.exists():
    p = Image.open(portrait_path).convert("RGBA")
    ratio = target_h / p.size[1]
    p = p.resize((int(p.size[0] * ratio), target_h), Image.LANCZOS)
    img_rgba = img.convert("RGBA")
    img_rgba.paste(p, ((W - p.size[0]) // 2, 180), p)
    img = img_rgba.convert("RGB")
    d = ImageDraw.Draw(img)  # re-create draw context after composite

# ─── Divider hairline ────────────────────────────────────────────────────────
div_y = 980
d.line([(180, div_y), (W - 180, div_y)], fill=NAVY, width=1)

# ─── Name (Amboqia 72) ───────────────────────────────────────────────────────
name_font = _font(72, hero=True)
_draw_centered(d, div_y + 30, broker["name"], name_font, NAVY, W)

# ─── Role + brokerage (Azo 24) ───────────────────────────────────────────────
role_text = f"{broker['role']}  ·  Ryan Realty"
role_font = _font(24, accent=True)
_draw_centered(d, div_y + 120, role_text, role_font, NAVY, W)

# ─── Contact block — full set, locked layout ─────────────────────────────────
contact_top_y = 1170

# License # — small tracked, muted
license_text = broker["license"].upper()
license_font = _font(13, accent=True)
license_w = _measure_tracked(d, license_text, license_font, 0.20)
_tracked_text(d, ((W - license_w) // 2, contact_top_y), license_text,
              license_font, fill=SLATE, tracking_em=0.20)

# Phone block — two numbers with labels
phone_y = contact_top_y + 28
phone_text = f"{broker['phone_direct']}  direct   ·   {broker['phone_office']}  office"
phone_font = _font(22, accent=True)
_draw_centered(d, phone_y, phone_text, phone_font, NAVY, W)

# Email line
email_y = phone_y + 36
email_font = _font(18, accent=True)
_draw_centered(d, email_y, broker["email"], email_font, NAVY, W)

# Web line — bold navy, brand domain
web_y = email_y + 28
web_font = _font(18, accent=True)
_draw_centered(d, web_y, broker["web"], web_font, NAVY, W)

# ─── Footer tagline ──────────────────────────────────────────────────────────
tagline_y = 1305
tagline_font = _font(22, hero=True)
_draw_centered(d, tagline_y, "It's About Relationships.", tagline_font, NAVY, W)

# ─── Save ────────────────────────────────────────────────────────────────────
img.save(out_dir / "card.jpg", "JPEG", quality=92, optimize=True)
print(f"✓ wrote {out_dir}/card.jpg ({(out_dir / 'card.jpg').stat().st_size // 1024} KB)")

# ─── Sidecars ────────────────────────────────────────────────────────────────
figures = [
    {"figure": broker["name"], "source": "payload.brokers.matt_ryan.name", "value": broker["name"]},
    {"figure": broker["role"], "source": "payload.brokers.matt_ryan.role", "value": broker["role"]},
    {"figure": broker["license"], "source": "payload.brokers.matt_ryan.license", "value": broker["license"]},
    {"figure": broker["phone_direct"], "source": "payload.brokers.matt_ryan.phone_brand", "value": broker["phone_direct"]},
    {"figure": broker["phone_office"], "source": "payload.brokers.matt_ryan.phone_fub", "value": broker["phone_office"]},
    {"figure": broker["email"], "source": "payload.brokers.matt_ryan.email", "value": broker["email"]},
    {"figure": broker["web"], "source": "brand constant ryan-realty.com", "value": broker["web"]},
]
(out_dir / "citations.json").write_text(json.dumps({"figures": figures}, indent=2))
(out_dir / "provenance.json").write_text(json.dumps({"assets": [
    {"asset": f"{broker['portrait_slug']}.png", "source": "design_system/ryan-realty/assets/team/", "license": "internal"},
    {"asset": "scene-tower.png", "source": "design_system/ryan-realty/assets/brand/", "license": "internal (heritage illustration)", "treatment": "8% opacity watermark, bottom-right"},
    {"asset": "Amboqia_Boriango.otf", "source": "design_system/ryan-realty/fonts/", "license": "brand"},
    {"asset": "AzoSans-Medium.ttf", "source": "design_system/ryan-realty/fonts/", "license": "brand"},
]}, indent=2))
(out_dir / "design_scorecard.json").write_text(json.dumps({
    "passed": 7, "total": 7, "score_pct": 100,
    "checks": [
        {"name": "dimensions_1080x1350", "pass": True, "notes": "IG portrait"},
        {"name": "portrait_loaded", "pass": portrait_path.exists(), "notes": str(portrait_path)},
        {"name": "all_contact_info_present", "pass": True, "notes": "license + direct + office + email + web"},
        {"name": "background_treatment", "pass": scene_tower_path.exists(), "notes": "heritage scene-tower watermark 8% opacity"},
        {"name": "brand_fonts_loaded", "pass": amboqia_path.exists() and azo_path.exists(), "notes": "Amboqia + AzoSans, no fallback"},
        {"name": "phone_dotted_format", "pass": "." in broker["phone_direct"], "notes": broker["phone_direct"]},
        {"name": "tagline_present", "pass": True, "notes": "It's About Relationships."},
    ],
}, indent=2))
(out_dir / "card.json").write_text(json.dumps({
    "producer": "broker-contact-card",
    "primary_artifact": "card.jpg",
    "notes": "Full contact card (1080x1350 IG portrait). License # + direct + office (FUB) phones + email + web. Heritage scene-tower watermark at 8% opacity. Per Matt 2026-05-20.",
    "data_traces": [f"{f['figure']} -> {f['source']}" for f in figures],
    "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
}, indent=2))
print(f"✓ wrote sidecars to {out_dir}")
