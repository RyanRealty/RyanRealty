# Phase 5 Part A — Brain layer audit

**Started:** 2026-05-17T00:00:00Z
**Finished:** 2026-05-17T00:15:00Z
**Skills audited:** 10

---

## Summary table

| skill | inputs clear | outputs clear | references complete | gaps | priority |
|---|---|---|---|---|---|
| weekly-cycle | partial | partial | no | 9 | P0 |
| diagnose-performance | yes | yes | no | 7 | P1 |
| generate-briefs | yes | yes | partial | 8 | P0 |
| audit-ads | yes | yes | no | 7 | P1 |
| audit-crm | yes | yes | no | 7 | P1 |
| audit-website | yes | yes | no | 7 | P1 |
| brand-voice | partial | partial | no | 8 | P0 |
| competitor-recon | yes | yes | no | 6 | P1 |
| platform-trends | yes | yes | partial | 7 | P1 |
| snapshot-channels | partial | yes | no | 8 | P0 |

---

## Per-skill findings (10 sections)

### weekly-cycle
- Path: `marketing_brain_skills/weekly-cycle/SKILL.md`
- Lines: 108
- Frontmatter: name, description present. Missing: `when_to_use` trigger block in frontmatter (present only as body section).
- A. Input contract: Calls 11 channels plus 3 deep audits. Does not explicitly list required Supabase tables, required env vars, or skill dependency graph. The reader must infer these from the Related skills section.
- B. Output contract: Describes WeeklyCycleReport shape in a TypeScript interface block. Does not state which tables it writes to beyond a one-line mention of `marketing_decisions`. Does not mention `content_briefs`, `marketing_brain_actions`, or the Phase 4.6 upgraded tables.
- C. Bibles referenced: None. `tool-inventory.md` not cited. `platform-bible.md` not cited. `asset-library-map.md` not cited. `bend-market-bible.md` not cited.
- D. Phase 4.6 data model referenced: No. No mention of `marketing_cost_ledger`, `producer_change_requests`, `marketing_strategy`, `producer_execution_failures`, `marketing_brain_actions_upgrade`, or `content_performance_upgrade`.
- E. Decision logic referenced: N/A (weekly-cycle is an orchestrator, not the scorer). Does not forward-reference `brain-decision-logic.md` or Q3-2026-strategy.md.
- F. Voice guidelines: Not directly cited. Voice enforcement is delegated to generate-briefs and brand-voice skill, but weekly-cycle does not name `voice_guidelines.md` as a required load.
- G. CLAUDE.md §0+§0.5: Not cited. No mention of the data accuracy mandate or Draft-First, Commit-Last gate.
- H. Gaps:
  1. No table manifest (which Supabase tables this skill reads or writes).
  2. No env var list (CRON_SECRET only, but downstream skills need APIFY_API_TOKEN, GA4 credentials, FUB token, etc. and the orchestrator should surface these).
  3. Missing all four Phase 1/2/2.5 bibles.
  4. Missing Phase 4.6 data model reference.
  5. Missing CLAUDE.md §0 (data accuracy) citation.
  6. Missing CLAUDE.md §0.5 (Draft-First) citation.
  7. Cron schedule comment says "Monday 02:00 UTC" but the body says "Sunday evening" -- the two are consistent but confusingly worded.
  8. Idempotency section flags generate-briefs deduplication as a TODO ("NOT yet") with no owner or target date.
  9. No forward reference to brain-decision-logic.md or Q3-2026-strategy.md.
- I. Recommended changes:
  1. Add a "Required inputs" section listing tables read (marketing_channel_daily, competitor_intel, content_briefs, marketing_decisions) and env vars needed by the full dependency chain.
  2. Add a "Writes to" section naming every table that any sub-skill writes to in a single weekly cycle.
  3. Add "Required references" section citing all four bibles and phase-4.6-data-model-rationale.md.
  4. Add a CLAUDE.md compliance note (§0 data accuracy and §0.5 Draft-First apply to any deliverable surface this cycle produces).
  5. Resolve the deduplication TODO with a target milestone.
- J. Priority: P0. weekly-cycle is the entry point every Phase 6 producer will reference to understand the full brain contract. An incomplete orchestrator spec blocks producer design.

---

### diagnose-performance
- Path: `marketing_brain_skills/diagnose-performance/SKILL.md`
- Lines: 176
- Frontmatter: name, description present. Frontmatter description is terse but includes table and trigger path.
- A. Input contract: Clearly states "Reads from `public.marketing_channel_daily`." States minimum data requirements (30 days for z-scores, 14 days before anomalies fire). No env var list; CRON_SECRET is needed for the HTTP trigger but not mentioned here.
- B. Output contract: Returns `InsightSummary` clearly typed. States writes to `public.marketing_decisions` only for flagged anomalies. Output contract is the most complete of any skill in this set.
- C. Bibles referenced: None. All four bibles (tool-inventory, platform-bible, asset-library-map, bend-market-bible) absent.
- D. Phase 4.6 data model referenced: No.
- E. Decision logic referenced: N/A (diagnose-performance feeds generate-briefs; it does not run the priority_score formula itself).
- F. Voice guidelines: Not cited. This skill produces machine-readable signals, not consumer content, so a direct voice load is low-value. However, `RecommendedAction` tags flow into briefs that are voice-checked, so a forward reference to brand-voice is appropriate.
- G. CLAUDE.md §0+§0.5: Not cited.
- H. Gaps:
  1. No env var list (CRON_SECRET required).
  2. All four Phase 1/2/2.5 bibles absent.
  3. Phase 4.6 data model absent.
  4. CLAUDE.md §0 not cited.
  5. CLAUDE.md §0.5 not cited.
  6. No forward reference to generate-briefs' priority_score formula or brain-decision-logic.md.
  7. `RecommendedAction` vocabulary is defined here and reused everywhere, but this skill does not explicitly state it owns the canonical definition.
- I. Recommended changes:
  1. Add "Env vars required: CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY."
  2. Add "Canonical vocabulary owner" note at the top of the RecommendedAction table.
  3. Add "Required references" section with bibles and Phase 4.6 data model.
  4. Add CLAUDE.md §0 compliance note.
- J. Priority: P1. Clean contracts. The missing references are hygiene gaps, not blockers for Phase 6 producers reading this skill.

---

### generate-briefs
- Path: `marketing_brain_skills/generate-briefs/SKILL.md`
- Lines: 188
- Frontmatter: name, description present. Frontmatter description names tables written to and the HTTP trigger path.
- A. Input contract: Well documented. SignalBundle lists all six signal sources with their origin function. Soft-fail behavior (per-source) is stated.
- B. Output contract: GeneratedBrief interface is fully typed. Persistence flow is described step by step. Tables written to are named: `content_briefs`, `marketing_decisions`.
- C. Bibles referenced: `voice_guidelines.md` is cited (§6 hard-fail rules). The other three bibles (tool-inventory, platform-bible, asset-library-map, bend-market-bible) are absent.
- D. Phase 4.6 data model referenced: No. The skill names `content_briefs` and `marketing_decisions` but does not cite the upgraded schemas from phase-4.6-data-model-rationale.md. The `marketing_brain_actions` table is not mentioned at all, which is a significant gap given that Phase 6 producers will route through `marketing_brain_actions` not `content_briefs`.
- E. Decision logic referenced: No. The opportunity ranking formula used is a simplified `rank_score = severity_score x north_star_weight`. The Phase 5 target formula (`priority_score = 0.50 x north_star_impact + 0.20 x brand_position_lift + 0.15 x channel_growth + 0.10 x site_or_ad_health + 0.05 x brand_equity`) is entirely absent. This is the most critical gap in this skill. brain-decision-logic.md and Q3-2026-strategy.md are not referenced.
- F. Voice guidelines: Yes. `marketing_brain_skills/brand-voice/voice_guidelines.md` §6 is cited explicitly.
- G. CLAUDE.md §0+§0.5: Not cited. Given that generate-briefs produces the copy seeds for all downstream content, a CLAUDE.md §0 citation is important for agents reading this skill.
- H. Gaps:
  1. Opportunity ranking formula is the old simplified version, not the Phase 5 five-factor formula.
  2. No reference to brain-decision-logic.md.
  3. No reference to Q3-2026-strategy.md.
  4. marketing_brain_actions table not mentioned (Phase 6 producers write to this table, not content_briefs directly).
  5. Phase 4.6 data model rationale not cited.
  6. Three bibles (tool-inventory, platform-bible, asset-library-map, bend-market-bible) absent.
  7. CLAUDE.md §0 and §0.5 not cited.
  8. No mention of the producer registry (REGISTRY.md) as the routing target once briefs are generated.
- I. Recommended changes:
  1. Replace the rank_score formula with the five-factor priority_score and add a reference to brain-decision-logic.md.
  2. Add a "Writes to" clarification that distinguishes content_briefs (current) from marketing_brain_actions (Phase 6 target schema).
  3. Add "Required references" section including phase-4.6-data-model-rationale.md and Q3-2026-strategy.md.
  4. Add CLAUDE.md §0 compliance note.
  5. Add a "Next step" note pointing to REGISTRY.md as the routing destination after brief generation.
- J. Priority: P0. The missing priority_score formula means any Phase 6 producer that reads this skill to understand how briefs are ranked will use the wrong model.

---

### audit-ads
- Path: `marketing_brain_skills/audit-ads/SKILL.md`
- Lines: 208
- Frontmatter: name, description present. Description names tables read and HTTP trigger path.
- A. Input contract: Clearly states it reads only from `public.marketing_channel_daily`. Scope filters (channel='meta_ads' and channel='fub') are documented. Minimum data requirements stated. No env var list beyond the implicit CRON_SECRET for the HTTP trigger.
- B. Output contract: AdsAuditReport interface fully typed. Opportunity interface typed. Output is consumed by generate-briefs; that relationship is documented. No mention of any direct write to `marketing_decisions` or any other table (this skill is read-only and returns a struct, which is correct and should be stated explicitly).
- C. Bibles referenced: `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md` is cited (campaign structure and budget targets). The four Phase 1/2/2.5 research bibles (tool-inventory, platform-bible, asset-library-map, bend-market-bible) are absent.
- D. Phase 4.6 data model referenced: No.
- E. Decision logic referenced: N/A.
- F. Voice guidelines: Not cited. This skill produces structured audit data, not consumer content. A voice reference is not needed for the skill's core function, but it should note that downstream voice validation happens in generate-briefs.
- G. CLAUDE.md §0+§0.5: Not cited.
- H. Gaps:
  1. No env var list.
  2. All four Phase 1/2/2.5 bibles absent.
  3. Phase 4.6 data model absent.
  4. CLAUDE.md §0 and §0.5 not cited.
  5. Skill does not explicitly state it is read-only (no writes to any Supabase table).
  6. No reference to brain-decision-logic.md as the downstream consumer of this skill's opportunity rankings.
  7. Extending thresholds section says "requires Matt sign-off" but does not describe the approval mechanism.
- I. Recommended changes:
  1. Add "Env vars required" section.
  2. Add explicit "This skill is read-only. No rows are written to any table. Output is consumed by generate-briefs only."
  3. Add "Required references" section with bibles and Phase 4.6 rationale.
  4. Add CLAUDE.md §0 compliance note.
  5. Define what "Matt sign-off" means for threshold changes (e.g., chat approval + SKILL.md commit).
- J. Priority: P1. Audit-ads is well-specified for its core function. Gaps are documentation hygiene.

---

### audit-crm
- Path: `marketing_brain_skills/audit-crm/SKILL.md`
- Lines: 236
- Frontmatter: name, description present. Description names the table read and HTTP trigger path.
- A. Input contract: Clearly states reads only from `public.marketing_channel_daily` where `channel = 'fub'`. All scope levels and metrics are documented in detail. No env var list.
- B. Output contract: CRMAuditReport fully typed with sub-interfaces. Notes the skill is consumed by generate-briefs. Does not state whether it writes to any table (it does not; this should be stated explicitly).
- C. Bibles referenced: `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md` cited for SLA thresholds and seller-tag vocabulary. The four Phase 1/2/2.5 research bibles are absent.
- D. Phase 4.6 data model referenced: No.
- E. Decision logic referenced: N/A.
- F. Voice guidelines: Not cited. Same rationale as audit-ads (data-only output, voice enforced downstream).
- G. CLAUDE.md §0+§0.5: Not cited.
- H. Gaps:
  1. No env var list.
  2. All four Phase 1/2/2.5 bibles absent.
  3. Phase 4.6 data model absent.
  4. CLAUDE.md §0 and §0.5 not cited.
  5. Source quality formula uses per-account allocation proxy for per-source outcomes. This approximation is documented as a known limitation but there is no TODO with a target milestone to fix it.
  6. Skill does not explicitly state it is read-only.
  7. No reference to brain-decision-logic.md.
- I. Recommended changes:
  1. Add "Env vars required" section.
  2. Add explicit read-only statement.
  3. Add "Required references" section with bibles and Phase 4.6 rationale.
  4. Add CLAUDE.md §0 note.
  5. Promote the per-source allocation approximation to a tracked TODO with a milestone tied to ingestor enhancement.
- J. Priority: P1. Well-specified. Gaps are documentation hygiene plus one known data limitation that needs a milestone.

---

### audit-website
- Path: `marketing_brain_skills/audit-website/SKILL.md`
- Lines: 168
- Frontmatter: name, description present. Description names tables read and HTTP trigger path.
- A. Input contract: Clearly states it reads from `marketing_channel_daily` using ga4, gsc, and fub channels. Minimum data requirements stated. No env var list.
- B. Output contract: WebsiteAuditReport typed. Explicitly states that page-leak CRO tasks never produce a brief (they go to marketing_decisions only). This is important for generate-briefs and is correctly documented here.
- C. Bibles referenced: None. All four Phase 1/2/2.5 bibles absent.
- D. Phase 4.6 data model referenced: No.
- E. Decision logic referenced: N/A.
- F. Voice guidelines: Not cited. Correct for a data-only skill.
- G. CLAUDE.md §0+§0.5: Not cited.
- H. Gaps:
  1. No env var list.
  2. All four Phase 1/2/2.5 bibles absent.
  3. Phase 4.6 data model absent.
  4. CLAUDE.md §0 and §0.5 not cited.
  5. Skill does not explicitly state it is read-only.
  6. `pause_underperformer` tag in the vocabulary table is noted as "(reserved for future funnel logic -- not currently emitted)" but there is no milestone or condition to activate it.
  7. No reference to brain-decision-logic.md.
- I. Recommended changes:
  1. Add "Env vars required" section.
  2. Add explicit read-only statement.
  3. Add "Required references" section.
  4. Add CLAUDE.md §0 note.
  5. Either add a milestone condition for `pause_underperformer` or remove the reserved entry to reduce confusion.
- J. Priority: P1. Well-structured. Gaps are documentation hygiene.

---

### brand-voice
- Path: `marketing_brain_skills/brand-voice/SKILL.md`
- Lines: 192
- Frontmatter: name, description present. Description is thorough, listing all content types covered and mandatory load conditions.
- A. Input contract: The skill accepts "a piece of content." It does not state which Supabase table it reads from for validation logging, although the Validation flow section mentions writing to `marketing_decisions`. No env var list. No stated dependency on specific tables for the validation input (content is passed directly, not read from a table).
- B. Output contract: Validation result is described as pass, hard fail, or soft flag with rules cited. States writes to `marketing_decisions`. Does not describe the shape of the `marketing_decisions` row it inserts, making it harder for downstream agents to query the decision log.
- C. Bibles referenced: `voice_guidelines.md` and `corpus/gbp_responses.md` are cited extensively. The four Phase 1/2/2.5 bibles are absent. This is arguably low-importance for a voice enforcement skill but there is a `bend-market-bible.md` reference that should be present because market data claims must be voice-checked against the bend-market context.
- D. Phase 4.6 data model referenced: No. `marketing_decisions` is referenced but the Phase 4.6 schema upgrades are not mentioned.
- E. Decision logic referenced: N/A.
- F. Voice guidelines: Yes. This skill is the voice guidelines skill. Full references to `voice_guidelines.md` are throughout.
- G. CLAUDE.md §0+§0.5: Not cited. Given this is the content gate, a CLAUDE.md §0 citation is a notable absence. The data accuracy rule (§0) is a peer requirement to voice compliance, not a subset of it.
- H. Gaps:
  1. No env var list (SUPABASE_SERVICE_ROLE_KEY needed to write marketing_decisions).
  2. Shape of the marketing_decisions row written by this skill is not described.
  3. All four Phase 1/2/2.5 bibles absent (bend-market-bible is particularly relevant for verifying market claims).
  4. Phase 4.6 data model not cited.
  5. CLAUDE.md §0 not cited.
  6. `marketing-brain:dispatch-content` is referenced in Related skills but that skill does not appear to exist in the current brain skill set. This is a dangling reference.
  7. Soft flag "over time the brain learns which Matt consistently overrides" implies an adaptive threshold system that is not implemented and not described in any skill. This creates false expectations.
  8. No mention of CLAUDE.md §0.5 (Draft-First gate).
- I. Recommended changes:
  1. Add "Env vars required" section.
  2. Add the marketing_decisions row schema for validation events.
  3. Resolve or remove the dangling `dispatch-content` reference.
  4. Remove or qualify the "brain learns" soft-flag statement until an implementation exists.
  5. Add CLAUDE.md §0 and §0.5 compliance notes.
  6. Add bend-market-bible.md to Required references.
- J. Priority: P0. Every Phase 6 content producer will call this skill as a gate. The dangling dispatch-content reference and missing §0 citation are blockers.

---

### competitor-recon
- Path: `marketing_brain_skills/competitor-recon/SKILL.md`
- Lines: 183
- Frontmatter: name, description present. Description names the table written to and the cron route path.
- A. Input contract: Env vars explicitly listed (APIFY_API_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET) with sourcing instructions. This is the best env var documentation of any skill in the set.
- B. Output contract: Table written to (`competitor_intel`) is named. Row taxonomy is documented (source, data_type, competitor, data, apify_run_id, observation_date). Downstream consumers (diagnose-performance, generate-briefs) are named. Output contract is clear.
- C. Bibles referenced: None. All four Phase 1/2/2.5 bibles absent. `platform-bible.md` is particularly relevant for validating which platforms to monitor.
- D. Phase 4.6 data model referenced: No.
- E. Decision logic referenced: N/A.
- F. Voice guidelines: Not cited. Correct for a data collection skill.
- G. CLAUDE.md §0+§0.5: Not cited.
- H. Gaps:
  1. All four Phase 1/2/2.5 bibles absent.
  2. Phase 4.6 data model absent.
  3. CLAUDE.md §0 and §0.5 not cited.
  4. Social handles for local competitors are marked `verified: false` with no instructions on who verifies them or by what date.
  5. Actor input shape mismatches are flagged as a failure mode with "see TODO comments in each scraper" but no tracking issue or milestone exists.
  6. No reference to brain-decision-logic.md or Q3-2026-strategy.md as consumers of competitor signal.
- I. Recommended changes:
  1. Add "Required references" section with bibles and Phase 4.6 rationale.
  2. Add CLAUDE.md §0 and §0.5 compliance notes.
  3. Set a target milestone for verifying local competitor social handles.
  4. Promote the actor input shape TODO to a tracked issue with owner.
- J. Priority: P1. Env vars and output contract are the best in the set. Gaps are reference hygiene and two open TODOs.

---

### platform-trends
- Path: `marketing_brain_skills/platform-trends/SKILL.md`
- Lines: 202
- Frontmatter: name, description present. Description names the table written to (competitor_intel), the cron route, and the helper lib path.
- A. Input contract: Env vars explicitly listed (same four as competitor-recon). Source URLs documented per scraper function. Apify actor IDs named. Clear input contract.
- B. Output contract: PlatformTrendsReport fully typed. Table written to (competitor_intel) is named with row schema documented. Downstream consumer (generate-briefs via `act_on` array) is named. Output contract is clear.
- C. Bibles referenced: `voice_guidelines.md` is cited (VOICE_VIOLATION_PATTERNS reference the exact section numbers). The other three bibles (tool-inventory, platform-bible, asset-library-map, bend-market-bible) are absent. `platform-bible.md` is directly relevant here and its absence is a notable gap.
- D. Phase 4.6 data model referenced: No.
- E. Decision logic referenced: N/A.
- F. Voice guidelines: Yes. Cited by section number within the VOICE_VIOLATION_PATTERNS table.
- G. CLAUDE.md §0+§0.5: Not cited.
- H. Gaps:
  1. All Phase 1/2/2.5 bibles except voice_guidelines.md absent. platform-bible.md absence is particularly notable.
  2. Phase 4.6 data model absent.
  3. CLAUDE.md §0 and §0.5 not cited.
  4. TikTok Creative Center is identified as a known failure mode (SPA cannot be parsed by RAG browser) with a TODO to switch actors. No milestone or owner.
  5. RyanRealtyAdaptations filter is described but the "monitor" bucket's promotion path to "act_on" is not documented (when does a monitored trend graduate?).
  6. No reference to brain-decision-logic.md or Q3-2026-strategy.md.
  7. `platform-bible.md` would inform which platforms to prioritize in the trend scrape and is the obvious missing reference here.
- I. Recommended changes:
  1. Add "Required references" section including platform-bible.md and Phase 4.6 rationale.
  2. Add CLAUDE.md §0 and §0.5 notes.
  3. Promote the TikTok Creative Center actor TODO to a tracked milestone.
  4. Document the monitor-to-act_on promotion rule (e.g., "a trend in monitor for two consecutive weekly cycles with growing signal moves to act_on").
- J. Priority: P1. Well-specified. The platform-bible absence and missing monitor promotion rule are the most meaningful gaps.

---

### snapshot-channels
- Path: `marketing_brain_skills/snapshot-channels/SKILL.md`
- Lines: 142
- Frontmatter: name, description present. Description names the table written to, the cron path, and idempotency behavior.
- A. Input contract: Channel inventory table lists all channels with route, helper lib, and status. However, env vars are not listed. Each channel's helper lib has different API credential requirements (GA4 service account, Meta token, FUB API key, etc.) and none of these are enumerated here. An agent building a new ingestor has no single-document reference for what credentials to provision.
- B. Output contract: `marketing_channel_daily` is the output table. Row taxonomy is documented (scope levels, metric naming, source naming, idempotency key). Output contract is clear. However, the skill does not list which metrics each live ingestor actually writes, meaning downstream audits cannot verify coverage without running a live query.
- C. Bibles referenced: None. All four Phase 1/2/2.5 bibles absent. `tool-inventory.md` is particularly relevant here since it inventories all API credentials and connection status.
- D. Phase 4.6 data model referenced: No.
- E. Decision logic referenced: N/A.
- F. Voice guidelines: Not cited. Correct for a data ingest skill.
- G. CLAUDE.md §0+§0.5: Not cited. CLAUDE.md §0 is relevant here: the brain's data accuracy guarantee depends on snapshot-channels writing correct numbers, and any agent extending an ingestor should know the data accuracy rule applies at the ingest layer too.
- H. Gaps:
  1. No env var list (major gap given the credential diversity across 15 channels).
  2. All four Phase 1/2/2.5 bibles absent. tool-inventory.md absence is critical.
  3. Phase 4.6 data model absent.
  4. CLAUDE.md §0 not cited (data accuracy at ingest is the foundation for all downstream claims).
  5. CLAUDE.md §0.5 not cited.
  6. Per-ingestor metric manifest is absent. An agent cannot confirm a channel is writing the right metrics without a live Supabase query.
  7. 11 of 15 channels are in Pending or Skipped status with no target dates for completion.
  8. No reference to brain-decision-logic.md or Q3-2026-strategy.md, which determine which channel metrics are highest-priority to bring online first.
- I. Recommended changes:
  1. Add "Env vars required per channel" table, cross-referencing tool-inventory.md as the authoritative credential source.
  2. Add "Required references" section with tool-inventory.md and Phase 4.6 rationale.
  3. Add CLAUDE.md §0 compliance note at the top of the skill ("every metric written by an ingestor is a primary source under the data accuracy mandate").
  4. Add per-channel metric manifest or link to a live query that surfaces coverage.
  5. Add target milestones for the 11 Pending/Skipped channels, prioritized by what Q3-2026-strategy.md and brain-decision-logic.md identify as highest-value channels.
- J. Priority: P0. Snapshot-channels is the data foundation for every downstream audit, diagnose, and brief. Missing env vars and the tool-inventory.md reference mean any agent building a new ingestor will lack the credential context and the API status picture.

---

## Aggregate gap list

Sorted by priority.

### P0 gaps (blockers for Phase 6 producers)

1. **generate-briefs: priority_score formula is wrong.** The current formula is `rank_score = severity_score x north_star_weight`. The Phase 5 formula is `priority_score = 0.50 x north_star_impact + 0.20 x brand_position_lift + 0.15 x channel_growth + 0.10 x site_or_ad_health + 0.05 x brand_equity`. Every Phase 6 producer reads generate-briefs to understand how briefs are ranked. Wrong formula = wrong prioritization model. (generate-briefs)
2. **generate-briefs: marketing_brain_actions table not mentioned.** Phase 6 producers route through `marketing_brain_actions`, not `content_briefs` directly. generate-briefs must reference this table and clarify the Phase 4.6 upgrade path. (generate-briefs)
3. **weekly-cycle: no table manifest or env var list.** The orchestrator entry point does not enumerate what it reads, what it writes, or what credentials the full dependency chain requires. Phase 6 producers start by reading weekly-cycle. (weekly-cycle)
4. **brand-voice: dangling dispatch-content reference.** The Related skills section references `marketing-brain:dispatch-content`, a skill that does not exist in the current brain skill set. Any Phase 6 producer reading this will assume a dispatch-content routing layer exists and build against it incorrectly. (brand-voice)
5. **brand-voice: CLAUDE.md §0 not cited.** Brand-voice is the content gate. Data accuracy is a parallel gate, not subordinate to voice. An agent running brand-voice validation without knowing §0 may pass a brief that contains an unverified market statistic. (brand-voice)
6. **snapshot-channels: no env var list and tool-inventory.md not cited.** Any agent adding a new ingestor channel has no single-document credential reference. The 11 pending channels cannot be built without this. (snapshot-channels)
7. **snapshot-channels: CLAUDE.md §0 not cited.** Data accuracy at the ingest layer is the foundation for the entire brain. This citation should be at the top of the skill. (snapshot-channels)

### P1 gaps (should fix before Phase 11.5 go-live)

8. No skill cites `tool-inventory.md`, `platform-bible.md`, `asset-library-map.md`, or `bend-market-bible.md`. This is a universal gap across all 10 skills. (all 10 skills)
9. No skill cites `phase-4.6-data-model-rationale.md` or any of the Phase 4.6 migration names. (all 10 skills)
10. No skill cites `brain-decision-logic.md` or `Q3-2026-strategy.md`. Both are Phase 5B deliverables but generate-briefs, weekly-cycle, and snapshot-channels should at least contain a "pending Phase 5B" forward reference. (generate-briefs, weekly-cycle, snapshot-channels)
11. CLAUDE.md §0.5 (Draft-First, Commit-Last) not cited in any skill. Relevant for weekly-cycle and brand-voice since both interact with publishable content. (weekly-cycle, brand-voice, generate-briefs)
12. diagnose-performance: does not explicitly claim ownership of the canonical RecommendedAction vocabulary, which it defines and all other skills reuse. (diagnose-performance)
13. brand-voice: soft-flag "brain learns" adaptive threshold system is described but not implemented. Creates false expectations for Phase 6 producers. (brand-voice)
14. audit-crm: per-source outcome allocation is a documented approximation with no milestone to fix it. (audit-crm)
15. platform-trends: monitor-to-act_on promotion rule is undocumented. (platform-trends)
16. platform-trends: platform-bible.md is the most relevant absent reference for this skill. (platform-trends)
17. snapshot-channels: per-ingestor metric manifest is absent. (snapshot-channels)
18. snapshot-channels: 11 of 15 channels are Pending/Skipped with no target dates. (snapshot-channels)
19. competitor-recon: local competitor social handles marked verified=false with no verification timeline. (competitor-recon)

### P2 gaps (nice-to-have)

20. weekly-cycle: cron schedule wording inconsistency between "Sunday evening" (body) and "Monday 02:00 UTC" (schedule). Technically consistent but confusing. (weekly-cycle)
21. audit-ads, audit-crm, audit-website: none explicitly states the skill is read-only (no Supabase writes). This should be a one-liner so Phase 6 producers do not accidentally assume these skills mutate state. (audit-ads, audit-crm, audit-website)
22. audit-ads: threshold change approval process ("requires Matt sign-off") is undescribed. (audit-ads)
23. audit-website: `pause_underperformer` vocabulary entry is reserved but never emitted. Either activate it or remove it. (audit-website)

---

## Rewrite recommendation

### P0 gaps and which Phase 6 producers block on them

| Gap | Blocking Phase 6 producers |
|---|---|
| generate-briefs: wrong priority_score formula | Any producer that reads generate-briefs to understand brief ranking. fb_ad_creative, ig_reel, blog_post producers will prioritize the wrong opportunities if the formula is not corrected before they are built. |
| generate-briefs: marketing_brain_actions not mentioned | Every Phase 6 producer writes to marketing_brain_actions. If generate-briefs does not document this table, producers have no authoritative reference for how briefs flow into the action queue. |
| weekly-cycle: no table manifest or env vars | Phase 6 producers that need to understand the full execution context (what data is available, what credentials are needed) will lack the entry point. |
| brand-voice: dangling dispatch-content reference | Any Phase 6 producer that models its routing on the brand-voice Related skills section will wire to a non-existent skill. |
| brand-voice: CLAUDE.md §0 not cited | Phase 6 content producers that use brand-voice as their sole gate may ship briefs with unverified market statistics. |
| snapshot-channels: no env vars, no tool-inventory.md | Phase 6 producers that trigger new channel ingestion (e.g. a producer that needs youtube or linkedin data) cannot provision credentials without this reference. |
| snapshot-channels: CLAUDE.md §0 not cited | Phase 6 producers that trust channel data as accurate without the §0 provenance check may propagate unverified numbers into briefs. |

**Recommended rewrite order for Phase 5B:**
1. generate-briefs (priority_score + marketing_brain_actions + brain-decision-logic.md forward reference)
2. weekly-cycle (table manifest + env var list + Phase 4.6 reference)
3. brand-voice (remove dispatch-content + add §0 + describe marketing_decisions row shape)
4. snapshot-channels (env var table + tool-inventory.md reference + §0 citation)
5. All 10 skills: universal reference block (tool-inventory, platform-bible, asset-library-map, bend-market-bible, phase-4.6-data-model-rationale, Q3-2026-strategy, brain-decision-logic where applicable)
