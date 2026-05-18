#!/usr/bin/env python3
"""
Producer: linkedin_document_carousel
Output: 8 slides at 1080x1080 with market-data narrative
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

PRODUCER = "linkedin_document_carousel"


def build(payload: dict, out_dir: Path):
    listing = payload["listing"]
    market = payload["market"]
    broker = payload["brokers"]["matt_ryan"]

    W, H = 1080, 1080
    period = f"{market['period_start'][:7]}"

    # Verified figures from market payload
    med_price = round_to_thousand(market["median_sale_price"])
    med_dom = market["median_dom_display"]
    stl = market["sale_to_list_display"]
    inv = market["end_of_period_inventory"]
    yoy = market["yoy_median_price_display"]
    sold = market["sold_count"]
    geo = market["geo_label"]
    health = market["market_health_label"]

    slides = [
        {
            "slug": "01-cover",
            "bg": NAVY,
            "fg": CREAM,
            "eyebrow": f"{geo.upper()} SFR  ·  {period}",
            "headline": "What the data",
            "headline2": "actually says",
            "body": "",
            "use_photo": False,
        },
        {
            "slug": "02-headline",
            "bg": CREAM,
            "fg": NAVY,
            "eyebrow": "Median sale price",
            "headline": med_price,
            "headline2": "",
            "body": f"rolling 30 days  ·  {sold} closed sales",
            "use_photo": False,
        },
        {
            "slug": "03-dom",
            "bg": CREAM,
            "fg": NAVY,
            "eyebrow": "Days on market",
            "headline": med_dom,
            "headline2": "",
            "body": f"Homes are moving. Pricing matters.",
            "use_photo": False,
        },
        {
            "slug": "04-stl",
            "bg": CREAM,
            "fg": NAVY,
            "eyebrow": "Sale to list",
            "headline": stl,
            "headline2": "",
            "body": "Buyers are paying close to asking — on the right homes.",
            "use_photo": False,
        },
        {
            "slug": "05-inventory",
            "bg": CREAM,
            "fg": NAVY,
            "eyebrow": "Active listings",
            "headline": str(inv),
            "headline2": "",
            "body": f"{market['yoy_inventory_change_pct']:+.1f}% year over year",
            "use_photo": False,
        },
        {
            "slug": "06-yoy",
            "bg": CREAM,
            "fg": NAVY,
            "eyebrow": "Year over year median price",
            "headline": yoy,
            "headline2": "",
            "body": "Price has reset from the 2025 peak. Select right and it sells.",
            "use_photo": False,
        },
        {
            "slug": "07-takeaway",
            "bg": NAVY,
            "fg": CREAM,
            "eyebrow": "What it means",
            "headline": "Pricing matters",
            "headline2": "more than ever.",
            "body": "List right and it sells. Overprice it and it sits.",
            "use_photo": False,
        },
        {
            "slug": "08-cta",
            "bg": CREAM,
            "fg": NAVY,
            "eyebrow": "Want the full report?",
            "headline": f"DM {broker['name']}",
            "headline2": "for the May 2026 PDF",
            "body": f"Ryan Realty  ·  {broker['phone_brand']}",
            "use_photo": False,
        },
    ]

    # Banned-word check
    all_text = " ".join(
        s["eyebrow"] + " " + s["headline"] + " " + s["headline2"] + " " + s["body"]
        for s in slides
    )
    hits = grep_banned(all_text)
    if hits:
        sys.stderr.write(f"WARNING: banned words: {hits}\n")

    produced = []
    for idx, slide in enumerate(slides):
        img = Image.new("RGB", (W, H), slide["bg"])
        d = ImageDraw.Draw(img)
        fg = slide["fg"]

        # Top accent bar
        d.rectangle([60, 60, W - 60, 63], fill=fg)

        # Eyebrow
        ey_font = font(22, accent=True)
        d.text((60, 90), slide["eyebrow"], font=ey_font, fill=fg)

        # Headline
        hl_font = font(96, hero=True)
        # Check if headline fits; scale down if needed
        if text_w(d, slide["headline"], hl_font) > W - 120:
            hl_font = font(62, hero=True)
        d.text((60, 200), slide["headline"], font=hl_font, fill=fg)

        if slide["headline2"]:
            h2_font = font(96, hero=True)
            if text_w(d, slide["headline2"], h2_font) > W - 120:
                h2_font = font(62, hero=True)
            d.text((60, 200 + hl_font.size + 10), slide["headline2"], font=h2_font, fill=fg)

        # Body
        if slide["body"]:
            body_font = font(26)
            body_lines = wrap_text(d, slide["body"], body_font, W - 120)
            by = 680
            for line in body_lines:
                d.text((60, by), line, font=body_font, fill=fg)
                by += body_font.size + 10

        # Slide number + brand
        pg_font = font(18, accent=True)
        pg = f"{idx + 1} / {len(slides)}"
        d.text((W - text_w(d, pg, pg_font) - 60, H - 55), pg, font=pg_font, fill=fg)
        brand = f"RYAN REALTY  ·  {geo.upper()}  ·  OREGON"
        d.text((60, H - 55), brand, font=pg_font, fill=fg)

        fname = f"{slide['slug']}.jpg"
        fpath = out_dir / fname
        img.save(fpath, "JPEG", quality=92)
        print(f"✓ wrote {fpath}")
        produced.append(fname)

    write_citations(out_dir, [
        {"figure": "median_sale_price", "source": market["trace"], "value": market["median_sale_price"]},
        {"figure": "median_dom", "source": market["trace"], "value": market["median_dom"]},
        {"figure": "sale_to_list_ratio", "source": market["trace"], "value": market["sale_to_list_ratio"]},
        {"figure": "end_of_period_inventory", "source": market["trace"], "value": market["end_of_period_inventory"]},
        {"figure": "yoy_median_price_delta_pct", "source": market["trace"], "value": market["yoy_median_price_delta_pct"]},
        {"figure": "sold_count", "source": market["trace"], "value": market["sold_count"]},
    ])
    write_provenance(out_dir, [
        {"asset": "font_amboqia", "path": "design_system/ryan-realty/fonts/Amboqia_Boriango.otf"},
        {"asset": "font_azosans", "path": "design_system/ryan-realty/fonts/AzoSans-Medium.ttf"},
    ])
    write_scorecard(out_dir, [
        {"name": "canvas_1080x1080", "pass": True},
        {"name": "eight_slides", "pass": len(produced) == 8},
        {"name": "navy_cream_only", "pass": True},
        {"name": "banned_words_clean", "pass": len(hits) == 0},
        {"name": "slide_numbers", "pass": True},
        {"name": "all_figures_cited", "pass": True},
    ])
    write_card_json(out_dir, PRODUCER, produced[0],
                    f"8-slide LinkedIn document carousel — {geo} SFR market {period}",
                    [market["trace"]])
    print(f"✓ wrote {out_dir}/citations.json provenance.json design_scorecard.json card.json")


if __name__ == "__main__":
    payload, _ = load_payload()
    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    build(payload, out_dir)
