# FUB Round 2 Optimization — Complete (2026-05-17)

**Status:** Phase A + Phase B done. Phase C (Buyer Master Workflow) intentionally deferred for explicit approval given its scope.
**Audit:** `docs/FUB_OPTIMIZATION_AUDIT_2026-05-17.md`

---

## What shipped

### Phase A — Live data cleanup (executed against production FUB)

| # | What | Before | After |
|---|---|---:|---:|
| A.2 | Test/junk records deleted | 14 | 0 |
| A.3 | Bounced + Unsubscribed records hard-blocked with `do_not_email` + `compliance:hard-stop` | 0 enforcement | **694 records** protected |
| A.4 | Phone-placeholder cleanup (5+ records sharing one Bend area code) | 197 false dupes | **197 wiped** |
| A.6 | Site source variants normalized to `Ryan-Realty.com` via `sourceId` | 4 variants live | **19 records consolidated** |
| A.7 | Legacy `Buyer`-tagged records get canonical `audience:buyer` | 0 canonical | **37 backfilled** |

### Phase A.1 + A.5 — Found audit errors, no action needed

- **A.1 (custom field wiring):** the LP form already writes 4 SL custom fields. The audit's "0% population" was a GET bug — custom fields don't return from `/v1/people` without explicit `fields=` param. Real population: 0-39% across the 25 fields.
- **A.5 (delete dead custom fields):** based on the wrong 0% number. Re-audited with `fields=` and most fields have real data (`customMarketValue` 39%, `customPurchaseDate` 36%, `customHomeAnniversary` 35%, etc.). All 25 fields preserved.

### Phase B — Universal canonical lead tagger

**`lib/canonical-lead-tagger.ts` (new, 165 lines):**

One helper that wraps every lead-creation path with the canonical schema:
- `audience:seller` or `audience:buyer`
- `<audience>:<tier>` — seller:hot / buyer:warm / etc.
- `source:<path>` — source:contact-form / source:fb-ads-buyer / etc.
- `broker:<slug>` — round-robin between Matt + Rebecca via `marketing_assignments` Supabase ledger
- Idempotent, never blocks, never throws

Wired into:
- `app/contact/actions.ts` — every contact form submission post-processes through `canonicallyTagLead()` after `sendEvent()`. `inferAudience()` decides seller vs buyer from inquiry-type keywords.
- `app/api/meta/lead-webhook/route.ts` — replaced legacy tier tags (`hot-buyer`, `warm-seller`, `auto:seller-seq:new`, `nurture-only`) with canonical schema (`buyer:hot`, `seller:warm`, `buyer:nurture`, etc.). Added `source:fb-ads-seller` / `source:fb-ads-buyer` attribution.
- `app/lp/seller-home-value/actions.ts` — already canonical from earlier work.

**Coverage:** the 3 highest-volume lead-creation paths are now canonical. The other 10 (Calendly, homepage CTA, IDX, blog email, etc.) can be migrated as they're touched — adding the wrap is a 2-line change per file.

### Phase C — Buyer Workflow (deferred — needs explicit go/no-go)

The buyer workflow mirror of the seller workflow is the right next move, but it's 6 hours of work + FUB UI configuration. Spec ready when you greenlight:

- New action plan id 70 in FUB UI: `Buyer Lead — Master Workflow`
- 5 email templates (BL-01 through BL-05) — different cadence (T+0, T+30min, T+2h, T+24h, T+7d) since buyers need faster matching to listings
- New FUB Automation rule: tag `audience:buyer` → enroll in action plan 70
- Buyer LP at `/lp/buyer-listing-alerts` (or similar)
- Round-robin assignment uses the same `marketing_assignments` ledger

---

## Cumulative state after Round 1 + Round 2

| Surface | Original | Now |
|---|---:|---:|
| Active action plans | 67 | **1** (Seller Lead — Master Workflow) |
| Visible templates | 669 | **108** |
| Custom fields | 22 | **25** (6 new SL + 3 KTS deleted) |
| Tags in use | 158 | **~110** + canonical schema layer (geo, audience, owner, tenure) |
| Tag canonicalization | 11 seller variants | **3,498 `audience:seller`** records on canonical schema |
| Geo tags | 0 | **8,695 records** carry `city:`, `neighborhood:`, `owner:`, `geo:`, `equity:`, `tenure:` |
| Geocoded leads (fub_person_geo) | 0 | **5 from smoke test** (full 3,266 owner-occupied batch via script 17b ready to run) |
| Compliance protection | 0 records | **694 hard-blocked** for email automation |
| Phone-dupe noise | 652 dupe groups | **197 placeholders wiped**, signal restored |
| Lead records | 13,163 | **13,143** (20 test/junk total deleted across both rounds) |

---

## What still needs your hands (FUB UI, not API)

1. **Build the FUB Automation rule** (one-time, 2 min):
   - Settings → Automations → New Automation
   - When tag `audience:seller` added → Enroll in action plan `Seller Lead — Master Workflow`

2. **Build the FUB Automation for compliance** (one-time, 5 min):
   - When tag `do_not_email` added → set emailStatus = Unsubscribed (belt+suspenders)
   - On action plan id 69 → Audience filter → EXCLUDE tags `do_not_email`, `compliance:hard-stop`, `Bounced`, `Unsubscribed`

3. **Build 4 curated smart lists** (10 min — list specs in `docs/FUB_SMART_LISTS_STARTER_PACK.md`)

4. **Greenlight the Buyer Workflow** — say "build the buyer workflow" and I'll execute Phase C (~3 hours wall time)

5. **Optional: register a `peopleTagsUpdated` webhook** (5 min in FUB UI) — would cut the 15-min pause-on-reply cron lag to seconds

---

## Files shipped this round

| Path | Purpose |
|---|---|
| `lib/canonical-lead-tagger.ts` | universal post-process helper |
| `app/contact/actions.ts` | wired with canonical tagger |
| `app/api/meta/lead-webhook/route.ts` | canonical tier + source tags |
| `.tmp_env/fub-setup/18-delete-test-records-round2.mjs` | 14 test deletes |
| `.tmp_env/fub-setup/19-compliance-sweep.mjs` | 694 records hard-blocked |
| `.tmp_env/fub-setup/20-phone-placeholder-cleanup.mjs` | 197 records phone-wiped |
| `.tmp_env/fub-setup/21-normalize-source-and-tag-buyers.mjs` | 19 source-fixed + 37 buyer-backfilled |
| `docs/FUB_OPTIMIZATION_AUDIT_2026-05-17.md` | the audit that drove this work |
| `docs/FUB_ROUND2_COMPLETE_2026-05-17.md` | this doc |

---

## One bug fix worth noting

The Round 2 audit reported "all 25 custom fields are 0% populated." That was wrong — the auditor's GET on `/v1/people` didn't include `fields=customXxx`, and FUB doesn't return custom fields by default. Real population is 0-39%. Caught and corrected.

Same class of bug we caught in the v1 normalize script: silent skips when an API call doesn't return the expected shape. The lesson is encoded in `.tmp_env/fub-setup/16b-normalize-geo-tags-v2.mjs` retry pattern.

---

*End of round 2. Ready for Phase C on your word.*
