#!/usr/bin/env python3
"""
_voice_lib.py — shared ElevenLabs Victoria TTS helper for every Ryan Realty
Python producer that generates voiceover.

Canonical settings + voice ID + model live HERE. Producers MUST NOT hardcode
these values — import from this module so a one-line change here propagates
to every producer that synths VO.

Per CLAUDE.md "ElevenLabs Voice — MANDATORY" and
`video_production_skills/elevenlabs_voice/SKILL.md` §"Canonical voice settings"
(locked 2026-05-07, conversational tuning):

    Voice ID:          qSeXEcewz7tA0Q0qk9fH (Victoria — Ryan Realty Anchor)
    Model:             eleven_turbo_v2_5 (eleven_v3 only for phoneme tags)
    stability:         0.40
    similarity_boost:  0.80
    style:             0.50
    use_speaker_boost: True
    previous_text:     chain every sentence after the first

Usage:

    from scripts._voice_lib import (
        synth_vo,
        synth_vo_chain,
        get_forced_alignment,
        synth_vo_ab,
        VOICE_ID,
        DEFAULT_SETTINGS,
        IPA_PHONEMES,
    )

    path = synth_vo("Bend home prices climbed four percent.", out_path)
    alignment = get_forced_alignment(path, "Bend home prices climbed four percent.")

    # For unusual scripts that may read robotic, A/B test before locking:
    variants = synth_vo_ab("...", out_dir=Path("out/vo-ab"))
    # → out/vo-ab/baseline.mp3, out/vo-ab/expressive.mp3, out/vo-ab/controlled.mp3
"""

from __future__ import annotations
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path
from typing import TypedDict

# ─────────────────────────────────────────────────────────────────────────────
# Canonical voice constants — single source of truth (locked 2026-05-07)
# ─────────────────────────────────────────────────────────────────────────────

VOICE_ID = "qSeXEcewz7tA0Q0qk9fH"  # Victoria — locked permanent per CLAUDE.md
DEFAULT_MODEL = "eleven_turbo_v2_5"
PHONEME_MODEL = "eleven_v3"  # use only when <phoneme> tags appear in text
BANNED_MODEL = "eleven_multilingual_v2"  # never use

DEFAULT_SETTINGS: dict[str, float | bool] = {
    "stability": 0.40,
    "similarity_boost": 0.80,
    "style": 0.50,
    "use_speaker_boost": True,
}

# A/B test variants for scripts that may read robotic at the baseline settings.
# Run synth_vo_ab() to produce all three; pick the one that sounds most natural.
AB_VARIANTS: dict[str, dict[str, float | bool]] = {
    "baseline": dict(DEFAULT_SETTINGS),
    "expressive": {"stability": 0.30, "similarity_boost": 0.80, "style": 0.60, "use_speaker_boost": True},
    "controlled": {"stability": 0.55, "similarity_boost": 0.80, "style": 0.40, "use_speaker_boost": True},
}

# Central Oregon place-name IPA phoneme tags (only used with eleven_v3 model)
IPA_PHONEMES: dict[str, str] = {
    "Deschutes": "dəˈʃuːts",  # duh-SHOOTS
    "Tumalo": "ˈtuːməloʊ",  # TOO-muh-low
    "Tetherow": "ˈtɛθəroʊ",  # TETH-er-oh
    "Awbrey": "ˈɔːbri",  # AW-bree
    "Terrebonne": "ˈtɛrəbɒn",  # TAIR-uh-bon
    "Paulina": "pɒlˈaɪnə",  # pol-EYE-nuh
    "Madras": "ˈmædrəs",  # MAD-russ
}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _api_key() -> str:
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.stderr.write(
            "ERROR: ELEVENLABS_API_KEY not set. Add to .env.local or load via "
            "node --env-file=.env.local (Python: dotenv load before running).\n"
        )
        sys.exit(2)
    return key


def _pick_model(text: str, model: str | None) -> str:
    """Auto-pick the right model. eleven_v3 when <phoneme> tag present."""
    if model:
        return model
    if "<phoneme" in text:
        return PHONEME_MODEL
    return DEFAULT_MODEL


def wrap_phonemes(text: str, names: dict[str, str] | None = None) -> str:
    """Wrap every Central Oregon place name in the text with IPA phoneme tags.

    Useful for scripts that mention Deschutes / Tumalo / Tetherow etc. Returns
    text with <phoneme> SSML wrappers; the result must be synthesized with
    eleven_v3 (use _pick_model auto-detect).

    Example:
        wrap_phonemes("Deschutes county home prices") →
        '<phoneme alphabet="ipa" ph="dəˈʃuːts">Deschutes</phoneme> county home prices'
    """
    pool = names or IPA_PHONEMES
    for name, ipa in pool.items():
        text = text.replace(name, f'<phoneme alphabet="ipa" ph="{ipa}">{name}</phoneme>')
    return text


# ─────────────────────────────────────────────────────────────────────────────
# Core API calls
# ─────────────────────────────────────────────────────────────────────────────

def synth_vo(
    text: str,
    out_path: Path,
    *,
    previous_text: str = "",
    settings: dict | None = None,
    model: str | None = None,
    timeout: int = 60,
) -> Path:
    """Synthesize VO via ElevenLabs Victoria. Writes MP3 to out_path. Returns the path.

    Args:
        text: The VO script for this segment. Numbers spelled out
            ("four hundred seventy five thousand" not "475,000").
        out_path: Where to write the .mp3
        previous_text: Prior sentence for prosody continuity (chain across segments)
        settings: Override settings (defaults to canonical DEFAULT_SETTINGS)
        model: Override model (auto-picks eleven_v3 when <phoneme> tag present)
        timeout: Request timeout in seconds

    Raises:
        urllib.error.HTTPError on API failure.
    """
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    body = {
        "text": text,
        "model_id": _pick_model(text, model),
        "voice_settings": settings or DEFAULT_SETTINGS,
    }
    if previous_text:
        body["previous_text"] = previous_text

    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}",
        data=json.dumps(body).encode(),
        headers={
            "xi-api-key": _api_key(),
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        out_path.write_bytes(resp.read())
    return out_path


def synth_vo_chain(
    sentences: list[str],
    out_dir: Path,
    *,
    slug: str,
    settings: dict | None = None,
    model: str | None = None,
) -> list[Path]:
    """Synthesize a multi-sentence clip with previous_text chaining.

    Writes <out_dir>/<slug>_s01.mp3 ... <slug>_sNN.mp3. Returns the path list.
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    prev = ""
    for i, sentence in enumerate(sentences, start=1):
        path = out_dir / f"{slug}_s{i:02d}.mp3"
        synth_vo(sentence, path, previous_text=prev, settings=settings, model=model)
        prev = sentence
        paths.append(path)
    return paths


def synth_vo_ab(
    text: str,
    out_dir: Path,
    *,
    variants: dict[str, dict] | None = None,
    previous_text: str = "",
    model: str | None = None,
) -> dict[str, Path]:
    """A/B test the same VO line across multiple voice settings.

    Use this when a script may read robotic at baseline settings — generate
    all three variants, listen, pick the most natural one, lock its settings
    via the `settings` arg on the production synth_vo call.

    Returns dict mapping variant name → mp3 path.
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    variants = variants or AB_VARIANTS
    paths: dict[str, Path] = {}
    for name, settings in variants.items():
        path = out_dir / f"{name}.mp3"
        print(f"  synth A/B variant '{name}': stability={settings['stability']}, style={settings['style']}", file=sys.stderr)
        synth_vo(text, path, previous_text=previous_text, settings=settings, model=model)
        paths[name] = path
    return paths


# ─────────────────────────────────────────────────────────────────────────────
# Forced alignment (word-level timestamps for captions)
# ─────────────────────────────────────────────────────────────────────────────

class AlignmentWord(TypedDict):
    text: str
    start: float
    end: float


def get_forced_alignment(audio_path: Path, transcript: str, *, timeout: int = 60) -> dict:
    """Fetch word-level timestamps for a VO file via /v1/forced-alignment.

    Writes <audio_path>.replace('.mp3', '.words.json') alongside the MP3.
    Returns the parsed JSON response.

    The .words.json file is what video_production_skills/captions/canonical/
    SingleWordCaption.tsx reads at render time. Captions cannot sync
    correctly without it.
    """
    audio_path = Path(audio_path)
    if not audio_path.exists():
        raise FileNotFoundError(f"audio not found: {audio_path}")

    # multipart/form-data manually (avoid adding requests as a dep)
    boundary = "----RyanRealtyAlignment" + str(os.urandom(8).hex())
    audio_bytes = audio_path.read_bytes()
    parts = []
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(f'Content-Disposition: form-data; name="text"\r\n\r\n'.encode())
    parts.append(transcript.encode() + b"\r\n")
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(
        f'Content-Disposition: form-data; name="audio_file"; filename="{audio_path.name}"\r\nContent-Type: audio/mpeg\r\n\r\n'.encode()
    )
    parts.append(audio_bytes + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)

    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/forced-alignment",
        data=body,
        headers={
            "xi-api-key": _api_key(),
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        result = json.loads(resp.read())

    words_path = audio_path.with_suffix(".words.json")
    words_path.write_text(json.dumps(result, indent=2))
    print(f"  alignment → {words_path.name} ({len(result.get('words', []))} words)", file=sys.stderr)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Caption-ready word mapper (for direct hand-off to SingleWordCaption)
# ─────────────────────────────────────────────────────────────────────────────

def alignment_to_caption_words(alignment: dict) -> list[dict]:
    """Map forced-alignment response to the shape SingleWordCaption.tsx expects.

    Input shape:  {"words": [{"text": "...", "start": 0.42, "end": 0.78}, ...]}
    Output shape: [{"text": "...", "startSec": 0.42, "endSec": 0.78}, ...]

    Empty / whitespace-only entries are filtered.
    """
    words = alignment.get("words", [])
    return [
        {"text": w["text"], "startSec": w["start"], "endSec": w["end"]}
        for w in words
        if w.get("text") and w["text"].strip()
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Self-test
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"VOICE_ID         : {VOICE_ID}")
    print(f"DEFAULT_MODEL    : {DEFAULT_MODEL}")
    print(f"DEFAULT_SETTINGS : {DEFAULT_SETTINGS}")
    print(f"A/B VARIANTS     : {list(AB_VARIANTS.keys())}")
    print(f"IPA_PHONEMES     : {len(IPA_PHONEMES)} place names")
    print()
    print("Library OK. Import from a producer script:")
    print("    from scripts._voice_lib import synth_vo, get_forced_alignment")
