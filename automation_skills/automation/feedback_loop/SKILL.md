---
name: feedback_loop
description: Use this skill whenever the user says "no, change [X]", "redo this", "this isn't right", "I don't like the [X]", "next time do [Y]", "update the workflow", "make this a permanent rule", "remember not to [X]", "keep doing [Y] going forward", "always do", "never do", "add this as a rule", or "this keeps happening". Also auto-invoked by content_engine when a draft is rejected. Captures Matt's rejections and change requests as permanent rules in the originating skill's "Lessons learned" section. NOT for mid-build iteration on a single draft — only for final rejections of a rendered or delivered output.
---

# Feedback Loop

## What it is


## When NOT to invoke

- Matt is iterating mid-build on the same draft (not a final rejection)
- Matt is revising the creative brief or changing the requested format
- Matt is commenting on research or a storyboard, not a rendered/delivered output

## Hard constraints

- Extracted rules MUST be actionable, not vague. "Be better" is not a rule. "Don't open with 'Welcome to'" is.
- Every rule MUST cite the specific asset and rejection that produced it (auditability).
- Manifesto/guardrails promotion REQUIRES Matt's explicit chat confirmation before writing — automated promotion of a bad rule into a hard rule is the worst failure mode.
- Skill SKILL.md updates follow draft-first: local write only. The updated rule is live on the NEXT deliverable from that skill — not retroactively.
- If Matt provides no specific reason ("just doesn't feel right"), still capture as `confidence: low` and ask for one-line clarification before writing the rule.

## Procedure

1. **Receive inputs:** `rejection_reason` (Matt's words verbatim), `originating_skill` (which skill produced the output), `asset_path`, `render_metadata` (scorecard, citations, format).

2. **Parse rejection.** Extract one actionable rule from Matt's words. Map to scope:
   - Skill-specific fix → stays in the originating skill only

3. **Open originating `SKILL.md`.** Locate or create `## Lessons learned` section at the end of the file.

4. **Append rule block:**
   ```
   ### YYYY-MM-DD — [asset-slug]
   **Rejection:** [Matt's verbatim reason]
   **Rule:** [Actionable rule extracted]
   **Apply to:** [Condition that triggers this rule]
   **Confidence:** high | low
   ```

5. **Write to `rejection_log` in Supabase** (schema below). Record `matt_approved_extraction: null` (pending) if confidence is low — follow up in chat.

6. **Query promotion threshold.** Count distinct `originating_skill` values in `rejection_log` WHERE `extracted_rule` ILIKE `%[key phrase]%`. If count ≥ 3:
   - Surface to Matt: "This rule has hit 3 skills ([list]). Should I promote it to [MANIFESTO/GUARDRAILS]?"
   - Wait for explicit "yes" / "promote it" in chat.
   - On approval: append to the relevant file, set `promoted_to_manifesto = true` in all matching rows.

7. **Return summary** in chat: rule captured, file updated, promotion status.

## rejection_log Supabase schema

```sql
create table rejection_log (
  id                      uuid primary key default gen_random_uuid(),
  rejected_at             timestamptz not null default now(),
  asset_path              text not null,
  asset_format            text not null,          -- 'listing_video' | 'market_report' | 'news_clip' | etc.
  originating_skill       text not null,           -- e.g. 'listing_reveal', 'elevenlabs_voice'
  rejection_reason        text not null,           -- Matt's verbatim words
  extracted_rule          text not null,           -- actionable rule derived from rejection
  rule_applies_to         text not null,           -- condition/trigger for this rule
  rule_scope              text not null default 'skill',  -- 'skill' | 'manifesto' | 'guardrails'
  confidence              text not null default 'high',   -- 'high' | 'low'
  promoted_to_manifesto   boolean not null default false,
  promoted_at             timestamptz,
  matt_approved_extraction boolean,               -- null = pending confirmation (low-confidence rules)
  scorecard_at_rejection  jsonb default '{}'::jsonb,     -- scorecard.json snapshot
  render_metadata         jsonb default '{}'::jsonb,     -- format, duration, codec, crf, voice_id
  context                 jsonb default '{}'::jsonb       -- any extra metadata
);

create index rejection_log_skill_idx   on rejection_log (originating_skill, rejected_at desc);
create index rejection_log_rule_idx    on rejection_log using gin (to_tsvector('english', extracted_rule));
create index rejection_log_promote_idx on rejection_log (promoted_to_manifesto, rule_scope);
```

## Promotion logic (to manifesto or guardrails)

```sql
-- Run after every new rejection_log insert:
select originating_skill, count(*) as hits
from rejection_log
where extracted_rule ilike '%' || :key_phrase || '%'
  and promoted_to_manifesto = false
group by originating_skill
having count(*) >= 1
-- If count(distinct originating_skill) across all rows >= 3, surface promotion prompt to Matt
```

Promotion target:
- Workflow / data accuracy → `CLAUDE.md` top section (rare — only for systemic failures)

## Examples — feedback to rule

| Matt says | Originating skill | Extracted rule | Promotion candidate |
|---|---|---|---|
| "Tumalo sounds wrong — it's TUM-uh-low not TOO-muh-low" | `elevenlabs_voice` | Force IPA tag `TUM-uh-low` on every VO line mentioning Tumalo. Phoneme: `<phoneme ph="ˈtʌm.ə.loʊ">Tumalo</phoneme>` | No — skill-specific |
| "The hook started with 'Welcome to' — we banned that opener" | `listing_reveal` | Banned opening: 'Welcome to'. Hook must lead with content (number, place, contradiction) per VIRAL_GUARDRAILS. | Yes → MANIFESTO if hits 3 skills |
| "Price shown was off by $5K — reconciliation gate missed it" | `market-data-video` | Tighten Spark × Supabase reconciliation tolerance from 1% to 0.5% for any price figure shown on screen. | Yes → GUARDRAILS if recurs |
| "End card showed 'Ryan Realty' text — logos only for viral cuts" | `news_video` | Banned: brokerage text in viral-cut end cards. Use `stacked_logo_white.png` only — no text, no phone, no URL. | Yes → MANIFESTO if hits 3 skills |
| "The stat pill says 'seller's market' but MoS was 4.3 — that's balanced" | `data_viz_video` | Verdict pill must be derived from actual MoS value against thresholds (≤4 seller, 4–6 balanced, ≥6 buyer) — never pre-written. | Yes → CLAUDE.md data accuracy section |

## Cost

- Rule extraction (parsing Matt's words into an actionable rule): ~$0.001 (Gemini Flash or local rule parse)
- Supabase write: negligible
- Promotion check (SQL aggregate query): free

## See also

- `automation_skills/automation/content_engine/` — invokes this skill on draft rejection
- `automation_skills/automation/performance_loop/` — surfaces patterns from post-performance data that may trigger rule updates
