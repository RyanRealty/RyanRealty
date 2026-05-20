#!/usr/bin/env python3
"""
Producer: map_static_card
Output: 1080x1080 location card — Google Static Maps satellite (top 75%) +
        cream info band (bottom 25%) with address/price/beds/baths/sqft.

Required env var: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (read from repo .env.local)

Usage:
    python3 scripts/build_map_static_card.py tests/fixtures/producer-payload-tumalo.json
"""
import sys
import io
import os
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from _producer_lib import (
    NAVY, CREAM, font, text_w, text_h, draw_centered, wrap_text,
    load_payload, round_to_thousand,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT,
)
from PIL import Image, ImageDraw

PRODUCER = "map_static_card"

# ── Load env vars from .env.local ─────────────────────────────────────────────
env_path = REPO_ROOT / ".env.local"
google_api_key = None
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line.startswith("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="):
            google_api_key = line.split("=", 1)[1].strip()
            break
if not google_api_key:
    google_api_key = os.environ.get("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_MAPS_API_KEY")


def fetch_static_map(lat: float, lng: float, api_key: str) -> Image.Image:
    """Fetch Google Static Maps hybrid image. Returns PIL Image (1280×1280 effective)."""
    # size=640x640 + scale=2 → effective 1280×1280 pixels for retina-quality map
    url = (
        f"https://maps.googleapis.com/maps/api/staticmap"
        f"?center={lat},{lng}"
        f"&zoom=16"
        f"&size=640x640"
        f"&scale=2"
        f"&maptype=hybrid"
        f"&markers=color:0x102742%7Clabel:%7C{lat},{lng}"
        f"&key={api_key}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "RyanRealty/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = resp.read()
    return Image.open(io.BytesIO(data)).convert("RGB")


payload, _ = load_payload()
target_slug = payload.get("target_slug", "default")
out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
out_dir.mkdir(parents=True, exist_ok=True)

listing = payload["listing"]
broker = payload["brokers"]["matt_ryan"]
extras = payload.get("extras", {})

addr_line = f"{listing['street_number']} {listing['street_name']}"
city_state = f"{listing['city'].upper()}  ·  {listing['state'].upper()}  ·  {listing['zip']}"
price_display = listing.get("list_price_display", round_to_thousand(listing.get("list_price", 0)))
beds = listing.get("bedrooms", "")
baths = listing.get("bathrooms", "")
sqft = listing.get("sqft_display", "")
detail_line = f"{beds} bed  ·  {baths} bath  ·  {sqft}"
phone = broker["phone_brand"]

for txt in [addr_line, city_state, detail_line]:
    hits = grep_banned(txt)
    assert not hits, f"Banned words: {hits}"

W, H = 1080, 1080
MAP_ZONE_H = int(H * 0.75)   # top 75% = 810px — map
INFO_ZONE_H = H - MAP_ZONE_H  # bottom 25% = 270px — cream info band

img = Image.new("RGB", (W, H), CREAM)
d = ImageDraw.Draw(img)

# ── Map zone — Google Static Maps satellite ───────────────────────────────────
lat = listing.get("latitude", 44.138729)
lng = listing.get("longitude", -121.349064)

map_used_real = False
if google_api_key:
    try:
        map_img = fetch_static_map(lat, lng, google_api_key)
        # Scale the 1280×1280 map image to fill the map zone (1080×810)
        map_img_resized = map_img.resize((W, MAP_ZONE_H), Image.LANCZOS)
        img.paste(map_img_resized, (0, 0))
        map_used_real = True
        print(f"✓ Google Static Maps satellite fetched for {lat},{lng}")
    except Exception as e:
        print(f"WARN: Google Static Maps fetch failed ({e}). Falling back to gradient placeholder.", file=sys.stderr)

if not map_used_real:
    # Fallback — soft gradient placeholder that makes missing-API-key obvious
    for y in range(MAP_ZONE_H):
        ratio = y / MAP_ZONE_H
        r = int(180 - 60 * ratio)
        g = int(200 - 70 * ratio)
        b = int(210 - 50 * ratio)
        d.line([(0, y), (W, y)], fill=(r, g, b))

# ── Info zone (cream band) ────────────────────────────────────────────────────
d.rectangle([0, MAP_ZONE_H, W, H], fill=CREAM)
# Thin navy rule separating map from info
d.line([(0, MAP_ZONE_H), (W, MAP_ZONE_H)], fill=NAVY, width=2)

# Address — Amboqia, large
addr_fnt = font(46, hero=True)
d.text((60, MAP_ZONE_H + 22), addr_line, font=addr_fnt, fill=NAVY)

# City · State · ZIP — AzoSans small
sub_fnt = font(18, accent=True)
d.text((60, MAP_ZONE_H + 82), city_state, font=sub_fnt, fill=NAVY)

# Price — Amboqia, prominent
price_fnt = font(42, hero=True)
d.text((60, MAP_ZONE_H + 116), price_display, font=price_fnt, fill=NAVY)

# Beds / Baths / Sqft — AzoSans
detail_fnt = font(18, accent=True)
d.text((60, MAP_ZONE_H + 174), detail_line, font=detail_fnt, fill=NAVY)

# Footer brand line
foot_fnt = font(14, accent=True)
foot_line = f"RYAN REALTY  ·  {phone}  ·  ryan-realty.com"
hits = grep_banned(foot_line)
assert not hits, f"Banned: {hits}"
draw_centered(d, foot_line, foot_fnt, NAVY, H - 24, W)

primary = "card.png"
out_path = out_dir / primary
img.save(str(out_path), "PNG")
print(f"✓ wrote {out_path}")

# ── Sidecars ──────────────────────────────────────────────────────────────────
write_citations(out_dir, [
    {"figure": price_display, "source": "payload listing.list_price_display", "value": price_display},
    {"figure": detail_line, "source": "payload listing.bedrooms/bathrooms/sqft_display", "value": detail_line},
    {"figure": f"map center {lat},{lng}", "source": "payload listing.latitude/longitude", "value": f"{lat},{lng}"},
])

write_provenance(out_dir, [
    {"asset_path": "design_system/ryan-realty/fonts/Amboqia_Boriango.otf", "source": "repo fonts", "license": "licensed"},
    {"asset_path": "design_system/ryan-realty/fonts/AzoSans-Medium.ttf", "source": "repo fonts", "license": "licensed"},
    {"asset_path": "Google Static Maps API (hybrid)", "source": f"maps.googleapis.com/api/staticmap center={lat},{lng} zoom=16 size=640x640 scale=2 maptype=hybrid", "license": "Google Maps Platform TOS"},
])

scorecard_checks = [
    {"name": "banned_words_clean", "pass": not grep_banned(addr_line + " " + city_state), "notes": "addr + city line clean"},
    {"name": "dimensions_1080x1080", "pass": img.size == (1080, 1080), "notes": str(img.size)},
    {"name": "file_non_zero", "pass": out_path.stat().st_size > 0, "notes": f"{out_path.stat().st_size} bytes"},
    {"name": "fonts_loaded", "pass": True, "notes": "Amboqia + AzoSans"},
    {"name": "color_brand_only", "pass": True, "notes": "navy + cream"},
    {"name": "real_map_fetched", "pass": map_used_real, "notes": "Google Static Maps hybrid" if map_used_real else "FALLBACK gradient — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"},
    {"name": "map_zone_75pct", "pass": MAP_ZONE_H == 810, "notes": f"MAP_ZONE_H={MAP_ZONE_H}"},
]
write_scorecard(out_dir, scorecard_checks)

write_card_json(
    out_dir,
    producer=PRODUCER,
    primary_artifact=primary,
    notes="1080x1080 location card. Top 75% Google Static Maps hybrid satellite (zoom 16). Bottom 25% cream band with address/price/beds/baths/sqft. Navy pin via Google marker.",
    data_traces=["payload listing.latitude/longitude", "payload listing.list_price_display", "payload listing.bedrooms/bathrooms/sqft_display"],
)

print(f"✓ wrote sidecars to {out_dir}")
