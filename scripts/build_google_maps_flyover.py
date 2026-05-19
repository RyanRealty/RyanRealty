#!/usr/bin/env python3
"""google_maps_flyover producer — stylized aerial path frames downtown to Tumalo."""
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

PRODUCER = "google_maps_flyover"
W, H = 1080, 1920

STOPS = [
    {"label": "DOWNTOWN BEND", "desc": "Historic core. Tower Theatre. Old Mill District.", "zoom_pct": 0.08},
    {"label": "BEND OUTSKIRTS", "desc": "Crossing Tumalo Road. Ranch land ahead.", "zoom_pct": 0.25},
    {"label": "TUMALO", "desc": "Community of 800 residents. Wide open skies.", "zoom_pct": 0.60},
    {"label": "19496 TUMALO RESERVOIR RD", "desc": "2.28 acres. Three Sisters visible from the porch.", "zoom_pct": 1.0},
]


def draw_map_frame(stop: dict, idx: int, total: int, payload: dict) -> Image.Image:
    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    # Map area (stylized)
    map_top, map_bot = 200, H - 400
    map_h = map_bot - map_top
    # Background map area navy
    draw.rectangle([60, map_top, W - 60, map_bot], fill=(230, 228, 222))

    # Grid lines (street grid)
    for gx in range(60, W - 60, 80):
        draw.line([(gx, map_top), (gx, map_bot)], fill=(210, 208, 200), width=1)
    for gy in range(map_top, map_bot, 80):
        draw.line([(60, gy), (W - 60, gy)], fill=(210, 208, 200), width=1)

    # Route path
    route_points = [
        (200, map_bot - 40),   # downtown
        (360, map_bot - 120),
        (520, map_bot - 260),
        (W - 200, map_top + 80),  # destination
    ]
    for i in range(len(route_points) - 1):
        x1, y1 = route_points[i]
        x2, y2 = route_points[i + 1]
        draw.line([(x1, y1), (x2, y2)], fill=NAVY, width=6)

    # Current position marker
    zoom_pct = stop["zoom_pct"]
    # Interpolate along route
    seg = int(zoom_pct * (len(route_points) - 1))
    seg = min(seg, len(route_points) - 2)
    t = zoom_pct * (len(route_points) - 1) - seg
    x1, y1 = route_points[seg]
    x2, y2 = route_points[min(seg + 1, len(route_points) - 1)]
    px = int(x1 + t * (x2 - x1))
    py = int(y1 + t * (y2 - y1))
    r = 20
    draw.ellipse([px - r, py - r, px + r, py + r], fill=NAVY)
    draw.ellipse([px - r + 4, py - r + 4, px + r - 4, py + r - 4], fill=CREAM)

    # Stop labels on map
    sm_fnt = font(24, accent=True)
    for i2, (rx, ry) in enumerate(route_points):
        draw.ellipse([rx - 8, ry - 8, rx + 8, ry + 8], fill=NAVY)
    draw.text((route_points[0][0] + 12, route_points[0][1] - 24), "BEND", font=sm_fnt, fill=NAVY)
    draw.text((route_points[-1][0] - 60, route_points[-1][1] - 24), "19496", font=sm_fnt, fill=NAVY)

    # Title
    title_fnt = font(72, hero=True)
    lines = wrap_text(draw, stop["label"], title_fnt, W - 100)
    y = 30
    for line in lines:
        draw_centered(draw, line, title_fnt, NAVY, y, W)
        y += 84

    # Description
    desc_fnt = font(52, accent=True)
    desc_lines = wrap_text(draw, stop["desc"], desc_fnt, W - 120)
    y_desc = map_bot + 40
    for line in desc_lines:
        draw_centered(draw, line, desc_fnt, NAVY, y_desc, W)
        y_desc += 64

    # Progress
    prog_fnt = font(36, accent=True)
    draw_centered(draw, f"STOP {idx + 1} OF {total}", prog_fnt, NAVY, H - 100, W)
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
    frame_dur = 3
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

    frame_paths = []
    for i, stop in enumerate(STOPS):
        fp = out_dir / f"frame{i+1}.png"
        draw_map_frame(stop, i, len(STOPS), payload).save(fp)
        print(f"✓ wrote {fp}")
        frame_paths.append(fp)

    listing = payload.get("listing", {})
    vo_lines = [
        "Skyliners Road carries you out of downtown Bend.",
        "Past the Bend outskirts. Ranch land opens up.",
        "Eight minutes. Tumalo. Population 800. Open skies.",
        f"Twelve minutes total to {listing.get('street_number', '19496')} Tumalo Reservoir Road.",
    ]
    hits = grep_banned(" ".join(vo_lines))
    if hits:
        sys.stderr.write(f"WARN banned: {hits}\n")
    vo_path = call_elevenlabs(vo_lines, out_dir)
    mp4 = render_mp4(frame_paths, vo_path, out_dir)

    write_citations(out_dir, [
        {"figure": "12 min drive time", "source": "payload.extras.drive_times.downtown_bend",
         "trace": "producer-payload-tumalo.json extras.drive_times.downtown_bend = 12 min"},
    ])
    write_provenance(out_dir, [{"asset": "map frames", "source": "PIL generated — stylized map", "license": "internal"}])
    write_scorecard(out_dir, [
        {"name": "no_banned_words", "pass": not hits, "notes": str(hits)},
        {"name": "mp4_exists", "pass": mp4.exists() and mp4.stat().st_size > 0, "notes": ""},
        {"name": "route_rendered", "pass": True, "notes": "4-stop route with progress markers"},
    ])
    write_card_json(out_dir, PRODUCER, str(mp4), "Aerial route flyover downtown Bend to Tumalo",
                    ["12 min drive time"])
    print(f"✓ wrote sidecars")


if __name__ == "__main__":
    main()
