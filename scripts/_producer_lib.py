#!/usr/bin/env python3
"""
Shared producer library — used by every `scripts/build_<producer>.py` to read
payload JSON, load brand fonts, render brand-compliant primitives, and write
the canonical sidecars (citations.json, provenance.json, design_scorecard.json,
card.json) per the producer template.

Conventions:
- Every producer script is invoked as: `python3 scripts/build_<producer>.py <payload.json> [--out <dir>]`
- payload.json is the marketing_brain_actions payload field (see schema below)
- Output lands at out/<producer-slug>/<target-slug>/ unless --out overrides
- Brand assets are at design_system/ryan-realty/

Payload schema (canonical):
{
  "producer": "testimonial_card",
  "target": "mls:20260225192329433521000000",
  "target_slug": "19496-tumalo-reservoir-rd",
  "listing": { ListingKey, StreetNumber, StreetName, City, ListPrice, ... },
  "market": { period_end, median_sale_price, median_dom, ... },
  "brokers": { matt_ryan: {name, email, phone_brand, ...}, ... },
  "brand_assets": { hero_photo_path, logo_blue_path, ... },
  "extras": { ... producer-specific extras ... }
}
"""

from __future__ import annotations
import json
import sys
import argparse
import hashlib
import datetime
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# ── Brand constants ──────────────────────────────────────────────────────────
NAVY = (16, 39, 66)
NAVY_DEEP = (10, 26, 46)
CREAM = (250, 248, 244)
INK = (26, 26, 26)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)

REPO_ROOT = Path("/Users/matthewryan/RyanRealty")
BRAND_DIR = REPO_ROOT / "design_system" / "ryan-realty"
AMBOQIA_PATH = BRAND_DIR / "fonts" / "Amboqia_Boriango.otf"
AZO_PATH = BRAND_DIR / "fonts" / "AzoSans-Medium.ttf"
LOGO_BLUE_PATH = BRAND_DIR / "assets" / "brand" / "logo-blue.png"
LOGO_WHITE_PATH = BRAND_DIR / "assets" / "brand" / "logo-white.png"
TEAM_DIR = BRAND_DIR / "assets" / "team"
HERO_FALLBACK = BRAND_DIR / "assets" / "hero" / "hero-old-mill-master-4k.jpg"


def font(size: int, hero: bool = False, accent: bool = False) -> ImageFont.FreeTypeFont:
    """Load Amboqia (hero=True), AzoSans (accent=True), or Helvetica fallback."""
    if hero and AMBOQIA_PATH.exists():
        return ImageFont.truetype(str(AMBOQIA_PATH), size)
    if accent and AZO_PATH.exists():
        return ImageFont.truetype(str(AZO_PATH), size)
    for f in [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Avenir.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def text_w(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> int:
    bbox = draw.textbbox((0, 0), text, font=fnt)
    return bbox[2] - bbox[0]


def text_h(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> int:
    bbox = draw.textbbox((0, 0), text, font=fnt)
    return bbox[3] - bbox[1]


def draw_centered(draw: ImageDraw.ImageDraw, text: str, fnt, fill, y: int, canvas_w: int):
    w = text_w(draw, text, fnt)
    draw.text(((canvas_w - w) // 2, y), text, font=fnt, fill=fill)


def wrap_text(draw, text: str, fnt, max_w: int) -> list[str]:
    """Word-wrap text to fit max_w in pixels."""
    words = text.split()
    lines = []
    cur = []
    for word in words:
        test = " ".join(cur + [word])
        if text_w(draw, test, fnt) > max_w and cur:
            lines.append(" ".join(cur))
            cur = [word]
        else:
            cur.append(word)
    if cur:
        lines.append(" ".join(cur))
    return lines


def load_payload(args=None) -> tuple[dict, Path]:
    """Parse CLI args, load payload JSON, return (payload, out_dir)."""
    parser = argparse.ArgumentParser(description="Producer script")
    parser.add_argument("payload", type=str, help="Path to payload.json")
    parser.add_argument("--out", type=str, default=None, help="Output directory override")
    parsed = parser.parse_args(args)

    payload_path = Path(parsed.payload).resolve()
    if not payload_path.exists():
        sys.stderr.write(f"ERROR: payload not found: {payload_path}\n")
        sys.exit(1)
    payload = json.loads(payload_path.read_text())

    producer = payload.get("producer", "unknown")
    target_slug = payload.get("target_slug", "default")
    out_dir = Path(parsed.out) if parsed.out else REPO_ROOT / "out" / producer / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    return payload, out_dir


def load_hero(payload: dict, target_w: int, target_h: int) -> Image.Image:
    """Load the listing hero photo (or fallback) and smart-crop to target dims."""
    hero_path_str = (
        payload.get("brand_assets", {}).get("hero_photo_path")
        or payload.get("listing", {}).get("primary_photo_path")
    )
    if hero_path_str:
        p = Path(hero_path_str)
        if not p.is_absolute():
            p = REPO_ROOT / p
        if p.exists():
            return _smart_crop(Image.open(p).convert("RGB"), target_w, target_h)
    if HERO_FALLBACK.exists():
        return _smart_crop(Image.open(HERO_FALLBACK).convert("RGB"), target_w, target_h)
    img = Image.new("RGB", (target_w, target_h), CREAM)
    return img


def _smart_crop(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    sw, sh = img.size
    sa, ta = sw / sh, target_w / target_h
    if sa > ta:
        new_w = int(sh * ta)
        left = (sw - new_w) // 2
        img = img.crop((left, 0, left + new_w, sh))
    else:
        new_h = int(sw / ta)
        top = int((sh - new_h) * 0.35)
        img = img.crop((0, top, sw, top + new_h))
    return img.resize((target_w, target_h), Image.LANCZOS)


def round_to_thousand(n: float) -> str:
    """Format currency rounded to nearest thousand per brand-voice rule."""
    n = int(round(n / 1000.0)) * 1000
    return f"${n:,}"


# ── Sidecar writers per producer template §6 ─────────────────────────────────

def write_citations(out_dir: Path, figures: list[dict]) -> Path:
    """citations.json: every figure shown traces to a primary source."""
    p = out_dir / "citations.json"
    p.write_text(json.dumps({"figures": figures}, indent=2))
    return p


def write_provenance(out_dir: Path, assets: list[dict]) -> Path:
    """provenance.json: every photo / font / asset traces to its source + license."""
    p = out_dir / "provenance.json"
    p.write_text(json.dumps({"assets": assets}, indent=2))
    return p


def write_scorecard(out_dir: Path, checks: list[dict]) -> Path:
    """design_scorecard.json: QA results. Each check has name + pass + notes."""
    passed = sum(1 for c in checks if c.get("pass"))
    total = len(checks)
    payload = {
        "passed": passed,
        "total": total,
        "score_pct": round(100.0 * passed / max(total, 1), 1),
        "checks": checks,
    }
    p = out_dir / "design_scorecard.json"
    p.write_text(json.dumps(payload, indent=2))
    return p


def write_card_json(out_dir: Path, producer: str, primary_artifact: str, notes: str,
                    data_traces: list[str], **kwargs) -> Path:
    """card.json: contact-sheet manifest entry per producer."""
    p = out_dir / "card.json"
    body = {
        "producer": producer,
        "primary_artifact": primary_artifact,
        "notes": notes,
        "data_traces": data_traces,
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
    }
    body.update(kwargs)
    p.write_text(json.dumps(body, indent=2))
    return p


# ── Banned-word grep per voice_guidelines.md §6.2 ────────────────────────────

BANNED_WORDS = {
    # Real-estate clichés
    "stunning", "breathtaking", "gorgeous", "charming", "pristine", "nestled",
    "boasts", "must-see", "dream home", "meticulously maintained",
    "entertainer's dream", "tucked away", "hidden gem", "truly", "spacious",
    "cozy", "luxurious", "updated throughout", "turnkey", "immaculate",
    "captivating", "exquisite",
    # AI filler
    "delve", "leverage", "tapestry", "navigate", "robust", "seamless",
    "comprehensive", "elevate", "unlock", "holistic", "dynamic", "vibrant",
    "bustling", "eclectic", "curated", "bespoke", "foster",
    # Marketing slop
    "top producing", "top 1 percent", "white glove", "luxury concierge",
    "premier brokerage", "boutique brokerage", "your real estate journey",
    "we are passionate about", "we pride ourselves on",
    # Vague hedges
    "approximately", "roughly", "fairly", "somewhat",
    # Fake urgency
    "act fast", "don't miss out", "won't last long",
}


def grep_banned(text: str) -> list[str]:
    """Return banned words found in text (lowercased substring match)."""
    t = text.lower()
    return sorted(b for b in BANNED_WORDS if b in t)


# ── Geometry helpers ────────────────────────────────────────────────────────

def rounded_rectangle(draw: ImageDraw.ImageDraw, xy, radius: int, fill=None, outline=None, width=1):
    """PIL.ImageDraw rounded_rectangle is available 9.4+; alias for clarity."""
    return draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def add_scrim(img: Image.Image, xy, fill_rgba):
    """Overlay a translucent rectangle on the image. xy is (l, t, r, b)."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(overlay).rectangle(xy, fill=fill_rgba)
    return Image.alpha_composite(img, overlay).convert("RGB")


if __name__ == "__main__":
    print("This is a library — import it from a producer script.")
    sys.exit(0)
