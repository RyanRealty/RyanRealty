#!/usr/bin/env python3
"""
walkability_overlay producer — animated isochrone rings + amenity markers.

Walks-speed isochrone rings (5/10/15 min at 3 mph):
  5-min  = 0.25 mile radius
  10-min = 0.50 mile radius
  15-min = 0.75 mile radius

Workflow:
  1. Fetch nearby amenities via Google Places API (parks, restaurants, schools,
     grocery stores) within 15-min walk radius (~0.75mi = ~1.2km)
  2. Compute ring radii in pixels for the map viewport at mapZoom
  3. Normalize amenity lat/lng to 0-1 viewport coords
  4. Determine headline (closest coffee/restaurant walk time)
  5. Synth VO via Victoria
  6. Build Remotion props.json
  7. Render (after Matt approval)

Usage:
  python3 scripts/build_walkability_overlay.py payload.json [--out DIR] [--dry-run]
  python3 scripts/build_walkability_overlay.py --help

Payload schema:
  {
    "target_slug":      str,
    "listing_lat":      float,
    "listing_lng":      float,
    "map_zoom":         int,    // default 15
    "duration_sec":     int,    // default 46
    "headline_amenity": str,    // default "coffee" — overrides auto-detected
  }

To render after Matt approval:
  cd video/walkability_overlay
  npx remotion render src/index.ts WalkabilityOverlay out/walkability_overlay.mp4 \\
    --codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92 \\
    --props ../../out/walkability_overlay/<slug>/props.json
"""

import sys
import os
import json
import argparse
import math
import datetime
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path("/Users/matthewryan/RyanRealty")
sys.path.insert(0, str(REPO_ROOT / "scripts"))

PRODUCER = "walkability_overlay"
W, H = 1080, 1920
COMP_ID = "WalkabilityOverlay"
PROJECT_DIR = REPO_ROOT / "video" / "walkability_overlay"

# Walking speed: 3 mph = 4.83 km/h = 80.5 meters/min
WALK_SPEED_M_PER_MIN = 80.5
RING_MINUTES = [5, 10, 15]
RING_RADIUS_M = {m: WALK_SPEED_M_PER_MIN * m for m in RING_MINUTES}

# Place types to fetch
PLACE_TYPES = ['cafe', 'restaurant', 'park', 'school', 'grocery_or_supermarket']
TYPE_MAP = {
    'cafe': 'cafe', 'coffee_shop': 'cafe',
    'restaurant': 'restaurant',
    'park': 'park',
    'school': 'school',
    'grocery_or_supermarket': 'grocery',
    'supermarket': 'grocery',
}


# ── Map projection helpers ────────────────────────────────────────────────────

def lat_to_y_world(lat_deg, zoom):
    sin_lat = math.sin(math.radians(lat_deg))
    sin_lat = max(-0.9999, min(0.9999, sin_lat))
    return (0.5 - math.log((1 + sin_lat) / (1 - sin_lat)) / (4 * math.pi)) * 256 * (2 ** zoom)


def lng_to_x_world(lng_deg, zoom):
    return (lng_deg + 180) / 360 * 256 * (2 ** zoom)


def meters_to_pixels(meters, lat_deg, zoom):
    """Convert distance in meters to pixels at the given lat/zoom."""
    # 1 degree lat ≈ 111,320 meters at equator × cos(lat)
    lat_rad = math.radians(lat_deg)
    meters_per_deg_lat = 111320.0
    world_h = 256 * (2 ** zoom)
    px_per_meter = (world_h / 360) / (meters_per_deg_lat / 111320.0) * math.cos(lat_rad)
    return meters * px_per_meter


def latlng_to_normalized(lat, lng, center_lat, center_lng, zoom, width=W, height=H):
    cx = lng_to_x_world(center_lng, zoom)
    cy = lat_to_y_world(center_lat, zoom)
    px = lng_to_x_world(lng, zoom) - cx + width / 2
    py = lat_to_y_world(lat, zoom) - cy + height / 2
    return px / width, py / height


# ── Google Places API ─────────────────────────────────────────────────────────

def fetch_places(lat, lng, api_key, radius_m, place_type):
    params = urllib.parse.urlencode({
        "location": f"{lat},{lng}",
        "radius": int(radius_m),
        "type": place_type,
        "key": api_key,
    })
    url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?{params}"
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            return json.loads(resp.read().decode()).get("results", [])
    except Exception as e:
        print(f"WARNING: Places API error ({place_type}): {e}", file=sys.stderr)
        return []


# ── Walk minutes estimator ────────────────────────────────────────────────────

def walk_minutes(amenity_lat, amenity_lng, origin_lat, origin_lng):
    """Haversine distance → walking minutes at 3 mph."""
    R = 6371000  # Earth radius in meters
    dlat = math.radians(amenity_lat - origin_lat)
    dlng = math.radians(amenity_lng - origin_lng)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(origin_lat)) * math.cos(math.radians(amenity_lat)) * math.sin(dlng/2)**2
    dist_m = 2 * R * math.asin(math.sqrt(a))
    return dist_m / WALK_SPEED_M_PER_MIN


# ── VO script ─────────────────────────────────────────────────────────────────

def build_vo_script(headline_min, headline_amenity, ring_counts):
    five_str = f"{ring_counts[5]} place{'s' if ring_counts[5] != 1 else ''}" if ring_counts[5] else "a few spots"
    ten_str = f"{ring_counts[10]}" if ring_counts[10] else "several"
    fifteen_str = f"{ring_counts[15]}" if ring_counts[15] else "many"
    return (
        f"{headline_amenity.capitalize()} is {headline_min} minutes away on foot. "
        f"Within a 5-minute walk, there are {five_str}. "
        f"Extend that to 10 minutes and you reach {ten_str} destinations. "
        f"At 15 minutes, {fifteen_str} places in total. "
        f"This is a property where daily errands happen on foot."
    )


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="walkability_overlay producer")
    parser.add_argument("payload", nargs="?", type=str)
    parser.add_argument("--out", type=str, default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.payload:
        parser.print_help()
        print("\nExample payload:")
        print(json.dumps({
            "target_slug": "downtown-bend-example",
            "listing_lat": 44.0582,
            "listing_lng": -121.3153,
            "map_zoom": 15,
            "duration_sec": 46,
            "headline_amenity": "coffee",
        }, indent=2))
        return

    payload_path = Path(args.payload)
    if not payload_path.exists():
        print(f"ERROR: payload not found: {payload_path}", file=sys.stderr)
        sys.exit(1)

    payload = json.loads(payload_path.read_text())
    required = ["target_slug", "listing_lat", "listing_lng"]
    for field in required:
        if field not in payload:
            print(f"ERROR: missing required field '{field}'", file=sys.stderr)
            sys.exit(1)

    target_slug = payload["target_slug"]
    listing_lat = float(payload["listing_lat"])
    listing_lng = float(payload["listing_lng"])
    map_zoom = int(payload.get("map_zoom", 15))
    duration_sec = int(payload.get("duration_sec", 46))
    headline_amenity_override = payload.get("headline_amenity", "")

    out_dir = Path(args.out) if args.out else REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    # Load API key
    env_local = REPO_ROOT / ".env.local"
    api_key = ""
    if env_local.exists():
        for line in env_local.read_text().split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            eq = line.find("=")
            if eq < 1:
                continue
            k, v = line[:eq].strip(), line[eq + 1:].strip()
            v = v.strip("\"'")
            if k == "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY":
                api_key = v
                break

    # Compute ring radii in pixels
    ring_radii_px = {
        m: meters_to_pixels(RING_RADIUS_M[m], listing_lat, map_zoom)
        for m in RING_MINUTES
    }
    print(f"Ring radii at z{map_zoom}: " + ", ".join(f"{m}min={r:.0f}px" for m, r in ring_radii_px.items()))

    # Fetch amenities
    all_amenities = []
    if api_key and not args.dry_run:
        max_radius_m = RING_RADIUS_M[15] * 1.1  # slight buffer
        seen_names = set()
        for ptype in PLACE_TYPES:
            results = fetch_places(listing_lat, listing_lng, api_key, max_radius_m, ptype)
            for r in results[:4]:
                name = r.get("name", "")
                if name in seen_names:
                    continue
                seen_names.add(name)
                place_lat = r["geometry"]["location"]["lat"]
                place_lng = r["geometry"]["location"]["lng"]
                wmin = walk_minutes(place_lat, place_lng, listing_lat, listing_lng)
                if wmin > 15.5:
                    continue
                ring_bucket = 5 if wmin <= 5 else 10 if wmin <= 10 else 15
                nx, ny = latlng_to_normalized(place_lat, place_lng, listing_lat, listing_lng, map_zoom)
                mapped_type = TYPE_MAP.get(ptype, "other")
                all_amenities.append({
                    "name": name,
                    "type": mapped_type,
                    "lat": place_lat,
                    "lng": place_lng,
                    "walkMinutes": ring_bucket,
                    "nx": nx,
                    "ny": ny,
                })

    if not all_amenities:
        # Placeholder for dry-run / no API key
        all_amenities = [
            {"name": "Thump Coffee",    "type": "cafe",      "lat": listing_lat+0.003, "lng": listing_lng-0.005, "walkMinutes": 5,  "nx": 0.44, "ny": 0.46},
            {"name": "Drake Park",      "type": "park",      "lat": listing_lat+0.002, "lng": listing_lng-0.006, "walkMinutes": 5,  "nx": 0.40, "ny": 0.49},
            {"name": "Newport Ave Mkt", "type": "grocery",   "lat": listing_lat+0.005, "lng": listing_lng+0.003, "walkMinutes": 8,  "nx": 0.58, "ny": 0.43},
            {"name": "Old Mill Dist.",  "type": "restaurant","lat": listing_lat-0.003, "lng": listing_lng-0.010, "walkMinutes": 12, "nx": 0.33, "ny": 0.56},
            {"name": "Pine Ridge Elem", "type": "school",    "lat": listing_lat+0.010, "lng": listing_lng+0.005, "walkMinutes": 14, "nx": 0.61, "ny": 0.37},
        ]
        print("WARNING: using placeholder amenities (no API key or dry-run)", file=sys.stderr)

    # Ring counts
    ring_counts = {m: sum(1 for a in all_amenities if a["walkMinutes"] <= m) for m in RING_MINUTES}

    # Headline
    headline_amenity = headline_amenity_override
    headline_min = 5
    if not headline_amenity:
        cafes = [a for a in all_amenities if a["type"] == "cafe"]
        if cafes:
            headline_amenity = "coffee"
            headline_min = min(a["walkMinutes"] for a in cafes)
        else:
            restaurants = [a for a in all_amenities if a["type"] == "restaurant"]
            if restaurants:
                headline_amenity = "dining"
                headline_min = min(a["walkMinutes"] for a in restaurants)
            else:
                headline_amenity = "the park"
                parks = [a for a in all_amenities if a["type"] == "park"]
                headline_min = min((a["walkMinutes"] for a in parks), default=10)

    # VO
    vo_script = build_vo_script(headline_min, headline_amenity, ring_counts)
    vo_path = ""
    caption_words = []
    try:
        from _voice_lib import synth_vo, get_forced_alignment
        vo_file = out_dir / "walkability_vo.mp3"
        synth_vo(vo_script, str(vo_file))
        caption_words = get_forced_alignment(vo_script, str(vo_file))
        vo_path = f"walkability_overlay/{target_slug}/walkability_vo.mp3"
        print(f"VO synthesized ({len(caption_words)} words)")
    except ImportError:
        print("WARNING: _voice_lib not available -- VO skipped")
    except Exception as e:
        print(f"WARNING: VO synthesis failed -- {e}")

    # Props
    props = {
        "apiKey": api_key,
        "centerLat": listing_lat,
        "centerLng": listing_lng,
        "mapZoom": map_zoom,
        "headlineMinutes": headline_min,
        "headlineAmenity": headline_amenity,
        "ring5MinRadiusPx": ring_radii_px[5],
        "ring10MinRadiusPx": ring_radii_px[10],
        "ring15MinRadiusPx": ring_radii_px[15],
        "subjectNx": 0.5,
        "subjectNy": 0.5,
        "amenities": all_amenities,
        "captionWords": caption_words,
        "voPath": vo_path,
        "durationSec": duration_sec,
    }

    props_file = out_dir / "props.json"
    props_file.write_text(json.dumps(props, indent=2))
    print(f"Props written: {props_file}")

    citations = {
        "figures": [
            {
                "figure": f"{a['walkMinutes']}-min walk to {a['name']}",
                "source": "Google Places API (nearbysearch)" if api_key else "Placeholder",
                "note": f"Distance computed via haversine at {WALK_SPEED_M_PER_MIN:.1f} m/min (3 mph)",
                "fetched_at": datetime.datetime.utcnow().isoformat() + "Z",
            }
            for a in all_amenities[:6]
        ] + [
            {
                "figure": f"Walk-time isochrone rings (5/10/15 min)",
                "source": "Computed: 3 mph walking speed, haversine distance",
                "methodology": f"0.25mi/0.50mi/0.75mi approximate circles",
            }
        ]
    }
    (out_dir / "citations.json").write_text(json.dumps(citations, indent=2))

    card = {
        "producer": PRODUCER,
        "primary_artifact": "walkability_overlay.mp4",
        "target_slug": target_slug,
        "headline": f"{headline_min} min walk to {headline_amenity}",
        "ring_counts": ring_counts,
        "amenity_count": len(all_amenities),
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "render": {
            "source": "video/walkability_overlay/src/WalkabilityOverlay.tsx",
            "comp_id": COMP_ID,
            "duration_sec": duration_sec,
            "resolution": f"{W}x{H}",
            "fps": 30,
        }
    }
    (out_dir / "card.json").write_text(json.dumps(card, indent=2))
    print(f"Sidecars written to {out_dir}")
    print("\nReady. Render requires Matt approval (draft-first rule).")
    print(f"  cd {PROJECT_DIR}")
    print(f"  npx remotion render src/index.ts {COMP_ID} \\")
    print(f"    {out_dir}/walkability_overlay.mp4 \\")
    print(f"    --codec h264 --concurrency 1 --crf 22 \\")
    print(f"    --image-format=jpeg --jpeg-quality=92 \\")
    print(f"    --props {props_file}")


if __name__ == "__main__":
    main()
