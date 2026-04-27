---
name: depthflow_pipeline
description: Generates 2.5D parallax videos from a single still photo using Depth Anything V2 for depth estimation and DepthFlow for camera-driven 2.5D rendering. Use this for listing-photo motion sequences, neighborhood drone-still re-animation, or any case where a flat photo needs to feel like a moving camera shot without re-shooting.
---

# DepthFlow Pipeline

## What it is

A two-step pipeline that turns a single 2D photo into a 2.5D parallax video:

1. **Depth Anything V2** (DA-V2) generates a per-pixel depth map from the input photo.
2. **DepthFlow** consumes that depth map plus the original RGB and renders a video where a
   virtual camera moves through 3D space, producing parallax (foreground moves faster than
   background) and dolly/zoom effects that look like a real cinematographer's shot.

This replaces the **Ken Burns crop-and-pan** approach used in `listing_video_v4` v1–v3 and
the **manual cinemagraph mask overlay** approach used in v4. The cinemagraph approach still
wins for one-off "horse in the field" style shots; DepthFlow wins for: any photo where the
viewer sees foreground/midground/background depth, and we want the camera to feel like it's
moving through space.

## Why Depth Anything V2 (not MiDaS)

- DA-V2 was state-of-the-art on monocular depth as of 2024-2025 and remains the strongest
  generalist baseline for outdoor real-estate scenes through April 2026.
- MiDaS (the v4 default for many Stable-Diffusion / 2.5D pipelines) blurs depth at depth
  discontinuities — eaves, rooflines, tree edges — producing the classic "stretching"
  artifact when the camera dollies in.
- DA-V2 ships in three sizes: Small (24M params), Base (97M), Large (335M). For listing
  photos at 4K we use Large; for neighborhood drone stills at 1080p we use Base. Small is
  for batch-processing dozens of photos in <1s each — useful for the trend_trigger skill
  burst-render path.

The Tumalo v5 build (this skill's proof-of-correctness) uses **Large**.

## Why DepthFlow (not pure Python with cv2.warpAffine)

- DepthFlow ships a real-time GLSL shader pipeline that handles disocclusion (the gaps
  revealed when foreground moves and background was hidden) via a learned in-painting
  pass. Pure cv2 warps produce hard black edges in disocclusion regions.
- DepthFlow exposes camera animations as Python objects: `Dolly`, `Zoom`, `Orbital`,
  `Vertical`, `Horizontal`, `Circle`, plus `lambda t: ...` for custom rigs. Easy to wire
  to a beat-synced timeline.
- DepthFlow renders via FFmpeg directly to MP4 H.264 (or any codec FFmpeg supports). No
  intermediate frame dump.
- BrokenSource/DepthFlow is actively maintained as of April 2026. See
  `https://github.com/BrokenSource/DepthFlow`.

## Install

```
pip install depthflow              # pulls in PyTorch, torchvision, OpenGL, FFmpeg bindings
pip install depth-anything-v2      # the depth model (separately published)
# or, if depth-anything-v2 is not on PyPI by your install date:
pip install git+https://github.com/DepthAnything/Depth-Anything-V2.git
```

GPU: DA-V2 Large needs ~6 GB VRAM; on the M3 Max it runs via MPS at ~1.2s/image at 1080p.
DepthFlow uses GPU for the GLSL shader and falls back to CPU OpenGL — the M3 Max GPU is fine.

## Pipeline (Tumalo v5 reference build)

```
input_photo.jpg          (4032×3024 iPhone original)
  │
  ▼ resize_for_depth.py   (downsamples to 1080×1920 if needed, preserves EXIF)
input_photo_resized.jpg
  │
  ▼ depth_anything_v2_run.py   (DA-V2 Large, fp16 on MPS)
depth_map.png            (16-bit grayscale, same dims as input)
  │
  ▼ depthflow_render.py        (animates camera per beat track)
shot_v5_scene01.mp4      (1080×1920 portrait, 30fps, ~2-4s clip)
  │
  ▼ stitch_with_remotion.tsx   (mounts each shot as <Video> with Sequence)
tumalo_v5.mp4            (final, music + VO + endcard)
```

The Remotion stitch step is the same pattern used today for `tumalo_v4.mp4`. The DepthFlow
output is ingested as a `<Video>` source rather than rendering each frame in Remotion. This
keeps the heavy depth/parallax math in DepthFlow's GLSL pipeline and the timeline / VO /
captions in Remotion.

## Camera moves (DepthFlow recipe per shot type)

| Shot intent | DepthFlow rig | Notes |
|---|---|---|
| Establishing | `Dolly(intensity=0.6, smooth=0.8) + Zoom(intensity=0.05)` | Slow forward push, micro-zoom for cinematic feel |
| Hero hold | `Orbital(intensity=0.8, smooth=1.0)` | Subtle parallax orbit so the still feels alive without committing direction |
| Reveal | `Dolly(intensity=1.0) + Vertical(intensity=0.4)` | Push-and-tilt-up — best when subject is in lower third |
| Texture/detail | `Zoom(intensity=0.4) + Horizontal(intensity=0.2)` | Slow zoom with whisper-pan, good for "wide-plank floors" type shots |
| Sky/cascade | `Vertical(intensity=0.6) + Horizontal(intensity=0.3)` | Drift-up with slight side, mimics a stabilizer-on-stick shot |

The intensities pair to a beat tempo. For 90-110 BPM music (most cinematic listing edits),
intensities of 0.6–0.8 land each "feels-cinematic" beat without becoming rocking.

## What this is NOT for

- Photos where there is no real foreground/midground/background depth (sky-only, a flat
  countertop). DepthFlow will run but produce a flat 2D pan that looks worse than a Ken
  Burns crop because the depth map is mostly noise.
- Photos with people (Stable-Diffusion-style depth models still butcher fingers and eyes
  under camera motion). Use a real video clip or a static portrait.
- AI-generated photos. The ANTI_SLOP_MANIFESTO bans AI photos for property/people/Bend
  geography. DepthFlow on an AI photo of "Bend in autumn" is double the violation —
  fabricated content with synthetic camera motion masking it.

## Pre-render gate (mirrors VIDEO_PRODUCTION_SKILL gate)

Before any DepthFlow output ships:

1. Photo source must be traced (photographer + date OR MLS ID OR Matt's iPhone OR drone
   operator OR licensed stock with provider+ID).
2. AI disclosure pill present if the photo is AI-enhanced (it should not be — see above).
3. Camera motion must serve a beat or VO line. Decorative motion = banned.
4. No more than 4s on a single still — viewer fatigue + AI-detection cue. Stitch multiple
   stills via Remotion Sequence.

## Tumalo v5 — implementation status

**Scaffolded only as of 2026-04-26.** DepthFlow is not yet installed on this machine. Next
implementation steps:

1. `pip install depthflow depth-anything-v2` (one-time).
2. `video_production_skills/depthflow_pipeline/scripts/depth_anything_v2_run.py`.
3. `video_production_skills/depthflow_pipeline/scripts/depthflow_render.py`.
4. Source 6–8 Tumalo photos (drone establishing + 5 interior + 2 exterior detail).
5. Generate depth maps + DepthFlow MP4s for each.
6. Build `listing_video_v4/src/TumaloV5.tsx` that mounts each MP4 as `<Video>` per beat.
7. Synth VO via ElevenLabs voice 4YYIPFl9wE5c4L2eu2Gb (listing voice).
8. Music bed: register-matched per VIDEO_PRODUCTION_SKILL §5.
9. Render via `npm run video:tumalo:v5`.
10. Run quality gate: ffmpeg blackdetect, scorecard.json, citations.json.

## Reference: BLONDE_WATERFALL_DECONSTRUCTION

The viral "blonde waterfall" listing-tour reel that Matt referenced as the inspiration uses
this exact pipeline (depth estimator + 2.5D camera + Remotion stitch). The
deconstruction notes in `video/cascade-peaks/BLONDE_WATERFALL_DECONSTRUCTION.md` (if
present) and the Cowork-mounted `work/cascade_peaks` projects document the specific camera
intensities the original author chose. Match those for the first build; iterate per beat
afterward.

## Failure modes

| Failure | Detection | Recovery |
|---|---|---|
| Depth map has hard edges (DA-V2 confidence low on a region) | Manual visual check, or run a Sobel filter on the depth map and flag areas with edge density > threshold | Re-run with DA-V2 Large at a higher input resolution; if still bad, fall back to Ken Burns for that shot |
| DepthFlow disocclusion in-painting visible (smudge/streaks at object edges during camera motion) | Frame-by-frame review at 25%, 50%, 75% of each shot | Reduce camera intensity (0.6 → 0.4); or shorten the shot to 1.5s so the artifact never reaches a noticeable frame |
| GPU OOM on M3 Max with DA-V2 Large at 4K | RuntimeError from torch | Resize input to 1080×1920 before depth pass; DA-V2 still produces a clean map at that resolution |
| MPS compute disagreement vs CUDA reference (rare; DA-V2 is mostly fp16-safe on Apple Silicon) | Visual diff vs a CUDA-rendered reference shot | Force fp32 on MPS for that pass (slower, ~2s/image at 1080p, still acceptable) |

## Open questions

1. **Real-time parallax for live tours.** DepthFlow can run the shader at 60fps on a
   webcam-rate input. Future work: wire this to an in-browser viewer for an "explore the
   listing" experience on each property page.
2. **Per-beat intensity learning.** The intensity pairings above are hand-picked. With
   enough scored renders (`scorecard.json` × DepthFlow params), `automation/performance_loop`
   could learn which intensities correlate with retention and tune per-shot defaults.
3. **Depth model swap.** DA-V2 is current best. ZoeDepth and Marigold are competitive on
   indoor scenes; if a future version of DA materially regresses, fall back to ZoeDepth via
   the same pipeline (DepthFlow takes any 16-bit depth map).

## Related

- `video_production_skills/VIDEO_PRODUCTION_SKILL.md` — master gate every render passes.
- `video_production_skills/cinematic_transitions/SKILL.md` — sibling motion skill for
  beat-synced cuts that complement DepthFlow shots.
- `BLONDE_WATERFALL_DECONSTRUCTION.md` — viral reference build, same pipeline.
- `social_media_skills/content/animation_rules/SKILL.md` — defines the per-platform motion
  intensity caps (TikTok tolerates more aggressive parallax than IG Reels).
