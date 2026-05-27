# GA4 — BigQuery link + bot filter setup (5 minute runbook)

**Why:** Two GA4 actions that the Admin API doesn't expose. Both unlock cleaner reporting + (optionally) unthresholded data.

- **BigQuery link** unlocks raw event-level data the GA4 UI threshold-suppresses. Free tier covers our volume (10 GB storage + 1 TB queries/month vs our actual ~200 events/day).
- **Internal-traffic filter** removes the ~40% of users that are bots from datacenter IPs (Singapore AWS, Boardman OR AWS, Dublin AWS, Lulea Meta).

Both attempted via API. BigQuery returned 403 (service account lacks BigQuery Admin on GCP). Data filters: not exposed in v1alpha. UI is the path.

Property `527333348` ("Ryan Realty"), GCP project `ryanrealty` (number `725620954432`).

---

## Step 1 — BigQuery link (2 minutes)

1. Open https://analytics.google.com/analytics/web/#/p527333348/admin/bigquery-link
2. Click **Link**
3. Pick GCP project **`ryanrealty`** (number `725620954432`). If it doesn't appear in the picker, the GA4 user needs **BigQuery Admin** on the project — click "View projects you have access to" first.
4. Data location: **United States (us)**
5. Frequency: **Daily** (free tier safe). **Streaming OFF** (would burn the free 1 TB query budget fast).
6. Skip the include-advertising-id checkbox.
7. Submit. First export lands within 24 hours into a dataset called `analytics_527333348`.

After first export, you can query in BigQuery Studio:

```sql
SELECT
  event_date, event_name, user_pseudo_id,
  geo.city, geo.country, device.category,
  collected_traffic_source.manual_source, collected_traffic_source.manual_medium
FROM `ryanrealty.analytics_527333348.events_*`
WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', CURRENT_DATE() - 1)
LIMIT 100;
```

That's raw per-event, no threshold suppression. Demographics still surface as `(not set)` for users without Google Signals data — the threshold suppression is gone but the underlying data still requires signed-in Google + ads-personalization-on.

---

## Step 2 — Internal-traffic filter (3 minutes)

**What it does:** Marks events from datacenter IPs as `traffic_type=internal`, then filters them out of reporting. Singapore, Boardman, Dublin, Lulea = ~75 of last-90d's 183 users (40%).

1. Open https://analytics.google.com/analytics/web/#/p527333348/admin/streams/table
2. Click the **Web** stream "Ryan Realty Web Site"
3. Click **Configure tag settings** (small gear at the bottom of the stream details)
4. Click **Define internal traffic**
5. Click **Create**, then add these IP ranges (one rule per range or combined):

   | Range | Provider | Why |
   |---|---|---|
   | `52.74.0.0/15` | AWS ap-southeast-1 (Singapore) | 38 users / 90d, bots |
   | `52.32.0.0/11` | AWS us-west-2 (Boardman OR) | 14 users / 90d, bots |
   | `52.208.0.0/13` | AWS eu-west-1 (Dublin IE) | 6 users / 90d, bots |
   | `157.240.0.0/16` | Meta Lulea SE | 5 users / 90d, bots |
   | `47.74.0.0/15` | Alibaba Cloud (Shanghai) | 4 users / 90d, bots |

   Value: `internal` (this is the default; leave it).

6. Save.
7. Open **Admin → Data Settings → Data Filters**
8. There's a built-in "Internal Traffic" filter in **Testing** state by default. Click it, change state to **Active**, save.

After ~48 hours, reports refresh and the bot users drop out. The filter is non-retroactive — historical data still shows them.

---

## What this does NOT fix

- **Age + gender demographics** — still threshold-suppressed at our traffic volume. Even with BigQuery, the underlying demographic data only exists for users who (a) signed in to Google in the same browser + (b) have Ads Personalization on + (c) aren't in incognito + (d) aren't blocking cookies. At 2-3 real-prospect users/day, the math doesn't surface anything. Not fixable today; comes with growth.
- **Matt's office traffic** — if you want to filter your own browsing too, add your home/office IP to the same internal-traffic ruleset. To find your IP: https://whatismyipaddress.com/

---

## Verify it worked

48 hours after Step 2, run this from a fresh terminal:

```bash
set -a && source .env.local && set +a
node -e "
const { BetaAnalyticsDataClient } = await import('@google-analytics/data')
const c = new BetaAnalyticsDataClient({ credentials: {
  client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
  private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\\\n/g,'\n'),
}})
const [r] = await c.runReport({
  property: 'properties/527333348',
  dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
  dimensions: [{ name: 'city' }],
  metrics: [{ name: 'activeUsers' }],
  limit: 10,
})
for (const row of r.rows || []) console.log(row.dimensionValues[0].value, '=', row.metricValues[0].value)
"
```

Expect Singapore, Boardman, Dublin, Lulea to NOT appear in the top 10. Bend should rise to the top.

For BigQuery — within 24 hours of Step 1, check the dataset exists:
```bash
curl -s "https://bigquery.googleapis.com/bigquery/v2/projects/ryanrealty/datasets" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" | jq '.datasets[].datasetReference.datasetId'
```
Should list `analytics_527333348`.
