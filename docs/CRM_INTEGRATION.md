# CRM Integration — Follow Up Boss lead flow

**Status 2026-06-17.** Authoritative spec for how leads enter and move through
Follow Up Boss (FUB), derived from an adversarially-verified 2026 CRM deep-research
pass (run `wf_eed8569d-ca5`) cross-referenced against the live code. Load-bearing
invariants are **locked by the `ci:crm-lead-integrity` gate (G49)**. Items that
change live lead-handling behavior are a **backlog that ships on a careful,
live-verified pass** (paid-lead paths must not break).

## The rule that anchors everything: events, not people

Every inbound lead (ads, organic, on-site form) MUST be created via **POST `/v1/events`**,
never **POST `/v1/people`**. Only `/events`:
- runs FUB's native **deduplication** (by email, or phone + name),
- fires **action plans / automations**, and
- triggers the **speed-to-lead initial auto-text** (Lead Flow).

A `/people`-created lead is silently NOT auto-texted, runs no automation, and can
duplicate. FUB's own docs: *"Do not use POST /v1/people to send leads into Follow
Up Boss."* (3-0 verified.)

## Flow

```
ad / organic / form ──► POST /v1/events (sendEvent)  ─┬─ dedup (email | phone+name)
   type = Registration / *Inquiry                      ├─ action plan fires
   person carries email and/or phone                   ├─ Lead Flow initial auto-text (<=5 min)
   source + campaign stamped                           └─ returns/links the person
        │
   apply tags / stage / custom fields / assignment (PUT /v1/people/{id})  ← updates, fine
        │
   FUB pipeline ──► close/won ──► [BACKLOG] webhook (dealsUpdated) ──► offline upload to Google/Meta
```

## Principles → status → enforcement

| # | Principle (research-verified, FUB docs) | Status | Enforcement |
|---|---|---|---|
| 1 | Inbound leads via **POST /v1/events**, never /v1/people | ⚠️ forms ✅ / Meta webhook ✗ (tracked) | **G49** (locks + tracks the 1 violation) |
| 2 | Event carries a **dedup identifier** (email and/or phone) | ✅ (sendEvent person always has email) | code review + DAL |
| 3 | **source** stamped on every event (attribution survives) | ✅ (`SendEventParams.source` required) | **G49 item 3** |
| 4 | Event **type** is action-plan-eligible (Registration / Seller / Property / General Inquiry), not a passive type | ✅ (forms use Inquiry types) | code review |
| 5 | **POST /v1/textMessages is log-only**, never a send path | ✅ (no POST today; reads only) | **G49 item 2** (tripwire) |

## Backlog — ship on a careful, live-verified pass

1. ~~**Meta Lead Ads webhook → `/v1/events`.**~~ ✅ **DONE 2026-06-17 (events-first, fallback-safe).**
   `app/api/meta/lead-webhook/route.ts` `createFubContact` now creates leads via `sendEvent`
   (POST `/v1/events`, type Seller/General Inquiry by audience, person with email+phone+tags,
   source `Facebook Lead Ad — <campaign>`, campaign object), resolves the person id via
   `findPersonByEmail`/`findPersonByPhone`, then sets custom fields + stage `Lead` + mirrors.
   Paid Meta leads now get dedup + action plans + the speed-to-lead auto-text. The original
   `/people` POST is preserved as a **fallback** if the events path fails, so a lead is never
   lost. **Verify the first live Meta lead post-deploy** (events 204 + person resolution timing).
   REMAINING polish: set the FUB pipeline on the events path too (currently only the fallback
   sets it); confirm `customBuySellIntent` / `customFbCampaignName` custom fields exist in FUB.
2. **Stamp the `campaign` object on form events.** ✅ **DONE 2026-06-17 across the public
   lead forms** — seller-home-value, fsbo, contact, home-valuation, expired-listing,
   buyer-listing-alerts, and tetherow/heath all now capture origin UTMs from the referer and
   send the structured FUB `campaign` object (source/medium/campaign/content), gated on
   utm_source. lead-landing already had a richer always-attribute campaign (kept). The
   remaining sendEvent callers either take `campaign` via a `CampaignInput` param
   (lead-capture: page-CTA / rental / tetherow / exit-intent) or are internal/admin paths
   (crm, agents, home, cma, crons) — not public ad-lead forms, so out of scope.
3. **FUB webhooks + offline-conversion upload (closed-loop ROAS).** No FUB webhook handler
   exists today. Add one for `dealsUpdated` (close/won) that **decouples**: persist the
   event (resourceId + uri only — FUB payloads are thin) to a queue table, then a separate
   process GETs the resource and uploads the conversion to Google (Enhanced Conversions for
   Leads: GCLID or hashed PII + conversion name + time + Order ID) and Meta CAPI offline.
   This is the same closed loop as TRACKING_POLICY backlog #2.
4. **Speed-to-lead config.** Confirm each active Lead Flow source has an initial-text rule
   with delay ≤ 5 minutes (FUB Admin config, not code). Contact odds drop ~100x from 5 to
   30 minutes (MIT/InsideSales study).

## Avoid

- **Never POST /v1/people to create a lead** (no automations, dupes). Locked by G49.
- **Never treat POST /v1/textMessages as a send** — it only logs; FUB cannot send for
  integrations. Real sends go through the approved sender + the TCPA consent gate
  ([[a2p-sms-consent]] / `ci:sms-consent`).
- **Never auto-text before a stored consent record** (TCPA prior-express-written-consent
  is still required in 2026; the one-to-one bundling rule was vacated but core consent stands).
- **Don't act on FUB webhook payload bodies** beyond resourceId/uri — fetch the resource.

## References

- Research: deep-research run `wf_eed8569d-ca5` (this session).
- FUB docs: events-post, people-post, lead-provider-integration-guide, webhooks-guide,
  textmessages-post; Google Ads Enhanced Conversions for Leads (answer 14274408).
- Code: `lib/followupboss.ts` (`sendEvent`), `app/api/meta/lead-webhook/route.ts`,
  `app/lp/*/actions.ts`, `app/contact/actions.ts`.
