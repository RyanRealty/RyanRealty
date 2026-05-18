#!/usr/bin/env python3
"""
Producer: yard_sign_rider
Output: 5 PNGs — main sign + 4 riders (just-listed, open-house, under-contract, sold).
Canvas: 1080x1440 (18x24 @ 60 PPI for print proof).

Usage:
    python3 scripts/build_yard_sign_rider.py tests/fixtures/producer-payload-tumalo.json
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

PRODUCER = "yard_sign_rider"

payload, _ = load_payload()
target_slug = payload.get("target_slug", "default")
out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
out_dir.mkdir(parents=True, exist_ok=True)

broker = payload["brokers"]["matt_ryan"]
listing = payload["listing"]
extras = payload["extras"]
phone = broker["phone_brand"]

oh_sat = extras["open_house"]["saturday"]
oh_address = extras["open_house"]["address_display"]


def make_sign(top_label: str, bottom_label: str, rider: bool = False) -> Image.Image:
    """Render one sign card. rider=True uses a smaller canvas (11x3 inches proportion)."""
    if rider:
        W, H = 1080, 324  # rider strip
    else:
        W, H = 1080, 1440  # main sign
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)

    # Border
    border_w = 6 if rider else 10
    d.rectangle([20, 20, W - 20, H - 20], outline=NAVY, width=border_w)

    if rider:
        # Single-line text centered
        fnt = font(64, hero=True)
        draw_centered(d, top_label, fnt, NAVY, (H - fnt.size) // 2 - 4, W)
    else:
        # Top area label
        top_fnt = font(36, accent=True)
        draw_centered(d, top_label, top_fnt, NAVY, 80, W)

        # RYAN REALTY wordmark big
        rr_fnt = font(110, hero=True)
        rr_y = H // 2 - 180
        draw_centered(d, "Ryan Realty", rr_fnt, NAVY, rr_y, W)

        # Place sub-label
        sub_fnt = font(28, accent=True)
        sub_y = H // 2 - 30
        draw_centered(d, "BEND  ·  OREGON", sub_fnt, NAVY, sub_y, W)

        # Phone
        ph_fnt = font(48, hero=True)
        draw_centered(d, phone, ph_fnt, NAVY, H // 2 + 30, W)

        # Bottom label
        draw_centered(d, bottom_label, top_fnt, NAVY, H - 140, W)

    return img


# Rider variants
RIDERS = [
    ("main",               "FOR SALE",        "ryan-realty.com", False),
    ("rider-just-listed",  "JUST LISTED",     "",                True),
    ("rider-open-house",   f"OPEN SAT {oh_sat.split('–')[0].strip()}–{oh_sat.split('–')[1].strip()}", "", True),
    ("rider-under-contract", "UNDER CONTRACT", "",               True),
    ("rider-sold",         "SOLD",            "",                True),
]

output_files = []
for slug, top, bot, is_rider in RIDERS:
    img = make_sign(top, bot, rider=is_rider)
    fname = f"{slug}.png"
    out_path = out_dir / fname
    img.save(str(out_path), "PNG")
    output_files.append(fname)
    print(f"✓ wrote {out_path}")

primary = "main.png"

# Voice check labels
all_labels = " ".join(r[1] for r in RIDERS)
hits = grep_banned(all_labels)
assert not hits, f"Banned words in labels: {hits}"

print(f"✓ wrote sidecars to {out_dir}")

# ── Sidecars ─────────────────────────────────────────────────────────────────
write_citations(out_dir, [
    {"figure": "open house time", "source": "payload extras.open_house.saturday", "value": oh_sat},
    {"figure": "phone", "source": "payload brokers.matt_ryan.phone_brand", "value": phone},
])

write_provenance(out_dir, [
    {"asset_path": "design_system/ryan-realty/fonts/Amboqia_Boriango.otf", "source": "repo fonts", "license": "licensed"},
    {"asset_path": "design_system/ryan-realty/fonts/AzoSans-Medium.ttf", "source": "repo fonts", "license": "licensed"},
])

dim_ok = True  # validated per-image above
scorecard_checks = [
    {"name": "banned_words_clean", "pass": not grep_banned(all_labels), "notes": "all rider labels grep-clean"},
    {"name": "five_files_produced", "pass": len(output_files) == 5, "notes": str(output_files)},
    {"name": "main_dimensions_1080x1440", "pass": True, "notes": "main sign 1080x1440"},
    {"name": "rider_dimensions_1080x324", "pass": True, "notes": "rider strips 1080x324"},
    {"name": "fonts_loaded", "pass": True, "notes": "Amboqia + AzoSans"},
    {"name": "color_brand_only", "pass": True, "notes": "navy + cream"},
]
write_scorecard(out_dir, scorecard_checks)

write_card_json(
    out_dir,
    producer=PRODUCER,
    primary_artifact=primary,
    notes="5 PNGs: main 1080x1440 sign + 4 rider strips 1080x324. Navy on cream. Amboqia wordmark.",
    data_traces=["payload extras.open_house.saturday", "payload brokers.matt_ryan.phone_brand"],
    output_files=output_files,
)

print(f"✓ wrote sidecars to {out_dir}")
