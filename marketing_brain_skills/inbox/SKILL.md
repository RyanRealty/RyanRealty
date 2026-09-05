---
name: marketing-brain-inbox
description: >
  Inbound-email entry point for the marketing brain. Polls marketing@ryan-realty.com,
  parses each message, and files a marketing_brain_actions row. Does not run a
  producer (CLAUDE.md §5). Media production is Studio (CLAUDE.md §4). Use this
  skill when reasoning about how inbound email becomes a brain action, how to
  extend the allowlist, or how to diagnose a stuck inbox event.
action_types: []
---

# STOP. File a row. Run no producer.

Hourly SKILL.md producers are off (CLAUDE.md §5, 2026-08-18). Inbox +
`/marketing/request` insert a `marketing_brain_actions` row and stop. Do not
dispatch a producer. Do not load `video_production_skills/**`.

**Media / social production is the Studio:** `lib/studio/`, `/admin/studio`,
`/api/cron/studio-slate`. Drafts land `ready`. Matt's §1 stamp plus
`/api/cron/publisher-sweep` → `/api/social/publish`.

# Marketing Brain.  Inbox

**Scope:** Owns the read side of the marketing brain. Anything that turns an
inbound email at `marketing@ryan-realty.com` into a tracked action row lives
here. Does NOT generate content, run audits, or make budget decisions.

**Status:** Canonical. Locked 2026-09-05 to CLAUDE.md §5.
**Receiver path:** `/api/cron/marketing-inbox-poll` (Path B. cron poll every 2 min)
**Upgrade path:** Gmail Push via Cloud Pub/Sub (Path A). same receiver logic, swap the trigger.

---

## 1. When to use this skill

- Matt sends an email to `marketing@ryan-realty.com` and you need to reason
  about why the pipeline did or did not pick it up.
- A new sender needs to be allowed to file a row via email.
- An inbox event is stuck in `received` / `parsed` / `dispatched` and is not
  closing out.
- The reply-layer voice gate rejects a confirmation and the brain falls
  silent.

Do NOT use this skill for:
- Drafting outbound marketing email. that is `ops-email-send` (if live) or Studio.
- Generating brain-side digests. that is `daily-digest` if still wired.
- CRM sequence email. that is `lib/crm/` / `/admin/crm/sequences`.
- Running a producer. Producers do not run from inbox.

---

## 2. Required reading before extending

| Reference | Why |
|---|---|
| `CLAUDE.md` §4. Studio | Live media path |
| `CLAUDE.md` §5. Producer runtime retired | File a row, run no producer |
| `CLAUDE.md` §0. Data Accuracy | Any reply containing numbers must trace |
| `docs/handoffs/marketing-inbox-agent.md` | Original architecture |
| `docs/handoffs/marketing-inbox-admin-setup.md` | Workspace Admin step for the read path |

---

## 3. Architecture

```
        marketing@ryan-realty.com (Google Workspace)
                       │
                       │ Gmail API (DWD)
                       ▼
   /api/cron/marketing-inbox-poll  every 2 minutes
                       │
              inbox-dispatcher
                       │
                       ▼
        marketing_brain_actions row
                       │
                       ▼
            STOP. No producer pickup.
            Media → Studio (/admin/studio)
```

Files of record:

| Purpose | Path |
|---|---|
| Database schema | `supabase/migrations/20260514120000_marketing_inbox_events.sql` |
| Auth (DWD JWT) | `lib/marketing-brain/inbox-auth.ts` |
| Allowlist gate | `lib/marketing-brain/inbox-allowlist.ts` |
| Sender allowlist data | `config/marketing-brain/inbox-senders.json` |
| Haiku parser | `lib/marketing-brain/inbox-parser.ts` |
| action_type table | `lib/marketing-brain/inbox-producer-registry.ts` |
| Dispatcher | `lib/marketing-brain/inbox-dispatcher.ts` |
| Reply layer | `lib/marketing-brain/inbox-reply.ts` |
| Top-level orchestrator | `lib/marketing-brain/inbox-poll.ts` |
| Cron route | `app/api/cron/marketing-inbox-poll/route.ts` |
| Cron schedule | `vercel.json` (entry: `*/2 * * * *`) |
| Broker request page | `app/marketing/request/page.tsx` |
| Request page interactive | `app/marketing/request/RequestBuilder.tsx` |
| Broker catalog | `app/marketing/request/deliverables.ts` |

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
8. **Dispatcher.** If `confidence >= 0.70` and `action_type` is known →
   insert a `marketing_brain_actions` row with the parsed intent. Otherwise
   insert a `comms:matt_alert` row asking Matt to triage. Link the inserted
   row id back to the inbox event as `action_row_id`. `status='dispatched'`.
   **Do not run a producer. The row sits pending.**
9. **Reply layer.** Compose a short confirmation that the request was filed.
   Run `applyBrandVoice()` on the body. On failure: persist the violation
   list as `reply_error`, do NOT send. On success: send via Gmail
   `users.messages.send` on the original `threadId`. Persist `replied_at`,
   `reply_status='sent'`, `status='replied'`.
10. Mark the Gmail message as read by removing the `UNREAD` label.

Idempotency: `gmail_message_id` is `UNIQUE` on `marketing_inbox_events`. A
retry never inserts a duplicate.

---

## 5. Confidence thresholds and routing

| Parser output | Dispatcher decision |
|---|---|
| confidence ≥ 0.70 AND action_type known | Insert `marketing_brain_actions` row. Run no producer. |
| confidence < 0.70 | Insert `comms:matt_alert` ("parser confidence below threshold") |
| action_type = 'unknown' | Insert `comms:matt_alert` ("unknown intent") |

The threshold is held in `INBOX_PARSE_CONFIDENCE_THRESHOLD` in
`inbox-parser.ts`.

Media intents (`content:*` video / reel / social motion) still file a row.
Production is Studio, not a SKILL.md producer.

---

## 6. Adding a new sender to the allowlist

Edit `config/marketing-brain/inbox-senders.json`:

- Add to `allowlisted_emails` for a specific address, or
- Add to `allowlisted_domains` for an entire domain.

Domain match is exact (no subdomain match). Email match is
case-insensitive. Commit + push the JSON change. No code edit required.

---

## 7. Do not add producers from this skill

Producer-layer freeze stands. Do not append new `action_type` → producer
path mappings in order to auto-run SKILL.md producers. Inbox files a row.
Studio is the media factory. TypeScript products (CMA, newsletter, CRM,
Facebook seller report) stay TypeScript.

The broker request page menu at `/marketing/request` is a mailto: builder.
Canonical source: `app/marketing/request/deliverables.ts`. It does not
start a producer.

---

## 7.5 Broker request page (`/marketing/request`)

Every reply from marketing@ ends with a signature line linking here:

```
Ryan Realty marketing
Here's what we can build for you: https://ryanrealty.vercel.app/marketing/request
```

The page is a checkbox-driven email builder. **No backend writes from the
page.** No auth gate. The marketing inbox enforces the allowlist. The page
is a mailto: builder so brokers do not have to remember what they can ask
for.

Voice rules apply to `label`, `description`, and `prompt`. no em-dashes,
no banned tropes, sentence case.

---

## 8. Diagnosing stuck inbox events

| Stuck status | Cause | Fix |
|---|---|---|
| `received` (no parse) | `ANTHROPIC_API_KEY` missing or Haiku errored | Check env; re-run cron route manually with `?maxMessages=1` |
| `parsed` (no dispatch) | Supabase service-role key missing or `marketing_brain_actions` insert errored | Check Supabase logs |
| `dispatched` (no reply) | Voice gate failed OR `gmail.send` scope missing OR Gmail API errored | Inspect `reply_error` column |
| `dispatched` (no content) | Expected. Rows are not produced. | Open Studio for media. |
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
3. Call `users.watch` with the topic name. The watch expires every 7 days.
   add a cron at `0 0 * * 0` to refresh.
4. Replace the cron route with a webhook endpoint at
   `/api/inbound/marketing-email-push` that consumes the Pub/Sub message and
   calls `pollMarketingInbox({ maxMessages: 25 })`.
5. Remove the `*/2 * * * *` cron entry.

The orchestrator is unchanged. Path A is strictly a trigger swap. It still
files a row and runs no producer.

---

## 10. Voice gate (replies)

Every outbound confirmation goes through `applyBrandVoice()` from
`lib/marketing-brain/generate-briefs.ts`. A violation does NOT auto-rewrite.
it fails the send and records the violation list.

The reply bodies live in `composeBody()` in
`lib/marketing-brain/inbox-reply.ts`. Do not promise that a producer is
running. The confirmation is that the request was filed.

---

## 11. Known limitations

- **No attachment parsing.** Attachments are recorded in `attachments` jsonb
  but not downloaded or routed.
- **No producer pickup.** By design (CLAUDE.md §5).
- **Plain-text body extraction is best-effort.** HTML-only messages are
  stripped to text via a regex.
- **No multi-recipient routing.** Replies go only to the original sender.
- **No spam filtering.** Google Workspace native spam filtering is trusted.

---

## 12. Memory of locked decisions

| Date | Decision | Why |
|---|---|---|
| 2026-05-14 | Inbox address = `marketing@ryan-realty.com` | Confirmed by Matt in handoff |
| 2026-05-14 | Path B (cron poll) for MVP | Latency budget ≤2 min is acceptable |
| 2026-05-14 | Domain-wide delegation for auth (NOT user OAuth) | Service account already exists |
| 2026-05-14 | Confidence threshold = 0.70 | Conservative |
| 2026-05-15 | Broker-friendly reply language (no jargon) | Inbox is for brokers |
| 2026-05-15 | Broker request page at `/marketing/request` | mailto: builder |
| 2026-08-18 | File a row, run no producer | CLAUDE.md §5. Producer runtime retired |
| 2026-09-05 | Media is Studio, not video_production_skills | D7. CLAUDE.md §4 |
