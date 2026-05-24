# GA4 + Meta Ads — Best-Practice Setup Runbook

**Last updated:** 2026-05-24
**Owner:** Matt Ryan
**Property:** GA4 `527333348` (`G-ST40W4WM6T`) · Pixel `1546878946032105`

This is the Admin-side click trail for everything the codebase already wires automatically. The code is shipped — these are the GA4 / Meta Ads Manager toggles you need to flip once for the data to actually surface in reports.

---

## TL;DR — 7 GA4 clicks to unlock individual-user reporting

1. **Reporting Identity → Blended** (10 sec, unlocks User Explorer + cross-device)
2. **Enable Google Signals** (10 sec, unlocks Demographics + Interests + better modeling)
3. **Register `user_id` as a custom dimension** (30 sec, unlocks per-user pivots)
4. **Register 6 event-scoped custom dimensions** (`lp_variant`, `lp_source`, `lp_campaign`, `lp_content`, `broker_slug`, `lead_classification`, `lead_type`) (1 min, unlocks campaign + LP + broker pivots)
5. **Mark `generate_lead`, `listing_inquiry`, `home_valuation_cta_click` as Key Events** (formerly Conversions) (30 sec, makes them eligible for bid optimization)
6. **Enable "Detailed location and device data"** for full geo (10 sec)
7. **Run the User Explorer report** to see your first identified user (zero clicks — just opens it)

Total: under 5 minutes.

---

## Part 1 — Reporting Identity (the unlock for individual-user reporting)

**Why this matters:** the `AnalyticsIdentityBridge` component now sets `gtag('config', GA4_ID, { user_id: 'fub-<sha256>' })` for every identified visitor. But GA4 only USES that user_id if Reporting Identity is set to **Blended** or **Observed**. The default is `Device-only` — which throws user_id away.

**Steps:**

1. Open https://analytics.google.com/
2. Bottom-left gear icon → **Admin**
3. Under **Property settings → Data display → Reporting identity**
4. Choose **Blended** (recommended — combines user_id + device-id + Google Signals for the most complete picture)
5. Click **Save**

**What changes immediately:**
- Cross-device User reports show one row per person instead of one per device
- User Explorer (Explore → Templates → User Explorer) lists each identified user as a row you can click into
- Audiences can be built around `user_id` values

---

## Part 2 — Google Signals (unlocks Demographics + Interests + cross-device)

**Why this matters:** Signals is the GA4 feature that turns anonymous visits into rich demographic and interest data — `age 25–34`, `Real Estate Enthusiasts`, `Bend Oregon area`, etc. It's also what enables Google's conversion modeling (filling in conversions for visitors who declined cookies).

**Prerequisites (already done in code, shipped 9738df3):**
- ✅ Consent Mode v2 wired (Google Signals requires this)
- ✅ Cookie consent banner discloses Google Analytics
- ✅ `/privacy` page (live)
- ✅ `ad_storage`, `ad_user_data`, `ad_personalization` consent categories sent to gtag

**Steps:**

1. Admin → **Data collection and modification → Data collection**
2. Toggle **Enable Google signals data collection** → ON
3. (Optional but recommended) Toggle **Enable Granular location and device data collection** → ON
4. Accept the disclosure language
5. Click **Save**

**What changes within ~24 hours:**
- Reports → User → Demographics → Demographic details populates with age, gender, interests
- Reports → User → Tech → Devices shows cross-device journeys (e.g. visitor lands on iPhone, returns on desktop, counts as 1 user)
- Audiences can target by demographic + interest
- Conversion modeling kicks in for consent-denied visitors (fills in attribution gaps)

---

## Part 3 — Custom dimensions (so you can pivot reports by LP / campaign / broker)

The codebase fires GA4 events with rich custom params already (see `lib/lead-tracking.ts` for the canonical schema). But GA4 doesn't show those params in standard reports until you **register** them as custom dimensions.

**Steps:**

1. Admin → **Data display → Custom definitions → Custom dimensions tab**
2. Click **Create custom dimension** for each of the rows below:

| Dimension name | Scope | User property / Event parameter | Description |
|---|---|---|---|
| **User ID** | User | user_id | The hashed FUB-person identifier set by AnalyticsIdentityBridge |
| **Assigned broker** | User | assigned_broker | matt / rebecca / paul |
| **LP variant** | Event | lp_variant | Which landing page / form fired the event (`seller-home-value`, `expired-listing`, etc.) |
| **LP source** | Event | lp_source | utm_source captured at form submit |
| **LP medium** | Event | lp_medium | utm_medium |
| **LP campaign** | Event | lp_campaign | utm_campaign — **this is the one that breaks out FB ads by campaign name** |
| **LP content** | Event | lp_content | utm_content (FB ad set name when using the convention below) |
| **Broker slug** | Event | broker_slug | The broker assigned at form-submit time |
| **Lead classification** | Event | lead_classification | hot / warm / nurture |
| **Lead type** | Event | lead_type | seller / buyer / listing_inquiry / exit_intent / page_cta |

After saving, GA4 needs ~24 hours to start showing these in reports. They appear immediately in **Explorations** (Explore → Free form → drag the new dimension as a row).

---

## Part 4 — Mark lead events as Key Events (formerly Conversions)

**Why this matters:** Without this, GA4 treats `generate_lead` as just another event. Marking it as a Key Event makes it appear in the Conversions report, makes it bid-optimizable in Google Ads, and lets you build audiences around it.

**Steps:**

1. Admin → **Data display → Events** (waits 24 hrs after first firing to appear)
2. Find each of these events in the list:
   - `generate_lead`
   - `listing_inquiry`
   - `home_valuation_cta_click`
   - `valuation_requested` (legacy — fired by some forms)
   - `contact_agent` (legacy)
3. Toggle the **Mark as key event** column to ON for each
4. (Optional) Admin → **Key events** → Configure default value: $500 for `generate_lead`, $300 for `listing_inquiry`, $50 for `home_valuation_cta_click`

---

## Part 5 — User Explorer (where you SEE individual users)

Once Parts 1–3 are done, this is the report that answers "what is Sarah Smith doing on my site right now":

1. Open **Explore** (left sidebar)
2. **Template gallery** → **User Explorer**
3. The default view lists every identified user (rows with `fub-<hash>` or `em-<hash>`)
4. Click any row → see every event that user fired, in chronological order, with all parameters

Combine with **Custom dimensions** to filter to specific LP variants or brokers.

---

## Part 6 — FB Ad attribution (answering "can I see FB ad results in GA4?")

**Today's state (audited 2026-05-24):**

- ✅ `fbclid` query param auto-detected by `components/GoogleAnalytics.tsx` lines 58–72 → stamps `source=facebook`, `medium=paid_social` on the visit
- ✅ Lead-flow report at `/admin/reports/lead-flow` shows FB-attributed lead events
- ❌ **Campaign / ad-set / ad-level breakdown is NOT visible** because Meta does not auto-add `utm_campaign`

**Fix (manual, per ad URL):** every Facebook / Instagram ad URL must carry these parameters:

```
https://ryan-realty.com/lp/seller-home-value
  ?utm_source=facebook
  &utm_medium=paid_social
  &utm_campaign=<campaign-name-kebab-case>
  &utm_content=<ad-set-name-kebab-case>
  &utm_term=<ad-name-kebab-case>
```

**Concrete example:**

```
https://ryan-realty.com/lp/seller-home-value?utm_source=facebook&utm_medium=paid_social&utm_campaign=seller-funnel-may-2026&utm_content=lookalike-1pct&utm_term=hero-video-30s
```

**Why kebab-case:** GA4 surfaces these strings verbatim. Spaces and special chars break filtering. Stick to lowercase, hyphens, no punctuation.

**Where to put this:** Ads Manager → Ad level → Website URL field. Apply to every ad.

**Once tagged, view the results:**

1. GA4 → **Reports → Acquisition → Traffic acquisition**
2. Change the primary dimension from **Session default channel group** to **Session source / medium**
3. Filter to `facebook / paid_social`
4. Add a secondary dimension: **Session campaign**
5. You now see sessions + key events + revenue broken out by campaign

**Also visible on:** `/admin/reports/lead-flow` → "Top GA4 lead sources" table (uses the same data).

---

## Part 7 — Meta side: re-importing GA4 data into Meta Ads Manager

This is OPTIONAL. Most Ryan Realty data flows the other direction (Meta CAPI → GA4). But if you want Meta's bid algorithm to optimize against GA4 conversions:

**Option A — Conversions API** (already wired in code via `/api/meta-capi`)
- Every form submit fires CAPI with the canonical Lead event + value tier ($500 seller, $300 buyer)
- Meta's bid algorithm already uses these for optimization
- No additional Admin action needed

**Option B — Offline Conversions API (manual upload)**
- Pull a CSV from GA4: User Explorer → filter to identified users → export
- Ads Manager → Events Manager → Data Sources → Offline Event Sets → Upload
- Match against ad clicks via email hash (already in your CSV from FUB)
- Use this only for high-LTV conversions like Closed Sale (months after the click)

---

## Part 8 — Things the code already does (no Admin action needed)

For reference — these are the wins already shipped and live as of commit `9738df3`:

| Capability | Where it lives | What it does |
|---|---|---|
| **GA4 user_id** | `components/AnalyticsIdentityBridge.tsx` + `app/api/identity/me/route.ts` | Sets `user_id` on every identified visitor for cross-device + User Explorer |
| **Meta Pixel advanced matching** | Same file | Re-inits Meta Pixel with `em: <sha256>` for stronger person stitching |
| **Server-side `generate_lead` mirror** | `lib/lead-tracking.ts` + every form action | Fires GA4 events server-side so ad-blockers can't drop them |
| **`fubclid` / `gclid` / `ttclid` / `msclkid` auto-attribution** | `components/GoogleAnalytics.tsx` lines 58–72 | Stamps source + medium without UTMs |
| **Cross-domain linker** | Same file lines 83–86 | Stitches sessions across `ryan-realty.com` ↔ `ryanrealty.vercel.app` |
| **Consent Mode v2** | Same file (gtag-consent-defaults script) | Required for Google Signals + cookieless modeling |
| **Visitor session tracking** | `app/api/visitors/track/route.ts` + Postgres triggers | Engagement scoring, intent tags, hot-lead auto-escalation |
| **Per-person admin view** | `app/admin/(protected)/people/[fubPersonId]/page.tsx` | Joins FUB + Supabase for one unified profile per person |

---

## Quick-verify checklist (do this after the 7 GA4 clicks)

After clicking through Parts 1–4, run this on production:

1. Open https://ryanrealty.vercel.app in an incognito window
2. Click **Accept All** on the cookie banner
3. Navigate to `/lp/seller-home-value`
4. Wait ~5 seconds
5. Switch to GA4 → **Reports → Realtime**
6. You should see:
   - 1 active user
   - 1 `page_view` event on `/lp/seller-home-value`
   - `Session source / medium = (direct)` (or whichever channel you came from)
7. Submit the form with a test email
8. Within 30 seconds you should see:
   - `generate_lead` event
   - `lp_variant = seller-home-value` parameter
   - `assigned_broker = matt` user property (once Part 3 dims are registered)

If any of those is missing, drop a note in `docs/marketing/facebook-seller-growth-LEARNINGS.md` so the next agent can debug.

---

## Related files

- `lib/lead-tracking.ts` — canonical server-side GA4 fire helper
- `lib/ga4-measurement-protocol.ts` — low-level Measurement Protocol client
- `components/AnalyticsIdentityBridge.tsx` — identity → GA4 user_id + Meta em
- `app/api/identity/me/route.ts` — hashed identity endpoint
- `components/GoogleAnalytics.tsx` — Consent Mode v2 + gtag bootstrap
- `app/admin/reports/lead-flow/page.tsx` — the dashboard that proves it's working
- `docs/MARKETING_LEAD_FLOW.md` — every lead-creation path
- `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md` — end-to-end FB → site → CRM map
