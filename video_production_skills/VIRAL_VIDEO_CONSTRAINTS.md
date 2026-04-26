# Viral Video Constraints — Quick Reference

**This is the 30-second scan card.** The full master skill is in `VIDEO_PRODUCTION_SKILL.md` — read that before scaffolding. This file is for double-checking work in progress.

---

## Hard constraints (each is a ship blocker)

### Length
- [ ] **30-45s target. Never over 60s.**
- [ ] Default for new builds: **45s**.

### Hook (first 2s)
- [ ] **Frame 0 has motion engaged** by frame 12 (0.4s). Never static.
- [ ] **Address text on screen by 1s.** Centered, ≥48 px body / 64-80 px headline.
- [ ] **VO content begins by 2s.** No greetings, no "today I'm going to."
- [ ] **No logo, no brokerage name, no title card on black** in the open.

### Cuts
- [ ] **Standard 2-3s per beat.** Luxury drone 3-4s **MAX**.
- [ ] **No beat over 4s. Period.**
- [ ] **12-15 beats minimum** in a 45s video.

### Re-hooks
- [ ] **25% mark:** new visual register or text shock.
- [ ] **50% mark:** pattern interrupt (exterior cut into interior tour, drone wide cut into closeups, sepia cut into color, etc.).
- [ ] **Final 15%:** kinetic stat reveal.

### Text overlays
- [ ] **Safe zone 900×1400** centered in 1080×1920.
- [ ] **Min 2s display per block.**
- [ ] **Body 48 px+, headline 64-80 px.**
- [ ] **Max 5-7 words per block.**
- [ ] **Numbers carry units** ("$3,025,000" not "3,025,000").
- [ ] **High contrast** — white + shadow OR dark pill under text.

### Retention
- [ ] **70%+ retention** through first 30s is the target.
- [ ] **Always include captions** — ~40% IG / ~85% FB views are muted.
- [ ] **No filler** — every second earns its place.

### Motion
- [ ] **Gimbal/parallax on every photo beat.** No static photos.
- [ ] **Three movement types minimum** per video.

### Branding (zero in frame)
- [ ] **No logo, no "Ryan Realty" text, no phone, no agent name** anywhere in the video frame.
- [ ] **No "REPRESENTED BY" line in the reveal.**
- [ ] Brokerage attribution lives in the IG caption + bio, never the frame.

### Audio
- [ ] **Music starts frame 1** (when music is in scope; some viral cuts ship VO-only).
- [ ] **Music ducks under VO** to ~-18 dB.
- [ ] **Music swells into the reveal.**
- [ ] **Adjacent VO lines have positive gaps** (no overlap).
- [ ] **`previous_text` chained** when synthing multi-line scripts (prosody continuity).

### Render hygiene
- [ ] **Resolution: 1080×1920 portrait, 30 fps.**
- [ ] **Remotion only.** No Playwright video, no PIL composition.
- [ ] **`concurrency=1`** in render command (Chrome OOMs higher).
- [ ] **PhotoBeat parent div is transparent** (so the previous Sequence shows through fade-in).
- [ ] **`crossfadeOut: 0`** by default; each Sequence overlaps the previous by 0.5s so AbsoluteFill never exposed.
- [ ] **Final encode: x264, CRF 24, faststart.** Compressed file under 100 MB.

---

## Pre-render checklist

Run this BEFORE every render:

```
[ ] All photo paths exist (modern/, historic/, snowdrift/, masks/)
[ ] All VO files in public/audio/ referenced by Listing.tsx
[ ] public/images/maps_z15.png exists (if open uses satellite tile)
[ ] public/brand/stacked_logo_white.png exists (only if outro uses it — viral cuts skip this)
[ ] public/fonts/AzoSans-Medium.ttf, Amboqia_Boriango.otf
[ ] node_modules/@remotion present (npm install if not)
[ ] BEATS array uses 3+ different motion types
[ ] No banned words in VO or on-screen text
[ ] Reveal contains kinetic stat only (no brokerage line, no logo)
```

## Post-render quality gate

Run this BEFORE pushing or emailing:

```
[ ] ffprobe Duration: between 30s and 60s
[ ] ffmpeg blackdetect strict (pix_th=0.05) returns ZERO black sequences
[ ] Frame at 0s has motion, address overlay, photo content (not black)
[ ] Frame at 25% has new visual register or text overlay
[ ] Frame at 50% has pattern-interrupt visual
[ ] Frame at final 15% is kinetic reveal text on navy
[ ] No frozen frames at any beat boundary
[ ] Audio probe: VO clear, no overlap between lines
[ ] File size < 100 MB after CRF 24 compress
```

---

## When something fails

| Symptom | Fix | Where |
|---|---|---|
| Black bars at transitions | Parent div transparent + crossfadeOut 0 + Sequence overlap | `PhotoBeat.tsx` |
| Black at open → Beat 1 | OpenSequence Sequence runs 0.5s past Beat 1 startSec | `Listing.tsx` |
| Audio mismatch | `previous_text` chained synth | `synth_vo_*.py` |
| Deschutes pronunciation | IPA `<phoneme>` tag on `eleven_v3` | `synth_vo_*.py` |
| Missing assets | Run `build_v5_library.py` + verify symlinks | pre-render |
| Generic feel | Re-read VIDEO_PRODUCTION_SKILL.md Section 2 | before BEATS rewrite |

---

## Banned (each is a hard rule)

- Length over 60s
- Static frame 0
- Logo / brokerage / phone / agent name in frame
- Pure-black letterbox bars
- AI photo-to-video on interior architecture
- Generic VO ("welcome to your dream home", "stunning", "nestled")
- Em-dashes or hyphens in prose copy
- Reusing a clip or photo within a single video
- "Approximately," "roughly," "about" in numbers
- Reveal that includes contact info

---

## Shipped patterns that work

- Address overlay on hero exterior (vignetteLetterbox + blurred photo backdrop) at frame 0
- Hook VO that combines architect + location in one short line
- Pattern interrupt at 50% via drone aerial after interior closeups
- Kinetic stat reveal: PENDING / price / address (no brokerage)
- ffmpeg blackdetect verification before push
- `previous_text` prosody chaining for VO consistency
- Per-photo motion as judgment work (not delegated to Sonnet)
- 14 photo beats at 2.5-3s each in a 45s frame

---

Full reasoning, history, and lesson log: `VIDEO_PRODUCTION_SKILL.md`.
