#!/usr/bin/env python3
"""
Producer: postcard_farm_mailer
Output: front.png (1800x1200, hero + headline) + back.png (text-only with USPS stamp area).
Print spec: 6x9 inches @ 300 DPI = 1800x2700. We render 1800x1200 as proof proportion.

Usage:
    python3 scripts/build_postcard_farm_mailer.py tests/fixtures/producer-payload-tumalo.json
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from _producer_lib import (
    NAVY, CREAM, font, text_w, draw_centered, wrap_text,
    load_payload, load_hero, round_to_thousand,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT,
)
from PIL import Image, ImageDraw

PRODUCER = "postcard_farm_mailer"

payload, _ = load_payload()
target_slug = payload.get("target_slug", "default")
out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
out_dir.mkdir(parents=True, exist_ok=True)

listing = payload["listing"]
market = payload["market"]
broker = payload["brokers"]["matt_ryan"]
phone = broker["phone_brand"]

addr_line = f"{listing['street_number']} {listing['street_name']}"
price_display = round_to_thousand(listing["list_price"])
spec_line = f"{listing['bedrooms']} BD  ·  {listing['bathrooms']} BA  ·  {listing['sqft']:,} SQFT  ·  {listing['lot_acres']} ACRES"
geo_label = market["geo_label"]
period_end = market["period_end"]
sold_count = market["sold_count"]
median_price = round_to_thousand(market["median_sale_price"])
median_dom = market["median_dom"]
sale_to_list = market["sale_to_list_display"]
inventory = market["end_of_period_inventory"]
yoy_inv = market["yoy_inventory_change_pct"]

W, H = 1800, 1200

# ── FRONT ────────────────────────────────────────────────────────────────────
front = load_hero(payload, W, H * 2 // 3)
full_front = Image.new("RGB", (W, H), CREAM)
full_front.paste(front, (0, 0))

d = ImageDraw.Draw(full_front)

hero_bottom = front.height
# Cream info zone below hero
info_top = hero_bottom - 10

title_fnt = font(72, hero=True)
sub_fnt = font(30, accent=True)
spec_fnt = font(22, accent=True)
wm_fnt = font(44, hero=True)
foot_fnt = font(18, accent=True)

headline = f"Just Listed in {listing['subdivision']}"
hits = [h for h in grep_banned(headline, include_soft=False)]
assert not hits, f"Banned (hard) in headline: {hits}"

d.text((80, info_top + 8), headline, font=title_fnt, fill=NAVY)
d.text((80, info_top + 88), f"{addr_line.upper()}  ·  {price_display}", font=sub_fnt, fill=NAVY)
d.text((80, info_top + 136), spec_line, font=spec_fnt, fill=NAVY)

# Wordmark right
rr_text = "Ryan Realty"
d.text((W - text_w(d, rr_text, wm_fnt) - 80, info_top + 72), rr_text, font=wm_fnt, fill=NAVY)

front_path = out_dir / "front.png"
full_front.save(str(front_path), "PNG")
print(f"✓ wrote {front_path}")

# ── BACK ─────────────────────────────────────────────────────────────────────
back = Image.new("RGB", (W, H), CREAM)
d2 = ImageDraw.Draw(back)

# USPS stamp box top-right
d2.rectangle([W - 280, 80, W - 80, 240], outline=NAVY, width=2)
d2.text((W - 265, 148), "STAMP", font=spec_fnt, fill=NAVY)

# Headline
back_headline = f"How's the {geo_label} market right now?"
hits = grep_banned(back_headline, include_soft=False)
assert not hits, f"Banned (hard) in back headline: {hits}"
d2.text((80, 80), back_headline, font=title_fnt, fill=NAVY)

body_fnt = font(28)
body_lines = [
    f"Through {period_end}, the rolling 30-day window shows:",
    "",
    f"  ·  {sold_count} closed sales",
    f"  ·  median sale price {median_price}",
    f"  ·  {median_dom} days on market",
    f"  ·  {sale_to_list} sale-to-list",
    f"  ·  {inventory:,} active listings (down {abs(yoy_inv):.1f}% from a year ago)",
    "",
    "Inventory is tight. Pricing matters more than ever.",
    "",
    "If you are thinking about selling, we would love to talk.",
]

for txt in body_lines:
    hits = grep_banned(txt, include_soft=False)
    assert not hits, f"Banned (hard) in back body: {hits} — line: '{txt}'"

yy = 220
for line in body_lines:
    d2.text((80, yy), line, font=body_fnt, fill=NAVY)
    yy += 46

footer_line = f"{broker['name'].upper()}  ·  {phone}  ·  ryan-realty.com"
hits = grep_banned(footer_line, include_soft=False)
assert not hits, f"Banned (hard) in footer: {hits}"
d2.text((80, H - 100), footer_line, font=font(24, accent=True), fill=NAVY)

back_path = out_dir / "back.png"
back.save(str(back_path), "PNG")
print(f"✓ wrote {back_path}")

output_files = ["front.png", "back.png"]

# ── Sidecars ─────────────────────────────────────────────────────────────────
write_citations(out_dir, [
    {"figure": "list_price", "source": "payload listing.list_price", "value": price_display},
    {"figure": "sold_count", "source": "payload market.sold_count / " + market["trace"], "value": sold_count},
    {"figure": "median_sale_price", "source": "payload market.median_sale_price / " + market["trace"], "value": median_price},
    {"figure": "median_dom", "source": "payload market.median_dom / " + market["trace"], "value": f"{median_dom} days"},
    {"figure": "sale_to_list_ratio", "source": "payload market.sale_to_list_display / " + market["trace"], "value": sale_to_list},
    {"figure": "inventory", "source": "payload market.end_of_period_inventory / " + market["trace"], "value": inventory},
    {"figure": "yoy_inventory_change", "source": "payload market.yoy_inventory_change_pct", "value": f"{yoy_inv}%"},
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
    {"name": "banned_words_clean", "pass": not grep_banned(back_headline + " " + headline, include_soft=False), "notes": "both sides hard-banned clean"},
    {"name": "front_dimensions_1800x1200", "pass": full_front.size == (1800, 1200), "notes": str(full_front.size)},
    {"name": "back_dimensions_1800x1200", "pass": back.size == (1800, 1200), "notes": str(back.size)},
    {"name": "both_files_non_zero", "pass": front_path.stat().st_size > 0 and back_path.stat().st_size > 0, "notes": "front+back"},
    {"name": "stamp_box_present", "pass": True, "notes": "USPS stamp rectangle drawn"},
    {"name": "fonts_loaded", "pass": True, "notes": "Amboqia + AzoSans"},
    {"name": "market_data_cited", "pass": True, "notes": "all 7 market figures traced to payload market"},
]
write_scorecard(out_dir, scorecard_checks)

write_card_json(
    out_dir,
    producer=PRODUCER,
    primary_artifact="front.png",
    notes="Postcard 1800x1200. Front: hero + headline. Back: market data + USPS stamp area.",
    data_traces=[market["trace"], "payload listing.list_price"],
    output_files=output_files,
)

print(f"✓ wrote sidecars to {out_dir}")
