# Handoff — Marketing Inbox Agent

**Mission:** Stand up an always-on email intake pipeline for the dedicated agent-facing inbox `marketing@ryan-crealty.com`. Every inbound email becomes a tracked action in the marketing brain queue, gets parsed for intent, dispatched to the matching producer (or routed for triage if intent is unclear), and the sender gets a confirmation reply within the same minute.

The user (Matt) wants this to "just work" — he sends an email from anywhere, and the brain picks it up and acts on it. He should not have to log into a dashboard or poll for status.

**This handoff is self-contained. You have full autonomy to execute. Surface drafts before final commit per CLAUDE.md §0.5; otherwise grind.**

---

## 0. Domain verification (do this first)

Matt wrote the email address as `marketing@ryan-crealty.com`. Every other Ryan Realty domain reference in the codebase uses `ryan-realty.com` (no `c`) — see CLAUDE.md "production domain" memory, the Resend SKILL.md (`mail.ryan-realty.com`), the website canonical, every email signature kit.

Three possibilities:
1. Typo — Matt meant `marketing@ryan-realty.com`. Most likely. Verify via DNS lookup or by asking Matt.
2. New separate domain — Matt registered `ryan-crealty.com` deliberately for agent-only inbound. Then DNS + MX records would be live. Check.
3. Subdomain — `marketing.ryan-realty.com` or similar. Ask Matt.

**Confirm before building anything.** Wrong domain = receiver builds the wrong webhook. Quick MX record check:

```sh
dig MX ryan-crealty.com +short
dig MX ryan-realty.com +short
```

Whichever resolves to a real mail provider (Google, Microsoft 365, Resend inbound, etc.) is the live domain. If both resolve, Matt has two domains and you ask him which one this inbox lives on.

---

## 1. Required reading (in order)

1. `CLAUDE.md` — especially §0 (data accuracy), §0.5 (draft-first), "Marketing Brain Architecture", "Work Standards", "Persistent memory (repo)", "Skill Routing"
2. `.auto-memory/memory_marketing_brain_decisions.md` — every decision the brain has shipped through 2026-05-14 + the cross-session git collision gotcha
3. `marketing_brain_skills/produce/SKILL.md` — the brain's direct-produce entry point; your inbox agent likely routes parsed emails through this
4. `marketing_brain_skills/producers/REGISTRY.md` — action_type → producer lookup table; the inbox parser maps email intent to action_type
5. `marketing_brain_skills/tools_registry/REGISTRY.md` + the 7 authored tool SKILL.mds (supabase, replicate, spark_mls, meta_graph, resend, apify, anthropic-classifier)
6. `supabase/migrations/20260513170000_marketing_brain_actions.sql` — the action queue schema
7. `lib/marketing-brain/daily-digest.ts` — example of a brain-side module that inserts comms action rows (your inbox handler will follow a similar pattern but on the inbound side)
8. `app/api/cron/marketing-daily-digest/route.ts` — the cron route pattern your scheduled poller can copy
9. `marketing_brain_skills/producers/comms-matt-alert/SKILL.md` — covers comms:* action_types; useful when the inbox needs to alert Matt about an unparseable email

If there's already a Gmail integration in the repo, you'll find it via `grep -rn "googleapis.com\|gmail\|google-auth" lib/ app/api/`. There's also a `Read_and_Send_iMessages` MCP and likely a Gmail MCP (`mcp__dadfc8c5...`); check `list_mcp_resources` if you need it.

---

## 2. State of the world

What you can build on:

- **Marketing brain action queue** is live in Supabase (project `dwvlophlbvvygjfxcrhm`, table `public.marketing_brain_actions`). Every action a producer executes flows through this. Inbox-triggered work should produce one row per email.
- **`marketing_brain_skills/produce/SKILL.md`** already accepts natural-language requests and parses them into structured action rows. Your inbox parser should ideally hand parsed-email-content to this skill rather than re-implement the parsing logic.
- **`comms:matt_alert` + `comms:matt_summary`** action types route to email/iMessage/dashboard via the existing comms-matt-alert producer. Use these for status replies and parse-failure alerts.
- **Vercel cron** is the standard scheduling layer. `vercel.json` has 30+ entries. Daily digest just landed at `0 14 * * *`. You can add a `*/2 * * * *` cron for aggressive polling, or set up a Gmail Push subscription for near-real-time.
- **Anthropic API** integration pattern is established (see `lib/marketing-brain/audit-classifier.ts`). Use Haiku for cheap email intent classification.
- **Resend** for outbound transactional email is wired but `mail.ryan-realty.com` is pending DNS verification. If you send confirmation replies via Resend, see `marketing_brain_skills/tools_registry/resend/SKILL.md` for the unblock path. Until verified, fall back to Gmail-as-sender via OAuth (works today).

What does NOT yet exist:

- No Gmail OAuth flow specifically for `marketing@ryan-crealty.com` (verify this — the existing Gmail integration may already cover it).
- No inbox-events table.
- No email parser.
- No webhook receiver for inbound mail.
- No Gmail Push (Pub/Sub) subscription set up.

---

## 3. Architectural recommendation

You have three paths to "always trigger on new email." Pick one and ship it; trade-offs documented so future you can swap later.

### Path A — Gmail Push via Cloud Pub/Sub (recommended for production)

Gmail's `users.watch` API publishes to a Google Cloud Pub/Sub topic on every mailbox change. Your webhook subscribes to the topic and receives near-real-time notifications.

- Latency: typically <5 seconds from email arrival to webhook fire
- Cost: Pub/Sub is essentially free at this volume
- Complexity: medium — requires Cloud project + Pub/Sub topic + Gmail watch refresh every 7 days
- Setup: see https://developers.google.com/gmail/api/guides/push

### Path B — Aggressive cron polling (recommended for MVP)

Vercel cron at `*/2 * * * *` (every 2 minutes) hits `/api/cron/marketing-inbox-poll`. Route calls `gmail.users.messages.list` with `q=is:unread`, processes each, marks as read.

- Latency: up to 2 minutes
- Cost: ~21,600 cron runs/month (well within Vercel limits)
- Complexity: low — single route + cron entry
- Risk: Vercel cron has a minimum granularity (often 1 minute on Pro plan; verify before scheduling tighter)

### Path C — IMAP IDLE long-poll

A long-lived Node process holds an IMAP IDLE connection. Not compatible with Vercel's serverless model. Would require a separate worker on Fly.io, Railway, or similar.

- Not recommended; Vercel-native paths above are simpler.

**Pick Path B for MVP (ships today), then upgrade to Path A once the parser + dispatcher are stable.** Architecturally Path B is a strict subset of Path A — the receiver logic is identical; only the trigger changes.

### Data model — new table `marketing_inbox_events`

Independent of `marketing_brain_actions` so an email can fail to parse without dirtying the action queue.

```sql
create table public.marketing_inbox_events (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  gmail_message_id text not null unique,
  gmail_thread_id text not null,
  sender_email text not null,
  sender_name text,
  subject text,
  body_text text,
  body_html text,
  attachments jsonb default '[]'::jsonb,
  -- Parser output
  parsed_at timestamptz,
  parsed_intent text,         -- e.g. 'content:listing_reel' or 'unknown'
  parsed_target text,         -- e.g. 'mls:220189422'
  parsed_payload jsonb,
  parser_confidence numeric,
  parser_model text,
  -- Action linkage
  action_row_id uuid references public.marketing_brain_actions(id) on delete set null,
  -- Reply tracking
  replied_at timestamptz,
  reply_status text,          -- 'sent' | 'failed' | 'skipped'
  -- Lifecycle
  status text not null default 'received'
    check (status in ('received', 'parsed', 'dispatched', 'replied', 'killed'))
);
create index on public.marketing_inbox_events (status);
create index on public.marketing_inbox_events (sender_email);
create index on public.marketing_inbox_events (received_at desc);
grant select, insert, update, delete on public.marketing_inbox_events to service_role;
```

Apply via Supabase MCP (`apply_migration`) in the same commit as the code that uses it (per CLAUDE.md Work Standards).

### Parser — LLM-based intent classification

Email bodies are unstructured. Hardcoded regex rules will fail on the long tail. Use Haiku for classification:

- Input: `from`, `subject`, `body_text` (first 2000 chars), list of valid action_types from `producers/REGISTRY.md` Sections A-F
- Output JSON: `{ action_type, target, payload: {...}, confidence: 0.0-1.0, rationale }`
- Confidence threshold: 0.7. Below → mark as `parsed_intent='unknown'` and route to `comms:matt_alert` for manual triage.

Reuse the `getClassifierSystemPrompt()` pattern from `lib/marketing-brain/topic-taxonomy.ts` as a template, but build a separate `getInboxParserPrompt()` that lists valid action_types from the producer registry.

### Sender allowlist (security)

Anyone with the address can email it. The pipeline must:

1. Match `from` against a configurable allowlist (start with `matt@ryan-realty.com` + Matt's other personal addresses)
2. Reject non-allowlisted senders with a polite bounce reply (or silent drop)
3. Log every rejection in `marketing_inbox_events` with `status='killed'` and a kill reason

The allowlist lives in `config/marketing-brain/inbox-senders.json` — same pattern as `competitors.json`.

### Confirmation reply

After successful dispatch, the agent replies-all on the original thread with:

- The parsed intent + action row ID
- A link to the marketing dashboard view of the action row
- The expected next step (e.g. "Draft will be in dashboard within 15 minutes" / "Producer Authoring session will pick this up on next cycle")

Voice rules apply: no em dashes, no banned phrases, no fake urgency, "you/your" subject. The reply text goes through `applyBrandVoice()` from `lib/marketing-brain/generate-briefs.ts` before send.

---

## 4. Scope boundaries

**In scope:**
- The receiver (webhook OR cron poll)
- The parser (LLM-based intent classification)
- The dispatcher (insert action row, optionally call produce/SKILL.md routing)
- The reply layer (confirmation back to sender)
- The allowlist + security layer
- The `marketing_inbox_events` table + migration
- One end-to-end test against a real test email
- Documentation in `marketing_brain_skills/inbox/SKILL.md` (you author this — same template as `produce/SKILL.md`)

**Out of scope:**
- Authoring new producer SKILL.md files (Producer Authoring session owns that)
- Modifying any existing producer's SKILL.md
- Modifying `producers/REGISTRY.md` (only Producer Authoring adds rows)
- Modifying `lib/marketing-brain/generate-briefs.ts` (the brain mapper layer)
- Anthropic Batches API integration (sync calls are fine at expected volume)
- Multi-recipient routing (you reply only to the original sender for now)

---

## 5. Work items (priority order)

1. **Verify the domain** (§0 above). Don't build anything until you know which domain is real.
2. **Pick the trigger path** (§3 — Path A vs Path B). Recommend Path B (cron poll) for MVP.
3. **Author the migration** for `marketing_inbox_events` and apply via Supabase MCP. Same commit as the code that uses it.
4. **Build the receiver** — cron route at `/api/cron/marketing-inbox-poll/route.ts` OR webhook at `/api/inbound/marketing-email/route.ts`. Fetches new messages, writes to `marketing_inbox_events`, marks as read in Gmail.
5. **Build the parser** — `lib/marketing-brain/inbox-parser.ts`. Anthropic Haiku call. Reads valid action_types from producer registry. Writes parsed_* fields back to the inbox_events row.
6. **Build the dispatcher** — `lib/marketing-brain/inbox-dispatcher.ts`. For confident parses (≥0.7), inserts a `marketing_brain_actions` row mirroring the parsed intent. For low confidence, inserts a `comms:matt_alert` row asking Matt to triage manually.
7. **Build the reply layer** — `lib/marketing-brain/inbox-reply.ts`. Composes the confirmation message, validates voice, sends via Gmail OAuth (since Resend is blocked on DNS until that's verified). Sets `replied_at` + `reply_status`.
8. **Author the allowlist config** — `config/marketing-brain/inbox-senders.json` with Matt's known addresses + a `default_action_on_unknown_sender: 'reject_and_alert'` field.
9. **Wire the cron schedule** — add `{ "path": "/api/cron/marketing-inbox-poll", "schedule": "*/2 * * * *" }` to `vercel.json`.
10. **Author `marketing_brain_skills/inbox/SKILL.md`** — same template as `produce/SKILL.md`. Documents triggers, scope, procedure, action types, related skills.
11. **End-to-end test** — send a real email to the verified address from Matt's account. Confirm it lands in `marketing_inbox_events`, parses to a valid action_type, dispatches to `marketing_brain_actions`, and the confirmation reply arrives back in Matt's inbox.
12. **Update memory** — append a section to `.auto-memory/memory_marketing_brain_decisions.md` documenting what shipped, the chosen trigger path, and any gotchas discovered.

---

## 6. Approval rules + voice gates (non-negotiable)

- **Draft-first** per CLAUDE.md §0.5. Show changes before commit. Do NOT auto-send the first reply — show Matt the composed reply text before enabling auto-send.
- **Voice validation** on every outbound reply via `applyBrandVoice()`. Reject on banned phrases / em dashes / fake urgency.
- **Data accuracy** per §0. If the parsed email references market data or listing facts, the dispatched action row must inherit the verification trace requirements. Don't fabricate any number in a reply.
- **No `git add -A`** — the cross-session collision gotcha is documented in the memory log. Stage specific files. `git status --short` before every commit.
- **Pull rebase before push.**
- **Push immediately after commit.**

---

## 7. Existing patterns to reuse (don't reinvent)

| Pattern | Reference |
|---|---|
| Cron route auth | `lib/marketing-brain/snapshot.ts` `isAuthorizedCron()` |
| Supabase service client | `getSupabase()` pattern in any `lib/marketing-brain/*.ts` |
| LLM call via fetch | `callAnthropic()` in `lib/marketing-brain/audit-classifier.ts` |
| Action row insert | `persistBriefs()` in `lib/marketing-brain/generate-briefs.ts` |
| Voice validation | `applyBrandVoice()` in `lib/marketing-brain/generate-briefs.ts` |
| Migration application | Supabase MCP `apply_migration` tool |
| Cron schedule entry | `vercel.json` (~30 existing examples) |

---

## 8. Definition of done

- Matt sends a test email to the verified address. Within ≤2 minutes (or ≤5 seconds if you ship Path A), it lands in `marketing_inbox_events` with `status='dispatched'`.
- The dispatched row references a valid `marketing_brain_actions` row with the right action_type for the parsed intent.
- Matt receives a confirmation reply on the original thread, voice-validated, within the same window.
- Non-allowlisted senders get rejected and logged; no action row is created.
- The 12 work items above are all complete + committed + pushed.
- Memory log updated with the architectural choices made.
- `marketing_brain_skills/inbox/SKILL.md` exists and documents the procedure.

When all 8 are true, surface a summary to Matt with the test-email transcript + the commit shas and stop.

---

## 9. Cost model (for budget transparency)

| Component | Cost / month at expected volume |
|---|---|
| Vercel cron (every 2 min) | ~$0 (within plan) |
| Gmail API quota | Free (1B units/day) |
| Pub/Sub (if Path A) | <$1 |
| Anthropic Haiku parsing (assume 100 emails/day, 1000 input tokens each) | ~$0.10 |
| Resend or Gmail OAuth reply | Free |
| Supabase storage | <$1 |
| **Total** | **<$5/month** |

Costs surface in the response payload of the cron route for spot-checking.

---

## 10. Final note

The marketing brain just shipped its biggest architectural lift in one day (4/21 → 14/21 producer coverage; audit infrastructure live; 7 tool SKILL.mds authored). The brain is healthy. Your job is the next layer up: make it triggerable by email so Matt's workflow is "send an email, work happens" without dashboards or polling.

You have the patterns, the producers, the queue, the voice gates, and the auth. Build the inbox layer, prove it end-to-end with one real email, ship it.

Stop bouncing back to Matt for architectural micro-decisions — pick the recommended path, document the choice in the memory log, keep going. Only surface for ship sign-off and for the domain question in §0.
