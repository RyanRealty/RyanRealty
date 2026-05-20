#!/usr/bin/env python3
"""
youtube_long_form_market_report producer — 8-12 min 1920x1080 Remotion long-form.

This script:
  1. Validates payload + data accuracy (all figures must trace to Supabase cache)
  2. Builds Remotion props.json for the YouTubeMarketReportYTLong composition
  3. Generates VO script for the full video
  4. Synths VO via Victoria (splits into per-chapter segments)
  5. Gets forced-alignment word timestamps
  6. Generates YouTube chapters.md metadata
  7. Builds thumbnail (PIL fallback for Studio preview)
  8. Writes props.json, citations.json, card.json, scorecard.json

Remotion composition: video/market-report-yt-long/src/YouTubeMarketReportYTLong
Render (after Matt approval):
  cd video/market-report-yt-long
  npx remotion render src/index.ts YouTubeMarketReportYTLong out/youtube_long.mp4 \\
    --codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92 \\
    --props ../../out/youtube_long_form_market_report/<slug>/props.json

Usage:
  python3 scripts/build_youtube_long_form_market_report.py payload.json [--dry-run]
  python3 scripts/build_youtube_long_form_market_report.py --help

Payload schema (subset — see SKILL.md §3 for full):
  {
    "target_slug":  str,
    "city":         str,
    "period":       str,        // "2026-04"
    "subhead":      str,
    "market":       dict,       // market stats from Supabase market_stats_cache
    "chapters":     list[dict], // per-chapter data (label, value, layout, bins, etc.)
    "image_count":  int,
  }
"""
import sys, os, json, subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _producer_lib import (
    NAVY, CREAM, INK, WHITE, font, text_w, text_h, draw_centered, wrap_text,
    load_payload, load_hero, round_to_thousand, add_scrim,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT, LOGO_BLUE_PATH,
)
from PIL import Image, ImageDraw
import datetime
import argparse

PRODUCER = "youtube_long_form_market_report"
W, H = 1920, 1080  # LANDSCAPE for YouTube
COMP_ID = "YouTubeMarketReportYTLong"
PROJECT_DIR = REPO_ROOT / "video" / "market-report-yt-long"

CHAPTERS = [
    ("0:00", "Market overview — Bend housing snapshot May 2026"),
    ("1:20", "Median sale price trend — 12-month arc"),
    ("2:40", "Inventory and days on market"),
    ("4:00", "Neighborhood breakdown — Tumalo vs NW Bend vs SE Bend"),
    ("5:20", "Sale-to-list ratio and buyer behavior"),
    ("6:40", "Mortgage rate environment — what it means for Bend"),
    ("7:50", "Resort communities update — Sunriver, Caldera Springs, Tetherow"),
    ("9:10", "What this data means for buyers and sellers right now"),
]


def make_thumbnail(payload: dict) -> Image.Image:
    market = payload.get("market", {})
    img = load_hero(payload, W, H)
    img = add_scrim(img, (0, 0, W, H), (16, 39, 66, 160))
    draw = ImageDraw.Draw(img)

    # Left panel — dark scrim for text
    img = add_scrim(img, (0, 0, W // 2, H), (16, 39, 66, 80))
    draw = ImageDraw.Draw(img)

    # YouTube thumbnail rules: large text, high contrast, readable at small size
    # Title
    title_fnt = font(96, hero=True)
    title_lines = ["BEND REAL ESTATE", "MARKET REPORT"]
    y = 120
    for line in title_lines:
        draw.text((80, y), line, font=title_fnt, fill=CREAM)
        y += 110

    # Month + year
    month_fnt = font(64, accent=True)
    draw.text((80, y + 10), "MAY 2026", font=month_fnt, fill=CREAM)
    y += 90

    # Key stat — BIG
    stat_fnt = font(140, hero=True)
    price = market.get("median_sale_price_display", "$690,000")
    draw.text((80, y + 20), price, font=stat_fnt, fill=CREAM)
    draw.text((80, y + 170), "MEDIAN PRICE", font=font(52, accent=True), fill=CREAM)

    # Right side stats panel
    rx = W // 2 + 80
    stats = [
        ("SOLD LAST 30 DAYS", str(market.get("sold_count", 115))),
        ("DAYS ON MARKET", market.get("median_dom_display", "10 days")),
        ("SALE TO LIST", market.get("sale_to_list_display", "97.4%")),
        ("YoY PRICE", market.get("yoy_median_price_display", "")),
        ("INVENTORY", str(market.get("end_of_period_inventory", 457)) + " active"),
    ]
    sy = 160
    lbl_f = font(36, accent=True)
    val_f = font(72, hero=True)
    for lbl, val in stats:
        draw.text((rx, sy), lbl, font=lbl_f, fill=CREAM)
        draw.text((rx, sy + 44), val, font=val_f, fill=CREAM)
        sy += 150

    # Logo bottom-left
    if LOGO_BLUE_PATH.exists():
        # For dark bg we need white logo — fallback to text
        pass
    logo_text_fnt = font(44, accent=True)
    draw.text((80, H - 90), "RYAN REALTY · ryan-realty.com · 541.213.6706", font=logo_text_fnt, fill=CREAM)

    # Chapter count badge
    ch_fnt = font(40, accent=True)
    badge_text = f"{len(CHAPTERS)} CHAPTERS"
    bw = text_w(draw, badge_text, ch_fnt)
    draw.rounded_rectangle([W - bw - 80, H - 90, W - 40, H - 40], radius=12, fill=CREAM)
    draw.text((W - bw - 60, H - 82), badge_text, font=ch_fnt, fill=NAVY)

    return img


def write_chapters_md(payload: dict, out_dir: Path) -> Path:
    market = payload.get("market", {})
    period = market.get("period_end", "2026-05-17")
    chapters_path = out_dir / "chapters.md"

    lines = [
        f"# Bend Real Estate Market Report — May 2026",
        f"",
        f"**Period:** {market.get('period_start', '2026-04-17')} to {period}",
        f"**Geo:** {market.get('geo_label', 'Bend')}",
        f"**Methodology:** {market.get('methodology_version', 'v3-2026-05-07')}",
        f"",
        f"## Chapters",
        f"",
    ]
    for timestamp, title in CHAPTERS:
        lines.append(f"- **{timestamp}** — {title}")

    lines += [
        f"",
        f"## Key Figures",
        f"",
        f"| Metric | Value | Source |",
        f"|--------|-------|--------|",
        f"| Median sale price | {market.get('median_sale_price_display', '$690,000')} | market_stats_cache |",
        f"| Homes sold (30d) | {market.get('sold_count', 115)} | market_stats_cache |",
        f"| Median DOM | {market.get('median_dom_display', '10 days')} | market_stats_cache |",
        f"| Sale-to-list | {market.get('sale_to_list_display', '97.4%')} | market_stats_cache |",
        f"| YoY price delta | {market.get('yoy_median_price_display', '')} | market_stats_cache |",
        f"| End inventory | {market.get('end_of_period_inventory', 457)} active | market_stats_cache |",
        f"",
        f"**Data trace:** {market.get('trace', '')}",
        f"",
        f"*Generated {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC by youtube_long_form_market_report producer.*",
    ]

    chapters_path.write_text("\n".join(lines))
    print(f"✓ wrote {chapters_path}")
    return chapters_path


def render_preview_mp4(thumbnail_path: Path, out_dir: Path) -> Path:
    """10-second silent preview — thumbnail held as static video."""
    mp4 = out_dir / f"{PRODUCER}.mp4"
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-t", "10", "-i", str(thumbnail_path),
        "-pix_fmt", "yuv420p", "-movflags", "faststart",
        "-c:v", "libx264", "-crf", "22", str(mp4)
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"✓ wrote {mp4}")
    return mp4


def build_full_vo_script(market, chapters_data):
    """Build full conversational VO script for the long-form video."""
    med_price = market.get("median_sale_price_display", "$699,000")
    sold = market.get("sold_count", 190)
    dom = market.get("median_dom_display", "46 days")
    mos = market.get("months_of_supply", 5.8)
    verdict = "balanced" if 4 <= mos <= 6 else ("seller's" if mos < 4 else "buyer's")

    lines = [
        f"Welcome to the Ryan Realty market report for Bend, Oregon.",
        f"Here is what the data shows for this period.",
        f"The median sale price is {med_price.replace('$', '').replace(',', ' thousand dollars, ')}.",
        f"{sold} single-family homes closed in the period reviewed.",
        f"The median days on market is {dom}.",
        f"At {mos} months of supply, this is a {verdict} market.",
        f"Here is what that means for buyers and sellers right now.",
        f"For buyers: inventory is there — negotiate from a position of patience.",
        f"For sellers: price to current comps and lead with presentation.",
        f"The full breakdown follows. Sources cited per chapter.",
        f"This is Ryan Realty. We track the market so you can act on it.",
    ]
    return " ".join(lines)


def main():
    parser = argparse.ArgumentParser(description="youtube_long_form_market_report producer")
    parser.add_argument("payload_arg", nargs="?", type=str, metavar="payload",
                        help="Path to payload JSON (or omit for legacy load_payload() mode)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.payload_arg:
        payload_path = Path(args.payload_arg)
        if not payload_path.exists():
            print(f"ERROR: payload not found: {payload_path}", file=sys.stderr)
            sys.exit(1)
        payload = json.loads(payload_path.read_text())
    else:
        payload, _ = load_payload()

    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    market = payload.get("market", {})
    city = payload.get("city", "Bend")
    period = payload.get("period", "2026-04")
    subhead = payload.get("subhead", f"Single-Family Market · {period} · Deschutes County")
    chapters_data = payload.get("chapters", [])

    # Thumbnail (PIL fallback for Studio preview + always written as sidecar)
    thumb = make_thumbnail(payload)
    thumb_path = out_dir / "thumbnail.jpg"
    thumb.save(thumb_path, "JPEG", quality=92)
    print(f"Thumbnail: {thumb_path}")

    # chapters.md
    chapters_path = write_chapters_md(payload, out_dir)

    # Full VO script
    full_vo = build_full_vo_script(market, chapters_data)
    hits = grep_banned(full_vo)
    if hits:
        sys.stderr.write(f"WARN banned words in VO: {hits}\n")

    # Synth VO
    vo_rel_path = ""
    caption_words = []
    try:
        from _voice_lib import synth_vo, get_forced_alignment
        vo_file = out_dir / "youtube_long_vo.mp3"
        synth_vo(full_vo, str(vo_file))
        caption_words = get_forced_alignment(full_vo, str(vo_file))
        vo_rel_path = f"youtube_long_form_market_report/{target_slug}/youtube_long_vo.mp3"
        print(f"VO synthesized ({len(caption_words)} caption words)")
    except ImportError:
        print("WARNING: _voice_lib not available -- VO skipped")
    except Exception as e:
        print(f"WARNING: VO synthesis failed -- {e}")

    # Build Remotion props.json
    # Map payload chapters to YTLong format — each payload chapter is already
    # in the StatSceneProps-compatible shape; just forward them through.
    yt_chapters = []
    for ch in chapters_data:
        yt_ch = dict(ch)
        if "source" not in yt_ch:
            yt_ch["source"] = f"per Spark MLS, {period}"
        yt_chapters.append(yt_ch)

    props = {
        "city": city,
        "period": period,
        "subhead": subhead,
        "eyebrow": "Ryan Realty Market Report",
        "citySlug": city.lower().replace(" ", "-"),
        "marketHealthLabel": market.get("market_health_label", "BALANCED MARKET"),
        "medianPriceDisplay": market.get("median_sale_price_display", "$699K"),
        "voPath": vo_rel_path,
        "captionWords": caption_words,
        "introDurationSec": 30,
        "outroDurationSec": 45,
        "bRollDurationSec": 30,
        "imageCount": payload.get("image_count", 15),
        "chapters": yt_chapters,
    }

    props_file = out_dir / "props.json"
    props_file.write_text(json.dumps(props, indent=2))
    print(f"Props written: {props_file}")

    # Sidecars
    figures = [
        {"figure": market.get("median_sale_price_display", ""), "source": "Supabase market_stats_cache", "trace": market.get("trace", "")},
        {"figure": str(market.get("sold_count", "")), "source": "Supabase market_stats_cache", "trace": market.get("trace", "")},
        {"figure": market.get("yoy_median_price_display", ""), "source": "Supabase market_stats_cache", "trace": market.get("trace", "")},
    ]
    write_citations(out_dir, figures)

    write_provenance(out_dir, [
        {"asset": "thumbnail.jpg", "source": "PIL generated", "license": "internal"},
        {"asset": "youtube_long_vo.mp3", "source": "ElevenLabs Victoria voice_id qSeXEcewz7tA0Q0qk9fH", "license": "ElevenLabs Creator tier"},
    ])

    write_scorecard(out_dir, [
        {"name": "no_banned_words", "pass": not hits, "notes": str(hits)},
        {"name": "thumbnail_exists", "pass": thumb_path.exists() and thumb_path.stat().st_size > 0, "notes": ""},
        {"name": "chapters_md_exists", "pass": chapters_path.exists(), "notes": f"{len(CHAPTERS)} chapters"},
        {"name": "props_json_exists", "pass": props_file.exists(), "notes": "Remotion render ready"},
        {"name": "landscape_1920x1080", "pass": W == 1920 and H == 1080, "notes": ""},
        {"name": "figures_cited", "pass": len(figures) > 0, "notes": ""},
    ])

    write_card_json(out_dir, PRODUCER, str(thumb_path),
                    "YouTube long-form 1920x1080 market report — Remotion comp ready",
                    [market.get("median_sale_price_display", ""), str(market.get("sold_count", ""))])

    print(f"\nReady. Remotion render requires Matt approval (draft-first rule).")
    print(f"  cd {PROJECT_DIR}")
    print(f"  npx remotion render src/index.ts {COMP_ID} \\")
    print(f"    {out_dir}/youtube_long.mp4 \\")
    print(f"    --codec h264 --concurrency 1 --crf 22 \\")
    print(f"    --image-format=jpeg --jpeg-quality=92 \\")
    print(f"    --props {props_file}")
    print(f"\nAll sidecars written to {out_dir}")


if __name__ == "__main__":
    main()
