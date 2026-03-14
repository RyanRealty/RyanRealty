# Spark Platform API — Complete Developer Reference

**Source:** sparkplatform.com/docs  
**Compiled:** March 2026  
**Publisher:** FBS — Powering Real Estate Markets  

This document is a complete reference for building applications against the Spark Platform API. Use it when implementing sync, filters, and any Spark integration.

---

## Base URLs

- **Spark API:** `https://sparkapi.com/v1/`
- **RESO Web API:** `https://replication.sparkapi.com/Reso/OData/`

---

## Key Conventions

- **ListingKey** — Primary identifier for listings. Use this (not `ListingId` / MLS number) for lookups and joins.
- **Pagination** — Use `_skiptoken` for large datasets; `_page`/`_skip` can miss records during sync. `_limit` 0–25 default; up to 1000 for replication.
- **Incremental sync** — `_filter=ModificationTimestamp Ge {last_sync_timestamp}`. Update last_sync_timestamp only after a full cycle succeeds.
- **Terminal statuses** (no re-sync after initial): Closed, Cancelled, Withdrawn, Expired.
- **403** — Log endpoint as inaccessible, skip permanently, do not retry.
- **429** — Exponential backoff (e.g. 2s, 4s, 8s, 16s, 32s); then pause and allow manual retry.

---

## Authentication

- Header: `Authorization: Bearer {access_token}`
- Token expiry: 401 → re-authenticate and retry.

---

## Pagination

| Parameter    | Default | Description |
|-------------|---------|-------------|
| `_limit`    | 10      | Records per request. 0–25 normal; up to 1000 replication. |
| `_pagination` | 0     | 1 = include Pagination block; count = count only. |
| `_page`     | 1       | Page number (max 100,000). |
| `_skip`     | —       | Skip N records (0–2,500,000). |
| `_skiptoken`| —       | Cursor from previous response. **Preferred for replication.** |

---

## SparkQL Filter

- Connectors: `And`, `Or`, `Not`
- Operators: `Eq`, `Ne`, `Bt`, `Gt`, `Ge`, `Lt`, `Le`
- Types: Date `YYYY-MM-DD`, Datetime `YYYY-MM-DDThh:mm:ssZ`, Integer, Decimal, Character `'value'`, Boolean, `NULL`
- Wildcards: `*` (zero or more), `?` (zero or one); only with `Eq`/`Ne`; max 3 per condition.
- Functions: `days(-N)`, `months(-N)`, `now()`, `toupper()`, `startswith('x')`, etc.
- **One level of parentheses only** — two levels return error.

Example incremental:
```
_filter=ModificationTimestamp Ge 2026-03-01T00:00:00Z
```

---

## Response Envelope

- Success: `{ "D": { "Success": true, "Results": [ ... ], "Pagination": { ... } } }`
- Failure: `{ "D": { "Success": false, "Code": 1234, "Message": "..." } }` — may include `Errors` or `SparkQLErrors` array.

---

## Listings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/listings` | Search; full SparkQL, sort, expand. |
| GET | `/v1/listings/{ListingKey}` | Single listing. |
| GET | `/v1/my/listings` | Listings for current user. |
| GET | `/v1/office/listings` | Office listings. |
| GET | `/v1/company/listings` | Company listings. |
| GET | `/v1/listings/nearby?_lat=&_lon=` | By proximity. |
| GET | `/v1/listings/historical` | Sold/expired/cancelled/withdrawn. |
| GET | `/v1/listings/registered` | Registered listings. |

**Expansions (comma-separated):** `Photos`, `PrimaryPhoto`, `OpenHouses`, `Documents`, `Videos`, `VirtualTours`, `Rooms`, `FloorPlans`, `FloPlans` (single record), `Units`, `RentalCalendar`, etc.

---

## Listing Sub-Resources

Base: `/v1/listings/{ListingKey}/{sub-resource}`

| Sub-Resource | Endpoint | Methods |
|---------------|----------|---------|
| History | `/v1/listings/{Id}/history` | GET |
| Photos | `/v1/listings/{Id}/photos` | GET, POST, PUT, DELETE |
| Open Houses | `/v1/listings/{Id}/openhouses` | GET, POST, PUT, DELETE |
| Documents | `/v1/listings/{Id}/documents` | GET, POST, PUT, DELETE |
| Videos | `/v1/listings/{Id}/videos` | GET, POST, PUT, DELETE |
| Virtual Tours | `/v1/listings/{Id}/virtualtours` | GET, POST, PUT, DELETE |
| Floor Plans | `/v1/listings/{Id}/floorplans` | GET, POST, PUT, DELETE |
| FloPlans | `/v1/listings/{Id}/floplans` | GET |
| Rooms | `/v1/listings/{Id}/rooms` | GET, POST, PUT, DELETE |
| Units | `/v1/listings/{Id}/units` | GET, POST, PUT, DELETE |
| Notes | `/v1/listings/{Id}/notes` | GET, POST, PUT, DELETE |
| Tickets | `/v1/listings/{Id}/tickets` | GET |
| Tour of Homes | `/v1/listings/{Id}/tourofhomes` | GET, POST, PUT, DELETE |
| Rental Calendar | `/v1/listings/{Id}/rentalcalendar` | GET, POST, DELETE |
| Rules | `/v1/listings/{Id}/rules` | GET |
| Validation | `/v1/listings/{Id}/validation` | GET |

---

## Contacts

- GET/POST `/v1/contacts` — list/create
- GET/PUT/DELETE `/v1/contacts/{Id}`
- GET `/v1/contacts/unconnected`
- GET/PUT `/v1/my/contact`

---

## Market Statistics

- Params: `LocationField`, `LocationValue`, `PropertyTypeCode`, `Options`
- Endpoints: `/v1/marketstatistics/absorption`, `inventory`, `price`, `ratio`, `dom`, `volume`
- Response: `Dates` array + one value array per option (e.g. `ActiveAverageListPrice`, `SoldMedianSoldPrice`).

---

## Other Services

- **Saved searches:** `/v1/savedsearches`, `/v1/savedsearches/provided`, `/v1/savedsearches/tags`, `/v1/contacts/{Id}/savedsearches`
- **Listing carts:** `/v1/listingcarts`, `/v1/listingcarts/portalcarts`, `/v1/contacts/{Id}/listingcarts`
- **News feed:** `/v1/contacts/{Id}/newsfeed`, `.../newsfeed/settings`, `schedule`, `templates`, `curation`, `restrictions`, `meta`
- **Account:** `/v1/my/account`, `associations`, `meta`, `profile`
- **Schema:** `/v1/standardfields`, `/v1/customfields`, `/v1/propertytypes`, `/v1/fieldorder`, `/v1/roomsmeta`, `/v1/unitsmeta`
- **Config:** `/v1/preferences`, `/v1/portals`, `/v1/systeminfo`, `/v1/overlays`, `/v1/overlays/{Id}/geometries`
- **Flexmls:** `/v1/flexmls/emaillinks`, `listingmetaorigins`, `listingmetatranslations`, etc. (if accessible)

---

## HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | OK | Parse body. |
| 201 | Created | ResourceUri in body. |
| 202 | Accepted | Queued; poll later. |
| 400 | Bad Request | Check params/filter/Errors. |
| 401 | Unauthorized | Re-auth and retry. |
| 403 | Forbidden | Log, skip permanently. |
| 404 | Not Found | Resource not accessible. |
| 429 | Too Many Requests | Exponential backoff. |
| 500/503 | Server Error | Retry with backoff (e.g. 3x). |

---

## Replication Summary

1. **Initial sync:** `_skiptoken` pagination, `_limit=1000`; store skiptoken per job for resumption.
2. **Incremental:** `ModificationTimestamp Ge {last_sync_timestamp}`; update timestamp only after full cycle success.
3. **Terminal listings:** Once closed/cancelled/withdrawn/expired and fully synced (including history), mark finalized and do not re-fetch.
4. **Upsert:** `ON CONFLICT (ListingKey)` or resource Id `DO UPDATE`; never hard-delete from API response.
5. **Primary keys:** Listings = `ListingKey`; Contacts = `Id`; Photos = `Id`; etc.

---

*Full reference: sparkplatform.com/docs. Support: api-support@sparkplatform.com*
