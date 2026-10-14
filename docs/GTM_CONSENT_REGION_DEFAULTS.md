# GTM: Consent Mode v2 region defaults

**Owner of the publish: Matt.** Code sets the defaults in the page before `gtm.js` loads
(`lib/analytics/consent-defaults.ts`, rendered by `lib/analytics/gtm-bootstrap.ts`).
This page is only for the Google Tag Manager container **GTM-WV6R4NZ5** (one Google tag
for **G-ST40W4WM6T**).

Matt 2026-10-08. Counsel confirms before merge.

## What the page already does

Before `gtm.js` the bootstrap pushes:

1. A **region-scoped** `gtag('consent','default',{ analytics_storage:'denied', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied', region:[...EEA, GB, CH] })`.
2. A **global** default with `analytics_storage:'granted'` and all `ad_*` `'denied'`.

Google resolves the visitor's region itself. The more specific (region) command wins
for those countries. `wait_for_update: 500` is set. `functionality_storage` and
`security_storage` are granted in both defaults.

Overrides, still before `gtm.js`:

- `navigator.globalPrivacyControl === true` → a single all-denied default (analytics included).
- Stored decline in `ryan_realty_cookie_consent` → all-denied.
- Stored accept → analytics granted (and `ad_*` granted only if marketing was accepted).

The Meta Pixel is separate (`lib/analytics/meta-pixel-consent.ts`). It does not go
through GTM. It stays off until marketing cookies are accepted (US included). An ad
click is not consent and does not load the pixel.

**GA4 Admin:** keep **Google signals** and **ads personalization** off for this
property. Region defaults on the page already deny `ad_*` until marketing is
granted. Turning signals or ads personalization on in GA4 Admin would collect
that data outside the consent default.

## Does the container need a setting change?

**Usually none.** Region defaults are a `gtag('consent','default', { region })` command on
the page. The Google tag inside GTM-WV6R4NZ5 reads that state. You do not enter the country
list in GTM.

Confirm these, and only change them if they drifted:

1. tagmanager.google.com → container **GTM-WV6R4NZ5** → **Admin** → **Container Settings**.
2. **Enable consent overview** should be on (it lets Tag Assistant show consent). If it is
   off, turn it on and save. This does not change what tags send.
3. Open the Google tag (the one for **G-ST40W4WM6T**, All Pages). **Consent Settings** should
   stay **Not set** / built-in checks. Do **not** add a required `analytics_storage` check
   that would block the tag from loading: Consent Mode needs the tag to load so it can send
   cookieless pings when denied.
4. Do **not** add a second Consent Initialization / Consent Default tag in GTM. The page
   already sets the default before `gtm.js`. A GTM default that fires later would be the
   late default Google ignores at best.

If you import the GA4 browser-events container (`docs/GTM_GA4_BROWSER_EVENTS.md`), leave
that tag's consent settings as they are.

## Verify in Tag Assistant Preview

Use **Preview**, then open the site. Do not publish to test.

### A. United States, no banner answer, no GPC

1. Preview → open `https://ryan-realty.com/` (or `/sell`).
2. Do not click the cookie banner.
3. In Tag Assistant, the Google tag for G-ST40W4WM6T **Fired**.
4. Open the tag's hit (or Chrome DevTools → Network → `google-analytics.com/g/collect` or
   `analytics.google.com/g/collect`).
5. Query string:
   - `gcs` is **G101** (Consent Mode on, **ad_storage denied**, **analytics_storage granted**).
   - `npa=1` may still appear because ads are denied.
6. After a few seconds a `_ga` cookie may appear. `_gcl_au` / ads cookies should not.

### B. Restricted region (EEA / UK / CH), no banner answer, no GPC

Tag Assistant cannot spoof Google's geo. Easiest checks:

1. **GTM Preview** with a VPN or a device in a restricted country, **or**
2. Chrome DevTools → three-dot menu → More tools → **Network conditions** does **not**
   change Consent Mode region. Use a VPN, or temporarily add only your test country to the
   `region` array in a preview workspace **on a branch**, never in the live container.

Expected on the first collect hit, no banner answer:

- `gcs` is **G100** (ads denied, analytics denied).
- No `_ga` cookie.

`gcs` codes (the common two-signal form):

| `gcs` | ad_storage | analytics_storage |
|---|---|---|
| G100 | denied | denied |
| G101 | denied | granted |
| G111 | granted | granted |

Consent Mode v2 also sends `gcd` (four signals). For a US default you should see analytics
granted and ad_storage / ad_user_data / ad_personalization denied.

### C. Global Privacy Control

1. Chrome: a GPC extension, or `chrome://flags` / a browser with GPC on. Firefox: Settings →
   Global Privacy Control.
2. Preview → same URL, no banner answer.
3. First collect hit: `gcs` is **G100**, even from a US IP. No `_ga`.

### D. After decline

1. Click **Essential only** on the banner (or set
   `ryan_realty_cookie_consent` to `{"analytics":false,"marketing":false}`).
2. Reload in Preview.
3. `gcs` is **G100**. No new `_ga`. A leftover `_ga` from an earlier grant may still sit
   in the browser; Consent Mode will not use it for new hits.

### E. After accept all

1. Click **Accept all**.
2. `gcs` is **G111**. `_ga` may be set. Ads cookies may appear.

## Publish

If you only confirmed Consent Overview and changed nothing, there is nothing to publish.

If you turned Consent Overview on: **Submit** → version name
`Consent overview on (region defaults are in the page, 2026-10-08)` → **Publish**.
