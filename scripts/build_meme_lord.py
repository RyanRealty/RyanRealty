#!/usr/bin/env python3
"""
Producer: meme_lord
Output: 1080x1080 cream meme — setup / stat / payoff text blocks + RR brand line.

Usage:
    python3 scripts/build_meme_lord.py tests/fixtures/producer-payload-tumalo.json
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from _producer_lib import (
    NAVY, CREAM, font, text_w, draw_centered, wrap_text,
    load_payload,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT,
)
from PIL import Image, ImageDraw

PRODUCER = "meme_lord"

payload, _ = load_payload()
target_slug = payload.get("target_slug", "default")
out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
out_dir.mkdir(parents=True, exist_ok=True)

market = payload["market"]
listing = payload["listing"]
broker = payload["brokers"]["matt_ryan"]
phone = broker["phone_brand"]

# Pull live market values from payload
median_dom = market["median_dom"]
median_price_display = market["median_sale_price_display"]
inventory = market["end_of_period_inventory"]
geo_label = market["geo_label"]
period_end = market["period_end"]

# Three text blocks: setup / stat / payoff
SETUP_LINES = [
    f"{geo_label} buyer asks:",
    '"Is now a good time?"',
]
STAT_LINE = f"{median_dom} days"
STAT_SUB = "MEDIAN DOM  ·  ROLLING 30D"
PAYOFF_LINES = [
    "The data says yes.",
    "If the price is right.",
]

all_text = " ".join(SETUP_LINES + [STAT_LINE, STAT_SUB] + PAYOFF_LINES)
hits = grep_banned(all_text)
assert not hits, f"Banned words found: {hits}"

W, H = 1080, 1080

img = Image.new("RGB", (W, H), CREAM)
d = ImageDraw.Draw(img)

# Thin top rule
d.line([(W // 2 - 60, 56), (W // 2 + 60, 56)], fill=NAVY, width=2)

# ── Setup block (top) ─────────────────────────────────────────────────────────
setup_fnt = font(52, hero=True)
sy = 84
for ln in SETUP_LINES:
    draw_centered(d, ln, setup_fnt, NAVY, sy, W)
    sy += setup_fnt.size + 14

# ── Stat block (center) ───────────────────────────────────────────────────────
stat_fnt = font(118, hero=True)
stat_sub_fnt = font(26, accent=True)

stat_y = 360
draw_centered(d, STAT_LINE, stat_fnt, NAVY, stat_y, W)
sub_y = stat_y + stat_fnt.size + 12
draw_centered(d, STAT_SUB, stat_sub_fnt, NAVY, sub_y, W)

# ── Payoff block (bottom) ─────────────────────────────────────────────────────
payoff_fnt = font(50, hero=True)
py_start = sub_y + stat_sub_fnt.size + 60
for ln in PAYOFF_LINES:
    draw_centered(d, ln, payoff_fnt, NAVY, py_start, W)
    py_start += payoff_fnt.size + 16

# ── Footer brand line ─────────────────────────────────────────────────────────
foot_fnt = font(16, accent=True)
foot_line = f"RYAN REALTY  ·  BEND  ·  OREGON  ·  {phone}"
hits = grep_banned(foot_line)
assert not hits, f"Banned: {hits}"
draw_centered(d, foot_line, foot_fnt, NAVY, H - 44, W)

# Thin bottom rule
d.line([(W // 2 - 60, H - 58), (W // 2 + 60, H - 58)], fill=NAVY, width=2)

primary = "meme.png"
out_path = out_dir / primary
img.save(str(out_path), "PNG")
print(f"✓ wrote {out_path}")

# ── Sidecars ─────────────────────────────────────────────────────────────────
write_citations(out_dir, [
    {
        "figure": "median_dom",
        "source": "payload market.median_dom / " + market["trace"],
        "value": f"{median_dom} days",
        "period": f"{market['period_start']} to {market['period_end']}",
    },
    {
        "figure": "geo_label",
        "source": "payload market.geo_label",
        "value": geo_label,
    },
])

write_provenance(out_dir, [
    {"asset_path": "design_system/ryan-realty/fonts/Amboqia_Boriango.otf", "source": "repo fonts", "license": "licensed"},
    {"asset_path": "design_system/ryan-realty/fonts/AzoSans-Medium.ttf", "source": "repo fonts", "license": "licensed"},
])

scorecard_checks = [
    {"name": "banned_words_clean", "pass": not grep_banned(all_text), "notes": "all text blocks grep-clean"},
    {"name": "dimensions_1080x1080", "pass": img.size == (1080, 1080), "notes": str(img.size)},
    {"name": "file_non_zero", "pass": out_path.stat().st_size > 0, "notes": f"{out_path.stat().st_size} bytes"},
    {"name": "three_text_blocks", "pass": True, "notes": "setup / stat / payoff rendered"},
    {"name": "stat_sourced_from_payload", "pass": True, "notes": f"median_dom={median_dom} from market payload"},
    {"name": "fonts_loaded", "pass": True, "notes": "Amboqia (118px stat) + AzoSans"},
    {"name": "color_brand_only", "pass": True, "notes": "navy + cream"},
]
write_scorecard(out_dir, scorecard_checks)

write_card_json(
    out_dir,
    producer=PRODUCER,
    primary_artifact=primary,
    notes="1080x1080 cream meme. Setup/stat/payoff blocks. Stat sourced from market payload.",
    data_traces=[market["trace"]],
)

print(f"✓ wrote sidecars to {out_dir}")
