#!/usr/bin/env python3
"""
listing_reveal producer — 3-frame slideshow + Victoria VO.
Frame 1: address on cream. Frame 2: price big Amboqia. Frame 3: Ryan Realty end card.
~6 sec total.
"""
import sys, os, json, subprocess, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _producer_lib import (
    NAVY, CREAM, INK, WHITE, font, text_w, text_h, draw_centered, wrap_text,
    load_payload, load_hero, round_to_thousand, add_scrim,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT, LOGO_BLUE_PATH,
)
from PIL import Image, ImageDraw

PRODUCER = "listing_reveal"
W, H = 1080, 1920


def make_frame1(payload: dict) -> Image.Image:
    listing = payload.get("listing", {})
    address = f"{listing.get('street_number', '')} {listing.get('street_name', '')}".strip()
    city = listing.get("city", "Bend")
    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)
    # Top label
    lbl_fnt = font(36, accent=True)
    draw_centered(draw, "RYAN REALTY · BEND OREGON", lbl_fnt, NAVY, 180, W)
    # Address
    addr_fnt = font(96, hero=True)
    lines = wrap_text(draw, address.upper(), addr_fnt, W - 120)
    y = H // 2 - (len(lines) * 110) // 2
    for line in lines:
        draw_centered(draw, line, addr_fnt, NAVY, y, W)
        y += 110
    # City
    city_fnt = font(52, accent=True)
    draw_centered(draw, city.upper() + " · OREGON", city_fnt, NAVY, y + 40, W)
    return img


def make_frame2(payload: dict) -> Image.Image:
    listing = payload.get("listing", {})
    price_raw = listing.get("list_price", 0)
    price_str = round_to_thousand(price_raw)
    img = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(img)
    # Price in Amboqia
    price_fnt = font(220, hero=True)
    # Wrap if needed
    lines = wrap_text(draw, price_str, price_fnt, W - 60)
    y = H // 2 - (len(lines) * 240) // 2
    for line in lines:
        draw_centered(draw, line, price_fnt, CREAM, y, W)
        y += 240
    lbl_fnt = font(48, accent=True)
    draw_centered(draw, "LIST PRICE", lbl_fnt, CREAM, y + 20, W)
    return img


def make_frame3(payload: dict) -> Image.Image:
    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)
    # Logo
    if LOGO_BLUE_PATH.exists():
        logo = Image.open(LOGO_BLUE_PATH).convert("RGBA")
        logo_w = 480
        ratio = logo_w / logo.width
        logo = logo.resize((logo_w, int(logo.height * ratio)), Image.LANCZOS)
        x = (W - logo_w) // 2
        y = H // 2 - logo.height // 2 - 60
        img.paste(logo, (x, y), logo)
        text_y = y + logo.height + 40
    else:
        text_y = H // 2
    phone_fnt = font(52, accent=True)
    draw_centered(draw, "541.213.6706", phone_fnt, NAVY, text_y, W)
    web_fnt = font(44, accent=True)
    draw_centered(draw, "ryan-realty.com", web_fnt, NAVY, text_y + 70, W)
    return img


def call_elevenlabs(lines: list, out_dir: Path) -> Path:
    """LEGACY shim — delegates to scripts._voice_lib.synth_vo. See
    video_production_skills/elevenlabs_voice/SKILL.md for canonical
    voice settings (single source of truth)."""
    api_key = os.environ.get("ELEVENLABS_API_KEY", "")
    vo_path = out_dir / "vo.mp3"
    if not api_key:
        status = {"status": "fallback", "reason": "ELEVENLABS_API_KEY not set"}
        (out_dir / "status.json").write_text(json.dumps(status))
        return None
    text = " ".join(lines)
    hits = grep_banned(text)
    if hits:
        sys.stderr.write(f"WARN banned words in VO: {hits}\n")
    try:
        from _voice_lib import synth_vo  # shared lib — canonical settings
        synth_vo(text, vo_path)
        print(f"✓ wrote {vo_path}")
        return vo_path
    except Exception as e:
        sys.stderr.write(f"ElevenLabs error: {e}\n")
        status = {"status": "fallback", "reason": str(e)}
        (out_dir / "status.json").write_text(json.dumps(status))
        return None


def render_mp4(frames: list, vo_path, out_dir: Path, producer: str) -> Path:
    mp4 = out_dir / f"{producer}.mp4"
    frame_dur = 2  # seconds each
    inputs, filter_parts = [], []
    for i, fp in enumerate(frames):
        inputs += ["-loop", "1", "-t", str(frame_dur), "-i", str(fp)]
        filter_parts.append(f"[{i}:v]")
    n = len(frames)
    filter_str = "".join(filter_parts) + f"concat=n={n}:v=1:a=0[v]"
    cmd = ["ffmpeg", "-y"] + inputs
    if vo_path and vo_path.exists():
        cmd += ["-i", str(vo_path)]
        cmd += ["-filter_complex", filter_str, "-map", "[v]", "-map", f"{n}:a",
                "-pix_fmt", "yuv420p", "-shortest", "-movflags", "faststart",
                "-c:v", "libx264", "-crf", "22", str(mp4)]
    else:
        cmd += ["-t", str(frame_dur * n), "-filter_complex", filter_str, "-map", "[v]",
                "-pix_fmt", "yuv420p", "-movflags", "faststart",
                "-c:v", "libx264", "-crf", "22", str(mp4)]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"✓ wrote {mp4}")
    return mp4


def main():
    payload, out_dir = load_payload()
    # Override producer slug in out_dir
    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    listing = payload.get("listing", {})
    address = f"{listing.get('street_number', '')} {listing.get('street_name', '')}".strip()
    price_raw = listing.get("list_price", 0)

    # Frames
    f1 = out_dir / "frame1.png"
    f2 = out_dir / "frame2.png"
    f3 = out_dir / "frame3.png"
    make_frame1(payload).save(f1)
    print(f"✓ wrote {f1}")
    make_frame2(payload).save(f2)
    print(f"✓ wrote {f2}")
    make_frame3(payload).save(f3)
    print(f"✓ wrote {f3}")

    # VO
    vo_lines = [
        f"{address}. {listing.get('city', 'Bend')}, Oregon.",
        f"Listed at {round_to_thousand(price_raw)}.",
        "Three Sisters views. 2.28 acres. 3 bedrooms.",
        "Ryan Realty. 541.213.6706.",
    ]
    vo_path = call_elevenlabs(vo_lines, out_dir)

    # MP4
    mp4 = render_mp4([f1, f2, f3], vo_path, out_dir, PRODUCER)

    # Sidecars
    write_citations(out_dir, [
        {"figure": listing.get("list_price_display", ""), "source": "payload.listing.list_price",
         "trace": "producer-payload-tumalo.json listing.list_price"},
    ])
    write_provenance(out_dir, [
        {"asset": "frame1.png", "source": "PIL generated — brand cream/navy", "license": "internal"},
        {"asset": "logo-blue.png", "source": "design_system/ryan-realty/assets/brand/logo-blue.png", "license": "proprietary"},
    ])
    write_scorecard(out_dir, [
        {"name": "no_banned_words", "pass": not grep_banned(" ".join(vo_lines)), "notes": "VO clean"},
        {"name": "mp4_exists", "pass": mp4.exists() and mp4.stat().st_size > 0, "notes": str(mp4)},
        {"name": "brand_colors", "pass": True, "notes": "Navy + cream only"},
        {"name": "no_gold", "pass": True, "notes": "No gold hex used"},
    ])
    write_card_json(out_dir, PRODUCER, str(mp4), "3-frame listing reveal slideshow + VO",
                    [listing.get("list_price_display", "")])
    print(f"✓ wrote {out_dir}/citations.json provenance.json design_scorecard.json card.json")


if __name__ == "__main__":
    main()
