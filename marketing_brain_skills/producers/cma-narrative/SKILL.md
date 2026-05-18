---
name: cma-narrative
description: >
  Generates the long-form narrative cover letter and per-section commentary text
  that lives inside a Ryan Realty CMA HTML document. Delegated by the cma producer
  (marketing_brain_skills/producers/cma/SKILL.md). Produces 600-1000 words of
  voice-validated prose that slots into the existing CMA HTML template.
action_types:
  - content:cma_narrative
output_type: text
output_type: document
target_platforms: ['email']
asset_destination: "public/cmas/<slug>/"
auto_inputs: ['mls_listing_record', 'comparable_solds', 'market_stats_cache']
required_inputs: ['subject_address or mls_id', 'broker_slug']
optional_inputs: ['comp_count (default 6)', 'include_pricing_strategy (default true)']
estimated_runtime_min: 25
cost_usd_estimate: $0
thumbnail_uri: public/cmas/cma-21042-robin/cma.html
example_outputs: []
    label: Tumalo Reservoir - CMA exemplar
    surface: print

---

# CMA Narrative Producer

**Scope:** Long-form narrative prose for a Comparative Market Analysis. This producer is
always delegated by the `cma` producer - it is never invoked directly by the brain's
weekly cycle. It receives a structured context object from the `cma` producer (subject
data, comp set, pricing methodology output, broker identity) and returns finished prose
for four narrative sections of the CMA HTML: (1) cover letter, (2) subject property
narrative, (3) pricing rationale, and (4) disclosure statement. Total prose: 600-1000
words, voice-validated, no banned words, no em-dashes, no semicolons.

**Status:** Canonical
**Locked:** 2026-05-17
**Parent producer:** `marketing_brain_skills/producers/cma/SKILL.md`
**Exemplar CMA:** `public/cmas/cma-21042-robin/cma.html` (reference for prose placement)
**Canonical exemplar:** `public/cmas/cma-19496-tumalo-reservoir/cma.html` (current rules)

---

## 1. Scope

### In scope

- Cover letter (200-300 words): addressed to the client by first name, written in Matt's
  voice (or the signing broker's voice), framing the purpose of the analysis and the
  market context
- Subject property narrative (150-250 words): factual description of the subject property
  that sets up the comp analysis without promotional language
- Pricing rationale and why this list price (150-300 words): explains the methodology,
  the outlier comps if any, and the reasoning behind the recommended list price range
- Disclosure statement (100-150 words): standard Oregon disclaimer that the CMA is not a
  USPAP appraisal, per CLAUDE.md §0 data accuracy mandate

### Out of scope

- The CMA HTML structure itself (that is the cma producer's responsibility)
- Comp selection and pricing methodology calculation (cma producer handles these)
- The comp flyer text or per-comp remarks (those use MLS public_remarks directly)
- Client email delivery (that is ops-email-send after Matt's approval)

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:cma_narrative` | Full context object from cma producer (see payload schema) | Not emitted by the brain directly; delegated by cma producer after comp set is assembled |

### Payload schema

```typescript
interface CMANarrativePayload {
  // Subject property (all fields from cma producer's Step 3):
  subject_address: string          // '21042 Robin Ave, Bend, OR 97703'
  subject_city: string
  subject_subdivision: string
  subject_beds: number
  subject_baths: number
  subject_sqft: number
  subject_lot_acres?: number
  subject_year_built: number
  subject_garage_spaces?: number
  subject_listing_history?: string // brief summary of MLS listing history
  seller_improvements?: string     // from payload.seller_improvements in parent row

  // Client:
  client_name: string              // 'Kelly Hansen' - used for cover letter salutation
  client_notes?: string

  // Comp summary (from cma producer's Step 4):
  comps_count: number
  comp_close_date_range: string    // e.g. 'January 2025 - April 2026'
  comp_price_range: string         // e.g. '$1,150,000 - $1,450,000'
  comp_sqft_range: string          // e.g. '2,200 - 2,800 sq ft'

  // Pricing output (from cma producer's Step 9):
  recommended_list: number         // 1225000
  value_low: number                // 1150000
  value_high: number               // 1267500
  pricing_method_1_summary: string // 1-2 sentence description of per-sqft method result
  pricing_method_2_summary: string // 1-2 sentence description of baseline + value-add result
  outlier_explanations?: string[]  // If any comps were excluded or weighted, explain why

  // Market context (live, from market_stats_cache):
  bend_active_count: number
  bend_mos: number                 // months of supply
  bend_mos_verdict: string         // 'seller' | 'balanced' | 'buyer'
  bend_median_price: number
  bend_dom_median: number

  // Broker:
  broker_display_name: string      // 'Matt Ryan'
  broker_title: string             // 'Principal Broker'
  broker_license: string           // '201206613'
  broker_phone: string             // '541.213.6706'
  broker_email: string

  // Tone override (optional):
  tone?: 'formal' | 'conversational'  // defaults to 'conversational' (Matt's voice)
}
```

---

## 3. Brief payload schema

```typescript
interface CMANarrativeActionRow {
  id: string
  action_type: 'content:cma_narrative'
  target: string                   // 'cma:<parent-cma-slug>'
  assigned_producer: 'marketing_brain_skills/producers/cma-narrative'
  payload: CMANarrativePayload
  data_evidence: {}               // inherited from parent cma action row
  generation_reason: string       // 'Delegated by cma producer for <client_name>'
  status: 'pending'
}
```

---

## 4. The recipe

**Step 1 - Read the action row and transition to in_production**

```sql
SELECT * FROM marketing_brain_actions WHERE id = '<id>' AND status = 'pending';
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>';
```

**Step 2 - Load mandatory references**

Before writing any prose:
- `CLAUDE.md` §0 (Data Accuracy - all figures in the narrative trace to payload fields verified by the parent cma producer)
- `CLAUDE.md` §0.5 (Draft-First, Commit-Last)
- `design_system/ryan-realty/SKILL.md` (brand voice - Heritage register for CMA prose: formal, direct, trustworthy)
- `marketing_brain_skills/brand-voice/voice_guidelines.md` (full load - long-form external prose)
- `marketing_brain_skills/research/tool-inventory.md`
- `marketing_brain_skills/research/platform-bible.md` (§23 compliance rules apply to CMA text)
- `marketing_brain_skills/research/asset-library-map.md`
- `marketing_brain_skills/research/bend-market-bible.md` §4 (Oregon disclosure requirements)
- `marketing_brain_skills/producers/cma/SKILL.md` (parent producer - understand the full CMA structure)

**Step 3 - Validate all figures in the payload**

The payload figures came from the parent cma producer which already verified them against
Supabase. However, the narrative producer must confirm each figure used in prose maps
to the payload exactly. Do not alter figures. Do not round in a way that changes meaning.

Cross-check the market context figures against market_stats_cache:
```sql
SELECT city_median_price, city_active_count, city_months_supply, city_dom_median
FROM market_stats_cache
WHERE city = 'Bend' AND property_type = 'A'
ORDER BY stats_date DESC LIMIT 1;
```

If any market figure in the payload differs from the cache by >1%, flag to the parent
cma producer before proceeding. The payload wins if it has a more recent query timestamp;
the cache wins if the payload timestamp is >24 hours old.

**Step 4 - Draft the cover letter**

Length: 200-300 words. Addressed to `client_name` by first name.

Structure:
1. Opening: "Dear [First Name]," - thank them for the opportunity, reference the specific property address
2. Purpose statement: what the CMA does and does not do (not an appraisal, is an informed professional opinion)
3. Market context paragraph: current Bend SFR market conditions in one to two sentences. Reference the MoS verdict and median price from the payload. Frame it neutrally, not as hype.
4. Confidence statement: brief note on why the comp set is credible (subdivision proximity, time window, size similarity)
5. Close: "I am available to walk through this analysis with you at your convenience." Canonical phrase from voice_guidelines.md. Sign with broker's name, title, phone.

Voice rules:
- First-person ("I") is correct here - this is a personal professional letter from the broker
- No em-dashes. No semicolons. No exclamation marks.
- No banned words (see voice_guidelines.md §6.2 complete list)
- "Honored" and "privilege" are acceptable in the opening - see canonical phrases
- Phone format: 541.213.6706 (dotted)
- Currency rounded to the nearest thousand: $1,225,000 not $1,224,750

**Step 5 - Draft the subject property narrative**

Length: 150-250 words. Placed on Page 2 of the CMA ("Subject narrative" section).

Purpose: Set up the comp analysis by describing the subject property factually. The reader (the client) already knows their property - the narrative frames how this property sits in the market context.

Structure:
1. Physical description: beds, baths, square footage, lot size, year built, garage - one sentence, factual, no adjectives
2. Subdivision and location: name the subdivision, proximity to key Bend amenities (use bend-market-bible.md §1 for the correct neighborhood descriptors for this area)
3. Listing history: brief factual note on prior MLS activity if present in `subject_listing_history`
4. Seller improvements: if `seller_improvements` is provided, list the improvements factually. Every improvement mentioned must be from the seller-provided notes. Do not add improvements not documented. Prefix with "Per the seller, improvements include:"
5. What makes comp selection appropriate: one sentence connecting the subject's physical profile to the comp filter criteria

No promotional language. No "stunning," no "nestled," no "boasts." The subject property description reads like a qualified professional assessment, not a listing ad.

**Step 6 - Draft the pricing rationale**

Length: 150-300 words. Placed on Pages N+1 and N+2 of the CMA ("Pricing strategy" and "Why this list price" sections).

Structure:
1. Method 1 paragraph (3-4 sentences): summarize the per-sqft tier methodology in plain English. State the $/sqft range for the renovated tier, the resulting price range for the subject's square footage. Reference `pricing_method_1_summary` from payload.
2. Method 2 paragraph (3-4 sentences): summarize the baseline + value-add methodology. Cite the unimproved baseline and the documented improvement value-add. Reference `pricing_method_2_summary` from payload.
3. Convergence paragraph (2-3 sentences): note that both methods converge within the stated range, and explain the three tiers (Conservative, Recommended, High End) in plain English.
4. Outlier explanation (if `outlier_explanations` is populated): one paragraph per outlier explaining why that comp was weighted differently or excluded. Be specific: "65258 Old Bend Redmond Hwy closed at $1,450,000 in February 2026, which is 18% above the cluster median. This comp was weighted at 50% due to its waterfront parcel, which the subject does not share."
5. Verification trace: one sentence naming the data source and date range. "Comp data sourced from Supabase listings table, 24-month close window, Whispering Pines subdivision, PropertyType='A'."

**Step 7 - Draft the disclosure statement**

Length: 100-150 words. Placed on the final page.

Required language per Oregon law and professional standards (bend-market-bible.md §4):

"This Comparative Market Analysis is prepared by [Broker Name], [Title], Oregon License #[Number], of Ryan Realty, and is provided for informational purposes only. It is not a formal appraisal and does not constitute an opinion of value under the Uniform Standards of Professional Appraisal Practice (USPAP). Market conditions, property features, and comparable data change frequently. Ryan Realty makes no warranty, express or implied, regarding the accuracy of this analysis. This analysis should not be relied upon as a substitute for a qualified appraisal by a state-certified or licensed appraiser. [Broker Name] is a licensed Oregon real estate broker, not a state-certified appraiser. Data sourced from the MLS of Central Oregon (COCAR) and the Supabase ryan-realty-platform database. Market data current as of [fetched_at date]."

Adjust broker name, title, and license number from the payload. Fill in the data date from citations.json.

**Step 8 - Voice self-check across all four sections**

Mandatory grep before surfacing:
- Em-dash (U+2014), en-dash (U+2013): zero allowed. Replace with period or comma.
- Semicolons: zero allowed. Replace with period.
- Exclamation marks: zero allowed in CMA narrative (formal document).
- Banned words from voice_guidelines.md §6.2: zero allowed. The banned word list applies equally to CMA prose as to marketing copy.
- "Approximately", "roughly", "about" as number substitutes: zero allowed. Use the actual number.
- Fair-housing check: no protected-class language. The neighborhood descriptor for any subdivision must be physical and geographic, not demographic.

Do not surface a draft that fails any check.

**Step 9 - Return prose to parent cma producer**

The cma-narrative producer returns its output as structured prose blocks for the parent to insert into the HTML at the correct page positions. Return format:

```json
{
  "cover_letter": "Dear Kelly...",
  "subject_narrative": "The subject property at 21042 Robin Ave...",
  "pricing_rationale": "Method 1 analysis...",
  "pricing_why": "The recommended list price of $1,225,000...",
  "disclosure": "This Comparative Market Analysis is prepared by..."
}
```

Also write the prose to `out/cma-<slug>/narrative-draft.json` for the parent's contact sheet to display.

**Step 10 - UPDATE action row to ready**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = jsonb_build_object(
      'draft_path', 'out/cma-<slug>/narrative-draft.json',
      'cover_letter_words', <count>,
      'total_words', <count>,
      'voice_gate', 'pass',
      'fair_housing_gate', 'pass'
    )
WHERE id = '<id>';
```

The parent cma producer surfaces the full CMA (including this narrative) to Matt for approval.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | market_stats_cache cross-check, action row transitions | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

No additional API calls are required. All property and comp data arrives via the payload
from the parent cma producer. The narrative producer's job is prose generation and validation.

---

## 6. Output format

**Draft lands at:** `out/cma-<slug>/`

```
out/cma-<slug>/
├── narrative-draft.json     <- structured prose blocks for parent producer
└── (parent cma producer assembles the full CMA HTML)
```

The narrative producer does not produce a standalone contact sheet. The parent cma producer's
contact sheet includes the narrative text for Matt's review.

---

## 7. Approval gate

**This producer uses:** `matt-review-draft` (inherited from parent)

The narrative producer transitions its action row to `ready` and returns control to the
parent cma producer. Matt reviews and approves the full CMA (including narrative) through
the parent's contact sheet. The narrative producer's action row is set to `executed` when
the parent's CMA is committed.

---

## 8. Status flow

```
pending           <- created by parent cma producer
  |
  v
in_production     <- narrative producer starts
  |
  v
ready             <- prose returned to parent, narrative-draft.json written
  |
  v (parent CMA approved by Matt)
executed          <- set when parent's git commit+push completes

killed            <- if voice/fair-housing gate fails after 2 auto-fixes
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Payload figures inconsistent with Supabase | Market stats delta >1% | Surface to parent cma producer. Use the more recent timestamp. Do not proceed until resolved. |
| Voice gate fails | Banned word or punctuation in draft | Rewrite and re-validate. Max 2 auto-iterations. After 2 failures, surface the specific failure to the parent cma producer which surfaces to Matt. |
| Fair-housing gate fails | Protected-class language detected | Rewrite immediately. If the neighborhood descriptor in bend-market-bible.md §1 itself contains borderline language, use only the physical/geographic facts (lot size, trail proximity, school name) and omit the characterization. |
| Seller improvement not verifiable | Improvement in seller_notes but not in MLS data | Use "Per the seller:" prefix. Do not present seller claims as verified facts. Surface the gap in the narrative draft with a [UNVERIFIED - per seller only] tag for Matt to confirm. |
| Disclosure language outdated | Oregon OAR changes post-2026-05-17 | Surface to Matt if there is reason to believe OAR 863-015-0215 has been updated. Do not modify the disclosure without Matt's confirmation. |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0 - Data Accuracy (all figures trace to payload from parent producer)
- `CLAUDE.md` §0.5 - Draft-First, Commit-Last
- `design_system/ryan-realty/SKILL.md` - brand voice (Heritage register: formal, direct)
- `marketing_brain_skills/brand-voice/voice_guidelines.md` - full load (long-form external)
- `marketing_brain_skills/research/tool-inventory.md` - tool status
- `marketing_brain_skills/research/platform-bible.md` - §23 MLS syndication, §24 compliance
- `marketing_brain_skills/research/asset-library-map.md` - asset tracking
- `marketing_brain_skills/research/bend-market-bible.md` - §4 Oregon regulatory environment
- `marketing_brain_skills/producers/cma/SKILL.md` - parent producer (delegator)

**Pipeline:**
- `automation_skills/content_engine/SKILL.md` - content routing
- `social_media_skills/platform-best-practices/SKILL.md` - 2026 platform rule layer
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` - banned content gate
- `video_production_skills/VIRAL_GUARDRAILS.md` - scorecard and format minimums

**Oregon legal authority:**
- OAR 863-015-0215 (license disclosure in real estate advertising)
- ORS 696.030 (real estate broker duties)
- USPAP (Uniform Standards of Professional Appraisal Practice) - for the disclaimer

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md` - Section B, row `cma-narrative`
- Delegated from: `marketing_brain_skills/producers/cma/SKILL.md`
- Never emitted directly by the brain's weekly cycle

## 12. Tool gap suggestions

What would make this 10x better:

1. **Automated comps refresh**: if the CMA payload is older than 48 hours, re-query Supabase for the latest closed comps before generating the narrative rather than using potentially stale comp data.
2. **E-signature integration** (DocuSign or HelloSign API): after Matt approves the CMA, auto-generate a signature-ready PDF version so the client can sign the listing agreement in the same workflow.
3. **Price opinion confidence interval**: add a low/mid/high scenario to the pricing section using a simple regression on comp data rather than a single point estimate.

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/tool-inventory.md`
- `marketing_brain_skills/research/platform-bible.md`
- `marketing_brain_skills/research/asset-library-map.md`
- `marketing_brain_skills/research/bend-market-bible.md`

---

## Validator stub sections (canonical 11-section structure)

## 11. Tool gap suggestions

Tool gap suggestions: see tool-acquisition-recommendations.md for the aggregated list across all producers.

