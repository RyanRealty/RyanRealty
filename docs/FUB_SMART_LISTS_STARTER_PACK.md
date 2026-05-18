# FUB Smart Lists — Starter Pack (post geo-tagging)

**Status:** Ready to build in FUB UI once the geo-tagging migration completes.
**Built by:** docs/FUB_GEO_TAGGING_2026-05-17.md pipeline (script 16 + 17)

Each smart list is a one-click filter in FUB. Each can be exported to CSV for a Facebook custom-audience upload to run hyper-targeted ad campaigns.

---

## ⚠️ MANDATORY EXCLUDE on every smart list — never message realtors

**Per Matt's 2026-05-17 directive:** every smart list MUST exclude:

- Tag `Realtor` (case-insensitive — covers `Realtor`, `realtor`, etc.)
- Tag `Real Estate`
- Tag `industry:realtor` (canonical)
- Tag `compliance:hard-stop`
- Tag `do_not_email`
- Tag `Bounced`
- Tag `Unsubscribed`
- Stage `Real Estate Agent`

Without these excludes, a single smart-list-driven email blast would hit 2,316+ industry contacts (fellow realtors, brokers, agents) and 694 hard-blocked records. Sender reputation destroyed in one click.

**FUB UI filter pattern:** every smart list below should add this exclude group:

```
WHERE [your filter conditions] AND
      NOT tag CONTAINS "Realtor" AND
      NOT tag CONTAINS "Real Estate" AND
      NOT tag CONTAINS "industry:realtor" AND
      NOT tag CONTAINS "compliance:hard-stop" AND
      NOT tag CONTAINS "do_not_email" AND
      NOT tag CONTAINS "Bounced" AND
      NOT tag CONTAINS "Unsubscribed" AND
      NOT stage = "Real Estate Agent"
```

The code-side compliance gate in `lib/canonical-lead-tagger.ts` enforces the same exclusions when the LP form runs, so new leads with these tags never enter the workflow in the first place. The smart-list filter is the second layer for when Matt manually exports a list for an ad campaign or email blast.

---

---

## How to build each one

**FUB UI → Smart Lists → New Smart List**
- Name it exactly as shown below
- Add the filters in the "When ALL of these match" section
- Save + share with Rebecca

---

## 1. By neighborhood — primary targeting pool

### Northwest Crossing (NWX) owners
- Filter: tag IS `neighborhood:northwest-crossing`
- Expected size: ~471 leads
- Use: NWX market-update emails, NWX-specific FB lookalike audience

### River West owners
- Filter: tag IS `neighborhood:bend-river-west`
- Expected size: ~448 leads
- Use: River West outreach, recently-sold case studies

### Sunriver owners
- Filter: tag IS `neighborhood:sunriver`
- Expected size: ~443 leads
- Use: Sunriver listing alerts, vacation-home seasonal touches

### Crosswater owners
- Filter: tag IS `neighborhood:crosswater`
- Expected size: ~40 leads
- Use: Crosswater Phase 3 prospects, premium resort-community targeting

### Tetherow owners
- Filter: tag IS `neighborhood:tetherow`
- Expected size: ~0 today (requires Phase 2 geocoding to populate)
- Use: Tetherow-specific market intel, golf-community outreach

### Old Bend owners
- Filter: tag IS `neighborhood:bend-old-bend`
- Use: Long-term residents, downtown / historic district outreach

### Black Butte Ranch owners
- Filter: tag IS `neighborhood:black-butte-ranch`
- Expected size: ~3
- Use: BBR resort-community list

---

## 2. By city — broader pools

### All Bend owners
- Filter: tag IS `city:bend`
- Expected size: ~6,154 leads
- Use: Citywide market reports, broad seasonal campaigns

### All Redmond owners
- Filter: tag IS `city:redmond`
- Expected size: ~1,381 leads

### All Sisters owners
- Filter: tag IS `city:sisters`
- Expected size: ~259

### Prineville / Madras / La Pine owners
- Filter: tag IS `city:prineville` OR `city:madras` OR `city:la-pine`
- Use: Outlying-city seasonal outreach

---

## 3. By owner type — intent signals

### Absentee owners — Bend
- Filter: tag IS `owner:absentee` AND `city:bend`
- Expected size: ~1,800 leads (large pool)
- Use: Rental-property selling decisions, "convert your rental" angle

### Owner-occupied — high equity — Bend
- Filter: tag IS `owner:occupied` AND `equity:high` AND `city:bend`
- Expected size: ~2,500 leads
- Use: "Cash out and upgrade" / "downsize and pocket equity" angles

### Out-of-state Sunriver owners
- Filter: tag IS `neighborhood:sunriver` AND `geo:out-of-state`
- Use: Vacation-home conversion targeting

### In-state out-of-area Bend property owners
- Filter: tag IS `city:bend` AND `geo:out-of-area`
- Expected size: ~461 leads
- Use: Portland / Eugene investors who own in Bend

---

## 4. By seller intent — workflow active pool

### Sellers — new today (your existing list)
- Filter: tag IS `audience:seller` AND created last 24 hours
- Use: Daily 9 AM check-in

### Sellers — hot, untouched
- Filter: tag IS `seller:hot` AND last broker activity > 4 hours ago
- Use: Hot lead escalation

### Sellers — warm in NWX
- Filter: tag IS `seller:warm` AND tag IS `neighborhood:northwest-crossing`
- Use: NWX-specific warm seller follow-up

### Sellers — nurture in Sunriver
- Filter: tag IS `seller:nurture` AND tag IS `neighborhood:sunriver`
- Use: Long-fuse Sunriver outreach

---

## 5. Combined — high-value targets

### NWX absentee owners with high equity
- Filter: `neighborhood:northwest-crossing` + `owner:absentee` + `equity:high`
- Use: Premier rental-conversion candidates

### Crosswater owners with recent purchases
- Filter: `neighborhood:crosswater` + `tenure:recent`
- Use: Recent buyers who might already be considering trade-up

### Sunriver long-term out-of-state owners
- Filter: `neighborhood:sunriver` + `tenure:long-term` + `geo:out-of-state`
- Use: Long-held vacation properties — high cap-gain awareness

### Bend owners long-term — over 5 years
- Filter: `city:bend` + `tenure:long-term`
- Expected size: ~1,937
- Use: "Time to consider selling" angles, market-update emails

---

## How to use a list for a Facebook custom audience

1. Open the smart list in FUB
2. Top-right → Export → CSV (email + phone columns)
3. Facebook Ads Manager → Audiences → Create Audience → Customer List
4. Upload the CSV
5. Facebook matches ~50-70% of contacts to active accounts
6. Build a lookalike audience from the matched ones (1% similarity = most precise)
7. Target the lookalike + the original list with neighborhood-specific creative

Cost example: a "NWX absentee owners" lookalike → 471 source contacts → ~300-400 FB matches → ~5,000-15,000 lookalike audience size in Central Oregon. Tightly targeted, low CPM.

---

## How to use a list for direct outreach

1. Smart list → Export CSV with all available fields (name, email, phone, address)
2. Decide the outreach type:
   - **Email blast** (handled by FUB action plan or `ops-email-send`)
   - **SMS blast** (FUB SMS bulk send — be cautious with compliance, ≤ 1-2 SMS per 30 day window per the seller workflow doc)
   - **Direct mail** (export to a print service like Lob or PostGrid)
   - **Door knocking** (broker walking the neighborhood with the list)

For email/SMS, route through the existing seller workflow templates (SL-01 through SL-05) or build a new one in `marketing_brain_skills/producers/ops-fub-crm/templates/`.

---

## Maintenance

The geo tags are applied by:
- **Backfill** (one-time): scripts 16 + 17 in `.tmp_env/fub-setup/`
- **Forward** (continuous): `app/lp/seller-home-value/actions.ts` calls `geocodeAndTagLead()` on every new LP submission

If you add new neighborhoods or subdivisions to `public.boundaries`, just re-run script 17 in DRY mode first to see what would change, then live to apply.

---

*Once the Phase 1 + Phase 2 backfill completes, all the lists above become instantly populated. Build the ones you'll actually use first; the rest can wait.*
