# Pulse Feed Safe Zone — HARD RULE

**Locked 2026-05-20.** Every text overlay, pill, badge, action button,
and data label on a pulse-feed card — or on a 1080×1920 video that
gets repurposed into the feed — must sit inside the safe rectangle
below. Anything outside gets covered by platform chrome the moment the
page is opened from an Instagram, TikTok, YouTube Shorts, or Facebook
in-app browser ad.

## The safe rectangle (canonical values)

On a 1080×1920 source:

```
top safe edge      : 15 %  of height  =  288 px
bottom safe edge   : 14 %  of height  =  269 px
left safe edge     : 5.5 % of width   =   59 px
right safe edge    : 5.5 % of width   =   59 px
right action col   : 72  px width (below the top safe edge)

resulting safe rect:
  x: 59  → 1021    (962 px wide)
  y: 288 → 1651    (1363 px tall)
```

On a smaller card render (e.g. 460×818 in the feed), use the % values
directly — they scale with the card.

## Worst case across all platforms

| platform / surface          | top chrome | bottom chrome | right chrome |
|-----------------------------|------------|---------------|--------------|
| IG in-app browser (iOS)     | 14 %       | 13 %          | 0            |
| TikTok in-app browser       | 15 %       | 6 %           | 0            |
| YouTube in-app browser      | 11 %       | 12 %          | 0            |
| Facebook in-app browser     | 12 %       | 0             | 0            |
| **IG Reels video feed**     | 18 %       | 25 %          | 12 %         |
| **TikTok video feed**       | 12 %       | 26 %          | 14 %         |
| **YouTube Shorts feed**     | 15 %       | 22 %          | 10 %         |

The 15 / 14 / 5.5 % values clear every in-app browser scenario plus a
16-pixel cushion. For repurposing into actual social videos, use the
tighter producer-grade rect (18 / 26 / 14 / 5.5 %).

## CSS variables (drop in)

```css
:root {
  --pulse-safe-top:    15%;
  --pulse-safe-bottom: 14%;
  --pulse-safe-side:   5.5%;
  --pulse-actions-w:   72px;
}

.card .top {
  position: absolute;
  top:   var(--pulse-safe-top);
  left:  var(--pulse-safe-side);
  right: var(--pulse-safe-side);
}
.card .actions {
  position: absolute;
  right: var(--pulse-safe-side);
  top: 50%; transform: translateY(-50%);
}
.card .bottom {
  position: absolute;
  left:   var(--pulse-safe-side);
  right:  calc(var(--pulse-safe-side) + var(--pulse-actions-w));
  bottom: var(--pulse-safe-bottom);
}
```

## Producer-grade rect (repurposing card frames as social videos)

```
IG Reels:    top 18 %, bottom 25 %, right 12 %
TikTok:      top 12 %, bottom 26 %, right 14 %  (worst right column)
YT Shorts:   top 15 %, bottom 22 %, right 10 %

Producer-grade rect (clears all three):
  top    : 18 %  (≈346 px on 1920)
  bottom : 26 %  (≈499 px on 1920)
  right  : 14 %  (≈151 px on 1080)
  left   : 5.5 % (≈59 px)
```

Build to the producer-grade rect when in doubt.

## Verification — the four toolbar modes on /pulse-demo.html

1. **Clean** — default appearance.
2. **Show safe zones** — red diagonal hatching marks unsafe strips.
   Every pill, label, price block must sit OUTSIDE the hatching.
3. **IG in-app browser** — overlays the IG webview chrome at top + bottom.
4. **TikTok video feed** — worst case: full TT social UI with top, bottom,
   right action column. If our frame clears THIS, it clears everything.

## Producers bound by this rule

- `video_production_skills/listing-tour-video/SKILL.md`
- `video_production_skills/listing_reveal/SKILL.md`
- `video_production_skills/market-data-video/SKILL.md`
- `video_production_skills/news-video/SKILL.md`
- `video_production_skills/neighborhood-overview/SKILL.md`
- `video_production_skills/neighborhood_tour/SKILL.md`
- `video_production_skills/weekend-events-video/SKILL.md`
- `video_production_skills/avatar_market_update/SKILL.md`
- `video_production_skills/meme_content/SKILL.md`
- `video_production_skills/data_viz_video/SKILL.md`

Each producer SKILL.md must reference this file in its "Required
references" section.

## Inheritance

Layers on top of (not in place of):

- `CLAUDE.md` §0 — Data Accuracy
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`

A frame can be 100/100 on the viral scorecard and still be a
ship-blocker if its text overflows the safe rect.
