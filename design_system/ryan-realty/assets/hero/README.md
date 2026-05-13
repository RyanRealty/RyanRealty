# Ryan Realty — canonical brand hero

**The hero image for every Ryan Realty design surface that needs a banner / cover photo / header / hero / cinematic anchor.**

Locked 2026-05-13 by Matt. F1 frame extracted at 3.61s from `iStock-1330945786` — Old Mill District drone shot. Three smokestacks, American flag flying, Deschutes River with floaters + kayakers, theater stage, Old Mill shops, Cascade mountain horizon. Stock subscription license — active sub required for use.

## When to use this image

- **Any social profile banner / cover** (Facebook, YouTube, X, LinkedIn, Pinterest, Threads, etc.).
- **Email headers + signatures** that have a banner slot.
- **Website hero sections** where a "the Bend lifestyle" anchor is needed (Home, About, Bend area pages).
- **Marketing collateral** (flyers, postcards, brochures) that have a hero photo slot in their template.
- **Listing-tour video intros** that use a "your brokerage" stinger or area B-roll.
- **Carousel covers** for IG / TikTok / Pinterest where the first slide is a brand intro.
- **Anywhere a design template references "default brand hero photo."**

Use a per-listing photo when the design is about a specific property. Use F1 when the design is about Ryan Realty as a brand.

## Files

| File | Resolution | Aspect | Use for |
|---|---|---|---|
| `hero-old-mill-master-4k.jpg` | 1920×1080 | 16:9 | **Source of truth.** Extract custom crops from here. |
| `hero-old-mill-banner-2048x1152.jpg` | 2048×1152 | 16:9 | YouTube channel art, generic 16:9 hero |
| `banner-2048x1152-youtube.jpg` | 2048×1152 | 16:9 | YouTube channel art |
| `banner-1500x500-x.jpg` | 1500×500 | 3:1 | X / Twitter header |
| `banner-820x312-facebook.jpg` | 820×312 | 2.63:1 | Facebook Page cover |
| `banner-1024x576-gbp.jpg` | 1024×576 | 16:9 | Google Business Profile cover |
| `banner-800x450-pinterest.jpg` | 800×450 | 16:9 | Pinterest cover |
| `banner-1128x191-linkedin.jpg` | 1128×191 | 5.9:1 | LinkedIn Company cover |
| `hero-old-mill-source-1280x720.jpg` | 1280×720 | 16:9 | Legacy 720p web copy. Kept for reference. |

## Crop discipline (MANDATORY when generating new crops)

- **American flag must be visible.** Top-anchor every crop so the flag at ~11% from top of source survives.
- **Smokestacks centered horizontally** for square or near-square aspects.
- **Floaters / kayakers on river** visible whenever the aspect allows (preserves the "Bend lifestyle" read).
- **No banner-level text overlay** if the platform shows the avatar over the cover (Facebook, LinkedIn) — avatars will collide.

## Asset library registration

Both the photo and the source video are registered in `data/asset-library/manifest.json`:

- **Photo (F1 frame):** asset id `113232e1-1bd0-499e-8247-4c85c2386878` at `public/asset-library/photos/stock/`
- **Video (iStock-1330945786):** registered with 5 Drive copies linked (4K master 4.3GB, 244MB compressed, 21MB web copies, 7.3MB preview)

Geo tags: `bend · old-mill-district · central-oregon · deschutes-county · deschutes-river`
Subject tags: `old-mill-district · smokestack · three-smokestacks · american-flag · deschutes-river · river · floaters · kayakers · paddleboard · aerial · drone · summer · lifestyle · theater-stage · amphitheater · cascade-mountains · mountain-horizon · landmark · iconic · hero-content`

## Regenerating crops

```bash
node scripts/composite-f1-banners.mjs
```

Source defaults to `hero-old-mill-master-4k.jpg` (1920×1080). If you need a true-4K re-extract, run:

```bash
ffmpeg -y -ss 3.61 -i ~/Downloads/iStock-1330945786.mov \
  -frames:v 1 -q:v 1 \
  design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg
```

(The 4.3GB MOV master is in Drive at file id `1T3juCcPSF0Qw-YA-xAnMetHbYJcltcsz`.)
