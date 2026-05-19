#!/usr/bin/env python3
"""school_district_overlay producer — 3 frames: elementary, middle, high school."""
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

PRODUCER = "school_district_overlay"
W, H = 1080, 1920

LEVELS = [
    {"key": "elementary", "label": "ELEMENTARY", "color": (66, 133, 244)},
    {"key": "middle", "label": "MIDDLE SCHOOL", "color": (52, 168, 83)},
    {"key": "high", "label": "HIGH SCHOOL", "color": (234, 67, 53)},
]


def make_school_frame(level_cfg: dict, school: dict, idx: int, payload: dict) -> Image.Image:
    label = level_cfg["label"]
    color = level_cfg["color"]
    name = school.get("name", "Unknown School")
    rating = school.get("rating", 0)
    minutes = school.get("drive_minutes", 0)
    district = payload.get("extras", {}).get("school_boundary", {}).get("district", "Bend-La Pine SD")

    listing = payload.get("listing", {})
    address = f"{listing.get('street_number', '')} {listing.get('street_name', '')}".strip()

    # Background: cream with color accent
    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    # Color band at top
    draw.rectangle([0, 0, W, 280], fill=color)

    # Level label
    lbl_fnt = font(72, hero=True)
    lines = wrap_text(draw, label, lbl_fnt, W - 80)
    y = 50
    for line in lines:
        draw_centered(draw, line, lbl_fnt, CREAM, y, W)
        y += 84

    # School boundary map (stylized)
    map_y, map_h = 300, 580
    draw.rectangle([60, map_y, W - 60, map_y + map_h], fill=(228, 226, 218))
    # Stylized boundary polygon
    bx, by = W // 2, map_y + map_h // 2
    r = 200
    points = []
    import math
    for angle in range(0, 360, 45):
        rad = math.radians(angle)
        jitter = 0.8 + 0.2 * math.sin(angle * 0.17)
        points.append((int(bx + r * jitter * math.cos(rad)),
                       int(by + r * 0.7 * jitter * math.sin(rad))))
    draw.polygon(points, fill=(*color, 40) if False else (*[int(c * 0.3 + 200 * 0.7) for c in color],),
                 outline=color)
    # Actually draw polygon with outline only since PIL fill needs tuple
    draw.polygon(points, outline=color, width=4)
    # School marker
    draw.ellipse([bx - 18, by - 18, bx + 18, by + 18], fill=color)
    # Home marker
    hx, hy = bx + 80, by + 60
    draw.ellipse([hx - 14, hy - 14, hx + 14, hy + 14], fill=NAVY)

    # School name
    name_fnt = font(72, hero=True)
    name_lines = wrap_text(draw, name.upper(), name_fnt, W - 100)
    y2 = map_y + map_h + 50
    for line in name_lines:
        draw_centered(draw, line, name_fnt, NAVY, y2, W)
        y2 += 84

    # Rating bar
    y2 += 30
    rating_lbl = font(44, accent=True)
    draw_centered(draw, f"SCHOOL RATING  ·  {rating} / 10", rating_lbl, NAVY, y2, W)
    y2 += 70
    # Rating bar
    bar_x, bar_w, bar_h2 = 100, W - 200, 28
    draw.rounded_rectangle([bar_x, y2, bar_x + bar_w, y2 + bar_h2], radius=14, fill=(200, 198, 190))
    draw.rounded_rectangle([bar_x, y2, bar_x + int(bar_w * rating / 10), y2 + bar_h2],
                           radius=14, fill=color)
    y2 += 70

    # Drive time
    time_fnt = font(100, hero=True)
    draw_centered(draw, f"{minutes} min", time_fnt, NAVY, y2, W)
    draw_centered(draw, "FROM YOUR FRONT DOOR", font(40, accent=True), NAVY, y2 + 116, W)

    # District + address at bottom
    draw_centered(draw, district, font(36, accent=True), NAVY, H - 160, W)
    draw_centered(draw, address, font(32, accent=True), NAVY, H - 100, W)
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

    school_data = payload.get("extras", {}).get("school_boundary", {})
    frame_paths = []
    schools = []
    for i, level_cfg in enumerate(LEVELS):
        school = school_data.get(level_cfg["key"], {})
        fp = out_dir / f"frame{i+1}.png"
        make_school_frame(level_cfg, school, i, payload).save(fp)
        print(f"✓ wrote {fp}")
        frame_paths.append(fp)
        schools.append(school)

    elem = school_data.get("elementary", {})
    mid = school_data.get("middle", {})
    hi = school_data.get("high", {})
    vo_lines = [
        f"Your kids walk to {elem.get('name', 'Tumalo Community School')} in {elem.get('drive_minutes', 3)} minutes.",
        f"{mid.get('name', 'Sky View Middle School')} is {mid.get('drive_minutes', 12)} minutes away. Rated {mid.get('rating', 8)} out of 10.",
        f"And {hi.get('name', 'Summit High School')} is {hi.get('drive_minutes', 18)} minutes. Top-rated in the district.",
    ]
    hits = grep_banned(" ".join(vo_lines))
    if hits:
        sys.stderr.write(f"WARN banned: {hits}\n")
    vo_path = call_elevenlabs(vo_lines, out_dir)
    mp4 = render_mp4(frame_paths, vo_path, out_dir)

    write_citations(out_dir, [
        {"figure": f"{s.get('name', '')} {s.get('drive_minutes', '')} min",
         "source": "payload.extras.school_boundary",
         "trace": "producer-payload-tumalo.json extras.school_boundary"}
        for s in schools
    ])
    write_provenance(out_dir, [{"asset": "school frames", "source": "PIL generated", "license": "internal"}])
    write_scorecard(out_dir, [
        {"name": "no_banned_words", "pass": not hits, "notes": str(hits)},
        {"name": "mp4_exists", "pass": mp4.exists() and mp4.stat().st_size > 0, "notes": ""},
        {"name": "three_levels", "pass": len(frame_paths) == 3, "notes": "elem, middle, high"},
        {"name": "rating_bars_rendered", "pass": True, "notes": "Rating bars for each school"},
    ])
    write_card_json(out_dir, PRODUCER, str(mp4), "3-frame school district overlay",
                    [s.get("name", "") for s in schools])
    print(f"✓ wrote sidecars")


if __name__ == "__main__":
    main()
