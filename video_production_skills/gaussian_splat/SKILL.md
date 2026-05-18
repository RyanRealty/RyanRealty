---
name: gaussian_splat
kind: capability
description: >
  Gaussian splatting flythrough pipeline for premium listings $1M+. Reconstructs a 3D
  scene from 30+ property photos using Gaussian splatting and renders cinematic walkthrough
  clips. Used as a capability inside listing_reveal and listing_launch for qualifying
  luxury properties. Do NOT invoke as a standalone content-production skill; cinematic-cut
  deliverable only (banned from standard 45s viral cut).
---

# Skill 2.  3D Home Renders / Gaussian Splatting Flythroughs

**Read VIDEO_PRODUCTION_SKILL.md Section 1 before using this skill.** Hard constraints (beat length, hook, retention) override everything here.

---

## When to Use

- Premium listings **$1M+** only. This is a hero-property deliverable, not a general workflow.
- You have **30+ property photos** taken with reasonable overlap (adjacent rooms captured from multiple angles, not one shot per room).
- OR you have a **phone walkthrough video** (we frame-extract at 0.5s intervals to build the image set).
- The shoot was done in a **single lighting session**.  morning or afternoon, not a mix. Gaussian splat training requires consistent illumination across all input frames; photos taken hours apart in different light will produce floating artifacts.

## When NOT to Use

- Fewer than 25 usable photos.
- Photos with motion blur (hand-held interior without stabilization, HDR bracketing sequences with ghosting).
- Photos taken in drastically different lighting conditions (e.g., some at noon, some at dusk).
- Single-room shoots or isolated detail shots only.  you need enough spatial coverage to reconstruct a 3D scene.
- Any listing under $1M.  use standard `PhotoBeat` parallax motion instead.
- **Viral 45s cut**.  see constraint below.

---

## CRITICAL: Viral Cut Constraint (Inherited from VIDEO_PRODUCTION_SKILL.md Section 1)

> **No beat over 4 seconds. Period.**

Gaussian splat flythroughs are **cinematic-cut deliverables only**.  the longer-form 60-90 second walk-through version Matt posts separately. They are **banned from the standard 45s viral cut**. A 5-10s flythrough clip in a 45s reel violates the beat-length hard constraint and will tank retention.

The deliverable this skill produces drops into cinematic cuts, listing presentation decks, property website hero sections, and YouTube long-form.  not TikTok/IG Reels viral edits.

---

## Hardware Requirements (Be Honest)

### COLMAP (pose estimation)

COLMAP runs on CPU with optional GPU acceleration. On the Mac mini M2 Pro or M4:

- **Expect 30-90 minutes** for 50 photos to estimate camera poses (feature extraction + matching + sparse reconstruction).
- CPU-only on Apple Silicon.  COLMAP's CUDA path does not run on MPS.
- Output: a `sparse/` folder with camera poses, a point cloud, and an `images/` working set.

### Nerfstudio `splatfacto` (Gaussian splat training)

Nerfstudio's Gaussian splatting trainer (`splatfacto`) is built around CUDA. On Apple Silicon:

- MPS (Metal Performance Shaders) support in nerfstudio is **partial and experimental** as of 2025. Expect crashes or extremely slow training.
- **Realistic training time on Mac mini M2 Pro / M4:** 4-10 hours per scene (vs ~30 minutes on an NVIDIA 4090).
- **Do not run training locally on Mac mini** unless you have time to burn and the scene is simple.

### Practical Recommendation: Cloud GPU

Run COLMAP locally (CPU is fine, just slow), then ship the COLMAP workspace to a cloud GPU for training:

- **RunPod / Lambda / vast.ai** with an NVIDIA 4090 or 3090
- Cost: ~$0.40/hr × 1 hour = **~$0.40 per scene**
- Use `--cloud-gpu` flag with the wrapper script.  it prints the exact `ns-train` command to paste into the cloud session and where to drop the checkpoint back.

### Disk Budget

Plan for ~5 GB per scene:
- Raw photos: ~500 MB (50 × 10 MB JPEGs)
- COLMAP workspace (features, matches, sparse model): ~500 MB
- Nerfstudio checkpoint / splat: ~1-2 GB
- Render cache + output MP4: ~500 MB

---

## Expected Wall-Clock Timeline

| Stage | Where | Time |
|---|---|---|
| Prepare inputs (frame extract or copy) | Local | 1-5 min |
| COLMAP pose estimation | Local (CPU) | 30-90 min |
| Gaussian splat training | Cloud GPU (4090) | 30-60 min |
| Camera path render | Local | 5-15 min |
| **Total** | | **~1.5-3 hrs** |

---

## Output Format

- **Resolution:** 1080×1920 (vertical, mobile-first 9:16).  matches the Remotion composition canvas.
- **Duration:** 5-10 seconds for cinematic cut beats. Set to 8s for orbit, 6s for flythrough, 5s for dolly (matching the presets below).
- **Codec:** H.264, ~8 Mbps, for compatibility with Remotion's `<OffthreadVideo>`.
- Drop the output MP4 into `listing_video_v4/public/clips/` before rendering.

---

## Install

### COLMAP

```bash
brew install colmap
```

One-liner, ~1-2 GB with dependencies. Verify: `colmap --help`.

### Nerfstudio

Full install per https://docs.nerf.studio/quickstart/installation.html.  **do not pip-install into your system Python**. Use a dedicated conda env:

```bash
conda create --name nerfstudio -y python=3.10
conda activate nerfstudio

# xcode command-line tools (required on macOS.  run once)
xcode-select --install

# Core ML stack
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
pip install ninja

# tinycudann.  the painful one on macOS
# On Mac mini (no CUDA), this builds a CPU/MPS stub that may not support all ops.
# If the build fails, try: TCNN_CUDA_ARCHITECTURES="" pip install git+https://github.com/NVlabs/tiny-cuda-nn/#subdirectory=bindings/torch
pip install git+https://github.com/NVlabs/tiny-cuda-nn/#subdirectory=bindings/torch

# Nerfstudio itself
pip install nerfstudio
```

**Honest warning:** `tinycudann` is the hardest part of the install on macOS. It is a CUDA extension; the MPS/CPU fallback is not feature-complete. If you're only doing pose estimation on Mac and training on a cloud GPU, you don't need a fully working nerfstudio install locally.  COLMAP is sufficient for the local stages.

Verify: `ns-train --help`.

---

## Usage

```bash
python scripts/gaussian_flythrough.py \
  --photos./path/to/photos \
  --output./flythrough.mp4 \
  [--cloud-gpu] \
  [--camera-path orbit|flythrough|dolly] \
  [-v]
```

### Flags

| Flag | Default | Description |
|---|---|---|
| `--photos` | required | Path to a folder of JPEGs/PNGs, OR a single `.mp4` walkthrough video |
| `--output` | required | Output MP4 path |
| `--camera-path` | `orbit` | Camera preset: `orbit`, `flythrough`, or `dolly` |
| `--cloud-gpu` | off | Skip training; print cloud GPU instructions and exit |
| `--workdir` | auto (temp) | Reuse an existing COLMAP workspace to skip pose re-estimation |
| `-v` | off | Show subprocess stdout (verbose) |

---

## Camera Path Presets

### `orbit` (8 seconds)
360° lazy-susan orbit around the scene centroid at chest height. Works well for exteriors, great rooms, and open-plan spaces. The camera circles the point cloud at a fixed radius, always facing the centroid.

### `flythrough` (6 seconds)
Forward motion through the scene.  enters one space and drifts toward another. Best for open floor plans where the camera can "walk through" a great room into a kitchen or from a foyer toward a view window. Requires good spatial coverage of a connected path.

### `dolly` (5 seconds)
Slow lateral slide while looking at the property. Works for exteriors, dramatic facades, or rooms with a strong feature wall. Simpler camera path, lower risk of artifacts at the edges of the training coverage.

---

## Remotion Integration

After render, copy the output MP4 to `listing_video_v4/public/clips/flythrough.mp4`. Add it to the BEATS array in `Listing.tsx` as a Sequence wrapping `<OffthreadVideo>`:

```tsx
import { OffthreadVideo, Sequence, staticFile } from 'remotion';

// In your composition JSX (cinematic cut only.  NOT the 45s viral cut):
<Sequence from={beatStartFrame} durationInFrames={8 * 30}>
  <OffthreadVideo src={staticFile('clips/flythrough.mp4')} />
</Sequence>
```

Where `beatStartFrame = Math.round(beatStartSec * FPS)`.

Notes:
- `<OffthreadVideo>` renders frame-accurately.  no seeking artifacts.
- The clip plays at native resolution (1080×1920). No scaling needed if the Remotion comp is already 1080×1920.
- For cinematic cuts that start with the flythrough as the hero beat, set `from={0}`.
- Audio: the flythrough clip has no audio. Add music separately via `<Audio>` in the Remotion comp or in post.

---

## References

- Nerfstudio: https://github.com/nerfstudio-project/nerfstudio
- Nerfstudio docs: https://docs.nerf.studio
- COLMAP: https://colmap.github.io
- `splatfacto` model card: https://docs.nerf.studio/nerfology/methods/splat.html
- RunPod (cloud GPU): https://www.runpod.io
- vast.ai (cloud GPU): https://vast.ai

---

## Related Skills

- `video_production_skills/depth_parallax/`.  2.5D parallax from a single photo (no 3D reconstruction needed; runs entirely locally; works for any listing).
- `VIDEO_PRODUCTION_SKILL.md`.  master constraints, beat rules, brand rules.
- `VIRAL_VIDEO_CONSTRAINTS.md`.  30-second checklist; confirms this skill's output is cinematic-cut only.
