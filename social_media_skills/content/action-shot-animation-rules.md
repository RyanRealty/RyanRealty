---
name: action-shot-animation-rules
description: Action Shot Animation Rules — Ryan Realty
---
# Action Shot Animation Rules — Ryan Realty

> **When to read:** Before animating ANY photo containing people doing outdoor activities (mountain biking, kayaking, hiking, skiing, fishing, paddleboarding, rock climbing). This is a companion to `viral-video-quality-gate.md` and `interior-animation-rules.md` — all applicable gates must pass.

## Core Principle

**Landscape stays locked. People get natural, physics-plausible motion.** The camera is on a tripod. The person performs a simple, repetitive, or slow action. Architecture of the landscape never moves. The goal is a living photograph — not a VFX sequence.

---

## What Works vs. What Doesn't

### WORKS (animate these)

| Activity | Why It Works | Key Motion |
|----------|-------------|------------|
| Mountain biking (wide shot) | Repetitive pedaling, small figure in frame | Legs cycling, wheels turning, dust trail |
| Kayaking / canoeing | Repetitive paddle stroke, calm water | Paddle dipping, water ripples spreading |
| Fly fishing | Slow, graceful casting arc | Rod arc, line unfurling, water rings |
| Hiking (distant figure) | Slow walking, small in landscape | Legs stepping, hair/clothes moving |
| Skiing (wide shot) | Carving turns, powder spray | Skier descending, snow spray |
| SUP / paddleboard | Slow paddle strokes on calm water | Paddle movement, gentle wake |
| Rock climbing (wide) | Slow deliberate reach, small against rock | Single limb reach, rope sway |

### FAILS (avoid these compositions)

| Situation | Why It Fails | What Happens |
|-----------|-------------|--------------|
| Close-up of face during activity | Face morphing, identity drift | Eyes melt, jaw warps, uncanny valley |
| Fast multi-person action | Too many moving elements | Limbs multiply, bodies merge |
| Complex body mechanics (gymnastics, yoga) | Unnatural joint articulation | Extra fingers, broken limbs, jello body |
| Person running toward camera | Hard perspective + motion | Body distortion, size warping |
| Group sports (team shots) | Models can't track multiple bodies | People fuse together, limb confusion |
| Tight framing on hands/feet | Fine motor detail beyond model capability | Finger multiplication, melting hands |

---

## Golden Rules

1. **Small figure, big landscape.** The person should be ≤25% of the frame. Landscape dominance = model focuses energy on the easy stuff (clouds, water, trees) and treats the person as a small animation region.

2. **Simple, repetitive motion ONLY.** Pedaling. Paddling. Casting. Walking. Carving. The model excels at looping, physics-plausible motion. It fails at complex, one-off movements.

3. **Face is optional (prefer no face).** Best results come from side angles, back-to-camera, silhouette, or distant shots where the face is <5% of frame area. If face is visible, use micro-movements only (slow head turn, not talking).

4. **One person only.** Never animate a group shot. One figure = model can focus all motion budget on one body.

5. **4-5 seconds max.** Shorter = less drift. At 5s, repetitive motion loops cleanly. Beyond 5s, body proportions start shifting.

6. **Locked camera, always.** No tracking shots, no push-ins, no orbits. Static tripod. The only exception is a very slow (2-3°) push-in, and only if the person is distant.

---

## Model Selection

| Use Case | Best Model | Why |
|----------|-----------|-----|
| Wide landscape + distant person | **Wan 2.7 I2V** | Best at preserving landscape structure while animating small regions |
| Person as primary subject (medium shot) | **Kling 3.0** (via fal.ai) | Better body geometry preservation, less limb distortion |
| Skiing/fast downhill action | **Kling 3.0** | Handles speed + particle effects (snow spray) better |
| Subtle activity (fishing, SUP) | **Wan 2.7 I2V** | Excels at gentle, slow motion in a locked frame |

**Default: Wan 2.7 I2V** — use Kling only when the person is prominent in frame or the motion is fast.

---

## Prompt Templates

### Mountain Biker (Wide Landscape)

```
Static tripod shot, camera completely locked, no camera movement.
Wide landscape shot of [forest trail / desert trail / mountain path].
A single mountain biker [small in frame] pedals steadily along the trail.
MOTION: Cyclist's legs pedaling in smooth rhythm, wheels turning, very subtle dust trail behind.
[Trees / bushes] sway gently in breeze. Clouds drift slowly overhead.
All terrain, rocks, trail surface: completely rigid and static.
No zoom. No pan. No tilt. No body distortion. No face detail.
Cinematic quality, photorealistic landscape photography, natural daylight.
```

### Kayaker / Canoe on Lake

```
Static tripod shot, completely locked camera, no camera movement.
Wide landscape, calm [alpine lake / river] with mountains in background.
A single kayaker [small in frame] paddles slowly across the water.
MOTION: Paddle dips gently into water and lifts, creating small ripples that spread outward. Gentle water surface movement.
Mountains, shoreline, sky: completely rigid and static. Clouds drift slowly.
No zoom. No tilt. No body morphing. No face detail visible.
Photorealistic landscape, golden hour light, cinematic.
```

### Fly Fisher in River

```
Static tripod shot, locked camera, no movement.
Wide river scene, person standing in shallow water [small to medium in frame].
MOTION: Single slow fly-casting arc — rod sweeps back, line unfurls gracefully forward. Water flows gently around legs.
River current flows naturally over rocks. Trees on bank sway subtly.
All riverbed rocks, boulders, banks: completely rigid.
No zoom. No pan. No face detail. No body distortion.
Photorealistic, warm natural light, cinematic outdoor photography.
```

### Hiker on Summit / Trail

```
Static tripod shot, camera completely locked.
Wide mountain landscape, single hiker [small, distant] on trail / summit.
MOTION: Hiker takes slow deliberate steps forward. Hair and jacket move gently in wind.
Clouds drift past peaks. Grass or wildflowers sway in breeze.
All rock, trail, mountain structure: completely rigid and static.
No zoom. No tilt. No face visible. Landscape dominant.
Cinematic, photorealistic, golden hour or overcast light.
```

### Skier (Wide Mountain)

```
Static tripod shot, completely locked camera.
Wide mountain slope, single skier [small in frame] carving turns through powder.
MOTION: Skier descends in smooth carved turns, powder spray trailing behind each turn.
Snow particles drift in air. Clouds move slowly past peak.
All mountain terrain, trees, rock faces: completely rigid and static.
No zoom. No pan. No tilt. No face detail.
Cinematic winter landscape, bright daylight, photorealistic.
```

### SUP / Paddleboard on Lake

```
Static tripod shot, locked camera, no movement.
Calm lake with mountains reflected in water surface. Single paddleboarder [small to medium in frame].
MOTION: Person takes slow, steady paddle strokes. Gentle wake trails behind the board. Subtle water ripples.
Mountain reflection shimmers gently on water surface. Clouds drift slowly.
Shoreline, mountains, sky: completely rigid.
No zoom. No pan. No face detail. No body distortion.
Photorealistic, serene, golden or morning light.
```

---

## Negative Prompt (Always Include)

```
morphing, swimming textures, distortion, camera drift, face morphing, extra limbs, extra fingers, body warping, melting face, uncanny valley, jello effect, rubber body, identity drift, perspective creep, zoom, pan, tilt, edge softening, CGI, cartoon, illustration, 3D render, text, watermark, blurry, oversaturated, motion blur, rolling shutter, multiple people appearing, limb multiplication
```

---

## Pre-Flight Checklist (Before API Call)

Before sending ANY action shot to the animation API:

1. **[ ] Figure size check:** Is the person ≤25% of the frame? If larger, switch to Kling 3.0 or reject the composition.
2. **[ ] Face visibility check:** Is the face >5% of frame area? If yes, either crop wider or ensure prompt uses micro-movement only.
3. **[ ] Single person check:** Is there exactly ONE person in the shot?
4. **[ ] Motion simplicity check:** Is the activity simple/repetitive (pedaling, paddling, walking, casting)?
5. **[ ] Duration set to 5s max?** (4s preferred for medium shots with visible person)
6. **[ ] Locked camera in prompt?** ("Static tripod shot, completely locked camera, no camera movement")
7. **[ ] Negative prompt includes body-specific terms?** (extra limbs, face morphing, body warping, identity drift)

**Pass all 7 = cleared for generation.**
**Fail any 1 = adjust composition or prompt before generating.**

---

## Quality Gate (Action-Specific)

After generation, before brand use:

1. **Body integrity:** Pause at frames 1, middle, last — do all limbs look correct? No extra fingers/arms?
2. **Face check (if visible):** Does the face stay consistent? No melting, morphing, or identity shift?
3. **Motion physics:** Does the motion look physically plausible? No rubber-band limbs, no sliding feet?
4. **Landscape lock:** Did the terrain, rocks, mountains stay perfectly rigid?
5. **Camera stability:** Zero camera drift, zoom, or perspective shift?
6. **Clothing/gear integrity:** Do clothes, helmet, backpack stay consistent? No appearing/disappearing equipment?

**Pass all 6 = cleared for brand use.**
**Fail any 1 = discard and regenerate with adjusted prompt.**

Expected discard rate: **~50-60%** (action shots are the hardest category for i2v models).

---

## Key Differences from Landscape & Interior Rules

| | Landscape | Interior | Action Shot |
|-|-----------|----------|-------------|
| Moving elements | Clouds, water, trees | One (curtain/steam/fire) | One person + environment |
| Main risk | Camera drift | Texture swimming | Body distortion |
| Ideal subject size | N/A (no person) | N/A | ≤25% of frame |
| Face tolerance | N/A | N/A | Prefer invisible or <5% |
| Duration | 5s | 4s preferred | 4-5s |
| Regeneration rate | ~20% | ~40-50% | **~50-60%** |
| Model default | Wan 2.7 | Wan 2.7 | Wan 2.7 (Kling for close) |

---

## Advanced Technique: Wan 2.2 Animate (Future)

When Wan 2.2 Animate becomes available on Replicate/fal.ai:

- **Move model:** Upload a reference video of someone biking/paddling. Upload the landscape photo. The model animates the person in the photo to match the reference motion. Much better body consistency.
- **Replace model:** Upload any activity video + the landscape photo. Model replaces the background while keeping the person's natural motion.

This is the future of action-shot animation — using real human motion as a reference rather than generating it from a text prompt. Not yet available via API but worth watching.

---

*Skill authored 2026-04-18. Sources: Ambience AI Wan prompting guide, Segmind Wan 2.7 guide, wan-animate.com I2V prompting guide, 10b.ai face stability guide, Kling 2.6 motion control documentation.*
