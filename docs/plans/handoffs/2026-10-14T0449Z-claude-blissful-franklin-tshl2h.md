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

**Next.** Merge #563 when CI is green, then verify production with `npm run deploy:verify` and `npm run analytics:audit`. #560 (persist GA client id) edits the same lines in `fireLeadGenerated`: whichever lands second merges main and keeps both changes.

**Matt's calls, open.**
- A Search Console Domain property, which needs a DNS TXT record.
- `scripts/ga4-admin.mjs apply` still disagrees with live. Do not run it.

Skills read: `docs/analytics/README.md`, `docs/TRACKING_POLICY.md`, built-in `code-review`.
