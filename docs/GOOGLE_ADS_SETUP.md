# Google Ads setup and analytics

Use Google Ads on the site and track performance in Analytics and other metrics.

---

## What you need to provide

### 1. Google Ads tag ID (required for Ads to load)

- In [Google Ads](https://ads.google.com): **Tools & settings** → **Setup** → **Conversions**, or open an existing conversion action.
- Your **tag ID** is in the form `AW-123456789` (shown in the global site tag snippet).
- Set in env:
  - **`NEXT_PUBLIC_GOOGLE_ADS_ID=AW-123456789`**
- Add the same in Vercel (and `.env.local` for dev). The tag loads only after the user accepts analytics cookies.

### 2. Optional: Conversion actions (for lead and sign-up)

To send **conversion events** (so Ads can optimize and report on leads/sign-ups):

1. In Google Ads: **Tools** → **Conversions** → **New conversion action** → **Website**.
2. Create one action for **Lead** (e.g. “Contact form / listing inquiry”) and one for **Sign-up** (e.g. “Account created”).
3. For each action, choose **Use Google Tag Manager or a website tag** and copy the **`send_to`** value from the gtag snippet, e.g. `AW-123456789/AbCdEfGhIjK`.
4. Set in env:
   - **`NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LEAD=AW-123456789/AbCdEfGhIjK`** (your lead conversion `send_to`)
   - **`NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SIGNUP=AW-123456789/XyZ123AbC`** (your sign-up conversion `send_to`)

When these are set, the site will fire:

- **Lead conversion**: on contact form submit, listing inquiry (schedule showing / ask question), and save listing.
- **Sign-up conversion**: when a user completes sign-up (e.g. Google or email).

---

## Linking GA4 and Google Ads (recommended)

Linking lets you:

- See GA4 metrics and audiences in Google Ads.
- Import GA4 conversions into Google Ads (alternative or complement to the conversion tags above).
- Use GA4 audiences for remarketing.

### In Google Analytics 4

1. **Admin** → **Product links** → **Google Ads links**.
2. **Link** → choose your Google Ads account → confirm.

### In Google Ads

1. **Tools** → **Linked accounts** → **Google Analytics 4**.
2. Link the same GA4 property.

After linking you can:

- In GA4: **Admin** → **Product links** → **Google Ads links** → **Conversion import** to use GA4 events (e.g. `generate_lead`, `sign_up`) as Ads conversions.
- In Google Ads: use **Audiences** from GA4 for targeting/remarketing.

---

## What the site already does

- **Tag loading**: With `NEXT_PUBLIC_GOOGLE_ADS_ID` set and analytics consent given, the app loads the Google tag (gtag.js) and configures your Ads ID alongside GA4 (if configured).
- **GA4**: Existing `NEXT_PUBLIC_GA4_MEASUREMENT_ID` and GA4 Data API (admin dashboard) are unchanged; GA4 continues to receive the same events.
- **Conversions**: If `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LEAD` and/or `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SIGNUP` are set, the app fires the corresponding `conversion` events via gtag when:
  - A lead is generated (contact form, listing inquiry, save listing), or
  - A user completes sign-up.

---

## Env summary

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | Yes (for Ads) | Tag ID (e.g. `AW-123456789`). Loads the Ads tag after consent. |
| `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LEAD` | No | `send_to` for lead conversions (contact, inquiry, save). |
| `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SIGNUP` | No | `send_to` for sign-up conversion. |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | No (but recommended) | GA4 measurement ID for analytics; link to Ads for reporting and import. |

All of these are optional at the code level; set only the ones you use.
