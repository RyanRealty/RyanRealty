# /goal — Admin consolidation: from ~40 pages to broker workflows

**Owner:** Cursor agent session, 2026-07-07. **Status: in flight.**

## The organizing principle

The user is a real estate broker whose core job in this admin is: **manage my leads and
understand what's going on with them.** Every consolidation decision, every nav item, every
dashboard widget gets judged against that job. The person/lead is the center of gravity —
everything about a lead (saved searches and alerts, the reports they receive, their activity
on the site, conversations, deals, next steps) is reachable from ONE place.

Acid test for every screen: could a busy broker who has never seen this page accomplish the
task in under a minute without asking for help?

## End state (definition of done)

1. **Consolidated IA:** the admin nav presents 5-8 top-level areas organized around broker
   jobs. Every one of the ~40 current top-level routes has an explicit disposition (keep /
   merge into X / cut) recorded in the Phase 0 findings doc, and the dispositions are
   implemented — no stubs, no redirect graveyards, no orphan pages left in the nav.
2. **One alert model:** saved searches and listing alerts are ONE concept with one name a
   broker would use, one storage model, migrated losslessly, with every consumer updated
   (admin UI, CRM contact pages, email crons, user-facing pages).
3. **Editable criteria everywhere:** the broker can edit the full criteria of any
   search/alert and any market report subscription (geography, price, property type,
   cadence, recipients) in place — never delete/recreate. The editor reads like a sentence
   with a live plain-English summary and a live count of matching listings.
4. **Market report emails rebuilt:** charts as email-safe images, stats with context
   (vs last period, vs last year, what it means), brand voice per VOICE.md, all data from
   market_stats_cache / market_pulse_live with a verification trace per figure, one-click
   preview of exactly what the recipient receives.
5. **Delivery observability in broker terms:** who is getting what, when it last went out,
   whether it arrived, who opened it, what failed, and a clear "fix this" path — surfaced
   globally (Marketing area) and per-person (on the lead's page).
6. **Guided help system shipped WITH the features:** one persistent Help button in the admin
   shell offering (a) interactive guided tours per area + per core workflow, declaratively
   defined; (b) a searchable knowledge base at /admin/help written for the broker, deep-linked
   from the Help button per page; (c) tooltips on every non-obvious control and teaching empty
   states. Help content describes the CONSOLIDATED admin only.
7. **Lead hub:** a broker opens one page per person and sees their whole story: activity,
   searches/alerts, reports, conversations, deals, next steps.
8. **Home:** /admin is a real "what needs my attention right now" dashboard.

## Verification standard (per workstream, before done)

- `npm run build` and `npm run ci:gates` pass; vitest green.
- Real browser walkthrough AS THE BROKER: from Home, find a lead, see everything about them,
  edit their alert criteria, preview their next market report, check whether their last email
  arrived — without touching the URL bar. Screenshots at 1400x900 and 390x844.
- Help coverage: on every changed screen, run the guided tour end to end in the browser;
  tooltips on non-obvious controls; Help deep-link lands on an article matching the shipped UI.
- Email deliverable: real test email sent, charts render in an actual client, verification
  trace per figure.
- Push to main, hosted Supabase migrations applied same delivery, `npm run deploy:verify`
  exit 0, spot-check changed admin paths in production.

## Phases and workstreams

| Phase | Scope | Blocking? |
|---|---|---|
| P0 | Consolidation audit: open every route in a real browser, record job / works / overlap / broker-relevance; propose IA; page-by-page disposition + severity punch list → `docs/plans/ADMIN_CONSOLIDATION_AUDIT.md` | Yes — IA is the shared contract |
| WS1 | Unify saved searches + listing alerts (model, migration, all consumers) | After P0 |
| WS2 | Editable criteria everywhere (sentence editor, live count, live summary) | After WS1 model |
| WS3 | Market report emails rebuilt (charts, context, voice, traces, preview) | Parallel |
| WS4 | Delivery observability (global + per-person) | Parallel |
| WS5 | Guided help system (tours, KB, tooltips, Help button) | Infra parallel; content after pages settle |
| P2 | Execute consolidation (merge/cut, lead hub completion, Home dashboard) | After P0 approval |

Each dispatched agent receives its own goal: deliverable, owned files, verification steps,
completion standard. File ownership per the matrix in `docs/plans/master-plan.md` plus the
per-workstream ownership recorded in the audit doc.

## Existing foundations (do not rebuild — extend)

- CRM ground-up rebuild complete (18 screens, `docs/fub-crm-spec/crm-screens.json`,
  production sign-off 2026-07-02). `/admin/crm` + person detail IS the lead hub base.
- Subscriptions hub `/admin/crm/subscriptions` + unified email shell `lib/email/shell.ts`
  + newsletter/CMA workflows shipped 2026-07-07 (`LIFECYCLE_WORKFLOWS_MASTER_GOAL.md`).
- Saved-search system W1-W5 shipped 2026-07-06 (`SAVED_SEARCH_MASTER_GOAL.md`) — but still
  three models (`saved_searches`, `guest_search_alerts`, `crm_report_subscriptions`); WS1
  unifies the first two.
- Admin nav already job-grouped (2026-06-12 IA rework, `app/components/admin/admin-nav.ts`);
  this mission goes further: nav AREAS collapse, pages merge or die.
- Every admin page passed the `ADMIN_CURATION_TO_BAR.md` layout bar (2026-06-15).

## Hard constraints (every workstream)

- Design system: shadcn/ui from `@/components/ui/` only, semantic tokens only, `cn()` only.
- DAL boundary: no raw `.from()` outside `lib/data/`; server actions return `{ data, error }`.
- Read `docs/DATABASE_FOR_AI_AGENTS.md` before any SQL. Migrations idempotent, applied to
  hosted Supabase in the same delivery.
- Brand voice: plain language for brokers, no jargon, no raw IDs/JSON in UI, no em-dashes,
  no semicolons, no banned words, sentence case headings.
- §0 data accuracy: every number in a market report email traces to a named source query.
- Ship working increments; never document a screen about to change.

## PROGRESS

- 2026-07-07: goal written; Phase 0 audit dispatched.
- 2026-07-07 (Claude Code session, verification + finish pass): ALL WORKSTREAMS COMPLETE, awaiting Matt's ship approval.
  - WS1 shipped: `listing_alerts` unified table live on hosted Supabase (migration
    `20260707160000_unify_listing_alerts.sql` applied; 2 rows migrated with dedupe; the
    2026-05-18 expired-LP orphan pair `listing_alerts`/`listing_alert_matches` — 0 rows,
    0 consumers — was shape-guard dropped to clear the name collision). E2E flows 12/12.
  - WS2 wired: AlertCriteriaEditor → AlertEditDialog, ReportCriteriaEditor → ReportEditDialog.
    Instant cadence now allowed through the admin patch path (closes audit foot-gun #4).
  - WS4 wired: ContactDeliveryPanel on the person page right rail (Website Activity section
    now open by default); Home dashboard gained the Email delivery attention section +
    superuser Hot leads card (DashboardDeliveryAttention).
  - WS5 verified in browser: 5/5 tours end-to-end (dashboard tour gained the delivery step),
    /admin/help search + articles, Help button desktop + phone. 23/23 checks.
  - Phase 2 executed: /admin/people (+ /admin/people/[fubId]) → person page redirects;
    reports + analytics merged into the Performance hub at /admin/analytics (catalog +
    weekly tool + city builder moved in); query-builder folded into the listings browser
    (ListingsCsvExport panel); nav renamed Subscriptions → "Alerts & reports",
    Analytics → "Performance"; Query builder + Reports nav entries removed.
  - Verification: tsc clean, build clean, 2613/2613 tests, `ci:gates` exit 0, broker
    acid-test walkthrough 12/12 (Home → find lead → edit criteria in the sentence editor
    with live count → preview market report → check delivery; 1400x900 + 390x844
    screenshots in out/broker-walkthrough/), 42-route sweep clean (all redirects land,
    producers 404 by design).
