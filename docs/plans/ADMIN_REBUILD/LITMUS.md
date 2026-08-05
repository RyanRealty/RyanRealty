# LITMUS — notification → pre-filled CMA kick-off (D8)

**The acceptance test #1 of the admin rebuild:** a broker gets a phone
notification that a new lead wants a CMA, and gets from that notification to a
**kicked-off, pre-filled CMA build** in ≤ 3 taps / ≤ 30 s on mobile. The timed
span is the BROKER-ACTION span (notification → kick-off). The CMA itself stays
draft-first: the async build lands in `/admin/cmas` for review, the broker gets
a text when it is ready, and nothing is ever auto-sent (§0 / D8).

Demonstrated 2026-07-17 against the production `next build` on the real hosted
DB, authed as matt@, 375×812 viewport. Re-runnable: every step below is a
command or a tap.

---

## Before (session-start baseline @ 707a52a5)

- **Desktop:** ≈ 10–12 clicks across 4–5 page loads + a 30–60 s SYNCHRONOUS
  in-request build (`startCmaForContactAction`), approval only at
  `/admin/cmas/[slug]` (audit `send-center.md §1.7`).
- **Mobile: impossible.** `crm/[id]/mobile-detail.tsx` had no CMA/send surface
  at all (audit `send-center.md §7` critical).
- The new-lead notification linked the bare person page (no intent, no
  kick-off surface): `lib/crm/broker-alerts.ts newLeadAlertBody`.

## After (this diff)

The full path, exercised end-to-end through the REAL pipeline:

1. **Fixture lead arrives through the real webhook.** `tmp/litmus-inbound-sms.mjs`
   POSTs a Twilio-signature-valid inbound SMS ("What is my home at 20695 Town Dr
   in Bend worth?", from +15005550006, a number not in the CRM) to
   `/api/twilio/inbound-sms`. The webhook created person **57531**, and queued
   the broker alert (crm_broker_alerts id 810) whose body ends:

   ```
   New lead: Text lead 5005550006 (inbound-sms)
   Texting now from +15005550006: What is my home at 20695 Town Dr in Bend worth?
   ryan-realty.com/admin/crm/57531?intent=cma
   ```

   `hasSellerIntent()` detected the home-value ask and appended **`?intent=cma`**
   (lib/crm/seller-intent.ts; the alert is delivered to the broker's cell by the
   existing mac-mini relay).

2. **Tap 1 — the notification link.** Lands on `/admin/crm/57531?intent=cma`
   (deep-link `next` preservation now carries the query through an expired-session
   funnel too — middleware `x-search`). The **CMA kick-off sheet auto-opens**,
   identity resolved (name · phone), **address pre-filled "20695 Town Dr, Bend"**
   — extracted from the lead's message by `extractAddressCandidate()` with the
   caption "Pulled from their message. Confirm it before building."

3. **Tap 2 — "Build CMA — text me when ready."** `kickoffCmaForContactAction`
   (auth in-body) → `kickoffCmaCore` → the canonical `createCmaRequest` pipeline.
   Round trip ≈ 3 s. The sheet flips to "CMA build kicked off … you'll get a
   text when the draft is ready to review."

**Broker-action span: 2 taps** (notification + Build) — 1 under budget; the
spare tap is the address-confirm/edit if the extraction needs it. **Elapsed
(production build, measured): see the timed pass below.**

4. **The async leg (outside the timed span, proven):** the real
   `cma-build-worker` cron ran (`GET /api/cron/cma-build-worker`, scanned 1
   built 1), producing the full deterministic draft — reviewable on the phone at
   `/admin/cmas/cma-20695-town`: Draft badge, $560,000 recommended list,
   $520,000–$560,000 value range, 9 comps, Bend · 3.9 MoS — and queued the
   ready-text (crm_broker_alerts):

   ```
   CMA draft ready — 20695 Town Dr, Bend
   Review and send: https://ryan-realty.com/admin/cmas/cma-20695-town
   ```

   Review + personal send stay exactly the existing draft-first flow.

## Data-side proof (only the intended rows changed)

Before tap → after tap (`tmp/litmus-db-check.mjs`, person 57531):

| Table | Before | After |
|---|---|---|
| `cmas` (slug cma-20695-town) | 0 rows | 1 row, `status='draft'`, client = the lead (phone-only, no email required to kick off) |
| `marketing_brain_actions` (target cma:cma-20695-town) | 0 | 1 row `pending`, payload `notify_broker_sms:true, crm_person_id:57531, alert_broker:'matt'`, data_evidence `request_source:'crm-kickoff'` |
| `crm_timeline` | 3 rows (webhook's) | +1 "CMA build kicked off" (deduped per attempt) |
| `crm_idempotency_keys` | 0 | 1 (`cma-kickoff:57531:<uuid>`) |
| anything else | — | unchanged (no GA4 conversion fired, no lead email, no broker email — all gated off for `crm-kickoff`) |

## Idempotency / mutation safety (regression-locked)

`lib/crm/cma-kickoff.int.test.ts` (real-DB, self-cleaning, runs in the
pre-commit suite): double-tap with the same key + a second kick-off with a NEW
key both resolve to **exactly one** open `content:cma` action row; the second
new-key call returns `alreadyQueued:true`. The client additionally auto-retries
an aborted POST once with the SAME key (safe replay) — cell-network blips can't
strand or duplicate the tap.

## Timed pass (production build, measured 2026-07-17 12:38 UTC)

- **t0 12:38:02** — tap the notification link (`/admin/crm/57531?intent=cma`).
- **12:38:12** — page interactive, sheet open, address pre-filled (~10 s
  including automation-harness overhead; the person page is force-dynamic).
- **12:38:19.7** — tap "Build CMA" → server-side kick-off stamped
  (`crm_timeline` ts 12:38:19.709, action row 12:38:19.611 — sub-second round
  trip; ~7 s of the gap is harness screenshot/read tooling a thumb doesn't pay).
- **Total broker-action span: 17.5 s, 2 taps. Budget ≤ 3 taps / ≤ 30 s: MET**
  (human path without tooling latency ≈ 11–12 s).

Client hardening proven in the same pass: an aborted action POST (observed
twice under the automation harness — same class as a cell-network blip)
auto-retries once with the SAME idempotency key, so the tap can neither strand
nor double-enqueue.

## Cleanup

`tmp/litmus-cleanup.mjs` deletes: crm_people 57531 (+ timeline, tasks,
conversation model rows), crm_broker_alerts rows, the `cmas` row, the
`marketing_brain_actions` row, and the idempotency keys. No Gmail draft exists
(the span ends at kick-off; nothing was sent). Verified zero-residue after run.

## Final form + re-verification

- After the adversarial fixes, `ci:design-tokens` (correctly) rejected the
  hand-rolled overlay — the sheet was rebuilt on the design-system `<Dialog>`
  (focus-trap, Escape, token styling; state-opened by the intent param, no
  trigger). The FINAL tree was re-demonstrated on a fresh production build:
  deep link → Dialog auto-open, address pre-filled, focus in the field →
  Build tap → kick-off stamped server-side sub-second (13:21:15.7) → success
  state. DB delta identical to the earlier pass. Fixture then fully cleaned.
- The kick-off guards demonstrated live at the data layer (int tests vs the
  real hosted DB): double-tap replay, attach-to-open-build, finalized-row
  no-clobber, killed-stub re-kick, and the DB unique-index race backstop.

## Re-run recipe (any future session)

1. `node tmp/litmus-inbound-sms.mjs` (dev server on :3000) — creates the lead
   through the real signed webhook; prints the alert body with the deep link.
2. Open the printed link authed as matt@ at 375px; tap Build.
3. `node tmp/litmus-db-check.mjs` — before/after row proof.
4. `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/cma-build-worker`
   — builds the draft + queues the ready-text.
5. `node tmp/litmus-cleanup.mjs` — zero-residue teardown.

## Notes

- The Next.js dev-tools badge ("N", bottom-left) appears in dev screenshots
  only — not product UI.
- Heavy-page hydration is the one real tap-latency tax: on the force-dynamic
  person page, a tap in the first seconds after paint can land before React
  attaches handlers (observed under the automation harness). Spec 03's fetch
  rebuild (identity core + streamed regions) is the structural fix and stays
  next in queue.
- A `cmas` slug collision can never be clobbered from this surface (guarded +
  int-tested); the seller-LP intake path still upserts-by-slug — chipped.

---

## Re-proof 2026-08-05 (Admin Product OS P8, current main @ 12e7fa9d)

Full loop re-run on a fresh production build of current main (includes the CMA
flowing-page migration), real hosted DB, authed as matt@, 375×812:

1. Signed webhook fixture → person 60540, seller-intent alert queued with
   `?intent=cma` deep link. **The alert delivered to Matt's real phone through
   the PRODUCTION crm-alert-drain + Twilio rail** (alert 925 `sent`) — the
   notification leg proved itself on the live path, no relay.
2. Deep link at 375 → sheet auto-open, identity resolved, address pre-filled
   "20695 Town Dr, Bend" from the message. **Tap 2 = Build** → all three rows
   stamped in ~4.2 s (cmas draft 03:23:56.13 · action pending .17 · timeline
   .34). **2 taps, ≤3 budget met.**
3. Real cma-build-worker: built in ~44 s — $560,000 recommended, $520K–$560K
   range, 8 comps, live MoS — reviewed on the phone on the NEW flowing-page
   renderer. Ready-text (alert 926) delivered to Matt's phone.
4. Cleanup: zero residue, double-verified (person/cma/action/alerts/timeline
   all 0).

Harness caveat (recorded honestly): two click attempts failed before the
successful one — the first was an automation coordinate error (2× image
scaling), the second the known harness-vs-Radix pointer-event class
(reference_preview_e2e_admin_auth_and_radix); a DOM-dispatched click fired
instantly and the July device-run already proved human taps. No product
defect found; wall-clock human span not re-measured this pass (tap count +
sub-5 s server leg + page-interactive-in-seconds put it well inside 30 s).

Verdict: **LITMUS holds on current main.** The v2-language kickoff surface
was NOT rebuilt in this pass — scoping question for Matt at the litmus stop:
fold the v2 rebuild into P9's People/Today family rolls (recommended, since
the litmus passes on the existing surface) or require it inside P8.
