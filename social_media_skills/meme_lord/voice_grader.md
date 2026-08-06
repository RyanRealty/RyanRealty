# Voice Grader — Pre-Publish Checklist

Run this checklist on every meme caption and on every text slot rendered onto the image. A single fail blocks publish until rewrite.

This grader exists because CLAUDE.md §4 bans AI-written humor and engagement bait. The skill never writes punchlines. Matt writes them. The grader confirms what Matt wrote actually sounds like Matt.

---

## The 8 questions

### 1. Banned-word grep — clean?

Run a case-insensitive search on the caption and every text slot against the canonical vocabulary
and construction rules, not a second list maintained here. Source of truth:
`marketing_brain_skills/brand-voice/VOICE.md` (the Five Laws + banned constructions), the
machine-readable vocabulary at `scripts/brand-voice-vocabulary.cjs`, and the shapes in
`scripts/voice-constructions.cjs` — enforced by `scripts/check-brand-voice.mjs` and
`scripts/check-voice-constructions.mjs`. If a word or opener needs to be added to the ban list,
it gets added there, never re-invented in this file.

**Pass condition:** zero hits against the canon. **Fail action:** rewrite the offending phrase to something specific.

### 2. Punctuation — clean?

- Any **semicolons**? Fail.
- Any **em-dashes** (— or --)? Fail.
- Any **en-dashes used as em-dashes** (–)? Fail.
- Any **hyphens used as dashes** (` - `)? Fail.
- Any **ellipses** outside a quoted trailed-off speech? Fail.
- Any **exclamation points** outside genuine surprise? Fail.
- Oxford comma present where needed? Pass condition.

**Fail action:** split sentences, replace dashes with periods.

### 3. Specificity — present?

Is there at least one concrete noun anchored in reality?

Acceptable anchors:
- A number (price, %, count, days)
- A street, neighborhood, or city name
- A brokerage or MLS field name
- A specific listing detail (square footage, lot size, year built — if real)
- A specific time / date

**Pass condition:** at least one specific anchor in either the caption or the image text. **Fail action:** rewrite with a real number or place.

### 4. Voice test — read aloud

Read the caption aloud. Read the image text aloud. Ask out loud:

> "Does this sound like a 40-something Bend principal broker who has closed deals through three rate cycles, or does it sound like a chatbot trying to be funny?"

Honest answer required. **If second, kill it.** Do not ship a "close enough" version.

Reference voice (from real accounts):
- The Broke Agent: terse, insider, no emoji-heavy energy
- @zillowgonewild: deadpan, the artifact carries it
- Matt's existing posts: direct, factual, specific

### 5. Setup-punchline structure

Where is the joke?

**Pass condition:** punchline at the bottom of the image, or end of the caption. Setup leads, payoff lands last.

**Fail condition:** punchline in the first line. The joke is given away before the viewer commits to the read.

**Fail action:** invert. Setup first, punchline last.

### 6. Caption explanation

Does the caption explain the meme image?

**Pass condition:** caption adds context, color, or a second beat. **Fail condition:** caption narrates the image ("this is what it feels like when..."). Kill the narration.

### 7. Engagement bait

Banned phrases in caption:

- "Tag a friend who..."
- "Comment below if you agree"
- "Double tap if..."
- "Save this for later"
- "Wait until you see..."
- "You won't believe..."
- "The answer will shock you..."
- Cliffhanger that resolves in a different post
- Any thumbnail/hook text that does not appear in the actual content

**Pass condition:** zero hits. **Fail action:** rewrite to a soft, honest CTA or no CTA.

Acceptable CTAs:
- "DM 'BEND' for the weekly market note"
- "Bend market data updates every Friday"
- A single relevant question that genuinely invites a reply

### 8. Insider-only check

Would a non-agent get the joke?

**Pass condition:** the meme works for both an agent peer and a regular Bend buyer/seller. **Fail condition:** only agents get it.

If it's agent-only, it's still allowed but capped — agent-only memes get tagged `[agent-audience]` in the post log and count against the weekly cap separately. The `social_calendar` skill enforces no more than 1 agent-only meme per month.

---

## Bonus: the "would Matt actually post this" test

Before queueing, ask: "If Matt's mom saw this, would Matt be proud or embarrassed?" If embarrassed, kill it.

If Matt's spouse saw it, same question.

If a past client saw it, same question.

If the OREA board read it during a license audit, same question.

A "yes I'd be proud" on all four is the bar. Anything less goes back to draft.

---

## Failure log

Every fail gets logged in `out/meme_lord/<slug>/voice_grader_log.md` with the question number, the offending text, and the fix applied. The log feeds the `performance_loop` automation skill so the failure modes inform future templates.

---

Last reviewed: 2026-04-26.
