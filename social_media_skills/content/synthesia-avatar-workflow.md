---
name: synthesia-avatar-workflow
description: Ryan Realty: Synthesia Avatar Workflow Skill
---
# Ryan Realty: Synthesia Avatar Workflow Skill

## When to Use

Use this skill when Matt asks to generate avatar video content (market updates, listing talking-head, FAQ series, neighborhood tours, lead-magnet promos). This skill is a complete blueprint for what happens AFTER Matt's custom avatar is created in Synthesia.

## Pre-Use Blocker

**CRITICAL: This skill is blocked until Matt's Synthesia avatar exists.**

Before using this skill for any production:

```javascript
// Check avatar availability via Synthesia API
const checkAvatarAvailability = async () => {
  const response = await fetch("https://api.synthesia.io/v2/avatars", {
    headers: { "Authorization": process.env.SYNTHESIA_API_KEY }
  });
  const avatars = await response.json();
  const mattAvatar = avatars.find(a => a.name.includes("Matt") || a.name.includes("Ryan"));
  
  if (!mattAvatar) {
    throw new Error(
      "Matt's custom avatar has not been created in Synthesia. " +
      "Contact Synthesia support or visit app.synthesia.io/studio to build it first. " +
      "Once built, store the avatar_id in .env.local as SYNTHESIA_AVATAR_ID."
    );
  }
  return mattAvatar;
};
```

If this check fails, escalate to Matt with the error. Do not proceed.

Once created, store the avatar ID in `.env.local`:
```
SYNTHESIA_AVATAR_ID=avatar_uuid_from_synthesia
SYNTHESIA_MATT_VOICE_ID=voice_uuid_if_cloned (optional)
```

---

## Use Cases (When Avatar Is Right, When It Isn't)

### GOOD USE CASES

**Weekly Market Update (45-60s)**
- Hook: "Real estate numbers show X. Here's what it means."
- Format: Avatar full-shot or bust, stat card overlay on right, slow camera push or static lock
- Disclosure: None required (avatar is identified as Ryan Realty agent, not deceptive)
- Example: "Inventory up 12% month-over-month. For sellers, this means more competition. Here's the strategy..."

**Listing First-Look Talking-Head (30-45s)**
- Hook: Avatar introduces property, key fact (price, acreage, position)
- Format: Avatar picture-in-picture over listing exterior cover shot or 3D tour
- Disclosure: Disclose that video contains AI-generated speaking (per emerging state rules)
- Example: "Just listed in Tumalo. 2.28 acres, $1.6M, mountain views. DM me for a tour."

**FAQ Mini-Series (30-60s per episode)**
- Topics: "What does a pre-approval actually mean?", "Why did your offer get rejected?", "What's an appraisal gap?"
- Format: Avatar at desk or casual setting, animated graphics/charts as B-roll
- Disclosure: None (educational content)

**Neighborhood Mini-Tour (60-90s)**
- Format: Avatar walking through or gesturing to B-roll (Snowdrift Visuals neighborhood footage)
- Hook: "Johnson Ranch. Why this neighborhood crushes for young families."
- Disclosure: Disclose AI-generated speaking

**Lead-Magnet Promo (45s)**
- Offer: Free buyer's guide, seller assessment, neighborhood video download
- Format: Avatar on solid background or lifestyle B-roll, CTA button overlay
- Disclosure: None for promotional content

### BAD USE CASES (Never Use Avatar For These)

**Viral Video Concept**
- Reason: Viral videos ban branding and personal tether. An avatar IS personal branding. Violates hard rule.
- Use: Science/nature AI video instead (see ai-video-production.md)

**Sensitive or Controversial Topics**
- Reason: Avatar can be deepfake-confused. Real Matt is better for anything that needs trust or authenticity.
- Use: Film Matt directly or write text content instead

**Testimonials or Client Stories**
- Reason: Avatar could look deceptive. Real people are required.
- Use: Film real clients, testimonial video, or written quotes

**Ads to Cold Audiences**
- Reason: Disclosure liability. Avatar in ads requires explicit "AI-generated" labeling in creative.
- Use: Static image or real Matt instead

---

## Script Format for Synthesia

### Structure

**Hook (4-5 words, first sentence)**, Stop the scroll
**Opening statement (8-12 words, sets context)**, The "why you're watching"
**Main content (3-5 brief points, 30-40 seconds)**, The value
**CTA or sign-off (1-2 sentences)**, Next action
**Pause markers**, [PAUSE 1s] for natural breath stops

### Template

```
[HOOK, "The market just shifted."]

[OPENING]
I wanted to share what just happened with Bend real estate pricing, 
because it affects your next move.

[MAIN CONTENT]
Here's the data: Median list price is up 8% quarter-over-quarter. 
Homes are sitting 12 days longer on average. [PAUSE 1s]
What does this mean? 
If you're selling, price aggressively now. If you're buying, you have leverage.
[PAUSE 1s]

[CTA]
DM me "strategy" and let's talk about your position in this market.
```

### Length Guidelines

- **45-60 seconds**: Sweet spot for IG Reels and feed posts
- **30-45 seconds**: TikTok and Story series
- **60-90 seconds**: YouTube, email leads, landing page embed
- **Never exceed 120 seconds**: Synthesia video quality degrades beyond this; split into series

### Pause Markers (How to Use Them)

Write `[PAUSE 1s]` in the script where you want a natural breath or emphasis. Synthesia reads these as brief moments where the avatar holds still or looks off camera. Use sparingly (max 2-3 per script) to avoid awkward pacing.

### Lip-Sync Consideration (Synthesia 2026 Engine)

The current Synthesia engine (April 2026) still has lip-sync issues with certain phonetic clusters. Avoid these in scripts:

- Complex "s" sibilants in sequence: "this sales season" (rewrite: "this market season")
- Overlapping consonants: "scripts" (use "written words" or "dialogue")
- Rapid plosives: "pick pack put" (use slower pacing or different phrasing)

Test first script with a short 15-second preview. If lips are out of sync, rewrite the problematic phrase.

---

## API Workflow: Synthesia Video Generation

### Setup: Fetch Avatar and Voice IDs

```javascript
const getSynthesiaAssets = async () => {
  // Get avatar list
  const avatarRes = await fetch("https://api.synthesia.io/v2/avatars", {
    headers: { "Authorization": process.env.SYNTHESIA_API_KEY }
  });
  const avatars = await avatarRes.json();
  const mattAvatar = avatars.find(a => a.id === process.env.SYNTHESIA_AVATAR_ID);
  
  // Get voice list (optional: if Matt has cloned voice)
  const voiceRes = await fetch("https://api.synthesia.io/v2/voices", {
    headers: { "Authorization": process.env.SYNTHESIA_API_KEY }
  });
  const voices = await voiceRes.json();
  const mattVoice = voices.find(v => v.id === process.env.SYNTHESIA_MATT_VOICE_ID);
  
  return { mattAvatar, mattVoice };
};
```

### Generate Avatar Video: Node.js Example

```javascript
const generateAvatarVideo = async (script, backgroundImageUrl) => {
  const { mattAvatar, mattVoice } = await getSynthesiaAssets();
  
  // Build video request
  const videoRequest = {
    title: "Market Update - April 2026",
    description: "Weekly real estate market analysis for Bend, Oregon",
    visibility: "private", // Change to "public" for live
    avatar: {
      id: mattAvatar.id,
      style: "static" // or "talking" for full body
    },
    voice: mattVoice ? { id: mattVoice.id } : { id: mattAvatar.default_voice_id },
    background: {
      type: "image",
      image_url: backgroundImageUrl // Solid color or photo
    },
    scenes: [
      {
        caption: "The market just shifted.",
        background: {
          type: "image",
          image_url: backgroundImageUrl
        }
      },
      // ... additional scenes if needed
    ],
    // Inline script for single-scene video
    script: script, // The full dialogue with pause markers
    speed: 0.95, // Slightly slower than default (1.0) for naturalness
    quality: "high" // Options: low, medium, high
  };
  
  // POST to Synthesia
  const response = await fetch("https://api.synthesia.io/v2/videos", {
    method: "POST",
    headers: {
      "Authorization": process.env.SYNTHESIA_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(videoRequest)
  });
  
  const video = await response.json();
  return video.id; // Use this to poll status
};

// Poll for video completion
const pollVideoStatus = async (videoId) => {
  let done = false;
  let videoUrl = null;
  
  while (!done) {
    const response = await fetch(
      `https://api.synthesia.io/v2/videos/${videoId}`,
      { headers: { "Authorization": process.env.SYNTHESIA_API_KEY } }
    );
    const video = await response.json();
    
    if (video.status === "complete") {
      videoUrl = video.download_url;
      done = true;
    } else if (video.status === "failed") {
      throw new Error(`Video generation failed: ${video.error_message}`);
    }
    
    if (!done) {
      await new Promise(r => setTimeout(r, 3000)); // Poll every 3s
    }
  }
  
  return videoUrl;
};
```

### Curl Example (Quick Test)

```bash
curl -X POST https://api.synthesia.io/v2/videos \
  -H "Authorization: $SYNTHESIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Weekly Market Update",
    "avatar": {
      "id": "SYNTHESIA_AVATAR_ID_HERE"
    },
    "voice": {
      "id": "SYNTHESIA_VOICE_ID_HERE"
    },
    "background": {
      "type": "image",
      "image_url": "https://example.com/bg.jpg"
    },
    "script": "The market just shifted. [PAUSE 1s] Here is why it matters...",
    "quality": "high"
  }'
```

---

## Workflow: From Script to Upload

### 1. Write Script

Use template above. Keep it 45-60 seconds for Reels. Include pause markers. Run through brand-voice:brand-voice-enforcement before submission to Matt.

### 2. Get Matt Approval on Script

Show Matt the script in plaintext. Make sure tone is right (knowledgeable, warm, never salesy). No hype language.

### 3. Select Background

Options:
- **Solid color**: Any RGB hex code (recommend brand navy `#102742` with gold overlay text)
- **Brand image**: Ryan Realty logo backdrop, office setting, Bend skyline
- **Video B-roll**: Synthesia can layer avatar over video background (Snowdrift Visuals footage for neighborhood videos)
- **Stat card overlay**: If this is a market update, layer a graphic on the right side with key numbers

### 4. Generate Video

Fire Synthesia API with script and background. Latency is typically 2-3 minutes for single-scene, high-quality videos. Poll for completion.

### 5. Download and Post-Process

Download from Synthesia. Light pass in CapCut if needed:
- Color balance (match brand colors if overlays need pop)
- Audio normalize (Synthesia's speech can vary in volume)
- Add music bed underneath (subtle, 50% volume, no vocals)
- Add captions/stat overlay (Canva or CapCut)

### 6. Upload to Platform

**Instagram Reel:** Use Meta Graph API (POST /{ig_user_id}/media with video_url)
**TikTok:** Use Chrome MCP fallback (TikTok Business API not yet available)
**YouTube:** Use Google Data API (videos.insert) for longer videos
**Email/Landing Page:** Embed via Synthesia player or host on Vimeo/YouTube

### 7. Include Disclosure (if required by jurisdiction)

For any avatar video in paid media or disclosure-sensitive content, add a frame at the end or in description:

"This video contains AI-generated speaking. Avatar created with Synthesia technology."

For lead-magnet videos or educational content: no disclosure required.

---

## Batch Mode: Quarter-Ahead Market Updates

Synthesia shines when batching. Generate 8-12 weekly market updates in one weekend for the next 3 months.

### Batch Script Template (Reusable Structure)

```
Week 1: "Inventory up 8%. What it means for sellers."
[HOOK]
Bend inventory climbed this week. [PAUSE 1s]

[MAIN]
Median days on market went from 9 to 12 days.
That's great for buyers, tougher for sellers.
[PAUSE 1s]
If you're selling, price aggressively. Market window is closing.

[CTA]
DM me "strategy" if you're thinking about a move this quarter.
---

Week 2: "Interest rates dropped. How this changes your payment."
[HOOK]
Rate action this week... [PAUSE 1s]
```

Generate all scripts, batch-approve with Matt (group review, 30 min), then fire all 12 videos in parallel (Synthesia handles queuing). Download and schedule posts via Meta API or Buffer.

---

## Fair Housing & Disclosure Compliance

### State Rules (As of April 2026)

**Oregon (Matt's market):**
- No state-level AI video disclosure law yet. Watch Oregon Real Estate Commission monthly updates.
- Federal Fair Housing applies: no avatar content that creates housing discrimination (avoid race/age/familial status implications in any script).

**California (if expanding):**
- AB 723 (2026): Real estate content depicting a property must disclose "This video contains AI-generated content."
- Applies to property tours, listing videos. Does NOT apply to market commentary or educational content.

**Emerging: Federal FTC Guidance (Q2 2026)**
- Expected guidance on deepfakes and disclosure. Recommend preemptively disclosing any avatar video touching real estate.

### Safe Approach

For any avatar video Matt produces:
- Educational/commentary: No disclosure needed
- Listing property tour: Add disclosure frame
- Lead-magnet promo: No disclosure needed (not depicting property)
- Paid ad with property imagery: Disclosure frame + disclaimer in creative

Template disclosure text:
"This video contains AI-generated speaking. For full market data and real tours, contact us."

---

## Voice Settings (Optimization Tips)

**Pace:** Set to 0.90-0.95 (default is 1.0). Slower speech reads more authoritative and less "bot-like."

**Energy:** Keep at 50-60% (not 100% energetic, which sounds forced; not 30% which sounds dead).

**Pitch:** Keep at default (100%), Synthesia's voice cloning handles pitch naturally. Don't adjust unless Matt's cloned voice sounds off.

**Pause Handling:** Synthesia handles pause markers well. Use them for natural breath stops, not for dramatic effect overuse.

---

## Output Artifacts

Save these after each avatar video:

```
market-update-week-1-april-2026/
  ├── script_approved.md (final Matt-approved script)
  ├── brief.md (idea, hook, background, disclosure needs)
  ├── avatar_video_high_quality.mp4
  ├── caption.md (platform captions with DM CTA)
  ├── disclosure_note.txt (if applicable)
  └── posting_schedule.md (when/where posted)
```

Store in Drive under `06_Marketing & Brand > Marketing > Avatar Videos > [Season]/`.

---

## Verification Checklist

Before publishing an avatar video:

- [ ] Avatar was tested and confirmed in Synthesia API before production
- [ ] Script approved by Matt (no salesy language, authentic voice)
- [ ] No discrimination implied (Fair Housing compliance)
- [ ] Disclosure added if depicting property or paid media
- [ ] Background selected and matches brand (navy/gold preferred)
- [ ] Synthesia generation completed and video downloaded
- [ ] Post-processing applied (color, audio normalize, optional music bed)
- [ ] Captions or stat overlays added if needed
- [ ] Caption written with DM CTA (e.g., "DM me 'strategy'")
- [ ] Posted to platform via API or Chrome MCP fallback
- [ ] All artifacts saved to Drive with proper naming
