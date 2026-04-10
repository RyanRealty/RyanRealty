---
name: skyslope-api
description: >-
  Explains SkySlope API families, authentication, env vars for this repo, and
  safe patterns for auditing listings/sales files via API. Use when the user
  mentions SkySlope API, transaction files, bulk export, audit logs, OAuth,
  Integrations keys, api-latest.skyslope.com, or wiring SKYSLOPE_* environment
  variables.
---

# SkySlope APIs and integration

## Multiple APIs (do not conflate)

SkySlope exposes **different** REST APIs with **different** auth:

| API | Typical use | Auth pattern | Doc entry (public) |
|-----|-------------|--------------|-------------------|
| **Listings / Sales** (transaction files, bulk export, audit trails) | Brokerage data export, ERP, custom tools | **HMAC** + `POST /auth/login` → session | Redoc: `https://api-latest.skyslope.com/api/docs/redoc/index.html?url=/swagger/v1/swagger.json` |
| **Forms (Partnership)** | Forms libraries, files, envelopes, signed docs | **OAuth 2.0 authorization code** → Bearer | https://forms.skyslope.com/partner/api/docs |
| **Offers** | Listings/offers analytics | **OAuth 2.0 client credentials** → Bearer | https://offers.skyslope.com/offers-api/reference |

If the user says “SkySlope API,” **ask which surface** unless context is obvious (this repo’s `.env.example` targets the **Listings/Sales** style keys).

## Listings/Sales API: credentials (Ryan Realty repo)

Required env names (see `.env.example`):

- `SKYSLOPE_ACCESS_KEY` / `SKYSLOPE_ACCESS_SECRET` — **My Account → Integrations** (generate key).
- `SKYSLOPE_CLIENT_ID` / `SKYSLOPE_CLIENT_SECRET` — from **Customer Success Manager** (SkySlope FAQ; used in HMAC and login body).

**Common mistake:** `SKYSLOPECLIENT_SECRET` (missing underscore) — wrong; use `SKYSLOPE_CLIENT_SECRET`.

### Auth algorithm (summary)

Official pattern mirrors SkySlope’s public example repo:

- Timestamp: ISO UTC string.
- `hmac = HMAC-SHA256(accessSecret, clientId + ":" + clientSecret + ":" + timestamp)` → base64.
- Headers: `Authorization: ss {accessKey}:{hmac}`, `Timestamp: {timestamp}`, `Content-Type: application/json`.
- Body: JSON with `ClientId` and `ClientSecret`.
- `POST` login: prefer `https://api-latest.skyslope.com/auth/login` (confirm with SkySlope if your contract names a different host).

Successful responses use fields such as **`Session`** and **`Expiration`** (use session value as Bearer for subsequent calls per current swagger).

**Reference implementation:** https://github.com/cybercoinc/skyslope-example-authentication (and related SkySlope sample repos).

## Operational commands (this repo)

- Push Listings/Sales vars to Vercel: `npm run vercel:env:skyslope`  
  - Preview also needs `VERCEL_TOKEN` in `.env.local` for non-interactive preview sync (`scripts/sync-vercel-env.mjs`).
- Push to GitHub Actions secrets: `npm run github:secrets:skyslope` (needs `GITHUB_TOKEN` or `gh` auth).

## Auditing “files” (listings/sales)

1. Authenticate → obtain session/token per swagger.
2. Use documented **files**, **listings**, **sales**, **audit** (or equivalent) endpoints from the **same** swagger the brokerage was provisioned for.
3. Respect **rate limits** and **data handling** (PII); do not log tokens or full responses to public CI output.
4. **Support:** https://support.skyslope.com/hc/en-us — for entitlement and endpoint access.

### “Fully executed” (do not conflate with automation)

**Fully executed** means the **correct buyers and sellers** have **fully and correctly signed** the instrument, **and** required Oregon / OREF / brokerage items are **not missing**. That judgment needs a **licensed human workflow** (TC, PB, compliance) who knows **OREF**, **SkySlope**, and **Oregon real estate practice**. API fields and PDF text clues (DigiSign counts, word “Accepted”, etc.) are **not** proof of full execution. See [reference.md — Fully executed](reference.md#fully-executed-what-that-means-for-ryan-realty-work).

## What not to do

- Do not assume **Offers** or **Forms** tokens work on **Listings/Sales** hosts (or vice versa).
- Do not paste **live secrets** into issues, commits, or client-side code.
- Do not store session tokens in `localStorage` for production apps; follow server-side patterns and short-lived sessions.

## More links

See [reference.md](reference.md).
