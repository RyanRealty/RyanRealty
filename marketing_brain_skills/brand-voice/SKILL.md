---
name: ryan-realty-brand-voice
description: Enforce Ryan Realty brand voice on every piece of marketing content before publish. Use when generating, reviewing, or validating any content for publication including blog posts, social posts, email, SMS, packets, video voiceover, or website copy. The law lives in VOICE.md (D11). Mandatory load for the marketing brain and any subagent generating Ryan Realty content.
---

# Ryan Realty Brand Voice

The law is `marketing_brain_skills/brand-voice/VOICE.md`. This file is the
operational entry. Load VOICE.md before generating public copy. Do not keep a
second canon here.

## When to use

- Before publishing any piece of content to a Ryan Realty channel.
- When generating new content from a marketing brief.
- When auditing existing content for voice drift.

If a piece of content is going out under the Ryan Realty name, VOICE.md governs it.

## Point of view

We. Not I. Write to one person. Say the fact. Then stop.

Personal notes to clients may thank. Public listing posts do not thank. The
house is the post. Admin copy is instrument language.

## Hard fails (the tiny mechanical gate)

A piece that contains any of these stops at validation.

- Em dash, en dash, semicolon, `!`
- An invented quote under a name
- "What's my home worth" / "What is your home worth" on a CTA (use Value my home)

The lists live in `scripts/brand-voice-vocabulary.cjs` and
`scripts/voice-constructions.cjs`. Do not grow them.

Unsourced market statistics, guaranteed-outcome claims, and fair-housing
violations are also ship-blockers (CLAUDE.md §0).

## Validation flow

1. Read the text (caption, body, VO, on-screen, headline).
2. Run `checkBrandVoice` from `lib/voice/check.ts` (or `has_hard_fail` /
   `grep_banned` from `scripts/_producer_lib.py`).
3. If it fails, return FAIL with the specific rule. If it passes the gate,
   still read it against the named exemplars in VOICE.md. Regex cannot catch
   corny.
4. Log the result. Route: pass, hard fail, or Matt review.

When this file and `VOICE.md` disagree, **`VOICE.md` is the source of truth.**

## Related

- Corpus of Matt's first-party writing: `corpus/gbp_responses.md`
- Runtime chokepoint: `lib/voice/check.ts`
- Commit gate: `ci:brand-voice` and `ci:voice-constructions`
