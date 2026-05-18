---
name: audio_sync
kind: capability
description: >
  Beat detection and audio-sync library. Takes a music bed or combined VO+music track
  and produces beats.json with tempo, beat timestamps, downbeat timestamps, and onset
  timestamps. Remotion compositions import beats.json to snap cut startSec values to
  the nearest beat within ±0.15s. Support library used by listing_reveal,
  neighborhood_tour, and other format skills. Do NOT invoke as a standalone
  content-production skill.
---

# Skill 4.  Music/Audio Sync (Beat Detection)

## Overview

Input: a music bed or combined VO+music track (mp3 or wav).
Output: `beats.json`.  a JSON file containing tempo, beat timestamps, downbeat timestamps, and onset timestamps.

The Remotion composition imports `beats.json` and snaps cut `startSec` values to the nearest detected beat, within a ±0.15s tolerance window, using `snapToNearestBeat()` from `listing_video_v4/src/lib/beats.ts`.

---

## When to Use

Use this skill any time the video has a music bed where cuts should feel locked to the music.  the editing energy comes from the rhythm, not from arbitrary timer cuts.

**Trigger condition:** music bed present + cuts are timed by hand → run beat detection and snap.

---

## When NOT to Use

- **VO-only videos with no music bed.** The current Vandevert v5.9 cut is VO-only (`// VO only.  no music bed. Matt adds music in post.`). Beat detection is irrelevant for that cut; skip this skill entirely.
- **Narration-paced docs or testimonials** where the edit follows speech rhythm, not musical rhythm.

---

## Register Warning: Luxury vs. Sub-$500K

Beat-aligned cuts produce a "TikTok-y" energy.  fast, rhythmic, punchy. That energy can **clash with $1M+ luxury register**, which reads better with breathing room and deliberate pacing.

| Price tier | Beat-snapping strategy |
|---|---|
| **Sub-$500K / starter homes** | Snap **every** cut to the nearest beat. Full grid-lock feel. |
| **$500K-$1M mid-market** | Snap most cuts; give emotional beats (hero exterior, final reveal) a half-beat of breathing room. |
| **$1M+ luxury** | Snap only the **re-hook moments**.  at ~25% and ~50% of total runtime (the pattern interrupts). Leave every other cut free-floating. The score should feel like it's supporting the image, not driving it. |

---

## Install

```bash
cd video_production_skills/audio_sync
pip install -r requirements.txt
```

Optional (more accurate downbeat detection, harder install):
```bash
# pip install madmom   # see requirements.txt.  commented out
```

---

## Usage

```bash
python scripts/detect_beats.py \
  --audio listing_video_v4/public/audio/music_bed_v5.mp3 \
  --output listing_video_v4/public/audio/beats.json
```

Additional flags:
```bash
python scripts/detect_beats.py \
  --audio <path>        # required: mp3 or wav
  --output <path>       # required: where to write beats.json
  --hop-length 512      # librosa hop length (default 512)
  --tightness 100       # beat-tracker tightness (default 100; raise to 400 for strict grid)
```

---

## Output JSON Shape

```json
{
  "audio": "music_bed_v5.mp3",
  "duration_s": 47.2,
  "tempo_bpm": 92.5,
  "beats": [0.16, 0.81, 1.47, 2.13],
  "downbeats": [0.16, 2.79, 5.41],
  "onsets": [0.16, 0.42, 0.81]
}
```

| Field | Source | Description |
|---|---|---|
| `beats` | `librosa.beat.beat_track` | Every beat in the bar grid |
| `downbeats` | Every 4th beat from index 0 (heuristic) | Approximate bar-1-beat-1 timestamps. **Limitation:** librosa does not ship a robust downbeat detector.  this is a ÷4 approximation. For high-accuracy downbeats on complex arrangements, see `madmom` (commented out in requirements.txt). |
| `onsets` | `librosa.onset.onset_detect` | Sharp transients (percussive hits, string attacks). Often more useful than beats for cut points in energetic tracks. |

---

## Using in Remotion

```ts
import beatsData from '. /public/audio/beats.json';
import type { BeatsManifest } from './lib/beats';
import { snapToNearestBeat, snapBeatsArray, enforceBeatBounds } from './lib/beats';

const manifest = beatsData as BeatsManifest;

// Snap a single cut point
const snappedStart = snapToNearestBeat(beat.startSec, manifest.beats, 0.15);

// Snap all BEATS start times at once
const rawStarts = BEATS.map(b => b.startSec);
const snapped = snapBeatsArray(rawStarts, manifest.beats, 0.15);
const enforced = enforceBeatBounds(snapped, 2.0, 4.0);
```

The `enforceBeatBounds` call enforces the master-skill hard rule: **no beat shorter than 2s, no beat longer than 4s** (from `VIDEO_PRODUCTION_SKILL.md` Section 1).

---

## Audio Library Manifest

See `video_production_skills/audio_sync/audio_library_manifest.json` for the track library.
Files should land in `listing_video_v4/public/audio/library/`.

---

## Verification Checklist (before any video ships with beat-snapped cuts)

1. Run `detect_beats.py` fresh.  do not reuse a cached `beats.json` from a prior session.
2. Print the human-readable trace output and confirm tempo + beat count are plausible for the track.
3. After snapping, visually scrub the Remotion preview at every cut point. The cut should land on a musical accent, not a dead silence.
4. Run `enforceBeatBounds` and confirm no beat exceeds 4s (hard cap from master skill).
5. If luxury register: confirm only re-hook beats (25% / 50%) are snapped; remaining cuts feel floating.
