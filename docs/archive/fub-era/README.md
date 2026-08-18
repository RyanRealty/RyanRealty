# Archive — the Follow Up Boss era

**Follow Up Boss was decommissioned on 2026-06-24.** Every document listed below describes an integration that cannot fire. They are kept as the historical record of what the FUB integration did and why, and for the cadence/template research inside a few of them that outlived the vendor. **Nothing here is a build target.**

## The decommission, traced to code

| Claim | Where to verify it |
|---|---|
| No vendor CRM client remains | `lib/crm/fub-env.ts` and `lib/followupboss.ts` were deleted. |
| Lead capture writes natively | `lib/crm/send-event.ts` — `sendEvent()` calls `ensureNativeLead` and creates/reuses a `public.crm_people` row. |
| The live CRM is in-house | `/admin/crm` (app/admin/(protected)/crm), `lib/crm/*`, and the `crm-*` crons registered in `vercel.json` (`crm-auto-enroll`, `crm-sequence-engine`, `crm-scheduled-sends`, `crm-gmail-sync`, and the rest). |
| Follow-up sequences replaced action plans | `lib/crm/enroll.ts` (`autoEnrollPerson`, `autoEnrollByPersonId`, `manualEnrollPerson`); sequence definitions live in Supabase `crm_sequences`; they are edited at `/admin/crm/sequences`. |

## Why the files are still at their original paths

A physical move was scoped and deliberately not done in this pass. **25 tracked source files outside `docs/` still cite these paths in comments** — `app/lp/seller-home-value/actions.ts`, `app/lp/expired-listing/actions.ts`, `app/lp/buyer-listing-alerts/actions.ts`, `app/contact/actions.ts`, `app/api/meta/lead-webhook/route.ts`, `app/actions/crm.ts`, four `components/` files, `lib/canonical-lead-tagger.ts`, `lib/expired-owner-lookup.ts`, `lib/lead-geocode.ts`, three `marketing_brain_skills/` SKILL.md files, four `supabase/migrations/*.sql`, and five `.tmp_env/fub-setup/*.mjs` scripts. Moving the docs without repointing those citations first would trade one class of dead reference for another. The citations get repointed first; the move follows.

What has been done instead, and is mechanically enforced by `scripts/check-claude-canon.mjs`:

1. Every FUB-era doc carries the `<!-- FUB-ERA-ARCHIVED -->` marker and the decommission banner, so an agent that opens one is told on line 1 not to build against it.
2. The canon docs (CLAUDE.md and the live doc set) cite **zero** FUB-era doc paths. CLAUDE.md's routing table now points the seller-LP follow-up row at the in-house sequence engine.
3. The repo-wide count of files citing a FUB-era doc is baselined and may only shrink. A new citation fails CI.
4. The FUB-era inventory may only shrink. A new `docs/FUB_*.md` fails CI.

## Inventory (20 files)

| File | What it was |
|---|---|
| `docs/FOLLOWUPBOSS-SETUP.md` | API key, system registration, lead source setup |
| `docs/FUB_AGENT_LINK_AND_EXPIRED_LP_RESEARCH_2026-05-17.md` | Research behind the expired-listing LP voice and content |
| `docs/FUB_AUDIT_2026-05-17.md` | The audit that drove the 2026-05-17 workflow redesign |
| `docs/FUB_BROKER_DIGESTS.md` | Per-broker digest spec |
| `docs/FUB_BUILD_COMPLETE_2026-05-17.md` | Build completion record |
| `docs/FUB_BUYER_WORKFLOW_2026-05-17.md` | Buyer-side workflow spec |
| `docs/FUB_CLEANUP_FINAL_2026-05-17.md` | Data cleanup record |
| `docs/FUB_COMPLETE_LEAD_FLOW_2026-05-17.md` | End-to-end lead flow |
| `docs/FUB_COMPLETION_FINAL_2026-05-17.md` | Completion record |
| `docs/FUB_CRM_FEATURE_SPEC.md` | Feature spec used as the parity target for the in-house CRM |
| `docs/FUB_CUSTOM_FIELDS.md` | Custom-field configuration (seeded `crm_field_definitions`) |
| `docs/FUB_FSBO_WORKFLOW.md` | FSBO workflow spec |
| `docs/FUB_GEO_TAGGING_2026-05-17.md` | Geo-tagging spec (seeded the geo resolver) |
| `docs/FUB_LEAD_WORKFLOW_LIVE_AUDIT_2026-05-29.md` | Live audit of the lead workflow |
| `docs/FUB_OPTIMIZATION_AUDIT_2026-05-17.md` | Optimization audit |
| `docs/FUB_ROUND2_COMPLETE_2026-05-17.md` | Round-2 completion record |
| `docs/FUB_SELLER_WORKFLOW_2026-05-17.md` | The locked seller workflow. Its cadence research and template copy are the one part still worth reading |
| `docs/FUB_SMART_LISTS_STARTER_PACK.md` | Smart-list starter pack |
| `docs/FUB_UI_SETUP_RUNBOOK.md` | Step-by-step FUB-UI configuration runbook |
| `docs/HANDOFF_FUB_SMART_LIST_WIRING_2026-05-27.md` | Smart-list wiring handoff |

Not in this set, deliberately: `docs/MOBILE_CRM_FUB_PARITY.md` is a live design contract for **our** mobile CRM (the bar it names is FUB mobile), cited by shipped components, and is not a FUB-API spec. `docs/fub-crm-spec/` and `docs/fub-feature-audit/` are separate trees with their own consolidation verdicts, and `docs/fub-crm-spec/crm-screens.json` plus `docs/fub-crm-spec/_verify/*.png` are live machinery read by `scripts/check-crm-screen-parity.mjs`.
