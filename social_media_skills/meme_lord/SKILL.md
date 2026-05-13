---
name: meme_lord
description: "Use this skill whenever the user says 'make me an image meme', 'create a real estate meme', 'I need a meme for Instagram', 'find a meme template for this', 'make something funny about [real estate topic]', 'Drake meme about buyers', 'distracted boyfriend meme for listings', or any request for an image-format social meme (not video — for video memes use meme_content). Image-format viral real estate memes for Instagram and X. Surfaces real templates, real friction points, real Bend market data. Matt writes every punchline. No AI humor (Anti-Slop Rule 9)."
---

# Meme Lord — Image Memes for Instagram and X

## Required references — load these BEFORE producing any content

Two canonical rule layers are non-negotiable inheritance for every Ryan Realty piece. CLAUDE.md "Skill self-binding (2026-05-13)" makes this mandatory.

1. **[`design_system/ryan-realty/SKILL.md`](../../design_system/ryan-realty/SKILL.md)** — visual brand spec. Colors (navy `#102742`, cream `#faf8f4`, sand `#e8e2d4`), three type families (Amboqia Boriango display, Geist sans body/UI, Azo Sans Medium accent), heritage + modern register, mascot Jax, voice rules, banned vocab, the asset cheat sheet, the broker headshots (transparent PNGs).

2. **[`social_media_skills/platform-best-practices/SKILL.md`](../platform-best-practices/SKILL.md)** — 2026 platform rule layer. The cross-platform decision matrix (logo when, agent face when, aspect, length, hook, captions, posting cadence) + the Ryan Realty application matrix (per-surface decisions). Synthesized from research on 30+ top real estate creators.

A piece of content that ships without consulting BOTH of these is non-compliant.

---

**Read `video_production_skills/ANTI_SLOP_MANIFESTO.md` before invoking this skill. The manifesto is the ship gate. This skill enforces Rule 9 (no AI humor), Rule 11 (Matt's voice), Rule 12 (brand visuals), and Rule 13 (Oregon broker compliance, Fair Housing) at every step.**

**MANDATORY — Read `humor_calibration.md` and `humor_patterns.md` before generating any meme concept.** These two files are the humor quality gate. The calibration doc teaches what's funny vs. corny (based on deep study of @thebrokeagent and viral RE meme accounts). The patterns doc has 35+ proven concept structures categorized by humor type. If a generated concept doesn't match the quality bar in those docs, it doesn't ship. Previous output was "corny as hell" — these files exist to fix that.

**Pair-skill:** `video_production_skills/meme_content/SKILL.md` (15-25s video memes via Vlipsy clips). This skill is image-only. If the trend wants a video format, route to `meme_content` instead.

---

## What it is

A workflow for shipping image memes (PNG/JPG, single image or carousel) tuned for Instagram feed, IG Stories, and X (Twitter). The skill does five things:

1. Pulls live trending meme formats and current real estate friction points.
2. Maps each friction point to 3-5 candidate templates from a registry of **actual recognizable meme images** (Drake, Distracted Boyfriend, This Is Fine, Expanding Brain, Woman Yelling at Cat, Change My Mind, Epic Handshake, Gru's Plan, Two Buttons, Always Has Been).
3. Hands Matt the chosen template's slot schema with the friction context, the verified data anchor (when applicable), and voice calibration examples.
4. Composites Matt's punchline onto the real template image using classic meme typography — Impact font, all caps, white fill with black stroke (or template-appropriate label boxes).
5. Renders the final meme to the right platform aspect ratio and queues it for the 30-day human-review window.

The skill never writes the punchline. It surfaces structure, context, and constraint. Matt writes the words.

**The humor is universal real estate, not Bend-specific.** Bend angles get sprinkled in occasionally. The default is broad agent / buyer / seller pain that any RE pro or homebuyer instantly recognizes. Specificity beats locality — "buyers who send 47 Zillow links at 2am" lands everywhere; "Westside Bend buyers who send a Cessna over Drake Park" lands nowhere.

**Output platforms and sizes:**
- Instagram feed: 1080×1080 (square) or 1080×1350 (4:5 portrait, preferred for reach)
- Instagram Stories: 1080×1920 (9:16)
- X / Twitter: 1200×675 (16:9) for inline, 1200×1500 for tall single image

**Cadence cap:** 2 image memes per week per account. Memes are seasoning, not the meal. The `social_calendar` skill enforces the mix ratio.

---

## Why this skill exists separately from `meme_content`

| | `meme_content` (video) | `meme_lord` (image) |
|---|---|---|
| Output | 15-25s MP4 | PNG/JPG single or carousel |
| Source | Vlipsy clip | Template image registry |
| Tool chain | ffmpeg + Remotion | PIL/Pillow + brand fonts |
| Audio | Required (beat-synced or natural) | None |
| Compliance gate | Same | Same |
| Cooldown | 2/week shared cap | 2/week shared cap |

Image memes are cheaper to produce, faster to ship on a breaking trend, and fill the gap when there is no video clip that fits.

---

## The hard rules (read before every invocation)

1. **Rule 9 — No AI humor.** This skill does not generate punchlines. It generates *empty templates with context*. The `voice_grader.md` checklist runs on every Matt-written caption. If it sounds like ChatGPT, kill it.
2. **Rule 11 — Voice constraints.** No semicolons. No em-dashes. No exclamation points outside genuine surprise. No banned AI words (delve, leverage, navigate, robust, in today's market, etc. — full list in manifesto). Short, declarative sentences.
3. **Rule 12 — Brand visuals.** Navy `#102742`, Gold `#D4AF37`, White, Charcoal `#1A1A1A`. Amboqia for headlines >32px, AzoSans for body. No other fonts. No other colors as brand chrome.
4. **Rule 13 — Oregon broker compliance.** Fair Housing screen runs on every meme before render. No protected-class jokes. No steering. No misrepresentation. No forecasting without "this is opinion + verified data" framing.
5. **Rule 7 — Source-verified data.** Every market figure on a meme cites a source in `out/meme_lord/<slug>/citations.json`. LLM-recall numbers do not ship.
6. **Rule 8 — 30-day human-review window.** Every output lands in `out/meme_lord/pending_review/` until Matt approves it. Format graduates to auto-publish only after 30 clean days.
7. **Cooldown — 30 days per template.** No template repeats within 30 days. Registry tracks `last_used`.
8. **Cooldown — 2 memes per week.** Shared with `meme_content`. Algorithm de-prioritizes meme-heavy accounts.

---

## When to invoke

- Weekly trend scan returns an image-format trend (not a video trend)
- Breaking RE-relevant news creates a real-time opening (rate move, MLS data release, NAR settlement update, OREA rule change)
- A specific Bend market data point just shifted enough to merit comment
- Matt explicitly asks for a meme on a topic
- The `social_calendar` weekly mix has an open meme slot

**Do NOT invoke for:**
- More than 2 image memes per week (combined with video memes)
- Trends older than 72 hours
- Topics that contradict data already published this week
- Anything that intersects a Fair Housing protected class
- Generic lifestyle or political content unrelated to RE

---

## Tool chain

| Step | Tool | Cost | Auth |
|------|------|------|------|
| Trend scan | `automation_skills/triggers/trend_trigger` or manual | $0 | — |
| Account intel | Live web check on @thebrokeagent, @zillowgonewild, @re_memes, @therealestatememes, Derrick Gregory | $0 | — |
| Friction map | This skill's `friction_topics.md` library | $0 | — |
| Template registry | `templates/registry.json` | $0 | — |
| Data anchor | Supabase `ryan-realty-platform` (live) | $0 | Service role key |
| Image render | Python + Pillow (`scripts/render_meme.py`) compositing onto real template images in `templates/base_images/` | $0 | Local |
| Voice grader | `voice_grader.md` checklist + manual judgment | $0 | Matt |
| Compliance gate | `compliance_gate.md` checklist | $0 | Matt or reviewer |
| Queue | `automation_skills/automation/post_scheduler` pending_review | $0 | — |

---

## Step-by-step workflow

### Step 1 — Weekly trend scan

Run Monday morning. Sources to check (live, not from training data):

- **Know Your Meme** trending page (https://knowyourmeme.com/memes/trending) — top 10
- **r/MemeEconomy** top of week — early signal on emerging formats
- **TikTok Creative Center** trending visuals (image overlays, not just sounds)
- **X / Twitter** real estate filter — search `real estate` + `mortgage` + `rates`, sort by Top of last 7 days
- **Instagram Explore** — log into the brand account, scroll Explore for hashtag set: `#realestate`, `#bendoregon`, `#realestatehumor`, `#brokerlife`
- **Bellwether accounts** (last 14 days):
  - @thebrokeagent (545K) — agent-to-agent humor benchmark
  - @zillowgonewild (2.2M) — listing absurdity, deadpan format
  - @re_memes (31K) — template recycling, useful for what NOT to do when stale
  - @therealestatememes (20K)
  - Derrick Gregory — character-driven skit benchmark

Output: `out/meme_lord/week_<yyyy-mm-dd>/trend_scan.md` with 1-2 viable image-format trends documented.

A trend is viable only if:
1. It maps to a real RE friction that is currently true
2. There are recognizable image-template variants of it in the wild
3. Matt's voice can say something specific and honest about it
4. It does not touch a Fair Housing protected class

### Step 2 — Friction mapping

For each viable trend, pick the friction category from `friction_topics.md`. Categories include:

- Rate cycle ("should I wait for rates to drop")
- Inventory tension (active listings vs days on market vs months of supply)
- Buyer behavior ("just looking", lowball offers, ghost clients, the "highest and best" panic)
- Seller delusion (Zestimate vs comps, "we put granite in 2007")
- Showing logistics (lockbox fails, neighbor showing up, kid spilling juice)
- Listing photo fails (toilet-mirror selfie, agent reflected in oven door)
- Inspection drama
- Closing day chaos (wire fraud panic, lender pulling docs, garage opener missing)
- Commission conversation (post-NAR settlement)
- Bend-specific (Cascades view that's actually a distant ridge, transplant pricing pressure, short-term rental zoning, wildfire smoke contingency, Old Bend / new Bend / Tetherow / NWX tribal humor)
- MLS workflow (the MLS down meme, agent-to-agent inside-baseball)
- Open house scenarios

Bend-specific topics get priority. Generic RE topics are crowded — the moat is local knowledge.

Document the mapping in the same `trend_scan.md`.

### Step 3 — Template selection

Open `templates/registry.json`. Filter for templates whose `last_used` is more than 30 days ago. Rank by `format_fit_score` for the friction category. Surface the top 3-5 candidate templates.

The registry currently includes:

| Template ID | Format | Best for |
|---|---|---|
| `drake` | Drake Hotline Bling, two-panel reject/approve | Behavior contrast, decision gates |
| `distracted_boyfriend` | Three-figure label image | Choosing between options, scope creep |
| `this_is_fine` | Cartoon dog in burning room | Closing chaos, deal sideways |
| `expanding_brain` | Four-panel escalating brain | Buyer/seller escalation, absurdity ramps |
| `woman_yelling_cat` | Two-panel confrontation | Seller delusion, agent vs client |
| `change_my_mind` | Steven Crowder sign | Provocative single-take |
| `epic_handshake` | Two arms gripping with shared label | Unlikely allies, both sides agreeing |
| `grus_plan` | Four-panel plan-realization | Plans that fall apart on the third step |
| `two_buttons` | Sweating man at impossible choice | Agent dilemmas, no good option |
| `always_has_been` | Astronaut speech / "always has been" | Dark realizations about how the system works |

Each template has a JSON spec in `templates/registry.json` with the base image path, slot schema, format-fit scores per friction category, and current `last_used` date. Base template images live in `templates/base_images/`.

### Step 4 — Data anchor (when applicable)

If the meme references a market figure (rates, median price, months of supply, DOM, inventory count, sale-to-list, absorption), pull it live from Supabase per CLAUDE.md verification rules:

```sql
-- Example: months of supply for SFR Bend, last 30 days
SELECT
  COUNT(*) FILTER (WHERE Status = 'A') AS active,
  COUNT(*) FILTER (WHERE Status = 'C' AND CloseDate >= CURRENT_DATE - INTERVAL '30 days') AS sold_30d,
  ROUND(
    COUNT(*) FILTER (WHERE Status = 'A')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE Status = 'C' AND CloseDate >= CURRENT_DATE - INTERVAL '30 days'), 0),
    2
  ) AS months_of_supply
FROM listings
WHERE PropertyType = 'A' AND City = 'Bend';
```

Print the raw result. Save to `out/meme_lord/<slug>/citations.json`:

```json
{
  "figures": [
    {
      "value": "2.1 months",
      "source": "Supabase ryan-realty-platform.listings",
      "filter": "PropertyType='A', City='Bend', CloseDate >= 2026-03-26",
      "rows": 188,
      "computed": "active / sold_30d = 394 / 188 = 2.1",
      "pulled_at": "2026-04-26T09:14:00-07:00"
    }
  ]
}
```

If the meme has no market figure (pure observational humor), the citations file still exists and notes "no figures used".

### Step 5 — Hand off to Matt

Build a `brief.md` for Matt with:

```markdown
# Meme brief — <yyyy-mm-dd>-<slug>

## Trend
[one sentence describing the trend]

## Friction
[the RE friction this maps to, in one sentence]

## Verified data anchor (if any)
- [figure]: [value] — [trace line from citations.json]

## Voice calibration (real examples to read first)
- [quote a verbatim line from @thebrokeagent or similar that nails the voice for this friction — attribute the source]
- [second example, different account]

## Candidate templates (pick one, fill the slots, voice-check it)
1. drake — slots: top, bottom
2. expanding_brain — slots: panel_1, panel_2, panel_3, panel_4 (escalating)
3. woman_yelling_cat — slots: woman, cat

## Reminders before you write (from humor_calibration.md)
- **Painful specificity.** Use a real number, a real time, a real dollar amount, a real verbatim phrase. "47 Zillow links at 2am" not "too many Zillow links."
- **The joke must hurt a little.** If it doesn't touch a nerve, it won't get shared.
- **Punch yourself, not clients.** Self-deprecating about agents > making fun of buyers/sellers.
- **Text must be funny without the template.** If the text isn't funny as plain text, the concept is too weak.
- No semicolons. No em-dashes. No banned AI words.
- Punchline at the end. Setup at the top.
- **"Would an agent screenshot this and send it to their group chat with no caption?"** If no, it's not funny enough.
- Read `humor_patterns.md` for the pattern that fits this friction.
```

Matt fills the slots. Returns the filled brief.

### Step 6 — Render

Save the filled punchline as a `slots.json` file:

```json
{
  "template": "drake",
  "friction": "buyer_behavior",
  "slots": {
    "top": "Buyers who send a clean offer in their budget",
    "bottom": "Buyers who send 47 Zillow links at 2am asking 'thoughts?'"
  }
}
```

Then run `scripts/render_meme.py`:

```bash
python3 scripts/render_meme.py \
  --template drake \
  --slots out/meme_lord/2026-04-26-zillow-links/slots.json \
  --platform ig_square \
  --out out/meme_lord/2026-04-26-zillow-links/render_ig_square.png
```

Renderer rules:
- The base meme image lives in `templates/base_images/<id>.jpg`. The renderer scales it to fill the platform canvas, letterboxing on whichever axis doesn't match.
- Classic meme typography: Impact font, all caps, white fill with black stroke, fitted to the slot box. Templates with label-box semantics (Distracted Boyfriend, Expanding Brain, Change My Mind, Two Buttons) use Arial Bold black on white instead.
- Slot positions are template-specific and live in `scripts/render_meme.py` per renderer (e.g., `render_drake`, `render_expanding_brain`). Adding a template = a new base image + a new renderer fn + a registry entry.
- Subtle `@ryanrealty` watermark on the bottom-right. Small enough that the meme reads as a meme, not as branded content. No big logo bars or footers — that kills shareability.
- Output dimensions match `--platform`:
  - `ig_square` → 1080×1080
  - `ig_portrait` → 1080×1350
  - `ig_story` → 1080×1920
  - `x_inline` → 1200×675
  - `x_tall` → 1200×1500
- File written to `out/meme_lord/<slug>/render_<platform>.png`.

### Step 7 — Voice grader

Open `voice_grader.md`. Run the 8-question checklist on the rendered meme. Sample questions:

1. Banned-word grep: any hits? (delve, navigate, leverage, robust, "in today's market", etc.)
2. Punctuation: any semicolons, em-dashes, or exclamation points (outside genuine surprise)?
3. Specificity: is there at least one concrete noun (number, place, brokerage, MLS field, listing detail)?
4. Voice test: read aloud. Does it sound like a 40-something Bend principal broker, or like a chatbot trying to be funny?
5. Setup-punchline structure: is the punchline at the end, not the start?
6. Caption explanation: does the caption explain the joke? (it should not)
7. Engagement bait: does the caption use "tag a friend", "double tap if", "comment below"? (banned)
8. Insider-only check: would a non-agent get the joke? If only agents get it, you're capping reach.

A single fail = back to Step 5 with the failure documented.

### Step 8 — Compliance gate

Open `compliance_gate.md`. Run the Fair Housing + misrepresentation checklist:

1. Does the meme touch a protected class (familial status, race, religion, national origin, disability, sex, source of income, sexual orientation, gender identity, marital status)? If yes, kill.
2. Does the meme imply who a property is "right for" based on a protected class? If yes, kill.
3. Does the meme use steering language ("good schools", "family-friendly", "up-and-coming")? If yes, kill.
4. Does the meme reference a specific real listing, agent, or seller in a way they could identify themselves? If yes, generalize to a composite or kill.
5. Does the meme make a forecast without "this is my opinion" framing and a verified data citation? If yes, reframe or kill.
6. Does the meme quote an MLS price for a non-Ryan-Realty listing without ORMLS attribution? If yes, attribute or kill.
7. Does the meme make a political statement? If yes, kill (rate-cycle math is fine, partisan framing is not).
8. Could a reasonable consumer read this as a misrepresentation of property characteristics? If yes, kill.

A single fail = kill the meme. Do not "soften it." Pick a different friction.

### Step 9 — Queue for human review

Move the rendered meme + brief + citations to `out/meme_lord/pending_review/` and surface in `/admin/post-queue` (defined in `automation_skills/automation/post_scheduler/SKILL.md`).

For the first 30 days of this skill running, Matt approves or rejects every meme manually. After 30 clean days, the format graduates to auto-publish status — but the voice grader and compliance gate still run on every render.

### Step 10 — Caption draft

Caption draft lives in `out/meme_lord/<slug>/caption_<platform>.txt`. Per-platform rules:

**Instagram (image meme):**
- 1-3 short sentences
- First 7-9 words must hook (preview cutoff)
- 3-7 hashtags max, mix of one big (#realestate), 2-3 mid (#bendoregon, #pnwrealestate), 1-2 niche (#bendrealtor, #centraloregonhomes)
- No banned engagement bait
- Optional soft CTA: "DM 'BEND' for the weekly market note" — never "Call me!"

**X (image meme):**
- Often best with zero caption — let the image work
- If captioning, one line, no hashtags
- A self-quote-tweet with a follow-up beat is a high-performing pattern
- Thread variant: image meme as tweet 1 + 3-tweet "the data behind this" thread, paired with the corresponding data viz

Caption goes through the same voice grader + compliance gate as the image.

### Step 11 — Post-publish observation

After publish, log the meme in `out/meme_lord/posted_log.csv`:

```csv
date,slug,template,friction,platform,impressions_24h,saves_24h,shares_24h,comment_quality_note
```

The `performance_loop` automation skill ingests this weekly to score template performance and update `templates/registry.json` `format_fit_score` per friction category.

---

## Files in this skill

- `SKILL.md` — this file
- `humor_calibration.md` — **READ FIRST.** The corny-vs-funny rulebook. 7 rules, translation guide, voice examples from @thebrokeagent and viral accounts. The "Would They Screenshot This?" test.
- `humor_patterns.md` — 35+ proven meme concepts categorized by humor pattern (painful specificity, escalation, self-deprecation, verbatim client quotes, dark market commentary, format subversion, insider baseball, the pivot). Use as a reference when generating new concepts.
- `friction_topics.md` — the friction taxonomy library (updated with Specific Pain Scenarios per category)
- `voice_grader.md` — the 8-question voice checklist
- `compliance_gate.md` — the Fair Housing + misrepresentation checklist
- `templates/registry.json` — template registry with cooldowns, slot schemas, and format-fit scores per friction
- `templates/base_images/` — the actual meme template images (Drake, This Is Fine, Expanding Brain, etc.)
- `templates/brand_tokens.json` — platform sizes and brand color tokens (used by some renderers for caption bars)
- `scripts/render_meme.py` — Pillow compositor: loads base image, fits to platform canvas, overlays Impact-style caption text per template-specific slot positions
- `samples/slots/` — slot files for each sample (template + filled punchline + caption draft)
- `samples/renders/` — 10 rendered sample memes proving each template ships clean output

---

## Sources used to build this skill

- `video_production_skills/ANTI_SLOP_MANIFESTO.md` (the ship gate)
- `video_production_skills/meme_content/SKILL.md` (sister skill, video format)
- Live web check on @thebrokeagent (545K), @zillowgonewild (2.2M), @therealestatememes (20K), @re_memes (31K), Derrick Gregory (April 2026)
- CLAUDE.md (data verification rules, design system, voice rules)
- Deep research pass (April 2026): The Close "68 Hilarious RE Memes", HousingWire "75 RE Memes", AgentWealthHustle "105 Funny RE Memes", Propphy "100 RE Memes Agents Share 2026", NowBam "Top 10 Broke Agent Posts", NowBam "How to Create Hyper-Local Memes", Lighter Side of Real Estate "26 Snarkiest Memes", BAM "Summer RE Memes", Eric Simon interviews (Real Estate Rockstars, Placester, Massive Agent Podcast). 129+ specific meme concepts extracted and analyzed.

Last reviewed: 2026-04-26.
