---
name: captions
description: Use this skill whenever a Ryan Realty video needs captions — listing tour, market report, news clip, neighborhood guide, meme, evergreen, anything with VO. Defines the single-word Amboqia caption rule (Matt directive 2026-05-20), the canonical SingleWordCaption Remotion component, the ElevenLabs forced-alignment data format, the safe-zone placement, and the migration path for the six legacy CaptionBand / KineticCaptions / SentenceCaption components.
---

# Captions Skill — Single-Word Amboqia (canonical, locked 2026-05-20)

## Canonical references

This skill loads on top of the brand + platform rule layers. Per CLAUDE.md "Skill self-binding", every video that ships captions loads ALL of:

1. [`CLAUDE.md`](../../CLAUDE.md) §0 (Data Accuracy) — outranks everything else
2. [`CLAUDE.md`](../../CLAUDE.md) §0.5 (Captions — HARD RULES) — single-word Amboqia, the rule this skill enforces
3. [`design_system/ryan-realty/SKILL.md`](../../design_system/ryan-realty/SKILL.md) — brand register, Amboqia Boriango font path
4. [`social_media_skills/platform-best-practices/SKILL.md`](../../social_media_skills/platform-best-practices/SKILL.md) — platform-specific caption notes
5. [`video_production_skills/elevenlabs_voice/SKILL.md`](../elevenlabs_voice/SKILL.md) — forced-alignment data source

---

## The one rule

**Every Ryan Realty vertical social video ships captions in this single, locked treatment:**

> **One word at a time, large, centered in the caption safe zone, in Amboqia Boriango. The word appears at speech start and fades out at speech end, synced to ElevenLabs `/v1/forced-alignment` word timestamps. Crossfade ≤ 100 ms between adjacent words. Same look across every video the brand ships.**

No phrase windows. No 3-word chunks. No full sentences staying on screen. No karaoke-style highlight inside a sentence. No colored pill background. No gold accent (gold is retired per Design System v2). No AzoSans, no Geist, no Anton — Amboqia Boriango only.

This rule supersedes the 2026-05-07 "full sentence stays on screen with active-word highlight" directive that lived in CLAUDE.md §0.5. The older rule produced legible-but-busy captions that competed with the photo / video content for attention. The single-word rule mirrors what's working on TikTok / Reels / Shorts in 2026: the eye locks onto a single beat per spoken word, the word stamps the moment, and the visual treatment becomes a content layer instead of a UI layer.

---

## Visual spec

| Property | Value | Notes |
|---|---|---|
| **Font family** | `"Amboqia Boriango", Amboqia, serif` | The brand display font. NEVER substitute AzoSans / Geist / Anton / Inter / system fallback. |
| **Font weight** | 400 (regular) | Amboqia is already a display face — extra weight reads as too heavy. |
| **Font size** | 120 px (portrait 1080×1920) / 96 px (landscape 1920×1080) | Sized for full safe-zone width on most single words. |
| **Letter spacing** | 0.5 px | Default Amboqia tracking. |
| **Case** | As-typed | Do NOT force uppercase. Amboqia is designed to read in mixed case. |
| **Color** | `#FFFFFF` (white) | NEVER gold, NEVER navy, NEVER cream. White only. |
| **Background** | None — no pill, no scrim, no border | The word stamps directly onto the photo / video underneath. |
| **Drop shadow** | Layered, soft + hard | `0 0 24px rgba(0,0,0,0.75), 0 4px 12px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.95)` |
| **Line height** | 1.0 | Single-word means no real line height, but set explicitly. |
| **Max width** | 900 px (portrait) / 1600 px (landscape) | Allows long words like "approximately" to fit on one line. |
| **Trailing punctuation** | Stripped for display | `,` `.` `;` `:` `!` `?` `'` `"` removed from rendered word. The pause is in the timing, not the glyph. |

## Safe zone (placement)

Single-word captions live in the caption band defined by [`video_production_skills/safe-zones/SKILL.md`](../safe-zones/SKILL.md) (canonical source). The canonical component imports `CAPTION_PORTRAIT` / `CAPTION_LANDSCAPE` / `CAPTION_SQUARE` from `safe-zones/canonical/safe-zones.ts` — never hardcoded. Nothing else may render inside the caption band.

| Format | Caption band | `centerY` default |
|---|---|---|
| Portrait 1080×1920 | `y: 1280–1460`, centered horizontally (`x: 90–990`) | `1370` |
| Landscape 1920×1080 | `y: 880–1000`, centered horizontally (`x: 90–1830`) | `940` |
| Square 1080×1080 | `y: 850–1010`, centered horizontally (`x: 90–990`) | `930` |

These positions sit INSIDE the working safe zone for each format — captions never cross into the platform UI overlay regions (IG / TikTok / FB profile pill at top, action column at right, caption box at bottom). Override per-comp via the `centerY` prop, but anchor to the canonical constants whenever possible.

**Important change from prior CLAUDE.md spec:** the old caption zone (y 1480–1720 portrait) sat INSIDE the platform's bottom action UI region and is replaced. The 6 legacy components used the old coords and will be migrated as part of per-producer rebuild.

---

## Timing rules

1. **Synced to ElevenLabs forced-alignment word timestamps.** NEVER to clock-time slots. NEVER to `<Sequence>` boundaries. The component reads `{ text, startSec, endSec }` per word.
2. **Crossfade ≤ 100 ms between adjacent words.** Hard cuts produce flicker. The canonical component uses `CROSSFADE_SEC = 0.08`.
3. **Word appears at `startSec`, disappears at `endSec`.** A word with `endSec - startSec < 0.20s` (a clipped function word like "the" or "a") still renders, but the crossfade window shrinks to half its normal width to avoid the word never fully fading in before fading out.
4. **Inter-word gaps:**
   - Gap `< CROSSFADE_SEC` → crossfade the outgoing word into the incoming word.
   - Gap ≥ `CROSSFADE_SEC` and < 0.5s → outgoing word fades out, brief blank, incoming word fades in.
   - Gap ≥ 0.5s (a real breath / pause) → no caption renders during the gap. The pause is visible.
5. **First spoken word renders from `startSec`.** Skip captions for any opening title card via `suppressBeforeSec`.

---

## ElevenLabs forced-alignment — required data

Captions cannot render correctly without word-level timestamps. Every VO MP3 must have a sibling `.words.json` produced by `https://api.elevenlabs.io/v1/forced-alignment` (called immediately after every VO synth — see [`elevenlabs_voice/SKILL.md`](../elevenlabs_voice/SKILL.md) §"Forced-alignment").

Shape:

```json
{
  "words": [
    { "text": "Bend", "start": 0.42, "end": 0.78 },
    { "text": "home", "start": 0.84, "end": 1.12 },
    { "text": "prices", "start": 1.18, "end": 1.62 },
    ...
  ]
}
```

Map `start` → `startSec`, `end` → `endSec`. Strip empty / whitespace-only tokens before passing to the component (forced-alignment occasionally pads spaces as empty entries).

---

## Canonical component — how to use it

The shared canonical implementation lives at:

```
video_production_skills/captions/canonical/SingleWordCaption.tsx
```

Every Remotion composition imports it via relative path. Example from `video/market-report/src/MarketReportComp.tsx`:

```tsx
import { SingleWordCaption } from '../../../video_production_skills/captions/canonical/SingleWordCaption'

// ...

<SingleWordCaption
  words={captionWords}         // Array<{ text, startSec, endSec }>
  suppressBeforeSec={4.0}      // skip caption during opening title card
  centerY={1600}                // portrait safe-zone center
  fontSizePx={120}
  maxWidthPx={900}
/>
```

Props summary (full TSDoc on the file):

| Prop | Type | Default | Notes |
|---|---|---|---|
| `words` | `Array<{ text, startSec, endSec }>` | required | Forced-alignment output |
| `suppressBeforeSec` | `number` | `0` | Hide captions before this t (intro card) |
| `suppressFrames` | `Array<[start, end]>` | `[]` | Frame ranges to skip (chapter transitions, outros) |
| `centerY` | `number` | `CAPTION_PORTRAIT.centerY` = `1370` | Portrait default. For landscape pass `CAPTION_LANDSCAPE.centerY` (`940`). For square pass `CAPTION_SQUARE.centerY` (`930`). |
| `fontSizePx` | `number` | `CAPTION_PORTRAIT.fontSizePx` = `120` | Portrait default. Landscape: `96`. |
| `maxWidthPx` | `number` | `CAPTION_PORTRAIT.maxWidthPx` = `900` | Portrait default. Landscape: `1600`. |

---

## Font loading in Remotion

Amboqia Boriango must be loaded as a custom font in every Remotion project that renders captions. Two-step pattern:

**1. Copy the font into the project's `public/fonts/` directory** (Remotion serves files from `public/` to the headless browser):

```bash
cp design_system/ryan-realty/fonts/Amboqia_Boriango.otf \
   video/<project>/public/fonts/Amboqia_Boriango.otf
```

**2. Declare it via `@font-face` in the Remotion comp's CSS or via Remotion's `loadFont()` helper:**

```tsx
// video/<project>/src/load-fonts.ts
import { staticFile, continueRender, delayRender } from 'remotion'

const handle = delayRender('Loading Amboqia Boriango')
const font = new FontFace(
  'Amboqia Boriango',
  `url(${staticFile('fonts/Amboqia_Boriango.otf')}) format('opentype')`,
  { weight: '400', style: 'normal' }
)
font.load().then(() => {
  document.fonts.add(font)
  continueRender(handle)
})
```

Import `load-fonts.ts` at the top of the comp's entry file (`src/index.ts` or `src/Root.tsx`). Without this step the component renders with the browser's default serif fallback and captions look wrong.

A canonical `loadAmboqia()` helper that does this work lives at `video_production_skills/captions/canonical/load-amboqia.ts` — import that instead of writing it per-project.

---

## Migration — what each existing component becomes

The repository has six legacy caption components, all built on the now-superseded sentence-with-active-word-highlight paradigm. Each is rewired to render via the canonical `SingleWordCaption` as part of per-producer migration.

| Legacy file | Status | Migration |
|---|---|---|
| `video/market-report/src/CaptionBand.tsx` | LEGACY | Replace body with `export { SingleWordCaption as CaptionBand } from '../../../video_production_skills/captions/canonical/SingleWordCaption'`. Bump `centerY` to `1600` if needed; the old `CAPTION_Y_TOP/BOTTOM` are deprecated. |
| `video/market-report/src/KineticCaptions.tsx` | LEGACY | Same — re-export `SingleWordCaption as KineticCaptions`. The `suppressFrames` prop survives. |
| `video/market-report-yt-long/src/KineticCaptions.tsx` | LEGACY | Re-export with landscape defaults: `centerY={980}`, `fontSizePx={96}`, `maxWidthPx={1600}`. |
| `video/earnest/src/brand/CaptionBand.tsx` | LEGACY | Earnest. uses a custom color palette (Ember instead of gold). Single-word rule still applies; the canonical component renders white-on-photo per Earnest brand spec. Re-export. |
| `video/evergreen-education/src/components/CaptionBand.tsx` | LEGACY | Re-export. Drop the `sentences` prop and the legacy sliding-window fallback path — both are superseded. |
| `listing_video_v4/src/news/SentenceCaption.tsx` | LEGACY | Re-export with portrait defaults. The auto-shrink-for-long-sentences logic is unnecessary in single-word mode (each word has the full safe-zone width). |

Per-producer migration is downstream work — see the producer rebuild handoff (`docs/HANDOFF_PRODUCER_REBUILD_2026-05-19.md`). The canonical component + this SKILL.md establish the source of truth NOW; producers swap over as they're rebuilt.

---

## Anti-patterns (instant ship-blocker)

| Anti-pattern | Why it fails |
|---|---|
| Phrase windows (e.g. 3-word sliding chunks) | Eye scans, doesn't lock — competes with photo content |
| Full sentence stays on screen | Old rule, superseded — busy, UI-feeling, hides the photo |
| Karaoke active-word highlight inside a sentence | Same problem as full sentence |
| Word-by-word reveal that keeps prior words visible | Builds a sentence over time — UI-feeling, low-content |
| AzoSans or Geist or Anton or Inter for caption text | Wrong font — not Amboqia |
| Gold color (#D4AF37 / #C8A864 / #F2C44A) for active word | Gold is retired per Design System v2 |
| Colored pill background behind the caption | Single-word rule renders direct-on-photo with drop shadow only |
| Hard cut between words (zero crossfade) | Flicker, jitter — fails the smooth-transition rule |
| Caption timing slotted to `<Sequence>` boundaries | Loses speech sync — must use forced-alignment word timestamps |
| Caption rendering during opening title card | Use `suppressBeforeSec` — clean preview thumbnail required |

---

## Pre-render checklist

```
[ ] .words.json file present alongside every VO .mp3
[ ] All words have { text, startSec, endSec } populated
[ ] Empty-text tokens filtered out
[ ] Amboqia Boriango loaded via @font-face or Remotion loadFont() in the comp
[ ] <SingleWordCaption> imported from the canonical path (not a local copy)
[ ] suppressBeforeSec set if the comp has an opening title card
[ ] centerY / fontSizePx / maxWidthPx match the aspect ratio (portrait / landscape / square)
[ ] First frame extraction confirms NO caption visible at t=0 (clean thumbnail)
[ ] Mid-render frame extraction at t = mid-VO confirms caption renders in Amboqia, white, no pill
[ ] Caption never overlaps stat panels, charts, end-card content (zone reservation works)
```

---

## Change log

| Date | Change |
|---|---|
| 2026-05-20 | **Locked.** Single-word Amboqia rule replaces 2026-05-07 sentence-with-highlight rule. Canonical component at `canonical/SingleWordCaption.tsx`. |
| 2026-05-07 | Prior rule: full sentence on screen with active-word highlight in gold + scale 1.0→1.08 spring. Superseded. |
