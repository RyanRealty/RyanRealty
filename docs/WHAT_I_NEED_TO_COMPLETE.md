# What You Need to Complete All Build Sequence Tasks

For each item: **where to find it** and **where it goes**.

---

## Already implemented (no extra input required)

- **Priority 1** — Photo classification pipeline, hero selection, design tokens.
- **Priority 2** — Delta sync, sync_state, activity_events, change detection.
- **Priority 3** — Geo hierarchy, URL architecture doc, admin geo/neighborhoods.
- **Priority 4** — Community hero (video → listing hero → banner), full-viewport, ken-burns.
- **Priority 5** — Activity feed, full-bleed 4:5 cards, save on each card.
- **Priority 6** — FUB identity bridge (email-click param → cookie → events).

---

## Env / config: where to find & where it goes

### Photo classification (Priority 1 – optional)

| What | Where to find it | Where it goes |
|------|------------------|---------------|
| **OPENAI_API_KEY** | **Find:** [platform.openai.com](https://platform.openai.com) → Sign in → **API keys** (left sidebar) → **Create new secret key**. Or [OpenAI API Keys](https://platform.openai.com/api-keys). | **Goes in:** `.env.local` (local) and **Vercel** → Project → **Settings** → **Environment Variables**. Add `OPENAI_API_KEY` with the key value. Not needed for frontend; server-only. |

---

### FUB identity bridge (Priority 6)

| What | Where to find it | Where it goes |
|------|------------------|---------------|
| **NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM** | **Find:** In your **Follow Up Boss email templates**, check the tracking/click links. They often append a param like `_fuid=123` (contact id). Use whatever param name FUB adds to links (or FUB docs/support). Default in code is `_fuid`. | **Goes in:** `.env.local` and **Vercel** → **Environment Variables**. Add `NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM=_fuid` (or your param name). Must be `NEXT_PUBLIC_` so the client can read the param name. |

---

### GA4 + GTM (Priority 7)

| What | Where to find it | Where it goes |
|------|------------------|---------------|
| **GTM container ID** | **Find:** [tagmanager.google.com](https://tagmanager.google.com) → select (or create) container → top of the screen: **Container ID** like `GTM-XXXXXXX`. | **Goes in:** Your app’s layout or a dedicated analytics component so the GTM script loads on every page. Typically: add to `.env.local` as `NEXT_PUBLIC_GTM_CONTAINER_ID=GTM-XXXXXXX`, then in code (e.g. `app/layout.tsx` or `components/GoogleTagManager.tsx`) inject the script with that ID. |
| **GA4 measurement ID** | **Find:** [analytics.google.com](https://analytics.google.com) → **Admin** (gear) → **Data streams** → select your web stream → **Measurement ID** (e.g. `G-XXXXXXXXXX`). | **Goes in:** **Google Tag Manager** (not in .env). In GTM: create a **GA4 Configuration** tag, paste the Measurement ID there, set the tag to fire on All Pages (or as needed). GA4 receives data via GTM. |
| **Data layer** | N/A (you implement it) | **Goes in:** Your codebase. Push events to `window.dataLayer` (e.g. on listing view, search, save, page view). GTM **Triggers** listen for those data layer events; **Tags** (GA4, Meta, etc.) use the event data. Single data layer, multiple tags. |

---

### Meta Pixel + CAPI (Priority 8)

| What | Where to find it | Where it goes |
|------|------------------|---------------|
| **Meta Pixel ID** | **Find:** [business.facebook.com](https://business.facebook.com) → **Events Manager** → **Data sources** → select your **Pixel** → **Settings** → **Pixel ID** (numeric, e.g. `1234567890123456`). | **Goes in:** Either (1) **GTM**: create a **Custom HTML** or **Meta Pixel** tag with the Pixel ID and fire it on your triggers, or (2) `.env.local`: `NEXT_PUBLIC_META_PIXEL_ID=1234567890123456` and inject the pixel script in your layout/component. |
| **CAPI (Conversions API) access token** | **Find:** **Events Manager** → your Pixel → **Settings** → **Conversions API** → **Generate access token** (or use existing). Requires a **Meta App** linked; create one in [developers.facebook.com](https://developers.facebook.com) if needed. | **Goes in:** `.env.local` and **Vercel** → **Environment Variables**. Add `META_CAPI_ACCESS_TOKEN=...`. Use only on the server (e.g. server actions or API routes) to send server-side events; do not expose in client. |

---

### Lead scoring + broker alerts (Priority 9)

| What | Where to find it | Where it goes |
|------|------------------|---------------|
| **FUB API** | Already used. **Find:** Follow Up Boss → **Settings** → **API** (or **Admin** → **API**). Same key as `FOLLOWUPBOSS_API_KEY`. | Already in `.env.local` as `FOLLOWUPBOSS_API_KEY`. No new key. |
| **Alert delivery** | Your choice: FUB tasks, webhook, email, Slack, etc. | **Goes in:** App design. When implementing: either create FUB tasks via API when score crosses threshold, or call a webhook / send email from your backend. Config (e.g. threshold, webhook URL) can live in env (e.g. `LEAD_ALERT_WEBHOOK_URL`) or in a config table in Supabase. |

---

### AI video pipeline (Priority 10)

| What | Where to find it | Where it goes |
|------|------------------|---------------|
| **Luma API key** | **Find:** [lumalabs.ai](https://lumalabs.ai) (or PiAPI if you use that) → account / API section → create API key. Check [Luma API docs](https://docs.lumalabs.ai) for current URL. | **Goes in:** `.env.local` and **Vercel** → **Environment Variables**. e.g. `LUMA_API_KEY=...` or `LUMALABS_API_KEY=...`. Use in server-side job only. |
| **Runway API key** | **Find:** [runwayml.com](https://runwayml.com) → account → **API** or **Developers** → generate key. [Runway API](https://docs.runwayml.com) for docs. | **Goes in:** `.env.local` and **Vercel**. e.g. `RUNWAY_API_KEY=...`. Server-only. |
| **Queue + broker review** | N/A (you implement) | **Goes in:** Your app. Queue: e.g. **Inngest** (inngest.com), **Vercel background functions**, or a DB table + cron. Storage: e.g. **Supabase Storage** or **Vercel Blob** for generated clips. Broker review: e.g. **Admin** page that lists pending clips and has Approve/Reject; on approve, update `hero_videos` or equivalent and optionally move file to public URL. |

---

### Market stats pre-computation (Priority 12)

| What | Where to find it | Where it goes |
|------|------------------|---------------|
| **Cache table** | N/A (you add it) | **Goes in:** New Supabase migration, e.g. `reporting_cache` (geo_key, period_type, period_start, period_end, data jsonb, updated_at). |
| **Job after sync** | N/A (you implement) | **Goes in:** Same place you run delta sync (e.g. after `syncSparkListingsDelta` in your cron handler or Inngest step). Job computes stats for affected geos and writes to `reporting_cache`. Report pages then read from this table instead of computing on the fly. |

---

### Content engine (Priority 13)

| What | Where to find it | Where it goes |
|------|------------------|---------------|
| **Trigger map** | **Find:** In this repo: **docs/CONTENT_ENGINE_TRIGGER_MAP.md** (if present) or the content-engine section of the master instruction set. | **Goes in:** Implementation: when activity_events (or listing changes) fire, your content engine checks the trigger map and creates draft content (caption, suggested assets, hashtags). |
| **Social OAuth / posting APIs** | **Find:** [developers.facebook.com](https://developers.facebook.com) for Facebook/Instagram; each platform’s developer portal for posting APIs. | **Goes in:** `.env.local` and **Vercel** (e.g. `META_APP_ID`, `META_APP_SECRET`, or platform-specific tokens). Use in server-side flow: OAuth to get user token, then call Graph API (or equivalent) to post. Optional; only if you want auto-publish or one-tap share to connected accounts. |

---

### Identified personalization (Priority 14)

| What | Where to find it | Where it goes |
|------|------------------|---------------|
| **No new keys** | Uses FUB, Supabase Auth, saved listings, visits. | Logic only: e.g. on load, if user is signed in, read their history (visits, saved listings), infer price range and community, default map/search to that. “Under contract + similars” and “new in browsed community” use existing listing and visit data. |

---

### Type Two microsites (Priority 15)

| What | Where to find it | Where it goes |
|------|------------------|---------------|
| **SPARK subdivision names** | **Find:** Your **Spark/MLS feed** or Supabase `listings` table: `SubdivisionName` (and `City`) for active listings. Compare to **lib/resort-communities.ts** (e.g. `RESORT_LIST`). | **Goes in:** **lib/resort-communities.ts**: add or adjust city/subdivision entries so they match SPARK’s `SubdivisionName` / `City` exactly (or normalized). Ensures resort pages and hero selection match real listings. |

---

## Other checklist items

| Item | Where to find it | Where it goes |
|------|------------------|---------------|
| **UTM on outbound links** | UTM spec: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`. | **Goes in:** Any outbound link (e.g. to FUB, social, partner sites). Append query params. Store in your DB (e.g. with session or FUB contact) when the user lands so you can attribute later. |
| **Cookie consent** | CCPA/Oregon requirements; your legal/compliance source. | **Goes in:** A **cookie banner** component (you have `CookieConsentBanner`); store consent in cookie or DB; only load non-essential scripts (GTM, Meta pixel, etc.) after consent; honor opt-out and 90d anonymous purge per your policy. |
| **Oregon MLS / sold photos** | **Find:** Your **MLS rules** or **Spark/MLS agreement** (from your broker or MLS documentation). | **Goes in:** Policy/implementation. If you show sold listing photos (e.g. Just Sold, community hero), confirm that use is allowed. If not, restrict to active listings only or use different assets. |

---

## Quick reference: env vars and files

| Env var | Where to find the value | Where it goes |
|---------|-------------------------|---------------|
| **OPENAI_API_KEY** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | `.env.local` + Vercel env (server-only) |
| **NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM** | FUB email link param (e.g. `_fuid`) | `.env.local` + Vercel env |
| **NEXT_PUBLIC_GTM_CONTAINER_ID** | [tagmanager.google.com](https://tagmanager.google.com) → container ID | `.env.local` + Vercel env; used in layout/GTM component |
| **GA4 measurement ID** | [analytics.google.com](https://analytics.google.com) → Admin → Data streams | Inside GTM (GA4 Configuration tag), not in .env |
| **NEXT_PUBLIC_META_PIXEL_ID** | [business.facebook.com](https://business.facebook.com) → Events Manager → Pixel → Settings | `.env.local` + Vercel env; or only in GTM |
| **META_CAPI_ACCESS_TOKEN** | Events Manager → Pixel → Settings → Conversions API | `.env.local` + Vercel env (server-only) |
| **LUMA_API_KEY** / **RUNWAY_API_KEY** | Luma / Runway account → API section | `.env.local` + Vercel env (server-only) |

**Where env vars live in the project:**

- **Local:** `.env.local` in the project root (create from `.env.example`; never commit `.env.local`).
- **Production:** **Vercel** → your project → **Settings** → **Environment Variables** — add each variable and choose Environment (Production, Preview, Development).
