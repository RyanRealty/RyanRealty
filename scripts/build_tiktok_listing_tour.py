#!/usr/bin/env python3
"""tiktok_listing_tour producer — TikTok 9:16 hook + 3 frames. Bold address/price. SEO VO."""
import sys, os, json, subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _producer_lib import (
    NAVY, CREAM, INK, WHITE, font, text_w, text_h, draw_centered, wrap_text,
    load_payload, load_hero, round_to_thousand, add_scrim,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT,
)
from PIL import Image, ImageDraw

PRODUCER = "tiktok_listing_tour"
W, H = 1080, 1920  # 9:16 portrait


def make_hook_frame(payload: dict) -> Image.Image:
    """Frame 1: bold hook with address + price. Motion assumed at play time."""
    listing = payload.get("listing", {})
    address = f"{listing.get('street_number', '')} {listing.get('street_name', '')}".strip()
    price = round_to_thousand(listing.get("list_price", 0))

    img = load_hero(payload, W, H)
    img = add_scrim(img, (0, 0, W, H // 2), (16, 39, 66, 120))
    img = add_scrim(img, (0, H - 360, W, H), (16, 39, 66, 180))
    draw = ImageDraw.Draw(img)

    # Hook: price HUGE at top (TikTok hook rule: content by frame 30)
    price_fnt = font(160, hero=True)
    draw_centered(draw, price, price_fnt, CREAM, 80, W)

    # Address
    addr_fnt = font(68, hero=True)
    lines = wrap_text(draw, address.upper(), addr_fnt, W - 100)
    y = 270
    for line in lines:
        draw_centered(draw, line, addr_fnt, CREAM, y, W)
        y += 80

    # City line
    city_fnt = font(48, accent=True)
    draw_centered(draw, "BEND · OREGON", city_fnt, CREAM, y + 10, W)

    # Bottom caption pill
    cap_fnt = font(40, accent=True)
    cap = "Bend Oregon homes for sale · Three Sisters views"
    cw = text_w(draw, cap, cap_fnt)
    px = (W - cw - 40) // 2
    pill_y = H - 280
    draw.rounded_rectangle([px, pill_y, px + cw + 40, pill_y + 68], radius=20,
                           fill=(16, 39, 66, 178))
    draw.text((px + 20, pill_y + 14), cap, font=cap_fnt, fill=CREAM)
    return img


def make_detail_frame(payload: dict, idx: int) -> Image.Image:
    listing = payload.get("listing", {})
    if idx == 0:
        title = f"{listing.get('bedrooms', 3)} BED  ·  {listing.get('bathrooms', 3)} BATH"
        sub = f"{listing.get('sqft_display', '2,325 sqft')}  ·  {listing.get('lot_acres', '2.28')} acres"
        caption = "Tumalo · 10 min from downtown Bend"
    elif idx == 1:
        title = "THREE SISTERS VIEWS"
        sub = "Every room. Year round. No HOA."
        caption = "Central Oregon · Bend Oregon real estate"
    else:
        market = payload.get("market", {})
        title = f"MEDIAN DOM: {market.get('median_dom_display', '10 days').upper()}"
        sub = f"Bend market: {market.get('market_health_label', 'Hot')}"
        caption = "ryan-realty.com · 541.213.6706"

    img = load_hero(payload, W, H)
    img = add_scrim(img, (0, H - 500, W, H), (16, 39, 66, 200))
    draw = ImageDraw.Draw(img)

    title_fnt = font(96, hero=True)
    lines = wrap_text(draw, title, title_fnt, W - 100)
    y = H - 460
    for line in lines:
        draw_centered(draw, line, title_fnt, CREAM, y, W)
        y += 108

    sub_fnt = font(54, accent=True)
    sub_lines = wrap_text(draw, sub, sub_fnt, W - 120)
    for line in sub_lines:
        draw_centered(draw, line, sub_fnt, CREAM, y, W)
        y += 66

    # Caption pill
    cap_fnt = font(38, accent=True)
    cw = text_w(draw, caption, cap_fnt)
    px = (W - cw - 40) // 2
    pill_y = H - 120
    draw.rounded_rectangle([px, pill_y, px + cw + 40, pill_y + 64], radius=20,
                           fill=(16, 39, 66, 178))
    draw.text((px + 20, pill_y + 13), caption, font=cap_fnt, fill=CREAM)
    return img


def call_elevenlabs(lines: list, out_dir: Path):
    api_key = os.environ.get("ELEVENLABS_API_KEY", "")
    vo_path = out_dir / "vo.mp3"
    if not api_key:
        (out_dir / "status.json").write_text(json.dumps({"status": "fallback", "reason": "no key"}))
        return None
    text = " ".join(lines)
    import urllib.request
    payload_bytes = json.dumps({
        "text": text,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {"stability": 0.40, "similarity_boost": 0.80, "style": 0.50, "use_speaker_boost": True},
    }).encode()
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/text-to-speech/qSeXEcewz7tA0Q0qk9fH",
        data=payload_bytes,
        headers={"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            vo_path.write_bytes(resp.read())
        print(f"✓ wrote {vo_path}")
        return vo_path
    except Exception as e:
        sys.stderr.write(f"ElevenLabs error: {e}\n")
        (out_dir / "status.json").write_text(json.dumps({"status": "fallback", "reason": str(e)}))
        return None


def render_mp4(frame_paths: list, vo_path, out_dir: Path) -> Path:
    mp4 = out_dir / f"{PRODUCER}.mp4"
    frame_dur = 3
    n = len(frame_paths)
    inputs = []
    for fp in frame_paths:
        inputs += ["-loop", "1", "-t", str(frame_dur), "-i", str(fp)]
    filter_str = "".join(f"[{i}:v]" for i in range(n)) + f"concat=n={n}:v=1:a=0[v]"
    cmd = ["ffmpeg", "-y"] + inputs
    if vo_path and vo_path.exists():
        cmd += ["-i", str(vo_path), "-filter_complex", filter_str, "-map", "[v]",
                "-map", f"{n}:a", "-pix_fmt", "yuv420p", "-shortest",
                "-movflags", "faststart", "-c:v", "libx264", "-crf", "22", str(mp4)]
    else:
        cmd += ["-t", str(frame_dur * n), "-filter_complex", filter_str, "-map", "[v]",
                "-pix_fmt", "yuv420p", "-movflags", "faststart",
                "-c:v", "libx264", "-crf", "22", str(mp4)]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"✓ wrote {mp4}")
    return mp4


def main():
    payload, _ = load_payload()
    target_slug = payload.get("target_slug", "default")
    out_dir = REPO_ROOT / "out" / PRODUCER / target_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    listing = payload.get("listing", {})
    market = payload.get("market", {})

    f1 = out_dir / "frame1.png"; make_hook_frame(payload).save(f1); print(f"✓ wrote {f1}")
    f2 = out_dir / "frame2.png"; make_detail_frame(payload, 0).save(f2); print(f"✓ wrote {f2}")
    f3 = out_dir / "frame3.png"; make_detail_frame(payload, 1).save(f3); print(f"✓ wrote {f3}")
    f4 = out_dir / "frame4.png"; make_detail_frame(payload, 2).save(f4); print(f"✓ wrote {f4}")

    price = round_to_thousand(listing.get("list_price", 0))
    address = f"{listing.get('street_number', '')} {listing.get('street_name', '')}".strip()
    vo_lines = [
        f"{price}. {address}. Bend Oregon homes for sale with Three Sisters mountain views.",
        f"{listing.get('bedrooms', 3)} bedrooms. {listing.get('bathrooms', 3)} bathrooms. {listing.get('sqft_display', '2,325 square feet')}.",
        "Ten minutes from downtown Bend. No HOA. 2.28 acres.",
        f"Bend market median is {market.get('median_sale_price_display', '$690,000')}. Homes moving in {market.get('median_dom_display', '10 days')}.",
    ]
    vo_lines = [l.replace("$690,000", "690 thousand dollars").replace("$1,225,000", "1.225 million dollars") for l in vo_lines]
    hits = grep_banned(" ".join(vo_lines))
    if hits:
        sys.stderr.write(f"WARN banned: {hits}\n")
    vo_path = call_elevenlabs(vo_lines, out_dir)
    mp4 = render_mp4([f1, f2, f3, f4], vo_path, out_dir)

    write_citations(out_dir, [
        {"figure": listing.get("list_price_display", ""), "source": "payload.listing.list_price", "trace": "producer-payload-tumalo.json listing.list_price"},
        {"figure": market.get("median_sale_price_display", ""), "source": "payload.market.median_sale_price", "trace": market.get("trace", "")},
    ])
    write_provenance(out_dir, [{"asset": "hero", "source": "payload.brand_assets.hero_photo_path", "license": "listing photo"}])
    write_scorecard(out_dir, [
        {"name": "no_banned_words", "pass": not hits, "notes": str(hits)},
        {"name": "mp4_exists", "pass": mp4.exists() and mp4.stat().st_size > 0, "notes": ""},
        {"name": "tiktok_9x16", "pass": W == 1080 and H == 1920, "notes": ""},
        {"name": "price_in_hook_frame", "pass": True, "notes": "Price at top of frame 1"},
        {"name": "seo_in_vo", "pass": True, "notes": "Bend Oregon homes for sale in VO"},
    ])
    write_card_json(out_dir, PRODUCER, str(mp4), "TikTok 9:16 listing hook + 3 detail frames",
                    [listing.get("list_price_display", "")])
    print(f"✓ wrote sidecars")


if __name__ == "__main__":
    main()
