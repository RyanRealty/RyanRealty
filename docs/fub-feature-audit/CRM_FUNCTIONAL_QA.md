# CRM functional QA — every button/link/component works end-to-end

> /goal (Matt 2026-06-26): every feature, button, link, UI component in the CRM works as
> expected — DB writes happen, notifications send, navigation works. Bar = production-grade,
> a real user can walk in and use it. Test the real thing; fix; commit; review.

## Method
- **Phase A — audit (parallel, read-only + SAFE e2e):** per surface cluster, trace EVERY
  interactive element to its handler and classify: ✅ WIRED-OK (calls a real action that
  writes/sends), ☠️ DEAD (no handler / `#` href / onClick noop / TODO / stub), 🐞 BROKEN
  (handler exists but errors / writes nothing / wrong target), ❓ UNVERIFIED. Each cluster
  writes its defect list to `docs/fub-feature-audit/qa/<cluster>.md`.
- **Phase B — fix (parallel, disjoint files):** fix the defects.
- **Phase C — verify + commit + review.**

## SAFETY (absolute — every agent)
- The preview browser at localhost:3000 is authed as matt@ → clicks fire REAL production writes.
- NEVER send a real email/SMS/call to a real contact. To test a send PATH: verify the wiring
  in code, and at most send to a dedicated ZZTEST contact or matt@ryan-realty.com — never a
  real client. Prefer code-verification over triggering a send.
- Safe mutation e2e: create ZZTEST-prefixed rows, verify via Supabase MCP service-role read,
  then DELETE them. Never bulk-mutate real records.
- Do NOT edit git / baselines / the schema snapshot. Report; the orchestrator commits.

## Clusters
- A1 Contacts list + bulk actions + smart lists + import
- A2 Contact detail (all actions: call/text/email/note/stage/broker/tags/tasks/enroll/CMA/newsletter/reports/memberships/relationships/saved-searches/custom-fields)
- A3 Inbox + Tasks + Sequences + Workflows
- A4 Deals (list + detail) + Calendar + Appointments
- A5 Settings/* CRUD (stages/tags/custom-fields/segments/areas/templates/brokers/assignment/lead-flows/groups/ponds/appointments/suppression/team) + My Settings + Import wizard
- A6 Dashboard + Approvals + Health

## Defect log (synthesized — ~250 elements audited, ~30 defects). Detail in qa/*.md.
Fix on BOTH mobile + desktop (Matt 2026-06-26).

### Feature gaps (build)
- A1: **Export CSV** dead (no action/route). **Bulk Delete** absent (no worker/UI).
- A2: **Custom fields read-only** (no write action). **No workflow-enroll button** on the contact page (action exists).
- A3: **NewTaskDialog** needs a contact SEARCH (currently raw numeric id).
- A4: **No "New deal"** entry (no createCrmDeal action). **Delete appointment** action exists, no UI button. **Calendar month prev/next** missing.
- A6: dashboard **filter selects noop** (Everyone/date/Filter-Activity, no onChange).

### Wiring fixes (action/prop exists — just connect)
- A1: 4 desktop toolbar icon buttons (mail/assign/tag/export) dead — wire to the real BulkActions.
- A2: Text/Email `href="#comms"` fails on MOBILE (hidden tab) — switch tab then scroll.
- A3: StepBuilder edit page not passed stages/brokers/sequences → change_stage/reassign/run_automation steps fall back to raw text. **Sequence Pause/Activate not superuser-guarded** (auth gap).
- A4: "Invitation sent" switch disabled + never submitted. split_pct=0 allowed. No calendar broker filter.
- A5: **Template folder rename** not passed to TemplateEditor (dead). **Pond slug erased** on name-only save (FormData guard bug). ConfigTableEditor reorder **move-up only**. Appt type/outcome delete **no confirm**.
- A6: FAB `leadIdFrom` misses `/admin/crm/:id`. "Listing reel"/"IG carousel" → wrong href (listing editor vs media). FAB "New task" doesn't auto-open. FAB "New deal" mislabeled.

### Feedback fixes (errors swallowed)
- A2 add-note, A3 inbox send error, A3 enrollment-board transitions — all `console.error` only; surface to the user.

### Cross-cutting (orchestrator)
- `revalidateTag(tag, 'max')` extra arg across action files (silently discarded).

## Fix partition (disjoint files; agents report, orchestrator commits; browser-verify 1440 + 375)
- Central (me): revalidateTag arg, sequence-status superuser guard.
- FIX-1 Contacts/bulk: crm/page.tsx, BulkAssignWrapper, BulkActions, bulk-helpers, export action/route.
- FIX-2 Contact detail: leads/[id]/page.tsx, CustomFieldsPanel, LeadTabs.
- FIX-3 Inbox/Tasks/Sequences: inbox/page.tsx, workflows/page.tsx, sequences/[id]/edit, NewTaskDialog, tasks/page.tsx, StepBuilder.
- FIX-4 Deals/Calendar: calendar/*, appointments.ts, deals/* , crm-deals.ts.
- FIX-5 Settings + Dashboard/FAB: templates/page.tsx, TemplateEditor, crm-ponds.ts, ConfigTableEditor, AppointmentSettingsClient, broker-dashboard/page.tsx, ConsoleQuickAction.

## Log
- 2026-06-26: QA goal set. Dispatching Phase A audit (read-only + safe e2e).
