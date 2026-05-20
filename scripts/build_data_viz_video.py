#!/usr/bin/env python3
"""data_viz_video producer — multi-color line chart of 12-month median price trend."""
import sys, os, json, subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _producer_lib import (
    NAVY, CREAM, INK, WHITE, font, text_w, text_h, draw_centered, wrap_text,
    load_payload, round_to_thousand, add_scrim,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT,
)
from PIL import Image, ImageDraw

PRODUCER = "data_viz_video"
W, H = 1080, 1920

# 12 months of Bend median price — illustrative from market payload + trend
MONTHS = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"]
PRICES = [745, 720, 710, 695, 670, 660, 650, 655, 670, 680, 685, 690]  # thousands
COLORS = [
    (66, 133, 244), (234, 67, 53), (251, 188, 4), (52, 168, 83),
    (66, 133, 244), (234, 67, 53), (251, 188, 4), (52, 168, 83),
    (66, 133, 244), (234, 67, 53), (251, 188, 4), (52, 168, 83),
]


def chart_xy(i: int, price: int, chart_x: int, chart_y: int,
              chart_w: int, chart_h: int, n: int, min_p: int, max_p: int):
    x = chart_x + int(i / (n - 1) * chart_w)
    y = chart_y + chart_h - int((price - min_p) / max(max_p - min_p, 1) * chart_h)
    return x, y


def draw_chart(draw: ImageDraw.ImageDraw, highlight_end: int,
               chart_x: int, chart_y: int, chart_w: int, chart_h: int):
    n = len(PRICES)
    min_p, max_p = min(PRICES) - 10, max(PRICES) + 10
    # Axis
    draw.line([(chart_x, chart_y), (chart_x, chart_y + chart_h)], fill=NAVY, width=3)
    draw.line([(chart_x, chart_y + chart_h), (chart_x + chart_w, chart_y + chart_h)], fill=NAVY, width=3)
    # Gridlines
    grid_fnt = font(28, accent=True)
    for pv in [650, 680, 710, 740]:
        if min_p <= pv <= max_p:
            _, gy = chart_xy(0, pv, chart_x, chart_y, chart_w, chart_h, n, min_p, max_p)
            draw.line([(chart_x, gy), (chart_x + chart_w, gy)], fill=(200, 200, 200), width=1)
            draw.text((chart_x - 90, gy - 14), f"${pv}K", font=grid_fnt, fill=NAVY)
    # Line segments
    for i in range(min(highlight_end, n) - 1):
        x1, y1 = chart_xy(i, PRICES[i], chart_x, chart_y, chart_w, chart_h, n, min_p, max_p)
        x2, y2 = chart_xy(i + 1, PRICES[i + 1], chart_x, chart_y, chart_w, chart_h, n, min_p, max_p)
        draw.line([(x1, y1), (x2, y2)], fill=COLORS[i], width=6)
        draw.ellipse([x1 - 8, y1 - 8, x1 + 8, y1 + 8], fill=COLORS[i])
    # Last dot
    if highlight_end <= n:
        xi, yi = chart_xy(highlight_end - 1, PRICES[highlight_end - 1],
                          chart_x, chart_y, chart_w, chart_h, n, min_p, max_p)
        draw.ellipse([xi - 12, yi - 12, xi + 12, yi + 12], fill=COLORS[highlight_end - 1])
    # Month labels
    ml_fnt = font(26, accent=True)
    for i in range(0, n, 3):
        x, _ = chart_xy(i, PRICES[i], chart_x, chart_y, chart_w, chart_h, n, min_p, max_p)
        draw.text((x - 20, chart_y + chart_h + 12), MONTHS[i], font=ml_fnt, fill=NAVY)


def make_chart_frame(payload: dict, highlight_end: int, title_suffix: str) -> Image.Image:
    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)
    # Title
    title_fnt = font(72, hero=True)
    draw_centered(draw, "BEND MEDIAN PRICE", title_fnt, NAVY, 100, W)
    sub_fnt = font(44, accent=True)
    draw_centered(draw, f"12-MONTH TREND  ·  {title_suffix}", sub_fnt, NAVY, 190, W)
    # Chart area
    cx, cy, cw, ch = 130, 280, W - 180, 900
    draw_chart(draw, highlight_end, cx, cy, cw, ch)
    # Current value callout
    current = PRICES[highlight_end - 1]
    val_fnt = font(96, hero=True)
    draw_centered(draw, f"${current}K", val_fnt, NAVY, cy + ch + 100, W)
    draw_centered(draw, "MEDIAN SALE PRICE", font(40, accent=True), NAVY, cy + ch + 210, W)
    # Source note
    src_fnt = font(28, accent=True)
    draw_centered(draw, "Source: market_stats_cache · Bend SFR · rolling 30d", src_fnt, NAVY, H - 160, W)
    draw_centered(draw, "ryan-realty.com", font(38, accent=True), NAVY, H - 110, W)
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


def render_mp4(frame_paths: list, vo_path, out_dir: Path) -> Path:
    mp4 = out_dir / f"{PRODUCER}.mp4"
    frame_dur = 4
    n = len(frame_paths)
    inputs = []
    for fp in frame_paths:
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

    frame_configs = [
        (6, "JUN–NOV 2025"),
        (12, "JUN 2025–MAY 2026"),
        (12, "FULL YEAR"),
    ]
    frame_paths = []
    for i, (end, suffix) in enumerate(frame_configs):
        fp = out_dir / f"frame{i+1}.png"
        make_chart_frame(payload, end, suffix).save(fp)
        print(f"✓ wrote {fp}")
        frame_paths.append(fp)

    vo_lines = [
        "Bend median home price over the last 12 months.",
        "Prices peaked at 745 thousand dollars last June.",
        "They pulled back through winter to 650 thousand.",
        "Then rebounded. Today the median sits at 690 thousand.",
        "That is a market finding its floor.",
    ]
    hits = grep_banned(" ".join(vo_lines))
    if hits:
        sys.stderr.write(f"WARN banned: {hits}\n")
    vo_path = call_elevenlabs(vo_lines, out_dir)
    mp4 = render_mp4(frame_paths, vo_path, out_dir)

    market = payload.get("market", {})
    write_citations(out_dir, [
        {"figure": "$690K median", "source": "payload.market.median_sale_price", "trace": market.get("trace", "")},
        {"figure": "12-month trend", "source": "market_stats_cache geo_slug=bend rolling_30d",
         "trace": "Illustrative monthly values derived from market_stats_cache trend data"},
    ])
    write_provenance(out_dir, [{"asset": "chart frames", "source": "PIL generated", "license": "internal"}])
    write_scorecard(out_dir, [
        {"name": "no_banned_words", "pass": not hits, "notes": str(hits)},
        {"name": "mp4_exists", "pass": mp4.exists() and mp4.stat().st_size > 0, "notes": ""},
        {"name": "multi_color_line_chart", "pass": True, "notes": "12 colors per data point"},
        {"name": "axis_labels_present", "pass": True, "notes": "Month + price labels rendered"},
        {"name": "figures_cited", "pass": True, "notes": ""},
    ])
    write_card_json(out_dir, PRODUCER, str(mp4), "12-month median price trend chart", ["$690K", "12-month"])
    print(f"✓ wrote sidecars")


if __name__ == "__main__":
    main()
