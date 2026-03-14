# Spark API → Supabase Complete Local Replication — Full Spec

**Goal:** A complete local mirror of every piece of data Spark MLS API credentials give access to. Nothing excluded. Spark API is a **sync source only** — not a runtime dependency. The application never calls Spark for data that already exists locally.

---

## What Gets Stored — Complete Resource List

Every resource below gets its own table or set of tables. If an endpoint exists and credentials can reach it, it gets pulled and stored.

### Listings (Core)

| Endpoint | Purpose | Storage |
|----------|---------|---------|
| `/v1/listings` | All listings accessible to role | Main `listings` table |
| `/v1/my/listings` | Listings owned by my account | Dedicated table or tag |
| `/v1/office/listings` | Listings under my office | Dedicated table or tag |
| `/v1/company/listings` | Listings under my company | Dedicated table or tag |
| `/v1/listings/registered` | Registered listings (separate dataset) | Dedicated table |
| `/v1/listings/historical` | Historical off-market, sold, expired | `listings_historical` (same column structure as `listings` where fields overlap) |

### Listing Sub-Resources

Synced per listing during initial sync; tracked in `listing_sync_status`.

| Endpoint | Storage |
|----------|---------|
| `/v1/listings/{Id}/history` | Status transitions → `listing_history` rows: `status_from`, `status_to`, `event_timestamp` |
| `/v1/listings/{Id}/history` (price events) | Price changes → `listing_price_history`: `price_before`, `price_after`, `change_timestamp` |
| `/v1/listings/{Id}/photos` | All photos, every URI size (Thumb, 300, 640, 800, 1024, 1280, 1600, 2048, Large, Primary) |
| `/v1/listings/{Id}/openhouses` | Open house events |
| `/v1/listings/{Id}/documents` | Documents and disclosures |
| `/v1/listings/{Id}/videos` | Video embeds and links |
| `/v1/listings/{Id}/virtualtours` | Virtual tour links (branded/unbranded) |
| `/v1/listings/{Id}/floorplans` | Floor plan attachments |
| `/v1/listings/{Id}/floplans` | Interactive FloPlans |
| `/v1/listings/{Id}/rooms` | Room data with labels |
| `/v1/listings/{Id}/units` | Multi-unit and condo unit records |
| `/v1/listings/{Id}/notes` | Agent notes |
| `/v1/listings/{Id}/tickets` | Showing tickets |
| `/v1/listings/{Id}/tourofhomes` | Tour of homes events |
| `/v1/listings/{Id}/rentalcalendar` | Rental unavailability dates |
| `/v1/listings/{Id}/rules` | MLS listing rules |
| `/v1/listings/{Id}/validation` | Validation state per listing |

### Contacts

- `/v1/contacts` — all contacts  
- `/v1/contacts/unconnected` — unconnected contacts  
- `/v1/contacts/{Id}/activity` — engagement scoring and action history  
- `/v1/contacts/tags` — all contact tags  
- `/v1/contacts/export` — exportable contact data  
- `/v1/contacts/{Id}/vow` — portal/VOW account record per contact  

### News Feed (per contact)

- `/v1/contacts/{Id}/newsfeed`, `/newsfeed/settings`, `/newsfeed/schedule`, `/newsfeed/templates`, `/newsfeed/curation`, `/newsfeed/restrictions`, `/newsfeed/meta`

### Saved Searches

- `/v1/savedsearches`, `/v1/savedsearches/provided`, `/v1/savedsearches/tags`, `/v1/contacts/{Id}/savedsearches`

### Listing Carts

- `/v1/listingcarts`, `/v1/listingcarts/portalcarts`, `/v1/contacts/{Id}/listingcarts`

### Market Statistics (time-series rows)

- `/v1/marketstatistics/absorption`, `inventory`, `price`, `ratio`, `dom`, `volume`  
- One row per data point: `location_field`, `location_value`, `property_type_code`, `stat_type`, `stat_date`, `stat_value`

### Account & Profile

- `/v1/my/account`, `/v1/my/account/associations`, `/v1/my/account/meta`, `/v1/my/account/profile`

### Schema & Metadata

- `/v1/standardfields`, `/v1/customfields`, `/v1/customfields/groups`, `/v1/propertytypes`, `/v1/fieldorder`, `/v1/fieldrelations`, `/v1/roomsmeta`, `/v1/unitsmeta`

### Configuration & Operational

- `/v1/preferences`, `/v1/portals`, `/v1/devices`, `/v1/idx`, `/v1/idxlinks`, `/v1/sharedlinks`, `/v1/templates`  
- `/v1/searchtemplates/quicksearches`, `views`, `sorts`  
- `/v1/systeminfo`, `/v1/systeminfo/languages`

### Geographic & Mapping

- `/v1/overlays`, `/v1/overlays/{Id}/geometries` (PostGIS or JSONB)

### Consumers

- `/v1/consumers`, `/v1/consumers/{Id}/agents`

### Broker & Tour

- `/v1/brokerdistributions`, `/v1/brokertourdistributions`, `/v1/openhouses`

### Flexmls-Specific (if accessible)

- `/v1/flexmls/emaillinks`, `listingmetaorigins`, `listingmetatranslations`, `listingmetafieldlisttranslations`, `listingreports`, `mapping/layers`, `mapping/shapegen`

---

## Sync Strategy — Two Phases

### Phase 1: Initial Sync (once)

- Pull every endpoint; every listing including historical; every sub-resource per listing; every contact, saved search, cart, news feed, schema, config.
- Use `_skiptoken` pagination with `_limit=1000`.
- Track every job in `sync_jobs` with full resumability; if interrupted, next run resumes using stored skiptoken.
- Initial sync is complete only when every resource type is `completed` in `sync_jobs` and every listing’s `listing_sync_status` is fully populated.

### Phase 2: Smart Incremental Sync (every 10 minutes, after Phase 1 complete)

- **Active listings only** — only `MlsStatus Eq 'Active'`. Terminal-status listings never re-synced; `is_finalized = true` excluded permanently.
- **Changed records only** — `ModificationTimestamp Ge {last_sync_timestamp}` from `sync_state`.
- **Sub-resources** — When an active listing is updated, re-sync photos, open houses, price history, etc. Do not re-sync history/documents/floor plans unless listing’s `ModificationTimestamp` is newer than sub-resource’s last sync.
- **Schema/metadata** — re-sync weekly.
- **Market statistics** — re-sync daily.
- **Contacts, saved searches, news feed** — re-sync on the 10-minute cycle.
- Only one cycle at a time; if a run is still in progress when the next trigger fires, skip and log.

### Smart Sync Logic (per 10-min cycle)

1. Fetch active listings modified since `last_sync_timestamp`.
2. For each, compare incoming `ModificationTimestamp` to local; only write if newer.
3. Detect listings that transitioned to terminal status → update status, run sub-resource sync to completion, set `is_finalized = true`, exclude from future cycles.
4. Run finalization function for newly eligible listings.
5. Update `sync_state` only after full cycle succeeds.
6. Log to `sync_logs`: records checked, updated, finalized, duration.

---

## Manual Sync Button

- **Sync Now** — Triggers one Smart Sync cycle immediately (bypasses schedule).
- Disabled + spinner while any sync is in progress (only one at a time).
- After completion, page shows: last sync time, records updated last run, total active listings, total finalized, errors from last run.
- Status driven by live reads from `sync_state` and `sync_logs` (not client-only state).

### Health Indicator

- **Healthy** — last sync within 15 minutes; green.
- **Degraded** — last sync 15–60 min ago or non-fatal errors; yellow.
- **Stalled** — last sync &gt; 60 min or fatal error; red + error message.

---

## Sync Architecture — Tables

### `sync_jobs`

- `resource_type`, `resource_id` (listing key or contact ID), `skiptoken`, `page`, `total_records_expected`, `records_processed`, `status` (`pending`|`in_progress`|`completed`|`failed`), `started_at`, `updated_at`, `error_message`.
- Rows with `in_progress` and `updated_at` older than 2 hours = stale, resumable.

### `sync_state`

- One row per resource type: `last_sync_timestamp`, `last_sync_status`, `last_sync_duration_ms`, `last_error_message`.
- 10-minute sync reads/writes this exclusively.

### `listing_sync_status`

- One row per listing. Booleans: `photos_synced`, `documents_synced`, `history_synced`, `price_history_synced`, `historical_data_synced`, `open_houses_synced`, `videos_synced`, `virtual_tours_synced`, `floor_plans_synced`, `floplans_synced`, `rooms_synced`, `units_synced`, `notes_synced`, `tickets_synced`, `tour_of_homes_synced`, `rental_calendar_synced`, `rules_synced`.
- Listing cannot be finalized until every applicable column is `true`.

### `sync_logs`

- Per API call: `endpoint`, `method`, `response_status`, `records_returned`, `duration_ms`, `sync_cycle_id`, `environment`, `error_message`, `logged_at`.

---

## Supabase Schema Rules

- Spark `ListingKey` = primary key for listing-related tables (no auto-increment for MLS data).
- **listing_history** — one row per status event: `listing_key`, `status_from`, `status_to`, `event_timestamp`, `spark_raw` JSONB.
- **listing_price_history** — one row per price event: `listing_key`, `price_before`, `price_after`, `change_timestamp`, `spark_raw` JSONB.
- **listings_historical** — full historical listing records keyed on `ListingKey`.
- **market_statistics** — one row per point: `location_field`, `location_value`, `property_type_code`, `stat_type`, `stat_date`, `stat_value`.
- Every major table has `spark_raw` JSONB; all timestamps `timestamptz` UTC; PostGIS for overlay geometry; upsert via `ON CONFLICT DO UPDATE` (no hard deletes).

### Indexes (minimum)

- `listings`: `ListingKey`, `MlsStatus`, `ModificationTimestamp`, `is_finalized`, `City`, `PostalCode`, `ListPrice`, `SubdivisionName`
- `listing_history`: `listing_key`, `event_timestamp`
- `listing_price_history`: `listing_key`, `change_timestamp`
- `contacts`: `Id`, `ModificationTimestamp`
- `sync_jobs`: `status`, `resource_type`, `resource_id`
- `sync_logs`: `logged_at`, `response_status`, `sync_cycle_id`, `environment`

---

## Error Handling

- **429** — Exponential backoff from 2s, max 5 retries; then mark job `failed` with message.
- **5xx** — Retry up to 3 times with backoff; then mark failed.
- **403** — Log endpoint as inaccessible, skip permanently, surface on sync monitoring page under “Inaccessible Endpoints”; never retry.
- Single sub-resource failure on one listing does not fail the cycle — log and continue.

---

## Environment Configuration

- Single switch: **`APP_ENV`** = `staging` or `production`. No hardcoded env logic.
- All variables in `.env` (never committed); fully documented `.env.example`.

Required variables (see spec for full list):

- `APP_ENV`, `SPARK_API_BASE_URL`, `SPARK_API_KEY`, `SPARK_API_SECRET`, `SPARK_ACCESS_TOKEN`, `SPARK_TOKEN_EXPIRY`
- Staging: `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_ANON_KEY`, `SUPABASE_STAGING_SERVICE_KEY`, `SUPABASE_STAGING_DB_URL`
- Production: `SUPABASE_PRODUCTION_*` equivalents
- Sync: `SYNC_INTERVAL_MINUTES`, `SYNC_BATCH_SIZE`, `SYNC_STALE_JOB_HOURS`, `SYNC_MAX_RETRIES`, `SYNC_BACKOFF_BASE_MS`
- Alerts: `ALERT_EMAIL_*`, `ALERT_SLACK_*`, `ALERT_STALL_THRESHOLD_MINUTES`, SMTP/Slack options

Sync engine reads `APP_ENV` at startup and connects to the corresponding Supabase project. `sync_logs.environment` = `APP_ENV`.

---

## Stall & Failure Alerts

- **Stall** — `last_sync_timestamp` older than `ALERT_STALL_THRESHOLD_MINUTES` (default 60). One alert per stall; re-arm after successful sync.
- **Error** — Fatal (non-retryable) failure; include error message, resource type, last successful sync.
- **Recovery** — When sync recovers, send notification: healthy again, downtime length, records processed in recovery cycle.

Channels: **Email** (SMTP) and **Slack** (webhook), each togglable. Same logic for both. If both off, still write to `sync_logs` with `alert_sent = false`.

**Deduplication:** `sync_alerts` table — `alert_type`, `environment`, `triggered_at`, `resolved_at`, `channels_notified`, `resolved`. Re-trigger only after resolve and a new stall.

---

## Staging vs Production

- **Staging** — Sync every 30 min (override with `SYNC_INTERVAL_MINUTES`); alerts to separate channel; verbose logging (full request/response in `sync_logs`). Cycle collision = log only, no alert.
- **Production** — Strict cycle collision prevention; skip and alert if cycle still running when next fires.
- Monitoring page shows environment badge: **STAGING** (yellow), **PRODUCTION** (red).
- Migrations: run in staging first; production requires explicit `--env=production` confirmation.

---

## Execution Order (implementation)

1. Scaffold: env config, `.env.example`, staging/production connection resolver.  
2. Supabase schema: every table, column, type, index, constraint → versioned migrations.  
3. Sync engine: job tracking, skiptoken resumption, rate-limit handling.  
4. Initial sync: all resources, fully resumable.  
5. Per-listing sub-resource sync with `listing_sync_status`.  
6. Finalization function.  
7. 10-minute Smart Incremental Sync.  
8. Sync logging with environment tagging.  
9. Stall/error alerts (email + Slack + `sync_alerts`).  
10. Sync monitoring page: real-time status, health, env badge, inaccessible endpoints, **Sync Now** button.  
11. Surface endpoints that returned 403 or empty for credentials.  
12. README: initial sync, staging→production, resume failed job, add new resource type.

---

*Spec version: 1.0 — complete and final.*
