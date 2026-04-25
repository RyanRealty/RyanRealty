#!/usr/bin/env python3
"""Render 4 polygon variants over the same satellite tile, stitch into comparison PNG.
Matt picks which boundary is "correct" visually.
"""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4")
LIB = ROOT / "public" / "v5_library"
SUBDIV = LIB / "vandevert_subdivision.geojson"
PARCEL = LIB / "vandevert_parcel.geojson"
TILE = ROOT / "public" / "images" / "maps_z15.png"  # ~6km wide, fits 777-acre ranch w/ headroom

# Tile metadata (matches what was queried in Bash)
TILE_LAT = 43.8383243
TILE_LNG = -121.4428004
TILE_Z = 15
TILE_PX = 1280  # we requested size=640 scale=2 → 1280px
TILE_WORLD_PX_FULL = 256 * (2 ** TILE_Z)

def latlng_to_world_px(lat, lng):
    x = (lng + 180) / 360 * TILE_WORLD_PX_FULL
    sin_lat = math.sin(lat * math.pi / 180)
    y = (0.5 - math.log((1 + sin_lat) / (1 - sin_lat)) / (4 * math.pi)) * TILE_WORLD_PX_FULL
    return x, y

CENTER_WX, CENTER_WY = latlng_to_world_px(TILE_LAT, TILE_LNG)

def latlng_to_tile_px(lat, lng):
    """Convert lat/lng to pixel coordinates within the 1280×1280 tile."""
    wx, wy = latlng_to_world_px(lat, lng)
    return (TILE_PX/2 + (wx - CENTER_WX), TILE_PX/2 + (wy - CENTER_WY))

# Load polygons
subdiv = json.loads(SUBDIV.read_text())
phase1 = phase2 = None
import re
for f in subdiv["features"]:
    n = f["properties"].get("NAME", "")
    geom = f["geometry"]
    # match "PHASE I" or "PHASE 1" with word boundary, NOT "PHASE II"
    if re.search(r"PHASE\s+(?:I|1)\b(?!I)", n.upper()):
        phase1 = (n, geom["coordinates"][0])
    elif re.search(r"PHASE\s+(?:II|2)\b", n.upper()):
        phase2 = (n, geom["coordinates"][0])

# Single taxlot
parcel = json.loads(PARCEL.read_text())
parcel_feat = parcel["features"][0] if parcel.get("type") == "FeatureCollection" else parcel
parcel_ring = parcel_feat["geometry"]["coordinates"][0]
parcel_name = parcel_feat["properties"].get("OBJECTID", "201117C001000") if parcel.get("type") == "FeatureCollection" else "201117C001000"

print(f"Phase I: {phase1[0]}, {len(phase1[1])} verts" if phase1 else "Phase I: NOT FOUND")
print(f"Phase II: {phase2[0]}, {len(phase2[1])} verts" if phase2 else "Phase II: NOT FOUND")
print(f"Parcel: {parcel_name}, {len(parcel_ring)} verts")

# Load tile
tile = Image.open(TILE).convert("RGB")
print(f"Tile: {tile.size}")

# 4 variants
GOLD = (200, 168, 100)  # #C8A864
GOLD_FILL_CENTER = (200, 168, 100, 130)  # ~50% alpha
GOLD_FILL_EDGE = (200, 168, 100, 60)
STROKE_WIDTH = 3

def render_panel(ring, label_top, label_bottom):
    """Render a single 1080x540 panel: tile + polygon overlay."""
    # Crop center 1080×1080 of tile (square fit), then resize to 1080×540 for panel? No, render at full 1080 square then label band below.
    # Actually let's do 1080×1080 panel + 60px label band → 1080×1140 per panel × 4 = 1080×4560 too tall
    # Instead: 540×540 panel × 4 in 2×2 grid = 1080×1080 + label bands
    # Cleanest: 1080×1920 single comparison image, 4 panels in 2×2 grid each 540×540 + 60px label rows
    pass  # we build the grid below

def project_ring(ring):
    return [latlng_to_tile_px(lat, lng) for lng, lat in ring]

def render_single(tile_img, ring, label, panel_w=540, panel_h=540):
    """Crop tile to square, scale to panel size, draw polygon."""
    # Crop center square from the 1280×1280 tile
    crop_size = 1280
    cx, cy = tile_img.size[0]/2, tile_img.size[1]/2
    half = crop_size / 2
    cropped = tile_img.crop((int(cx-half), int(cy-half), int(cx+half), int(cy+half)))

    # Project polygon onto 1280×1280 (tile native)
    pts_native = project_ring(ring)

    # Resize cropped to panel size
    scale = panel_w / 1280
    panel = cropped.resize((panel_w, panel_h), Image.LANCZOS)

    # Project to panel coordinates
    pts_panel = [(x*scale, y*scale) for x, y in pts_native]

    # Overlay
    overlay = Image.new("RGBA", panel.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Fill (semi-transparent gold)
    if len(pts_panel) >= 3:
        fill_alpha = 100  # ~40% opacity
        draw.polygon(pts_panel, fill=(200, 168, 100, fill_alpha), outline=None)

    # Stroke (thin gold)
    if len(pts_panel) >= 2:
        for i in range(len(pts_panel)):
            x1, y1 = pts_panel[i]
            x2, y2 = pts_panel[(i+1) % len(pts_panel)]
            draw.line([(x1,y1),(x2,y2)], fill=(200, 168, 100, 255), width=2)

    # Composite
    panel_rgba = panel.convert("RGBA")
    composite = Image.alpha_composite(panel_rgba, overlay).convert("RGB")

    # Add label band (60px) below
    band_h = 60
    final = Image.new("RGB", (panel_w, panel_h + band_h), (26, 23, 20))  # charcoal
    final.paste(composite, (0, 0))
    draw_band = ImageDraw.Draw(final)

    # Try to load a font
    font = None
    for fp in ["/System/Library/Fonts/Supplemental/Georgia.ttf", "/Library/Fonts/Georgia.ttf", "/System/Library/Fonts/Georgia.ttf"]:
        if Path(fp).exists():
            font = ImageFont.truetype(fp, 22)
            break
    if not font:
        font = ImageFont.load_default()

    bbox = draw_band.textbbox((0,0), label, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    draw_band.text(((panel_w - text_w)/2, panel_h + (band_h - text_h)/2 - 5), label, font=font, fill=(200, 168, 100))

    return final

# Render each variant
variants = [
    ("A. Single home lot (taxlot 201117C001000, ~0.5 acre)", parcel_ring),
    ("B. Phase I only (316 acres, eastern strip w/ home site)", phase1[1] if phase1 else parcel_ring),
    ("C. Phase II only (461 acres, western expansion)", phase2[1] if phase2 else parcel_ring),
    ("D. Phase I + II combined (777 acres, what v6 used)", phase1[1] + phase2[1] if phase1 and phase2 else parcel_ring),
]

# For variant D, render BOTH polygons separately (don't try to combine into one ring)
def render_two_rings(tile_img, ring_a, ring_b, label, panel_w=540, panel_h=540):
    crop_size = 1280
    cx, cy = tile_img.size[0]/2, tile_img.size[1]/2
    half = crop_size / 2
    cropped = tile_img.crop((int(cx-half), int(cy-half), int(cx+half), int(cy+half)))
    scale = panel_w / 1280
    panel = cropped.resize((panel_w, panel_h), Image.LANCZOS)
    overlay = Image.new("RGBA", panel.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for ring in (ring_a, ring_b):
        pts_native = project_ring(ring)
        pts_panel = [(x*scale, y*scale) for x, y in pts_native]
        if len(pts_panel) >= 3:
            draw.polygon(pts_panel, fill=(200, 168, 100, 100), outline=None)
        for i in range(len(pts_panel)):
            x1, y1 = pts_panel[i]
            x2, y2 = pts_panel[(i+1) % len(pts_panel)]
            draw.line([(x1,y1),(x2,y2)], fill=(200, 168, 100, 255), width=2)
    panel_rgba = panel.convert("RGBA")
    composite = Image.alpha_composite(panel_rgba, overlay).convert("RGB")
    band_h = 60
    final = Image.new("RGB", (panel_w, panel_h + band_h), (26, 23, 20))
    final.paste(composite, (0, 0))
    draw_band = ImageDraw.Draw(final)
    font = None
    for fp in ["/System/Library/Fonts/Supplemental/Georgia.ttf", "/Library/Fonts/Georgia.ttf"]:
        if Path(fp).exists():
            font = ImageFont.truetype(fp, 22)
            break
    if not font:
        font = ImageFont.load_default()
    bbox = draw_band.textbbox((0,0), label, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    draw_band.text(((panel_w - text_w)/2, panel_h + (band_h - text_h)/2 - 5), label, font=font, fill=(200, 168, 100))
    return final

panel_a = render_single(tile, parcel_ring, "A. Single home lot only")
panel_b = render_single(tile, phase1[1] if phase1 else parcel_ring, "B. Phase I only (316 acres)")
panel_c = render_single(tile, phase2[1] if phase2 else parcel_ring, "C. Phase II only (461 acres)")
panel_d = render_two_rings(tile, phase1[1] if phase1 else parcel_ring, phase2[1] if phase2 else parcel_ring, "D. Phase I + II combined (777a, v6)")

# Stitch 2x2 grid: 1080×1200 (2 panels at 540×600 each, 2 rows)
panel_w, panel_h = 540, 600  # 540 image + 60 label
header_h = 80
final_w, final_h = 1080, header_h + panel_h * 2

final = Image.new("RGB", (final_w, final_h), (26, 23, 20))

# Header
draw = ImageDraw.Draw(final)
font = None
for fp in ["/System/Library/Fonts/Supplemental/Georgia.ttf", "/Library/Fonts/Georgia.ttf"]:
    if Path(fp).exists():
        font_h = ImageFont.truetype(fp, 28)
        font_sub = ImageFont.truetype(fp, 16)
        break
header = "Which Vandevert Ranch boundary is correct?"
sub = "Tap the panel that matches the actual ranch boundary"
hb = draw.textbbox((0,0), header, font=font_h)
draw.text(((final_w-(hb[2]-hb[0]))/2, 18), header, font=font_h, fill=(200,168,100))
sb = draw.textbbox((0,0), sub, font=font_sub)
draw.text(((final_w-(sb[2]-sb[0]))/2, 52), sub, font=font_sub, fill=(242,235,221))

# Place 4 panels in 2x2
final.paste(panel_a, (0, header_h))
final.paste(panel_b, (540, header_h))
final.paste(panel_c, (0, header_h + panel_h))
final.paste(panel_d, (540, header_h + panel_h))

OUT_LOCAL = LIB / "boundary_compare_v7.png"
OUT_VERCEL = Path("/Users/matthewryan/RyanRealty/public/v5_library/boundary_compare_v7.png")
final.save(OUT_LOCAL, "PNG", optimize=True)
final.save(OUT_VERCEL, "PNG", optimize=True)
print(f"Saved {OUT_LOCAL} ({OUT_LOCAL.stat().st_size/1024:.0f}KB)")
print(f"Saved {OUT_VERCEL} ({OUT_VERCEL.stat().st_size/1024:.0f}KB)")
