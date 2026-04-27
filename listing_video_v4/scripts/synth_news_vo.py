#!/usr/bin/env python3
"""News clip VO — 3 viral news-style clips, ElevenLabs, prosody-chained.

Voice: news anchor (BIvP0GN1cAtSRTxNHnWS) — declarative, paced, neutral.
Settings: stability 0.55, similarity_boost 0.85, style 0.15, speaker_boost True.

Pronunciation overrides via SSML phonemes for proper nouns when needed.
Each sentence chains previous_text from same clip for prosody continuity.
"""
import json, urllib.request, sys
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4")
OUT = ROOT / "public" / "audio"
OUT.mkdir(parents=True, exist_ok=True)

VOICE = "BIvP0GN1cAtSRTxNHnWS"  # Ellen — news anchor


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


def synth(slug: str, text: str, prev_text: str = "", model: str = "eleven_multilingual_v2") -> bool:
    out_path = OUT / f"{slug}.mp3"
    if out_path.exists() and out_path.stat().st_size > 1024:
        print(f"[skip] {slug} exists", file=sys.stderr)
        return True
    payload = {
        "text": text,
        "model_id": model,
        "voice_settings": {
            "stability": 0.55,
            "similarity_boost": 0.85,
            "style": 0.15,
            "use_speaker_boost": True,
            "speed": 0.95,
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
CLIPS = {
    "tariffs": [
        ("news_tariffs_s01", "Your next home just got more expensive."),
        ("news_tariffs_s02", "Tariffs added an average of ten thousand nine hundred dollars to the cost of every new home."),
        ("news_tariffs_s03", "Lumber. Steel. Cabinets. Drywall. Supplier prices jumped six point three percent across the board."),
        ("news_tariffs_s04", "And by twenty thirty, four hundred fifty thousand new homes will never get built at all."),
        ("news_tariffs_s05", "When new construction gets harder, the home you already own gets stronger."),
    ],
    "gh": [
        ("news_gh_s01", "The lock-in effect just broke."),
        ("news_gh_s02", "One in three sellers with mortgage rates below five percent are listing anyway."),
        ("news_gh_s03", "Eighty percent of agents say buyers are not waiting on rates."),
        ("news_gh_s04", "Forty-three percent are reporting a busier spring than last year."),
        ("news_gh_s05", "If you've been waiting on rates to sell, the market is no longer waiting on you."),
    ],
    "sbc": [
        ("news_sbc_s01", "The Sun Belt boom is unwinding."),
        ("news_sbc_s02", "Cities that overshot in twenty twenty-one are giving it back."),
        ("news_sbc_s03", "Phoenix, Tampa, Austin. All down. Bend held positive."),
        ("news_sbc_s04", "It's not geography. It's the cycle."),
        ("news_sbc_s05", "Bend's median is still climbing. Different market. Different rules."),
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
