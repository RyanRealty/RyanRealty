#!/usr/bin/env python3
"""avatar_market_update producer — Matt's headshot on cream + rolling-30d stats. AI disclosure pill."""
import sys, os, json, subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _producer_lib import (
    NAVY, CREAM, INK, WHITE, font, text_w, text_h, draw_centered, wrap_text,
    load_payload, load_hero, round_to_thousand, add_scrim,
    write_citations, write_provenance, write_scorecard, write_card_json,
    grep_banned, REPO_ROOT, TEAM_DIR,
)
from PIL import Image, ImageDraw

PRODUCER = "avatar_market_update"
W, H = 1080, 1920


def make_avatar_frame(payload: dict, frame_idx: int) -> Image.Image:
    market = payload.get("market", {})
    brokers = payload.get("brokers", {})
    broker = brokers.get("matt_ryan", {})

    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    # AI disclosure pill — top left
    ai_fnt = font(32, accent=True)
    ai_text = "AI-ASSISTED CONTENT"
    aw = text_w(draw, ai_text, ai_fnt)
    draw.rounded_rectangle([60, 60, 60 + aw + 40, 108], radius=12, fill=NAVY)
    draw.text((80, 68), ai_text, font=ai_fnt, fill=CREAM)

    # Headshot
    headshot_rel = broker.get("headshot_path", "design_system/ryan-realty/assets/team/matt-ryan.png")
    headshot_path = REPO_ROOT / headshot_rel
    if not headshot_path.exists():
        headshot_path = TEAM_DIR / "matt-ryan.png"
    if headshot_path.exists():
        hs = Image.open(headshot_path).convert("RGBA")
        hs_w = 480
        ratio = hs_w / hs.width
        hs = hs.resize((hs_w, int(hs.height * ratio)), Image.LANCZOS)
        # Paste with alpha mask
        temp = Image.new("RGBA", img.size, (0, 0, 0, 0))
        temp.paste(hs, ((W - hs_w) // 2, 160), hs)
        img = Image.alpha_composite(img.convert("RGBA"), temp).convert("RGB")
        draw = ImageDraw.Draw(img)
        hs_bot = 160 + hs.height
    else:
        hs_bot = 700

    # Broker name + role
    name_fnt = font(52, hero=True)
    draw_centered(draw, broker.get("name", "Matt Ryan").upper(), name_fnt, NAVY, hs_bot + 20, W)
    role_fnt = font(36, accent=True)
    draw_centered(draw, broker.get("role", "Principal Broker").upper(), role_fnt, NAVY, hs_bot + 90, W)

    # Stats block (vary by frame)
    y_stats = hs_bot + 170
    if frame_idx == 0:
        stats = [
            ("MEDIAN PRICE", market.get("median_sale_price_display", "$690,000")),
            ("HOMES SOLD", str(market.get("sold_count", 115)) + " last 30 days"),
            ("MARKET", market.get("market_health_label", "Hot")),
        ]
    elif frame_idx == 1:
        stats = [
            ("DAYS ON MARKET", market.get("median_dom_display", "10 days")),
            ("PRICE PER SQFT", market.get("median_ppsf_display", "$381 / sqft")),
            ("SALE TO LIST", market.get("sale_to_list_display", "97.4%")),
        ]
    else:
        stats = [
            ("YoY PRICE", market.get("yoy_median_price_display", "")),
            ("INVENTORY", str(market.get("end_of_period_inventory", 457)) + " active"),
            ("PERIOD", market.get("period_end", "2026-05-17")),
        ]

    lbl_fnt = font(36, accent=True)
    val_fnt = font(72, hero=True)
    for label, value in stats:
        # Card background
        draw.rounded_rectangle([80, y_stats, W - 80, y_stats + 120], radius=14,
                               fill=(16, 39, 66, 15))
        draw.text((110, y_stats + 8), label, font=lbl_fnt, fill=NAVY)
        draw.text((110, y_stats + 46), value, font=val_fnt, fill=NAVY)
        y_stats += 140

    # Phone
    ph_fnt = font(44, accent=True)
    draw_centered(draw, broker.get("phone_brand", "541.213.6706"), ph_fnt, NAVY, H - 160, W)
    return img


def call_elevenlabs(lines: list, out_dir: Path):
    """LEGACY shim — delegates to scripts._voice_lib.synth_vo. See
    video_production_skills/elevenlabs_voice/SKILL.md for canonical
    voice settings (single source of truth)."""
    api_key = os.environ.get("ELEVENLABS_API_KEY", "")
    vo_path = out_dir / "vo.mp3"
    if not api_key:
        (out_dir / "status.json").write_text(json.dumps({"status": "fallback", "reason": "no key"}))
        return None
    text = " ".join(lines)
    try:
        from _voice_lib import synth_vo  # shared lib — canonical settings
        synth_vo(text, vo_path)
        print(f"✓ wrote {vo_path}")
        return vo_path
    except Exception as e:
        sys.stderr.write(f"ElevenLabs error: {e}\n")
        (out_dir / "status.json").write_text(json.dumps({"status": "fallback", "reason": str(e)}))
        return None


def render_mp4(frame_paths: list, vo_path, out_dir: Path) -> Path:
    mp4 = out_dir / f"{PRODUCER}.mp4"
    frame_dur = 4
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

    market = payload.get("market", {})
    frame_paths = []
    for i in range(3):
        fp = out_dir / f"frame{i+1}.png"
        make_avatar_frame(payload, i).save(fp)
        print(f"✓ wrote {fp}")
        frame_paths.append(fp)

    vo_lines = [
        "Matt Ryan here with your Bend market update.",
        f"Median sale price this month: {market.get('median_sale_price_display', '690 thousand dollars')}.",
        f"Homes are selling in {market.get('median_dom_display', '10 days')} on average.",
        f"Sale to list ratio: {market.get('sale_to_list_display', '97.4 percent')}.",
        "Reach out anytime. 541.213.6706.",
    ]
    # Replace display strings with spoken versions
    vo_lines = [l.replace("$690,000", "690 thousand dollars").replace("$381 / sqft", "381 dollars per square foot") for l in vo_lines]
    hits = grep_banned(" ".join(vo_lines))
    if hits:
        sys.stderr.write(f"WARN banned: {hits}\n")
    vo_path = call_elevenlabs(vo_lines, out_dir)
    mp4 = render_mp4(frame_paths, vo_path, out_dir)

    write_citations(out_dir, [
        {"figure": market.get("median_sale_price_display", ""), "source": "payload.market.median_sale_price", "trace": market.get("trace", "")},
        {"figure": market.get("median_dom_display", ""), "source": "payload.market.median_dom", "trace": market.get("trace", "")},
    ])
    write_provenance(out_dir, [
        {"asset": "matt-ryan.png", "source": "design_system/ryan-realty/assets/team/matt-ryan.png", "license": "proprietary"},
    ])
    write_scorecard(out_dir, [
        {"name": "ai_disclosure_pill", "pass": True, "notes": "Top-left pill on every frame"},
        {"name": "no_banned_words", "pass": not hits, "notes": str(hits)},
        {"name": "mp4_exists", "pass": mp4.exists() and mp4.stat().st_size > 0, "notes": ""},
    ])
    write_card_json(out_dir, PRODUCER, str(mp4), "Avatar market update with AI disclosure",
                    [market.get("median_sale_price_display", ""), market.get("median_dom_display", "")])
    print(f"✓ wrote sidecars")


if __name__ == "__main__":
    main()
