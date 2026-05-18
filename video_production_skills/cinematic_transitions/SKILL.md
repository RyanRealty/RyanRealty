---
name: cinematic_transitions
kind: capability
description: >
  Five Remotion transition components (CrossfadeTransition, LightLeakTransition, and
  others) that layer between PhotoBeat sequences using overlapping Sequence pairs.
  Support library for listing_reveal, listing_launch, neighborhood_tour, and other
  format skills. Do NOT invoke as a standalone content-production skill.  no content
  ships from this file alone.
---

# Skill 3.  Cinematic Transitions

Five Remotion transition components that layer between existing PhotoBeat sequences.
Each wraps a single layer (outgoing OR incoming) and is used in overlapping
Sequence pairs so both layers are live simultaneously during the transition window.

---

## CRITICAL: Never paint solid black or charcoal

Per `VIDEO_PRODUCTION_SKILL.md` Section 7 #1.  the existing Sequence overlap
pattern prevents dark flashes at cuts. That pattern relies on every component
having `background: 'transparent'` on its root `<div>`. All five transition
components follow this rule. Do not add a background color to the wrapper div.

The LightLeakTransition overlay uses `mixBlendMode: 'screen'` and a warm
orange radial gradient.  it is luminous/additive, never solid.

---

## Component Reference

### CrossfadeTransition
**File:** `listing_video_v4/src/components/CrossfadeTransition.tsx`
**Default duration:** 0.4s

Smoothest, simplest transition. Ramps `opacity` of the wrapped layer.
- `mode: 'out'`.  wraps outgoing layer, opacity 1 → 0
- `mode: 'in'`.  wraps incoming layer, opacity 0 → 1
- `easing`.  `'linear' | 'easeInOut' | 'easeOutCubic'` (default `easeInOut`)

**When to use:** Everywhere as the default. Soft, luxury, doesn't draw
attention to itself. Best for $1M+ listings where the shot composition is
the star. Also appropriate for any price tier when you have no reason to
use a more expressive transition.

**Avoid:** When the built-in `crossfadeIn`/`crossfadeOut` props on PhotoBeat
already handle the fade.  don't double-fade the same layer.

---

### LightLeakTransition
**File:** `listing_video_v4/src/components/LightLeakTransition.tsx`
**Default duration:** 0.35s

Warm orange/gold bloom that mimics an analog film light leak. The overlay
blooms in over the first 50% of the duration and fades out over the second 50%.
- `intensity`.  `'subtle' | 'medium' | 'strong'` (peak opacity 0.35 / 0.55 / 0.72)
- `position`.  `{ x: string; y: string }` radial gradient hotspot, default `'50% 30%'`

Note: LightLeakTransition is a standalone overlay, not a wrapper. Place it
inside an overlapping Sequence at the transition point.  it does not need
`mode` because it is not wrapping a content layer.

**When to use:** Cinematic warmth at scene-register changes, e.g. interior →
exterior shot at the 50% pattern interrupt. Use sparingly.  once or twice per
video max.

**Avoid at:** $1M+ listings (too "gram-y" for the restrained luxury register).

---

### WhipPanTransition
**File:** `listing_video_v4/src/components/WhipPanTransition.tsx`
**Default duration:** 0.3s

Snap horizontal pan blur. Outgoing translates off-screen with peak motion
blur at midpoint; incoming arrives from opposite side.
- `direction: 'lr'`.  motion is leftward (out exits left, in enters from right)
- `direction: 'rl'`.  motion is rightward
- `mode: 'in' | 'out'`.  wrap the incoming or outgoing layer

**When to use:** High-energy register, viral cut tempo. Best at the 25%
re-hook beat to signal "new chapter" with kinetic motion. Under $500K
listings where an upbeat peppy tone fits.

**Avoid at:** $1M+ listings.  too aggressive for the restrained luxury register.

---

### PushTransition
**File:** `listing_video_v4/src/components/PushTransition.tsx`
**Default duration:** 0.4s

Clean horizontal/vertical carousel push. Outgoing travels fully off-screen
while incoming enters from opposite. No blur.  orderly spatial feel.
- `direction: 'left' | 'right' | 'up' | 'down'`
- `mode: 'in' | 'out'`

**When to use:** Orderly transitions between adjacent rooms, e.g. kitchen →
dining room. Use `direction` to imply spatial flow.  if kitchen is "left of"
dining, push `'left'`.

**Avoid:** For scene-register changes (use CrossfadeTransition or LightLeak
instead). Push is a spatial metaphor.  it implies the viewer is moving
through a physical space.

---

### SlideTransition
**File:** `listing_video_v4/src/components/SlideTransition.tsx`
**Default duration:** 0.5s

Like Push but with a partial overlap window (incoming enters from 30% offset
instead of 100%), giving a "doors opening" feel where both layers are visible
simultaneously for longer. Includes scale pulse: outgoing 1 → 0.96, incoming
1.04 → 1.
- `direction: 'left' | 'right' | 'up' | 'down'`
- `mode: 'in' | 'out'`

**When to use:** Two beats that share the same visual register.  e.g. both
interiors of the same wing. The overlap makes the transition feel like a
reveal rather than a cut.

**Avoid:** When the scenes are visually dissimilar (the overlap makes
mismatched scenes look jarring). Use Push or Crossfade instead.

---

## Usage Pattern

Wrap the outgoing beat AND the incoming beat in overlapping Sequences.
The overlap window is the transition duration:

```tsx
const FPS = 30;
const endOfBeatA = 90; // frame where beat A content ends

// Outgoing layer.  crossfade out over 0.4s starting 9 frames before end
<Sequence from={endOfBeatA - 0.3 * FPS} durationInFrames={Math.ceil(0.4 * FPS)}>
  <CrossfadeTransition durationSec={0.4} mode="out">
    <BeatA />
  </CrossfadeTransition>
</Sequence>

// Incoming layer.  crossfade in over 0.4s starting at same point
<Sequence from={endOfBeatA - 0.3 * FPS} durationInFrames={Math.ceil(0.4 * FPS)}>
  <CrossfadeTransition durationSec={0.4} mode="in">
    <BeatB />
  </CrossfadeTransition>
</Sequence>
```

For LightLeak (standalone overlay, no mode):
```tsx
// Overlay fires during the same overlap window
<Sequence from={endOfBeatA - 0.17 * FPS} durationInFrames={Math.ceil(0.35 * FPS)}>
  <LightLeakTransition durationSec={0.35} intensity="medium" />
</Sequence>
```

The PhotoBeat component already has built-in `crossfadeIn`/`crossfadeOut` props.
Use these transition components for cases where the built-in crossfade is not
enough (light leak, whip pan) or for non-PhotoBeat content (SpecDrop, TitleCard,
etc.).

---

## Import

```tsx
import {
  CrossfadeTransition,
  LightLeakTransition,
  WhipPanTransition,
  PushTransition,
  SlideTransition,
} from './components';
```
