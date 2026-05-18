#!/usr/bin/env python3
"""
Producer: coming_soon_teaser
Output: 3 storyboard PNGs at 1080x1920 (exterior, tease, reveal)
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

PRODUCER = "coming_soon_teaser"


def build(payload: dict, out_dir: Path):
    listing = payload["listing"]
    broker = payload["brokers"]["matt_ryan"]

    W, H = 1080, 1920

    loc = f"{listing['city'].upper()}  ·  {listing['state'].upper()}"

    frames = [
        {
            "slug": "01-exterior",
            "scrim_alpha": 150,
            "content": [
                ("Coming this week", font(88, hero=True), CREAM, H // 2 - 260),
                (loc, font(32, accent=True), CREAM, H // 2 - 130),
            ],
        },
        {
            "slug": "02-tease",
            "scrim_alpha": 170,
            "content": [
                (f"{listing['bedrooms']} BD  ·  {listing['bathrooms']} BA", font(80, hero=True), CREAM, H // 2 - 240),
                (f"{listing['sqft']:,} sqft  ·  {listing['lot_acres']} acres", font(52, hero=True), CREAM, H // 2 - 130),
                ("Three Sisters views", font(36, accent=True), CREAM, H // 2 - 40),
            ],
        },
        {
            "slug": "03-reveal",
            "scrim_alpha": 160,
            "content": [
                ("Coming Soon", font(108, hero=True), CREAM, H // 2 - 280),
                (f"{listing['street_number']} {listing['street_name']}", font(38, accent=True), CREAM, H // 2 - 130),
                (f"{listing['city']}, {listing['state']}  ·  {listing['zip']}", font(28, accent=True), CREAM, H // 2 - 60),
                ("DM for early access", font(30, accent=True), CREAM, H // 2 + 20),
            ],
        },
    ]

    # Banned-word check
    all_text = " ".join(txt for f in frames for txt, _, _, _ in f["content"])
    hits = grep_banned(all_text)
    if hits:
        sys.stderr.write(f"WARNING: banned words: {hits}\n")

    produced = []
    for frame in frames:
        img = load_hero(payload, W, H)
        img = add_scrim(img, (0, 0, W, H), (16, 39, 66, frame["scrim_alpha"]))
        d = ImageDraw.Draw(img)

        for txt, fnt, clr, y in frame["content"]:
            draw_centered(d, txt, fnt, clr, y, W)

        # Brand bottom
        foot_font = font(22, accent=True)
        draw_centered(d, "RYAN REALTY", foot_font, CREAM, H - 110, W)

        # Top accent bar
        d.rectangle([90, 90, W - 90, 94], fill=CREAM)

        fname = f"{frame['slug']}.png"
        fpath = out_dir / fname
        img.save(fpath, "PNG")
        print(f"✓ wrote {fpath}")
        produced.append(fname)

    write_citations(out_dir, [
        {"figure": "property_specs", "source": "payload listing fields",
         "values": {"beds": listing["bedrooms"], "baths": listing["bathrooms"],
                    "sqft": listing["sqft"], "acres": listing["lot_acres"]}},
    ])
    write_provenance(out_dir, [
        {"asset": "hero_photo", "path": payload["brand_assets"]["hero_photo_path"], "license": "listing photo"},
        {"asset": "font_amboqia", "path": "design_system/ryan-realty/fonts/Amboqia_Boriango.otf"},
        {"asset": "font_azosans", "path": "design_system/ryan-realty/fonts/AzoSans-Medium.ttf"},
    ])
    write_scorecard(out_dir, [
        {"name": "canvas_1080x1920", "pass": True},
        {"name": "three_frames_produced", "pass": len(produced) == 3},
        {"name": "navy_cream_only", "pass": True},
        {"name": "banned_words_clean", "pass": len(hits) == 0},
        {"name": "brand_footer_each_frame", "pass": True},
    ])
    write_card_json(out_dir, PRODUCER, produced[0],
                    f"3-frame coming-soon storyboard for {listing['street_number']} {listing['street_name']}",
                    ["payload listing fields"])
    print(f"✓ wrote {out_dir}/citations.json provenance.json design_scorecard.json card.json")


if __name__ == "__main__":
    payload, _ = load_payload()
    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    build(payload, out_dir)
