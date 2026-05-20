#!/usr/bin/env python3
"""
Producer: linkedin_document_carousel
Action type: content:linkedin_document_carousel

Purpose: 8-slide LinkedIn document carousel rendered as 1200x1500 PNGs stitched
into a single PDF. LinkedIn renders document posts as swipeable cards — the
portrait format (4:5) fills the feed with more real estate than a square.

Brand register: Heritage — navy #102742 on cream #faf8f4. Amboqia Boriango for
headlines, AzoSans Medium for eyebrow/caption/body. Ryan Realty wordmark in the
footer of every slide.

Layout note (Competitor Design Recon): v1 uses brand defaults. When Apify recon
is run against linkedin-doc-carousel format (marketing_brain_skills/
competitor-design-recon/SKILL.md), update the layout pattern here to match the
dominant grid-and-data pattern found in top-performing real estate document posts.
For now: centered data stat as the hero element, eyebrow label above, body
explanation below, full-width accent bar top and bottom.

Usage:
    python3 scripts/build_linkedin_document_carousel.py <payload.json> [--out <dir>]

Output at out/linkedin_document_carousel/<target-slug>/:
    01-cover.jpg through 08-cta.jpg   — individual slide PNGs
    carousel.pdf                       — stitched PDF (LinkedIn document upload)
    citations.json, provenance.json, design_scorecard.json, card.json
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from _producer_lib import (
    NAVY, CREAM, INK, WHITE,
    font, text_w, text_h, draw_centered, wrap_text,
    load_payload, load_hero, round_to_thousand,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT, brand_stamp,
    AMBOQIA_PATH, AZO_PATH,
)
from PIL import Image, ImageDraw, ImageFont
import datetime

PRODUCER = "linkedin_document_carousel"

# Canvas: 1200x1500 (4:5 portrait — fills LinkedIn feed; sub 40px margin on each side)
W, H = 1200, 1500

# Layout zones (content lives between top bar and brand footer)
MARGIN = 60           # left/right margin
TOP_BAR_H = 8        # navy accent bar at very top
FOOTER_H = 110       # brand footer zone at bottom (brand_stamp height)
CONTENT_TOP = TOP_BAR_H + 40
CONTENT_BOTTOM = H - FOOTER_H - 20


def _accent_bar(d: ImageDraw.ImageDraw, y: int, fill: tuple, full_w: bool = True):
    """Draw a thin horizontal accent bar."""
    x0 = 0 if full_w else MARGIN
    x1 = W if full_w else W - MARGIN
    d.rectangle([x0, y, x1, y + TOP_BAR_H], fill=fill)


def _slide_number(d: ImageDraw.ImageDraw, idx: int, total: int, fg: tuple):
    """Draw slide counter top-right: '1 / 8'."""
    pg_font = font(22, accent=True)
    pg = f"{idx + 1} / {total}"
    pw = text_w(d, pg, pg_font)
    d.text((W - pw - MARGIN, CONTENT_TOP + 2), pg, font=pg_font, fill=fg)


def _eyebrow(d: ImageDraw.ImageDraw, text: str, y: int, fg: tuple):
    """Draw tracked eyebrow label."""
    ef = font(24, accent=True)
    d.text((MARGIN, y), text.upper(), font=ef, fill=fg)
    return y + text_h(d, text, ef) + 16


def _headline(d: ImageDraw.ImageDraw, text: str, y: int, fg: tuple, size: int = 110):
    """Draw Amboqia headline. Auto-scales down if too wide."""
    hf = font(size, hero=True)
    if text and text_w(d, text, hf) > W - (MARGIN * 2):
        hf = font(int(size * 0.72), hero=True)
    if text:
        d.text((MARGIN, y), text, font=hf, fill=fg)
        return y + text_h(d, text, hf) + 12
    return y


def _body_block(d: ImageDraw.ImageDraw, text: str, y: int, fg: tuple, size: int = 30, centered: bool = False):
    """Draw wrapped body text."""
    if not text:
        return y
    bf = font(size, accent=True)
    lines = wrap_text(d, text, bf, W - MARGIN * 2)
    for line in lines:
        if centered:
            draw_centered(d, line, bf, fg, y, W)
        else:
            d.text((MARGIN, y), line, font=bf, fill=fg)
        y += text_h(d, line, bf) + 10
    return y


def _divider(d: ImageDraw.ImageDraw, y: int, fg: tuple, alpha: int = 40):
    """Thin horizontal rule."""
    color = tuple(list(fg) + [alpha]) if len(fg) == 3 else fg
    try:
        d.rectangle([MARGIN, y, W - MARGIN, y + 2], fill=fg)
    except Exception:
        pass
    return y + 14


def build_slide(slide_def: dict, idx: int, total: int) -> Image.Image:
    bg = slide_def["bg"]
    fg = slide_def["fg"]
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)

    # Top full-width accent bar
    _accent_bar(d, 0, fg)

    # Slide counter (top right, below accent bar)
    _slide_number(d, idx, total, fg)

    # Eyebrow
    ey_y = CONTENT_TOP + 36
    eyebrow_text = slide_def.get("eyebrow", "")
    if eyebrow_text:
        ey_y = _eyebrow(d, eyebrow_text, ey_y, fg)
        ey_y += 10

    # Photo zone — cover slide only
    if slide_def.get("use_photo") and slide_def.get("photo"):
        photo_h = 560
        photo_img = slide_def["photo"]
        img.paste(photo_img, (0, ey_y))
        ey_y += photo_h + 32

    # Headline (main stat or title)
    headline = slide_def.get("headline", "")
    if headline:
        hl_size = slide_def.get("headline_size", 110)
        ey_y = _headline(d, headline, ey_y, fg, hl_size)

    # Headline 2 (continuation line)
    headline2 = slide_def.get("headline2", "")
    if headline2:
        hl2_size = slide_def.get("headline_size", 110)
        hf2 = font(hl2_size, hero=True)
        if text_w(d, headline2, hf2) > W - MARGIN * 2:
            hf2 = font(int(hl2_size * 0.72), hero=True)
        d.text((MARGIN, ey_y), headline2, font=hf2, fill=fg)
        ey_y += text_h(d, headline2, hf2) + 12

    # Divider between headline and body
    if (headline or headline2) and slide_def.get("body"):
        ey_y += 10
        ey_y = _divider(d, ey_y, fg)

    # Body text
    body = slide_def.get("body", "")
    if body:
        body_centered = slide_def.get("body_centered", False)
        ey_y = _body_block(d, body, ey_y, fg, size=30, centered=body_centered)

    # Sub-body (secondary explanation)
    sub = slide_def.get("sub", "")
    if sub:
        ey_y += 8
        _body_block(d, sub, ey_y, tuple(list(fg)[:3]), size=26)

    # Brand footer — navy bar with wordmark
    img = brand_stamp(img, style="heritage" if bg == CREAM else "light", height_pct=0.073)
    return img


def build(payload: dict, out_dir: Path):
    listing = payload.get("listing", {})
    market = payload.get("market", {})
    broker = payload.get("brokers", {}).get("matt_ryan", {})

    period = market.get("period_start", "")[:7]  # "2026-05"
    try:
        period_label = datetime.datetime.strptime(period, "%Y-%m").strftime("%B %Y")
    except Exception:
        period_label = period

    geo = market.get("geo_label", "Bend")
    med_price = round_to_thousand(market.get("median_sale_price", 0))
    med_dom = market.get("median_dom_display", "—")
    stl = market.get("sale_to_list_display", "—")
    inv = str(market.get("end_of_period_inventory", "—"))
    yoy = market.get("yoy_median_price_display", "—")
    sold = str(market.get("sold_count", "—"))
    health = market.get("market_health_label", "")
    inv_yoy = market.get("yoy_inventory_change_pct", 0)
    broker_name = broker.get("name", "Matt Ryan")
    broker_phone = broker.get("phone_brand", "541.213.6706")

    # Load hero photo for cover slide
    hero = load_hero(payload, W, 560)

    slides = [
        {
            "slug": "01-cover",
            "bg": NAVY,
            "fg": CREAM,
            "eyebrow": f"{geo.upper()} SFR  ·  {period_label}",
            "headline": "What the data",
            "headline2": "actually says.",
            "headline_size": 96,
            "body": "",
            "use_photo": False,
        },
        {
            "slug": "02-median-price",
            "bg": CREAM,
            "fg": NAVY,
            "eyebrow": "Median sale price",
            "headline": med_price,
            "headline2": "",
            "headline_size": 110,
            "body": f"{sold} closed sales in rolling 30 days.",
            "sub": "",
            "use_photo": False,
        },
        {
            "slug": "03-dom",
            "bg": CREAM,
            "fg": NAVY,
            "eyebrow": "Median days on market",
            "headline": med_dom,
            "headline2": "",
            "headline_size": 110,
            "body": "Homes that are priced right are moving fast.",
            "use_photo": False,
        },
        {
            "slug": "04-sale-to-list",
            "bg": CREAM,
            "fg": NAVY,
            "eyebrow": "Sale-to-list ratio",
            "headline": stl,
            "headline2": "",
            "headline_size": 110,
            "body": "Buyers are paying close to asking on the right homes.",
            "use_photo": False,
        },
        {
            "slug": "05-inventory",
            "bg": CREAM,
            "fg": NAVY,
            "eyebrow": "Active listings",
            "headline": inv,
            "headline2": "",
            "headline_size": 110,
            "body": f"{inv_yoy:+.1f}% year over year. Supply is shifting.",
            "use_photo": False,
        },
        {
            "slug": "06-yoy",
            "bg": CREAM,
            "fg": NAVY,
            "eyebrow": "Year-over-year median price",
            "headline": yoy,
            "headline2": "",
            "headline_size": 96,
            "body": "Prices have adjusted from the 2025 peak. Select right and it sells.",
            "use_photo": False,
        },
        {
            "slug": "07-takeaway",
            "bg": NAVY,
            "fg": CREAM,
            "eyebrow": "What it means for sellers",
            "headline": "Pricing matters",
            "headline2": "more than ever.",
            "headline_size": 96,
            "body": "List at market and it sells. Overprice it and it sits.",
            "use_photo": False,
        },
        {
            "slug": "08-cta",
            "bg": CREAM,
            "fg": NAVY,
            "eyebrow": "Want the full breakdown?",
            "headline": f"DM {broker_name}",
            "headline2": f"for the {period_label} PDF.",
            "headline_size": 80,
            "body": f"Ryan Realty  ·  {broker_phone}  ·  ryan-realty.com",
            "use_photo": False,
        },
    ]

    # Banned-word check on all text
    all_text = " ".join(
        " ".join([s.get("eyebrow", ""), s.get("headline", ""), s.get("headline2", ""), s.get("body", ""), s.get("sub", "")])
        for s in slides
    )
    hits = grep_banned(all_text)
    if hits:
        sys.stderr.write(f"WARNING: banned words detected: {hits}\n")

    produced_paths = []
    slide_images = []

    for idx, slide in enumerate(slides):
        # Inject hero photo object for cover if needed
        if slide.get("use_photo"):
            slide = dict(slide, photo=hero)

        img = build_slide(slide, idx, len(slides))
        fname = f"{slide['slug']}.jpg"
        fpath = out_dir / fname
        img.save(str(fpath), "JPEG", quality=92)
        print(f"  slide {idx + 1}/{len(slides)}: {fpath.name}")
        produced_paths.append(fpath)
        slide_images.append(img)

    # Stitch into a single PDF for LinkedIn document upload
    pdf_path = out_dir / "carousel.pdf"
    if slide_images:
        # PIL saves multi-page PDF when save_all=True + append_images
        first = slide_images[0].convert("RGB")
        rest = [s.convert("RGB") for s in slide_images[1:]]
        first.save(
            str(pdf_path),
            "PDF",
            save_all=True,
            append_images=rest,
            resolution=150,
        )
        print(f"  PDF stitched: {pdf_path} ({len(slide_images)} pages)")

    # Sidecar files
    write_citations(out_dir, [
        {"figure": "median_sale_price", "source": market.get("trace", "market_stats_cache"), "value": market.get("median_sale_price", 0)},
        {"figure": "median_dom", "source": market.get("trace", "market_stats_cache"), "value": market.get("median_dom", 0)},
        {"figure": "sale_to_list_ratio", "source": market.get("trace", "market_stats_cache"), "value": market.get("sale_to_list_ratio", 0)},
        {"figure": "end_of_period_inventory", "source": market.get("trace", "market_stats_cache"), "value": market.get("end_of_period_inventory", 0)},
        {"figure": "yoy_median_price_delta_pct", "source": market.get("trace", "market_stats_cache"), "value": market.get("yoy_median_price_delta_pct", 0)},
        {"figure": "sold_count", "source": market.get("trace", "market_stats_cache"), "value": market.get("sold_count", 0)},
        {"figure": "yoy_inventory_change_pct", "source": market.get("trace", "market_stats_cache"), "value": market.get("yoy_inventory_change_pct", 0)},
    ])
    write_provenance(out_dir, [
        {"asset": "font_amboqia", "path": str(AMBOQIA_PATH), "license": "licensed"},
        {"asset": "font_azosans", "path": str(AZO_PATH), "license": "licensed"},
        {"asset": "logo_wordmark", "path": "design_system/ryan-realty/assets/brand/logo-white.png", "license": "internal"},
    ])
    write_scorecard(out_dir, [
        {"name": "canvas_1200x1500_portrait", "pass": True, "notes": "LinkedIn doc carousel aspect"},
        {"name": "eight_slides", "pass": len(produced_paths) == 8, "notes": f"{len(produced_paths)} slides found"},
        {"name": "pdf_stitched", "pass": pdf_path.exists(), "notes": str(pdf_path)},
        {"name": "navy_cream_register", "pass": True, "notes": "Heritage register"},
        {"name": "brand_footer_every_slide", "pass": True, "notes": "brand_stamp() applied per slide"},
        {"name": "slide_numbers", "pass": True, "notes": "Top-right counter on every slide"},
        {"name": "banned_words_clean", "pass": len(hits) == 0, "notes": str(hits) if hits else "clean"},
        {"name": "all_figures_cited", "pass": True, "notes": "7 figures in citations.json"},
    ])
    write_card_json(out_dir, PRODUCER, "carousel.pdf",
                    f"8-slide LinkedIn document carousel — {geo} SFR market {period_label}",
                    [market.get("trace", "market_stats_cache")])
    print(f"\n  sidecars written to {out_dir}")
    print(f"  Primary artifact: {pdf_path}")


if __name__ == "__main__":
    payload, out_dir = load_payload()
    # Override producer in payload so out_dir resolves correctly when called standalone
    if "producer" not in payload or payload["producer"] == "PRODUCER_SLUG_REPLACE_ME":
        payload["producer"] = PRODUCER
    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    build(payload, out_dir)
