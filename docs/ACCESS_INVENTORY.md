# Access inventory: what an agent session can reach

**Rule (Matt 2026-10-07): never ask Matt what access you have.** Read this page and
list the variable names (`env | cut -d= -f1 | sort`, names only, never values).
When a provider refuses a call, the refusal is a scope or grant problem: name the
exact scope, the exact account, and the exact place it is granted, then fix it or
say precisely what one change is needed. "Do you have access to X?" is never the
question.

Values live in the cloud environment's variables field and in `.env.local` on
Matt's machine (docs/CLOUD_ENVIRONMENT_SETUP.md §2). Print counts and pass/fail
only, never a secret.

## Verified this year

| What | Variables / tool | Reach (verified) |
|---|---|---|
| Supabase, full database | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; `SUPABASE_DB_HOST/USER/PASSWORD` (direct Postgres); `SUPABASE_ACCESS_TOKEN` (management API); Supabase connector (Always allow) | Service-role read and write on every `public.*` table (2026-10-07). Run scripts from the repo root so `@supabase/supabase-js` resolves. |
| Google service account (Gmail, Workspace) | `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (one line, `\n` escapes), `GOOGLE_SERVICE_ACCOUNT_SUBJECT`; domain-wide delegation client **116585568564644399058** | Impersonates any ryan-realty.com mailbox. `gmail.readonly`: yes (matt@, paul@, 2026-10-07). `gmail.send`: yes (CMA owner email left matt@ through it, 2026-10-07). `gmail.settings.basic`: **granted 2026-10-07** (Matt added it in Google Admin), so Gmail signatures and other basic settings can be read and written; Matt's signature was installed through it the same day. `gmail.settings.sharing`: not granted (unauthorized_client, 2026-10-07). |
| Gmail connector | `mcp__Gmail__*` | Matt's own mailbox: read and search (2026-10-07). Sending to a real person is a §1 per-action approval. |
| Vercel | `VERCEL_TOKEN`; Vercel connector | `npm run deploy:verify` and deployment reads (2026-10-07). |
| GitHub | GitHub connector (`mcp__github__*`), `GH_TOKEN`; git push through the session proxy | Branch push, PR create and update, merge (2026-10-07). Push with `npm run push -- <args>` (the pre-push hook needs the gates stamp). |
| Production site | **https://ryan-realty.com** is the one public origin. `NEXT_PUBLIC_SITE_URL` in Vercel production still holds the Vercel alias, so code never reads it directly | **Never use `ryanrealty.vercel.app` for anything outward** (links, emails, SMS, canonicals, OG and sitemaps, PDFs, redirects, lead sources, script output; Matt 2026-10-07). Build every outward URL with `siteOrigin()` / `siteUrl()` / `siteHost()` from `lib/site-origin.ts` (`scripts/lib/site-origin.mjs` in plain-node scripts); gate `ci:site-origin` (G81). From this container, node's own `fetch` must run with `NODE_USE_ENV_PROXY=1` or Vercel's mitigation 403s it (`x-vercel-mitigated: deny`, 2026-10-07; docs/CLOUD_ENVIRONMENT_SETUP.md §1). Plain curl gets a 403 from the bot screen; use a browser user agent or Playwright with `executablePath: '/opt/pw-browsers/chromium'`. |

## Present, not exercised in the sessions that wrote this page

Twilio (`TWILIO_*`), Meta (`META_*`), Upstash (`UPSTASH_REDIS_REST_*`), Sentry
(`SENTRY_AUTH_TOKEN`), Replicate, Apify, Google Maps / GA4 / CrUX / Business
Profile keys, `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`,
`GCP_USER_REFRESH_TOKEN`, `CLOUDSDK_AUTH_ACCESS_TOKEN` (gcloud). The code that
uses each one is the reference for what it can do: grep the variable name.

The session's auto-mode safety check refuses minting tokens from one credential
to probe what another can reach ("credential exploration"). Use the credential
the code path already uses; when it is refused, report the grant per the rule
above.

## Keep it current

When a session proves a reach or a refusal, update the row with the date. A new
credential gets a row when it is first used.
