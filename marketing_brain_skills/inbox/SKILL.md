---
name: marketing-brain-inbox
description: >
  Inbound-email entry point for the marketing brain. Polls the dedicated
  agent-facing inbox at marketing@ryan-realty.com every 2 minutes, parses each
  message via Anthropic Haiku, dispatches the matching producer (or routes
  unparseable mail to comms:matt_alert), and replies to the sender with a
  voice-validated confirmation. Use this skill when reasoning about how
  inbound email becomes a brain action, how to extend the allowlist, how to
  add a new action_type to the parser, or how to diagnose a stuck inbox event.
action_types: []
---

# Marketing Brain — Inbox

**Scope:** Owns the read side of the marketing brain. Anything that turns an
inbound email at `marketing@ryan-realty.com` into a tracked action row lives
here. Does NOT generate content, run audits, or make budget decisions. Hands
off to the matching producer the moment a confident parse is dispatched.

**Status:** Canonical
**Locked:** 2026-05-14
**Receiver path:** `/api/cron/marketing-inbox-poll` (Path B — cron poll every 2 min)
**Upgrade path:** Gmail Push via Cloud Pub/Sub (Path A) — same receiver logic, swap the trigger.

---

## 1. When to use this skill

- Matt sends an email to `marketing@ryan-realty.com` and you need to reason
  about why the pipeline did or did not pick it up.
- A new producer ships and the parser/dispatcher need to learn its
  `action_type`.
- A new sender (e.g. a contracted designer, a virtual assistant) needs to be
  allowed to drive the brain via email.
- An inbox event is stuck in `received` / `parsed` / `dispatched` and is not
  closing out.
- The reply-layer voice gate rejects a confirmation and the brain falls
  silent.

Do NOT use this skill for:
- Drafting outbound marketing email — that is `ops-email-send`.
- Generating brain-side digests Matt receives daily — that is `daily-digest`.
- Anything to do with FUB email parsing — `ops-fub-crm` and the FUB
  ingestor own that.

---

## 2. Required reading before extending

| Reference | Why |
|---|---|
| `docs/handoffs/marketing-inbox-agent.md` | The original handoff brief — architecture, work items, definition of done |
| `docs/handoffs/marketing-inbox-admin-setup.md` | The one-time Workspace Admin step required to unlock the read path |
| `CLAUDE.md` §0 — Data Accuracy | Any reply containing numbers must trace |
| `CLAUDE.md` §0.5 — Draft-First | Confirmation replies do not need draft-first since they describe the routing, not the deliverable; the deliverable still does |
| `marketing_brain_skills/producers/REGISTRY.md` | Single source of truth for valid action_types |
| `marketing_brain_skills/produce/SKILL.md` | The natural-language entry point this skill mirrors |
| `marketing_brain_skills/producers/comms-matt-alert/SKILL.md` | Triage path for unparseable email |

---

## 3. Architecture

```
        marketing@ryan-realty.com (Google Workspace)
                       │
                       │ Gmail API (DWD)
                       ▼
   ┌─────────────────────────────────────────┐
   │  /api/cron/marketing-inbox-poll         │  every 2 minutes
   │  → lib/marketing-brain/inbox-poll.ts    │
   └─────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
  inbox-auth     inbox-allowlist  inbox-parser   inbox-reply
  (DWD JWT)      (config json)    (Haiku)        (Gmail send + voice gate)
        │              │              │              │
        └──────────────┴──────────────┴──────────────┘
                       │
                       ▼
              inbox-dispatcher
                       │
                       ▼
        marketing_brain_actions row
                       │
                       ▼
            assigned producer picks up
```

Files of record:

| Purpose | Path |
|---|---|
| Database schema | `supabase/migrations/20260514120000_marketing_inbox_events.sql` |
| Auth (DWD JWT) | `lib/marketing-brain/inbox-auth.ts` |
| Allowlist gate | `lib/marketing-brain/inbox-allowlist.ts` |
| Sender allowlist data | `config/marketing-brain/inbox-senders.json` |
| Haiku parser | `lib/marketing-brain/inbox-parser.ts` |
| action_type → producer table | `lib/marketing-brain/inbox-producer-registry.ts` |
| Dispatcher | `lib/marketing-brain/inbox-dispatcher.ts` |
| Reply layer | `lib/marketing-brain/inbox-reply.ts` |
| Top-level orchestrator | `lib/marketing-brain/inbox-poll.ts` |
| Cron route | `app/api/cron/marketing-inbox-poll/route.ts` |
| Cron schedule | `vercel.json` (entry: `*/2 * * * *`) |
| Broker request page | `app/marketing/request/page.tsx` |
| Request page interactive | `app/marketing/request/RequestBuilder.tsx` |
| Broker catalog (single source of truth) | `app/marketing/request/deliverables.ts` |

---

## 4. Lifecycle of one email

1. Cron fires every 2 minutes (Vercel cron with `Authorization: Bearer $CRON_SECRET`).
2. Receiver authenticates with the service-account JWT impersonating
   `marketing@ryan-realty.com` via Google Workspace domain-wide delegation.
3. `gmail.users.messages.list?q=is:unread in:inbox` returns up to 10 messages
   per tick.
4. For each Gmail message id, the receiver checks `marketing_inbox_events`
   for a row with that `gmail_message_id`. If present → mark Gmail-side as
   read and continue (idempotency safeguard).
5. Fetch full message, parse RFC822 headers + bodies (text first, HTML
   fallback), persist as a new `marketing_inbox_events` row with
   `status='received'`.
6. **Allowlist gate.** Match `from` against `config/marketing-brain/inbox-senders.json`.
   - Match → continue.
   - No match → set `status='killed'`, log `kill_reason`. If
     `default_action_on_unknown_sender='reject_and_alert'`, send a polite
     bounce. Mark Gmail-side as read. Stop.
7. **Parser.** Call Haiku with the system prompt enumerating valid
   `action_types`. Returns `{ action_type, target, payload, confidence,
   rationale }`. Persist to `parsed_*` columns. `status='parsed'`.
8. **Dispatcher.** If `confidence >= 0.70` and `action_type` is known and a
   producer is registered → insert a `marketing_brain_actions` row with the
   parsed intent. Otherwise insert a `comms:matt_alert` row asking Matt to
   triage. Link the inserted row id back to the inbox event as
   `action_row_id`. `status='dispatched'`.
9. **Reply layer.** Compose a short confirmation message describing the
   routing. Run `applyBrandVoice()` on the body. On failure: persist the
   violation list as `reply_error`, do NOT send. On success: send via Gmail
   `users.messages.send` on the original `threadId` with the matching
   `In-Reply-To`. Persist `replied_at`, `reply_status='sent'`,
   `status='replied'`.
10. Mark the Gmail message as read by removing the `UNREAD` label.

Idempotency: `gmail_message_id` is `UNIQUE` on `marketing_inbox_events`. A
retry never inserts a duplicate.

---

## 5. Confidence thresholds and routing

| Parser output | Dispatcher decision |
|---|---|
| confidence ≥ 0.70 AND action_type in registry AND producer registered | Insert `marketing_brain_actions` row with parsed intent |
| confidence ≥ 0.70 AND action_type in registry AND no producer registered | Insert `comms:matt_alert` ("no producer registered for action_type X") |
| confidence < 0.70 | Insert `comms:matt_alert` ("parser confidence below threshold") |
| action_type = 'unknown' | Insert `comms:matt_alert` ("unknown intent") |

The threshold is held in `INBOX_PARSE_CONFIDENCE_THRESHOLD` in
`inbox-parser.ts`. Tune cautiously — lower threshold = more autonomous, more
risk of misrouting; higher threshold = more triage volume on Matt.

---

## 6. Adding a new sender to the allowlist

Edit `config/marketing-brain/inbox-senders.json`:

- Add to `allowlisted_emails` for a specific address, or
- Add to `allowlisted_domains` for an entire domain.

Domain match is exact (no subdomain match). Email match is
case-insensitive. The config is loaded on the first poll after deploy.

Commit + push the JSON change. No code edit required.

---

## 7. Adding a new action_type the parser can emit

When a new producer is added to `marketing_brain_skills/producers/REGISTRY.md`:

1. Append the action_type string to the `VALID_ACTION_TYPES` array in
   `lib/marketing-brain/inbox-parser.ts`.
2. Add an entry to `PRODUCER_REGISTRY` in
   `lib/marketing-brain/inbox-producer-registry.ts` mapping the action_type
   to the producer path.
3. **Add a row to `app/marketing/request/deliverables.ts`** under the right
   group (For a listing / Market reports / Neighborhoods / News, evergreen,
   and social / Email, ads, and reviews / Website). Use broker-friendly
   wording — `label` and `description` are what the broker sees, `prompt`
   is the verb-led sentence the email body will contain.
4. (Optional) Add an example phrasing to the parser system prompt if the
   action_type is ambiguous with a sibling type.

If a parser response references an action_type that is missing from
`VALID_ACTION_TYPES`, the parser downgrades it to `'unknown'`. If it is
missing from the producer registry only, the dispatcher routes it to
`comms:matt_alert` with a `no producer registered` reason. If it is
missing from the broker request page only, brokers can still ask for it
in free-text via the "Anything else" textarea or by emailing directly —
the page menu is not the security boundary. All three paths are safe.

---

## 7.5 Broker request page (`/marketing/request`)

Every reply from marketing@ ends with a signature line linking here:

```
Ryan Realty marketing
Here's what we can build for you: https://ryanrealty.vercel.app/marketing/request
```

The page is a checkbox-driven email builder. Brokers pick from the
catalog, the page reveals only the context fields the team needs
(property address / city / topic / free-text details), and the
"Build my email" button generates a `mailto:` link that opens their
email client with the request pre-written and addressed to
`marketing@ryan-realty.com`.

**No backend writes from the page.** No auth gate. The marketing inbox
itself enforces the allowlist; this page is purely a mailto: builder
so brokers don't have to remember what they can ask for.

**Canonical source for the menu:** `app/marketing/request/deliverables.ts`.

To add a new deliverable to the menu:

1. Open `app/marketing/request/deliverables.ts`.
2. Find the matching group (`DELIVERABLE_GROUPS` array).
3. Append a new entry:
   ```typescript
   {
     id: 'unique_slug',
     label: 'What brokers will read',
     description: 'One-line plain-English explanation. No jargon.',
     prompt: 'Make a <thing>.',  // verb-led; goes into the email body
     needsProperty: true,         // reveals property/MLS# field
     needsMarket: true,           // reveals city/neighborhood field
     needsTopic: true,            // reveals topic field
   }
   ```
4. Commit + push. The page rebuilds on deploy; no other changes needed.

Voice rules apply to `label`, `description`, and `prompt` — no em-dashes,
no banned tropes, sentence case. The reply layer's voice gate doesn't
validate these strings at runtime (they're static), so they're inspected
at review time.

---

## 8. Diagnosing stuck inbox events

Common stuck states and remedies:

| Stuck status | Cause | Fix |
|---|---|---|
| `received` (no parse) | `ANTHROPIC_API_KEY` missing or Haiku errored | Check env; re-run cron route manually with `?maxMessages=1` |
| `parsed` (no dispatch) | Supabase service-role key missing or `marketing_brain_actions` insert errored | Check Supabase logs |
| `dispatched` (no reply) | Voice gate failed OR `gmail.send` scope missing OR Gmail API errored | Inspect `reply_error` column |
| `killed` | Sender not on allowlist OR explicit kill | Confirm intentional; add to allowlist if not |

Manual re-trigger:
```sh
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://ryanrealty.vercel.app/api/cron/marketing-inbox-poll?maxMessages=5"
```

Dry-run (no reply, no read-mark):
```sh
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://ryanrealty.vercel.app/api/cron/marketing-inbox-poll?dryReply=true&dryRead=true&maxMessages=1"
```

---

## 9. Migrating to Path A (Gmail Push)

When email volume justifies near-real-time latency:

1. Provision a Cloud Pub/Sub topic in the `ryanrealty` GCP project.
2. Grant `roles/pubsub.publisher` to `gmail-api-push@system.gserviceaccount.com`.
3. Call `users.watch` with the topic name. The watch expires every 7 days —
   add a cron at `0 0 * * 0` to refresh.
4. Replace the cron route with a webhook endpoint at
   `/api/inbound/marketing-email-push` that consumes the Pub/Sub message and
   calls `pollMarketingInbox({ maxMessages: 25 })`. The Pub/Sub message body
   is the `historyId`, not the email itself — the poll still does the
   `messages.list` step.
5. Remove the `*/2 * * * *` cron entry.

The orchestrator is unchanged. Path A is strictly a trigger swap.

---

## 10. Cost ledger (verified expected — actuals to be measured)

| Component | Per-message cost | Monthly at 100 emails/day |
|---|---|---|
| Anthropic Haiku parser | ~$0.0008 | ~$2.40 |
| Gmail API list + get + modify | $0 | $0 |
| Gmail send (reply) | $0 | $0 |
| Vercel cron (every 2 min) | $0 | $0 |
| Supabase storage (~5KB/event) | <$0.001 | <$0.10 |
| Total | <$0.001 | **<$3** |

Path A swap adds ~$1/month for Pub/Sub at this volume.

---

## 11. Voice gate (replies)

Every outbound confirmation goes through `applyBrandVoice()` from
`lib/marketing-brain/generate-briefs.ts`. The current banned-content list
catches em-dashes, AI filler, fake-urgency tropes, banned vocabulary, and
the standard real estate clichés. A violation does NOT auto-rewrite — it
fails the send and records the violation list so a human can edit the
template if it keeps tripping.

The reply bodies live in `composeBody()` in
`lib/marketing-brain/inbox-reply.ts`. Edit there if a future template
needs to change.

---

## 12. Known limitations

- **No attachment parsing.** Attachments are recorded in `attachments` jsonb
  but not downloaded or routed. A follow-up could pipe attachments to
  Supabase Storage for image/video assets.
- **Plain-text body extraction is best-effort.** HTML-only messages are
  stripped to text via a regex; complex layouts may lose semantics. Haiku
  still parses the result correctly in practice.
- **No multi-recipient routing.** Replies go only to the original sender,
  not `To` + `Cc` + `Bcc` from the inbound. Acceptable for the agent-facing
  inbox; revisit if non-Matt senders start cc'ing teammates.
- **No spam filtering.** Google Workspace's native spam filtering is
  trusted to drop obvious junk before it reaches `is:unread`.
- **One Anthropic call per message.** Anthropic Batches API integration is
  a TODO once volume exceeds ~1000 emails/day.

---

## 13. Memory of locked decisions

| Date | Decision | Why |
|---|---|---|
| 2026-05-14 | Inbox address = `marketing@ryan-realty.com` | Confirmed by Matt in handoff. Separate from `matt@` personal and `noreply@mail.` transactional sender |
| 2026-05-14 | Path B (cron poll) for MVP | Latency budget ≤2 min is acceptable; Path A swap is strictly a trigger change |
| 2026-05-14 | Domain-wide delegation for auth (NOT user OAuth) | Service account already exists; no browser consent flow needed once admin adds `gmail.modify` scope |
| 2026-05-14 | Confidence threshold = 0.70 | Conservative; tune after first 2 weeks of triage volume |
| 2026-05-14 | Default action on unknown sender = `reject_silent` | Avoid bouncing spam back into the world |
| 2026-05-14 | Receiver, parser, dispatcher, reply layer separated into 5 modules | Lets the Path A swap reuse parser + dispatcher + reply 1:1 |
| 2026-05-15 | Broker-friendly reply language (no jargon) | The inbox is for brokers, not internal. No "brain queue", "action row", "producer", or "routing" in any broker-facing surface |
| 2026-05-15 | Broker request page at `/marketing/request` | Linked in every reply signature. Single source of truth for what brokers can ask for. Checkbox-driven mailto: builder |
| 2026-05-15 | RFC-822 `-- ` signature delimiter (not em-dash) | Voice gate bans em-dashes; the RFC sig delimiter is also what every mail client folds into a signature block |
