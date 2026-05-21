# Ryan Realty — FSBO Detection Workflow

**Status:** Built 2026-05-21. Not yet committed — Matt review pending.
**Companion to:** `docs/FUB_COMPLETE_LEAD_FLOW_2026-05-17.md` §1.5 (expired-listing cron). The FSBO cron mirrors the expired pipeline at the architecture level. Same dedupe model, same tagging schema, same alert format, same broker assignment.

---

## 1. What it does

Every hour at `:20` past the hour, scrape Zillow's For-Sale-By-Owner filter for each of our 6 service-area cities (Bend, Redmond, Sisters, Sunriver, Tumalo, La Pine), find new $500K+ FSBO listings, push each one into FollowUp Boss as a hot seller lead with full property context, and alert Matt by email.

FSBO sellers are by definition unrepresented, listed publicly, and at a moment of high signal. Catching them within the first 24–48 hours of going up gives the brokerage a real shot at the listing appointment before the seller burns out on showings, mispricing, or paperwork.

---

## 2. Why Zillow as the Phase 1 source

| Source | Coverage CO | API access | Integration cost | Decision |
|---|---|---|---|---|
| **Zillow FSBO** | Highest single-source coverage. Public FSBO filter URL per city. | No first-party API. Apify actor `maxcopell~zillow-scraper` is mature + URL-driven. | Low. We already pay for Apify (DIAL scrape, competitor recon). | **PRIMARY** |
| FSBO.com | Lower volume. Canonical FSBO site but Central Oregon coverage is thin. | No API. Would need a custom scraper. | Medium. | Phase 2. |
| ForSaleByOwner.com | Very low volume in CO. | No API. | Medium. | Phase 2. |
| Craigslist Bend `reo` (real estate by owner) | Moderate volume. RSS feed available. | RSS — free, native. | Low. | Phase 2 — listings are often duplicates of Zillow. |
| Facebook Marketplace | Unknown but plausibly moderate. | No API. Bot detection aggressive. | High. | Not feasible. |

Zillow alone catches the majority of high-intent CO FSBO inventory. The other sources get added when the Phase 1 capture rate plateaus.

---

## 3. Filters (locked, match the expired cron exactly per Matt's 2026-05-19 directive)

- **Service-area cities:** Bend, Redmond, Sisters, Sunriver, Tumalo, La Pine. Madras + Prineville EXCLUDED.
- **Price floor:** ListPrice > $500,000.
- **Property type:** SFR + Townhouse + Manufactured. Condos, Land, Multifamily, Lots are filtered out client-side after the scrape.

Source-of-truth constants: `FSBO_SERVICE_AREA_CITIES` + `FSBO_MIN_LIST_PRICE` at the top of `lib/fsbo-detector.ts`.

---

## 4. Pipeline per fire (max 25 new listings/run)

```
Hour T:20:
  ↓
  Apify Zillow scrape per city (sequential, 6 runs)
    Input: Zillow FSBO URL per city
    Actor: maxcopell~zillow-scraper
    Output: parsed FsboListing[] per city
  ↓
  Combine + dedupe by fsbo_url across all cities
  ↓
  Filter SFR/Townhouse/Manufactured · ListPrice > $500K · City in service area
  ↓
  Dedupe against public.fsbo_listings.fsbo_url
  ↓
  Touch last_seen_at on already-seen URLs (so we can later flag "gone")
  ↓
  For each unseen listing (max 25/run):
    │
    │  Owner resolution:
    │    If Zillow item already carries name + phone/email → status=direct-from-listing
    │    Else → run lookupOwnerForExpiredListing()
    │           (FUB address match → Deschutes DIAL → Tracerfy → Apify skip-trace)
    │
    │  FUB person resolution:
    │    Real owner data → create real FUB person via sendEvent({type:'Seller Inquiry'})
    │    No contact at all → placeholder FUB person keyed on fsbo_url
    │
    │  Apply tags:
    │    Plain words: FSBO, <City>
    │    Namespaced: audience:seller, seller:hot, seller:fsbo-untouched,
    │                intent:fsbo, source:fsbo-cron, broker:matt,
    │                city:<slug>, owner-lookup:{pending|resolved}
    │
    │  Custom fields:
    │    customSellerPropertyAddress (full address)
    │    customLeadTier=hot
    │    customMoveTimeline=ready-now
    │
    │  Note: full FSBO context (price, beds/baths/sqft/lot, year built,
    │        days listed, URL, owner contact, approach guidance)
    │
    │  Task: 60-min Call task assigned to Matt
    │
    │  Email: Resend alert to MATT_ALERT_EMAIL with full context
    │
    │  Upsert into public.fsbo_listings (audit + dedupe)
  ↓
  Return JSON with stats + sample for cron monitoring
```

Cron entry point: `app/api/cron/detect-fsbo-listings/route.ts`
Scrape + parse logic: `lib/fsbo-detector.ts`
Alert template: `lib/fsbo-alert.ts`
Owner-lookup fallback chain: `lib/expired-owner-lookup.ts` (shared with expired cron)
Table: `public.fsbo_listings` (migration `20260521161036_fsbo_listings.sql`)

---

## 5. Canonical tag schema (applied to every FSBO lead)

| Tag | Purpose |
|---|---|
| `FSBO` | Plain word — matches Matt's existing manual filter convention. |
| `<City>` (Bend, Redmond, etc.) | Plain word — matches manual filter convention. |
| `audience:seller` | Routes the lead into FUB Action Plan 69 via existing automation rule. |
| `seller:hot` | Tier — FSBOs are by definition at-market high-intent. |
| `seller:fsbo-untouched` | **Holding tag** — removing it triggers Plan 72 (the FSBO outreach plan, future). Until Matt removes it manually after first contact, the lead stays in the bucket. |
| `intent:fsbo` | Distinguishes FSBOs from expired-listings + LP-submitted sellers. |
| `source:fsbo-cron` | Source attribution. |
| `broker:matt` | Owner. Default to Matt per 2026-05-17 directive. |
| `city:<slug>` | Spatial filterability (matches the geocode tagger's convention). |
| `owner-lookup:{pending\|resolved}` | Did we get contact info or not. Pending = manual skiptrace needed. |

The plain-word + namespaced split mirrors what Matt already does manually in the FUB UI. Plain words show up in his existing smart-list filters; namespaced tags drive automation.

---

## 6. FUB sendEvent payload (every FSBO)

```js
sendEvent({
  type: 'Seller Inquiry',
  source: 'FSBO Cron',
  sourceUrl: <zillow listing url>,
  pageTitle: 'FSBO Listing — auto-detected',
  person: {
    firstName: <owner name or 'Owner of 123 Main St'>,
    lastName: <owner last name or '(Bend)'>,
    emails: [{ value: <real email or synthetic fsbo-<zpid>@placeholder.ryan-realty.com> }],
    phones: [{ value: <owner phone if known> }]
  },
  message: 'Auto-detected FSBO listing at <full address> (zillow). Owner source: <source>.',
  brokerAttribution: { brokerSlug: 'matt' }
})
```

`assignedUserId` is set to Matt's id (1) by default (per the 2026-05-17 "all leads to Matt" directive). When per-broker FSBO ads land, the agent-attribution cookie path applies the same way it does for LP forms.

---

## 7. Owner-lookup resolution priority

Most Zillow FSBO listings carry the seller's name + phone (and sometimes email) on the detail page — Zillow exposes them under `listingProvidedBy` / `attributionInfo`. When the Apify actor surfaces those, status = `direct-from-listing` and we skip the skiptrace chain.

When the listing is anonymized (Zillow's "Contact agent" wrapper for some markets), we fall through to the shared owner-lookup chain:

1. FUB internal address match (Strategy 1 in `lib/expired-owner-lookup.ts`)
2. Deschutes DIAL public-records scrape (Strategy 2)
3. Tracerfy skiptrace (Strategy 3)
4. Apify property-owner skip-trace (Strategy 4)
5. Pending — placeholder FUB person, alert sent, manual lookup queued

The DNC scrub still applies to any phone we land on. Cold-calling a DNC-flagged number = TCPA risk.

---

## 8. Schedule + budget

- **Cadence:** `20 * * * *` — every hour at `:20` past the hour. Staggered from the expired cron at `:00` to spread Apify load.
- **Volume estimate:** 0–3 new FSBO listings/day across the 6 cities at the $500K+ floor. Most days will see zero new inventory and the cron returns immediately after dedupe.
- **Cost ceiling per new FSBO:**
  - Apify Zillow scrape — runs every hour regardless. ~$0.05/city/run = ~$0.30/run = ~$7.20/day = ~$220/month for the recurring scrape.
  - Per-new-FSBO owner enrichment — only if direct contact wasn't on the page. ~$0.10 Tracerfy. Usually $0 because Zillow exposes the contact.
  - Resend email — free under our existing quota.
- **Tradeoff:** $220/month in scrape cost vs. potentially one captured FSBO listing per quarter. One Bend FSBO at $750K = ~$22,500 GCI at 3%. Math is overwhelming.

The cost can be cut by 6x if we batch all 6 cities into a single Zillow query (the actor supports multi-URL input). Phase 2 optimization once we verify the per-city extraction works cleanly in production.

---

## 9. Audit table — `public.fsbo_listings`

PK: `fsbo_url` (canonical detail-page URL with query string stripped).
Secondary id: `fsbo_unique_id` (Zillow zpid when available; future sources will use their own id).
Status: `active` while the listing is being scraped each hour; transitions to `gone` when a future sweep notices it's no longer in the FSBO feed (TODO — Phase 2).

Same shape as `public.expired_listings` minus the MLS-specific columns (no list_agent, no original_list_price for FSBOs, no MLS#). Adds FSBO-specific columns: `fsbo_source`, `fsbo_unique_id`, `description`, `last_seen_at`, `status`.

---

## 10. Brand voice compliance (alert email + FUB note)

Both the Resend alert template and the FUB note copy were scanned against `marketing_brain_skills/brand-voice/voice_guidelines.md`:

- No em-dashes in body prose (em-dashes appear only as the "no data" placeholder, which is allowed per CLAUDE.md §0).
- No exclamation marks.
- No banned real-estate clichés (stunning, nestled, gorgeous, etc.).
- No marketing slop (premier, white-glove, etc.).
- "You/your" used for direct reader address where present.
- Approach guidance in the FUB note frames the FSBO conversation as the listing-appointment conversation (pricing, exposure, time), not as a critique of the seller's decision. Per voice §4.7 — never pander, never editorialize.

---

## 11. Files added

```
app/api/cron/detect-fsbo-listings/route.ts    — cron entry point (HTTP GET, Bearer auth)
lib/fsbo-detector.ts                           — Apify scrape + parse + dedupe
lib/fsbo-alert.ts                              — Resend email alert template
supabase/migrations/20260521161036_fsbo_listings.sql — public.fsbo_listings table
vercel.json                                    — cron registration at 20 * * * *
docs/FUB_FSBO_WORKFLOW.md                      — this doc
```

No changes to existing files except `vercel.json` (one new cron entry).

---

## 12. Deployment checklist (before flipping the cron on)

- [ ] Apply migration `20260521161036_fsbo_listings.sql` to hosted Supabase.
- [ ] Verify `APIFY_API_TOKEN` is set in Vercel env (already present per `lib/marketing-brain/competitor-recon.ts` usage).
- [ ] Verify `FOLLOWUPBOSS_API_KEY` is set in Vercel env.
- [ ] Verify `RESEND_API_KEY` + `RESEND_FROM` are set.
- [ ] Verify `CRON_SECRET` is set.
- [ ] Run one test fire manually: `curl -H "Authorization: Bearer $CRON_SECRET" https://ryan-realty.com/api/cron/detect-fsbo-listings`.
- [ ] Confirm the returned JSON shows `scanned_total > 0` for at least one city.
- [ ] Confirm at least one new FSBO produces a real FUB person + tag + note + task + alert email.
- [ ] Confirm the `fsbo_listings` row is upserted with `owner_lookup_status` and `alert_sent_at`.

---

## 13. Phase 2 backlog

- Add Craigslist Bend `reo` RSS as a second source (free, native).
- Add a "gone" sweep — daily, mark listings as `status='gone'` if `last_seen_at` is older than 48h.
- Build FUB Action Plan 72 (FSBO outreach) — triggers on `seller:fsbo-untouched` tag removal.
- Wire the agent-attribution cookie path so a per-broker FSBO ad (`?agent=rebecca`) auto-routes to that broker instead of Matt.
- Add a manual re-fire endpoint mirroring `app/api/admin/expired-listing-lookup/route.ts` for FSBO entries.
- Track conversion: FSBO detected → meeting set → listing signed.

---

*Mirror of the expired-listings architecture, applied to a different signal source.*
