#!/usr/bin/env python3
"""
build_area_guides.py — Producer for the area_guides Remotion composition.

Spec: video_production_skills/area_guides/SKILL.md
Format: 30-35s portrait neighborhood reel, 6 beats, VO optional.

Usage:
  python3 scripts/build_area_guides.py payload.json [--out out/area_guides/<slug>]
  python3 scripts/build_area_guides.py --help

Payload schema (JSON):
  {
    "neighborhood": "Tumalo",
    "city": "Bend, Oregon",
    "hook_text": "...",
    "amenity_labels": ["...", "...", "..."],
    "stat_value": "$847K",
    "stat_label": "Median price · 2025",
    "pexels_query": "...",
    "target_slug": "tumalo"
  }

Pipeline:
  1. Banned-words check on all text fields (_producer_lib.has_hard_fail).
  2. Pull Pexels stock photos for each beat (6 photos via PEXELS_API_KEY).
  3. Synth VO (synth_vo from _voice_lib) if ELEVENLABS_API_KEY is present.
  4. Fetch forced-alignment from ElevenLabs /v1/forced-alignment.
  5. Write Remotion props JSON to video/area_guides/src/props.json.
  6. Run: npx remotion render src/index.ts AreaGuide out/<slug>/area_guides.mp4
  7. Run scripts/check_first_frame.py gate.
  8. Write card.json + citations.json.
  9. Print draft path — wait for Matt approval before any publish.
"""

import sys
import json
import argparse
import subprocess
import datetime
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path("/Users/matthewryan/RyanRealty")
SKILL = "area_guides"
COMP_ID = "AreaGuide"
PROJECT_DIR = REPO_ROOT / "video" / "area_guides"

NEIGHBORHOOD_DEFAULTS = {
    "tumalo": {
        "hook_text": "Wide open space. Ten minutes from downtown.",
        "amenity_labels": ["Tumalo State Park", "Deschutes River access", "Wide lots · No HOA"],
        "pexels_query": "Tumalo Oregon Deschutes River open land",
    },
    "northwest crossing": {
        "hook_text": "Walkable neighborhood. Trails at your door.",
        "amenity_labels": ["Shevlin Park trails", "Neighborhood market", "Top-rated schools"],
        "pexels_query": "Oregon neighborhood trails park walkable community",
    },
    "awbrey butte": {
        "hook_text": "Elevated views. Elevated life.",
        "amenity_labels": ["Panoramic Cascade views", "HOA trail system", "Minutes to Old Mill"],
        "pexels_query": "Oregon mountain views luxury neighborhood butte",
    },
}


def load_env() -> dict:
    env = {}
    env_file = REPO_ROOT / ".env.local"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            eq = s.find("=")
            if eq < 1:
                continue
            k, v = s[:eq].strip(), s[eq + 1:].strip()
            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                v = v[1:-1]
            env[k] = v
    return env


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build an area_guides Remotion video.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("payload", nargs="?", help="Path to payload JSON file.")
    parser.add_argument("--out", default=None, help="Output directory.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and plan without rendering.")
    args = parser.parse_args()

    if not args.payload:
        parser.print_help()
        sys.exit(0)

    payload_path = Path(args.payload)
    if not payload_path.exists():
        print(f"ERROR: payload not found: {payload_path}", file=sys.stderr)
        sys.exit(1)

    payload = json.loads(payload_path.read_text())
    neighborhood = payload.get("neighborhood", "Tumalo")
    city = payload.get("city", "Bend, Oregon")
    target_slug = payload.get("target_slug", neighborhood.lower().replace(" ", "-"))
    neighborhood_key = neighborhood.lower()

    defaults = NEIGHBORHOOD_DEFAULTS.get(neighborhood_key, {
        "hook_text": f"Your next chapter starts in {neighborhood}.",
        "amenity_labels": ["Local parks", "Great schools", "Community events"],
        "pexels_query": f"{neighborhood} Oregon community",
    })

    hook_text = payload.get("hook_text", defaults["hook_text"])
    amenity_labels = list(payload.get("amenity_labels", defaults["amenity_labels"]))
    while len(amenity_labels) < 3:
        amenity_labels.append("")
    amenity_labels = amenity_labels[:3]

    stat_value = payload.get("stat_value", "—")
    stat_label = payload.get("stat_label", "Median sale price")

    # Step 1: Banned-words check
    print(f"[{SKILL}] Step 1: banned-words check ...")
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    try:
        from _producer_lib import has_hard_fail  # type: ignore
        all_text = " ".join([hook_text] + amenity_labels + [stat_value, stat_label, city, neighborhood])
        fail_reason = has_hard_fail(all_text)
        if fail_reason:
            print(f"ERROR: banned-word/phrase found: {fail_reason}", file=sys.stderr)
            sys.exit(1)
        print("  ok no banned words")
    except ImportError:
        print("  warn _producer_lib not importable - skipping banned-word check")

    out_dir = Path(args.out) if args.out else REPO_ROOT / "out" / SKILL / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    # Step 2: Pexels photo fetch
    print(f"[{SKILL}] Step 2: Pexels photo fetch ...")
    env_vars = load_env()
    pexels_key = env_vars.get("PEXELS_API_KEY", "")
    photo_urls = [None] * 6

    if pexels_key:
        try:
            pexels_query = payload.get("pexels_query", defaults["pexels_query"])
            url = f"https://api.pexels.com/v1/search?query={urllib.parse.quote(pexels_query)}&per_page=12&orientation=portrait"
            req = urllib.request.Request(url, headers={"Authorization": pexels_key})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
            photos = data.get("photos", [])
            for i, photo in enumerate(photos[:6]):
                src = photo.get("src", {})
                photo_urls[i] = src.get("portrait") or src.get("large") or src.get("original")
            print(f"  ok fetched {sum(1 for p in photo_urls if p)} Pexels photos")
        except Exception as exc:
            print(f"  warn Pexels fetch failed ({exc}) - comp renders with placeholders")
    else:
        print("  warn PEXELS_API_KEY not set - comp renders with placeholder gradients")

    # Step 3: VO synthesis
    print(f"[{SKILL}] Step 3: VO synthesis ...")
    vo_path = None
    caption_words = []
    vo_script = " ".join([
        hook_text,
        f"Welcome to {neighborhood} in {city}.",
        f"{amenity_labels[0]}.",
        f"{amenity_labels[1]}.",
        f"{amenity_labels[2]}.",
        f"Median price: {stat_value}.",
    ])

    elevenlabs_key = env_vars.get("ELEVENLABS_API_KEY", "")
    if elevenlabs_key:
        try:
            from _voice_lib import synth_vo  # type: ignore
            vo_result = synth_vo(text=vo_script, out_dir=str(out_dir), filename="area_guides_vo.mp3")
            vo_path = vo_result.get("mp3_path")
            caption_words = vo_result.get("alignment_words", [])
            print(f"  ok VO synthesized: {vo_path}")
            print(f"  ok {len(caption_words)} alignment words")
        except ImportError:
            print("  warn _voice_lib not importable - skipping VO")
        except Exception as exc:
            print(f"  warn VO synthesis failed ({exc}) - skipping")
    else:
        print("  warn ELEVENLABS_API_KEY not set - skipping VO")

    # Step 4: Write Remotion props
    print(f"[{SKILL}] Step 4: writing Remotion props ...")
    remotion_props = {
        "neighborhood": neighborhood,
        "city": city,
        "hookText": hook_text,
        "amenityLabels": amenity_labels,
        "statValue": stat_value,
        "statLabel": stat_label,
        "captionWords": caption_words,
        "photoUrls": photo_urls,
    }
    props_path = PROJECT_DIR / "src" / "props.json"
    props_path.write_text(json.dumps(remotion_props, indent=2))
    print(f"  ok props written to {props_path}")

    if args.dry_run:
        print(f"\n[{SKILL}] dry-run complete. Planned output: {out_dir}/area_guides.mp4")
        return

    # Step 5: Remotion render
    print(f"[{SKILL}] Step 5: Remotion render ...")
    mp4_path = out_dir / "area_guides.mp4"
    render_cmd = [
        "npx", "remotion", "render",
        "src/index.ts", COMP_ID,
        str(mp4_path),
        "--props", str(props_path),
        "--codec", "h264",
        "--concurrency", "1",
        "--crf", "22",
        "--image-format=jpeg",
        "--jpeg-quality=92",
    ]
    result = subprocess.run(render_cmd, cwd=str(PROJECT_DIR))
    if result.returncode != 0:
        print(f"ERROR: Remotion render failed (exit {result.returncode})", file=sys.stderr)
        sys.exit(result.returncode)
    print(f"  ok rendered: {mp4_path}")

    # Step 6: First-frame gate
    print(f"[{SKILL}] Step 6: first-frame gate ...")
    gate_result = subprocess.run(
        ["python3", str(REPO_ROOT / "scripts" / "check_first_frame.py"), str(mp4_path)],
        capture_output=True, text=True,
    )
    if gate_result.returncode != 0:
        print(f"SHIP-BLOCKER: first-frame gate failed:\n{gate_result.stdout}\n{gate_result.stderr}", file=sys.stderr)
        sys.exit(1)
    print("  ok first-frame gate passed")

    # Step 7: Sidecars
    now = datetime.datetime.utcnow().isoformat() + "Z"
    (out_dir / "card.json").write_text(json.dumps({
        "producer": SKILL, "slug": target_slug, "primary_artifact": "area_guides.mp4",
        "neighborhood": neighborhood, "city": city, "generated_at": now,
        "render": {"source": "video/area_guides/src/AreaGuide.tsx", "composition": COMP_ID, "resolution": "1080x1920", "fps": 30},
    }, indent=2))
    (out_dir / "citations.json").write_text(json.dumps({
        "generated_at": now,
        "figures": [{"figure": stat_value, "label": stat_label, "source": "Supabase market_stats_cache", "note": "Re-verify before publish."}],
    }, indent=2))

    print(f"\n[{SKILL}] Draft ready: {mp4_path}")
    print("  DO NOT commit. Wait for Matt's explicit approval before moving to public/v5_library/.")


if __name__ == "__main__":
    main()
