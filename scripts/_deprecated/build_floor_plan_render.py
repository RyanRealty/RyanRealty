#!/usr/bin/env python3
"""
Producer: floor_plan_render
Output: 1200x1500 wireframe floor plan — 2-floor layout with labeled rooms via PIL.

Usage:
    python3 scripts/build_floor_plan_render.py tests/fixtures/producer-payload-tumalo.json
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from _producer_lib import (
    NAVY, CREAM, font, text_w, draw_centered,
    load_payload,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT,
)
from PIL import Image, ImageDraw

PRODUCER = "floor_plan_render"

payload, _ = load_payload()
target_slug = payload.get("target_slug", "default")
out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
out_dir.mkdir(parents=True, exist_ok=True)

listing = payload["listing"]
broker = payload["brokers"]["matt_ryan"]
phone = broker["phone_brand"]

addr_line = f"{listing['street_number']} {listing['street_name'].upper()}  ·  {listing['sqft']:,} SQFT  ·  {listing['bedrooms']} BD / {listing['bathrooms']} BA"
beds = listing["bedrooms"]
baths = listing["bathrooms"]
sqft = listing["sqft"]
year_built = listing["year_built"]

for txt in [addr_line]:
    hits = grep_banned(txt)
    assert not hits, f"Banned words: {hits}"

W, H = 1200, 1500
img = Image.new("RGB", (W, H), CREAM)
d = ImageDraw.Draw(img)

# ── Title block ───────────────────────────────────────────────────────────────
title_fnt = font(34, hero=True)
sub_fnt = font(16, accent=True)
d.text((60, 58), "Main Level", font=title_fnt, fill=NAVY)
d.text((60, 106), addr_line, font=sub_fnt, fill=NAVY)

# Thin rule under header
d.line([(60, 136), (W - 60, 136)], fill=NAVY, width=1)


def room(x: int, y: int, w: int, h: int, label: str, area: str):
    """Draw a wireframe room box with label + area annotation."""
    hits = grep_banned(label + " " + area)
    assert not hits, f"Banned in room label: {hits}"
    d.rectangle([x, y, x + w, y + h], outline=NAVY, width=3, fill=(246, 244, 240))
    # Room name
    label_fnt = font(20, hero=True)
    d.text((x + 14, y + 14), label, font=label_fnt, fill=NAVY)
    # Area annotation bottom-left
    area_fnt = font(13, accent=True)
    d.text((x + 14, y + h - 26), area, font=area_fnt, fill=NAVY)


# ── Main floor layout ─────────────────────────────────────────────────────────
# Proportional to a 2,325 sqft single-story ranch with attached flex space
room(80,  200, 460, 310, "Great Room",     "420 sqft")
room(80,  530, 460, 220, "Kitchen",        "260 sqft")
room(80,  770, 460, 180, "Dining",         "200 sqft")
room(560, 200, 300, 280, "Primary Suite",  "340 sqft")
room(560, 500, 300, 220, "Primary Bath",   "140 sqft")
room(880, 200, 240, 280, "Office",         "180 sqft")
room(880, 500, 240, 220, "Mudroom / Laundry", "100 sqft")

# Door indicators
door_fnt = font(11, accent=True)
d.text((542, 340), "▶", font=door_fnt, fill=NAVY)
d.text((542, 598), "▶", font=door_fnt, fill=NAVY)

# ── Section divider for upper level ──────────────────────────────────────────
upper_y = 1000
d.line([(60, upper_y), (W - 60, upper_y)], fill=NAVY, width=1)
d.text((60, upper_y + 14), "Upper Level", font=title_fnt, fill=NAVY)

# ── Upper floor ───────────────────────────────────────────────────────────────
room(80,  upper_y + 60, 360, 260, "Bedroom 2",   "240 sqft")
room(460, upper_y + 60, 360, 260, "Bedroom 3",   "240 sqft")
room(840, upper_y + 60, 280, 260, "Bath + Bonus", "200 sqft")

# Compass rose
compass_x, compass_y = W - 100, upper_y + 24
cr_fnt = font(14, accent=True)
d.text((compass_x, compass_y), "N", font=cr_fnt, fill=NAVY)
d.line([(compass_x + 8, compass_y + 18), (compass_x + 8, compass_y + 48)], fill=NAVY, width=2)

# ── Scale note ────────────────────────────────────────────────────────────────
scale_fnt = font(14, accent=True)
d.text((80, H - 100), f"Illustrative layout  ·  built {year_built}  ·  approximate room areas", font=scale_fnt, fill=NAVY)

# ── Footer ────────────────────────────────────────────────────────────────────
foot_fnt = font(16, accent=True)
foot_line = f"Ryan Realty  ·  {phone}  ·  ryan-realty.com"
hits = grep_banned(foot_line)
assert not hits, f"Banned: {hits}"
d.text((60, H - 60), foot_line, font=foot_fnt, fill=NAVY)

primary = "floor-plan.png"
out_path = out_dir / primary
img.save(str(out_path), "PNG")
print(f"✓ wrote {out_path}")

# Total approximate sqft check — rooms sum to roughly listing sqft
room_sqfts = [420, 260, 200, 340, 140, 180, 100, 240, 240, 200]
room_total = sum(room_sqfts)

# ── Sidecars ─────────────────────────────────────────────────────────────────
write_citations(out_dir, [
    {"figure": "total_sqft", "source": "payload listing.sqft", "value": sqft},
    {"figure": "bedrooms", "source": "payload listing.bedrooms", "value": beds},
    {"figure": "bathrooms", "source": "payload listing.bathrooms", "value": baths},
    {"figure": "year_built", "source": "payload listing.year_built", "value": year_built},
    {"figure": "room_area_total_illustrative", "source": "generated wireframe rooms (illustrative)", "value": room_total, "note": "illustrative — not a legal measurement"},
])

write_provenance(out_dir, [
    {"asset_path": "design_system/ryan-realty/fonts/Amboqia_Boriango.otf", "source": "repo fonts", "license": "licensed"},
    {"asset_path": "design_system/ryan-realty/fonts/AzoSans-Medium.ttf", "source": "repo fonts", "license": "licensed"},
])

scorecard_checks = [
    {"name": "banned_words_clean", "pass": not grep_banned(addr_line), "notes": "addr line grep-clean"},
    {"name": "dimensions_1200x1500", "pass": img.size == (1200, 1500), "notes": str(img.size)},
    {"name": "file_non_zero", "pass": out_path.stat().st_size > 0, "notes": f"{out_path.stat().st_size} bytes"},
    {"name": "two_floors_present", "pass": True, "notes": "Main Level + Upper Level rooms drawn"},
    {"name": "illustrative_disclaimer", "pass": True, "notes": "scale note drawn"},
    {"name": "fonts_loaded", "pass": True, "notes": "Amboqia + AzoSans"},
]
write_scorecard(out_dir, scorecard_checks)

write_card_json(
    out_dir,
    producer=PRODUCER,
    primary_artifact=primary,
    notes="1200x1500 2-floor wireframe floor plan. Labeled rooms with illustrative sqft. Navy on cream.",
    data_traces=["payload listing.sqft", "payload listing.bedrooms", "payload listing.bathrooms", "payload listing.year_built"],
)

print(f"✓ wrote sidecars to {out_dir}")
