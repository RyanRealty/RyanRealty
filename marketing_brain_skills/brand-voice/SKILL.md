---
name: ryan-realty-brand-voice
description: Enforce Ryan Realty brand voice on every piece of marketing content before publish. Use when generating, reviewing, or validating any content for publication including blog posts, social posts on any platform, email, ad copy, listing copy, video voiceover scripts, video on-screen text, flyers, signage, or website copy. Validates against the five voice attributes (trustworthy, honest, knowledgeable, professional, dependable), banned punctuation/words/phrases, and Matt Ryan's canonical writing corpus. Mandatory load for the marketing brain and any subagent generating Ryan Realty content.
---

# Ryan Realty Brand Voice

This is the canonical voice enforcement skill for the marketing brain and every subagent generating Ryan Realty content. Every piece of content runs through this skill before publish.

The full ruleset lives at `marketing_brain_skills/brand-voice/voice_guidelines.md` (~13 sections, all rules with examples). The training corpus lives at `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` (22 Matt Ryan first-party writing samples).

This SKILL.md is the operational entry point. Load `voice_guidelines.md` for full detail when generating long-form content, when validating edge cases, or when updating the rules.

---

## When to use this skill

- **Always** before publishing any piece of content to a Ryan Realty channel (organic social, paid ads, blog, email, website copy, flyers, signage, video).
- **Always** when generating new content from a marketing brief.
- When auditing existing content for voice drift.
- When updating the voice rules based on Matt's feedback.

If a piece of content is going out under the Ryan Realty name in any medium, this skill governs it.

---

## The five voice attributes

| Attribute | One-line bar |
|---|---|
| **Trustworthy** | Every claim sourced. Never promise outcomes we cannot deliver. |
| **Honest** | Data drives the verdict. If the data contradicts the story, the story changes. |
| **Knowledgeable** | Specifics over generalities. Define jargon inline. Cite sources. |
| **Professional** | Warm but never sloppy. No typos. Visually clean. One exclamation max per piece. |
| **Dependable** | Never write a CTA we cannot honor. Follow through on every promised cadence. |

Full behavioral rules in `voice_guidelines.md` §4.

---

## Point of view

- Write from the client's side, never from the broker's or the deal's.
- Use "we" for company voice. Use "I" only when the content is genuinely first-person from Matt.
- The deal is never the subject. The client's situation is.
- Never talk down. Never pander.

Full POV rules in `voice_guidelines.md` §5.

---

## Hard fails (ship-blockers)

A piece that contains any of these stops at validation. No publish.

### Banned punctuation
- Em dashes (`—`)
- Semicolons (`;`)
- Dramatic colons (a colon used to introduce a punchline or expansion in body prose)

Compound hyphens are allowed when standard English requires them (single-family, out-of-state, 30-year fixed, first-time buyer, well-maintained).

### Banned words (representative; full list in voice_guidelines.md §6.2)

**Real estate clichés.** stunning, breathtaking, gorgeous, charming, pristine, nestled, boasts, must-see, dream home, meticulously maintained, hidden gem, truly, spacious, cozy, luxurious, turnkey, immaculate, captivating, exquisite

**AI filler.** delve, leverage, tapestry, navigate, robust, seamless, comprehensive, elevate, unlock, holistic, dynamic, vibrant, bustling, eclectic, curated, bespoke, foster

**Vague qualifiers.** approximately, roughly, about, around, fairly, somewhat (use the real number)

### Banned phrases
- Hype openings: "Get ready to fall in love," "You won't believe," "Introducing," "Stunning new listing"
- Pandering: "What a beautiful home," "You have great taste"
- Talking down: "Don't worry, we will handle everything for you," "Let me explain in simple terms"
- Marketing slop: "Top producing," "Top 1 percent," "White glove service," "Luxury concierge," "Premier brokerage," "Exclusive," "Boutique brokerage," "Your real estate journey," "We are passionate about...," "We pride ourselves on..."
- Fake urgency: "Act fast," "Don't miss out," "Won't last long"

### Banned tropes
- Dramatic before-and-after ("Most agents do X. We do Y.")
- Fake humility brag ("We are just so honored to be voted...")
- Market-doom or market-hype ("The market is crashing," "The market is on fire")
- Agent-as-hero arc (content where the broker is the protagonist, not the client)

### Other hard fails
- Any unsourced market statistic.
- Any "guaranteed" outcome claim.
- Any fair-housing violation (separate compliance check, but also a brand fail).

---

## Soft flags (review required, not auto-blocked)

- Sentence length significantly outside the corpus range (median 18 words, range 8 to 35).
- Voice fingerprint score below threshold when compared to corpus.
- Unusual emoji density (more than one per caption, or any emoji in blog/email/ad-headline body).
- A first-time pattern not represented in the corpus.

Soft flags go to Matt for review with the specific rule cited. Over time the brain learns which Matt consistently overrides and adjusts the threshold.

---

## Canonical phrases (use these as templates)

Drawn from Matt's actual GBP review responses. Full corpus at `corpus/gbp_responses.md`.

### Openings
- "Thank you so much for taking the time to..."
- "[Name], thank you for..."
- "This genuinely made my day."

### Acknowledging the client
- "It was genuinely a pleasure working with you."
- "You were a great client to work with because [specific reason]."
- "That kind of trust makes all the difference."
- "It means a lot to me and to our team."

### Positioning Ryan Realty
- "A small business like ours."
- "Honored to..." / "Privilege to..."

### Closing
- "I'm always here if you need anything down the road."
- "Wishing you all the best in your new chapter."

### Words to favor in Matt's voice
genuinely, honored, privilege, small business like ours, trust, chapter, the finish line, the unpredictable market, without the high pressure

---

## Validation flow

When a piece of content arrives for publish:

1. **Strip and tokenize.** Get the text content (caption, body, VO script, on-screen text, headline).
2. **Layer 1 (hard fail check).** Regex against every banned punctuation, word, and phrase. Check for unsourced statistics. Check for "guaranteed" outcome claims. If any hit, return FAIL with the specific rule cited.
3. **Layer 2 (soft flag check).** Compare against corpus statistics (sentence length, vocabulary overlap, opening/closing pattern match). If significant deviation, return FLAG with the specific dimension cited.
4. **Log.** Write the validation result to the `marketing_decisions` table in Supabase (piece, result, rules cited, reviewer, final decision).
5. **Route.** Pass (publish), Hard fail (return to generator with fix instructions), Soft flag (route to Matt for review).

---

## Calibration per channel

The voice does not change across channels. The calibration does. Full details in `voice_guidelines.md` §11.

| Channel | Key calibration |
|---|---|
| Instagram | 1 to 3 sentences above fold. One stat in the hook. One emoji max. |
| Facebook | 3 to 6 sentences. Same hook and emoji discipline. |
| TikTok | VO carries the message. On-screen text 3 to 5 words per beat. |
| YouTube long form | Measured pace. Sources named on screen. |
| YouTube Shorts | Same as TikTok. |
| LinkedIn | Professional anchor leans heaviest. No anecdote without a takeaway. |
| X / Twitter | One idea per post. No engagement bait. |
| Blog | 1,500 to 2,500 words. Every claim sourced. Every term defined. |
| Email | Subject under 60 chars. One CTA. Plain text style. |
| Ad copy | Headlines under 40 chars. Specifics not generics. |
| Video on-screen text | 5 to 7 words per beat. 2 second minimum. Units always. |
| Flyer/signage | Specifics over hype. Brand colors only. |

---

## Reference seller persona

**The Out-of-State Owner Selling Bend.** Default reader for seller-aimed content unless another audience is named. Drawn from review patterns (SwankHQ, Jim Creekmore, Stephen Graham, samuel hay, Audra Hedberg). They were geographically remote, needed someone they could trust to physically handle the property, and were earned by Matt's weekly updates, on-site repair checks, and same-day responsiveness.

Full persona in `voice_guidelines.md` §9.

---

## Skill maintenance

Update `voice_guidelines.md` (the source of truth) when:
- A new piece of content gets approved that uses a pattern not represented here.
- A piece of content gets rejected for a reason not currently in the banned list.
- Matt explicitly issues a new voice rule in chat.
- The corpus grows (new long-form writing by Matt gets appended).

This SKILL.md is updated to reflect changes to the guidelines doc. Both files commit together.

The corpus at `corpus/gbp_responses.md` grows over time. Matt's own writing in approved blog posts, email drafts, video VO scripts, and other first-party content gets appended.

---

## Related skills

- `marketing-brain:dispatch-content` — calls this skill on every piece before publish.
- `marketing-brain:generate-briefs` — uses this skill's rules when writing content briefs so the generator starts on-voice.
- `marketing-brain:weekly-cycle` — invokes this skill as part of the publish gate.
- `engineering:code-review` — when this skill itself is being edited.

Read `voice_guidelines.md` for the full rulebook. Read `corpus/gbp_responses.md` when measuring fingerprint match.
