#!/usr/bin/env python3
"""
check_first_frame.py — first-frame thumbnail gate for Ryan Realty video renders.

The first frame of every social video is what auto-generates as the preview
thumbnail in the IG / TikTok / YT / FB feed. A black frame, a logo-only card,
a blank background, or a low-contrast title slide kills click-through before
the algorithm gets a chance.

This script extracts frame 0 from a rendered MP4 and runs three checks:

  1. LUMINANCE   — fail if mean luminance < 30 (too dark) or > 240 (too white)
  2. VARIANCE    — fail if pixel variance < 250 (solid color, blank card, logo-on-flat)
  3. SATURATION  — fail if saturation < 8 AND luminance is mid-range (mid-gray screen)

Exit code 0 = PASS (frame is a good thumbnail).
Exit code 1 = FAIL (frame is unsuitable — re-design the comp's t=0).

Usage:
    python3 scripts/check_first_frame.py <path/to/video.mp4>
    python3 scripts/check_first_frame.py out/news_video/<slug>/news.mp4 --verbose

Per CLAUDE.md "First frame as thumbnail (t=0) — HARD RULE" locked 2026-05-20.
"""

from __future__ import annotations
import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import TypedDict

try:
    from PIL import Image, ImageStat
except ImportError:
    sys.stderr.write("ERROR: Pillow is required. Install with `pip install Pillow`.\n")
    sys.exit(2)


# ── Tunable thresholds ──────────────────────────────────────────────────────
# These match the rule in CLAUDE.md "First frame as thumbnail (t=0)".
LUMA_MIN = 30      # too dark below this
LUMA_MAX = 240     # too white above this
VARIANCE_MIN = 250 # solid color below this (across R / G / B average)
SAT_MIN = 8        # near-grayscale below this when luma is mid-range
LUMA_MID_LO = 60   # mid-range luma low end (gray-screen check)
LUMA_MID_HI = 200  # mid-range luma high end (gray-screen check)


class CheckResult(TypedDict):
    passed: bool
    luma_mean: float
    variance_mean: float
    saturation_mean: float
    failures: list[str]
    frame_path: str


def extract_first_frame(video_path: Path, out_dir: Path) -> Path:
    """Run ffmpeg to extract frame 0 to a PNG. Return the path."""
    ffmpeg = shutil.which("ffmpeg") or "ffmpeg"
    frame_path = out_dir / "frame0.png"
    cmd = [
        ffmpeg,
        "-hide_banner",
        "-loglevel", "error",
        "-y",
        "-ss", "0",
        "-i", str(video_path),
        "-frames:v", "1",
        "-q:v", "2",
        str(frame_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.stderr.write(f"ERROR: ffmpeg failed extracting frame 0:\n{result.stderr}\n")
        sys.exit(2)
    if not frame_path.exists() or frame_path.stat().st_size == 0:
        sys.stderr.write(f"ERROR: ffmpeg produced empty frame at {frame_path}\n")
        sys.exit(2)
    return frame_path


def analyze_frame(frame_path: Path) -> CheckResult:
    """Run luminance + variance + saturation checks on the extracted frame."""
    img = Image.open(frame_path).convert("RGB")

    # Mean R, G, B
    stat_rgb = ImageStat.Stat(img)
    r_mean, g_mean, b_mean = stat_rgb.mean
    luma = 0.2126 * r_mean + 0.7152 * g_mean + 0.0722 * b_mean

    # Variance — average across channels
    r_var, g_var, b_var = stat_rgb.var
    variance = (r_var + g_var + b_var) / 3.0

    # Saturation — compute on HSV
    hsv = img.convert("HSV")
    stat_hsv = ImageStat.Stat(hsv)
    _, saturation_mean, _ = stat_hsv.mean

    failures: list[str] = []
    if luma < LUMA_MIN:
        failures.append(
            f"too dark (luminance mean {luma:.1f} < {LUMA_MIN}) — likely black opening; "
            f"add real photo / hero content at t=0"
        )
    elif luma > LUMA_MAX:
        failures.append(
            f"too white (luminance mean {luma:.1f} > {LUMA_MAX}) — likely blank cream card; "
            f"add real photo / hero content at t=0"
        )
    if variance < VARIANCE_MIN:
        failures.append(
            f"solid color (channel variance {variance:.1f} < {VARIANCE_MIN}) — frame has "
            f"no visual detail; banned brand-card / logo-only / blank-background opening"
        )
    if saturation_mean < SAT_MIN and LUMA_MID_LO <= luma <= LUMA_MID_HI:
        failures.append(
            f"gray-screen (saturation {saturation_mean:.1f} < {SAT_MIN}, mid-luma {luma:.1f}) — "
            f"frame reads as a neutral title card; add color + photo content at t=0"
        )

    return CheckResult(
        passed=len(failures) == 0,
        luma_mean=round(luma, 2),
        variance_mean=round(variance, 2),
        saturation_mean=round(saturation_mean, 2),
        failures=failures,
        frame_path=str(frame_path),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="First-frame thumbnail gate for Ryan Realty videos.")
    parser.add_argument("video", type=str, help="Path to MP4 (rendered video file)")
    parser.add_argument("--verbose", action="store_true", help="Print all stats, not just failures")
    parser.add_argument("--keep-frame", action="store_true", help="Keep extracted frame0.png next to the MP4")
    parser.add_argument("--json", action="store_true", help="Emit JSON result to stdout")
    args = parser.parse_args()

    video_path = Path(args.video).resolve()
    if not video_path.exists():
        sys.stderr.write(f"ERROR: video not found: {video_path}\n")
        return 2

    if args.keep_frame:
        out_dir = video_path.parent
        frame_path = extract_first_frame(video_path, out_dir)
        result = analyze_frame(frame_path)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            frame_path = extract_first_frame(video_path, Path(tmp))
            result = analyze_frame(frame_path)
            # Override with a non-existent path for the result since we cleaned up.
            result["frame_path"] = ""

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        status = "PASS" if result["passed"] else "FAIL"
        print(f"[{status}] first-frame gate for {video_path.name}")
        if args.verbose or not result["passed"]:
            print(f"  luminance mean : {result['luma_mean']:>7.2f}  (range {LUMA_MIN}-{LUMA_MAX})")
            print(f"  channel variance: {result['variance_mean']:>7.2f}  (min {VARIANCE_MIN})")
            print(f"  saturation mean : {result['saturation_mean']:>7.2f}  (min {SAT_MIN} when mid-luma)")
        if result["failures"]:
            print("\nFailures:")
            for f in result["failures"]:
                print(f"  - {f}")
            print(
                "\nFix: re-design the Remotion comp's t=0. Render real hero photography or "
                "live content at frame 0. Brand stamps, logos, title cards on flat color, and "
                "fade-from-black openings are banned at t=0 (see CLAUDE.md \"First frame as "
                "thumbnail\")."
            )

    return 0 if result["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
