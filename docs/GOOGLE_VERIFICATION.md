# Google Items — Verification Checklist

Use this to confirm you have everything. **Where to find it** = where you get the value. **Where it goes** = where you put it (file or UI).

---

## Required for tracking and analytics (you have these)

| Item | Status | Where to find it | Where it goes |
|------|--------|------------------|---------------|
| **GA4 Measurement ID** | Set | Google Analytics: https://analytics.google.com → Admin → Data streams → your web stream → **Measurement ID** | `.env.local`: `NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-ST40W4WM6T` (and same in Vercel → Project → Settings → Environment Variables for production) |
| **GTM Container ID** | Set | Google Tag Manager: https://tagmanager.google.com → your container → **Container ID** at top | `.env.local`: `NEXT_PUBLIC_GTM_CONTAINER_ID=GTM-WV6R4NZ5` (and Vercel env for production) |

**How the app uses them:** `components/GoogleAnalytics.tsx` reads these env vars and loads GA4 (gtag.js) and GTM on every page. No GTM UI setup required for basic Analytics.

---

## Required for server-side Google API access (you have these)

| Item | Status | Where to find it | Where it goes |
|------|--------|------------------|---------------|
| **Google OAuth Client ID** | Set | Google Cloud Console: https://console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client ID (type Web). Same as in your `client_secret_*.json` file: `web.client_id` | `.env.local`: `GOOGLE_OAUTH_CLIENT_ID=725620954432-...` (and Vercel env; do **not** use `NEXT_PUBLIC_` — server only) |
| **Google OAuth Client Secret** | Set | Same credentials as above: `web.client_secret` in the JSON file | `.env.local`: `GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-...` (and Vercel env; server only) |

**How the app uses them:** Reserved for future server-side calls (e.g. GA4 Data API, AdSense Management API, Tag Manager API). The app does not yet call those APIs; when you add that code, it will use these env vars.

---

## Optional (not set — add only if you use them)

| Item | Status | Where to find it | Where it goes |
|------|--------|------------------|---------------|
| **AdSense Publisher ID** | Not set | AdSense: https://adsense.google.com → Account → Settings (or Account info) → **Publisher ID** (e.g. `ca-pub-XXXXXXXXXXXXXXXX`) | `.env.local`: `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX` (and Vercel env). The app will then load the AdSense script automatically. |

---

## Not in env — configured elsewhere

| Item | Where to find it | Where it goes |
|------|------------------|---------------|
| **GA4 custom events / audiences / conversions** | GA4 and GTM UIs | In **Google Analytics**: Admin → Events, Conversions, Audiences. In **GTM**: create tags and triggers that fire on your data layer events. The app can push events to `window.dataLayer`; GTM sends them to GA4. |
| **Google Search Console** | https://search.google.com/search-console | Add your property (site URL), verify ownership, submit sitemap (`/sitemap.xml`). Not an env var. |
| **Sign-in with Google (Supabase)** | Google Cloud Console → Credentials → OAuth 2.0 Client ID (can be same or different from above) | **Supabase Dashboard** → Authentication → Providers → Google → paste Client ID and Client Secret. Ensures "Sign in with Google" works on your site. |

---

## Summary

- **You have:** GA4 Measurement ID, GTM Container ID, Google OAuth Client ID, Google OAuth Client Secret. All are in `.env.local` and are used (or ready for use) by the app.
- **Optional:** AdSense — add `NEXT_PUBLIC_ADSENSE_CLIENT_ID` only if you want to show ads.
- **For production:** Add the same four vars (GA4, GTM, OAuth ID, OAuth Secret) to **Vercel** → your project → **Settings** → **Environment Variables**, for the Production (and optionally Preview) environment.

No Google items required by the master instruction set are missing from your current setup for basic tracking and future API use.
