# Phase 2 — Auto-CMA Pipeline Map

Audit of the existing CMA, FUB, and seller-LP plumbing in this repo, and the proposed design for an auto-CMA loop fired from `/lp/seller-home-value` form submits. **Findings only — nothing built.**

---

## CMA generation — what's live

### Entry points
- **`lib/cma.ts`** — pure compute. Two public entry points:
  - `computeCMA(propertyId: string)` — full pipeline keyed off the `properties` table primary id. Fetches the subject from `properties`, finds the matching active `listings` row by city + street_number + postal_code, pulls comp candidates via the `get_cma_comps` Postgres RPC (then falls back to a direct `listings` query if the RPC is missing or returns <3 hits), filters by sqft/beds/year similarity, scores each comp, builds a weighted average, and **persists** a row to `valuations` + per-comp rows to `valuation_comps`. Returns a `CMAResult` (`estimatedValue`, `valueLow`, `valueHigh`, `confidence`, `comps`, `methodology`, `valuationId`).
  - `computeCMAByListingKey(listingKeyOrMls: string)` — same math but keyed off `ListingKey`/`ListNumber`; calls the `get_cma_comps_by_listing_key` RPC. Does **not** persist — pure compute.
  - `getCachedCMA(propertyId)` — re-hydrates the most recent `valuations` row plus its `valuation_comps` children. No expiration logic in code; latest row wins.

### Inputs required
- A `properties.id` UUID. The visitor's typed address is **never** the direct input to `computeCMA`. The seller-LP / home-valuation actions handle that one-way mapping with `findPropertyByAddress` (parses the address, matches by city + optional state + optional postal_code, then ilike-includes street_parts in `unparsed_address`). If `findPropertyByAddress` returns null (no MLS-side property record matches), no CMA gets generated at all — the lead lands in FUB but the auto-CMA branch is silently skipped.
- For `computeCMAByListingKey`: an MLS `ListingKey` or `ListNumber`.

### PDF renderer
- **`lib/pdf/cma-pdf.tsx`** — `<CMAPdfDocument data={…}/>`. Four-page A4 doc via `@react-pdf/renderer`. Inputs: `cma: CMAResult`, address, beds/baths/sqft/lotAcres/yearBuilt, optional `heroPhotoUrl`, optional `agentName`/`agentEmail`/`agentPhone`. Pages: cover with value + range + confidence, comps table (first 6), market context page (mostly disclaimer text only — no real chart data wired in), methodology + disclaimer.
- Rendered via `renderToBuffer(doc)` to a Node `Buffer`. Fully callable from server actions (already done by `app/home-valuation/actions.ts`).

### HTTP routes
- **`app/api/cma/[propertyId]/route.ts`** — `GET`. Returns JSON `CMAResult` via `getCachedCMA` then falls back to `computeCMA`. Rate-limited (`strict`). No auth gate. Used by client-side previewers, not by the seller LP.
- **`app/api/pdf/cma/route.ts`** — `POST`. Body `{ propertyId }`. **Requires session** (`getSession()` — rejects if no `session.user.email`). Generates the PDF buffer and returns it as `application/pdf` with `Content-Disposition: attachment`. Also fires a fire-and-forget FUB `Property Inquiry` event tagged "Downloaded CMA / Value Report (high intent)" with the session user's email. Anonymous LP visitors hit a 401 here — this route is for signed-in users browsing the platform, not for the seller-LP flow.

### Triggerable from a server action?
Yes. `submitValuationRequest` in `app/home-valuation/actions.ts` already calls `getCachedCMA(propertyId) ?? computeCMA(propertyId)`, renders the PDF inline with `React.createElement(CMAPdfDocument, …)` + `renderToBuffer(doc)`, and ships it via `sendEmail` from `lib/resend`. The seller-LP form (`app/lp/seller-home-value/actions.ts`) does **NOT** do this yet — it only writes the FUB event + adds tags. **This is the gap.**

### Speed estimate
~2–5 seconds per CMA, dominated by Supabase round-trips:
1. `properties` lookup (1 query).
2. `listings` match (1 query, often returns >1 row, ilike on city).
3. `get_cma_comps` RPC (1 call, ~200 ms when present).
4. Direct comps fallback query (1–2 queries when RPC is empty or schema-mismatched).
5. `valuations` insert (1 query).
6. Per-comp `valuation_comps` inserts (loop, ~6–10 inserts).
7. `renderToBuffer` on the React-PDF tree (CPU; ~500 ms–1.5 s for 4-page doc).
8. `sendEmail` via Resend with the PDF attachment (~500 ms).

Latency makes it **not safe to block** the form-submit response. Already not blocking in the current code — `submitValuationRequest` runs it inline but inside a try/catch that swallows failures; the form still returns `success: true` even if the CMA email fails. **Recommendation: move CMA gen entirely off the form-submit path, do it from a queued worker.**

---

## Seller LP form — current submit flow

### Form fields collected
**Two steps.** Step 1 (always shown): `address` (combined). Step 2 (skipped if known visitor with prefilled email): `name`, `email`, `phone` (optional), `timeline` (one of `ready-now`, `next-3-6`, `next-6-12`, `exploring`).

Client component: `app/lp/seller-home-value/SellerLPForm.tsx` — branches on `knownVisitor` (true when the server upstream detected a `fub_cid` cookie) to skip step 2 entirely if the visitor is already identified.

### Server action
**`submitSellerLPForm`** in `app/lp/seller-home-value/actions.ts`. Order of operations:

1. Parse the combined address into `{ street, city, state, postalCode }` via the same logic as `submitValuationRequest`.
2. Resolve the FUB person:
   - `findPersonByEmail(email)` if email present → match.
   - Else `getFubPersonIdFromCookie()` for `fub_cid` cookie identity.
   - Else create new (handled by FUB on `sendEvent`).
3. Insert a row into Supabase `valuation_requests` (street, city, state, postalCode, name, email, phone, `source_url=/lp/seller-home-value`).
4. `sendEvent({ type: 'Seller Inquiry', person, source, sourceUrl, pageTitle, message, property })` to FUB.
5. Re-resolve `fubPersonId` (re-fetch by email if `sendEvent` just created the person) and `addPersonTags(personId, ['audience:seller', sequenceTag, 'source:seller-lp', <classification>])` where `sequenceTag` is `auto:seller-seq:new` / `:warm` / `:watch` based on timeline.
6. For `ready-now` (classification=`hot`): `createRealtimeTask({ personId, taskName: 'Hot seller LP lead — call within 5 min: …', taskType: 'Call', dueInMinutes: 5 })`. The task auto-routes to the FUB assigned user (via `getPersonAssignedUserId`) or a default fallback.
7. Fire-and-forget Meta CAPI `Lead` event ($500 value) at `/api/meta-capi`.
8. Return `{ success: true, eventId, classification, alreadyKnown }`.

### Where the lead lands
- **FUB Person** — primary system of record. Tagged `audience:seller`, `source:seller-lp`, `hot-seller`/`warm-seller`/`nurture-only`, plus a `auto:seller-seq:*` tag that triggers an existing FUB automation sequence.
- **Supabase `valuation_requests`** — analytics row (also feeds the weekly outreach cron).
- **Meta CAPI** — `Lead` $500 with shared `event_id` for browser pixel dedup.

### Where the FUB person gets the assigned broker
**Not assigned at submit-time.** The seller-LP submit does NOT pass `brokerAttribution` to `sendEvent`. The current behavior is:

- FUB's own round-robin / lead-routing rules (configured inside FUB UI, outside this repo) determine who picks up the new lead.
- The 5-min hot-lead task uses `getPersonAssignedUserId(personId)` to read FUB's current assignment, then falls back to `FOLLOWUPBOSS_DEFAULT_ASSIGNED_USER_ID` env if FUB hasn't assigned yet.
- `lib/followupboss.ts` `sendEvent` supports `brokerAttribution: { brokerSlug, brokerEmail }` to explicitly assign + tag `broker:<slug>` — used by `app/actions/agents.ts` (agent-card contact form) and `app/actions/track-cta-click.ts`. The seller LP doesn't use it.

So: **broker assignment for seller-LP leads is delegated to FUB's UI-configured lead routing today.** No code in this repo decides which broker gets a new home-valuation lead.

### Existing post-submit automation
- The realtime task fires for hot leads (5-min SLA).
- Tags trigger FUB-side automations (action plans, drip sequences, etc.) — configured inside FUB, not in code.
- Resend admin email goes out from `app/home-valuation/actions.ts` (legacy path) but NOT from the seller-LP action.
- **No auto-CMA email today on the `/lp/seller-home-value` path.** The legacy `/home-valuation` action DOES email the CMA inline — but only as a best-effort try/catch that silently skips if `findPropertyByAddress` returns null. The new seller LP doesn't even attempt this.

---

## FUB integration

### Client wrapper modules
Two coexist, both in `lib/`:
- **`lib/followupboss.ts`** — the canonical and far-larger client. Used by every server action and webhook in the app. ~1130 lines. Auth, person search, events, notes, tags, tasks, broker attribution, live "My Leads" pull. Single env: `FOLLOWUPBOSS_API_KEY` (Basic auth, password empty). Optional `FOLLOWUPBOSS_SYSTEM` + `FOLLOWUPBOSS_SYSTEM_KEY` headers for registered system integrations.
- **`lib/fub.ts`** — minimal alternate wrapper (`pushToFub`). Reads `FOLLOWUPBOSS_API_KEY`. Used in only a handful of places. The Meta lead webhook (`app/api/meta/lead-webhook/route.ts`) and the FB ad webhook both call the FUB REST API directly with their own `fubHeaders` helper — accepting `FUB_API_KEY` OR `FOLLOWUPBOSS_API_KEY` env. Two env-var names exist for the same key.

### Auth method
Basic auth: `Authorization: Basic <base64(apiKey:)>`. API key only — no OAuth, no service account.

### Methods available
| Need | Function | File | Notes |
|---|---|---|---|
| Find person by email | `findPersonByEmail(email)` | `lib/followupboss.ts` | Returns `FubPerson` or null |
| Create / update person (via event) | `sendEvent({ type, person, ... })` | `lib/followupboss.ts` | FUB auto-creates/merges by email |
| Create person directly | (Not wrapped — see `createFubContact` inline in `app/api/meta/lead-webhook/route.ts`) | — | POST to `/v1/people` directly |
| Add tags | `addPersonTags(personId, tags)` | `lib/followupboss.ts` | `PUT /v1/people/:id?mergeTags=true` |
| Add note | `addPersonNote(personId, body)` | `lib/followupboss.ts` | `POST /v1/notes` |
| Create task | `createRealtimeTask({ personId, taskName, taskType, dueInMinutes })` | `lib/followupboss.ts` | `POST /v1/tasks` |
| Update stage / tags | `updatePersonAutomationState({ personId, stage, tags })` | `lib/followupboss.ts` | |
| Assign broker | `brokerAttribution` on `sendEvent`, or `applyBrokerAttribution` internal | `lib/followupboss.ts` | Adds `broker:<slug>` tag + sets `assignedUserId` |
| Pull my-leads page | `fetchMyLeadsFromFubLive({ brokerSlug, brokerEmail, brokerId })` | `lib/followupboss.ts` | Used by weekly outreach cron |

### Email draft / attachment upload
**Not wrapped in this repo, and FUB's public API does not support either operation.**

Verified: there is no `/v1/emails`, `/v1/drafts`, `/v1/attachments`, or `/v1/files` usage anywhere in `lib/` or `app/`. FUB's public REST API surface (per FUB docs) covers People, Events, Notes, Tasks, Tags, Stages, Pipelines, Users, Smart Lists, and Action Plans. **It does not expose:**

- Drafting an outbound email for a broker to review.
- Uploading a file attachment to a person record.
- Triggering a "send as broker" automation with an attached PDF.

What FUB does have that's adjacent: action plans (templated drip sequences) and email templates inside the FUB app, both managed in the UI. Email-send from FUB happens via the broker hitting "Send Email" inside FUB's UI; there's no API to programmatically create an email draft tied to a person record.

### The "send-as-broker" / draft-review pattern
Not feasible through FUB's API. Three practical alternatives:

1. **Resend draft + iMessage handoff to broker** (recommended): send the CMA from Resend `<broker-email>@…` style sender, link to a "review before send" admin page on ryan-realty.com, broker approves, server sends from broker's email account. Already partially wired — Resend with attachments works (see `submitValuationRequest`).
2. **Pure Resend pre-broker-review** (what's there today): Resend just sends the email to the lead from `noreply@mail.ryan-realty.com` with the PDF attached, then drops a FUB note + 5-min task so the broker calls within the SLA. No broker-review gate at all.
3. **FUB note + manual attachment**: write the CMA to Supabase Storage with a public URL, create a FUB note that says "CMA ready: <url>" + creates a task for the assigned broker to "review and send to lead." Broker manually triggers send from inside FUB. Slowest, but never miscarries.

Existing usage patterns:
- `lib/resend.ts` `sendEmail({ to, subject, attachments: [{ filename, content: Buffer }] })` is the proven path for sending PDFs from a server action. Already used by `submitValuationRequest`.
- `addPersonNote(personId, body)` is the proven path for surfacing the CMA inside FUB. Already used after listing views and other high-signal events.

---

## Broker assignment

### Current logic
**No code-level assignment for inbound seller-LP leads.** FUB-side round-robin (configured in FUB UI) handles it. Code observes via `getPersonAssignedUserId(personId)`.

Resolution chain inside the codebase:
1. `FOLLOWUPBOSS_BROKER_USER_MAP` env (comma-separated `slug:userId` pairs) — when a caller passes `brokerAttribution: { brokerSlug }`.
2. Supabase `brokers` table lookup (`select email where slug=… and is_active=true`) → `findUserByEmail(email)` in FUB → `userId`.
3. Falls back to `FOLLOWUPBOSS_DEFAULT_ASSIGNED_USER_ID` env when no explicit slug.

### Brokers table
Lives in Supabase. Columns visible across `app/actions/brokers.ts`, `app/actions/admin-media.ts`, `app/actions/dashboard.ts`: `id` (uuid), `slug`, `display_name`, `email`, `photo_url`, `intro_video_url`, `saved_headshot_urls`, `is_active`, `sort_order`. Three active rows expected (Matt Ryan, Paul Stevenson, Rebecca Peterson per `design_system/ryan-realty/MANIFEST.md`).

### Possible strategies for auto-CMA
- **Round-robin from the `brokers` table** — query `is_active=true ORDER BY sort_order`, pick the next in line by lead-count modulo. Stateless. Easy to implement; needs a counter row or a Supabase function.
- **By zip / city** — assign by listing geography. Not currently encoded anywhere (no broker→city/zip mapping table).
- **By price tier** — only valuable post-CMA (need the estimated value first). Could route luxury (>$1.5M) to a specific broker.
- **Manual / FUB-routing default** — what we have today. Leave broker assignment to FUB's existing rules and have the auto-CMA producer read the assignment from FUB after it lands.

**Recommended: keep FUB's routing as the source of truth**. Auto-CMA producer reads `assignedUserId` from FUB after the LP submit lands, joins to the `brokers` Supabase row for the slug + phone, and uses that broker's identity for the iMessage notification. No new routing logic to maintain.

---

## Proposed auto-CMA loop design

### Trigger point
`app/lp/seller-home-value/actions.ts` `submitSellerLPForm`. **After** the existing FUB event + tags + Meta CAPI fire-and-forget, **before** the function returns. Goes through the `marketing_brain_actions` table for audit + retries.

### Sequence
```
Visitor clicks "Send my home value"
  → submitSellerLPForm runs (existing flow)
  → FUB Person created/matched, tagged audience:seller + sequence tag
  → 5-min hot-lead task if classification=hot
  → submitSellerLPForm returns {success:true} to client (<2s)
  → [NEW] action row inserted: action_type=ops:cma_delivery,
          target=email:<lead-email>, payload={address, name, phone,
          fubPersonId, classification}
  → [NEW] fire-and-forget POST to /api/cron/cma-delivery?action_id=<uuid>
  → [worker] /api/cron/cma-delivery picks up the action row:
      1. status → in_production
      2. findPropertyByAddress → propertyId (or skip if no match — set status=killed,
         log "no MLS match for address, manual CMA needed", notify broker via iMessage anyway)
      3. computeCMA(propertyId) → CMAResult
      4. render CMAPdfDocument → PDF Buffer
      5. write PDF to Supabase Storage (cma-deliveries bucket) → signed URL
      6. sendEmail({ to: lead.email, replyTo: assignedBroker.email,
                     subject: "Your home value report — <address>",
                     attachments: [{filename, content: buffer}] })
      7. addPersonNote(fubPersonId, "CMA emailed to <lead-email>. Value:
                                    $X (range $Y–$Z, <confidence>).
                                    Storage: <signed-url>")
      8. createRealtimeTask(fubPersonId, "Review CMA with lead within 24h: $X")
      9. resolve assigned broker (getPersonAssignedUserId → brokers table lookup
                                  for phone + display_name)
     10. send iMessage to assigned broker via Read_and_Send_iMessages MCP:
         "Auto-CMA sent to <lead-name> for <address>. Value $X.
          Classification: <hot/warm/nurture>. Reply within 24h.
          FUB person: <url>"
     11. status → executed; executor_response = {pdf_url, cma_value,
                                                 broker_imessage_id, broker_email}
```

### Where to put the producer code
**New producer:** `marketing_brain_skills/producers/ops-cma-delivery/SKILL.md` + a thin worker route at `app/api/cron/cma-delivery/route.ts`. Follows the registry pattern alongside `comms-matt-alert` (which already invokes the iMessage MCP) and `ops-email-send` (which already proves Resend-with-attachment from a producer).

The compute itself lives in existing `lib/cma.ts` + `lib/pdf/cma-pdf.tsx` — no rewrite. The producer just orchestrates: address-to-propertyId, compute, render, send, notify.

### Error / retry strategy
- Wrap each side-effect (`computeCMA`, `renderToBuffer`, `sendEmail`, `addPersonNote`, MCP send) in its own try/catch. On failure, write the error to `executor_response.warnings[]`, **do not** kill the row; keep going for the next side-effect.
- Address miss is a soft-fail: status=killed, executor_response={reason:'address_not_in_mls'}, but still fire the iMessage to the broker — "Manual CMA needed for <address>, no MLS match" — so a human picks it up.
- All other failures: status=killed with a clear `executor_response.error`. The brain dashboard surfaces killed rows for triage.
- Idempotency: dedup key on (target_email, address, day) so a double-submit doesn't double-send.

### Latency
The LP form returns in <500 ms (existing path with only the FUB event + tags + Meta CAPI, all already fire-and-forget). The CMA producer runs in the background — target P95 of ~10 s end-to-end including the PDF render. Visitor sees "your value report is on its way" immediately; PDF lands in their inbox within a minute.

---

## What's missing / needs to be built

### Files to create
- `marketing_brain_skills/producers/ops-cma-delivery/SKILL.md` — the producer spec.
- `app/api/cron/cma-delivery/route.ts` — the worker. POST handler that takes `action_id` query param, runs the sequence.
- `lib/cma-delivery.ts` — extracted helper containing the orchestration (so the worker can also be invoked directly from `submitSellerLPForm` for testing).
- `lib/imessage-broker.ts` — broker-resolution + iMessage formatting helper. Wraps `Read_and_Send_iMessages` MCP, resolves broker phone from the `brokers` Supabase table given a FUB `assignedUserId`.
- Migration: a `cma_deliveries` table (`id`, `action_id`, `lead_email`, `address`, `property_id`, `valuation_id`, `pdf_storage_path`, `email_resend_id`, `imessage_target`, `imessage_sent_at`, `status`, `created_at`).
- Supabase Storage bucket `cma-deliveries` (private, signed URLs).

### Files to modify
- `app/lp/seller-home-value/actions.ts` — after the existing tag + task block, insert a row into `marketing_brain_actions` (`action_type: 'ops:cma_delivery'`, `target: email:<lead>`, `payload: {…}`) and fire-and-forget POST to `/api/cron/cma-delivery`.
- `marketing_brain_skills/producers/REGISTRY.md` — add `ops-cma-delivery` row under Section D.
- `app/home-valuation/actions.ts` (legacy `/home-valuation` page) — same call out to the producer so we have ONE auto-CMA path, not two divergent ones. Delete the inline CMA render block in `submitValuationRequest`.

### API endpoints we still need
- Internal: `/api/cron/cma-delivery` POST worker (above).
- No new external integrations needed. FUB email-draft / attachment-upload APIs do **not exist** — we send from Resend instead, then add a FUB note pointing back at the signed Storage URL.

### Tests
- Unit: `findPropertyByAddress` edge cases (no MLS match, multiple matches, partial street).
- Integration: full LP submit → worker run, asserting the action row hits `executed`, the email lands, the FUB note appears, and the iMessage MCP was called with the right broker phone.
- Manual QA: one real submit per timeline classification (hot/warm/nurture) end-to-end through staging.

---

## Recommended next 3 build steps

1. **Lift the CMA orchestration out of `submitValuationRequest` into `lib/cma-delivery.ts`.** Make it pure (no fetch to itself), expose `runCmaDelivery({ leadEmail, leadName, leadPhone, addressRaw, fubPersonId, classification })` returning `{ status, pdfStoragePath, valuation, errors[] }`. No behavior change yet — both `/home-valuation` and the new producer call the same helper.
2. **Build the producer skeleton: `marketing_brain_skills/producers/ops-cma-delivery/SKILL.md` + `app/api/cron/cma-delivery/route.ts` + the `cma_deliveries` migration.** Worker reads action row, calls `runCmaDelivery`, writes the result back. Add the registry entry. Manual fire from psql to confirm round-trip.
3. **Wire `submitSellerLPForm` to insert the `ops:cma_delivery` action row + fire-and-forget the worker URL.** Then add the iMessage-to-assigned-broker step via the existing `Read_and_Send_iMessages` MCP pattern from `comms-matt-alert`. Manual end-to-end: submit the LP form with a real Bend address, verify CMA email lands, FUB note appears, and Matt's iPhone gets the broker iMessage.
