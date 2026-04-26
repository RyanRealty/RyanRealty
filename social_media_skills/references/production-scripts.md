---
name: production-scripts
description: Production Scripts — Ryan Realty Profile Assets
---
# Production Scripts — Ryan Realty Profile Assets

Reference file for `media-asset-production.md`. Contains all ImageMagick commands, Python PIL scripts, and Canva brief specs.

---

## Section 1: ImageMagick Commands

### Prerequisites

```bash
# Verify ImageMagick 7+ is installed
magick --version

# Set source path variables (adjust if running from different cwd)
LOGO_NAVY="/RyanRealty/public/logo.png"
LOGO_WHITE_400="/RyanRealty/public/logo-header-white.png"
HEADSHOT="/RyanRealty/public/images/brokers/ryan-matt.jpg"
OUT="/BRAND MANAGER/platform-assets"
LOGOS="/BRAND MANAGER/logos"
```

---

### 1.1 White Logo — Convert from Navy Master

```bash
# Convert dark navy logo to white on transparent
magick "$LOGO_NAVY" \
  -fuzz 15% \
  -fill white \
  +opaque "rgb(16,39,66)" \
  "$LOGOS/white/rr-logo-white-master.png"
```

**Note:** The `+opaque` flag keeps the specified color and replaces everything else. Adjust `-fuzz` (10–20%) if fringe pixels remain.

---

### 1.2 Logo Variants — All Sizes (Navy and White)

```bash
# Navy logo variants
for W in 2048 1024 512 256; do
  magick "$LOGO_NAVY" \
    -resize ${W}x \
    "$LOGOS/navy/rr-logo-navy-${W}.png"
done

# White logo variants (from converted master)
for W in 2048 1024 512 256; do
  magick "$LOGOS/white/rr-logo-white-master.png" \
    -resize ${W}x \
    "$LOGOS/white/rr-logo-white-${W}.png"
done
```

---

### 1.3 YouTube Watermark (150×150 transparent PNG)

```bash
# Scale white logo to fit within 150×150, preserve transparency
magick "$LOGOS/white/rr-logo-white-512.png" \
  -resize 150x150 \
  -gravity center \
  -background transparent \
  -extent 150x150 \
  "$OUT/youtube/rr-youtube-watermark-150x150.png"
```

---

### 1.4 Logo on White Square (LinkedIn company, Nextdoor)

```bash
# Logo centered on white 1000×1000 square
magick -size 1000x1000 xc:white \
  "$LOGO_NAVY" -resize 700x \
  -gravity center \
  -composite \
  "$LOGOS/on-white/rr-logo-on-white-1000x1000.png"

# 400×400 variant for LinkedIn company upload
magick "$LOGOS/on-white/rr-logo-on-white-1000x1000.png" \
  -resize 400x400 \
  "$OUT/linkedin/rr-linkedin-company-logo-400x400.png"
```

---

### 1.5 GBP Logo (1200×1200 recommended)

```bash
# White background, logo centered with generous padding
magick -size 1200x1200 xc:white \
  "$LOGO_NAVY" -resize 900x \
  -gravity center \
  -composite \
  "$OUT/gbp/rr-gbp-logo-1200x1200.png"
```

---

### 1.6 Headshot Avatars — Batch All Platforms

```bash
# Instagram avatar: 1080×1080
magick "$HEADSHOT" \
  -resize 1080x1080^ \
  -gravity center \
  -extent 1080x1080 \
  -background white \
  "$OUT/instagram/rr-instagram-avatar-matt-1080x1080.jpg"

# Facebook profile: 720×720
magick "$HEADSHOT" \
  -resize 720x720^ \
  -gravity center \
  -extent 720x720 \
  -background white \
  "$OUT/facebook/rr-facebook-profile-matt-720x720.jpg"

# YouTube profile: 800×800
magick "$HEADSHOT" \
  -resize 800x800^ \
  -gravity center \
  -extent 800x800 \
  -background white \
  "$OUT/youtube/rr-youtube-profile-matt-800x800.jpg"

# LinkedIn personal: 640×640
magick "$HEADSHOT" \
  -resize 640x640^ \
  -gravity center \
  -extent 640x640 \
  -background white \
  "$OUT/linkedin/rr-linkedin-personal-profile-matt-640x640.jpg"

# TikTok: 720×720
magick "$HEADSHOT" \
  -resize 720x720^ \
  -gravity center \
  -extent 720x720 \
  -background white \
  "$OUT/tiktok/rr-tiktok-profile-matt-720x720.jpg"

# X/Twitter: 800×800
magick "$HEADSHOT" \
  -resize 800x800^ \
  -gravity center \
  -extent 800x800 \
  -background white \
  "$OUT/twitter/rr-twitter-profile-matt-800x800.jpg"

# Pinterest: 600×600
magick "$HEADSHOT" \
  -resize 600x600^ \
  -gravity center \
  -extent 600x600 \
  -background white \
  "$OUT/pinterest/rr-pinterest-profile-matt-600x600.jpg"

# Nextdoor business logo: 500×500 (use logo, not headshot)
magick "$LOGOS/on-white/rr-logo-on-white-1000x1000.png" \
  -resize 500x500 \
  "$OUT/nextdoor/rr-nextdoor-logo-500x500.png"

# Zillow headshot: 330×220 JPEG
magick "$HEADSHOT" \
  -resize 330x220^ \
  -gravity center \
  -extent 330x220 \
  -background white \
  -quality 90 \
  "$OUT/portals/rr-zillow-headshot-330x220.jpg"

# Realtor.com / Homes.com: 400×400
magick "$HEADSHOT" \
  -resize 400x400^ \
  -gravity center \
  -extent 400x400 \
  -background white \
  "$OUT/portals/rr-portal-headshot-400x400.jpg"
```

---

### 1.7 Circular Badge Logo (1000×1000)

```bash
# Navy circle background with white logo centered
magick -size 1000x1000 \
  xc:"rgb(16,39,66)" \
  -fill "rgb(16,39,66)" \
  -draw "circle 500,500 500,1" \
  "$LOGOS/white/rr-logo-white-512.png" \
  -gravity center \
  -composite \
  "$LOGOS/badge/rr-logo-navy-badge-1000x1000.png"
```

---

## Section 2: Python PIL Scripts

### 2.1 Instagram Highlight Covers — Batch 8 Frames

Each highlight cover is 1080×1920. The visible area is a ~420px circle at center. Design strategy: navy full background, gold icon area, Butcher label at center.

Since custom fonts (Butcher) cannot be embedded via PIL without the .ttf file, this script uses a compositing approach: creates the colored background and a centered label zone. Final text/icon layer is applied as a Canva brief or via `magick` with embedded font path.

```python
#!/usr/bin/env python3
"""
Generate Instagram Highlight Cover backgrounds (8 frames).
Outputs navy 1080x1920 PNG with a gold circle at center (420px diameter)
sized to match Instagram's display circle crop.

Run:  python3 highlight_covers.py
Output: /BRAND MANAGER/platform-assets/instagram/highlights/
"""

from PIL import Image, ImageDraw
import os

OUTPUT_DIR = "/BRAND MANAGER/platform-assets/instagram/highlights"
os.makedirs(OUTPUT_DIR, exist_ok=True)

NAVY = (16, 39, 66)
GOLD = (212, 175, 55)
WHITE = (255, 255, 255)
CANVAS_W, CANVAS_H = 1080, 1920

# Circle: 420px diameter centered at (540, 960)
CIRCLE_DIAMETER = 420
CIRCLE_RADIUS = CIRCLE_DIAMETER // 2
CX, CY = CANVAS_W // 2, CANVAS_H // 2

HIGHLIGHTS = [
    "Listings",
    "Market Updates",
    "Bend Life",
    "Buying",
    "Selling",
    "About Matt",
    "Testimonials",
    "FAQ",
]


def make_highlight_base(label: str) -> Image.Image:
    """Create navy background with gold accent circle at center."""
    img = Image.new("RGBA", (CANVAS_W, CANVAS_H), (*NAVY, 255))
    draw = ImageDraw.Draw(img)

    # Gold ring (stroke only, 6px)
    ring_bbox = [
        CX - CIRCLE_RADIUS,
        CY - CIRCLE_RADIUS,
        CX + CIRCLE_RADIUS,
        CY + CIRCLE_RADIUS,
    ]
    draw.ellipse(ring_bbox, outline=GOLD, width=6)

    # Inner lighter circle for icon/text area (white at low opacity)
    inner_r = CIRCLE_RADIUS - 30
    inner_bbox = [
        CX - inner_r,
        CY - inner_r,
        CX + inner_r,
        CY + inner_r,
    ]
    # Draw semi-transparent white fill
    overlay = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    ov_draw.ellipse(inner_bbox, fill=(*WHITE, 20))
    img = Image.alpha_composite(img, overlay)

    return img


for label in HIGHLIGHTS:
    img = make_highlight_base(label)
    slug = label.lower().replace(" ", "_")
    filename = f"rr-instagram-highlight-{slug}-1080x1920.png"
    path = os.path.join(OUTPUT_DIR, filename)
    img.save(path)
    print(f"Saved: {path}")

print("Done. Add label text via ImageMagick or Canva handoff.")
```

---

### 2.2 Add Text Labels to Highlight Covers (ImageMagick — requires font path)

After running the PIL script above, add the label using ImageMagick with the Butcher font TTF:

```bash
# Path to Butcher font (adjust if font is in a different location)
FONT_PATH="/BRAND MANAGER/fonts/Butcher.ttf"
HIGHLIGHT_DIR="/BRAND MANAGER/platform-assets/instagram/highlights"

LABELS=(
  "Listings:listings"
  "Market Updates:market_updates"
  "Bend Life:bend_life"
  "Buying:buying"
  "Selling:selling"
  "About Matt:about_matt"
  "Testimonials:testimonials"
  "FAQ:faq"
)

for ENTRY in "${LABELS[@]}"; do
  LABEL="${ENTRY%%:*}"
  SLUG="${ENTRY##*:}"
  IN="$HIGHLIGHT_DIR/rr-instagram-highlight-${SLUG}-1080x1920.png"
  OUT_F="$HIGHLIGHT_DIR/rr-instagram-highlight-${SLUG}-final-1080x1920.png"

  magick "$IN" \
    -font "$FONT_PATH" \
    -pointsize 52 \
    -fill white \
    -gravity center \
    -annotate +0+0 "$LABEL" \
    "$OUT_F"

  echo "Labeled: $OUT_F"
done
```

**If Butcher.ttf is not available locally:** Skip this step and add text in Canva using the brand kit Butcher font. Export from Canva as PNG at 1080×1920.

---

## Section 3: Canva Brief Handoffs

Canva MCP design generation is banned. These briefs are structured handoffs for a human operator to execute in Canva using the Ryan Realty brand kit.

Each brief includes: dimensions, background, typography specs, copy, logo placement, and source assets.

---

### 3.1 Facebook Cover Photo

**File:** `rr-facebook-cover-851x315.jpg`

| Field | Value |
|-------|-------|
| Canvas size | 851×315 px |
| Background | White (`#FFFFFF`) |
| Safe zone | Center 820×315; keep critical content away from left 176px (profile photo overlap) |

**Layout (left to right):**
- Left 200px: leave empty or subtle navy texture (profile photo will overlap on desktop)
- Center: Matt Ryan name in Butcher 36pt Navy, subtitle "Principal Broker · Ryan Realty" in AzoSans 16pt Navy
- Right area: Logo (navy, ~220px wide), phone 541.213.6706 in AzoSans 13pt Navy

**Bottom rule:** 4px gold line at bottom of canvas, full width

**Source assets to place:**
- `/RyanRealty/public/logo.png` — resize to ~220px wide, right side
- No headshot in cover (Matt's profile photo already shows left)

---

### 3.2 YouTube Channel Banner

**File:** `rr-youtube-banner-2560x1440.jpg`

| Field | Value |
|-------|-------|
| Canvas size | 2560×1440 px |
| Background | Navy `#102742` full bleed OR Bend landscape photo with navy overlay (60% opacity) |
| Safe zone | 1235×338 centered at (662, 551) — ALL critical content here |

**Inside safe zone (1235×338):**
- Left: White logo at ~340px wide
- Center divider: 2px gold vertical rule
- Right: "Ryan Realty" in Butcher white 48pt | "Bend, Oregon Real Estate" in AzoSans white 20pt | "541.213.6706" in AzoSans gold 16pt

**Outside safe zone:** Navy fill or photography — decorative only, no text

**Source assets:**
- `/RyanRealty/public/logo-header-white.png` — white logo
- Bend landscape photography from `/06_Marketing & Brand/Marketing/Media/Web Site/Area Guides/` if using photo background

---

### 3.3 LinkedIn Personal Banner (Matt Ryan)

**File:** `rr-linkedin-personal-banner-1584x396.jpg`

| Field | Value |
|-------|-------|
| Canvas size | 1584×396 px |
| Background | White or very light off-white (`#F8F8F6`) |

**Layout:**
- Left 2/3: "Bend, Oregon Real Estate" in Butcher Navy 52pt (split across two lines if needed)
- Subtitle: "Principal Broker · Ryan Realty" in AzoSans Navy 20pt
- Bottom: 4px gold accent line spanning left 60% of width
- Right 1/3: Logo (navy, ~280px wide) vertically centered

**Tone:** Editorial. Clean white space. No photography. Minimal.

---

### 3.4 LinkedIn Company Cover (Ryan Realty)

**File:** `rr-linkedin-company-cover-4200x700.jpg`

| Field | Value |
|-------|-------|
| Canvas size | 4200×700 px |
| Background | Navy `#102742` |

**Layout:**
- Center: White logo at ~700px wide
- Below logo: "Bend, Oregon · Real Estate" in AzoSans white 28pt, letter-spacing 0.15em
- Subtle gold horizontal rule below text (600px wide, centered)

**Note:** 4200×700 is the official LinkedIn spec; LinkedIn will scale down on display. Keep the center 2800px relatively clear.

---

### 3.5 X / Twitter Header

**File:** `rr-twitter-header-1500x500.jpg`

| Field | Value |
|-------|-------|
| Canvas size | 1500×500 px |
| Background | White or Bend lifestyle photography |
| Mobile crop | Top and bottom ~60px are hidden on mobile — place critical content in center 380px vertically |

**Layout:**
- If white background: Left-align "Ryan Realty" Butcher navy 60pt, "Bend, Oregon Real Estate" AzoSans navy 22pt, gold rule below
- If photo background: Navy overlay 50% opacity, centered white logo ~300px wide, white tagline below

---

### 3.6 Pinterest Profile Cover

**File:** `rr-pinterest-cover-1600x900.jpg`

| Field | Value |
|-------|-------|
| Canvas size | 1600×900 px |
| Background | Bend lifestyle photography preferred (Snowdrift Visuals library) |

**Layout:**
- Navy overlay 40% opacity over photo
- Centered: White logo ~320px wide
- Below: "Central Oregon Real Estate" in AzoSans white 22pt

**Source photos:** `/06_Marketing & Brand/Marketing/Media/Web Site/Area Guides/` — use any Bend neighborhood image

---

### 3.7 Nextdoor Business Banner

**File:** `rr-nextdoor-banner-1156x650.jpg`

| Field | Value |
|-------|-------|
| Canvas size | 1156×650 px |
| Background | White or light navy |

**Layout:**
- Centered layout: Logo navy at ~300px wide (top center)
- Below: "Matt Ryan · Principal Broker" in AzoSans navy 24pt
- "Ryan Realty · Bend, OR" in AzoSans navy 18pt
- "541.213.6706" in AzoSans gold 18pt
- Thin gold bottom rule

---

### 3.8 Google Business Profile Cover

**File:** `rr-gbp-cover-1024x575.jpg`

| Field | Value |
|-------|-------|
| Canvas size | 1024×575 px (16:9) |
| Background | Bend lifestyle photography (preferred) or white |

**Layout:**
- If photo: Navy bar at bottom 120px height, white logo ~200px wide left-aligned in bar, "Ryan Realty · Bend, OR" white AzoSans 18pt right side of bar
- If white: Navy left column 300px wide, white logo centered in column, right side "Ryan Realty" Butcher navy 36pt, tagline AzoSans navy 16pt

**GBP is often the first visual impression for search — use photography if available.**

---

## Section 4: Full Production Run Script

One-shot script that runs all ImageMagick commands in sequence. Requires ImageMagick 7+ installed.

```bash
#!/usr/bin/env bash
# Ryan Realty — Full Profile Asset Production Run
# Produces all avatar/logo assets that do NOT require Canva
# Run from any directory; uses absolute paths throughout

set -euo pipefail

LOGO_NAVY="/RyanRealty/public/logo.png"
LOGO_WHITE_SRC=""  # Will be generated in step 1
HEADSHOT="/RyanRealty/public/images/brokers/ryan-matt.jpg"
LOGOS="/BRAND MANAGER/logos"
OUT="/BRAND MANAGER/platform-assets"

# Create directory structure
mkdir -p \
  "$LOGOS/navy" "$LOGOS/white" "$LOGOS/badge" "$LOGOS/on-white" \
  "$OUT/instagram/highlights" \
  "$OUT/facebook" "$OUT/youtube" "$OUT/linkedin" \
  "$OUT/tiktok" "$OUT/twitter" "$OUT/pinterest" \
  "$OUT/nextdoor" "$OUT/gbp" "$OUT/portals"

echo "=== Step 1: White logo master ==="
magick "$LOGO_NAVY" \
  -fuzz 15% -fill white +opaque "rgb(16,39,66)" \
  "$LOGOS/white/rr-logo-white-master.png"
LOGO_WHITE_SRC="$LOGOS/white/rr-logo-white-master.png"

echo "=== Step 2: Logo variants — navy and white ==="
for W in 2048 1024 512 256; do
  magick "$LOGO_NAVY" -resize ${W}x "$LOGOS/navy/rr-logo-navy-${W}.png"
  magick "$LOGO_WHITE_SRC" -resize ${W}x "$LOGOS/white/rr-logo-white-${W}.png"
done

echo "=== Step 3: Logo on white square ==="
magick -size 1000x1000 xc:white \
  \( "$LOGO_NAVY" -resize 700x \) \
  -gravity center -composite \
  "$LOGOS/on-white/rr-logo-on-white-1000x1000.png"

magick "$LOGOS/on-white/rr-logo-on-white-1000x1000.png" \
  -resize 400x400 "$OUT/linkedin/rr-linkedin-company-logo-400x400.png"

magick "$LOGOS/on-white/rr-logo-on-white-1000x1000.png" \
  -resize 500x500 "$OUT/nextdoor/rr-nextdoor-logo-500x500.png"

echo "=== Step 4: GBP logo ==="
magick -size 1200x1200 xc:white \
  \( "$LOGO_NAVY" -resize 900x \) \
  -gravity center -composite \
  "$OUT/gbp/rr-gbp-logo-1200x1200.png"

echo "=== Step 5: YouTube watermark ==="
magick "$LOGOS/white/rr-logo-white-512.png" \
  -resize 150x150 -gravity center \
  -background transparent -extent 150x150 \
  "$OUT/youtube/rr-youtube-watermark-150x150.png"

echo "=== Step 6: Circular badge logo ==="
magick -size 1000x1000 xc:"rgb(16,39,66)" \
  \( "$LOGO_WHITE_SRC" -resize 600x \) \
  -gravity center -composite \
  "$LOGOS/badge/rr-logo-navy-badge-1000x1000.png"

echo "=== Step 7: Headshot avatars ==="
declare -A AVATARS=(
  ["$OUT/instagram/rr-instagram-avatar-matt-1080x1080.jpg"]="1080x1080"
  ["$OUT/facebook/rr-facebook-profile-matt-720x720.jpg"]="720x720"
  ["$OUT/youtube/rr-youtube-profile-matt-800x800.jpg"]="800x800"
  ["$OUT/linkedin/rr-linkedin-personal-profile-matt-640x640.jpg"]="640x640"
  ["$OUT/tiktok/rr-tiktok-profile-matt-720x720.jpg"]="720x720"
  ["$OUT/twitter/rr-twitter-profile-matt-800x800.jpg"]="800x800"
  ["$OUT/pinterest/rr-pinterest-profile-matt-600x600.jpg"]="600x600"
  ["$OUT/portals/rr-portal-headshot-400x400.jpg"]="400x400"
)

for OUTPATH in "${!AVATARS[@]}"; do
  SIZE="${AVATARS[$OUTPATH]}"
  magick "$HEADSHOT" \
    -resize ${SIZE}^ -gravity center -extent ${SIZE} \
    -background white \
    "$OUTPATH"
  echo "  $OUTPATH"
done

# Zillow special: 330×220 landscape
magick "$HEADSHOT" \
  -resize 330x220^ -gravity center -extent 330x220 \
  -background white -quality 90 \
  "$OUT/portals/rr-zillow-headshot-330x220.jpg"

echo ""
echo "=== ImageMagick production complete ==="
echo "Remaining: run PIL highlight script, then execute Canva briefs (Section 3)"
echo "See media-asset-production.md for upload checklist"
```

---

## Section 5: Asset Status Tracker

Update this table as assets are produced and uploaded.

| Platform | Asset | Produced | Uploaded | Last Updated |
|----------|-------|----------|----------|-------------|
| Instagram | Avatar | — | — | — |
| Instagram | Highlight: Listings | — | — | — |
| Instagram | Highlight: Market Updates | — | — | — |
| Instagram | Highlight: Bend Life | — | — | — |
| Instagram | Highlight: Buying | — | — | — |
| Instagram | Highlight: Selling | — | — | — |
| Instagram | Highlight: About Matt | — | — | — |
| Instagram | Highlight: Testimonials | — | — | — |
| Instagram | Highlight: FAQ | — | — | — |
| Facebook | Profile photo | — | — | — |
| Facebook | Cover photo | — | — | — |
| YouTube | Profile photo | — | — | — |
| YouTube | Channel banner | — | — | — |
| YouTube | Channel watermark | — | — | — |
| LinkedIn (personal) | Profile photo | — | — | — |
| LinkedIn (personal) | Banner | — | — | — |
| LinkedIn (company) | Logo | — | — | — |
| LinkedIn (company) | Cover photo | — | — | — |
| TikTok | Profile photo | — | — | — |
| X/Twitter | Profile photo | — | — | — |
| X/Twitter | Header image | — | — | — |
| Pinterest | Profile photo | — | — | — |
| Pinterest | Cover photo | — | — | — |
| Threads | Profile (auto from IG) | — | — | — |
| Nextdoor | Business logo | — | — | — |
| Nextdoor | Business banner | — | — | — |
| GBP | Logo | — | — | — |
| GBP | Cover photo | — | — | — |
| Zillow | Headshot | — | — | — |
| Realtor.com | Profile photo | — | — | — |
| Homes.com | Profile photo | — | — | — |
| Logo library | White 2048 | — | — | — |
| Logo library | White 1024 | — | — | — |
| Logo library | White 512 | — | — | — |
| Logo library | White 256 | — | — | — |
| Logo library | Navy badge 1000×1000 | — | — | — |
