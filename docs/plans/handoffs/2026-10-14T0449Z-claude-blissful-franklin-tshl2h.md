# 2026-10-14 (Claude Code, analytics source of truth, lead session fix, per-session handoffs)

Branch `claude/blissful-franklin-tshl2h`, PR #563. Nobody pushes main. Nothing sent.

**Landed in #563**
- Server GA4 events carry the browser's `session_id`, `session_number` and `page_location`, through `ga4ServerSend()` / `ga4ServerEventParams()` in `lib/analytics/ga4-server-context.ts`. That covers `generate_lead`, the non-lead form events, `person_identified` and `valuation_requested`. Before, all 117 `generate_lead` events from 2026-09-15 to 10-13 were Unassigned with hostname (not set).
- Server events obey the browser suppression rule and fail closed.
- `docs/analytics/README.md` is the one analytics source of truth. It includes #558 and a Registry.
- `npm run analytics:audit` is the read-only live audit of GA4, Search Console and GTM.
- `ci:analytics-registry` fails an unregistered GA4, GSC or GTM surface.
- New skill `.claude/skills/analytics/`.
- `npm run push` publishes a branch that has no upstream.
- GA4 key events: Matt approved removing four that nothing sends: `schedule_showing`, `listing_showing_click`, `listing_inquiry`, `home_valuation_cta_click`. They were removed live on 2026-10-14 through `scripts/ga4-admin-setup.mjs`, which now matches the live property (9 key events).
- Handoffs: Matt approved one file per session. Each session writes its own note in `docs/plans/handoffs/`. `CROSS_AGENT_HANDOFF.md` is frozen history.

**Live.** #563 merged `7994f4f07`; production deploy READY, ryan-realty.com 200, GTM loader present. First `analytics:audit` after it (07:42Z) still shows the old 28 days: 96% Unassigned, 102 of 103 `generate_lead` with no hostname. Re-run `npm run analytics:audit` once GA4 has processed leads that came in after the deploy; the hostname share should move.

**Follow-up PR (same branch).** `deploy:verify` live SEO found 9 failures on main, none from #563:
- `/communities/sunriver` lost `id="takeaways"` when #521 swapped `V3TakeawaysLead` for `CommunityFoldAnswer id="answer"`. Fixed: the fold answer carries `takeaways`.
- `/homes-for-sale/<city>/on-golf-course` (golf landing) never emitted BreadcrumbList. Fixed in `GolfBranch.tsx`.
- `CROSS_AGENT_HANDOFF.md` now carries the frozen header.
- Seven community titles: #521 set "X Homes for Sale | City, OR" citing Matt 2026-10-13; `data/seo/decisions.json` still pins "X real estate" (Matt 09-22, 09-24, 10-04). Held for Matt; not changed.

**Matt's calls, open.**
- A Search Console Domain property, which needs a DNS TXT record.
- `scripts/ga4-admin.mjs apply` still disagrees with live. Do not run it.

Skills read: `docs/analytics/README.md`, `docs/TRACKING_POLICY.md`, built-in `code-review`.
