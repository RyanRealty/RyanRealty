# /goal — Lifecycle workflows 100% dialed in (Expired→CMA · Newsletter · Saved Searches · Market Reports)

**Owner:** Cursor agent session, 2026-07-06. **Status: in flight.**
**Matt directives (2026-07-06):** (1) CMAs must actually BUILD (queued rows are stuck), reviewable by Matt, then manually sent to a lead. (2) Newsletter generated on the 1st, Matt approves, delivered gradually to protect sender reputation. (3) Every feature — assigning, emailing, tracking opens/clicks, editing, deleting — verified end to end. (4) All public-facing pages, reports, and emails look like ONE system: the brutalist navy/cream style of the existing web pages and the CMA. Admin pages do NOT need the branding. (5) Approval surfaces show a rendered visual preview, never raw HTML. (6) Nothing is sacred — remove anything that blocks an optimized workflow (the legacy React-PDF CMA path dies). Goal: convert readers into active clients on the strength of the reports.

## End state (definition of done)

1. **CMA:** `createCmaRequest` rows get BUILT automatically by a deterministic server-side builder (no LLM dependency) — subject + comps + adjustment grid + market context + 3-method pricing + disclosure (incl. ORS 696.820) rendered in the canonical brutalist CMA style, HTML stored in DB/storage (Vercel-safe), served at `/cma/[slug]`, PDF at `/api/cma/[slug]/pdf`. Expired-listing detection and seller-LP submissions auto-build a draft. `/admin/cmas` gains: manual "Build CMA" form (any address), per-CMA review page with live preview iframe, edit, approve, and tracked "Send to lead" (Resend branded email + Gmail-draft option). The 12 stuck `in_production` action rows are drained to reviewable drafts. Legacy `cma_deliveries` React-PDF path retired; CRM contact card uses the canonical pipeline.
2. **Newsletter:** auto-draft cron on the 1st of each month (produceNewsletterDraft + Matt notification), visual-first review page (rendered preview leads; HTML behind a tab), Schedule action (default send from the ~3rd, existing engagement-tiered tranches deliver over days), pixel events land on the newsletter ledger, pause/resume control, subscriber management complete (search/filter, edit, delete, CSV export, broker column).
3. **Saved searches + market reports:** admin hub gains per-row engagement (sends/opens/clicks), edit-filters and edit-areas dialogs, correct `sendType` classification (`alert`), `sent` events recorded for alerts, signed-in queue fairness (overdue-first + cursor advance), email search for report subs, working manage/unsubscribe links from `/account/notifications`.
4. **One brand system:** a shared brutalist email shell (derived from the approved newsletter shell + CMA aesthetic: navy `#102742`, cream `#faf8f4`, display serif moments, hard rules, tabular nums) used by newsletter, listing alerts, market reports, and CMA delivery. Legacy templates (welcome gold CTA etc.) migrated. Public CMA/report pages match the site. Admin pages untouched.
5. **Ship:** `npm run build` + `npx vitest run` + `npm run ci:gates` green; hosted Supabase migrations applied; pushed to `main`; `npm run deploy:verify` exit 0; browser-verified end to end (admin review flows + real test emails to matt@ryan-realty.com with open/click rows proven). NO outbound sends to real leads/subscribers — everything lands as drafts for Matt's approval.

## Workstreams + file ownership (exclusive)

| WS | Scope | Owns |
|----|-------|------|
| W1 CMA | Builder, auto-build worker, admin build/review/send UI, drain queue, retire legacy | `lib/cma/**` (new), `lib/cma-request.ts`, `lib/cma-deliver.ts`, `app/api/cma/**`, `app/api/cron/cma-build-worker/**` (new), `app/cma/**` (new), `app/admin/(protected)/cmas/**`, `app/actions/contact-cma.ts`, `lib/cma-delivery.ts` (retire), `components/admin/cma/**` (new), migrations `202607071*` |
| W2 Newsletter | Monthly cron, schedule UI, visual review, ledger, subscriber mgmt | `app/api/cron/newsletter-monthly-draft/**` (new), `app/admin/(protected)/newsletters/**`, `app/actions/newsletter.ts`, `lib/newsletter/**`, `lib/data/newsletter/**`, `app/api/track/e/**` (ledger hook) |
| W3 Subscriptions | Hub metrics + edit dialogs, engine fairness, event classification | `components/admin/crm/subscriptions/**`, `lib/data/crm/subscriptionsAdmin.ts`, `app/actions/subscriptions-admin.ts`, `app/actions/saved-search-alerts.ts`, `lib/crm/market-report-send.ts`, `lib/crm/email-events.ts` (sendType map), `app/account/notifications/**` |
| W4 Brand shell | Shared email shell + template migration | `lib/email/shell.ts` (new), `lib/email/brand.ts`, `lib/crm/listing-alert-email.ts`, `lib/crm/market-report-email.ts`, `lib/email-templates/**` |
| W5 Integration | Gates, build, browser E2E, migrations to hosted, commit, push, deploy:verify | orchestrator |

## Hard constraints (every WS)

- Draft-first: no automated send to any real lead or subscriber. Auto-BUILD is allowed; SEND requires Matt's click. Test sends go to matt@ryan-realty.com only.
- §0 data accuracy: every CMA/report figure computed from Supabase in the same build, traceable (citations stored with the artifact). Months of supply, medians, time adjustments per `marketing_brain_skills/producers/cma/SKILL.md` methodology.
- Brand voice: no em-dashes/semicolons/banned words in any client-facing copy.
- Design system on admin UI: shadcn from `@/components/ui/`, semantic tokens, `cn()`.
- DAL boundary: no raw `.from()` outside `lib/data/`. Server actions return `{ data, error }`.
- Suppression: every send path checks `isSuppressed`/`isSuppressedByEmail`; unsubscribe links unwrapped (`isComplianceLink`).
- Tracking: every outbound client email routes HTML through `attributeOutbound` with resolved person + broker.
- File budget: no file over 600 LOC (split).
