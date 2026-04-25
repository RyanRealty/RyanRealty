# Viral Video Constraints — Mandatory for All Ryan Realty Videos

**Status: HARD CONSTRAINTS. Every video composition in this repo must conform.**
**Last updated: 2026-04-25 (locked after Schoolhouse v5 series review).**

These rules supersede any per-skill spec. If a skill's spec conflicts with this
file, this file wins. The cinematic-short-film register Matt explored in
Schoolhouse v5.0–v5.7 (110-130s) is **archived for reference only** and does
not ship to social channels.

---

## 1. Length

| Platform | Target | Hard cap |
|---|---|---|
| Instagram Reels | **30-60s, sweet spot 45s** | 60s |
| TikTok | **21-34s optimal** | 60s |
| YouTube Shorts | **30-58s** | 60s |
| **Default for any new build** | **45s** | **60s** |

A video over 60s ships nowhere. Don't render past it.

## 2. Hook — first 2 seconds

- **Must stop the scroll in under 2 seconds.**
- **Frame 1 = the most visually striking shot** in the deliverable. NOT a title card, NOT a slow boundary draw, NOT a logo bumper, NOT a black-then-fade-in. The strongest image is on screen at frame 0.
- **Text hook on screen by 0.5s.** White text with shadow OR dark pill background. Comprehensive, not shorthand.
- For real estate: open with **hero exterior** or the most dramatic interior. Address text overlay on the opening frame.
- VO begins within first 2 seconds. First spoken word is content (no greetings, no "today I'm going to...").

## 3. Scene pacing

- **Standard cuts: every 2-3 seconds.**
- Luxury real estate drone / cinematic: **3-4 seconds per scene max.**
- **Never hold a single scene longer than 4 seconds.**
- **Minimum 12-15 scenes in a 45-second video.**
- Pattern interrupt at the **25% mark** (different content register or visual shock).
- Pattern interrupt at the **50% mark**.
- Payoff / reveal in the **final 15%** of runtime.

## 4. Text overlays

- **Safe zone**: 900×1400 px centered inside 1080×1920 (90px margin on every edge — accounts for IG/TikTok UI chrome).
- **Display time**: minimum 2 seconds per text block.
- **Font size**: minimum 48px body, **headline 64-80px**.
- **Contrast**: white text with shadow, or dark pill/scrim under the text. Never white text on a white wall.
- **Word count**: max 5-7 words per text block.
- Numbers always carry units or framing ("$3,025,000", not "3,025,000"; "4 bedrooms", not "4 BR").

## 5. Audio

- **Music starts frame 1.** No silence at the open.
- **VO starts within first 2 seconds.**
- Background music **-18 dB** under VO during VO.
- **Music swell at the reveal / ending.**
- VO synthed with `previous_text` chaining when multi-line, so prosody is continuous.

## 6. Retention beats

- **Re-hook at 25%** of runtime — new visual surprise or text hook.
- **Re-hook at 50%** — pattern interrupt anchored to a content beat (not a gimmick).
- **Payoff in final 15%** — kinetic stat moment, satisfying resolution, or rhetorical close.
- **Target: 70% average view duration** (TikTok algorithmic minimum for distribution).

## 7. Branding rule

**Zero branding inside the video frame.** Per `feedback_no_branding_in_viral_video.md`:

- No logo
- No "Ryan Realty" text
- No phone number
- No website URL
- No agent name
- No "REPRESENTED BY" line on the reveal

Brokerage attribution lives in the **post caption + the IG handle**, not the video.

The reveal/end card is one of:
- Silent hold on the final visual
- Kinetic stat moment (price, address, status)
- Question / provocation

## 8. Frame composition

- **Resolution**: 1080×1920 portrait, 30fps.
- **Zero black bars / charcoal flashes anywhere.** Every frame is content.
  - When a photo doesn't fill 9:16, render a **blurred copy of the same photo as backdrop** filling the dead space (vignetteLetterbox mode in PhotoBeat).
  - Beat-to-beat transitions overlap by 0.5s (next beat's fade-in covers previous beat at full opacity, never AbsoluteFill exposed).
  - Verified via `ffmpeg blackdetect` at strict pix_th=0.05 — zero true-black sequences.

## 9. Movement rules (carries forward from listing video spec)

- **Three movement types per video minimum** — variety beats AutoReel-tier zoom-only.
- AI photo-to-video is **OFF**. Remotion + ffmpeg deterministic motion only.
- Per-photo motion is judgment work — picks differ by content (push_in, push_counter, slow_pan_lr/rl, gimbal_walk, multi_point_pan, cinemagraph mask overlay).
- Cinemagraph masks animate ONE organic element (water, sky, flame) at sub-pixel amplitudes. Never AI i2v.

## 10. CTA / payoff

- Reveal text appears in **final 5-8 seconds** of runtime.
- Stage smoothly: PENDING → price → address (no "REPRESENTED BY").
- Music swells under the reveal then ducks to zero.
- Caption delivers the social CTA ("DM me 'BEND' to talk" or platform-appropriate prompt).

---

## Pre-render compliance checklist

Before any video composition is rendered:

```
[ ] Total runtime ≤ 60s (target 45s)
[ ] Frame 0 is the strongest visual (no title card / boundary draw open)
[ ] Text hook on screen by frame 15 (0.5s)
[ ] First VO word is content by frame 60 (2s)
[ ] At least 12 photo beats in the body
[ ] No single beat > 4s
[ ] Pattern interrupt at 25% mark
[ ] Pattern interrupt at 50% mark
[ ] Reveal in final 15%
[ ] Zero brand elements in frame (logo, name, phone, "REPRESENTED BY")
[ ] Three movement types minimum
[ ] Music plays from frame 1
[ ] ffmpeg blackdetect strict (pix_th=0.05) returns zero black sequences
```

If any item is unchecked, the video is not ready to ship.

---

## Schoolhouse v5 specific notes

- **Open frame**: address text "56111 SCHOOLHOUSE ROAD / VANDEVERT RANCH" over hero exterior #2, vignetteLetterbox mode (blurred photo backdrop fills dead space).
- **History block**: pattern interrupt at 25% mark (~11s into a 45s cut). Sepia historic photos cutting in sharply against luxury color photos.
- **Reveal**: PENDING / $3,025,000 / address. No "REPRESENTED BY RYAN REALTY".

---

How to apply: every Listing.tsx, every video composition, every video skill in
this repo opens this file before scaffolding. Validate against the checklist
before render. Don't wait for review.
