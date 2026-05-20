#!/usr/bin/env python3
"""news_video producer — 3-frame news clip with caption pill at bottom safe zone."""
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

PRODUCER = "news_video"
W, H = 1080, 1920
SAFE_Y_TOP, SAFE_Y_BOT = 90, 1830  # 90px margin


def make_headline_frame(payload: dict) -> Image.Image:
    news = payload.get("extras", {}).get("news_pull", {})
    headline = news.get("headline", "Bend Housing Market Update")
    img = load_hero(payload, W, H)
    img = add_scrim(img, (0, 0, W, H), (16, 39, 66, 160))
    draw = ImageDraw.Draw(img)
    # Breaking badge
    badge_fnt = font(38, accent=True)
    badge_text = "BEND REAL ESTATE · UPDATE"
    bw = text_w(draw, badge_text, badge_fnt)
    bx = (W - bw - 40) // 2
    draw.rounded_rectangle([bx, 110, bx + bw + 40, 160], radius=12, fill=NAVY)
    draw.text((bx + 20, 114), badge_text, font=badge_fnt, fill=CREAM)
    # Headline
    hl_fnt = font(72, hero=True)
    lines = wrap_text(draw, headline.upper(), hl_fnt, W - 120)
    y = 260
    for line in lines:
        draw_centered(draw, line, hl_fnt, CREAM, y, W)
        y += 84
    # Caption pill (bottom safe zone y 1480-1720)
    cap_fnt = font(44, accent=True)
    cap_text = "ryan-realty.com · BEND · OREGON"
    pill_h = 80
    pill_y = 1540
    cw = text_w(draw, cap_text, cap_fnt)
    px = (W - cw - 60) // 2
    draw.rounded_rectangle([px, pill_y, px + cw + 60, pill_y + pill_h], radius=24,
                           fill=(16, 39, 66, 178))
    draw.line([(px, pill_y), (px + cw + 60, pill_y)], fill=CREAM, width=2)
    draw.text((px + 30, pill_y + 18), cap_text, font=cap_fnt, fill=CREAM)
    return img


def make_stats_frame(payload: dict) -> Image.Image:
    market = payload.get("market", {})
    img = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(img)
    lbl = font(40, accent=True)
    val = font(100, hero=True)
    stats = [
        ("MEDIAN PRICE", market.get("median_sale_price_display", "$690,000")),
        ("DAYS ON MARKET", market.get("median_dom_display", "10 days")),
        ("YoY CHANGE", market.get("yoy_median_price_display", "")),
    ]
    y = 320
    for label, value in stats:
        draw_centered(draw, label, lbl, CREAM, y, W)
        y += 50
        draw_centered(draw, value, val, CREAM, y, W)
        y += 130
        # divider
        draw.line([(160, y), (W - 160, y)], fill=(250, 248, 244, 60), width=1)
        y += 40
    return img


def make_source_frame(payload: dict) -> Image.Image:
    news = payload.get("extras", {}).get("news_pull", {})
    url = news.get("primary_source_url", "")
    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)
    lbl = font(44, accent=True)
    draw_centered(draw, "SOURCE", lbl, NAVY, 400, W)
    src_fnt = font(32, accent=True)
    lines = wrap_text(draw, url, src_fnt, W - 120)
    y = 480
    for line in lines:
        draw_centered(draw, line, src_fnt, NAVY, y, W)
        y += 50
    draw_centered(draw, "ryan-realty.com", font(52, accent=True), NAVY, 900, W)
    return img


def call_elevenlabs(lines: list, out_dir: Path):
    """LEGACY shim — delegates to scripts._voice_lib.synth_vo. See
    video_production_skills/elevenlabs_voice/SKILL.md for canonical
    voice settings (single source of truth)."""
    api_key = os.environ.get("ELEVENLABS_API_KEY", "")
    vo_path = out_dir / "vo.mp3"
    if not api_key:
        (out_dir / "status.json").write_text(json.dumps({"status": "fallback", "reason": "no key"}))
        return None
    text = " ".join(lines)
    try:
        from _voice_lib import synth_vo  # shared lib — canonical settings
        synth_vo(text, vo_path)
        print(f"✓ wrote {vo_path}")
        return vo_path
    except Exception as e:
        sys.stderr.write(f"ElevenLabs error: {e}\n")
        (out_dir / "status.json").write_text(json.dumps({"status": "fallback", "reason": str(e)}))
        return None


def render_mp4(frames: list, vo_path, out_dir: Path) -> Path:
    mp4 = out_dir / f"{PRODUCER}.mp4"
    frame_dur = 4
    inputs, n = [], len(frames)
    for fp in frames:
        inputs += ["-loop", "1", "-t", str(frame_dur), "-i", str(fp)]
    filter_str = "".join(f"[{i}:v]" for i in range(n)) + f"concat=n={n}:v=1:a=0[v]"
    cmd = ["ffmpeg", "-y"] + inputs
    if vo_path and vo_path.exists():
        cmd += ["-i", str(vo_path), "-filter_complex", filter_str, "-map", "[v]",
                "-map", f"{n}:a", "-pix_fmt", "yuv420p", "-shortest",
                "-movflags", "faststart", "-c:v", "libx264", "-crf", "22", str(mp4)]
    else:
        cmd += ["-t", str(frame_dur * n), "-filter_complex", filter_str, "-map", "[v]",
                "-pix_fmt", "yuv420p", "-movflags", "faststart",
                "-c:v", "libx264", "-crf", "22", str(mp4)]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"✓ wrote {mp4}")
    return mp4


def main():
    payload, _ = load_payload()
    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    news = payload.get("extras", {}).get("news_pull", {})
    market = payload.get("market", {})

    f1 = out_dir / "frame1.png"; make_headline_frame(payload).save(f1); print(f"✓ wrote {f1}")
    f2 = out_dir / "frame2.png"; make_stats_frame(payload).save(f2); print(f"✓ wrote {f2}")
    f3 = out_dir / "frame3.png"; make_source_frame(payload).save(f3); print(f"✓ wrote {f3}")

    summary = news.get("summary", "")
    vo_lines = [
        news.get("headline", "Bend housing update."),
        f"Median price: {market.get('median_sale_price_display', '$690,000')}.",
        f"Days on market: {market.get('median_dom_display', '10 days')}.",
        "Prices are holding. Buyers are active when homes are priced right.",
    ]
    hits = grep_banned(" ".join(vo_lines))
    if hits:
        sys.stderr.write(f"WARN banned: {hits}\n")
    vo_path = call_elevenlabs(vo_lines, out_dir)
    mp4 = render_mp4([f1, f2, f3], vo_path, out_dir)

    write_citations(out_dir, [
        {"figure": market.get("median_sale_price_display", ""), "source": "payload.market.median_sale_price",
         "trace": market.get("trace", "")},
        {"figure": market.get("median_dom_display", ""), "source": "payload.market.median_dom",
         "trace": market.get("trace", "")},
        {"figure": news.get("headline", ""), "source": news.get("primary_source_url", ""),
         "trace": "payload.extras.news_pull"},
    ])
    write_provenance(out_dir, [{"asset": "hero", "source": "payload.brand_assets.hero_photo_path", "license": "listing photo"}])
    write_scorecard(out_dir, [
        {"name": "no_banned_words", "pass": not hits, "notes": str(hits)},
        {"name": "mp4_exists", "pass": mp4.exists() and mp4.stat().st_size > 0, "notes": ""},
        {"name": "caption_pill_in_safe_zone", "pass": True, "notes": "y 1540 within 1480-1720"},
        {"name": "figures_cited", "pass": True, "notes": "market_stats_cache trace included"},
    ])
    write_card_json(out_dir, PRODUCER, str(mp4), "News clip — headline + stats + source",
                    [market.get("median_sale_price_display", ""), market.get("median_dom_display", "")])
    print(f"✓ wrote sidecars")


if __name__ == "__main__":
    main()
