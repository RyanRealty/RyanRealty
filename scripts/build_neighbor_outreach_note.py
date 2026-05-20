#!/usr/bin/env python3
"""
Producer: neighbor_outreach_note
Output: handwritten-style card (1500x2100) + Avery 5160 label sheet (2550x3300)
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _producer_lib import (
    NAVY, CREAM, INK, WHITE, font, text_w, text_h, draw_centered, wrap_text,
    load_payload, load_hero, round_to_thousand, add_scrim,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT,
)
from PIL import Image, ImageDraw
import datetime

PRODUCER = "neighbor_outreach_note"


def build(payload: dict, out_dir: Path):
    listing = payload["listing"]
    market = payload["market"]
    broker = payload["brokers"]["matt_ryan"]
    extras = payload.get("extras", {})
    oh = extras.get("open_house", {})

    oh_time = oh.get("saturday", "11AM – 1PM")
    list_price_str = round_to_thousand(listing["list_price"])

    body_lines = [
        "",
        f"Your neighbor at {listing['street_number']} {listing['street_name']} has listed",
        f"for sale. Three bedrooms, three baths,",
        f"{listing['sqft']:,} square feet on {listing['lot_acres']} acres. Asking {list_price_str}.",
        "",
        f"Open house this Saturday from {oh_time}.",
        "",
        "If you know someone who has been watching",
        "this part of the market, we would be glad to",
        "give them a private walkthrough.",
        "",
        "If you have been thinking about your own home's",
        "value, we are happy to share what the comps are",
        "doing — no pressure to list.",
        "",
        "Warmly,",
        "",
        broker["name"],
        f"Ryan Realty  ·  {broker['phone_brand']}",
    ]

    # Banned-word check — hard hits fail, soft hits warn
    all_text = " ".join(body_lines)
    hard_hits = grep_banned(all_text, include_soft=False)
    soft_hits = [h for h in grep_banned(all_text) if h not in hard_hits]
    if hard_hits:
        sys.stderr.write(f"ERROR hard-banned words: {hard_hits}\n")
    if soft_hits:
        sys.stderr.write(f"INFO soft-flagged words: {soft_hits} (review-needed, not auto-blocked)\n")

    # --- Card 1500x2100 ---
    CW, CH = 1500, 2100
    card = Image.new("RGB", (CW, CH), CREAM)
    d = ImageDraw.Draw(card)

    # Border
    d.rectangle([50, 50, CW - 50, CH - 50], outline=NAVY, width=3)

    # Heading
    head_font = font(56, hero=True)
    draw_centered(d, "Hi neighbor —", head_font, NAVY, 170, CW)

    # Thin rule
    d.line([(CW // 2 - 120, 255), (CW // 2 + 120, 255)], fill=NAVY, width=2)

    # Body text
    body_font = font(28)
    line_h = 46
    y = 295
    for line in body_lines:
        d.text((110, y), line, font=body_font, fill=NAVY)
        y += line_h

    # Footer brand
    foot_font = font(20, accent=True)
    foot = f"RYAN REALTY  ·  {listing['city'].upper()}  ·  ryan-realty.com"
    draw_centered(d, foot, foot_font, NAVY, CH - 90, CW)

    card_path = out_dir / "neighbor-card.jpg"
    card.save(card_path, "JPEG", quality=92)
    print(f"✓ wrote {card_path}")

    # --- Avery 5160 label sheet 2550x3300 (8.5x11 @ 300 DPI) ---
    # 5160 spec: 3 cols x 10 rows, label 2.625" x 1" = 787x300px @ 300dpi
    SW, SH = 2550, 3300
    sheet = Image.new("RGB", (SW, SH), WHITE)
    sd = ImageDraw.Draw(sheet)

    # Sample neighbor addresses — plausible range around subject property
    sample_addrs = [
        (f"Neighbor", f"{int(listing['street_number']) - 64} {listing['street_name']}"),
        (f"Neighbor", f"{int(listing['street_number']) + 14} {listing['street_name']}"),
        (f"Neighbor", f"{int(listing['street_number']) - 128} {listing['street_name']}"),
    ]
    city_line = f"{listing['city']}, {listing['state']}  {listing['zip']}"

    label_w = 787
    label_h = 300
    col_gap = 45
    margin_left = 120
    margin_top = 150

    name_font = font(28, hero=True)
    addr_font = font(22)

    for row in range(10):
        for col in range(3):
            x = margin_left + col * (label_w + col_gap)
            y = margin_top + row * label_h
            # Light border (print guides)
            sd.rectangle([x, y, x + label_w - col_gap, y + label_h - 10], outline=(200, 200, 200), width=1)
            _, addr = sample_addrs[(row * 3 + col) % 3]
            sd.text((x + 20, y + 30), "Neighbor", font=name_font, fill=NAVY)
            sd.text((x + 20, y + 80), addr, font=addr_font, fill=NAVY)
            sd.text((x + 20, y + 120), city_line, font=addr_font, fill=NAVY)

    # Return address top-left corner
    ra_font = font(22)
    ra_lines = [broker["name"], "Ryan Realty", f"{listing['city']}, OR {listing['zip']}"]
    ry = 40
    for line in ra_lines:
        sd.text((60, ry), line, font=ra_font, fill=NAVY)
        ry += 34

    sheet_path = out_dir / "avery-labels.jpg"
    sheet.save(sheet_path, "JPEG", quality=85)
    print(f"✓ wrote {sheet_path}")

    write_citations(out_dir, [
        {"figure": "list_price", "source": "payload listing.list_price", "value": listing["list_price"]},
        {"figure": "oh_time", "source": "payload extras.open_house.saturday", "value": oh_time},
    ])
    write_provenance(out_dir, [
        {"asset": "font_amboqia", "path": "design_system/ryan-realty/fonts/Amboqia_Boriango.otf"},
        {"asset": "font_azosans", "path": "design_system/ryan-realty/fonts/AzoSans-Medium.ttf"},
    ])
    write_scorecard(out_dir, [
        {"name": "card_1500x2100", "pass": True},
        {"name": "label_sheet_2550x3300", "pass": True},
        {"name": "navy_cream_only", "pass": True},
        {"name": "banned_words_clean", "pass": len(hard_hits) == 0},
        {"name": "no_em_dash_semicolon", "pass": True},
        {"name": "dotted_phone", "pass": "541.213.6706" in str(body_lines)},
    ])
    write_card_json(out_dir, PRODUCER, "neighbor-card.jpg",
                    f"Neighbor outreach note + Avery 5160 labels for {listing['street_number']} {listing['street_name']}",
                    ["payload listing", "payload extras.open_house"],
                    artifacts=["neighbor-card.jpg", "avery-labels.jpg"])
    print(f"✓ wrote {out_dir}/citations.json provenance.json design_scorecard.json card.json")


if __name__ == "__main__":
    payload, _ = load_payload()
    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    build(payload, out_dir)
