# AI Video Tools & Real Estate Content Strategy Research
**Date:** April 14, 2026 | **For:** Matt Ryan, Ryan Realty | **Research Scope:** Current AI video landscape, real estate creators, prompt engineering, fair housing compliance

---

## CRITICAL: Sora Shutdown ⚠️
**OpenAI Sora is officially discontinuing** on April 26, 2026 (web/app) and September 24, 2026 (API). This eliminates Sora from consideration. Focus shifts to: **Veo 3.1 (Google)**, **Kling AI**, **Runway Gen-4**, **Pika**, and specialized tools (HeyGen/Synthesia for avatars, Remotion for programmatic video).

---

## 1. THE CURRENT AI VIDEO TOOL LANDSCAPE (April 2026)

### Veo 3.1 (Google) — BEST OVERALL FOR REAL ESTATE
**Status:** Production-ready, available via Vertex AI, Google Cloud, veo3ai.io, and third-party APIs.
**Unique Strengths:**
- Up to 8-second clips at 1080p (4K available) with 60fps
- **Native synchronized audio** (dialogue, ambient sound, SFX) in single pass — no separate voiceover tool needed
- Superior prompt adherence and physics accuracy
- Free tier available for testing

**Pricing:**
- Vertex AI direct: $0.10–0.50/second depending on model variant and whether audio is included
- Third-party providers (OpenRouter, fal.ai): $0.40/second average
- New Google AI Pro ($19.99/month): access via Gemini + Flow; Google AI Ultra ($249.99/month): full model access
- $300 free credits for new Vertex AI developers (≈600–857 seconds of video)

**Real Estate Fit:** Excellent for cinematic property tours, market commentary with data overlays, neighborhood spotlights. The native audio is a major advantage for scripted market updates.

**Limitations:** 8-second maximum clip length (less than Kling for full walkthroughs)

**Refs:** [Veo 3 API Pricing & Features](https://piapi.ai/blogs/veo-3-1-api-pricing-prompting-guide-2026) | [Google Veo 3.1 Pricing](https://www.veo3ai.io/blog/veo-3-1-new-features-guide)

---

### Kling AI 3.0 — BEST FOR LONG-FORM & HUMAN REALISM
**Status:** Production-ready, Kuaishou's platform (Chinese origin, globally accessible).
**Unique Strengths:**
- Up to 3 minutes per generation (vs. Veo's 8 sec, Sora's 20 sec) — full property walkthroughs in one shot
- Photorealistic humans with strong character consistency and subtle micro-expressions
- Physics simulation is highly accurate; hand-anchoring technique solves hand distortion
- Fastest rendering in its class for 3-minute clips

**Pricing (as of April 2026):**
- Free plan: 0 monthly credits (expired/deprecated)
- Standard: $6.99/month — ~120 credits per month
- Pro: $25.99/month
- Premier: $64.99/month
- Ultra: $180/month (increased 41% since August 2025)
- **Cost per video:** Standard mode 5-sec ≈$0.11; Professional mode ≈$0.39–0.78; 1-min video ≈$1.27 (Standard mode)
- **Warning:** Professional mode + native audio costs 3–5x more; failed generations consume credits with no refund

**Real Estate Fit:** Ideal for talking-head avatar videos (broker/agent introductions, market updates), full property narratives, before-after renovation storytelling.

**Limitations:** Professional mode gets pricey; learning curve is steeper than Pika.

**Refs:** [Kling AI Pricing 2026](https://aitoolanalysis.com/kling-ai-pricing/) | [Kling AI Complete Guide](https://aitoolanalysis.com/kling-ai-complete-guide/)

---

### Runway Gen-4 — BEST FOR PROFESSIONALS & MULTI-CLIP CONSISTENCY
**Status:** Production-ready; enterprise-grade.
**Unique Strengths:**
- Multi-clip consistency tools maintain visual style across dozens of scenes
- Advanced motion controls and editing integration
- Professional pipeline for agencies managing multiple listings
- Granular control over camera, motion, and composition

**Pricing:** $15–20/month minimum; professional plans $50+

**Real Estate Fit:** Best for high-volume agencies with standardized editing workflows. Overkill for individual brokers/solo agents but unmatched for consistency across portfolios.

**Refs:** [Runway Gen-4 Features](https://www.eweek.com/news/sora-alternatives-ai-video-tools-2026/)

---

### Pika AI — BUDGET-FRIENDLY, CREATIVE
**Status:** Production-ready.
**Unique Strengths:**
- Affordable entry ($8/month basic tier)
- Fast iteration and creative exploration
- Good for shorter clips (15–60 sec) optimized for social

**Pricing:**
- Free: 80 credits/month (watermarked)
- Basic: $8/month (700 credits)
- Pro: $28–35/month (2,300 credits; removes watermark)
- Fancy: $76/month (6,000 credits; fastest speeds)

**Real Estate Fit:** Good for rapid iteration on social content. Not ideal for cinematic tours or long-form narratives.

**Refs:** [Pika AI Pricing 2026](https://pika.art/pricing)

---

### HeyGen — AVATAR VIDEO AT SCALE
**Status:** Production-ready; avatar platform.
**Unique Strengths:**
- 150+ diverse stock avatars or custom avatar creation
- 140+ languages and accents
- MCP integration with Claude (no API key management; OAuth only)
- Programmatic video generation via API ($5+ to start)
- Deep Remotion integration for complex compositions

**Real Estate Fit:** Talking-head property overviews, agent introductions, market commentary. Perfect for "Matt Ryan market update" series. **Custom avatar creation is missing on your account — blocking scale.**

**Cost:** API-first pricing starting at $5; Skills-based usage more affordable than direct API.

**Note:** Matt's Synthesia avatar is also not yet created — both Synthesia and HeyGen custom avatars remain to-do items.

**Refs:** [HeyGen Developers](https://developers.heygen.com) | [HeyGen + Claude Integration](https://mcpmarket.com/tools/skills/heygen-ai-avatars-1)

---

### Synthesia — AVATAR VIDEO (LEGACY FOR YOUR SETUP)
**Status:** Mature; industry standard for avatar video.
**Unique Strengths:**
- Most widely trusted avatar platform for professional business video
- 150+ stock avatars; custom avatar creation available
- Direct real estate use case documentation
- Multilingual support

**Pricing:** Scales with custom avatar ($1,000+ for custom creation; standard plans $60–150/month)

**Real Estate Fit:** Agent introduction videos, property narrative voiceovers, multilingual market updates.

**Status on Your Account:** Custom avatar has NOT been created. This is blocking AI avatar video at scale.

**Refs:** [Synthesia Real Estate Guide](https://www.synthesia.io/post/real-estate-marketing-videos)

---

### Arcads AI — UGC TALKING HEAD (EMERGING)
**Status:** Production-ready; specialized for UGC-style avatar ads.
**Unique Strengths:**
- 1,000+ AI actors with organic micro-gestures, head tilts, imperfect timing (feels like real UGC)
- Superior lip-sync and emotional realism vs. traditional avatars
- 30+ language translation
- 2-minute turnaround from script to video

**Pricing:** Not explicitly stated in search results; appears to be subscription-based comparable to HeyGen.

**Real Estate Fit:** Authentic-feeling agent testimonials, client success stories, "day in the life" realtor content. Perfect for TikTok/Instagram authenticity cues.

**Limitation:** No built-in editing for captions, overlays, music (requires external tools).

**Refs:** [Arcads Real Estate Solutions](https://www.arcads.ai/industries/real-estate-agencies)

---

### Remotion + Claude Code — PROGRAMMATIC VIDEO (HIGHLY TECHNICAL)
**Status:** Production-ready; agentic workflow layer.
**Unique Strengths:**
- React-based video composition: write TypeScript, get MP4 video
- Zero cloud video service fees (runs locally)
- Claude Code generates full video components from prompts
- Integrated with ElevenLabs for voiceover and natural audio

**Real Estate Fit:** Automated market updates with live MLS data visualization, animated listing explainers, data-driven neighborhood spotlights.

**Economics:** One-time Claude Code subscription (Opus) covers unlimited video generation. No per-video cost.

**Complexity:** Requires technical setup; not a "point-and-click" tool. Best for agentic workflows (Claude → script → Remotion component → render → post).

**Example Pipeline:**
1. Claude reads MLS data from Supabase (Matt's 587k listings + 3.8M history rows)
2. Claude generates video narrative + animated scene specifications
3. Claude writes Remotion React component
4. Local CLI renders to MP4
5. Opus orchestrator handles post-production

**Refs:** [Remotion + Claude Code Integration](https://www.remotion.dev/docs/ai/claude-code) | [Claude Code Changed Video Production](https://www.sabrina.dev/p/claude-just-changed-content-creation-remotion-video)

---

## 2. REAL ESTATE CREATORS WINNING WITH AI VIDEO (April 2026)

### Documented Success Patterns

**Glennda Baker (Atlanta)**
- Top agent on TikTok with massive following
- Formula: Quick property highlights + educational market content
- Engagement: Consistent organic growth via authenticity + expertise positioning

**Steevie** (Location unspecified)
- **80% of her business comes from social media**
- Content strategy: Entertaining, informative, and fun short-form
- Algorithm advantage: TikTok For You Page surface brand-new creators with 0 followers if content is high-quality

**Kina DeSantis**
- Built brokerage from zero to **$89M sales volume in 4 years** using TikTok + Instagram
- Strategy: Educational information source (down payments, market conditions, home-buying FAQs)
- Content mix: Hook-Value-CTA formula consistently applied

**RealStateVideo (Platform)**
- AI-powered video generator specifically for real estate
- One new agent closed **first $800K listing from a single TikTok video**
- Formula: AI writes script, generates voiceover, adds captions in 60 seconds

### Common Winning Patterns
1. **Authenticity first** — Overly polished/promotional content underperforms
2. **Education positions you as expert** — Market tips, buyer education, market data explainers
3. **Hook in first 3 seconds** — Strong visual or question; viewers decide to stay/leave immediately
4. **DM call-to-action on every post** — "DM me 'strategy'" outperforms "click link in bio"
5. **Consistency > virality** — Takes ~50 posts before first viral hit; frequency matters more than perfection
6. **Neighborhood spotlights** — Underexploited goldmine (Matt has 19 Snowdrift neighborhoods ready; could fuel 5+ months of weekly content)

**Refs:** [Real Estate AI Video Platform](https://www.realstatevideo.com/) | [Real Estate TikTok Strategy](https://www.cubi.casa/tiktok-accounts-for-real-estate-marketing/) | [Kina DeSantis Case Study](https://www.estatepromptai.com/blog/tiktok-for-realtors)

---

## 3. PROMPT ENGINEERING FOR AI VIDEO (The Core Skill)

### Universal Prompt Anatomy (Works across Veo, Kling, Runway, Pika)

Every effective AI video prompt contains 5–6 elements:

```
[CAMERA/SHOT] [SUBJECT] [ACTION] [ENVIRONMENT] [LIGHTING/MOOD] [AUDIO]
```

**Example for real estate:**
"Smooth tracking shot through modern kitchen. Woman in professional attire gestures toward granite island and stainless steel appliances. Golden hour sunlight streams through floor-to-ceiling windows. Subtle footsteps on hardwood, light ambient music (Spotify 'chill real estate' vibe)."

### Element-by-Element Breakdown

#### 1. CAMERA/SHOT TYPE (Highest Impact)
Use cinematography terminology:
- **Tracking/dolly:** Smooth camera movement following a path
- **Pan/tilt:** Camera rotates left-right or up-down
- **Orbit:** Camera circles around subject
- **Static:** No camera movement (use for interviews, straight-to-camera)
- **Handheld:** Subtle shake for documentary feel
- **Zoom/push-in:** Camera approaches subject
- **Crane shot:** High-to-low or low-to-high arc

**Real estate best:** Tracking/dolly through rooms creates immersion; orbiting wide shot for exterior façade; static for close-up kitchen counter detail.

#### 2. SUBJECT (BE SPECIFIC)
Don't say: "a house"
Say: "Mediterranean villa with terracotta tile roof, arched doorways, and wrought-iron railings"

For avatars:
"woman in her 40s, professional blazer, warm expression, nodding thoughtfully"

#### 3. ACTION/MOTION (DESCRIBE PHYSICS, NOT JUST THE ACT)
Bad: "person walks"
Good: "person walks into frame from left, each footstep deliberate on hardwood, hand trailing along banister, slight pause at the top of the stairs"

**Real estate:** Instead of "camera moves through house," specify: "camera glides slowly from living room toward kitchen, revealing the open-concept layout, pauses 2 seconds at island to highlight waterfall edge."

#### 4. ENVIRONMENT (3–5 KEY DETAILS MAX)
- What room/location?
- Furniture, fixtures, views?
- Outdoor? Urban/rural setting?

Example: "Modern loft with exposed brick, floor-to-ceiling windows overlooking downtown skyline, minimalist white furniture, hardwood floors."

#### 5. LIGHTING & ATMOSPHERE (SINGLE BIGGEST VISUAL LEVER)
This is where most prompts fail. Specificity here transforms output quality.

**Good lighting descriptions:**
- "Golden hour (warm orange-amber light) streaming through south-facing windows, creating long shadows across hardwood"
- "Overcast diffused daylight, soft and even, no harsh shadows"
- "Interior ambient with warm 2700K accent lights on island, cool pendant lighting above"
- "Blue hour dusk, lights inside glow warm against deep blue exterior"
- "Harsh noon sun creating strong contrast, shadows on stone walls"
- "Neon-lit commercial street, wet pavement reflecting storefront lights"

**Real estate pro tip:** Test lighting variations first; it's the highest-leverage edit.

#### 6. AUDIO (OPTIONAL BUT POWERFUL)
Veo 3 includes native audio; others may need separate voiceover tool.

Good audio prompts:
- "soft footsteps on hardwood, subtle ambient piano, distant city sounds"
- "agent voiceover: 'This kitchen is the heart of the home' (warm, confident tone), subtle jazz background"
- "sounds of waves, seagulls, gentle breeze (no voiceover)"

### Real Estate Prompt Examples

**Listing Tour (Veo 3):**
```
Smooth tracking shot through modern farmhouse kitchen. Shot begins at island, camera glides toward bank of windows overlooking manicured garden. Morning golden hour light streams across white marble counters. Subtle shuffling footsteps, light piano music fades in. Shot duration: 6 seconds. Photorealistic, 1080p, 30fps.
```

**Market Commentary (Kling):**
```
Professional woman, early 40s, dark blazer, standing in modern home office. She turns to camera with warm smile. "Bend's median price is up 8% year-over-year. Here's what that means for sellers." Calm, confident voiceover. Camera static on face, soft warm interior lighting (desk lamp + windows). Duration: 30 seconds. Photorealistic, natural skin tones, subtle micro-expressions.
```

**Neighborhood Spotlight (Kling or Veo):**
```
Quick montage of Tumalo neighborhood: (1) aerial orbit of contemporary home with mountain views, sunset lighting, 3 sec; (2) wide shot of neighborhood park with families, golden hour, 2 sec; (3) close-up of local coffee shop storefront, warm interior lighting, 2 sec; (4) wide shot of street lined with native juniper and aspen, blue hour dusk. Total: 8 seconds. Upbeat, optimistic indie instrumental soundtrack (no dialogue). Cinematic, 1080p.
```

### Common Mistakes & How to Fix

| Mistake | Why It Fails | Fix |
|---------|------------|-----|
| Overstuffed prompt (10+ clauses) | Model gets confused; outputs incoherent mashup | Break into 2–3 focused prompts instead |
| "dream home" / "gorgeous" / "luxurious" | Vague adjectives don't encode visuals | Use concrete descriptors: "marble countertops," "natural light," "architectural detail" |
| All motion at once (subject + camera + environment all moving) | Creates distortion; model can't prioritize | Pick ONE primary motion; keep others minimal |
| Physically impossible motion (person floating, object phasing through wall) | Models generate artifacts | Describe natural physics only |
| No lighting description | Default is flat, washed-out | Specify lighting FIRST; it's the highest-ROI element |
| Hand problems in avatar videos | Unanchored hands distort/morph | Anchor hands to objects: "holding coffee cup," "resting on banister," "gesturing toward counter" |
| Negative prompts too long | Can create stiffness instead of fixing issues | Keep negatives to 5–7 words max: "no floating limbs, no distorted joints, no extra fingers" |

**Refs:** [Veo 3 Prompt Guide 2026](https://www.veo3ai.io/blog/veo-3-prompt-guide-2026) | [Kling Prompt Engineering Mastery](https://www.atlascloud.ai/blog/guides/mastering-kling-3.0-10-advanced-ai-video-prompts-for-realistic-human-motion) | [AI Video Prompt Guide](https://zsky.ai/blog/ai-video-generation-prompts-guide)

---

## 4. CLAUDE + AI VIDEO PIPELINE FOR MATT'S SETUP

### How This Works (High-Level)

Matt has:
- Claude Opus (agentic, with Supabase MCP for live MLS data)
- Supabase: 587k Oregon listings + 3.8M listing_history rows
- Brand kit in Canva
- Listing photos from Rich @ Framed Visuals (via Aryeo)
- 19 Bend neighborhoods from Snowdrift Visuals (Photo + Video)

**The Pipeline:**
1. **Data Layer (Claude):** Query Supabase for market trends, listing highlights, neighborhood stats
2. **Narrative Layer (Claude):** Convert data into story beats and script
3. **Prompt Generation (Claude):** Write structured prompts for Veo/Kling/Remotion
4. **Video Generation (API):** Call Veo 3 API, Kling API, or Remotion CLI
5. **Post-Production (CapCut/Canva):** Add overlays, text, branding, music
6. **Publish (IG/TikTok):** Schedule via native apps

### Two Viable Paths

#### Path A: Veo 3 API + Claude (Easiest to Start)
**Setup:**
- Get Vertex AI account ($300 free credits)
- Create simple Claude Code skill that calls Veo 3 API
- Skill reads MLS data, generates prompt, triggers video generation

**Workflow:**
```
User: "Create a market update video about Bend's inventory trend"
↓
Claude queries Supabase for inventory data (last 30 days, by neighborhood)
↓
Claude writes script: "Bend inventory is down 12% year-over-year, what that means for sellers..."
↓
Claude generates Veo 3 prompt with data viz overlay instructions
↓
Claude calls Veo 3 API → receives MP4
↓
Matt downloads, adds music in CapCut, posts
```

**Economics:** $300 free credits ≈ 600–857 seconds of video. Then ~$0.40/second.

#### Path B: Remotion + Claude Code (Most Powerful, More Technical)
**Setup:**
- Install Remotion locally
- Create Claude Code skill that writes React video components
- Claude generates component code → local render → MP4

**Workflow:**
```
User: "Create an animated market report: Bend median home price trend 2023-2026"
↓
Claude queries Supabase for price trend data
↓
Claude writes Remotion React component: animated line chart + voiceover timeline
↓
Claude generates ElevenLabs voiceover script
↓
Local `remotion render` → MP4 (fast, no API calls)
↓
Matt adds final music/branding in CapCut
```

**Economics:** One-time Claude Code subscription. Unlimited local rendering. Zero per-video cost.

**Advantage:** Can pull live MLS data every time you run it. Perfect for "market update every Friday" automation.

### Recommended Starting Point for Matt
1. **Week 1:** Create custom avatars in HeyGen + Synthesia (this is the blocker)
2. **Week 2:** Build simple Veo 3 API skill in Claude Code to generate 8-second neighborhood spotlight clips
3. **Week 3:** Batch-produce 4 neighborhood videos, test posting cadence on IG/TikTok
4. **Week 4+:** Expand to Kling for longer-form content; add Remotion for data visualizations

**Why this order:** Avatar creation unblocks talking-head content immediately. Veo 3 is easiest to start. Quick wins build momentum.

**Refs:** [Claude Code + Remotion Integration](https://www.remotion.dev/docs/ai/claude-code) | [How I Built Videos with Claude + Remotion](https://juliangoldie.com/remotion-claude-integration/) | [Real Estate Data MCP](https://batchdata.io/blog/how-to-use-real-estate-data-mcp-for-automated-real-estate-market-reports)

---

## 5. CONTENT FORMATS THAT ACTUALLY WIN

### NOT Working Well (Saturated, Low ROI)
- ❌ Static listing tours (no AI needed; professional photography does it better)
- ❌ Generic "dream home" hype language (triggers Fair Housing + sounds cheesy)
- ❌ 60-second slow pans with no narrative
- ❌ AI-generated avatar speaking stiffly (uncanny valley)

### WORKING WELL (Proven High Engagement)

#### Format 1: Market Pulse + Data Visualization
**What:** Quick (15–30 sec) market commentary tied to live MLS data
**Hook:** "Bend inventory is at a 5-year low — here's what that means"
**Production:** Veo 3 (native audio) or Kling avatar + animated chart overlay in CapCut
**Platform:** IG Reels, TikTok, YouTube Shorts
**Why it works:** Educational (establishes expertise) + timely (data-driven, not hype)
**Example:** Matt as voiceover: "We've closed 47 homes in Bend since March. Average DOM is 23 days. That's *fast*. If you're thinking about selling, now's the time." [Chart animates showing DOM trend]

#### Format 2: Neighborhood Spotlight (MATT'S GOLDMINE)
**What:** 30–45 sec cinematic tour of neighborhood + 2–3 local business highlights
**Hook:** "If you love coffee culture and hiking access, you need to know about Tumalo"
**Production:** Snowdrift b-roll (video) + quick cuts to local spots (coffee shop, park, trail) + VO or avatar
**Platform:** IG Reels, TikTok, LinkedIn (professional audience)
**Why it works:** Positions Matt as neighborhood expert; builds community trust; durable content (neighborhoods don't change weekly)
**Scale:** Matt has 19 neighborhoods ready. Even 1 per week = 19 weeks of content in-flight
**Example template:** "Living in [neighborhood] means [benefit 1], [benefit 2], [benefit 3]. I send my buyers a private map + available homes. Comment MAP."

#### Format 3: Before-You-Offer Education
**What:** 30 sec quick tips for buyers: "3 things to check before submitting an offer"
**Hook:** "Most buyers forget to check this..."
**Production:** Avatar or voiceover + visual callouts; can be fully synthetic (Veo 3 generating scenes) or Canva-designed statics
**Platform:** IG Reels, TikTok, YouTube Shorts
**Why it works:** Directly solves buyer pain; generates DM inquiries ("DM me if you have more questions")

#### Format 4: AI-Generated Property Visualization
**What:** Fully synthetic fly-through of a kitchen renovation or new build
**Hook:** "This is what the kitchen reno will look like" (pre-construction)
**Production:** Veo 3 or Kling image-to-video (start frame = empty room, end frame = finished kitchen)
**Platform:** IG Reels, listing marketing, investor presentations
**Why it works:** Buyers can envision the end state; stands out from static photos
**Fair Housing Note:** Clearly label as "visualization" or "rendering" — never pass off as existing

#### Format 5: Quick Data Stories (Remotion + Claude)
**What:** 15–30 sec animated visualization of market trend
**Hook:** "Home prices in Bend have moved like this since 2020..." [animated chart]
**Production:** Claude queries Supabase → Remotion generates animated chart + ElevenLabs voiceover → MP4
**Platform:** TikTok, LinkedIn (professional positioning), email to past clients
**Why it works:** Positions Matt as data-informed, not hype-driven
**Automation:** Can run this weekly or monthly on schedule

#### Format 6: Authentic UGC-Style Talking Head (Arcads or HeyGen)
**What:** 30 sec "Matt standing in living room, speaking to camera about this home"
**Hook:** "The light in this room is my favorite part. Watch how it moves through the day"
**Production:** Arcads avatar with organic micro-gestures, or HeyGen stock avatar (custom avatar creation pending)
**Platform:** IG Reels, TikTok, listing page embed
**Why it works:** Feels like a real person; algorithm favors authentic-looking creator content
**Tip:** Arcads > Synthesia for UGC feel (more natural micro-expressions)

---

## 6. FAIR HOUSING, DISCLOSURE & LEGAL CONSIDERATIONS

### Fair Housing Compliance

**HUD Guidance (Effective Now):**
The Fair Housing Act applies to AI-generated advertising and content. You (Matt) are legally responsible for every video you publish, regardless of who or what wrote it.

**Steering Risk:**
AI prompts can unintentionally reference protected classes (age, familial status, race, religion, disability):
- ❌ "Perfect for young families" (familial status steering)
- ❌ "Peaceful, quiet community" (age/disability steering — implies no children/kids are loud)
- ❌ "Near top-rated schools" (familial status steering)
- ✅ "4-bedroom home in Tumalo neighborhood" (descriptive, neutral)

**California AB 723 (Effective January 2026):**
Any AI-altered listing photos must be labeled "Virtually Staged." Original, unaltered photos must also be provided. Failure to disclose is a misdemeanor.

**MLS Requirements:**
Most MLS systems require "Virtually Staged" label on all AI-enhanced images. Verify Bend MLS specifics.

### Video Disclosure Requirements

**For AI-Generated Video:**
- If listing photos are included in AI video tours, apply same "Virtually Staged" label if photos are AI-altered
- If entire video is AI-generated (synthetic scene generation), disclose this clearly
- Example: "This video is an AI-generated visualization of the property" or "Computer-generated tour"

**For Synthesia/HeyGen Avatar Videos:**
- Clearly identify as avatar: "Featuring AI Avatar [name]" or "Voiceover by AI"
- This builds trust (full transparency) vs. deception (which triggers FTC/Fair Housing issues)

**For Authentic Market Commentary:**
- If Matt provides voiceover (real voice), no disclosure needed
- If ElevenLabs voice clone of Matt, consider disclosing: "Generated with AI voiceover technology for efficiency"

### FTC Guidance (2026 Update)
The FTC is scrutinizing undisclosed AI in marketing. Best practice: **Disclose that AI tools were used in production**, especially for video/avatar work. This positions you as transparent and builds buyer trust.

### Penalties for Non-Compliance
Fair Housing Act violations for AI-related steering/discrimination: **$100,000+ for repeat offenses** + compensatory/punitive damages in private lawsuits.

**Refs:** [AI Real Estate Compliance 2026](https://neuhausre.com/ai-real-estate-compliance-disclosure-guide-2026/) | [California AB 723 Disclosure](https://imageworkindia.com/ai-disclosure-laws-real-estate-photography-2026/) | [HUD Fair Housing AI Guidance](https://www.consumerfinancialserviceslawmonitor.com/2024/05/hud-issues-guidance-on-applicability-of-the-fair-housing-act-to-tenant-screening-and-housing-related-advertising-that-relies-upon-algorithms-and-ai/)

---

## 7. ALGORITHM PREFERENCES & PLATFORM DYNAMICS (April 2026)

### TikTok Algorithm (BEST PLATFORM FOR REAL ESTATE DISCOVERY)

**What Matters (In Order):**
1. **Watch Time** (70%+ completion rate = 3x reach boost vs. 40% completion)
2. **Engagement** (likes, comments, shares; shares weighted highest)
3. **Post Frequency** (consistency beats viral hits; ~50 posts before first viral)
4. **Video Length** (1–3 minute videos getting boosted over 15–30 sec shorts)

**Distribution Model:**
- New videos shown primarily to existing followers first (24–48 hrs)
- TikTok analyzes engagement in that window
- If strong engagement, pushed to FYP (For You Page) of non-followers
- FYP ranking: 0 followers can go viral if content is exceptional

**AI Content Handling:**
- AI-generated content is **NOT penalized** if labeled properly
- Users can now filter how much AIGC they see
- Authentic AI (labeled avatar, transparent production) > fake organic

**Winning Strategy for Matt:**
- Post 3–4x per week (consistency)
- Lead with hook in first 3 seconds (question, bold statement, surprising stat)
- Aim for 70%+ watch time (shorter videos: 15–45 sec; longer content: 1–2 min with stronger narrative)
- Every post: DM CTA ("DM me 'strategy'" outperforms link-in-bio)
- Neighborhood spotlights: Highly differentiated; low saturation = high FYP potential

### Instagram Reels Algorithm (2ND BEST)

**2026 Changes:**
1. **De-ranking recycled content** (watermarked TikToks, reposts without additions)
2. **Prioritizing original content** (Reels shot/edited natively on Instagram)
3. **Account authority signals** (consistent engagement patterns > post-by-post lottery)

**Engagement Rate (IG Reels):** 0.65% average vs. TikTok's 3.15% (TikTok still wins)

**Strategy for Matt:**
- Edit/shoot Reels natively; don't repost TikToks
- Build account-level authority with consistent 3–4 posts/week
- Reels 15–90 seconds; focus on watch time over views

### YouTube Shorts

**Engagement:** 0.40% average (lowest of three)
**Best for:** Long-form subscribers (shorts supplement main videos)

### Algorithm: AI Detection

As of April 2026:
- Platforms **can detect AI-generated content** but don't automatically penalize it
- Advanced AI detection scans for editing patterns, audio signatures, user-made vs. synthetic visuals
- **Properly labeled AI content often outperforms** unlabeled AI (transparency = trust signal)
- Authenticity markers (inconsistent lighting, real human imperfections, genuine mistakes) = higher engagement

**Real estate implication:** Don't hide that you used AI. Position it as efficiency tool: "Generated this market update in 5 minutes using AI to save time for my clients."

**Refs:** [TikTok Algorithm 2026 Guide](https://greenfroglabs.com/blog/tiktok-algorithm-2026-brand-strategy) | [Instagram Algorithm Changes 2026](https://heropost.io/instagram-algorithm-changes-2026/) | [AI Content Detection 2026](https://www.techwyse.com/blog/infographics/social-media-algorithm-changes-2026)

---

## 8. MUSIC & AUDIO LICENSING FOR AI VIDEO

### Music for AI Video (2026 Status)

**Royalty-Free Music:** Copyrighted but licensed for reuse. Safe for commercial use if you buy license.

**AI-Generated Music (NEW CATEGORY):**
- ElevenLabs Music: Built on licensed training data; commercial use included on all paid plans
- Soundverse: Permission-based sourcing; transparent pipeline
- Universal + Udio: Launching 2026 subscription service (AI music from licensed Universal catalog)

**Best Practices:**
1. Use royalty-free music packs (Epidemic Sound, Soundstripe) for consistency
2. For AI music, stick to ElevenLabs Music (commercial-safe from day one)
3. Add custom voiceover (ElevenLabs API or real Matt) → don't rely solely on background music for narrative

### Music Impact on Viewer Retention
Studies show listings with **custom-fit background music retain viewers 35% longer** than stock music. This translates directly to more inquiries.

### What NOT to Do
- ❌ Use copyrighted music (Spotify, Apple Music songs) without license
- ❌ Assume "royalty-free" means you can use any music anywhere — read licenses
- ❌ Use AI-generated music from unknown/untrained sources (legal risk)

**Refs:** [Music Rights for AI Video 2026](https://www.soundverse.ai/blog/article/ai-music-licensing-creators-guide-to-rights-deals-0459) | [Royalty-Free Music Real Estate 2026](https://freetouse.com/blog/best-royalty-free-music-for-real-estate-videos)

---

## 9. SPECIFIC GOTCHAS & CONSTRAINTS

| Issue | Solution |
|-------|----------|
| **Video aspect ratios** | IG Reels: 9:16 (vertical). TikTok: 9:16. YouTube Shorts: 9:16. Keep all 1080x1920px. Veo 3 handles reframing; Kling may need manual crop. |
| **Synthetic hands look fake** | Kling/Veo: Anchor hands to objects (holding coffee cup, resting on banister). Don't let hands float. |
| **Avatar lips don't sync** | Use HeyGen or Synthesia, not Veo/Kling for close-up talking head. Veo/Kling are better for wide shots + voiceover. |
| **Watermarks on free videos** | Pika free tier watermarks. Upgrade to Pro ($28+/month) to remove. Same for Synthesia free tier. |
| **Inconsistent character across clips** | Use Kling (strong character consistency) for multi-scene videos. Veo 3 less consistent if you break clips into batches. |
| **Failed generations consume credits** | Kling & Pika don't refund failed videos. Budget 20% overage for retries. |
| **Price increases** | Kling Ultra increased 41% in 6 months (Aug 2025 → Jan 2026, $128 → $180). Budget for inflation. |
| **Native audio quality** | Veo 3's native audio is good but imperfect. For critical voiceovers, pre-generate with ElevenLabs, then use text-only prompts. |
| **Prompt ambiguity** | "Good light" produces inconsistent results. Use specific: "Golden hour, long shadows, 2700K warm tone." Vague = unpredictable. |

---

## 10. QUICK REFERENCE: TOOL COMPARISON TABLE

| Tool | Best For | Clip Length | Cost | Learning Curve | AI Look? |
|------|----------|------------|------|-----------------|----------|
| **Veo 3.1** | Cinematic tours + market commentary with native audio | 8 sec | $0.40/sec (API); $20/mo (subscription) | Easy | Low (very realistic) |
| **Kling 3.0** | Long-form narratives, photorealistic humans | 3 min | $1.27/min (Standard); $3.90/min (Pro) | Medium | Low (excellent humans) |
| **Runway Gen-4** | Multi-listing consistency, pro workflows | Variable | $15–50/mo | Hard | Low (very pro) |
| **Pika** | Quick iteration, social shorts | 60 sec | $8–76/mo | Easy | Medium (creative, less photo-real) |
| **HeyGen** | Avatar talking head, multilingual | 1–3 min | $5+ (API); $60–150/mo (custom avatar) | Medium | Medium (depends on avatar) |
| **Synthesia** | Avatar video, professional voiceover | 5–10 min | $60–150/mo + $1k+ custom avatar | Easy | Medium–High (traditional avatar) |
| **Arcads** | UGC-style avatar (organic feel) | 2 min | Unknown (TBD) | Easy | Low (very authentic micro-gestures) |
| **Remotion + Claude** | Animated data visualizations, programmatic video | Variable | $1 (Opus sub, unlimited renders) | Hard | Low (fully customizable) |

---

## 11. RECOMMENDED CONTENT CALENDAR FOR MATT (NEXT 60 DAYS)

**Goal:** Establish posting cadence, test formats, unblock avatar videos.

### Week 1–2: Setup & Avatar Creation
- [ ] Create HeyGen custom avatar (or use Synthesia stock avatar as fallback)
- [ ] Finalize ElevenLabs voice clone of Matt
- [ ] Build simple Canva template for market commentary overlays

### Week 3–4: Neighborhood Spotlights (Kling)
- [ ] Pick 4 neighborhoods from Snowdrift library
- [ ] Write narrative for each (30–45 sec)
- [ ] Generate Kling videos (using b-roll + VO)
- [ ] Post 1–2 per week (schedule for 3–4/week consistency)

### Week 5–6: Market Data Series (Veo 3 + Canva)
- [ ] Pull Supabase data (Bend median price, DOM, inventory, price/sqft trends)
- [ ] Write 2–3 market commentary scripts
- [ ] Generate Veo 3 videos with native audio
- [ ] Add Canva chart overlays
- [ ] Post 2x per week

### Week 7–8: Avatar Talking Head + Reels
- [ ] Create 4 "Matt's Market Update" avatar videos (HeyGen)
- [ ] Shoot 2 native IG Reels (authentic, unpolished, cell phone)
- [ ] Mix avatar + authentic content for algorithm variety
- [ ] Post 4x per week

**Total Content Created:** 12–15 videos (enough for 3–4 weeks of posting at 3–4/week cadence)
**Time Investment:** ~10 hours (mostly Claude-assisted generation; editing < 1 hour per video)
**Expected Reach:** 500–2,000 views per video (baseline for 0 followers; will climb with consistency)

---

## KEY TAKEAWAYS FOR MATT

1. **Sora is gone. Veo 3 + Kling are the new standards.** Veo 3 for cinematic 8-second reels with native audio; Kling for long-form storytelling.

2. **Avatar videos are still a blocker.** HeyGen + Synthesia custom avatars unblock talking-head at scale. This is the #1 to-do.

3. **You have an unfair advantage: Supabase + 587k listings.** Claude can mine this data to auto-generate market commentary weekly. Remotion can visualize it. Very few brokers can do this.

4. **Neighborhood spotlights are your goldmine.** 19 Snowdrift neighborhoods = 19 weeks of content. Each spotlight is 30–45 sec, highly differentiated, and builds community expertise positioning.

5. **Prompt quality >> tool choice.** All tools succeed when prompts are specific: lighting, camera movement, action physics, audio. Vague prompts fail on all of them.

6. **Authenticity + AI is winning.** Label your AI content. Be transparent. This builds trust and doesn't penalize you algorithmically.

7. **TikTok is 3.15% engagement; IG Reels are 0.65%.** TikTok's FYP algorithm gives unknowns a shot. Prioritize TikTok first; repurpose to IG/YouTube after.

8. **Fair Housing applies to AI video too.** No steering language. Disclose virtualizations. You are liable for every video you publish.

9. **Start with Veo 3 + Kling, not Remotion.** Remotion is powerful but technical. Get quick wins first; add automation later.

10. **DM CTA outperforms link-in-bio.** Every post: "DM me 'strategy'" drives engagement directly to your inbox.

---

## NEXT IMMEDIATE ACTIONS

1. **Create HeyGen custom avatar** (1–2 days, cost: $100–200)
2. **Build first Kling neighborhood video** (test prompt quality + editing workflow)
3. **Set up Veo 3 API access** (Vertex AI account, $300 credits)
4. **Write 3 neighborhood narratives** for Week 3–4 pipeline
5. **Schedule 4 posts per week minimum** (starting Week 3)

---

## SOURCES & REFERENCES

### Tools & Pricing
- [Veo 3 API Pricing 2026](https://piapi.ai/blogs/veo-3-1-api-pricing-prompting-guide-2026)
- [Kling AI Pricing Complete Breakdown](https://aitoolanalysis.com/kling-ai-pricing/)
- [Veo 3 Complete Guide](https://www.veo3ai.io/blog/veo-3-1-new-features-guide)
- [Kling AI Complete Guide](https://aitoolanalysis.com/kling-ai-complete-guide/)
- [Pika AI Pricing](https://pika.art/pricing)
- [Synthesia Real Estate Guide](https://www.synthesia.io/post/real-estate-marketing-videos)
- [HeyGen Developers](https://developers.heygen.com)
- [Arcads Real Estate Solutions](https://www.arcads.ai/industries/real-estate-agencies)

### Prompt Engineering
- [Veo 3 Prompt Guide 2026](https://www.veo3ai.io/blog/veo-3-prompt-guide-2026)
- [Kling 3.0 Advanced Prompts for Human Motion](https://www.atlascloud.ai/blog/guides/mastering-kling-3.0-10-advanced-ai-video-prompts-for-realistic-human-motion)
- [AI Video Prompt Guide](https://zsky.ai/blog/ai-video-generation-prompts-guide)

### Real Estate Creators & Strategy
- [Real Estate AI Video Platform](https://www.realstatevideo.com/)
- [Real Estate TikTok Strategy 2026](https://www.cubi.casa/tiktok-accounts-for-real-estate-marketing/)
- [Kina DeSantis Case Study](https://www.estatepromptai.com/blog/tiktok-for-realtors)
- [Tom Ferry TikTok for Real Estate](https://www.tomferry.com/blog/tiktok-for-real-estate/)

### Algorithm & Platform Dynamics
- [TikTok Algorithm 2026 Guide](https://greenfroglabs.com/blog/tiktok-algorithm-2026-brand-strategy)
- [Instagram Algorithm Changes 2026](https://heropost.io/instagram-algorithm-changes-2026/)
- [AI Content Detection 2026](https://www.techwyse.com/blog/infographics/social-media-algorithm-changes-2026)

### Fair Housing & Compliance
- [AI Real Estate Compliance 2026](https://neuhausre.com/ai-real-estate-compliance-disclosure-guide-2026/)
- [California AB 723 Disclosure](https://imageworkindia.com/ai-disclosure-laws-real-estate-photography-2026/)
- [HUD Fair Housing AI Guidance](https://www.consumerfinancialserviceslawmonitor.com/2024/05/hud-issues-guidance-on-applicability-of-the-fair-housing-act-to-tenant-screening-and-housing-related-advertising-that-relies-upon-algorithms-and-ai/)

### Music & Audio Licensing
- [AI Music Licensing 2026](https://www.soundverse.ai/blog/article/ai-music-licensing-creators-guide-to-rights-deals-0459)
- [Royalty-Free Music Real Estate 2026](https://freetouse.com/blog/best-royalty-free-music-for-real-estate-videos)

### Claude + Video Pipelines
- [Remotion + Claude Code Integration](https://www.remotion.dev/docs/ai/claude-code)
- [How I Built Videos with Claude + Remotion](https://juliangoldie.com/remotion-claude-integration/)
- [Real Estate Data MCP + Claude](https://batchdata.io/blog/how-to-use-real-estate-data-mcp-for-automated-real-estate-market-reports)

---

**Document prepared:** April 14, 2026
**For:** Matt Ryan, Ryan Realty, Bend OR
**Contact:** matt@ryan-realty.com

