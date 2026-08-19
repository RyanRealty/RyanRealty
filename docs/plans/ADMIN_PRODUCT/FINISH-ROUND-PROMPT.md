# The Finish Round — chain every remaining unit to program completion

Written 2026-08-06 at Matt's request ("chain all of these together and complete these
in one round"). Paste the block below into a fresh session, or just say
**"run the finish round"** — the skill reads this file from disk.

---

## PROMPT (paste from here down)

Continue the Admin Product OS in FINISH-ROUND mode. Read
`.claude/skills/admin-product-os/SKILL.md`, orient from
`docs/plans/ADMIN_PRODUCT/` (verify disk, print the ≤5-bullet summary), then
execute the ENTIRE remaining work-queue back to back — every P9 family, then
P10 gates — stopping only for: a defect that needs my call, context exhaustion
(flush + HANDOFF with the exact next item), or program completion.

### Per-family loop (one family = one commit, no exceptions)

1. **Scope from disk**: `ia-lock.md` (the destination's job), `page-inventory.json`
   (routes it absorbs), the matching `processes/*.md` §11 target shape, and
   `cut-list.md` (what must NOT come back).
2. **Build on the locked v2 language**: `components/admin/v2` primitives +
   `admin-v2.css` (add pattern classes there, never inline color). Page reads
   through `lib/data` ONLY (`ci:page-action-imports` is ratcheted — a new
   page→action read import fails the push). Mutations reuse existing actions
   via thin `Promise<void>` wrappers that `revalidatePath` the new surface.
   Access via `requireAdminPage(<capability>)`; scope = superuser→null else
   brokerSlug.
3. **Absorb, don't fork**: old routes become redirect bridges once their jobs
   are fully carried; delete replaced single-importer components/libs in the
   SAME commit (verify importers with the reachable-exports gate, not name-grep
   — comments and type-only imports lie). Heavy legacy machinery not yet
   migrated stays one tap away behind an "All tools" link.
4. **Nav**: repoint the single source (`lib/admin/nav.ts`) and update
   `lib/admin/capabilities.test.ts` expectations (labels, hrefs, item counts,
   badge finders, hub-naming rule: a child never repeats the hub label).
5. **Widen the functional gate**: add the new route dir to SCAN_DIRS in
   `scripts/check-admin-v2-tokens.mjs`.
6. **Verify like it's production**: `npm run build` (background), then serve
   `next-start` and browser-verify at 375 AND ≥1024 on REAL data — counts must
   reconcile (a verdict number equals the sum of its lanes), searches must hit,
   and every new read gets probed directly on error before trusting an empty
   result (never ship a read that swallows errors silently).
7. **Ship**: flush memory files (queue pop, progress append, SESSION_BOOT
   current-state), commit (conventional, one family), `npm run push`, then
   `npm run deploy:verify` — it times out at 300s while Vercel builds; run a
   second window before calling it stuck.

### Remaining families, in queue order

- **roll:prospecting** — the weekly pass on v2: worklist buckets
  (sendable / needs-audit / no-phone / sent) from `lib/data/prospecting/*`,
  per-row readiness with blocked-reasons in plain words, send via the existing
  guarded actions (NEVER auto-send; verification stops BEFORE any real
  outbound). DSCR stays in Reports (Matt's IA amendment).
- **roll:oversight** — verdict + needs-you pattern (tile boards are retired):
  one attention list (alarms, broken sequences, PB sign-off waits), quiet
  rows for healthy systems, the week strip. Absorbs `/admin/operations`,
  `/admin/crm/health`, `/admin/sync*`, `/admin/crm/activity`, the weekly
  reports (speed-to-lead, agent-activity/goals), and the old dashboard's
  KPI/feed jobs. Sequence ran/broke/parked lane included.
- **roll:remaining-families** — split into one commit each, order:
  **Valuations** (one worklist over cmas + BPOs — the P3 surface merge),
  **Closings** (TC-rooted deal list + lenses; the CRM deal board folds in
  per the one-deal-entity lock), **Reports** (hub v1: the definition-first
  index over the 34 absorbed routes; do NOT rebuild 34 report UIs — the hub
  + existing pages behind it is the honest increment), **Audiences**
  (subscriptions + segments + cohort compose doors unified), **Content**
  (one content home), **Settings** (config hub incl. compliance panel +
  sequence authoring). Thin hub v1s are acceptable ONLY if every link works
  and the destination's primary job is actually doable on it.
- **gates (P10)** — land the closing mechanical gates: extend
  `check-admin-v2-tokens` scope to everything rolled, a nav↔inventory parity
  check (every locked destination reachable, no cut route in nav), AA
  contrast spot-check on the v2 tokens (computed, not claimed), and wire all
  into `ci:gates` (the meta-gate requires it). Then the final program report:
  scoreboard, defects found/fixed, chips outstanding, and what P11 would be.

### FIRST ACTION of the finish round (before any family)

Heal the People deploy gap (progress.txt 2026-08-06T01:45): the 84ef6c8 build
was canceled by a superseding docs-only push that then skipped itself, so
production likely lacks /admin/people. Verify what production serves; if
stale, trigger a real build of current main (the first family push does it,
or redeploy the current SHA), then deploy:verify and confirm /admin/people
is live.

### Landmines already hit once — do not relearn them

- A docs-only push while a code deploy is BUILDING cancels the code build and
  then skips itself — production silently stays stale. Never push docs-only
  while a code deploy is in flight; always deploy:verify the CODE SHA through
  to READY before any follow-up push.

- First manual browser click after paint can be a harness artifact (2× image
  scaling; Radix pointer synthesis) — click by ref or DOM dispatch, and treat
  a silent no-op as harness-first, product-second. DB stamps are ground truth.
- `getTaskQueue` views are `today|overdue|upcoming|completed`; task rows are
  flat camelCase; form actions must return `Promise<void>`; loose supabase
  row types need local casts.
- The segment compiler's free-text `q` node is BROKEN (chip task_cb8a89a8) —
  search via `crm_contact_points` two-step with digit-normalized phones.
- Phones in contact points are stored digits-only/E.164.
- FUB-parity screens that a roll retires: mark `status:"superseded"` with a
  `supersededBy` pointer in `docs/crm-spec/crm-screens.json`.
- New DAL reads: refresh via `node scripts/check-data-access.mjs --refresh`
  and commit both generated docs.
- Alert deep links still target `/admin/crm/[id]` — repointing them to
  `/admin/people/[id]` requires a litmus RE-TIMING in the same unit
  (fold into roll:oversight or its own micro-unit; never silently).
- Fixture people (from `tmp/litmus-inbound-sms.mjs`) are cleaned ONLY on
  Matt's explicit "done" or at next-session start — never mid-window.
- The pre-commit suite reruns fully per commit (~4-6 min) — batch file edits
  before committing; the pre-push chain also builds (~10 min).

### Hard lines (unchanged)

Locks are all granted — but the cut-list is frozen (never resurrect), §0/§1
outrank everything, no real outbound sends during verification, no new schema
without a failed chain, and every claim in the final report must be verified
on disk or in the browser, not remembered.
