# Audit — API + Server-Action Surface

Domain: every route under `app/api/**` and every server action under `app/actions/**`.
Method: enumerated all route files + action files; static-traced each `/api/...` path string
and each action import across `app/ components/ lib/ hooks/ scripts/ emails/ public/`; read
implementations for every guard classification and every dead/duplicate claim. Cron schedule
source = `vercel.json`. All line references verified by reading the file.

Working data (reproducible): `routes.txt`, `route-classified.json`, `actions.txt`,
`action-auth.txt` in this audit dir.

---

## 0. Headline counts

| Surface | Count |
|---|---|
| API route files (`route.ts`/`route.tsx`) | **186** |
| HTTP method handlers exported (GET/POST/…) | **199** |
| Server-action files (`app/actions/*.ts`) | **161** (159 `'use server'` + 2 data-only helpers) |
| Exported functions across actions | **664** |
| Cron entries scheduled in `vercel.json` | **49** |
| Cron *route dirs* that exist | **72** (23 not on any schedule — see §5) |

**Route classification (by who invokes it):**

| Class | Count | Notes |
|---|---|---|
| (c) Cron — scheduled or self-fetched | 59 | 49 in vercel.json + 9 snapshot fan-out + `/api/social/publish` (self-fetched by publisher-sweep) |
| (a) Admin/site UI or lib caller found | 52 | fetched from a component/page/hook, or wrapped by a lib the UI uses |
| (e) Script-only caller (ops/gate), no runtime caller | 28 | invoked by `scripts/*` maintenance tooling only |
| cross-API only | 3 | invoked by another route via internal fetch |
| (e) **No caller anywhere — dead / orphan** | **44** raw → **~24 genuinely dead** after subtracting external-entry endpoints (OAuth callbacks, webhooks, email pixels, CMA map embeds) that have no in-repo caller *by design* |

The matcher under-reports a handful of routes whose URL is immediately followed by a
`${...}` template expression with no delimiter (e.g. `/api/admin/crm/export${qs}`); those were
re-verified by hand and are noted where relevant. Every "dead" claim in §4 was re-verified with a
permissive grep.

---

## 1. The auth model — one canonical guard, many surviving variants

There **is** a canonical guard module — `lib/auth/guards.ts` (audit step 1.3, comment says it
replaced "~6 different inline authz patterns"). It exposes:

- `getAdminContext()` → verified Supabase session → email → `getAdminRoleForEmail` (guards.ts:26)
- `requireAdminOr403()` → returns `AdminContext | Response(403)` (guards.ts:42)
- `requireSuperuserOr403()` (guards.ts:49)
- `isAuthorizedAdminOrCron(req)` → admin session **OR** `CRON_SECRET` bearer (guards.ts:63)

Cron secret comparison is isolated + unit-tested in `lib/auth/cron-auth.ts` (`isValidCronAuth`,
returns false when the secret is unset — good).

**But the consolidation is incomplete.** The 199 handlers authenticate through at least **eight**
distinct mechanisms, and most routes never adopted the canonical guard:

| Guard mechanism | Where | Count (routes) |
|---|---|---|
| `isAuthorizedCron(req)` (`lib/marketing-brain/snapshot.ts:148`) — raw `Bearer CRON_SECRET` | 42 cron/marketing routes | 42 |
| Inline `isAuthorized()` copy of the same bearer check | `crm-sequence-engine/helpers.ts:23`, `refresh-video-tours-cache`, others | ≥3 |
| Bare `process.env.CRON_SECRET` string compare in-file | many `/api/cron/*`, `/api/social/publish*` (`x-cron-secret`) | ~15 |
| `getAdminRoleForEmail(email)` inline (any admin role) | stock search, sync/status, approval-queue, run-producer, offline-conversion | ~14 |
| `isSuperuserAdmin` | `/api/admin/sync`, `/api/admin/sync/delta` | 2 |
| `getCrmAccess()` + `isPersonInScope` (CRM-specific, ownership-scoped) | crm/attachment, crm/export, crm/mms, crm/recording | 4 |
| `requireAdminOr403` / `requireSuperuserOr403` / `isAuthorizedAdminOrCron` (the canonical guards) | crm-import, expired-listing-lookup, gbp/set-website-utm, cma/* | ~5 |
| Per-endpoint bespoke secret (`TC_FORMS_INGEST_SECRET`, `CMA_WORKER_AUTH_SECRET`, `REVALIDATE_SECRET`, `META_OAUTH_STATE`) | forms/ingest, cma-delivery, revalidate, meta/oauth-callback | 4 |
| Twilio signature (`validateTwilioSignature`, `lib/crm/twilio.ts:81`) | all 7 `/api/twilio/*` | 7 |
| Webhook/verify token (`x-hub-signature`, Resend signature) | meta/lead-webhook, webhooks/resend | 2 |

A dedicated gate exists but is scoped to **only two files** (`scripts/check-admin-endpoint-auth.mjs`
whitelists `gbp/set-website-utm` + `expired-listing-lookup`), so nothing forces the other ~30
admin/interactive routes onto the canonical guard. **There is no mechanical guarantee that a new
admin route is authenticated at all.**

### 1a. Server actions rely entirely on the layout gate — they carry no in-body auth

This is the single most important architectural fact of this domain. **Server actions are the
primary admin mutation surface** (664 exported functions vs. ~15 admin-mutating API routes), and
the overwhelming majority carry **no auth check inside the action body**. They are protected only
by `app/admin/(protected)/layout.tsx` (layout.tsx:31–38: `getSession` → redirect, then
`getAdminRoleForEmail` → redirect) which gates *page rendering*.

Next.js server actions compile to POST endpoints that are invocable independently of the page that
renders them; a layout `redirect()` does not run on a direct action POST. So the layout gate
protects the UI, not the action. Concretely, these service-role **mutators/senders have zero
in-action authorization** (`action-auth.txt`):

- `app/actions/blog.ts` — `saveBlogPost` (blog.ts:210, `.upsert`), `deleteBlogPost` (blog.ts:256,
  `.delete`) — service-role writes to `blog_posts`, no session/role check in the function.
- `app/actions/admin-email.ts` — `sendAdminEmail` (admin-email.ts:7) — sends arbitrary email via
  Resend to any address + inserts `email_campaigns`, no role check (only a suppression check).
- `app/actions/admin-setup.ts`, `admin-listings.ts`, `broker-generated-media.ts`, `guides.ts`,
  `hero-videos.ts`, `headshot-prompts.ts`, `subdivision-descriptions.ts`,
  `community-engagement.ts`, `generate-market-report.ts`, `partnership-revenue.ts`,
  `log-admin-action.ts`, `saved-listings.ts` — all service-role `.insert/.update/.delete` with no
  in-body guard.

Most *CRM* actions **do** guard correctly (`crm.ts` and its satellites call
`resolveCrmAccess`/`requireCrmAccess`/`requirePersonInScope`), and the newest actions do too. The
gap is the older admin-CMS actions. Whether this is exploitable depends on Next's action-ID
protection and Supabase RLS, but the pattern is inconsistent and undefended-in-depth. **For the
rebuild: every server action that mutates must call a guard as its first statement, enforced by a
gate — do not rely on the layout.**

---

## 2. Route inventory by area (purpose · data path · guard · caller · verdict)

Full machine-readable table in `route-classified.json`. Grouped highlights below.

### 2.1 `/api/admin/*` (30 routes) — the admin-utility surface

| Route | Method | Guard | Caller | Verdict |
|---|---|---|---|---|
| `admin/crm/export` | GET | `getCrmAccess` + `scopeBroker` | crm/page.tsx:203, ExportPeopleDialog | OK — scoped CSV export |
| `admin/crm/attachment` | GET | `getCrmAccess` + `isPersonInScope` | thread UI (2) | OK — ownership-scoped storage proxy |
| `admin/crm/mms/[messageSid]/[mediaSid]` | GET | `getCrmAccess` + scope | thread UI (2) | OK |
| `admin/crm/recording/[sid]` | GET | `getCrmAccess` + scope | call logs UI (6) | OK |
| `admin/crm-import` | POST | `requireSuperuserOr403` ✅canonical | import UI | OK |
| `admin/sync` | POST | `isSuperuserAdmin` | 7 UI + 1 xapi + 7 scripts | OK |
| `admin/sync/delta` | POST | `isSuperuserAdmin` | sync UI | OK |
| `admin/sync/{live,status,backfill-health,history-yield,yearly-breakdown,terminal-*}` | GET/POST | `getAdminRoleForEmail` | sync dashboards + scripts | OK |
| `admin/sync/photos` | POST | raw `CRON_SECRET` | **none** | **DEAD** |
| `admin/sync/history-active` | POST | raw `CRON_SECRET` | **none** | **DEAD** |
| `admin/stock/{unsplash,pexels,shutterstock}/search` | GET | `getAdminRoleForEmail` | media picker UI | OK — but **no rate limit** on paid-API proxies |
| `admin/sync-heavy` | GET | `getAdminRoleForEmail` | sync UI | OK |
| `admin/approval-queue/[id]/{action,comments}` | POST | `getAdminRoleForEmail` | ActionButtons/CommentsThread | OK |
| `admin/run-producer/[id]` | POST | `getAdminRoleForEmail` | ActionButtons.tsx:154 | OK |
| `admin/run-loop-cycle` | GET | `CRON_SECRET`+`getAdminRoleForEmail` | **none (no UI, not scheduled)** | **DEAD / curl-only** |
| `admin/offline-conversion` | POST | `getAdminRoleForEmail` | **none** (superseded by `lib/meta-offline-conversions.ts`) | **DEAD** |
| `admin/producer-change-requests` | POST | `getAdminRoleForEmail` | **none** (no UI) | **DEAD** |
| `admin/tracerfy-history` | GET | raw `CRON_SECRET` | **none** | **DEAD** |
| `admin/forms/ingest` | POST | `TC_FORMS_INGEST_SECRET` (constant-time) | external SkySlope browser | OK — cross-origin by design |
| `admin/gbp/set-website-utm` | GET | `isAuthorizedAdminOrCron` ✅ | script-only | ops tool |
| `admin/expired-listing-lookup` | POST | `isAuthorizedAdminOrCron` ✅ | script-only | ops tool |

### 2.2 `/api/cron/*` — the automation spine

49 are scheduled in `vercel.json`; every scheduled one authenticates with `Bearer CRON_SECRET`
(via `isAuthorizedCron` or an inline copy). Two scheduled crons authenticate with **no guard at
all in the token scan** but were verified to guard correctly:
- `crm-sequence-engine` — guards via `isAuthorized()` in `helpers.ts:23` (inline bearer copy). OK.
- `deploy-health`, `market-stat-consistency` — guard via `isAuthorizedCron`. OK.

Data path for the CRM/marketing crons is consistent: `createServiceClient()` (service role,
bypasses RLS) → Supabase → optional Twilio/Resend/Gmail/Graph send. `crm-sequence-engine`
(618 lines) uses an advisory lease (`crm_try_cron_lease`, route.ts:49) to prevent overlap — good
pattern; most others do not, so a slow run can overlap the next tick.

### 2.3 `/api/twilio/*` (7 routes) — inbound comms

All 7 validate the Twilio signature and 403 on mismatch (`voice`, `voice-complete`, `status`,
`recording`, `inbound-sms`, `outbound-bridge`, `conversations-events` — each has
`if (!verified.ok) return 403`). This is the **most consistently-guarded** route family. The token
scan flagged 6 as "NONE" because the check is `verified.ok` from a shared helper, not a literal
`X-Twilio-Signature` string — a scanner false-negative, corrected by reading each file. All OK.

### 2.4 OAuth connect/callback routes (linkedin, x, youtube, tiktok, threads, pinterest, nextdoor,
google-business-profile, meta) — ~18 routes

`authorize` builds the provider consent URL; `callback` exchanges the code and stores the token.
Guarded by the OAuth `state` param, not by our session. **No in-repo caller** (invoked by the
browser redirect) so the matcher marks them dead — they are **alive by design**, not dead. Note
`meta/oauth-callback` is explicitly a one-time bootstrap route whose own header says "delete this
route or rotate `META_OAUTH_STATE` after minting" (oauth-callback.ts:39) — that cleanup never
happened; it's a live token-minting endpoint gated only by a shared env string.

### 2.5 Public / lead-capture / tracking routes

- `/api/cma` (POST) — Tetherow LP lead capture → `submitTetherowLead`. Its own header documents a
  past silent-404 bug where "every submission returned 404 and the lead was silently lost while
  the form showed a fake green success" (cma/route.ts:6). Now returns 502 on failure. Public by
  design (no auth), rate-limited via middleware. OK but this is exactly the class of "form says
  success, backend dropped it" failure the rebuild must design against.
- `/api/meta-capi` (POST) — Meta CAPI relay, 11 UI callers + gate-checked. Public by design. OK.
- `/api/visitors/track` (POST, 469 lines) — visitor fingerprint/session tracker, no auth (public
  telemetry). 3 UI callers. OK by design but large/heavy for a hot public endpoint.
- `/api/web-vitals`, `/api/track/e/{click,open}` (email pixels, guarded by `verifyEmailToken`),
  `/api/og` (43 callers — OpenGraph image, healthy), `/api/calendar` (ICS for open houses,
  OpenHouseBanner.tsx:42). All OK by design.

### 2.6 PDF + CMA generation

- `/api/pdf/{cma,comparison,rental,report}` — POST, rate-limited (`checkRateLimit`), `pdf/cma`
  additionally requires `getSession`. Each has a UI caller. OK.
- `/api/pdf/listing` — POST, rate-limited, **no caller**. **DEAD** (the other pdf routes are wired;
  this one is orphaned).
- `/api/cma/[slug]` (GET) — public CMA JSON read, rate-limited. OK.
- `/api/cma/[slug]/{pdf,email,gmail-draft}` — `isAuthorizedAdminOrCron`. OK (script/lib callers).
- `/api/cma/[slug]/finalize-deliver` — `CRON_SECRET`+admin. **Only reference is a doc comment in
  `lib/cma-deliver.ts:21`; no code fetches it.** Effectively dead/curl-only.
- `/api/cma/[slug]/track` — email open/click pixel, no auth by design (external). Alive.
- `/api/maps/cma-{18705,19496,3735,228,21042}-*` — **five hardcoded per-CMA static map routes.**
  These are one-off endpoints baked for individual CMA HTML files in `public/cmas/*` and
  `public/drafts/*`. `cma-21042-robin` has no live embed (draft only). This is a copy-paste route
  family that should be one parametric route; see §4.

---

## 3. Duplicate-capability list (same job, multiple entry points)

1. **Social publishing — unified route vs. per-platform routes.**
   `/api/social/publish` (782 lines) reimplements Facebook + Instagram publishing internally
   (`publishToFacebook` route.ts:314, `publishToInstagram` route.ts:276) using `lib/meta-graph`.
   Separately, `/api/social/publish-facebook`, `/api/social/publish-instagram`,
   `/api/social/publish-tiktok` are standalone routes that call the **same** `lib/meta-graph` /
   `lib/tiktok` helpers. The per-platform routes have **no runtime caller** (facebook/instagram =
   dead; tiktok = script-only). The live path is `publisher-sweep` → self-`fetch('/api/social/publish')`.
   → Three redundant publish endpoints; consolidate to the lib functions and one route.

2. **`weekly-cycle` vs `marketing-weekly-cycle`.** Both routes call the identical
   `runWeeklyCycle` from `lib/marketing-brain/weekly-cycle` (`marketing-weekly-cycle/route.ts:18`
   and `weekly-cycle/route.ts:20`). `weekly-cycle` self-documents as a "Phase 11.5 alias"
   (route.ts:5, "invoked_via: weekly-cycle (alias)"). Only `marketing-weekly-cycle` is scheduled.
   `weekly-cycle` is a redundant alias route.

3. **`snapshot-channels` vs the 9 `marketing-snapshot-*` routes.** `snapshot-channels` (scheduled)
   fans out via **internal HTTP self-fetch** to `/api/cron/marketing-snapshot-${p}` for 9
   platforms (route.ts:58). Each snapshot route re-authenticates and re-boots a serverless
   invocation. This works but pays 9 extra edge round-trips per run and duplicates the auth
   handshake; the snapshot logic already lives in `lib/marketing-brain/snapshot.ts` and could be
   called directly. (Note: `marketing-snapshot-google-ads` is NOT in the fan-out list of 9, so it
   is orphaned — see §5.)

4. **`publisher-sweep` → HTTP self-fetch of `/api/social/publish`** (publisher-sweep route.ts:183).
   Same internal-fan-out-via-HTTP anti-pattern as #3.

5. **Sync route sprawl.** Overlapping sync entry points across two namespaces:
   `/api/admin/sync`, `/api/admin/sync/delta`, `/api/admin/sync/live`, `/api/admin/sync/photos`,
   `/api/admin/sync/history-active`, `/api/cron/sync-delta`, `/api/cron/sync-full`,
   `/api/cron/sync-history-terminal`, `/api/cron/sync-parity`, `/api/cron/sync-verify-full-history`,
   `/api/cron/start-sync`, `/api/sync-spark`. Several are dead (`admin/sync/photos`,
   `admin/sync/history-active`, `sync-spark` route). The live sync logic is in
   `app/actions/sync-spark.ts` / `sync-full-cron.ts` / `lib`. The HTTP layer around it is
   duplicated and partly orphaned.

6. **CMA send — multiple wrappers.** `/api/cma/[slug]/email`, `/api/cma/[slug]/gmail-draft`,
   `/api/cma-delivery` (worker), `/api/cma-drafts/[id]/send`, plus server actions
   `cma-admin.sendCmaToLeadAction`, `contact-cma`, `lib/cma/send.sendCmaToLead`,
   `lib/cma-delivery.processCmaDelivery`, `lib/cma-deliver.ts`. At least four code paths deliver a
   CMA to a lead. Whether they converge on one send primitive was not fully traced, but the
   surface is large and overlapping.

7. **Email/SMS send primitives are not funneled.** 20+ `send*` functions across
   `lib/resend.ts`, `lib/crm/gmail.ts` (`sendCrmEmail`), `lib/crm/twilio.ts` (`sendSms`,
   `sendSmsViaMessagingService`), plus per-feature senders (`seller-lead-alert`, `expired-alert`,
   `fsbo-alert`, `market-stat-alert`, `deploy-health-alert`, `tc/signing-emails`,
   `bpo/send`, `cma/send`, `newsletter/queue`). The CRM UI composers are gate-enforced (G50 per
   memory), but the **backend** has no single choke point — alert emails bypass the CRM timeline /
   suppression path that CRM sends use. For the rebuild: one `sendEmail` and one `sendSms`
   primitive that every path (alerts included) routes through, with suppression + logging built in.

8. **Server-action ⇄ API-route duplication.** `getRefreshVideoToursCache`
   (`app/actions/video-tours-cache.ts`) and `/api/cron/refresh-video-tours-cache` both call
   `executeRefreshVideoToursCache` — the action wrapper has **no importer** (dead). Same shape for
   `app/actions/refresh-place-content.ts` (dead action) vs `/api/cron/refresh-place-content`.

---

## 4. Dead / orphan list (verified — no runtime invoker anywhere)

Each re-verified with a permissive grep after the initial static match. Excludes external-entry
endpoints (OAuth callbacks, Resend/Meta webhooks, email pixels, CMA map embeds) which have no
in-repo caller *by design*.

**API routes — genuinely dead:**
1. `/api/admin/offline-conversion` (POST) — superseded by `lib/meta-offline-conversions.ts`.
2. `/api/admin/producer-change-requests` (POST) — no UI.
3. `/api/admin/run-loop-cycle` (GET) — no UI, not scheduled.
4. `/api/admin/sync/history-active` (POST) — no caller.
5. `/api/admin/sync/photos` (POST) — no caller.
6. `/api/admin/tracerfy-history` (GET) — no caller.
7. `/api/ai/generate-text` (POST) — **no caller AND unauthenticated** (rate-limited only); it
   calls an LLM, so it is a live unauthenticated AI-cost endpoint with no consumer. Delete.
8. `/api/pdf/listing` (POST) — no caller (sibling pdf routes are wired).
9. `/api/search/semantic` (GET) — no caller; live search uses `/api/search/suggestions`
   (SmartSearch.tsx:45, HeroSearchOverlay.tsx:49).
10. `/api/spark-status` (GET) — no caller.
11. `/api/sync-spark` (GET/POST) — dead HTTP wrapper; the `syncSpark` *action/lib* is used, the
    route is not.
12. `/api/tiktok/diagnostic` (GET) — no caller.
13. `/api/social/publish-facebook` (POST) — superseded by `/api/social/publish`.
14. `/api/social/publish-instagram` (POST) — superseded.
15. `/api/social/publish-tiktok` (POST) — script-only, superseded.
16. `/api/cma/[slug]/finalize-deliver` (POST) — only a doc-comment reference; no code fetches it.
17. `/api/cma/[slug]/track` — *alive* (email pixel), listed here only to note the matcher flagged it.
18. `/api/marketing-brain/audit/ads`, `/audit/crm`, `/audit/website`, `/diagnose`,
    `/generate-briefs`, `/gsc-properties`, `/linkedin-orgs` — dead HTTP wrappers; the real audit
    runs via `/api/cron/marketing-audit-run` → `lib/marketing-brain/audit-run.runAudit`. (7 routes,
    all `CRON_SECRET`-guarded, curl-only at best.)
19. `/api/maps/cma-21042-robin` (GET) — draft-only, no live embed (the other four `maps/cma-*` are
    embedded by `public/cmas/*` HTML and are alive). The whole family is a copy-paste that should
    be one parametric `/api/maps/cma/[slug]` route.
20. `/api/listings/[listingKey]/photos` (GET) — the sparse-sync photo-fallback endpoint; no UI
    caller.

**Server-action files — no importer anywhere (dead):**
21. `app/actions/auto-response.ts` (`sendAutoResponse`) — 0 importers; a "5-minute auto-response"
    feature that is wired to nothing.
22. `app/actions/home.ts` (3 fns) — 0 importers.
23. `app/actions/lead-scoring.ts` (`computeLeadScore`) — 0 importers; a scoring system wired to nothing.
24. `app/actions/track-user-event.ts` — only imported by `track-visit.ts`, which is itself
    single-referenced; near-dead tracking chain.
25. `app/actions/video-tours-cache.ts` — dead action wrapper (see §3.8).
26. `app/actions/refresh-place-content.ts` — imported only by its cron; the action `'use server'`
    wrapper is redundant with the cron.
27. `app/actions/photo-classification.ts` — one importer (search page); keep, noted for low usage.

---

## 5. Cron-schedule integrity (routes vs `vercel.json`)

72 cron route dirs exist; 49 are scheduled. **23 cron routes are on no schedule.** Breakdown:

- **Alive via self-fetch** (fine): the 9 `marketing-snapshot-{ga4,gsc,meta-ads,meta-page,x,
  linkedin,tiktok,gbp,youtube}` (fanned out by scheduled `snapshot-channels`).
- **Orphaned — not scheduled, not self-fetched, script-or-none caller:**
  `marketing-snapshot-google-ads` (NOT in the snapshot-channels fan-out list → never runs on
  schedule), `neighborhood-default-subscriptions`, `refresh-video-tours-cache`,
  `strategy-revision-check`, `optimization-loop`, `weekly-cycle` (alias, §3.2),
  `refresh-listing-year-stats`, `sync-parity`, `sync-verify-full-history`, `start-sync`,
  `daily-broker-digest`, `weekly-pipeline-digest`, `marketing-inbox-poll`.
- **Schedule/reality mismatch:** `detect-expired-listings` — `CLAUDE.md` states it runs "hourly,"
  but it is **not in `vercel.json`**; `lib/expired-listing-processor.ts:17` confirms the route is
  "kept for ad-hoc manual invocation." The expired-listing detection is not actually scheduled.

No `vercel.json` entry points at a missing route dir (no broken schedule pointers).

---

## 6. Correctness / error-handling notes (senior-engineer lens)

- **Silent-success on lead capture** is a documented, recurring failure class here
  (`/api/cma/route.ts:6` header describes the past 404-with-fake-green bug). The pattern — form
  POSTs, backend fails, UI shows success — is the exact user-facing risk the owner feels as
  "leads disappear." Any rebuilt capture endpoint needs an honest error contract end-to-end.
- **`isAuthorizedCron` returns false when `CRON_SECRET` is unset** (snapshot.ts:150) — fail-closed,
  good. But several inline copies (`crm-sequence-engine/helpers.ts:23`,
  `refresh-video-tours-cache`) **fail OPEN in non-production** (`if (!secret) return !isProd`) —
  acceptable for local dev, but it means the guard's behavior depends on `NODE_ENV`/`VERCEL_ENV`
  being set correctly on every environment; a misconfigured preview would be unauthenticated.
- **Overlap protection is inconsistent.** Only `crm-sequence-engine` takes an advisory lease
  (`crm_try_cron_lease`). High-frequency crons (`crm-bulk-worker` */2, `newsletter-send` */2,
  `crm-scheduled-sends` */5) have no visible lease in the route header — a slow run can overlap the
  next tick and double-process.
- **Paid-API proxies have no rate limit.** `/api/admin/stock/{unsplash,pexels,shutterstock}/search`
  are admin-gated but not rate-limited; middleware rate-limits `/api/ai/*`, `/api/pdf/*`,
  `/api/cma/*`, `/api/auth/*` but not `/api/admin/stock/*`.
- **`middleware.ts` is rate-limiting only — it performs no auth.** Every route owns its own auth.
  There is no edge-level `/admin` or `/api/admin` gate; the sole admin gate is the
  `(protected)` layout for pages and per-route checks for APIs.

---

## 7. What the rebuild architect needs from this domain

1. **One auth entry point.** Force every admin/interactive route through `requireAdminOr403` /
   `isAuthorizedAdminOrCron` and every mutating server action through a first-line guard; widen the
   `check-admin-endpoint-auth` gate from 2 whitelisted files to *all* admin routes + actions.
2. **Server actions must self-authorize.** Stop relying on the `(protected)` layout for mutation
   safety. This is the biggest latent hole (§1a).
3. **Collapse the duplicates in §3** — one publish path, one weekly-cycle, one CMA-send primitive,
   one email + one SMS choke point (with suppression + logging inside), one parametric CMA-map route.
4. **Delete the ~24 dead routes + 7 dead actions in §4.**
5. **Reconcile crons to `vercel.json`** (§5) — either schedule or delete the 13 orphaned crons;
   fix the `detect-expired-listings` "hourly" claim; replace HTTP self-fetch fan-out with direct
   lib calls.
6. **Standardize the cron guard** — one `isAuthorizedCron`, fail-closed everywhere, with an
   overlap lease helper available to every high-frequency cron.
