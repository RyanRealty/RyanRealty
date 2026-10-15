# 2026-10-15 (CI + production Supabase, how much timeout load PR CI causes)

Branch `claude/youthful-wilson-386f51`. Follow-up to #618. Window 2026-10-13 00:05Z to 10-15 00:05Z.

## Sources
- Supabase `query_logs`: `postgres_logs` "canceling statement due to statement timeout" by `parsed.query_id`;
  `edge_logs` `/rest/v1/*` by `response.status_code` and `request.cf.asOrganization`.
- GitHub: 611 runs (CI, smoke, nightly), 37,618 job steps. Vercel API: 134 deployments (94 production READY).
- All 1,162 timeouts on 10-14 came through PostgREST (`authenticator`), so REST 500s carry them.

## Numbers (48h)
- 1,516 statement timeouts. 92% fell while PR CI was rendering pages (227 CI only, 1,171 CI + deploy
  window), 6% deploy window only (89), 2% neither (29). CI page steps covered 48% of the clock, so
  time overlap alone cannot assign blame.
- Network attribution: 1,290 REST 500s. GitHub Actions (Microsoft network) 692 = 54%, AWS (Vercel) 582 = 45%,
  other 16. All 692 GitHub 500s fall inside CI page-step windows, which confirms that runners are the source.
- Inside production deploy windows (Vercel build + 15 min after READY): 1,063 REST 500s, 546 (51%) from CI.
- Volume, last 24h: GitHub runners 2,495,583 REST requests, AWS 2,719,211 (CI = 47.5%).
- One isolated PR run (PR 632, 11:35-11:45Z 10-14, split by runner IP): 19,070 requests. Build SSG
  8,528 (45%), content-floor x4 6,030 (32%), smoke 2,995 (16%), lighthouse x4 636 (3%), e2e 384, a11y 371.
- Dose: timeouts 5.8/h with no PR run rendering, 37/h with 1, 74/h with 2. That is about 37/h per run, linear.
- Production's own (AWS) 500s in deploy windows: 19/h with 0 PR runs, 18/h with 1, 35-38/h with 2+.
  Outside deploy windows with no CI: 1.2/h.
- Top timed-out queries (last 24h): `listing_tile_mv` row walk 634 (stopped after 20:26Z 10-14),
  `get_place_schools` 462 (sibling session), raw `listings` key walk 56, raw `listings` City scan 34.
- Production compute is Medium (shared CPU, 4 GB, 120 connections: `max_connections`=120, `shared_buffers`=1GB).

## Options weighed
- Cross-PR concurrency cap (`queue: max`, GitHub changelog 2026-05-07): NOT shipped. Timeouts are linear
  in CI work, so a cap moves them in time and does not remove them. Simulated on these runs: one PR's page
  phase at a time gives a 539 min median wait; two at a time gives a 77 min p90. A build-only cap is cheap
  (cap 2: p90 0 min), but builds are not where CI times out (GitHub 500s 6/h build-only vs 27/h runtime-only).
- Fewer parallel page jobs: same total work, slower PRs. Not shipped.
- Fixtures for lighthouse/visual: lighthouse is 3% of requests. The visual step was inert (no baselines), removed.
- Supabase branch for CI: starts with schema and seed only, no production data, so content-floor and smoke
  would render empty pages. Not recommended.
- Read replica for CI (paid, put to Matt): replicas run the primary's size. Medium is $0.0822/h, about $60/mo,
  plus disk at 1.25x primary ($0.125/GB) and $4/mo IPv4 if that add-on is on. Compute credits do not apply.
  Sources: supabase.com/docs/guides/platform/manage-your-usage/read-replicas and /compute-and-disk.
  Catch: "Read Replicas only support GET requests from the REST API", and supabase-js `.rpc()` POSTs.
  39 `lib/data` files call `.rpc()`, so read RPCs need `{ get: true }` (a production code path change),
  and any CI write fails on a replica.
- Primary Medium to Large (dedicated 2 vCPU, 8 GB): $0.1517/h, about +$51/mo. No code change, CI stays on prod.

## Shipped (this PR)
- smoke-test.yml: one crawl per production deploy (dropped the duplicate CI workflow_run trigger and
  preview deployment_status runs), plus `concurrency: post-deploy-smoke` with cancel-in-progress.
- ci.yml: removed the visual-regression step and its upload. No baselines are committed, it failed every
  run under continue-on-error, and the upload never fired.

## Open
- Two database restarts on 10-14 (ready 22:49Z; shutdown 23:10Z, 143 FATAL) gave 9,480 Cloudflare 52x on
  REST. These are not timeouts. Cause not traced here: check whoever restarted or migrated around #618.
- Vercel functions run in iad1 (no `regions` in vercel.json) and the DB is us-west-2: every query crosses the country.
- Paid replica or Large compute: Matt's yes/no.

Skills read: none beyond CLAUDE.md, AGENTS.md CORE RULES, handoffs README.
