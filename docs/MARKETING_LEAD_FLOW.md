# Marketing lead flow — Ryan Realty

**Purpose:** Describe **every path** by which a prospect becomes a **known lead** in the in-house CRM (`public.crm_people`), what fires to **Meta** (pixel + Conversions API), **GA4**, and other **Supabase** tables, and how weekly automation **observes** pipeline health. This doc is the **lead-centric** companion to **`docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`** (full seller-growth stack).

**For AI agents:** Load **`docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`** for architecture, crons, env matrices, and optimization loops. Load **this file** when the question is specifically **how a lead is created**, **what runs on submit**, **deduplication**, or **debugging a missing `crm_people` row**.

**Live contract (2026-08-18):** Capture is **`sendEvent()`** in **`lib/crm/send-event.ts`** → **`ensureNativeLead()`**. the in-house CRM is decommissioned. There is no People API fallback that creates a live vendor contact. Unused `retired vendor-CRM env names` / `retired vendor-CRM public env names` names were removed from Vercel (2026-08-18).

---

## Table of contents

1. [Definitions](#1-definitions)
2. [One-page diagram](#2-one-page-diagram)
3. [Path A — Meta Lead Ads (native form)](#3-path-a--meta-lead-ads-native-form)
4. [Path B — Website contact form](#4-path-b--website-contact-form)
5. [Path C — Home valuation request](#5-path-c--home-valuation-request)
6. [Path D — Exit intent and valuation CTA](#6-path-d--exit-intent-and-valuation-cta)
7. [Path E — Lead landing pages](#7-path-e--lead-landing-pages)
8. [Path F — Page CTAs](#8-path-f--page-ctas)
9. [Identity stitching (before and after submit)](#9-identity-stitching-before-and-after-submit)
10. [Meta Conversions API and pixel deduplication](#10-meta-conversions-api-and-pixel-deduplication)
11. [Attribution and dashboard counting](#11-attribution-and-dashboard-counting)
12. [Where data lands (quick matrix)](#12-where-data-lands-quick-matrix)
13. [Environment variables by path](#13-environment-variables-by-path)
14. [Troubleshooting](#14-troubleshooting)
15. [Related files](#15-related-files)

---

## 1. Definitions

| Term | Meaning in this repo |
|------|----------------------|
| **Lead** | An identifiable person (email and/or phone) captured with intent. Operational truth is a **`crm_people`** row + timeline / tags / sequence enrollment. Other Supabase tables (`valuation_requests`, `processed_meta_leads`) are **analytics or dedup**, not the CRM record. |
| **Conversion event fan-out** | Same user action triggers **`sendEvent`** (CRM), optional extra **Supabase** insert, **Meta CAPI** (+ browser pixel with matching `event_id`), and **GA4** where implemented. Not every path implements every sink. |
| **`event_id`** | Stable id shared between **browser** `fbq('track','Lead',..., { eventID })` and **server** CAPI payload so Meta **deduplicates** one physical conversion. |

---

## 2. One-page diagram

```mermaid
flowchart TB
    subgraph META["Meta"]
        LA["Lead Ad submit"]
        CLK["Ad click to site"]
    end

    subgraph SITE["Site Next.js"]
        WH["POST api meta lead-webhook"]
        CF["submitContactForm"]
        HV["submitValuationRequest"]
        LI["submitLeadLandingForm"]
        EX["submitExitIntentLead"]
        PC["submitPageCTA"]
        CAPI["POST api meta-capi"]
        PIX["fbq Lead browser"]
    end

    subgraph DEST["Destinations"]
        CRM["crm_people via sendEvent"]
        SBV["Supabase valuation_requests"]
        METAUP["Meta CAPI plus Ads"]
        GA4["GA4"]
    end

    LA --> WH
    WH --> CRM

    CLK --> CF
    CLK --> HV
    CLK --> LI
    CLK --> EX
    CLK --> PC

    CF --> CRM
    CF --> CAPI
    CF --> PIX
    CAPI --> METAUP

    HV --> SBV
    HV --> CRM
    HV --> CAPI
    HV --> PIX

    LI --> CRM
    EX --> CRM
    PC --> CRM

    PIX --> METAUP
    SITE -. gtag PageView Lead etc .-> GA4
```

---

## 3. Path A — Meta Lead Ads (native form)

**User journey:** User sees ad → completes **Facebook or Instagram instant form** → Meta notifies Ryan Realty’s server.

**Server flow**

1. Meta `POST`s to **`/api/meta/lead-webhook`** with payload entries for field **`leadgen`**.
2. Handler verifies **`X-Hub-Signature-256`** using **`META_APP_SECRET`** (if unset, verification is skipped with a warning — **fix in production**).
3. For each lead id, app **`GET`**s Graph **`/{lead-id}`** with **`META_PAGE_ACCESS_TOKEN`** / **`META_PAGE_TOKEN`** to read **`field_data`**, campaign/ad set names, etc.
4. Dedup insert into **`processed_meta_leads`** (unique `leadgen_id`) so Meta retries do not create a second person.
5. Parsed fields map to name / email / phone / intent. **`sendEvent`** creates or reuses **`crm_people`** (source like **`Facebook Lead Ad — {campaign}`**). **`enrichNativeLead`** writes tags, campaign custom fields, and an origin note. Hot leads get **`createNativeTask`** due in 5 minutes. Buyer leads enroll immediately (email-only until SMS consent exists).

**Important:** This path **does not** go through Next.js contact or valuation server actions. There is **no automatic Supabase `valuation_requests` row** from Lead Ads unless something else records it. **Meta CAPI Lead** for this path is **not** wired in the webhook the same way as site forms (optimization relies on Meta’s native lead + offline conversions patterns elsewhere).

**Canonical implementation:** `app/api/meta/lead-webhook/route.ts`.

---

## 4. Path B — Website contact form

**Entry:** `/contact` → **`submitContactForm`** in **`app/contact/actions.ts`**.

**Order of operations**

1. **`sendEvent`** (`lib/crm/send-event`) with type **`General Inquiry`**, person name/email/phone, **`message`** prefixed with **`[inquiryType]`**. If capture fails, a direct **`ensureNativeLead`** fallback still writes the person.
2. **`sendContactNotification`** (email alert — non-blocking on failure).
3. **`canonicallyTagLead`** + enrollment (after() so the request can return).
4. **`generateEventId()`** → server **`POST /api/meta-capi`** with **`eventName: 'Lead'`**, hashed PII handled inside route, **`customData.value`** tiered:
   - **$300** if inquiry type suggests property/listing
   - **$500** if seller/valuation wording
   - **$200** otherwise (general)
5. Client **`ContactForm.tsx`** on success: **`fbq('track','Lead', { content_name: inquiryType }, { eventID: eventId })`** + **`trackEvent('generate_lead', ...)`**.

**Dedup:** **`eventId`** links CAPI and pixel **`Lead`**. CRM dedup is email-first inside **`ensureNativeLead`**.

---

## 5. Path C — Home valuation request

**Entry:** `/home-valuation` → **`submitValuationRequest`** in **`app/home-valuation/actions.ts`**.

**Order of operations**

1. **Insert** into Supabase **`valuation_requests`** (address, email, phone, **`source_url`**, etc.).
2. **`sendEvent`** type **`Seller Inquiry`** with property fragment when address parts exist.
3. Optional admin email; optional **automated CMA PDF** email path when property resolves.
4. **`POST /api/meta-capi`** with **`Lead`**, **`lead_type: 'seller_valuation'`**, **`value: 500`**, **`currency: 'USD'`**.
5. Client **`ValuationForm.tsx`**: **`fbq('track','Lead', { content_name: 'home_valuation' }, { eventID: eventId })`** + **`trackEvent('generate_lead', ...)`**.

**Dedup:** Same **`event_id`** pattern as contact form.

---

## 6. Path D — Exit intent and valuation CTA

These fire **CRM capture only** (no CAPI block in the helpers — treat as **mid-funnel signals**, not full Lead CAPI unless extended later).

| Action | Server helper | Event type | Notes |
|--------|---------------|------------|-------|
| Valuation CTA click tracking | **`trackHomeValuationCta`** (`app/actions/lead-capture.ts`) | **`Seller Inquiry`** | Needs a known email or identity-bridge person |
| Exit intent popup submit | **`submitExitIntentLead`** | **`Registration`** | Partner referral side effects when campaign hints lender/relocation |

---

## 7. Path E — Lead landing pages

**Entry:** **`submitLeadLandingForm`** in **`app/actions/lead-landing.ts`**.

**Behavior:** Builds **`Seller Inquiry`** or **`General Inquiry`** from **`audience`** + intent fields; **`sendEvent`** with campaign block (**`landing_page`**); **`sendContactNotification`**. **No CAPI** in this file path — add here if landing traffic should feed Meta optimization the same way as `/contact`.

---

## 8. Path F — Page CTAs

**Entry:** **`submitPageCTA`** (`app/actions/lead-capture.ts`).

**Behavior:** **`General Inquiry`** or **`Seller Inquiry`** via **`sendEvent`** only (no valuation row, no CAPI in this helper).

---

## 9. Identity stitching (before and after submit)

Anonymous browsers carry **`rr_vid`** (middleware). After identify, **`rr_pid`** (httpOnly, 90 days) points at **`crm_people.id`**.

**`PersonIdentityBridge`** (`components/PersonIdentityBridge.tsx`):

- **`?_pid=<crm_people.id>`** — preferred. Stamped on post-cutover outbound mail.
- **`?_fuid=<legacy id>`** — still honored for already-sent emails; resolved via **`fub_legacy_id`**, then the same native cookie.

Google / Facebook sign-in runs **`trackSignedInUser`** + **`stitchVisitorIdentity`** (`rr_vid` → person / email / auth user). After identify, later server actions attach to that person.

**Deep dive:** **`docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`** §3 and **`app/actions/identity-bridge.ts`**.

---

## 10. Meta Conversions API and pixel deduplication

**Route:** **`POST /api/meta-capi`** (`app/api/meta-capi/route.ts`).

**Behavior:**

- Accepts **`eventName`**, optional PII → **SHA-256** hashes (**Meta norm**).
- Reads **`_fbp`** / **`fbc`** cookies from the **request** carrying the server action call (same browser session when cookies exist).
- Forwards to **`sendServerEvent`** in **`lib/meta-capi`** with optional **`event_id`**.

**Browser side:** **`fbq`** calls pass **`eventID`** matching server **`event_id`** on **`Lead`** where implemented (**contact**, **valuation**).

---

## 11. Attribution and dashboard counting

**Seller funnel Facebook attribution** (for **`sellerVisitsFromFacebook30d`** and downstream ratios in **`getDashboardMarketingData`**) counts visit rows whose **`path`** matches **`utm_source=facebook`**, **`fbclid=`**, or known **Facebook or Instagram or Messenger referrers** (see `app/actions/dashboard.ts` around seller Facebook filters).

**CRM Facebook capture** on the dashboard is **`crm_people` via `getLeadIntake`** (social channel), not a vendor People API. The packet field is still named `fub` / `facebookContacts30d` in JSON for backward compatibility — the numbers are native.

**GA4:** Pulled into the same dashboard when service account + property access are valid; used for optimization scoring and weekly packets — not for creating CRM rows.

---

## 12. Where data lands (quick matrix)

| Path | crm_people | Supabase extra | Meta CAPI Lead | Pixel Lead | GA4 |
|------|------------|----------------|----------------|------------|-----|
| Lead Ad webhook | Yes + note + task | `processed_meta_leads` | Not same as site Lead wiring | N/A on site | Measurement Protocol `generate_lead` |
| Contact form | Yes | No dedicated row | Yes + value tier | Yes dedup | Via tracking helpers |
| Valuation | Yes | **`valuation_requests`** | Yes $500 | Yes dedup | Via tracking helpers |
| Exit intent / valuation CTA | Yes | No | No in helper | — | — |
| Lead landing | Yes | No in helper | No | — | — |
| Page CTA | Yes | No | No | — | — |

---

## 13. Environment variables by path

**Lead Ad webhook:** **`META_APP_SECRET`**, **`META_PAGE_ACCESS_TOKEN`** / **`META_PAGE_TOKEN`**. No CRM vendor API key.

**Site forms + CAPI:** **`NEXT_PUBLIC_SITE_URL`**, **`META_CAPI_ACCESS_TOKEN`**, pixel id on client (**`NEXT_PUBLIC_META_PIXEL_ID`**), Supabase keys for **`valuation_requests`** and **`crm_people`**.

**Weekly observability:** **`CRON_SECRET`**, dashboard GA keys — see pipeline doc §9.

---

## 14. Troubleshooting

| Symptom | Likely cause | Where to look |
|---------|----------------|---------------|
| Lead Ad submits but no `crm_people` row | Webhook URL or **`leadgen`** subscription wrong; **`META_APP_SECRET`** mismatch; Graph token cannot read lead; no email or phone (no dedup key) | Meta App Webhooks; logs **`[lead-webhook]`** |
| Duplicate Meta conversions | Missing or mismatched **`event_id`** between **`fbq`** and CAPI | Client form + **`/api/meta-capi`** payload |
| CAPI always weak match | No **`_fbp`** / **`fbc`** on server request; user blocking cookies | **`meta-capi` route** cookie reads |
| Valuation in DB but no CRM person | **`sendEvent`** failed and **`ensureNativeLead`** fallback also failed | **`[valuation]`** logs |
| Dashboard Facebook visits zero but ads run | Visit path not storing **`fbclid`** or UTM; referrer not classified | Visit tracker / landing URLs |
| Sequence never starts | Tags missing `audience:*`; pre-epoch contact; outreach-list source | **`lib/crm/enroll.ts`**, **`/api/cron/crm-auto-enroll`** |

---

## 15. Related files

| Area | Path |
|------|------|
| Lead Ad webhook | `app/api/meta/lead-webhook/route.ts` |
| CAPI ingress | `app/api/meta-capi/route.ts`, `lib/meta-capi.ts` |
| Contact lead | `app/contact/actions.ts`, `app/contact/ContactForm.tsx` |
| Valuation lead | `app/home-valuation/actions.ts`, `app/home-valuation/ValuationForm.tsx` |
| Mid-funnel capture | `app/actions/lead-capture.ts`, `app/actions/lead-landing.ts` |
| Native capture | `lib/crm/send-event.ts` (`sendEvent` → `ensureNativeLead`) |
| Visit / identity | `components/PersonIdentityBridge.tsx`, `app/actions/identity-bridge.ts`, `lib/visitor-backfill.ts` |
| Marketing dashboard | `app/actions/dashboard.ts` |
| Weekly packet | `app/api/cron/marketing-optimization-report/route.ts` |
| Sequence + enroll | `app/api/cron/crm-auto-enroll/route.ts`, `app/api/cron/crm-sequence-engine/route.ts` |
| Paid spec automation | `scripts/build-fb-ad.mjs`, `scripts/create-fb-ad.mjs` |

**Also read:** **`docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`**, **`docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md`** (campaign ops), **`docs/CRM_INTEGRATION.md`**, **`.cursor/rules/marketing-advertising-workflow.mdc`**, **`.cursor/skills/facebook-seller-growth/SKILL.md`**, **`docs/marketing/facebook-seller-growth-LEARNINGS.md`**.
