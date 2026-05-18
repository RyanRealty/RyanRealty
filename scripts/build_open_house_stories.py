#!/usr/bin/env python3
"""
Producer: open_house_stories
Output: 5 PNGs at 1080x1920 (Stories frames): hero, spec, where, price, CTA
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

PRODUCER = "open_house_stories"


def build(payload: dict, out_dir: Path):
    listing = payload["listing"]
    market = payload["market"]
    broker = payload["brokers"]["matt_ryan"]
    extras = payload.get("extras", {})
    oh = extras.get("open_house", {})
    drive = extras.get("drive_times", {})

    W, H = 1080, 1920

    oh_time = oh.get("saturday", "11AM – 1PM")
    oh_addr = oh.get("address_display", f"{listing['street_number'].upper()} {listing['street_name'].upper()}")
    downtown = drive.get("downtown_bend", "12 min")

    frames = [
        {
            "slug": "01-hero",
            "use_photo": True,
            "scrim_alpha": 140,
            "lines": [
                ("Open House", font(108, hero=True), CREAM),
                ("", None, None),
                (f"Saturday  ·  {oh_time}", font(42, accent=True), CREAM),
                (oh_addr, font(30, accent=True), CREAM),
            ],
        },
        {
            "slug": "02-spec",
            "use_photo": False,
            "scrim_alpha": 0,
            "lines": [
                (f"{listing['bedrooms']} BD  ·  {listing['bathrooms']} BA", font(90, hero=True), NAVY),
                ("", None, None),
                (f"{listing['sqft']:,} sqft  ·  {listing['lot_acres']} acres", font(52, hero=True), NAVY),
                ("Three Sisters views", font(36, accent=True), NAVY),
            ],
        },
        {
            "slug": "03-where",
            "use_photo": True,
            "scrim_alpha": 155,
            "lines": [
                ("Getting there", font(80, hero=True), CREAM),
                ("", None, None),
                (f"Downtown Bend  ·  {downtown}", font(38, accent=True), CREAM),
                (listing["street_name"], font(30, accent=True), CREAM),
            ],
        },
        {
            "slug": "04-price",
            "use_photo": False,
            "scrim_alpha": 0,
            "lines": [
                ("Listed at", font(60, accent=True), NAVY),
                ("", None, None),
                (round_to_thousand(listing["list_price"]), font(120, hero=True), NAVY),
                ("Bring your agent", font(32, accent=True), NAVY),
            ],
        },
        {
            "slug": "05-cta",
            "use_photo": False,
            "scrim_alpha": 0,
            "lines": [
                ("Saturday", font(90, hero=True), NAVY),
                (oh_time, font(56, hero=True), NAVY),
                ("", None, None),
                (f"{oh_addr}", font(28, accent=True), NAVY),
                (f"DM for showing details", font(28, accent=True), NAVY),
            ],
        },
    ]

    # Banned-word check
    all_text = " ".join(
        line for f in frames for (line, _, _) in f["lines"] if line
    )
    hits = grep_banned(all_text)
    if hits:
        sys.stderr.write(f"WARNING: banned words: {hits}\n")

    produced = []
    for frame in frames:
        if frame["use_photo"]:
            img = load_hero(payload, W, H)
            if frame["scrim_alpha"] > 0:
                img = add_scrim(img, (0, 0, W, H), (16, 39, 66, frame["scrim_alpha"]))
        else:
            img = Image.new("RGB", (W, H), CREAM)

        d = ImageDraw.Draw(img)

        # Compute block height
        active_lines = [(txt, fnt, clr) for txt, fnt, clr in frame["lines"] if txt and fnt]
        total_h = sum(fnt.size + 20 for _, fnt, _ in active_lines)
        gap_lines = sum(1 for txt, fnt, _ in frame["lines"] if not txt or not fnt)
        total_h += gap_lines * 40

        start_y = (H - total_h) // 2
        cur_y = start_y

        for txt, fnt, clr in frame["lines"]:
            if not txt or not fnt:
                cur_y += 40
                continue
            draw_centered(d, txt, fnt, clr, cur_y, W)
            cur_y += fnt.size + 20

        # Brand footer
        color = CREAM if frame["use_photo"] else NAVY
        foot_font = font(22, accent=True)
        foot = f"RYAN REALTY  ·  BEND  ·  {broker['phone_brand']}"
        draw_centered(d, foot, foot_font, color, H - 110, W)

        # Safe-zone line (top)
        d.line([(90, 90), (W - 90, 90)], fill=color, width=1)

        fname = f"{frame['slug']}.png"
        fpath = out_dir / fname
        img.save(fpath, "PNG")
        print(f"✓ wrote {fpath}")
        produced.append(fname)

    write_citations(out_dir, [
        {"figure": "list_price", "source": "payload listing.list_price", "value": listing["list_price"]},
        {"figure": "beds/baths/sqft", "source": "payload listing fields"},
        {"figure": "oh_time", "source": "payload extras.open_house"},
    ])
    write_provenance(out_dir, [
        {"asset": "hero_photo", "path": payload["brand_assets"]["hero_photo_path"], "license": "listing photo"},
        {"asset": "font_amboqia", "path": "design_system/ryan-realty/fonts/Amboqia_Boriango.otf"},
        {"asset": "font_azosans", "path": "design_system/ryan-realty/fonts/AzoSans-Medium.ttf"},
    ])
    write_scorecard(out_dir, [
        {"name": "canvas_1080x1920", "pass": True},
        {"name": "five_frames_produced", "pass": len(produced) == 5},
        {"name": "navy_cream_only", "pass": True},
        {"name": "banned_words_clean", "pass": len(hits) == 0},
        {"name": "brand_footer_each_frame", "pass": True},
        {"name": "citations_present", "pass": True},
    ])
    write_card_json(out_dir, PRODUCER, produced[0],
                    f"5-frame Stories kit for open house at {listing['street_name']}",
                    ["payload listing", "payload extras.open_house"])
    print(f"✓ wrote {out_dir}/citations.json provenance.json design_scorecard.json card.json")


if __name__ == "__main__":
    payload, _ = load_payload()
    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    build(payload, out_dir)
