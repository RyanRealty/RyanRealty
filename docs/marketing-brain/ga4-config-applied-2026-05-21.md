# GA4 Admin Configuration — 2026-05-21

Property: `Ryan Realty` (id `527333348`)
Measurement ID: `G-ST40W4WM6T`
Script: [`scripts/ga4-admin.mjs`](../../scripts/ga4-admin.mjs)
Audit output: [`out/ga4-audit.json`](../../out/ga4-audit.json)
Apply log: [`out/ga4-apply.json`](../../out/ga4-apply.json)

## Auth

Service account `viewer@ryanrealty.iam.gserviceaccount.com` is used directly (no domain-wide delegation impersonation needed for Admin API). The account currently holds **Analyst** role on property `527333348`. Editor or Administrator role is needed for writes (create / update conversion events, dimensions, audiences).

The Data API (read-only) continues to work for Matt's existing dashboards via DWD subject `matt@ryan-realty.com`.

## Current state (audit summary)

| Resource | Count | Status |
|---|---|---|
| Conversion events | 8 | 3 of the locked-spec items present, 5 missing |
| Custom dimensions | 12 | 4 of the locked-spec items present, 6 missing |
| Audiences | 10 | 0 of the locked-spec items present, 5 missing |

### Conversion events already configured (3 of 7 from locked spec)

| event_name | status |
|---|---|
| `generate_lead` | already a conversion |
| `contact_agent` | already a conversion |
| `purchase` (default) | already a conversion |
| `close_convert_lead` | already a conversion (legacy) |
| `qualify_lead` | already a conversion (legacy) |
| `schedule_showing` | already a conversion |
| `property_inquiry` | already a conversion |
| `form_start` | already a conversion |

### Conversion events MISSING from locked spec (5)

| event_name | purpose |
|---|---|
| `valuation_requested` | CMA request fired from seller LP + agent-page valuation forms |
| `call_initiated` | `tel:` link click — strong intent signal |
| `tour_requested` | buyer tour request from listing detail |
| `cma_anchor_click` | CMA section interaction (anchor scroll, "see comps" click) |
| `listing_showing_click` | listing page primary CTA click |

### Custom dimensions already configured (4 of 10 from locked spec)

| parameterName | scope | status |
|---|---|---|
| `lp_variant` | EVENT | already exists |
| `lp_source` | EVENT | already exists |
| `lp_campaign` | EVENT | already exists |
| `broker_slug` | EVENT | already exists (renamed from `broker` in locked spec) |

Plus 8 unrelated event-scoped dimensions for property type / city / community slugs.

### Custom dimensions MISSING from locked spec (6)

| parameterName | scope | description |
|---|---|---|
| `lp_medium` | EVENT | utm_medium captured on LP view |
| `lp_content` | EVENT | utm_content (ad creative id) captured on LP view |
| `lead_classification` | EVENT | timeline-based tier (hot / warm / nurture) |
| `lead_type` | EVENT | seller or buyer |
| `assigned_broker` | USER | first broker assigned to this user — stable user property |
| `lead_status` | USER | current FUB pipeline status — synced from FUB via user property |

### Audiences MISSING from locked spec (5)

All 5 are new. None of the existing 10 audiences overlap functionally with these:

| displayName | membership | filter logic |
|---|---|---|
| `Form starters — no submit` | 30d | INCLUDE event=`form_start`, EXCLUDE event=`generate_lead` |
| `LP visitors 7d — no conversion` | 7d | INCLUDE event=`view_landing_page`, EXCLUDE event=`generate_lead` |
| `LP visitors 30d — no conversion` | 30d | INCLUDE event=`view_landing_page`, EXCLUDE event=`generate_lead` |
| `Repeat visitors — no conversion` | 540d | INCLUDE event_count(`session_start`) > 2, EXCLUDE event=`generate_lead` |
| `High-intent sellers` | 30d | INCLUDE event=`view_landing_page` where lp_variant=`seller-home-value`, AND event=`scroll_depth` where percent_scrolled > 74 |

## Manual step required from Matt

The service account `viewer@ryanrealty.iam.gserviceaccount.com` needs **Editor** role on the GA4 property to apply the missing items.

**How to grant**:

1. Open Google Analytics → Admin (gear icon, bottom-left).
2. Property column → Property access management.
3. Find `viewer@ryanrealty.iam.gserviceaccount.com` (currently Analyst).
4. Click the row → Edit role → choose **Editor**.
5. Save.

Then re-run:

```
node scripts/ga4-admin.mjs apply
```

The script is idempotent — it will skip the 6 already-existing items and create the 16 missing ones. Re-run `node scripts/ga4-admin.mjs audit` to verify.

## Decisions deliberately skipped

- **Google Signals enrollment**: not toggled. Privacy policy update not pre-approved by Matt. Per task brief, this is a Matt-toggles-later item.
- **Cross-domain linker**: not configured (ryan-realty.com WordPress ↔ ryanrealty.vercel.app). Phase 5, separate work.
- **`broker` dimension parameter name**: renamed in locked spec to `broker_slug` to match existing GA4 dimension and avoid duplicates.

## Re-run cadence

The script is safe to run daily as a drift check. Suggested usage:

```
# Audit only — writes out/ga4-audit.json, no mutations
node scripts/ga4-admin.mjs audit

# Apply locked config — idempotent
node scripts/ga4-admin.mjs apply
```

## What the dashboard depends on

The comprehensive `/admin/analytics` dashboard (Phase 3) queries against:

- `customEvent:lp_variant` (already configured)
- `customEvent:lp_source` (already configured)
- `customEvent:lp_campaign` (already configured)
- `customEvent:broker_slug` (already configured)
- `customEvent:lead_classification` (DEPENDS on Matt elevating SA → re-apply)
- `customEvent:lead_type` (DEPENDS on Matt elevating SA → re-apply)
- `sessionSource`, `sessionMedium`, `sessionCampaign` (built-in)
- `pagePath`, `pageTitle` (built-in)
- `eventCount`, `sessions`, `totalUsers`, `engagementRate` (built-in metrics)

Funnel data is fully present in the existing `marketing_channel_daily` table (scope=`lp` rows) so the dashboard works end-to-end against today's data without waiting on the elevation.
