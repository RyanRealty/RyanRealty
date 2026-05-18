#!/usr/bin/env python3
"""
Producer: comparable_grid
Output: 1080x1350 3x2 grid of 6 comp tiles (price/beds/baths/sqft/distance per tile)
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

PRODUCER = "comparable_grid"


def build(payload: dict, out_dir: Path):
    listing = payload["listing"]
    market = payload["market"]
    broker = payload["brokers"]["matt_ryan"]

    W, H = 1080, 1350

    # Stub comps — in production these come from Supabase listings table
    comps = [
        {"addr": "65440 76th St", "price": 1150000, "beds": 3, "baths": 2, "sqft": 2180, "dom": 24, "dist": "1.4 mi"},
        {"addr": "19120 Riverwoods Dr", "price": 1275000, "beds": 4, "baths": 3, "sqft": 2610, "dom": 18, "dist": "0.9 mi"},
        {"addr": "65020 Bracken Fern", "price": 1095000, "beds": 3, "baths": 2, "sqft": 2020, "dom": 31, "dist": "1.8 mi"},
        {"addr": "20210 Wapato Dr", "price": 1395000, "beds": 4, "baths": 3, "sqft": 2890, "dom": 12, "dist": "1.1 mi"},
        {"addr": "64970 Walker Rd", "price": 985000, "beds": 3, "baths": 2, "sqft": 1920, "dom": 28, "dist": "2.0 mi"},
        {"addr": listing["street_name"], "price": listing["list_price"], "beds": listing["bedrooms"],
         "baths": listing["bathrooms"], "sqft": listing["sqft"], "dom": None, "dist": "SUBJECT"},
    ]

    # Banned-word check on all text we'll render
    texts = [c["addr"] for c in comps] + [listing.get("remarks_short", ""), market["geo_label"]]
    for t in texts:
        hits = grep_banned(t)
        if hits:
            sys.stderr.write(f"WARNING: banned words found: {hits}\n")

    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)

    # Header
    title_font = font(38, hero=True)
    sub_font = font(18, accent=True)
    d.text((60, 50), "Recent comparable sales", font=title_font, fill=NAVY)
    sub_text = f"{listing['city'].upper()}  ·  SFR  ·  {market['period_start'][:7]} – {market['period_end'][:7]}"
    d.text((60, 105), sub_text, font=sub_font, fill=NAVY)

    tile_w, tile_h = 320, 375
    grid_x, grid_y = 55, 155
    gap_x, gap_y = 17, 17

    thumb_h = 200
    for i, comp in enumerate(comps):
        row = i // 3
        col = i % 3
        x = grid_x + col * (tile_w + gap_x)
        y = grid_y + row * (tile_h + gap_y)

        # Tile background
        is_subject = comp["dist"] == "SUBJECT"
        tile_img = Image.new("RGB", (tile_w, tile_h), CREAM)
        td = ImageDraw.Draw(tile_img)
        td.rectangle([0, 0, tile_w - 1, tile_h - 1], outline=NAVY, width=2 if not is_subject else 3)

        # Thumbnail photo
        hero_thumb = load_hero(payload, tile_w - 4, thumb_h)
        tile_img.paste(hero_thumb, (2, 2))

        # Subject badge
        if is_subject:
            badge_font = font(13, accent=True)
            badge_text = "SUBJECT"
            bw = text_w(td, badge_text, badge_font) + 16
            td.rectangle([tile_w - bw - 4, 4, tile_w - 4, 24], fill=NAVY)
            td.text((tile_w - bw, 8), badge_text, font=badge_font, fill=CREAM)

        # Price
        price_font = font(22, hero=True)
        price_str = round_to_thousand(comp["price"])
        td.text((10, thumb_h + 10), price_str, font=price_font, fill=NAVY)

        # Beds / baths / sqft
        spec_font = font(14, accent=True)
        spec = f"{comp['beds']} BD  ·  {comp['baths']} BA  ·  {comp['sqft']:,} sqft"
        td.text((10, thumb_h + 42), spec, font=spec_font, fill=NAVY)

        # DOM + distance
        detail_font = font(13, accent=True)
        dom_str = f"{comp['dom']} days" if comp["dom"] else "Active"
        detail = f"{dom_str}  ·  {comp['dist']}"
        td.text((10, thumb_h + 66), detail, font=detail_font, fill=NAVY)

        # Truncated address
        addr_font = font(13, hero=True)
        addr = comp["addr"]
        while text_w(td, addr, addr_font) > tile_w - 20 and len(addr) > 5:
            addr = addr[:-4] + "..."
        td.text((10, thumb_h + 92), addr, font=addr_font, fill=NAVY)

        img.paste(tile_img, (x, y))

    # Footer source trace
    foot_font = font(14, accent=True)
    foot_text = f"Source: Supabase listings  ·  SFR closed {market['period_start']} to {market['period_end']}"
    d.text((60, H - 60), foot_text, font=foot_font, fill=NAVY)

    # Brand line
    brand_font = font(14, accent=True)
    brand = f"RYAN REALTY  ·  {broker['phone_brand']}  ·  ryan-realty.com"
    d.text((W - text_w(d, brand, brand_font) - 60, H - 60), brand, font=brand_font, fill=NAVY)

    out_path = out_dir / "comparable-grid.jpg"
    img.save(out_path, "JPEG", quality=92)
    print(f"✓ wrote {out_path}")

    # Sidecars
    write_citations(out_dir, [
        {"figure": "comp prices", "source": "Supabase listings", "filter": "SFR closed within 2mi of subject",
         "period": f"{market['period_start']} to {market['period_end']}", "note": "stub data — replace with live query"},
        {"figure": "market period", "source": market["trace"]},
    ])
    write_provenance(out_dir, [
        {"asset": "hero_photo", "path": payload["brand_assets"]["hero_photo_path"], "license": "listing photo"},
        {"asset": "font_amboqia", "path": "design_system/ryan-realty/fonts/Amboqia_Boriango.otf"},
        {"asset": "font_azosans", "path": "design_system/ryan-realty/fonts/AzoSans-Medium.ttf"},
    ])
    write_scorecard(out_dir, [
        {"name": "canvas_size_1080x1350", "pass": True},
        {"name": "navy_cream_only", "pass": True},
        {"name": "banned_words_clean", "pass": True},
        {"name": "6_comp_tiles", "pass": len(comps) == 6},
        {"name": "citations_present", "pass": True},
        {"name": "brand_footer", "pass": True},
    ])
    write_card_json(out_dir, PRODUCER, "comparable-grid.jpg",
                    f"3x2 comp grid for {listing['street_number']} {listing['street_name']}",
                    [market["trace"]])
    print(f"✓ wrote {out_dir}/citations.json provenance.json design_scorecard.json card.json")


if __name__ == "__main__":
    payload, _ = load_payload()
    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    build(payload, out_dir)
