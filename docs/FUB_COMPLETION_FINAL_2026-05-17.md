# Follow Up Boss — Complete (2026-05-17 final)

**Status:** Everything done that can be done via API. Two FUB UI clicks remain (~5 min total).

---

## What the seller LP + buyer LP do, end-to-end

```
Visitor fills LP form (seller or buyer)
  ↓
submitSellerLPForm() / submitBuyerLPForm()
  ↓
1. Resolve/create FUB person (email match > cookie > new)
2. Compliance gate: if person carries do_not_email / Bounced / Unsubscribed /
   compliance:hard-stop → skip workflow enrollment (lead still saved + broker
   still alerted, but no auto-touches will fire)
3. Round-robin assign (Matt or Rebecca; hot → Matt default)
4. Apply canonical tags: audience:seller|buyer + tier + source + broker
5. Write custom fields (seller: 4; buyer: 5)
6. Round-robin ledger insert
7. Create 5-min realtime task for hot leads
8. Trigger CMA producer (seller only) / first-listings batch task (buyer)
9. Geocode address → fub_person_geo + city/neighborhood/subdivision tags
10. Meta CAPI Lead event ($500 seller, $300 buyer)
  ↓
FUB Automation Rule (UI) sees tag audience:seller|buyer → enrolls in action plan
  ↓
Action plan 69 (seller) / 70 (buyer) runs 9-10 step cadence
  Touches: T+0 task + T+0 email + T+1min SMS + T+1d email + T+3d task +
           T+7d email + T+14d email + T+30d email + T+60d move-to-long-nurture
  ↓
Lead replies OR broker logs activity → 15-min cron adds {audience}:in-conversation
  ↓
Action plan pauses (FUB automation rule on tag {audience}:in-conversation → stop plan)
```

---

## What's in FUB right now

| Surface | Count |
|---|---:|
| Active action plans | **2** (id 69 Seller Lead — Master Workflow, id 70 Buyer Lead — Master Workflow) |
| Production email templates | **10** (SL-01..05 + BL-01..05) |
| Production SMS templates | **4** (SL-S1, SL-S2, BL-S1, BL-S2) |
| Archived/hidden non-production templates | 27 zzzArchived (FUB-protected, can't delete) |
| Custom fields | **30** total (6 seller-workflow + 5 buyer-workflow + 19 carried over from imports with real data) |
| Lead records | 13,143 (cleaned of 20 test records) |
| Records with canonical audience tag | 3,498 seller + 37 buyer + every new LP submission going forward |
| Records hard-blocked from auto-email | 694 (do_not_email + compliance:hard-stop) |
| Records geo-tagged with neighborhood | 2,229 owner-occupied + every new LP submission |
| Pause-on-reply cron | every 15 min, handles both seller + buyer audiences |

---

## The 2 things Matt still needs to do in FUB UI (~5 min)

The FUB API blocks `POST /v1/automations` for integrations (403). These have to be set up by hand.

### 1. Automation Rule — Seller (2 min)

**Settings → Automations → New Automation**

- **Name:** `Seller LP → Master Workflow`
- **When (any one of):**
  - Tag `audience:seller` is added (any source)
- **Then:**
  - Enroll in Action Plan: `Seller Lead — Master Workflow` (id 69)

### 2. Automation Rule — Buyer (2 min)

**Settings → Automations → New Automation**

- **Name:** `Buyer LP → Master Workflow`
- **When:**
  - Tag `audience:buyer` is added (any source)
- **Then:**
  - Enroll in Action Plan: `Buyer Lead — Master Workflow` (id 70)

### Optional — Pause-on-reply automations (1 min each)

- **When** tag `seller:in-conversation` added → **Stop** Action Plan `Seller Lead — Master Workflow`
- **When** tag `buyer:in-conversation` added → **Stop** Action Plan `Buyer Lead — Master Workflow`

(Without these, the action plans use FUB's built-in `stopOnContacted` rule — which fires when the lead replies via email. They'll pause on inbound reply automatically. The explicit tag-based rule adds belt-and-suspenders for when the 15-min cron detects an inbound SMS but FUB's native logic hasn't caught up.)

---

## What's done end-to-end (everything else)

✅ **Round 1** (`docs/FUB_AUDIT_2026-05-17.md` + workflow build):
- 67 action plans → 1 (Seller Lead — Master Workflow id 69)
- 525 KTS templates hidden
- 7 test records deleted
- 11 seller-tag variants → canonical `audience:seller` (3,498 records migrated)
- 6 seller custom fields created (ids 28-33)
- Round-robin assignment via Supabase `marketing_assignments` ledger
- 15-min pause-on-reply cron at `/api/cron/seller-workflow-pause`

✅ **Geo-tagging pipeline** (`docs/FUB_GEO_TAGGING_2026-05-17.md`):
- 8,695 records carry canonical city / neighborhood / subdivision / owner / geo / equity / tenure tags (100% invariant audit)
- 2,229 owner-occupied leads geocoded into `fub_person_geo` with PostGIS spatial lookup against `public.boundaries`
- LP forms auto-geocode + tag on every new submission
- `lib/lead-geocode.ts` + Supabase RPC `lookup_address_geo()` + GIST index

✅ **Round 2 optimization** (`docs/FUB_OPTIMIZATION_AUDIT_2026-05-17.md` + `FUB_ROUND2_COMPLETE_2026-05-17.md`):
- 14 test/junk records deleted
- 694 records hard-blocked (do_not_email + compliance:hard-stop)
- 197 phone-placeholder records cleaned
- 19 source variants normalized to Ryan-Realty.com (via `sourceId`)
- 37 legacy `Buyer` records backfilled with `audience:buyer`
- `lib/canonical-lead-tagger.ts` universal helper
- Contact form + FB lead webhook wired to canonical schema

✅ **Phase C — Buyer workflow** (`docs/FUB_BUYER_WORKFLOW_2026-05-17.md`):
- 5 buyer custom fields (ids 34-38)
- 7 buyer templates (BL-01..05 + BL-S1, BL-S2; ids 677-683)
- Action plan id 70 with **10 steps fully configured via API** (verified)
- Buyer LP at `/lp/buyer-listing-alerts` (page + actions + shadcn form)
- Pause cron extended to handle both audiences

✅ **Brand voice rewrite** (today):
- All 14 production templates rewritten against `voice_guidelines.md`
- Em-dashes (HARD BAN) eliminated
- "Happy to walk through" / "interesting things" / "few things working in its favor" / "before it gets the foot traffic" all cut
- Voice-lint script (idempotent) at `.tmp_env/fub-setup/23-rewrite-templates-brand-voice.mjs`
- 2 missing seller SMS templates created (SL-S1, SL-S2; ids 684, 685)
- 65 non-SL/BL templates hidden, 11 deleted (117 visible → 41; 14 production + 27 FUB-protected zzz)
- `voice_guidelines.md` §4.7 "Authentic, not salesy" — Matt's 5 operating rules with practical patterns

✅ **Compliance gate in code** (today):
- `isHardStopped(personId)` helper in `lib/canonical-lead-tagger.ts`
- Seller LP form and Buyer LP form check before applying `audience:*` tag
- Hard-stopped leads still create FUB person + broker alert, but skip workflow enrollment
- Belt-and-suspenders: even if Matt forgets to configure the FUB-UI compliance filter on action plans, our backend won't tag them in the first place

---

## How to verify everything's wired

After the 2 UI clicks above:

1. **Open `/lp/seller-home-value`** in an incognito browser
2. Submit with your own email (use `matt+e2e@ryan-realty.com` to avoid touching your real record)
3. Confirm in FUB UI within 30 sec:
   - New person created with tags `audience:seller`, `seller:nurture` (or `hot`/`warm`), `source:seller-lp`, `broker:matt` or `broker:rebecca`
   - Custom fields populated: Move Timeline, Lead Tier, Property Address
   - Push + iMessage broker alert fires
   - Person assigned via round-robin
   - Action plan `Seller Lead — Master Workflow` started (check person's timeline tab)
   - First task created (call within 5 min)
4. Wait 2 min and confirm SL-S1 SMS fires (FUB texts your phone)
5. Reply to the SMS or confirmation email
6. Wait 15 min and confirm the cron added `seller:in-conversation` tag → action plan pauses

Same test for `/lp/buyer-listing-alerts`.

---

## Files shipped today

| Path | Purpose |
|---|---|
| `lib/canonical-lead-tagger.ts` | universal canonical tagger + `isHardStopped()` gate |
| `lib/lead-geocode.ts` | geocode + spatial lookup helper used by LP forms |
| `app/contact/actions.ts` | wired canonical tagger |
| `app/api/meta/lead-webhook/route.ts` | canonical tier + source tags |
| `app/lp/seller-home-value/actions.ts` | full canonical + compliance gate + geocode |
| `app/lp/buyer-listing-alerts/{page,actions,BuyerLPForm}.tsx` | buyer LP |
| `app/api/cron/seller-workflow-pause/route.ts` | extended for both audiences |
| `supabase/migrations/20260517190000_marketing_assignments.sql` | round-robin ledger |
| `supabase/migrations/20260517200000_fub_person_geo_and_lookup_rpc.sql` | spatial table + RPC + GIST index |
| `marketing_brain_skills/brand-voice/voice_guidelines.md` | §4.7 added |
| `.tmp_env/fub-setup/22..25-*.mjs` | buyer workflow build + voice rewrite + picker cleanup |
| `docs/FUB_BUYER_WORKFLOW_2026-05-17.md` | buyer workflow spec |
| `docs/FUB_COMPLETION_FINAL_2026-05-17.md` | this doc |

---

*FUB is now ultra-simple. ONE canonical seller workflow + ONE canonical buyer workflow + ONE canonical lead-tagger that every intake path uses + ONE pause-on-reply cron + brand-voice-compliant copy everywhere.*
