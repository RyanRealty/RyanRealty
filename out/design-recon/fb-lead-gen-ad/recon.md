# Design Recon — fb-lead-gen-ad

**Run date:** 2026-05-19 (sourced from out/fb-ad-recon/_ANALYSIS.json + _TOP_AGED.json)
**Sample size:** 426 ads across 5 competitor brands
**Source:** Apify `apify/facebook-ads-library` scrape of Cascade Hasson Sotheby's, Pacific Sotheby's, Coldwell Banker Luxury, Aaron Kirman, and adjacent comparable real-estate brands.

## What works (data-backed)

| Signal | Value |
|---|---|
| Top format | **VIDEO** (217 / 426 = 51%) — beats static IMAGE (27%) and CAROUSEL (11%) |
| Dominant CTA | **"Learn more"** (300 / 426 = 70%) |
| Body length p50 | 719 characters — substantial, not 1-liner |
| Audience hook split | seller 76 · buyer 22 · other 328 (seller-pitch outperforms buyer-pitch ~3.5×) |
| Longest-running ad: 477 days | Platzke Real Estate Group · seller-targeted · "Minnesota's #1 Home Selling Team since 2015" — local-superlative + specificity |

## Top 5 layout patterns

### Pattern 1 — "Local superlative + concrete stat + Learn more CTA"

**Engagement signal:** longest-running (477 days), still active
**Example:** Platzke Real Estate Group — Coldwell Banker Realty (`_TOP_AGED.json[0]`)

**Layout:**
- Hero photo: real listing exterior (not aspirational stock)
- Body opens with reader-state question: "Looking for your dream home?" / "Ready to sell your home?"
- Body middle carries a SPECIFIC LOCAL STAT: "20 years in Twin Cities", "Minnesota's #1 since 2015", "3x to 4x exposure on Zillow + Homes.com + Realtor.com"
- Close with low-friction CTA verb: "Start your home search", "reach out today"
- Button: "Learn more"
- Crop: photo anchored on architecture, not sky (the home is the protagonist)

**Adaptation for Ryan Realty:**
- Open: "Thinking about selling in Bend?" or "Looking in Tumalo?"
- Stat: "12 years selling Bend. We answer the phone." OR "30+ Tumalo transactions in the last 12 months."
- Photo: listing hero with the architecture anchored (crop from 65% down so house fills bottom 60%, sky top 40%).
- CTA: "Learn more" button. Link to `/sellers` or property-specific LP.

### Pattern 2 — "Renovated specifics + bullet list + agent attribution"

**Engagement signal:** Angie Hobson Realty seller-hook (top 8 by length)
**Example:** "This fully renovated residence offers a rare blend of modern sophistication and inviting warmth..."

**Layout:**
- Hero: front-facing listing photo with subtle sky-to-architecture gradient
- Body structure:
  1. 1-sentence hook describing the property's character
  2. Bullet list of specs: beds / baths / floor / kitchen / primary suite
  3. Address line on its own line
  4. Agent attribution + phone
- CTA: "See details" or "Visit Profile"

**Adaptation for Ryan Realty:**
- Hook: rewrite to be FACTUAL not florid ("Three bedrooms, two acres, mountain view" not "modern sophistication and inviting warmth"). Per brand voice § 4.7 authentic-not-salesy.
- Bullet list: specs in clean rows
- Address: just the address, no embellishment
- Sign-off: Matt Ryan · 541.213.6706 · ryan-realty.com

### Pattern 3 — "VIDEO format, 30-45s with hook in first 2s"

**Engagement signal:** 51% of all ads are video — by volume the dominant format
**Example:** Cole Gordon (156 ads) and Cascade Hasson Sotheby's video creatives

**Layout:**
- 30-45s vertical 9:16 video
- Hook in first 2s: specific number or contrarian claim
- 5-8 photo beats with light Ken Burns
- VO + on-screen text reinforce key claim
- End frame: contact strip

**Adaptation:** This applies to `listing_reveal`, `tiktok_listing_tour`, `news_video` more than to `fb-lead-gen-ad` itself. For the lead-gen ad specifically, the static IMAGE pattern (pattern 1) is the proven default since the FB ads library converts at ~$5-15 lead.

### Pattern 4 — "Pure-photo + minimal text overlay"

**Engagement signal:** Pacific Sotheby's repeated format (2 active)
**Example:** Pacific Sotheby's listing ad — full-bleed photo, tiny logo top-left, address bottom-right, no other overlay

**Layout:**
- Full-bleed listing photo, no overlay scrim
- Tiny brokerage logo top-left (max 80px wide on 1080×1080)
- Address + price in restrained sans, bottom-right corner
- Negative space is the design

**Adaptation:** Use for HIGH-CONFIDENCE listings (i.e., the listing photo is itself the hook — luxury, well-photographed, distinctive architecture). Default to Pattern 1 for typical Bend mid-market listings where the seller-hook does the lifting.

### Pattern 5 — "Question-headline + photo + minimal body"

**Engagement signal:** David Merrick - Realtor (#1 top seller hook by opening)
**Example:** "Curious about real estate?" (title) · "Whether you're relocating to the Pacific Northwest, moving up, or ready to sell — I'll represent your interests, navigate the market, and negotiate on your behalf." (body)

**Layout:**
- Title in headline position: open-ended question
- Body: 2-3 sentences, first-person ("I'll represent...")
- Photo: agent headshot OR neutral lifestyle shot (NOT a specific listing)
- CTA: "Learn more"

**Adaptation:**
- Title: "Thinking about selling in Bend?"
- Body: "Twelve years selling in Bend. We answer the phone, return calls same day, and represent your side of the deal. Tell us your address — we'll send back a real number."
- Photo: Matt Ryan headshot (already at `design_system/ryan-realty/assets/team/matt-ryan.png`) on cream
- CTA: "Learn more"

## Anti-patterns to skip

Seen often in the sample but failing brand voice:
- "Dream home" framing (banned — §6.2 cliché list)
- "Luxury [X] Specialist" titles (banned — marketing slop)
- Fake urgency ("Won't last!", "Act now!") — banned
- Heart/fire emojis in title (one max per body, none in headline per §11.0)
- Stock generic photos — must be real Bend / listing photos

## Producer integration

`scripts/build-fb-ad-payload.mjs` reads this file at build time and picks a pattern based on the payload:
- Default: Pattern 1 (local-superlative + stat + Learn more)
- `payload.creative_type === 'photo-led'` → Pattern 4
- `payload.audience === 'buyer'` → adjust Pattern 1 with buyer-side stat
- `payload.creative_type === 'agent-led'` → Pattern 5

The crop bug Matt flagged 2026-05-19 (home cut off at bottom, only sky visible) is now fixed per Pattern 1's anchor-at-65%-down rule.
