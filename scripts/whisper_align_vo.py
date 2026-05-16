#!/usr/bin/env python3
"""
Word-level forced alignment via local whisper.cpp.

Replaces the proportional byte-length stub previously used when ElevenLabs
forced-alignment isn't available on the Creator plan. Produces an alignment
JSON next to the input MP3 in the same shape the caption components expect:

  {
    "vo_duration_sec": 22.847,
    "model": "whisper.cpp/base.en",
    "source": "whisper",
    "words": [{"text": "...", "start": 0.12, "end": 0.86}, ...],
    "sentences": [{"text": "...", "startSec": 0.0, "endSec": 2.77}, ...]
  }

Usage:
  python3 scripts/whisper_align_vo.py <vo.mp3> <canonical_script.txt>
  python3 scripts/whisper_align_vo.py <vo.mp3> --text "Tumalo, Oregon. Twelve minutes..."

Requires:
  whisper.cpp built at /Users/matthewryan/.local/whisper.cpp/build/bin/whisper-cli
  base.en model at /Users/matthewryan/.local/whisper.cpp/models/ggml-base.en.bin
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

WHISPER_CLI = Path("/Users/matthewryan/.local/whisper.cpp/build/bin/whisper-cli")
WHISPER_MODEL = Path("/Users/matthewryan/.local/whisper.cpp/models/ggml-base.en.bin")


def mp3_to_wav(mp3_path: Path, wav_path: Path) -> float:
    """Convert MP3 → 16kHz mono WAV, return duration."""
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3_path),
         "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(wav_path)],
        check=True,
    )
    dur = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(wav_path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(dur)


def run_whisper(wav_path: Path, out_prefix: Path) -> dict:
    """Run whisper-cli with token-level timestamps, return parsed JSON."""
    subprocess.run(
        [str(WHISPER_CLI),
         "-m", str(WHISPER_MODEL),
         "-f", str(wav_path),
         "-oj",
         "-of", str(out_prefix),
         "--language", "en",
         "-ml", "1",      # one token per segment → token-level timestamps
         "-sow",          # split on word boundary (keep subwords attached)
         "-t", "8"],
        check=True, capture_output=True,
    )
    return json.loads((out_prefix.with_suffix(".json").read_text()))


def normalize_word(s: str) -> str:
    """Lowercase + strip punctuation for fuzzy matching."""
    return re.sub(r"[^a-z0-9]", "", s.lower())


def merge_subwords_to_words(whisper_segments: list[dict]) -> list[dict]:
    """
    Whisper.cpp emits one segment per token including BPE subwords ("Reserv", "oir").
    Merge consecutive segments that don't start with a space into single words.
    """
    words = []
    current = None
    for seg in whisper_segments:
        text = seg.get("text", "")
        if not text:
            continue
        start_ms = seg["offsets"]["from"]
        end_ms = seg["offsets"]["to"]
        starts_word = text.startswith(" ") or current is None
        clean = text.strip()
        # Skip standalone punctuation
        if not clean or all(c in ".,!?;:-'\"" for c in clean):
            if current is not None:
                current["end_ms"] = end_ms
            continue
        if starts_word:
            if current is not None:
                words.append(current)
            current = {
                "text": clean,
                "start_ms": start_ms,
                "end_ms": end_ms,
            }
        else:
            # Continuation of previous word (BPE subword)
            current["text"] += clean
            current["end_ms"] = end_ms
    if current is not None:
        words.append(current)
    return words


def align_canonical_to_whisper(canonical: str, whisper_words: list[dict]) -> list[dict]:
    """
    Use canonical script words but anchor timing to whisper's positions.
    Strategy: walk canonical word list, find best matching whisper word,
    interpolate when no match.
    """
    canon_tokens = re.findall(r"\S+", canonical)
    canon_norm = [normalize_word(w) for w in canon_tokens]
    whisp_norm = [normalize_word(w["text"]) for w in whisper_words]

    aligned: list[dict] = []
    wi = 0  # whisper index
    last_t = 0.0
    for ci, (ctok, cnorm) in enumerate(zip(canon_tokens, canon_norm)):
        if not cnorm:
            # Pure punctuation token — emit zero-length at last anchor
            aligned.append({"text": ctok, "start": last_t, "end": last_t})
            continue
        # Try to find a match in the next 4 whisper words
        match = None
        for k in range(wi, min(wi + 4, len(whisp_norm))):
            if whisp_norm[k] and (cnorm == whisp_norm[k] or
                                   cnorm.startswith(whisp_norm[k]) or
                                   whisp_norm[k].startswith(cnorm)):
                match = k
                break
        if match is not None:
            ww = whisper_words[match]
            start = ww["start_ms"] / 1000.0
            end = ww["end_ms"] / 1000.0
            aligned.append({"text": ctok, "start": round(start, 3), "end": round(end, 3)})
            last_t = end
            wi = match + 1
        else:
            # No match — interpolate. Borrow timing from the next known anchor.
            # Use a small slot proportional to remaining canonical words.
            slot = 0.2
            aligned.append({"text": ctok, "start": round(last_t, 3),
                            "end": round(last_t + slot, 3)})
            last_t += slot
    return aligned


def detect_sentences(aligned_words: list[dict]) -> list[dict]:
    """Group aligned words into sentences by `.`, `!`, `?`."""
    sentences = []
    cur_words = []
    cur_start = None
    for w in aligned_words:
        if cur_start is None:
            cur_start = w["start"]
        cur_words.append(w["text"])
        if w["text"].rstrip().endswith((".", "!", "?")):
            sentences.append({
                "text": " ".join(cur_words),
                "startSec": cur_start,
                "endSec": w["end"],
            })
            cur_words = []
            cur_start = None
    if cur_words:
        sentences.append({
            "text": " ".join(cur_words),
            "startSec": cur_start or 0.0,
            "endSec": aligned_words[-1]["end"] if aligned_words else 0.0,
        })
    return sentences


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mp3", help="Path to VO MP3")
    ap.add_argument("script", nargs="?", help="Path to canonical script .txt")
    ap.add_argument("--text", help="Inline canonical script (alt to script path)")
    ap.add_argument("--out", help="Output alignment JSON path (default: mp3.alignment.json)")
    args = ap.parse_args()

    if not WHISPER_CLI.exists():
        sys.exit(f"missing: {WHISPER_CLI}")
    if not WHISPER_MODEL.exists():
        sys.exit(f"missing: {WHISPER_MODEL}")

    mp3 = Path(args.mp3)
    if not mp3.exists():
        sys.exit(f"missing: {mp3}")

    if args.text:
        canonical = args.text
    elif args.script:
        canonical = Path(args.script).read_text()
    else:
        sys.exit("provide --text or a script path")

    out_path = Path(args.out) if args.out else mp3.with_suffix(".alignment.json")

    import tempfile
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        wav = td / "vo.wav"
        whisper_out = td / "out"

        print(f"[whisper-align] {mp3.name}")
        duration = mp3_to_wav(mp3, wav)
        print(f"  duration: {duration:.2f}s")

        result = run_whisper(wav, whisper_out)
        segments = result.get("transcription", [])
        print(f"  whisper segments: {len(segments)}")

        whisper_words = merge_subwords_to_words(segments)
        print(f"  whisper words: {len(whisper_words)}")

        aligned = align_canonical_to_whisper(canonical, whisper_words)
        matched = sum(1 for w in aligned if w["end"] > w["start"])
        print(f"  canonical words aligned: {matched}/{len(aligned)}")

        sentences = detect_sentences(aligned)
        print(f"  sentences: {len(sentences)}")

        output = {
            "vo_duration_sec": duration,
            "model": "whisper.cpp/base.en",
            "source": "whisper",
            "words": aligned,
            "sentences": sentences,
        }
        out_path.write_text(json.dumps(output, indent=2))
        print(f"  wrote: {out_path}")


if __name__ == "__main__":
    main()
