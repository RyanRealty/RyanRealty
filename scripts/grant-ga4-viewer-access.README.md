# Grant GA4 viewer access — handoff for a browser-capable agent

## Background

The Ryan Realty marketing optimization cron (`/api/cron/marketing-optimization-report`) calls the GA4 Data API with a service account so the weekly Facebook seller optimization packet can include real attribution numbers.

State as of 2026-05-10:

- Vercel production env has all four required vars:
  - `GOOGLE_GA4_PROPERTY_ID=527333348`
  - `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL=viewer@ryanrealty.iam.gserviceaccount.com`
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=…` (encrypted)
  - `GOOGLE_SERVICE_ACCOUNT_SUBJECT=matt@ryan-realty.com`
- Cron runs successfully but GA4 returns:
  > `7 PERMISSION_DENIED: User does not have sufficient permissions for this property.`
- Matt is unable to find an "Add user" control in either GA4 Property Access Management or Account Access Management, suggesting his Google account does not currently hold Administrator on the GA4 account.

The fix is to add `viewer@ryanrealty.iam.gserviceaccount.com` as a Viewer on GA4 property `527333348`. Once granted, the cron starts reporting `ga4.ok=true` immediately (no redeploy needed).

## What this handoff is

A self-contained Playwright script at `scripts/grant-ga4-viewer-access.mjs` plus this brief. Anyone with browser access (a Browserbase agent, a Cursor cloud agent with browser capability, a human running Chromium locally) can pick this up and finish the grant, OR diagnose the access blocker in a way Matt cannot do from the GA4 Admin UI alone.

## How to run it

```bash
cd /Users/matthewryan/RyanRealty
node scripts/grant-ga4-viewer-access.mjs                 # headed, default
node scripts/grant-ga4-viewer-access.mjs --headed false  # headless (CI / cloud)
node scripts/grant-ga4-viewer-access.mjs --dry-run       # screenshots only, never click
```

Optional flags:

- `--property-id <id>` — defaults to `527333348`
- `--service-account <email>` — defaults to `viewer@ryanrealty.iam.gserviceaccount.com`
- `--profile-dir <path>` — Chromium persistent profile (default `~/.cache/ryan-realty-ga4-grant-context`)
- `--out-dir <path>` — screenshot + summary destination (default `out/ga4-grant/<ISO>/`)
- `--signin-timeout-ms <n>` — how long to wait for Google sign-in (default 5 min)

## What the script does, step by step

1. Launches Chromium with a persistent profile so Google sign-in survives between runs.
2. Navigates to `https://analytics.google.com/analytics/web/#/p527333348/admin/suiteuserpermissions/property`.
3. If not signed in, pauses on the Google sign-in screen. **The first run requires a human (or browser agent) to complete sign-in.** Subsequent runs reuse the cookies in the profile dir.
4. Captures full-page screenshots at every waypoint into `out/ga4-grant/<ISO timestamp>/`.
5. Searches for an add affordance (`+`, "Create", "Add users") on the property access table.
6. If found, clicks it, fills the email field with the service account, sets role to Viewer, and submits.
7. If not found, navigates to Account Access Management and tries the same flow there.
8. Verifies the service account appears in the user list.
9. Writes a structured `summary.json` with `status`, `level`, screenshots taken, and any error text.

## Possible terminal states (in `summary.json` as `status`)

| status | meaning | next action |
|---|---|---|
| `added` | service account is now a Viewer (success) | re-run `/api/cron/marketing-optimization-report`, confirm `ga4.ok=true` |
| `missing_admin_role` | no add control visible at either property or account level | the signed-in Google account does not have GA4 Administrator. Either get Administrator promoted, or find the Google account that originally created GA4 property 527333348 and run the script signed in as that user |
| `auth_required` | sign-in did not complete in time | re-run with `--headed`, complete Google OAuth manually |
| `email_rejected` | GA4 refused the service account email | confirm the full email including `@ryanrealty.iam.gserviceaccount.com` and that the GCP service account exists |
| `role_not_set` | could not set Viewer role in the dialog | inspect screenshots in the out dir; UI variant likely changed |
| `unknown_failure` | submitted but service account did not appear in the user list | inspect `*_after_submit.png` and `*_email_entered.png` |
| `error` | script crashed | inspect `99_fatal_error.png` and `summary.json.stack` |

## After a successful grant

```bash
# In the RyanRealty repo on a machine with the production CRON_SECRET handy:
vercel env pull ".env.vercel.production.tmp" --environment=production --yes
CRON_SECRET_VALUE=$(grep '^CRON_SECRET=' .env.vercel.production.tmp | sed -E 's/^CRON_SECRET="?([^"]*)"?$/\1/')
curl -sS -H "Authorization: Bearer ${CRON_SECRET_VALUE}" \
  "https://ryanrealty.vercel.app/api/cron/marketing-optimization-report"
rm .env.vercel.production.tmp
```

Then check the latest `agent_insights` row in Supabase (`insight_type = 'marketing_optimization_weekly'`). Look for `data.metrics_snapshot.ga4.ok = true` and a higher `data.report_card.score`.

## If `missing_admin_role` keeps coming back

That is the real blocker, not a script issue. Options:

1. Sign into Google Analytics with the account that originally provisioned GA4 property 527333348. Property creators always get Administrator. Run the script while signed in as that account.
2. If the original creator account is lost, contact Google Analytics support; there is a well-defined "I lost access to my own property" recovery flow.
3. As a workaround for the immediate cron, the GA4 service account creds in `.env.local` could be swapped for a different service account that is already known to have Viewer role on the property. There is no such service account documented in this repo today; this is a last resort.

## Why we are not using the GA4 Admin API directly

The Admin API can grant access bindings programmatically, but doing so from a Node script requires an OAuth token from a user who already has Administrator on the property — exactly the access we are missing. So the API path has the same precondition as the UI path. The browser script was chosen because it surfaces, with screenshots, _why_ access cannot be granted, which is what Matt actually needs to know.
