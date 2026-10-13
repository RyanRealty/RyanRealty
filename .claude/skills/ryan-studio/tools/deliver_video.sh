#!/usr/bin/env bash
# The ONLY sanctioned way to save/send a finished video (Ryan Reels, Drive, Desktop, chat, upload).
# Refuses unless video_render_gate.py PASSED on this exact file (sha256 in <file>.gate.json).
# Usage: deliver_video.sh <final.mp4> <destination path or dir>
set -euo pipefail
f="${1:?usage: deliver_video.sh <final.mp4> <dest>}"; dest="${2:?missing destination}"
stamp="$f.gate.json"
[ -f "$stamp" ] || { echo "REFUSED: no render-gate pass stamp for $f. Run: python3 tools/video_render_gate.py \"$f\" [--silent]" >&2; exit 1; }
sha=$( (sha256sum "$f" 2>/dev/null || shasum -a 256 "$f") | cut -d' ' -f1)
python3 - "$stamp" "$sha" <<'PY' || { echo "REFUSED: stamp does not match this file (re-rendered or edited after the gate). Re-run the gate." >&2; exit 1; }
import json,sys; s=json.load(open(sys.argv[1])); sys.exit(0 if s.get("pass") is True and s.get("sha256")==sys.argv[2] else 1)
PY
cp "$f" "$dest"; echo "DELIVERED $f -> $dest (gate sha256 ${sha:0:12})"
