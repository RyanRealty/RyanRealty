# Documentation Index — Ryan Realty

Use this index to find the right doc for setup, operations, and development. **Current product capabilities** are summarized in **`FEATURES.md`**.

---

## Product and features

| Document | Purpose |
|----------|--------|
| **FEATURES.md** | **Start here.** List of all current features: public site, listing page, search, auth, account, sync, integrations, admin, env and deployment. |
| **LISTING_PAGE_AUDIT.md** | Listing page vs. competitive instructions: section order, implementation status (Phase 2/3), gaps resolved and remaining. |
| **URL_ARCHITECTURE.md** | Current URLs (search, listing), target future hierarchy (`/real-estate/...`), redirect and migration plan. |
| **ADVANCED_SEARCH.md** | Advanced filters, RPC, backend (search_listings_advanced). |
| **ADVANCED_SEARCH_MAP_SPEC.md** | Map+list layout, clustering, filter bar, map behavior. |

---

## Setup and configuration

| Document | Purpose |
|----------|--------|
| **WHAT_I_NEED_TO_COMPLETE.md** | Where to get each API key, ID, and secret (OpenAI, FUB, GA4, GTM, Meta, Luma/Runway, etc.) and where it goes (`.env.local`, Vercel). |
| **.env.example** (project root) | Template for all environment variables; copy to `.env.local` and fill values. Never commit `.env.local`. |

---

## Deployment and auth

| Document | Purpose |
|----------|--------|
| **VERCEL_DEPLOY.md** | How to get code onto Vercel (commit, push), fix failed builds, set env vars, production vs localhost, Supabase redirect URLs. |
| **SUPABASE_AUTH_URLS.md** | Configure Supabase redirect URLs so Google sign-in works in production and preview. |
| **DOMAIN_SETUP.md** | Custom domain (Vercel, DNS, Supabase, Google OAuth) for production. |
| **SWITCH_TO_NEW_SUPABASE_DATABASE.md** | Point the app at a new Supabase project and bring the DB up to date. |

---

## Data and sync

| Document | Purpose |
|----------|--------|
| **SYNC.md** | What gets synced (listings, history, media), how to run full sync (Admin UI, script, cron), Spark history vs historical listings, API key role (Private for history), troubleshooting. |
| **SPARK_SUPABASE_REPLICATION_SPEC.md** | Replication spec: Spark → Supabase mapping and behavior. |
| **SPARK_REPLICATION_ROADMAP.md** | Roadmap for Spark replication and sync. |
| **SPARK_API_REFERENCE.md** | Spark API reference and usage. |
| **SPARK_FIELDS_AUDIT.md** | Field-level audit Spark ↔ app. |
| **SPARK_TO_SUPABASE_FIELDS.md** | Field mapping Spark → Supabase. |
| **SPARK_VOW_SUPPORT_EMAIL.md** | VOW/replication support and contacts. |
| **SPARK_TOTAL_LISTING_COUNT_QUERY.md** | How total listing count is queried. |
| **SUPABASE_SCHEMA.md** | Database schema (tables, columns) for Supabase. |
| **SYNC_DELTA_STATUS.md** | Delta sync (2-min ingest) status, stale-ingest warning, run log. |

---

## Integrations

| Document | Purpose |
|----------|--------|
| **FOLLOWUPBOSS-SETUP.md** | Follow Up Boss: API key, system registration, lead source; what happens on Google sign-in and how to test. |
| **FUB_CUSTOM_FIELDS.md** | Custom fields to create in Follow Up Boss for lead intelligence. |
| **AUTH_AND_CRM.md** | Auth and CRM flow (Supabase Auth + FUB). |
| **GOOGLE_MAPS_SETUP.md** | Google Maps setup for listing map. |
| **GOOGLE_APIS_WHERE_TO_GET.md** | Where to get Google API credentials (Maps, GA4, etc.). |
| **GOOGLE_VERIFICATION.md** | Google site/domain verification. |
| **GTM_GA4_SETUP.md** | Google Tag Manager and GA4 setup. |
| **GTM_TRIGGERS.md** | dataLayer events and GTM trigger setup for GA4/Meta. |
| **GA4_SERVICE_ACCOUNT_SETUP.md** | GA4 Data API and service account (admin dashboard live metrics); org policy and personal-account options. |

---

## Analytics, tracking, reporting

| Document | Purpose |
|----------|--------|
| **TRACKING_AND_ANALYTICS_AUDIT.md** | Audit of tracking and analytics implementation. |
| **REPORTING_AND_ANALYTICS.md** | Reporting and analytics architecture (cache, flow, branding). |
| **MARKET_REPORTS_AND_SHARING.md** | Market reports, share button, Explore, weekly report, generation. |
| **REPORTS_CHECKLIST.md** | List of report types, URLs, status, where reports are surfaced. |

---

## Admin and operations

| Document | Purpose |
|----------|--------|
| **ADMIN_DASHBOARD.md** | Admin dashboard: panels, sync health, leads, GA4/notifications placeholders, what’s not implemented. |
| **REQUIREMENTS_CHECKLIST.md** | Requirements checklist. |
| **CONTENT_ENGINE_TRIGGER_MAP.md** | Content engine trigger map. |
| **CONTENT_BRIEF_TEMPLATES.md** | Content brief templates. |

---

## SEO and content

| Document | Purpose |
|----------|--------|
| **SEO.md** | SEO guidelines and implementation. |
| **ENTITY_OPTIMIZATION.md** | Schema.org and SGE/AI Overviews entity consistency. |

---

## UI and media

| Document | Purpose |
|----------|--------|
| **CARD_STANDARDS.md** | Card and tile layout, action bar, badges, sliders. |
| **BADGE_AND_EMOJI_GUIDE.md** | Badge colors, semantics, emoji use for tiles. |
| **VIDEO_DATA_FLOW.md** | How listing video gets from Spark to the listing page. |
| **VIDEO_TROUBLESHOOTING.md** | Why hero or listing videos might not work; what to do. |

---

## Reference and one-off

| Document | Purpose |
|----------|--------|
| **COPY_FROM_CURRENT_SITE.md** | One-time: copy and brokers from ryan-realty.com. |
| **PERFORMANCE_AUDIT.md** | Point-in-time speed/code audit. |
| **CODEBASE_AUDIT_REPORT.md** | Point-in-time codebase audit (redundancy, dead code). |

---

## For a professional website and app

- **Handoff / onboarding:** Start with **FEATURES.md** and **DOCUMENTATION_INDEX.md** (this file). Use **WHAT_I_NEED_TO_COMPLETE.md** and **.env.example** for env setup; **VERCEL_DEPLOY.md** and **SUPABASE_AUTH_URLS.md** for go-live.
- **Listing experience:** **LISTING_PAGE_AUDIT.md** and **FEATURES.md** (§ 1.3) describe the listing page in detail.
- **Data pipeline:** **SYNC.md**, **SPARK_***, **SUPABASE_SCHEMA.md**.
- **CRM and leads:** **FOLLOWUPBOSS-SETUP.md**, **AUTH_AND_CRM.md**; listing inquiries in **FEATURES.md** (§ 1.3, 4.1).
