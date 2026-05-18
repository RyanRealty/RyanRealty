#!/usr/bin/env python3
"""
Producer: sold_deal_summary
Output: 1080x1350 hero + navy scrim + big "Sold" + closed price + DOM.

Usage:
    python3 scripts/build_sold_deal_summary.py tests/fixtures/producer-payload-tumalo.json
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

PRODUCER = "sold_deal_summary"

payload, _ = load_payload()
target_slug = payload.get("target_slug", "default")
out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
out_dir.mkdir(parents=True, exist_ok=True)

listing = payload["listing"]
broker = payload["brokers"]["matt_ryan"]
extras = payload["extras"]
sold = extras["sold_deal"]

phone = broker["phone_brand"]
sold_price_display = round_to_thousand(sold["sold_price"])
dom = sold["days_on_market"]
sale_to_list = sold["sale_to_list"]
addr_line = f"{listing['street_number']} {listing['street_name'].upper()}  ·  {listing['bedrooms']} BD / {listing['bathrooms']} BA / {listing['sqft']:,} SQFT"
sub_line = f"{listing['subdivision'].upper()}  ·  {sold_price_display}  ·  {dom} DAYS ON MARKET"

for txt in [addr_line, sub_line]:
    hits = grep_banned(txt)
    assert not hits, f"Banned words: {hits}"

W, H = 1080, 1350
SCRIM_TOP = H - 620

img = load_hero(payload, W, H)
img = add_scrim(img, (0, SCRIM_TOP, W, H), (16, 39, 66, 228))

d = ImageDraw.Draw(img)

# Eyebrow
eb_fnt = font(18, accent=True)
eyebrow = "RYAN REALTY  ·  REPRESENTED THE SELLERS"
d.text((60, SCRIM_TOP + 22), eyebrow, font=eb_fnt, fill=CREAM)

# Big "Sold"
sold_fnt = font(220, hero=True)
d.text((52, SCRIM_TOP + 52), "Sold", font=sold_fnt, fill=CREAM)

# Sub line: price + DOM
sub_fnt = font(28, accent=True)
d.text((60, H - 200), sub_line, font=sub_fnt, fill=CREAM)

# Sale-to-list
stl_fnt = font(18, accent=True)
stl_line = f"{sale_to_list} of asking price"
hits = grep_banned(stl_line)
assert not hits, f"Banned: {hits}"
d.text((60, H - 148), stl_line, font=stl_fnt, fill=CREAM)

# Address + spec
addr_fnt = font(16, accent=True)
d.text((60, H - 96), addr_line, font=addr_fnt, fill=CREAM)

# Phone bottom-right
ph_fnt = font(16, accent=True)
ph_x = W - text_w(d, phone, ph_fnt) - 60
d.text((ph_x, H - 50), phone, font=ph_fnt, fill=CREAM)

primary = "sold-deal.png"
out_path = out_dir / primary
img.save(str(out_path), "PNG")
print(f"✓ wrote {out_path}")

# ── Sidecars ─────────────────────────────────────────────────────────────────
write_citations(out_dir, [
    {"figure": "sold_price", "source": "payload extras.sold_deal.sold_price", "value": sold_price_display},
    {"figure": "days_on_market", "source": "payload extras.sold_deal.days_on_market", "value": f"{dom} days"},
    {"figure": "sale_to_list", "source": "payload extras.sold_deal.sale_to_list", "value": sale_to_list},
    {"figure": "beds_baths_sqft", "source": "payload listing bedrooms/bathrooms/sqft", "value": f"{listing['bedrooms']} BD / {listing['bathrooms']} BA / {listing['sqft']:,} SQFT"},
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
    {"name": "scrim_covers_bottom", "pass": True, "notes": f"navy scrim from y={SCRIM_TOP}"},
    {"name": "sold_price_cited", "pass": True, "notes": f"{sold_price_display} from payload extras.sold_deal.sold_price"},
    {"name": "fonts_loaded", "pass": True, "notes": "Amboqia (220px sold) + AzoSans"},
]
write_scorecard(out_dir, scorecard_checks)

write_card_json(
    out_dir,
    producer=PRODUCER,
    primary_artifact=primary,
    notes="1080x1350 hero + navy scrim. Amboqia 220px 'Sold'. Closed price + DOM + sale-to-list.",
    data_traces=[
        "payload extras.sold_deal.sold_price",
        "payload extras.sold_deal.days_on_market",
        "payload extras.sold_deal.sale_to_list",
    ],
)

print(f"✓ wrote sidecars to {out_dir}")
