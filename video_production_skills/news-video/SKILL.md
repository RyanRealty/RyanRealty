---
name: news-video
description: |
  Produce 1-3 daily real-estate news videos for Instagram Reels / TikTok / FB
  Reels. Pulls top national real-estate stories from last 24-72h, verifies
  every stat against primary sources, maps each to a Bend / Central Oregon
  counterpart stat from Supabase, writes 30-45s scripts in Matt's voice,
  narrates them with the Victoria ElevenLabs voice, sources licensed imagery,
  and renders 1080x1920 portrait Remotion videos with burn-in captions.
triggers:
  - "news video"
  - "run the news"
  - "daily news reel"
  - "real estate news today"
  - "rundown on real estate news"
  - "produce a news drop"
dependencies:
  - WebSearch + WebFetch (primary source verification)
  - Supabase ryan-realty-platform (Bend counterpart stats)
  - ElevenLabs API (voice ID qSeXEcewz7tA0Q0qk9fH = "Victoria" — Ryan Realty Anchor)
  - Unsplash API (primary image source) + Shutterstock API (fallback)
  - Remotion 4.0.290 project at /sessions/stoic-sweet-dirac/work/news_video
  - ffmpeg (compression, thumbnail extraction)
  - Resend (email delivery to matt@ryan-realty.com)
related_skills:
  - market-data-video (shares the Remotion base + brand components)
  - engineering:code-review (before shipping any composition changes)
  - engineering:deploy-checklist (if pushing the auto-scheduled job to prod)
---

# News Video — Production Recipe

## Purpose

Turn the morning's top 3 U.S. real-estate news stories into three 30-45
second vertical videos that:

1. Lead with a stat shock or question bait in the first 3 seconds (muted-feed rule).
2. Translate the national story into a buyer/seller action for this week.
3. Anchor to a Bend/Central OR counterpart stat (from Supabase, verified live).
4. Close on a DM hook (DM-to-likes is 3-5x stronger per viral-stats memory).
5. Use brand voice: direct, no fluff, no salesy language, no em dashes.

Brand: Ryan Realty. Colors: navy `#102742`, gold `#D4AF37`. Fonts: Amboqia
(serif headlines) + AzoSans Medium (body). Voice: Victoria — Ryan Realty
Anchor.

## Full daily pipeline (run time: ~15-20 min wall)

```
1. DISCOVER  (2-3 min, Sonnet subagent)
   └─ WebSearch across: Inman, HousingWire, NAR, Realtor Mag, WSJ RE,
      NYT RE, Axios RE, Redfin News, Zillow Research, Bend Bulletin, OPB.
   └─ Output: 15-20 candidate stories with URL + headline + snippet.

2. SCORE + RANK  (30 sec, Opus)
   └─ Each story scored 0-10 on:
      • Freshness (today=10, 48h=4)
      • Bend relevance (macro rate move=10, NYC-only=2)
      • Hook potential (surprise, reversal, stat shock)
      • Actionability this week
   └─ Output: Top 3 with justification trace.

3. VERIFY  (2-3 min, Opus)
   └─ WebFetch each primary source (NAR, Freddie Mac, Zillow, etc).
   └─ Every number that lands on screen gets a source URL trace.
   └─ If a stat can't be verified, it gets cut.
   └─ Per CLAUDE.md data-accuracy mandate — non-negotiable.

4. BEND OVERLAY  (2 min, Opus + Supabase MCP)
   └─ For each story, run SQL on listings/listing_history for the
      corresponding local stat. Example counterparts:
        rate story  → Bend SFR median close ClosePrice * payment math
        forecast    → Bend SFR MoS + YoY close median delta
        sales vol   → Bend SFR 4.63 MoS vs national 4.1
   └─ Store every query + raw row count in verification_trace.md.

5. SCRIPT  (1-2 min, Opus)
   └─ Per story: 30-45 sec, structure below.
   └─ No em dashes, no hyphens in prose, no salesy words.
   └─ Output: scripts.json with slug, script, key_stat, sources, beats[].

6. VOICEOVER  (30-60 sec, ElevenLabs)
   └─ Voice ID: qSeXEcewz7tA0Q0qk9fH (Victoria). Model eleven_turbo_v2_5.
   └─ Settings: stability 0.50, similarity_boost 0.75, style 0.35, use_speaker_boost true.
   └─ After synth, call /v1/forced-alignment to get word-level caption timings.

7. VISUALS  (2-3 min, Sonnet subagent)
   └─ For each beat: check asset_index.sqlite first, else Unsplash API.
   └─ Download 6 images per story, save to public/images/{slug}_{n}.jpg.
   └─ Write manifest.json with photographer, license, unsplash_id.

8. RENDER  (3-5 min, Remotion)
   └─ 1080x1920, 30fps. Ken Burns on every photo. Word-level captions.
   └─ Persistent top chrome (headline bar) + bottom chrome (@MattRyanRealty).
   └─ `npm run render:1`, `render:2`, `render:3` in news_video/ project.

9. COMPRESS  (30 sec, ffmpeg)
   └─ libx264 CRF 24, preset slow, +faststart, scaled 1080x1920.
   └─ Target: <4 MB per story (IG upload ceiling).

10. PACKAGE + DELIVER  (30 sec, Resend)
    └─ Email digest.html to matt@ryan-realty.com with:
       - 3 MP4 attachments
       - Scene thumbnails (inline cid:)
       - IG / TikTok / FB caption drafts per story
       - Source trace per stat (verification_trace.md summary)
```

## Per-story script structure (30-45 sec total)

```
0:00-0:03  HOOK           Stat shock / question / pattern break.
                          Big number on screen. Captions on.
0:03-0:08  CONTEXT        One sentence: what happened, primary source.
0:08-0:25  TRANSLATION    What it means for a buyer/seller this week.
                          Concrete dollars, not abstract concepts.
0:25-0:38  BEND ANGLE     Verified Supabase stat that grounds the
                          national move in Bend's market.
0:38-0:45  CTA            "DM me 'X' and I'll send Y" — DM bait beats
                          like bait 3-5x in the algorithm.
```

## Voice rules (non-negotiable)

- **No em dashes** in the script (memory: copy-writing rules).
- **No hyphens in prose** — spell "three year" not "three-year" (helps TTS, matches brand).
- **Never state the obvious about the reader** (e.g. don't say "if you're a homeowner…").
- **Never salesy** — no "Don't miss out!", "Call today!", "Act now!".
- **Always concrete over abstract** — "$229/mo" beats "a meaningful savings."
- **End on a question** (prompts DM, boosts algorithmic signal).

## Visual rules

- No houses/families/keys/porch-lights unless it's the closing CTA. Stock photos of real estate are slop.
- Every static image gets a Ken Burns pan+zoom. Flat holds = amateur.
- Background tint: navy gradient bottom-to-top, 25% → 65% opacity. Never lets the image compete with text.
- Text overlay: Amboqia 140-220pt center; sub in AzoSans 32pt gold.
- Active-word caption in gold, inactive in white, navy scrim at bottom.

## Where this runs

Working Remotion project: `/sessions/stoic-sweet-dirac/work/news_video`

- `src/NewsStory.tsx` — per-story composition
- `src/Root.tsx` — registers 3 compositions (Story01, Story02, Story03)
- `public/scripts.json` — story data (slug, script, key_stat, beats)
- `public/audio/*.mp3` — Victoria VO per story
- `public/audio/*.json` — ElevenLabs forced-alignment (word-level timing)
- `public/images/*.jpg` — 6 images per story (Ken-Burns'd)
- `out/story_0{1,2,3}_raw.mp4` — rendered, pre-compression
- `out/story_0{1,2,3}.mp4` — compressed for IG (< 4 MB)

## Scheduling for daily automation

Use the `schedule` skill to run daily at 6:00 AM Pacific:

```
schedule: news-video
  interval: "0 6 * * *"  # 6am daily
  deliver_to: matt@ryan-realty.com
  count: 3
```

Matt reviews drafts in email, picks the 1-3 that ship, posts them manually
to IG/TikTok/FB. Future enhancement: auto-post via Meta Graph API once
approval flow is codified (see Meta Graph key in .env.local).

## Verification trace requirement (compliance)

Every stat on screen must have a verification row in
`out/verification_trace.md` with:

```
$STAT — $SOURCE — $URL — $FETCH_TIMESTAMP — $METHOD
```

Example:
```
6.23% — Freddie Mac PMMS — https://www.freddiemac.com/pmms —
  2026-04-24T14:20Z — WebFetch, quote verbatim: "30-year fixed-rate mortgage
  averaged 6.23% as of April 23, 2026"
```

This is mandatory per CLAUDE.md DATA ACCURACY MANDATE. No trace, no ship.

## Known gotchas

- **Font timeout during render**: delayRender for FontFace.load() hits
  28s worker timeout. Use CSS @font-face injection with font-display:
  block instead (see src/fonts.ts).
- **Unsplash German stock photos**: Unsplash sometimes returns European
  finance screenshots (German "HEUTE"/"WOCHE"). For USA news videos,
  add `&location=united-states` or query filters that skew American.
- **Caption gold-highlighting flicker**: forced-alignment JSON may have
  tokens with 0-length windows. Buffer with +0.05s `end` tolerance in Captions.tsx.
- **Victoria voice profile**: middle-aged American, conversational, warm,
  trustworthy, relatable. Designed for explainer videos, viral social, and
  modern brand VO. Saved on Matt's ElevenLabs account as "Victoria — Ryan
  Realty Anchor." For a custom American anchor, clone Matt's own voice and
  swap `VOICE_ID_VICTORIA` → `VOICE_ID_MATT` (future enhancement).
