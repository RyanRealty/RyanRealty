# Admin (non-CRM) functional QA — every button/link/component works

> /goal (Matt 2026-06-26): same as the CRM QA — every feature/button/link/component in the
> REST of the admin works end-to-end (DB writes happen, etc.). Production-grade, both mobile +
> desktop. The CRM cluster is already done (CRM_FUNCTIONAL_QA.md); this covers everything else.

## Method (same as CRM QA)
Phase A audit (parallel, READ-ONLY + safe e2e) → classify every interactive element ✅WIRED /
☠️DEAD / 🐞BROKEN / ❓UNVERIFIED, write defects to `docs/fub-feature-audit/qa/<cluster>.md`.
Phase B fix (disjoint files). Phase C verify + commit + review + live prod scan.

## SAFETY (heightened — this side can fire real outbound)
- Preview browser is authed as matt → clicks fire REAL production writes.
- NEVER trigger an outbound/destructive real action: no newsletter/email-campaign SEND, no
  signing/envelope SEND, no publishing/approving real marketing content, no editing/deleting
  real brokers/users/listings/transactions/commissions. For ALL of those: verify the wiring in
  CODE only (trace handler → action). Do NOT click the real button.
- Safe e2e ONLY where a clearly-disposable test row is creatable + deletable (verify via
  Supabase MCP, then delete). When in doubt, code-verify and mark ❓UNVERIFIED-needs-safe-test.
- AGENTS: do NOT touch git / commit / push / stash / baselines / the schema snapshot. Write your
  defect file + report a short summary. The ORCHESTRATOR commits. (Two CRM-QA agents disobeyed
  and clobbered peers' work — do not repeat.)

## Clusters
- ADM-1 Transactions/TC + Email + Newsletters: deals(+[key]), signing(+[envelopeId]), commissions, financials, forms, sign-off, cmas, email/campaigns, email/compose, newsletters(+[id]/new/subscribers)
- ADM-2 Reports + Analytics: reports/* (brokers/custom/emails/lead-flow/leads/market/traffic-sources), analytics/* (11 pages), optimization, fub-attribution
- ADM-3 Listings + Content + Geo: listings(+[listingKey]), expired-listings, search, geo(+area-guide-upload), resort-communities, site-pages, media, photos, banners, stock-photos, blog, guides, producers(+[slug])
- ADM-4 System/Access + People/Visitors + Marketing-ops: operations, sync, spark-status, brokers(+edit/new), users, audit-log, query-builder, approval-queue, broker-links, people(+[fubPersonId]), visitors/live(+[sessionId])

## Defect log (synthesized — ~264 elements; mostly wired). Detail in qa/adm*.md.
### Must-fix
- **ADM-2 D12 (§0 DATA ACCURACY):** analytics/_lib/queries.ts ~200 fabricates per-milestone scroll-depth from hardcoded ratios (0.45/0.28/0.17/0.10) and shows them as real GA4 data. → remove the fake rows, show only the real aggregate (no estimating, per §0).
- **ADM-3 P0-1:** banner "Generate missing banners" generates 0 (getOrCreatePlaceBanner discards the search term). → use fetchPlacePhoto → downloadAndStoreBanner.
- **ADM-3 P0-2:** area-guide upload shows success but writes nothing — the DB writes use supabaseAnon (RLS-blocked). → createServiceClient in those write paths (lib/data/cities/getCityMetadata.ts).
- **ADM-4 P1:** /admin/sync has zero operator controls (all action components orphaned). → restore the SyncHeavyStatusSections import (or formally delete the 22 orphans).
### Broken
- ADM-2 D1/D9: funnel-breakdown date filter dead; 10 analytics pages have no date filter (DateRangePicker exists → thread it).
- ADM-2 D10: silent row truncation (50k/20k caps) → show a "capped" warning.
- ADM-2 D11: meta-health blank on expired token → surface the API error.
- ADM-2 D2: social DateRangePicker only affects the GA4 section → scope label/fix.
- ADM-3 P2: listings pagination stuck page 1; beds/baths always —; expired save drops errors.
- ADM-4 P2: approval-queue approved_by hardcoded 'matt' → user.email.
- ADM-1: forms "Open blank" link silently disappears when blankUrl null → show an "unavailable" badge.
### Missing UI (actions exist / feature absent)
- ADM-3 P1: blog edit+delete (deleteBlogPost exists, unwired), guide edit+delete (no action), media-suppression toggle on listing editor (MEMORY mechanism, raw-SQL-only today).
### Flag to Matt (don't fix blind)
- ADM-3 P0-3: blog posts upsert to Supabase blog_posts; if the live blog is AgentFire/WordPress (per CLAUDE.md) they're publicly invisible — architectural confirm needed.
- ADM-2 D8: 12 analytics pages bypass the DAL (raw createClient, no cache) — real but large perf refactor; track separately.
### Correctly NOT triggered (outbound/destructive — wiring confirmed in code)
- ADM-1: signing send/void, email cohort/single send, newsletter send. ADM-4: approval publish, broker/user/role edits, sync-trigger. All ✅ wired; never clicked per safety.

## Fix partition (disjoint; agents NEVER git; orchestrator commits; verify 1440+375)
- FIX-A Reports/Analytics: analytics/_lib/queries.ts + analytics/* + reports/* (D12, D1/D9, D10, D11, D2).
- FIX-B Listings/Content: banners.ts, getCityMetadata.ts, listings(+editor), expired-listings, blog.ts(+page), guides (P0-1, P0-2, P2 listings, blog/guide CRUD, media-suppression).
- FIX-C System/Forms: sync/page.tsx, approval-queue route, forms page (sync controls, approved_by, forms badge).

## Log
- 2026-06-26: goal set. Dispatching Phase A audit (4 clusters, read-only + safe e2e).
