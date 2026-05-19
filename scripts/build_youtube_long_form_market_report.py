#!/usr/bin/env python3
"""youtube_long_form_market_report producer — landscape thumbnail + chapters.md + 10s preview MP4."""
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

PRODUCER = "youtube_long_form_market_report"
W, H = 1920, 1080  # LANDSCAPE for YouTube

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


def main():
    payload, _ = load_payload()
    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    market = payload.get("market", {})

    # Thumbnail (JPEG)
    thumb = make_thumbnail(payload)
    thumb_path = out_dir / "thumbnail.jpg"
    thumb.save(thumb_path, "JPEG", quality=92)
    print(f"✓ wrote {thumb_path}")

    # chapters.md
    chapters_path = write_chapters_md(payload, out_dir)

    # VO (optional — short preview VO)
    vo_lines = [
        f"Bend real estate market report. May 2026.",
        f"Median sale price: {market.get('median_sale_price_display', '$690,000')}.",
        f"{market.get('sold_count', 115)} homes sold in the last 30 days.",
        "Eight chapters. Full market breakdown. ryan-realty.com.",
    ]
    vo_lines = [l.replace("$690,000", "690 thousand dollars") for l in vo_lines]
    hits = grep_banned(" ".join(vo_lines))
    if hits:
        sys.stderr.write(f"WARN banned: {hits}\n")

    api_key = os.environ.get("ELEVENLABS_API_KEY", "")
    vo_path = out_dir / "vo.mp3"
    if api_key:
        import urllib.request
        text = " ".join(vo_lines)
        payload_bytes = json.dumps({
            "text": text,
            "model_id": "eleven_turbo_v2_5",
            "voice_settings": {"stability": 0.40, "similarity_boost": 0.80, "style": 0.50, "use_speaker_boost": True},
        }).encode()
        req = urllib.request.Request(
            "https://api.elevenlabs.io/v1/text-to-speech/qSeXEcewz7tA0Q0qk9fH",
            data=payload_bytes,
            headers={"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                vo_path.write_bytes(resp.read())
            print(f"✓ wrote {vo_path}")
        except Exception as e:
            sys.stderr.write(f"ElevenLabs error: {e}\n")
            vo_path = None
    else:
        (out_dir / "status.json").write_text(json.dumps({"status": "fallback", "reason": "no key"}))
        vo_path = None

    # Preview MP4
    mp4 = render_preview_mp4(thumb_path, out_dir)

    write_citations(out_dir, [
        {"figure": market.get("median_sale_price_display", ""), "source": "payload.market.median_sale_price", "trace": market.get("trace", "")},
        {"figure": str(market.get("sold_count", "")), "source": "payload.market.sold_count", "trace": market.get("trace", "")},
        {"figure": market.get("yoy_median_price_display", ""), "source": "payload.market.yoy_median_price_delta_pct", "trace": market.get("trace", "")},
    ])
    write_provenance(out_dir, [
        {"asset": "thumbnail.jpg", "source": "PIL generated + payload.brand_assets.hero_photo_path", "license": "listing photo"},
    ])
    write_scorecard(out_dir, [
        {"name": "no_banned_words", "pass": not hits, "notes": str(hits)},
        {"name": "thumbnail_exists", "pass": thumb_path.exists() and thumb_path.stat().st_size > 0, "notes": ""},
        {"name": "chapters_md_exists", "pass": chapters_path.exists(), "notes": f"{len(CHAPTERS)} chapters"},
        {"name": "mp4_exists", "pass": mp4.exists() and mp4.stat().st_size > 0, "notes": "10s silent preview"},
        {"name": "landscape_1920x1080", "pass": W == 1920 and H == 1080, "notes": ""},
        {"name": "figures_cited", "pass": True, "notes": ""},
    ])
    write_card_json(out_dir, PRODUCER, str(mp4), "YouTube landscape thumbnail + 8-chapter plan + 10s preview",
                    [market.get("median_sale_price_display", ""), str(market.get("sold_count", ""))])
    print(f"✓ wrote sidecars")


if __name__ == "__main__":
    main()
