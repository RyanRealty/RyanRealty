#!/usr/bin/env python3
"""Extract speaker bites from long Council clips, pre-process to portrait
1080x1920 full-bleed (objectFit: cover style — fills frame, no letterbox).

Each bite gets two outputs:
  bites/<label>.mp4  — portrait full-bleed with original audio
  bites/<label>.json — manifest entry with text, source, timestamps, duration
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4/public/source_clips/bend_pulse")
LONG = ROOT / "long"
OUT = ROOT / "bites"
OUT.mkdir(exist_ok=True)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"FAIL: {' '.join(cmd[:3])}...", file=sys.stderr)
        print(r.stderr[-400:], file=sys.stderr)
    return r.returncode


def extract_bite(source_label: str, label: str, start: float, end: float, text: str):
    src = LONG / f"{source_label}.mp4"
    out_mp4 = OUT / f"{label}.mp4"
    out_meta = OUT / f"{label}.json"

    # Crop slide region (890x577 from raw 1280x720, excluding right-side insets)
    # then composite into 1080x1920 portrait with TikTok-style blurred-fill background.
    # Foreground is WIDTH-FIT so the whole slide stays visible (no rightmost-column
    # clipping). Background is cover-scaled + blurred to fill the rest.
    duration = end - start
    vf = (
        "[0:v]crop=890:577:10:58,split=2[orig][bg];"
        "[bg]scale=1080:1920:force_original_aspect_ratio=increase,"
        "crop=1080:1920,boxblur=24:2,eq=brightness=-0.06:saturation=0.85[bgblur];"
        "[orig]scale=1080:-2:flags=lanczos[fg];"
        "[bgblur][fg]overlay=(W-w)/2:(H-h)/2,"
        "format=yuv420p"
    )
    cmd = [
        "ffmpeg", "-hide_banner", "-nostats", "-loglevel", "error",
        "-ss", str(start), "-i", str(src), "-t", f"{duration:.3f}",
        "-vf", vf,
        "-c:v", "libx264", "-preset", "medium", "-crf", "21",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        "-y", str(out_mp4),
    ]
    if run(cmd) != 0:
        return None
    out_meta.write_text(json.dumps({
        "label": label,
        "source_clip": source_label,
        "source_start_sec": start,
        "source_end_sec": end,
        "duration_sec": round(duration, 3),
        "text": text,
        "output_file": f"source_clips/bend_pulse/bites/{label}.mp4",
    }, indent=2))
    size_kb = out_mp4.stat().st_size / 1024
    print(f"  {label:35s} {duration:5.2f}s  {size_kb:5.0f}KB  {text[:60]}", file=sys.stderr)
    return out_mp4


def main():
    bites = json.loads((LONG / "bites_inventory.json").read_text())
    print(f"Extracting {len(bites)} bites...\n", file=sys.stderr)
    for b in bites:
        # Use expanded sentence boundary
        extract_bite(
            source_label=b["source_file"],
            label=b["label"],
            start=b["expanded_start_sec"],
            end=b["expanded_end_sec"],
            text=b["matched_text"],
        )
    print("\nDone.", file=sys.stderr)


if __name__ == "__main__":
    main()
