---
name: facebook-seller-growth
description: Unified online growth routine for Ryan Realty across Facebook ads, website analytics, Follow Up Boss outcomes, and organic social growth. Use when running weekly growth optimization, generating execution packets, updating ad strategy, or deciding site and social improvements from data.
when_to_use: Use when the user asks for one routine that continuously improves ads, web presence, and social growth; asks for a Claude cloud routine; wants autonomous optimization loops; or asks how to convert analytics into platform growth actions.
---

# Facebook Seller Growth Routine

## What This Is

One merged growth routine that:

1. Optimizes Facebook paid seller acquisition
2. Optimizes website conversion performance
3. Optimizes CRM outcome quality (Follow Up Boss)
4. Optimizes organic social growth using the same analytics signal

This is the canonical routine for cloud and local agent runs in this project (**tracked** under `.cursor/skills/`). A non-gitignored copy may also exist under `~/.claude/skills/` on developer machines; prefer this path so every clone sees the same file.

## Canonical system docs (read before code changes or paid-social advice)

Agents are expected to load these **in order** when Matt asks for anything marketing-specific or advertising-related:

1. **`docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`** — End-to-end architecture (Meta → site → CAPI → FUB → Supabase → Vercel crons). **Canonical for how the system actually works.** Regenerate the browsable HTML with `node scripts/build-pipeline-doc-html.mjs` → `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.html`.
2. **`docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md`** — Launch checklist, campaign structure, lead form spec, verification cadence.
3. **`social_media_skills/facebook-lead-gen-ad/SKILL.md`** — When the task is ad creative, lead form fields, or Meta Ads Manager steps for lead-gen units.

Also indexed from **`AGENTS.md`** (Skills list), **`CLAUDE.md`** (Skill Routing table), and **`.cursor/rules/marketing-advertising-workflow.mdc`**.

## Hard Constraints

1. Optimize for listing outcomes, not vanity metrics.
2. Use fair-housing-safe ad practices.
3. Never propose broad strategy without metric evidence from this cycle.
4. Every recommendation must map to one of: `scale`, `pause`, `test`, `fix`, `watch`.
5. Save learnings after each cycle in **`docs/marketing/facebook-seller-growth-LEARNINGS.md`** (append-only).

## Input Sources (Every Cycle)

- Meta paid performance (delivery + conversion)
- GA4 acquisition and funnel signals
- Website seller funnel conversion checkpoints
- Follow Up Boss downstream quality signals
- Prior cycle learnings in **`docs/marketing/facebook-seller-growth-LEARNINGS.md`**
- Automated packet in `agent_insights` (`insight_type = marketing_optimization_weekly`) when available

## Routine Outputs

Produce all of the following:

1. Weekly score (0-100) and verdict (`strong`, `needs_attention`, `at_risk`)
2. Prioritized action queue (`scale/pause/test/fix/watch`)
3. Tactical execution plan for:
   - Facebook paid
   - website conversion
   - organic platform growth
4. Two controlled experiments for next cycle
5. Updated learning entry appended to **`docs/marketing/facebook-seller-growth-LEARNINGS.md`**

## Execution Procedure

1. **Load latest context**
   - Read newest entries in **`docs/marketing/facebook-seller-growth-LEARNINGS.md`**
   - Read latest automated packet from `agent_insights` if present
2. **Score current state**
   - Evaluate paid, web, CRM, and organic indicators together
3. **Create decision set**
   - Assign actions with priority and rationale
4. **Define implementation tasks**
   - Facebook changes (audience, creative, budget, exclusions)
   - Website changes (offer, form friction, page/path issues)
   - Organic changes (format mix, hooks, cadence, channel focus)
5. **Set experiments**
   - Exactly two high-signal tests for next cycle
6. **Publish packet**
   - Update routine output in dashboard/insight artifacts
7. **Persist learning**
   - Write what changed, what won, what failed, and what to test next

## Growth Decision Hierarchy

Use this ordering when making choices:

1. Listing outcomes
2. Appointment outcomes
3. Contact outcomes
4. Qualified lead outcomes
5. Traffic and engagement indicators

If CPL improves but appointments/listings decline, treat as regression.

## Organic Growth Integration

Each cycle must include organic recommendations:

- channel priority updates (where to invest effort this week)
- top content pattern to repeat
- one content pattern to stop
- one web-content topic to publish that supports both SEO and social demand
- one audience-building action (followers, saves, subscribers, email captures)

## Cloud Routine Prompt

For Claude cloud or UI paste routines, use **`docs/marketing/facebook-seller-growth-CLOUD_ROUTINE_PROMPT.md`** as the canonical routine body.

## Standard Status Output

1. What is live now
2. What changed this week
3. Best performer and why
4. Worst performer and why
5. Next tests
6. Risks/blockers
7. Expected impact next cycle
