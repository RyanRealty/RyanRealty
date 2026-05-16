#!/usr/bin/env python3
"""ElevenLabs forced-alignment for Victoria bridge MP3s.

For each bridge MP3 + its known text, call ElevenLabs /v1/forced-alignment
to get word-level timestamps. Output: <slug>.alignment.json next to each MP3.

Schema: { "words": [{ "text": str, "startSec": float, "endSec": float }, ...] }

This enables full-sentence captions with active-word highlight per Matt's
canonical CaptionBand rule (CLAUDE.md §0.5).
"""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4")
AUDIO_DIR = ROOT / "public" / "audio" / "bend_pulse_v4"


def load_env(path):
    env = {}
    for line in path.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


KEY = load_env(Path("/Users/matthewryan/RyanRealty/.env.local"))["ELEVENLABS_API_KEY"]


# Bridge text — MUST stay in sync with synth_bend_pulse_v4_bridges.py
BRIDGE_TEXT = {
    "p1_b1_hook":           "Bend is finalizing a climate pollution fee on new homes. It is the biggest housing policy decision the city has made in years.",
    "p1_b2_setup_calc":     "On February eleventh, City Council met for a final work session before the public hearing. The city's electrification project manager Cassie Lacy walked them through how the fee actually works.",
    "p1_b3_setup_scc":      "Each gas appliance in a new house gets the fee. The calculation starts with what economists call the social cost of carbon. A dollar value put on every ton of CO2.",
    "p1_b4_levels":         "Council had three fee levels in front of them that day. Low, reduced, and maximum. Per home, that's one thousand nine hundred fifty four dollars on the low end, up to nine thousand seven hundred seventy one on the high end.",
    "p1_b5_impact":         "And here's what city staff projected those fee levels would do to the price of a new home. A zero point two three to one point one five percent bump in housing cost, depending on which level Council picks.",
    "p1_b6_existing":       "Important to know. This only applies to new construction. If you already own a Bend home with gas appliances, nothing changes for you. The fee covers new single family homes, duplexes, townhouses, and ADUs.",
    "p2_b1_hook":           "When Bend put this fee on the table, three industries showed up at the Bend Economic Development Board in January to push back.",
    "p2_b2_groups":         "Central Oregon Builders said the fee will get passed straight to the home buyer. The Bend Chamber of Commerce asked for a time limited pilot before any fee goes live. And the plumbers and steamfitters union flagged grid capacity at Pacific Power.",
    "p2_b3_vote":           "The board voted eight to zero, asking Council for that pilot. But on Council, the debate over fee levels and exemptions got real.",
    "p2_b4_setup_binary":   "One councilor pushed back hard on how the conversation has been framed in the community.",
    "p2_b5_setup_chew":     "Another councilor took the same line. Affordability and climate goals, in their view, are not mutually exclusive.",
    "p2_b6_setup_nudge":    "And Council's read on what this fee is actually trying to do. Not a mandate. A signal to start the transition.",
    "p2_b7_landed":         "Where it landed. A new Temporary Committee on Electrification Policy. Four advisory bodies, one table, working through fee design and incentives together.",
    "p3_b1_hook":           "Three dates worth putting on your calendar if you live in Bend or own land here.",
    "p3_b2_setup_qs":       "Before the fee goes to ordinance, three questions still need answers. From Cassie Lacy at that February eleventh meeting.",
    "p3_b3_setup_three_qs": "And the other two questions Council still has to decide.",
    "p3_b4_setup_stake":    "The way Council plans to answer all three. Through targeted stakeholder engagement.",
    "p3_b5_setup_tcep":     "Specifically through the new committee they just created.",
    "p3_b6_dates":          "Three dates locked in. Late May or early June, the public hearing on the fee. June third, first reading of the ordinance. June seventeenth, second reading. After that, it becomes law.",
    "p3_b7_start_loc":      "Earliest possible start date for the fee. April first, twenty twenty seven. Bend City Hall, seven ten northwest Wall Street. Public can attend in person or watch online.",
}


def align_one(slug: str, text: str) -> dict:
    mp3 = AUDIO_DIR / f"{slug}.mp3"
    out_path = AUDIO_DIR / f"{slug}.alignment.json"
    if not mp3.exists():
        print(f"[skip] {slug} mp3 missing", file=sys.stderr)
        return {}
    if out_path.exists() and out_path.stat().st_size > 256:
        return json.loads(out_path.read_text())

    print(f"[align] {slug} ...", file=sys.stderr)

    boundary = "----alignmentboundary7c3f"
    body = b""
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="file"; filename="' + mp3.name.encode() + b'"\r\n'
    body += b"Content-Type: audio/mpeg\r\n\r\n"
    body += mp3.read_bytes()
    body += b"\r\n"
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="text"\r\n\r\n'
    body += text.encode()
    body += b"\r\n"
    body += f"--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/forced-alignment",
        data=body,
        headers={
            "xi-api-key": KEY,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="replace")
        print(f"  ERROR {e.code}: {body_err[:300]}", file=sys.stderr)
        return {}

    # ElevenLabs returns: { "words": [{ "text": "...", "start": 0.42, "end": 0.6 }, ...] }
    # Normalize to our schema (startSec/endSec)
    words = []
    for w in data.get("words", []):
        words.append({
            "text": w.get("text", "").strip(),
            "startSec": round(float(w.get("start", 0.0)), 3),
            "endSec": round(float(w.get("end", 0.0)), 3),
        })
    out = {"words": words, "raw_keys": list(data.keys())}
    out_path.write_text(json.dumps(out, indent=2))
    print(f"  -> {out_path.name} ({len(words)} words)", file=sys.stderr)
    return out


def main():
    ok = 0
    fail = 0
    for slug, text in BRIDGE_TEXT.items():
        result = align_one(slug, text)
        if result and result.get("words"):
            ok += 1
        else:
            fail += 1
    print(f"\nDone: {ok} ok, {fail} fail", file=sys.stderr)
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
