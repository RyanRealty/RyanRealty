#!/usr/bin/env python3
"""
build_avatar_market_update.py — Producer for the avatar_market_update format.

Spec: video_production_skills/avatar_market_update/SKILL.md

IMPORTANT: This producer is BLOCKED on Synthesia avatar configuration.
See video/avatar_market_update/README.md for the full setup runbook.

This script documents the full intended pipeline and exits with a clear
instructional error until SYNTHESIA_AVATAR_ID is configured.

Usage:
  python3 scripts/build_avatar_market_update.py payload.json [--out out/avatar_market_update/<slug>]
  python3 scripts/build_avatar_market_update.py --help

Payload schema (JSON):
  {
    "city": "Bend",                  # required
    "week": "2026-05-20",            # optional — defaults to today
    "target_slug": null              # optional
  }

Pipeline (once Synthesia avatar is configured):
  1. Pull Supabase market_pulse_live for the city.
  2. Generate 180-word-max script via generate_avatar_script.py.
  3. Check script: _producer_lib.has_hard_fail(), word count <= 180.
  4. Submit to Synthesia API (POST /v2/videos) with SYNTHESIA_AVATAR_ID.
  5. Poll until render complete; download avatar MP4.
  6. Run Remotion AvatarMarketComp to add intro + stat overlays + end cards.
  7. First-frame gate.
  8. Write sidecars.
  9. Print draft path — wait for Matt approval.

Setup requirement:
  export SYNTHESIA_AVATAR_ID=<avatar_id_from_app.synthesia.io>
  (Add to .env.local)
"""

import sys
import json
import argparse
from pathlib import Path

REPO_ROOT = Path("/Users/matthewryan/RyanRealty")
SKILL = "avatar_market_update"


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
        description="Build an avatar_market_update video (requires Synthesia avatar setup).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("payload", nargs="?", help="Path to payload JSON file.")
    parser.add_argument("--out", default=None)
    parser.add_argument("--dry-run", action="store_true", help="Validate prerequisites without rendering.")
    args = parser.parse_args()

    if not args.payload:
        parser.print_help()
        sys.exit(0)

    env_vars = load_env()

    synthesia_key = env_vars.get("SYNTHESIA_API_KEY", "")
    avatar_id = env_vars.get("SYNTHESIA_AVATAR_ID", "")

    print(f"[{SKILL}] Prerequisites check ...")
    print(f"  SYNTHESIA_API_KEY: {'ok (present)' if synthesia_key else 'MISSING'}")
    print(f"  SYNTHESIA_AVATAR_ID: {'ok (present)' if avatar_id else 'NOT SET'}")

    if not synthesia_key:
        print(
            "\nERROR: SYNTHESIA_API_KEY not set in .env.local.\n"
            "Add: SYNTHESIA_API_KEY=<your_key>\n"
            "See video/avatar_market_update/README.md for setup instructions.",
            file=sys.stderr,
        )
        sys.exit(1)

    if not avatar_id:
        print(
            "\nERROR: SYNTHESIA_AVATAR_ID not set in .env.local.\n\n"
            "Setup steps:\n"
            "  1. Log in to app.synthesia.io\n"
            "  2. Go to Avatars — choose a stock avatar or upload Matt's video\n"
            "  3. Copy the avatar ID from the URL or API\n"
            "  4. Add to .env.local:\n"
            "       SYNTHESIA_AVATAR_ID=<id>\n"
            "  5. Re-run this script\n\n"
            "Full runbook: video/avatar_market_update/README.md",
            file=sys.stderr,
        )
        sys.exit(1)

    # If both keys are present, proceed (pipeline stub — Remotion comp pending)
    payload_path = Path(args.payload)
    if not payload_path.exists():
        print(f"ERROR: payload not found: {payload_path}", file=sys.stderr)
        sys.exit(1)

    payload = json.loads(payload_path.read_text())
    city = payload.get("city", "Bend")
    target_slug = payload.get("target_slug", city.lower())

    print(f"\n[{SKILL}] Synthesia API key verified. Avatar ID: {avatar_id}")
    print(f"  City: {city}")
    print()
    print("  NOTE: The full Synthesia render pipeline + Remotion AvatarMarketComp")
    print("  is scaffolded in video/avatar_market_update/README.md.")
    print("  The Remotion composition will be built as a follow-up task once the")
    print("  first Synthesia render is confirmed working.")
    print()
    print("  To proceed manually:")
    print(f"    1. Call Synthesia API with avatar_id={avatar_id}")
    print(f"    2. Download avatar MP4 to out/avatar_market_update/{target_slug}/avatar_raw.mp4")
    print(f"    3. Run the Remotion AvatarMarketComp wrap (once built)")
    sys.exit(0)


if __name__ == "__main__":
    main()
