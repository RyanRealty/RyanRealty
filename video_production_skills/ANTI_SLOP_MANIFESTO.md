# Anti-Slop Manifesto

**This document is the ship/no-ship gate for every piece of content Ryan Realty publishes — video, image, copy, caption, comment, DM, ad, email, automated post.** Every skill in `video_production_skills/`, `social_media_skills/`, and `automation_skills/` references this file. If a deliverable violates a rule, it does not ship. There is no override. There is no "this one time."

The cost of slop is not aesthetic. Matt is a licensed Oregon principal broker. Ryan Realty's license, reputation, and lead pipeline are on the line every time a piece of content goes out. AI slop, generic real estate language, and unverified data are the three fastest ways to look like every other agent in Bend and to torch trust we cannot rebuild.

This file outranks speed, style, cost, and every other instruction. Read it before you write a caption. Read it before you scaffold a Remotion comp. Read it before you queue a post.

---

## Rule 1 — No generic real estate language

**Banned words and phrases (do not appear in any caption, VO, on-screen text, email, blog, ad, listing description, or comment reply):**

- stunning
- nestled
- boasts
- coveted
- dream home
- charming
- must-see
- gorgeous
- pristine
- meticulously maintained
- entertainer's dream
- one-of-a-kind (unless literally true and verifiable)
- truly
- breathtaking
- spacious (use the actual square footage)
- cozy (use the actual square footage)
- luxurious (let the photos and price decide)
- updated throughout (list what was updated)
- a rare opportunity
- this won't last long
- priced to sell
- hidden gem
- tucked away

**Why:** Every other agent in the country uses these. Zillow descriptions are a sea of them. The moment a Ryan Realty piece reads like a Zillow blurb, we look like the other 1.5 million agents — generic and skippable. Matt's voice is direct, factual, and confident. The house is good or it is not. The numbers carry it.

**How to apply:** Pre-publish grep. Every video script, caption, and listing copy gets run through a banned-word filter. A hit blocks the publish. Replacement is always more specific: "stunning kitchen" → "Wolf range, Sub-Zero, marble counters." "Nestled in the trees" → "Eight tenths of an acre, mature ponderosa." "Boasts a primary suite" → "Primary suite is 420 sqft with a private deck."

---

## Rule 2 — No AI-generated photos passed off as real

**No image that purports to show the listing, the neighborhood, the agent, the team, or any real place may be AI-generated.** No Midjourney exterior. No DALL-E interior. No Grok-Imagine "what the kitchen could look like." No upscaled-then-restyled photo where the AI hallucinates new windows.

**AI is allowed for:**
- Abstract backgrounds (data viz fills, gradient atmospherics)
- Logo treatments
- Conceptual illustrations clearly labeled as such ("concept", "illustration")
- Stylized hooks that are obviously not photographic

**AI is forbidden for:**
- Anything representing real property
- Anything representing real people
- Anything representing real Bend/Central Oregon geography
- "Enhanced" listing photos where AI invents detail

**Why:** Misrepresentation is a license violation. A buyer who sees an AI-generated front yard and shows up to a different yard has a real claim. Beyond compliance, audiences spot AI photos in seconds in 2026 — the watermark of slop is now obvious to consumers, and anyone who detects one image assumes everything else is fake too.

**How to apply:** Every photographic asset in any deliverable must trace to a source: photographer name + shoot date, MLS photo ID, Matt's iPhone, drone operator, or licensed stock with provider + ID. The trace lives next to the asset in source control. No trace, no use.

---

## Rule 3 — No robotic voice. ElevenLabs only, natural cadence

**All voice-over uses ElevenLabs.** Not Synthesia avatar TTS for VO unless the avatar is on screen and the voice is the avatar's voice. Not Apple TTS. Not browser SpeechSynthesis. Not Google WaveNet. Not OpenAI TTS.

**Voice settings (ElevenLabs):**
- Stability: 0.45–0.55 (flat reads sound robotic, too low sounds drunk)
- Similarity boost: 0.75
- Style: 0.30–0.45 (some emphasis, not theatrical)
- Speaker boost: on
- Output: 22050 Hz minimum, mono is fine for VO bed

**Pronunciation overrides (mandatory):**
- "Deschutes" → input as `duh-shoots` phonetically. Never let the model say "des-CHEW-tees."
- "Tumalo" → input as `TOO-muh-low`. Two syllables emphasized first.
- "Sisters" stays as is.
- "Tetherow" → input as `TETH-er-oh`.
- "Awbrey" → input as `AW-bree`.
- "Terrebonne" → input as `tair-uh-BONE`.
- Verify any new street or place name with a Bend native pronunciation check before render.

**Cadence rules:**
- No commas where Matt wouldn't pause.
- Numbers spelled out for ElevenLabs ingestion: "475,000" → "four hundred seventy five thousand". Otherwise the model fumbles.
- No "in today's market" openings (see Rule 4).
- Sentences are short. Two clauses, max. If you cannot say it in one breath, rewrite.

**Why:** A robotic VO is the loudest signal that a piece of content was AI-assembled with no human in the loop. Audience drop-off at second 1.5 is the cost.

**How to apply:** Every render's audio track gets a 30-second listen pass before the video ships. If you cannot tell from the first sentence that a real person is reading, kill the render and re-tune.

---

## Rule 4 — No "in today's real estate market" openings

**Banned opening patterns (the first 5 seconds of any video, the first sentence of any caption, the subject line of any email):**

- "In today's real estate market..."
- "Have you ever wondered..."
- "Did you know that..."
- "Let's talk about..."
- "Are you thinking about buying/selling..."
- "Welcome to..."
- "Today we're going to..."
- "Hey guys..."
- "What's up..."
- Anything that delays the actual content past second 1.

**Why:** The first 2 seconds determine whether the algorithm shows the post to a second viewer. A formulaic opener is an instant scroll-past. The statement is also a tell — every AI-generated real estate video on TikTok in 2026 opens this way.

**How to apply:** First-frame test. Cover everything except the first 2 seconds of video and the first 6 words of caption. Does that alone make a viewer stop scrolling? If not, rewrite.

The replacement is a hook anchored in something specific — a number that just changed, a property feature that's unusual, a question the viewer is already asking. "Median price in Redmond just dropped 4.2% in 30 days." is an opening. "In today's real estate market, things are changing." is not.

---

## Rule 5 — No watermark-less AI video. Always disclose AI enhancement

**Any video that includes AI-generated imagery, an AI avatar, or AI-extended footage must carry an AI disclosure pill on screen for at least the first 5 seconds of the AI-affected portion.**

- Pill: 12px white text on 50% navy background, bottom-left, "AI-enhanced" or "AI avatar"
- Synthesia avatars: pill says "AI avatar" and stays for entire avatar segment
- AI-generated establishing shots (sky replacement, atmospheric overlays): pill says "AI-enhanced" for first 5s of that segment
- Captions on social posts that include AI imagery must include `#AIAssisted` in hashtag set

**Why:** FTC guidance on AI disclosure tightens every quarter. Real estate is a regulated industry. Disclosure protects the license and removes the "you tricked me" argument from any future complaint. It also costs us nothing — viewers who care will appreciate the honesty, viewers who don't won't notice.

**How to apply:** Every Remotion comp that imports an AI-generated asset auto-inserts the disclosure pill component. Pre-render gate fails if any AI asset is present without a corresponding pill in the timeline.

---

## Rule 6 — No generic stock music. Beat-synced or no music

**Every video either uses a track that has been beat-detected and synced to the cuts, or it uses no music at all and runs on natural audio plus VO.**

- Use the existing `audio_sync` skill in `video_production_skills/audio_sync/` for beat detection
- Cuts land on beats — primary cuts on downbeats, secondary cuts on subdivisions
- No royalty-free elevator loop. No "epic cinematic" Epidemic Sound default. No Artlist top-of-page generic.
- Track choice ladders to register: under $500K = upbeat indie or hip-hop instrumental, $500K–$1M = balanced cinematic, over $1M = sparse piano or atmospheric

**Why:** Music that doesn't match the cut signals "no editor was here." Audiences feel it even when they cannot articulate it. A beat-synced cut at the same content level outperforms an unsync'd cut by 2-3x retention in our test data.

**How to apply:** No render ships without an audio-sync trace JSON next to the render — the file lists every cut frame and the beat it lands on. If cuts are off-beat by more than 4 frames at 30fps, the render fails QA.

---

## Rule 7 — No content without verified data from market_pulse_live or Beacon

**Every market statistic, every listing figure, every neighborhood claim, every comparison, every trend statement must trace to:**

- Supabase `ryan-realty-platform` → `market_pulse_live` (live), `listings`, or other documented table
- ORMLS direct pull (with timestamp)
- Beacon (Beacon Reports — check `references/` for connection if/when added)
- NAR official data
- Census ACS / BLS / FRED / Case-Shiller
- A linked primary-source URL

**LLM-recall is not a source.** "I remember the median was around $475K" is not a source. "GPT-4 told me" is not a source. A number from a previous render's hard-coded array is not a source unless re-pulled in this session.

**The verification trace pattern (mandatory, per CLAUDE.md):**

> "$475K median — Supabase listings, PropertyType='A', City='Redmond', CloseDate 2026-01-01..2026-04-19, median(ClosePrice) = $475,000 over 188 rows"

Every figure on screen, in caption, in VO, in email, in listing copy gets a trace line. The traces ship next to the deliverable in `out/<deliverable>/citations.json`.

**Why:** This rule is duplicated from CLAUDE.md because it is the most important rule. Bad data = license risk. Bad data = trust loss. Bad data = the brand dies.

**How to apply:** No deliverable ships without a `citations.json` next to the render. The ship gate diff-checks every number that appears in any visible asset against the citations file. A number with no citation = ship blocked.

---

## Rule 8 — No posting without human review for first 30 days of any new format

**The first 30 days of any new format (new skill in `video_production_skills/` or new automation pipeline in `automation_skills/`) require Matt to manually review and approve every output before it posts.**

After 30 days of clean output, the format graduates to auto-publish status. Until then, every render lands in `out/<format>/pending_review/` and surfaces in `/admin/post-queue` (defined in `automation_skills/automation/post_scheduler/SKILL.md`). Matt approves or rejects with one click.

**Why:** Every new format has hidden failure modes — a Remotion bug that misrenders one specific photo aspect ratio, a CountUp that displays the wrong unit, a VO mispronunciation we didn't catch in voice tuning. Catching these in prod with the audience watching is expensive. Catching them in pending_review is free.

**How to apply:** Each automation skill ships with a `humanReviewWindow: { days: 30, default: 'on' }` config object. The post_scheduler refuses to publish a piece tagged with a format whose review window is still open and whose `pending_review` flag has not been cleared by human action.

---

## Rule 9 — No AI humor. Real clips, real cultural references only

**Memes, trend-jacks, and humor-driven posts use real human cultural artifacts — vlipsy clips, real-life voiceover trends, real audio from TikTok's trending tab.**

- No ChatGPT-written punchlines
- No AI-generated reaction images
- No "make a joke about" prompts to any LLM
- No "in the style of [comedian]" generated content
- Real clip + Matt's actual reaction or commentary

**Why:** AI is bad at humor. It is mediocre at best, and audiences have been burned by enough AI-generated "jokes" that detection is now a reflex. A 40-something Bend broker telling a real joke about interest rates lands. An AI joke about interest rates is excruciating.

**How to apply:** The `meme_content` skill enforces this — every meme post has a "voice grader" pass before render. The grader question: "Does this sound like a 40-something Bend broker, or like ChatGPT trying to be funny?" Honest answer required. If the second, kill it.

---

## Rule 10 — No engagement bait that does not deliver

**Every hook, every thumbnail, every caption opener must accurately represent what the viewer gets if they keep watching/reading.**

- Thumbnail says "$2M house" → the video must show a $2M house
- Hook says "the price just dropped" → the video must lead with the price drop
- Caption says "the one thing nobody tells you about closing costs" → the post must contain that thing, in the first 30% of content, named explicitly

**Banned engagement bait patterns:**
- "Wait until you see the end..."
- "You won't believe what happened..."
- "The agent's reaction was priceless..."
- Cliffhanger that resolves in a different post
- Thumbnail with text that does not appear in video

**Why:** Audiences who feel tricked unfollow. Algorithms detect short-watch-time-after-strong-CTR and demote. Bait wins one impression and loses ten.

**How to apply:** Pre-publish content/thumbnail consistency check. Every thumbnail's hook text must appear verbatim or near-verbatim in the video's first 33%. Captions get the same check.

---

## Rule 11 — Matt's voice rules (writing constraints, all formats)

**These are non-negotiable for every word that ships under Matt's name or Ryan Realty's brand.**

### Punctuation
- **No semicolons.** Period.
- **No em-dashes.** No en-dashes used as em-dashes. No hyphens used as dashes. If a sentence wants a dash, split it into two sentences.
- **No ellipses unless quoting trailed-off speech.**
- **Oxford comma: use it.**

### Word choice
- **No AI-language tells:** "delve", "leverage", "tapestry", "underscore", "navigate", "embark", "myriad", "robust", "seamless", "comprehensive", "pivotal", "transformative", "elevate", "empower", "unlock", "unleash", "harness", "foster", "facilitate", "in the realm of", "at the intersection of", "in this rapidly evolving landscape"
- **No "I'm thrilled to..."**, "I'm excited to...", "delighted to..." opening business emails
- **No corporate softeners:** "I just wanted to..." → cut the "just wanted to". "I was hoping to..." → cut. Direct request.

### Sentence structure
- **Short. Declarative.**
- **No more than one subordinate clause per sentence.**
- **Active voice. Subject does the verb.**
- **No "as you may know"** or other hedges.

### Tone
- **Honest, genuine, direct.**
- Confidence without bragging. The numbers do the bragging.
- Warmth without performance. No exclamation points outside genuine surprise.
- Specific over general always. "Eight-tenths of an acre with mature ponderosa" beats "private wooded lot" every time.

**How to apply:** Every text deliverable runs through a voice-rules linter before publish. Hits = ship blocked until rewrite.

---

## Rule 12 — Brand visual standards (non-negotiable)

### Colors
- **Navy: #102742** — primary brand
- **Gold: #D4AF37** — accent, never used for body text
- **White: #FFFFFF** — light text on dark
- **Charcoal: #1A1A1A** — dark text on light

No other colors as primary brand elements. Photo content can be any color obviously. UI chrome, data viz pills, logo treatment, end cards — Navy + Gold + White + Charcoal only.

### Typography
- **Amboqia** — all headlines, all on-screen video text bigger than 32px, all logo lockups
- **AzoSans** — all body copy, all captions on-screen smaller than 32px, all email body, all blog body
- No Helvetica. No Arial. No system-ui. No fallback to default. If the font fails to load, the render fails.

### Logo
- Logo lockups live in `Logo_Animations/` (do not modify)
- Minimum size: 120px wide on a 1080px-wide canvas
- Clear space: 0.5x logo height on every side
- Never on a busy photo without a navy scrim
- White-on-navy or navy-on-white only. Never gold-on-white (illegible).

### End cards
- 5 seconds maximum
- Logo + phone (541-XXX-XXXX) + URL (ryanrealty.com or current production domain) + tagline if used
- Black background with subtle navy gradient or solid navy with gold accent line
- No animated logo unless using one of the existing `Logo_Animations/` presets

**How to apply:** Every Remotion composition imports brand tokens from a shared `brand.ts` file (define if not present). Direct hex values fail the design lint. Any deliverable missing brand colors or using an off-brand color blocks at QA.

---

## Enforcement — the ship gate

Before any deliverable ships, sends, posts, renders, or commits, the orchestrator (or the human in the loop during the 30-day window) verifies:

1. **Voice rules pass.** Banned-word grep clean. No semicolons. No em-dashes. No AI filler.
2. **Data trace exists.** Every number has a citation in `citations.json`.
3. **Source trace exists.** Every photographic asset has a source line.
4. **AI disclosure present** (if AI assets used).
5. **Beat sync trace** (if music used).
6. **Brand tokens used** (no hex literals in components).
7. **Voice grader pass** (does it sound like Matt, not like ChatGPT).
8. **Engagement honesty pass** (thumbnail/hook/content match).
9. **Format-review-window check** (still in 30-day window? human approval present?).

A single failure = no ship. Fix the failure. Do not override. Do not "this one is special."

---

## Why this manifesto exists

Anthropic's models (and every other vendor's) make slop trivially easy to produce. The ceiling for "passable" content has dropped to a few seconds of prompting. The floor for *trustworthy* content has not moved — it still requires verified data, real photos, real voice, real review.

Ryan Realty's edge is that we do the floor work. We pull real numbers. We use real photos. We write in a real voice. We disclose what's AI. We catch the things automation misses by reviewing every output for 30 days before letting it run loose.

If that work feels expensive in the moment, remember: a single bad listing description, a single misrepresented photo, a single fabricated stat costs more than a year of careful production. The license is the asset. The trust is the moat. Nothing in the content engine is allowed to put either at risk.

This file is the operating constraint. Every skill cites it. Every render checks it. Every post passes through it. No exceptions.

---

*Last reviewed: 2026-04-26. Next review: when a new format launches or a violation ships (whichever first).*
