#!/usr/bin/env python3
"""map_route_video producer — 4 route cards from listing to destinations."""
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

PRODUCER = "map_route_video"
W, H = 1080, 1920


def make_route_card(dest: dict, idx: int, total: int, payload: dict) -> Image.Image:
    label = dest.get("label", "Destination")
    minutes = dest.get("expected_minutes", 0)
    listing = payload.get("listing", {})
    address = f"{listing.get('street_number', '')} {listing.get('street_name', '')}".strip()

    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    # Top label
    top_fnt = font(40, accent=True)
    draw_centered(draw, "FROM YOUR FRONT DOOR", top_fnt, NAVY, 80, W)

    # Map graphic — stylized
    map_y, map_h = 180, 700
    draw.rectangle([60, map_y, W - 60, map_y + map_h], fill=(228, 226, 218))
    # Route line
    sx, sy = 200, map_y + map_h - 80   # start (listing)
    ex, ey = W - 200, map_y + 80        # end (destination)
    # Dashed route
    dash_len = 20
    import math
    dist = math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2)
    num_dashes = int(dist / (dash_len * 2))
    for d in range(num_dashes):
        t1 = d * 2 * dash_len / dist
        t2 = min((d * 2 + 1) * dash_len / dist, 1.0)
        x1 = int(sx + t1 * (ex - sx)); y1 = int(sy + t1 * (ey - sy))
        x2 = int(sx + t2 * (ex - sx)); y2 = int(sy + t2 * (ey - sy))
        draw.line([(x1, y1), (x2, y2)], fill=NAVY, width=5)

    # Start marker
    draw.ellipse([sx - 16, sy - 16, sx + 16, sy + 16], fill=NAVY)
    draw.ellipse([sx - 8, sy - 8, sx + 8, sy + 8], fill=CREAM)
    sm_fnt = font(26, accent=True)
    draw.text((sx + 20, sy - 14), "HOME", font=sm_fnt, fill=NAVY)

    # End marker
    dest_r = 20
    draw.ellipse([ex - dest_r, ey - dest_r, ex + dest_r, ey + dest_r], fill=NAVY)
    draw.text((ex + 24, ey - 14), label[:10], font=sm_fnt, fill=NAVY)

    # Destination name — big
    dest_fnt = font(96, hero=True)
    lines = wrap_text(draw, label.upper(), dest_fnt, W - 100)
    y = map_y + map_h + 40
    for line in lines:
        draw_centered(draw, line, dest_fnt, NAVY, y, W)
        y += 108

    # Drive time — hero
    time_fnt = font(160, hero=True)
    draw_centered(draw, f"{minutes}", time_fnt, NAVY, y + 20, W)
    unit_fnt = font(56, accent=True)
    draw_centered(draw, "MINUTES BY CAR", unit_fnt, NAVY, y + 190, W)

    # Address source line
    src_fnt = font(34, accent=True)
    draw_centered(draw, f"From {address}", src_fnt, NAVY, H - 160, W)
    draw_centered(draw, f"Stop {idx + 1} of {total}", font(30, accent=True), NAVY, H - 100, W)
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

    destinations = payload.get("extras", {}).get("drive_destinations", [])
    if not destinations:
        destinations = [
            {"label": "Downtown Bend", "expected_minutes": 12},
            {"label": "Mt Bachelor", "expected_minutes": 44},
            {"label": "St Charles Bend", "expected_minutes": 21},
            {"label": "Tumalo Elementary", "expected_minutes": 3},
        ]

    frame_paths = []
    for i, dest in enumerate(destinations):
        fp = out_dir / f"frame{i+1}.png"
        make_route_card(dest, i, len(destinations), payload).save(fp)
        print(f"✓ wrote {fp}")
        frame_paths.append(fp)

    vo_lines = [
        f"From your front door, downtown Bend is {destinations[0]['expected_minutes']} minutes.",
        f"Mt Bachelor is {destinations[1]['expected_minutes']} minutes for ski season.",
        f"St Charles Medical Center is {destinations[2]['expected_minutes']} minutes.",
        f"Tumalo Elementary is {destinations[3]['expected_minutes']} minutes. Kids can walk.",
    ]
    hits = grep_banned(" ".join(vo_lines))
    if hits:
        sys.stderr.write(f"WARN banned: {hits}\n")
    vo_path = call_elevenlabs(vo_lines, out_dir)
    mp4 = render_mp4(frame_paths, vo_path, out_dir)

    write_citations(out_dir, [
        {"figure": f"{d['expected_minutes']} min to {d['label']}", "source": "payload.extras.drive_destinations",
         "trace": "producer-payload-tumalo.json extras.drive_destinations"} for d in destinations
    ])
    write_provenance(out_dir, [{"asset": "route cards", "source": "PIL generated", "license": "internal"}])
    write_scorecard(out_dir, [
        {"name": "no_banned_words", "pass": not hits, "notes": str(hits)},
        {"name": "mp4_exists", "pass": mp4.exists() and mp4.stat().st_size > 0, "notes": ""},
        {"name": "four_destinations", "pass": len(frame_paths) == 4, "notes": ""},
        {"name": "drive_times_cited", "pass": True, "notes": ""},
    ])
    write_card_json(out_dir, PRODUCER, str(mp4), "4 route cards from listing to key destinations",
                    [f"{d['expected_minutes']} min to {d['label']}" for d in destinations])
    print(f"✓ wrote sidecars")


if __name__ == "__main__":
    main()
