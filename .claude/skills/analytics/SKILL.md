---
name: analytics
description: The entry point for ANY analytics, tracking, SEO-measurement, Google Analytics (GA4), Google Tag Manager (GTM), Search Console (GSC), conversion, UTM, pixel, Meta CAPI, Google Ads conversion import, lead-event, consent, sitemap-submission, or "is tracking working" task on ryan-realty.com. Load it before reading or writing any of that code, before answering a question about traffic, leads, rankings or attribution, and before touching GA4, GTM or Search Console settings. Use when Matt says "analytics", "GA4", "tag manager", "search console", "tracking", "conversions", "UTM", "SEO numbers", "is my tracking set up", or "optimize analytics".
---

# Analytics, tracking and SEO measurement

Matt, 2026-10-14: every SEO, analytics or tracking task is looked at and done properly, from one reference, with no one-offs and nothing rebuilt that already exists.

## 1. Read the one source of truth

[`docs/analytics/README.md`](../../../docs/analytics/README.md). It wins over every older analytics doc, skill, handoff and the claude.ai shared "Ryan Realty analytics guide". It holds:

- the IDs
- the GTM container rules (Merge import only, never Overwrite)
- the browser and server event rules
- consent
- offline conversions
- Search Console
- the **Registry** of every file that touches GA4, GSC or GTM

## 2. Look at the live systems, from code

```bash
npm run analytics:audit             # GA4 config + data health, Search Console, GTM live vs code
npm run analytics:audit -- --days=7
```

- **Access.** The script uses the Google service account already in the environment (`GOOGLE_SERVICE_ACCOUNT_*`, `GOOGLE_GA4_PROPERTY_ID`). That account reads GA4, is a site owner in Search Console, and reads GTM. You do not need a browser or a Google sign-in, so never ask Matt to sign you in.
- **Read-only.** The script changes nothing in Google and prints no credentials.
- **Before and after.** Run it before you change anything and again after the change is live. Report its findings, not memory.

## 3. Extend; do not recreate

- Find the file in the README Registry and extend it. A new file that sends to GA4, calls the GA4, GSC or GTM APIs, or lives in `lib/analytics/` fails `ci:analytics-registry` until it has a Registry row that says why it exists.
- Need a new check of the live systems? Add it to `scripts/analytics-audit.mjs`. Do not write a probe in a scratchpad or an underscore script.
- Need a server GA4 event? Use `fireGa4Event` with `ga4ServerContext()` (`lib/analytics/ga4-server-context.ts`). Never send one with only a client_id, because it lands in GA4 as Unassigned.
- Need a browser event? Add it to `GA4_BROWSER_EVENTS` (`lib/analytics/ga4-browser-events.ts`) and rebuild the GTM import. Never call `gtag('event')`.

## 4. What stays Matt's

- **GTM publishes.** Matt imports with **Merge** and publishes. Agents read GTM only.
- **GA4 settings.** Adding or removing key events (they feed Google Ads), turning off Google Signals, and Search Console Domain-property DNS are Matt's calls. Ask him as a yes/no question, with the recommended option first.
- **Ad spend and OAuth grants** follow CLAUDE.md §1.

## 5. Ship

- Use `npm run ship`. Work is done when it is live on ryan-realty.com and `npm run analytics:audit` shows it.
- Every number you report traces to a named source, per CLAUDE.md §0: the GA4 Data API, the GSC API or a Supabase table, with the window and the filter.

## Required references

- [`design_system/ryan-realty/SKILL.md`](../../../design_system/ryan-realty/SKILL.md) and [`social_media_skills/platform-best-practices/SKILL.md`](../../../social_media_skills/platform-best-practices/SKILL.md), only when the task produces content (CLAUDE.md §3 skill self-binding).
- [`docs/TRACKING_POLICY.md`](../../../docs/TRACKING_POLICY.md) for consent and identity invariants (gated by `ci:tracking-policy`).
