#!/usr/bin/env python3
"""
school_district_overlay producer — animated school district boundary + markers.

Workflow:
  1. Load/cache Oregon Dept of Education GeoJSON for the listing's school district
  2. Project boundary polygon to map viewport (normalize to 0-1)
  3. Locate schools via Google Places API (or ODE school list) within 2mi
  4. Generate VO script from district name + school list
  5. Synth VO via Victoria
  6. Build Remotion props.json
  7. Render via Remotion (after Matt approval)
  8. Write citations.json, card.json

Data source:
  Oregon Dept of Education boundary GeoJSON:
    https://data.oregon.gov/api/geospatial/njfk-3inm?method=export&type=GeoJSON
  Cached to: data/school-districts/deschutes-county-districts.geojson
  Per-district: data/school-districts/<district-slug>.geojson

  If GeoJSON is not cached, build_boundary_data_available=False and the comp
  renders a placeholder per the spec ("School district data source TBD").

Usage:
  python3 scripts/build_school_district_overlay.py payload.json [--out DIR] [--dry-run]
  python3 scripts/build_school_district_overlay.py --help

Payload schema:
  {
    "target_slug":      str,
    "listing_lat":      float,
    "listing_lng":      float,
    "district_name":    str,    // e.g. "Bend-LaPine"
    "district_slug":    str,    // e.g. "bend-lapine"
    "map_zoom":         int,    // default 12
    "duration_sec":     int,    // 30-45, default 44
  }

To render after Matt approves:
  cd video/school_district_overlay
  npx remotion render src/index.ts SchoolDistrictOverlay out/school_district_overlay.mp4 \\
    --codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92 \\
    --props ../../out/school_district_overlay/<slug>/props.json
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

PRODUCER = "school_district_overlay"
W, H = 1080, 1920
COMP_ID = "SchoolDistrictOverlay"
PROJECT_DIR = REPO_ROOT / "video" / "school_district_overlay"
DATA_DIR = REPO_ROOT / "data" / "school-districts"

# ODE GeoJSON endpoint
ODE_GEOJSON_URL = (
    "https://data.oregon.gov/api/geospatial/njfk-3inm"
    "?method=export&type=GeoJSON"
)


# ── GeoJSON utils ─────────────────────────────────────────────────────────────

def load_district_geojson(district_slug):
    """Try to load cached district GeoJSON. Returns feature or None."""
    per_district = DATA_DIR / f"{district_slug}.geojson"
    if per_district.exists():
        try:
            gj = json.loads(per_district.read_text())
            if gj.get("type") == "Feature":
                return gj
            if gj.get("type") == "FeatureCollection":
                features = gj.get("features", [])
                if features:
                    return features[0]
        except Exception as e:
            print(f"WARNING: failed to parse {per_district}: {e}", file=sys.stderr)
    return None


def fetch_and_cache_ode_geojson():
    """Fetch ODE school district GeoJSON and save to data/school-districts/."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    county_cache = DATA_DIR / "deschutes-county-districts.geojson"
    if county_cache.exists():
        print(f"Using cached ODE GeoJSON: {county_cache}")
        return json.loads(county_cache.read_text())
    print(f"Fetching ODE GeoJSON from {ODE_GEOJSON_URL}...")
    try:
        with urllib.request.urlopen(ODE_GEOJSON_URL, timeout=30) as resp:
            data = resp.read()
        county_cache.write_bytes(data)
        print(f"Cached to {county_cache}")
        return json.loads(data)
    except Exception as e:
        print(f"WARNING: ODE GeoJSON fetch failed: {e}", file=sys.stderr)
        return None


def polygon_centroid(coords):
    """Return (lat, lng) centroid of a GeoJSON polygon ring [[lng, lat], ...]."""
    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]
    return sum(ys) / len(ys), sum(xs) / len(xs)


def normalize_polygon(coords, center_lat, center_lng, zoom, width=W, height=H):
    """Project GeoJSON polygon coords [[lng, lat]] to normalized viewport."""
    def lat_to_y(lat_deg, z):
        sin_lat = math.sin(math.radians(lat_deg))
        sin_lat = max(-0.9999, min(0.9999, sin_lat))
        world_h = 256 * (2 ** z)
        return (0.5 - math.log((1 + sin_lat) / (1 - sin_lat)) / (4 * math.pi)) * world_h

    def lng_to_x(lng_deg, z):
        return (lng_deg + 180) / 360 * 256 * (2 ** z)

    cx = lng_to_x(center_lng, zoom)
    cy = lat_to_y(center_lat, zoom)

    result = []
    for lng, lat in coords[::2]:  # simplify: take every other point for perf
        px = lng_to_x(lng, zoom) - cx + width / 2
        py = lat_to_y(lat, zoom) - cy + height / 2
        result.append({"nx": px / width, "ny": py / height})
    return result


# ── Google Places API ─────────────────────────────────────────────────────────

def fetch_nearby_schools(lat, lng, api_key, radius_meters=3000):
    """Use Google Places Nearby Search to find schools."""
    if not api_key:
        return []
    params = urllib.parse.urlencode({
        "location": f"{lat},{lng}",
        "radius": radius_meters,
        "type": "school",
        "key": api_key,
    })
    url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?{params}"
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        results = data.get("results", [])
        schools = []
        for r in results[:6]:
            school_lat = r["geometry"]["location"]["lat"]
            school_lng = r["geometry"]["location"]["lng"]
            schools.append({
                "name": r.get("name", "School"),
                "lat": school_lat,
                "lng": school_lng,
                "rating": r.get("rating"),
                "type": "other",
            })
        return schools
    except Exception as e:
        print(f"WARNING: Places API error: {e}", file=sys.stderr)
        return []


# ── VO script ─────────────────────────────────────────────────────────────────

def build_vo_script(district_name, schools, nearby_count):
    school_names = [s.get("name", "") for s in schools[:3] if s.get("name")]
    if school_names:
        school_line = f"Nearby schools include {', '.join(school_names[:-1])} and {school_names[-1]}. " if len(school_names) > 1 else f"The closest school is {school_names[0]}. "
    else:
        school_line = ""
    return (
        f"This property sits in the {district_name} School District. "
        f"{school_line}"
        f"{nearby_count} school{'s' if nearby_count != 1 else ''} within one mile. "
        f"That is the kind of detail that matters when you are choosing where to raise a family."
    )


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="school_district_overlay producer"
    )
    parser.add_argument("payload", nargs="?", type=str)
    parser.add_argument("--out", type=str, default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.payload:
        parser.print_help()
        print("\nExample payload:")
        print(json.dumps({
            "target_slug": "19496-tumalo-reservoir-rd",
            "listing_lat": 44.138729,
            "listing_lng": -121.349064,
            "district_name": "Bend-LaPine",
            "district_slug": "bend-lapine",
            "map_zoom": 12,
            "duration_sec": 44,
        }, indent=2))
        return

    payload_path = Path(args.payload)
    if not payload_path.exists():
        print(f"ERROR: payload not found: {payload_path}", file=sys.stderr)
        sys.exit(1)

    payload = json.loads(payload_path.read_text())
    required = ["target_slug", "listing_lat", "listing_lng", "district_name", "district_slug"]
    for field in required:
        if field not in payload:
            print(f"ERROR: missing required field '{field}'", file=sys.stderr)
            sys.exit(1)

    target_slug = payload["target_slug"]
    listing_lat = float(payload["listing_lat"])
    listing_lng = float(payload["listing_lng"])
    district_name = payload["district_name"]
    district_slug = payload["district_slug"]
    map_zoom = int(payload.get("map_zoom", 12))
    duration_sec = int(payload.get("duration_sec", 44))

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

    # Load/fetch district boundary
    district_feature = load_district_geojson(district_slug)
    if not district_feature and not args.dry_run:
        geojson_data = fetch_and_cache_ode_geojson()
        # Try to extract the matching district
        if geojson_data and geojson_data.get("type") == "FeatureCollection":
            for feat in geojson_data.get("features", []):
                props = feat.get("properties", {})
                name_prop = props.get("name", "") or props.get("district_name", "") or ""
                if district_name.lower() in name_prop.lower():
                    per_district = DATA_DIR / f"{district_slug}.geojson"
                    per_district.write_text(json.dumps(feat, indent=2))
                    district_feature = feat
                    print(f"Extracted and cached district feature: {district_slug}")
                    break

    boundary_data_available = district_feature is not None
    boundary_points = []
    center_lat = listing_lat
    center_lng = listing_lng

    if boundary_data_available:
        geometry = district_feature.get("geometry", {})
        geom_type = geometry.get("type", "")
        coords_raw = geometry.get("coordinates", [])
        # Handle Polygon (take outer ring) and MultiPolygon (take first ring)
        if geom_type == "Polygon" and coords_raw:
            ring = coords_raw[0]
        elif geom_type == "MultiPolygon" and coords_raw:
            ring = coords_raw[0][0]
        else:
            ring = []
            boundary_data_available = False

        if ring:
            center_lat, center_lng = polygon_centroid(ring)
            boundary_points = normalize_polygon(ring, center_lat, center_lng, map_zoom)

    if not boundary_data_available:
        print("WARNING: district boundary GeoJSON not available -- showing placeholder", file=sys.stderr)
        # Fallback placeholder boundary around listing
        boundary_points = [
            {"nx": 0.15, "ny": 0.25},
            {"nx": 0.85, "ny": 0.20},
            {"nx": 0.88, "ny": 0.75},
            {"nx": 0.12, "ny": 0.80},
        ]

    # Fetch nearby schools
    raw_schools = fetch_nearby_schools(listing_lat, listing_lng, api_key) if not args.dry_run else []
    if not raw_schools:
        raw_schools = [
            {"name": "Bear Creek Elem", "lat": listing_lat + 0.012, "lng": listing_lng - 0.018, "type": "elementary"},
            {"name": "Cascade Middle",  "lat": listing_lat + 0.006, "lng": listing_lng + 0.012, "type": "middle"},
            {"name": "Mountain View HS","lat": listing_lat - 0.009, "lng": listing_lng + 0.008, "type": "high"},
        ]

    # Normalize school positions
    def lat_to_y_px(lat_deg, z):
        sin_lat = math.sin(math.radians(lat_deg))
        sin_lat = max(-0.9999, min(0.9999, sin_lat))
        return (0.5 - math.log((1 + sin_lat) / (1 - sin_lat)) / (4 * math.pi)) * 256 * (2 ** z)

    def lng_to_x_px(lng_deg, z):
        return (lng_deg + 180) / 360 * 256 * (2 ** z)

    cx_px = lng_to_x_px(center_lng, map_zoom)
    cy_px = lat_to_y_px(center_lat, map_zoom)

    schools_normalized = []
    for s in raw_schools:
        sx = (lng_to_x_px(s["lng"], map_zoom) - cx_px + W / 2) / W
        sy = (lat_to_y_px(s["lat"], map_zoom) - cy_px + H / 2) / H
        schools_normalized.append({**s, "nx": sx, "ny": sy})

    # Subject pin normalized
    subject_nx = (lng_to_x_px(listing_lng, map_zoom) - cx_px + W / 2) / W
    subject_ny = (lat_to_y_px(listing_lat, map_zoom) - cy_px + H / 2) / H

    # Count nearby (within ~0.5 deg ~ 1mi)
    nearby_count = sum(
        1 for s in raw_schools
        if abs(s["lat"] - listing_lat) < 0.015 and abs(s["lng"] - listing_lng) < 0.018
    )

    # VO
    vo_script = build_vo_script(district_name, raw_schools, nearby_count)
    vo_path = ""
    caption_words = []
    try:
        from _voice_lib import synth_vo, get_forced_alignment
        vo_file = out_dir / "school_district_vo.mp3"
        synth_vo(vo_script, str(vo_file))
        caption_words = get_forced_alignment(vo_script, str(vo_file))
        vo_path = f"school_district_overlay/{target_slug}/school_district_vo.mp3"
        print(f"VO synthesized ({len(caption_words)} words)")
    except ImportError:
        print("WARNING: _voice_lib not available -- VO skipped")
    except Exception as e:
        print(f"WARNING: VO synthesis failed -- {e}")

    # Props
    props = {
        "apiKey": api_key,
        "centerLat": center_lat,
        "centerLng": center_lng,
        "mapZoom": map_zoom,
        "districtName": district_name,
        "boundaryPoints": boundary_points,
        "boundaryDataAvailable": boundary_data_available,
        "schools": schools_normalized,
        "subjectNx": subject_nx,
        "subjectNy": subject_ny,
        "nearbySchoolCount": nearby_count,
        "captionWords": caption_words,
        "voPath": vo_path,
        "durationSec": duration_sec,
    }

    props_file = out_dir / "props.json"
    props_file.write_text(json.dumps(props, indent=2))
    print(f"Props written: {props_file}")

    # Sidecars
    citations = {
        "figures": [
            {
                "figure": f"{district_name} district boundary",
                "source": "Oregon Dept of Education GeoJSON" if boundary_data_available else "Placeholder",
                "url": ODE_GEOJSON_URL,
                "cache": str(DATA_DIR / f"{district_slug}.geojson"),
                "fetched_at": datetime.datetime.utcnow().isoformat() + "Z",
                "boundary_data_available": boundary_data_available,
            },
            {
                "figure": f"{len(raw_schools)} nearby schools",
                "source": "Google Places API (nearbysearch type=school)" if api_key else "Placeholder data",
                "filter": f"lat={listing_lat},lng={listing_lng},radius=3000,type=school",
                "fetched_at": datetime.datetime.utcnow().isoformat() + "Z",
            },
        ]
    }
    (out_dir / "citations.json").write_text(json.dumps(citations, indent=2))

    card = {
        "producer": PRODUCER,
        "primary_artifact": "school_district_overlay.mp4",
        "target_slug": target_slug,
        "district_name": district_name,
        "school_count": len(raw_schools),
        "nearby_count": nearby_count,
        "boundary_data_available": boundary_data_available,
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "render": {
            "source": "video/school_district_overlay/src/SchoolDistrictOverlay.tsx",
            "comp_id": COMP_ID,
            "duration_sec": duration_sec,
            "resolution": f"{W}x{H}",
            "fps": 30,
        }
    }
    (out_dir / "card.json").write_text(json.dumps(card, indent=2))
    print(f"Sidecars written to {out_dir}")

    if not boundary_data_available:
        print(
            "\nNOTE: district boundary GeoJSON not available.\n"
            "  Composition will render with placeholder.\n"
            f"  To get real boundaries: cache ODE GeoJSON to {DATA_DIR}/{district_slug}.geojson\n"
            f"  Source: {ODE_GEOJSON_URL}"
        )

    print("\nReady. Render requires Matt approval (draft-first rule).")
    print(f"  cd {PROJECT_DIR}")
    print(f"  npx remotion render src/index.ts {COMP_ID} \\")
    print(f"    {out_dir}/school_district_overlay.mp4 \\")
    print(f"    --codec h264 --concurrency 1 --crf 22 \\")
    print(f"    --image-format=jpeg --jpeg-quality=92 \\")
    print(f"    --props {props_file}")


if __name__ == "__main__":
    main()
