# Marketing Analytics + Meta Audience Build — Session Memory

**Period:** 2026-05-23 through 2026-05-26 (Cursor agent, ~16 commits)
**Surface:** Cursor Agent (Claude Opus)
**`main` @ commit at handoff:** `65fdd91` (latest pushed audience-builder scripts)
**Production:** Vercel READY through commit chain, all CI gates green

---

## What this memory file covers

The complete arc from "Claude Code session hit rate limit while patching lead-flow wiring" through "Meta retargeting audiences live + campaign infrastructure designed." Reads in 5 minutes; saves a full session of re-discovery.

---

## Shipped + live in production

### Code (16 commits, all READY)

| Commit | What |
|---|---|
| `8d5e770` | 7 lead surfaces brought to gold-standard wiring (`canonicallyTagLead` + `fireLeadGenerated` server-side mirror) + `snapshot-channels` cron registered |
| `7ba15ee` | `/admin/reports/lead-flow` — end-to-end funnel report joining GA4 + Supabase canonical tables |
| `9738df3` | `/admin/people/[id]` single-pane-of-glass person view + `AnalyticsIdentityBridge` (GA4 `user_id` + Meta Pixel `em` advanced matching wired) |
| `349518b` | Consent Mode v2 wired in `components/GoogleAnalytics.tsx` + `/admin/people` index page + `docs/GA4_USER_TRACKING_SETUP.md` |
| `74576e5` | `/admin/reports/traffic-sources` — 6-table dashboard (GA4 + first-touch UTMs + raw referrers + landing pages + GBP-gap + untagged-channels) + `docs/UTM_TRACKING_CONVENTION.md` |
| `f72a7d0` | `scripts/ga4-admin-setup.mjs` — idempotent GA4 Admin API baseline enforcer. Applied: Google Signals enabled, 4 new key events marked, 14-month retention, 90-day other-conversion lookback, data-driven attribution |
| `bd73fae` | `/admin/analytics/meta-health` live dashboard + `scripts/meta-admin-setup.mjs` (idempotent CLI audit + optional `--fix-utms`) + `docs/META_FIX_PLAN.md` |
| `c576b72` | Meta-health form-quality detection + dead-pixel forensics (identified `Conversions API System User` + foreign ad account leak source via API) |
| `bd87885` | `scripts/meta-apply-fixes.mjs` — archives misconfigured forms, reports leak sources. Archived `Home Valuation + Notes` form via API. |
| `2c844b0` | Documented Zapier zap as confirmed dead-pixel leak source (Matt killed it; verified 74h zero fires) |
| `4dde86a` | GBP UTM convention updated to Matt's choice: `utm_source=gbp&utm_medium=organic&utm_campaign=profile` (Matt set this himself in GBP admin) |
| `6469352` | Fixed false-alarm finding: lead-form `privacy_policy` IS readable via `?fields=legal_content` or `?fields=privacy_policy_url` (NOT bare `?fields=privacy_policy`). Both ACTIVE forms have valid privacy URLs. |
| `3fd9ce7` | `/api/admin/gbp/set-website-utm` admin route + `scripts/gbp-set-utm-website.mjs` (idempotent GBP Website URL updater via My Business Business Information API) |
| `65fdd91` | `scripts/meta-rebuild-fub-audiences.mjs` (built, NOT yet run) + `scripts/meta-upload-mls-audiences.mjs` (run — pushed 3 MLS audiences) |

### Admin pages now live

- `/admin/reports/lead-flow` — end-to-end funnel + wiring health by surface
- `/admin/reports/traffic-sources` — GBP attribution gap + untagged-channels detector
- `/admin/analytics/meta-health` — pixel/lead-form/webhook/spend dashboard
- `/admin/people` — searchable index (audience/broker/tier/source facets)
- `/admin/people/[fubPersonId]` — single-pane-of-glass per person (FUB profile + visitor_sessions + listing_inquiries + valuation_requests + cmas + marketing_assignments)

### Wiring (now active on every visitor)

- 7 lead surfaces fire `canonicallyTagLead` + `fireLeadGenerated` server-side (survives ad blockers): seller LP, buyer LP, expired LP, Heath CMA, contact form, home-valuation, listing-detail inquiries, lead-landing, exit-intent, page CTA
- GA4 `user_id` set on every identified visitor via `AnalyticsIdentityBridge` (hashed FUB person id or signed-in email)
- Meta Pixel `em` advanced matching re-init'd on every identified visitor
- Consent Mode v2: `gtag('consent', 'default', {...denied})` + `gtag('set', 'url_passthrough', true)` + `gtag('set', 'ads_data_redaction', true)`
- Server endpoint `/api/identity/me` returns `{identified, hashedUserId, hashedEmail, fubPersonId}` (Cache-Control: private, no-store)

### GA4 admin baseline (applied via API 2026-05-24)

- ✅ Google Signals ENABLED + CONSENTED
- ✅ 18 custom dimensions registered (`lp_variant`, `lp_source`, `lp_medium`, `lp_campaign`, `lp_content`, `broker_slug`, `lead_classification`, `lead_type`, `assigned_broker` + 9 pre-existing)
- ✅ 17 conversion events marked as Key Events (13 pre-existing + 4 added: `listing_inquiry`, `home_valuation_cta_click`, `cma_downloaded`, `newsletter_signup`)
- ✅ Data retention: 14 months (max for Standard tier)
- ✅ Attribution: data-driven (paid + organic)
- ✅ Other-conversion lookback: 90 days (acquisition lookback at API max of 30 days)

### Meta state (verified via Graph API 2026-05-26)

**Custom Audiences in `act_1178780510184911`:**

| ID | Name | Records pushed | Status |
|---|---|---|---|
| `120244161522810698` | RR MLS — Bend Property Owners (all) | 9,058 | Ready (matching settling, displaying 1000 floor) |
| `120244161526200698` | RR MLS — 97703 Property Owners | 7,178 | Ready (same) |
| `120244161528410698` | RR MLS — Absentee Owners (Bend area) | 1,619 | Ready (same) |
| `120243107433010698` | FUB Suppression — All Current Contacts | 7,600-8,900 (pre-existing) | Ready |
| `120235961910760698` | All website visitors 180 days | 20 (too small, low traffic) | Ready |

**Meta API audience size discovery:** uploads using FN+LN+CT+ST+ZIP-only schema (no email/phone) display as `1000-1000` with `estimate_ready: false` while matching settles. Privacy floor for sub-1,000 matched audiences. Actual counts ≤ 1,000 each at last check 5pm 2026-05-25. **Recommend re-check 24-72h after upload** (i.e. 2026-05-28+).

**Page Access Token scopes verified** (`debug_token` 2026-05-24):
`ads_management`, `ads_read`, `business_management`, `pages_manage_ads`, `instagram_content_publish`, `leads_retrieval`, `manage_app_solution`, `whatsapp_business_management`, plus 20 other page/IG/messaging scopes. Token type `PAGE`, `expires_at: 0` (never), `data_access_expires_at: 0`.

### GBP state

- Property `527333348` Website URL: `https://ryan-realty.com/?utm_source=gbp&utm_medium=organic&utm_campaign=profile` (Matt set via GBP admin 2026-05-24)
- Domain verification meta tag in `app/layout.tsx`: `u2o7h6orbfu10vsgp4rmihm91j3atf`
- 36 direction requests / 5 website clicks / 0 calls (last 30d)

### Resolved this session

- **Dead pixel leak (`590593947302147`)**: Source IDENTIFIED via Graph API (`Conversions API System User` ID `122166497978674230` + foreign ad account `act_599206346213887`). Matt killed the Zapier zap that was firing CAPI events through that system user. Verified 74h zero fires. The system user + foreign account ASSIGNMENTS remain on the dead pixel (cosmetic only — Meta `DELETE /pixel/assigned_users` returns 400 "Unsupported delete request" even with `ads_management` scope).
- **Lead-form privacy_policy false alarm**: my earlier audit reported `null` because I read the wrong field. Real field is `?fields=legal_content` or `?fields=privacy_policy_url`. Both ACTIVE forms have valid privacy URL `https://ryan-realty.com/privacy-policy/` — no action needed.

---

## Pending / next-up (decision points for next session)

### Awaiting Matt's green light

1. **Run `scripts/meta-rebuild-fub-audiences.mjs`** — script built, would create 2 new audiences:
   - `RR Database — Targetable (no realtors/compliance/test)` — 10,164 contacts (Tier 1 nurture target)
   - `RR FUB Hard-Stop Exclusion (realtors+compliance+test)` — 3,023 contacts (excluded from every campaign)
   - 30 sec runtime. Replaces stale `FUB Suppression — All Current Contacts` audience (7,600-8,900).
2. **Build 6 campaign shells** — designed but NOT yet built. Spec below.

### Awaiting Matt's UI clicks (no API path)

| Item | Why API can't do it |
|---|---|
| GA4 Reporting Identity → Blended | Not exposed in GA4 Admin API. Matt skipped earlier. |
| GA4 channel grouping: add `gbp` to Organic Search regex | Matt started, didn't finish. |
| Meta AEM priority events ordering | `/{pixel}/aem_conversion_configs` returns 400 "field does not exist" on v21.0 |
| Domain verification finalize in Business Manager | `/{business}/verified_domains` returns 400 |
| Page verification (optional) | Requires business document upload |
| Dead pixel residual cleanup (System User + foreign acct unassignment) | `DELETE /pixel/assigned_users` returns 400 even with ads_management scope |
| IG / TikTok / LinkedIn bio link UTMs | Meta locks IG bio update API (`POST /ig_id { website }` returns 400) |

### Awaiting external review

- Google Ads MCC + dev-token application (24-48h Google review) — separate prior agent task

---

## The designed-but-not-built 6-tier campaign structure

Final consensus design after multiple Matt-corrections:

```
TIER 1 — Database Nurture (25% budget, default $12/day)
  Objective:    OUTCOME_AWARENESS (not Lead — this is sphere/brand)
  Special Ad:   HOUSING (mandatory)
  INCLUDE:      RR Database — Targetable (FUB clean list — 10,164 contacts, build via script)
  EXCLUDE:      RR FUB Hard-Stop + AUD-CORE-Converters-365d
  Frequency:    Cap 2-3/week (sphere fatigue is real)
  Creative:     Just-sold, market updates, personal Matt content, testimonials. NOT direct-ask CTAs.

TIER 2A — Bend Resident TOFU (25% budget, $12/day)
  Objective:    OUTCOME_LEADS
  Special Ad:   HOUSING
  Geo:          Bend OR + 25mi radius
  INCLUDE:      Interest "Real estate" OR "Bend, Oregon" OR "Sotheby's" OR "Zillow"
                + Lookalike-1% of RR Database — Targetable (Special Ad Audience flavor)
  EXCLUDE:      RR FUB Hard-Stop + AUD-CORE-Converters-365d + RR Database — Targetable
                (excluding target makes this strictly cold acquisition)
  Frequency:    Uncapped (Meta Advantage+ optimizes)
  Creative:     Educational — market data, "Where does your home fit?"

TIER 2B — West Bend 97703 Premium TOFU (15% budget, $7/day)
  Objective:    OUTCOME_LEADS
  Special Ad:   HOUSING
  Geo:          97703 centroid (44.082 N, -121.333 W) + 15mi radius
  INCLUDE:      RR MLS — 97703 Property Owners (120244161526200698) — 7,178 records
                + interests + LAL
  EXCLUDE:      RR FUB Hard-Stop + AUD-CORE-Converters-365d
  Frequency:    Cap 4/week
  Creative:     Premium-tier — luxury market data, Tetherow/NW Crossing/Awbrey-specific

TIER 3 — Out-of-Area / Absentee Owner (10% budget, $5/day)
  Objective:    OUTCOME_LEADS
  Special Ad:   HOUSING
  Geo:          California (Bay Area + LA), Seattle metro, Portland metro
  INCLUDE:      RR MLS — Absentee Owners (Bend area) (120244161528410698) — 1,619 records
                + interest "Bend, Oregon" + Real estate
  EXCLUDE:      RR FUB Hard-Stop + AUD-CORE-Converters-365d + Bend 25mi
  Frequency:    Cap 3/week
  Creative:     "Considering selling your Bend second home?" / "Bend luxury market update for vacation-home owners"

TIER 4 — MOFU Retargeting (20% budget, $10/day)
  Objective:    OUTCOME_LEADS
  Special Ad:   HOUSING (still required)
  INCLUDE:      AUD-CORE-Sellers-180d (people who visited /lp/seller-home-value, /home-valuation,
                /sell, /sell/valuation in last 180 days — to be created as a Website Custom Audience
                from the canonical pixel)
  EXCLUDE:      RR FUB Hard-Stop + AUD-CORE-Converters-365d
  Frequency:    Cap 4/week
  Creative:     Testimonial, social proof, market timing, broker face card

TIER 5 — BOFU Hot (5% budget, $3/day)
  Objective:    OUTCOME_LEADS
  Special Ad:   HOUSING
  INCLUDE:      Visited seller LP in last 7-14 days (sub-window of AUD-CORE-Sellers-180d)
  EXCLUDE:      RR FUB Hard-Stop + AUD-CORE-Converters-365d
  Frequency:    Cap 6/week
  Creative:     Direct ask — "Get your CMA in 24 hours" or "Talk to Matt this week"
```

**Audiences needed that don't exist yet (Tier 4/5 prerequisites):**
- `AUD-CORE-Sellers-180d` — WCA from canonical pixel, URL contains seller LP paths, last 180d, exclude Lead converters
- `AUD-CORE-Converters-365d` — WCA from pixel, Lead event last 365d (used as universal exclusion)
- `AUD-LAL-1pct-Targetable` — Special Ad Audience Lookalike, 1% of RR Database — Targetable (cold acquisition)

These can all be created via `POST /act_X/customaudiences` with the right `rule` JSON or `subtype: LOOKALIKE` for the LAL.

---

## Matt's strategic decisions (carry forward)

- **Sphere marketing strategy**: TARGET his FUB database (don't exclude). The Database Nurture tier targets the clean FUB list with low frequency for top-of-mind awareness with past clients + warm leads.
- **Realtor exclusion is hard-stop**: 2,315 realtor records + 3,023 compliance hard-stops + 465 bounced + 230 unsubscribed all get excluded from EVERY tier including Database Nurture (same `HARD_STOP_TAGS` set as `lib/canonical-lead-tagger.ts`).
- **97703 is the premium focus** (West Bend / NW Crossing / Awbrey / Tetherow zone). Tier 2B gets dedicated geo + MLS audience targeting. Direct ZIP targeting banned under Housing — use 15mi centroid radius + MLS owner audience as workaround.
- **Out-of-area owners matter**: 1,621 of his 9,058 deduped MLS owners live elsewhere (CA 494, OR-non-Bend 515, WA 198, AZ 67). Tier 3 specifically targets these absentee owners.
- **Skip-trace enrichment ($700 BatchData)** was declined for now. MLS audience uses name+address-only multi-key matching (10-25% match rate vs 50-70% with email/phone).
- **Channel grouping override + Reporting Identity** were both skipped per Matt's call. GBP attribution still works (visible as `utm_source=gbp` in deep-dive reports); only the GA4 default channel rollup rolls GBP into "Unassigned" instead of "Organic Search."
- **GBP UTM convention chosen by Matt**: `utm_source=gbp&utm_medium=organic&utm_campaign=profile` (NOT `utm_source=google&utm_campaign=gbp-profile` which I initially recommended).

---

## Site reality check (the broader picture)

- Total prospect site traffic last 30d: ~20-30 sessions
- Lifetime Meta-driven leads (`processed_meta_leads`): **0** (no live campaigns)
- All 3 prior Meta campaigns are PAUSED, total spend ever: $35 / 1,033 impressions / 42 clicks / 0 leads
- The dashboards we built work correctly — they're just reading empty/low-data tables until traffic arrives
- The infrastructure is OVER-built relative to current traffic. Building campaigns + getting them spending is the next bottleneck-breaker.

---

## Critical scripts (CLI runnable, not yet automated via cron)

| Script | Purpose | Run state |
|---|---|---|
| `scripts/ga4-admin-setup.mjs` | Idempotent GA4 Admin API baseline | Applied 2026-05-24, 4 conversion events created |
| `scripts/meta-admin-setup.mjs` | Idempotent Meta audit (URLs, pixels, forms) + optional `--fix-utms` | Audited only, never used `--fix-utms` (all current campaigns are Lead Ads, URL=fb.me) |
| `scripts/meta-apply-fixes.mjs` | Form archive + dead-pixel forensics | Run — archived `Home Valuation + Notes`, identified leak source |
| `scripts/meta-upload-mls-audiences.mjs` | Upload MLS CSV → 3 Custom Audiences | Run 2026-05-25 — 3 audiences live |
| `scripts/meta-rebuild-fub-audiences.mjs` | FUB → 2 Custom Audiences (clean + hard-stop) | **NOT YET RUN — awaiting green light** |
| `scripts/gbp-set-utm-website.mjs` + `/api/admin/gbp/set-website-utm` | GBP Website URL UTM updater | Blocked on Supabase 522 issue 2026-05-24; Matt set URL manually via GBP admin instead |

Every script supports `--dry-run`. All require `vercel env pull .env.tmp && source .env.tmp` for credentials.

---

## How to verify everything currently shipped

```bash
git pull --rebase origin main           # land on 65fdd91+
npm run build                            # green
npm run ci:design-tokens                 # green
npm run ci:dal-boundary                  # green
vercel env pull /tmp/api.env --environment=production --yes
set -a && source /tmp/api.env && set +a

# Verify GA4 admin state (should report Planned: 0, Skipped: 22)
node scripts/ga4-admin-setup.mjs --dry-run

# Verify Meta audit state
node scripts/meta-admin-setup.mjs

# Verify MLS audiences are live with their IDs
node -e "fetch('https://graph.facebook.com/v21.0/act_1178780510184911/customaudiences?fields=id,name,approximate_count_lower_bound,delivery_status&access_token=' + process.env.META_PAGE_ACCESS_TOKEN).then(r=>r.json()).then(d=>console.log(JSON.stringify(d.data?.filter(a=>a.name.startsWith('RR MLS')), null, 2)))"

rm /tmp/api.env

# View live dashboards (admin login required)
open "https://ryanrealty.vercel.app/admin/analytics/meta-health"
open "https://ryanrealty.vercel.app/admin/reports/lead-flow"
open "https://ryanrealty.vercel.app/admin/reports/traffic-sources"
open "https://ryanrealty.vercel.app/admin/people"
```
