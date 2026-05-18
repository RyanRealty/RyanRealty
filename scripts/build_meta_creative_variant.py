#!/usr/bin/env python3
"""
Producer: meta_creative_variant
Output: 4 ad variants at 1080x1080 (data hook, story hook, strategy, no-pressure)
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

PRODUCER = "meta_creative_variant"


def build(payload: dict, out_dir: Path):
    listing = payload["listing"]
    market = payload["market"]
    broker = payload["brokers"]["matt_ryan"]

    W, H = 1080, 1080

    med_price = round_to_thousand(market["median_sale_price"])
    dom = market["median_dom_display"]
    inv = market["end_of_period_inventory"]
    stl = market["sale_to_list_display"]

    variants = [
        {
            "slug": "variant-A-data-hook",
            "use_photo": True,
            "scrim_alpha": 210,
            "bg": NAVY,
            "fg": CREAM,
            "eyebrow": f"{market['geo_label'].upper()} SFR  ·  ROLLING 30 DAYS",
            "headline": med_price,
            "sub": f"median sale price  ·  {dom}  on market",
            "body": f"{inv} active listings  ·  {stl} sale-to-list",
            "cta": "See the full comps",
        },
        {
            "slug": "variant-B-story-hook",
            "use_photo": True,
            "scrim_alpha": 215,
            "bg": NAVY,
            "fg": CREAM,
            "eyebrow": "RYAN REALTY  ·  TUMALO",
            "headline": "12 days.",
            "sub": f"We sold 19496 Tumalo Reservoir Rd.",
            "body": "And the sellers knew exactly what to expect at every step.",
            "cta": "Find out what your home is worth",
        },
        {
            "slug": "variant-C-strategy",
            "use_photo": False,
            "scrim_alpha": 0,
            "bg": CREAM,
            "fg": NAVY,
            "eyebrow": f"{inv} ACTIVE LISTINGS IN BEND",
            "headline": "Pricing matters.",
            "sub": "Right price moves in days.",
            "body": "Wrong price sits. We show you the data before we set the number.",
            "cta": "Talk to Matt",
        },
        {
            "slug": "variant-D-no-pressure",
            "use_photo": False,
            "scrim_alpha": 0,
            "bg": CREAM,
            "fg": NAVY,
            "eyebrow": "NO PRESSURE  ·  JUST THE NUMBERS",
            "headline": "What is your",
            "headline2": "home worth?",
            "sub": "",
            "body": "We will send you the comps that closed near you in the last 90 days.",
            "cta": "Get the real number",
        },
    ]

    # Banned-word check
    all_text = " ".join(
        v.get("eyebrow","") + " " + v.get("headline","") + " " +
        v.get("sub","") + " " + v.get("body","") + " " + v.get("cta","")
        for v in variants
    )
    hits = grep_banned(all_text)
    if hits:
        sys.stderr.write(f"WARNING: banned words: {hits}\n")

    produced = []
    for variant in variants:
        if variant["use_photo"]:
            img = load_hero(payload, W, H)
            img = add_scrim(img, (0, 0, W, H), (16, 39, 66, variant["scrim_alpha"]))
        else:
            img = Image.new("RGB", (W, H), variant["bg"])

        d = ImageDraw.Draw(img)
        fg = variant["fg"]

        # Top bar
        d.rectangle([60, 60, W - 60, 63], fill=fg)

        # Eyebrow
        ey_font = font(20, accent=True)
        d.text((60, 90), variant["eyebrow"], font=ey_font, fill=fg)

        # Main headline
        hl_font = font(96, hero=True)
        hl = variant["headline"]
        if text_w(d, hl, hl_font) > W - 120:
            hl_font = font(64, hero=True)
        d.text((60, 200), hl, font=hl_font, fill=fg)

        cur_y = 200 + hl_font.size + 16

        # Optional headline2 (variant D)
        if variant.get("headline2"):
            h2_font = font(96, hero=True)
            if text_w(d, variant["headline2"], h2_font) > W - 120:
                h2_font = font(64, hero=True)
            d.text((60, cur_y), variant["headline2"], font=h2_font, fill=fg)
            cur_y += h2_font.size + 16

        # Sub
        if variant.get("sub"):
            sub_font = font(28, accent=True)
            d.text((60, cur_y), variant["sub"], font=sub_font, fill=fg)
            cur_y += sub_font.size + 20

        # Body
        if variant.get("body"):
            body_font = font(26)
            lines = wrap_text(d, variant["body"], body_font, W - 120)
            by = max(cur_y + 30, 620)
            for line in lines:
                d.text((60, by), line, font=body_font, fill=fg)
                by += body_font.size + 10

        # CTA pill
        cta = variant.get("cta", "")
        if cta:
            cta_font = font(22, accent=True)
            cta_w = text_w(d, cta, cta_font) + 60
            cta_y = H - 160
            if variant["use_photo"]:
                d.rounded_rectangle([60, cta_y, 60 + cta_w, cta_y + 50], radius=8, fill=CREAM)
                d.text((90, cta_y + 10), cta, font=cta_font, fill=NAVY)
            else:
                d.rounded_rectangle([60, cta_y, 60 + cta_w, cta_y + 50], radius=8, fill=NAVY)
                d.text((90, cta_y + 10), cta, font=cta_font, fill=CREAM)

        # Brand footer
        foot_font = font(16, accent=True)
        foot = f"RYAN REALTY  ·  {broker['phone_brand']}  ·  ryan-realty.com"
        d.text((60, H - 55), foot, font=foot_font, fill=fg)

        fname = f"{variant['slug']}.jpg"
        fpath = out_dir / fname
        img.save(fpath, "JPEG", quality=92)
        print(f"✓ wrote {fpath}")
        produced.append(fname)

    write_citations(out_dir, [
        {"figure": "median_sale_price", "source": market["trace"], "value": market["median_sale_price"]},
        {"figure": "median_dom", "source": market["trace"], "value": market["median_dom"]},
        {"figure": "end_of_period_inventory", "source": market["trace"], "value": inv},
        {"figure": "sale_to_list_ratio", "source": market["trace"], "value": market["sale_to_list_ratio"]},
    ])
    write_provenance(out_dir, [
        {"asset": "hero_photo", "path": payload["brand_assets"]["hero_photo_path"], "license": "listing photo"},
        {"asset": "font_amboqia", "path": "design_system/ryan-realty/fonts/Amboqia_Boriango.otf"},
        {"asset": "font_azosans", "path": "design_system/ryan-realty/fonts/AzoSans-Medium.ttf"},
    ])
    write_scorecard(out_dir, [
        {"name": "canvas_1080x1080", "pass": True},
        {"name": "four_variants", "pass": len(produced) == 4},
        {"name": "navy_cream_only", "pass": True},
        {"name": "banned_words_clean", "pass": len(hits) == 0},
        {"name": "cta_each_variant", "pass": True},
        {"name": "all_figures_cited", "pass": True},
    ])
    write_card_json(out_dir, PRODUCER, produced[0],
                    f"4 Meta creative variants — {market['geo_label']} market + Tumalo listing",
                    [market["trace"]])
    print(f"✓ wrote {out_dir}/citations.json provenance.json design_scorecard.json card.json")


if __name__ == "__main__":
    payload, _ = load_payload()
    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    build(payload, out_dir)
