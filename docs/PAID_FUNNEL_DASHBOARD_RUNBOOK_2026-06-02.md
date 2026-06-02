# Paid Facebook funnel — dashboard runbook (2026-06-02)

This is the list of things only Matt can do (they live in dashboards, not the codebase). It came out of the end-to-end FB-funnel audit. The code side is built, secured, and verified firing live. The funnel is currently OFF because every campaign is paused, and the CRM is under-fed because website visits are not being stitched to FUB people.

Each step has a **GATE** = the exact pass/fail check that proves it is done.

## Verified IDs (from the live audit)

- Meta ad account: `act_1178780510184911`
- Meta Pixel: `1546878946032105`
- Facebook Page: `138563319329985`
- GA4 property: `527333348` (measurement id `G-ST40W4WM6T`)
- FUB users: Matt = `1`, Rebecca = `2`, Paul = `3`

## What was already fixed in code this session (no action needed)

- Heath LP now fires a Meta CAPI Lead (it sent zero Meta conversion before).
- Dead `/lp/listings/<id>` listing links on the bend, golf, and tetherow LPs now point at the real `/homes-for-sale` detail pages.
- Buyer LP Lead value aligned to 300 on both the Pixel and the server.
- Seller, buyer, and expired LP server Leads now forward `_fbp`/`_fbc` for stronger matching.
- `ryanrealty.vercel.app` now redirects to `ryan-realty.com` (fixed Google/Facebook sign-in).

---

## 1. Meta Ads Manager — turn the funnel ON (this is the #1 item)

Nothing else in the funnel can produce a lead while the campaigns are paused. The audit confirmed all 9 campaigns and 14 ads are paused, 0 spend and 0 impressions in the last 7 days.

1. Confirm the intended seller structure is the live set: Cold Acquisition (~$30/day), Lookalike 1% built from the FUB list (~$20/day), Retargeting site visitors (~$10/day).
2. Confirm **Special Ad Category = Housing** on each campaign (the API shows HOUSING, so this looks set — just confirm before spend).
3. Set **manual placements**: Facebook + Instagram Feed, Stories, Reels. **Mobile only.** **Exclude Audience Network** (it delivers low-quality real-estate leads). Right now placements are automatic/Advantage+, which lets Audience Network back in.
4. Upload the FUB suppression list as an **Exclusion audience** on every ad set so you do not pay to re-acquire existing contacts or realtors.
5. **Un-pause.**

**GATE:** in Ads Manager, at least one ad shows status Active, the account `/insights` for today shows spend > 0, and within a day the site shows real paid sessions (a visitor with `fbclid` in the URL, `utm_medium=paid_social`). Note: Ryan Realty ads tag `utm_source=meta` (not `facebook`), so count both.

## 2. Meta Events Manager — confirm Lead is a real conversion

The Pixel is receiving both browser and server events and the dedup is wired correctly in code. The two things only you can confirm in the UI:

1. Data Sources → pixel `ryan-realty.com` (`1546878946032105`) → **Aggregated Event Measurement**: confirm **Lead** is a configured/prioritized web conversion event. (There are 0 custom conversions on the account; the standard Lead event is the right primary, but its AEM ranking is UI-only.)
2. Same pixel → Lead event detail: confirm browser + server events are **deduplicated** (one conversion per shared `event_id`, not double-counted).

**GATE:** Events Manager shows Lead as an active/ranked conversion event, and the Lead event's "deduplicated" indicator is present (not "potential duplicate events").

## 3. Meta Lead Ads Testing Tool — prove the native lead-ad path

The native FB Lead Ad webhook (`/api/meta/lead-webhook`) is fully built and secured, but it has **never processed a single lead**. You cannot call that path "working end to end" until one real lead runs through it.

1. Go to `developers.facebook.com/tools/lead-ads-testing`.
2. Select the page (`138563319329985`) and the active seller lead form, submit one test lead.

**GATE:** within 60 seconds, the Supabase `processed_meta_leads` table has one new row with status `completed` and a non-null `fub_person_id`, and a matching `marketing_assignments` row with `source = 'meta-lead-form'` appears. (If you only run link-click ads to the on-site LPs and never native instant-form Lead Ads, you can skip this and mark Path A as not-in-use.)

## 4. Meta App Dashboard — re-point the leadgen webhook

The leadgen webhook callback is currently set to `https://ryanrealty.vercel.app/api/meta/lead-webhook`. That still works today only because the canonical redirect exempts `/api/*`. It is one refactor away from silently breaking.

1. Meta App Dashboard → Webhooks (or Messenger/Page subscriptions) → leadgen.
2. Change the callback URL to `https://ryan-realty.com/api/meta/lead-webhook`. Keep the same verify token.

**GATE:** the leadgen subscription callback URL reads `https://ryan-realty.com/...` and the test ping (step 3) still lands a `processed_meta_leads` row.

## 5. GA4 — mark sign_up as a key event

Verified live via the GA4 Admin API: `generate_lead` and `valuation_requested` are already key events. `sign_up` is **not** flagged (`newsletter_signup` is the key event instead), so account sign-ups are not counted as a conversion.

1. GA4 Admin (property `527333348`) → Events → Key events.
2. Either mark `sign_up` as a key event, or confirm `newsletter_signup` is the intended sign-up conversion and leave it.

**GATE:** GA4 Key events list contains the event you intend to use for account creation.

## 6. Google Ads — wire it or formally defer it

Verified live: `NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LEAD`, and `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SIGNUP` are all absent in production, so no Google Ads conversion ever fires. A server-side `GOOGLE_ADS_CUSTOMER_ID` exists, which suggests setup is mid-flight.

- **If Google Ads / PMax is running:** create the two conversion actions (lead + signup) in Google Ads, link to GA4 (one link already exists), then set the three `NEXT_PUBLIC_GOOGLE_ADS_*` vars in Vercel production. The client tag fires automatically once they are set.
- **If Google Ads is not running yet:** mark it formally deferred so the absence is not read as a regression.

**GATE:** either an `AW-` conversion fires on `generate_lead` (Google Ads → Conversions shows recent activity), or Google Ads is documented as deferred.

## 7. Follow Up Boss — close the loop

1. **Automation rule (most important):** confirm a FUB Automation Rule listens for the `audience:seller` and `audience:buyer` tags and enrolls the person in the master action plan. The code never sends emails or texts itself — FUB's own engine does. Without this rule, tagged leads sit untouched.
2. **Env vars in Vercel production:** set `FUB_PIPELINE_ID` and `FOLLOWUPBOSS_BROKER_USER_MAP=matt:1,rebecca:2,paul:3` before any non-Matt `?agent=` route or native Lead Ad launch.
3. **`_fuid` on email links (fixes "no website traffic in FUB"):** make outbound FUB email-campaign links carry the `_fuid` parameter so the `fub_cid` identity cookie is set when a known contact clicks through. This is the lever that lifts the ~2% visit-to-FUB bridge rate. (The code-side stitch on sign-in is being fixed separately.)

**GATE:** a test contact tagged `audience:seller` auto-enrolls in the seller action plan; a known contact who clicks an email link with `_fuid` produces a "Visited Website" event on their FUB timeline within a few minutes.

---

## Order to do these

1. **#1 un-pause** (nothing works without it).
2. **#7 FUB automation rule + env** (so leads that arrive actually get worked).
3. **#4 webhook re-point** + **#3 one test lead** (proves the native path).
4. **#2 Events Manager** + **#5 GA4** + **#6 Google Ads** (conversion definitions).

Once #1, #4, and #7 are done and one real lead has flowed through, the funnel is working end to end.
