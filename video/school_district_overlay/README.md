# school_district_overlay

Animated school district boundary + school marker video for property listings.

## Data source dependency

**School district boundary GeoJSON — pending Matt direction on data feed.**

The authoritative source is the Oregon Department of Education (ODE):
- District boundary GeoJSON: https://www.oregon.gov/ode/schools-and-districts/Pages/Data.aspx
- Direct GeoJSON API: https://data.oregon.gov/api/geospatial/njfk-3inm?method=export&type=GeoJSON (Oregon School Districts)

Until ODE GeoJSON is fetched and cached, the composition renders a clearly
labeled placeholder ("School district boundary data source TBD — pending Matt
direction on data feed").

## Data caching

Once the ODE GeoJSON feed is confirmed:

```bash
# Fetch and cache Deschutes County school districts
curl -o data/school-districts/deschutes-county-districts.geojson \
  "https://data.oregon.gov/api/geospatial/njfk-3inm?method=export&type=GeoJSON"
```

Each district is then extracted to:
  `data/school-districts/<district-slug>.geojson`

## Build

```bash
python3 scripts/build_school_district_overlay.py payload.json [--dry-run]
```

Payload:
```json
{
  "target_slug": "19496-tumalo-reservoir-rd",
  "listing_lat": 44.138729,
  "listing_lng": -121.349064,
  "district_name": "Bend-LaPine School District",
  "district_slug": "bend-lapine",
  "map_zoom": 12,
  "duration_sec": 44
}
```

## Render (after Matt approval)

```bash
cd video/school_district_overlay
npx remotion render src/index.ts SchoolDistrictOverlay out/school_district_overlay.mp4 \
  --codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92 \
  --props ../../out/school_district_overlay/<slug>/props.json
```
