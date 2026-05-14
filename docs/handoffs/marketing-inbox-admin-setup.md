# Marketing Inbox — One-Time Admin Setup

**Owner:** Matt
**Why this exists:** The marketing-inbox pipeline (`/api/cron/marketing-inbox-poll`)
needs two pieces of admin config that the brain cannot grant itself:

1. **Workspace DWD scope** — add `gmail.modify` so the brain can read inbox + mark as read.
2. **`ANTHROPIC_API_KEY` env var** — the Haiku parser cannot run without it.

Both are one-time. Time required: under 5 minutes total.

---

## Action 1 — Add `gmail.modify` to the DWD allowlist (under 60 seconds)

The service-account `viewer@ryanrealty.iam.gserviceaccount.com` currently has
`gmail.send` only. Adding `gmail.modify` unlocks the read path without
touching anything else.

---

### Steps

1. Open https://admin.google.com (sign in as the Workspace super admin).
2. Navigate: **Security → Access and data control → API controls**.
3. Click **Manage Domain-wide Delegation**.
4. Find the row whose **Client ID** is:

   ```
   116585568564644399058
   ```

   (This is the unique numeric Client ID of the service account
   `viewer@ryanrealty.iam.gserviceaccount.com`. If the row currently lists
   `https://www.googleapis.com/auth/gmail.send` among its OAuth scopes,
   that is the correct row.)

5. Click **Edit**.
6. In the **OAuth scopes (comma-delimited)** box, **append** these two scopes
   to the existing list (do NOT replace what is there):

   ```
   https://www.googleapis.com/auth/gmail.modify
   ```

   The final list should contain at minimum:

   ```
   https://www.googleapis.com/auth/gmail.send,
   https://www.googleapis.com/auth/gmail.modify
   ```

   Plus any scopes already there (GSC, GA4, Drive, etc.).

7. Click **Authorize**.

That's it.

---

### How to verify Action 1 worked

From the repo root, with `.env.local` loaded:

```sh
node --env-file=.env.local scripts/marketing-inbox-verify-auth.mjs
```

Expected output:

```
read scope ok
send scope ok
profile: { emailAddress: 'marketing@ryan-realty.com', ... }
unread count: <number>
```

If any of those lines say `FAIL` with `unauthorized_client`, the scope
addition did not propagate yet (allow up to 5 minutes) or was added to the
wrong service account. Re-check the Client ID against the value above.

---

---

## Action 2 — Provision `ANTHROPIC_API_KEY` (under 2 minutes)

The Haiku parser at `lib/marketing-brain/inbox-parser.ts` reads
`process.env.ANTHROPIC_API_KEY`. Without it the parser short-circuits to
`action_type='unknown'` and every email gets routed to manual triage —
the pipeline runs but the autonomy story breaks.

The same key is also referenced by `lib/marketing-brain/audit-classifier.ts`
(competitor content classification), so adding it unlocks two skills in one go.

### Steps

1. Open https://console.anthropic.com (Matt's account).
2. Settings → API keys → **Create key**. Name it `ryanrealty-marketing-brain`.
3. Copy the `sk-ant-...` value.
4. From the repo root, add it to Vercel for all three envs:

   ```sh
   vercel env add ANTHROPIC_API_KEY production
   vercel env add ANTHROPIC_API_KEY preview
   vercel env add ANTHROPIC_API_KEY development
   ```

   Paste the key each time. (Or one-liner: add via the Vercel dashboard
   under Settings → Environment Variables, select all three envs.)

5. Also drop it into `.env.local` so local scripts can run:

   ```
   ANTHROPIC_API_KEY=sk-ant-…
   ```

6. Re-deploy is automatic on next push; or trigger via `vercel deploy --prod`.

### How to verify Action 2 worked

From the repo root with `.env.local` loaded:

```sh
node --env-file=.env.local scripts/marketing-inbox-smoke-parser.mjs
```

Expected: 6 scenarios print `[PASS]` and the parser returns valid JSON for each.

---

## What this unblocks

Once both actions are complete, the cron route `/api/cron/marketing-inbox-poll`
starts processing every unread email in `marketing@ryan-realty.com` within
2 minutes:

1. Parses each via Anthropic Haiku to extract `action_type` + `target`.
2. Inserts a `marketing_brain_actions` row for the matching producer.
3. Sends a voice-validated confirmation reply on the original thread.
4. Marks the Gmail message as read.

If only Action 1 lands (read scope OK, no Anthropic key), the cron still
runs end-to-end but every parse confidence is 0.0 and every email routes
to `comms:matt_alert` for manual triage. Workable, but not the goal.

If only Action 2 lands (Anthropic key OK, no read scope), the cron
short-circuits with `{"status": "auth_pending"}` and does nothing else —
no errors, no retries, no noise.

---

## Why DWD instead of a per-mailbox OAuth flow

The service account already exists, already has Workspace impersonation for
the `ryan-realty.com` domain, and already sends transactional email via
`gmail.send` from `matt@ryan-realty.com`. Adding `gmail.modify` gives the
same client the inbox-read capability for `marketing@ryan-realty.com`
without a separate refresh-token storage, OAuth consent flow, or per-user
re-auth. One scope, one config edit, done.

If we ever need a per-mailbox OAuth instead (e.g. a partner inbox outside
the Workspace domain), the producer registry pattern still applies — only
the auth layer changes.

---

## Locked 2026-05-14.
