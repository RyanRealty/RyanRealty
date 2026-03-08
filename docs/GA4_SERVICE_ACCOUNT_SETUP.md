# GA4 Data API: Service Account Setup

So the Super Admin dashboard can show live GA4 metrics (sessions, users, etc.) without opening Google Analytics.

## 1. Google Cloud Console

- Go to: https://console.cloud.google.com
- Use the same project that has your GA4 property.

## 2. Enable the API

- APIs and Services → Library → search **Google Analytics Data API** → Enable.

## 3. Create a Service Account

- APIs and Services → Credentials → Create credentials → Service account.
- Name it (e.g. `ga4-dashboard-reader`) → Create and continue → Done.
- Open the service account → Keys → Add key → Create new key → JSON → Create (downloads JSON).

## 4. Grant access in GA4

- Open https://analytics.google.com → Admin → Property access management.
- Add users → enter the **service account email** from the JSON (`client_email`).
- Role: **Viewer** → Save.

## 5. Get Property ID

- GA4 Admin → Property settings → copy the **Property ID** (numeric, e.g. `123456789`). Not the Measurement ID (G-XXXX).

## 6. Add to .env.local and Vercel

From the JSON, set:

- `GOOGLE_GA4_PROPERTY_ID=123456789`
- `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL=...@....iam.gserviceaccount.com`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`  
  Use quotes and keep `\n` as backslash-n in the env file. Do not commit the JSON or the key.

Restart the app. The GA4 panel at /admin will then show live metrics.
