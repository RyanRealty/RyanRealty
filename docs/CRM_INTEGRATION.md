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

1. **Meta Lead Ads webhook → `/v1/events` (HIGHEST VALUE).** `app/api/meta/lead-webhook/route.ts`
   currently `POST`s `/v1/people`, so **paid Meta leads bypass dedup + action plans +
   the speed-to-lead auto-text** — the most expensive leads get the worst handling.
   Migrate to `sendEvent` (type by audience: Seller/Property/General Inquiry; person
   with email+phone; source `Facebook Lead Ad — <campaign>`; campaign object), then
   resolve the person id (email lookup) and re-apply the existing tags/stage/customFields/
   assignment via the PUT helpers. Needs live FUB verification (events 204 + person
   resolution) before it replaces a live paid-lead path. Tracked in G49's `KNOWN_PEOPLE_POST`.
2. **Stamp the `campaign` object on form events.** ✅ **Seller LP done 2026-06-17** —
   `app/lp/seller-home-value/actions.ts` now sends the structured `campaign` object
   (source/medium/campaign/content) from the captured origin UTMs on the full submission.
   REMAINING: do the same on the other lead actions (contact, home-valuation, buyer-listing-alerts,
   fsbo, expired-listing, listing inquiry, page CTA, rental, broker contact) — each already
   has UTM access via the referer; add the same conditional `campaign` block to their sendEvent calls.
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
