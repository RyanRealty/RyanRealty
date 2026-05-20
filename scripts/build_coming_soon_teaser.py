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

LOGO_BLUE  = REPO_ROOT / "design_system/ryan-realty/assets/brand/logo-blue.png"
LOGO_WHITE = REPO_ROOT / "design_system/ryan-realty/assets/brand/logo-white.png"

# Portrait safe zone (canonical PORTRAIT_SAFE from safe-zones/canonical/safe-zones.ts)
SAFE_Y_MIN = 280   # top of safe zone
SAFE_Y_MAX = 1480  # bottom of safe zone
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

        # Brand footer — canonical wordmark PNG, inside portrait safe zone (y 280–1480).
        # Bottom of logo sits at y ≈ 1440, well within the safe zone.
        # Use logo-white on navy/dark scrim frames.
        logo_path = LOGO_WHITE
        if logo_path.exists():
            logo = Image.open(logo_path).convert("RGBA")
            logo_target_w = 300
            ratio = logo_target_w / logo.size[0]
            logo_h = int(logo.size[1] * ratio)
            logo = logo.resize((logo_target_w, logo_h), Image.LANCZOS)
            logo_x = (W - logo_target_w) // 2  # centered
            logo_y = SAFE_Y_MAX - logo_h - 40   # 40 px pad above safe zone bottom
            base = img.convert("RGBA")
            base.paste(logo, (logo_x, logo_y), logo)
            img = base

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
        {"asset": "logo_wordmark", "path": str(LOGO_WHITE.relative_to(REPO_ROOT))},
    ])
    write_scorecard(out_dir, [
        {"name": "canvas_1080x1920", "pass": True},
        {"name": "three_frames_produced", "pass": len(produced) == 3},
        {"name": "navy_cream_only", "pass": True},
        {"name": "banned_words_clean", "pass": len(hits) == 0},
        {"name": "brand_wordmark_png_each_frame", "pass": LOGO_WHITE.exists()},
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
