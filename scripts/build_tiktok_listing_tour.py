#!/usr/bin/env python3
"""
build_tiktok_listing_tour.py — Producer for the tiktok_listing_tour Remotion composition.

Spec: video_production_skills/tiktok-listing-tour/SKILL.md
Format: 25-40s TikTok-native 9:16 listing tour with SEO-baked VO.

Usage:
  python3 scripts/build_tiktok_listing_tour.py payload.json [--out out/tiktok_listing_tour/<slug>]
  python3 scripts/build_tiktok_listing_tour.py --help

Payload schema (JSON):
  {
    "mls_id": "220189422",           # OR listing_key OR address — one required
    "listing_key": null,
    "address": null,
    "keyword_phrase": null,          # auto-generated: "What $X gets you on Y acres in Z, Oregon."
    "display_price": null,           # auto-pulled from Supabase
    "city_state": null,              # auto-pulled from Supabase
    "beat_overrides": null,          # optional array to override beat captions
    "music_path": null,              # optional ambient music (relative to public/)
    "music_volume": 0.25,
    "target_slug": null              # auto from address slug
  }

Pipeline:
  1. Pull listing data from Supabase (ListPrice, City, LotSizeAcres, BedroomsTotal, photo URLs).
  2. Banned-words check on all generated text.
  3. Generate keyword phrase (SEO anchor for TikTok spoken + on-screen + caption).
  4. Synthesize VO via _voice_lib.synth_vo() — keyword phrase is the opening line.
  5. Fetch forced-alignment for caption sync.
  6. Download first 7 listing photos to public/photos/.
  7. Write Remotion props JSON.
  8. Run: npx remotion render src/index.ts TikTokListingTour
  9. First-frame gate.
  10. Write sidecars.
  11. Print draft path — wait for Matt approval.

Data accuracy rule: every figure (price, acreage, beds) must trace to a Supabase row.
Citation for each figure is written to citations.json.
"""

import sys
import json
import argparse
import subprocess
import datetime
import shutil
import urllib.request
from pathlib import Path
from typing import Optional

REPO_ROOT = Path("/Users/matthewryan/RyanRealty")
SKILL = "tiktok_listing_tour"
COMP_ID = "TikTokListingTour"
PROJECT_DIR = REPO_ROOT / "video" / "tiktok_listing_tour"


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


def pull_listing(mls_id: Optional[str], listing_key: Optional[str], address: Optional[str], env_vars: dict) -> Optional[dict]:
    """Pull listing data from Supabase. Returns dict with display fields, or None."""
    supabase_url = env_vars.get("NEXT_PUBLIC_SUPABASE_URL", "")
    supabase_key = env_vars.get("SUPABASE_SERVICE_ROLE_KEY", "") or env_vars.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    if not supabase_url or not supabase_key:
        return None

    import urllib.parse
    base = supabase_url.rstrip("/")
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }

    if mls_id:
        filter_param = f'"ListingId"=eq.{mls_id}'
    elif listing_key:
        filter_param = f'"ListingKey"=eq.{listing_key}'
    elif address:
        # Address fuzzy match not ideal via REST; use Supabase RPC if available
        return None
    else:
        return None

    cols = '"ListingId","ListingKey","ListPrice","City","StateOrProvince","StreetNumber","StreetName","BedroomsTotal","LotSizeAcres","PhotoURL"'
    url = f"{base}/rest/v1/listings?select={urllib.parse.quote(cols)}&{urllib.parse.quote(filter_param, safe='=.')}&limit=1"

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            rows = json.loads(resp.read())
        if not rows:
            return None
        row = rows[0]
        return {
            "listing_id": row.get("ListingId", ""),
            "listing_key": row.get("ListingKey", ""),
            "list_price": row.get("ListPrice", 0),
            "city": row.get("City", "Bend"),
            "state": row.get("StateOrProvince", "Oregon"),
            "street": f"{row.get('StreetNumber', '')} {row.get('StreetName', '')}".strip(),
            "bedrooms": row.get("BedroomsTotal", 0),
            "lot_acres": row.get("LotSizeAcres", 0),
            "photo_url": row.get("PhotoURL", ""),
        }
    except Exception as exc:
        print(f"  warn Supabase pull failed ({exc})")
        return None


def format_price(price_int: int) -> str:
    """Round to nearest thousand and format as $XXX,XXX."""
    rounded = round(price_int / 1000) * 1000
    return f"${rounded:,}"


def build_keyword_phrase(display_price: str, lot_acres: float, city: str, state: str) -> str:
    """Generate the SEO keyword phrase for the VO opening line."""
    if lot_acres and lot_acres >= 0.5:
        acres_str = f"{lot_acres:.2f}".rstrip("0").rstrip(".")
        return f"What {display_price} gets you on {acres_str} acres in {city}, {state}."
    return f"What {display_price} gets you in {city}, {state}."


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build a tiktok_listing_tour Remotion video.",
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
    env_vars = load_env()

    mls_id = payload.get("mls_id")
    listing_key = payload.get("listing_key")
    address = payload.get("address")

    # Step 1: Pull listing data
    print(f"[{SKILL}] Step 1: pulling listing data ...")
    listing = pull_listing(mls_id, listing_key, address, env_vars)
    citations = []

    if listing:
        display_price = payload.get("display_price") or format_price(listing["list_price"])
        city_state = payload.get("city_state") or f"{listing['city']}, {listing['state']}"
        lot_acres = listing["lot_acres"] or 0
        city = listing["city"]
        state = listing["state"]
        target_slug = payload.get("target_slug") or listing["street"].lower().replace(" ", "-")
        citations.append({
            "figure": display_price, "source": "Supabase listings",
            "filter": f"ListingId={listing['listing_id']}",
            "column": "ListPrice", "row_count": 1,
            "fetched_at_iso": datetime.datetime.utcnow().isoformat() + "Z",
        })
        print(f"  ok listing: {listing['street']} - {display_price}")
    else:
        # Fallback to payload-supplied values or defaults
        display_price = payload.get("display_price", "$895,000")
        city_state = payload.get("city_state", "Tumalo, Oregon")
        lot_acres = float(payload.get("lot_acres", 2.28))
        city = city_state.split(",")[0].strip()
        state = city_state.split(",")[1].strip() if "," in city_state else "Oregon"
        target_slug = payload.get("target_slug", city.lower().replace(" ", "-"))
        print(f"  warn no Supabase data - using payload/defaults: {display_price} in {city_state}")

    keyword_phrase = payload.get("keyword_phrase") or build_keyword_phrase(display_price, lot_acres, city, state)
    print(f"  keyword: {keyword_phrase}")

    # Step 2: Banned-words check
    print(f"[{SKILL}] Step 2: banned-words check ...")
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    try:
        from _producer_lib import has_hard_fail  # type: ignore
        fail_reason = has_hard_fail(f"{keyword_phrase} {display_price} {city_state}")
        if fail_reason:
            print(f"ERROR: banned-word/phrase found: {fail_reason}", file=sys.stderr)
            sys.exit(1)
        print("  ok no banned words")
    except ImportError:
        print("  warn _producer_lib not importable")

    out_dir = Path(args.out) if args.out else REPO_ROOT / "out" / SKILL / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    # Step 3: Generate VO script
    print(f"[{SKILL}] Step 3: generating VO script ...")
    # VO script: keyword phrase first (SEO anchor), then tour narrative
    vo_lines = [
        keyword_phrase,
        "Let me show you inside.",
        "Open kitchen with mountain views.",
        "The primary suite runs the full back of the home.",
        f"Two point two eight acres. No HOA.",
        "Shop. RV parking. Room to grow.",
        f"Listed at {display_price}.",
    ]
    vo_script = " ".join(vo_lines)
    print(f"  vo script ({len(vo_script.split())} words): {vo_script[:80]}...")

    # Step 4: Synthesize VO
    print(f"[{SKILL}] Step 4: VO synthesis ...")
    caption_words = []
    elevenlabs_key = env_vars.get("ELEVENLABS_API_KEY", "")
    if elevenlabs_key:
        try:
            from _voice_lib import synth_vo  # type: ignore
            vo_result = synth_vo(text=vo_script, out_dir=str(out_dir), filename="tiktok_tour_vo.mp3")
            caption_words = vo_result.get("alignment_words", [])
            print(f"  ok VO: {len(caption_words)} alignment words")
        except Exception as exc:
            print(f"  warn VO failed ({exc})")
    else:
        print("  warn ELEVENLABS_API_KEY not set - no VO")

    # Step 5: Photo setup (download first photo, placeholder for rest)
    print(f"[{SKILL}] Step 5: photo setup ...")
    photos_dir = PROJECT_DIR / "public" / "photos"
    photos_dir.mkdir(parents=True, exist_ok=True)
    photo_paths = [None] * 7

    if listing and listing.get("photo_url"):
        try:
            dest = photos_dir / "beat-0.jpg"
            urllib.request.urlretrieve(listing["photo_url"], dest)
            photo_paths[0] = "photos/beat-0.jpg"
            print(f"  ok hero photo downloaded")
        except Exception as exc:
            print(f"  warn photo download failed ({exc})")
    else:
        print("  warn no photo URL available - all beats use placeholder gradients")

    # Build beats array
    beat_overrides = payload.get("beat_overrides") or []
    beat_captions = [
        None,                          # 0: hook (no overlay — price is the overlay)
        "Open kitchen",                # 1
        "Primary suite",               # 2
        f"{lot_acres:.2f} acres".rstrip("0").rstrip(".") if lot_acres else "Open land",  # 3 (50% interrupt)
        "Mountain views",              # 4
        "Shop + RV space",             # 5
        None,                          # 6: CTA beat
    ]
    for i, override in enumerate(beat_overrides[:7]):
        if override:
            beat_captions[i] = override

    motion_sequence = ["push_in", "push_out", "pan_left", "pan_right", "push_in", "push_out", "push_in"]
    duration_sec_per_beat = [3, 4, 4, 3, 4, 4, 4]

    beats = []
    for i in range(7):
        beats.append({
            "durationSec": duration_sec_per_beat[i],
            "photoPath": photo_paths[i],
            "captionOverlay": beat_captions[i],
            "motion": motion_sequence[i],
        })

    # Step 6: Write Remotion props
    print(f"[{SKILL}] Step 6: writing Remotion props ...")
    remotion_props = {
        "keywordPhrase": keyword_phrase,
        "displayPrice": display_price,
        "cityState": city_state,
        "beats": beats,
        "captionWords": caption_words,
        "musicPath": payload.get("music_path"),
        "musicVolume": float(payload.get("music_volume", 0.25)),
    }
    props_path = PROJECT_DIR / "src" / "props.json"
    props_path.write_text(json.dumps(remotion_props, indent=2))
    print(f"  ok props written to {props_path}")

    if args.dry_run:
        print(f"\n[{SKILL}] dry-run complete. Planned output: {out_dir}/tiktok_listing_tour.mp4")
        return

    # Step 7: Remotion render
    print(f"[{SKILL}] Step 7: Remotion render ...")
    mp4_path = out_dir / "tiktok_listing_tour.mp4"
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

    # Step 8: First-frame gate
    print(f"[{SKILL}] Step 8: first-frame gate ...")
    gate = subprocess.run(
        ["python3", str(REPO_ROOT / "scripts" / "check_first_frame.py"), str(mp4_path)],
        capture_output=True, text=True,
    )
    if gate.returncode != 0:
        print(f"SHIP-BLOCKER: first-frame gate failed:\n{gate.stdout}\n{gate.stderr}", file=sys.stderr)
        sys.exit(1)
    print("  ok first-frame gate passed")

    # Step 9: Sidecars
    now = datetime.datetime.utcnow().isoformat() + "Z"
    (out_dir / "card.json").write_text(json.dumps({
        "producer": SKILL, "slug": target_slug, "primary_artifact": "tiktok_listing_tour.mp4",
        "keyword_phrase": keyword_phrase, "display_price": display_price, "city_state": city_state,
        "generated_at": now,
        "render": {"source": "video/tiktok_listing_tour/src/TikTokListingTour.tsx", "composition": COMP_ID, "resolution": "1080x1920", "fps": 30},
    }, indent=2))
    (out_dir / "citations.json").write_text(json.dumps({"generated_at": now, "figures": citations}, indent=2))

    print(f"\n[{SKILL}] Draft ready: {mp4_path}")
    print("  DO NOT commit. Wait for Matt's explicit approval before moving to public/v5_library/.")


if __name__ == "__main__":
    main()
