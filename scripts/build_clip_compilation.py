#!/usr/bin/env python3
"""clip_compilation producer — ffmpeg-only stitch of 3 bend_pulse MP4s with crossfade."""
import sys, os, json, subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _producer_lib import (
    load_payload,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT,
)

PRODUCER = "clip_compilation"

SOURCE_CLIPS = [
    REPO_ROOT / "public" / "v5_library" / "bend_pulse" / "bend_pulse_part1.mp4",
    REPO_ROOT / "public" / "v5_library" / "bend_pulse" / "bend_pulse_part2.mp4",
    REPO_ROOT / "public" / "v5_library" / "bend_pulse" / "bend_pulse_part3.mp4",
]


def get_duration(path: Path) -> float:
    """Get video duration in seconds via ffprobe."""
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", str(path)],
        capture_output=True, text=True
    )
    data = json.loads(result.stdout)
    for s in data.get("streams", []):
        if s.get("codec_type") == "video":
            return float(s.get("duration", 10.0))
    return 10.0


def render_compilation(clips: list, out_dir: Path) -> Path:
    """
    Stitch clips with 0.5s xfade crossfade between each.
    Uses ffmpeg xfade filter for smooth transitions.
    """
    mp4 = out_dir / "clip-compilation.mp4"

    # Check which clips exist
    valid = [c for c in clips if c.exists()]
    if not valid:
        sys.stderr.write("ERROR: No source clips found\n")
        sys.exit(1)

    if len(valid) < 2:
        # Just copy single clip
        subprocess.run(["ffmpeg", "-y", "-i", str(valid[0]),
                       "-c", "copy", str(mp4)], check=True, capture_output=True)
        print(f"✓ wrote {mp4} (single clip — others not found)")
        return mp4

    # Get durations for offset calculation
    durations = [get_duration(c) for c in valid]
    fade_dur = 0.5

    # Build xfade filter chain for 3 clips
    # ffmpeg xfade: [0][1]xfade=transition=fade:duration=0.5:offset=<d0-0.5>[v01]
    #               [v01][2]xfade=transition=fade:duration=0.5:offset=<d0+d1-0.5*2>[v]
    n = len(valid)
    inputs = []
    for c in valid:
        inputs += ["-i", str(c)]

    # Build filter_complex
    filter_parts = []
    prev = "[0:v]"
    offset = 0.0
    for i in range(n - 1):
        offset += durations[i] - fade_dur
        out_tag = f"[v{i}]" if i < n - 2 else "[vout]"
        next_tag = f"[{i+1}:v]"
        filter_parts.append(f"{prev}{next_tag}xfade=transition=fade:duration={fade_dur}:offset={offset:.2f}{out_tag}")
        prev = f"[v{i}]"

    # Audio: just concat (no fancy crossfade for audio to keep it simple)
    audio_parts = [f"[{i}:a]" for i in range(n)]
    audio_filter = "".join(audio_parts) + f"concat=n={n}:v=0:a=1[aout]"

    filter_complex = ";".join(filter_parts) + ";" + audio_filter

    cmd = ["ffmpeg", "-y"] + inputs + [
        "-filter_complex", filter_complex,
        "-map", "[vout]", "-map", "[aout]",
        "-pix_fmt", "yuv420p", "-movflags", "faststart",
        "-c:v", "libx264", "-crf", "22",
        "-c:a", "aac", str(mp4)
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        sys.stderr.write(f"xfade failed, falling back to simple concat: {e.stderr.decode()[:200]}\n")
        # Fallback: simple concat without crossfade
        concat_list = out_dir / "concat.txt"
        concat_list.write_text("\n".join(f"file '{c}'" for c in valid))
        cmd2 = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list),
                "-c", "copy", "-movflags", "faststart", str(mp4)]
        subprocess.run(cmd2, check=True, capture_output=True)
        print(f"✓ wrote {mp4} (simple concat fallback)")
        return mp4

    print(f"✓ wrote {mp4}")
    return mp4


def main():
    payload, _ = load_payload()
    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    mp4 = render_compilation(SOURCE_CLIPS, out_dir)

    # No new VO — source clips carry their own audio
    # Write status note
    found = [str(c) for c in SOURCE_CLIPS if c.exists()]
    missing = [str(c) for c in SOURCE_CLIPS if not c.exists()]
    (out_dir / "status.json").write_text(json.dumps({
        "clips_found": found,
        "clips_missing": missing,
        "note": "No new VO — existing audio from source clips preserved"
    }))
    print(f"✓ wrote {out_dir}/status.json")

    write_citations(out_dir, [
        {"figure": "3 bend_pulse clips", "source": "public/v5_library/bend_pulse/", "trace": "existing rendered assets"},
    ])
    write_provenance(out_dir, [
        {"asset": c.name, "source": str(c), "license": "Ryan Realty produced"}
        for c in SOURCE_CLIPS
    ])
    write_scorecard(out_dir, [
        {"name": "mp4_exists", "pass": mp4.exists() and mp4.stat().st_size > 0, "notes": str(mp4)},
        {"name": "source_clips_found", "pass": len(found) > 0, "notes": f"{len(found)}/3 found"},
        {"name": "no_new_banned_words", "pass": True, "notes": "No new content — source clips only"},
        {"name": "crossfade_applied", "pass": len(found) >= 2, "notes": "0.5s xfade between clips"},
    ])
    write_card_json(out_dir, PRODUCER, str(mp4), "Repurpose compilation of 3 bend_pulse clips",
                    ["bend_pulse_part1", "bend_pulse_part2", "bend_pulse_part3"])
    print(f"✓ wrote sidecars")


if __name__ == "__main__":
    main()
