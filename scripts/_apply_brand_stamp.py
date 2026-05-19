#!/usr/bin/env python3
"""
Brand-compliance post-pass — iterates over every primary image output under
out/<producer>/<target>/ and stamps the canonical Ryan Realty brand bar at
the bottom of the image. Idempotent (marks each image with a tiny metadata
field so it doesn't double-stamp).

Run from repo root:
    python3 scripts/_apply_brand_stamp.py

What it stamps:
- All PNG/JPG primary artifacts listed in card.json
- Skips MP4 (video producers handle brand internally via Remotion/end-cards)
- Skips HTML / MD / TSX / JSON (those are handled by the HTML brand-CSS injector)
- Skips images that already have the brand stamp (by exif marker)

Style choices:
- 1080×1920 portrait → heritage stamp at bottom 7.5%
- 1080×1350 IG portrait → heritage stamp at bottom 8%
- 1080×1080 square → heritage stamp at bottom 8%
- Wider formats (postcard 1800×1200) → heritage stamp at bottom 10%
- Image dominated by hero photo bottom → use light style (cream-on-navy already there)
"""
from pathlib import Path
from PIL import Image
import json
import sys

REPO_ROOT = Path("/Users/matthewryan/RyanRealty")
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from _producer_lib import brand_stamp  # type: ignore

OUT_DIR = REPO_ROOT / "out"
TARGET_SLUG = "19496-tumalo-reservoir-rd"

# Producer subfolder slugs to scan (everything in producer-inventory.mjs that
# produces a primary image artifact)
IMAGE_PRODUCERS = [
    # Section B - image producers
    "testimonial_card", "map_static_card", "yard_sign_rider",
    "postcard_farm_mailer", "under_contract_announcement",
    "sold_deal_summary", "floor_plan_render", "meme_lord",
    "comparable_grid", "open_house_stories", "coming_soon_teaser",
    "neighbor_outreach_note", "linkedin_document_carousel",
    "meta_creative_variant", "nextdoor_business_ad", "virtual_staging",
    # Wave 6 wrappers
    "broker-contact-card", "facebook-lead-gen-ad",
    # Wave 7 existing-asset wrappers — these are pre-rendered assets we don't re-stamp
    # (they came with their own canonical branding from list-kit / v5_library)
    # Skip: listing_tour_video, neighborhood_tour, market_data_video, market_pulse_short,
    #       market_report_video, cma, flyer_design, ig_single_post
]


def already_stamped(img_path: Path) -> bool:
    """Check if image has our stamp marker in EXIF."""
    try:
        with Image.open(img_path) as img:
            return "ryan-realty-brand-stamp" in (img.info.get("Description", "") or "")
    except Exception:
        return False


def stamp_image(img_path: Path) -> tuple[bool, str]:
    """Stamp the image at img_path. Returns (changed, message)."""
    if already_stamped(img_path):
        return (False, "already stamped")
    try:
        img = Image.open(img_path).convert("RGB")
    except Exception as e:
        return (False, f"open failed: {e}")

    W, H = img.size
    if H >= 1800:
        height_pct = 0.075   # tall portrait
    elif H >= 1200:
        height_pct = 0.08
    else:
        height_pct = 0.10    # short — bigger bar relatively

    stamped = brand_stamp(img, style="heritage", height_pct=height_pct)
    # Embed marker via PNG/JPEG metadata
    if img_path.suffix.lower() in (".jpg", ".jpeg"):
        stamped.save(img_path, "JPEG", quality=92, exif=b"ryan-realty-brand-stamp")
    else:
        stamped.save(img_path, "PNG")
        # Re-open to write description text chunk
        try:
            with Image.open(img_path) as im2:
                from PIL.PngImagePlugin import PngInfo
                meta = PngInfo()
                meta.add_text("Description", "ryan-realty-brand-stamp")
                im2.save(img_path, "PNG", pnginfo=meta)
        except Exception:
            pass
    return (True, f"stamped {W}x{H}")


def list_primary_images(producer_dir: Path) -> list[Path]:
    """Find all primary image files in a producer's output dir."""
    if not producer_dir.is_dir():
        return []
    files = []
    for ext in ("*.png", "*.jpg", "*.jpeg"):
        files.extend(producer_dir.glob(ext))
    return sorted(files)


def main():
    print(f"Brand-stamp pass over {len(IMAGE_PRODUCERS)} producers")
    print("=" * 60)
    total_stamped = 0
    total_skipped = 0
    for slug in IMAGE_PRODUCERS:
        producer_dir = OUT_DIR / slug / TARGET_SLUG
        if not producer_dir.exists():
            print(f"  {slug}: NO OUTPUT DIR — skipping")
            continue
        images = list_primary_images(producer_dir)
        if not images:
            print(f"  {slug}: no images")
            continue
        stamped = 0
        skipped = 0
        for img_path in images:
            changed, msg = stamp_image(img_path)
            if changed:
                stamped += 1
            else:
                skipped += 1
        print(f"  {slug}: {stamped} stamped, {skipped} skipped")
        total_stamped += stamped
        total_skipped += skipped
    print("=" * 60)
    print(f"Total: {total_stamped} stamped, {total_skipped} skipped")


if __name__ == "__main__":
    main()
