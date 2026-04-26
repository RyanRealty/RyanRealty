---
name: interior-animation-rules
description: Interior Photo Animation Rules — Ryan Realty
---
# Interior Photo Animation Rules — Ryan Realty

> **When to read:** Before animating ANY interior listing photo (living room, kitchen, bedroom, bathroom, detail shot). This is a companion to `viral-video-quality-gate.md` — both must pass.

## Core Principle

**Same as landscape, but stricter.** Locked camera. Only elements with natural independent motion animate. Architecture NEVER moves. Period.

---

## Safe Motion Elements (Interior)

These are the ONLY things that may animate in an interior shot:

| Element | Motion Type | Prompt Language |
|---------|------------|-----------------|
| Sheer curtains | Gentle breathing at window edge | "barely perceptible," "subtle" |
| Fireplace flames | Natural flicker | "gentle fire flicker" |
| Steam / vapor | Slow vertical drift from mug, kettle, shower | "slow, vertical drift only" |
| Light shafts | Sunlight shifting 2-3 degrees | "light shaft shifts slowly" |
| Houseplant leaves | Micro-sway | "gentle," "subtle," "barely" |
| Dust motes | Floating in light beam | "drifting slowly in sunbeam" |
| Candle flame | Natural flicker | "subtle candle flame movement" |
| Water reflections | Light shifting on countertop/floor | "light reflection gently shifting" |

## Never-Move Elements

These must remain **100% rigid and static**:

- Walls, ceilings, floors (ALL structural surfaces)
- Hard furniture (sofas, tables, chairs, beds, cabinets)
- Countertops, backsplash, appliances
- Door frames, windows (the frames, not curtains)
- Art on walls, mirrors
- Light fixtures (body — glow can shift)
- Tile, hardwood, carpet (zero texture movement)

---

## Model Selection

| Use Case | Best Model | Why |
|----------|-----------|-----|
| Atmospheric animation (curtains, steam, light) | **Wan 2.1/2.7 I2V** | Best at locked-camera + single-element motion |
| Slow dolly into room | **Kling 3.0** (via fal.ai or KlingAI) | Better geometry preservation during camera movement |
| Detail shots (fireplace, faucet) | **Wan 2.1/2.7 I2V** | Excels at isolated element animation |

**Default: Wan 2.7 I2V** for all interior cinemagraph work.

---

## Prompt Templates

### Living Room / Bedroom (Atmospheric)

```
Static tripod shot, camera locked, no camera movement.
[Bright/Warm] Pacific Northwest [living room/bedroom] interior, natural light streaming through large windows.
MOTION: Sheer white curtains breathe gently at [left/right] window edge [subtle, barely perceptible].
[Optional: Steam rises softly from coffee mug on side table, slow vertical drift only.]
All furniture, walls, floors, ceiling completely rigid and static.
No zoom. No tilt. No pan. No texture movement on wood or upholstery.
Cinematic quality, photorealistic architectural photography aesthetic.
```

### Kitchen

```
Static locked camera, no movement.
Bright modern kitchen, warm daylight from window above sink.
MOTION: Single thin steam ribbon rising from kettle on stove [slow, soft, vertical only].
Window light shaft shifts 2-3 degrees over duration.
Countertops, cabinetry, appliances, tile backsplash: fully rigid, zero texture movement.
No camera drift. No floor movement. No furniture animation.
Photorealistic, architectural photography.
```

### Fireplace

```
Static tripod shot, completely locked camera.
Cozy [living room/den] with stone fireplace as focal point.
MOTION: Fire burning naturally in fireplace [gentle flicker, warm light dancing on nearby surfaces].
All stone, mantle, furniture, walls, floor: completely rigid and static.
No camera movement. No texture swimming. No morphing.
Photorealistic interior photography, warm tones.
```

### Bathroom

```
Static locked camera, no movement.
Luxurious bathroom, natural daylight through frosted window.
MOTION: Gentle steam wisping from [soaking tub/shower area], slowly rising and dissipating.
[Optional: Light shaft through window shifting subtly.]
All tile, fixtures, counters, mirrors: completely rigid, zero texture movement.
Photorealistic architectural interior.
```

## Negative Prompt (Always Include)

```
morphing, swimming textures, distortion, camera drift, furniture movement, wall deformation, warping tile, morphing cabinets, zoom, pan, tilt, floor movement, texture swimming, wood grain flowing, marble drifting, grout lines moving, perspective creep, edge softening, corner drift, CGI, cartoon, illustration, 3D render, jello effect, rolling shutter
```

---

## Common Failure Modes & Fixes

| Failure | Cause | Fix |
|---------|-------|-----|
| Swimming textures (wood, tile, marble) | Complex patterns at mid-res | Upscale source to 4K before generation; use Quality mode not Turbo |
| Morphing walls / furniture distortion | Too much motion amplitude | Reduce to ONE element only; add "completely rigid" for every surface |
| Perspective creep (slow zoom/tilt) | Model reinterprets perspective | Explicit "no zoom, no tilt, static frame" in both prompt and negative |
| Texture swimming on countertops | Marble/hardwood grain becomes fluid | Include "sharp architectural surfaces, rigid materials" in prompt |
| Over-animation (everything wiggles) | No motion constraint | Name every element that must NOT move explicitly |
| Corner softening | Multi-element motion | Single-element-only rule; regenerate |

---

## Quality Gate (Interior-Specific)

Before any interior animation is approved for brand use:

1. **Frame match:** Pause at frame 1 and frame last — do wall corners match exactly?
2. **Surface scan at 0.25x:** Does any non-designated surface move?
3. **Texture check:** Scrub slowly — any countertop, floor, or fabric texture drift?
4. **Perspective check:** Did the frame zoom, tilt, or drift when it shouldn't have?
5. **Single-element rule:** Is exactly ONE element animating (not multiple)?

**Pass all 5 = cleared for brand use.**
**Fail any 1 = discard and regenerate.**

---

## Key Differences from Landscape Rules

| | Landscape | Interior |
|-|-----------|----------|
| Acceptable motion sources | Clouds, water, trees, wind, light | Curtains, fire, steam, light shifts only |
| Number of moving elements | 2-3 OK (clouds + water + trees) | **ONE element only** (stricter) |
| Texture tolerance | High (nature is organic) | **Zero** (architecture must be rigid) |
| Duration | 5s standard | **4s preferred** (less time = less drift) |
| Regeneration rate | ~20% discarded | **~40-50% discarded** (interiors are harder) |

---

*Skill authored 2026-04-18. Sources: Segmind Wan I2V guide, fal.ai Kling 3.0 guide, Cliprise architecture animation review, Scenario troubleshooting guide, Wan 2.7 prompt guide.*
