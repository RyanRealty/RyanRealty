# Lead Capture & Tracking Flow Audit

**Date:** 2026-04-01
**Scope:** All lead capture and tracking flows from user interaction to database write and Follow Up Boss (FUB) API call.

---

## Executive Summary

Audited 9 files covering all lead capture flows. Found **6 bugs**, **5 missing error handling issues**, and **4 design concerns**. The most impactful bug is that the core FUB integration functions (`sendEvent()`, `findPersonByEmail()`, `pushToFub()`) do not catch `fetch()` network errors, meaning any DNS failure, timeout, or connection refusal will crash every lead capture flow that touches FUB.

---

## Flow-by-Flow Audit

### 1. `app/home-valuation/actions.ts` — submitValuationRequest()

**Path:** FormData → validate → DB insert (`valuation_requests`) → FUB "Seller Inquiry" → admin email → auto-CMA PDF email

| Check | Status |
|-------|--------|
| Code path complete? | Yes |
| DB write | `valuation_requests` via service role — works |
| FUB event type | `Seller Inquiry` — correct |
| FUB payload | Person (name, email, phone), property (street, city, state, code), message — correct |
| Error handling | Partial |

**Issues found:**

1. **BUG — `getServiceSupabase()` throws instead of returning `{ error }`** (line 21). If `SUPABASE_SERVICE_ROLE_KEY` is missing, the function throws `new Error('Server not configured')`. This violates the project's error handling rule (server actions must return `{ error }`, never throw). The main flow at line 82 calls this without try/catch, so a missing env var crashes the action.

2. **BUG — `sendEvent()` network errors crash the action** (line 96). The FUB call is `await sendEvent(...)`. If `fetch()` throws a network error, the exception propagates uncaught. The lead IS saved in the database before this call, so the DB record survives, but the user sees a generic error instead of `{ success: true }`.

3. **Minor — Redundant Supabase client creation.** `getServiceSupabase()` (line 18, creates new client each call) and `createServiceClient()` (line 141, cached singleton) both create service-role clients. Inconsistent but not a bug.

---

### 2. `app/contact/actions.ts` — submitContactForm()

**Path:** FormData → validate email → FUB "General Inquiry" → admin email notification (fire-and-forget)

| Check | Status |
|-------|--------|
| Code path complete? | Yes, but no DB backup |
| DB write | **None** |
| FUB event type | `General Inquiry` — correct |
| FUB payload | Person (name, email, phone), message with inquiry type — correct |
| Error handling | Incomplete |

**Issues found:**

4. **BUG — No database persistence.** Unlike every other lead capture flow (valuation_requests, listing_inquiries, open_house_rsvps), contact form submissions are NOT written to any database table. If FUB is temporarily unreachable, **the lead is permanently lost**. The admin email notification is fire-and-forget (`.catch(() => {})`), so if both FUB and email fail, there is zero record of the submission.

5. **Missing try/catch.** If `sendEvent()` throws (fetch network error), the server action throws to the client instead of returning `{ error }`. The function signature promises `ContactFormState` but can throw.

---

### 3. `app/api/pdf/cma/route.ts` — CMA PDF Download

**Path:** Rate limit → auth check → parse body → compute CMA → fetch property/listing → render PDF → FUB "Property Inquiry" → return PDF

| Check | Status |
|-------|--------|
| Code path complete? | Yes |
| DB write | CMA computation writes to `valuations` and `valuation_comps` (inside `computeCMA()`) |
| FUB event type | `Property Inquiry` — correct |
| FUB payload | Person (email only), property (street, url), message "Downloaded CMA" — correct |
| Error handling | Partial |

**Issues found:**

6. **BUG — FUB error crashes PDF delivery** (line 88). `await sendEvent(...)` is called AFTER the PDF buffer is generated but BEFORE the response is returned. If `sendEvent()` throws (network error), the user gets a 500 error instead of their PDF, even though the PDF was successfully generated. The FUB call should be fire-and-forget or wrapped in try/catch.

7. **`sendEvent()` return value is ignored** (line 88). The result of the FUB call is not checked. A non-throwing FUB error (e.g., 4xx response) is silently discarded. This is acceptable for a PDF download but worth noting.

8. **`getServiceSupabase()` throws** (line 17). Same pattern as Flow 1 — throws on missing env vars instead of returning an error response.

---

### 4. `app/actions/track-contact-agent.ts` — submitListingInquiry()

**Path:** Params → DB insert (`listing_inquiries`) via service role → FUB "Property Inquiry" via `trackContactAgentInquiry()`

| Check | Status |
|-------|--------|
| Code path complete? | Yes |
| DB write | `listing_inquiries` — works |
| FUB event type | `Property Inquiry` (via `trackContactAgentInquiry()`) — correct |
| FUB payload | Person (email or fubPersonId), property (street, mlsNumber, price), message (showing/question) — correct |
| Error handling | Incomplete |

**Issues found:**

9. **BUG — FUB error after successful DB write causes false failure** (line 61). `await trackContactAgentInquiry(...)` is called after the DB insert succeeds. If `trackContactAgentInquiry()` → `sendEvent()` → `fetch()` throws a network error, the function throws even though the inquiry IS saved. The user sees an error and may re-submit, creating duplicates.

10. **No try/catch wrapper.** The server action can throw on any network error in the FUB call chain.

11. **`trackContactAgentEmail()` has no error handling** (line 21-26). It directly `await`s `trackContactAgentInquiry()` with no catch. Callers (e.g., `ListingCtaSidebar.tsx`) will see an unhandled rejection if FUB is unreachable.

---

### 5. `app/api/open-houses/rsvp/route.ts` — Open House RSVP

**Path:** Auth check → parse body → validate open house → DB insert (`open_house_rsvps`) → increment `rsvp_count` → queue reminder notifications → FUB "Open House RSVP" via `pushToFub()`

| Check | Status |
|-------|--------|
| Code path complete? | Yes |
| DB write | `open_house_rsvps` + `open_houses.rsvp_count` + `notification_queue` |
| FUB event type | `Open House RSVP` (via `pushToFub()` from `lib/fub.ts`) |
| FUB payload | Person (email, firstName, lastName), listingUrl, eventDate, tags — correct |
| Error handling | Partial |

**Issues found:**

12. **BUG — Race condition on `rsvp_count`** (lines 67-68). The code reads `oh.rsvp_count`, then writes `currentCount + 1`. Two concurrent RSVPs can both read the same count and each write `count + 1`, losing an increment. This should use an atomic SQL increment (`rsvp_count = rsvp_count + 1`) or an RPC.

13. **BUG — `pushToFub()` network errors crash the response** (line 99). `await pushToFub(...)` is called after all DB writes succeed. `pushToFub()` in `lib/fub.ts` does NOT wrap `fetch()` in try/catch. A network error throws, and the RSVP route has no catch, so the user gets a 500 error even though their RSVP was saved successfully.

14. **`pushToFub()` return value not checked** (line 99). If FUB returns a non-200 response, the error is silently lost. The user's RSVP succeeds from a DB perspective, but FUB may not have received it.

15. **Notification queue insert errors are silently lost** (lines 77-93). The `await service.from('notification_queue').insert(...)` calls don't check the returned `{ error }`. If the insert fails (e.g., missing table, constraint violation), no reminder emails will be queued and no one is notified.

16. **Different FUB integration module.** This is the ONLY flow that uses `pushToFub()` from `lib/fub.ts` (system: `ryan-realty-platform`). All other flows use `sendEvent()` from `lib/followupboss.ts` (system: `Ryan Realty Website`). This means RSVP events appear in FUB under a different system identifier, which could confuse FUB automations and reporting.

---

### 6. `app/actions/saved-listings.ts` — Save Listing

**Path:** Auth check (cookie session) → DB insert (`saved_listings`) → increment `engagement_metrics.save_count`

| Check | Status |
|-------|--------|
| Code path complete? | Yes (DB only; FUB tracking is handled separately by the client) |
| DB write | `saved_listings` + `engagement_metrics` — works |
| FUB event | Not in this file — handled by `SaveListingButton.tsx` calling `trackSavedPropertyAction()` |
| Error handling | Acceptable |

**Issues found:**

17. **Race condition on `save_count`** (in `engagement.ts` lines 139-155). Same read-then-update pattern as `rsvp_count`. Two concurrent saves can lose an increment. Applies to all `increment*Count` / `decrement*Count` functions in `engagement.ts`.

18. **FUB tracking is optional and conditional.** `SaveListingButton` only calls `trackSavedPropertyAction()` when `userEmail`, `listingUrl`, AND `property` are all provided. If any is missing (e.g., on pages that don't pass all props), the FUB event is silently skipped. This is by design but means FUB tracking coverage for saved listings depends on prop drilling.

---

### 7. `app/auth/callback/route.ts` — Auth Callback with FUB Tracking

**Path:** Parse redirect target → handle OAuth error → exchange code/verify OTP → FUB "Registration" via `trackSignedInUser()` (fire-and-forget) → redirect

| Check | Status |
|-------|--------|
| Code path complete? | Yes |
| DB write | Session created by Supabase auth (implicit) |
| FUB event type | `Registration` — correct |
| FUB payload | Person (id or email+name), source, message (sign-in method) — correct |
| Error handling | Good |

**Issues found:**

19. **Minor — Missing type guard on magic link `fullName`** (line 72). The OAuth flow (line 47-48) checks `typeof name === 'string'` before passing to `trackSignedInUser()`. The magic link flow (line 72) does not — `user_metadata.full_name` could be any JSON type. `trackSignedInUser()` handles this with `String(params.fullName).trim()`, so it won't crash, but non-string values would produce garbled FUB names like `"[object Object]"`.

20. **Good pattern:** `.catch((err) => { Sentry.captureException(err) })` on `trackSignedInUser()` calls. This correctly handles the `fetch()` throw issue from `sendEvent()` by catching at the call site. This is the ONLY flow that properly catches FUB network errors.

---

### 8. `lib/tracking.ts` — Client-Side Tracking Events

**Path:** Pure client-side. Pushes events to `window.dataLayer` (GA4/GTM) and `window.fbq` (Meta Pixel).

| Check | Status |
|-------|--------|
| Code path complete? | Yes (client-side only) |
| Error handling | N/A (fire-and-forget DOM operations) |

**Issues found:**

21. **No issues.** All functions are safe fire-and-forget pushes. Proper `typeof window === 'undefined'` guards for SSR. GA4 event taxonomy is well-structured. `trackSaveListing` correctly fires both `saved_property` + `generate_lead` + Meta `Lead`.

---

### 9. `lib/followupboss.ts` — FUB API Integration

**Path:** Central FUB integration module. All `sendEvent()`, `findPersonByEmail()`, tracking functions, and broker attribution logic.

**Issues found:**

22. **CRITICAL BUG — `sendEvent()` does not catch `fetch()` errors** (line 331). `fetch()` throws `TypeError` on network errors (DNS failure, timeout, connection refused). This exception propagates to every caller. This is the root cause of bugs #2, #5, #6, #9, #13.

    ```ts
    // Current (line 331) — no try/catch
    const res = await fetch(`${FUB_BASE}/events`, { ... })

    // Should be
    let res: Response
    try {
      res = await fetch(`${FUB_BASE}/events`, { ... })
    } catch (err) {
      return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
    }
    ```

23. **CRITICAL BUG — `findPersonByEmail()` does not catch `fetch()` errors** (line 44). This is called by most tracking functions (`trackSignedInUser`, `trackListingView`, `trackContactAgentInquiry`, etc.) BEFORE `sendEvent()`. A network error here crashes the flow before any event is sent.

24. **`findUserByEmail()` does not catch `fetch()` errors** (line 143). Affects broker attribution resolution.

25. **`trackListingTileClick()` sends empty person object** (line 532). When no `userEmail` and no `fubPersonId`, it sends `person: {}` to FUB. The FUB Events API requires a person with at least an email to create/match a contact. This will likely result in a 400 error from FUB, which is silently ignored since `trackListingTileClick()` returns `void`.

26. **`trackContactAgentInquiry()` sends empty person object** (line 637). Same issue as above when called without email or fubPersonId.

27. **Good pattern noted:** `updatePersonAttribution()` (line 244) correctly uses `.catch(() => null)` on its fetch call. This shows awareness of the issue — it just wasn't applied to the other fetch calls.

---

## Cross-Cutting Issues

### A. Dual FUB Integration Modules

Two separate modules call the same FUB Events API:

| Module | System identifier | Used by |
|--------|------------------|---------|
| `lib/followupboss.ts` | `Ryan Realty Website` | All flows except RSVP and batch-views |
| `lib/fub.ts` | `ryan-realty-platform` | Open house RSVP, batch property views |

This creates inconsistency in FUB: events from the same website appear under two different systems. FUB automations, reporting, and lead routing may behave differently depending on which module sent the event.

### B. Race Conditions on Counters

Three locations use a non-atomic read-then-update pattern for incrementing/decrementing counters:

1. `open_houses.rsvp_count` in RSVP route (line 67-68)
2. `engagement_metrics.save_count` in `incrementListingSaveCount()` / `decrementListingSaveCount()`
3. `engagement_metrics.like_count`, `share_count`, `view_count` in similar functions

Under concurrent requests, these can lose increments. Fix: use SQL `column = column + 1` or an RPC.

### C. `getServiceSupabase()` Pattern

Three files define a local `getServiceSupabase()` that throws on missing env vars:
- `app/home-valuation/actions.ts` (line 21)
- `app/api/pdf/cma/route.ts` (line 17)
- `app/api/open-houses/rsvp/route.ts` (line 11)

The project also has `lib/supabase/service.ts` with `createServiceClient()` (also throws but is cached). These should be consolidated.

---

## Summary Table

| # | Severity | Flow | Issue |
|---|----------|------|-------|
| 22 | **Critical** | All FUB flows | `sendEvent()` doesn't catch `fetch()` network errors |
| 23 | **Critical** | All FUB flows | `findPersonByEmail()` doesn't catch `fetch()` network errors |
| 4 | **High** | Contact form | No database persistence — leads lost if FUB is down |
| 12 | **High** | RSVP | Race condition on `rsvp_count` (non-atomic increment) |
| 6 | **Medium** | CMA PDF | FUB error blocks PDF delivery to user |
| 9 | **Medium** | Listing inquiry | FUB error after DB success returns false failure |
| 13 | **Medium** | RSVP | `pushToFub()` network error crashes response after DB success |
| 5 | **Medium** | Contact form | No try/catch — throws instead of returning `{ error }` |
| 17 | **Medium** | Save listing | Race condition on engagement counters |
| 25-26 | **Low** | Tile click, contact agent | Empty person sent to FUB when no identity |
| 16 | **Low** | RSVP | Notification queue errors silently lost |
| 19 | **Low** | Auth callback | Missing type guard on magic link fullName |
| 1, 8 | **Low** | Valuation, CMA PDF | `getServiceSupabase()` throws instead of returning error |
| A | **Design** | All | Dual FUB modules with different system identifiers |
| C | **Design** | Multiple | Redundant `getServiceSupabase()` definitions |
