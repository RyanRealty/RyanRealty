# External API documentation template

Use this structure when writing `docs/<api>-api.md`.

````markdown
# <Service> API Reference

> Source of truth: <verified quirks / live probing / vendor docs — state which per section>.
> Consumers in this repo: <top-level list of client modules>.
> Last verified: {DATE}

## Authentication

{How we authenticate: env var names (never values), token lifetime, refresh behavior, where the client lives in this repo.}

## Verified quirks (outrank vendor docs)

{Every empirically-established behavior that differs from or isn't in the vendor docs. One bullet each, with the date verified and the memory/doc it came from.}

## Endpoints

### <Resource group>

#### `POST /v1/example` — What it does

- **Auth**: {scheme}
- **Request**:
  ```typescript
  { field: string }
  ```
- **Response** (observed live {DATE} / per vendor docs, unverified):
  ```typescript
  { id: string }
  ```
- **Side effects**: {webhooks, downstream records, messages sent}
- **Consumers**: `lib/example-client.ts`, `app/api/example/route.ts`
- **Gotchas**: {rate limits, pagination caps, silent failure modes}

{Repeat per endpoint. Group by resource.}

## Webhooks (inbound)

{Events we receive, their payloads as observed, the route that handles each, dedup/idempotency behavior.}

## Drift log

| Date   | Change observed                          | Action taken |
| ------ | ---------------------------------------- | ------------ |
| {DATE} | Initial documentation                    | —            |
````
