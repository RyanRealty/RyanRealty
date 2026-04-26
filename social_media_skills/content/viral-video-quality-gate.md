---
name: viral-video-quality-gate
description: Ryan Realty: Viral Video Quality Gate (MANDATORY)
---
# Ryan Realty: Viral Video Quality Gate (MANDATORY)

## Enforcement Level: ABSOLUTE

This skill is a hard gate. No AI-generated video content leaves this system without passing every check below. No exceptions. No "we'll fix it in post." No "it's good enough for a draft." If a check fails, the content does not ship. Period.

This gate applies to ALL video content: Reels, TikTok, YouTube Shorts, Stories, listing video, market commentary video, neighborhood spotlights, AI-generated B-roll, photo-to-video animations, text-to-video generations, avatar video. Everything.

**Source provenance:** All creator profiles, tool specs, and statistics in this skill were verified via web research on 2026-04-15. Inline citations are provided where the claim originates from a specific source. Claims without citations are Matt's hard brand rules.

---

## PHASE 1: CONCEPT GATE (Before Any Prompt Is Written)

### 1.1 Content Strategy Check

Every video must answer these three questions before a single prompt is drafted:

1. **What is the scroll-stop hook?** State it in one sentence. If you can't, the concept isn't ready.
2. **What is the viewer's reward for watching to the end?** (A fact, a reveal, an emotion, a laugh.) If there's no payoff, scrap it.
3. **Which AI strength does this leverage?** The concept MUST play to what AI does BETTER than cameras, not what AI does worse.

### 1.2 AI Strength/Weakness Matrix

**ALWAYS use AI for (high-confidence zones):**
- Morphing transitions (object A to object B)
- Impossible camera movements (spatial warps, scale shifts, perspective breaks)
- Macro/abstract cinematography (textures, patterns, nature close-ups)
- Surreal physics (water flowing upward, gravity-defying motion, time manipulation)
- Scale transitions (macro to aerial to macro in one shot)
- Data visualization overlays on cinematic B-roll
- Seasonal/weather impossible (snowfall in summer, perfect golden hour on demand)

**NEVER use AI for (high-failure zones):**
- Human face close-ups (mouth sync, micro-expressions, eye contact) — except via Synthesia stock avatars, which handle mouth sync natively
- Hand detail work (fine motor coordination, tool use, gestures)
- Eating or drinking (lip/swallow coordination)
- Dialogue-heavy content (speech-mouth alignment) — except Synthesia, which is purpose-built for this
- Human-to-human interaction (handshakes, hugs, conversation)
- Everyday human actions where viewers have lifetime experience to judge
- Animals with precise movement patterns (running dogs, birds in flight)

**CONDITIONAL (use with caution, only with elite prompting):**
- Wide shots of people walking/moving (acceptable if distant, not close-up)
- Interior room reveals (acceptable if focus is on space, not people)
- Aerial/drone-style footage (generally safe, watch for physics breaks)

### 1.3 Ryan Realty Content Rules

These are non-negotiable for ANY Ryan Realty video:

- **Zero real estate visuals in viral/brand video.** No houses, keys, families, interiors, porch lights, sold signs. Stats are the only housing tether. Visuals are science/nature/macro/abstract ONLY. (Exception: listing-specific video where the property IS the subject.)
- **Zero in-frame branding.** No logo, name, phone number, URL inside the video frame. IG handle in caption is the only attribution. Branding in-frame kills virality.
- **DM CTA on every single post.** "DM me [keyword]" in caption. Instagram's Head of Product Adam Mosseri confirmed Jan 2025 that "Sends Per Reach" (DM shares) is a top-3 ranking factor — weighted 3-5x higher than likes. (Source: dataslayer.ai Instagram Algorithm 2025 Guide; gonetech.net share-to-view analysis.)
- **No em dashes in any text.** No hyphens in prose copy. Matt's hard copy rule.
- **Never salesy.** If it sounds like a cheesy real estate ad, it's wrong. No "dream home," no "luxury living," no "act now," no urgency language.

---

## PHASE 2: PROMPT ENGINEERING GATE (Before Any API Call Fires)

### 2.1 Mandatory Prompt Format

Every prompt MUST use block-format structure. Narrative prose paragraphs are BANNED.

```
[SCENE: 1 sentence. Subject + specific action + location]
Camera: [focal length] + [movement type] + [angle]
Lighting: [specific fixture/technique] + [time of day] + [color temperature]
Film Stock: [named stock OR DP reference. NEVER "cinematic"]
Color Palette: [3 specific named colors]
Speed: [f-stop for DOF OR fps for slow-mo]
Duration: [N seconds]
Negative prompt: [artifacts to avoid]
```

### 2.2 Banned Vocabulary (Zero Tolerance)

These words produce generic output. Delete them before the prompt fires:

cinematic, epic, breathtaking, stunning, beautiful, amazing, gorgeous, premium, creamy, brooding, heavy, moody, masterpiece, high quality, 4K, ultra HD, 8K, professional, award-winning, best quality, extremely detailed, dramatic, magical, enchanting, mystical, ethereal, otherworldly, mind-blowing, jaw-dropping

Replace with SPECIFIC cinematography vocabulary: focal lengths, named film stocks, named DPs, named lighting fixtures, named camera movements.

### 2.3 Reference Pull Requirement

Before writing any prompt:

1. Pull 2-3 reference prompts from established libraries (awesome-grok-imagine-prompts, awesome-seedance-2-prompts, Sirio Berati framework, Curious Refuge patterns)
2. Study the structure, not the content. Adapt the structural pattern to your concept
3. Note which model the reference was built for. Prompt syntax varies across Kling, Veo, Runway, Grok

### 2.4 Pre-Fire Checklist

Before ANY video generation API call:

- [ ] Prompt is in block format (not narrative prose)
- [ ] Zero banned vocabulary present
- [ ] 2-3 reference prompts pulled and studied
- [ ] Concept passes the AI strength/weakness matrix (playing to strengths)
- [ ] Negative prompt included to suppress known artifacts
- [ ] Duration specified (not left to default)
- [ ] Aspect ratio specified (9:16 for Reels/TikTok/Shorts, 16:9 for YouTube long-form, 1:1 for feed posts)
- [ ] Matt has seen the brief and approved (verbatim: "show Matt the brief BEFORE firing the API call")

If ANY check fails, STOP. Fix the prompt. Do not generate.

---

## PHASE 3: GENERATION GATE (During API Call)

### 3.1 Tool Selection Matrix (Verified April 2026)

| Need | Tool | Access | Verified Pricing | Source |
|------|------|--------|------------------|--------|
| Hero shot, best overall quality (#1 on ELO) | Kling 3.0 | Replicate or Kling Standard $6.99/mo, Pro $29.99/mo, Ultra $59.99/mo (4K) | 5s 1080p = ~20 credits | invideo.io/blog/kling-3-0-complete-guide |
| Multi-character dialogue with lip-sync | Kling 3.0 | Replicate / direct | Same as above | Same |
| API-first, cost-effective | Veo 3.1 | Google AI Pro $19.99/mo (90 videos) OR API $0.10-0.50/sec | Recent price cuts April 2026 | developers.googleblog.com |
| Professional camera control (dolly, crane, orbit) | Runway Gen-4 / Gen-4.5 | Runway Standard $12/mo (625 credits), Pro $28-35/mo | Gen-4.5 = 5 credits/sec; Gen-4 = 10 credits/sec | max-productive.ai |
| Physics-compliant motion, object edits via natural language | Luma Dream Machine (with "Modify with Instructions") | $30/mo+ | Luma.com | lumalabs.ai |
| Photo-to-video animation | Kling 2.1/3.0 i2v | Replicate | ~$0.02-0.07/clip | Replicate pricing |
| Static image generation | Flux Pro / Midjourney / Grok Imagine | Replicate / direct | ~$0.05/image | Replicate pricing |
| Speed/value iteration | Grok Imagine | xAI subscription | subscription | xAI |
| Stock avatar presenter video | Synthesia (150+ stock avatars available without custom build) | SYNTHESIA_API_KEY | Per-minute metered | synthesia.io |

### 3.2 Deprecations and Changes (Must Know)

- **Sora (OpenAI) is sunsetting.** App discontinued April 26, 2026; API September 24, 2026. (Source: help.openai.com/en/articles/20001071-sora-1-sunset-faq). **Do NOT build new pipelines on Sora.** Paul Trillo's Washed Out video was Sora; that pipeline is now legacy. Nik Kleverov's Sora-based work (Toys R Us, Memory Maker) is transitioning away.
- **Kling 3.0 shipped Feb 5, 2026** and is currently #1 on video-generation ELO benchmarks. Features: 15-second clips, 4K, multi-character dialogue with lip-sync, Motion Brush for custom motion paths, scene-aware consistency.
- **Luma raised $900M Series C** and is building the Project Halo compute cluster with Humain. "Modify with Instructions" (natural-language object edit) is the new differentiator.

### 3.3 Generation Parameters

- Always specify aspect ratio explicitly
- Always include negative prompt
- Generate 3-5 variations minimum per shot concept
- Never publish the first generation. Compare variations, select best, iterate
- Log every generation (model, prompt, seed, result quality) for pattern learning

### 3.4 Multi-Tool Workflow (Elite Standard, Confirmed by Creator Research)

No elite creator uses a single tool. Confirmed workflow from researched creators:

1. **Concept iterations** in cheap/fast tool (Kling 2.1, Grok Imagine Speed mode)
2. **Hero shot generation** in quality tool (Kling 3.0, Veo 3.1, or Runway Gen-4.5)
3. **Enhancement** in Topaz Video AI (denoise, upscale)
4. **Color grade** in DaVinci Resolve or CapCut (kill the digital plastic look)
5. **Edit and audio** in CapCut (beat sync, text overlays, transitions)

Paul Trillo's documented workflow: generate 400+ (Runway Gen-2) or 700+ (Sora) clips per short, select ~55 for final edit. Accept a 95%+ reject rate as the cost of elite quality. (Source: nofilmschool.com)

---

## PHASE 4: POST-PROCESSING GATE (After Generation, Before Publish)

### 4.1 Never Publish Raw AI Output

This is the single biggest rule separating elite creators from slop merchants. Laszlo Gaal's signature technique is transferring AI-generated video to 35mm/16mm film stock and scanning back — specifically to "remove the plastic feel" of digital AI output (Source: petapixel.com). PJ Accetturo's distinction is "photorealistic cinematic output" (not stylized or obvious AI). Every piece of output gets:

1. **Color grading** to warm/cool the palette, add contrast, match a film stock look. Even a basic LUT applied in CapCut transforms raw output
2. **Film grain** at 1-2% to add texture and mask temporal artifacts
3. **Lens effects** (subtle vignette, minimal chromatic aberration) to add depth
4. **Speed ramping** synced to audio beats (slow at reveals, fast through transitions)
5. **Audio layering** (music + ambient + SFX, not just a single track)

### 4.2 Artifact Detection Checklist

Before the video advances to edit, screen every clip for:

- [ ] Temporal flickering (edges shimmer, details pop in/out between frames)
- [ ] Morphing artifacts (objects blending/transitioning unnaturally)
- [ ] Physics violations (wrong gravity, impossible fabric movement, water flowing wrong)
- [ ] Hand/finger anomalies (wrong count, impossible positions, tool-holding failures)
- [ ] Face uncanny valley (plastic skin, dead eyes, wrong micro-expressions)
- [ ] Color banding or posterization (gradients that step instead of smooth)
- [ ] Inconsistent lighting direction (shadows shifting frame to frame)
- [ ] Repetitive motion loops (same gesture repeating, stuck in cycle)

If ANY artifact is present: regenerate the clip or cut around it. Do not "hope nobody notices."

---

## PHASE 5: VIRAL ARCHITECTURE GATE (Before Publish)

### 5.1 Hook Architecture (First 3 Seconds)

**Verified stat (Mosseri, Jan 2025):** Instagram's algorithm heavily weights the first 3 seconds of a Reel. Aim for 60%+ retention in that window. (Source: dataslayer.ai Instagram Algorithm 2025 Guide.) The hook must contain:

1. **Immediate movement** in the first frame (no static opener, no fade from black)
2. **Text overlay** within 0.5 seconds (**85% of Facebook video is watched muted, ~92% on mobile**. Source: Nieman Lab, niemanlab.org. Instagram muted-viewing is lower, ~40%, but captions still improve completion.)
3. **Curiosity gap** (open a question the viewer wants answered)
4. **Visual motif** (an impossible AI visual that makes them stop scrolling)

### 5.2 Retention Beat Architecture

| Timestamp | What Happens |
|-----------|-------------|
| 0-3s | HOOK: movement + text + curiosity trigger (60%+ retention target) |
| 3-7s | FIRST PAYOFF: deliver the first value beat (fact, visual wow, data point) |
| 7-15s | CORE DELIVERY: this is the optimal retention zone for Reels (see 5.4 below) |
| 50% mark | PATTERN INTERRUPT: shift pacing, new angle, escalate |
| 75% mark | CLIMAX: biggest reveal, strongest visual, key insight |
| Final 2s | CTA: DM keyword call-to-action (text overlay + caption) |

**Verified completion thresholds:**
- **TikTok:** 70%+ completion + 15% early engagement earns ~3x more reach. (Source: beatstorapon.com TikTok algorithm guide.) This is a hard floor on TikTok.
- **Instagram:** No hard completion floor, but 60%+ retention correlates with distribution. Watch time > completion %.

### 5.3 Audio Selection Rules

- Trending audio boosts algorithmic push (check weekly audio scout log)
- Audio MUST sync to visual beats (speed ramps at drops, reveals at peaks)
- Avoid vocals if AI faces are present (draws attention to mouth sync) — exception: Synthesia avatars (purpose-built for mouth sync)
- Instrumental/beat-heavy tracks are safest for AI video
- Never use audio with another platform's watermark (TikTok stamp on IG = reach death)

### 5.4 Platform Dimension and Length Check (Verified 2025-2026)

| Platform | Format | Dimensions | Max Duration | Optimal Range (Verified) |
|----------|--------|-----------|-------------|--------------------------|
| Instagram Reels | 9:16 | 1080x1920 | 90s | 7-15s for max shareability; 30-45s for value content; >90s gets reduced distribution (Mosseri) |
| TikTok | 9:16 | 1080x1920 | 10min | 15-30s optimal; a 45s at 70% completion beats a 15s at 40% |
| YouTube Shorts | 9:16 | 1080x1920 | 60s | 15-60s, SEO indexed |
| Instagram Stories | 9:16 | 1080x1920 | 60s | 15s native, auto-splits |
| Instagram Feed | 4:5 | 1080x1350 | 60s | 1:1 also acceptable |
| Facebook Reels | 9:16 | 1080x1920 | 90s | Outperform feed posts 3-5x in reach |

Sources: joyspace.ai ideal-video-length-social-platform-2026; socialrails.com best-tiktok-video-length-maximum-engagement; dataslayer.ai.

### 5.5 Final Publish Checklist

- [ ] Hook passes the 3-second test (would YOU stop scrolling?)
- [ ] Retention beats at 50% and 75% marks
- [ ] No platform watermarks from other apps
- [ ] Color graded (not raw AI output)
- [ ] Film grain added (1-2%)
- [ ] Audio synced to visual beats
- [ ] Text overlays for silent viewing
- [ ] DM CTA in both text overlay and caption
- [ ] No banned vocabulary in caption (no salesy language, no em dashes)
- [ ] No in-frame branding
- [ ] No real estate visuals (unless listing-specific content)
- [ ] Every artifact screened and resolved
- [ ] Caption includes relevant hashtags (rotate sets)
- [ ] Posted at optimal time (Tue-Thu 8am-4pm Bend time for IG)

---

## PHASE 6: POST-PUBLISH MONITORING

### 6.1 Performance Gates

After publish, monitor:

- **First 100 views:** If completion rate is below 50%, the hook failed. Analyze and learn
- **First 500 views:** If completion rate is below 70% on TikTok, the algorithm will not push it further (verified TikTok threshold). On Instagram, target 60%+ retention
- **Comment sentiment:** "This is AI" comments = failed to post-process adequately. Learn and iterate
- **Share/save ratio:** High DM shares on Instagram = the single most weighted engagement signal (verified via Mosseri Jan 2025). Double down on that content pattern

### 6.2 Feedback Loop

After every video publish:
1. Log performance metrics to `social_metrics_weekly` Supabase table
2. Note which prompt structure produced the best result
3. Note which tool/model produced the best visual quality
4. Update the audio scout log with trending audio performance data
5. If a video breaks 10K views: dissect what worked, document the pattern

---

## ELITE CREATOR REFERENCE (Verified April 2026)

All creators below were verified via web research on 2026-04-15 with direct source URLs. Study their work regularly.

| Creator | Handle | Verified Signature | Primary Tools | Verification Source |
|---------|--------|-------------------|---------------|---------------------|
| PJ Accetturo | @pjacefilms (251K IG) | Photorealistic cinematic AI, CEO of Genre.ai, 275M+ views | Kling 2.0/3.0, Runway, Midjourney | instagram.com/pjacefilms; linkedin.com/in/pj-accetturo |
| Dave Clark | @Diesol | 2nd place $500K Grok Super Bowl ad (6-hour production), DGA filmmaker, co-founder Promise AI | Grok Imagine, Kling, Veo 2, Pika, Midjourney, ElevenLabs | curiousrefuge.com/blog/a-30-second-ai-commercial-won-500k |
| Caleb Ward | Curious Refuge (50K+ community, 5M YT views/yr) | Storyboard/prompt-first methodology, "AI Filmmaking school" | Teaches Pika + Midjourney workflow | hollywoodreporter.com curious-refuge profile |
| Laszlo Gaal | N/A | First AI video transferred to 35mm film (Random Access Memories) — kills digital plastic look | Runway Gen-3 + film stock + 5K scan | petapixel.com/2025/05/09 |
| Nik Kleverov | Native Foreign (Emmy-recognized, women-owned studio) | Directed first Toys R Us AI brand film; OpenAI's first animated feature | Sora (legacy — sunsetting Apr 2026) | nativeforeign.co; kleverov.com |
| Billy Boman | @billy.boman (Stockholm) | Stockholm boutique; Nissan, Google, Klarna, YouTube, Universal Music clients | Cinematic AI (tools not publicly detailed) | billyboman.com/about |
| Paul Trillo | N/A | 400+ clips for "Thank You For Not Answering"; 700 clips (55 selected) for Washed Out Sora music video | Runway Gen-2, Sora (legacy), "painting with AI brushes" | nofilmschool.com; shots.net |

**What they all share (confirmed across all 7 creator profiles):** None of them publish raw AI output. Every frame is graded, treated, and edited. They treat AI as a camera, not a magic wand. They use cinematography vocabulary in prompts, not adjectives. They iterate 3-10x (or in Trillo's case, 50-100x) per shot before selecting the hero.

---

## VIOLATION CONSEQUENCES

If this gate is bypassed and AI slop ships under the Ryan Realty brand:

1. The content is pulled immediately
2. A post-mortem identifies which gate was skipped
3. The specific failure is added to the banned patterns list
4. The skill is updated to prevent recurrence

Matt's words: "You would never, ever, ever, ever, ever create shit like that."

That standard is permanently encoded. No slop. Ever.

---

## CHANGE LOG

- **2026-04-15 (initial):** Skill authored from 7-agent parallel research sweep. All creators, tools, pricing, and statistics verified via web sources with URLs inline.
- Research agent IDs (for audit): ad1d05c621c785f17 (Accetturo), a0f687ec3deb4cf3a (Clark), aaca6a711650c8f18 (Ward), a607a4270964d9cad (Kleverov), a0bf5b479b125c156 (tool landscape), a9134586ca7b6ab1c (Boman/Trillo/Gaal), a6cace6ff8487cc37 (viral stats).
- Corrections applied: Dave Clark = 2nd place not winner; Kleverov uses Sora not Runway; Gaal uses Runway Gen-3 not Veo; "71%/1.3s" stat unsourced → replaced with Mosseri-confirmed 3-second window; "88% muted" → corrected to 85% FB/92% mobile; 70% completion threshold = TikTok-specific only.
