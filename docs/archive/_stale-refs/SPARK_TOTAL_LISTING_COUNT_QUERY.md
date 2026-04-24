# Spark API query used for total listing count (~200k+)

We use a **single, minimal request** to the Spark Listings API to get the total number of listings. The count comes from the response’s **Pagination.TotalRows** (the value you saw was over 200,000).

## Request details

**Method:** `GET`  
**URL (base):** `https://sparkapi.com/v1/listings`  
*(We can override the base with `SPARK_API_BASE_URL` in env; if not set, we use `https://sparkapi.com/v1`.)*

**Query parameters:**

| Parameter   | Value | Description |
|------------|-------|-------------|
| `_pagination` | `1` | Request pagination metadata in the response. |
| `_limit`     | `1` | Only need one result; we only care about totals. |
| `_page`       | `1` | First page. |

**No filter** is applied — this is the full listing set your API returns for our account.

**Full URL example:**

```
GET https://sparkapi.com/v1/listings?_pagination=1&_limit=1&_page=1
```

**Headers:**

- `Authorization: Bearer <access_token>`
- `Accept: application/json`

*(We can use `SPARK_AUTH_SCHEME=OAuth` so the header becomes `OAuth <token>`; by default we use `Bearer`.)*

## Response

We read the total from the **Pagination** object in the JSON response:

- **TotalRows** — total listing count (the ~200k+ value).
- **TotalPages**, **PageSize**, **CurrentPage** — we also use these for sync.

Example shape:

```json
{
  "D": {
    "Success": true,
    "Results": [ ... ],
    "Pagination": {
      "TotalRows": 200000,
      "PageSize": 1,
      "TotalPages": 200000,
      "CurrentPage": 1
    }
  }
}
```

## Where this is used in our app

- **Function:** `getSparkConnectionStatus()` in `lib/spark.ts`
- **Purpose:** Check Spark connectivity and show “total listings available from Spark” (e.g. on an admin/Spark status page).
- **Code:** We call `fetchSparkListingsPage(accessToken, { page: 1, limit: 1 })` and then use `response.D.Pagination.TotalRows` (and related fields) as the total listing count.

This is the **exact query we use** when we report the total listing count from the Spark API. Sharing this with Spark API developers should be enough for them to see which endpoint, parameters, and response field we rely on for the 200k+ number.

---

## How we use Spark StandardStatus (Active / Pending / Closed)

We store **StandardStatus** exactly as the Spark API returns it. Across the site we treat Spark’s three main listing states as:

- **Active** — For sale / available: `StandardStatus` is null, empty, or (case‑insensitive) contains "Active", "For Sale", or "Coming Soon".
- **Pending** — Under contract: `StandardStatus` contains "Pending".
- **Closed** — Sold/closed: `StandardStatus` contains "Closed".

The admin sync page “By status” table shows every distinct **StandardStatus** value from the feed (no renaming). The “By city” table buckets counts into Active / Pending / Closed (and Other) using the rules above so the site’s categorization matches Spark’s.
