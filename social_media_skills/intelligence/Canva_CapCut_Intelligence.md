---
name: Canva_CapCut_Intelligence
description: Canva & CapCut Production Intelligence — Ryan Realty
---
# Canva & CapCut Production Intelligence — Ryan Realty

## How to Use This Document

This guide is designed for two audiences:
1. **AI assistants** with access to Canva MCP (API control) — use the API capabilities section to understand what can be automated
2. **Matt Ryan** and content creators — use the workflow, specs, and best practices sections to guide manual production

This document consolidates current capabilities (2025), specific specs for real estate social media, and the optimal production pipeline from brand asset → finished Instagram Reel.

---

## Canva API Capabilities (What the AI Can Do Directly)

### Overview: The Canva MCP Server

The Canva Model Context Protocol (MCP) server enables AI assistants to control Canva programmatically. Once connected to Claude or another LLM, the assistant can:

- **Create designs** from scratch or from templates
- **Edit existing designs** (change text, swap images, adjust colors, reposition elements)
- **Apply brand kits** automatically (colors, fonts, logos)
- **Manage brand templates** and autofill fields with dynamic data
- **Export designs** in multiple formats (PDF, JPG, PNG, MP4)
- **Search and organize** existing designs and folders

**Source:** [Canva MCP Integration for AI Agents](https://www.canva.dev/docs/connect/mcp-server/) | [Connect AI assistants to Canva with the AI Connector](https://www.canva.com/help/mcp-agent-setup/)

### Key API Endpoints & Capabilities

#### Design Editing API (Design Editing Transaction)

The Design Editing API allows programmatic reading and updating of design layout and contents. An "editing transaction" is a workflow session where:

1. You start an editing transaction (get a transaction ID)
2. Perform operations: edit text, swap images, change colors, reposition elements
3. Commit the transaction (save changes to the design)

This powers features like:
- **Autofill brand templates** — populate template placeholders with listing data (address, price, acreage)
- **Programmatic text updates** — change listing details, captions, or agent contact info
- **Dynamic image swaps** — replace placeholder images with actual property photos
- **Color/style adjustments** — apply consistent brand colors across elements

**Source:** [Design Editing API - Design interaction](https://www.canva.dev/docs/apps/design-editing/) | [Design Editing API - Canva's biggest API update yet](https://www.canva.com/newsroom/news/new-apis-data-connectors/)

#### Design Creation & Autofill

```
POST /designs
```
Create a new design by autofilling a brand template with data. Example workflow:

1. Select a brand template (e.g., "Property Listing Reel Cover")
2. Map your data to template fields:
   - `listing_address` → template address field
   - `listing_price` → template price field
   - `property_photos` → image placeholders
3. Submit autofill job
4. API returns generated design ready to download

This reduces reel cover creation from 15 minutes to 2 minutes.

**Source:** [Create design - Designs - Canva Connect APIs Documentation](https://www.canva.dev/docs/connect/api-reference/designs/create-design/)

#### Brand Kit & Brand Template APIs

Brand templates enforce brand consistency at the API level:

- **Read brand kits** — fetch colors (navy #001F3F, gold #FFD700), fonts (Butcher, AzoSans, Amboqia), logos
- **Apply brand templates** — designs automatically use brand colors, fonts, logos
- **Autofill brand templates** — populate brand-approved template placeholders with fresh data

This means: Every design created via API automatically inherits your navy/gold palette and brand fonts without manual adjustment.

**Source:** [Brand templates - Canva Connect APIs Documentation](https://www.canva.dev/docs/connect/api-reference/brand-templates/)

#### Export API (Asynchronous Jobs)

```
POST /exports
```
Create an asynchronous export job. The API doesn't return the file immediately—it queues a job and returns a job ID. Poll the job status until complete, then download the file.

Supported formats:
- **PDF** — for print (300 DPI available), documents
- **JPG** — social media posts (96 DPI max, custom quality 1-100)
- **PNG** — social media reels, stories (96 DPI max, lossless option, single-image option for multi-page)
- **GIF** — animated stories
- **MP4** — video reels (CapCut-ready format)
- **PPTX** — PowerPoint presentations

For social media (Reels, Stories, Feed Posts), always export PNG or JPG at 96 DPI. Canva does not offer DPI adjustment for these formats.

**Source:** [Exports - Canva Connect APIs Documentation](https://www.canva.dev/docs/connect/api-reference/exports/)

### API Limitations: What the Canva API CANNOT Do

- **Cannot create custom fonts** — only use brand kit fonts
- **Cannot generate AI images** (Magic Design output) in bulk via API — requires manual interaction in Canva UI
- **Cannot access Design Editing API at scale** without Enterprise account — design editing is available but limited for non-Enterprise users
- **Cannot directly control CapCut** — exports designs as MP4, but audio, beat sync, and speed ramping must happen in CapCut
- **Cannot read audio properties** from designs — metadata like duration is not exposed via API

### Magic Design & AI-Assisted Design

Canva's Magic Design is an AI tool that generates complete design layouts from a text prompt (e.g., "property listing reel cover for $1.5M Bend home with mountain view"). However:

- **Manual workflow only** — Magic Design requires human interaction in the Canva editor
- **Not available via API** — you must use the Canva web UI to trigger Magic Design
- **Output: design candidates** — Magic Design returns 2-3 design variations; you select the best one

For automated workflows, use **autofill brand templates** instead (API-driven, consistent, fast).

**Source:** [Meet Magic Studio | Canva's AI Tools](https://www.canva.com/magic/) | [Canva AI: Your all-in-one AI assistant](https://www.canva.com/ai-assistant/)

---

## Canva Best Practices for Real Estate Social Content

### Instagram Reels Covers (1080x1920, 9:16)

**Design approach:**
- **Hero image at top** (60-70% of frame) — property photo or lifestyle shot
- **Text overlay at bottom** (30-40% of frame) — price, location, key detail
- **Consistent footer bar** — agent name + phone (541.213.6706)
- **Brand colors** — navy background with gold accents for text
- **Safe zone** — keep critical text 210px from top, 440px from bottom (avoid Instagram UI overlays)

**Best practices:**
- Use Canva's **text animation** (fade in, slide from bottom) to reveal price
- Apply **drop shadows** behind text for readability over image
- **Font hierarchy** — large Butcher display font for price, AzoSans body copy for property details
- **Whitespace** — avoid cramming text; let the image breathe
- Test on mobile before exporting

**Animation strategy:** Animate entrance (fade/slide) for price, static animation for property details. Total animation duration: 1-3 seconds.

**Source:** [15 Canva Reel Ideas Using Your Templates for Instagram](https://www.digitalzaa.com/blog/15-canva-reel-ideas-using-your-templates-for-instagram) | [Customize 3,240+ Business Instagram Reels Templates Online - Canva](https://www.canva.com/instagram-reels/templates/business/)

### Instagram Story Sequences (1080x1920, 7-9 frames)

**Frame structure:**
1. **Hook** — "Would you live here?" or "Check this out"
2. **Price reveal** — $1.5M (large, gold text)
3. **Key feature 1** — Mountain views, acreage, etc. (lifestyle image + text)
4. **Key feature 2** — Outdoor living, updated kitchen, etc.
5. **Key feature 3** — Location/neighborhood highlight
6. **CTA frame** — "DM me for a tour" or "DM me 'strategy'"
7. **Agent card** — Matt Ryan contact info, headshot, phone

**Design consistency:**
- All frames use same brand colors (navy + gold)
- Same font family (Butcher for headers, AzoSans for body)
- Same footer/contact layout
- Consistent image cropping (9:16 vertical, face-forward for lifestyle shots)

**Engagement driver:** Every story sequence must include a DM call-to-action (frame 6). Instagram ranks DM shares as the #1 engagement signal for Reels and Stories.

**Source:** [Create Engaging Real Estate Reels with Canva | myRealPage Blog](https://myrealpage.com/blog/create-engaging-real-estate-reels-with-canva/)

### Instagram Feed Posts (1080x1080, 1:1)

**Design approach:**
- **Centered composition** — property photo or lifestyle image as background
- **Text overlay** — short, impactful headline + short body copy
- **Consistent frame** — navy border or gold accent line
- **Whitespace** — don't extend text to edges; keep margins
- **CTA at bottom** — "DM me 'strategy'" or similar

**Caption strategy:** Captions are NOT part of the design; they live in the Instagram caption field. Canva design should be self-contained (image + headline). Keep on-screen text to <15 words.

**Best practices:**
- Use Canva's **Magic Write** to generate caption copy (tips: "Describe a property listing for a 3-bed 2-bath home in Bend with mountain views")
- Test readability at small thumbnail size (square will be 400px wide on feed)
- Avoid thin fonts; use bold/semi-bold weights for readability

### Canva Animations for Real Estate

**What works best:**
- **Fade in / Fade out** — smooth transitions between listing details
- **Slide from bottom** — price reveal, key property features
- **Zoom in** — emphasize hero property photo (subtle, 1.1x scale max)
- **Bounce entrance** — for CTAs ("DM me" text)

**What to avoid:**
- Spinning/rotating text (unprofessional)
- Overly fast animations (>3 seconds total)
- Multiple simultaneous animations (confusing, distracting)

**Duration sweet spot:** 1-2 seconds per animation. Total story frame should animate in 2-5 seconds.

### Canva's Magic Write for Copy

Magic Write is an AI writing assistant integrated into Canva text boxes. Workflow:

1. Click text box → type a prompt: "Create a short, engaging description for a 2.28 acre property with mountain views and modern home in Bend, Oregon"
2. Magic Write generates copy in 3-5 seconds
3. Edit, refine, delete unused text
4. Confirm

**Real estate prompts that work:**
- "Engaging Instagram caption for a property listing with [price], [beds], [location], [key feature]"
- "DM call-to-action for real estate reel about buying in [neighborhood]"
- "Short market tip about selling property in [area]"

**Output quality:** Generally good for first drafts; requires human editing to align with Ryan Realty voice (no salesy language, authentic, service-oriented).

**Source:** [Magic Write: AI Text Generator & AI Writer | Canva](https://www.canva.com/magic-write/) | [How to use Magic Write, Canva's AI-powered writing assistant](https://www.canva.com/learn/ai-writing-assistant-magic-write/)

### Canva Content Planner & Scheduling

Canva has a built-in content planner that allows you to:
- Create designs within the planner
- Schedule posts directly to Instagram, Facebook
- Manage content calendar
- Batch-create weekly content

**For Ryan Realty:** The 7-frame story sequence for Tumalo (and future listings) can be created in bulk, then scheduled for release (e.g., Monday/Wednesday/Friday mornings).

---

## Canva → Design Templates & Brand Kit Reference

### Ryan Realty Brand Kit (Loaded in Canva)

**Colors:**
- Primary navy: `#001F3F` (or closest Canva match)
- Accent gold: `#FFD700`
- Secondary: White (#FFFFFF), light gray for backgrounds

**Fonts:**
- Display/headlines: **Butcher** (bold, vintage feel)
- Body copy: **AzoSans** (clean, readable)
- Accent/captions: **Amboqia** (stylistic, limited use)

**Logo:**
- Dark navy on transparent (currently available)
- White version NEEDED for dark backgrounds (current gap — not yet created)

**Source:** [Brand Kit - Canva Pro](https://www.canva.com/pro/brand-kit/) | [How to build a brand kit + examples | Canva](https://www.canva.com/learn/how-to-build-a-brand-kit/)

### Template Structure in Canva (Ryan Realty Folders)

Canva folder organization:
- **Static Posts** — 1080x1080 feed posts (brand-approved designs)
- **Stories** — 1080x1920 story frames (7-9 frame sets)
- **Listing Reels** — 1080x1920 reel covers + full reel templates
- **Brand folder** — Rise Wise deliverables, custom fonts, digitized logo
- **Canva Templates folder** (in Google Drive) — backup of all templates for archival

**Access workflow:**
1. Start new design
2. Search templates: "Real estate Instagram Story" or "Property listing reel cover"
3. Select template
4. Brand Kit auto-applies navy/gold, fonts, logo
5. Edit text and image placeholders
6. Publish or export

### Autofill Workflow (API + Brand Templates)

For bulk listing creation (e.g., 5 properties per week):

1. **Data source:** CSV with columns: address, price, beds, baths, photo_url, agent_name, phone
2. **Brand template:** "Property Listing Reel Cover" (pre-designed, all field placeholders mapped)
3. **API call:** POST /designs with autofill data
4. **Output:** 5 reel covers, all brand-compliant, ready to download
5. **Next step:** Export to CapCut for video reel assembly

This reduces cover design time from 15 min × 5 = 75 min to ~5 min (API processing) + 5 min (review/export).

---

## CapCut: Complete Guide for Real Estate Video Production

### Desktop vs. Mobile: Which to Use

**CapCut Desktop** (primary for professional use):
- **Advantages:** Precise timeline editing, advanced color grading (LUTs), motion tracking, keyframing, higher export resolution, faster processing
- **Best for:** Property tours, neighborhood reels, complex multi-clip editing, color grading consistency
- **Timeline:** 2-3 minute Reel typically takes 20-40 minutes to produce

**CapCut Mobile:**
- **Advantages:** Quick, intuitive, built-in trending sounds, beat sync
- **Best for:** Quick 15-30 second clips, trending audio syncing, on-the-go edits
- **Limitation:** Less precise control, no LUT support, limited color grading

**Recommendation for Ryan Realty:** Use **CapCut Desktop** for all property videos and final Reels. Mobile is acceptable only for quick "neighborhood of the day" shorts.

### Beat Sync & Trending Audio (Critical for Algorithm)

Beat sync is CapCut's most powerful feature for Reels. It automatically detects audio beats and synchronizes video cuts to the rhythm.

**How it works:**
1. Import video clips (property footage, neighborhood scenes)
2. Add trending audio track
3. Click Beat Sync
4. CapCut analyzes audio peaks and cuts clips on beat
5. Review sync (usually requires tweaking)
6. Adjust manually for storytelling (property walk → price reveal on drop)

**Why it matters:** Videos with trending audio are **2.3x more likely to be shared** (per Later Media). Instagram's algorithm heavily rewards Reels that use current trending sounds.

**Real estate use case:** Beat sync works exceptionally well for:
- Property walk-throughs (cut on each major room reveal)
- Drone property footage (aerial shots sync to beat drops)
- Neighborhood montages (location transitions on beat)

**Trending audio sources in CapCut:**
- CapCut's built-in sound library (limited commercial rights — see music licensing below)
- **Bass Da Da Da** and similar percussive hooks are trending for real estate Reels

**Source:** [Beat Sync: Boost Your Videos with Perfect Rhythm | CapCut - AI Tools](https://www.capcut.com/explore/beat-sync) | [Beat Sync Video: Create Stunning Music Videos Easily | CapCut - AI Tools](https://www.capcut.com/explore/Beat-Sync-Video)

### Speed Ramping (Cinematic Property Tours)

Speed ramping (variable speed within a single clip) is effective for property tours:

**Example workflow:**
1. Slow motion (0.5x) as drone approaches property
2. Normal speed (1x) as you walk through front door
3. Fast forward (2x) through hallway
4. Normal speed (1x) in main living area
5. Slow motion (0.5x) at outdoor space reveal

**How to use in CapCut Desktop:**
1. Select clip on timeline
2. Right-click → **Speed** → create keyframes at points where speed changes
3. Set speed at each keyframe: 0.5x, 1x, 2x, etc.
4. CapCut uses **optical flow** to smooth transitions (avoids stuttering/tearing)

**Best practices:**
- Slow motion for reveals (main room, outdoor view, unique feature)
- Speed up mundane transitions (hallways, closets)
- Never exceed 2x speed (looks unnatural)
- Keep slow-motion segments under 3 seconds

**Limitation:** CapCut's keyframing is limited compared to Premiere Pro or DaVinci Resolve. For complex speed ramps, Premiere may be better.

**Source:** [Create smooth videos with speed curve effects - CapCut](https://www.capcut.com/tools/speed-ramp) | [Enhance Videos with Epic Speed Ramps in CapCut [2026 Guide]](https://filmora.wondershare.com/video-editing-tips/speed-ramp-capcut.html)

### Text Overlays & Animated Text

CapCut's text-to-video feature:

1. Add text element (price, address, key detail)
2. Choose animation: **fade in**, **slide from bottom**, **typewriter**, **bounce**
3. Set duration (1-3 seconds)
4. Position on screen (avoid safe zone violations)
5. Choose font, size, color

**Real estate text overlays that work:**
- **Price reveal** (fade in over 1 second, gold text on property image)
- **Address + neighborhood** (slide from bottom on aerial shot)
- **Key features** (typewriter effect: "2.28 Acres | Mountain Views | Updated")
- **CTA** (bounce entrance: "DM me for a tour")

**Font consistency:** Use fonts from Canva brand kit (AzoSans, Butcher) if possible, or closest match in CapCut. Gold (#FFD700) for accent text.

**Source:** [How to Make a Video with Scrolling Text - Desktop & Mobile Solutions](https://www.capcut.com/resource/how-to-make-videos-with-scrolling-text)

### CapCut AI Features

**AI Speech (Text-to-Speech):**
- Convert script or listing details to narration
- Choose voice (multiple options)
- Useful for neighborhood guide videos
- Output: audio track synced to timeline

**AI Enhance:**
- Auto-brighten underexposed footage
- Improve detail in dark areas
- Works well for property interior shots

**Background Removal & Green Screen:**
- Remove or replace backgrounds
- Limited use for real estate (backgrounds are important)

**Motion Tracking:**
- Track moving objects (car, person, drone movement)
- Add graphics that follow motion
- Advanced feature; rarely needed for property videos

### Color Grading with LUTs (Brand Consistency)

LUT (Look-Up Table) is a color preset that applies a consistent "look" to footage. Essential for maintaining visual consistency across multiple property videos.

**How to use LUTs in CapCut Desktop:**

1. **Import LUT file** (in .cube format) into CapCut
2. Select clip on timeline → **Adjust** → **Color** → **LUT**
3. Apply LUT to clip
4. For consistency: apply same LUT to all clips that appear together

**Why LUTs matter for real estate:**
- Property footage may be shot on different cameras, different times of day, different lighting
- A consistent LUT makes multi-clip Reels look professional (same color tone throughout)
- Creates recognizable visual signature (e.g., "Ryan Realty videos always have warm, golden tone")

**Recommended LUT approach:**
- Select 1-2 LUTs for all property videos (consistency)
- Examples: "Warm Cinematic," "Golden Hour," "Vibrant" (adjust to match Bend's landscape aesthetic)
- Free LUTs available; premium packs on Envato Elements, FilmImpact

**CapCut Desktop only:** Mobile version does not support external LUT imports.

**Source:** [The Ultimate Guide to LUTs: Transform Your Videos With Powerful Color Grading](https://www.capcut.com/resource/luts-for-color-grading) | [Master Color Grading in CapCut: Achieve Cinematic Quality Easily](https://www.capcut.com/resource/capcut-color-grading)

### Export Settings for Instagram Reels & TikTok

**Instagram Reels Specs:**
- **Resolution:** 1080 × 1920 pixels (9:16 aspect ratio)
- **Frame rate:** 30 fps (60 fps supported but 30 fps recommended for compatibility)
- **Codec:** H.264 (MP4 container)
- **Bitrate:** 5,000–10,000 kbps (max file size ~256 MB)
- **Audio:** AAC, 256 kbps, 48 kHz sample rate

**CapCut Desktop export:**
1. Timeline → **Export**
2. Resolution: **1080x1920**
3. Frame rate: **30 fps**
4. Format: **MP4**
5. Bitrate: **8,000 kbps** (middle of range, good quality without huge file)

**TikTok specs (identical to Instagram):**
- 1080 × 1920, 30 fps, H.264 MP4

**Quality tips:**
- Never export at 4K for social media (Instagram will compress, wasting bandwidth)
- Avoid bitrates below 5,000 kbps (visible compression artifacts)
- Keep critical text above 210px from top, below 440px from bottom (avoids UI overlays)

**Source:** [Best Bitrate & Export Settings for Instagram Reels (2026 Guide)](https://www.stayabundant.com/blog/best-instagram-reels-export-settings) | [Instagram Reel Size Guide (2026)](https://invideo.io/blog/instagram-reel-size-guide/)

### Music Licensing: What's Legal for Commercial Use

**Critical:** CapCut's default music library is NOT licensed for commercial use (selling a property is commercial).

**CapCut Commercial Sounds:**
- CapCut offers "Commercial Sounds" for commercial users
- **Limitation:** Only licensed for posting on CapCut, TikTok, TikTok for Business
- For Instagram/Facebook distribution, you need separate licensing

**Workaround for Real Estate Videos:**
1. **Royalty-free music libraries** (safe for commercial use):
   - YouTube Audio Library (free, Google account required)
   - Artlist (subscription, includes all sync rights)
   - Epidemic Sound (subscription)
   - Uppbeat (free + premium, all commercial rights included)

2. **Music licensing tip:** Always check "sync rights" before using — sync rights cover social media posting (Instagram, Facebook)

3. **Trending audio:** If you want trending sounds (TikTok native), post to TikTok directly with audio; TikTok's agreement covers most trending sounds. Avoid reposting TikTok audio to Instagram (licensing violation).

**Recommendation:** Purchase a subscription to Artlist or Epidemic Sound (~$10-20/month) for unlimited royalty-free music with commercial sync rights.

**Source:** [Is CapCut Music Copyrighted? Creator Guide to Safe Use](https://www.trademarkia.com/news/business/capcut-music-copyright-guide) | [CapCut Music for Commercial Use: What You Need to Know](https://artyfile.com/blog/capcut-music-commercial-use-guide)

---

## Production Workflow: Canva + CapCut Pipeline

### Recommended End-to-End Workflow (Weekly Real Estate Reel)

#### Phase 1: Plan & Prepare (Day 1–2)

**Inputs:**
- Property photos/video from Rich (Framed Visuals Co, rich@framedvisuals.co) via Aryeo
- Listing details: address, price, beds, baths, key features
- Trending audio research (check TikTok, Instagram Reels for trending sounds)

**Steps:**
1. **Organize footage** in folder: property_tour_video.mp4, hero_photo.jpg, lifestyle_photos (3-4)
2. **Source trending audio** — search Artlist or TikTok for current trending sounds in real estate space
3. **Write listing copy** using Ryan Realty voice guide (authentic, no hype)
4. **Sketch storyboard** (5-7 scenes for a 30-60 second Reel):
   - Drone approach (15 sec)
   - Front entry (10 sec)
   - Main living area (10 sec)
   - Outdoor space (10 sec)
   - Price/CTA (5 sec)

#### Phase 2: Create Reel Cover in Canva (30 min)

**Workflow:**
1. Open Canva → **Create new design** → **Instagram Reel Cover** (1080×1920)
2. Brand Kit auto-applies navy/gold, fonts, logo
3. **Upload hero property photo** (or use lifestyle image)
4. **Add text overlay:**
   - Headline (Butcher font): property address or key feature
   - Subheading (AzoSans): price or neighborhood
   - Footer: "DM me for a tour" or "Tap for details"
5. **Apply animation:** Fade in price (2 sec), static headline
6. **Export:** PNG, 1080×1920, 96 DPI
7. **Save export:** `Tumalo_ReelCover.png`

**API alternative (faster for bulk):**
- Use Canva API autofill if you have a brand template with placeholders
- Map CSV data (address, price, photo URL) to template
- Get result in 2 minutes

#### Phase 3: Build Video in CapCut (45–90 min)

**Workflow:**
1. **Open CapCut Desktop**
2. **Import footage:** Drag property_tour_video.mp4, hero_photo.jpg, lifestyle_photos to timeline
3. **Arrange clips** to match storyboard (5-7 scenes)
4. **Trim clips** to appropriate lengths (15 sec drone, 10 sec rooms, etc.)
5. **Add audio track:** Import trending music from Artlist
6. **Apply Beat Sync:**
   - Select all video clips
   - Right-click → **Beat Sync**
   - Review and adjust manually for storytelling flow
7. **Add text overlays:**
   - Price reveal (fade in, gold text, 1 sec)
   - Address/location (slide from bottom, 2 sec)
   - CTA (bounce entrance, "DM for details", 1 sec)
8. **Color grading (consistency):**
   - Import LUT file (warm cinematic theme)
   - Apply LUT to all clips (Adjust → Color → LUT)
   - Ensures cohesive visual look
9. **Speed ramp (optional, for high-end properties):**
   - Slow motion 0.5x on outdoor reveal
   - Normal speed 1x for feature rooms
10. **Add reel cover:** Insert Tumalo_ReelCover.png as opening frame (2 sec static)
11. **Export:** 1080×1920, 30 fps, H.264 MP4, 8000 kbps

**Output:** Tumalo_Reel_Final.mp4 (ready for Instagram)

#### Phase 4: Post & Track (5 min)

1. **Save video** to Downloads
2. **Copy reel caption** from Ryan Realty Social Media Content Package or use Magic Write prompt
3. **Post to Instagram:**
   - Upload MP4
   - Paste caption
   - Add DM CTA ("DM me 'strategy'")
   - Post
4. **Share to TikTok** if trending audio allows (cross-platform distribution)
5. **Monitor engagement** (DM replies, saves, shares)

### Workflow Timeline Summary

| Phase | Tool | Time | Output |
|-------|------|------|--------|
| Plan & Organize | Notes/Spreadsheet | 30 min | Storyboard, audio choice, footage organized |
| Canva Reel Cover | Canva | 30 min | 1080×1920 PNG reel cover |
| CapCut Build | CapCut Desktop | 60–90 min | 1080×1920 MP4 Reel (30 fps, 8 Mbps) |
| Post | Instagram | 5 min | Published Reel, monitoring active |
| **Total** | | **2–2.5 hours** | Ready-to-post, on-brand Reel |

**Optimization:** For weekly batches (2–3 Reels), build all Canva covers first (90 min total), then build all CapCut videos (3–4 hours total). Total: 4–5 hours for 3 high-quality Reels.

### When to Use Which Tool

**Canva:**
- Reel covers (static images)
- Story frames (7-frame sequences)
- Feed posts (1:1 square)
- Text-heavy designs (MLS disclosures, market tips)
- Anything brand-consistency critical (automatically applies brand kit)

**CapCut:**
- Property video tours (multi-clip narrative)
- Neighborhood montages (beat sync + trending audio)
- Speed ramping/cinematic effects
- Audio syncing and beat-matched cuts
- Color grading across multiple clips
- Anything with trending audio

**Never overlap:** Don't build video in Canva and try to refine in CapCut (quality loss, brand inconsistency). Build reel cover in Canva → export → import into CapCut as opening frame.

---

## Quick Reference: Specs & Settings

### Canva Export Specs

| Format | Resolution | DPI | Quality | Best For |
|--------|-----------|-----|---------|----------|
| PNG | User-specified or default | 96 | Lossless | Social media, transparency needed |
| JPG | User-specified or default | 96 | 1–100 quality scale | Social media, small file size |
| PDF | Default or user-specified | 300 (print) | High | Print, documents, archival |
| MP4 | Design dimensions | N/A | Standard | Social media video, CapCut import |
| GIF | Default | N/A | Standard | Animated stories, social media |

**For Ryan Realty social media:** Always export PNG or JPG at **1080×1920 (9:16 aspect ratio), 96 DPI** for Reels and Stories.

### CapCut Export Settings (for Instagram Reels)

| Setting | Value |
|---------|-------|
| Resolution | 1080 × 1920 |
| Aspect Ratio | 9:16 (portrait) |
| Frame Rate | 30 fps |
| Codec | H.264 |
| Format | MP4 |
| Bitrate | 8000 kbps (target) |
| Audio Codec | AAC |
| Audio Bitrate | 256 kbps |
| Audio Sample Rate | 48 kHz |
| Max File Size | ~256 MB |

### Ryan Realty Brand Specs (Apply Everywhere)

| Element | Specification |
|---------|---|
| Primary Color | Navy #001F3F |
| Accent Color | Gold #FFD700 |
| Display Font | Butcher (bold, headlines) |
| Body Font | AzoSans (copy, descriptions) |
| Accent Font | Amboqia (sparingly, captions) |
| Logo | Dark navy on transparent (web), White on dark backgrounds (MISSING — needs creation) |
| Phone Format | 541.213.6706 (always this format) |
| Reel Safe Zone (text) | 210px from top, 440px from bottom |

### Instagram Reel Performance Metrics to Track

1. **DM engagement** (most important) — count replies to "DM me 'strategy'" CTAs
2. **Saves** — indication of re-watchability, algorithm boost
3. **Shares** — external sharing, high value signal
4. **Play rate** — % of followers who watch
5. **Completion rate** — % who watch to end (optimize for <30 sec for better completion)

**Trending audio amplifies all metrics by 2.3x** — prioritize beat-synced, trending sound Reels.

---

## Immediate Action Items for Ryan Realty

1. **Create white logo version** — needed for dark backgrounds in CapCut/Canva overlays
2. **Build 2-3 brand reel cover templates** in Canva (property listing, neighborhood feature, market update)
3. **Curate trending audio library** — save 10-15 trending sounds from TikTok/Instagram (rights verified)
4. **Establish LUT standard** — download 1-2 cinematic LUTs (.cube format) for consistent color grading
5. **Import LUTs to CapCut** — load preferred LUTs into CapCut Desktop for quick application
6. **Test Canva → CapCut workflow** with Tumalo property (reel cover PNG → import into CapCut)
7. **Batch Tumalo story frames** — finalize 7-frame sequence in Canva, schedule for weekly release

---

## Sources & References

**Canva API & MCP:**
- [Canva Connect APIs - Documentation](https://www.canva.dev/docs/connect/)
- [Design Editing API](https://www.canva.dev/docs/apps/design-editing/)
- [Connect AI assistants to Canva](https://www.canva.com/help/mcp-agent-setup/)
- [Canva MCP Server Documentation](https://www.canva.dev/docs/connect/mcp-server/)

**Canva Brand & Design:**
- [Brand Kit - Canva Pro](https://www.canva.com/pro/brand-kit/)
- [Canva Templates - Real Estate](https://www.canva.com/templates/s/real-estate/)
- [Magic Write AI Copywriter](https://www.canva.com/magic-write/)
- [Magic Studio - AI Tools](https://www.canva.com/magic/)

**CapCut Features:**
- [Beat Sync Documentation](https://www.capcut.com/explore/beat-sync)
- [Speed Ramping Guide](https://www.capcut.com/tools/speed-ramp)
- [Color Grading with LUTs](https://www.capcut.com/resource/luts-for-color-grading)
- [Text Overlay & Animation](https://www.capcut.com/resource/how-to-make-videos-with-scrolling-text)

**Real Estate Social Media Best Practices:**
- [Create Engaging Real Estate Reels with Canva](https://myrealpage.com/blog/create-engaging-real-estate-reels-with-canva/)
- [Instagram Reel Dimensions & Specs (2026)](https://adcreate.com/blog/instagram-reel-dimensions-size-guide-2026)
- [Best Bitrate & Export Settings](https://www.stayabundant.com/blog/best-instagram-reels-export-settings)

**Music & Licensing:**
- [CapCut Music Licensing Guide](https://www.trademarkia.com/news/business/capcut-music-copyright-guide)
- [Royalty-Free Music Sources](https://www.capcut.com/resource/copyright-free-music)

---

**Document Version:** 1.0 | **Last Updated:** 2026-04-09 | **Audience:** Ryan Realty AI Assistant & Content Team
