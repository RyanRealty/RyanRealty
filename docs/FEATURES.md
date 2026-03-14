# Ryan Realty — Current Features and Capabilities

This document describes the features **currently implemented** in the website and app, for product handoff, professional documentation, and onboarding.

**Last updated:** March 2025

---

## Running without the Spark API key

You can run and review the site using **only the data already in Supabase** (no `SPARK_API_KEY`):

- **Homepage, /listings, /search/…, /listing/[key]** — All read from Supabase. If your database has listings, these pages work as normal.
- **/listings/template** — Redirects to the most recent listing using Supabase when the Spark key is not set (Spark is used when the key is present).
- **Admin → Sync** — Shows “Not configured (no API key)” and disables the Smart Sync button until `SPARK_API_KEY` is set. Data summary (counts, breakdown) still shows what’s in the database.
- **Admin → Spark status** — Shows “Not connected” / “SPARK_API_KEY is not set”.

Add `SPARK_API_KEY` to `.env.local` (and Vercel) when you have it; then you can run sync and use live Spark data.

---

## 1. Public website

### 1.1 Homepage

- **Hero:** Full-viewport area hero (video → listing photo → Unsplash/banner fallback) with Ken Burns effect; supports city and community entity keys for targeted imagery.
- **Navigation:** Header: Home, About, Team, Listings, Map; Sign in / Account (dropdown with Saved homes, Saved searches, Buying preferences, Profile). Footer: Home, About, Team, Listings, Map, Market Reports, Mortgage Calculator.
- **Listings:** Link to browse all listings and to search (city/community).
- **Footer:** Site owner name/email (from env), copyright, nav links (About, Team, Listings, Map, Market Reports, Mortgage Calculator).

### 1.1a About and Team (brokerage and brokers)

- **About:** `/about` — editable content from `site_pages` (key `about`). Default copy if no row; admin can edit in Supabase or future Site pages UI.
- **Team:** `/team` — list of active brokers from `brokers` table. Each broker has a profile at `/team/[slug]`. Brokers are editable in Admin → Brokers (and in Supabase until full CRUD UI is built).

### 1.2 Listings and search

- **All listings:** `/listings` — paginated grid of active listings from Supabase (synced from Spark).
- **Search by place:** `/search/[city]` and `/search/[city]/[subdivision]` (e.g. `/search/bend`, `/search/bend/tetherow`). Uses `cityEntityKey` and `subdivisionEntityKey` slugs (`lib/slug.ts`). Filters listings by City and optional SubdivisionName; same card grid and save/share as main listings.
- **URLs:** See `docs/URL_ARCHITECTURE.md` for current paths and future migration plan.

### 1.3 Listing detail page

**URL:** `/listing/[listingKey]`  
Listing key can be:

- **Stable key:** `ListNumber` or `ListingKey` from the database (used for canonical and all lookups).
- **SEO slug:** Optional address-based slug, e.g. `/listing/20241234-123-main-st-bend`. The app resolves the key via `listingKeyFromSlug` and uses the stable key for data; canonical URL uses the slug when available (`lib/slug.ts`, `getListingByKey` in `app/actions/listings.ts`).

**Sections (order):**

1. **Media (ListingHero):** Full-width gallery; **light background for photos** (zinc-100), dark for video; photo count (“1 of N”); keyboard nav (arrows, Escape in lightbox); first image priority; lazy load below fold. Photos and videos normalized from Spark or Supabase details (casing handled). “Videos & virtual tours” section below uses same normalized data.
2. **Sticky header:** “Back to search results” (when referrer is `/search/` or `?return=...` via `BackToSearchLink`), “All listings”, prev/next listing nav.
3. **Breadcrumb:** For hierarchy/navigation.
4. **Area banner:** Optional “Explore homes in {area}” link.
5. **Title row:** MLS#, address, city/state/zip, **price** (dominant), monthly payment link, Save, Share (copy link, email, text).
6. **Key facts:** Beds, baths, sq ft, acres, year built; price/sq ft; status badge (color-coded).
7. **CTA (mobile):** ListingCtaSidebar — Schedule showing, Ask a question (open in-page modals).
8. **Location:** Map in CollapsibleSection (Google Maps when configured).
9. **Floor plans, videos, other listings at address:** As available.
10. **Similar listings:** Min 4, max 8; fallback by subdivision then city; section always shown (`getSimilarListingsWithFallback`).
11. **Documents, price & status history:** CollapsibleSection.
12. **Property description & details:** ListingSpecial (“What makes this property special”), Property Description block, **ListingDetails** (accordions: Interior, Exterior, Community, Utilities, HOA & fees, Legal & tax; HOA and rental notice prominent).
13. **Community section:** ListingCommunitySection — city + subdivision description, amenities, link to search.
14. **Monthly cost:** Dedicated section with estimate and link to mortgage calculator (no login).
15. **Market context:** Price/sq ft, DOM, price history in CollapsibleSection.
16. **CTA (desktop):** Sticky sidebar — Schedule showing, Ask a question (same modals).

**Agent contact (2I):**

- “Schedule a showing” and “Ask a question” open **in-page modals** (no mailto).
- Forms submit via `submitListingInquiry` → stored in Supabase `listing_inquiries` and sent to Follow Up Boss (FUB).
- Both mobile and desktop CTAs receive `listingKey` for correct attribution.

**Save and share:**

- **Save:** SaveListingButton; when signed in, saves to Supabase `saved_listings`; when not, can prompt sign-in or use cookie/local storage per implementation.
- **Save count:** “X people have saved this home” when count > 0 (`getSavedListingCount`).
- **Share:** ShareButton — copy link, email, text (no social share unless agent opts in; see listing page audit).

**Metadata and SEO:**

- `generateMetadata` uses listing address, price, beds/baths, first photo; Open Graph and Twitter cards; canonical URL.

### 1.4 Mortgage calculator

- **Route:** `/tools/mortgage-calculator` — standalone calculator (no login); linked from listing page monthly cost section.

### 1.5 Reports (market reports)

- **Routes:** `/reports`, `/reports/[slug]` — market reports and shareable report pages (see `docs/MARKET_REPORTS_AND_SHARING.md` if present).

### 1.6 Static and policy

- **Privacy:** `/privacy` — privacy policy page.
- **Auth error:** `/auth-error` — shown on auth callback errors.

---

## 2. Authentication and account

- **Provider:** Supabase Auth; **Google OAuth** implemented (sign-in/sign-out, callback).
- **Redirect URLs:** Must be configured in Supabase (see `docs/SUPABASE_AUTH_URLS.md`).
- **Account area (when signed in):**
  - **Account home:** `/account`
  - **Profile:** `/account/profile`
  - **Saved homes:** `/account/saved-homes` — list of saved listings from `saved_listings`.
  - **Saved searches:** `/account/saved-searches` — saved search criteria (if implemented).
  - **Buying preferences:** `/account/buying-preferences` — preferences for recommendations/alerts (if implemented).

---

## 3. Data and sync (Spark → Supabase)

- **Source:** Spark (Flexmls) via replication API (`SPARK_API_BASE_URL`, `SPARK_API_KEY`). Listings and listing history.
- **Storage:** Supabase: `listings` (with `details` JSONB for full Spark fields, photos, videos, floor plans, etc.), `listing_history`, `sync_cursor`, `sync_run`, plus support tables (e.g. `listing_inquiries`, `saved_listings`).
- **Full sync:** Listings (paginated) then history (batched). Can be run from **Admin → Sync** (“Full sync”) or via cron `GET /api/cron/sync-full` with `Authorization: Bearer <CRON_SECRET>`. See `docs/SYNC.md`.
- **Script:** `npm run sync:full` runs the sync loop locally against `/api/cron/sync-full`.
- **Admin sync page:** Shows status (phase, listing/history counts per run), Pause/Resume/Stop, Cron on/off, and tooltips for “Listings: 0” / “History rows: 0” (per-run counts). No separate “Listings only” / “History only” buttons in current UI (single “Run now” for full sync).

---

## 4. Integrations

### 4.1 Follow Up Boss (FUB)

- **Purpose:** CRM; track signed-in users and listing/page views.
- **Setup:** `FOLLOWUPBOSS_API_KEY` (and optional `FOLLOWUPBOSS_SYSTEM`, `FOLLOWUPBOSS_SYSTEM_KEY`). See `docs/FOLLOWUPBOSS-SETUP.md`.
- **Behavior:** On Google sign-in, person is found or created in FUB and a **Registration** event is sent. While signed in: **Viewed Property** (listing views), **Viewed Page** (e.g. search pages). Listing inquiry forms (Schedule showing, Ask a question) submit to FUB via `submitListingInquiry` and are stored in `listing_inquiries`.

### 4.2 Spark (MLS)

- **Purpose:** Listing and history data. Replication endpoint required for production (see `docs/SPARK_VOW_SUPPORT_EMAIL.md`, `docs/SPARK_API_REFERENCE.md`).
- **History:** Requires **Private** role key for full listing history; see `docs/SYNC.md`.

### 4.3 Google Maps

- **Purpose:** Listing map on listing detail page (when configured). See `docs/GOOGLE_MAPS_SETUP.md`.

### 4.4 Analytics and tracking

- **GA4:** Optional `NEXT_PUBLIC_GA4_MEASUREMENT_ID` (direct) or GTM. See `docs/GTM_GA4_SETUP.md`, `docs/TRACKING_AND_ANALYTICS_AUDIT.md`.
- **Meta Pixel:** Optional `NEXT_PUBLIC_META_PIXEL_ID`; cookie consent respected.
- **FUB identity bridge:** Optional `NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM` (e.g. `_fuid`) to link email-click visits to FUB contacts.

---

## 5. Admin

- **Entry:** Visit the site with hash **#admin** (e.g. `https://yoursite.com#admin`) to be redirected to `/admin`, then sign in. Only the **superuser** (`matt@ryan-realty.com`) can access admin; others are redirected to `/admin/access-denied`.
- **First-time login:** Sign in with the superuser email (Google OAuth or email/password). Ensure that email is allowed in Supabase Auth. No separate “invite” flow yet; add the user in Supabase if needed.
- **Dashboard:** `/admin` — sync health, DB totals, lead/visit metrics, GA4/notifications/content/performance placeholders.
- **Brokers:** `/admin/brokers` — list of brokers (from `brokers` table). Edit in Supabase until full CRUD UI is built. Active brokers appear on public `/team`.
- **Site pages:** `/admin/site-pages` — editable site content (e.g. About page in `site_pages`). Edit in Supabase until edit UI is built.
- **Sync:** `/admin/sync` — full sync UI (run, pause, resume, stop, cron toggle).
- **Geo:** `/admin/geo` — geo/neighborhood/community hierarchy.
- **Banners:** `/admin/banners` — area banners and imagery.
- **Reports:** `/admin/reports` — report management.
- **Spark status:** `/admin/spark-status` — Spark API status / test.

---

## 6. Environment and deployment

- **Env vars:** See `.env.example` in project root; copy to `.env.local` for local development. Production: set same variables in Vercel → Project → Settings → Environment Variables. See `docs/WHAT_I_NEED_TO_COMPLETE.md` for where to obtain each value.
- **Deployment:** Vercel; deploy on push. See `docs/VERCEL_DEPLOY.md` for steps, env checklist, and Supabase redirect URL configuration.

### Tiles (consistent site-wide)

- **Listing tiles:** `ListingTile` is used everywhere (listings page, search, saved homes, home sliders/sections). Same layout and behavior.
- **Community tiles:** `CommunityTile` — used in PopularCommunitiesRow and anywhere community cards are shown.
- **City tiles:** `CityTile` — used in “Browse by city” and anywhere city cards are shown.

### Planned

- **Like/favorite photos and videos:** Ability to “like” or favorite individual photos/videos on listing pages (and elsewhere) is not yet implemented; would require storage (e.g. `listing_media_likes` or user preferences) and UI on ListingHero and gallery.

---

## 7. Documentation reference

- **Listing page implementation vs. instructions:** `docs/LISTING_PAGE_AUDIT.md`
- **URLs and future migration:** `docs/URL_ARCHITECTURE.md`
- **All docs index:** `docs/DOCUMENTATION_INDEX.md`

---

*This file is the single source of truth for “what exists today.” For how to configure or extend a feature, use the linked docs.*
