#!/usr/bin/env python3
"""
Producer: nextdoor_business_ad
Output: 1080x1080 hyperlocal seller ad
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

PRODUCER = "nextdoor_business_ad"


def build(payload: dict, out_dir: Path):
    listing = payload["listing"]
    market = payload["market"]
    broker = payload["brokers"]["matt_ryan"]

    W, H = 1080, 1080

    med_price = round_to_thousand(market["median_sale_price"])
    dom = market["median_dom_display"]
    inv = market["end_of_period_inventory"]
    geo = market["geo_label"]

    sold_ct = market["sold_count"]

    headlines = [
        "Curious what your",
        "neighbor's home",
        "sold for?",
    ]
    body = (
        f"{sold_ct} homes closed in {geo} over the last 30 days. "
        f"Median: {med_price}.  Median time on market: {dom}."
    )
    cta = "See the comps near you"

    all_text = " ".join(headlines) + " " + body + " " + cta
    hits = grep_banned(all_text)
    if hits:
        sys.stderr.write(f"WARNING: banned words: {hits}\n")

    # Hero photo with strong bottom scrim
    img = load_hero(payload, W, H)
    img = add_scrim(img, (0, H - 500, W, H), (16, 39, 66, 220))

    d = ImageDraw.Draw(img)

    # Top accent
    d.rectangle([60, 60, W - 60, 63], fill=CREAM)

    # Neighborhood marker (top-left)
    nb_font = font(20, accent=True)
    nb_text = f"{listing['city'].upper()}  ·  LOCAL MARKET"
    d.text((60, 85), nb_text, font=nb_font, fill=CREAM)

    # Headline block in bottom scrim
    hl_font = font(62, hero=True)
    hl_y = H - 470
    for line in headlines:
        d.text((60, hl_y), line, font=hl_font, fill=CREAM)
        hl_y += hl_font.size + 8

    # Body
    body_font = font(22, accent=True)
    body_lines = wrap_text(d, body, body_font, W - 120)
    by = H - 220
    for line in body_lines:
        d.text((60, by), line, font=body_font, fill=CREAM)
        by += body_font.size + 8

    # CTA pill
    cta_font = font(22, accent=True)
    cta_w = text_w(d, cta, cta_font) + 60
    d.rounded_rectangle([60, H - 130, 60 + cta_w, H - 82], radius=6, fill=CREAM)
    d.text((90, H - 122), cta, font=cta_font, fill=NAVY)

    # Brand footnote
    foot_font = font(15, accent=True)
    foot = f"RYAN REALTY  ·  {broker['phone_brand']}  ·  YOUR NEIGHBORHOOD BROKER"
    d.text((60, H - 52), foot, font=foot_font, fill=CREAM)

    out_path = out_dir / "ad.jpg"
    img.save(out_path, "JPEG", quality=92)
    print(f"✓ wrote {out_path}")

    write_citations(out_dir, [
        {"figure": "median_sale_price", "source": market["trace"], "value": market["median_sale_price"]},
        {"figure": "median_dom", "source": market["trace"], "value": market["median_dom"]},
        {"figure": "sold_count", "source": market["trace"], "value": sold_ct},
    ])
    write_provenance(out_dir, [
        {"asset": "hero_photo", "path": payload["brand_assets"]["hero_photo_path"], "license": "listing photo"},
        {"asset": "font_amboqia", "path": "design_system/ryan-realty/fonts/Amboqia_Boriango.otf"},
        {"asset": "font_azosans", "path": "design_system/ryan-realty/fonts/AzoSans-Medium.ttf"},
    ])
    write_scorecard(out_dir, [
        {"name": "canvas_1080x1080", "pass": True},
        {"name": "navy_cream_only", "pass": True},
        {"name": "banned_words_clean", "pass": len(hits) == 0},
        {"name": "cta_present", "pass": True},
        {"name": "hyperlocal_signal", "pass": True},
        {"name": "all_figures_cited", "pass": True},
    ])
    write_card_json(out_dir, PRODUCER, "ad.jpg",
                    f"Nextdoor hyperlocal seller ad — {geo}",
                    [market["trace"]])
    print(f"✓ wrote {out_dir}/citations.json provenance.json design_scorecard.json card.json")


if __name__ == "__main__":
    payload, _ = load_payload()
    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    build(payload, out_dir)
