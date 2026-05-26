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

---

## LIVE STATE (last updated 2026-05-26)

**Always cross-check against:** `.auto-memory/memory_marketing_analytics_session_2026-05-26.md` (canonical session memory) and `docs/plans/CROSS_AGENT_HANDOFF.md` (latest commit + pending decisions).

### Meta ad account `act_1178780510184911` — Custom Audiences pushed this cycle

| Audience ID | Name | Records | Source script |
|---|---|---|---|
| `120244161522810698` | RR MLS — Bend Property Owners (all) | 9,058 | `scripts/meta-upload-mls-audiences.mjs` |
| `120244161526200698` | RR MLS — 97703 Property Owners | 7,178 | same |
| `120244161528410698` | RR MLS — Absentee Owners (Bend area) | 1,619 | same |
| `120243107433010698` | FUB Suppression — All Current Contacts | ~8,000 | pre-existing |

### Pending audience builds (script ready, NOT yet run)

`scripts/meta-rebuild-fub-audiences.mjs` creates:
- `RR Database — Targetable (no realtors/compliance/test)` — 10,164 contacts
- `RR FUB Hard-Stop Exclusion (realtors+compliance+test)` — 3,023 contacts

### Pending campaign build (designed, NOT yet built)

6-tier structure stored in detail in `.auto-memory/memory_marketing_analytics_session_2026-05-26.md` ("The designed-but-not-built 6-tier campaign structure"):
1. Database Nurture (25%) — INCLUDES targetable FUB list
2. Bend Resident TOFU (25%) — broad geo + interests + LAL
3. West Bend 97703 Premium TOFU (15%) — uses 97703 MLS audience
4. Out-of-Area / Absentee Owner TOFU (10%) — uses Absentee MLS audience
5. MOFU Retargeting (20%) — uses to-be-created `AUD-CORE-Sellers-180d` WCA
6. BOFU Hot (5%) — sub-window of #5

ALL must have `special_ad_categories: ['HOUSING']`, `RR FUB Hard-Stop Exclusion` + `AUD-CORE-Converters-365d` excluded.

### GA4 baseline applied via API (2026-05-24)

- Google Signals ENABLED
- 4 conversion events newly marked: `listing_inquiry`, `home_valuation_cta_click`, `cma_downloaded`, `newsletter_signup`
- 18 custom dimensions registered (`lp_variant`, `broker_slug`, `lead_classification`, etc.)
- Retention 14mo, data-driven attribution, 90d other-conversion lookback

Re-run `node scripts/ga4-admin-setup.mjs --dry-run` any time to verify state (should report Planned: 0).

### Identity wiring (live for every visitor)

- GA4 `user_id` set via `components/AnalyticsIdentityBridge.tsx` (reads from `/api/identity/me` → `hashedUserId`)
- Meta Pixel `em` advanced matching re-init'd on every identified visitor (same component → `hashedEmail`)
- Consent Mode v2 (denied defaults, url_passthrough true, ads_data_redaction true) in `components/GoogleAnalytics.tsx`
- 7 server actions fire `canonicallyTagLead` + `fireLeadGenerated` (lib helper at `lib/lead-tracking.ts`)

### Dashboards live (admin-only)

- `/admin/reports/lead-flow` — funnel with wiring health
- `/admin/reports/traffic-sources` — GBP attribution gap + untagged channels
- `/admin/analytics/meta-health` — pixel/form/webhook/spend
- `/admin/people` (index) + `/admin/people/[fubPersonId]` (single-pane-of-glass)

### Outstanding UI-only items (API has no path)

- GA4 Reporting Identity → Blended (Matt skipped, not blocking)
- GA4 default channel grouping: add `gbp` to Organic Search regex (Matt skipped, see UTM convention doc)
- Meta AEM priority events (`/{pixel}/aem_conversion_configs` returns 400)
- Domain verification finalize (`/{business}/verified_domains` returns 400)
- Page verification (requires business document upload)
- Dead pixel `590593947302147` System User + foreign account unassignment (cosmetic only — leak source killed via Zapier zap removal)
- IG / TikTok / LinkedIn bio link UTMs (Meta locks IG bio update API)
