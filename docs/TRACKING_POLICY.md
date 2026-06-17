# Tracking Policy — privacy-compliant funnel attribution

**Status 2026-06-17.** This is the authoritative spec for how Ryan Realty tracks
a visitor from anonymous first touch through known-lead conversion and attributes
each lead to its originating ad. It is derived from an adversarially-verified 2026
deep-research pass (17 claims confirmed, 8 refuted) cross-referenced against the
live codebase. Load-bearing invariants are **locked by the `ci:tracking-policy`
gate (G48)**. Outward changes that alter live ad/tracking behavior are a **backlog
that ships only on Matt's explicit go** (Draft-First / ops-explicit).

## The architecture (what we do, end to end)

```
anonymous visit ──► first-party visitor_id (cookie/localStorage, PII-free)
                    + capture fbclid/gclid/utm_* into visitor_sessions
        │
        ▼  (browse: page_view, listing_view, search → /api/visitors/track, consent-gated)
        │
   form submit ──► resolve/stitch to FUB person (email > fub_cid cookie > new)
                    + backfill prior events into FUB timeline
                    + Meta CAPI "Lead" (SHA-256 hashed PII) with shared event_id
                    + browser pixel "Lead" with the SAME event_id  → dedup
        │
        ▼  (FUB pipeline: nurture → close/won)
   close/won  ──► [BACKLOG] offline-conversion upload back to Meta/Google
                   keyed by stored fbclid/gclid  → closed-loop ROAS
```

## Principles → status → enforcement

| # | Principle (research-verified) | Status | Enforcement |
|---|---|---|---|
| 1 | Durable **first-party, PII-free visitor_id**; stitch anonymous→known via a **deterministic shared id (hashed email)**, never fingerprinting | ✅ live (`visitor_sessions`, `rr_session_id`, identity bridge) | gate item 4/5 + DAL |
| 2 | **First-party, server-side** event collection preferred over client-only pixels | ✅ live (`/api/visitors/track`, `/api/meta-capi`, same-origin) | `ci:csp` host allowlist |
| 3 | Consent gates event firing; **Consent Mode v2 = 4 params** (`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`) denied-by-default | ✅ live (`GoogleAnalytics.tsx`) | **G48 item 1** |
| 4 | Analytics/marketing tags **gated on a consent helper** | ✅ live (GTM + FUB pixel gate on `hasAnalyticsConsent`) | **G48 item 2** |
| 5 | **PII SHA-256 hashed before transmission** to ad platforms (email lowercased+trimmed; phone digits-only) | ✅ live (`meta-capi` `em`/`ph` only) | **G48 item 3** |
| 6 | Pixel↔CAPI **dedup via one server-generated `event_id`** (same id + same event_name; Meta 48h merge) | ✅ live (seller LP `generateEventId`) | **G48 item 4** |
| 7 | **Persist click IDs (fbclid/gclid) + UTMs on the lead path** so offline conversions can be uploaded | ✅ live (seller LP captures utm + fbclid) | **G48 item 5** |

## Hard deadline — June 15, 2026

Google Ads stops deriving consent from Google Analytics (Google Signals) settings
and relies on the **CMP's Consent Mode signal**; `ad_storage` becomes the governing
control for ad data flowing GA4 → linked Ads. Our Consent Mode v2 wiring already
satisfies this. The legacy `UploadClickConversions` API also migrates to the Data
Manager API on the same date — build any offline-upload job (backlog #2) to the new
model. (Source: Google Analytics Help answer 17016975; corroborated, vote 2-1.)

## Backlog — outward changes, ship only on Matt's go

These change live ad/tracking behavior, so they are NOT auto-enforced. Each needs
explicit approval before shipping (ops-explicit / Draft-First).

1. **Meta Limited Data Use (LDU) for CCPA/CPRA opt-out.** This is a US opt-out
   site, so the correct pattern for an opted-out visitor is LDU (`data_processing_options`)
   / `ad_user_data=denied` — the event still reports but is excluded from targeting —
   **not** suppressing the pixel. Today the pixel fires on all traffic (intentional,
   Matt directive 2026-06-02) but never sets LDU when a visitor uses "Do Not Sell."
   Wire LDU on the pixel + CAPI when consent/`donotsell` is set. (Verified 3-0.)
2. **Offline-conversion upload (closed-loop ROAS).** On FUB close/won, upload the
   conversion back to Meta (CAPI offline event) and Google (Enhanced Conversions for
   leads / Data Manager) keyed by the stored fbclid/gclid. Windows: **GCLID 90 days,
   hashed-PII Enhanced Conversions 63 days** — the upload job must run inside them.
   Not implemented today. This is the single biggest ROAS gap. (Verified 3-0.)
3. **Versioned, timestamped consent record.** Store consent text version + scope +
   timestamp + IP per lead before any call/text automation fires. The FCC abandoned
   the federal one-to-one consent rule, but **state mini-TCPA laws (FL FTSA, OK OTSA)
   may still require seller-specific consent** — the record must capture scope so we
   can prove it. Today we show the disclosure (`ci:sms-consent`) but do not persist a
   per-lead consent record. (Verified 3-0.)
4. **Google Enhanced Conversions (online).** Send hashed PII with the GA4/Ads
   conversion for higher match rates (`AW-` id is present in env; not yet wired).

## Deprecated / do NOT do (refuted or outdated framings)

- Do **not** claim or design around "server-side tagging defeats ad blockers" — refuted
  (0-3). Server-side reduces *some* loss; it is not a cloak.
- Do **not** assume third-party cookies are being universally phased out — Google
  **cancelled** Chrome 3p-cookie deprecation (Jul 2024); the loss is Safari/Firefox-only
  (~36% of traffic).
- Do **not** use browser **fingerprinting** for identity. Stitch on hashed email only.
- Do **not** send **raw/unhashed** email or phone to Meta or Google. Ever. (Locked by G48.)
- Do **not** retain the leading `+` when hashing phone for Meta — strip to digits only,
  or the hash mismatches and match rate drops.

## References

- Research report: deep-research run `wf_f0c1c88d-073` (this session transcript).
- Tealium visitor-stitching docs; Google Ads offline-import (answer 10029210);
  Google Consent Mode docs; FCC one-to-one final rule (consumerfinanceinsights, 2025-09-15).
- Codebase: `components/GoogleAnalytics.tsx`, `components/CookieConsentBanner.tsx`,
  `components/MetaPixel.tsx`, `app/api/meta-capi/route.ts`, `app/api/visitors/track/route.ts`,
  `app/lp/seller-home-value/actions.ts`, `lib/visitor-backfill.ts`.
