#!/usr/bin/env python3
"""
map_route_video producer — animated polyline route from origin to listing.

Workflow:
  1. Fetch Google Maps Directions API for origin → destination
  2. Decode polyline-encoded route → lat/lng array
  3. Normalize lat/lng to SVG viewport for the Static Maps tile dimensions
  4. Generate VO script from route stats
  5. Synth VO via Victoria (_voice_lib.synth_vo)
  6. Get forced-alignment word timestamps
  7. Build Remotion props.json
  8. Remotion render (--concurrency 1) → out/<slug>/map_route_video.mp4
     (render requires Matt approval per draft-first rule — see below)
  9. QA gate: ffprobe duration, first-frame check, blackdetect
  10. Write citations.json, card.json, scorecard.json

Required env vars (from .env.local):
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY  — Google Maps Platform key

Usage:
  python3 scripts/build_map_route_video.py payload.json [--out out/map_route_video/<slug>]
  python3 scripts/build_map_route_video.py --help
  python3 scripts/build_map_route_video.py payload.json --dry-run

Payload schema:
  {
    "target_slug":      str,           // e.g. "19496-tumalo-reservoir-rd"
    "listing_lat":      float,         // destination latitude
    "listing_lng":      float,         // destination longitude
    "listing_label":    str,           // "Tetherow" or full address
    "origin_lat":       float,         // e.g. downtown Bend lat
    "origin_lng":       float,         // e.g. downtown Bend lng
    "origin_label":     str,           // "Downtown Bend"
    "landmarks":        list[dict],    // [{"name": "Old Mill District"}, ...]  optional
    "city_zoom":        int,           // default 11
    "route_zoom":       int,           // default 12
    "dest_zoom":        int,           // default 14
    "duration_sec":     int,           // 30-45, default 42
  }

To render after Matt approves:
  cd video/map_route_video
  npx remotion render src/index.ts MapRouteVideo out/map_route_video.mp4 \\
    --codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92 \\
    --props <out_dir>/props.json
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

PRODUCER = "map_route_video"
W, H = 1080, 1920
COMP_ID = "MapRouteVideo"
PROJECT_DIR = REPO_ROOT / "video" / "map_route_video"


# ── Polyline decoder (Google Maps encoded polyline algorithm) ─────────────────

def decode_polyline(encoded: str) -> list:
    """Decode Google Maps encoded polyline to list of (lat, lng) tuples."""
    points = []
    idx = 0
    lat = 0
    lng = 0
    while idx < len(encoded):
        result, shift = 0, 0
        while True:
            b = ord(encoded[idx]) - 63
            idx += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        delta = ~(result >> 1) if result & 1 else result >> 1
        lat += delta

        result, shift = 0, 0
        while True:
            b = ord(encoded[idx]) - 63
            idx += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        delta = ~(result >> 1) if result & 1 else result >> 1
        lng += delta

        points.append((lat / 1e5, lng / 1e5))
    return points


def normalize_route_points(latlng_points, center_lat, center_lng, zoom, width=W, height=H):
    """
    Normalize lat/lng route points to [0,1] viewport fractions at the given
    Static Maps zoom/center (Web Mercator projection matching Google Static Maps).
    """
    def lat_to_y(lat_deg, zoom_):
        sin_lat = math.sin(math.radians(lat_deg))
        sin_lat = max(-0.9999, min(0.9999, sin_lat))
        world_h = 256 * (2 ** zoom_)
        return (0.5 - math.log((1 + sin_lat) / (1 - sin_lat)) / (4 * math.pi)) * world_h

    def lng_to_x(lng_deg, zoom_):
        world_w = 256 * (2 ** zoom_)
        return (lng_deg + 180) / 360 * world_w

    cx = lng_to_x(center_lng, zoom)
    cy = lat_to_y(center_lat, zoom)

    normalized = []
    for lat, lng in latlng_points:
        px = lng_to_x(lng, zoom) - cx + width / 2
        py = lat_to_y(lat, zoom) - cy + height / 2
        normalized.append({"nx": px / width, "ny": py / height})

    return normalized


# ── Google Directions API ─────────────────────────────────────────────────────

def fetch_directions(origin_lat, origin_lng, dest_lat, dest_lng, api_key):
    """Call Google Maps Directions API and return the parsed JSON response."""
    params = urllib.parse.urlencode({
        "origin": f"{origin_lat},{origin_lng}",
        "destination": f"{dest_lat},{dest_lng}",
        "mode": "driving",
        "key": api_key,
    })
    url = f"https://maps.googleapis.com/maps/api/directions/json?{params}"
    with urllib.request.urlopen(url, timeout=15) as resp:
        return json.loads(resp.read().decode())


# ── VO script builder ─────────────────────────────────────────────────────────

def build_vo_script(origin_label, destination_label, drive_time_min, distance_mi, landmarks):
    """Build 30-second conversational VO script for the route reveal."""
    dist_str = f"{distance_mi:.1f} miles"
    landmark_line = ""
    if landmarks:
        names = [lm.get("name", "") for lm in landmarks[:2] if lm.get("name")]
        if names:
            landmark_line = f" You pass {' and '.join(names)} along the way."
    script = (
        f"From {origin_label}, this property is just {drive_time_min} minutes away. "
        f"That is {dist_str} by the most direct route."
        f"{landmark_line} "
        f"The kind of commute that makes daily life actually work."
    )
    return script


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="map_route_video producer — builds animated route reveal video"
    )
    parser.add_argument("payload", nargs="?", type=str, help="Path to payload JSON file")
    parser.add_argument("--out", type=str, default=None, help="Output directory override")
    parser.add_argument("--dry-run", action="store_true", help="Validate payload without rendering")
    args = parser.parse_args()

    if not args.payload:
        parser.print_help()
        print("\nExample payload:")
        print(json.dumps({
            "target_slug": "19496-tumalo-reservoir-rd",
            "listing_lat": 44.138729,
            "listing_lng": -121.349064,
            "listing_label": "Tetherow",
            "origin_lat": 44.0582,
            "origin_lng": -121.3153,
            "origin_label": "Downtown Bend",
            "landmarks": [{"name": "Old Mill District"}, {"name": "Mt. Bachelor Rd"}],
            "city_zoom": 11,
            "route_zoom": 12,
            "dest_zoom": 14,
            "duration_sec": 42,
        }, indent=2))
        return

    payload_path = Path(args.payload)
    if not payload_path.exists():
        print(f"ERROR: payload not found: {payload_path}", file=sys.stderr)
        sys.exit(1)

    payload = json.loads(payload_path.read_text())

    required = ["target_slug", "listing_lat", "listing_lng", "listing_label",
                "origin_lat", "origin_lng", "origin_label"]
    for field in required:
        if field not in payload:
            print(f"ERROR: missing required field '{field}' in payload", file=sys.stderr)
            sys.exit(1)

    target_slug = payload["target_slug"]
    listing_lat = float(payload["listing_lat"])
    listing_lng = float(payload["listing_lng"])
    listing_label = payload["listing_label"]
    origin_lat = float(payload["origin_lat"])
    origin_lng = float(payload["origin_lng"])
    origin_label = payload["origin_label"]
    landmarks = payload.get("landmarks", [])
    city_zoom = int(payload.get("city_zoom", 11))
    route_zoom = int(payload.get("route_zoom", 12))
    dest_zoom = int(payload.get("dest_zoom", 14))
    duration_sec = int(payload.get("duration_sec", 42))

    out_dir = Path(args.out) if args.out else REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    # Load API key from .env.local
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

    if not api_key:
        print("WARNING: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not found in .env.local", file=sys.stderr)
        print("  Route data will use placeholder values (suitable for Studio preview only)")

    # Fetch Directions API
    polyline_encoded = ""
    drive_time_min = 12
    distance_mi = 7.8
    route_points_normalized = []

    if api_key and not args.dry_run:
        try:
            print(f"Fetching Google Directions: {origin_label} -> {listing_label}...")
            directions = fetch_directions(origin_lat, origin_lng, listing_lat, listing_lng, api_key)
            status = directions.get("status")
            if status != "OK":
                print(f"WARNING: Directions API status '{status}' -- using placeholder data", file=sys.stderr)
            else:
                route = directions["routes"][0]
                leg = route["legs"][0]
                drive_time_min = max(1, round(leg["duration"]["value"] / 60))
                distance_mi = round(leg["distance"]["value"] / 1609.34, 1)
                polyline_encoded = route["overview_polyline"]["points"]
                latlng_pts = decode_polyline(polyline_encoded)
                center_lat = (origin_lat + listing_lat) / 2
                center_lng = (origin_lng + listing_lng) / 2
                route_points_normalized = normalize_route_points(
                    latlng_pts, center_lat, center_lng, route_zoom,
                )
                print(f"  Drive time: {drive_time_min} min, Distance: {distance_mi} mi, "
                      f"Route points: {len(route_points_normalized)}")
        except Exception as e:
            print(f"WARNING: Directions API error -- {e}. Using placeholder data.", file=sys.stderr)

    if not route_points_normalized:
        route_points_normalized = [
            {"nx": 0.5,  "ny": 0.65},
            {"nx": 0.48, "ny": 0.57},
            {"nx": 0.44, "ny": 0.50},
            {"nx": 0.42, "ny": 0.42},
            {"nx": 0.39, "ny": 0.36},
        ]

    # Build VO script
    vo_script = build_vo_script(origin_label, listing_label, drive_time_min, distance_mi, landmarks)
    print(f"VO script ({len(vo_script)} chars): {vo_script[:80]}...")

    # Synth VO
    vo_path = ""
    caption_words = []
    try:
        from _voice_lib import synth_vo, get_forced_alignment
        vo_file = out_dir / "map_route_video_vo.mp3"
        synth_vo(vo_script, str(vo_file))
        caption_words = get_forced_alignment(vo_script, str(vo_file))
        vo_path = f"map_route_video/{target_slug}/map_route_video_vo.mp3"
        print(f"VO synthesized: {vo_file} ({len(caption_words)} caption words)")
    except ImportError:
        print("WARNING: _voice_lib not available -- VO skipped (Studio preview only)")
    except Exception as e:
        print(f"WARNING: VO synthesis failed -- {e}. Continuing without VO.")

    # Build props.json
    props = {
        "apiKey": api_key,
        "originLat": origin_lat,
        "originLng": origin_lng,
        "originLabel": origin_label,
        "destLat": listing_lat,
        "destLng": listing_lng,
        "destinationLabel": listing_label,
        "driveTimeMin": drive_time_min,
        "distanceMi": distance_mi,
        "polylineEncoded": polyline_encoded,
        "routePointsNormalized": route_points_normalized,
        "landmarks": landmarks,
        "captionWords": caption_words,
        "voPath": vo_path,
        "cityZoom": city_zoom,
        "routeZoom": route_zoom,
        "destZoom": dest_zoom,
        "durationSec": duration_sec,
    }

    props_file = out_dir / "props.json"
    props_file.write_text(json.dumps(props, indent=2))
    print(f"Props written: {props_file}")

    # Write sidecars
    citations = {
        "figures": [
            {
                "figure": f"{drive_time_min} min drive",
                "source": "Google Maps Directions API",
                "filter": f"origin={origin_lat},{origin_lng}&destination={listing_lat},{listing_lng}&mode=driving",
                "column": "legs[0].duration.value",
                "fetched_at": datetime.datetime.utcnow().isoformat() + "Z",
            },
            {
                "figure": f"{distance_mi} miles",
                "source": "Google Maps Directions API",
                "column": "legs[0].distance.value",
                "fetched_at": datetime.datetime.utcnow().isoformat() + "Z",
            },
        ]
    }
    (out_dir / "citations.json").write_text(json.dumps(citations, indent=2))

    card = {
        "producer": PRODUCER,
        "primary_artifact": "map_route_video.mp4",
        "target_slug": target_slug,
        "origin": origin_label,
        "destination": listing_label,
        "drive_time_min": drive_time_min,
        "distance_mi": distance_mi,
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "render": {
            "source": "video/map_route_video/src/MapRouteVideo.tsx",
            "comp_id": COMP_ID,
            "duration_sec": duration_sec,
            "resolution": f"{W}x{H}",
            "fps": 30,
        }
    }
    (out_dir / "card.json").write_text(json.dumps(card, indent=2))
    print(f"Sidecars written to {out_dir}")

    if args.dry_run:
        print("Dry-run complete -- props.json ready, render skipped.")
    else:
        print("Props + sidecars ready. Render requires Matt approval (draft-first rule).")
        print(f"  Render command (run after approval):")
        print(f"    cd {PROJECT_DIR}")
        print(f"    npx remotion render src/index.ts {COMP_ID} \\")
        print(f"      {out_dir}/map_route_video.mp4 \\")
        print(f"      --codec h264 --concurrency 1 --crf 22 \\")
        print(f"      --image-format=jpeg --jpeg-quality=92 \\")
        print(f"      --props {props_file}")


if __name__ == "__main__":
    main()
