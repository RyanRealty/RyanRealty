# Spec 11 — API + Server-Action + Cron Consolidation and Hardening

> **Area:** the entire backend surface — every route under `app/api/**`, every
> server action under `app/actions/**`, every cron under `app/api/cron/**`, and the
> auth/send/sync/publish libraries beneath them. This is the **backbone every other
> spec sits on**: the one auth entry point, the one send chokepoint, the delete pass,
> and the cron reconciliation.
> **Derived from:** `../00-REASONING-AND-ARCHITECTURE.md` (§4.4 one auth primitive;
> §4.2 optimistic + idempotent mutation, server half; §4.7 one canonical surface per
> concept + delete the accretion; §4.6 direct lib calls not HTTP fan-out; §7
> sequencing — this is **Foundation + the final Delete pass**) and the ground-truth
> audit `../audit-reports/api-surface.md`. Every keep/merge/delete cites that audit;
> every schema/lib/signature fact was re-verified against the live tree at `d3dd457a`.
> **Conforms to:** C1 (right size is small — the surface is wildly oversized for ≤5
> operators), C4 (every number is a compliance artifact — the send chokepoint is
> where accuracy + suppression live), C5 (messages carry money + TCPA — send
> integrity is idempotent + fail-closed by construction). Kills **RC4** (build-by-
> accretion, no consolidation gate) and **RC5** (auth scattered across disagreeing
> layers), and delivers the server half of **RC2** (idempotent mutations) and **RC6**
> (delete the placebo/dead surfaces).

A senior engineer can build every item in this document with no further questions.
The deliverable is the **explicit keep / merge / delete ledger** for the whole
API + action + cron surface, plus the hardening (one auth entry point, one send
chokepoint, cron leases, direct lib calls) and the mechanical gates that stop the
accretion from regrowing.

---

## 0. What this spec owns vs. depends on

**Owns (this spec is the source of truth):**

- **The one auth entry point.** `lib/auth/guards.ts` (already canonical) adopted by
  *every* admin/interactive route handler and *every* mutating server action, with a
  first-line in-body guard; plus a widened mechanical gate (`ci:admin-authz`) that
  fails the build if a route/action mutates without it.
- **The send/publish/sync consolidation.** One governed `sendEmail` + one governed
  `sendSms` chokepoint that every path (alerts included) routes through; one social
  publish path; one weekly-cycle; one CMA-delivery primitive; one parametric CMA-map
  route; the sync HTTP surface de-sprawled.
- **The delete pass.** The ~24 dead routes + 7 dead action files removed, verified no
  runtime invoker remains.
- **The cron reconciliation.** The 13 orphaned crons scheduled or deleted; the
  `detect-expired-listings` "hourly" doc/reality mismatch fixed; the HTTP self-fetch
  fan-outs replaced with direct lib calls; an overlap-lease helper available to every
  high-frequency cron and adopted.
- **The cron guard standard.** One `isAuthorizedCron`, fail-closed everywhere, no
  inline copies.

**Depends on (owned by sibling specs — this spec conforms + consumes, does not
redefine):**

- **§4.1 Conversation / `message` model + the outbound-message persistence
  (`logOutboundMessage` / `claimOutboundMessage`)** → **Spec 02 (Inbox +
  conversations)**. The send chokepoint here *delegates persistence + the
  idempotency claim* to Spec 02's message store; it does not own the
  `conversation`/`message` migration. During the additive-migration window the
  claim/log writes through to `crm_timeline.dedupe_key`
  (`DATABASE_SCHEMA_SNAPSHOT.md:2119`, unique) so nothing breaks before `message`
  lands.
- **§4.2 client optimistic mutation primitive** (`useOptimistic`/`useTransition`,
  the client half) → **Spec 01 (Foundation)**. This spec owns the **server half** of
  the contract: actions accept + persist an `idempotency_key`, a duplicate key is a
  no-op returning the original result, and actions **return the changed entity**
  instead of `revalidatePath`-ing the whole page.
- **§4.4 capability map + nav generation** → **Spec 01**. This spec consumes the
  capability constants (`requireAdmin(capability)`); Spec 01 authors the map and the
  nav generator. The guard *primitive* and its universal adoption + gate are owned
  here.
- **The CRM composer UI + its optimistic wiring** → **Spec 02 / Spec 03**. This spec
  owns the *server* send primitives those composers call.
- **The metric layer** (`getLeadIntake`, one definition per number) → **Spec 06
  (Performance)**. This spec only guarantees the crons that *write* those metrics run
  on a schedule and don't double-process.

**Explicitly not in scope:** any UI. This spec produces libraries, route/action
shapes, migrations, deletions, and gates. Where a "flow" appears below it is the
*developer/operator* flow (the ci gate, the deploy path, the cron tick), not an
end-user screen.

---

## 1. The Keep / Merge / Delete ledger (the core deliverable)

Five ledgers cover the whole surface. Every row cites the audit. "Verdict" is the
action the rebuild takes.

### 1.1 Auth ledger — one guard, adopt everywhere, delete the variants

The canonical module already exists and is correct (verified `lib/auth/guards.ts`):
`getAdminContext()`, `requireAdminOr403()`, `requireSuperuserOr403()`,
`isAuthorizedAdminOrCron(req)`; the cron-secret comparison is isolated + fail-closed
in `lib/auth/cron-auth.ts` `isValidCronAuth` (returns `false` when the secret is
unset — verified). The problem is **adoption**, not design (`api-surface.md §1`: 199
handlers authenticate through ≥8 mechanisms; the gate whitelists only 2 files).

| Auth mechanism (today) | Where | Verdict |
|---|---|---|
| `requireAdminOr403` / `requireSuperuserOr403` / `isAuthorizedAdminOrCron` | crm-import, expired-listing-lookup, gbp/set-website-utm, cma/* (~5) | **KEEP — this is the canonical target.** Every other admin route + action migrates onto it. |
| `getAdminRoleForEmail(email)` inline (any admin role) | stock search, sync/status, approval-queue, run-producer, offline-conversion (~14) | **MERGE →** `requireAdminOr403()` (it wraps exactly this chain). |
| `isSuperuserAdmin` | `/api/admin/sync`, `/api/admin/sync/delta` | **MERGE →** `requireSuperuserOr403()`. |
| `isAuthorizedCron` (`lib/marketing-brain/snapshot.ts:148`) raw `Bearer CRON_SECRET` | 42 cron/marketing routes | **KEEP the function, standardize the import.** This is the one cron guard. Move it to `lib/auth/cron-auth.ts` as `isAuthorizedCron(req)` (re-export from the marketing path for back-compat), fail-closed. |
| Inline `isAuthorized()` copies of the bearer check | `crm-sequence-engine/helpers.ts:23`, `refresh-video-tours-cache`, others (≥3) | **DELETE the copies →** import `isAuthorizedCron`. The copies **fail OPEN in non-production** (`if (!secret) return !isProd`, `api-surface.md §6`) — a misconfigured preview is unauthenticated. Kill that footgun. |
| Bare `process.env.CRON_SECRET` string compare in-file | many `/api/cron/*`, `/api/social/publish*` (`x-cron-secret`) (~15) | **MERGE →** `isAuthorizedCron`. |
| `getCrmAccess()` + `isPersonInScope` (ownership-scoped) | crm/attachment, crm/export, crm/mms, crm/recording (4) | **KEEP.** CRM-specific ownership scope is correct and additive to the admin guard, not a replacement. |
| Per-endpoint bespoke secret (`TC_FORMS_INGEST_SECRET`, `CMA_WORKER_AUTH_SECRET`, `REVALIDATE_SECRET`, `META_OAUTH_STATE`) | forms/ingest, cma-delivery, revalidate, meta/oauth-callback (4) | **KEEP** where cross-origin-by-design (forms/ingest, cma-delivery worker). **`meta/oauth-callback` — see §1.3 delete note** (one-time bootstrap that was never removed). |
| Twilio signature (`validateTwilioSignature`) | all 7 `/api/twilio/*` | **KEEP.** Most-consistent family; correct fail-closed HMAC (verified `lib/crm/twilio.ts:81`). |
| Webhook/verify token (`x-hub-signature`, Resend signature) | meta/lead-webhook, webhooks/resend | **KEEP.** External-entry-by-design. |

**Server-action gap (the single most important hardening, `api-surface.md §1a`):**
664 exported action functions vs ~15 admin-mutating API routes; the **overwhelming
majority carry no in-body auth**, protected only by `app/admin/(protected)/layout.tsx`
which gates *page rendering*. Next.js actions compile to independently-invocable POST
endpoints; a layout `redirect()` does not run on a direct action POST. Named
offenders with **zero in-action authorization** performing service-role
mutations/sends:

| Action file | Function(s) | What it does unguarded | Verdict |
|---|---|---|---|
| `app/actions/blog.ts` | `saveBlogPost` (`:210` `.upsert`), `deleteBlogPost` (`:256` `.delete`) | service-role writes to `blog_posts` → stored-XSS/defacement onto `ryan-realty.com` | **HARDEN — first-line `requireAdmin('content:write')`.** |
| `app/actions/admin-email.ts` | `sendAdminEmail` (`:7`) | sends arbitrary Resend email to any address + inserts `email_campaigns`, only a suppression check | **HARDEN — guard + route through the governed chokepoint (§3.4).** |
| `app/actions/admin-setup.ts`, `admin-listings.ts`, `broker-generated-media.ts`, `guides.ts`, `hero-videos.ts`, `headshot-prompts.ts`, `subdivision-descriptions.ts`, `community-engagement.ts`, `generate-market-report.ts`, `partnership-revenue.ts`, `log-admin-action.ts`, `saved-listings.ts` | various `.insert/.update/.delete` | service-role writes, no in-body guard | **HARDEN — first-line guard each.** |
| `app/actions/crm.ts` + satellites | most CRM actions | already call `resolveCrmAccess`/`requireCrmAccess`/`requirePersonInScope` | **KEEP — this is the pattern.** The older admin-CMS actions above adopt it. |

### 1.2 Merge ledger — duplicate capability, collapse to one (`api-surface.md §3`)

| # | Concept | Duplicate entry points (today) | Verdict → one path |
|---|---|---|---|
| 1 | **Social publish** | `/api/social/publish` (782 lines, reimplements FB+IG internally) + `/api/social/publish-facebook` + `/api/social/publish-instagram` + `/api/social/publish-tiktok`, all calling the same `lib/meta-graph`/`lib/tiktok` helpers. Per-platform routes have no runtime caller. Live path = `publisher-sweep` → self-`fetch('/api/social/publish')`. | **MERGE.** Extract publish logic into `lib/social/publish.ts` `publishPost({platform, payload})`. `/api/social/publish` becomes a thin authenticated wrapper over it. `publisher-sweep` calls the lib **directly** (kills the self-fetch, §3.1). **DELETE** the 3 per-platform routes. |
| 2 | **Weekly cycle** | `/api/cron/weekly-cycle` (self-documented "Phase 11.5 alias", `route.ts:5`) + `/api/cron/marketing-weekly-cycle`, both calling `runWeeklyCycle` from `lib/marketing-brain/weekly-cycle`. Only `marketing-weekly-cycle` is scheduled. | **DELETE `weekly-cycle`** (the alias). Keep `marketing-weekly-cycle`. |
| 3 | **Marketing snapshots** | `snapshot-channels` (scheduled) fans out via internal HTTP self-fetch to 9 `marketing-snapshot-{ga4,gsc,meta-ads,meta-page,x,linkedin,tiktok,gbp,youtube}` routes; logic already lives in `lib/marketing-brain/snapshot.ts`. | **MERGE.** `snapshot-channels` calls the per-platform snapshot lib functions **directly** in one invocation (§3.1). The 9 routes become thin optional wrappers or are deleted (keep only if a manual per-platform re-pull is wanted — §5). `marketing-snapshot-google-ads` reconciliation → §5. |
| 4 | **Publisher self-fetch** | `publisher-sweep` → `fetch('/api/social/publish')` (`route.ts:183`) | **MERGE →** direct `lib/social/publish.ts` call (same fix as #1). |
| 5 | **Sync sprawl** | `/api/admin/sync`, `/sync/delta`, `/sync/live`, `/sync/photos`, `/sync/history-active`, `/api/cron/sync-delta`, `/sync-full`, `/sync-history-terminal`, `/sync-parity`, `/sync-verify-full-history`, `/start-sync`, `/api/sync-spark`. Live logic in `app/actions/sync-spark.ts` / `sync-full-cron.ts` / `lib`. | **KEEP** the wired admin interactive routes (`sync`, `sync/delta`, `sync/live`, `sync/status`, `sync-heavy`) + the scheduled crons (`sync-delta`, `sync-full`, `sync-history-terminal`). **DELETE** the dead wrappers `sync/photos`, `sync/history-active`, `/api/sync-spark` (§1.3). **Reconcile** `sync-parity`, `sync-verify-full-history`, `start-sync` (§5). |
| 6 | **CMA send** | `/api/cma/[slug]/email`, `/api/cma/[slug]/gmail-draft`, `/api/cma-delivery` (worker), `/api/cma-drafts/[id]/send`, actions `cma-admin.sendCmaToLeadAction`, `contact-cma`, libs `lib/cma/send.sendCmaToLead`, `lib/cma-delivery.processCmaDelivery`, `lib/cma-deliver.ts`. ≥4 delivery code paths. | **MERGE onto the KEPT primitive** `lib/cma/send.ts` `sendCmaToLead(slug, override?)` (verified `:293`; audit §3 (kept-core): "keep the libs, kill the redundant surfaces"). All routes/actions become thin callers of that one lib, which internally routes through the governed email chokepoint (§3.4). `lib/cma-deliver.ts` (only a doc-comment reference, §1.3) and the redundant wrappers are deleted/collapsed. Async build via `cma-build-worker` cron (kept). |
| 7 | **Email / SMS send primitives** | 20+ `send*` across `lib/resend.ts` (`sendEmail`), `lib/crm/gmail.ts` (`sendCrmEmail`), `lib/crm/twilio.ts` (`sendSms`, `sendSmsViaMessagingService`), + per-feature senders (`seller-lead-alert`, `expired-alert`, `fsbo-alert`, `market-stat-alert`, `deploy-health-alert`, `tc/signing-emails`, `bpo/send`, `cma/send`, `newsletter/send-queue`, `broker-alerts`, `daily-broker-digest`, `weekly-pipeline-digest`, `marketing/daily-digest`). CRM composers are gate-enforced but the **backend has no choke point** — alert emails bypass the suppression + timeline path CRM sends use. | **MERGE — the big one, §3.4.** One governed `sendEmail` + one governed `sendSms` in `lib/comms/`. Every path routes through it. Suppression (fail-closed) + logging inside. Transport-agnostic (Gmail-DWD vs Resend chosen inside). Alerts included. |
| 8 | **CMA static-map routes** | `/api/maps/cma-{18705,19496,3735,228,21042}-*` — 5 hardcoded per-CMA routes (verified `ls app/api/maps/`), one-offs for individual CMA HTML in `public/cmas/*`. | **MERGE →** one parametric `/api/maps/cma/[slug]` (§3.5). The 5 hardcoded dirs deleted after the embed HTML is repointed. |
| 9 | **Action ⇄ route duplication** | `app/actions/video-tours-cache.ts` (no importer) + `/api/cron/refresh-video-tours-cache`, both call `executeRefreshVideoToursCache`; same for `app/actions/refresh-place-content.ts` + its cron. | **DELETE the dead action wrappers** (§1.4); the cron calls the underlying lib fn directly. |

### 1.3 Delete ledger — API routes with no runtime invoker (`api-surface.md §4`)

Each re-verified with a permissive grep; external-entry endpoints (OAuth callbacks,
webhooks, email pixels, CMA map embeds) are **excluded** — they are alive by design.

| # | Route | Why dead | Notes |
|---|---|---|---|
| 1 | `/api/admin/offline-conversion` (POST) | superseded by `lib/meta-offline-conversions.ts` | |
| 2 | `/api/admin/producer-change-requests` (POST) | no UI | |
| 3 | `/api/admin/run-loop-cycle` (GET) | no UI, not scheduled | curl-only |
| 4 | `/api/admin/sync/history-active` (POST) | no caller | raw CRON_SECRET |
| 5 | `/api/admin/sync/photos` (POST) | no caller | raw CRON_SECRET |
| 6 | `/api/admin/tracerfy-history` (GET) | no caller | |
| 7 | `/api/ai/generate-text` (POST) | **no caller AND unauthenticated** (rate-limited only) — a live unauth LLM-cost endpoint | **priority delete** |
| 8 | `/api/pdf/listing` (POST) | no caller; sibling pdf routes wired | |
| 9 | `/api/search/semantic` (GET) | no caller; live search uses `/api/search/suggestions` | |
| 10 | `/api/spark-status` (GET) | no caller | |
| 11 | `/api/sync-spark` (GET/POST) | dead HTTP wrapper; the action/lib is used, the route is not | |
| 12 | `/api/tiktok/diagnostic` (GET) | no caller | |
| 13 | `/api/social/publish-facebook` (POST) | superseded by `/api/social/publish` | merge #1 |
| 14 | `/api/social/publish-instagram` (POST) | superseded | merge #1 |
| 15 | `/api/social/publish-tiktok` (POST) | script-only, superseded | merge #1 |
| 16 | `/api/cma/[slug]/finalize-deliver` (POST) | only a doc-comment reference in `lib/cma-deliver.ts:21`; no code fetches it | |
| 17 | `/api/marketing-brain/audit/ads`, `/audit/crm`, `/audit/website`, `/diagnose`, `/generate-briefs`, `/gsc-properties`, `/linkedin-orgs` (7) | dead HTTP wrappers; real audit runs via `/api/cron/marketing-audit-run` → `lib/marketing-brain/audit-run.runAudit` | all CRON_SECRET-guarded, curl-only |
| 18 | `/api/maps/cma-21042-robin` (GET) | draft-only, no live embed | the other 4 alive until repointed → merge #8 |
| 19 | `/api/listings/[listingKey]/photos` (GET) | sparse-sync photo-fallback; no UI caller | |
| 20 | `meta/oauth-callback` | one-time bootstrap; its own header (`oauth-callback.ts:39`) says "delete or rotate `META_OAUTH_STATE` after minting"; cleanup never ran; live token-minting endpoint gated only by a shared env string | **DELETE the route; rotate `META_OAUTH_STATE`.** Re-mint via a fresh short-lived route only when a token actually needs re-issuing. |

> **`/api/cma/[slug]/track` is NOT dead** — it is the CMA email open/click pixel
> (external entry). The matcher flagged it; it stays. Same for the 4 remaining
> `maps/cma-*` (embedded by live `public/cmas/*` HTML) until merge #8 repoints them.

### 1.4 Delete ledger — server-action files with no importer (`api-surface.md §4`)

All 7 confirmed present on disk (verified `app/actions/*.ts`). "No importer" =
static-traced across `app/ components/ lib/ hooks/ scripts/`.

| # | Action file | Why dead | Verdict |
|---|---|---|---|
| 21 | `app/actions/auto-response.ts` (`sendAutoResponse`) | 0 importers; a "5-minute auto-response" wired to nothing | **DELETE** |
| 22 | `app/actions/home.ts` (3 fns) | 0 importers | **DELETE** |
| 23 | `app/actions/lead-scoring.ts` (`computeLeadScore`) | 0 importers; scoring wired to nothing | **DELETE** (note: if lead scoring is wanted, it belongs in Spec 04/06 as a real feature, not this dead stub) |
| 24 | `app/actions/track-user-event.ts` | only imported by `track-visit.ts`, itself single-referenced; near-dead chain | **DELETE the chain** (confirm `track-visit.ts` consumer is also dead before removing) |
| 25 | `app/actions/video-tours-cache.ts` | dead action wrapper (merge #9) | **DELETE**; cron calls the lib fn directly |
| 26 | `app/actions/refresh-place-content.ts` | imported only by its cron; the `'use server'` wrapper is redundant | **DELETE the wrapper**; cron imports the underlying fn |
| 27 | `app/actions/photo-classification.ts` | one importer (search page) | **KEEP** — noted low-usage, not dead. (Audit lists it as "keep, noted".) |

### 1.5 Cron reconciliation ledger (`api-surface.md §5`)

49 crons scheduled in `vercel.json` (verified). 72 cron route dirs exist → 23
unscheduled. Disposition for each of the 23:

| Cron route (unscheduled) | Reality today | Verdict |
|---|---|---|
| 9× `marketing-snapshot-{ga4,gsc,meta-ads,meta-page,x,linkedin,tiktok,gbp,youtube}` | alive via `snapshot-channels` self-fetch | **MERGE** into `snapshot-channels` direct-lib fan-out (§3.1). Keep the route dirs only if a manual per-platform re-pull is wanted; otherwise delete. |
| `marketing-snapshot-google-ads` | **NOT** in the fan-out list → never runs | **DECISION → Matt (Q1).** If Google Ads is a live channel: add to the fan-out. Else: delete. Default proposal: add to fan-out (it is part of the durable data spine, not the frozen execution layer). |
| `weekly-cycle` | alias of `marketing-weekly-cycle` | **DELETE** (merge #2). |
| `strategy-revision-check`, `optimization-loop` | marketing-brain **execution** layer | **DELETE / leave unscheduled** — the execution layer is frozen (G45 producer-freeze; published zero content). Removing reduces maintenance surface. Note the freeze in the commit. |
| `refresh-video-tours-cache` | orphan; has dead action wrapper | **SCHEDULE** daily if video tours ship on the site, else delete. Default: schedule `0 6 * * *` (cheap cache refresh). Flag Q2. |
| `refresh-listing-year-stats` | orphan | **SCHEDULE.** Listing-year stats feed data-accuracy surfaces (C4); an unrefreshed stat silently rots (cf. MV-refresh-timeout incident). Default weekly `0 8 * * 0`. Flag Q2. |
| `neighborhood-default-subscriptions` | orphan | **SCHEDULE** if it seeds default market-report subscriptions the funnel needs (the market-report funnel audit found 3 subscribers ever); else delete. Flag Q2. Default: schedule weekly. |
| `sync-parity`, `sync-verify-full-history` | data-integrity verifiers | **SCHEDULE** (align with C4 — these prove the sync didn't drift). Default weekly off-peak. |
| `start-sync` | manual sync kickoff | **NOT a cron** — it is an admin trigger. Move behind the admin sync UI / `isAuthorizedAdminOrCron`; remove from the cron dir mental model. Keep as an interactive route. |
| `daily-broker-digest`, `weekly-pipeline-digest` | broker-facing digests (feed C2's notify edge) | **SCHEDULE.** These are useful loop notifications. Default: daily `0 13 * * *` / weekly `0 13 * * 1`. Route their emails through the governed chokepoint (internal audience, §3.4). Flag Q3 (confirm Matt wants them). |
| `marketing-inbox-poll` | polls social DMs → FUB lead capture (feeds C2's lead-arrival edge) | **DECISION → Matt (Q4).** Schedule if social-DM lead capture is wanted; the tokens/OAuth for some platforms are unconnected (per memory). Default: schedule `*/30` only for connected platforms. |
| `detect-expired-listings` | **CLAUDE.md says "hourly"; NOT in `vercel.json`** (`lib/expired-listing-processor.ts:17`: "kept for ad-hoc manual invocation") | **SCHEDULE + fix the doc.** Its sibling `detect-fsbo-listings` IS scheduled (`35 9 * * *`); expired detection being unscheduled is a latent bug (the expired dashboard is live per memory). Default: schedule `40 9 * * *` (daily, matching fsbo cadence) and correct the CLAUDE.md "hourly" claim to the real cadence. Flag Q5 (hourly vs daily). |

No `vercel.json` entry points at a missing route dir (verified — no broken schedule
pointers).

---

## 2. Feature — one auth entry point, adopted everywhere

### 2.1 Purpose & the job it serves

RC5: authorization truth is scattered across nav conditionals, 8 copy-pasted gate
layouts, and per-page/per-route checks that disagree — producing both broker
dead-ends *and* the security criticals (unauthenticated service-role writes onto the
public site; unauthenticated service-role reads of TC docs; `api-surface.md §1a`,
`content-geo-media.md crit #1`, `deals-tc.md high #1`). C4/C5: an unauthenticated
mutation surface is a compliance event, not a UX bug. The job: **make it structurally
impossible to ship an admin mutation that isn't authorized.**

### 2.2 What we keep / rebuild / delete

- **KEEP** `lib/auth/guards.ts` verbatim (verified correct) and `lib/auth/cron-auth.ts`
  `isValidCronAuth` (fail-closed on unset secret).
- **REBUILD** adoption: migrate the ~14 inline `getAdminRoleForEmail`, the 2
  `isSuperuserAdmin`, the ~15 bare `process.env.CRON_SECRET`, and the ≥3 inline
  `isAuthorized()` cron copies onto the four canonical guards (ledger §1.1).
- **ADD** `isAuthorizedCron(req)` as the single cron guard, re-homed in
  `lib/auth/cron-auth.ts`, fail-closed in **all** environments (delete the
  `return !isProd` fail-open branch, `api-surface.md §6`).
- **DELETE** the inline copies.

### 2.3 The server-action self-authorization contract (§4.4, the biggest hole)

Every server action that mutates or sends calls a guard as its **first executable
statement**, before reading any input:

```ts
'use server'
import { requireAdmin } from '@/lib/auth/guards' // capability-aware wrapper (§2.4)

export async function saveBlogPost(input: BlogInput): Promise<ActionResult> {
  const ctx = await requireAdmin('content:write')   // throws/returns 403-shaped result if unauthorized
  // ...only now touch input + the service-role client
}
```

- CRM actions keep their richer `requireCrmAccess` + `requirePersonInScope`
  (ownership scope) — that is a *superset* of the admin guard, not a bypass. The
  admin-CMS actions in ledger §1.1 adopt the plain `requireAdmin(capability)`.
- Read-only actions that expose sensitive data (TC deal documents, blog drafts) get
  the same guard. Public read actions (listing search) do not.

### 2.4 `requireAdmin(capability)` — the capability-aware wrapper

`requireAdmin(capability: Capability)` composes `getAdminContext()` (verified) with
the capability→role map **authored in Spec 01**. This spec consumes the map; it does
not define the capability list. Contract:

- Returns `AdminContext` when the session's role holds `capability`.
- Returns a typed refusal (route: `Response(403)`; action: `{ ok:false, code:'forbidden' }`)
  otherwise — never throws an unhandled 500.
- The **same** capability map generates the nav (Spec 01 §4.4), so a shown item can
  never point at an action that refuses (kills the 6 broker dead-end classes).

### 2.5 Mechanical gate — `ci:admin-authz` (widened)

Today `scripts/check-admin-endpoint-auth.mjs` whitelists exactly 2 files (verified).
Rebuild it into a **deny-by-default** gate:

- **Routes:** every `app/api/admin/**/route.ts` and every interactive (non-webhook,
  non-cron, non-OAuth-callback) route must import `@/lib/auth/guards` and call a guard.
  A curated allowlist names the genuinely public/external-entry routes (lead capture,
  pixels, OAuth callbacks, Twilio/webhook-signature routes, `/api/og`, `/api/calendar`)
  — everything not on it must guard, or the build fails.
- **Actions:** every exported function in `app/actions/**/*.ts` whose body contains a
  mutating Supabase call (`.insert/.update/.upsert/.delete/.rpc`) **or** a send
  (`sendEmail`/`sendSms`/Resend/Twilio) must call a guard (`requireAdmin*`,
  `requireCrmAccess`, `requirePersonInScope`, or `isAuthorizedAdminOrCron`) before it.
  AST-check (reuse the repo's existing action-AST tooling) — not a substring grep.
- Wire into `ci:gates` and the pre-commit hook. This is the "gates not prose"
  enforcement RC4/RC5 demand (CLAUDE.md; memory `feedback_gates_not_prose`).

---

## 3. Feature — the send/publish/sync consolidation

### 3.1 Direct lib calls replace internal HTTP self-fetch fan-out

**Purpose:** `snapshot-channels` and `publisher-sweep` each fan out by
`fetch()`-ing their own domain (`api-surface.md §3.3, §3.4`) — 9 extra edge
round-trips per snapshot run, a re-auth handshake per hop, a fresh serverless
cold-start per hop, and a failure mode where a self-fetch 500 is invisible to the
parent. §4.6 mandates direct lib calls.

**Rebuild:**

- `lib/marketing-brain/snapshot.ts` already holds the per-platform snapshot logic.
  Export `snapshotPlatform(platform)` and `snapshotAllChannels()`; `snapshot-channels`
  calls `snapshotAllChannels()` in-process (parallel `Promise.allSettled`, per-platform
  error captured), no self-fetch. The 9 routes become thin optional wrappers (manual
  re-pull) or are deleted (§5).
- Extract social publish into `lib/social/publish.ts` `publishPost({platform, payload})`
  (from the 782-line `/api/social/publish` route). `publisher-sweep` calls
  `publishPost` directly per queued post; `/api/social/publish` becomes a thin
  authenticated wrapper for any external caller.

**Behavior parity:** each extracted lib returns a typed per-platform result
`{ platform, ok, id?, error? }`; the caller aggregates. No behavior change other than
removing the network hop.

### 3.2 One weekly-cycle, one CMA-delivery, one parametric map route

- **Weekly-cycle:** delete `/api/cron/weekly-cycle` (alias). `marketing-weekly-cycle`
  stays as the one scheduled entry over `runWeeklyCycle`.
- **CMA delivery:** all send surfaces (routes `email`, `gmail-draft`,
  `cma-drafts/[id]/send`, `cma-delivery` worker; actions `sendCmaToLeadAction`,
  `contact-cma`) call the **kept** `lib/cma/send.ts` `sendCmaToLead(slug, override?)`
  (verified `:293`), which internally uses the governed email chokepoint (§3.4). Delete
  `lib/cma-deliver.ts` (doc-comment-only reference) and `/api/cma/[slug]/finalize-deliver`.
  The async build stays on the `cma-build-worker` cron (kept, scheduled `14,44 * * * *`).

### 3.3 One parametric CMA-map route

**Rebuild:** `/api/maps/cma/[slug]/route.ts` reads the CMA record by `slug`, resolves
its subject + comps + center, and returns the static-map image/JSON. Migration:

1. Ship `/api/maps/cma/[slug]`.
2. Repoint the 4 live `public/cmas/*` embeds from `/api/maps/cma-<n>-<name>` to
   `/api/maps/cma/<slug>`.
3. Delete the 5 hardcoded route dirs (`cma-18705-*`, `cma-19496-*`, `cma-3735-*`,
   `cma-228-*`, `cma-21042-*`). `cma-21042-robin` is draft-only and deletes immediately.

Guard: public read (the maps are embedded in publicly-shared CMA HTML), rate-limited
via middleware (add `/api/maps/*` to the rate-limit matcher — see §12).

### 3.4 The governed send chokepoint — one `sendEmail`, one `sendSms` (the big one)

**Purpose & the job it serves.** C4 + C5: every message costs money, sits under TCPA,
and every number in it is a compliance artifact. The audit's headline hole
(`api-surface.md §3.7`): the CRM composers are gate-enforced but **alert emails bypass
the suppression + timeline path** — `seller-lead-alert`, `expired-alert`,
`fsbo-alert`, `market-stat-alert`, `deploy-health-alert`, the broker digests, and
`admin-email.sendAdminEmail` all call `lib/resend.sendEmail` (verified: 30+ importers)
directly, so a suppressed/hard-stopped contact can be emailed by an alert path even
though the CRM UI would refuse. There is no single choke point.

**What we keep / rebuild / delete.**

- **KEEP** the transport libs unchanged: `lib/resend.ts` `sendEmail`
  (From-resolution + DKIM-safe sender, verified), `lib/crm/gmail.ts` `sendCrmEmail`
  (Gmail-DWD), `lib/crm/twilio.ts` `sendSms`/`sendSmsViaMessagingService` (A2P
  fail-closed gate + `StatusCallback` wiring, verified). These are the raw wires.
- **KEEP** the suppression chokepoint `lib/crm/suppressions.ts` `isSuppressed(personId,
  channel)` and `isSuppressedByEmail(email, channel)` — both **fail-closed** on any
  read error (verified `:37-45`, `:107-113`), both enforce `TAG_CHANNEL`
  (compliance:hard-stop → all; contact:do-not-call → call+sms per the 2026-06-16
  incident fix). **Do not rewrite these.**
- **KEEP** the quiet-hours gate `lib/crm/quiet-hours.ts` `inSmsQuietHours(date, tz)`
  (TCPA: no SMS before 8am / at-or-after 9pm local, verified).
- **REBUILD** the *entry surface*: introduce `lib/comms/` with two governed
  primitives that every path calls. Everything above is composed **inside** them.

**New module `lib/comms/send.ts`:**

```ts
type Audience = 'contact' | 'internal' | 'transactional'
// contact       = a lead/consumer → full marketing + legal suppression, fail-closed
// internal       = a broker/ops recipient (alerts, digests, deploy-health) → NO consent
//                  suppression (they are staff), but still logged + From-resolved
// transactional  = a transaction party mid-signing/receipt → exempt from MARKETING
//                  suppression, but STILL honors compliance:hard-stop (legal)  [Q6]

export async function sendGovernedEmail(p: {
  audience: Audience
  to: string                      // resolved recipient
  personId?: number               // when known (contact/transactional)
  subject: string
  html?: string; text?: string; react?: ReactElement
  from?: string; replyTo?: string
  attachments?: { filename: string; content: Buffer }[]
  headers?: Record<string, string>
  transport?: 'auto' | 'gmail' | 'resend'   // auto: gmail-DWD for CRM person threads, resend otherwise
  idempotencyKey?: string         // required for contact/transactional; optional for internal
  logContext: { kind: string; source: string; templateKey?: string; broker?: string }
}): Promise<{ ok: true; id: string } | { ok: false; error: string; suppressed?: boolean }>

export async function sendGovernedSms(p: {
  audience: Audience
  to: string
  personId?: number
  body: string
  mediaUrls?: string[]
  fromBroker?: CrmBrokerSlug      // pins the broker line via the A2P messaging service
  idempotencyKey?: string
  logContext: { kind: string; source: string; templateKey?: string; broker?: string }
}): Promise<{ ok: true; sid: string } | { ok: false; error: string; suppressed?: boolean }>
```

**The pipeline inside each primitive (order is load-bearing, every gate fail-closed):**

1. **Auth is the caller's job** — the chokepoint is a lib, not an endpoint; it assumes
   an already-authorized caller (the action/route/cron guarded per §2). It does not
   re-auth, but it DOES refuse an unresolved/empty recipient.
2. **Idempotency claim (contact/transactional):** call Spec 02's
   `claimOutboundMessage({ idempotencyKey, personId, channel })`. If the key was
   already claimed, **return the original result — no provider call** (this is what
   makes a double-tap a no-op, §4.2 / RC2 / C5). During the migration window this
   claims a `crm_timeline` row keyed by `dedupe_key = idempotencyKey` (unique index,
   verified `:2119`); a 23505 conflict → return the prior row's result.
3. **Suppression gate:**
   - `audience:'contact'` → `isSuppressed(personId, channel)` (or `isSuppressedByEmail`
     when no `personId`). Suppressed → return `{ ok:false, suppressed:true, error:<reasons> }`,
     **no provider call**, log a `suppressed` timeline entry so the block is visible.
   - `audience:'transactional'` → check **only** `compliance:hard-stop` (legal), not
     marketing opt-outs. [Q6 confirms this policy.]
   - `audience:'internal'` → skip consent suppression entirely (staff recipient).
4. **Quiet-hours gate (SMS only, contact/transactional):** `inSmsQuietHours(now, tz)`
   → if quiet, **defer** to `crm_scheduled_sends` (kept table, verified) for the next
   allowed window rather than sending; return `{ ok:true, deferred:true }`-shaped.
   (Internal SMS alerts are exempt — a deploy-health text to Matt is not TCPA-bound.)
5. **A2P gate (SMS):** already enforced fail-closed inside `sendSms` (blocks unless
   VERIFIED, verified `:227`). The chokepoint surfaces its error verbatim.
6. **Transport send:** email → `transport` resolves gmail-DWD (`sendCrmEmail`) vs
   Resend (`sendEmail`); SMS → `sendSmsViaMessagingService` pinning `fromBroker`.
7. **Finalize + log:** on success, call Spec 02's `finalizeOutboundMessage({
   claimId, providerSid|providerId, deliveryState:'sent' })` — one typed row, provider
   SID always present so the delivery webhook can match it (kills the SID-key
   fragmentation, RC1). On failure, mark the claim failed with the error so a Retry
   affordance (Spec 02/03) can re-drive it.

**Migration of the 30+ callers (ledger §1.2 #7):**

- **Contact-facing** (`contact-cma`, `contact-listing-matches`, `lead-landing`,
  `saved-search-alerts`, `newsletter/send-queue`, `market-report-send`, `cma/send`,
  `bpo/send`, `home-valuation/actions`, `contact/actions`) → `sendGovernedEmail({
  audience:'contact' })`. These gain suppression they may lack today.
- **Internal alerts** (`seller-lead-alert`, `expired-alert`, `fsbo-alert`,
  `market-stat-alert`, `deploy-health-alert`, `broker-alerts`, `daily-broker-digest`,
  `weekly-pipeline-digest`, `marketing/daily-digest`, `marketing-optimization-report`)
  → `sendGovernedEmail({ audience:'internal' })`. They gain unified From-resolution +
  logging; they do not gain consent suppression (correct — they go to staff).
- **Transactional** (`tc/signing-emails`) → `audience:'transactional'`.
- **`admin-email.sendAdminEmail`** → guard first (§2.3) then
  `sendGovernedEmail({ audience:'internal' })`; it is an operator tool, never a
  contact path.
- **CRM composer sends** (`app/actions/crm.ts` `sendCrmSmsAction`, the email action) →
  refactor to call the chokepoint so the composer and the alerts share **one** gate
  path. Behavior must stay byte-identical (proven by the kept
  `suppression-case.int.test.ts` + `crm-suppressions.action.test.ts`).

**Data-accuracy (C4) note:** any alert/digest that renders a market/lead number
(`market-stat-alert`, the digests) must trace that number to its DAL definition
(Spec 06). The chokepoint does not compute numbers; it refuses to invent an error
string that implies success (honest error contract, §10).

### 3.5 Sync HTTP de-sprawl

Keep the wired interactive admin sync routes + the 3 scheduled sync crons; delete the
3 dead wrappers (§1.3 #4,5,11); reconcile `sync-parity` / `sync-verify-full-history` /
`start-sync` (§1.5). No change to `app/actions/sync-spark.ts` / `sync-full-cron.ts`
(the live logic) — only the redundant HTTP skin is trimmed.

---

## 4. Data model

Everything is **additive + back-compatible** (§4.1 discipline). No column dropped, no
table renamed in this spec.

### 4.1 Tables touched (existing — verified in `DATABASE_SCHEMA_SNAPSHOT.md`)

| Table | Columns used | Role in this spec |
|---|---|---|
| `crm_timeline` (`:2105`) | `dedupe_key` (unique), `payload`, `kind`, `source`, `broker` | Idempotency claim + outbound-message log during the migration window (until `message` lands, Spec 02). |
| `crm_suppressions` (`:2030`) | `person_id`, `channel`, `reason`, `value` | Read by the chokepoint's suppression gate. Unchanged. |
| `crm_scheduled_sends` (`:1929`) | `kind`, `selection`, `params`, `scheduled_at`, `status` | Quiet-hours deferral target for SMS. Unchanged. |
| `crm_cron_leases` (`:1608`) | `name`, `locked_until` | Overlap-lease store (verified migration `20260704120300`). Adopted by every high-freq cron (§5.2). |
| `email_campaigns` (`:2138`) | insert on send | Kept; written via the chokepoint's log step for campaign-class sends. |

### 4.2 New migration — `comms_send_log` (optional idempotency for internal sends)

Contact/transactional idempotency rides on Spec 02's `message` claim (or the
`crm_timeline.dedupe_key` bridge). **Internal** alerts have no person/conversation, so
they get a tiny dedicated ledger for (a) optional idempotency and (b) observability
(the audit's "alerts bypass logging" complaint):

```sql
-- Additive. Internal/ops send observability + optional idempotency.
create table if not exists public.comms_send_log (
  id              bigint generated always as identity primary key,
  channel         text not null check (channel in ('email','sms')),
  audience        text not null,               -- 'internal' | 'transactional' | 'contact'
  to_value        text not null,               -- email or E.164 (never a raw secret)
  kind            text not null,               -- logContext.kind
  source          text not null,               -- logContext.source
  broker          text,
  provider_id     text,                         -- resend id / twilio sid
  status          text not null default 'sent',-- 'sent' | 'failed' | 'suppressed' | 'deferred'
  error           text,
  idempotency_key text,
  created_at      timestamptz not null default now()
);
create unique index if not exists comms_send_log_idem_uq
  on public.comms_send_log (idempotency_key) where idempotency_key is not null;
create index if not exists comms_send_log_created_idx on public.comms_send_log (created_at desc);
```

Refresh the schema snapshot + DAL index after applying (`npm run ci:data-access --
--refresh`, per CLAUDE.md data-access discipline). No RLS-consumer surface — service-
role only.

### 4.3 Source of truth

- Consent/suppression: `crm_suppressions` + `crm_people.tags` via
  `lib/crm/suppressions.ts` (the one chokepoint). No second copy.
- Outbound-message record of truth: Spec 02's `message` table (contact channels);
  `comms_send_log` (internal/ops). No message state invented in a `payload` blob.
- Cron overlap: `crm_cron_leases` (one row per named cron).

---

## 5. Cron hardening

### 5.1 Reconcile to `vercel.json`

Apply ledger §1.5: delete `weekly-cycle`; schedule `detect-expired-listings` + fix the
CLAUDE.md doc; schedule the digests + the verifiers + the two refresh crons per the
defaults; decide `google-ads` snapshot + `marketing-inbox-poll` (Matt, Q1/Q4); fold
the 9 snapshot routes into the direct fan-out (§3.1). After the pass, **add a
`ci:cron-parity` gate**: every cron route dir must be either (a) in `vercel.json`, (b)
in an explicit `self-fetched` / `manual-only` allowlist, or the build fails — so a new
orphan cron can never silently exist again.

### 5.2 Overlap leases everywhere high-frequency

`crm_try_cron_lease(p_name, p_lease_seconds)` / `crm_release_cron_lease(p_name)` exist
and are correct (verified migration `20260704120300`: insert-or-renew-if-expired,
self-expiring so a crash can't wedge). Only 3 crons use it today
(`crm-sequence-engine`, `crm-gmail-sync`, `crm-auto-enroll`, verified). Adopt on every
cron whose run can exceed its interval — **required** on the `*/2` and `*/5` crons
(`newsletter-send` `*/2`, `crm-bulk-worker` `*/2`, `crm-scheduled-sends` `*/5`,
`visitor-hot-lead-escalation` `*/15`, `publisher-sweep` `*/30`) that today have no
lease (`api-surface.md §6` — a slow run overlaps + double-processes). Ship a one-liner
helper so adoption is trivial:

```ts
// lib/cron/lease.ts
export async function withCronLease<T>(name: string, seconds: number, run: () => Promise<T>):
  Promise<T | { skipped: 'lease-held' }> {
  const sb = createServiceClient()
  const { data: got } = await sb.rpc('crm_try_cron_lease', { p_name: name, p_lease_seconds: seconds })
  if (got === false) return { skipped: 'lease-held' }
  try { return await run() } finally { await sb.rpc('crm_release_cron_lease', { p_name: name }) }
}
```

`p_lease_seconds` = the route's `maxDuration` (so a crash self-expires the lease).

### 5.3 Standardize the cron guard

One `isAuthorizedCron(req)` in `lib/auth/cron-auth.ts`, fail-closed in all
environments (delete the `return !isProd` fail-open copies, §2.2). Every scheduled
cron's first line: `if (!isAuthorizedCron(req)) return new Response('Forbidden', {
status: 403 })`. A `ci:cron-auth` assertion (fold into `ci:admin-authz`) fails the
build if a `app/api/cron/**/route.ts` doesn't call it.

---

## 6. The server-side idempotency + "return the entity" contract (§4.2, server half)

RC2: mutations universally signal completion via `router.refresh()`, re-running the
whole page fan-out, and sends have no idempotency key so a second tap is a second
delivered message. The client half (`useOptimistic`) is Spec 01's; the **server
contract** is owned here and applies to *every* mutating action:

1. **Accept + persist `idempotency_key`.** Sends require it (contact/transactional);
   other mutations accept it. A duplicate key is a **no-op that returns the original
   result** (the claim in §3.4 step 2; the same at-most-once pattern the
   sequence-engine already uses for send claims).
2. **Return the changed entity, not a page revalidate.** An action returns the new
   message / updated tag / created deliverable row; the client patches local state
   from the return value. Actions **must not** `revalidatePath('/admin/...')` the whole
   page on a hot mutation (that is the universal `router.refresh()` tax, §4.2).
   Cache-tag invalidation (`revalidateTag`) for cached *aggregate* reads is fine and
   expected (§12).
3. **Typed result envelope.** Every action returns
   `{ ok: true, entity } | { ok: false, code, error }` — never throws to the client,
   never returns a bare `void` that forces a refetch. `code` is machine-readable
   (`forbidden`, `suppressed`, `quiet_hours`, `over_limit`, `duplicate`, `provider_error`).

---

## 7. Operator / developer flows

This spec has no end-user screen; its "flows" are the ci gate, the deploy, and the
cron tick.

### 7.1 Adding a new admin action (happy path)

1. Write the action; first line `const ctx = await requireAdmin('some:capability')`.
2. `npm run ci:gates` → `ci:admin-authz` confirms the guard is present (AST). **Tap
   budget: zero manual review** — the gate is the reviewer.
3. If the action sends, it calls `sendGovernedEmail`/`sendGovernedSms` (a `sendEmail`/
   `sendSms` import outside `lib/comms` / the transport libs fails a new
   `ci:send-chokepoint` lint, §13).
4. Commit → pre-commit hook re-runs the gates → push.

### 7.2 Adding / changing a cron (happy path)

1. Create `app/api/cron/<name>/route.ts`; first line `isAuthorizedCron`; wrap the body
   in `withCronLease('<name>', maxDuration, …)`.
2. Add the schedule to `vercel.json` (or the `manual-only` allowlist).
3. `ci:cron-parity` + `ci:admin-authz` pass → commit → push.

### 7.3 A send at runtime (the money path, C5)

1. Caller (action/cron) resolves recipient + generates/receives `idempotencyKey`.
2. `sendGoverned*` claims the key → suppressed/quiet/A2P gates → transport → finalize +
   log. Returns typed result.
3. Duplicate call with the same key returns the original result, **zero** second
   provider call. This is the structural guarantee behind "it can't double-send."

---

## 8. States (every mutation / send)

| State | Behavior |
|---|---|
| **empty** | No recipient / empty body → `{ ok:false, code:'invalid' }`, no provider call, no log-as-sent. |
| **loading (streamed)** | N/A for the lib; the *calling* surface renders optimistic pending (Spec 01/02). Cron runs stream nothing (server-only). |
| **pending / optimistic** | The claim row is written `pending`/`sending` before the provider call; the client shows the optimistic bubble (Spec 02). |
| **success** | Provider returns id/sid → finalize `sent`, return `{ ok:true, id\|sid }`. Delivery state advances later via the Twilio/Resend webhook onto the same claim row (provider SID matches). |
| **partial** | Group send / multi-recipient / snapshot fan-out: `Promise.allSettled` → per-target `{ ok, error? }`; overall result reports `{ ok:true, partial:true, failures:[…] }`. No all-or-nothing rollback of already-sent recipients. |
| **error (provider)** | Twilio/Resend failure → claim marked `failed`, `{ ok:false, code:'provider_error', error }`. The calling surface shows Retry (re-drives with the **same** idempotency key → no dup). |
| **offline** | Client-side concern (Spec 01 queues the optimistic action). Server: an idempotency key means a replayed offline action is deduped on arrival. |
| **permission-denied** | Guard refuses → `{ ok:false, code:'forbidden' }` (action) / `403` (route). Never reaches the provider or the log-as-sent path. |
| **over-limit** | Rate-limited routes (paid-API proxies, PDF, CMA, maps) → `429`. Bulk sends respect the kept bulk-job preflight/estimate caps. Twilio A2P throughput queue handles carrier limits. |
| **suppressed** | Contact suppressed → `{ ok:false, code:'suppressed', suppressed:true }`, a `suppressed` log row (visible), no provider call. **Fail-closed** on any suppression-read error. |
| **quiet-hours** | Contact SMS in quiet window → deferred to `crm_scheduled_sends`, `{ ok:true, code:'deferred' }`. Internal SMS exempt. |
| **lease-held (cron)** | A concurrent run holds the lease → `{ skipped:'lease-held' }`, exits cleanly, no double-process. |

---

## 9. Edge cases (exhaustive, specific to real data)

1. **Duplicate submit / double-tap SMS (the owner's #1 pain).** Same `idempotencyKey`
   → the claim conflicts (23505 / already-claimed) → return the original result, **no
   second Twilio call, no second charge, no second delivered text.** This is the
   structural C5 fix.
2. **Group text with a raw number that later resolves to a contact.** The chokepoint
   sends per-participant; a raw-phone participant has no `personId`, so it is
   suppression-checked by number-derived person lookup (`lookupPersonByPhone`,
   verified) — if that later resolves to a contact carrying `contact:do-not-text`, the
   *next* send to that number is suppressed. The already-sent message is logged against
   the raw number and back-linked when the contact resolves (Spec 02's participant
   model). No silent participant drop (RC1).
3. **Lead with no phone / no email.** SMS to no-phone → `{ ok:false, code:'invalid' }`.
   Email to no-email → `isSuppressedByEmail('') → suppressed:true, reason:'no-email'`
   (fail-closed, verified `:89-92`). Neither hits the provider.
4. **Suppression table unreadable mid-send.** `isSuppressed` returns
   `{ suppressed:true, reason:'suppression-check-failed' }` (verified `:37-45`) → the
   send is blocked, not attempted. A DB blip fails **closed**, never open.
5. **`crm_people.tags` read fails.** Same fail-closed branch (verified `:41-45`) — the
   compliance tags (`compliance:hard-stop`, `contact:do-not-*`) are invisible on error,
   so the code must (and does) block rather than assume clean.
6. **Merge-token with no value in an alert/CMA email.** The kept CMA/BPO send libs
   already fail-closed refuse a merge-token with no value (architecture §3 kept-core).
   An alert template with an unresolved `{{…}}` must not send a literal `{{name}}` — the
   chokepoint rejects a body containing an unresolved merge token
   (`code:'merge_token_empty'`), same posture.
7. **A2P status is null (transient Twilio 5xx).** `a2pBlocked(null) === true` (verified
   `:227`) → SMS blocked with the 30034 guidance string. A transient upstream error
   never lets an unregistered-campaign text through.
8. **Quiet-hours boundary in the recipient's timezone.** `inSmsQuietHours` uses the
   *recipient's* local tz (verified test covers ET vs PT divergence). A 9:30pm-ET lead
   who is 6:30pm-PT is **not** quiet (send proceeds); a real 9:15pm-local is deferred.
9. **Expired session mid-send.** The action's first-line guard already ran on invoke;
   if the session expired between page-load and submit, the guard refuses at submit →
   `{ ok:false, code:'forbidden' }`; the client (Spec 01) routes to re-auth preserving
   `next` and the optimistic bubble is marked failed-retryable (idempotency key
   survives → the retry after re-auth doesn't dup).
10. **Concurrent broker edits of the same blog post / listing.** `saveBlogPost` is an
    `upsert`; last-write-wins on the row. For the rebuild, pass an optimistic-concurrency
    token (`updated_at`) and refuse a stale write (`code:'stale'`) so a broker doesn't
    silently clobber another's edit. (Listing-editor-vs-MLS-sync is Spec 08's domain;
    here we only guarantee the action refuses a stale overwrite.)
11. **MLS sync overwriting an admin edit.** Cross-spec (Spec 08). This spec's guarantee:
    the sync crons take a lease (§5.2) so two sync runs don't race, and the edit path
    returns the entity so the UI reflects the true post-write state (not a stale
    refresh).
12. **Timeout on a 30–60s CMA/BPO build.** The synchronous build path is **removed** —
    the build runs on the `cma-build-worker` cron; the send action enqueues + returns
    immediately (`code:'building'`), and the governed email fires when the build lands.
    No 30–60s action that times out mid-request (send-center pain).
13. **Cron run exceeds its interval.** `withCronLease` → the next tick gets
    `{ skipped:'lease-held' }` and exits; the lease self-expires after `maxDuration` so
    a crashed run can't wedge the cron forever (verified lease semantics).
14. **A metric/alert with no live writer.** `market-stat-alert` / a digest that reads a
    dropped table (e.g. `broker_stats`, RC6) must **not** render `$0` as fact — the
    chokepoint refuses to send an alert whose numbers trace to a dead source (the
    number comes from Spec 06's metric layer, which returns `unavailable`, and the
    alert omits the line rather than sending `$0`). C4.
15. **Self-fetch fan-out partial failure (pre-fix behavior).** Today a
    `snapshot-channels` self-fetch 500 is invisible to the parent; post-fix the direct
    `Promise.allSettled` captures each platform's error and the run reports
    `{ partial:true, failures:[…] }` — the failure is observable.
16. **`meta/oauth-callback` replay.** The route is deleted (§1.3 #20) and
    `META_OAUTH_STATE` rotated; a replayed callback 404s instead of minting a token off
    a stale shared string.
17. **Unauthenticated direct POST to a hardened action.** A crafted POST to
    `saveBlogPost` without a session → the first-line `requireAdmin('content:write')`
    refuses (`403`-shaped) before any `blog_posts` write. The `ci:admin-authz` gate
    guarantees the guard is present (defense in depth beyond Next's action-ID).
18. **Rate-limit exhaustion on a paid-API proxy.** `/api/admin/stock/*` (unlimited
    today, `api-surface.md §6`) gets added to the middleware rate-limit matcher →
    `429` on abuse, protecting the paid Unsplash/Pexels/Shutterstock quota.
19. **`ci:cron-parity` false positive on a legit self-fetched/manual cron.** The
    allowlist names the 9 snapshot routes (if kept) + `start-sync` (manual) explicitly,
    so a legitimately-unscheduled route passes; only an *un-allowlisted* orphan fails.
20. **Duplicate email event webhook redelivery.** Already handled by the kept
    `buildDedupeKey` idempotency in `lib/crm/email-events.ts` (verified tests) — a Resend
    open/click redelivery is deduped on `messageId+event+recipient`. Unchanged.

---

## 10. Error handling & compliance

- **Honest error contract (the recurring failure class, `api-surface.md §6`).** The
  `/api/cma` "form shows fake green success while the lead was silently 404-lost"
  bug (`cma/route.ts:6`) is the archetype. Rule for every capture/send path: a backend
  failure returns a non-2xx / `{ ok:false }` the surface renders as failure. **No path
  returns success on a dropped write.** The governed chokepoint never logs `sent`
  unless the provider returned an id/sid.
- **Suppression fail-closed** (§9.4, §9.5) — a compliance-table read error blocks the
  send. Non-negotiable (C4/C5).
- **Quiet hours fail-closed** — a tz-resolution failure defers rather than sends.
- **A2P fail-closed** — null/unknown status blocks (verified).
- **Auth fail-closed** — unset `CRON_SECRET` → `isValidCronAuth` returns false
  (verified); the fail-open `!isProd` copies are deleted (§2.2).
- **Merge-token fail-closed** — an unresolved token refuses the send (§9.6).
- **Data-accuracy (C4)** — any number in an alert/digest/CMA traces to its Spec 06 DAL
  definition; `unavailable` is omitted, never rendered as `$0`.

---

## 11. Responsive behavior

This spec ships no UI, so there is no responsive tree. Its contribution to §4.3 (one
responsive tree) is negative-space: by making **actions return the changed entity**
instead of `router.refresh()` (§6), it removes the full-page re-render that made the
forked mobile/desktop trees each pay a double server render on every tap. The single
responsive surfaces (Specs 01–04) *consume* these primitives; the primitives are
device-agnostic and add nothing to either bundle.

---

## 12. Performance

- **No full-page refresh on mutation** (§6) — the single biggest admin-wide latency
  win beyond killing the double tree. Every hot action returns its entity; only cached
  aggregate reads are invalidated by tag.
- **Direct lib calls, not HTTP self-fetch** (§3.1) — removes 9 edge round-trips +
  9 cold starts per snapshot run and the publisher self-fetch per post.
- **Cron leases** (§5.2) — a slow run no longer stacks a second concurrent run doing
  the same work.
- **Rate limits extended** to `/api/admin/stock/*` and `/api/maps/*` (middleware is
  rate-limit-only, no auth — `api-surface.md §6`); paid-API + map-render quotas
  protected.
- **CMA/BPO build off the request path** (§9.12) — the 30–60s synchronous action is
  gone; build on the worker cron.
- **The chokepoint adds one indexed claim insert + one suppression read** per send —
  both are single-row/`in`-list lookups on indexed columns; negligible next to the
  provider round-trip it guards.

---

## 13. Mechanical gates (the enforcement — "gates not prose")

| Gate | Fails the build when | Wires into |
|---|---|---|
| `ci:admin-authz` (widen `check-admin-endpoint-auth.mjs`) | an `app/api/admin/**` or interactive route, or a mutating/sending `app/actions/**` function, lacks a first-line guard; a cron route lacks `isAuthorizedCron` | `ci:gates` + pre-commit |
| `ci:cron-parity` (new) | a `app/api/cron/**` dir is neither in `vercel.json` nor the `self-fetched`/`manual-only` allowlist | `ci:gates` |
| `ci:send-chokepoint` (new lint) | a `sendEmail`/`sendSms`/`sendCrmEmail`/`sendSmsViaMessagingService` is imported outside `lib/comms/`, the transport libs, or the kept CMA/BPO send libs | `ci:gates` |
| `ci:no-self-fetch` (new lint) | a route/cron under `app/api/**` `fetch()`es its own origin (`/api/…`) | `ci:gates` |
| `ci:data-access --refresh` | the schema snapshot / DAL index drifts after the `comms_send_log` migration | local + nightly |

Adopt the "meta-gate" pattern (`ci:gates-wired`) so these new gates can't silently run
nowhere (the 2026-06-20 audit found 28 gate files that ran nowhere).

---

## 14. Acceptance criteria (writer → store → reader → outcome, §8)

Each is an end-to-end proof, not a render check.

**Auth (§2):**
- [ ] A direct unauthenticated POST to `saveBlogPost` / `sendAdminEmail` / every
      hardened admin-CMS action returns `403`/`{forbidden}` and performs **no** DB
      write (proven: seed row absent after the call). *writer(attacker)→guard→store
      unchanged.*
- [ ] `ci:admin-authz` fails on a deliberately-unguarded fixture action and passes on a
      guarded one. *gate proves the class, not one instance.*
- [ ] Every scheduled cron 403s a request with a wrong/absent `CRON_SECRET` in
      production env; `isValidCronAuth('', undefined) === false` (kept unit test).

**Send chokepoint (§3.4):**
- [ ] An **alert** email (`seller-lead-alert`) to a contact carrying `unsubscribed`
      is **not** delivered — the chokepoint returns `suppressed:true`, a `suppressed`
      log row exists, Resend received **zero** calls. *writer(alert)→suppression
      gate→no provider→visible block* (the exact gap `api-surface.md §3.7` names).
- [ ] Two `sendGovernedSms` calls with the same `idempotencyKey` produce **one**
      Twilio message and one timeline/message row; the second returns the first's sid.
      *double-tap→one delivered text→one charge* (C5 / RC2).
- [ ] A contact SMS at 9:15pm-recipient-local is deferred to `crm_scheduled_sends` and
      fires in the next allowed window; a broker (`internal`) SMS at the same clock
      sends immediately.
- [ ] A CRM composer send and an alert send to the same suppressed contact both refuse,
      proving one shared gate path (the kept suppression int-tests still pass).

**Consolidation (§3.1–3.3):**
- [ ] `snapshot-channels` runs with **zero** self-`fetch` to `/api/cron/marketing-
      snapshot-*` (network trace clean) and writes the same per-platform snapshot rows
      as before. *direct lib call→same store→same reader.*
- [ ] `publisher-sweep` publishes via `lib/social/publish.publishPost` with no
      self-fetch; a queued post reaches the platform and the row flips to `executed`.
- [ ] The 4 live CMA embeds render maps from `/api/maps/cma/[slug]`; the 5 hardcoded
      routes are gone and no embed 404s.

**Delete pass (§1.3, §1.4):**
- [ ] The 24 routes + 7 action files are removed; `next build` + `ci:gates` green; a
      repo-wide grep finds **no** importer of any deleted symbol. *no regression from
      deletion.*
- [ ] `/api/ai/generate-text` returns 404 (deleted); no unauthenticated LLM-cost
      endpoint remains.

**Cron reconciliation (§5):**
- [ ] `ci:cron-parity` passes: every cron dir is scheduled or allowlisted;
      `detect-expired-listings` is scheduled and the CLAUDE.md cadence matches
      `vercel.json`. *doc = reality.*
- [ ] `crm-bulk-worker` / `newsletter-send` / `crm-scheduled-sends` skip cleanly under
      an induced overlap (a held lease) — no double-processed row (assert a
      single-send count under a forced concurrent tick).

**Contract (§6):**
- [ ] A hot CRM mutation (tag add, send) returns the changed entity and triggers **no**
      `revalidatePath` of the page (assert the action's return + that the page RSC
      payload isn't refetched). *no full re-render tax.*

---

## 15. Open questions for Matt

- **Q1 — Google Ads snapshot.** Is Google Ads a live channel? If yes, add
  `marketing-snapshot-google-ads` to the `snapshot-channels` fan-out; if no, delete the
  route. (Default: add.)
- **Q2 — Refresh crons.** Schedule `refresh-video-tours-cache`,
  `refresh-listing-year-stats`, and `neighborhood-default-subscriptions`, or delete
  them? (Default: schedule all three; they feed data-accuracy/funnel surfaces.)
- **Q3 — Broker digests.** Keep + schedule `daily-broker-digest` +
  `weekly-pipeline-digest`? They feed the loop's notify edge (C2). (Default: schedule.)
- **Q4 — Social DM capture.** Schedule `marketing-inbox-poll` to pull social DMs into
  FUB/CRM as leads? Depends on which platform tokens you want connected. (Default:
  schedule only for connected platforms.)
- **Q5 — Expired-listing cadence.** `detect-expired-listings`: hourly (matches the old
  CLAUDE.md claim) or daily (matches `detect-fsbo-listings`)? (Default: daily `40 9`.)
- **Q6 — Transactional suppression policy.** Should a `compliance:hard-stop` (legal
  do-not-contact) also block a **transactional** signing/receipt email to a party
  actively in a signing flow? Legally hard-stop usually means all contact, but a party
  mid-transaction is a gray area. (Default: hard-stop blocks even transactional; only
  *marketing* opt-outs are exempt for `transactional`.)
- **Q7 — Marketing-brain execution crons.** Confirm `strategy-revision-check` +
  `optimization-loop` can be deleted given the G45 producer-freeze (execution layer is
  maintenance-only and published zero content). (Default: delete.)

---

## 16. Cross-spec dependencies

- **Spec 01 (Foundation)** — authors the capability map + nav generation this spec's
  `requireAdmin(capability)` consumes; authors the client optimistic primitive whose
  server half (§6) lives here. Seam: the capability constants + the "return the entity"
  client patch.
- **Spec 02 (Inbox / conversations)** — owns the `conversation`/`message` model +
  `claimOutboundMessage`/`finalizeOutboundMessage`/`logOutboundMessage`. The send
  chokepoint (§3.4) delegates persistence + the idempotency claim to it; during
  migration it bridges to `crm_timeline.dedupe_key`. Seam: the message-claim API.
- **Spec 03 (Person workspace / unified send)** — the CMA/BPO/newsletter/saved-search
  send surfaces call the kept send libs (`lib/cma/send`, `lib/bpo/send`) which this
  spec routes through the governed email chokepoint. Seam: the deliverable send path +
  the async-build worker.
- **Spec 06 (Performance / metric layer)** — the crons this spec schedules write the
  metrics; the alerts/digests this spec routes through the chokepoint read numbers from
  the one metric definition (C4). Seam: `getLeadIntake` et al. + the "omit, never
  render $0" rule.
- **Spec 08 (Content / listings / media)** — owns the listing-editor-vs-MLS-sync
  conflict; this spec only guarantees sync crons take a lease and mutating content
  actions (blog/guides/media) are guarded + refuse stale writes. Seam: the sync lease +
  the `content:write` capability.

---

*This spec is the delete-pass + hardening backbone. Built first alongside Spec 01
(Foundation) and finished by the Delete pass in §7 of the architecture. Its gates
(`ci:admin-authz`, `ci:cron-parity`, `ci:send-chokepoint`, `ci:no-self-fetch`) are what
stop RC4/RC5 from regrowing after the rebuild ships.*
