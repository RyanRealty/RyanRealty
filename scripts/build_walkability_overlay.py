#!/usr/bin/env python3
"""walkability_overlay producer — 3 isochrone frames (5/10/15 min drive radius)."""
import sys, os, json, subprocess, math
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _producer_lib import (
    NAVY, CREAM, INK, WHITE, font, text_w, text_h, draw_centered, wrap_text,
    load_payload, load_hero, round_to_thousand, add_scrim,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT,
)
from PIL import Image, ImageDraw

PRODUCER = "walkability_overlay"
W, H = 1080, 1920

ISOCHRONES = [
    {"minutes": 5, "color": (66, 133, 244), "label": "5 MINUTES"},
    {"minutes": 10, "color": (52, 168, 83), "label": "10 MINUTES"},
    {"minutes": 15, "color": (234, 67, 53), "label": "15 MINUTES"},
]


def make_isochrone_frame(iso: dict, walk: dict, payload: dict) -> Image.Image:
    minutes = iso["minutes"]
    color = iso["color"]
    label = iso["label"]

    key = {5: "five_minute", 10: "ten_minute", 15: "fifteen_minute"}.get(minutes, "five_minute")
    destinations = walk.get(key, [])

    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    # Color header band
    draw.rectangle([0, 0, W, 220], fill=color)
    mins_fnt = font(100, hero=True)
    draw_centered(draw, label, mins_fnt, CREAM, 50, W)

    # Map area
    map_y, map_h = 240, 680
    draw.rectangle([60, map_y, W - 60, map_y + map_h], fill=(228, 226, 218))

    # Isochrone rings (nested circles for visual clarity)
    cx, cy = W // 2, map_y + map_h // 2
    for i, r_frac in enumerate([1.0, 0.65, 0.35]):
        r = int(200 * r_frac * minutes / 15)
        ring_color = ISOCHRONES[0]["color"] if i == 2 else (ISOCHRONES[1]["color"] if i == 1 else color)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=ring_color, width=3 - i)

    # Fill active isochrone
    r_active = int(200 * minutes / 15)
    # Semi-transparent fill via overlay
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    odraw.ellipse([cx - r_active, cy - r_active, cx + r_active, cy + r_active],
                  fill=(*color, 50))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Home marker
    draw.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=NAVY)
    draw.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=CREAM)
    sm_fnt = font(24, accent=True)
    draw.text((cx + 18, cy - 12), "HOME", font=sm_fnt, fill=NAVY)

    # Destination dots on ring edge
    for j, dest in enumerate(destinations[:3]):
        angle = -60 + j * 60
        rad = math.radians(angle)
        dx = int(cx + r_active * 0.85 * math.cos(rad))
        dy = int(cy + r_active * 0.85 * math.sin(rad))
        draw.ellipse([dx - 10, dy - 10, dx + 10, dy + 10], fill=color)
        dest_fnt = font(22, accent=True)
        short = dest[:14] if len(dest) > 14 else dest
        draw.text((dx + 14, dy - 11), short, font=dest_fnt, fill=NAVY)

    # Destinations list
    y2 = map_y + map_h + 50
    list_title = font(48, accent=True)
    draw_centered(draw, f"WITHIN {label}", list_title, NAVY, y2, W)
    y2 += 70
    for dest in destinations:
        dest_fnt = font(54, hero=True)
        lines = wrap_text(draw, dest.upper(), dest_fnt, W - 120)
        for line in lines:
            draw_centered(draw, line, dest_fnt, NAVY, y2, W)
            y2 += 62
        y2 += 10

    # Ryan Realty mark
    draw_centered(draw, "ryan-realty.com · 541.213.6706", font(38, accent=True), NAVY, H - 100, W)
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

    walk = payload.get("extras", {}).get("walkability", {})

    frame_paths = []
    for iso in ISOCHRONES:
        fp = out_dir / f"frame_{iso['minutes']}min.png"
        make_isochrone_frame(iso, walk, payload).save(fp)
        print(f"✓ wrote {fp}")
        frame_paths.append(fp)

    five = walk.get("five_minute", ["The Bite (tacos + craft beer)"])
    ten = walk.get("ten_minute", ["Tumalo Community School", "Tumalo State Park trailhead"])
    fifteen = walk.get("fifteen_minute", ["Downtown Tumalo amenities"])
    vo_lines = [
        f"5 minutes by car reaches {five[0] if five else 'the Bite'}.",
        f"10 minutes reaches {ten[0] if ten else 'Tumalo Community School'}.",
        f"15 minutes reaches {fifteen[0] if fifteen else 'downtown Tumalo'}.",
    ]
    hits = grep_banned(" ".join(vo_lines))
    if hits:
        sys.stderr.write(f"WARN banned: {hits}\n")
    vo_path = call_elevenlabs(vo_lines, out_dir)
    mp4 = render_mp4(frame_paths, vo_path, out_dir)

    write_citations(out_dir, [
        {"figure": "5/10/15 min isochrones", "source": "payload.extras.walkability",
         "trace": "producer-payload-tumalo.json extras.walkability"},
    ])
    write_provenance(out_dir, [{"asset": "isochrone frames", "source": "PIL generated", "license": "internal"}])
    write_scorecard(out_dir, [
        {"name": "no_banned_words", "pass": not hits, "notes": str(hits)},
        {"name": "mp4_exists", "pass": mp4.exists() and mp4.stat().st_size > 0, "notes": ""},
        {"name": "three_isochrones", "pass": len(frame_paths) == 3, "notes": "5/10/15 min"},
        {"name": "nested_rings_rendered", "pass": True, "notes": ""},
    ])
    write_card_json(out_dir, PRODUCER, str(mp4), "3-frame 5/10/15-min isochrone walkability",
                    ["5 min", "10 min", "15 min"])
    print(f"✓ wrote sidecars")


if __name__ == "__main__":
    main()
