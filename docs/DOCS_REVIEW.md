# Documentation Review — What’s Needed, Redundant, or Missing

**Reviewed:** All files in `docs/` and `docs/build-steps/`.  
**Purpose:** Single reference for what to keep, consolidate, remove, or add to the index.  
**Applied:** All recommended changes have been applied (GA4 merge, FUB rename, VIDEO_TROUBLESHOOTING, build-steps Scope, index updates).

---

## 1. Redundant or overlapping

### GA4 service account (3 docs → 1 canonical)

| Doc | Content | Verdict |
|-----|--------|--------|
| **GA4_SERVICE_ACCOUNT_SETUP.md** | Option A (key allowed) + Option B (key disabled, use other project); env vars; GA4 property access. | **Keep as canonical.** |
| **GA4_ENABLE_KEY_AND_SERVICE_ACCOUNT.md** | Org policy to allow key creation + Cloud Shell script for ryanrealty project. | **Merge** “org policy” + “Cloud Shell” into GA4_SERVICE_ACCOUNT_SETUP as a section (e.g. “If your org disables key creation”). Then **remove** this file. |
| **GA4_KEYS_WALKTHROUGH.md** | Personal Google account, create project, Cloud Shell script. | **Merge** any unique steps into GA4_SERVICE_ACCOUNT_SETUP (e.g. “Using a personal account”). Then **remove** this file. |

**Action:** One GA4 service-account doc with: (1) key allowed in main project, (2) key disabled → use other project or Cloud Shell, (3) env vars and GA4 Viewer. Delete the other two.

---

### FUB (2 docs — keep both, clarify names)

| Doc | Content | Verdict |
|-----|--------|--------|
| **FOLLOWUPBOSS-SETUP.md** | API key, system registration, testing (Google sign-in → FUB Registration + events). | **Keep.** Primary FUB integration doc. |
| **fub-setup.md** | Custom fields to create in FUB (buyer_budget_min, lead_score, etc.). | **Keep.** Rename to **FUB_CUSTOM_FIELDS.md** and add to DOCUMENTATION_INDEX under Integrations. |

No content overlap; both needed.

---

### Spark (6+ docs — keep, slight overlap)

| Doc | Purpose | Verdict |
|-----|--------|--------|
| **SPARK_API_REFERENCE.md** | Developer reference: base URLs, auth, pagination, filters, conventions. | **Keep.** |
| **SPARK_TO_SUPABASE_FIELDS.md** | Column count, data loss (none; full payload in `details`), mapping. | **Keep.** |
| **SPARK_SUPABASE_REPLICATION_SPEC.md** | Full spec: what gets stored, endpoints → tables. | **Keep.** |
| **SPARK_REPLICATION_ROADMAP.md** | Current state vs spec, phased path. | **Keep.** References SPEC; not redundant. |
| **SPARK_FIELDS_AUDIT.md** | Field-level audit Spark ↔ app; “use every Spark field.” | **Keep.** |
| **SPARK_TOTAL_LISTING_COUNT_QUERY.md** | How total count is queried. | **Keep.** Small reference. |
| **SPARK_VOW_SUPPORT_EMAIL.md** | VOW/replication support contacts. | **Keep.** |

No consolidation needed; each has a distinct role.

---

### Reporting (3 docs — keep all; clarify roles)

| Doc | Purpose | Verdict |
|-----|--------|--------|
| **REPORTING_AND_ANALYTICS.md** | Architecture: cache tables, refresh flow, branding, adding new reports. | **Keep.** “How it works.” |
| **MARKET_REPORTS_AND_SHARING.md** | Share button, Explore market data, weekly report, generating (manual + cron). | **Keep.** User- and operator-facing. |
| **REPORTS_CHECKLIST.md** | List of report types, URLs, status, metrics to expose, where reports are surfaced. | **Keep.** Lightweight “what we have” index. |

Optional: add one line at top of REPORTS_CHECKLIST pointing to REPORTING_AND_ANALYTICS and MARKET_REPORTS_AND_SHARING for detail.

---

### Google (3 docs — no overlap)

- **GOOGLE_APIS_WHERE_TO_GET.md** — Where to get any Google API credential (Console, GA4 Measurement ID, etc.). Keep.
- **GOOGLE_MAPS_SETUP.md** — Maps API key, migration from Mapbox. Keep.
- **GOOGLE_VERIFICATION.md** — Site/domain verification. Keep.

---

### Audits (4 docs — keep; treat as point-in-time)

| Doc | Purpose | Verdict |
|-----|--------|--------|
| **TRACKING_AND_ANALYTICS_AUDIT.md** | What’s in code for GA4, GTM, Meta, etc.; how to verify. | **Keep.** Add “Audit as of [date]” at top. |
| **PERFORMANCE_AUDIT.md** | Speed/code audit: what’s done, top improvements, data fetching. | **Keep.** Add date. |
| **LISTING_PAGE_AUDIT.md** | Listing page vs competitive benchmark; section order; gaps. | **Keep.** Product/spec doc. |
| **CODEBASE_AUDIT_REPORT.md** | Dead code, redundancy, Supabase client, security. | **Keep.** Add date; implement or close findings over time. |

---

## 2. Not needed or stale — fix or remove

### WHY_AUDIT_AND_VIDEOS.md

- **Issue:** Section 1 still describes “continuous UI audit loop” and “run the full UI audit from GOALS_AND_UI_AUDIT.md,” which were removed.
- **Action:** Turn into **VIDEO_TROUBLESHOOTING.md** (or merge into VIDEO_DATA_FLOW):
  - Keep: “Why hero videos might not work” (XAI key, no row, generation failed).
  - Keep: “Why listing videos might not play” (URLs, CORS, VIDEO_DATA_FLOW).
  - Keep: “What to do next” (hero + homepage).
  - Remove: All audit/“run the checklist” wording.
- Then delete **WHY_AUDIT_AND_VIDEOS.md**.

---

### SWITCH_TO_NEW_SUPABASE_DATABASE.md

- **Issue:** Says “You do not need to redo the master plan or build phases” — those docs are gone.
- **Action:** One-line edit: e.g. “The app is already built; you only need to point it at the new project and bring the DB up to date.”

---

### COPY_FROM_CURRENT_SITE.md

- **Purpose:** One-time copy from ryan-realty.com (about, brokers, headshots, office).
- **Verdict:** Keep until migration is done; then archive or remove. Optional: add “(one-time migration)” in DOCUMENTATION_INDEX.

---

## 3. Build-steps (docs/build-steps/)

- **README.md** — How to use (tell agent to read step-N, order, tips). **Keep.**
- **step-10 through step-23** — Each has “Relevant topics: Section X, Section Y” that referred to deleted PLATFORM_REQUIREMENTS. Content is still valid; the “Section” refs are now meaningless.
- **Action:** In each step file, replace “Relevant topics: Section 32 (…), Section 33 (…)” with a short, self-contained “Scope” or “Topics” line (e.g. “Reporting engine, cache tables, charts”) so steps don’t depend on removed docs. No need to delete any step files.

---

## 4. Clearly needed and not redundant

- **DOCUMENTATION_INDEX.md** — Main index. Keep; update when you merge/rename/remove docs (see §5).
- **FEATURES.md** — Current capabilities. Keep.
- **WHAT_I_NEED_TO_COMPLETE.md** — Where to get keys and where they go. Keep.
- **.env.example** (root) — Env template. Keep.
- **VERCEL_DEPLOY.md**, **SUPABASE_AUTH_URLS.md**, **DOMAIN_SETUP.md** — Deploy and auth. Keep.
- **SYNC.md**, **SYNC_DELTA_STATUS.md** — What syncs, how to run, 2-min ingest. Keep.
- **SUPABASE_SCHEMA.md** — DB schema. Keep.
- **AUTH_AND_CRM.md** — Auth + CRM flow. Keep.
- **URL_ARCHITECTURE.md** — Current and target URLs. Keep.
- **ADVANCED_SEARCH.md** — Filters, RPC, backend. Keep.
- **ADVANCED_SEARCH_MAP_SPEC.md** — Map+list layout, clustering, filter bar. Keep. (Different from ADVANCED_SEARCH.)
- **ADMIN_DASHBOARD.md**, **ADMIN_FIRST_LOGIN.md** — Admin panels and first-time login. Keep.
- **REQUIREMENTS_CHECKLIST.md** — Implementation checklist. Keep.
- **CONTENT_ENGINE_TRIGGER_MAP.md**, **CONTENT_BRIEF_TEMPLATES.md** — Content engine and copy. Keep.
- **SEO.md** — SEO guidelines. Keep.
- **VIDEO_DATA_FLOW.md** — Spark → listing page video. Keep.
- **HOME_PAGE_BEST_PRACTICES.md** — Hero, sections, CTAs. Keep.
- **CARD_STANDARDS.md**, **BADGE_AND_EMOJI_GUIDE.md** — Card/tile and badge design. Keep.
- **ENTITY_OPTIMIZATION.md** — Schema.org / SGE. Keep.
- **GTM_TRIGGERS.md** — dataLayer events and GTM triggers. Keep.
- **LISTING_PAGE_AUDIT.md** — Listing page vs competitive. Keep.

---

## 5. DOCUMENTATION_INDEX — gaps

The index does not list every doc. Consider adding (with one-line purpose):

- **SYNC_DELTA_STATUS.md** — Delta sync (2-min) status and stale-ingest warning.
- **DOMAIN_SETUP.md** — Custom domain (Vercel, Supabase, Google OAuth).
- **ENTITY_OPTIMIZATION.md** — Schema.org and SGE entity consistency.
- **ADVANCED_SEARCH.md** — Advanced filters and RPC.
- **ADVANCED_SEARCH_MAP_SPEC.md** — Map+list layout and map behavior.
- **VIDEO_DATA_FLOW.md** — How video gets from Spark to listing page.
- **GTM_TRIGGERS.md** — dataLayer events and GTM trigger setup.
- **REPORTS_CHECKLIST.md** — List of report types and where they appear.
- **ADMIN_FIRST_LOGIN.md** — Admin access and first-time login.
- **CARD_STANDARDS.md** / **BADGE_AND_EMOJI_GUIDE.md** — Card and badge design.
- **FUB_CUSTOM_FIELDS.md** (after renaming fub-setup.md).

Optional (audits / one-off):

- **PERFORMANCE_AUDIT.md**, **CODEBASE_AUDIT_REPORT.md** — Point-in-time audits.
- **COPY_FROM_CURRENT_SITE.md** — One-time migration from current site.
- **SWITCH_TO_NEW_SUPABASE_DATABASE.md** — Switching to a new Supabase project.

---

## 6. Summary

| Action | Count | Docs |
|--------|--------|------|
| **Merge then remove** | 2 | GA4_ENABLE_KEY_AND_SERVICE_ACCOUNT, GA4_KEYS_WALKTHROUGH → merge into GA4_SERVICE_ACCOUNT_SETUP |
| **Rename** | 1 | fub-setup.md → FUB_CUSTOM_FIELDS.md |
| **Replace with trimmed version** | 1 | WHY_AUDIT_AND_VIDEOS → VIDEO_TROUBLESHOOTING (or merge into VIDEO_DATA_FLOW) then delete |
| **Small edit** | 2 | SWITCH_TO_NEW_SUPABASE_DATABASE (remove master-plan ref); build-steps (replace “Section X” with short scope) |
| **Keep as-is** | Rest | All other docs listed above |
| **Index update** | 1 | DOCUMENTATION_INDEX — add missing entries after renames/removals |

No other docs are redundant; the main wins are one GA4 service-account doc, a clear FUB custom-fields name, and removing stale audit wording from the video doc.
