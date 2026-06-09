# Ultracode kickoff — Ryan Realty site-consistency & self-improving loop

> Paste everything below the line into a fresh Claude Code session running in Ultracode mode.
> It is self-contained (the new session has none of our conversation). It names the exact
> files and skills so subagents are equipped, not sent off blind.

---

You are Claude Code on Opus, running in Ultracode mode, in the Ryan Realty repo (`/Users/matthewryan/RyanRealty`). This is a multi-session program, not a one-shot task. The goal: end design and content drift, and stand up a self-improving consistency loop that gets measurably smarter every cycle. Token cost is not the constraint — correctness and coverage are.

## This document is the canonical development process (THE LOOP)

This is not another plan to file next to the others. It supersedes them. Once stood up (Phase 4), **all future development in this repo — site code, the marketing brain, cron agents, producers, and any work in Cursor or Claude Code — routes through this one iterative cycle.** Three rules make that real and keep it from becoming legacy itself:

- **One canonical home, referenced everywhere.** The process lives at `docs/DEVELOPMENT_PROCESS.md` and is pointed at from every file a Claude Code agent loads at session start (CLAUDE.md, the producer TEMPLATE, and the cron system-prompt builder). A mechanical gate fails the build if any pointer goes missing, so agents do not need to "remember" the process — they load it because it is wired into what they already read. (Cursor is being decommissioned — all work runs only in Claude Code in the terminal. See Phase 4.)
- **It supersedes prior plans, and they get retired.** Phase 4 archives the superseded plans and dated handoffs so no agent copies an old way. The plan you are reading replaces them.
- **It rewrites itself.** This doc is versioned and is expected to improve. When a better idea lands, it goes into this doc, the version bumps, and the sync gate re-verifies every reference in the same commit. Never preserve an old approach out of inertia — if there is a better way, change the canon and let the gate propagate it. If anything below is already outdated when you read it, fixing this document is the first task, not a reason to follow the stale version.

## Read first (this is how you avoid sending subagents off unequipped)

1. `CLAUDE.md` in full. Internalize §0 (data accuracy), §0.5 (draft-first, commit-last), the Brand Voice section, the Design System rules, the Mechanical Gates section, and the Opus Orchestrator Policy.
2. `docs/MECHANICAL_GATES.md` — every gate (G1–G38+) and the documented pattern for adding a new one.
3. `docs/DATABASE_FOR_AI_AGENTS.md`, `docs/DAL_INDEX.md`, `docs/DATABASE_SCHEMA_SNAPSHOT.md` — the data layer. Never run ad-hoc schema queries; the answers are in these files.
4. `design_system/ryan-realty/` — read MANIFEST.md → SKILL.md → README.md → colors_and_type.css. This is the brand source of truth.
5. The `MEMORY.md` index and any memory it points to that is relevant.
6. `video_production_skills/API_INVENTORY.md` (every provider + live status), `docs/GOOGLE_SETUP.md`, `docs/MARKETING_ANALYTICS_PLAYBOOK.md`, and `docs/CUTOVER_RUNBOOK.md` (the now-completed migration record, still useful for the DNS / auth specifics). The site is fully live on Vercel at the apex `ryan-realty.com` — AgentFire (the old WordPress site) is retired, so there is no fallback and production safety is non-negotiable (see "The data layer and the live environment" below). The full per-system map is the Stack Command Registry in Phase 0.

Load and USE these skills — do not hand-roll what they already cover:

- `/deep-audit` — the existing 10-pass auditor. This is your audit engine; extend it, don't replace it.
- `design:design-system`, `frontend-design`, `hallmark` — design compliance and anti-AI-slop.
- `engineering:code-review` and `/code-review` (use `ultra` for a cloud multi-agent review on any meaningful diff).
- `data:*` — any SQL or analytics work.
- `facebook-seller-growth` (your unified FB ads + analytics + FUB + organic growth routine) and `marketing:seo-audit` — the marketing, SEO, and lead-flow surface.
- `brand-voice:*` — voice.
- `skill-creator` — to build the new `site-consistency` skill in Phase 3.
- `update-config` — to wire enforcement hooks into `settings.json`.

## Operating rules (non-negotiable)

- **Draft-first, commit-last.** Nothing commits, pushes, or publishes until Matt has seen the draft and explicitly said go. Read-only audits and local edits are fine; commits wait. Re-confirm approval each time — a passing gate is never approval.
- **Data accuracy (§0).** Every number traces to a live source. No memory-numbers. The route/gate counts below come from a prior recon pass — verify them, don't trust them.
- **Single checkout, `main` only.** No worktrees, no feature branches. `git pull --rebase origin main` before starting.
- **Delegate the bulk work.** You are on Opus. Fan out enumeration, grep sweeps, and multi-file reads to subagents and the Workflow tool. Keep architecture, final review, and product decisions for yourself.
- **Gates, not prose.** Every fix that kills a *class* of bug must add or tighten a mechanical gate so it cannot recur. A fix without a gate is incomplete work.
- **Verify before "done."** Render the page, run the gate, read the output. No claim you have not checked.

## The thesis (why this program exists)

The site drifts because "what good looks like" is mechanically enforced on a small fraction of it (a prior pass found ~10 of ~158 routes carry a design parity contract), most gates are *ratcheted* — they grandfather existing violations, so the backlog is invisible and becomes the template the next edit copies — facts are scattered (geo pages invent SEO and description text instead of reading the database columns that already hold it), and legacy cruft is the example the next change reaches for.

The cure is one converging loop: measure the live product against mechanical contracts, close the highest-value gap as a reviewed fix, and every single time either tighten a gate (backlog trends to zero) or delete the legacy and add a gate forbidding its return (that regression becomes impossible).

Two things make this self-improving, not just self-cleaning. **First, consistency is the mechanism, not the goal.** The goal is measured competitive results: search rankings and organic traffic, conversion rate, lead volume and quality, and page speed. A consistent, fast, coherent product is how you move those numbers — but the numbers are the scoreboard, and beating competitors on the surfaces that drive the business is the win condition. **Second, the loop ingests real outcome data and learns from it.** Every cycle it pulls GA4, Search Console, Meta/FB ads, FUB, Core Web Vitals, and competitor signals, records which change actually moved which metric, and refines what it tries next. "Smarter" means three things compounding: the contract set grows, the baselines shrink, and the loop's model of what produces results sharpens with every measured experiment.

## How we work — no spot fires, no blind starts

The expensive failure mode is reactive: a change ships, it gets reviewed, someone finds a wrong number or a broken layout, and we patch that one thing. Then the next. That is fighting spot fires, and it never converges. Worse is the blind start — work begins without loading the input it depends on (the DB schema, the design spec, the existing code, the canonical data source), produces something wrong, and gets caught later. Both are banned mechanically, not by good intentions.

- **Take the whole project into account before any change.** Phase 1 clusters every finding by root cause and class, not as a flat list of symptoms, so the entire shape is understood before anything is touched.
- **Fix the class, never the instance.** When a problem is found — a hardcoded stat, a layout that breaks, an inaccurate number — the unit of work is the pattern across the entire site, resolved everywhere it occurs in one coordinated change, plus a gate so it cannot reappear. Never fix only the one page someone happened to land on.

**No change starts blind — the preflight contract.** Before work begins on a class, the inputs that change depends on must be loaded, and a trace proving it must ride with the change or the build fails. Skipping the schema is a red build, not a judgment call. Per work-type:

| The change touches | Load first (mandatory) | The trace that gates it |
|---|---|---|
| Database / data / a stat | `DATABASE_SCHEMA_SNAPSHOT.md` + `DAL_INDEX.md` + the relevant DAL function | a §0 verification trace per figure (source, table, filter, row count, fetched-at) — the deliverable's number equals the printout's |
| A page or surface | that surface's mockup (`ui_kits/<surface>`) + its `parity.json` + the canonical data source it should read + the existing component | imports the parity-required components (G6) + reads through `@/lib/data` (G8) + a "sources consulted" line |
| Design / UI / layout | `design_system/ryan-realty/` specs + the surface mockup + the tokens | design-token gate (G4) + mockup parity (G6) + Amboqia-on-headings |
| An audit finding being acted on | the actual file/source, read directly | the finding cites `file:line` confirmed by direct read, adversarially verified — never acted on from a subagent's recall (the 29-vs-4-rules lesson, made structural) |
| Anything touching the live runtime (DAL, crons, producers) | the affected path's current behavior + a Vercel preview | route-smoke (G11) green + preview deploy verified before the prod push |

Build this as `scripts/check-preflight.mjs`, wired into `ci:gates` and a pre-commit hook: a change whose work-type is missing its required trace fails the build.

**The review is exhaustive and happens before Matt sees it.** Before anything reaches him, review the entire affected surface the way he would — every instance, mobile and desktop, every number traced — using the real skills (`/deep-audit`, `engineering:code-review` / `ultra`, `design:design-critique`, `design:accessibility-review`, `/verify`, the §0 trace), not a glance. Matt confirms a class is resolved; he is not the one finding the bugs.

**When something is wrong, the answer is a guardrail, never an apology.** If a defect reaches Matt, or any check fails, the only acceptable response is: fix the whole class, add or tighten the gate that would have caught it, and log the escape (`process_escape_ledger`). A hollow "you're right, I should have looked at X" is banned. If X should have been looked at, X becomes a mandatory preflight input so it can never be skipped again. Likewise, never claim a change is in a file from memory — read the file and confirm it before saying it is done. The lesson becomes a gate, not a sentence.

Two compounding loops, not one: the **product** improves (rankings, conversion, speed) and the **process** improves (escapes trend to zero, the check set grows). That is what moving forward instead of backward means mechanically.

## The data layer and the live environment

AgentFire is retired. The site is fully live on Vercel at the apex `ryan-realty.com`, with no fallback. Every change runs in production, so safety is a precondition, not a nicety.

**Live-environment rules:**
- Nothing reaches production unverified. A risky change verifies on a Vercel preview deploy, with `ci:gates` + Lighthouse + the route-smoke gate (G11) green, before the push that deploys to prod.
- Schema changes are **expand-contract**: add the new column/table → migrate the reads → only then remove the old. The live DAL must never read a column a migration just dropped. Apply the migration to hosted Supabase in the same delivery as the code that depends on it.
- Protect the **money paths** first and hardest: the lead-capture forms into FUB, the ranking pages (use redirects — never 404 a page that holds a position), and market-data accuracy. A regression on these is a P0.
- Every risky change is reversible with a named rollback before it ships. A regression is caught by the **system** (Sentry + Vercel runtime logs + the route-smoke), not by a user and not by Matt.

**The data layer is the system, not a pile of queries.** Reads go through the DAL in `lib/data/` (enforced by G1 / G8) — never a raw `.from()` in a page or component. The schema snapshot (`docs/DATABASE_SCHEMA_SNAPSHOT.md`) and DAL index (`docs/DAL_INDEX.md`) are the source of truth — never run ad-hoc schema queries (G16). The cache model is respected (`market_pulse_live` ~10-min, `market_stats_cache` ~6-hour); don't aggregate raw `listings` for a report, use the cache. Data freshness is a §0 concern on a live site: the Spark→Supabase sync and the cache freshness are monitored, and stale or wrong data reaching users is a regression the loop must catch.

**Exposing new data on a page — the full chain, every link verified, nothing one-off.** When a page (new or existing) needs to surface data it doesn't yet, the whole chain is built and tied in, in order:

1. **Migration** (expand-contract) applied to hosted Supabase in the same delivery; RLS set; backfilled if needed.
2. **A DAL function** in `lib/data/` — cached via `unstable_cache` with the right TTL + tags, typed, returning exactly what the surface needs. No query lives in the page.
3. **Regenerate the canon:** schema snapshot + DAL index + TS types (`npm run ci:data-access -- --refresh`, G16) so the source of truth reflects the new shape.
4. **The page reads only through `@/lib/data`** (G8). SEO title / description / JSON-LD derive from the canonical record (the DB), never hardcoded template strings.
5. **Tie it in so it is not orphaned:** `generateStaticParams` (G9), the sitemap, internal nav + links (nav-reachability + internal-links gates), structured data (G34).
6. **Verify end to end:** `ci:gates` green, route-smoke passes, the page renders on a preview (full page, mobile + desktop, every number traced to source per §0). Then ship.

A new page that skips any link in this chain is incomplete by definition — not "done" until the whole chain is built and verified. This is the preflight contract applied to the most common operation, so new data is always part of the system, never a one-off.

## Phase 0 — Become an operator of the full stack (do this before the audit)

You are expected to operate every system below, not just read about it. An agent that does not know its own tools is the exact failure mode this program exists to kill. Spend real time here.

**First, discover your actual tools.** At session start, enumerate your connected MCP servers (ToolSearch with domain keywords, or the mcp-registry). Server IDs rotate between sessions, so resolve a server by capability, never a hardcoded ID. Confirm which of the servers below are live this session; if one you need is missing, say so before relying on it.

**Operate in three tiers, in this order:**
1. **Dedicated MCP server** (fastest, most precise) — connected: Supabase (SQL, migrations, advisors, logs), Vercel (deploys, build + runtime logs, docs), Gmail, Google Calendar, Google Drive, Figma, Apify. Use directly.
2. **Repo API wrapper** (when no MCP) — FUB `lib/fub.ts`, GA4 `lib/ga4-data-api.ts`, GBP `lib/google-business-profile.ts`, Meta `lib/meta-*.ts`, Resend `lib/resend.ts`, Spark MLS `lib/data/listings/`. Operate through these; never reinvent the API call.
3. **Dashboard-driving** (when no API path) — Cloudflare DNS, FUB UI config, Meta Ads Manager, Google Ads UI, GBP posting. Drive via the Chrome MCP; resolve the browser by NAME ("mac mini matt logged in"), never a hardcoded deviceId (it rotates). Cloudflare has a `CLOUDFLARE_API_TOKEN` fallback because its dashboard often will not load in the automation browser.

**Never print a secret value.** Read env var names, not values. Treat `.env.local` as read-name-only.

### Stack Command Registry

| Domain | Canonical doc(s) | Code path | How you operate it | Key env names |
|---|---|---|---|---|
| **Supabase** (DB `dwvlophlbvvygjfxcrhm`) | `docs/DATABASE_FOR_AI_AGENTS.md`, `docs/DATABASE_SCHEMA_SNAPSHOT.md`, `docs/DAL_INDEX.md`, `lib/data/README.md` | `lib/data/` (DAL boundary), `lib/supabase/`, `supabase/migrations/` | Supabase MCP (execute_sql, apply_migration, get_advisors, get_logs). Reads go through the DAL, never raw `.from()` | `NEXT_PUBLIC_SUPABASE_URL`, `…_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Vercel** (deploy, crons) | `vercel.json`, `docs/CUTOVER_RUNBOOK.md` | `app/api/cron/*`, `scripts/sync-vercel-env.mjs` | Vercel MCP (deployments, build + runtime logs, doc search) | `CRON_SECRET`, `VERCEL_TOKEN` |
| **Analytics** (GA4 / GSC / GTM) | `docs/MARKETING_ANALYTICS_PLAYBOOK.md`, `docs/GA4_SERVICE_ACCOUNT_SETUP.md`, `docs/GTM_ANALYTICS_SETUP.md` | `lib/ga4-data-api.ts`, `lib/ga4-measurement-protocol.ts`, `lib/tracking.ts`, `lib/marketing-brain/measurement-loop.ts` | Repo API via the Google service account (DWD). No GA MCP — Ahrefs / Similarweb / Amplitude exist as connect-able plugin stubs | `GOOGLE_GA4_PROPERTY_ID`, `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, `GOOGLE_SEARCH_CONSOLE_SITE_URL`, `GOOGLE_SERVICE_ACCOUNT_*` |
| **Cloudflare / DNS** | `docs/resend-dns-verification-steps-2026-05-14.md`, `docs/CUTOVER_RUNBOOK.md` | none (dashboard-managed) | Chrome MCP on the dashboard, or `CLOUDFLARE_API_TOKEN` (dash often will not load in automation) | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` |
| **Follow Up Boss** | `docs/FUB_SELLER_WORKFLOW_2026-05-17.md`, `docs/FUB_CUSTOM_FIELDS.md`, `docs/FUB_UI_SETUP_RUNBOOK.md` | `lib/fub.ts` (Events API), `lib/fub-snapshot.ts`, `app/api/cron/seller-lead-attribution/` | Repo API for events; FUB UI via Chrome MCP for smart-list / field config. Bulk ops scope to Matt's contacts only unless told otherwise | `FOLLOWUPBOSS_API_KEY`, `…_SYSTEM`, `…_SYSTEM_KEY`, `…_BROKER_USER_MAP` |
| **Google Workspace** (Gmail / Calendar / Drive) | `docs/GOOGLE_SETUP.md` | Google service-account clients in `lib/` | Gmail MCP, Calendar MCP, Drive MCP (all connected); DWD service account for headless | `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `GOOGLE_SERVICE_ACCOUNT_*` |
| **Google Business Profile** | `docs/GOOGLE_SETUP.md` | `lib/google-business-profile.ts`, `app/api/google-business-profile/*`, `gbp-*` crons | Repo OAuth (tokens in Supabase `google_business_profile_auth`); GBP UI via Chrome for posting | `GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID/LOCATION_ID`, `…_CLIENT_ID/SECRET` |
| **Meta / FB / IG** | `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`, `docs/MARKETING_ANALYTICS_PLAYBOOK.md`, `docs/META_FIX_PLAN.md` | `lib/meta-capi.ts`, `lib/meta-graph.ts`, `lib/meta-marketing-api.mjs`, `app/api/meta-capi/`, `app/api/meta/lead-webhook/` | Repo API (Graph + CAPI); Ads Manager via Chrome. Page token never-expires (verified 2026-05-18). Mind the `delivery_estimate` custom-audience gotchas | `META_PAGE_ACCESS_TOKEN`, `META_CAPI_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `NEXT_PUBLIC_META_PIXEL_ID` |
| **Email (Resend)** | `docs/resend-dns-verification-steps-2026-05-14.md` | `lib/resend.ts` | Repo API. `mail.ryan-realty.com` verified; send-only key | `RESEND_API_KEY`, `RESEND_FROM` |
| **MLS (Spark)** | `video_production_skills/market-data-video/SKILL.md` §22 | `lib/data/listings/`, `app/api/sync-spark/`, `sync-*` crons | Repo API. Mandatory cross-check vs Supabase for any published stat (CLAUDE.md §0) | `SPARK_API_KEY`, `SPARK_API_BASE_URL` |
| **UI / Design** | `design_system/ryan-realty/` (MANIFEST→SKILL→README→colors_and_type.css), `ui_kits/<surface>/` mockups | `components/ui/`, `components/site/` | Figma MCP for design context; skills `design:design-system`, `frontend-design`, `hallmark` | — |
| **SEO** | `docs/seo-audit-*`, gates G5 + G34 | `lib/site/page-metadata.ts`, per-route `generateMetadata`, JSON-LD helpers | Skill `marketing:seo-audit`; GSC via service account; Ahrefs / Similarweb plugins connect-able | `GOOGLE_SEARCH_CONSOLE_SITE_URL` |
| **AI providers** | `video_production_skills/API_INVENTORY.md` | `lib/replicate.ts`, `lib/pulse-brain-content.ts`, the voice libs | Replicate, ElevenLabs (Victoria, locked), xAI Grok, Vertex AI, Anthropic | `REPLICATE_API_TOKEN`, `ELEVENLABS_API_KEY`, `XAI_API_KEY`, `VERTEX_PROJECT_ID`, `ANTHROPIC_API_KEY` |
| **Auth** (Supabase Auth + Google sign-in) | memory `reference_supabase_custom_domain_oauth`, `docs/CUTOVER_RUNBOOK.md` (Phase C auth URLs) | `lib/supabase/oauth.ts`, `lib/supabase/server.ts`, middleware | Supabase Auth dashboard + Google Cloud OAuth console via Chrome MCP. Custom domain `auth.ryan-realty.com`; after any Auth change, save a setting to force a GoTrue config reload | `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `NEXT_PUBLIC_SUPABASE_URL` |
| **Maps** (Google Maps JS, Geocoding, Photorealistic 3D) | `docs/GOOGLE_MAPS_SETUP.md` | `lib/use-google-maps-ready.ts`, map components, `app/api/maps/*`, Remotion flyovers | Repo (browser key for live maps, Remotion key for video flyovers). Geocoding API may need enabling | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `REMOTION_GOOGLE_MAPS_KEY` |
| **Social publishing** (TikTok, YouTube, LinkedIn, Threads, X, Pinterest, Nextdoor, Buffer) | `social_media_skills/platform-best-practices/SKILL.md`, `automation_skills/post_scheduler/` | `lib/tiktok.ts`, `app/api/<platform>/authorize/`, `app/api/social/publish/`, Meta-family via `lib/meta-graph.ts` | Repo OAuth + each platform's API; Buffer for X / Pinterest / Threads. First-time platforms need OAuth connect at `/api/<platform>/authorize`. TikTok is sandbox-only. Handles locked to `@ryanrealtybend` | `TIKTOK_CLIENT_KEY/SECRET`, `YOUTUBE_CLIENT_ID/SECRET`, `LINKEDIN_CLIENT_ID/SECRET`, `THREADS_*`, `X_*`, `PINTEREST_*`, `NEXTDOOR_*`, `BUFFER_ACCESS_TOKEN` |
| **Lead enrichment / skip-trace** (Apify, Tracerfy, BatchData, NeverBounce) | `marketing_brain_skills/producers/expired-listing-lp/SKILL.md`, `docs/MARKETING_LEAD_FLOW.md`, memory `reference_tcpa_litigator_handling` | `lib/expired-owner-lookup.ts`, `app/api/cron/detect-expired-listings/`, `detect-fsbo-listings/` | Apify MCP + repo wrappers. Apply TCPA hard-stop tagging on litigator / DNC hits before ANY outreach (real lawsuit risk) | `APIFY_API_TOKEN`, `TRACERFY_API_KEY/BASE`, `BATCHDATA_API_KEY`, `NEVERBOUNCE_API_KEY` |
| **Transaction ops (SkySlope)** | skill `skyslope-form-compliance`, memory `reference_skyslope_form_compliance_lessons` | `app/api/admin/*` (SkySlope), `scripts/` SkySlope tooling | SkySlope API + UI via Chrome / Playwright. **Vault is the source of truth for transactions, never reconcile against SkySlope** | `SKYSLOPE_ACCESS_KEY/SECRET`, `SKYSLOPE_CLIENT_ID/SECRET`, `SKYSLOPE_LOGIN_*` |
| **Media / stock** (Unsplash, Pexels, Shutterstock, asset library) | `video_production_skills/media-sourcing/SKILL.md`, `video_production_skills/asset-library/SKILL.md` | `lib/asset-library.mjs`, `data/asset-library/manifest.json` | Follow the media-sourcing decision tree: asset library → Unsplash → Pexels → Shutterstock → AI generation | `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`, `SHUTTERSTOCK_API_KEY/SECRET` |
| **Infra / observability** (Sentry, Upstash Redis, Inngest) | Sentry config files, `vercel.json` | `sentry.*.config.ts`, rate-limit middleware, Inngest event/webhook handler + video pipeline | Sentry via dashboard + repo config (mind the G19 trace-sample-rate gate); Upstash for rate limiting; Inngest for background jobs | `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `UPSTASH_REDIS_REST_URL/TOKEN`, `INNGEST_EVENT_KEY/SIGNING_KEY` |
| **Marketing brain / publishing pipeline** (the connective tissue) | `marketing_brain_skills/run/`, `produce/`, `producers/REGISTRY.md`, `automation_skills/content_engine/SKILL.md` | `marketing_brain_actions` table, `app/api/cron/{producer-dispatcher,producer-runtime,publisher-sweep,marketing-measurement-loop}/` | Brain creates action rows → producer crons execute → Matt approves → publisher-sweep posts → measurement loop scores. Never invoke a producer outside this pipeline | (uses the per-platform creds above) |
| **Web push** (optional) | — | service worker + push route | Browser push notifications; optional surface | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |

**Not yet wired / optional** (present as env stubs — confirm before relying): SchoolDigger (school ratings), STR provider (vacation-rental estimates). `API_INVENTORY.md` is the single source of truth for what is live, degraded, or down — read it before assuming any provider works.

## Phase 1 — Full-stack state-of-the-codebase map (as a Workflow)

Orchestrate a parallel audit with the Workflow tool and synthesize ONE ranked document at `docs/plans/site-consistency-audit-<today>.md`. Read-only. Commit nothing. Every finding gets a severity score and a "fix it needs" tag (contract / deletion / refactor / new gate). Cover:

1. **Route ledger** — every `app/**/page.tsx` route. For each: has a mockup in `design_system/ryan-realty/ui_kits/`? has a `parity.json`? composes from the `components/site` primitives? The routes with no contract are the drift surface — quantify them.
2. **Gate-adherence ledger** — every ratcheted gate (DAL boundary, brand voice, design tokens, mockup parity, page-DAL, internal links, tool discipline, hydration, and the rest). For each, COUNT the violations currently grandfathered in its baseline file. This is the hidden debt, made countable for the first time.
3. **Knowledge-layer ledger** — every place a page invents a fact the DB or a registry already holds. Known starting points: `cities` / `communities` / `neighborhoods` have `seo_title` / `seo_description` / `description` columns that are populated but ignored in favor of hardcoded template strings; resort content is double-sourced between `data/resort-community-*.json` and `communities.resort_content`. Find the rest.
4. **Legacy kill-list** — dead code, orphan one-off scripts (`scripts/_*`), retired-pattern remnants (gold tokens, AzoSans, `_style_backup` references), stale docs and handoffs, cold or dead Supabase tables. Tag each remove / keep / investigate.
5. **Systems coherence** — beyond the front-end: how coherently do the database/knowledge model, analytics wiring, the FUB pipeline, the Facebook/ads stack, and the SEO surface connect to the site? Where do they duplicate, drift from, or contradict each other?
6. **Performance & competitive baseline** — pull the current scoreboard from the telemetry you mapped in Phase 0: GA4 (traffic, conversion, bounce by surface), Search Console (rankings, CTR, impressions by query and page), ads (CPL by campaign and LP), Core Web Vitals (LCP/CLS/TTFB by route), FUB (lead volume and outcome), and the competitive gap (where competitors outrank or outconvert us). This is the baseline the loop optimizes against — no baseline, no way to prove the loop produces results.

Then cluster. Group every finding by root cause and class — one root cause (for example, "pages invent SEO text instead of reading the DB column") maps to all its instances across the site. Phase 3 attacks the clusters, not the symptoms, so the whole project is taken into account before any change is made.

Adversarially verify each finding before it lands in the doc (an independent verifier per claim; default to "not a real finding" when unproven). Log anything you cap or skip — no silent truncation. Then stop and show Matt the doc. Do not start fixing without his read.

## Phase 2 — Worked example: brand-voice dial-in (Matt has pre-approved this scope)

The brand-voice system conflates an excellent positive spec with over-broad negative enforcement. Keep the spec; fix the enforcement. Make these as a reviewed draft, then wait for go:

- **Scope the gates.** G2 (ESLint) and G3 (CI) both source from `scripts/brand-voice-vocabulary.cjs`. Scope them to genuinely client-facing surfaces — the publish path, listing/email/social/blog/VO generators, public page copy — and exempt internal UI, admin, dashboards, and dev code. This kills most of the false-positive friction.
- **Em-dash / en-dash → WARNING (Matt approved this specific change).** Downgrade the hard `DashViolationError` throw in `lib/punctuation-guard.ts` from blocking to a non-blocking warning. Update the "locked permanently" banner and the changelog in `marketing_brain_skills/brand-voice/voice_guidelines.md` to record the downgrade and the date.
- **Tier discipline.** Move legit-use survivors (`dynamic`, `vibrant`, `curated`) from HARD to SOFT (warn, not block), using the two-tier system the skill already defines.
- Keep both gate consumers in sync (a test asserts they match). Show the diff. Nothing commits without go.

## Phase 3 — Build the self-training improvement engine (a real system, not prose)

The loop is a closed feedback system: ingest real outcome data, decide the highest-ROI improvement, ship it as a measured experiment, learn from the result, lock the win behind a gate. Build on the telemetry that already exists (the `marketing-snapshot-*` crons, `content_performance`, `marketing_channel_daily`, the measurement loop, `optimization-loop` / `performance_loop`) — extend it, do not rebuild it. Every component below is a table, a query, a function, or a gate you can point at. If a step would be prose, it is not done.

1. **Ingest.** Read the outcome data already landing in Supabase, and wire the gaps: GA4 (sessions, conversion, bounce by surface), Search Console (impressions, clicks, CTR, average position, query → page — the SEO goldmine), Meta/FB ads (spend, CPL, conversion by campaign / ad / LP), FUB (leads created, source, broker outcome), Core Web Vitals (LCP/CLS/TTFB by route), and competitive signals (Apify competitor recon, SERP position vs named competitors, SimilarWeb / Ahrefs if connected). Normalize into one `site_signal` view keyed by route + date.

2. **Diagnose — turn signal into ranked opportunities** with concrete rules, not vibes:
   - High impressions + CTR under ~2% → rewrite title/meta (seen, not clicked).
   - Average position 5–15 on a query with real volume → on-page SEO + content depth (a winnable ranking).
   - High traffic + high bounce + low conversion → UX / consistency / CTA fix on that surface.
   - High ad spend + low LP conversion → funnel / LP fix.
   - LCP over 2.5s on a high-traffic route → performance fix.
   - A competitor outranks us on a target query → targeted content / page.
   Each candidate carries: surface, signal evidence, hypothesized fix, and the metric it should move.

3. **Prioritize — a value function with shown math.** `score = reach × gap-to-benchmark × confidence ÷ effort`, where `confidence` is the *learned* win-rate for that change-class (from step 5). The top candidate wins the cycle.

4. **Fix the whole class, then review it exhaustively before Matt sees it.** The unit of work is the root-cause cluster, resolved everywhere it occurs across the site in one coordinated change plus a gate — never the single instance someone happened to spot. Honor the preflight contract (load the inputs first). Then, before anything reaches Matt, run the full review the way he would — every affected instance, mobile and desktop, every number traced — using `/deep-audit`, `engineering:code-review` (`ultra`), `design:design-critique`, `design:accessibility-review`, `/verify`, and the §0 data trace. Matt confirms a class is resolved; he does not find the bugs. The change is a measured experiment: stamp a baseline metric + window, A/B where the surface supports it (`automation_skills/ab_testing`), else before/after.

5. **Learn — this is the self-training part.** After the window closes, write `(change_class, surface, predicted_delta, actual_delta)` to a `site_improvement_ledger` table and update the per-change-class win-rate prior the value function reads in step 3. Over cycles the loop learns which change-classes actually move which metric on which surface, and stops spending effort on the ones that do not. That is how it trains itself to get better — the priors are data, not opinion.

6. **Lock the win.** Every improvement that fixed a class of problem also adds or tightens a mechanical gate (the ratchet). A measured win that can silently regress is incomplete.

7. **Compete.** A standing weekly benchmark of our rankings / CTR / conversion vs the named competitors on target queries. The gap to the leader is an explicit input to the value function, so the loop preferentially attacks where we are losing.

8. **Improve the process itself.** Feed two failure types back into the process, not just the product. (a) *Escapes:* a defect that reached Matt or slipped a check — fix the class, add the check that would have caught it, and log it to a `process_escape_ledger` (defect, why the review missed it, the check added). (b) *Mispredictions / regressions:* a fix that regressed or a predicted win that did not land — tighten the gate or sharpen the value function. Over cycles the review gets as thorough as Matt's eye, then past it.

**Wiring it up (the solid build):** a `site-consistency` skill (`skill-creator`) encodes the Phase-1 audit pass + the ratchet rules; `site_signal` (view), `site_improvement_ledger` (table), and `process_escape_ledger` (table) ship as real migrations; a recurring driver (`/schedule` cloud agent or a Vercel cron, extending the existing `optimization-loop` / `performance_loop` rather than duplicating them) runs ingest → diagnose → prioritize → propose; enforcement hooks (`update-config` → `settings.json`) make skill-loading, the preflight contract, and `ci:gates` harness-enforced. Each cycle reports four numbers moving the right way: baselines down, contract count up, the measured business metric (rank / CTR / conversion / leads) up, and review escapes trending to zero.

## Phase 4 — Establish the single canonical process and decommission Cursor

Make this process the one thing every agent and component runs through, remove the old plans it replaces, and remove Cursor (all work now runs only in Claude Code in the terminal). This can and probably should run FIRST, so the rest of the loop operates inside a clean, single-tool canon. **Roll-in before remove: never delete a rule or skill until its surviving value is preserved in the canon.**

1. **Promote to a canonical home.** Distill this launcher into `docs/DEVELOPMENT_PROCESS.md` — the permanent, versioned source of truth for the cycle (ingest → audit → diagnose → prioritize → ship-as-experiment → learn → lock → compete, plus the ratchet and draft-first rules). This launcher can then be archived; it ran once.
2. **Wire the pointer into the Claude Code entry points** (verified to exist): `CLAUDE.md`, `marketing_brain_skills/producers/TEMPLATE.md`, and the cron system-prompt builder `buildTextProducerSystemPrompt(skillContent)` (defined in `lib/marketing-brain/producer-output-class.ts`, called from `app/api/cron/producer-runtime/route.ts:218`). Each gets a one-line "all development routes through THE LOOP — see `docs/DEVELOPMENT_PROCESS.md`" pointer, so every Claude Code session, producer, and cron agent inherits it. (`AGENTS.md` and `.cursor/` are decommission targets in step 4, not wire-up targets.)
3. **Build the sync gate** (`scripts/check-process-canon.mjs`, added to `ci:gates`). Fails the build if: (a) any entry point stops pointing at `docs/DEVELOPMENT_PROCESS.md`; (b) the referenced doc version drifts from the doc's own version header; (c) a new file lands in `docs/plans/` without being registered in the canonical doc's index (no rogue plans reaccumulating).
4. **Decommission Cursor (verified inventory — preserve, then remove).** The `.cursor/` tree holds real value that must not be lost:
   - **`.cursor/rules/` (29 rules).** 3 are pure-Cursor and safe to delete (`complete-scope-and-best-practices`, `cross-agent-handoff-skills`, `goals-and-audit`; plus the Cursor-procedural parts of `master-plan-protocol` and `sync-status-trigger`). The other ~26 are real engineering rules (sync pipeline, server-action shape, error handling, design-system, production-parity, auth patterns, SEO URL guardrails, data architecture, and more). Roll these into the canon — **deduped against CLAUDE.md** (much already overlaps), consolidated into a few focused `docs/` references rather than bloating CLAUDE.md. Read each rule's content before deciding; do not classify from the filename.
   - **`.cursor/skills/` (7 tool-agnostic skills):** `oregon-orea-principal-broker`, `oregon-real-estate-oref`, `skyslope-api`, `skyslope-file-organization`, `professional-word-docx`, `database-canonical-reference`, `facebook-seller-growth`. Move to `.claude/skills/`; `facebook-seller-growth` already exists there, so merge, do not duplicate.
   - **Strip the dual-tool machinery:** remove the "Same pipeline as Cursor" / "Claude Code ↔ Cursor" / Cursor-plugin references from `CLAUDE.md` (4 known spots) and `AGENTS.md` (keep its universal ship-discipline, cut the handoff section); delete `docs/plans/CROSS_AGENT_HANDOFF.md` and the `.cursor/GLOBAL_SKILLS_REGISTRY.md` stub; edit the 3 memories that name Cursor (`feedback_enforcement_over_audits`, `project_canonical_dev_loop`, `feedback_always_push`). KEEP `docs/plans/task-registry.json` and the git `docs/plans/GLOBAL_SKILLS_REGISTRY.md` mirror — both tool-agnostic.
   - Only after the above lands: delete the `.cursor/` directory. Run `npm run build` + `ci:gates` to confirm nothing referenced a moved or removed file.
5. **Retire the old plans.** Archive the superseded plans (`phase-0`…`phase-6` briefs, `PRODUCT_SPEC_V2`, `INDEX_MASTER_DEAL_PIPELINE`, `USER_JOURNEYS`, `continuous-improvement` — ~11 docs) and dated handoff / audit snapshots (~27 in `docs/`, ~9 in `.auto-memory/`) into `docs/archive/_plans-completed/`, each with a one-line supersession note. Protect the 17 active-reference docs.
6. **Self-revision protocol.** `docs/DEVELOPMENT_PROCESS.md` carries a version + changelog. The loop may propose edits to itself like any other improvement (draft → Matt approves). On any change, the version bumps and the sync gate re-verifies all pointers in the same commit — so the canon and its references can never drift, and the process is never frozen.

**Tighten the canon as you establish it (architecture researched and decided — not open questions):**
- **Invert CLAUDE.md.** It is a ~4,500-line kitchen sink today, which is why rules get missed. Cut it to a lean ~800 lines: the hard gates (data accuracy, draft-first, live-safety) + a "when X, load skill Y" routing index + a process overview + a compact-fallback block that survives context compaction. Everything else — design system, data layer, video, marketing, the rolled-in Cursor rules — moves into skills and focused `docs/`, deduped.
- **Make skills actually load.** Skills auto-discover only from `.claude/skills/`; the 150+ skills in `video_production_skills/`, `marketing_brain_skills/`, etc. do not auto-load today. Wire the high-value ones into `.claude/skills/` (symlinks) plus the routing index, so the right expertise loads on relevance instead of the session going naked.
- **Hooks are the enforcement, not prose.** Move the pre-commit gate from per-machine `.git/hooks/` into checked-in `.claude/hooks/` + `.claude/settings.json`: a `PreToolUse` hook blocks any commit/push when `ci:gates` or the preflight check is red; a `SessionStart` hook health-checks the environment.
- **One process, terminal and crons alike.** A `process-and-gates` skill carries the cycle; interactive sessions load it and the headless producer crons inject it via `buildTextProducerSystemPrompt` — so identical rules are in-context for the terminal and the 30-minute cron. "All agents aware" is enforced, not hoped.

Surface the work as reviewed batches (the new doc, the lean CLAUDE.md + routing index, the wired-in skills, the hooks, the pointers, the rolled-in rules, the moved skills, the CLAUDE.md / AGENTS.md edits, the archive + deletion list, the new gates). The Cursor decommission is destructive — show Matt the full preserve-then-delete list and wait. Nothing commits without go.

## Cadence with Matt

Stop at the end of each phase and show the artifact (the audit doc + the baseline scoreboard, the brand-voice diff, the loop's first measured cycle, the canonization + Cursor-decommission batches). Surface every decision as concrete options. Commit only on explicit approval. **This plan supersedes all prior plans and audits in `docs/plans/` and `docs/`** — treat it as canonical and improve it in place rather than starting a new one. Phase 4 (establish the canon + decommission Cursor) can run first to give the loop a clean, single-tool base; otherwise begin with Phase 0 and work in order.
