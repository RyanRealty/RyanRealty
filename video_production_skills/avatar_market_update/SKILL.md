---
name: avatar_market_update
description: "Weekly 60s Synthesia avatar market pulse video. Mon 5am Supabase pull → constrained script → Synthesia API render → Remotion branded wrap. Mandatory AI disclosure pill."
---

# Avatar Market Update — Synthesia Weekly Stats Delivery

**Read `video_production_skills/VIDEO_PRODUCTION_SKILL.md` and `CLAUDE.md` (Data Accuracy section) before running this pipeline. Data accuracy rules outrank all other instructions. Avatar disclosure is mandatory — no exceptions.**

---

## What it is

A weekly Monday-morning 60-second video where a Synthesia avatar (Matt's likeness preferred, fallback to a configured professional avatar) delivers the Bend metro market pulse. The avatar reads a 180-word-max script generated from a live Supabase pull. The raw Synthesia MP4 is wrapped in a Remotion composition that adds a branded 5-second intro, animated stat overlays synced to the script, a 5-second CTA end card, and a 5-second contact end card. The format is distinct from `data_viz_video/SKILL.md` — that format is all animated charts, no avatar. This format is avatar-forward with supporting overlays.

**Platforms:** IG Reels (1080×1920), TikTok, YT Shorts, LinkedIn (1920×1080 crop for professional reach).

**Output length:** exactly 60 seconds (5 + 45 + 5 + 5 structure).

**Cadence:** Monday AM, published before 9 AM Pacific. Triggered by `social_calendar/SKILL.md` or by the Monday automation cron.

---

## When to invoke

- Monday 5 AM automated trigger (weekly pulse)
- Significant market event requiring immediate broadcast (Fed rate decision, MLS anomaly, large inventory shift)
- On-demand at Matt's request for a specific city or topic

Do NOT invoke for:
- Any script that cannot be verified against fresh Supabase data (no stale data, no "I think the number is around...")
- Weeks where `market_pulse_live` has not refreshed (check `last_updated` before proceeding — block and alert if stale)
- Scripts that exceed 180 words (the Synthesia render of a longer script will run over the 45-second avatar window)

---

## Tool chain

| Step | Tool | Cost | Auth |
|------|------|------|------|
| Data pull | Supabase `market_pulse_live` | $0 | `SUPABASE_SERVICE_ROLE_KEY` |
| Script generation | `generate_avatar_script.py` | $0 | — |
| Voice rule enforcement | `check_voice_rules.py` | $0 | — |
| Synthesia render | Synthesia API | ~$0.07/sec | `SYNTHESIA_API_KEY` |
| MP4 fetch | Synthesia API poll + download | $0 | Same key |
| Remotion wrap | `AvatarMarketComp` | $0 | Node env |
| Final encode | ffmpeg x264 CRF 24 | $0 | — |

Synthesia cost estimate: 45-second avatar section = ~$3.15 per video at current pricing. Confirm pricing tier with current API docs before budget approval.

---

## Step-by-step workflow

### Step 1 — Pull market data (same as data_viz_video Step 1-3)

Run the data pull and verification from `data_viz_video/SKILL.md` Steps 1-3. This skill shares the same data source. If the data pull has already been run this morning (check `out/data_viz/Bend_<today>.json` exists and `query_run_at` is within the last 2 hours), reuse that JSON — do not re-pull.

```bash
# Check if today's data is fresh
TODAY=$(date +%Y-%m-%d)
if [ -f "out/data_viz/Bend_${TODAY}.json" ]; then
  AGE=$(python -c "
import json, datetime
d = json.load(open('out/data_viz/Bend_${TODAY}.json'))
t = datetime.datetime.fromisoformat(d['query_run_at'].replace('Z',''))
print((datetime.datetime.utcnow() - t).seconds // 60)
")
  echo "Data age: ${AGE} minutes"
  if [ "$AGE" -lt 120 ]; then
    echo "Reusing fresh data snapshot."
    DATA_FILE="out/data_viz/Bend_${TODAY}.json"
  fi
fi
```

If no fresh data exists, run the full pull:

```bash
python video_production_skills/data_viz_video/pull_market_data.py \
  --city "Bend" \
  --property-type "A" \
  --output "out/data_viz/Bend_${TODAY}.json" \
  --period-months 3
```

Verify metrics per `data_viz_video/SKILL.md` Step 3 before generating the script.

### Step 2 — Generate the avatar script

The script generator uses a constrained template — not an LLM free-form response. The template is fixed structure; only the numbers change.

```bash
python video_production_skills/avatar_market_update/generate_avatar_script.py \
  --data-file "out/data_viz/Bend_${TODAY}.json" \
  --avatar-type "matt"  \
  --output "out/avatar_market_update/Bend_${TODAY}_script.txt"
```

**Script template (third-person framing when avatar is not Matt; first-person only when avatar is confirmed to be Matt's licensed likeness):**

When avatar is Matt's likeness (first-person):

```
Bend real estate. Week of [date].

The median close price is [median_price]. That is [yoy_pct] [up/down] from this time last year.

Homes are averaging [dom_avg] days on market. [Faster/Slower] than last quarter.

We have [active_count] active listings right now. [months_supply]-month supply. [Market classification].

Sale-to-list is [sale_to_list_pct]. Sellers are getting [sale_to_list_pct] of asking.

Bottom line: [one direct factual sentence derived from the data — no opinion language, no "I think", no forward-looking claims].

For a detailed breakdown, visit ryan-realty.com.
```

When avatar is NOT Matt's likeness (third-person — mandatory):

```
Ryan Realty's Bend market update. Week of [date].

The median close price is [median_price]. That is [yoy_pct] [up/down] from one year ago.

[...same structure but "Ryan Realty's market" and "the data shows" — never "I" unless the avatar IS Matt.]

For a full breakdown, visit ryan-realty.com.
```

**Word count check:** the generator enforces 180-word maximum. If the generated script exceeds 180 words, it trims the "bottom line" sentence until it fits.

### Step 3 — Enforce voice rules

```bash
python video_production_skills/avatar_market_update/check_voice_rules.py \
  --script "out/avatar_market_update/Bend_${TODAY}_script.txt"
```

The checker flags:
- Semicolons (banned)
- Em-dashes (banned)
- Banned words: "leverage", "delve", "stunning", "nestled", "boasts", "coveted", "dream home", "in today's market", "it's worth noting", "certainly", "absolutely"
- "approximately", "roughly", "about" before any number
- Forward-looking price predictions ("will increase", "expected to rise")
- First-person "I" when avatar is configured as third-person

Fix any flags before proceeding. The voice rules are non-negotiable.

### Step 4 — Submit to Synthesia API

```bash
python video_production_skills/avatar_market_update/render_synthesia.py \
  --script "out/avatar_market_update/Bend_${TODAY}_script.txt" \
  --avatar-id "$SYNTHESIA_AVATAR_ID" \
  --voice-id "$SYNTHESIA_VOICE_ID" \
  --background "office_branded" \
  --output-dir "out/avatar_market_update/Bend_${TODAY}/" \
  --poll-interval 60
```

The script submits the render request and polls the Synthesia API until the video is ready, then downloads the MP4 to `out/avatar_market_update/Bend_${TODAY}/synthesia_raw.mp4`.

**Avatar ID configuration:**

- Matt's likeness avatar: `SYNTHESIA_AVATAR_ID` env var — set by Matt after Synthesia likeness approval
- Fallback professional avatar: hardcoded fallback ID in `render_synthesia.py` (update when Synthesia changes their avatar library)

If the API returns an error or the render takes more than 30 minutes, log the error to `out/avatar_market_update/Bend_${TODAY}/render_error.log` and alert via the monitoring channel. Do not substitute a different avatar silently.

### Step 5 — Verify Synthesia output

```bash
# Duration check — avatar section must be 40-50s (will be trimmed/padded to 45s in Remotion)
ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1 \
  out/avatar_market_update/Bend_${TODAY}/synthesia_raw.mp4

# Visual QA — extract frames at 5s intervals
ffmpeg -i out/avatar_market_update/Bend_${TODAY}/synthesia_raw.mp4 \
  -vf fps=0.2 \
  out/avatar_market_update/Bend_${TODAY}/synthesia_qa_frames/frame_%03d.jpg

open out/avatar_market_update/Bend_${TODAY}/synthesia_qa_frames/
```

Confirm:
- Avatar is the correct one (Matt or configured fallback — not a random Synthesia avatar)
- Audio is clear, no Synthesia TTS artifacts
- "duh-shoots" pronunciation correct if Deschutes was in the script (note: Synthesia uses its own TTS — test pronunciation separately from ElevenLabs scripts)

### Step 6 — Remotion wrap composition

The `AvatarMarketComp` wraps the Synthesia MP4 in a 4-beat branded structure:

**Structure:**

| Segment | Duration | Content |
|---------|----------|---------|
| Brand intro | 5s | Logo animation (from `Logo_Animations/` folder), city name, report date. Navy background, gold accent. |
| Avatar + stat overlays | 45s | Synthesia MP4 full-bleed, stat overlays keyed to script timestamps |
| CTA end card | 5s | "ryan-realty.com" + QR code. Navy. No phone, no agent name. |
| Contact end card | 5s | Phone number + address. Navy. |

**AI disclosure pill (mandatory):**
A small pill overlay appears bottom-left for the first 5 seconds of the avatar segment (seconds 5-10 of the full video). White text, semi-transparent navy background, AzoSans 20px:

```
AI avatar
```

This is required for FTC compliance and Ryan Realty's integrity standards. It must be visible but not obtrusive. It does not display during the brand intro or end cards — only during the avatar section's first 5 seconds.

**Stat overlays (synced to script timestamps):**

The `render_synthesia.py` script captures word-level timestamps from the Synthesia response. The Remotion comp uses these timestamps to fade stat pills in and out when the avatar speaks each number:

- When avatar says the median price: price pill fades in bottom-left, stays for 3s
- When avatar says DOM: DOM pill fades in, stays for 2s
- When avatar says months of supply: classification pill fades in with the market condition badge
- Etc.

All stat pill values come from the verified JSON snapshot — never from parsing the spoken script.

Render command:

```bash
npx remotion render \
  video/avatar_market_update/src/index.ts \
  AvatarMarketComp \
  out/avatar_market_update/Bend_${TODAY}/avatar_market_render.mp4 \
  --props="{
    \"synthesiaSrc\": \"out/avatar_market_update/Bend_${TODAY}/synthesia_raw.mp4\",
    \"dataFile\": \"out/data_viz/Bend_${TODAY}.json\",
    \"avatarType\": \"matt\",
    \"reportDate\": \"${TODAY}\"
  }" \
  --concurrency=1
```

### Step 7 — Post-render quality gate

Full checklist in next section. Run every item.

### Step 8 — Final encode

```bash
ffmpeg -i out/avatar_market_update/Bend_${TODAY}/avatar_market_render.mp4 \
  -c:v libx264 -crf 24 -preset medium \
  -movflags faststart \
  -c:a aac -b:a 128k \
  out/avatar_market_update/Bend_${TODAY}/avatar_market_final.mp4
```

---

## Anti-slop guardrails

Read `video_production_skills/ANTI_SLOP_MANIFESTO.md` before QA. Critical rules:

- **AI disclosure is non-negotiable.** The "AI avatar" pill must be present in the first 5 seconds of the avatar segment, every single video, every single week. Removing it is a compliance failure. See FTC guidelines on AI-generated content disclosure.
- **Third-person framing required when avatar is not Matt's likeness.** Using "I" with a synthetic persona that is not Matt creates a false impression of identity. The script generator enforces this — do not override.
- **All numbers from verified Supabase snapshot.** No LLM-recalled market numbers. No "I think the median is around...". If the data pull fails, the video does not ship that week.
- **No forward-looking claims.** "Prices are expected to rise" is banned. The avatar reports what the data says, not what might happen.
- **No opinion language.** "It's a great time to buy" is banned. "The data shows a seller's market" is acceptable — it names the source.
- **Manifesto rules 1, 2, 3, 7, 8** apply: no hallucinated data, no AI filler, no false attribution, no deceptive framing, human review gate.
- **Human review gate: first 4 weeks of production** (elevated standard for avatar format — weekly review by Matt or designated reviewer for the first month, then move to random sampling).

---

## Brand rules

- **Colors:** Navy `#102742` for brand intro, end cards, and all overlay pills. Gold `#D4AF37` for logo accent, CTA accents, and positive market indicator highlights.
- **Fonts:** Amboqia for city name and report date in brand intro. AzoSans Medium for all stat overlays and end card text.
- **Logo placement:** Brand intro only — first 5s. Not during avatar segment. Not in end cards.
- **AI disclosure pill:** bottom-left of avatar segment, first 5 seconds. 20px AzoSans, white text, semi-transparent navy pill. Always present, always visible.
- **No brokerage name, phone, or agent name during avatar segment.** These live in end cards and IG caption.
- **Text safe zone:** 900×1400 px centered in 1080×1920 portrait.

---

## Data verification

Same requirements as `data_viz_video/SKILL.md`. The `verification_trace.txt` generated in the data pull step applies here. The avatar script numbers must match the JSON values exactly. Run `check_voice_rules.py` which includes a numeric consistency check: it parses the script for numbers and diffs them against the JSON.

No video ships without `verification_trace.txt` in the output directory.

---

## Quality gate checklist

**Pre-render:**
- [ ] `market_pulse_live` freshness confirmed (all cities in script refreshed within 24 hours for weekly pulse)
- [ ] Data pull executed fresh this session
- [ ] `verify_metrics.py` passed with zero discrepancies
- [ ] `verification_trace.txt` written and reviewed
- [ ] Script generated from template (not free-form LLM output)
- [ ] `check_voice_rules.py` passed with zero flags
- [ ] Word count confirmed 180 words or fewer
- [ ] Avatar ID confirmed (correct avatar for Matt vs fallback — log in `render_log.txt`)
- [ ] Synthesia raw MP4 duration in 40-50s range
- [ ] Avatar QA frames reviewed: correct avatar, clear audio, no artifacts
- [ ] "duh-shoots" pronunciation verified if Deschutes is in script (Synthesia TTS may need a different phonetic — test)

**Post-render:**
- [ ] `ffprobe` duration: exactly 60 seconds (5 + 45 + 5 + 5)
- [ ] `ffmpeg blackdetect` returns zero black sequences
- [ ] Frame at 0s: brand intro, logo visible, no avatar yet
- [ ] Frames at 5-10s: AI disclosure pill "AI avatar" visible bottom-left
- [ ] Frame at 10s: disclosure pill gone, avatar continues
- [ ] Frame at 55s: CTA end card visible, ryan-realty.com
- [ ] All stat overlay values match JSON (visual spot-check)
- [ ] No brokerage name or phone number during avatar segment (seconds 5-50)
- [ ] File size under 100 MB
- [ ] `verification_trace.txt` present in output directory
- [ ] **Human review gate: every video for first 4 weeks** (per ANTI_SLOP_MANIFESTO rule 8 — elevated for avatar format)

---

## Output paths

```
out/avatar_market_update/Bend_<yyyy-mm-dd>/
  synthesia_raw.mp4                 # Synthesia API output
  synthesia_qa_frames/              # QA frame extractions
  avatar_market_render.mp4          # Remotion output
  avatar_market_final.mp4           # CRF 24 deliverable
  render_log.txt                    # Avatar ID, voice ID, API response metadata
  render_error.log                  # API errors (if any)
```

Shared with data_viz_video (reuse if fresh):
```
out/data_viz/Bend_<yyyy-mm-dd>.json
out/data_viz/Bend_<yyyy-mm-dd>_verification_trace.txt
```

---

## See also

- `CLAUDE.md` — Data Accuracy rules (mandatory)
- `video_production_skills/VIDEO_PRODUCTION_SKILL.md` — master video constraints
- `video_production_skills/data_viz_video/SKILL.md` — chart-only market format (runs alongside this)
- `video_production_skills/social_calendar/SKILL.md` — weekly schedule this feeds
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — enforced rules, especially rule 8 (human review gate)
