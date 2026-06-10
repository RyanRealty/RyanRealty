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

## LIVE STATE (last updated 2026-05-26, Claude Code session)

**Always cross-check against:** `.auto-memory/memory_marketing_analytics_session_2026-05-26.md` (canonical session memory) and `docs/plans/CROSS_AGENT_HANDOFF.md` (latest commit + pending decisions).

### Meta ad account `act_1178780510184911` — Custom Audiences (canonical inventory)

| Audience ID | Name | Records | Source |
|---|---|---|---|
| `120244161522810698` | RR MLS — Bend Property Owners (all) | 9,058 | `scripts/meta-upload-mls-audiences.mjs` |
| `120244161526200698` | RR MLS — 97703 Property Owners | 7,178 | same |
| `120244161528410698` | RR MLS — Absentee Owners (Bend area) | 1,619 | same |
| `120244223033600698` | RR Database — Targetable (no realtors/compliance/test) | 10,164 | `scripts/meta-rebuild-fub-audiences.mjs` |
| `120244223042110698` | RR FUB Hard-Stop Exclusion (realtors+compliance+test) | 3,023 | same — universal exclusion |
| `120244223729930698` | AUD-CORE-Sellers-180d (WCA) | n/a | `scripts/meta-build-campaign-shells.mjs` |
| `120244223730320698` | AUD-CORE-Sellers-14d (WCA) | n/a | same |
| `120244223731130698` | AUD-CORE-Converters-365d (WCA) | n/a | same — universal exclusion |
| `120244223731190698` | AUD-LAL-1pct-Targetable (standard LAL) | n/a | same — NOT yet HOUSING-compatible, see below |

`120243107433010698` "FUB Suppression — All Current Contacts" is legacy/superseded by the Hard-Stop exclusion above.

### Live campaign shells (PAUSED, HOUSING-compliant, no creative attached)

All 6 tiers shipped 2026-05-26 via `scripts/meta-build-campaign-shells.mjs`. Total $49/day if fully activated. Matt's next move: attach creative + Lead Forms in Ads Manager, then unpause.

| Tier | Campaign ID | Ad Set ID | Daily | Objective / Optimization |
|---|---|---|---|---|
| Tier 1 — Database Nurture (Sphere) | `120244223736960698` | `120244224327800698` | $12 | OUTCOME_AWARENESS / REACH |
| Tier 2A — Bend Resident TOFU | `120244223739790698` | `120244224332950698` | $12 | OUTCOME_LEADS / OFFSITE_CONVERSIONS |
| Tier 2B — West Bend 97703 Premium TOFU | `120244223741480698` | `120244224337020698` | $7 | OUTCOME_LEADS / OFFSITE_CONVERSIONS |
| Tier 3 — Out-of-Area Absentee Owner | `120244223742330698` | `120244224340000698` | $5 | OUTCOME_LEADS / OFFSITE_CONVERSIONS |
| Tier 4 — MOFU Retargeting (Sellers 180d) | `120244223743080698` | `120244224342140698` | $10 | OUTCOME_LEADS / OFFSITE_CONVERSIONS |
| Tier 5 — BOFU Hot (Sellers 14d) | `120244223745230698` | `120244224344090698` | $3 | OUTCOME_LEADS / OFFSITE_CONVERSIONS |

### HOUSING Special Ad Category — locked rules surfaced this session

When editing or extending paid Meta tooling, the following constraints are HARD and apply to every ad set under `special_ad_categories: ['HOUSING']`:

1. **Standard Lookalikes are rejected on assignment.** Use Special Ad Audience LALs (UI-only — Meta Marketing API doesn't expose the flag). The `AUD-LAL-1pct-Targetable` audience is a standard LAL; it needs to be recreated as Special Ad Audience via Ads Manager before it can be added to Tier 2A.
2. **`excluded_geo_locations` is banned (#2909046).** The Absentee MLS audience filter (mailing city ≠ site city) does Bend-exclusion in audience space instead of geo space.
3. **Detailed targeting (`flexible_spec.interests` etc.) is severely restricted (#2909049).** Most real-estate interest IDs are blocked. Tier 2A runs broad on geo + exclusions; if interests are needed, pick HOUSING-eligible ones via the UI.
4. **WCA `subtype: 'WEBSITE'` is removed in v21.0** — omit subtype, let Meta infer from `rule.event_sources`.
5. **`frequency_control_specs` is incompatible with `OFFSITE_CONVERSIONS`** — let Meta auto-optimize frequency.
6. **Campaign create requires `is_adset_budget_sharing_enabled: false`** when using ad-set budgets (not CBO).
7. **Region keys must be verified** via `/search?type=adgeolocation` — CA=3847, OR=3880, WA=3890 (not the older `3877` / `3895` I had cached).

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

### LIVE STATE delta (2026-06-09 — Claude Code review cycle, supersedes conflicting rows above)

- **Spending now:** T2A "AdSet 2" (`120244926443800698`, $20/day, LANDING_PAGE_VIEWS, targets `RR Database — Targetable`) trimmed to 2 ads: champion `react-t2a-v2-out-of-state` (2.43% link CTR, $1.06/LPV) + `react-t1-v1-worth-today`. Three dead ads paused 2026-06-09.
- **Tier 3 LIVE:** new ad set `RR — T3 — Absentee Owners — AdSet 2 (LPV)` (`120245421093840698`, $5/day, CA/OR/WA home-location, includes `RR Absentee / Out-of-Area Owners` `120244510681250698`) reusing the champion creative (`creative_id 1310064894013970`). Total live spend $25/day.
- **The 2026-05-26 MLS audience IDs above are STALE** — `120244161528410698` etc. no longer exist. Current audiences are the `meta-rebuild-audiences-from-fub.mjs` seed set (`RR Absentee / Out-of-Area Owners`, `RR Seller-Intent — Warm + Hot`, `RR Westside Bend Homeowners`, ...). Always re-pull `act_1178780510184911/customaudiences` instead of trusting doc IDs.
- **Attribution:** zero Meta-attributed leads through 2026-06-08 explained by timing — the `rr_fbc` fbclid-rescue middleware shipped 2026-06-07 (a9592372), AFTER the only plausible paid lead (Jun 4). CAPI match-quality fix (real visitor IP/UA forwarded from server actions) shipped 6f29133e. Judge attribution only on leads after 2026-06-09.
- **`AUD-CORE-Converters-365d` is ~empty (~20 users)** — do not exclude it until lead volume populates it; pointless learning reset.
- **Weekly packet cron** `marketing-optimization-report` re-scheduled in vercel.json (Mon 06:30 UTC) after being unscheduled ~May 18. Next packet 2026-06-15.
- **Pending approval:** challenger creatives `chal-a-net-number` + `chal-b-ten-years` rendered to `out/seller-ad-concepts/v10/` (drafts; not attached to Meta).
- Full cycle detail: LEARNINGS.md entry 2026-06-09.
