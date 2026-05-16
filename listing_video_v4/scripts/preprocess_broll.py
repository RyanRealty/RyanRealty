#!/usr/bin/env python3
"""Pre-process Bend Council b-roll clips into TikTok-style portrait full-bleed.

Per-source crops to eliminate Zoom UI + Zoom internal letterboxing of the
chamber video panel.

Source measurements (verified from full-frame 1280x720 thumbnails):

  jan7_chambers (Council Chambers wide shot from chamber camera):
    Active video panel: x=95..1015, y=80..510  → crop=920:430:95:80
    (excludes Zoom UI top + bottom + chamber camera black borders)

  feb4_chambers (Councilor Franzosa close-up + Council bench inset):
    Active panel: x=95..1015, y=125..400 → crop=920:275:95:125

  feb11_*  (Cassie Lacy slide presentations on Zoom screen-share):
    Slide content: x=10..900, y=58..635 → crop=890:577:10:58
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4/public/source_clips/bend_pulse")
LONG = ROOT / "long"
STACKED = ROOT / "stacked"
OUT = ROOT / "broll"
OUT.mkdir(exist_ok=True)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"FAIL: {' '.join(cmd[:3])}", file=sys.stderr)
        print(r.stderr[-300:], file=sys.stderr)
    return r.returncode


# Per-clip jobs:
# (label, source_dir_key, source_file, ss, dur, crop_w, crop_h, crop_x, crop_y, mode)
# mode = "chambers" → zoom on people (height-fit + crop sides)
# mode = "slide"    → preserve full slide content (width-fit, accept side bars)
JOBS = [
    # Tight chambers — Council DAIS only (drop public audience side). Pull from
    # source's right half: x=595..1015, y=140..345 → 420w × 205h.
    ("jan7_dais",         "stacked", "jan7_chambers.mp4",       0, 15,  420, 205, 595, 140, "chambers"),
    ("feb4_dais",         "stacked", "feb4_chambers.mp4",       0, 12,  420, 205, 595, 140, "chambers"),
    # Slides — full slide content
    ("feb11_fee_design",  "long", "feb11_intro_to_fee.mp4",     28, 15,  890, 577,  10,  58, "slide"),
    ("feb11_fee_levels",  "long", "feb11_fee_levels_discuss.mp4", 0, 15, 890, 577,  10,  58, "slide"),
    ("feb11_tcep",        "long", "feb11_tcep_discuss.mp4",    100, 14,  890, 577,  10,  58, "slide"),
    ("feb11_grid_impact", "long", "feb11_grid_pacific_power.mp4", 60, 15, 890, 577, 10,  58, "slide"),
    ("feb11_transmission","long", "feb11_grid_pacific_power.mp4", 18, 14, 890, 577, 10,  58, "slide"),
    # Cassie's "Recommended Approach" slide (different timestamp than tcep)
    ("feb11_approach",    "long", "feb11_tcep_discuss.mp4",     30, 14,  890, 577,  10,  58, "slide"),
]


def process(label, src_dir_key, src_file, ss, dur, cw, ch, cx, cy, mode):
    src_dir = STACKED if src_dir_key == "stacked" else LONG
    src = src_dir / src_file
    out_mp4 = OUT / f"{label}.mp4"
    if mode == "chambers":
        # Chambers content is wide and short. Zoom in on faces by height-fitting
        # to 1100 then cropping to 1080 wide.
        fg_chain = (
            "[orig]scale=-2:1100:flags=lanczos,"
            "crop='min(iw\\,1080)':1100:'(iw-min(iw\\,1080))/2':0[fg]"
        )
    else:
        # Slide content is closer to 4:3. Width-fit so the WHOLE slide is visible
        # (including the rightmost column with $9,771). Result: 1080 wide, 700ish tall.
        fg_chain = (
            "[orig]scale=1080:-2:flags=lanczos[fg]"
        )
    vf = (
        f"[0:v]crop={cw}:{ch}:{cx}:{cy},split=2[orig][bg];"
        # Background: cover-scale + heavy blur
        "[bg]scale=1080:1920:force_original_aspect_ratio=increase,"
        "crop=1080:1920,boxblur=24:2,eq=brightness=-0.06:saturation=0.85[bgblur];"
        f"{fg_chain};"
        "[bgblur][fg]overlay=(W-w)/2:(H-h)/2,"
        "format=yuv420p"
    )
    cmd = [
        "ffmpeg", "-hide_banner", "-nostats", "-loglevel", "error",
        "-ss", str(ss), "-i", str(src), "-t", str(dur),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "medium", "-crf", "21",
        "-an",
        "-movflags", "+faststart",
        "-y", str(out_mp4),
    ]
    if run(cmd) != 0:
        return None
    size_kb = out_mp4.stat().st_size / 1024
    print(f"  {label:25s} {dur}s  {size_kb:5.0f}KB", file=sys.stderr)
    return out_mp4


def main():
    print(f"Pre-processing {len(JOBS)} b-roll clips...\n", file=sys.stderr)
    for job in JOBS:
        process(*job)
    print("\nDone.", file=sys.stderr)


if __name__ == "__main__":
    main()
