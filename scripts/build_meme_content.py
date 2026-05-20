#!/usr/bin/env python3
"""
build_meme_content.py — Producer for the meme_content Remotion composition.

Spec: video_production_skills/meme_content/SKILL.md
Format: 15-25s trend-jacking meme clip (Vlipsy clip + Remotion text overlay).

Usage:
  python3 scripts/build_meme_content.py payload.json [--out out/meme_content/<slug>]
  python3 scripts/build_meme_content.py --help

Payload schema (JSON):
  {
    "context_line": "When you offer asking price",     # required, max 8 words
    "punchline_line": "4 other buyers did too",        # required, max 8 words
    "clip_url": "https://vlipsy.com/...",              # required — Vlipsy clip URL
    "duration_sec": 20,                                # optional, default 20
    "punchline_start_sec": null,                       # optional, default 40% of duration
    "trend_id": "clip-slug",                           # optional slug for output folder
    "vo_script": null                                  # optional VO text (rare for memes)
  }

Meme library:
  The clip_url and text come from data/meme-library.jsonl. Each entry has:
    {"id": "...", "clip_url": "...", "context_line": "...", "punchline_line": "...", "flag": "PASS|REVIEW|FAIL"}
  The build script picks a PASS-flagged entry or accepts a specific trend_id.
  If the library is empty (no PASS entries) this script exits with an informative error.

Pipeline:
  1. Load meme library; select PASS entry (or use payload clip_url directly).
  2. Banned-words check on context_line + punchline_line.
  3. Download Vlipsy clip to out/<slug>/clip.mp4 via yt-dlp or direct URL.
  4. Synthesize VO if vo_script present.
  5. Write Remotion props JSON.
  6. Remotion render: MemeComp.
  7. First-frame gate.
  8. Write sidecars.
"""

import sys
import json
import argparse
import subprocess
import datetime
from pathlib import Path

REPO_ROOT = Path("/Users/matthewryan/RyanRealty")
SKILL = "meme_content"
COMP_ID = "MemeComp"
PROJECT_DIR = REPO_ROOT / "video" / "meme_content"
MEME_LIBRARY = REPO_ROOT / "data" / "meme-library.jsonl"


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


def pick_meme_entry(trend_id: str | None) -> dict | None:
    """Pick a PASS-flagged meme entry from the library, or None if empty."""
    if not MEME_LIBRARY.exists():
        return None
    entries = []
    for line in MEME_LIBRARY.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
            if entry.get("flag") == "PASS":
                entries.append(entry)
        except json.JSONDecodeError:
            continue
    if not entries:
        return None
    if trend_id:
        for e in entries:
            if e.get("id") == trend_id:
                return e
    return entries[0]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build a meme_content Remotion video.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("payload", nargs="?", help="Path to payload JSON file.")
    parser.add_argument("--out", default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.payload:
        parser.print_help()
        sys.exit(0)

    payload_path = Path(args.payload)
    if not payload_path.exists():
        print(f"ERROR: payload not found: {payload_path}", file=sys.stderr)
        sys.exit(1)

    payload = json.loads(payload_path.read_text())

    # Resolve clip + text: payload direct fields take precedence over library lookup
    context_line = payload.get("context_line", "")
    punchline_line = payload.get("punchline_line", "")
    clip_url_raw = payload.get("clip_url", None)
    trend_id = payload.get("trend_id", None)
    duration_sec = float(payload.get("duration_sec", 20))
    punchline_start_sec = payload.get("punchline_start_sec", None)
    vo_script = payload.get("vo_script", None)

    # If payload doesn't have text, try library
    if not context_line or not punchline_line or not clip_url_raw:
        entry = pick_meme_entry(trend_id)
        if entry is None:
            print(
                "ERROR: meme-library.jsonl is empty or has no PASS-flagged entries.\n"
                "Run scripts/scrape-meme-library.mjs to populate data/meme-library.jsonl,\n"
                "then re-run with a PASS-flagged entry.",
                file=sys.stderr,
            )
            sys.exit(1)
        context_line = context_line or entry.get("context_line", "")
        punchline_line = punchline_line or entry.get("punchline_line", "")
        clip_url_raw = clip_url_raw or entry.get("clip_url", None)
        trend_id = trend_id or entry.get("id", "meme")

    if not context_line or not punchline_line:
        print("ERROR: context_line and punchline_line are required.", file=sys.stderr)
        sys.exit(1)

    target_slug = trend_id or "meme"
    out_dir = Path(args.out) if args.out else REPO_ROOT / "out" / SKILL / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    # Step 1: Banned-words check
    print(f"[{SKILL}] Step 1: banned-words check ...")
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    try:
        from _producer_lib import has_hard_fail  # type: ignore
        all_text = f"{context_line} {punchline_line} {vo_script or ''}"
        fail_reason = has_hard_fail(all_text)
        if fail_reason:
            print(f"ERROR: banned-word/phrase found: {fail_reason}", file=sys.stderr)
            sys.exit(1)
        print("  ok no banned words")
    except ImportError:
        print("  warn _producer_lib not importable - manual review required")

    # Step 2: Download Vlipsy clip
    print(f"[{SKILL}] Step 2: clip download ...")
    clip_local = out_dir / "clip.mp4"
    clip_remotion_path = None  # relative to public/ - set after copy

    if clip_url_raw:
        if not clip_local.exists():
            dl_result = subprocess.run(
                ["yt-dlp", "-o", str(clip_local), "--quiet", "--no-warnings", clip_url_raw],
                capture_output=True, text=True,
            )
            if dl_result.returncode != 0:
                # Fallback: try urllib direct download
                try:
                    import urllib.request
                    urllib.request.urlretrieve(clip_url_raw, clip_local)
                    print(f"  ok clip downloaded (urllib): {clip_local}")
                except Exception as exc:
                    print(f"  warn clip download failed ({exc}) - MemeComp will render library-empty placeholder")
                    clip_local = None
            else:
                print(f"  ok clip downloaded (yt-dlp): {clip_local}")
        else:
            print(f"  ok clip already present: {clip_local}")

        if clip_local and clip_local.exists():
            # Copy to project public/clips/ so staticFile() can reference it
            clips_dir = PROJECT_DIR / "public" / "clips"
            clips_dir.mkdir(parents=True, exist_ok=True)
            dest = clips_dir / "clip.mp4"
            import shutil
            shutil.copy2(clip_local, dest)
            clip_remotion_path = "clips/clip.mp4"
    else:
        print("  warn no clip_url - MemeComp renders library-empty placeholder")

    # Step 3: VO (optional)
    print(f"[{SKILL}] Step 3: VO synthesis ...")
    caption_words = []
    env_vars = load_env()
    if vo_script and env_vars.get("ELEVENLABS_API_KEY"):
        try:
            from _voice_lib import synth_vo  # type: ignore
            vo_result = synth_vo(text=vo_script, out_dir=str(out_dir), filename="meme_vo.mp3")
            caption_words = vo_result.get("alignment_words", [])
            print(f"  ok VO synthesized, {len(caption_words)} alignment words")
        except Exception as exc:
            print(f"  warn VO failed ({exc})")
    else:
        print("  ok no VO requested for this meme")

    # Step 4: Write Remotion props
    print(f"[{SKILL}] Step 4: writing Remotion props ...")
    duration_frames = int(round(duration_sec * 30))
    punchline_frame = int(round(punchline_start_sec * 30)) if punchline_start_sec is not None else int(round(duration_frames * 0.40))
    remotion_props = {
        "clipUrl": clip_remotion_path,
        "durationFrames": duration_frames,
        "contextLine": context_line,
        "punchlineLine": punchline_line,
        "punchlineStartFrame": punchline_frame,
        "captionWords": caption_words,
    }
    props_path = PROJECT_DIR / "src" / "props.json"
    props_path.write_text(json.dumps(remotion_props, indent=2))
    print(f"  ok props written to {props_path}")

    if args.dry_run:
        print(f"\n[{SKILL}] dry-run complete. Planned output: {out_dir}/meme_content.mp4")
        return

    # Step 5: Remotion render
    print(f"[{SKILL}] Step 5: Remotion render ...")
    mp4_path = out_dir / "meme_content.mp4"
    render_cmd = [
        "npx", "remotion", "render",
        "src/index.ts", COMP_ID, str(mp4_path),
        "--props", str(props_path),
        "--codec", "h264", "--concurrency", "1",
        "--crf", "22", "--image-format=jpeg", "--jpeg-quality=92",
    ]
    result = subprocess.run(render_cmd, cwd=str(PROJECT_DIR))
    if result.returncode != 0:
        print(f"ERROR: Remotion render failed (exit {result.returncode})", file=sys.stderr)
        sys.exit(result.returncode)
    print(f"  ok rendered: {mp4_path}")

    # Step 6: First-frame gate
    print(f"[{SKILL}] Step 6: first-frame gate ...")
    gate = subprocess.run(
        ["python3", str(REPO_ROOT / "scripts" / "check_first_frame.py"), str(mp4_path)],
        capture_output=True, text=True,
    )
    if gate.returncode != 0:
        print(f"SHIP-BLOCKER: first-frame gate failed:\n{gate.stdout}\n{gate.stderr}", file=sys.stderr)
        sys.exit(1)
    print("  ok first-frame gate passed")

    # Step 7: Sidecars
    now = datetime.datetime.utcnow().isoformat() + "Z"
    (out_dir / "card.json").write_text(json.dumps({
        "producer": SKILL, "slug": target_slug, "primary_artifact": "meme_content.mp4",
        "context_line": context_line, "punchline_line": punchline_line,
        "clip_source": clip_url_raw, "generated_at": now,
        "render": {"source": "video/meme_content/src/MemeComp.tsx", "composition": COMP_ID, "resolution": "1080x1920", "fps": 30},
    }, indent=2))
    (out_dir / "citations.json").write_text(json.dumps({
        "generated_at": now,
        "figures": [],
        "notes": "Meme format has no market-data figures. Text reviewed against _producer_lib.has_hard_fail().",
    }, indent=2))

    print(f"\n[{SKILL}] Draft ready: {mp4_path}")
    print("  DO NOT commit. Wait for Matt's explicit approval before moving to public/v5_library/.")


if __name__ == "__main__":
    main()
