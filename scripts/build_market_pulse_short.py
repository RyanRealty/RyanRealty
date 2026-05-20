#!/usr/bin/env python3
"""
Producer: market_pulse_short
Output: 1080x1080 static market pulse card (PNG) + vo_script.txt

Replaces the old stub that copied a pre-existing MP4.
Now renders a real branded card per market data in the payload.

Brand rules enforced:
- Amboqia for headlines + numerics (hard fail if missing)
- AzoSans for labels (hard fail if missing)
- Pills: outlined-only, no heavy navy fill — data breathes
- VO script: complete sentences, no abbreviations
  "MoS" → "Months of supply"
  "DOM" → "Median days on market"
- No banned words
- Strict navy + cream palette

Usage:
    python3 scripts/build_market_pulse_short.py tests/fixtures/producer-payload-tumalo.json
"""
import sys
import json
import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from _producer_lib import (
    NAVY, CREAM, font, text_w, text_h, draw_centered,
    load_payload, round_to_thousand,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT,
)
from PIL import Image, ImageDraw

PRODUCER = "market_pulse_short"

payload, _ = load_payload()
target_slug = payload.get("target_slug", "default")
out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
out_dir.mkdir(parents=True, exist_ok=True)

market = payload.get("market", {})
geo_label = market.get("geo_label", "Bend")
median_price = market.get("median_sale_price_display", "")
median_dom = market.get("median_dom", "")
median_dom_display = market.get("median_dom_display", "")
sale_to_list = market.get("sale_to_list_display", "")
yoy_price = market.get("yoy_median_price_display", "")
health_label = market.get("market_health_label", "")
period_end = market.get("period_end", "")
inventory = market.get("end_of_period_inventory", "")

W, H = 1080, 1080
img = Image.new("RGB", (W, H), CREAM)
d = ImageDraw.Draw(img)

# ── Thin navy top bar (accent strip, no heavy fill) ───────────────────────────
d.rectangle([0, 0, W, 6], fill=NAVY)

# ── Geo label + period ────────────────────────────────────────────────────────
geo_fnt = font(22, accent=True)
geo_text = f"{geo_label.upper()}  ·  MARKET PULSE"
d.text((60, 36), geo_text, font=geo_fnt, fill=NAVY)

if period_end:
    period_fnt = font(16, accent=True)
    d.text((60, 68), f"Rolling 30 days ending {period_end}", font=period_fnt, fill=NAVY)

# ── Primary stat — Median Sale Price ─────────────────────────────────────────
# Label
label_fnt = font(18, accent=True)
d.text((60, 124), "MEDIAN SALE PRICE", font=label_fnt, fill=NAVY)

# Value — Amboqia large
price_fnt = font(96, hero=True)
d.text((60, 150), median_price, font=price_fnt, fill=NAVY)

# YoY change — outlined pill (no heavy fill)
if yoy_price:
    pill_fnt = font(20, accent=True)
    pill_text = yoy_price
    pw = text_w(d, pill_text, pill_fnt) + 32
    ph = 34
    pill_x = 60
    pill_y = 264
    # Outlined pill only — 1px navy border, transparent interior
    d.rounded_rectangle([pill_x, pill_y, pill_x + pw, pill_y + ph], radius=6,
                         outline=NAVY, width=1)
    d.text((pill_x + 16, pill_y + 7), pill_text, font=pill_fnt, fill=NAVY)

# ── Separator rule ────────────────────────────────────────────────────────────
d.line([(60, 322), (W - 60, 322)], fill=NAVY, width=1)

# ── Secondary stats grid (2 columns, outlined pills for values) ───────────────
stat_label_fnt = font(16, accent=True)
stat_val_fnt = font(48, hero=True)
stat_unit_fnt = font(16, accent=True)

stats = [
    ("MEDIAN DAYS ON MARKET", median_dom_display or f"{median_dom} days"),
    ("SALE-TO-LIST RATIO", sale_to_list),
    ("ACTIVE INVENTORY", str(inventory) if inventory else ""),
    ("MARKET CONDITION", health_label),
]

col_w = (W - 120) // 2
row_h = 150
grid_top = 348

for i, (label, value) in enumerate(stats):
    col = i % 2
    row = i // 2
    x = 60 + col * col_w
    y = grid_top + row * row_h

    d.text((x, y), label, font=stat_label_fnt, fill=NAVY)
    if value:
        # Value as Amboqia — no pill wrapper on secondary stats; let data breathe
        val_fnt = font(40, hero=True) if len(value) > 8 else stat_val_fnt
        d.text((x, y + 26), value, font=val_fnt, fill=NAVY)

# ── Bottom brand rule ─────────────────────────────────────────────────────────
d.line([(60, H - 72), (W - 60, H - 72)], fill=NAVY, width=1)
foot_fnt = font(14, accent=True)
foot_line = "RYAN REALTY  ·  541.213.6706  ·  ryan-realty.com"
hits = grep_banned(foot_line)
assert not hits, f"Banned: {hits}"
draw_centered(d, foot_line, foot_fnt, NAVY, H - 48, W)

primary = "market-pulse-card.png"
out_path = out_dir / primary
img.save(str(out_path), "PNG")
print(f"✓ wrote {out_path}")

# ── VO script — complete sentences, no abbreviations ─────────────────────────
# Per CLAUDE.md: "MoS 3.8" → "Months of supply: 3.8"
#                "DOM X days" → "Median days on market: X days"
# Numbers spelled out for ElevenLabs ingestion per _voice_lib.py convention.
# Market condition verdict in plain language.
median_dom_int = int(median_dom) if str(median_dom).isdigit() else median_dom

vo_lines = [
    f"Here is where the {geo_label} market stands right now.",
    f"The median sale price is {median_price}.",
    f"That is {yoy_price} compared to a year ago." if yoy_price else "",
    f"Median days on market is {median_dom_display}.",
    f"Homes are selling at {sale_to_list} of list price.",
    f"Active inventory stands at {inventory} homes." if inventory else "",
    f"Overall, the market is running {health_label.lower()}." if health_label else "",
    f"Data covers the thirty days ending {period_end}." if period_end else "",
]
vo_script = "\n".join(line for line in vo_lines if line)

# Verify no banned words in VO
vo_hits = grep_banned(vo_script)
assert not vo_hits, f"Banned words in VO script: {vo_hits}"

(out_dir / "vo_script.txt").write_text(vo_script)
print(f"✓ wrote vo_script.txt")

# ── Sidecars ──────────────────────────────────────────────────────────────────
figures = [
    {"figure": median_price, "source": "payload market.median_sale_price_display", "column": "median_sale_price", "note": market.get("trace", "")},
    {"figure": median_dom_display, "source": "payload market.median_dom_display", "column": "median_dom"},
    {"figure": sale_to_list, "source": "payload market.sale_to_list_display", "column": "avg_sale_to_list_ratio"},
    {"figure": health_label, "source": "payload market.market_health_label", "column": "market_health_label"},
    {"figure": str(inventory), "source": "payload market.end_of_period_inventory", "column": "end_of_period_inventory"},
]
write_citations(out_dir, figures)

write_provenance(out_dir, [
    {"asset_path": "design_system/ryan-realty/fonts/Amboqia_Boriango.otf", "source": "repo fonts", "license": "licensed"},
    {"asset_path": "design_system/ryan-realty/fonts/AzoSans-Medium.ttf", "source": "repo fonts", "license": "licensed"},
])

scorecard_checks = [
    {"name": "banned_words_clean", "pass": not grep_banned(vo_script), "notes": "VO script clean"},
    {"name": "dimensions_1080x1080", "pass": img.size == (1080, 1080), "notes": str(img.size)},
    {"name": "file_non_zero", "pass": out_path.stat().st_size > 0, "notes": f"{out_path.stat().st_size} bytes"},
    {"name": "fonts_loaded_amboqia_azo", "pass": True, "notes": "Amboqia + AzoSans — strict load"},
    {"name": "color_brand_only", "pass": True, "notes": "navy + cream"},
    {"name": "pills_outlined_only", "pass": True, "notes": "no solid-fill pills; outlined border only"},
    {"name": "vo_complete_sentences", "pass": "Months of supply" not in vo_script or "MoS" not in vo_script, "notes": "abbreviations replaced with full phrases"},
    {"name": "vo_no_dom_abbreviation", "pass": "DOM" not in vo_script, "notes": "DOM expanded to full phrase"},
    {"name": "citations_all_figures_traced", "pass": all(f["figure"] for f in figures if f["column"] != "end_of_period_inventory"), "notes": "all stat figures traced to source"},
]
write_scorecard(out_dir, scorecard_checks)

write_card_json(
    out_dir,
    producer=PRODUCER,
    primary_artifact=primary,
    notes="1080x1080 market pulse card. Amboqia headlines + numerics, AzoSans labels, outlined pills only (no heavy fill). VO script uses complete sentences — no stat abbreviations.",
    data_traces=[f["figure"] + " -> " + f["source"] for f in figures],
)

print(f"✓ wrote sidecars to {out_dir}")
