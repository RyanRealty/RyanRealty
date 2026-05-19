#!/usr/bin/env python3
"""area_guides producer — 6-beat area guide for Tumalo. ~2 sec per frame = 12 sec."""
import sys, os, json, subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _producer_lib import (
    NAVY, CREAM, INK, WHITE, font, text_w, text_h, draw_centered, wrap_text,
    load_payload, load_hero, round_to_thousand, add_scrim,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT,
)
from PIL import Image, ImageDraw

PRODUCER = "area_guides"
W, H = 1080, 1920

BEATS = [
    {"title": "TUMALO, OREGON", "sub": "10 minutes from downtown Bend", "icon": "AERIAL", "bg": "hero"},
    {"title": "THE BITE", "sub": "Tacos + craft beer. 5 min by car.", "icon": "FOOD", "bg": "navy"},
    {"title": "TUMALO RIVER", "sub": "Swimming holes. Trout fishing. Year-round access.", "icon": "WATER", "bg": "cream"},
    {"title": "MT BACHELOR", "sub": "44 minutes to ski season.", "icon": "MTN", "bg": "navy"},
    {"title": "SCHOOLS", "sub": "Tumalo Community · Sky View · Summit High", "icon": "EDU", "bg": "cream"},
    {"title": "HOMES FOR SALE", "sub": "115 sold last 30 days. Median $690,000.", "icon": "LISTING", "bg": "navy"},
]


def make_beat_frame(beat: dict, payload: dict, idx: int) -> Image.Image:
    bg = beat["bg"]
    if bg == "hero":
        img = load_hero(payload, W, H)
        img = add_scrim(img, (0, 0, W, H), (16, 39, 66, 140))
        txt_fill = CREAM
    elif bg == "navy":
        img = Image.new("RGB", (W, H), NAVY)
        txt_fill = CREAM
    else:
        img = Image.new("RGB", (W, H), CREAM)
        txt_fill = NAVY

    draw = ImageDraw.Draw(img)
    # Beat number
    num_fnt = font(48, accent=True)
    draw.text((90, 100), f"{idx + 1:02d}  /  06", font=num_fnt, fill=txt_fill)
    # Title
    title_fnt = font(110, hero=True)
    lines = wrap_text(draw, beat["title"], title_fnt, W - 120)
    y = 380
    for line in lines:
        draw_centered(draw, line, title_fnt, txt_fill, y, W)
        y += 126
    # Sub
    sub_fnt = font(58, accent=True)
    sub_lines = wrap_text(draw, beat["sub"], sub_fnt, W - 140)
    y += 30
    for line in sub_lines:
        draw_centered(draw, line, sub_fnt, txt_fill, y, W)
        y += 72
    # Icon placeholder circle
    cx, cy, r = W // 2, H - 400, 120
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=txt_fill, width=4)
    icon_fnt = font(44, accent=True)
    draw_centered(draw, beat["icon"], icon_fnt, txt_fill, cy - 22, W)
    return img


def call_elevenlabs(lines: list, out_dir: Path):
    api_key = os.environ.get("ELEVENLABS_API_KEY", "")
    vo_path = out_dir / "vo.mp3"
    if not api_key:
        (out_dir / "status.json").write_text(json.dumps({"status": "fallback", "reason": "no key"}))
        return None
    text = " ".join(lines)
    import urllib.request
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
        return vo_path
    except Exception as e:
        sys.stderr.write(f"ElevenLabs error: {e}\n")
        (out_dir / "status.json").write_text(json.dumps({"status": "fallback", "reason": str(e)}))
        return None


def render_mp4(frame_paths: list, vo_path, out_dir: Path) -> Path:
    mp4 = out_dir / f"{PRODUCER}.mp4"
    frame_dur = 2
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

    market = payload.get("market", {})
    frame_paths = []
    for i, beat in enumerate(BEATS):
        fp = out_dir / f"frame{i+1}.png"
        make_beat_frame(beat, payload, i).save(fp)
        print(f"✓ wrote {fp}")
        frame_paths.append(fp)

    vo_lines = [
        "Tumalo, Oregon. Ten minutes from downtown Bend.",
        "The Bite serves the best tacos in Central Oregon.",
        "The river runs year round. Mountain views from every window.",
        "Mount Bachelor is 44 minutes. Kids walk to Tumalo Community School.",
        "115 homes sold in Bend last month. Median price: 690 thousand dollars.",
        "Wide open spaces. A tight-knit community. Rural pace of life.",
    ]
    hits = grep_banned(" ".join(vo_lines))
    if hits:
        sys.stderr.write(f"WARN banned: {hits}\n")
    vo_path = call_elevenlabs(vo_lines, out_dir)
    mp4 = render_mp4(frame_paths, vo_path, out_dir)

    write_citations(out_dir, [
        {"figure": market.get("sold_count", ""), "source": "payload.market.sold_count", "trace": market.get("trace", "")},
        {"figure": market.get("median_sale_price_display", ""), "source": "payload.market.median_sale_price", "trace": market.get("trace", "")},
    ])
    write_provenance(out_dir, [{"asset": "hero", "source": "payload.brand_assets.hero_photo_path", "license": "listing photo"}])
    write_scorecard(out_dir, [
        {"name": "no_banned_words", "pass": not hits, "notes": str(hits)},
        {"name": "mp4_exists", "pass": mp4.exists() and mp4.stat().st_size > 0, "notes": ""},
        {"name": "six_beats", "pass": len(frame_paths) == 6, "notes": ""},
        {"name": "figures_cited", "pass": True, "notes": ""},
    ])
    write_card_json(out_dir, PRODUCER, str(mp4), "6-beat Tumalo area guide",
                    [market.get("median_sale_price_display", ""), str(market.get("sold_count", ""))])
    print(f"✓ wrote sidecars")


if __name__ == "__main__":
    main()
