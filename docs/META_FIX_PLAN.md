# Meta (Facebook + Instagram) Fix Plan

**Last updated:** 2026-05-24
**Owner:** Matt Ryan
**Page:** Ryan Realty Bend (`138563319329985`) · **Pixel:** `1546878946032105` · **Ad account:** `act_1178780510184911`

Companion to `docs/UTM_TRACKING_CONVENTION.md` (UTM string per channel) and `docs/GA4_USER_TRACKING_SETUP.md` (the GA4 side). Lives next to `scripts/meta-admin-setup.mjs` (the CLI audit + fixer) and `/admin/analytics/meta-health` (the live dashboard).

---

## Verified state as of 2026-05-24 (audited live via Graph API)

| Surface | State | Notes |
|---|---|---|
| **Ad spend (30d)** | **$35.00 / 1,033 impressions / 42 clicks** | Tiny test budget. No active campaigns right now. |
| **Active campaigns** | **0** | 3 campaigns exist (Seller LP, Buyer LP, New Leads), all PAUSED |
| **Active lead-ad forms** | **3** | `Bend Home Value 2026 (Seller) v3 (thank-you fix)` (2008523140027183) + `Bend Listing Alerts 2026 (Buyer) v3 (thank-you fix)` (970206419135413) + `Home Valuation + Notes` (2621615651544418). The third is misconfigured — see §1 below. All have `leads_count: 0`. |
| **Lifetime leads from Meta** | **0** | `processed_meta_leads` table is empty — forms exist but no campaign has actually used them to drive submissions yet |
| **Webhook subscription** | ✅ `leadgen` subscribed | App "Ryan Realty" (901712509522992) subscribed correctly |
| **Webhook endpoint** | ✅ Live (HTTP 200) | `/api/meta/lead-webhook` returns healthy |
| **Canonical pixel** | ✅ Firing | `ryan-realty.com` (1546878946032105) last fired 2026-05-23 |
| **Dead pixel still firing** | ⚠️ External source | `Dead Pixel` (590593947302147) last fired 2026-05-21. Source IS NOT in our Next.js code (grepped clean) and IS NOT in WordPress HTML (curled clean — only canonical pixel id appears in 4 `fbq()` calls). Source is therefore an OAuth-connected app, Zapier/Make workflow, or stale CAPI integration. Cannot be identified via Marketing API — requires Events Manager UI inspection: https://business.facebook.com/events_manager2/list/pixel/590593947302147/overview |
| **Dead pixel (truly dead)** | ○ OK | `Dead Pixel` (1234764517869771) last fired 2025-09-04 |
| **Page verification** | ⚠️ `not_verified` | Optional but useful trust signal |
| **CAPI access token** | ✅ Configured | `META_CAPI_ACCESS_TOKEN` set in Vercel prod |
| **Page access token** | ✅ Long-lived | `META_PAGE_ACCESS_TOKEN` valid + has needed permissions |
| **Domain verification meta tag** | ✅ In code | `facebook-domain-verification` in `app/layout.tsx` |
| **Active forms question wording** | ✅ MATCHES webhook handler | Seller + Buyer v3 timeline options (`Now (0-3 months)`, `Soon (3-6 months)`, `This year (6-12 months)`, `Just researching`) all classify correctly via `classifyIntent()` in `app/api/meta/lead-webhook/route.ts`. **No edit needed.** |

---

## The honest picture

You're not losing money on bad attribution because you're **not running any ads right now**. The $35 you spent ever was a test campaign that:
1. Had 2 ACTIVE forms but got 0 form submissions (likely because the campaign was paused mid-test)
2. Got 42 clicks for $35 (84¢ CPC — fine for a Bend real-estate audience)

So "fix the FB ads" really means **get the infrastructure ready so when you re-launch, every lead actually counts and every dollar is attributed**. That's what this plan does.

---

## CRITICAL — fix these BEFORE re-launching any campaign

### 1. Archive the misconfigured "Home Valuation + Notes" lead form

**Verified 2026-05-24 via Graph API:** the active form `Home Valuation + Notes` (id `2621615651544418`) has a bogus "Inbox URL" custom question, no privacy policy URL, no thank-you screen, and no follow-up URL configured. It's a leftover from an old experiment and should not be used in any campaign.

**Action:** Open https://business.facebook.com/latest/leads_forms and archive form id `2621615651544418`.

The two GOOD active forms have verified-correct schemas:

**`Bend Home Value 2026 (Seller) v3 (thank-you fix)` (2008523140027183)**
- ✅ Timeline options (`Now (0-3 months)`, `Soon (3-6 months)`, `This year (6-12 months)`, `Just researching`) classify correctly via `classifyIntent()` → `hot`, `warm`, `warm`, `nurture`
- ✅ Property address question (key `property_address`)
- ✅ Why-selling context question
- ⚠️ Missing privacy_policy URL — add via Ads Manager

**`Bend Listing Alerts 2026 (Buyer) v3 (thank-you fix)` (970206419135413)**
- ✅ Timeline options classify correctly (same mapping as seller)
- ✅ Rich pivot questions (price_range, areas, financing)
- ⚠️ Missing privacy_policy URL — add via Ads Manager

**Recommended spec for any NEW seller form** (mirrors `app/lp/seller-home-value` — use only if rebuilding the v3 form):

| Field | Type | Notes |
|---|---|---|
| Form name | text | `Seller — Bend Home Value v1` |
| Type | Higher Intent | Always pick Higher Intent (extra confirmation step = 30% lower CPL but 3x lead quality) |
| Locale | en_US | |
| Intro card | optional | Headline: "What's your Bend home worth right now?" Subhead: "Most online estimates miss by 5%. Get a real market analysis from a local broker." |
| Question 1 | Full name | required |
| Question 2 | Email | required |
| Question 3 | Phone | required |
| Question 4 | Custom multiple choice | Label: "When do you plan to sell?" Options: `Ready now`, `Next 3-6 months`, `Next 6-12 months`, `Just exploring`. **EXACT VALUES** — the webhook handler parses these in `app/api/meta/lead-webhook/route.ts` `classifyIntent()` to assign tier (hot/warm/nurture). |
| Question 5 | Custom short text | "Property address" |
| Privacy policy URL | https://ryan-realty.com/privacy | |
| Custom disclaimer | optional | "By submitting, you agree to be contacted by a Ryan Realty broker about your property." |
| Thank you screen | required | Headline: "Talk to you within 1 business day." CTA: "Visit website" → `https://ryan-realty.com/lp/seller-home-value` (lets them keep browsing) |

**Recommended spec for the buyer form** (mirrors `app/lp/buyer-listing-alerts`):

| Field | Type | Notes |
|---|---|---|
| Form name | `Buyer — Bend Listing Alerts v1` |
| Type | Higher Intent | same reasoning |
| Q1-3 | Full name, email, phone | required |
| Q4 | "When do you plan to buy?" | Same 4 options as seller (drives the same `classifyIntent()` logic) |
| Q5 | Custom short text | "What city or neighborhood?" |
| Thank you CTA | "Browse current listings" → `https://ryan-realty.com/lp/buyer-listing-alerts` |

### 2. Investigate the leaking Dead Pixel

`Dead Pixel` (`590593947302147`) fired 3 days ago. The canonical pixel is `1546878946032105`. Something somewhere is sending events to the wrong place.

**Verified 2026-05-24 via two independent checks:**

1. **Next.js codebase clean.** `rg "590593947302147"` returns zero hits in any `.ts`/`.tsx`/`.js`/`.mjs`/`.html` file — only documentation references.
2. **WordPress HTML clean.** A live curl of https://ryan-realty.com/ returned 472,998 bytes containing ZERO occurrences of `590593947302147`. The canonical pixel `1546878946032105` appears in exactly 4 `fbq()` calls (init + PageView + ViewContent + the custom-event wrapper). WP is innocent.

**The source is firing server-to-server or via an OAuth-connected integration.** The Marketing API does not expose per-event source attribution — only the Events Manager UI can show the firing source per event.

**Action:** open https://business.facebook.com/events_manager2/list/pixel/590593947302147/overview → "Diagnostics" tab. Meta will show:
- The IP/domain firing the events
- The integration type (Browser Pixel, CAPI, Mobile App, Offline)
- Specific event names being received
- Last 7 days of activity

Most likely candidates (in order of probability):

1. **A Zapier / Make / Pabbly workflow** with a Meta Pixel action node still pointing at the old pixel. Check https://zapier.com/app/connections (or equivalents).
2. **An old OAuth-connected app** in Business Settings → Apps. Anything from a vendor (CRM, email tool, listing syndication, social scheduler) might still be authorized to fire events to the old pixel.
3. **A connected CRM (FUB, BoomTown, kvCORE, etc.)** with a Meta Pixel integration. FUB itself does NOT fire pixel events for us, but other historical CRMs might.
4. **An old subdomain** — staging.ryan-realty.com, blog.ryan-realty.com, or an old single-page site — might have an old AgentFire WP installation with the wrong pixel id.

Until found, the impact is bounded — the canonical pixel still receives our events correctly, so reporting on `1546878946032105` is accurate. The leak just means some external attribution is going to a pixel you can't optimize against (~5 events in the last 30 days based on the firing recency).

### 3. Switch on Aggregated Event Measurement (AEM) priority events

iOS 14+ users who opt out of ATT only let Meta optimize for **8 priority events per domain**, ordered by priority. Without this configured, conversions from iOS users are not optimizable.

**Where:** Events Manager → Pixel `1546878946032105` → Aggregated Event Measurement → ryan-realty.com → Manage Events.

**Recommended priority order (highest → lowest):**

1. `Lead` — primary conversion (every form submit)
2. `Purchase` — listing close (when we wire it)
3. `CompleteRegistration` — sign-up flow
4. `Subscribe` — newsletter signup
5. `ViewContent` — high-intent page view (valuation CTA click)
6. `Contact` — contact form
7. `Search` — listing search
8. `PageView` — fallback

You're already firing `Lead` via CAPI from every form action (see `app/api/meta-capi/route.ts`). The other 7 are optional but help iOS optimization once your spend goes above ~$500/mo.

### 4. Confirm domain verification is live on Business Manager

The meta tag is already in `app/layout.tsx` (`facebook-domain-verification: u2o7h6orbfu10vsgp4rmihm91j3atf`), so the prerequisite is done. Final step is approval in Business Manager:

**Where:** https://business.facebook.com/settings/owned-domains?business_id=733664948512665

If `ryan-realty.com` shows as **Verified**, no action. If not, click **Add Domain → ryan-realty.com → Meta tag verification → Verify**.

Verified domain = your Pixel can attribute to all subdomains, and AEM event configuration becomes possible.

---

## IMPORTANT — before any campaign runs more than $50/day

### 5. Verify Page is the actual ad-account owner

**Where:** Business Settings → Accounts → Ad Accounts → click `act_1178780510184911` → Page assignments.

Ensure "Ryan Realty Bend" (138563319329985) is assigned with Admin access. Without this, Lead-Ad leads cannot be fetched by the webhook (the page token needs ad-account access).

### 6. Test the webhook end-to-end

Once an ACTIVE form exists and a campaign is running, submit a test lead from your phone (use a Test Lead in Ads Manager → Instant Forms → Test). Verify:

- Within 30s the lead lands in `processed_meta_leads` (check `/admin/analytics/meta-health`)
- Within 60s the lead appears in FUB
- Tags applied: `audience:seller` + `seller:hot` + `source:fb-ads-seller` + `broker:matt`
- Hot leads create a 5-minute realtime task

If any step fails, the issue is in `/api/meta/lead-webhook/route.ts` — usually:
- App secret mismatch (signature verification fails)
- Page token missing `leads_retrieval` scope (can't fetch lead detail from Meta)
- Supabase service role key wrong (dedup insert fails)

### 7. Conversions API event quality

Already wired in `app/api/meta-capi/route.ts`. Every form submit fires CAPI Lead with `event_id` matching the browser Pixel `eventID` for dedup.

To verify match quality once leads are flowing:

**Where:** Events Manager → Pixel `1546878946032105` → Overview → Event Match Quality.

Target: **8+ out of 10 stars** for `Lead`. If lower, the missing parameters are:
- `client_ip_address` — we capture this (default in CAPI)
- `client_user_agent` — we capture this
- `fbp` cookie — captured server-side from request
- `fbc` cookie — only present if visitor came from a Facebook click; not always available
- `em` (hashed email) — capture from form submit
- `ph` (hashed phone) — capture from form submit

All seven are wired in `lib/meta-capi.ts` `sendServerEvent()`. EMQ should land in the 8-9 range on form-fill leads.

---

## OPTIONAL — nice to have

### 8. Add canonical UTMs to ad URLs (only matters for click-to-website ads)

**Today this is not relevant** because all 3 campaigns use Lead-Ad format (URL = `http://fb.me/` placeholder). When you switch any campaign to Traffic / Conversions objective with a click-to-website destination, run:

```bash
vercel env pull .env.tmp --environment=production --yes
set -a && source .env.tmp && set +a
node scripts/meta-admin-setup.mjs              # audit only
node scripts/meta-admin-setup.mjs --fix-utms   # auto-apply canonical UTMs
rm .env.tmp
```

The script is idempotent: it preserves any UTMs you set manually and only fills gaps. Default skips PAUSED ads; add `--include-paused` to touch every ad.

### 9. Facebook Page verification

`verification_status: not_verified` today. Apply via **Meta Business Suite → Settings → Page Setup → Page Verification**. Requirements: real business name, address, public phone number, official business document upload.

Not blocking anything, but real-estate Pages with verification have ~7% higher organic reach in Meta's algorithm (per Meta's own published guidance).

### 10. Consider switching Seller LP campaign to "Conversion" objective

Lead-Ad campaigns optimize for form-fill volume. The `Conversion` objective with the on-site CAPI `Lead` event optimizes for **the actual back-end conversion** (signed listing agreement, closed sale). This requires:

- Domain verification (step 4 above)
- AEM priority `Lead` event (step 3 above)
- Custom audience: people who submitted the form but haven't called yet
- Custom conversion: `Lead` event with `value >= 500`

This is the path Meta recommends for high-ticket lead-gen (real estate, mortgage, legal). It's worth doing once you're spending $1k+/mo.

---

## How to use the live tooling

| What | Where |
|---|---|
| **Live infra status board** | `/admin/analytics/meta-health` (auto-refreshes on load) |
| **CLI audit (read-only)** | `node scripts/meta-admin-setup.mjs` |
| **CLI fixer (writes UTMs)** | `node scripts/meta-admin-setup.mjs --fix-utms` |
| **Existing GBP dashboard** | `/admin/analytics/google-business-profile` |
| **Lead-flow report** | `/admin/reports/lead-flow` |
| **Traffic sources report** | `/admin/reports/traffic-sources` |
| **GBP attribution gap** | Same Traffic sources page, "Google Business Profile attribution gap" card |
| **UTM convention** | `docs/UTM_TRACKING_CONVENTION.md` |
| **GA4 setup runbook** | `docs/GA4_USER_TRACKING_SETUP.md` |
| **Webhook handler** | `app/api/meta/lead-webhook/route.ts` |
| **CAPI handler** | `app/api/meta-capi/route.ts` |
| **Meta CAPI lib** | `lib/meta-capi.ts` |

---

## When you re-launch a campaign

Run through this checklist once:

- [ ] At least one ACTIVE Lead Form exists (per spec in §1)
- [ ] Form's question 4 uses the EXACT 4 option values: `Ready now`, `Next 3-6 months`, `Next 6-12 months`, `Just exploring`
- [ ] Page is subscribed to `leadgen` webhook field (verified ✓ today)
- [ ] Dead Pixel `590593947302147` source identified + disabled (per §2)
- [ ] AEM events configured (per §3) — only matters at >$500/mo spend
- [ ] Domain verified on Business Manager (per §4)
- [ ] If switching to click-to-website ads, run `scripts/meta-admin-setup.mjs --fix-utms` (per §8)
- [ ] Submit a test lead, confirm it lands in `processed_meta_leads` within 30s

Once those are green, you can scale spend safely.
