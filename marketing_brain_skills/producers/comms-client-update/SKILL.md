---
name: comms-client-update
description: >
  Produces per-client touchpoint communications: weekly seller status updates,
  milestone notes (offer accepted, inspection passed, closing), and quarterly
  past-client touches (home-value update + market snapshot). Sends via Resend
  with FUB-personalized fields. Voice-validated for warmth and brevity in Matt's
  actual writing register.
action_types:
  - comms:client_weekly
  - comms:client_milestone
  - comms:past_client_touch
output_type: text
output_type: operational
target_platforms: ['email']
asset_destination: marketing_brain_actions row + email/SMS
auto_inputs: ['fub_contact_data', 'transaction_status']
required_inputs: ['contact_id', 'update_type', 'update_body']
optional_inputs: ['send_channel (default email)', 'schedule_iso (default immediate)']
estimated_runtime_min: 3
cost_usd_estimate: $0
thumbnail_uri: out/proof/2026-05-17/exemplars/comms-client-update/sample.txt
example_outputs: []
    label: Phase 7.5 exemplar placeholder
    surface: email

---

# comms-client-update

**Scope:** Drafts and sends per-client email communications on behalf of Ryan Realty.
Three action types: a weekly seller status update for an active listing, a milestone
note triggered by a transaction event, and a quarterly past-client touch combining a
home-value estimate with a market snapshot. Every email is voice-validated before
surfacing to Matt. Every market figure traces to a live Supabase query. Matt approves
each draft before Resend delivers it.

Does NOT send marketing emails to leads (that is `ops-email-send`). Does NOT draft
review responses (that is `ops-reputation`). Does NOT send alert messages to Matt
himself (that is `comms-matt-alert`). Does NOT draft listing descriptions or CMAs.

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/comms-client-update/<slug>/email-draft.txt` + `contact-sheet.html`

---

## 1. Scope

### In scope

- `comms:client_weekly`: weekly seller status email to an active-listing client
- `comms:client_milestone`: milestone note: offer accepted, inspection contingency cleared,
  appraisal complete, closing scheduled, closed and funded
- `comms:past_client_touch`: quarterly home-value estimate email to a past client,
  including a brief neighborhood market snapshot

### Out of scope

- Marketing emails to cold leads or prospect lists (that is `ops-email-send`)
- Posting public review responses (that is `ops-reputation`)
- Sending critical operational alerts to Matt (that is `comms-matt-alert`)
- Bulk newsletter campaigns (that is `ops-email-send`)

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `comms:client_weekly` | `client_name`, `client_email`, `mls_id`, `week_number`, `showings_this_week`, `offers_received`, `price_reduction_pending` | `broker_slug` optional (defaults to listing agent) |
| `comms:client_milestone` | `client_name`, `client_email`, `mls_id`, `milestone_type`, `milestone_date`, `next_step` | `milestone_type`: see enum below |
| `comms:past_client_touch` | `client_name`, `client_email`, `client_address`, `neighborhood_slug`, `last_sale_date`, `last_sale_price` | Triggers home-value estimate from Supabase |

### Payload schema

```typescript
type MilestoneType =
  | 'offer_accepted'
  | 'inspection_contingency_cleared'
  | 'appraisal_complete'
  | 'closing_scheduled'
  | 'closed_funded';

interface ClientUpdatePayload {
  // comms:client_weekly
  client_name?: string;
  client_email?: string;
  mls_id?: string;
  week_number?: number;              // 1 = first week on market
  showings_this_week?: number;
  offers_received?: number;
  price_reduction_pending?: boolean;
  broker_slug?: 'matt-ryan' | 'paul-stevenson' | 'rebecca-peterson';

  // comms:client_milestone (add to weekly fields)
  milestone_type?: MilestoneType;
  milestone_date?: string;           // YYYY-MM-DD
  next_step?: string;                // one sentence: what happens next

  // comms:past_client_touch
  client_address?: string;           // full street address of their former home
  neighborhood_slug?: string;        // from bend-market-bible.md §1
  last_sale_date?: string;           // YYYY-MM-DD
  last_sale_price?: number;          // in dollars
}
```

---

## 3. Full action row schema

```typescript
interface ClientUpdateActionRow {
  id: string;
  action_type: 'comms:client_weekly' | 'comms:client_milestone' | 'comms:past_client_touch';
  target: string;                    // e.g. 'client:<client_email>' or 'mls:<mls_id>'
  assigned_producer: string;         // 'marketing_brain_skills/producers/comms-client-update'
  payload: ClientUpdatePayload;
  data_evidence: {
    audit_source?: string;           // e.g. 'ops-fub-crm'
    trigger_event?: string;          // e.g. 'ShowingConfirmed', 'OfferReceived'
    signal_evidence?: string;
  };
  generation_reason: string;
  status: 'pending';
}
```

---

## 4. The recipe

**Step 1: Read the action row and claim it**

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>' AND status = 'pending';
```

**Step 2: Load mandatory references**

- `CLAUDE.md` §0: Data Accuracy (market figures verified live)
- `CLAUDE.md` §0.5: Draft-First, Commit-Last
- `design_system/ryan-realty/SKILL.md`: brand tone anchors
- `marketing_brain_skills/brand-voice/voice_guidelines.md`: full voice rules
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md`: Matt's actual writing; use as tone reference for warmth and brevity
- `marketing_brain_skills/research/tool-inventory.md`: Resend and FUB env var status
- `marketing_brain_skills/research/platform-bible.md`: §21 cross-cutting email rules
- `marketing_brain_skills/research/asset-library-map.md`: not required for text emails
- `marketing_brain_skills/research/bend-market-bible.md`: §1 for past-client touch neighborhood context

**Step 3: Pull listing data (client_weekly and client_milestone)**

For `comms:client_weekly` and `comms:client_milestone`, pull current listing status:

```sql
SELECT
  "ListPrice",
  "StandardStatus",
  "CumulativeDaysOnMarket",
  "BedroomsTotal",
  "TotalLivingAreaSqFt",
  "StreetNumber",
  "StreetName",
  "City",
  "ListAgentEmail",
  "ListAgentFullName"
FROM listings
WHERE "ListingId" = '<mls_id>'
LIMIT 1;
```

Verify `ListAgentEmail` matches one of the three brokers in
`design_system/ryan-realty/assets/team/`. Resolve `broker_slug` from the email if
not provided in payload. If `ListAgentEmail` matches no known broker, default to
`matt-ryan` and note in contact sheet.

Broker email map:
- `matt@ryan-realty.com` -> `matt-ryan`
- `paul@ryan-realty.com` -> `paul-stevenson`
- `rebecca@ryan-realty.com` -> `rebecca-peterson`

**Step 4: Pull market context (past_client_touch)**

For `comms:past_client_touch`, compute estimated current value for the client's former
home using neighborhood-level median as a proxy:

```sql
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS neighborhood_median,
  COUNT(*) AS sample_size,
  MAX("CloseDate") AS most_recent_close
FROM listings l
JOIN neighborhood_subdivisions ns
  ON l."SubdivisionName" = ANY(ns.mls_aliases)
WHERE ns.neighborhood_slug = '<neighborhood_slug>'
  AND l."StandardStatus" = 'Closed'
  AND l."PropertyType" = 'A'
  AND l."CloseDate" >= date_trunc('year', now());
```

Do NOT present this as an appraisal or a guarantee. Language must be:
"Based on recent sales in <neighborhood>, homes similar to yours are trading around
$X in <current year>."

If sample_size < 3: expand to trailing 12 months. If still < 3: omit the figure. Use:
"The <neighborhood> market has been active this year. We'd be glad to run a full
comparison for you if you're curious where your home stands today."

**Step 5: Draft the email body**

Voice rules for client communications (sourced from GBP corpus and CLAUDE.md brand voice):

Canonical phrases Matt actually uses:
- "Thank you so much for taking the time to..."
- "It was genuinely a pleasure working with you."
- "That kind of trust makes all the difference."
- "A small business like ours."
- "Honored to..." / "Privilege to..."
- "I'm always here if you need anything down the road."
- "Wishing you all the best in your new chapter."

Register: warm, brief, honest, without pressure. No exclamation marks in body. No em-dashes.
No semicolons. No banned words. First-person "I" IS allowed for client emails because
these are personal from the broker.

**comms:client_weekly template structure:**

Subject: `<StreetName>: week <week_number> update`

Body:
1. Opening: one sentence acknowledging the week (genuine, not peppy).
2. Activity: showings this week and cumulative, stated as a fact.
3. Feedback: one sentence summarizing what you heard (if available from payload; if
   not, note "No specific feedback to share from this week's showings yet.").
4. Next step: one sentence on what happens in the next 7 days (price review,
   open house, broker tour, etc.).
5. Closing: one sentence with Matt's direct line and availability.

Total length: 5-7 sentences. No bullets. No headers. No markdown formatting in the
email body (plain text renders in all clients).

**comms:client_milestone template structure:**

Subject line by milestone type:
- `offer_accepted`: `Offer accepted on <StreetName>: next steps`
- `inspection_contingency_cleared`: `Inspection contingency cleared: we're moving forward`
- `appraisal_complete`: `Appraisal is in: here's where we stand`
- `closing_scheduled`: `Closing is on the calendar for <milestone_date>`
- `closed_funded`: `Congratulations: <StreetName> has closed and funded`

Body: 4-6 sentences. State the milestone clearly. Note what it means for the client.
State the immediate next step from `payload.next_step`. Close with Matt's availability.
For `closed_funded`: include one of the canonical closing phrases from the GBP corpus.

**comms:past_client_touch template structure:**

Subject: `<neighborhood_name> market update: thought of you`

Body:
1. Genuine opener: reference the specific transaction by street address and approximate
   year. One sentence.
2. What's happening: one verified market observation from the neighborhood (median,
   DOM, active count). Cite the source range (e.g., "YTD 2026 sales in NW Crossing").
3. Home value note: the estimated current value paragraph (or the omission language
   if data is insufficient).
4. Offer: "If you're ever curious about a full comparison, I'm glad to put one together
   for you at no cost or obligation."
5. Personal close: "Wishing you all the best in your new chapter." + sign-off with
   Matt's direct line `541.213.6706`.

Total: 6-8 sentences. Plain text. No bullets. No marketing language.

**Step 6: Voice self-check (mandatory)**

Grep every field for:
- Em-dash (U+2014), en-dash (U+2013): hard fail
- Semicolons: hard fail
- Exclamation marks in body: hard fail
- All words in voice_guidelines.md §6.2 banned list
- Vague qualifiers ("approximately," "roughly," "about"): hard fail; use the number
- Fake urgency ("don't miss out," "act now," "won't last"): hard fail
- Marketing slop ("boutique brokerage," "premier," "passionate"): hard fail

Fix every hit. Do not surface a draft with a single violation.

**Step 7: Write email-draft.txt**

```
CLIENT EMAIL DRAFT
Action type: <action_type>
Recipient: <client_name> <client_email>
Broker: <broker_slug>
Generated: <ISO date>

SUBJECT
<subject line>

BODY
<full email body in plain text>

VERIFICATION TRACE
<figure>: <source>, <filter>, fetched <ISO>

SEND INSTRUCTIONS
Via Resend from: <RESEND_FROM or fallback>
FUB tag to apply after send: 'weekly_update_sent' / 'milestone_<type>' / 'past_client_touch_<quarter>'
```

**Step 8: Write citations.json and contact-sheet.html**

Citations: one entry per market figure. Contact sheet: brand v2 navy on cream, Geist.
Show subject, body in a readable block, verification trace, and approval prompt.

**Step 9: Update action row and surface to Matt**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{
      "draft_path": "out/comms-client-update/<slug>/email-draft.txt",
      "contact_sheet": "out/comms-client-update/<slug>/contact-sheet.html",
      "recipient_email": "<client_email>",
      "subject": "<subject>",
      "action_type": "<action_type>",
      "voice_validated": true
    }'::jsonb
WHERE id = '<id>';
```

Surface to Matt:

```
Draft ready: comms-client-update: <client_name> (<action_type>)

Contact sheet:
  -> file:///Users/matthewryan/RyanRealty/out/comms-client-update/<slug>/contact-sheet.html

  DELIVERABLE
    Path: out/comms-client-update/<slug>/email-draft.txt
    To: <client_name> <client_email>
    Subject: <subject>
    Body length: <N> words

  VERIFICATION TRACE
    <one line per market figure, or "No market stats in this email.">

Reply with one of:
  - approve <slug>  : sends via Resend immediately
  - revise <slug>: <note>
  - kill <slug>
```

Then stop. Do not send. Wait for Matt's explicit approval.

**Step 10: Send via Resend (post-approval only)**

After Matt's approval, call the Resend API:

```
POST https://api.resend.com/emails
Headers:
  Authorization: Bearer <RESEND_API_KEY>
  Content-Type: application/json
Body:
{
  "from": "<RESEND_FROM>",
  "to": ["<client_email>"],
  "subject": "<subject>",
  "text": "<email body plain text>",
  "tags": [{"name": "action_type", "value": "<action_type>"}]
}
```

If `RESEND_FROM` is unset (per env-manifest.md, `mail.ryan-realty.com` domain not yet
verified): surface to Matt: "RESEND_FROM is unset. Verify `mail.ryan-realty.com` in
Resend dashboard before sending." Set `status='killed'`. Do not send from
`onboarding@resend.dev` for client-facing emails.

On successful send: update action row to `executed` with the Resend message ID.

**Step 11: Apply FUB tag (post-send)**

After confirmed send, apply the appropriate FUB tag via `lib/followupboss.ts` or the
FUB REST API:

```
POST https://api.followupboss.com/v1/events
{
  "source": "Ryan Realty Brain",
  "type": "Note",
  "personId": "<fub_person_id>",
  "description": "Automated <action_type> email sent <ISO date>."
}
```

If FUB person ID is not in the payload, search by email via the FUB people API before
tagging. If not found in FUB, log the gap in `executor_response.warnings` but do not
block the send.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | listing data; market stat queries; action row updates | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Resend API | email delivery | `RESEND_API_KEY`, `RESEND_FROM` |
| FUB REST API | post-send tagging and event logging | `FOLLOWUPBOSS_API_KEY` |
| Read (file) | GBP corpus, brand voice, bend-market-bible | paths above |
| Write (file) | `email-draft.txt`, `citations.json`, `contact-sheet.html` | `out/comms-client-update/<slug>/` |

---

## 6. Output format

**Draft lands at:** `out/comms-client-update/<slug>/`

```
out/comms-client-update/<slug>/
├── email-draft.txt
├── citations.json
└── contact-sheet.html
```

**After Matt approval:** email sent via Resend; FUB event logged; action row updated to `executed`.

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-draft` | Matt sees the draft and says "approve," "ship it," or "go" | Matt only |

Silence is not approval. A passing voice-check is not approval.

---

## 8. Status flow

```
pending           <- producer reads row here
  |
  v
in_production     <- set immediately; executed_at=now()
  |
  +-- Listing not found -> killed
  +-- Market stat unverifiable -> stat omitted; continue
  +-- RESEND_FROM unset -> killed (with setup instruction)
  +-- Voice fail after 2 iterations -> killed
  |
  v (draft written, QA passed)
ready             <- executor_response populated with draft_path
  |
  v (Matt says "approve")
approved          <- approved_by='matt', approved_at=now()
  |
  v (Resend confirms delivery; FUB event logged)
executed          <- Resend message_id captured
  |
  v (no performance loop for direct client emails; marked measured immediately)
measured
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Listing not found | Supabase returns 0 rows for `mls_id` | Kill; surface: "Listing <mls_id> not found in Supabase. Verify the MLS number." |
| Neighborhood data sparse | Fewer than 3 closed sales in 12-month window | Omit median; use the "market has been active" fallback language |
| RESEND_FROM unset | `process.env.RESEND_FROM` undefined | Kill; surface setup instructions for mail.ryan-realty.com domain verification |
| Resend API 4xx | Authentication or domain verification error | Kill; surface the full Resend error; do not retry without Matt's direction |
| FUB person not found | Email lookup returns 0 contacts | Log warning; proceed with send; do not block |
| Voice fail after 2 iterations | Banned word persists | Kill; cite the specific rule and offending text |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0: Data Accuracy
- `CLAUDE.md` §0.5: Draft-First, Commit-Last
- `design_system/ryan-realty/SKILL.md`: brand tone anchors
- `marketing_brain_skills/brand-voice/voice_guidelines.md`: voice enforcement
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md`: Matt's actual writing register
- `marketing_brain_skills/research/tool-inventory.md`: Resend and FUB env var status
- `marketing_brain_skills/research/platform-bible.md`: §21 email rules
- `marketing_brain_skills/research/asset-library-map.md`: not required for text emails
- `marketing_brain_skills/research/bend-market-bible.md`: §1 for past-client neighborhood context

**Related producers:**
- `marketing_brain_skills/producers/ops-email-send/SKILL.md`: bulk marketing email (different use case)
- `marketing_brain_skills/producers/comms-matt-alert/SKILL.md`: alerts to Matt, not clients
- `marketing_brain_skills/producers/ops-reputation/SKILL.md`: public review responses

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md`: Section E, row `comms-client-update`

## 12. Tool gap suggestions

What would make this 10x better:

1. **FUB webhook trigger**: auto-dispatch a comms-client-update action row when FUB fires a stage-changed webhook (e.g. Under Contract to Closed) rather than requiring a manual produce call.
2. **Personalization tokens**: replace [CLIENT_NAME], [ADDRESS], [DATE] placeholders with actual values pulled from the FUB contact record at send time rather than requiring the caller to populate them.
3. **Two-way SMS threading**: if the client replies via SMS, pipe the reply back into the FUB activity feed and create an inbox action row so Matt sees the thread in context.

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/tool-inventory.md`
- `marketing_brain_skills/research/platform-bible.md`
- `marketing_brain_skills/research/asset-library-map.md`
- `marketing_brain_skills/research/bend-market-bible.md`

---

## Validator stub sections (canonical 11-section structure)

## 11. Tool gap suggestions

Tool gap suggestions: see tool-acquisition-recommendations.md for the aggregated list across all producers.

