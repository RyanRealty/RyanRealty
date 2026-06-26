# FUB feature-build — master goal + orchestration plan

> **Master /goal (Matt 2026-06-26):** Build the FUB features the restyle pass could not
> (because the backend didn't exist) to a production-grade, end-to-end standard —
> architecture, implementation, tests, review, real browser validation, committed.
> Don't stop at partial progress unless blocked by missing credentials, destructive
> ambiguity, or conflicting requirements. Restyle scope is DONE (see REBUILD_PROGRESS.md).

## Completion standard (every feature)
- Real backend (tables/migrations applied to hosted Supabase in the same delivery as the code).
- Wired UI on the admin console (FUB-matched look from the audit).
- The end-to-end path works in a real browser (create → save → it persists → it drives behavior).
- Tests where logic warrants; gates green (responsive, design-tokens, console-kit, build, DAL boundary).
- Committed + pushed to main, deploy verified.
- A real user can walk in and use it.

## Feature targets (FUB audit §8 + §5/§6)
1. **Automations engine** (§8.5) — triggers + conditional steps + delays + actions; visual list + builder; enrollment + execution. (Partial backend exists: crm_sequences / enrollments / workflows.)
2. **Lead Flow routing** (§8.1) — source → distribution (agent/Group/Pond) → automation trigger; advanced conditional rules.
3. **Groups** (§8.2) — round-robin / first-to-claim agent pools.
4. **Ponds** (§8.3) — shared lead pools agents claim from.
5. **Templates** (§8.6) — email + text template library + editor with merge fields. (Partial: crm_templates exists.)
6. **Calendar / Appointments** (§5) — appointment scheduling tied to contacts; types + outcomes.
7. **Deal record** (§6) — milestone dates, commission + splits, people/team, files.
8. **Team management** (§8.7) — roles, groups, permissions (brokers table exists).
9. **Import wizard** (§8.8) — CSV contact import.
10. Account/config panels (§8.13–8.19) — Phone/Company/API/Integrations/Billing/Domain-auth: triage which are in-house-relevant vs N/A.

## Orchestration
- **Phase D (discovery, parallel, read-only):** map existing backend per area → build plans + file lists (for non-overlap partitioning).
- **Phase B (build, parallel):** one agent per non-overlapping feature, each with its own /goal (deliverable + verification + standard).
- **Phase V (validate):** I browser-verify each end-to-end, run gates, resolve conflicts, commit.
- **Phase R (review):** dedicated review pass; final summary.

## Discovery dispatch (Phase D)
- D1 Automations/Sequences engine
- D2 Lead Flow / routing / Groups / Ponds
- D3 Templates (email/text)
- D4 Calendar / Appointments / Deal milestones
- D5 Team / Import / account-config panels

## Discovery synthesis (Phase D complete)
Most "gaps" have backends. Real build scope:
- **B1 Automations** — EXTEND the existing engine (crm_sequences/enrollments/crm_automation_rules + crm-sequence-engine cron + sequences/workflows UI): add `triggers` jsonb to crm_sequences, new step channels (change_stage/add_note/reassign/run_automation), conditional branching, trigger-config UI, wire stage_changed dispatch, Engaged %.
- **B2 Lead Flow + Groups + Ponds** — NET-NEW, layered on the existing routing engine (pickRoutedBroker/crm_assignment_config). 5 migrations (crm_groups/+members, crm_ponds/+members, lead_flows/+rules, crm_people.pond_id, group RR fn) + resolver + DAL + 3 action files + 3 routes + editors. Fallback preserves all-to-Matt until configured.
- **B3 Templates UX** — EXTEND (crm_templates/CRUD/merge all exist): searchable TemplatePicker, MergeFieldPicker, folder grouping (category), per-template perf columns (email_events), preview pane.
- **B4 Calendar/Appointments** — NET-NEW: crm_appointments(+types/outcomes) migration, DAL, actions, /admin/crm/calendar route + AppointmentSheet, dashboard feed.
- **B5 Deal record** — crm_deals + milestone/commission columns + crm_deal_splits/files; /admin/crm/deals/[id] detail page; kanban card → deal detail.
- **B6 Team + Import + My Settings** — Team page (admin_roles +cols, surface broker CRM/phone fields), Import wizard (crm_imports +cols, CSV → crm_people), My Settings (brokers +cols). Account panels (Company/API/Integrations/Billing) = N/A; Domain-auth (Resend) + A2P (Twilio) already done.

## Conflict-file ownership (orchestrator wires these centrally — build agents DO NOT touch)
- `app/components/admin/admin-nav.ts` (Calendar/Lead Flows/Groups/Ponds/Team/Import entries) — orchestrator.
- `app/admin/(protected)/crm/settings/page.tsx` (new setting cards) — orchestrator.
Build agents report the nav/settings entries they need; the orchestrator adds them in one synthesis commit.

## Git model: build agents do NOT commit/push or stash (shared single working tree). They build disjoint files + apply their own migrations (unique timestamps, own tables only) + browser-validate + report. Orchestrator reviews, git-adds the agent's specific files, commits, pushes serially.

## Status — COMPLETE (all stylable + buildable FUB features shipped)
- ✅ B2 Lead Flow + Groups + Ponds (wave 1) — tables + resolver (23 tests) + admin UI. Live.
- ✅ B4 Calendar + Appointments (wave 1) — table + month grid + create-appointment + dashboard KPI. Live.
- ✅ B5 Deal record (wave 1) — milestone/commission cols + splits/files + detail page. Live.
- ✅ B1 Automations engine (wave 2) — triggers col + new step channels + if/else conditions + trigger UI + dispatch + Engaged%. Backward-compatible (existing workflows verified). Live.
- ✅ B3 Templates UX (wave 2) — searchable picker, merge-field picker, folders, perf columns, preview. Live.
- ✅ B6 Team + Import + My Settings (wave 2) — permissions + Team page; CSV import wizard (unit-tested + smoke-tested); my-settings. Live.
- ✅ Synthesis — nav (Calendar/Import/My-settings) + settings catalog (Lead Distribution group, Team/Import/Appointments cards).
- N/A (FUB-product-specific, correctly skipped): Billing, API-keys marketplace, Integrations marketplace, Company settings. Already-done elsewhere: A2P (Twilio), email domain auth (Resend).
- Each browser-verified at 1440 + mobile; gates green (design-tokens 344, console-kit, nav-reachability, build); migrations applied to hosted Supabase; snapshot + DAL index refreshed.

## Orchestration note (lesson)
6 parallel build agents in ONE shared working tree: they delivered, but concurrently they
git-staged each other's files, raised 5 gate baselines, refreshed the snapshot, and 2 edited
the same lib/crm/merge.ts. The orchestrator must NOT trust the staged state — unstage, rebuild,
verify baseline bumps are legitimate (no egregious patterns), reconcile collisions, and
browser-validate per-feature before committing. For true isolation, worktrees would be cleaner,
but the repo mandates a single main checkout — so disjoint-file partitioning + central git is
the model. It worked, but required hands-on reconciliation.

## Log
- 2026-06-26: Master goal set. Phase D discovery (5 agents) → synthesis. Phase B builds in 2 waves of 3 (commits 992965ff→81767771). Phase V browser-validated each. Phase R review done. COMPLETE.
