# Facebook Seller Growth Learnings

**Tracked copy for all clones.** Append one entry per weekly optimization cycle. (Historical copies may exist under `~/.claude/skills/facebook-seller-growth/LEARNINGS.md` on local machines; treat **this file** as the durable repo source going forward.)

## Entry Template

- Date:
- Market:
- Objective:
- What changed:
- Best performer:
- Worst performer:
- Quality outcomes (contact, appointment, listing opportunity):
- Decision summary:
- Next two tests:
- Risks:

## Seed Entry

- Date: 2026-05-09
- Market: Bend, OR
- Objective: Build Claude-native seller lead and retargeting system.
- What changed: Created reusable `facebook-seller-growth` skill with KPI and optimization loop standards.
- Best performer: N/A (initial setup baseline).
- Worst performer: N/A (initial setup baseline).
- Quality outcomes (contact, appointment, listing opportunity): Baseline not captured yet.
- Decision summary: Use hybrid Lead Ads + website funnel with always-on retargeting windows and CRM (`crm_people`) attribution.
- Next two tests:
  1. Compare seller valuation offer vs strategy-call offer by appointment rate.
  2. Compare hot-window (0-30d) creative variant A vs B on consultation rate.
- Risks: Missing or inconsistent attribution fields across some legacy form paths until fully standardized.

## 2026-05-09 Routine Merge Update

- Date: 2026-05-09
- Market: Bend, OR
- Objective: Merge Facebook optimization into one cloud-capable growth routine that also drives web and organic growth.
- What changed: Expanded skill scope to unified growth routine and added `CLOUD_ROUTINE_PROMPT.md` for Claude UI routine paste/use.
- Best performer: N/A (architecture update, no new cycle results yet).
- Worst performer: N/A (architecture update, no new cycle results yet).
- Quality outcomes (contact, appointment, listing opportunity): No new deltas yet; waiting for next automated cycle packet.
- Decision summary: Keep one canonical routine for paid + website + CRM + organic actions with weekly score and prioritized action tags.
- Next two tests:
  1. Validate routine output consistency across two consecutive weekly packets.
  2. Compare organic recommendation quality before and after merged routine deployment.
- Risks: Routine quality depends on data freshness from Meta, GA4, and `crm_people` intake.

## 2026-05-10 Recovery and Resume Update

- Date: 2026-05-10
- Market: Bend, OR
- Objective: Recover locked Facebook optimization agent state and resume from last unfinished step.
- What changed: Recovered latest runtime memory from `agent_insights` and resumed the interrupted deep architecture audit of the ad → site → `crm_people` pipeline. (2026-05-10 entry originally named a retired vendor CRM; that path is gone.)
- Best performer: Automation packet generation is live (`marketing_optimization_weekly`). Weekly vendor-outreach packets are retired — nurture is `crm-auto-enroll` + `crm-sequence-engine`.
- Worst performer: At the time of this entry, outreach had no usable contact snapshot and generated zero executable items.
- Quality outcomes (contact, appointment, listing opportunity): Cycle was blind on GA4 and produced zero outreach actions (`my_leads_count=0`, `targetable_count=0`, `execution_items=[]`).
- Decision summary: Pipeline integrity is native CRM. Dashboard intake is `getLeadIntake` on `crm_people`. Do not restore a third-party People API snapshot.
- Next two tests:
  1. Confirm weekly packet CRM figures match `crm_people` / `getLeadIntake` (social channel).
  2. After GA4 service account setup, validate Facebook source attribution by comparing GA4 lead events and CRM social-channel capture in the same 30-day window.
- Risks: GA4 misconfig (`GA4_NOT_CONFIGURED`) still blinds attribution. Do not reintroduce dropped vendor contact-cache tables.
