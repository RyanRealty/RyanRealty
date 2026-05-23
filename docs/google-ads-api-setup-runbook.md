# Google Ads API setup runbook

To activate `/api/cron/marketing-snapshot-google-ads` and have Google Ads spend show up in `/admin/analytics/cost-per-lead`, three credentials need to land in Vercel prod env:

| Env var | Status |
|---|---|
| `GOOGLE_ADS_CUSTOMER_ID` | ✅ set to `5881785778` (Ryan Realty account 588-178-5778) |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | ⏳ requires Manager (MCC) account + Google approval |
| `GOOGLE_ADS_REFRESH_TOKEN` | ⏳ one-time OAuth dance via `scripts/google-ads-mint-refresh-token.mjs` |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | ⏳ optional, the MCC's own customer id |

The snapshot cron is already deployed and **gracefully no-ops** until all three required env vars are set. Once they are, the next 06:30 UTC run starts ingesting spend, impressions, clicks, conversions per campaign and the cost-per-lead dashboard adds Google Ads automatically.

## Step 1 — Create a Google Ads Manager (MCC) account (5 min, Matt)

The API Center is blocked for standard advertiser accounts. You need an MCC. The MCC is free, it just changes how account ownership is structured. Standard practice for any broker who wants programmatic access.

1. Go to https://ads.google.com/intl/en/home/tools/manager-accounts/
2. Click **Create a manager account**
3. Sign in with `matt@ryan-realty.com` (the email that owns the existing 588-178-5778 advertiser account)
4. Manager account name: `Ryan Realty MCC` or similar
5. Accept the Manager account Terms of Service
6. After creation, link the existing `588-178-5778` account:
   - In the new MCC: Accounts → Sub-account settings → Link existing account
   - Enter customer ID `588-178-5778`
   - The existing account owner (you) will receive a request to accept the link
   - Click Accept

## Step 2 — Apply for a developer token (5 min, Matt)

Inside the MCC (top-right account switcher shows the MCC, not the advertiser):

1. Tools → Setup → **API Center** (or go directly to https://ads.google.com/aw/apicenter while the MCC is selected)
2. Read the API terms and click **Apply for Basic access**
3. Application form:
   - Company name: Ryan Realty LLC
   - Primary contact: matt@ryan-realty.com
   - Intended use: "Internal marketing analytics: pull our own Google Ads spend, impressions, clicks, and conversions into our own dashboard for cost-per-lead analysis."
   - Tool description: "Internal reporting dashboard at ryanrealty.vercel.app/admin/analytics/cost-per-lead. Read-only API consumer. No third-party data, no resale."
   - API services needed: Reporting only (basic access tier)
4. Submit. Google sends approval to your Gmail in 24–48 hours typically.
5. When approved, your developer token appears in the API Center as a string like `xxxxxxxxxxxxxxx_xxxxxx`. Copy it.

## Step 3 — Add the adwords scope to the OAuth client (2 min, Matt)

In Google Cloud Console at https://console.cloud.google.com/apis/credentials:

1. Open the OAuth 2.0 Client ID matching `GOOGLE_OAUTH_CLIENT_ID` from `.env.local` (the one used for One-Tap + Sign in with Google)
2. Under **Authorized redirect URIs**, add `http://localhost:53682/` if not present (used by the local mint script below)
3. In **OAuth consent screen** → Scopes, add `https://www.googleapis.com/auth/adwords`
4. Save. No app re-verification needed for sensitive scopes since this is internal.

## Step 4 — Mint the refresh token (2 min, Matt or Claude)

From the repo root:

```bash
node scripts/google-ads-mint-refresh-token.mjs
```

The script:
1. Opens a Google OAuth consent screen in your browser
2. You log in with `matt@ryan-realty.com` (the MCC owner)
3. You approve the adwords scope
4. The script captures the redirect, exchanges the code for a refresh token
5. Writes `GOOGLE_ADS_REFRESH_TOKEN=...` to `.env.local`
6. Prints the value so it can be copied into Vercel env

## Step 5 — Push the secrets to Vercel (2 min, anyone with deploy access)

```bash
# Already done: GOOGLE_ADS_CUSTOMER_ID
echo "<developer-token-from-step-2>" | vercel env add GOOGLE_ADS_DEVELOPER_TOKEN production
echo "<refresh-token-from-step-4>"   | vercel env add GOOGLE_ADS_REFRESH_TOKEN   production

# Optional: the MCC's own customer ID for login-customer-id header
# Find this in the MCC URL after creation (10-digit number)
echo "<mcc-customer-id-no-dashes>"   | vercel env add GOOGLE_ADS_LOGIN_CUSTOMER_ID production
```

## Step 6 — Trigger the snapshot

```bash
# Force a backfill for the last 7 days to verify it works
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://ryanrealty.vercel.app/api/cron/marketing-snapshot-google-ads?startDate=$(date -v-7d +%Y-%m-%d)&endDate=$(date -v-1d +%Y-%m-%d)"
```

The response should include `rowsUpserted` > 0 and `metricsCovered` listing spend, impressions, clicks, conversions, cpc, cpm, ctr. If `skipped: true` comes back, check that all three required env vars are set.

## What's blocking each step

| Step | Time | Blocked on |
|---|---|---|
| 1. Create MCC | 5 min | Matt (Terms of Service + account creation can't be automated) |
| 2. Apply for developer token | 5 min app + 24-48h Google approval | Matt fills form, Google approves |
| 3. Add adwords scope to OAuth client | 2 min | Matt (Cloud Console UI) |
| 4. Mint refresh token | 2 min | Matt clicks "Allow" on consent screen (Claude runs the script) |
| 5. Push secrets to Vercel | 2 min | Anyone with deploy access |
| 6. Trigger snapshot | 0 min | Automatic next cron run, OR manual curl |

## Real-talk

Today there's no active Google Ads spend (account has 1 paused campaign, 0 cost over the visible 30-day window). All this infrastructure is preparing for the moment Matt starts spending. Until then, the cron returns zeros every day, which is correct and harmless.

The work to wire it up is real and worth doing now so the moment a Google Ads campaign goes live, the cost-per-lead dashboard shows it without code changes.
