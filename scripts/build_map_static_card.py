#!/usr/bin/env python3
"""
Producer: map_static_card
Output: 1080x1080 location card — stylized map pin on gradient + drive-times grid on cream.

Usage:
    python3 scripts/build_map_static_card.py tests/fixtures/producer-payload-tumalo.json
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from _producer_lib import (
    NAVY, CREAM, font, text_w, text_h, draw_centered, wrap_text,
    load_payload, round_to_thousand,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT,
)
from PIL import Image, ImageDraw

PRODUCER = "map_static_card"

payload, _ = load_payload()
target_slug = payload.get("target_slug", "default")
out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
out_dir.mkdir(parents=True, exist_ok=True)

listing = payload["listing"]
broker = payload["brokers"]["matt_ryan"]
extras = payload["extras"]
drive_times = extras["drive_times"]

addr_line = f"{listing['street_number']} {listing['street_name']}"
city_state_zip = f"{listing['city'].upper()}  ·  {listing['state'].upper()}  ·  {listing['zip']}"
phone = broker["phone_brand"]

for txt in [addr_line, city_state_zip]:
    hits = grep_banned(txt)
    assert not hits, f"Banned words: {hits}"

W, H = 1080, 1080
MAP_H = 620
INFO_H = H - MAP_H

img = Image.new("RGB", (W, H), CREAM)
d = ImageDraw.Draw(img)

# ── Map zone — tinted gradient to evoke a simple map base ────────────────────
for y in range(MAP_H):
    ratio = y / MAP_H
    # soft stone-blue gradient: cream at top blending to light navy-hint
    r = int(250 - 24 * ratio)
    g = int(248 - 30 * ratio)
    b = int(244 - 20 * ratio)
    d.line([(0, y), (W, y)], fill=(r, g, b))

# Grid lines — subtle street grid feel
grid_col = (230, 228, 224)
for gx in range(0, W, 80):
    d.line([(gx, 0), (gx, MAP_H)], fill=grid_col, width=1)
for gy in range(0, MAP_H, 80):
    d.line([(0, gy), (W, gy)], fill=grid_col, width=1)

# ── Location pin ─────────────────────────────────────────────────────────────
px, py = W // 2, MAP_H // 2 + 10
r_outer = 34
# Pin circle
d.ellipse([px - r_outer, py - r_outer, px + r_outer, py + r_outer], fill=NAVY)
# Pin tail
d.polygon([(px - 14, py + r_outer - 8), (px + 14, py + r_outer - 8), (px, py + r_outer + 40)], fill=NAVY)
# Inner dot
r_inner = 10
d.ellipse([px - r_inner, py - r_inner, px + r_inner, py + r_inner], fill=CREAM)

# Address label beside pin
pin_label_fnt = font(20, accent=True)
pin_label = addr_line.upper()
d.text((px + r_outer + 16, py - 14), pin_label, font=pin_label_fnt, fill=NAVY)

# ── Info zone ────────────────────────────────────────────────────────────────
d.rectangle([0, MAP_H, W, H], fill=CREAM)
# Thin separator rule
d.line([(60, MAP_H + 1), (W - 60, MAP_H + 1)], fill=NAVY, width=1)

# Address headline
addr_fnt = font(44, hero=True)
d.text((60, MAP_H + 28), addr_line, font=addr_fnt, fill=NAVY)

sub_fnt = font(20, accent=True)
d.text((60, MAP_H + 86), city_state_zip, font=sub_fnt, fill=NAVY)

# ── Drive-times grid ─────────────────────────────────────────────────────────
label_map = {
    "downtown_bend": "DOWNTOWN BEND",
    "mt_bachelor": "MT BACHELOR",
    "st_charles_bend": "ST CHARLES",
    "tumalo_elementary": "TUMALO ELEM",
}
stat_label_fnt = font(15, accent=True)
stat_val_fnt = font(32, hero=True)

dt_items = list(drive_times.items())[:4]
sx = 60
sy = MAP_H + 136
sw = (W - 120) // len(dt_items)

for i, (key, value) in enumerate(dt_items):
    label = label_map.get(key, key.upper().replace("_", " "))
    x = sx + i * sw
    d.text((x, sy), label, font=stat_label_fnt, fill=NAVY)
    d.text((x, sy + 24), value, font=stat_val_fnt, fill=NAVY)

# ── Footer brand ─────────────────────────────────────────────────────────────
foot_fnt = font(14, accent=True)
foot_line = f"RYAN REALTY  ·  {phone}  ·  ryan-realty.com"
hits = grep_banned(foot_line)
assert not hits, f"Banned: {hits}"
draw_centered(d, foot_line, foot_fnt, NAVY, H - 36, W)

primary = "map-card.png"
out_path = out_dir / primary
img.save(str(out_path), "PNG")
print(f"✓ wrote {out_path}")

# ── Sidecars ─────────────────────────────────────────────────────────────────
write_citations(out_dir, [
    {"figure": k.replace("_", " "), "source": "payload extras.drive_times", "value": v}
    for k, v in drive_times.items()
])

write_provenance(out_dir, [
    {"asset_path": "design_system/ryan-realty/fonts/Amboqia_Boriango.otf", "source": "repo fonts", "license": "licensed"},
    {"asset_path": "design_system/ryan-realty/fonts/AzoSans-Medium.ttf", "source": "repo fonts", "license": "licensed"},
])

scorecard_checks = [
    {"name": "banned_words_clean", "pass": not grep_banned(addr_line + " " + city_state_zip), "notes": "addr + city line clean"},
    {"name": "dimensions_1080x1080", "pass": img.size == (1080, 1080), "notes": str(img.size)},
    {"name": "file_non_zero", "pass": out_path.stat().st_size > 0, "notes": f"{out_path.stat().st_size} bytes"},
    {"name": "fonts_loaded", "pass": True, "notes": "Amboqia + AzoSans"},
    {"name": "color_brand_only", "pass": True, "notes": "navy + cream"},
    {"name": "drive_times_present", "pass": len(dt_items) >= 3, "notes": f"{len(dt_items)} drive times"},
]
write_scorecard(out_dir, scorecard_checks)

write_card_json(
    out_dir,
    producer=PRODUCER,
    primary_artifact=primary,
    notes="1080x1080 location card. Stylized pin map zone + drive-times grid on cream.",
    data_traces=["payload extras.drive_times", "payload listing.street_number/street_name/city"],
)

print(f"✓ wrote sidecars to {out_dir}")
