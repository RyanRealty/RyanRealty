#!/usr/bin/env python3
"""News clip VO — 3 viral news-style clips, ElevenLabs, prosody-chained.

Voice: Victoria — Ryan Realty Anchor (qSeXEcewz7tA0Q0qk9fH) — HARDCODED.
Model: eleven_turbo_v2_5. Settings: stability 0.50, similarity_boost 0.75,
style 0.35, speaker_boost True.

Locked 2026-04-27 per Matt — Victoria is the permanent voice. Voice ID is
hardcoded as a literal string, NOT read from any env variable. Do not
change without explicit Matt direction. Each sentence chains previous_text
for prosody continuity.
"""
import json, urllib.request, sys
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4")
OUT = ROOT / "public" / "audio"
OUT.mkdir(parents=True, exist_ok=True)

VOICE = "qSeXEcewz7tA0Q0qk9fH"  # Victoria — Ryan Realty Anchor (HARDCODED, NOT from env)


def load_env(path):
    env = {}
    for line in path.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


env = load_env(Path("/Users/matthewryan/RyanRealty/.env.local"))
KEY = env["ELEVENLABS_API_KEY"]


def synth(slug: str, text: str, prev_text: str = "", model: str = "eleven_turbo_v2_5") -> bool:
    out_path = OUT / f"{slug}.mp3"
    if out_path.exists() and out_path.stat().st_size > 1024:
        print(f"[skip] {slug} exists", file=sys.stderr)
        return True
    payload = {
        "text": text,
        "model_id": model,
        "voice_settings": {
            "stability": 0.50,
            "similarity_boost": 0.75,
            "style": 0.35,
            "use_speaker_boost": True,
        },
    }
    if prev_text:
        payload["previous_text"] = prev_text
    print(f"[synth] {slug} ({len(text)} chars)", file=sys.stderr)
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}",
        data=json.dumps(payload).encode(),
        headers={
            "xi-api-key": KEY,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
            "User-Agent": "curl/8.4",
        },
    )
    try:
        resp = urllib.request.urlopen(req)
        out_path.write_bytes(resp.read())
        print(f"  -> {out_path.name} ({out_path.stat().st_size/1024:.0f}KB)", file=sys.stderr)
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  ERROR {e.code}: {body[:300]}", file=sys.stderr)
        return False


# Clip layouts with VO scripts. Each block matches the BEAT timing in the .tsx file.
#
# Density rule (per Matt 2026-04-27): scripts are dense with verified facts,
# not thin talking points stretched to fill 45 seconds. Every figure traces
# to a primary source already cited in the corresponding .tsx file header.
# These are NATIONAL stories — Bend is not shoehorned in.
#
# Tariffs source: NAHB / Wells Fargo Housing Market Index, April 2025
# survey + Center for American Progress 2026 analysis (URLs in ClipTariffs.tsx).
# Golden Handcuffs source: Coldwell Banker 2026 Home Shopping Season Report
# (PRNewswire 2026-04-23, n=727 affiliated agents fielded Mar 23–Apr 6 2026).
# Sun Belt source: Fortune / AEI Housing Center, Feb 2025 → Feb 2026 window
# (Fortune 2026-04-11; URL in ClipSunBeltCorrection.tsx).
CLIPS = {
    # Expanded for 60s clips per Matt 2026-04-27: more substance, slower pacing,
    # 6-7 sentences per clip with deliberate breath between. All figures still
    # trace to the primary sources cited in each .tsx file header — no new
    # fabrication, just more of what those sources already said.
    "tariffs": [
        ("news_tariffs_s01", "Your next new home just got more expensive. About ten thousand nine hundred dollars more, on average."),
        ("news_tariffs_s02", "That's the per home cost effect estimated by the National Association of Home Builders."),
        ("news_tariffs_s03", "Here's where it goes. Suppliers raised prices an average of six point three percent."),
        ("news_tariffs_s04", "Lumber. Steel. Aluminum. Cabinets. Drywall. Doors. Every line item up."),
        ("news_tariffs_s05", "And the squeeze doesn't stop at one home. The Center for American Progress projects four hundred fifty thousand fewer new homes built by twenty thirty."),
        ("news_tariffs_s06", "Less new supply means higher prices on what does get built."),
        ("news_tariffs_s07", "If you already own, you're sitting on the asset that just got harder to replace."),
    ],
    "gh": [
        ("news_gh_s01", "The lock in effect just cracked."),
        ("news_gh_s02", "For two years, sellers with mortgage rates below five percent stayed put. Refused to give up a cheap rate."),
        ("news_gh_s03", "That just changed. One in three of those sellers are listing anyway, this spring."),
        ("news_gh_s04", "From a national survey of seven hundred twenty seven Coldwell Banker agents."),
        ("news_gh_s05", "Eighty percent of those agents say buyers stopped waiting for rates."),
        ("news_gh_s06", "Forty three percent report a busier spring than twenty twenty five."),
        ("news_gh_s07", "Two years of frozen inventory is thawing. The market is rewarding action now."),
    ],
    "sbc": [
        ("news_sbc_s01", "The Sun Belt boom is unwinding."),
        ("news_sbc_s02", "Cape Coral, Florida. Down nine point six percent year over year."),
        ("news_sbc_s03", "The biggest annual home price drop in the country, per the AEI Housing Center."),
        ("news_sbc_s04", "Phoenix. Tampa. Austin. Every Sun Belt market that overshot in twenty twenty one is giving back gains."),
        ("news_sbc_s05", "Now compare Kansas City. Up eight point six percent."),
        ("news_sbc_s06", "Steady mid American markets are climbing while pandemic boom towns correct."),
        ("news_sbc_s07", "It's not geography. It's cycle position. The hottest markets cool the fastest."),
    ],
}


def main():
    ok = 0
    fail = 0
    for clip_key, sentences in CLIPS.items():
        prev = ""
        for slug, text in sentences:
            if synth(slug, text, prev_text=prev):
                ok += 1
            else:
                fail += 1
            prev = text  # chain prosody
    print(f"\nDone: {ok} ok, {fail} fail")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
