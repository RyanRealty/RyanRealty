# Ryan Realty — Production Launch Checklist

Follow this checklist step-by-step before going live. Each section is independent — work through them in order. Check the box when done.

---

## 1. Domain & DNS

- [ ] **Decide your production domain.** Your codebase defaults to `ryan-realty.com` (with hyphen). The session brief mentions `ryanrealty.com` (no hyphen). These are different domains. Pick one and use it everywhere.
- [ ] **Point your domain to Vercel.** In your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):
  - Add a CNAME record: `www` → `cname.vercel-dns.com`
  - Add an A record: `@` → `76.76.21.21`
  - Or follow [Vercel's domain docs](https://vercel.com/docs/concepts/projects/domains)
- [ ] **Add the domain in Vercel.** Go to your Vercel project → Settings → Domains → Add your production domain.
- [ ] **SSL is automatic.** Vercel provisions an SSL certificate automatically once DNS propagates.

---

## 2. Vercel Environment Variables

Go to your Vercel project → Settings → Environment Variables. Set these for **Production** environment:

### Required (site will not function without these)

| Variable | What It Does | Where to Get It | Status |
|----------|-------------|-----------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API | ✅ Already set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public API key | Supabase Dashboard → Settings → API | ✅ Already set |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server-only) | Supabase Dashboard → Settings → API | ✅ Already set |
| `SPARK_API_KEY` | MLS listing data feed | Your MLS provider (Flexmls/Spark) | ✅ Already set |
| `NEXT_PUBLIC_SITE_URL` | Production domain for canonicals, OG, sitemap | Your domain, e.g. `https://ryan-realty.com` (no trailing slash) | ⚠️ Must set to production domain |
| `FOLLOWUPBOSS_API_KEY` | CRM for leads/contacts | Follow Up Boss → Admin → API | ✅ Already set |
| `RESEND_API_KEY` | Transactional emails (CMA delivery, notifications) | [resend.com/api-keys](https://resend.com/api-keys) | ✅ Already set |

### Important (features won't work without these)

| Variable | What It Does | Where to Get It |
|----------|-------------|-----------------|
| `ADMIN_EMAIL` | Where admin notifications go (valuation requests, contact form) | Your email address |
| `CRON_SECRET` | Protects cron endpoints from unauthorized access | Generate any random string (e.g. `openssl rand -hex 32`) |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Google Analytics 4 tracking | GA4 → Admin → Data Streams → your stream → Measurement ID (starts with `G-`) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps on listing pages, search, compare | [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create API Key. Enable Maps JavaScript API, Maps Embed API, Geocoding API. |
| `UPSTASH_REDIS_REST_URL` | Rate limiting for API routes | [console.upstash.com](https://console.upstash.com) → Create Redis database → REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting token | Same Upstash page → REST Token |

### Optional (enhanced features)

| Variable | What It Does | Where to Get It |
|----------|-------------|-----------------|
| `NEXT_PUBLIC_GTM_CONTAINER_ID` | Google Tag Manager (if you use GTM for other tags) | GTM → your container → Container ID (starts with `GTM-`) |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta/Facebook Pixel tracking | [Events Manager](https://business.facebook.com/events_manager) → Data Sources → Pixel → Pixel ID |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | Google Ads conversion tracking | Google Ads → Tools → Setup → Google tag → Tag ID (starts with `AW-`) |
| `FOLLOWUPBOSS_SYSTEM` | FUB system name for attribution | [apps.followupboss.com/system-registration](https://apps.followupboss.com/system-registration) |
| `FOLLOWUPBOSS_SYSTEM_KEY` | FUB system key | Same registration page |
| `XAI_API_KEY` | AI chat widget ("Chat With Us") | [console.x.ai](https://console.x.ai) |
| `SENTRY_DSN` | Error tracking and monitoring | [sentry.io](https://sentry.io) → Create project → DSN |

**After setting env vars:** Go to Deployments → click the "..." menu on the latest deployment → Redeploy.

---

## 3. Supabase Auth Configuration

- [ ] **Set Site URL.** Go to Supabase Dashboard → Authentication → URL Configuration:
  - Set **Site URL** to your production domain (e.g. `https://ryan-realty.com`)

- [ ] **Add Redirect URLs.** In the same URL Configuration section, add:
  ```
  https://YOUR-DOMAIN.com/auth/callback
  https://YOUR-DOMAIN.com
  http://localhost:3000/auth/callback
  http://localhost:3000
  ```
  Replace `YOUR-DOMAIN.com` with your actual production domain.

- [ ] **Update Google OAuth redirect URIs.** Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → your OAuth 2.0 Client ID:
  - Under **Authorized redirect URIs**, add:
    ```
    https://YOUR-SUPABASE-PROJECT.supabase.co/auth/v1/callback
    ```
  - Under **Authorized JavaScript origins**, add:
    ```
    https://YOUR-DOMAIN.com
    ```

- [ ] **Verify Google OAuth is enabled.** In Supabase Dashboard → Authentication → Providers → Google:
  - Should show "Enabled" with your Client ID and Client Secret filled in.

---

## 4. Vercel Cron Jobs

Your `vercel.json` already defines these cron jobs. Verify they're correct for your needs:

| Job | Route | Current Schedule | Recommended | What It Does |
|-----|-------|-----------------|-------------|-------------|
| Delta Sync | `/api/cron/sync-delta` | Daily 8am UTC | **Every 2-4 hours** | Syncs new/changed listings from MLS |
| Full Sync | `/api/cron/sync-full` | Weekly Sunday 2am UTC | **Daily or 2x/day** | Full listing sync from MLS |
| Market Report | `/api/cron/market-report` | Weekly Saturday 2pm UTC | Good as-is | Generates weekly market report |
| Saved Search Alerts | `/api/cron/saved-search-alerts` | Daily 2pm UTC | Good as-is | Emails users with matching new listings |
| Place Content Refresh | `/api/cron/refresh-place-content` | Daily 3am UTC | Good as-is | Refreshes geo/place content |
| Optimization Loop | `/api/cron/optimization-loop` | Weekly Monday 6am UTC | Good as-is | Analyzes GA4/Search Console data |

**⚠️ Important:** The sync schedules in `vercel.json` are conservative. For a live real estate site, listings should sync more frequently. To update:

1. Edit `vercel.json` in the repo
2. Change the `schedule` values using [cron syntax](https://crontab.guru/)
3. Commit, push, and redeploy

Example for more frequent sync:
```json
{"path": "/api/cron/sync-delta", "schedule": "0 */4 * * *"}
{"path": "/api/cron/sync-full", "schedule": "0 2 * * *"}
```

All cron endpoints require `Authorization: Bearer YOUR_CRON_SECRET`. Make sure `CRON_SECRET` is set in env vars.

---

## 5. Google Services Setup

### Google Maps API Key
- [ ] Create or verify your API key at [Google Cloud Console](https://console.cloud.google.com)
- [ ] Enable these APIs for your project:
  - Maps JavaScript API
  - Maps Embed API
  - Geocoding API
- [ ] Restrict the API key:
  - **Application restrictions:** HTTP referrers → add your production domain
  - **API restrictions:** Restrict to the 3 APIs above
- [ ] Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in Vercel env vars

### Google Analytics 4
- [ ] Create a GA4 property at [analytics.google.com](https://analytics.google.com) if not already done
- [ ] Create a web data stream for your production domain
- [ ] Copy the Measurement ID (starts with `G-`)
- [ ] Set `NEXT_PUBLIC_GA4_MEASUREMENT_ID` in Vercel env vars
- [ ] (Optional) For admin dashboard live metrics, also set up a GA4 Service Account (see `docs/GA4_SERVICE_ACCOUNT_SETUP.md`)

### Google Search Console
- [ ] Add your production domain to [Search Console](https://search.google.com/search-console)
- [ ] Verify ownership (DNS TXT record or HTML file)
- [ ] Submit your sitemap: `https://YOUR-DOMAIN.com/sitemap.xml`

---

## 6. Resend Email Configuration

- [ ] Verify your sending domain in [Resend](https://resend.com):
  - Go to Domains → Add Domain → follow DNS setup instructions
  - This ensures CMA emails, contact notifications, and saved search alerts arrive in inboxes (not spam)
- [ ] Set `ADMIN_EMAIL` to the email address where you want admin notifications

---

## 7. Rate Limiting (Upstash Redis)

- [ ] Create a Redis database at [console.upstash.com](https://console.upstash.com)
- [ ] Copy REST URL and Token
- [ ] Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel env vars

Without this, API routes have no rate limiting, which could expose you to spam or abuse.

---

## 8. Post-Launch Verification

After DNS propagates and the first deployment is live on your domain:

### Pages to Test
- [ ] Homepage loads with real listings
- [ ] `/homes-for-sale` shows listing grid
- [ ] Click a listing → listing detail page loads with photos, price, key facts
- [ ] `/sell/valuation` → submit a test valuation → check your email for CMA
- [ ] `/contact` → submit a test inquiry → verify it appears in Follow Up Boss
- [ ] `/login` → sign in with Google → verify you can sign in and see "Account" in header
- [ ] After sign in: save a listing → verify it appears in `/dashboard/saved`
- [ ] `/housing-market/reports` → verify market data table shows real numbers
- [ ] `/team` → verify all brokers display correctly
- [ ] `/communities` → verify community cards display

### SEO
- [ ] `https://YOUR-DOMAIN.com/robots.txt` returns valid robots.txt with correct sitemap URL
- [ ] `https://YOUR-DOMAIN.com/sitemap.xml` returns valid XML sitemap
- [ ] Submit sitemap in Google Search Console
- [ ] Share your homepage URL on social media → verify OG image and title preview correctly

### Tracking
- [ ] Accept cookies on the cookie consent banner
- [ ] Check GA4 Realtime report → verify page views are being tracked
- [ ] If Meta Pixel is set: check [Events Manager](https://business.facebook.com/events_manager) for PageView events
- [ ] Submit a contact form → check Follow Up Boss for the new "General Inquiry" event
- [ ] Submit a home valuation → check Follow Up Boss for the "Seller Inquiry" event

### Cron Jobs
- [ ] Wait for the first delta sync to run (check your schedule)
- [ ] After sync: verify new listings appear on the site
- [ ] Monitor Vercel → Functions → Cron for any failures

---

## 9. Ongoing Monitoring

- [ ] **Google Search Console:** Check weekly for crawl errors, indexing issues
- [ ] **Follow Up Boss:** Verify leads are flowing in from the site
- [ ] **Vercel Analytics:** Monitor Core Web Vitals, error rates
- [ ] **GA4:** Set up conversion goals for lead forms, CMA downloads
- [ ] (Optional) **Sentry:** Set `SENTRY_DSN` for real-time error alerting

---

## Quick Reference: Key URLs

| What | URL |
|------|-----|
| Homepage | `https://YOUR-DOMAIN.com/` |
| Listings | `https://YOUR-DOMAIN.com/homes-for-sale` |
| Home Valuation | `https://YOUR-DOMAIN.com/sell/valuation` |
| Contact | `https://YOUR-DOMAIN.com/contact` |
| Market Reports | `https://YOUR-DOMAIN.com/housing-market/reports` |
| Team | `https://YOUR-DOMAIN.com/team` |
| Admin | `https://YOUR-DOMAIN.com/#admin` (sign in with superuser email) |
| Sitemap | `https://YOUR-DOMAIN.com/sitemap.xml` |
| Robots.txt | `https://YOUR-DOMAIN.com/robots.txt` |
