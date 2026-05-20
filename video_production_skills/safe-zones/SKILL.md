---
name: safe-zones
description: Use this skill whenever a Ryan Realty video composition places text or critical visual content on the frame. Defines the platform-aware safe zones for portrait 1080×1920 (IG Reels / TikTok / FB Reels / YT Shorts), landscape 1920×1080 (YouTube long-form), and square 1080×1080 (IG feed). Exports a canonical constants module that every Remotion comp imports, plus an optional `<SafeZone>` dev-mode wrapper for visualizing the zone during render.
---

# Safe Zones Skill — Platform-Aware Text + Content Placement (locked 2026-05-20)

## Canonical references

Every video composition that places text or critical content loads this skill plus:

1. [`CLAUDE.md`](../../CLAUDE.md) §0.5 (Captions — HARD RULES)
2. [`video_production_skills/captions/SKILL.md`](../captions/SKILL.md)
3. [`social_media_skills/platform-best-practices/SKILL.md`](../../social_media_skills/platform-best-practices/SKILL.md) — the platform UI overlay reference layer

---

## The rule

**No text, no critical content, no logo, no broker headshot, no end-card element — nothing the viewer is meant to read or recognize — sits inside the platform UI overlay regions.** Captions, headlines, stat panels, end cards, and primary content anchor inside the working safe zone defined per aspect ratio below.

This rule is enforced at the composition level by importing the canonical constants from `video_production_skills/safe-zones/canonical/safe-zones.ts`. Never hardcode coordinates per Remotion comp.

---

## Portrait 1080×1920 (IG Reels / TikTok / FB Reels / YT Shorts)

This is the highest-stakes format — the platform UI bites into the top AND the bottom AND the right edge of the frame. The safe zone is asymmetric.

| Region | Pixel range | Use |
|---|---|---|
| **Top platform UI** | y 0–280 | profile pill (IG/TikTok), follow button, account name overlay |
| **Right platform UI** | x 960–1080 | like / comment / share / save action column (IG / TikTok) |
| **Bottom platform UI** | y 1480–1920 | caption box (IG), description (TikTok), engagement chrome, music attribution |
| **Working safe zone** | x 90–990, y 280–1480 | **all text, captions, headlines, stats, end-card content lives HERE** |

**Working safe zone dims:** 900 px wide × 1200 px tall, anchored top-left at (90, 280).

**Caption band inside the working zone:** y 1280–1460 (bottom of the working zone). Center y = 1370. Caption text never crosses y 1480.

---

## Landscape 1920×1080 (YouTube long-form, YT player embed)

YouTube's player chrome auto-hides during playback but reappears on hover / pause. The control bar takes the bottom ~80 px when visible. Title overlay shows top-left on initial load.

| Region | Pixel range | Use |
|---|---|---|
| **Top platform UI** | y 0–80 | YT title overlay (initial load + hover) |
| **Bottom player chrome** | y 1000–1080 | YT control bar (auto-hides; assume visible) |
| **Working safe zone** | x 90–1830, y 80–1000 | text + content anchor zone |

**Working safe zone dims:** 1740 px wide × 920 px tall.

**Caption band inside the working zone:** y 880–1000 (bottom of the working zone). Center y = 940.

---

## Square 1080×1080 (IG feed post, FB feed, LinkedIn carousel slide)

IG square feed posts do NOT have full-bleed action overlay — the action UI lives in the post chrome below the image. Safe-zone constraints are looser.

| Region | Pixel range | Use |
|---|---|---|
| **Working safe zone** | x 90–990, y 90–1010 | text + content anchor zone |

**Working safe zone dims:** 900 px wide × 920 px tall.

**Caption band inside the working zone:** y 850–1010 (bottom of the working zone). Center y = 930. (Used by single-word captions if a square-format video ships with captions, e.g. an IG carousel slide that animates.)

---

## Vertical 4:5 / 1080×1350 (IG feed crop)

IG sometimes auto-crops portrait posts to 4:5 in the feed. Build to 1080×1350 OR build 1080×1920 with critical content inside the 4:5-safe crop area (top y 90 + 1350 = y 1440 max, but center the content within y 285–1635 of the 1080×1920 frame so a 4:5 crop centered on the frame catches it).

| Region | Pixel range | Use |
|---|---|---|
| **Working safe zone** | x 90–990, y 285–1635 (inside the 4:5 crop) | text + content anchor zone for IG-feed-crop-safe builds |

---

## The canonical constants module

Every Remotion comp imports from `video_production_skills/safe-zones/canonical/safe-zones.ts`. Example:

```tsx
import {
  PORTRAIT_SAFE,
  LANDSCAPE_SAFE,
  SQUARE_SAFE,
  CAPTION_PORTRAIT,
  CAPTION_LANDSCAPE,
  CAPTION_SQUARE,
} from '../../../video_production_skills/safe-zones/canonical/safe-zones'

// In a portrait comp:
<div style={{
  position: 'absolute',
  left: PORTRAIT_SAFE.x,
  top: PORTRAIT_SAFE.y,
  width: PORTRAIT_SAFE.width,
  height: PORTRAIT_SAFE.height,
}}>
  {/* All text + critical content lives inside here */}
</div>
```

Constants exported (full list in the .ts file):

| Constant | Value | Notes |
|---|---|---|
| `PORTRAIT_SAFE` | `{ x: 90, y: 280, width: 900, height: 1200 }` | The working zone for 1080×1920 |
| `LANDSCAPE_SAFE` | `{ x: 90, y: 80, width: 1740, height: 920 }` | The working zone for 1920×1080 |
| `SQUARE_SAFE` | `{ x: 90, y: 90, width: 900, height: 920 }` | The working zone for 1080×1080 |
| `CAPTION_PORTRAIT` | `{ centerY: 1370, top: 1280, bottom: 1460 }` | Single-word caption band, portrait |
| `CAPTION_LANDSCAPE` | `{ centerY: 940, top: 880, bottom: 1000 }` | Single-word caption band, landscape |
| `CAPTION_SQUARE` | `{ centerY: 930, top: 850, bottom: 1010 }` | Single-word caption band, square |
| `PORTRAIT_AVOID_TOP` | `{ x: 0, y: 0, width: 1080, height: 280 }` | IG / TikTok profile pill |
| `PORTRAIT_AVOID_BOTTOM` | `{ x: 0, y: 1480, width: 1080, height: 440 }` | Platform action UI |
| `PORTRAIT_AVOID_RIGHT` | `{ x: 960, y: 280, width: 120, height: 1200 }` | IG / TikTok action column |

---

## The `<SafeZone>` dev component (optional)

A Remotion wrapper that visualizes the safe zone during local preview, then becomes a no-op in production renders. Useful during composition development.

```tsx
import { SafeZone } from '../../../video_production_skills/safe-zones/canonical/SafeZone'

<AbsoluteFill>
  {/* ... your scene content ... */}
  <SafeZone format="portrait" visible={process.env.NODE_ENV !== 'production'} />
</AbsoluteFill>
```

The component draws cross-hatched red overlays in the AVOID regions when `visible={true}`. Default `visible={false}` — production renders never see it.

---

## Anti-patterns (ship-blocker)

| Anti-pattern | Fix |
|---|---|
| Hardcoded `top: 1500`, `bottom: 1700` in a portrait comp | Replace with `top: CAPTION_PORTRAIT.top`, etc. |
| Headline at `y: 100` in a portrait comp | y < 280 = inside the platform UI overlay. Move to y ≥ 280. |
| Logo at `x: 980` in a portrait comp | x ≥ 960 = inside the action column. Move logo left or to an end card. |
| Footer text at `y: 1820` in a portrait comp | y ≥ 1480 = inside the platform action UI. Move into the working zone OR to an end card frame. |
| Per-comp custom safe-zone constants | Always import from the canonical module. Never re-derive. |
| Square comp using portrait safe-zone | Match the constant to the aspect ratio. Square is wider in usable area. |

---

## Pre-render checklist

```
[ ] All text overlays inside the working safe zone for the target aspect ratio
[ ] No content in the platform UI overlay regions (top 280px, bottom 440px, right 120px for portrait)
[ ] Caption band inside the working zone (y 1280-1460 for portrait single-word captions)
[ ] Logo / brand attribution either inside the safe zone OR on the end card (NOT in platform UI regions)
[ ] Canonical constants imported from video_production_skills/safe-zones/canonical/safe-zones.ts (no hardcoded coords)
[ ] First-frame extraction at t=0 confirms no critical content in unsafe regions
[ ] Final-frame extraction confirms end-card content is inside the safe zone
```

---

## Change log

| Date | Change |
|---|---|
| 2026-05-20 | **Locked.** Three-format canonical constants (portrait / landscape / square) + caption band positions. Replaces the inline "Safe zone 900×1400 inside 1080×1920 (90 px margin every edge)" rule from CLAUDE.md (which was symmetric and didn't account for the IG / TikTok bottom action UI). |
