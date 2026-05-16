#!/usr/bin/env python3
"""Transcribe Bend Council audio chunks via OpenAI Whisper API.

Returns word-level timestamps so we can identify pertinent speaker bites
matching Victoria's narrative beats.

Reads OPENAI_API_KEY from .env.local. Costs ~$0.006/min ($0.09 for 15 min total).
"""
import json
import sys
from pathlib import Path
import urllib.request

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


KEY = load_env(ENV)["OPENAI_API_KEY"]


def transcribe(mp3_path: Path) -> dict:
    out_path = mp3_path.with_suffix(".transcript.json")
    if out_path.exists() and out_path.stat().st_size > 1024:
        print(f"[skip] {mp3_path.name} already transcribed")
        return json.loads(out_path.read_text())
    print(f"[whisper] {mp3_path.name}...", file=sys.stderr)

    boundary = "----whispherboundary7c3f"
    body = b""
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="file"; filename="' + mp3_path.name.encode() + b'"\r\n'
    body += b"Content-Type: audio/mpeg\r\n\r\n"
    body += mp3_path.read_bytes()
    body += b"\r\n"
    for k, v in [
        ("model", "whisper-1"),
        ("response_format", "verbose_json"),
        ("timestamp_granularities[]", "word"),
        ("timestamp_granularities[]", "segment"),
    ]:
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode()
        body += f"{v}\r\n".encode()
    body += f"--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/transcriptions",
        data=body,
        headers={
            "Authorization": f"Bearer {KEY}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.loads(r.read())
    out_path.write_text(json.dumps(data, indent=2))
    print(f"  -> {out_path.name} ({len(data.get('words', []))} words, {data.get('duration', 0):.0f}s)", file=sys.stderr)
    return data


def main():
    for mp3 in sorted(ROOT.glob("*.mp3")):
        try:
            transcribe(mp3)
        except Exception as e:
            print(f"  ERROR {type(e).__name__}: {e}", file=sys.stderr)
    print("\nDone.", file=sys.stderr)


if __name__ == "__main__":
    main()
