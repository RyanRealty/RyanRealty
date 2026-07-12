---
name: document-external-api
description: "Generate or refresh docs/<api>-api.md for an external API this repo consumes (FUB, SkySlope, Spark, Twilio, ElevenLabs, Meta, Resend). Captures endpoints, request/response shapes, auth, side effects, and verified quirks; cross-references our consumer code and flags drift. Use when documenting an external API, when an integration breaks unexpectedly, or when onboarding a new external service."
---

# Document external API

Generalized from the `document-ai-hero-api` skill in Matt Pocock's `course-video-manager` (reviewed 2026-07-11). His version reads one hardcoded sibling repo; ours parameterizes the pattern for the external services this repo actually consumes.

## The pattern

API docs written from memory rot. Docs written by scanning the source of truth AND cross-referencing our own consumer code stay honest — they capture what the API really does and what we really use, and every refresh surfaces drift between the two.

## Workflow

### 1. Identify the source of truth (in priority order)

1. **Verified quirks already recorded in this repo** — memory files and `docs/` findings (e.g. FUB `/v1/deals` status always 'Active'; FUB blocks POST /v1/emails for integrations; SkySlope internal API cracked via browser token; Meta delivery_estimate flooring). These were established empirically and OUTRANK official docs where they conflict. Fold them in, never contradict them.
2. **Live probing** through already-established client code paths, where a safe read-only call can confirm a shape.
3. **Official vendor docs** — for coverage of endpoints we haven't touched yet. Mark these entries as unverified-by-us.

### 2. For each endpoint we use (or plan to use), capture

- HTTP method + path, or SDK method
- Request body / query params with TypeScript types as our client sends them
- Response shape as actually observed (not just as documented)
- Auth (API key, OAuth token + refresh behavior, session cookie, HMAC)
- Side effects (webhooks fired, records created elsewhere, emails/SMS sent)
- Rate limits, pagination caps, and gotchas (e.g. PostgREST 1000-row cap pattern)

### 3. Cross-reference our consumers

Grep `lib/`, `app/api/`, `app/actions/`, and `scripts/` for the client code that calls each endpoint. Record file paths in the doc. Flag:

- Endpoints we call that changed shape vs what our code expects (breaking drift)
- Endpoints documented but unused (candidates for capability, not cleanup)
- Multiple call sites with divergent request construction (consolidation candidates)

### 4. Write the doc

Output to `docs/<api>-api.md` following [TEMPLATE.md](TEMPLATE.md). If a doc for that API already exists (check `docs/` first — several do), update it in place rather than creating a parallel file.

### 5. Summary

After writing, report: endpoints documented, breaking drift detected vs current usage, verified-quirk entries carried forward, and unverified entries that need a live confirmation before anything ships against them.

## Standing rules

- Never store credentials or tokens in the doc — reference the env var name only.
- A response shape claimed in the doc that was neither observed live nor carried from a verified-quirk record must be labeled `(per vendor docs, unverified)`.
- When an integration incident reveals a new quirk, updating the API doc is part of closing the incident — same bidirectional rule as skills and CONTEXT.md.
