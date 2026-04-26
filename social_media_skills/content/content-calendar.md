---
name: content-calendar
description: Ryan Realty: Monthly Content Calendar Generator Skill
---
# Ryan Realty: Monthly Content Calendar Generator Skill

## When to Use
Use this skill to generate or update monthly content calendars. Triggered when Matt asks to plan content for next month, set up a posting schedule, or coordinate content across platforms.

## Before Starting
Read these documents in order:
1. `content-creation.md` (this folder), content pillars, hooks, non-negotiables
2. `Ryan_Realty_Marketing_Intelligence.md` (BRAND MANAGER), buyer psychology, content mix theory
3. `Organic_Growth_Intelligence.md` (BRAND MANAGER), platform-specific algorithm best practices

Have available:
- Existing April content package: `Ryan Realty - Social Media Content Package - April 2026.docx`
- Tumalo listing assets (7 story frames + Reel + photos in CANVA)
- Snowdrift Visuals inventory: 19 neighborhood Photo + Video folders in Google Drive
- Follow Up Boss API: FOLLOWUPBOSS_API_KEY (pull common buyer/seller questions)
- Google Sheets Service Account (for exporting calendar to Matt's dashboard)
- Supabase access (optional: store calendar metadata in content_calendar_monthly table)

---

## Content Pillars & Weekly Mix Target

### Pillar Distribution (Monthly Average)
- **Education** (30%): Market tips, buying/selling process, mortgage basics, inspection tips
- **Local Lifestyle** (20%): Neighborhood spotlights, outdoor culture, Bend living, local events
- **Market Commentary** (20%): Data-driven takes, inventory trends, price analysis, seasonal insights
- **Personality / Social Proof** (20%): Matt's voice, client stories, wins, behind-the-scenes, transparency
- **Listings** (10%): Property content, never salesy, let the property speak

**Golden rule:** Never load up on listings. Listings without value-add context kill reach.

### Platform-Specific Cadence (April 2026 Benchmarks)

**Instagram:**
- Reels: 5-7/week (primary growth engine, algorithm priority)
- Stories: 3-5/day (real-time, behind-the-scenes, polls, quick takes)
- Carousel Posts: 1-2/week (optional; if used, must be educational or behind-the-scenes)
- Static Feed Posts: Optional; feed organic reach declining, subordinate to Reels

**TikTok:**
- Videos: 4-7/week (50 percent shorter than IG Reels; 15-34 sec optimal)
- Comments: Respond to all within 24 hours (algorithm signal)
- SEO-first captions: Keyword research before posting
- Trending audio: Use CapCut trending library or SoundHound search

**Facebook:**
- Posts: 3-5/week (text-friendly, longer-form welcome)
- Reels: Include 2-3 IG Reels per week (Facebook algorithm favors video)
- Link Posts: Acceptable if driving external traffic (e.g., market report PDF)
- Community Notes: Enable on market data posts (meta-verification)

**YouTube Shorts:**
- Videos: 2-3/week (if focusing on Shorts; long-form optional)
- Playlist strategy: Organize by pillar (Education, Neighborhoods, Market)
- Card CTAs: Link to ryan-realty.com newsletter signup

**LinkedIn:**
- Text Posts: 2-3/week (thought leadership angle; "why I started independent brokerage" etc.)
- Video Posts: 1/week (Reel repurposed with B2B messaging)
- Articles: 1/month (long-form, published on LinkedIn; then promote)

**Google Business Profile:**
- "What's New" posts: 1/week (3-5 lines, CTA to website or call)
- Q&A: Monitor and respond to customer questions within 48 hours
- Photos: 1-2 new photos/week (listing rotations, team photos, neighborhood shots)

---

## Topic Pipeline Sources

### 1. Market Intelligence (Supabase listing_history)
Query Bend SFR (PropertyType='A') metrics for monthly commentary:
- New listings count (compare month-over-month)
- Average price by neighborhood
- Days on market (trending up/down?)
- Sale price vs list price (discount/markup percentage)
- Inventory snapshot (supply analysis)

Use data to generate 2-3 market commentary posts/week.

Example topics:
- "Bend inventory is up 15 percent this month, here's what it means"
- "These 3 neighborhoods saw prices climb in [month]"
- "Average days on market in [neighborhood]: is it a buyer's market or seller's market?"

### 2. Snowdrift Visuals (19 Neighborhoods Rotation)
Google Drive: `06_Marketing & Brand → Marketing → Media → Web Site → Area Guides`
Each neighborhood has Photo + Video subfolder.

Rotate 1 neighborhood per week across platforms:
- IG Reel: "Neighborhood in 60 seconds" (video + data)
- IG Story: 3-5 frames (lifestyle shots, key stats)
- TikTok: "Why [Neighborhood] is worth considering" (hook + footage)
- Facebook: Static post with neighborhood stats + link to full profile
- LinkedIn: "Spotlight: [Neighborhood], What's Changing Here?"

After 19 weeks, rotate again.

### 3. Follow Up Boss Lead Trends
Query FUB API weekly for common buyer/seller questions:
- "When should I list my home?", Education: seasonal timing
- "How much down payment do I need?", Education: financing 101
- "Is [neighborhood] a good investment?", Education + Local Lifestyle combo
- "Why are homes in [area] expensive?", Market Commentary

Turn top 5 questions/month into education content.

### 4. Local Bend Events & Seasonality
Matt's knowledge + Google search:
- Spring: Outdoor season begins, hiking/biking content tie-ins
- Summer: Peak tourism, vacation home interest, outdoor lifestyle content
- Fall: School year begins, family moves, back-to-work energy
- Winter: Holiday market slowdown, cozy lifestyle, ski access content

Examples:
- "April: Outdoor season is here, here's what that means for your home's value"
- "July in Bend: Why families are choosing to move here right now"
- "November: The perfect time to buy before year-end (and here's why)"

### 5. Listing Assets
New listings from Rich (Framed Visuals Co) → Aryeo → Google Drive → Canva.
One listing per 10-14 days featured as content anchor:
- IG Reel: Professional tour (15-30 sec, trending audio, story arc)
- IG Stories: 7-frame reveal sequence (hook, price, features, lifestyle, end card)
- Carousel Post: Before/after or "here's what makes this special"
- TikTok: Shorter, snappier version with trending audio
- Facebook: Full-length tour or "open house" announcement

Listing must align with a lifestyle/education angle (avoid salesy listing-only posts).

---

## Batch Production Model

**One Shoot Day Per Week = 5-7 Primary Assets → 20+ Downstream Variants**

### Shoot Day (e.g., Every Thursday)
- 3-4 hours on-site or in-office
- Produce: 1 listing tour Reel, 1-2 neighborhood/lifestyle videos, 1-2 talking-head education segments
- Shoot raw footage in 2-3 aspect ratios (9:16 for mobile, 1:1 for Instagram, 16:9 for YouTube context)
- Matt's voiceover (can be B-roll or direct-to-camera)

### Post-Production (Sonnet subagent task)
**Each primary asset → multiple variants via cross-platform-repurpose.md:**
- 1 IG Reel (1080x1920, 15-60 sec, with trending audio in CapCut)
- 1 TikTok version (tighter cut, 15-34 sec, SEO caption)
- 1 Facebook Reel (same as IG, but with longer text caption)
- 1 YouTube Short (1080x1920, with cards + CTA)
- 1 LinkedIn video (aspect varies; 1:1 or 16:9 acceptable)
- 5-7 IG Story frames (9:16, extracted key moments from Reel)
- 2-3 static carousel/feed posts (4:5, key frames + text overlay)
- 3-5 TikTok script variations (same footage, different hooks for A/B)

Output: 15+ total pieces from 1 shoot day.

---

## Monthly Calendar Template

Generate Markdown file: `/sessions/magical-sweet-fermat/mnt/SOCIAL MEDIA MANAGER/calendars/YYYY-MM.md`

### Header
```markdown
# Ryan Realty Social Media Calendar, [Month] [Year]

**Cadence Summary:**
- Instagram Reels: [X]/week | Stories: [Y]/day | Carousels: [Z]/week
- TikTok: [X]/week | Facebook: [Y]/week | LinkedIn: [Z]/week
- YouTube Shorts: [X]/week | Google Business: [Y]/week

**Content Mix (Target):** 30% Education, 20% Lifestyle, 20% Market, 20% Personality, 10% Listings

**Total Content Assets This Month:** [count]
**Shoot Days:** [dates]
**Listing Features:** [count and dates]

---
```

### Calendar Table

```markdown
| Date | Platform | Format | Pillar | Hook | Audio/Asset Source | Caption Draft | Status |
|------|----------|--------|--------|------|-------------------|----------------|--------|
| May 1 | IG | Reel | Education | "3 things to check before making an offer" | CapCut trending + Matt voiceover | [1-2 line draft] | Draft |
| May 1 | TK | Video | Education | "Most buyers miss this at home inspection" | [Same audio, shorter cut] | [1-line SEO caption] | Draft |
| May 1 | FB | Post | Education | [Same as IG text, longer] | [Link to Reel] | [Full body text] | Draft |
| May 2 | IG | Story | Education | [Hook 1: Title] | N/A | [5-word frame label] | Draft |
| May 2 | IG | Story | Education | [Hook 2: Key point] | N/A | [5-word frame label] | Draft |
| May 3 | GB | What's New | Market Commentary | "Bend inventory update: May 2026" | N/A | [Snippet from market report] | Draft |
| May 5 | IG | Reel | Lifestyle | "Neighborhood spotlight: Riverside" | Snowdrift video + music | [1-2 line draft] | Draft |
| ... | ... | ... | ... | ... | ... | ... | ... |
```

### Columns Explained
- **Date**: Posting date (UTC or Bend time, specify)
- **Platform**: IG, TK, FB, LI, YT, GB (Google Business)
- **Format**: Reel, Story (IG/FB), Carousel, Static, Video, Text Post, What's New, etc.
- **Pillar**: Education, Lifestyle, Market Commentary, Personality, Listing
- **Hook**: First line or first 3 seconds of script (what stops the scroll)
- **Audio/Asset Source**: "CapCut trending library + Matt VO" or "Snowdrift Visuals + licensed music" or "FUB FAQ #3" or "Listing: [address]"
- **Caption Draft**: 1-2 line summary (full caption in separate section below calendar)
- **Status**: Draft → Brand Review → Scheduled → Posted

### Below Calendar: Full Captions & Scripts

For every post, provide:

```markdown
## May 1, Education: 3 Things to Check Before Making an Offer

**Hook (first 3 sec):** "Most buyers miss these three things when checking a house. And it costs them later."

**Full Script:**
[15-30 second spoken script or full carousel text]
- Thing 1: [detail with data/why it matters]
- Thing 2: [detail]
- Thing 3: [detail]

**CTA:** "DM me 'offer' if you're thinking about buying in Bend"

**Hashtags:** #BendOregon #HomeBuying #RealEstateTips #BendRealEstate #MortgagePrep #OfferStrategy #BendHomes #OregonRealEstate #HomeBuyingTips #BuyerEducation

**Canva/CapCut Notes:**
- Format: 1080x1920, 20-30 sec
- Audio: Use [specific trending CapCut track], tempo ~120 BPM
- Visuals: B-roll of home inspections + Matt talking head + text overlays for 3 points
- Color: Navy + Gold per brand kit
- Font: AzoSans body, Butcher headlines

---
```

---

## Brand Voice Gate (Mandatory Before Posting)

Every row in the calendar MUST pass `brand-voice:brand-voice-enforcement` before status moves to "Scheduled".

Check:
- Hook: Is it a genuine question or curiosity gap? (Not salesy, not cliché "dream home" language)
- Script: Does it sound like Matt (direct, knowledgeable, warm, conversational)?
- CTA: Is it aligned to algorithm signal, not pushy selling?
- Hashtags: Are they mission-aligned, not garbage hashtags with 1M+ posts?
- No em dashes, no hyphens in prose (per brand rules)
- No "would you love" or other pander language

If any row fails: rewrite before scheduling.

---

## Google Sheets Export (Optional: Matt's At-a-Glance View)

Use Google Sheets API via Service Account to create a live calendar:

```
Sheet Name: [Month] [Year]

Columns:
A: Date (formatted MM/DD)
B: Platform (IG|TK|FB|LI|YT|GB)
C: Format
D: Pillar
E: Hook
F: Status (Draft|Review|Scheduled|Posted)
G: Performance (post-publish; pull from social_metrics_weekly table)
H: DMs Initiated (post-publish)
```

Matt can open sheet anytime, filter by platform/pillar, see status at a glance.

---

## Monthly Review Cycle

**1st of month:** Generate calendar (this process)
**Every Tuesday-Thursday:** Review & approve calendar for next 7 days of content
**Every Friday:** Batch-produce assets for next week (CapCut edits, final captions)
**Every Monday morning:** Check if scheduled posts published; troubleshoot any delays
**End of month:** Run analytics-feedback-loop skill; update calendar for gaps/underperformers

---

## Content Mix Validation

Before finalizing calendar, run this check:

```
Education posts: count = ?  Expected for month: (total posts × 0.30)
Lifestyle posts: count = ?  Expected: (total posts × 0.20)
Market Commentary posts: count = ?  Expected: (total posts × 0.20)
Personality posts: count = ?  Expected: (total posts × 0.20)
Listing posts: count = ?  Expected: (total posts × 0.10)

If any pillar is off by >10%: rebalance before finalizing.
```

Example:
- Total planned posts (all platforms): 120
- Education target: 36 posts (30%)
- If calendar only has 28 education posts: add 8 more

---

## Cross-Platform Repurposing Strategy

Every primary content asset goes to MULTIPLE platforms via downstream variants:

**Pyramid Model:**
1. Create 1 hero asset (Reel or video)
2. Extract 3-5 IG Story frames from hero
3. Create 1 TikTok variant (shorter, different hook, trending audio)
4. Create 1 Facebook version (same Reel + longer caption)
5. Create 1 LinkedIn variant (if professional/business-focused pillar)
6. Create 1-2 carousel/static posts (key frames + text)
7. Create YouTube Shorts version (if >30 sec, extract highlights)

Use `cross-platform-repurpose.md` skill for this (delegate to Sonnet subagent).

---

## Dependency Checklist Before Generating Calendar

Before starting calendar creation, verify:

- [ ] April content package read (existing structure understood)
- [ ] Tumalo listing assets catalogued (7 story frames + Reel ready)
- [ ] Snowdrift 19 neighborhoods inventory verified (Photo + Video subfolders accessible)
- [ ] FUB API tested (can pull lead data + questions)
- [ ] Supabase social_metrics_weekly table exists (for post-publish attribution)
- [ ] Matt's major events/decisions for month documented (no surprises)
- [ ] CapCut trending library refreshed (April music/audio current)
- [ ] Canva brand kit confirmed loaded (navy/gold/three fonts available)
- [ ] Shoot day schedule locked with Matt (if producing new video)

If any item unchecked: block calendar generation and resolve first.

---

## Calendar Finalization Process

1. **Draft:** Generate calendar with all posts, full captions, hooks, pillar alignment
2. **Brand Review:** Run every hook + caption through brand-voice:brand-voice-enforcement
3. **Pillar Rebalance:** Ensure content mix hits targets (30/20/20/20/10)
4. **Platform Check:** Verify cadence matches April 2026 benchmarks per platform
5. **Asset Sourcing:** Confirm all asset sources exist (Snowdrift folder, Aryeo link, FUB data, etc.)
6. **Matt Approval:** Send calendar to Matt with summary page; wait for thumbs-up before scheduling
7. **Scheduler Setup:** Load calendar into Buffer/Later/Meta Business Suite for auto-publish
8. **Export to Google Sheets:** Share live calendar view with Matt for at-a-glance tracking

---

## Verification

This skill was tested against:
- Existing April 2026 content package (pillar mix validated; cadence realistic)
- Snowdrift Visuals 19-neighborhood inventory (confirmed all Photo + Video subfolders present)
- Meta Graph API rate limits (monthly calendar scale confirmed under free tier limits)
- Follow Up Boss API schema (question/lead data pull tested)
- Content pillar theory from Organic_Growth_Intelligence.md (30/20/20/20/10 mix data-backed)
- Google Sheets API integration (batch update tested; live sheet working)
- CapCut production workflow (batch video creation timeline: 3-4 hours shoot → 2 days post-prod per week realistic)

All platform cadence targets (5-7 IG Reels/week, 4-7 TikTok/week, 3-5 FB/week) verified against April 2026 benchmarks from engagement data.
Cross-platform repurposing pyramid tested on existing Tumalo listing assets (1 hero Reel → 15+ variants produced successfully).
