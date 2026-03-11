# Pre-Launch Build — 2026-03-10

Create this PR manually (GitHub web or install `gh` CLI): **base: main**, **branch: optimizer-swarm**, **draft**.

## Title
`🚀 Pre-Launch Build — 2026-03-10`

## Body (paste into PR description)

```markdown
## Ryan Realty Pre-Launch Build

**Go-live status: 🟡 READY WITH CONDITIONS**

### What Was Done
- **Phase 1:** Broker data — 3 brokers (Matt Ryan, Rebecca Ryser Peterson, Paul Stevenson); headshots set via migration from `public/images/brokers/`.
- **Phase 2:** Security audit — no hardcoded credentials; admin routes under `(protected)` layout; service role server-side only.
- **Phase 3:** Infrastructure verified — Inngest (MLS sync, CMA, notifications, sitemap, etc.); Sentry; auth.
- **Phases 4–10:** Platform build verified — home, search, listing, community, broker, seller, blog, account, admin, reports. No console.log; not-found and global-error in place. Master plan header and completion status updated in `docs/PLATFORM_REQUIREMENTS_v25.md`.

### Your Review
1. Open Vercel preview URL (or run `npm run build` and `npm run start` locally).
2. Click through the site on your phone and desktop — home, search, listing, team, admin.
3. Check `/admin` — dashboard, brokers, sync, reports.
4. Merge when satisfied.

### After Merge
- Add domain in Vercel; update DNS at registrar.
- Resume history sync in Inngest if desired.

### Items Needing Input
None.
```
