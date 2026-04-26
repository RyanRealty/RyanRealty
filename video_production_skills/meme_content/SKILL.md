---
name: meme_content
description: "15-25s trend-jacking meme clips. Vlipsy clip + ffmpeg + Remotion text overlay. Real estate friction mapped to real trends. Matt's voice only — no AI humor."
---

# Meme Content — Trend-Jacking with Vlipsy Clips

**Read `video_production_skills/VIDEO_PRODUCTION_SKILL.md` before writing any composition code. All hard constraints (hook, length, branding) apply. Read `video_production_skills/ANTI_SLOP_MANIFESTO.md` — the text grader pass in this skill is the most important quality gate.**

---

## What it is

Short-form reaction and trend-jacking clips (15-25 seconds) that anchor a recognizable internet moment to a specific, honest real estate friction point. The format uses a clip sourced from vlipsy.com (pre-trimmed, searchable reaction database), overlays on-screen text in Matt's voice, and ships as an IG Reel, TikTok, or YT Short. The clip is the hook that stops the scroll. The text is the real estate content that earns the follow.

This format lives or dies on authenticity. If the text sounds like it was written by a chatbot trying to be funny, it gets killed. The standard is: would a 40-something Bend principal broker who has seen 20 years of cycles actually post this, or does it sound like a social media intern's prompt output?

**Platforms:** IG Reels (1080×1920), TikTok (1080×1920), YT Shorts (1080×1920).

**Output length:** 15-25 seconds. Hard cap. A 26-second meme is a failed meme.

---

## When to invoke

- Weekly trend scan returns 1-2 viable trends (see Step 1)
- A Fed announcement, MLS data release, or public conversation about interest rates or market timing creates a real-time opening
- Matt explicitly flags a trend or topic
- `social_calendar/SKILL.md` weekly content calendar has a meme slot open

Do NOT invoke for:
- More than 2 meme clips per week per account (algorithm de-prioritizes accounts that only post memes — see `social_calendar/SKILL.md` for content mix ratios)
- Any trend that is more than 72 hours old (trend shelf life is short; stale trend = no reach)
- Any trend that contradicts verified data recently published (e.g., posting a "market is slow" meme the same week you posted a data viz showing 2.1 months of supply)
- Any clip where fair-use status is unclear (see Step 2 for the review)
- Any trend unrelated to real estate friction — no lifestyle flexing, no political commentary, no national news unless directly tied to mortgage rates or housing policy

---

## Tool chain

| Step | Tool | Cost | Auth |
|------|------|------|------|
| Trend scan | Manual weekly scan or `automation_skills/triggers/trend_trigger` | $0 | — |
| Clip search | vlipsy.com | Free | None required |
| Clip download | vlipsy.com download or `yt-dlp` | $0 | — |
| Clip trim | ffmpeg | $0 | — |
| Text overlay | Remotion `MemeComp` | $0 | Node env |
| Text grader | Manual review (per quality gate) | $0 | Judgment required |
| Final encode | ffmpeg x264 CRF 24 | $0 | — |

---

## Step-by-step workflow

### Step 1 — Weekly trend scan

Run the trend scan Monday morning (or trigger `automation_skills/triggers/trend_trigger` if configured). The scan checks:
- TikTok trending sounds and formats (via TikTok Creative Center — no API needed, manual browse)
- IG Reels trending audio (via Creator Studio)
- Twitter/X real estate conversations (search `real estate` + `mortgage` + `rates` — trending topics)
- Reddit r/FirstTimeHomeBuyer, r/RealEstate top posts of the week

Criteria for a viable trend:
1. The trend maps to a real estate friction point that is currently true (not manufactured)
2. The trend is active now — posts in the last 48 hours are getting traction
3. There is a recognizable reaction clip on vlipsy.com that fits the moment
4. Matt's voice can say something honest and specific about this friction — not just a generic "I know, right?"

**Real estate friction categories that consistently map to memes:**
- Interest rate announcements and buyer psychology
- "I'll wait until rates drop" timing decisions
- Inventory vs buyer demand tension
- First-time buyer reality check moments
- The gap between national real estate headlines and Bend market reality
- Open house traffic observations
- Seller pricing expectations vs actual comps
- The "should I wait or buy now" cycle

Document the two selected trends in `out/meme_content/week_<yyyy-mm-dd>/trends.md`:

```markdown
# Trend selections — week of <date>

## Trend 1
- Trend: [describe the trend in one sentence]
- Platform origin: [TikTok / IG / Reddit / Twitter]
- Real estate friction: [the specific friction this maps to]
- Verified data support: [cite data we have published or can verify — or note "no data needed, observation-based"]
- Vlipsy search terms: [2-3 search terms to find the clip]
- Draft text: [first draft of the on-screen text in Matt's voice]

## Trend 2
[same structure]
```

### Step 2 — Fair-use review

Before downloading any clip, confirm it passes the fair-use review:

| Factor | Check | Pass condition |
|--------|-------|---------------|
| Source | Is the clip from vlipsy.com? | vlipsy.com clips are pre-cleared for social use |
| Length | Is the clip under 6 seconds? | Under 6s is commentary/reaction use |
| Transformation | Is the on-screen text transformative? | Text must comment on or recontextualize the clip — not just repeat it |
| Commercial use | Is the video monetized? | Ryan Realty videos are commercial — note this increases scrutiny |

If the clip is not on vlipsy.com (e.g., it's a direct TV/film clip), do not use it. Stop and find a different clip on vlipsy. Do not proceed with legally uncertain sources.

Log the fair-use review in `out/meme_content/week_<yyyy-mm-dd>/fairuse_log.txt`:

```
Clip: [vlipsy URL]
vlipsy cleared: yes
Length after trim: [X seconds]
Transformative use: yes — text recontextualizes clip as real estate commentary
Commercial use noted: yes
Decision: APPROVED
```

### Step 3 — Download and trim the clip

```bash
# Download from vlipsy (vlipsy provides direct MP4 links)
curl -L "<vlipsy_direct_mp4_url>" \
  -o out/meme_content/week_<yyyy-mm-dd>/<slug>/clip_source.mp4

# Inspect duration
ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1 \
  out/meme_content/week_<yyyy-mm-dd>/<slug>/clip_source.mp4

# Trim to the exact reaction moment needed (identify start and end times by watching)
ffmpeg -i out/meme_content/week_<yyyy-mm-dd>/<slug>/clip_source.mp4 \
  -ss <start_time> -t <duration> \
  -c copy \
  out/meme_content/week_<yyyy-mm-dd>/<slug>/clip_trimmed.mp4
```

Trimmed clip should be 3-8 seconds. The Remotion text overlay runs on top of the clip. Total video = trimmed clip + text hold + optional freeze frame. Max 25 seconds total.

### Step 4 — Scale clip to portrait

Most vlipsy clips are horizontal (16:9). Scale and crop to 9:16:

```bash
ffmpeg -i out/meme_content/week_<yyyy-mm-dd>/<slug>/clip_trimmed.mp4 \
  -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" \
  out/meme_content/week_<yyyy-mm-dd>/<slug>/clip_portrait.mp4
```

Watch the portrait crop. If the crop cuts off the reaction face or the key visual, adjust the crop position:

```bash
# Shift crop to the left by 200px to center a face
ffmpeg -i out/meme_content/week_<yyyy-mm-dd>/<slug>/clip_trimmed.mp4 \
  -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:x_offset:0" \
  out/meme_content/week_<yyyy-mm-dd>/<slug>/clip_portrait.mp4
```

### Step 5 — Write the on-screen text

This step requires judgment. The text must pass the voice grader in Step 6. Write it first, then grade it.

**Format options:**

**Option A — Setup/punchline (two text blocks):**
```
[Block 1 — appears over the clip, sets the real estate situation]
[Block 2 — appears at the clip's reaction moment, delivers the honest observation]
```

**Option B — Running commentary:**
```
[Block 1 — first observation]
[Block 2 — second observation, adds depth]
[Block 3 — specific, concrete detail that makes it real]
```

**Voice rules (non-negotiable):**
- No semicolons
- No em-dashes
- No AI language: "delve", "leverage", "in today's market", "it's worth noting", "certainly"
- No marketing language: "amazing opportunity", "competitive market", "now more than ever"
- No made-up statistics (if you reference a number, it must be verified — see next point)
- If the text references any market number (DOM, price, supply), it must match the current verified Supabase data. Cross-check against `out/data_viz/Bend_<latest>.json` before writing it in.
- Sentences end with periods, not ellipses
- No hashtags in the on-screen text (they go in the IG caption)
- No call to action in the video frame ("Call me today" is banned in frame — it goes in the caption)

**Good example (buyer timing meme, after a rate uptick):**

```
[Block 1 — over the clip setup]:
"Waiting for rates to drop before buying"

[Block 2 — over the reaction]:
"Meanwhile, 198 active listings in Bend. 2.1-month supply."
```

The second block is a data reference. Confirm those numbers against `out/data_viz/Bend_<latest>.json` before finalizing.

**Bad example (would fail the voice grader):**
```
"When buyers keep saying they're waiting for rates to drop 😂"
"But the market is still incredibly hot right now!"
```
Fails: emoji in frame, "incredibly hot" is generic marketing language, no data reference.

### Step 6 — Text grader pass (mandatory)

Read every word of the on-screen text aloud. Ask:

**Grader questions:**
1. Does this sound like Matt (direct, Bend-specific, no fluff) or like a social media account trying to be relatable?
2. Is there anything in this text that would embarrass a licensed broker if screenshotted out of context?
3. Does any number in the text contradict data we have published in the last 30 days?
4. Is any claim in the text verifiable, or is it an opinion stated as fact?
5. Does the trend map honestly to a real estate situation, or is it forced?

If the answer to question 1 is "social media account" — kill the meme, start over with different text.
If the answer to question 2 is "yes" — kill the meme.
If the answer to question 3 is "yes" — fix the number or kill the meme.
If the answer to question 4 is "opinion as fact" — rewrite to state it as Matt's observation, not a universal truth.
If the answer to question 5 is "forced" — kill the meme. Do not post a forced trend-jack.

Log the grader result in `out/meme_content/week_<yyyy-mm-dd>/<slug>/grader_log.txt`:

```
Grader pass: [PASS / FAIL]
Q1 (voice): [answer]
Q2 (broker screenshot): [answer]
Q3 (data contradiction): [answer — note JSON file cross-checked]
Q4 (fact vs opinion): [answer]
Q5 (trend fit): [answer]
Decision: [APPROVED / KILLED — reason]
```

### Step 7 — Remotion composition

`MemeComp` at `video/meme_content/src/MemeComp.tsx`.

```typescript
type MemeProps = {
  clipSrc: string;          // portrait-cropped clip
  textBlocks: Array<{
    text: string;
    startSec: number;
    durationSec: number;
    position: 'top' | 'center' | 'bottom';
  }>;
  orientation: 'portrait';
};
```

Text overlay styles:
- Font: AzoSans Medium (not Amboqia — meme format uses the body font for readability at small sizes)
- Size: 52px minimum
- Color: white
- Background: black pill with 70% opacity, 12px radius, 24px horizontal padding
- Safe zone enforced: text stays within 900×1400 px centered area
- No gold, no navy — meme format uses neutral pill to not distract from the clip

Render:

```bash
npx remotion render \
  video/meme_content/src/index.ts \
  MemeComp \
  out/meme_content/week_<yyyy-mm-dd>/<slug>/meme_render.mp4 \
  --props="$(cat out/meme_content/week_<yyyy-mm-dd>/<slug>/remotion_props.json)" \
  --concurrency=1
```

### Step 8 — Post-render quality gate

```bash
# Duration check
ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1 \
  out/meme_content/week_<yyyy-mm-dd>/<slug>/meme_render.mp4

# Blackdetect
ffmpeg -i out/meme_content/week_<yyyy-mm-dd>/<slug>/meme_render.mp4 \
  -vf blackdetect=d=0.05:pix_th=0.05 -an -f null - 2>&1 | grep black_

# Frame extraction
ffmpeg -i out/meme_content/week_<yyyy-mm-dd>/<slug>/meme_render.mp4 \
  -vf fps=4 out/meme_content/week_<yyyy-mm-dd>/<slug>/qa_frames/frame_%03d.jpg

open out/meme_content/week_<yyyy-mm-dd>/<slug>/qa_frames/
```

Watch the full render. One final gut check: would Matt actually post this?

### Step 9 — Final encode

```bash
ffmpeg -i out/meme_content/week_<yyyy-mm-dd>/<slug>/meme_render.mp4 \
  -c:v libx264 -crf 24 -preset medium \
  -movflags faststart \
  -c:a aac -b:a 128k \
  out/meme_content/week_<yyyy-mm-dd>/<slug>/meme_final.mp4
```

---

## Anti-slop guardrails

Read `video_production_skills/ANTI_SLOP_MANIFESTO.md` before QA. Critical rules:

- **No AI humor.** If the joke was generated by an LLM without being grounded in a specific, true observation about the Bend market, it is AI humor. Kill it. Real estate meme content is specific — "198 active listings" is specific. "The market is wild right now" is not.
- **No unrelated trend hijacking.** The trend must map honestly to a real estate friction. Using a TikTok food trend with "when your mortgage payment is bigger than your grocery bill" is a forced reach. "When Bend inventory hits 198 listings and rates tick up the same week" maps to something real.
- **No clips without fair-use review.** Every clip gets logged in `fairuse_log.txt`. No exceptions.
- **No trend that contradicts recently published data.** If we posted that months of supply is 2.1 (seller's market) on Monday, we cannot post a meme implying buyers have all the leverage on Tuesday. Data consistency is a brand trust issue.
- **No data numbers in frame without verification.** Any market statistic referenced in the on-screen text must be cross-checked against `out/data_viz/Bend_<latest>.json` or Supabase, and documented in the grader log.
- **No meme posts during active listing under contract** (pending/closing week) — the social calendar should flag this conflict; confirm with `social_calendar/SKILL.md` calendar check.
- **Manifesto rules 1, 4, 6** apply: no hallucinated data, no recycled/stale content, no deceptive framing of market conditions.
- **Manifesto rule 8** (human review gate): for first 30 days of format use, every meme gets Matt's eyes before posting.

---

## Brand rules

- **Colors in frame:** White text, black semi-transparent pill. No navy. No gold. The brand colors stay out of the meme format — the meme clip is the visual, not the brand frame.
- **Font:** AzoSans Medium only. Not Amboqia — headline fonts on memes look like ads.
- **No logo in frame.** No brokerage name in frame. No "Ryan Realty" text overlay.
- **No phone number in frame.**
- **No agent name in frame.**
- **Attribution in caption only:** "@MattRyanRealty | ryan-realty.com" goes in the IG/TikTok caption, not the video frame.
- **No emojis in on-screen text.** Emojis go in the caption.

---

## Data verification

Any market number referenced in the on-screen text requires a verification entry in `grader_log.txt`:

```
active_count: 198 — listings, Status='Active', PropertyType='A', City='Bend', pulled [date] from out/data_viz/Bend_<date>.json
months_supply: 2.1 — same source
```

If the meme text does not contain any market numbers, note "No market data referenced" in the grader log.

---

## Quality gate checklist

**Pre-render:**
- [ ] `trends.md` written with trend selection rationale for both clips
- [ ] Trend is active within the last 72 hours (not stale)
- [ ] Fair-use review completed for both clips, logged in `fairuse_log.txt`
- [ ] Trend does not contradict any data published in the last 30 days
- [ ] Text grader pass completed and logged in `grader_log.txt`
- [ ] All market numbers in text cross-checked against current Supabase data
- [ ] Voice rules check passed (no semicolons, no em-dashes, no banned words)
- [ ] Portrait crop of clip reviewed (reaction face/key visual not cut off)
- [ ] No VO needed for this format (meme clips are typically silent with on-screen text only — confirm)

**Post-render:**
- [ ] `ffprobe` duration: 15-25 seconds (hard cap)
- [ ] `ffmpeg blackdetect` returns zero black sequences
- [ ] Text blocks appear at the correct timing relative to the clip's reaction moment
- [ ] No logo, brokerage name, phone, or agent name in frame
- [ ] Text is legible (contrast check — white pill on whatever the clip's background is)
- [ ] File size under 50 MB (memes are short — 100 MB is overkill; flag if over 50)
- [ ] Grader log documents PASS decision with answers to all 5 questions
- [ ] **Human review gate for first 30 days** (per ANTI_SLOP_MANIFESTO rule 8)

---

## Output paths

```
out/meme_content/week_<yyyy-mm-dd>/
  trends.md                         # Trend selection rationale
  <slug>/
    clip_source.mp4                 # Downloaded vlipsy clip
    clip_trimmed.mp4                # Trimmed to reaction moment
    clip_portrait.mp4               # Scaled to 1080×1920
    remotion_props.json             # Render props
    meme_render.mp4                 # Remotion output
    meme_final.mp4                  # CRF 24 deliverable
    qa_frames/                      # Extracted QA frames
    fairuse_log.txt                 # Fair-use review record
    grader_log.txt                  # Text grader pass/fail log
```

---

## See also

- `video_production_skills/VIDEO_PRODUCTION_SKILL.md` — master constraints (length, hook, branding)
- `video_production_skills/data_viz_video/SKILL.md` — source for any market numbers referenced in meme text
- `video_production_skills/social_calendar/SKILL.md` — content calendar slot and weekly mix ratios
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — enforced rules, especially the voice and data rules
- `automation_skills/triggers/trend_trigger` — automated weekly trend scan (if configured)
