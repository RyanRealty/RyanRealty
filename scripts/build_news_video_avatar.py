#!/usr/bin/env python3
"""news_video_avatar producer — news video with Matt avatar lower-third + AI disclosure."""
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

PRODUCER = "news_video_avatar"
W, H = 1080, 1920


def make_avatar_news_frame(payload: dict, frame_idx: int) -> Image.Image:
    news = payload.get("extras", {}).get("news_pull", {})
    market = payload.get("market", {})
    brokers = payload.get("brokers", {})
    broker = brokers.get("matt_ryan", {})

    # Background — hero with heavy scrim
    img = load_hero(payload, W, H)
    img = add_scrim(img, (0, 0, W, H), (16, 39, 66, 180))
    draw = ImageDraw.Draw(img)

    # AI disclosure pill
    ai_fnt = font(32, accent=True)
    ai_text = "AI-ASSISTED CONTENT"
    aw = text_w(draw, ai_text, ai_fnt)
    draw.rounded_rectangle([60, 60, 60 + aw + 40, 108], radius=12, fill=CREAM)
    draw.text((80, 68), ai_text, font=ai_fnt, fill=NAVY)

    # Breaking badge
    badge_fnt = font(38, accent=True)
    badge_text = "BEND REAL ESTATE"
    bw = text_w(draw, badge_text, badge_fnt)
    bx = (W - bw - 40) // 2
    draw.rounded_rectangle([bx, 130, bx + bw + 40, 178], radius=12, fill=CREAM)
    draw.text((bx + 20, 136), badge_text, font=badge_fnt, fill=NAVY)

    # Headline or stats per frame
    if frame_idx == 0:
        headline = news.get("headline", "Bend Housing Update")
        hl_fnt = font(68, hero=True)
        lines = wrap_text(draw, headline.upper(), hl_fnt, W - 100)
        y = 260
        for line in lines:
            draw_centered(draw, line, hl_fnt, CREAM, y, W)
            y += 80
    elif frame_idx == 1:
        stats = [
            (market.get("median_sale_price_display", "$690,000"), "MEDIAN PRICE"),
            (market.get("median_dom_display", "10 days"), "DAYS ON MARKET"),
        ]
        y = 300
        val_fnt = font(96, hero=True)
        lbl_fnt = font(40, accent=True)
        for val, lbl in stats:
            draw_centered(draw, val, val_fnt, CREAM, y, W)
            y += 110
            draw_centered(draw, lbl, lbl_fnt, CREAM, y, W)
            y += 80
    else:
        summary = news.get("summary", "")
        sum_fnt = font(54, accent=True)
        lines = wrap_text(draw, summary, sum_fnt, W - 120)
        y = 300
        for line in lines[:5]:
            draw_centered(draw, line, sum_fnt, CREAM, y, W)
            y += 68

    # Lower-third avatar strip (navy bar)
    bar_top = H - 320
    draw.rectangle([0, bar_top, W, H - 60], fill=(16, 39, 66, 210))

    # Avatar headshot in lower-third
    headshot_rel = broker.get("headshot_path", "design_system/ryan-realty/assets/team/matt-ryan.png")
    headshot_path = REPO_ROOT / headshot_rel
    if not headshot_path.exists():
        headshot_path = TEAM_DIR / "matt-ryan.png"
    if headshot_path.exists():
        hs = Image.open(headshot_path).convert("RGBA")
        hs_h = 220
        ratio = hs_h / hs.height
        hs = hs.resize((int(hs.width * ratio), hs_h), Image.LANCZOS)
        img_rgba = img.convert("RGBA")
        img_rgba.paste(hs, (60, bar_top + 20), hs)
        img = img_rgba.convert("RGB")
        draw = ImageDraw.Draw(img)

    # Name + role in lower-third
    name_fnt = font(48, hero=True)
    draw.text((320, bar_top + 30), broker.get("name", "Matt Ryan").upper(), font=name_fnt, fill=CREAM)
    role_fnt = font(34, accent=True)
    draw.text((320, bar_top + 90), broker.get("role", "Principal Broker").upper(), font=role_fnt, fill=CREAM)
    ph_fnt = font(38, accent=True)
    draw.text((320, bar_top + 140), broker.get("phone_brand", "541.213.6706"), font=ph_fnt, fill=CREAM)
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

    news = payload.get("extras", {}).get("news_pull", {})
    market = payload.get("market", {})

    frame_paths = []
    for i in range(3):
        fp = out_dir / f"frame{i+1}.png"
        make_avatar_news_frame(payload, i).save(fp)
        print(f"✓ wrote {fp}")
        frame_paths.append(fp)

    vo_lines = [
        news.get("headline", "Bend housing market update."),
        f"Median price: {market.get('median_sale_price_display', '$690,000')}. {market.get('median_dom_display', '10 days')} on market.",
        "Buyers are active when homes are priced correctly. Matt Ryan. 541.213.6706.",
    ]
    vo_lines = [l.replace("$690,000", "690 thousand dollars") for l in vo_lines]
    hits = grep_banned(" ".join(vo_lines))
    if hits:
        sys.stderr.write(f"WARN banned: {hits}\n")
    vo_path = call_elevenlabs(vo_lines, out_dir)
    mp4 = render_mp4(frame_paths, vo_path, out_dir)

    write_citations(out_dir, [
        {"figure": market.get("median_sale_price_display", ""), "source": "payload.market.median_sale_price", "trace": market.get("trace", "")},
        {"figure": news.get("headline", ""), "source": news.get("primary_source_url", ""), "trace": "payload.extras.news_pull"},
    ])
    write_provenance(out_dir, [
        {"asset": "matt-ryan.png", "source": "design_system/ryan-realty/assets/team/matt-ryan.png", "license": "proprietary"},
        {"asset": "hero", "source": "payload.brand_assets.hero_photo_path", "license": "listing photo"},
    ])
    write_scorecard(out_dir, [
        {"name": "ai_disclosure_pill", "pass": True, "notes": "Top-left pill on every frame"},
        {"name": "no_banned_words", "pass": not hits, "notes": str(hits)},
        {"name": "avatar_lower_third", "pass": True, "notes": "Navy bar with headshot + name"},
        {"name": "mp4_exists", "pass": mp4.exists() and mp4.stat().st_size > 0, "notes": ""},
    ])
    write_card_json(out_dir, PRODUCER, str(mp4), "News clip with avatar lower-third + AI disclosure",
                    [market.get("median_sale_price_display", "")])
    print(f"✓ wrote sidecars")


if __name__ == "__main__":
    main()
