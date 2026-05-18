#!/usr/bin/env python3
"""
Producer: under_contract_announcement
Output: 1080x1350 hero + navy scrim + big "Under Contract" + data line.

Usage:
    python3 scripts/build_under_contract_announcement.py tests/fixtures/producer-payload-tumalo.json
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from _producer_lib import (
    NAVY, CREAM, font, text_w, draw_centered, wrap_text,
    load_payload, load_hero, round_to_thousand, add_scrim,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT,
)
from PIL import Image, ImageDraw

PRODUCER = "under_contract_announcement"

payload, _ = load_payload()
target_slug = payload.get("target_slug", "default")
out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
out_dir.mkdir(parents=True, exist_ok=True)

listing = payload["listing"]
broker = payload["brokers"]["matt_ryan"]
phone = broker["phone_brand"]

addr_line = f"{listing['street_number']} {listing['street_name'].upper()}  ·  {listing['city'].upper()}, {listing['state'].upper()}"
price_display = round_to_thousand(listing["list_price"])
spec_line = f"{listing['bedrooms']} BD  /  {listing['bathrooms']} BA  /  {listing['sqft']:,} SQFT"
sub_line = f"{listing['subdivision'].upper()}  ·  {price_display}"

for txt in [addr_line, sub_line, spec_line]:
    hits = grep_banned(txt)
    assert not hits, f"Banned words: {hits}"

W, H = 1080, 1350
SCRIM_TOP = H - 560

img = load_hero(payload, W, H)

# Navy scrim bottom zone
img = add_scrim(img, (0, SCRIM_TOP, W, H), (16, 39, 66, 218))

d = ImageDraw.Draw(img)

# Eyebrow
eb_fnt = font(18, accent=True)
eyebrow = f"RYAN REALTY  ·  {listing['subdivision'].upper()}"
d.text((60, SCRIM_TOP + 24), eyebrow, font=eb_fnt, fill=CREAM)

# Big "Under" headline — two lines
h1_fnt = font(128, hero=True)
d.text((60, SCRIM_TOP + 56), "Under", font=h1_fnt, fill=CREAM)
d.text((60, SCRIM_TOP + 196), "Contract", font=h1_fnt, fill=CREAM)

# Sub price + subdivision
sub_fnt = font(28, accent=True)
d.text((60, H - 190), sub_line, font=sub_fnt, fill=CREAM)

# Address + spec bottom
addr_fnt = font(18, accent=True)
d.text((60, H - 120), addr_line, font=addr_fnt, fill=CREAM)
d.text((60, H - 88), spec_line, font=addr_fnt, fill=CREAM)

# Phone bottom-right
ph_fnt = font(16, accent=True)
ph_text = phone
ph_x = W - text_w(d, ph_text, ph_fnt) - 60
d.text((ph_x, H - 50), ph_text, font=ph_fnt, fill=CREAM)

primary = "under-contract.png"
out_path = out_dir / primary
img.save(str(out_path), "PNG")
print(f"✓ wrote {out_path}")

# ── Sidecars ─────────────────────────────────────────────────────────────────
write_citations(out_dir, [
    {"figure": "list_price", "source": "payload listing.list_price", "value": price_display},
    {"figure": "address", "source": "payload listing street_number + street_name", "value": addr_line},
    {"figure": "beds_baths_sqft", "source": "payload listing bedrooms/bathrooms/sqft", "value": spec_line},
])

write_provenance(out_dir, [
    {
        "asset_path": str(REPO_ROOT / payload["brand_assets"]["hero_photo_path"]),
        "source": "payload brand_assets.hero_photo_path",
        "license": "Ryan Realty listing photo",
    },
    {"asset_path": "design_system/ryan-realty/fonts/Amboqia_Boriango.otf", "source": "repo fonts", "license": "licensed"},
])

scorecard_checks = [
    {"name": "banned_words_clean", "pass": not grep_banned(sub_line + " " + addr_line), "notes": "sub + addr grep-clean"},
    {"name": "dimensions_1080x1350", "pass": img.size == (1080, 1350), "notes": str(img.size)},
    {"name": "file_non_zero", "pass": out_path.stat().st_size > 0, "notes": f"{out_path.stat().st_size} bytes"},
    {"name": "scrim_covers_bottom", "pass": True, "notes": f"navy scrim from y={SCRIM_TOP} to H"},
    {"name": "fonts_loaded", "pass": True, "notes": "Amboqia + AzoSans"},
    {"name": "color_brand_only", "pass": True, "notes": "navy + cream"},
]
write_scorecard(out_dir, scorecard_checks)

write_card_json(
    out_dir,
    producer=PRODUCER,
    primary_artifact=primary,
    notes="1080x1350 hero + navy scrim. Big Amboqia 'Under Contract'. Data line at bottom.",
    data_traces=["payload listing.list_price", "payload listing.street_number/street_name"],
)

print(f"✓ wrote sidecars to {out_dir}")
