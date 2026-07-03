# Expired-Listing Workflow — Adversarial Full Audit + Fix (2026-07-03)

**Trigger:** Matt: "do a full audit of the expired listing workflow which seems to be broken."
**Method:** assume-broken-until-proven. Every stage verified against live prod data (Supabase project `dwvlophlbvvygjfxcrhm`) + live API smoke tests. Net-zero mutations (one test contact created + deleted). No sends to real expired leads.

---

## TL;DR verdict

The workflow was **broken end-to-end from person-creation onward, dead since ~2026-06-12**. Detection works and writes `expired_listings` rows every 15 min, but nothing downstream fired: **0 new enrollments in 3 weeks, 0 alert emails ever sent, only 13 of 98 detected listings ever produced a CRM lead**.

Two compounding P0 root causes, both a fallout of the **Follow Up Boss cutover (2026-06-24)**:

1. **P0-A — the processor still created people through FUB (`sendEvent` → `findPersonByEmail`), which is dead.** `findPersonByEmail`/`findPersonByPhone` return null when FUB creds are gone, so `fubPersonId` never resolved → no person → no tags → no note → no task → **no enrollment** → no CMA. Even the 17 rows where skip-trace resolved a real phone/email created zero people.
2. **P0-B — `BATCHDATA_API_KEY` is missing/invalid on Vercel production.** County records resolve the owner NAME, but the BatchData skip-trace returns null → no phone/email → `hasReachableOwnerContact=false` → the listing is dropped as `no-contact-skip-fub`. 81 of 98 rows are stuck here. (The key WORKS — proven by a live local smoke test; it's an env-var gap on prod.)

Plus two P1s:

3. **P1-C — the alert email to Matt never sends** (`alert_sent_at` NULL on 100% of rows). It hard-coded an **unverified** Resend sender (`alerts@mail.ryan-realty.com`) that Resend rejects, and linked to a **dead FUB deep-link**.
4. **P1-D — 10 early enrollments stuck `paused`** since 2026-06-16 (secondary; not the cause of the 0-new-enrollment break).

**Compliance verdict: SAFE.** No outreach was going out at all, so there was zero TCPA/DNC exposure. The suppression + hard-stop + DNC gating is intact and correctly fail-closed. The fix does NOT weaken any of it; it restores compliant enrollment (email-first, suppression-gated) only.

---

## Root-cause chain (the "0 active enrollments" break, fully traced)

```
sync-delta cron (every 15m)  →  processNewExpiredListings()
  → county lookup resolves OWNER NAME (works, no key needed)
  → BatchData skip-trace  →  ✗ returns null (BATCHDATA_API_KEY missing on Vercel)   [P0-B]
      → hasReachableOwnerContact = false
      → 'no-contact-skip-fub'  → NO person, NO enrollment, NO CMA
  → (even when Tracerfy fallback DID resolve contact, 17 rows:)
      → sendEvent() → findPersonByEmail() [FUB API, dead]  → null   [P0-A]
      → fubPersonId stays null → stats.errors++ → NO person → NO enrollment
  → sendExpiredAlertEmail()  →  ✗ Resend rejects unverified alerts@ sender   [P1-C]
```

Net effect at HEAD (verified by query 2026-07-03):
`expired_listings`: 98 total · 43 in last 7d · **13 has_person · 0 lookup_matched · 81 pending · 0 alerted**.
`crm_sequence_enrollments` seq 3 (Expired Recovery): 13 total, **0 running/awaiting** — 10 paused, 2 stopped, 1 suppressed. Last enrollment 2026-06-12.

---

## Per-stage findings

| # | Stage | Verdict | Evidence |
|---|---|---|---|
| 1 | **Detection** | ✅ WORKING | `expired_listings`: 98 rows, 43 in 7d, latest `2026-07-03 00:18`. Trigger is `/api/cron/sync-delta` (every 15m, `3,18,33,48 * * * *`) → `processNewExpiredListings`, NOT a dedicated cron (the `detect-expired-listings` route is manual-only since 2026-05-22). Dedup by `listing_key` works. |
| 2 | **Contact creation + enrichment** | ⛔ BROKEN → ✅ FIXED | County lookup resolves owner name for every row (Deschutes assessor, no key). BatchData skip-trace returns null on prod (`enrichment_notes` literally reads *"Skip trace unavailable (check BATCHDATA_API_KEY on Vercel)"*). **BatchData proven working via live local smoke test** on the exact address `26695 Horsell, Bend` → 5 phones + 1 email + DNC flag. So the API is fine; the key is missing on Vercel. Separately, the processor's person-creation went through dead FUB APIs. |
| 3 | **Auto-enrollment** (PRIME SUSPECT) | ⛔ BROKEN → ✅ FIXED | The sequence exists + is active (crm_sequences id 3, `fub_legacy_plan_id=71`, 3 steps). The 90 backfill contacts carry `intent:expired-listing` (good) but are ALL pre-epoch (`created_at 2026-06-10`, `import:expired-backfill-2026`) so the `ENROLLMENT_EPOCH` guard (correctly) skips them. The LIVE break: no NEW person is ever created (stages 2 + P0-A), so there is nothing to enroll. Also two enrollment wiring bugs: the processor + LP call `autoEnrollByFubId` (resolves by `fub_legacy_id`) with a NATIVE crm id → miss. |
| 4 | **Outreach sends** | ⚠️ BLOCKED UPSTREAM | The sequence engine (`crm-sequence-engine`, every 15m) only processes `status='running'` + `crm_sequences.status='active'`. There were 0 such enrollments, so nothing to send. Proven: a freshly-enrolled native lead IS picked up by the engine's exact query (test below). Sends stay email-first + suppression-gated. |
| 5 | **Compliance** | ✅ SAFE | No outreach was flowing → zero exposure. `owner.complianceTags` (litigator / DNC / hard-stop) map correctly onto the person. `autoEnrollPerson` is fail-closed on hard-stop + one-master-sequence-per-person. The engine's `isSuppressed` chokepoint + quiet-hours are intact. The fix preserves all of it. |
| 6 | **The LP** (`/lp/expired-listing`) | ✅ WORKING (1 wiring bug fixed) | Renders clean at localhost (H1 "YOUR LISTING EXPIRED. HERE IS THE HONEST READ.", empathy copy, Matt broker card, FUB-tracked bio phone 541.703.3095, form). Voice-compliant per §4.7 (no "most agents do X" framing). Zero console errors. Bug fixed: the native-fallback tagged `intent:expired` (not `-listing`) and passed a native id to `autoEnrollByFubId`. |
| 7 | **Alerting + reporting** | ⛔ BROKEN → ✅ FIXED | `alert_sent_at` NULL on 100% of rows (never sent). Cause: unverified `alerts@mail.ryan-realty.com` sender + dead FUB deep-link. Reporting (`expired_listings` counts) is accurate. |

---

## The fix (shipped this session)

CRM-native rewire of the whole downstream — no FUB round-trip anywhere.

**`lib/expired-listing-processor.ts`** — replaced the FUB `sendEvent → findPersonByEmail` person-resolution with the canonical native path used by the LP forms:
- `ensureNativeLead()` creates/reuses the `crm_people` row (email-first, then phone dedup) → returns a native id.
- `enrichNativeLead()` stamps the tags (`intent:expired-listing` + status + `audience:seller` + compliance tags), the `custom` fields (incl. `customClassification: 'EXPIRED'`), and the listing-context origin note.
- `createNativeTask()` for the 60-min call task.
- `autoEnrollPerson(crmPersonId)` enrolls **directly by native id** (not `autoEnrollByFubId`), firing the first email touch of Plan 71 automatically. A fresh native person is post-epoch, so it passes the enrollment gate.
- CMA queued via `createCmaRequest({ crmPersonId })`.
- The `no-contact` branch (county name but no reachable phone/email) still SKIPS person creation per Matt's 2026-06-09 "no placeholder leads without real contact" directive, but the audit row + the (now-working) alert still fire so nothing is lost.

**`lib/expired-alert.ts`** — fixed the never-sending alert:
- `resolveAlertFrom()` uses the verified `RESEND_FROM` sender (never the unverified `alerts@`), and never double-wraps a value that already carries a display name.
- `crmLink()` deep-links to `/admin/crm/<id>` (the in-house CRM), not the dead `app.followupboss.com` URL.

**`lib/cma-request.ts`** — added a `crmPersonId` input so the CMA slug stamps onto a native lead by id (the old path only resolved by `fub_legacy_id`).

**`lib/crm/enroll.ts`** — `autoEnrollByFubId` now falls back to treating its arg as a native `crm_people.id` when the `fub_legacy_id` lookup misses (fixes the LP + any post-cutover caller).

**`app/lp/expired-listing/actions.ts`** — native-fallback tag corrected to `intent:expired-listing`; CMA call uses `crmPersonId`.

**Tests:** `lib/expired-alert.test.ts` (6 tests) locks the alert From resolution + the CRM (non-FUB) deep-link.

### E2E proof (net-zero)

A test contact was created via the exact native shape the processor now writes, then run through the real enrollment logic:
```
created test person 52299
post-epoch: true (created_at 2026-07-03T01:53:31Z)   ← passes ENROLLMENT_EPOCH gate
target seq: 3 Expired Recovery (auto) active
ENROLLED: {"status":"running","step_index":0}
ENGINE WOULD PROCESS: true  ← the sequence engine's exact query picks it up
CLEANUP: person 52299 deleted ✅ (net-zero)
```

Gates: `npm run ci:gates` exit 0. Tests: `vitest run` 2479 pass.

---

## What still needs Matt (NOT code — credentials/env)

1. **Set `BATCHDATA_API_KEY` on Vercel production.** This is the last gate on owner contact for the 81 pending listings. The key is valid (proven locally); it's just not in the prod env. Once set, new detections resolve phone/email → create a person → auto-enroll into Plan 71 → email-first outreach flows (compliance-gated).
2. **Confirm `RESEND_FROM` on prod** is the verified `mail.ryan-realty.com` sender (e.g. `noreply@mail.ryan-realty.com`). The alert now uses it. (If unset, the fix falls back to `noreply@mail.ryan-realty.com`, which is verified per the repo memory.)
3. **Optional backfill:** re-run `/api/cron/detect-expired-listings?lookbackHours=168` (with the CRON_SECRET) AFTER the BatchData key is set to re-process the 81 pending listings through the now-working pipeline. (Do NOT run before the key is set — it would just re-mark them pending.)

I did NOT trigger any outreach. The wiring is fixed and proven; real expired leads flow only once the BatchData key lands and the cron next runs.

---

## Deferred / secondary (P1-D)

The 10 `paused` enrollments in seq 3 (stuck at `step_index=1`, `next_run_at=null` since 2026-06-16) are early backfill/auto-rule leads that the engine paused. They are not the cause of the 0-new-enrollment break and touching them risks re-sending to leads that may have already been contacted. Left as-is; recommend Matt review whether to resume or archive them once the live pipeline is confirmed flowing.
