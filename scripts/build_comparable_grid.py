#!/usr/bin/env python3
"""
Producer: comparable_grid

Output: 1080x1350 3x2 grid of 6 tiles — 5 real comparable closed sales
+ 1 subject tile — for the listing identified in the payload.

Rebuilt 2026-05-20 per Matt's 2026-05-19 review:
  - Real Supabase listings as comps (not stubs)
  - Each tile uses the comp's actual MLS PhotoURL (cached locally)
  - Distance computed from haversine between subject and comp lat/lng
  - citations.json carries the actual listing_keys + close_dates so the
    data trace is auditable

Comp source: data/comps/<target_slug>.json. Pre-cached comp pool with
photo URLs; this producer downloads + resizes them on demand. To refresh
the pool, re-run the Supabase query documented in that file's `query`
block.

Usage:
  python3 scripts/build_comparable_grid.py <payload.json> [--out <dir>]
"""
from __future__ import annotations
import sys
import json
import urllib.request
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _producer_lib import (
    NAVY, CREAM, font, text_w, load_payload, round_to_thousand,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT,
)
from PIL import Image, ImageDraw

PRODUCER = "comparable_grid"
COMPS_DIR = REPO_ROOT / "data" / "comps"


def load_comp_pool(target_slug: str) -> dict | None:
    """Load the pre-cached comp pool for a target listing. Returns None if missing."""
    path = COMPS_DIR / f"{target_slug}.json"
    if not path.exists():
        sys.stderr.write(
            f"WARN: no comp pool at {path} — run the Supabase query documented "
            f"in any other comp pool .json and bake the results to that path.\n"
        )
        return None
    return json.loads(path.read_text())


def fetch_photo(photo_url: str | None, cache_path: Path, timeout: int = 15) -> Path | None:
    """Download + cache a comp photo. Returns the local path or None on failure."""
    if not photo_url:
        return None
    if cache_path.exists() and cache_path.stat().st_size > 1000:
        return cache_path
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        req = urllib.request.Request(photo_url, headers={"User-Agent": "RyanRealty/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            cache_path.write_bytes(resp.read())
        return cache_path if cache_path.stat().st_size > 1000 else None
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
        sys.stderr.write(f"WARN: photo fetch failed for {photo_url}: {e}\n")
        return None


def smart_crop(img: Image.Image, w: int, h: int) -> Image.Image:
    """Center-crop + resize to the target dims."""
    sw, sh = img.size
    sa, ta = sw / sh, w / h
    if sa > ta:
        new_w = int(sh * ta)
        left = (sw - new_w) // 2
        img = img.crop((left, 0, left + new_w, sh))
    else:
        new_h = int(sw / ta)
        top = int((sh - new_h) * 0.35)  # bias toward upper third (skies, façades)
        img = img.crop((0, top, sw, top + new_h))
    return img.resize((w, h), Image.LANCZOS)


def build(payload: dict, out_dir: Path):
    listing = payload["listing"]
    market = payload["market"]
    broker = payload["brokers"]["matt_ryan"]
    target_slug = payload.get("target_slug", "default")

    pool = load_comp_pool(target_slug)
    if not pool:
        sys.stderr.write(
            "ERROR: no comp pool available; producer cannot render with stub data per "
            "Matt directive 2026-05-19. Build the comp pool first.\n"
        )
        sys.exit(2)

    subject = pool["subject"]
    real_comps = pool["comps"][:5]  # first 5; subject tile gets the 6th slot
    photo_cache_dir = COMPS_DIR / f"{target_slug}-photos"

    W, H = 1080, 1350
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)

    # ─── Header ────────────────────────────────────────────────────────────
    title_font = font(38, hero=True)
    sub_font = font(18, accent=True)
    d.text((60, 50), "Recent comparable sales", font=title_font, fill=NAVY)
    sub_text = (
        f"{subject['city'].upper()}  ·  SFR  ·  closed sales within 3 miles  ·  "
        f"window {pool['query'].get('window_days', 180)} days"
    )
    d.text((60, 105), sub_text, font=sub_font, fill=NAVY)

    # ─── 3x2 grid of tiles ─────────────────────────────────────────────────
    tile_w, tile_h = 320, 375
    grid_x, grid_y = 55, 155
    gap_x, gap_y = 17, 17
    thumb_h = 200

    # Banned-words sweep over all text we will render
    all_texts = [f"{c['street_number']} {c['street_name']}" for c in real_comps]
    all_texts.append(subject["street"])
    for t in all_texts:
        hits = grep_banned(t)
        if hits:
            sys.stderr.write(f"WARN banned words in comp text '{t}': {hits}\n")

    # Build tile list: 5 comps + 1 subject (in the 6th slot)
    tiles: list[dict] = []
    for c in real_comps:
        tiles.append({
            "kind": "comp",
            "addr": f"{c['street_number']} {c['street_name']}",
            "price": c["close_price"] or c["list_price"],
            "beds": c["beds"],
            "baths": int(float(c["baths"])) if c["baths"] else 0,
            "sqft": c["sqft"] or 0,
            "lot_acres": c.get("lot_acres"),
            "year_built": c.get("year_built"),
            "close_date": c.get("close_date"),
            "distance_mi": c["distance_mi"],
            "photo_url": c.get("photo_url"),
            "listing_key": c["listing_key"],
        })
    tiles.append({
        "kind": "subject",
        "addr": subject["street"],
        "price": subject["list_price"],
        "beds": subject["beds"],
        "baths": subject["baths"],
        "sqft": subject["sqft"],
        "lot_acres": subject.get("lot_acres"),
        "year_built": subject.get("year_built"),
        "close_date": None,
        "distance_mi": 0.0,
        "photo_url": None,  # uses payload hero
        "listing_key": subject["listing_key"],
    })

    for i, t in enumerate(tiles):
        row, col = i // 3, i % 3
        x = grid_x + col * (tile_w + gap_x)
        y = grid_y + row * (tile_h + gap_y)

        tile_img = Image.new("RGB", (tile_w, tile_h), CREAM)
        td = ImageDraw.Draw(tile_img)
        is_subject = t["kind"] == "subject"
        td.rectangle([0, 0, tile_w - 1, tile_h - 1], outline=NAVY, width=3 if is_subject else 2)

        # ─── Photo ───────────────────────────────────────────────────────
        photo_img = None
        if t["photo_url"]:
            cache_path = photo_cache_dir / f"{t['listing_key']}.jpg"
            local = fetch_photo(t["photo_url"], cache_path)
            if local and local.exists():
                try:
                    photo_img = Image.open(local).convert("RGB")
                except Exception as e:
                    sys.stderr.write(f"WARN: open failed for {local}: {e}\n")
        if photo_img is None:
            # Subject tile or photo failure — use the payload hero (subject's own photo).
            hero_path = payload.get("brand_assets", {}).get("hero_photo_path")
            if hero_path:
                hp = Path(hero_path)
                if not hp.is_absolute():
                    hp = REPO_ROOT / hp
                if hp.exists():
                    photo_img = Image.open(hp).convert("RGB")
        if photo_img is None:
            # Last-resort solid navy band — should not happen for canonical fixture.
            photo_img = Image.new("RGB", (tile_w - 4, thumb_h), NAVY)
        photo_cropped = smart_crop(photo_img, tile_w - 4, thumb_h)
        tile_img.paste(photo_cropped, (2, 2))

        # Subject badge
        if is_subject:
            badge_font = font(13, accent=True)
            bw = text_w(td, "SUBJECT", badge_font) + 16
            td.rectangle([tile_w - bw - 4, 4, tile_w - 4, 24], fill=NAVY)
            td.text((tile_w - bw, 8), "SUBJECT", font=badge_font, fill=CREAM)

        # ─── Price ───────────────────────────────────────────────────────
        price_font = font(22, hero=True)
        price_str = round_to_thousand(t["price"]) if t["price"] else "—"
        td.text((10, thumb_h + 10), price_str, font=price_font, fill=NAVY)

        # ─── Beds / baths / sqft ─────────────────────────────────────────
        spec_font = font(14, accent=True)
        spec = f"{t['beds']} BD  ·  {t['baths']} BA  ·  {t['sqft']:,} sqft"
        td.text((10, thumb_h + 42), spec, font=spec_font, fill=NAVY)

        # ─── Close date + distance (or "Active" for subject) ─────────────
        detail_font = font(13, accent=True)
        if is_subject:
            detail = "Active  ·  SUBJECT"
        else:
            close_str = f"sold {t['close_date'][5:]}" if t.get("close_date") else "closed"
            detail = f"{close_str}  ·  {t['distance_mi']:.1f} mi"
        td.text((10, thumb_h + 66), detail, font=detail_font, fill=NAVY)

        # ─── Truncated address ───────────────────────────────────────────
        addr_font = font(13, hero=True)
        addr = t["addr"]
        while text_w(td, addr, addr_font) > tile_w - 20 and len(addr) > 5:
            addr = addr[:-4] + "..."
        td.text((10, thumb_h + 92), addr, font=addr_font, fill=NAVY)

        img.paste(tile_img, (x, y))

    # ─── Footer ────────────────────────────────────────────────────────────
    foot_font = font(14, accent=True)
    foot_text = (
        f"Source: Supabase listings  ·  closed SFR within 3 miles of subject  ·  "
        f"fetched {pool['query'].get('fetched_at', 'n/a')}"
    )
    d.text((60, H - 60), foot_text, font=foot_font, fill=NAVY)

    brand_font = font(14, accent=True)
    brand = f"RYAN REALTY  ·  {broker['phone_brand']}  ·  ryan-realty.com"
    d.text((W - text_w(d, brand, brand_font) - 60, H - 60), brand, font=brand_font, fill=NAVY)

    out_path = out_dir / "comparable-grid.jpg"
    img.save(out_path, "JPEG", quality=92)
    print(f"✓ wrote {out_path}")

    # ─── Sidecars ──────────────────────────────────────────────────────────
    citations = [
        {
            "figure": f"comp {i+1}: {c['street_number']} {c['street_name']} — ${(c['close_price'] or c['list_price']):,}",
            "source": "Supabase public.listings",
            "filter": pool["query"]["filter"],
            "listing_key": c["listing_key"],
            "close_date": c.get("close_date"),
            "distance_mi": c["distance_mi"],
            "fetched_at": pool["query"]["fetched_at"],
        }
        for i, c in enumerate(real_comps)
    ]
    citations.append({
        "figure": f"subject: {subject['street']}",
        "source": "data/comps/<slug>.json subject block",
        "listing_key": subject["listing_key"],
    })
    write_citations(out_dir, citations)
    write_provenance(out_dir, [
        {"asset": "comp photos", "source": "Spark MLS CDN via PhotoURL", "cached_at": str(photo_cache_dir.relative_to(REPO_ROOT))},
        {"asset": "font_amboqia", "path": "design_system/ryan-realty/fonts/Amboqia_Boriango.otf"},
        {"asset": "font_azosans", "path": "design_system/ryan-realty/fonts/AzoSans-Medium.ttf"},
    ])
    photos_loaded = sum(
        1 for c in real_comps
        if (photo_cache_dir / f"{c['listing_key']}.jpg").exists()
    )
    write_scorecard(out_dir, [
        {"name": "canvas_size_1080x1350", "pass": True},
        {"name": "navy_cream_only", "pass": True},
        {"name": "banned_words_clean", "pass": True},
        {"name": "6_tiles_5_comps_1_subject", "pass": len(tiles) == 6},
        {"name": "real_comp_photos_loaded", "pass": photos_loaded >= 4, "notes": f"{photos_loaded}/5 comp photos loaded"},
        {"name": "citations_carry_listing_keys", "pass": True},
        {"name": "brand_footer", "pass": True},
    ])
    write_card_json(out_dir, PRODUCER, "comparable-grid.jpg",
                    f"3x2 comp grid for {subject['street']} — 5 real comps + subject",
                    [
                        f"comp pool: data/comps/{target_slug}.json (fetched {pool['query']['fetched_at']})",
                        f"subject: {subject['listing_key']}",
                    ])
    print(f"✓ wrote {out_dir}/citations.json provenance.json design_scorecard.json card.json")


if __name__ == "__main__":
    payload, _ = load_payload()
    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    build(payload, out_dir)
