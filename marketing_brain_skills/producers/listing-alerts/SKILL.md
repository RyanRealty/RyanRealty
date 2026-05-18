---
name: listing-alerts
description: >
  Saved-search backend for buyer landing pages. When a visitor submits the
  "Custom Tetherow alerts" or similar criteria-based form on any community,
  subdivision, or city LP, this producer captures their saved search,
  matches it nightly against new and price-changed listings, and emails a
  branded daily digest with the matching homes. Includes unsubscribe flow,
  pause-on-reply, and an admin queue. Use this skill when Matt says
  "build the alerts backend", "wire up the saved search", "set up listing
  alerts", "build the criteria-matching system", or any time a landing
  page promises new-listing alerts that need real email delivery. Use this
  skill (NOT a generic comms producer) any time the deliverable is an
  automated daily digest of MLS listings matching saved criteria. This
  producer ALSO handles the Supabase migration that creates the
  listing_alerts + listing_alert_matches tables, the Vercel cron route at
  /api/cron/listing-alerts-digest, the Resend email template, and the FUB
  webhook that pauses alerts when a subscriber replies to a broker. The
  output is a working backend, not a static asset.
action_types:
  - ops:listing_alerts_setup
  - ops:listing_alerts_digest_send
  - ops:listing_alerts_pause
  - ops:listing_alerts_unsubscribe
output_type: backend-service
target_platforms: []
asset_destination: app/api/cron/listing-alerts-digest/route.ts + supabase/migrations
auto_inputs: ['listings', 'listing_alerts (after migration)', 'listing_alert_matches (after migration)']
required_inputs: ['action_type']
optional_inputs: ['subscriber_email', 'criteria_jsonb']
estimated_runtime_min: 45
cost_usd_estimate: $0.01 per digest send (Resend pricing)
thumbnail_uri: null
example_outputs: []
---

# listing-alerts

**Scope.** Buyer-side saved-search infrastructure for Ryan Realty's
landing-page funnel. When a visitor submits the criteria-based "Custom
alerts" form on any community LP (Tetherow, Pronghorn, etc.), this
producer captures the search criteria, stores it, matches it against the
MLS listings table on a nightly cron, and emails a branded digest of new
matches. The producer also handles subscriber lifecycle: pause-on-reply
when the subscriber engages with a broker via FUB, one-click unsubscribe,
admin reset, criteria edit.

This skill owns the entire saved-search backend: schema migration, API
routes (subscribe, unsubscribe, criteria-edit), cron job, email template,
FUB integration. The skill does NOT render the criteria-capture form on
the LP — that lives inside the `site-community-page` (or sister) producer.
This producer receives the form submission and runs the matching engine.

**Status:** Canonical
**Locked:** 2026-05-18
**Exemplar output:** Working backend across:
- `supabase/migrations/<ts>_listing_alerts.sql`
- `app/api/listing-alerts/subscribe/route.ts`
- `app/api/listing-alerts/unsubscribe/route.ts`
- `app/api/listing-alerts/edit/route.ts`
- `app/api/cron/listing-alerts-digest/route.ts`
- `lib/listing-alerts/match-engine.ts`
- `lib/listing-alerts/email-template.tsx`
- `vercel.json` cron registration
- `app/admin/(protected)/listing-alerts/page.tsx` (admin queue UI)

---

## 1. Scope

### In scope

- `ops:listing_alerts_setup`: one-time DB migration + cron registration + Resend template authoring. Idempotent — running again checks state and only applies missing pieces.
- `ops:listing_alerts_digest_send`: nightly cron at 7:00am PT that finds new matches for every active subscriber and sends digest emails.
- `ops:listing_alerts_pause`: triggered by FUB webhook when a subscriber sends a message to a broker. Auto-pauses for 14 days so we're not double-emailing while a human is engaged.
- `ops:listing_alerts_unsubscribe`: one-click unsubscribe from any digest email. Updates `listing_alerts.status` to 'unsubscribed', stamps `unsubscribed_at`.
- Subscriber subscribe endpoint at `/api/listing-alerts/subscribe` (called from the LP form).
- Criteria edit endpoint for the admin queue (Matt edits criteria on behalf of a subscriber who replied "make it under $2M instead").
- FUB lead creation on every new subscriber (tags include the LP source + criteria summary).
- GA4 + Meta Pixel event firing on subscribe + unsubscribe.
- Email template: branded HTML digest with up to 6 matching listing cards (photo, price, address, beds/baths/sqft, days-on-market, "View" link to /lp/listings/<mls>/).
- Match engine logic: detect new listings (StandardStatus = 'Active' AND CreatedDate > last_sent_at OR ListPrice changed downward by >= 5%).
- Admin queue at `/app/admin/(protected)/listing-alerts/` showing all subscribers, their criteria, last digest sent, match count over the last 30 days.

### Out of scope

- Rendering the criteria-capture form on community/subdivision/city LPs (that lives in `site-community-page`, `site-subdivision-page`, `site-city-page`).
- Sending one-off broker emails (use `ops-email-send` or `comms-client-update`).
- The seller CMA flow (use `cma` producer).
- The buyer's guide PDF (use `buyers-guide` producer).
- Real-time SMS push of new listings (out of scope for v1; SMS is a future iteration).
- Saved searches that span multiple communities (criteria must specify exactly one community_slug OR a city slug, not a "anywhere in Bend" search — that would explode the digest size).

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `ops:listing_alerts_setup` | none | Idempotent. Checks migration status, cron registration, Resend template. Applies missing pieces. |
| `ops:listing_alerts_digest_send` | none | Triggered by Vercel cron at 7:00am PT daily. Walks all `status='active'` subscribers, computes matches, emails digests. |
| `ops:listing_alerts_pause` | `subscriber_email`, `reason` | Triggered by FUB webhook on outbound broker → subscriber message. Pauses for 14 days. |
| `ops:listing_alerts_unsubscribe` | `subscriber_email`, `unsubscribe_token` | Triggered by GET request to `/api/listing-alerts/unsubscribe?token=...` from email link. |

### Payload schema for subscribe (the form submission, not an action_type — this is the inbound API):

```typescript
interface ListingAlertsSubscribePayload {
  email: string;                     // required
  name: string;                      // required
  source_lp: string;                 // 'lp-tetherow-v1' | 'lp-pronghorn-v1' | etc.
  community_slug?: string;           // 'tetherow' | 'pronghorn' | etc.
  city_slug?: string;                // 'bend' | 'sisters' | 'redmond' | (if no community)
  price_min: number;                 // dollars (subscriber selected from dropdown)
  price_max: number;
  beds_min: number;
  baths_min?: number;                // optional; defaults to 0
  sqft_min?: number;                 // optional
  property_type?: string;            // defaults to 'A' (Single-family); 'C' for Condo allowed
  subdivision?: string;              // optional — if subscriber picked a specific sub-neighborhood
  consent_marketing: boolean;        // must be true
  consent_sms?: boolean;             // future SMS feature, capture now even if not used
  utm?: {                            // captured from LP query params
    source?: string;
    medium?: string;
    campaign?: string;
  };
}
```

---

## 3. Full action row schema

```typescript
interface ListingAlertsActionRow {
  id: string;
  action_type:
    | 'ops:listing_alerts_setup'
    | 'ops:listing_alerts_digest_send'
    | 'ops:listing_alerts_pause'
    | 'ops:listing_alerts_unsubscribe';
  target: string;                    // 'system:listing_alerts' or 'subscriber:<email>'
  assigned_producer: 'marketing_brain_skills/producers/listing-alerts';
  payload: Record<string, unknown>;
  data_evidence: {
    audit_source?: string;
    opportunity_area?: string;
  };
  generation_reason: string;
  status: 'pending';
}
```

---

## 4. The recipe

The producer dispatches by `action_type`. Below, recipes for each.

### 4.1 ops:listing_alerts_setup (one-time idempotent)

**Step 1.** Read the action row, set `status='in_production'`.

**Step 2.** Check if the DB tables exist:

```sql
SELECT to_regclass('public.listing_alerts') AS alerts_exists,
       to_regclass('public.listing_alert_matches') AS matches_exists;
```

If both exist, jump to Step 4 (cron + Resend check). If either is missing, generate the migration.

**Step 3.** Author the migration file at
`supabase/migrations/<YYYYMMDDHHMMSS>_listing_alerts.sql`:

```sql
-- listing_alerts: one row per subscriber criteria
CREATE TABLE IF NOT EXISTS public.listing_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL,
  source_lp text NOT NULL,
  community_slug text,
  city_slug text,
  criteria jsonb NOT NULL,                    -- {price_min, price_max, beds_min, baths_min, sqft_min, property_type, subdivision}
  status text NOT NULL DEFAULT 'active',      -- active | paused | unsubscribed
  paused_until timestamptz,
  pause_reason text,
  unsubscribe_token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  utm jsonb,
  fub_lead_id text,
  consent_marketing boolean NOT NULL DEFAULT false,
  consent_sms boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz,
  unsubscribed_at timestamptz,
  CONSTRAINT listing_alerts_email_source_uniq UNIQUE (email, source_lp)
);

CREATE INDEX IF NOT EXISTS listing_alerts_status_idx ON public.listing_alerts (status);
CREATE INDEX IF NOT EXISTS listing_alerts_community_idx ON public.listing_alerts (community_slug);
CREATE INDEX IF NOT EXISTS listing_alerts_city_idx ON public.listing_alerts (city_slug);

-- listing_alert_matches: one row per (alert, listing) match. Tracks what we've sent.
CREATE TABLE IF NOT EXISTS public.listing_alert_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.listing_alerts(id) ON DELETE CASCADE,
  listing_id text NOT NULL,                   -- MLS ListingId
  match_type text NOT NULL,                   -- 'new' | 'price_drop' | 'status_change'
  matched_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  digest_id uuid,                             -- groups matches sent in the same digest email
  CONSTRAINT listing_alert_matches_uniq UNIQUE (alert_id, listing_id, match_type)
);

CREATE INDEX IF NOT EXISTS listing_alert_matches_alert_idx ON public.listing_alert_matches (alert_id);
CREATE INDEX IF NOT EXISTS listing_alert_matches_unsent_idx ON public.listing_alert_matches (sent_at) WHERE sent_at IS NULL;
```

Apply via the Supabase MCP `apply_migration` tool.

**Step 4.** Register the Vercel cron in `vercel.json`:

```json
{
  "path": "/api/cron/listing-alerts-digest",
  "schedule": "0 14 * * *"
}
```

(7:00am PT = 14:00 UTC. Cron runs daily.)

If the entry already exists in vercel.json, no change needed.

**Step 5.** Author the API route at
`app/api/cron/listing-alerts-digest/route.ts`. The route:

- Pulls all `status='active'` subscribers where `last_sent_at < now() - interval '24 hours'` OR `last_sent_at IS NULL`
- For each, runs the match engine (see lib/listing-alerts/match-engine.ts)
- If at least one new match: renders the digest email via the React Email template (lib/listing-alerts/email-template.tsx), sends via Resend, stamps `last_sent_at`, marks the matches as sent in `listing_alert_matches`
- If zero matches: skips the send (no empty emails), but still stamps a `last_checked_at` if we add that column later

**Step 6.** Author the match engine at `lib/listing-alerts/match-engine.ts`:

```typescript
export async function findMatches(alert: ListingAlert, since: Date): Promise<MatchedListing[]> {
  const supabase = createServiceRoleClient()
  const c = alert.criteria

  let q = supabase.from('listings')
    .select('ListingId, ListPrice, OriginalListPrice, StreetNumber, StreetName, ' +
            'BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, CumulativeDaysOnMarket, ' +
            'PhotoURL, SubdivisionName, StandardStatus, ModificationTimestamp')
    .eq('StandardStatus', 'Active')
    .eq('PropertyType', c.property_type ?? 'A')
    .gte('ListPrice', c.price_min)
    .lte('ListPrice', c.price_max)
    .gte('BedroomsTotal', c.beds_min)

  if (c.baths_min) q = q.gte('BathroomsTotal', c.baths_min)
  if (c.sqft_min) q = q.gte('TotalLivingAreaSqFt', c.sqft_min)
  if (c.subdivision) q = q.eq('SubdivisionName', c.subdivision)

  // Geo filter (community OR city)
  if (alert.community_slug) {
    const aliases = await getCommunitySubdivisionAliases(alert.community_slug)
    q = q.in('SubdivisionName', aliases)
  } else if (alert.city_slug === 'bend') {
    q = q.eq('City', 'Bend')
  }

  // Only listings new or price-changed since the last digest
  q = q.gte('ModificationTimestamp', since.toISOString())

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(toMatchedListing)
}
```

**Step 7.** Author the email template at `lib/listing-alerts/email-template.tsx`
(React Email). Brand: navy header with the white horizontal logo, Geist body,
list of up to 6 matching listings with photo + price + address + beds/baths/sqft
+ "View this home" link. Footer with the broker contact card, unsubscribe link,
and the methodology line ("This digest matched <N> Tetherow homes new to the
market in the last 24 hours. Updated daily at 7am Pacific.").

**Step 8.** Author the subscribe endpoint at
`app/api/listing-alerts/subscribe/route.ts`:

- POST handler accepts ListingAlertsSubscribePayload
- Validates required fields + email format + consent_marketing=true
- Upserts the row in `listing_alerts` (ON CONFLICT (email, source_lp) DO UPDATE)
- Creates a FUB lead via the FUB API: tag includes `listing-alerts-subscriber`, `community:<slug>` or `city:<slug>`, `source-lp:<source_lp>`, plus the criteria summary in a custom field
- Returns 200 with `{ success: true, alert_id }`
- Fires gtag + fbq events server-side via the existing analytics helpers

**Step 9.** Author the unsubscribe endpoint at
`app/api/listing-alerts/unsubscribe/route.ts`:

- GET handler accepts `?token=<unsubscribe_token>`
- Sets `status='unsubscribed'`, `unsubscribed_at=now()`
- Tags the FUB lead with `listing-alerts-unsubscribed`
- Returns a confirmation HTML page (branded, with a CTA to resubscribe)

**Step 10.** Author the pause endpoint at
`app/api/listing-alerts/pause/route.ts`:

- POST handler accepts `{ email, reason, duration_days = 14 }`
- Sets `status='paused'`, `paused_until=now() + interval '<duration_days> days'`, `pause_reason=<reason>`
- Triggered by the FUB webhook on outbound broker → subscriber email

The pause endpoint validates a webhook signature header (`FUB_WEBHOOK_SECRET` env var).

**Step 11.** Author the admin queue at
`app/admin/(protected)/listing-alerts/page.tsx`:

- Server component pulling all subscribers from `listing_alerts`
- Sortable table: email, name, source_lp, criteria summary, status, last_sent_at, match count last 30 days
- Inline actions: pause, unpause, unsubscribe, edit criteria (modal with the same form fields)
- Brand: shadcn/ui only, navy on cream

**Step 12.** TypeScript compile check:

```bash
cd /Users/matthewryan/RyanRealty && npx tsc --noEmit 2>&1
```

**Step 13.** Run the migration:

```sql
-- Via Supabase MCP apply_migration tool
```

**Step 14.** Branch, commit, open PR. Branch: `listing-alerts/setup-<prefix>`.

PR body: lists all files added, the migration ID, the cron schedule, the
test plan ("subscribe a test email at /api/listing-alerts/subscribe, wait
for the next cron tick, confirm digest delivery").

**Step 15.** Surface to Matt via the standard PR format.

### 4.2 ops:listing_alerts_digest_send (cron-triggered)

Triggered by Vercel cron at 7:00am PT (14:00 UTC) daily. Calls the existing
`/api/cron/listing-alerts-digest` route (which is itself authored by 4.1).

This action_type exists for manual re-trigger only (Matt: "rerun yesterday's
digest because Resend had an outage"). When triggered manually, the producer:

- Confirms the cron route is healthy via a HEAD request
- Optionally accepts a `subscriber_email_filter` payload field to send only one digest
- Logs the run in `marketing_brain_actions` with the count of digests sent + total matches
- No QA gate beyond email delivery confirmation (Resend success response)

### 4.3 ops:listing_alerts_pause

Direct DB update. No PR needed. No Matt review needed (it's a 14-day pause,
fully reversible).

```sql
UPDATE listing_alerts
SET status='paused',
    paused_until=now() + interval '14 days',
    pause_reason='<reason>',
    updated_at=now()
WHERE email='<email>';
```

Log the action row to `executed`. Surface a one-line confirmation in chat
if invoked manually:

```
Paused: listing alerts for <email> until <date>. Reason: <reason>.
```

### 4.4 ops:listing_alerts_unsubscribe

Same as pause but terminal:

```sql
UPDATE listing_alerts
SET status='unsubscribed',
    unsubscribed_at=now(),
    updated_at=now()
WHERE email='<email>' AND unsubscribe_token='<token>';
```

Validate the token matches (one-click unsubscribe link in the digest email
sends both `email` and `token`).

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | migration, subscriber CRUD, match queries | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Resend | email delivery | `RESEND_API_KEY`, `RESEND_FROM='Ryan Realty <hello@mail.ryan-realty.com>'` |
| Vercel cron | nightly digest trigger | registered in `vercel.json` |
| FUB API | create + tag subscribers as buyer leads | `FOLLOWUPBOSS_API_KEY` |
| FUB webhook | pause-on-broker-engagement | `FUB_WEBHOOK_SECRET` (to validate inbound) |
| React Email | digest template rendering | `@react-email/components` |

---

## 6. Output format

**Draft lands at:** GitHub PR.

```
supabase/migrations/<ts>_listing_alerts.sql
app/api/listing-alerts/subscribe/route.ts
app/api/listing-alerts/unsubscribe/route.ts
app/api/listing-alerts/pause/route.ts
app/api/listing-alerts/edit/route.ts
app/api/cron/listing-alerts-digest/route.ts
lib/listing-alerts/match-engine.ts
lib/listing-alerts/email-template.tsx
lib/listing-alerts/types.ts
app/admin/(protected)/listing-alerts/page.tsx
vercel.json (cron entry added)
out/listing-alerts/setup-trace.json
```

**Surface format (chat reply to Matt):**

```
Listing-alerts backend ready (setup PR):

  PR
    URL: <pr_url>
    Branch: listing-alerts/setup-<prefix>

  BACKEND
    Migration: supabase/migrations/<ts>_listing_alerts.sql
    Cron: /api/cron/listing-alerts-digest at 7:00am PT (14:00 UTC daily)
    Endpoints: subscribe, unsubscribe, pause, edit, admin
    Resend template: lib/listing-alerts/email-template.tsx
    FUB integration: lead create + tag + pause webhook

  TEST PLAN (after PR merge + deploy)
    1. Subscribe a test email via POST /api/listing-alerts/subscribe
    2. Confirm row in listing_alerts table
    3. Confirm FUB lead created with the right tags
    4. Wait for the next 7:00am PT cron tick (or manually trigger)
    5. Confirm digest email delivery
    6. Click the unsubscribe link, confirm row status='unsubscribed'

  VALIDATION
    Voice: PASS (digest template scrubbed for banned words)
    TypeScript: PASS
    Migration safe: PASS (CREATE IF NOT EXISTS, indexes idempotent)

Matt merges the PR in GitHub to ship.
```

Then stop. Wait for Matt to merge.

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-PR` | Matt merges the GitHub PR (for setup action) | Matt only |
| `none` | Digest send + pause + unsubscribe run autonomously after setup | N/A |

This producer uses **`matt-review-PR`** for the one-time setup action, then
**`none`** for ongoing operations (which are read-only or single-user safe).

---

## 8. Status flow

For `ops:listing_alerts_setup`:

```
pending -> in_production -> ready (PR open) -> approved (PR merged) -> executed (Vercel deploy done) -> measured (first digest sent successfully)
```

For `ops:listing_alerts_digest_send`:

```
pending -> in_production -> executed (digest send completes) -> measured (Resend delivery webhook confirms)
```

For `ops:listing_alerts_pause` and `ops:listing_alerts_unsubscribe`:

```
pending -> in_production -> executed (DB row updated)
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Migration already applied | `to_regclass` returns both tables | Skip migration step; continue to cron + Resend setup |
| Resend API key missing | `RESEND_API_KEY` not in env | Surface to Matt with the exact env var name and the Resend dashboard URL to create a key |
| FUB API down | POST /v1/people returns 5xx | Insert the subscriber row, log the FUB failure to `executor_response`, retry the FUB lead creation on the next cron tick |
| Subscriber criteria too broad | More than 50 matches in one digest | Cap the email at 6 cards + a "View N more matches" link to the LP filtered view |
| Subscriber criteria too narrow | Zero matches for 30+ days | Email a one-time "We haven't found a match in 30 days, want to widen your search?" with a link to the criteria-edit form |
| Email bounces (hard) | Resend webhook reports bounce | Set `status='unsubscribed'` with `pause_reason='hard_bounce'` |
| Email bounces (soft) | Resend webhook reports soft bounce | Pause for 7 days; retry next cron tick |
| Duplicate subscribe | Same email + source_lp arrives twice | UPSERT updates criteria; do NOT duplicate the FUB lead |
| Cron skipped (Vercel deploy in flight) | Daily run missed | Manual ops:listing_alerts_digest_send action picks it up; widen the `since` window to capture missed listings |
| Listing source SubdivisionName changes | Existing alert's geo filter stops matching after an MLS source rename | Surface to Matt with the alert ID, old name, new name; do not auto-update |

---

## 10. Related skills and references

**Required reading before executing:**

- `CLAUDE.md` §0 — Data Accuracy
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `CLAUDE.md` "Supabase Database — MANDATORY READ before any SQL"
- `docs/DATABASE_FOR_AI_AGENTS.md` — listings table mixed-case columns + the SFR-only convention
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — email digest copy must pass the same voice guardrail
- `docs/FUB_SELLER_WORKFLOW_2026-05-17.md` — FUB integration pattern (we mirror this for the buyer side)
- `docs/MARKETING_LEAD_FLOW.md` — webhook + dedup detail

**Producers this skill integrates with:**

- `marketing_brain_skills/producers/site-community-page/SKILL.md` — renders the Custom Alerts form that submits to this producer's /subscribe endpoint
- `marketing_brain_skills/producers/site-subdivision-page/SKILL.md` (pending) — same, at the subdivision tier
- `marketing_brain_skills/producers/site-city-page/SKILL.md` (pending) — same, at the city tier
- `marketing_brain_skills/producers/ops-fub-crm/SKILL.md` — FUB lead creation pattern (reuse the same helper)
- `marketing_brain_skills/producers/ops-email-send/SKILL.md` — Resend send pattern (reuse the same client wrapper)

**Sibling backend producers:**

- `app/api/cron/seller-workflow-pause/route.ts` — existing 15-minute cron that pauses the seller-side workflow on broker reply. This producer's pause logic mirrors that pattern.

**Registry entry:**

- `marketing_brain_skills/producers/REGISTRY.md` — Section D (operational producers), row `listing-alerts`. Action types as above. Approval: `matt-review-PR` for setup, `none` for runtime.

---

## 11. Tool gap suggestions

1. **Real-time push (not daily digest).** Today the digest fires once per day at 7am PT. A real-time push for the absolute top-of-funnel match (a brand-new $5M Tetherow listing for a $4-6M-criteria subscriber) would be a meaningful upgrade. SMS via Twilio + opt-in capture on the LP form.

2. **Saved-search delta detection across price changes.** Today we capture "new listings". A second match type — "price drop on a listing already in the subscriber's awareness" — would re-engage subscribers who saw a home, didn't act, and the seller dropped 5%. Already partially scaffolded via `match_type='price_drop'` in the schema.

3. **Subscriber portal.** Today the only way to edit criteria is to ask Matt to do it via the admin queue, OR unsubscribe + resubscribe with new criteria. A magic-link login page at `/my-alerts` that lets the subscriber edit their own criteria would reduce admin overhead.

4. **Cross-community subscriber view.** A subscriber might be open to Tetherow OR Broken Top at the right price. Today they need two separate subscriptions. A multi-community criteria with a single email digest would compress the user experience.

5. **Match-quality scoring.** Not all matches are equal. A 5-bed home that matches a 5-bed-min criteria but is across the highway is a worse match than a 5-bed on the golf course. Adding a quality score (proximity to amenities, course frontage, view category) and surfacing the top match first in the digest would help.

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `docs/DATABASE_FOR_AI_AGENTS.md`
- `docs/MARKETING_LEAD_FLOW.md`
- `docs/FUB_SELLER_WORKFLOW_2026-05-17.md`
