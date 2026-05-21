# FB Lead Form → FUB audit (audience:buyer tag gap)

**Symptom.** 13,276 contacts in FUB, only 37 carry the `audience:buyer` tag.
The FB Lead Form → FUB integration is supposed to apply that tag on every
buyer-side FB lead.

## Root cause

**The Meta page-level webhook subscription points to a different Vercel
project, not to this repo.** Meta is delivering every `leadgen` event to
`https://ryan-realty-lps.vercel.app/api/fb-lead-webhook`, which is the legacy
LP site. This repo's webhook at
`https://ryanrealty.vercel.app/api/meta/lead-webhook` is correctly
implemented and ready to apply `audience:buyer`, `audience:seller`,
`source:fb-ads-buyer`, etc. (see `app/api/meta/lead-webhook/route.ts` lines
352-378), but Meta has never delivered a single payload to it.

Confirmed live against the Meta Graph API:

```
GET /v21.0/901712509522992/subscribed_apps
=> "data":[{
     "category":"Business",
     "name":"Ryan Realty",
     "subscribed_fields":["leadgen"]
   }]

GET /v21.0/<APP_ID>/subscriptions (filtered to the leadgen page object)
=> "data":[{
     "object":"page",
     "callback_url":"https://ryan-realty-lps.vercel.app/api/fb-lead-webhook",
     "active":true,
     "fields":[{"name":"leadgen","version":"v25.0"}]
   }]
```

The legacy LP project either does not exist as a code path inside this repo or
does not apply `audience:buyer` the way the new `meta/lead-webhook` handler
does. Either way, no FB-ad lead is landing with the canonical schema tags.

Live FUB confirms the gap:

| Tag query | `_metadata.total` |
| --- | --- |
| `audience:buyer` | 37 (none from FB Lead Ads) |
| `audience:seller` | 3,492 (mostly from seller LP + IDX paths) |
| `source:fb-ads-buyer` | 0 |
| `source:fb-ads-seller` | 0 |
| `FB Lead Ad` | 0 |
| `source=Facebook Lead Ad` | 0 |
| `source=Facebook` | 4 (oldest 2025-07, newest 2025-12) |

## Fix (single step, no code change required)

Repoint the Meta webhook callback URL from
`https://ryan-realty-lps.vercel.app/api/fb-lead-webhook` to
`https://ryanrealty.vercel.app/api/meta/lead-webhook`.

### Step-by-step

1. **Confirm `META_WEBHOOK_VERIFY_TOKEN` is set in Vercel env for this repo.**
   The GET handler at `app/api/meta/lead-webhook/route.ts:534` enforces it when
   present. If unset, Meta's "subscribe" challenge will still pass (the handler
   replies to any `hub.mode=subscribe` with a `hub.challenge` echo when no
   token is configured). Pick the same value that the legacy LP site used so
   Meta's subscribe step succeeds first try.

2. **Update the subscription on the Meta side.** Two options:

   **Option A — Meta App Dashboard (UI).** App Dashboard → Webhooks → Page →
   Edit Subscription. Change the Callback URL to
   `https://ryanrealty.vercel.app/api/meta/lead-webhook` and the Verify Token
   to `META_WEBHOOK_VERIFY_TOKEN`. Save.

   **Option B — Graph API (CLI).** From a shell with `META_APP_ID`,
   `META_APP_SECRET`, and `META_WEBHOOK_VERIFY_TOKEN` set:

   ```bash
   curl -X POST \
     "https://graph.facebook.com/v21.0/$META_APP_ID/subscriptions" \
     -d "object=page" \
     -d "callback_url=https://ryanrealty.vercel.app/api/meta/lead-webhook" \
     -d "fields=leadgen" \
     -d "verify_token=$META_WEBHOOK_VERIFY_TOKEN" \
     -d "access_token=$META_APP_ID|$META_APP_SECRET"
   ```

3. **Verify the page is still subscribed** (one-time, after the app-level
   callback flips):

   ```bash
   curl -s "https://graph.facebook.com/v21.0/$META_FB_PAGE_ID/subscribed_apps?access_token=$META_PAGE_ACCESS_TOKEN"
   ```

   `subscribed_fields` should include `leadgen`.

4. **Send a test lead** through one of the live FB lead forms. Within 60
   seconds, a new FUB person should appear with these tags:

   - `FB Lead Ad`
   - `audience:buyer` or `audience:seller`
   - `source:fb-ads-buyer` or `source:fb-ads-seller`
   - one of `buyer:hot|buyer:warm|buyer:nurture|seller:hot|seller:warm|seller:nurture`

5. **Decommission the legacy LP webhook** (optional, after step 4 verifies the
   new path works). Either delete the `ryan-realty-lps` Vercel project or
   leave it inactive — it will stop receiving payloads as soon as Meta accepts
   the new callback URL.

### What is NOT broken (verified)

- `app/api/meta/lead-webhook/route.ts` already applies the canonical tag
  schema: `audience:buyer` or `audience:seller`, kebab-case tier tags
  (`buyer:hot`, `seller:warm`, etc.), and `source:fb-ads-buyer` or
  `source:fb-ads-seller`. Lines 352-378.
- HMAC signature verification against `META_APP_SECRET` is in place (line 99).
- Hot-lead 5-minute realtime tasks fire when intent classifies as `hot` and
  the lead is not a realtor (line 487).
- The `META_USER_ACCESS_TOKEN` (with `leads_retrieval` scope) is set in env
  and is used to fetch `field_data` for each lead (line 56).

In other words: the handler is ready. Meta is just not calling it.

## Code patch

No code patch needed. The existing handler is correct. The fix is a
configuration change in Meta's webhook subscription.

If we ever want defense in depth against this class of bug, the
`/api/cron/marketing-snapshot-meta-page` snapshot could publish a daily
metric for "FB Lead Ad payloads received in the last 24 hours," and trigger
an iMessage alert via `comms:matt_summary` when it goes to zero for more
than 2 days while ad spend is non-zero. That belongs in a follow-up task.
