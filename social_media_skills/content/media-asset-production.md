---
name: media-asset-production
description: Complete production guide for every Ryan Realty profile-related media asset. Covers avatars, banners, highlight covers, channel art, logo variants, thumbnails, and watermarks across all 14+ platforms. Use when setting up channels, refreshing profiles, or creating brand assets. Includes exact dimensions, color specs, typography, source files, production methods (PIL/ImageMagick/Canva brief), naming conventions, and file destinations. Does NOT cover content assets like post images or reel covers (use cross-platform-repurpose.md for those).
---

# Media Asset Production — Ryan Realty Profile Assets

## Brand Constants (Authoritative)

| Token | Value | Use |
|-------|-------|-----|
| Navy | `#102742` | Primary background, text on white |
| Gold | `#D4AF37` | Accent only — lines, price callouts, icon borders |
| White | `#FFFFFF` | Text on navy, backgrounds |
| Font: Display | Butcher | Headlines, channel names |
| Font: Body | AzoSans | Supporting copy, bios, labels |
| Font: Accent | Amboqia | Single decorative touch per design |
| Phone | 541.213.6706 | Use this exact format everywhere |
| Handle | @ryanrealtybend (IG/TikTok/FB/YT) | Consistent across all channels |

**Design-eye rule:** Light-forward editorial — navy text on white/off-white is primary. Full navy backgrounds reserved for strong branded moments (channel art, highlight covers). Gold is always an accent, never a fill.

---

## Source Assets (Canonical Paths)

| Asset | Path | Dimensions | Notes |
|-------|------|-----------|-------|
| Logo master (dark navy) | `/RyanRealty/public/logo.png` | 1024×671 | Source for all logo derivatives |
| Logo white (header) | `/RyanRealty/public/logo-header-white.png` | 400×80 WebP | Confirmed exists |
| Logo white (alt) | `/BRAND MANAGER/Historical_Oregon_Carousel/bend_unsplash/assets/logo_white.png` | 400×80 PNG | Confirmed exists |
| Headshot (square) | `/RyanRealty/public/images/brokers/ryan-matt.jpg` | 360×360 | White bg, avatar-ready |
| Headshot (landscape) | `/RyanRealty/public/images/brokers/ryan-matt.jpg` | 1920×1080 | Banner source |
| Headshot (portrait) | `/RyanRealty/public/images/brokers/ryan-matt.png` | 414×600 WebP | Portrait crop |
| Favicon | `/RyanRealty/public/icons/favicon-32x32.png` | 32×32 | — |
| Apple touch icon | `/RyanRealty/public/icons/apple-touch-icon.png` | 180×180 | — |

**Known gaps (must produce before full channel setup):**
- White logo at 2048, 1024, 512, 256px — needed for all banner overlays
- 1920×1080 wide-format lifestyle banner photo (Bend landscape preferred)
- Circular badge logo (logo inside navy circle, for platforms with heavy circle-crop)

---

## Master Asset List

### Instagram

| Asset | Upload Size | Display | Status | Method |
|-------|------------|---------|--------|--------|
| Profile avatar | 1080×1080 | 110px (mobile) / 180px (desktop), circle | EXISTS — use `ryan-matt.jpg` scaled up | ImageMagick |
| Highlight covers (set of 8) | 1080×1920 | ~420px circle crop at center | TO CREATE | PIL batch script |

**Avatar notes:** Instagram crops to circle. Keep subject centered with 120px+ clearance from all edges. The 360×360 headshot should be scaled to 1080×1080 with white background fill.

**Highlight covers needed:**
1. Listings
2. Market Updates
3. Bend Life
4. Buying
5. Selling
6. About Matt
7. Testimonials
8. FAQ

Each: navy background, gold icon or Butcher label at center, minimal — fits in a 420px circle.

---

### Facebook

| Asset | Upload Size | Display | Status | Method |
|-------|------------|---------|--------|--------|
| Profile photo | 720×720 | 176×176 desktop, circle | EXISTS — scale `ryan-matt.jpg` | ImageMagick |
| Cover photo | 851×315 | 820×312 desktop; mobile safe zone: center 820×360 of full image | TO CREATE | Canva brief |

**Cover notes:** Place critical content (name, tagline, phone) in center horizontal band — roughly the middle 315px vertically, 820px wide. Left 176px from left edge will be obscured by profile photo on desktop.

---

### YouTube

| Asset | Upload Size | Display | Status | Method |
|-------|------------|---------|--------|--------|
| Profile photo | 800×800 | 98×98, circle | EXISTS — scale `ryan-matt.jpg` | ImageMagick |
| Channel banner | 2560×1440 | Safe zone: 1235×338 centered | TO CREATE | Canva brief |
| Channel watermark | 150×150 PNG transparent | Bottom-right of all videos | TO CREATE | ImageMagick |
| Video thumbnails | 1280×720 | — | Covered in cross-platform-repurpose.md | — |

**Banner safe zone:** 1235×338 centered at (662, 551) in the 2560×1440 canvas. All text and logo must be inside this box. Outside it: decorative/brand color only.

**Watermark:** White logo on transparent background, 150×150. Scale from `logo-header-white.png`.

---

### LinkedIn (Personal — Matt Ryan)

| Asset | Upload Size | Display | Status | Method |
|-------|------------|---------|--------|--------|
| Profile photo | 640×640 | Circle display | EXISTS — scale `ryan-matt.jpg` | ImageMagick |
| Background banner | 1584×396 | Full bleed | TO CREATE | Canva brief |

---

### LinkedIn (Company — Ryan Realty)

| Asset | Upload Size | Display | Status | Method |
|-------|------------|---------|--------|--------|
| Company logo | 400×400 | Square display | EXISTS — scale from `logo.png`, white bg | ImageMagick |
| Company cover photo | 4200×700 | Full bleed | TO CREATE | Canva brief |

---

### TikTok

| Asset | Upload Size | Display | Status | Method |
|-------|------------|---------|--------|--------|
| Profile photo | 720×720 | ~200px, circle | EXISTS — scale `ryan-matt.jpg` | ImageMagick |

**Note:** TikTok also supports 3–6 second profile video as avatar. Static photo is standard; video is optional enhancement.

---

### X / Twitter

| Asset | Upload Size | Display | Status | Method |
|-------|------------|---------|--------|--------|
| Profile photo | 800×800 (400×400 min) | Circle | EXISTS — scale `ryan-matt.jpg` | ImageMagick |
| Header image | 1500×500 | Full bleed; top/bottom ~60px cropped on mobile | TO CREATE | Canva brief |

---

### Pinterest

| Asset | Upload Size | Display | Status | Method |
|-------|------------|---------|--------|--------|
| Profile photo | 600×600 recommended (165×165 min) | Circle | EXISTS — scale `ryan-matt.jpg` | ImageMagick |
| Profile cover | 1600×900 | Full bleed | TO CREATE | Canva brief |

---

### Threads

| Asset | Upload Size | Display | Status | Method |
|-------|------------|---------|--------|--------|
| Profile photo | Synced from Instagram | — | AUTO — set Instagram, Threads follows | — |

No separate upload. Ensure Instagram profile is set correctly.

---

### Nextdoor

| Asset | Upload Size | Display | Status | Method |
|-------|------------|---------|--------|--------|
| Business logo | 500×500 | Square | EXISTS — produce from `logo.png` | ImageMagick |
| Business banner | 1156×650 | Full bleed | TO CREATE | Canva brief |

---

### Google Business Profile

| Asset | Upload Size | Display | Status | Method |
|-------|------------|---------|--------|--------|
| Logo | 1200×1200 recommended (720×720 min) | Square | TO CREATE — scale from `logo.png` | ImageMagick |
| Cover photo | 1024×575 (16:9) | Primary display photo | TO CREATE | Canva brief |
| Additional photos | 1200×900 | Gallery | Listing photos qualify; see `Organic_Growth_Intelligence.md` |

---

### Real Estate Portals

| Platform | Asset | Spec | Status | Method |
|----------|-------|------|--------|--------|
| Zillow | Agent headshot | Min 330×220 JPEG, under 25MB | EXISTS — export `ryan-matt.jpg` as JPEG | ImageMagick |
| Realtor.com | Profile photo | No official spec — 400×400 safe practice | EXISTS — scale `ryan-matt.jpg` | ImageMagick |
| Homes.com | Profile photo | No official spec — 400×400 safe practice | EXISTS — scale `ryan-matt.jpg` | ImageMagick |
| Redfin | Profile photo | Controlled by Redfin — not self-uploaded | N/A | — |

---

## Logo Variants Required

| Variant | Dimensions | Background | Use |
|---------|-----------|-----------|-----|
| Logo — 2048px wide | 2048×(proportional) | Transparent | Banner source file |
| Logo — 1024px wide | 1024×(proportional) | Transparent | General export |
| Logo — 512px wide | 512×(proportional) | Transparent | Social headers |
| Logo — 256px wide | 256×(proportional) | Transparent | Small placements |
| Logo white — 2048px | 2048×(proportional) | Transparent | Dark banner overlays |
| Logo white — 1024px | 1024×(proportional) | Transparent | Channel art |
| Logo white — 512px | 512×(proportional) | Transparent | YouTube watermark source |
| Logo circular badge | 1000×1000 | Navy circle | Platforms with heavy circle crop |
| Logo on white square | 1000×1000 | White | Company LinkedIn, Nextdoor |

Storage: `/BRAND MANAGER/logos/` with subdirs `navy/`, `white/`, `badge/`, `on-white/`

---

## File Naming Convention

```
rr-[platform]-[asset-type]-[variant]-[dimensions].[ext]

Examples:
rr-instagram-avatar-matt-1080x1080.jpg
rr-instagram-highlight-listings-1080x1920.png
rr-youtube-banner-2560x1440.jpg
rr-youtube-watermark-150x150.png
rr-facebook-cover-851x315.jpg
rr-linkedin-personal-banner-1584x396.jpg
rr-linkedin-company-cover-4200x700.jpg
rr-gbp-cover-1024x575.jpg
rr-logo-white-2048.png
rr-logo-navy-badge-1000x1000.png
```

---

## File Destinations

```
/BRAND MANAGER/logos/                  — all logo variants
  navy/                                — dark navy on transparent
  white/                               — white on transparent
  badge/                               — circular badge versions
  on-white/                            — logo on white square bg

/BRAND MANAGER/platform-assets/        — all platform-specific exports
  instagram/
  facebook/
  youtube/
  linkedin/
  tiktok/
  twitter/
  pinterest/
  nextdoor/
  gbp/
  portals/
```

---

## Production Methods

### Method A: ImageMagick (avatars, logo resizing, color conversion)

All resize commands use `magick` (ImageMagick 7+). For existing photos:

```bash
# Scale headshot to 1080×1080 with white background (Instagram avatar)
magick "/RyanRealty/public/images/brokers/ryan-matt.jpg" \
  -resize 1080x1080^ \
  -gravity center \
  -extent 1080x1080 \
  -background white \
  "rr-instagram-avatar-matt-1080x1080.jpg"
```

Full command library: `references/production-scripts.md` → Section 1

### Method B: Python PIL (highlight covers batch, compositing)

Used for Instagram highlight covers (8 frames), any batch operation, and logo-on-background compositing.

Full scripts: `references/production-scripts.md` → Section 2

### Method C: Canva Brief Handoff (banners and covers)

Canva MCP generation is banned (per `feedback_no_canva_generation.md`). For all banner/cover assets, produce a structured design brief and hand off to Canva manually. No API calls for generating new designs.

Brief format: `references/production-scripts.md` → Section 3

---

## Production Order (Fresh Channel Setup)

Run in this sequence — each step unblocks the next:

1. **Produce white logo variants** (2048, 1024, 512, 256px) — ImageMagick, Section 1
2. **Produce navy logo variants** (2048, 1024, 512, 256px) — ImageMagick, Section 1
3. **Produce circular badge logo** — PIL, Section 2
4. **Scale headshot for all avatar platforms** — ImageMagick batch, Section 1
5. **Generate Instagram highlight covers** (8 frames) — PIL, Section 2
6. **Execute Canva briefs** for all banners/covers (FB, YT, LI personal, LI company, X, Pinterest, Nextdoor, GBP) — Section 3
7. **Upload everything** per platform (use `platform-publishing.md` for upload steps)

---

## NAP Consistency Checklist

All directory and portal profiles must use exactly:

| Field | Value |
|-------|-------|
| Business name | Ryan Realty |
| Broker name | Matt Ryan |
| Phone | 541.213.6706 |
| Website | https://ryan-realty.com |
| Address | Bend, OR (use current registered address) |
| Handle | @ryanrealtybend |

Audit all 14 platforms against this table any time a name, phone, or URL changes.

---

## Verification After Production

Before uploading any asset:

- [ ] Dimensions match upload spec in Master Asset List
- [ ] Circle-crop test: center content visible within smallest circle display size
- [ ] Logo not illegible at smallest display size
- [ ] Gold is accent only — no large gold fills
- [ ] No em dashes in any text (per `feedback_copy_writing_rules.md`)
- [ ] Phone formatted as 541.213.6706 (not dashes, not parens)
- [ ] File named per convention above
- [ ] File saved to correct destination folder

---

## Related Skills

- `platform-publishing.md` — upload steps per platform after assets are ready
- `cross-platform-repurpose.md` — post images, reel covers, content assets (not this skill)
- `references/production-scripts.md` — all ImageMagick commands, PIL scripts, Canva briefs
