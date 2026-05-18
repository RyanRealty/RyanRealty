# Phase 0 — Pre-flight log

**Started:** 2026-05-16 (Matt invoked the brief under /loop)
**Orchestrator model:** Opus 4.7
**Brief contract:** `marketing_brain_skills/research/AUTONOMOUS_PIPELINE_BRIEF.md` (962 lines, 90 KB)

## A. §3 required reading

CLAUDE.md was loaded into the orchestrator context at session start via the system reminder (project instructions). The remaining §3 files exist on disk and have been catalogued. Deep loads are delegated to the per-phase subagents below — the orchestrator carries the dispatch-relevant excerpts.

| # | File | Status | Last modified | Loaded by |
|---|---|---|---|---|
| 1 | `CLAUDE.md` | Loaded in orchestrator context | (in system reminder) | orchestrator |
| 2 | `marketing_brain_skills/producers/REGISTRY.md` | Loaded in orchestrator context (185 lines) | 2026-05-15 | orchestrator |
| 3 | `marketing_brain_skills/producers/TEMPLATE.md` | Loaded in orchestrator context (316 lines) | 2026-05-14 | orchestrator |
| 4 | `automation_skills/content_engine/SKILL.md` | Loaded in orchestrator context (230 lines) | 2026-05-15 | orchestrator |
| 5 | `automation_skills/automation/publish/SKILL.md` | Catalogued, scheduled for Phase 8 audit | (existing) | Phase 8 agent |
| 6 | `marketing_brain_skills/brand-voice/voice_guidelines.md` | Catalogued (37 KB), scheduled for Phase 6 and brand-voice subagents | 2026-05-15 | Phase 6 + 11 agents |
| 7 | `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` | Catalogued, voice subagent loads | (existing) | brand-voice subagent |
| 8 | `video_production_skills/asset-library/SKILL.md` | Catalogued, Phase 2.5 + 7 agents load | (existing) | Phase 2.5 + Phase 7 agents |
| 9 | `social_media_skills/platform-best-practices/SKILL.md` | Catalogued, Phase 2 agent loads + expands | (existing) | Phase 2 agent |
| 10 | `video_production_skills/VIDEO_PRODUCTION_SKILL.md` | Catalogued (68 KB), Phase 6 video agents load | 2026-05-13 | Phase 6 video batches |
| 10 | `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Catalogued (23 KB), Phase 6 content agents load | 2026-05-12 | Phase 6 content batches |
| 10 | `video_production_skills/VIRAL_GUARDRAILS.md` | Catalogued (48 KB), Phase 6 content agents load | 2026-05-12 | Phase 6 content batches |
| 11 | `lib/punctuation-guard.ts` | Loaded in orchestrator context (132 lines) | 2026-05-15 | orchestrator |
| 12 | `out/proof/2026-05-14/publish-status.json` | Catalogued (7.5 KB) | 2026-05-15 | Phase 8 agent |
| 13 | `out/proof/2026-05-14/research-broker-captions.md` | Catalogued (13 KB), Phase 2 agent expands | 2026-05-15 | Phase 2 agent |
| 14 | `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md` | Catalogued (33 KB) | 2026-05-12 | Phase 5 agent |
| 15 | `docs/MARKETING_LEAD_FLOW.md` | Catalogued (13.5 KB) | 2026-05-12 | Phase 5 agent |
| 16 | `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md` | Catalogued (16.8 KB) | 2026-05-10 | Phase 5 agent |
| 17 | `.cursor/skills/facebook-seller-growth/SKILL.md` | Catalogued | (existing) | Phase 5 agent |

## B. State of the repository (discovery findings)

Significant infrastructure already exists. This is a "complete + harden + extend" build, not green-field.

**Existing producers (32 total against the brief's expected 32-existing baseline):**

- 13 in `marketing_brain_skills/producers/` (cma, comms-matt-alert, ops-email-send, ops-fb-marketplace, ops-fub-crm, ops-manychat, ops-meta-ads, ops-reputation, site-edit, site-matterport-embed, site-page-create, site-performance, site-property-landing)
- 18 in `social_media_skills/` (agent-coop-eflyer, blog-post, broker-contact-card, coming-soon-teaser, facebook-lead-gen-ad, flyer-design, ig-single-post, instagram-carousel, linkedin-document-carousel, list-kit, meme_lord, neighbor-outreach-note, open-house-stories, postcard-farm-mailer, platform-best-practices, sold-deal-summary, under-contract-announcement, yard-sign-rider)
- 32 in `video_production_skills/` (mix of producers + capabilities)
- 16 in `automation_skills/`

**Existing brain skills (10 confirmed):** weekly-cycle, diagnose-performance, generate-briefs, audit-ads, audit-crm, audit-website, brand-voice, competitor-recon, platform-trends, snapshot-channels.

**Existing supabase migrations (20+):**
- `20260512160100_marketing_channel_daily.sql`
- `20260512160200_content_briefs.sql` (view-equivalent of marketing_brain_actions)
- `20260512160300_content_calendar.sql`
- `20260512160400_content_performance.sql`
- `20260512160500_marketing_decisions.sql`
- `20260512160600_competitor_intel.sql`
- `20260513170000_marketing_brain_actions.sql`
- `20260514120000_cma_deliveries.sql`
- `20260514120000_marketing_inbox_events.sql`
- `20260514180000_content_classification.sql`
- Neighborhood-boundary RPCs

**Phase 4.6 upgrades** therefore become `ALTER TABLE` patches plus three new tables (`marketing_cost_ledger`, `producer_change_requests`, `marketing_strategy`, `producer_execution_failures`). Schema does not need to be re-created from scratch.

**Existing crons (31 in vercel.json):**
- Marketing snapshot crons for GA4, GSC, FUB, Meta Ads, Meta Page, X, LinkedIn, TikTok, GBP, YouTube — daily at 6:30 MT
- `marketing-weekly-cycle` at 2am Mon
- `marketing-daily-digest`, `marketing-measurement-loop`, `marketing-platform-trends`, `marketing-competitor-recon`
- `marketing-inbox-poll` every 2 min

Phase 8 Part B and Phase 11.5 cron schedule additions therefore are net-adds (performance-pull-48h/7d/30d, and the renamed snapshot-channels/weekly-cycle if Matt wants them re-pathed; otherwise the existing handlers map 1:1).

**Existing app/admin/ scaffold:** only `login/` and `setup/` directories — no `/admin/producers` or `/admin/approval-queue` yet (Phases 10.5 and 10.6 net-new).

**Existing asset library:** `data/asset-library/manifest.json` (52 KB) + `data/asset-library/schema.json` (4.3 KB).

**Existing punctuation guard:** `lib/punctuation-guard.ts` confirmed — `assertNoDashes`, `hasDashes`, `findDashes`, `stripDashes`, `DashViolationError` all exported.

## C. Sub-agent + skill availability

- `general-purpose` ✅ (for deep research with web access)
- `Explore` ✅ (for read-only codebase mapping)
- `Plan` ✅ (for architecture decisions)
- `brand-voice:enforce-voice` ✅ (voice validation)
- `brand-voice:discover-brand` ✅
- `brand-voice:generate-guidelines` ✅
- `anthropic-skills:skill-creator` ✅ (Phase 6 mandatory)
- `anthropic-skills:doc-coauthoring` ✅ (Phases 1, 2, 2.5)
- `anthropic-skills:web-artifacts-builder` ✅ (Phases 10.5, 10.6, 11)
- `engineering:code-review`, `engineering:documentation`, `engineering:testing-strategy`, `engineering:debug` ✅
- `design:design-system`, `design:ux-copy` ✅
- `data:sql-queries`, `data:build-dashboard` ✅
- `marketing:campaign-plan`, `marketing:competitive-brief`, `marketing:performance-report`, `marketing:email-sequence`, `marketing:brand-review`, `marketing:content-creation`, `marketing:draft-content`, `marketing:seo-audit` ✅
- `product-management:metrics-review`, `product-management:write-spec` ✅
- `legal:compliance-check` ✅
- `enterprise-search:digest` ✅

## D. Locked canonical output paths

```
marketing_brain_skills/research/
  AUTONOMOUS_PIPELINE_BRIEF.md (already exists)
  phase-0-required-reading-log.md ← THIS FILE
  phase-1-log.md
  phase-2-log.md
  phase-2.5-log.md
  phase-2.6-log.md
  phase-3-gate-1-log.md
  phase-4-registry-diff.md
  phase-4.5-env-manifest-log.md
  phase-4.6-data-model-rationale.md
  phase-5-brain-layer-audit.md
  phase-6-producer-authoring-log.md
  phase-7-asset-wiring-log.md
  phase-7.5-validator-log.md
  phase-8-publishing-layer-audit.md
  phase-9-tool-gap-log.md
  phase-10-smoke-test-result.md
  phase-10.5-catalog-ui-log.md
  phase-10.6-approval-queue-ui-log.md
  phase-11-summary-log.md
  phase-11.5-go-live-log.md

  tool-inventory.md (Phase 1, min 8k words, 50 citations)
  platform-bible.md (Phase 2, min 10k words, 200 verbatim caption examples)
  asset-library-map.md (Phase 2.5, min 3k words)
  bend-market-bible.md (Phase 2.6, min 6k words, 30 citations)
  env-manifest.md (Phase 4.5)
  brain-decision-logic.md (Phase 5 Part B, with 10 worked examples)
  reuse-query-patterns.md (Phase 7)
  tool-acquisition-recommendations.md (Phase 9)

marketing_brain_skills/strategy/
  Q3-2026-strategy.md (Phase 5 Part B, 15k–25k words, all 27 sections)
  KPI-dashboard.md (Phase 5 Part B, 50+ metrics)
  research/
    brokerage-playbook-synthesis.md
    mountain-town-comparables.md
    framework-references.md
    persona-research.md
    local-market-intelligence.md

scripts/
  validate-producer.mjs (Phase 7.5)

app/admin/producers/
  page.tsx
  [slug]/page.tsx
  _components/
lib/producer-catalog.ts (Phase 10.5)

app/admin/approval-queue/
  page.tsx
  _components/

app/api/cron/
  performance-pull-48h/route.ts (Phase 8 Part B)
  performance-pull-7d/route.ts (Phase 8 Part B)
  performance-pull-30d/route.ts (Phase 8 Part B)
  (weekly-cycle + snapshot-channels already exist; verify; alias if needed in Phase 11.5)

vercel.json (Phase 8 + 11.5 cron additions)
docs/MARKETING_BRAIN_USER_GUIDE.md (Phase 11)
CLAUDE.md (Phase 11 — appends ## Marketing Brain Pipeline section)

supabase/migrations/ (Phase 4.6 + 10.5/10.6)
  <ts>_marketing_brain_actions_upgrade.sql (ALTER existing table)
  <ts>_marketing_cost_ledger.sql (new)
  <ts>_producer_change_requests.sql (new)
  <ts>_marketing_strategy.sql (new)
  <ts>_producer_execution_failures.sql (new)
  <ts>_content_performance_metrics_jsonb.sql (ALTER existing table to add 48h/7d/30d JSONB columns if not present)

data/asset-library/manifest.json + schema.json (Phase 4.6 schema upgrade)
lib/asset-library.mjs (types updated)

out/proof/<today>/
  pipeline-build-summary.html
  smoke-test/
  exemplars/<producer-slug>/
```

`<today>` = 2026-05-16 unless multi-day run, in which case the date stamp follows the wakeup that produced the artifact.

## E. Cost ledger (running total)

- Phase 0 spend: orchestrator tokens only (~$2-4 estimate)
- Running total: ~$3

## F. Open items surfaced for Matt (none yet — none required for this phase)

No blockers. Proceeding to dispatch Phases 1, 2, 2.5, 2.6 in parallel as sonnet subagents.

**Phase 0 status:** PASSED. Advancing to Phase 1/2/2.5/2.6 dispatch.
