#!/usr/bin/env python3
"""Bend Policy Pulse v4 — Victoria bridge VO synth.

The video is structured as alternating segments:
  - Victoria narrates a "bridge" (her voice over Council b-roll, original audio at 0.08x)
  - Council/Cassie speaker bite plays with ORIGINAL audio at 1.0x (Victoria silent)

This script synthesizes ONLY Victoria's bridge lines. The bites are extracted
clips with native audio.

Voice settings (canonical per CLAUDE.md):
  Victoria qSeXEcewz7tA0Q0qk9fH, eleven_turbo_v2_5,
  stability 0.40, similarity_boost 0.80, style 0.50, speaker_boost True.
"""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4")
OUT = ROOT / "public" / "audio" / "bend_pulse_v4"
OUT.mkdir(parents=True, exist_ok=True)

VOICE = "qSeXEcewz7tA0Q0qk9fH"


def load_env(path):
    env = {}
    for line in path.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


KEY = load_env(Path("/Users/matthewryan/RyanRealty/.env.local"))["ELEVENLABS_API_KEY"]


def synth(slug: str, text: str, prev_text: str = "") -> bool:
    out_path = OUT / f"{slug}.mp3"
    if out_path.exists() and out_path.stat().st_size > 1024:
        print(f"[skip] {slug}", file=sys.stderr)
        return True
    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {
            "stability": 0.40,
            "similarity_boost": 0.80,
            "style": 0.50,
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
        },
    )
    try:
        resp = urllib.request.urlopen(req, timeout=60)
        out_path.write_bytes(resp.read())
        print(f"  -> {out_path.name} ({out_path.stat().st_size/1024:.0f}KB)", file=sys.stderr)
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  ERROR {e.code}: {body[:300]}", file=sys.stderr)
        return False


# Bridge scripts. Numbers spelled out for ElevenLabs ingestion.
# No banned words. No em-dashes / colons / semicolons in prose.
# Bridges set up the Council/Cassie speaker bite that follows.
BRIDGES = {
    # PART 1 — What Bend is actually proposing
    "p1_b1_hook":       "Bend is finalizing a climate pollution fee on new homes. It is the biggest housing policy decision the city has made in years.",
    "p1_b2_setup_calc": "On February eleventh, City Council met for a final work session before the public hearing. The city's electrification project manager Cassie Lacy walked them through how the fee actually works.",
    "p1_b3_setup_scc":  "Each gas appliance in a new house gets the fee. The calculation starts with what economists call the social cost of carbon. A dollar value put on every ton of CO2.",
    "p1_b4_levels":     "Council had three fee levels in front of them that day. Low, reduced, and maximum. Per home, that's one thousand nine hundred fifty four dollars on the low end, up to nine thousand seven hundred seventy one on the high end.",
    "p1_b5_impact":     "And here's what city staff projected those fee levels would do to the price of a new home. A zero point two three to one point one five percent bump in housing cost, depending on which level Council picks.",
    "p1_b6_existing":   "Important to know. This only applies to new construction. If you already own a Bend home with gas appliances, nothing changes for you. The fee covers new single family homes, duplexes, townhouses, and ADUs.",

    # PART 2 — What people are arguing about
    "p2_b1_hook":         "When Bend put this fee on the table, three industries showed up at the Bend Economic Development Board in January to push back.",
    "p2_b2_groups":       "Central Oregon Builders said the fee will get passed straight to the home buyer. The Bend Chamber of Commerce asked for a time limited pilot before any fee goes live. And the plumbers and steamfitters union flagged grid capacity at Pacific Power.",
    "p2_b3_vote":         "The board voted eight to zero, asking Council for that pilot. But on Council, the debate over fee levels and exemptions got real.",
    "p2_b4_setup_binary": "One councilor pushed back hard on how the conversation has been framed in the community.",
    "p2_b5_setup_chew":   "Another councilor took the same line. Affordability and climate goals, in their view, are not mutually exclusive.",
    "p2_b6_setup_nudge":  "And Council's read on what this fee is actually trying to do. Not a mandate. A signal to start the transition.",
    "p2_b7_landed":       "Where it landed. A new Temporary Committee on Electrification Policy. Four advisory bodies, one table, working through fee design and incentives together.",

    # PART 3 — What happens next
    "p3_b1_hook":          "Three dates worth putting on your calendar if you live in Bend or own land here.",
    "p3_b2_setup_qs":      "Before the fee goes to ordinance, three questions still need answers. From Cassie Lacy at that February eleventh meeting.",
    "p3_b3_setup_three_qs": "And the other two questions Council still has to decide.",
    "p3_b4_setup_stake":   "The way Council plans to answer all three. Through targeted stakeholder engagement.",
    "p3_b5_setup_tcep":    "Specifically through the new committee they just created.",
    "p3_b6_dates":         "Three dates locked in. Late May or early June, the public hearing on the fee. June third, first reading of the ordinance. June seventeenth, second reading. After that, it becomes law.",
    "p3_b7_start_loc":     "Earliest possible start date for the fee. April first, twenty twenty seven. Bend City Hall, seven ten northwest Wall Street. Public can attend in person or watch online.",
}


def main():
    ok = 0
    fail = 0
    prev = ""
    for slug, text in BRIDGES.items():
        if synth(slug, text, prev_text=prev):
            ok += 1
        else:
            fail += 1
        prev = text
    print(f"\nDone: {ok} ok, {fail} fail", file=sys.stderr)
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
