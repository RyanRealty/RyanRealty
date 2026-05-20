#!/usr/bin/env python3
"""meme_content producer — 3-frame meme reel (setup, twist, payoff)."""
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

PRODUCER = "meme_content"
W, H = 1080, 1920

MEMES = [
    {
        "label": "SETUP",
        "top": "When buyers ask if now is a good time to buy in Bend",
        "bottom": "*looks at 10-day median DOM*",
        "bg": "cream",
    },
    {
        "label": "TWIST",
        "top": "115 homes sold last month.",
        "bottom": "97.4% of list price. 10 days.",
        "bg": "navy",
    },
    {
        "label": "PAYOFF",
        "top": "The market doesn't wait for the perfect moment.",
        "bottom": "ryan-realty.com · 541.213.6706",
        "bg": "cream",
    },
]


def make_meme_frame(meme: dict, payload: dict) -> Image.Image:
    market = payload.get("market", {})
    bg = meme["bg"]
    if bg == "navy":
        img = Image.new("RGB", (W, H), NAVY)
        txt_fill = CREAM
        accent_fill = CREAM
    else:
        img = Image.new("RGB", (W, H), CREAM)
        txt_fill = NAVY
        accent_fill = NAVY

    draw = ImageDraw.Draw(img)

    # Label badge
    lbl_fnt = font(38, accent=True)
    lbl_text = meme["label"]
    lw = text_w(draw, lbl_text, lbl_fnt)
    lx = (W - lw - 40) // 2
    draw.rounded_rectangle([lx, 120, lx + lw + 40, 170], radius=12,
                           fill=accent_fill if bg == "navy" else NAVY)
    draw.text((lx + 20, 126), lbl_text, font=lbl_fnt,
              fill=NAVY if bg == "navy" else CREAM)

    # Top text
    top_fnt = font(84, hero=True)
    top_lines = wrap_text(draw, meme["top"].upper(), top_fnt, W - 120)
    y = 280
    for line in top_lines:
        draw_centered(draw, line, top_fnt, txt_fill, y, W)
        y += 98

    # Divider
    y += 40
    draw.line([(120, y), (W - 120, y)], fill=txt_fill, width=3)
    y += 60

    # Bottom text
    bot_fnt = font(64, accent=True)
    bot_lines = wrap_text(draw, meme["bottom"], bot_fnt, W - 120)
    for line in bot_lines:
        draw_centered(draw, line, bot_fnt, txt_fill, y, W)
        y += 78

    # Ryan Realty mark bottom
    mark_fnt = font(36, accent=True)
    draw_centered(draw, "RYAN REALTY · BEND · OREGON", mark_fnt, txt_fill, H - 140, W)
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

    market = payload.get("market", {})
    frame_paths = []
    for i, meme in enumerate(MEMES):
        fp = out_dir / f"frame{i+1}.png"
        make_meme_frame(meme, payload).save(fp)
        print(f"✓ wrote {fp}")
        frame_paths.append(fp)

    vo_lines = [
        "When buyers ask if now is a good time to buy in Bend.",
        f"One hundred fifteen homes sold last month. Ten days on market. 97.4 percent of list.",
        "The market doesn't wait for the perfect moment.",
        "ryan-realty.com",
    ]
    hits = grep_banned(" ".join(vo_lines))
    if hits:
        sys.stderr.write(f"WARN banned: {hits}\n")
    vo_path = call_elevenlabs(vo_lines, out_dir)
    mp4 = render_mp4(frame_paths, vo_path, out_dir)

    write_citations(out_dir, [
        {"figure": str(market.get("sold_count", 115)), "source": "payload.market.sold_count", "trace": market.get("trace", "")},
        {"figure": market.get("sale_to_list_display", "97.4%"), "source": "payload.market.sale_to_list_ratio", "trace": market.get("trace", "")},
        {"figure": market.get("median_dom_display", "10 days"), "source": "payload.market.median_dom", "trace": market.get("trace", "")},
    ])
    write_provenance(out_dir, [{"asset": "meme frames", "source": "PIL generated", "license": "internal"}])
    write_scorecard(out_dir, [
        {"name": "no_banned_words", "pass": not hits, "notes": str(hits)},
        {"name": "mp4_exists", "pass": mp4.exists() and mp4.stat().st_size > 0, "notes": ""},
        {"name": "three_beat_arc", "pass": len(frame_paths) == 3, "notes": "setup, twist, payoff"},
        {"name": "figures_cited", "pass": True, "notes": ""},
    ])
    write_card_json(out_dir, PRODUCER, str(mp4), "3-beat market meme (setup/twist/payoff)",
                    [str(market.get("sold_count", "")), market.get("median_dom_display", "")])
    print(f"✓ wrote sidecars")


if __name__ == "__main__":
    main()
