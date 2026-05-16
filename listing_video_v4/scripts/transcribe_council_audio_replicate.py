#!/usr/bin/env python3
"""Transcribe Bend Council audio chunks via Replicate Whisper.

Returns word-level timestamps so we can identify pertinent speaker bites.
Uses replicate.com/openai/whisper.
"""
import json
import sys
import time
from pathlib import Path
import urllib.request
import urllib.parse
import base64

ROOT = Path("/Users/matthewryan/RyanRealty/listing_video_v4/public/source_clips/bend_pulse/long")
ENV = Path("/Users/matthewryan/RyanRealty/.env.local")


def load_env(path):
    env = {}
    for line in path.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


KEY = load_env(ENV)["REPLICATE_API_TOKEN"]
HEADERS = {
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
}

# Use incredibly-fast-whisper for speed — uses Whisper Large v3 with batching.
# Returns word-level timestamps natively.
MODEL_VERSION = "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c"


def http_post(url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(), headers=HEADERS, method="POST"
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def http_get(url: str) -> dict:
    req = urllib.request.Request(url, headers=HEADERS, method="GET")
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def transcribe(mp3_path: Path) -> dict:
    out_path = mp3_path.with_suffix(".transcript.json")
    if out_path.exists() and out_path.stat().st_size > 1024:
        print(f"[skip] {mp3_path.name}", file=sys.stderr)
        return json.loads(out_path.read_text())

    print(f"[whisper-replicate] {mp3_path.name}...", file=sys.stderr)
    audio_b64 = base64.b64encode(mp3_path.read_bytes()).decode()
    data_uri = f"data:audio/mpeg;base64,{audio_b64}"

    create = http_post(
        "https://api.replicate.com/v1/predictions",
        {
            "version": MODEL_VERSION.split(":")[1],
            "input": {
                "audio": data_uri,
                "task": "transcribe",
                "language": "english",
                "timestamp": "word",
                "batch_size": 24,
                "diarise_audio": False,
            },
        },
    )
    pid = create["id"]
    print(f"  prediction {pid}", file=sys.stderr)

    while True:
        status = http_get(f"https://api.replicate.com/v1/predictions/{pid}")
        if status["status"] in ("succeeded", "failed", "canceled"):
            break
        print(f"  ... {status['status']}", file=sys.stderr)
        time.sleep(8)

    if status["status"] != "succeeded":
        print(f"  FAILED: {status.get('error') or status.get('logs', '')[:300]}", file=sys.stderr)
        return {}

    output = status["output"]
    out_path.write_text(json.dumps(output, indent=2))
    word_count = len(output.get("chunks") or output.get("text", "").split())
    print(f"  -> {out_path.name} ({word_count} words/chunks)", file=sys.stderr)
    return output


def main():
    for mp3 in sorted(ROOT.glob("*.mp3")):
        try:
            transcribe(mp3)
        except Exception as e:
            print(f"  ERROR {type(e).__name__}: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
    print("\nDone.", file=sys.stderr)


if __name__ == "__main__":
    main()
