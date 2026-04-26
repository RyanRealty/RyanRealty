# Viral Video Quality Gate — 6-Phase Hard Gate (MANDATORY)

## Enforcement: ABSOLUTE

This is a hard gate. **No AI-generated video content leaves this system without passing every check below.** No exceptions. No "we'll fix it in post." No "good enough for a draft." If a check fails, the content does not ship.

This gate applies to ALL video content: Reels, TikTok, YouTube Shorts, Stories, listing video, market commentary video, neighborhood spotlights, AI-generated B-roll, photo-to-video animations, text-to-video generations, avatar video. Everything.

**Source provenance:** All creator profiles, tool specs, and statistics in this skill were verified via web research on 2026-04-15. Inline citations where the claim originates from a specific source. Claims without citations are Matt's hard brand rules.

**Master skill cross-reference:** This skill is the hard-gate companion to [VIDEO_PRODUCTION_SKILL.md](../VIDEO_PRODUCTION_SKILL.md) §6. The master skill's quality gate is the technical render check (blackdetect, length, beat caps); this gate is the upstream architecture / prompt / artifact / publish check.

---

## PHASE 1 — Concept gate (before any prompt is written)

### 1.1 Three questions every concept must answer

1. **What is the scroll-stop hook?** State it in one sentence. If you can't, the concept isn't ready.
2. **What is the viewer's reward for watching to the end?** A fact, a reveal, an emotion, a laugh. If there's no payoff, scrap it.
3. **Which AI strength does this leverage?** The concept MUST play to what AI does BETTER than cameras, not what AI does worse.

### 1.2 AI strength/weakness matrix

**ALWAYS use AI for (high-confidence zones):**
- Morphing transitions (object A → object B)
- Impossible camera movements (spatial warps, scale shifts, perspective breaks)
- Macro / abstract cinematography (textures, patterns, nature close-ups)
- Surreal physics (water flowing upward, gravity-defying, time manipulation)
- Scale transitions (macro → aerial → macro in one shot)
- Data visualization overlays on cinematic B-roll
- Seasonal / weather impossible (snowfall in summer, perfect golden hour on demand)

**NEVER use AI for (high-failure zones):**
- Human face close-ups (mouth sync, micro-expressions, eye contact) — except via Synthesia, which handles mouth sync natively (see [`../news_video/SKILL.md`](../news_video/SKILL.md))
- Hand detail work (fine motor, tool use, gestures)
- Eating or drinking (lip/swallow coordination)
- Dialogue-heavy content — except Synthesia
- Human-to-human interaction (handshakes, hugs, conversation)
- Everyday human actions where viewers have lifetime experience to judge
- Animals with precise movement patterns (running dogs, birds in flight)

**CONDITIONAL (use only with elite prompting):**
- Wide shots of distant people walking
- Interior room reveals (focus on space, not people)
- Aerial / drone-style footage (generally safe, watch for physics breaks)

### 1.3 Ryan Realty content rules (non-negotiable)

- **Zero real estate visuals in viral / brand video.** No houses, keys, families, interiors, porch lights, sold signs. Stats are the only housing tether. Visuals are science / nature / macro / abstract ONLY. Exception: listing-specific video where the property IS the subject (see [`../listing_launch/SKILL.md`](../listing_launch/SKILL.md)).
- **Zero in-frame branding.** No logo, name, phone, URL inside the video frame. IG handle in caption is the only attribution. In-frame branding kills virality.
- **DM CTA on every single post.** "DM me [keyword]" in caption. Mosseri Jan 2025 confirmed "Sends Per Reach" (DM shares) is a top-3 ranking factor — weighted 3–5× higher than likes. (Source: dataslayer.ai Instagram Algorithm 2025; gonetech.net share-to-view analysis.)
- **No em-dashes in any text. No hyphens in prose copy.** Matt's hard copy rule.
- **Never salesy.** No "dream home", "luxury living", "act now", urgency language.

---

## PHASE 2 — Prompt engineering gate (before any API call fires)

### 2.1 Mandatory format

Block format only. Narrative prose paragraphs are BANNED. Full template + banned vocabulary list is in [`../ai_platforms/SKILL.md`](../ai_platforms/SKILL.md). Re-read that file before composing any prompt.

### 2.2 Reference pull requirement

Before writing any prompt:

1. Pull 2–3 reference prompts from established libraries (`awesome-grok-imagine-prompts`, `awesome-seedance-2-prompts`, Sirio Berati framework, Curious Refuge patterns).
2. Study the structure, not the content. Adapt the structural pattern to your concept.
3. Note which model the reference was built for. Prompt syntax varies across Kling, Veo, Runway, Grok.

### 2.3 Pre-fire checklist

- [ ] Prompt in block format (not prose)
- [ ] Zero banned vocabulary
- [ ] 2–3 reference prompts pulled and studied
- [ ] Concept passes the AI strength/weakness matrix
- [ ] Negative prompt included
- [ ] Duration specified (not default)
- [ ] Aspect ratio specified (9:16 for Reels/TikTok/Shorts; 16:9 for YT long-form; 1:1 for feed)
- [ ] **Matt has seen the brief and approved BEFORE the API call fires**

If ANY check fails: STOP. Fix the prompt. Do not generate.

---

## PHASE 3 — Generation gate (during API call)

### 3.1 Tool selection matrix

Full pricing/access table in [`../ai_platforms/SKILL.md`](../ai_platforms/SKILL.md). Summary:

| Need | Tool |
|------|------|
| Hero shot, top quality | Kling 3.0 |
| Multi-character dialogue | Kling 3.0 |
| Cost-effective API | Veo 3.1 |
| Pro camera control | Runway Gen-4.5 |
| Physics + natural-language object edits | Luma Dream Machine |
| Photo-to-video default | Kling 2.1/3.0 i2v |
| Static image gen | Flux Pro / Midjourney / Grok Imagine |
| Speed / value iteration | Grok Imagine |
| Stock-avatar presenter | Synthesia (see news_video skill) |

### 3.2 Deprecations you must know

- **Sora is sunsetting** — app April 26, 2026; API September 24, 2026. Source: help.openai.com/en/articles/20001071-sora-1-sunset-faq. Do NOT build new pipelines on Sora.
- **Kling 3.0 shipped Feb 5, 2026** — currently #1 on video-gen ELO benchmarks.
- **Luma raised $900M Series C** — Project Halo compute cluster + "Modify with Instructions" natural-language object edit.

### 3.3 Generation parameters

- Always specify aspect ratio explicitly
- Always include negative prompt
- Generate 3–5 variations minimum per shot concept
- Never publish first generation — compare, select, iterate
- Log every generation (model, prompt, seed, result quality) for pattern learning

### 3.4 Multi-tool elite-creator workflow

No elite creator uses one tool. Confirmed across all 7 profiles in §"Elite Creator Reference":

1. Concept iterations in cheap/fast tool (Kling 2.1, Grok Imagine Speed)
2. Hero shot in quality tool (Kling 3.0, Veo 3.1, Runway Gen-4.5)
3. Enhancement in Topaz Video AI (denoise + upscale)
4. Color grade in DaVinci Resolve or CapCut (kill the digital plastic look)
5. Edit + audio in CapCut (beat sync, text overlays, transitions)

Paul Trillo: 400+ clips for "Thank You For Not Answering"; 700 clips → 55 selected for Washed Out Sora music video. Accept a 95%+ reject rate as the cost of elite quality. (Source: nofilmschool.com)

---

## PHASE 4 — Post-processing gate (after generation, before publish)

### 4.1 Never publish raw AI output

This is the single biggest rule separating elite creators from slop merchants.

- Laszlo Gaal's signature: transferring AI video to 35mm/16mm film stock and scanning back — specifically to "remove the plastic feel." Source: petapixel.com/2025/05/09.
- PJ Accetturo's distinction: "photorealistic cinematic output" (not stylized or obvious AI).

Every clip gets:

1. **Color grading** — warm/cool the palette, add contrast, match a film stock look. Even a basic LUT in CapCut transforms raw output.
2. **Film grain** at 1–2% to add texture and mask temporal artifacts.
3. **Lens effects** — subtle vignette, minimal chromatic aberration.
4. **Speed ramping** synced to audio beats (slow at reveals, fast through transitions).
5. **Audio layering** — music + ambient + SFX, not a single track.

### 4.2 Artifact detection checklist

Before the clip advances to edit, screen for:

- [ ] Temporal flickering (edge shimmer, details popping in/out)
- [ ] Morphing artifacts (objects blending unnaturally)
- [ ] Physics violations (gravity, fabric, water flowing wrong)
- [ ] Hand/finger anomalies (wrong count, impossible position, tool failure)
- [ ] Face uncanny valley (plastic skin, dead eyes, wrong micro-expressions)
- [ ] Color banding / posterization (gradients stepping)
- [ ] Inconsistent lighting direction (shadows shifting frame to frame)
- [ ] Repetitive motion loops (gestures stuck in cycle)

If ANY artifact is present: regenerate or cut around it. Do NOT "hope nobody notices."

---

## PHASE 5 — Viral architecture gate (before publish)

### 5.1 Hook architecture (first 3s)

Mosseri Jan 2025: Instagram's algorithm heavily weights the first 3 seconds. Aim for 60%+ retention in that window. (Source: dataslayer.ai.) Hook must contain:

1. **Immediate movement** in frame 1 (no static opener, no fade from black)
2. **Text overlay** within 0.5s (85% of FB video watched muted, ~92% on mobile — source: Nieman Lab. IG muted-viewing ~40% but captions still improve completion.)
3. **Curiosity gap** — open a question
4. **Visual motif** — an impossible AI visual that stops the scroll

### 5.2 Retention beat architecture

| Timestamp | What happens |
|-----------|--------------|
| 0–3s | HOOK: movement + text + curiosity (60%+ retention target) |
| 3–7s | FIRST PAYOFF: deliver the first value beat |
| 7–15s | CORE DELIVERY: optimal Reels retention zone |
| 50% | PATTERN INTERRUPT: shift pacing, new angle |
| 75% | CLIMAX: biggest reveal |
| Final 2s | CTA: DM keyword (text overlay + caption) |

**Verified completion thresholds:**
- TikTok: 70%+ completion + 15% early engagement → ~3× more reach. (Source: beatstorapon.com.) Hard floor on TikTok.
- Instagram: no hard floor, but 60%+ retention correlates with distribution. Watch time > completion %.

### 5.3 Audio rules

- Trending audio boosts algorithmic push (weekly Monday scout)
- Audio MUST sync to visual beats (speed ramps at drops, reveals at peaks)
- Avoid vocals if AI faces are present (draws attention to mouth sync) — exception: Synthesia
- Instrumental / beat-heavy = safest for AI video
- Never use audio with another platform's watermark (TikTok stamp on IG = reach death)

### 5.4 Platform dimension + length check (verified 2025–2026)

| Platform | Format | Dimensions | Max | Optimal |
|----------|--------|------------|-----|---------|
| Instagram Reels | 9:16 | 1080×1920 | 90s | 7–15s for shareability; 30–45s for value; >90s gets reduced distribution (Mosseri) |
| TikTok | 9:16 | 1080×1920 | 10min | 15–30s optimal; a 45s at 70% completion beats a 15s at 40% |
| YouTube Shorts | 9:16 | 1080×1920 | 60s | 15–60s, SEO-indexed |
| IG Stories | 9:16 | 1080×1920 | 60s | 15s native, auto-splits |
| IG Feed | 4:5 | 1080×1350 | 60s | 1:1 also acceptable |
| FB Reels | 9:16 | 1080×1920 | 90s | Outperform feed 3–5× in reach |

Sources: joyspace.ai, socialrails.com, dataslayer.ai.

### 5.5 Final publish checklist

- [ ] Hook passes the 3-second test (would YOU stop scrolling?)
- [ ] Retention beats at 50% and 75%
- [ ] No platform watermarks from other apps
- [ ] Color graded (not raw AI)
- [ ] Film grain added (1–2%)
- [ ] Audio synced to visual beats
- [ ] Text overlays for silent viewing
- [ ] DM CTA in both text overlay AND caption
- [ ] No banned vocabulary in caption
- [ ] No in-frame branding
- [ ] No real estate visuals (unless listing-specific)
- [ ] Every artifact screened and resolved
- [ ] Caption hashtags rotated (don't reuse same set)
- [ ] Posted at optimal time (Tue–Thu 8am–4pm Bend time for IG)

---

## PHASE 6 — Post-publish monitoring

### 6.1 Performance gates

- **First 100 views:** completion <50% → hook failed. Analyze and learn.
- **First 500 views:** completion <70% on TikTok → algorithm won't push further. On IG, target 60%+.
- **Comment sentiment:** "this is AI" comments = post-processing inadequate. Iterate.
- **Share / save ratio:** high DM shares on IG = the most weighted engagement signal (Mosseri Jan 2025). Double down on that pattern.

### 6.2 Feedback loop

After every publish:

1. Log metrics to `social_metrics_weekly` Supabase table
2. Note which prompt structure produced the best result
3. Note which tool/model produced the best visual quality
4. Update audio scout log
5. If a video breaks 10K views: dissect what worked, document the pattern

---

## ELITE CREATOR REFERENCE (verified April 2026)

| Creator | Handle | Verified signature | Primary tools | Source |
|---------|--------|--------------------|---------------|--------|
| PJ Accetturo | @pjacefilms (251K IG) | Photorealistic cinematic AI; CEO of Genre.ai; 275M+ views | Kling 2.0/3.0, Runway, Midjourney | instagram.com/pjacefilms; linkedin.com/in/pj-accetturo |
| Dave Clark | @Diesol | 2nd place $500K Grok Super Bowl ad (6-hour production); DGA filmmaker; co-founder Promise AI | Grok Imagine, Kling, Veo 2, Pika, Midjourney, ElevenLabs | curiousrefuge.com/blog/a-30-second-ai-commercial-won-500k |
| Caleb Ward | Curious Refuge (50K+ community, 5M YT views/yr) | Storyboard/prompt-first methodology; "AI Filmmaking school" | Pika + Midjourney workflow | hollywoodreporter.com curious-refuge profile |
| Laszlo Gaal | — | First AI video transferred to 35mm film (Random Access Memories) — kills digital plastic | Runway Gen-3 + film stock + 5K scan | petapixel.com/2025/05/09 |
| Nik Kleverov | Native Foreign (Emmy-recognized, women-owned) | Directed first Toys R Us AI brand film; OpenAI's first animated feature | Sora (legacy — sunsetting Apr 2026) | nativeforeign.co; kleverov.com |
| Billy Boman | @billy.boman (Stockholm) | Stockholm boutique; Nissan, Google, Klarna, YouTube, Universal Music | Cinematic AI (tools not publicly detailed) | billyboman.com/about |
| Paul Trillo | — | 400+ clips for "Thank You For Not Answering"; 700 clips (55 selected) for Washed Out Sora music video | Runway Gen-2, Sora (legacy), "painting with AI brushes" | nofilmschool.com; shots.net |

**What they all share (across all 7 profiles):** None publish raw AI output. Every frame is graded, treated, edited. They treat AI as a camera, not a magic wand. They use cinematography vocabulary in prompts, not adjectives. They iterate 3–10× per shot (Trillo: 50–100×).

---

## VIOLATION CONSEQUENCES

If this gate is bypassed and AI slop ships under the Ryan Realty brand:

1. The content is pulled immediately
2. A post-mortem identifies which gate was skipped
3. The specific failure is added to the banned patterns list
4. The skill is updated to prevent recurrence

Matt's words: "You would never, ever, ever, ever, ever create shit like that." That standard is permanently encoded. No slop. Ever.

---

## CHANGE LOG

- **2026-04-15 (initial):** Skill authored from 7-agent parallel research sweep. All creators, tools, pricing, statistics verified via web sources with URLs inline.
- Research agent IDs (audit): ad1d05c621c785f17 (Accetturo), a0f687ec3deb4cf3a (Clark), aaca6a711650c8f18 (Ward), a607a4270964d9cad (Kleverov), a0bf5b479b125c156 (tool landscape), a9134586ca7b6ab1c (Boman/Trillo/Gaal), a6cace6ff8487cc37 (viral stats).
- Corrections applied: Dave Clark = 2nd place not winner; Kleverov uses Sora not Runway; Gaal uses Runway Gen-3 not Veo; "71%/1.3s" stat unsourced → replaced with Mosseri-confirmed 3-second window; "88% muted" → corrected to 85% FB / 92% mobile; 70% completion threshold = TikTok-specific only.
- **2026-04-26:** Ported into `video_production_skills/quality_gate/` as part of unified library consolidation. No content changes other than cross-references updated to new repo paths.
