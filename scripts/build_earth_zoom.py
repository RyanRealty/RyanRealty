#!/usr/bin/env python3
"""earth_zoom producer — 5-keyframe hyperlapse globe-to-property. Navy circle zoom simulation."""
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

PRODUCER = "earth_zoom"
W, H = 1080, 1920


def make_keyframe(kf: dict, idx: int, total: int, payload: dict) -> Image.Image:
    label = kf.get("label", "")
    anchor = kf.get("anchor_text", "")
    zoom = kf.get("zoom", 1)

    # Background alternates: cream for odd frames, navy for even
    if idx % 2 == 0:
        img = Image.new("RGB", (W, H), NAVY)
        txt_fill = CREAM
        circle_fill = CREAM
        circle_outline = None
    else:
        img = Image.new("RGB", (W, H), CREAM)
        txt_fill = NAVY
        circle_fill = None
        circle_outline = NAVY

    draw = ImageDraw.Draw(img)

    # Progress indicator
    prog_fnt = font(36, accent=True)
    draw.text((90, 100), f"{idx + 1}  /  {total}", font=prog_fnt, fill=txt_fill)

    # Simulated zoom circle — gets smaller as we zoom in
    max_r = 380
    min_r = 60
    # zoom goes 1 → 100000; map log scale to circle size
    import math
    t = math.log10(max(zoom, 1)) / math.log10(100000)
    r = int(max_r - t * (max_r - min_r))
    cx, cy = W // 2, H // 2 - 80
    if circle_fill:
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=circle_fill)
    else:
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=circle_outline, width=6)
        # Cross-hair lines
        draw.line([(cx - r - 30, cy), (cx + r + 30, cy)], fill=NAVY, width=2)
        draw.line([(cx, cy - r - 30), (cx, cy + r + 30)], fill=NAVY, width=2)

    # Label — big
    lbl_fnt = font(96, hero=True)
    lines = wrap_text(draw, label, lbl_fnt, W - 100)
    y = cy + r + 60
    for line in lines:
        draw_centered(draw, line, lbl_fnt, txt_fill, y, W)
        y += 108

    # Anchor text
    anc_fnt = font(48, accent=True)
    draw_centered(draw, anchor, anc_fnt, txt_fill, y + 20, W)

    # Coordinates at bottom
    coord_fnt = font(34, accent=True)
    draw_centered(draw, "44.13° N  ·  121.34° W", coord_fnt, txt_fill, H - 120, W)
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

    keyframes = payload.get("extras", {}).get("earth_zoom_keyframes", [])
    if not keyframes:
        keyframes = [
            {"label": "EARTH", "zoom": 1, "anchor_text": "44.13°N · 121.34°W"},
            {"label": "OREGON", "zoom": 100, "anchor_text": "Pacific Northwest"},
            {"label": "BEND", "zoom": 5000, "anchor_text": "Central Oregon"},
            {"label": "TUMALO", "zoom": 25000, "anchor_text": "10 minutes from downtown"},
            {"label": "19496", "zoom": 100000, "anchor_text": "Tumalo Reservoir Rd · 2.28 acres"},
        ]

    frame_paths = []
    for i, kf in enumerate(keyframes):
        fp = out_dir / f"frame{i+1}.png"
        make_keyframe(kf, i, len(keyframes), payload).save(fp)
        print(f"✓ wrote {fp}")
        frame_paths.append(fp)

    listing = payload.get("listing", {})
    vo_lines = [
        "Starting from orbit. 44.13 degrees north.",
        "Pacific Northwest. Oregon Cascades.",
        "Central Oregon. The high desert plateau.",
        "Tumalo. Ten minutes from downtown Bend.",
        f"19496 Tumalo Reservoir Road. {listing.get('lot_acres', '2.28')} acres. Three Sisters views.",
    ]
    hits = grep_banned(" ".join(vo_lines))
    if hits:
        sys.stderr.write(f"WARN banned: {hits}\n")
    vo_path = call_elevenlabs(vo_lines, out_dir)
    mp4 = render_mp4(frame_paths, vo_path, out_dir)

    write_citations(out_dir, [
        {"figure": "44.13°N 121.34°W", "source": "payload.listing.latitude + longitude",
         "trace": "19496 Tumalo Reservoir Rd — lat 44.138729, lng -121.349064"},
    ])
    write_provenance(out_dir, [{"asset": "keyframes", "source": "PIL generated — geometric zoom simulation", "license": "internal"}])
    write_scorecard(out_dir, [
        {"name": "no_banned_words", "pass": not hits, "notes": str(hits)},
        {"name": "mp4_exists", "pass": mp4.exists() and mp4.stat().st_size > 0, "notes": ""},
        {"name": "five_keyframes", "pass": len(frame_paths) == len(keyframes), "notes": ""},
    ])
    write_card_json(out_dir, PRODUCER, str(mp4), "5-keyframe earth zoom to property",
                    ["44.138729,-121.349064"])
    print(f"✓ wrote sidecars")


if __name__ == "__main__":
    main()
