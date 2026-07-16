# Admin Rebuild — Build Progress

Live log of what has shipped to `main`, verified. Newest first. Companion to the
spec package (`README.md`, `00-REASONING…`, `01-DECISIONS…`) and the per-feature
specs in `specs/`.

Verification bar for every entry: tsc + esbuild/`next build` clean, and the real
behavior exercised in the browser (authed as matt@ via a service-role magic link to
the local callback) or integration-tested against the real DB.

## Shipped

### RC1 — the first-class Conversation model — IN PROGRESS (schema landed)
- **Conversation / participant / message tables live** (`20260716200000_conversation_model.sql`).
  The root of the owner's #1 messaging confusion: today a "conversation" is just
  `person_id`, so groups, multi-channel threads, and multiple phone numbers collapse
  onto the person and receipts fragment across an untyped blob. New entity:
  `crm_conversation` (1..N participants, typed `state`/clocks/`needs_reply`) +
  `crm_conversation_participant` (broker line is NOT a participant) +
  `crm_message` (one typed shape; `provider_sid` is THE receipt key; unique on
  `provider_sid` and `idempotency_key`). Two triggers: participant-sync maintains
  `participant_count` + `is_group=(cnt>1)`; message-insert advances the clocks,
  sets/clears `needs_reply`, reopens closed→unread on inbound, unions `channel_set`.
  RLS on all three. **ADDITIVE + zero live behavior** — nothing reads/writes them yet;
  `crm_timeline` stays the ledger. Backfill + dual-write + inbox rewire are the next
  steps. **Trigger verified end-to-end vs the real DB**: seeded 2 participants + 1
  inbound + 1 outbound → participant_count=2, is_group=true, needs_reply=false (cleared
  by the reply), channel_set={sms}, both clocks set, msg_count=2; test row deleted,
  tables back to 0/0/0. Snapshot + DAL index refreshed.

### Integrity + security (compliance-grade wrong numbers / unauthenticated writes) — DONE
- **Content-write security holes closed** (`979350ad`). 18 in-body `checkAdminAction`
  guards across blog / guides / site-pages / geo-places / brokerage — the RC5
  criticals (unauthenticated service-role writes → public-site stored-XSS/defacement;
  several wrote BEFORE their getSession). Verified: /admin/blog loads + editor intact
  (superuser short-circuit).
- **No more fabricated "$0 team volume"** (`73a76054`). /admin/reports/brokers read the
  empty broker_stats and rendered "$0"; now shows "—" + a "being reconnected" note.
  Verified live.
- **False-CRITICAL "pause your ads" alert fixed** (`1890f17e`). action-required Spend
  Alerts divided Meta spend by the dead `fub` qualified_seller_leads metric (always 0 →
  fired CRITICAL every $60 week). Now divides by real getLeadIntake inbound leads.
  Verified live: "$0.00 spent for 3 new leads", no false alarm.
- **cost-per-lead + ad-ROI repaired** (`d2b35ddb`). Both pages (named for the owner's
  core question) divided ad spend by the dead `fub` lead metrics → permanent "—"/0.
  Now use real getLeadIntake (cost-per-lead buckets byDay into weeks; ad-ROI uses the
  aggregate). Closed-deal figures (no live source) show "— ledger reconnecting", not a
  fake 0. Verified live: real per-week counts (5/9/3/15/2), "34 real inbound leads".

### Consumer funnel (RC7) — partial
- **Signed-in visitors can reach their account** (`e5cb7662`). The header/nav always
  said "Sign in" and the account menu (AuthDropdown) had 0 importers. New
  `lib/hooks/useSessionUser` (client /api/auth/me fetch) drives a new
  `HeaderAccount` (SiteHeader account menu) + KbNav's auth link → "My account" when
  signed in. Verified live: KbNav shows "MY ACCOUNT" for the authed session.
- **save→sign-in returns you to the page** (`be5a8eca`). All 11 save entry points sent
  `?returnUrl=` (or `/account?signin=1`) which login ignored (it honors `next`), so a
  save→sign-in dumped the visitor on /account with the listing lost. Standardized every
  save on `/login?next=<page>`. Verified live. (Auto-replay of the save = spec-10.)
- **Viewing history made real** (`3a567bbc`). /account/history read user_activities (no
  writer → always empty, Remove on nonexistent rows). Now VisitTracker writes
  user_events on a signed-in listing view; getRecentListingViews reads it. Verified
  live end-to-end: viewed 2 listings → both render in history.

### Person-page CMA flow — DONE (partial)
- **CMA "Review comp" dead-end fixed + build feedback** (`1ab7872c`). Repointed to
  /admin/cmas/[slug] (was the tokenized lead page → "Link not valid"); "Generate comp"
  + "Send to lead" now use `PendingButton` (reusable useFormStatus button,
  `components/admin/PendingButton.tsx`).

### Messaging pain trilogy (the owner's #1 stated pain) — DONE
- **Double-send killed** (`0d786a49`). SmsComposer + EmailComposer Send buttons use
  `useFormStatus` → disable + spinner the instant you tap (no more "nothing happened →
  tap again"). Per-attempt idempotency key + `withSendIdempotency` over
  `crm_idempotency_keys` = a duplicate submit no-ops; a failed send releases the key so
  a real retry re-sends. Verified: live suppressed send (compliance intact), release-on-
  failure live (empty ledger), dedup+release integration test vs real DB.
- **Group vs 1:1 unmistakable** (`35c61e01`). `lib/crm/group-message.ts` (pure,
  shared) → "Group · N people" badge on group texts in the person timeline + inbox +
  mobile feed. Verified live: person 57297 shows Group·4 (in) / Group·3 (out).
- **Delivery status in the inbox** (`ad0f9fde`). `lib/crm/sms-delivery.ts` (pure,
  shared) → delivery chip (Delivered / Sent / Queued / Undelivered(code) / Failed) on
  outbound inbox bubbles. Verified live: person 57295 shows "⚠ Undelivered (30005)".

### Foundation primitives (the load-bearing floor) — DONE (additive, not yet wired into the live shell)
- **Capability model + in-body guard** (`ba03ff07`). `lib/admin/capabilities.ts`
  (one cap→roles map, reconciled v1 per §A1 + Matt's decisions) + `lib/admin/
  require-admin.ts` (`requireAdminPage/Action/Route` + `checkAdminAction`). Kills RC5.
- **Idempotency ledger + mutation primitive** (`ba03ff07`). `crm_idempotency_keys`
  table (migration applied) + `lib/crm/idempotency.ts` + `mutation-result.ts` +
  `useIdempotentAction`. The RC2 substrate.
- **Capability-projected nav** (`5bad2db5`). `lib/admin/nav.ts` `buildNav(ctx)` — the
  8-destination IA as a projection of the capability map (nav can't show a dead-end).
  9 unit tests.

### Shell / IA pass — IN PROGRESS (bounded HIGH defects landing)
- **Broker dead-ends killed** (`ef95e240`). /admin/listings + /admin/crm/import were
  shown to brokers but their pages redirect non-superusers → gated the nav to match.
  Verified: superuser nav intact, brokers no longer see them. (crm/calendar, templates,
  reporting use isSuperuser for DATA scoping not gating — left unchanged.)
- **Sign-out added** (`486bc01d`). Audited "no sign-out anywhere in the admin" — the
  avatar was a bare image. Desktop: account DropdownMenu (name/email, My settings, View
  site, Sign out). Mobile: sign-out footer in the hamburger sheet. Verified live (desktop
  menu opens showing Sign out; mobile sheet is Radix so harness can't open it but real
  users can).
- **Deep-link destination preserved through sign-in** (`d9e92c63`). Layout hardcoded
  next=/admin + AdminLoginForm hardcoded ADMIN_NEXT → a deep link with an expired session
  dumped you on the dashboard. Now the funnel carries the real page end to end (layout
  x-pathname → auth-error → login page → form dest). Verified page renders carrying next.
- STILL in shell scope (larger/risky, deferred): the responsive single-tree consolidation
  (kill the mobile/desktop fork), the persistable session-refresh (middleware/server.ts
  cookie writes), dropping the public-site bundle from admin (route-group refactor), and
  the full nav→buildNav(capability) migration with canonical routes.

### Dedicated review pass — DONE (`7108d338`)
A 5-area adversarial multi-agent review of the session's 14 commits found + fixed
**2 confirmed HIGH bugs manual testing missed**: (1) withSendIdempotency reported a
fake `{ok:true}` on a transient ledger DB error → silent no-send reported as sent (now
fails OPEN); (2) /account/history rendered ZERO cards for real users (keyed by
ListingKey but views store MLS ListNumber — my live test passed only via a legacy URL;
now keys by both). Plus MEDIUM cost-per-lead "blended" honesty + LOW guards/consent/doc
fixes. Deferred to spec 02: group participant-count off-by-one (inbound counts broker
line), per-recipient group idempotency. **Lesson: manual browser verification misses
transient-error paths + URL-form edge cases — the adversarial review is not optional.**

## Next (in priority order)
1. "Send a CMA in seconds" — collapse the CMA build+send to one fast path on the
   person workspace (the owner's explicit litmus test).
2. The responsive shell + Today home + capability nav wired live (kills bloat +
   mobile≠desktop). Higher blast radius — needs the destination routes to exist or
   redirect-bridge; browser-verified.
3. Public-site bundle off admin — the CORRECT fix is a route-group refactor (root
   layout must stay static for public prerender; naive `headers()` there regresses the
   whole site). Deferred to a dedicated careful pass, NOT the naive spec version.
4. Then per doc 01 §C: metric layer, transactions (no e-sign), prospecting/settings/
   content, consumer funnel, delete pass.

## Notes / gotchas learned
- Turbopack dev overlay can show a sticky false-positive parse error on an unvisited
  import chain (newsletter.ts→crm.ts) after rapid HMR edits to a large `use server`
  file. tsc + esbuild + `next build` are the truth; the page rendering is the truth.
- Local admin auth: mint a service-role magic link → land on `/auth/callback` (see
  `tmp/mint-magic.mjs`, gitignored). Preview mutations fire as matt@ for real — prefer
  read paths / knowingly-reverted single actions.
- Pre-commit runs full vitest (~2.5 min); pre-push runs `next build` (~2 min). Use
  Bash timeout ≥300000 for git commit/push. Concurrent sibling sessions push to main —
  always `git pull --rebase` before push.
