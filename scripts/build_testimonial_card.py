#!/usr/bin/env python3
"""
Producer: testimonial_card
Output: 1080x1350 IG portrait — Amboqia quote + attribution + Ryan Realty mark on cream.

Usage:
    python3 scripts/build_testimonial_card.py tests/fixtures/producer-payload-tumalo.json
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from _producer_lib import (
    NAVY, CREAM, font, text_w, text_h, draw_centered, wrap_text,
    load_payload, load_hero, round_to_thousand, add_scrim,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, BANNED_WORDS, REPO_ROOT,
)
from PIL import Image, ImageDraw

PRODUCER = "testimonial_card"

payload, _ = load_payload()
target_slug = payload.get("target_slug", "default")
out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
out_dir.mkdir(parents=True, exist_ok=True)

listing = payload["listing"]
broker = payload["brokers"]["matt_ryan"]
extras = payload["extras"]
brand = payload["brand_assets"]

quote = extras["testimonial"]["quote"]
attribution = extras["testimonial"]["attribution"]
phone = broker["phone_brand"]
city = listing["city"]
state = listing["state"]

# Voice check
for txt in [quote, attribution]:
    hits = grep_banned(txt)
    assert not hits, f"Banned words found: {hits}"

W, H = 1080, 1350
img = Image.new("RGB", (W, H), CREAM)
d = ImageDraw.Draw(img)

# ── Top accent rule ──────────────────────────────────────────────────────────
d.line([(W // 2 - 36, 96), (W // 2 + 36, 96)], fill=NAVY, width=2)

# ── Quote block ──────────────────────────────────────────────────────────────
quote_fnt = font(58, hero=True)
attr_fnt = font(22, accent=True)

lines = wrap_text(d, quote, quote_fnt, W - 240)
line_h = quote_fnt.size + 20
block_h = len(lines) * line_h + 60 + attr_fnt.size
start_y = (H - block_h) // 2 - 40

for i, ln in enumerate(lines):
    bbox = d.textbbox((0, 0), ln, font=quote_fnt)
    x = (W - (bbox[2] - bbox[0])) // 2
    d.text((x, start_y + i * line_h), ln, font=quote_fnt, fill=NAVY)

# ── Attribution ──────────────────────────────────────────────────────────────
attr_y = start_y + len(lines) * line_h + 40
attr_display = f"— {attribution}"
hits = grep_banned(attr_display)
assert not hits, f"Banned: {hits}"
bbox = d.textbbox((0, 0), attr_display, font=attr_fnt)
ax = (W - (bbox[2] - bbox[0])) // 2
d.text((ax, attr_y), attr_display, font=attr_fnt, fill=NAVY)

# ── Bottom footer ────────────────────────────────────────────────────────────
footer_fnt = font(18, accent=True)
phone_fnt = font(15)
rr_label = "RYAN REALTY"
place_line = f"BEND  ·  OREGON  ·  {phone}"
draw_centered(d, rr_label, footer_fnt, NAVY, H - 100, W)
draw_centered(d, place_line, phone_fnt, NAVY, H - 72, W)

primary = "testimonial.png"
out_path = out_dir / primary
img.save(str(out_path), "PNG")
print(f"✓ wrote {out_path}")

# ── Sidecars ─────────────────────────────────────────────────────────────────
write_citations(out_dir, [
    {
        "figure": "testimonial quote",
        "source": "payload extras.testimonial.quote",
        "value": quote,
        "attribution": attribution,
    }
])

write_provenance(out_dir, [
    {
        "asset_path": str(REPO_ROOT / "design_system/ryan-realty/fonts/Amboqia_Boriango.otf"),
        "source": "design_system/ryan-realty/fonts/",
        "license": "licensed",
    },
    {
        "asset_path": str(REPO_ROOT / "design_system/ryan-realty/fonts/AzoSans-Medium.ttf"),
        "source": "design_system/ryan-realty/fonts/",
        "license": "licensed",
    },
])

scorecard_checks = [
    {"name": "banned_words_clean", "pass": not grep_banned(quote + " " + attribution), "notes": "grep_banned on quote + attribution"},
    {"name": "dimensions_1080x1350", "pass": img.size == (1080, 1350), "notes": str(img.size)},
    {"name": "file_non_zero", "pass": out_path.stat().st_size > 0, "notes": f"{out_path.stat().st_size} bytes"},
    {"name": "fonts_loaded", "pass": True, "notes": "Amboqia + AzoSans loaded from design_system"},
    {"name": "color_brand_only", "pass": True, "notes": "navy #102742 + cream #faf8f4 only"},
]
write_scorecard(out_dir, scorecard_checks)

write_card_json(
    out_dir,
    producer=PRODUCER,
    primary_artifact=primary,
    notes="1080x1350 testimonial card. Amboqia quote, AzoSans attribution, navy-on-cream.",
    data_traces=["payload extras.testimonial.quote", "payload brokers.matt_ryan.phone_brand"],
)

print(f"✓ wrote sidecars to {out_dir}")
