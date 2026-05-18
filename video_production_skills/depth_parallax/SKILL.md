---
name: depth_parallax
kind: capability
description: >
  Remotion component <DepthParallaxBeat> that creates a genuine 3D Ken Burns parallax
  effect from a single listing photo using MiDaS depth estimation. Splits the photo into
  foreground/midground/background layers with different parallax multipliers. Support
  library used by listing_reveal, listing_launch, and neighborhood_tour format skills. 
  do NOT invoke as a standalone content-production skill.
---

# Skill: 3D Ken Burns / Depth Parallax

## What this skill does

Takes a single listing photo, runs it through the MiDaS depth-estimation model, and separates
it into three alpha-composited layer PNGs (background, midground, foreground). The Remotion
component `<DepthParallaxBeat>` renders these three layers with different parallax multipliers
so objects closer to the camera move more than objects far away.  creating a genuine 3D Ken Burns
effect from a still photograph.

The technique is inspired by [3D Ken Burns (Niklaus et al.)](https://github.com/sniklaus/3d-ken-burns).
The depth model is [MiDaS by Intel ISL](https://github.com/isl-org/MiDaS).

---

## When to use

Use `<DepthParallaxBeat>` when the photo has a **strong foreground/background depth separation**
and clean edges at depth boundaries. Strong candidates:

- **Hero exteriors** with mature trees or shrubs in front of the house and open sky behind
- **Kitchen island shots** where the island is near-camera and mountain/window view is far
- **Covered deck views** with railing/posts close and landscape receding into the distance
- **Living room** where a couch foreground separates from art wall and windows behind
- **Aerial-angle exterior** where a fence or pathway recedes toward the house

---

## When NOT to use

- **Flat images**.  straight-on interior shots where everything is on the same plane. MiDaS
  produces a nearly uniform depth map and the parallax is invisible or reads as warping.
- **Faces or people**.  depth boundaries around faces produce uncanny-valley cutout artifacts.
  Skip for any photo where a person is the primary subject.
- **Highly reflective surfaces**.  mirrors, polished floors, glass walls. MiDaS is confused by
  reflections and assigns incorrect depth.
- **Heavy vignette or already-processed photos**.  edge-feathering in the original can bleed
  into wrong layer assignment.
- **Very short beats (< 2.5s)**.  the parallax effect needs time to travel. Below 2.5s use
  a regular `<PhotoBeat>` with a `push_in` or `parallax` move instead.

---

## Install

From the repo root (Python 3.10+ recommended):

```bash
pip install -r video_production_skills/depth_parallax/requirements.txt
```

> **Note:** `torch`, `torchvision`, and `timm` are large downloads (~2 GB total).
> On macOS with Apple Silicon, PyTorch automatically uses the MPS backend for
> GPU-accelerated inference.  no extra flags needed.
> Inference time per image on an M-series Mac mini: roughly **5-8 seconds** (MiDaS small).

---

## Usage

### 1.  Generate depth map and layer PNGs

```bash
python video_production_skills/depth_parallax/generate_depth_map.py \
  --input public/images/v5_library/photo1.jpg \
  --output-dir public/images/v5_library/depth/photo1
```

Optional flags:

| Flag | Default | Description |
|------|---------|-------------|
| `--model small` | `small` | `MiDaS_small`.  fast, good quality |
| `--model large` |.  | `DPT_Large`.  slower but sharper depth edges |

### 2.  Inspect the output

The script writes these files to `--output-dir`:

| File | Description |
|------|-------------|
| `depth.png` | 8-bit grayscale depth map (0 = far/black, 255 = near/white) |
| `bg.png` | Background layer (depth < 33rd percentile), RGBA PNG |
| `mid.png` | Midground layer (33rd-66th percentile), RGBA PNG |
| `fg.png` | Foreground layer (depth ≥ 66th percentile), RGBA PNG |
| `manifest.json` | Metadata: source path, depth path, layer bounds, image size |

Open `depth.png` in Preview to validate: the house façade should be mid-grey, a tree in
front should be bright white, sky/mountains behind should be dark.

### 3.  Wire up the Remotion beat

In `Listing.tsx`, replace the `<PhotoBeat>` for the target beat with `<DepthParallaxBeat>`:

```tsx
// Before:
<PhotoBeat
  photo="v5_library/photo1.jpg"
  local={local}
  fps={fps}
  durationSec={durationSec}
  move={{ move: 'push_in' }}
  title="Chef's Kitchen"
  sub="Panoramic mountain view"
/>

// After:
import { DepthParallaxBeat } from './components/DepthParallaxBeat';

<DepthParallaxBeat
  photo="v5_library/photo1.jpg"
  depthDir="v5_library/depth/photo1"
  local={local}
  fps={fps}
  durationSec={durationSec}
  move={{ move: 'push_in' }}
  title="Chef's Kitchen"
  sub="Panoramic mountain view"
/>
```

`depthDir` is the path **under `public/images/`** to the folder containing `bg.png`, `mid.png`,
`fg.png`. It must match the `--output-dir` path you passed to `generate_depth_map.py` (relative
to `public/images/`).

All other props (`title`, `sub`, `titlePosition`, `scrim`, `crossfadeIn`, `crossfadeOut`,
`vignetteLetterbox`, `objectPosition`) are identical to `PhotoBeat`.

---

## How the parallax works

`<DepthParallaxBeat>` calls the same `cameraTransform()` from `cameraMoves.ts` to get the
base motion transform, then scales it per layer with these multipliers:

| Layer | Pan/translate mult | Scale offset mult |
|-------|--------------------|-------------------|
| bg    | 0.4×               | 0.95×             |
| mid   | 1.0×               | 1.0×              |
| fg    | 1.6×               | 1.08×             |

Example: on a `push_in` beat, the background barely grows while the foreground pushes in
noticeably more, giving the eye a convincing sense of camera-forward motion through space.
On a `slow_pan_lr`, the foreground streaks across the frame while the background drifts gently.

---

## Hardware note

MiDaS `small` runs entirely on CPU if MPS is unavailable, but on any M1/M2/M3/M4 Mac the
MPS backend is selected automatically:

```
device=mps  →  ~5-6s/image
device=cpu  →  ~20-30s/image
device=cuda →  ~2-3s/image (Linux/Windows with NVIDIA)
```

The `large` (`DPT_Large`) model is roughly 3-5× slower but produces crisper depth edges. 
worth it for hero shots where layer boundaries are visible.
