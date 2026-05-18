---
name: listing-description
description: >
  Generates MLS Public Remarks, private agent remarks, and showing instructions for
  a specific listing. Voice-validated and fair-housing-compliant. Outputs copy for
  manual paste into COCAR's web UI (no programmatic MLS write). Triggered by
  content:listing_description action rows or direct invocation.
action_types:
  - content:listing_description
output_type: text
output_type: text
target_platforms: ['zillow']
asset_destination: "out/listing-descriptions/<mls_id>/"
auto_inputs: ['mls_listing_record', 'listing_photos']
required_inputs: ['listing_key or mls_id']
optional_inputs: "['style (narrative|bullet|hybrid)', 'max_chars (default 1500)']"
estimated_runtime_min: 8
cost_usd_estimate: $0
thumbnail_uri: out/proof/2026-05-17/exemplars/listing-description/sample.txt
example_outputs: []
    label: Phase 7.5 exemplar placeholder
    surface: mls

---

# Listing Description Producer

**Scope:** Generates three text deliverables for a specific MLS listing: (1) Public Remarks
for MLS display (max 1000 chars, per COCAR field limit), (2) Private/Agent Remarks visible
only to cooperating agents (max 500 chars), and (3) Showing Instructions. All copy is
voice-validated, fair-housing-clean, and compliance-gated. Does not write directly to the
MLS - the MLS write API is not available. Matt or the listing agent pastes approved copy
into COCAR's Matrix web UI manually. See §4 Step 12 for exact paste instructions.

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/listing-description/<mls-slug>/` (three text files + contact-sheet)

---

## 1. Scope

### In scope

- MLS Public Remarks (500-1000 characters, targeting 800-950 for readability)
- Private Agent Remarks (100-500 characters; agent-to-agent tone, factual)
- Showing Instructions (50-200 characters; practical, clear, no marketing language)
- Fair-housing compliance gate (zero protected-class language anywhere in all three)
- Voice validation gate (zero banned words, zero em-dashes, zero semicolons)
- Oregon license disclosure compliance check (brokerage name in remarks where required)
- MLS upload instructions for COCAR Matrix paste

### Out of scope

- The full listing flyer or feature sheet (use flyer-design producer)
- The social media caption for the listing announcement (use ig-single-post or listing_reveal)
- The listing video VO script (use listing-tour-video producer)
- Any direct API write to COCAR MLS (not available; always manual paste)

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:listing_description` | `listing_key` OR `subject_address`; optional `seller_notes`, `showing_contact` | `listing_key` preferred for Supabase lookup; `seller_notes` captures seller-provided highlights |

### Payload schema

```typescript
interface ListingDescriptionPayload {
  // One of these is required:
  listing_key?: string             // Spark ListingKey (preferred)
  subject_address?: string         // '123 Main St, Bend, OR 97701'

  // Optional seller context:
  seller_notes?: string            // Seller-provided highlights, renovations, features
                                   // Use to inform copy but verify all claims against MLS data

  // Showing logistics:
  showing_contact?: string         // Name and phone for showing requests; defaults to
                                   // broker's phone from public.brokers if omitted
  showing_window?: string          // e.g. "8am-8pm daily" or "call 24hrs ahead"
  lockbox_type?: string            // e.g. "SentriKey on front door"
  pet_instructions?: string        // e.g. "1 small dog, secure before showing"
  special_notes?: string           // e.g. "seller works from home - avoid 9am-noon weekdays"

  // Override options:
  broker_email?: string            // Resolves to public.brokers; defaults to listing agent
  remarks_char_limit?: number      // Override default 1000 (COCAR standard)
}
```

---

## 3. Brief payload schema

```typescript
interface ListingDescriptionActionRow {
  id: string
  action_type: 'content:listing_description'
  target: string                   // 'mls:<listing_key>' or 'address:<slug>'
  assigned_producer: 'social_media_skills/listing-description'
  payload: ListingDescriptionPayload
  data_evidence: {
    request_source?: 'matt-direct' | 'listing-trigger' | 'broker-request'
    listing_status?: string        // 'Active' | 'Coming Soon' | 'Pending'
  }
  generation_reason: string
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

Before producing any copy:
- `CLAUDE.md` §0 (Data Accuracy - all property facts trace to MLS data, never invented)
- `CLAUDE.md` §0.5 (Draft-First, Commit-Last)
- `design_system/ryan-realty/SKILL.md` (brand register and voice)
- `marketing_brain_skills/brand-voice/voice_guidelines.md` (full load - listing descriptions are external-facing prose)
- `marketing_brain_skills/research/tool-inventory.md` (verify Supabase and Spark are reachable)
- `marketing_brain_skills/research/platform-bible.md` §23 (MLS / COCAR syndication rules)
- `marketing_brain_skills/research/bend-market-bible.md` §4 (Oregon regulatory environment) and §5 (COCAR MLS rules)
- `marketing_brain_skills/research/asset-library-map.md` (asset registration on approval)

**Step 3 - Pull property data from Supabase**

```sql
SELECT
  "StreetNumber", "StreetName", "ListPrice", "StandardStatus",
  "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt", "year_built",
  "SubdivisionName", "City", "PostalCode", "Latitude", "Longitude",
  "lot_size_acres", "garage_spaces", "PhotoURL",
  "ListAgentEmail", "ListAgentFullName", "ListOfficeEmail",
  "PublicRemarks", "PrivateRemarks",
  "CumulativeDaysOnMarket", "OnMarketDate"
FROM listings
WHERE "ListingKey" = '<key>';
```

If subject_address is provided instead of listing_key:
```sql
SELECT * FROM listings
WHERE "PostalCode" = '<zip>'
  AND "StreetNumber" = '<num>'
  AND "StreetName" ILIKE '<street>%'
ORDER BY "OnMarketDate" DESC
LIMIT 1;
```

Capture every factual detail: beds, baths, square footage, lot size, year built, garage spaces, subdivision name, and any existing MLS remarks. These become the fact-base. Do not invent features not present in the data.

**Step 4 - Resolve listing broker from public.brokers**

```sql
SELECT slug, display_name, phone, email, license_number
FROM brokers
WHERE email = '<ListAgentEmail>';
-- fallback to matt-ryan if no match
```

The broker's phone becomes the default showing contact if `payload.showing_contact` is not provided.

**Step 5 - Draft Public Remarks**

Length target: 800-950 characters (max 1000 per COCAR field limit).

Structure:
1. Opening sentence: one specific factual detail that differentiates this property. Not a generic statement. Lead with a physical fact (the view, the acreage, the garage, the school, the trail access).
2. Property description body: beds, baths, sqft, lot size, year built, key features from seller_notes (if verified against MLS data). Two to three sentences maximum.
3. Neighborhood or location context: one sentence citing a specific amenity or proximity (use bend-market-bible.md §1 for the correct descriptors for this neighborhood).
4. Close: one sentence about the listing status or opportunity. No urgency language ("act fast", "won't last", "don't miss out").

Voice rules for Public Remarks (mandatory):
- "You/your" is the subject (talking to the buyer reading this)
- No em-dashes. No semicolons. No exclamation marks.
- No banned words: stunning, nestled, boasts, charming, pristine, gorgeous, breathtaking, must-see, dream home, meticulously maintained, entertainer's dream, tucked away, hidden gem, truly, spacious, cozy, luxurious, updated throughout, turnkey, immaculate, captivating, exquisite
- No "approximately" or "roughly" - use the actual number or omit the claim
- Numbers carry units: "2,400 sq ft" not "2400sqft"; "0.25 acres" not ".25 acres"

**Step 6 - Fair housing compliance gate**

Scan all three deliverables (Public Remarks, Private Remarks, Showing Instructions) for any language that could indicate a preference for or against buyers or renters of a specific protected class. Protected classes under the Fair Housing Act (42 U.S.C. § 3604): race, color, national origin, religion, sex, familial status, disability.

Oregon extends protection to: marital status, source of income, sexual orientation, gender identity.

Per bend-market-bible.md §4 (regulatory environment) and COCAR rules §5:

Prohibited phrases (hard fail - rewrite immediately):
- Any neighborhood descriptor referencing the demographic composition of residents
- "Family-friendly" in context that implies preference for families with children
- "Walking distance to church" (religion preference)
- Any language about the "feel" or "vibe" that maps to a demographic
- "Quiet neighborhood" is permissible; "quiet neighborhood - no students" is not
- School names are permissible (factual); school rankings that imply class preference are not
- Disability-adjacent language: "ideal for able-bodied buyers", "not handicap accessible" (instead: "no ADA modifications")

The fair-housing check is a ship-blocker. No draft surfaces to Matt until this gate passes.

**Step 7 - Oregon MLS disclosure compliance**

Per Oregon Administrative Rule OAR 863-015-0215 and COCAR policy:
- Licensed brokerage name (Ryan Realty) must appear in advertising. In MLS Public Remarks, the listing office is displayed separately by the MLS system, so the remarks field itself does not require a brokerage callout.
- The producing agent's license number is not required in MLS remarks (it appears in the MLS agent record).
- Do not state specific commission rates or cooperative compensation in Public Remarks (per NAR settlement compliance 2025 onward).
- Clear Cooperation Policy: if the listing is being publicly marketed (IG, Facebook, flyers, signs), it must be in the COCAR MLS within one business day. Surface this timing constraint to Matt in the contact sheet if the listing status is Coming Soon.

Per bend-market-bible.md §4 - also verify:
- No statement about STR eligibility unless verified against Bend's STR ordinance (Bend Municipal Code 4.50). Do not claim "STR-eligible" without confirmation.
- No claims about school district boundaries that the producer cannot verify from Bend-La Pine Schools attendance area data.

**Step 8 - Draft Private Agent Remarks**

Length: 100-500 characters.

Content: information relevant to cooperating agents that is not appropriate in public remarks. Typical content:
- Showing logistics summary
- Seller motivation (if Matt approves sharing - ask in contact sheet)
- Key offer terms seller prefers (escalation clause welcome, as-is, preferred close date)
- Any HOA nuances or known disclosures that agents should flag to their buyers
- Financing notes (seller may carry, VA welcome, etc.)

Voice: agent-to-agent, direct, factual. No marketing language. No banned words. No em-dashes.

**Step 9 - Draft Showing Instructions**

Length: 50-200 characters.

Content: exactly what a showing agent needs to book a showing. Format:

"Call/text [Name] at [phone] [time window]. [Lockbox type] at [location]. [Pet/child/seller notes]."

Example: "Text Matt at 541.213.6706. Supra lockbox on front door. 1 dog - secure before entry. 24hr notice preferred."

No marketing language. Purely operational.

**Step 10 - Voice self-check (all three deliverables)**

Run the mandatory grep:
- Em-dash (U+2014), en-dash (U+2013): zero occurrences allowed
- Semicolons: zero occurrences allowed
- Every banned word from voice_guidelines.md §6.2: zero occurrences allowed
- Fair-housing protected-class language: zero occurrences allowed
- "Approximately", "roughly", "about" as substitute for a real number: zero occurrences allowed

Do not surface a draft that fails any of these checks.

**Step 11 - Write citations.json and output files**

```
out/listing-description/<mls-slug>/
├── public-remarks.txt         <- ready to paste into COCAR Matrix
├── private-remarks.txt        <- agent-only text
├── showing-instructions.txt   <- lockbox / contact / logistics
├── citations.json             <- fact trace
└── contact-sheet.html         <- MANDATORY review surface
```

citations.json entry format (one per factual claim):
```json
{
  "claim": "2,450 sq ft",
  "source": "Supabase listings",
  "column": "TotalLivingAreaSqFt",
  "listing_key": "<key>",
  "value": 2450,
  "fetched_at": "<ISO>"
}
```

**Step 12 - Build contact sheet with MLS paste instructions**

The contact sheet for listing descriptions includes:
- All three text blocks displayed clearly (monospace font for easy copy)
- Character count per block (Public Remarks must be under 1000; warn if over 950)
- Fair-housing gate result (PASS / list any reviewed language)
- Verification trace table (each factual claim source)
- MLS upload instructions panel:

```
MLS PASTE INSTRUCTIONS (manual - no API write available)
1. Log into COCAR Matrix at matrix.nwmls.com
2. Navigate to the listing: Add/Edit > [MLS number]
3. Tab: Remarks
   - Public Remarks field: paste public-remarks.txt (confirm char count <= 1000)
   - Private Remarks field: paste private-remarks.txt
   - Showing Instructions field: paste showing-instructions.txt
4. Save and submit to MLS
5. Reply "approved" here to mark this action row executed
```

**Step 13 - UPDATE action row to ready and surface to Matt**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = jsonb_build_object(
      'draft_path', 'out/listing-description/<slug>/',
      'public_remarks_chars', <count>,
      'fair_housing_gate', 'pass',
      'voice_gate', 'pass'
    )
WHERE id = '<id>';
```

Standard surface format (see TEMPLATE.md §6). After Matt approves and pastes into Matrix, Matt replies "approved" or "pasted" to close the action row. Producer sets status='executed'.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | property data pull, broker resolve, action row transitions | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Spark API | photo array lookup if PhotoURL null in Supabase | `SPARK_API_KEY`, `SPARK_API_BASE_URL` |

No programmatic MLS write API exists for COCAR. All MLS data entry is manual paste by Matt or the listing agent.

---

## 6. Output format

**Draft lands at:** `out/listing-description/<mls-slug>/`

```
out/listing-description/<mls-slug>/
├── public-remarks.txt
├── private-remarks.txt
├── showing-instructions.txt
├── citations.json
└── contact-sheet.html    <- MANDATORY
```

Surface format follows TEMPLATE.md §6 standard, with the MLS paste instructions panel added.

---

## 7. Approval gate

**This producer uses:** `matt-review-draft`

Matt sees the contact sheet, confirms the copy is accurate and compliant, then manually pastes into COCAR Matrix. Verbal "approved" or "pasted" closes the action row.

---

## 8. Status flow

```
pending
  |
  v
in_production     <- immediately on pickup
  |
  v
ready             <- draft complete, both gates pass, contact sheet built
  |
  v (Matt pastes into COCAR Matrix)
approved
  |
  v (Matt confirms paste complete)
executed          <- set after Matt's "pasted" or "done" confirmation
  |
  v (30-day post-listing performance check)
measured          <- DOM, close price vs list price, showing volume if available
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Property not in Supabase | Query returns 0 rows | Ask Matt for property details directly. Proceed with manually provided facts. Do not invent any figures. |
| Fair-housing gate fails | Protected-class language detected | Rewrite immediately. Do not surface failing draft. Re-run gate. Max 2 auto-rewrites; if third attempt still fails, surface the specific language to Matt for guidance. |
| Voice gate fails | Banned word or punctuation found | Rewrite and re-validate. Never surface a failing draft. |
| Public Remarks over 1000 chars | Character count exceeds COCAR field limit | Trim the lowest-information sentence. Never trim factual figures. Trim adjectives first, then narrative context. |
| Seller note claims cannot be verified | Seller says "newly renovated kitchen" but Supabase has no MLS data confirming | Do not include unverified claims in Public Remarks. Move them to Private Remarks prefixed with "Per seller:" so cooperating agents know the source. Surface the unverified claim to Matt in the contact sheet. |
| Broker not in public.brokers | ListAgentEmail does not match | Default showing contact to Matt's direct line 541.213.6706. Surface one-line note to Matt. |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0 - Data Accuracy (all property facts trace to MLS, never invented)
- `CLAUDE.md` §0.5 - Draft-First, Commit-Last
- `design_system/ryan-realty/SKILL.md` - brand voice, banned vocabulary
- `marketing_brain_skills/brand-voice/voice_guidelines.md` - full load (external-facing prose)
- `marketing_brain_skills/research/tool-inventory.md` - tool status
- `marketing_brain_skills/research/platform-bible.md` - §23 MLS / COCAR syndication rules, §24 real-estate compliance master list
- `marketing_brain_skills/research/bend-market-bible.md` - §4 regulatory environment (Oregon disclosure, STR ordinance), §5 COCAR MLS rules
- `marketing_brain_skills/research/asset-library-map.md` - asset registration

**Fair housing authority:**
- Fair Housing Act 42 U.S.C. § 3604 (federal protected classes)
- Oregon fair housing extensions (ORS 659A.421) - marital status, source of income, sexual orientation, gender identity
- HUD Fair Housing Advertising Guidelines (HUD Memo 88-1)
- NAR Code of Ethics Article 10

**Related producers:**
- `automation_skills/content_engine/SKILL.md` - content routing
- `social_media_skills/platform-best-practices/SKILL.md` - 2026 platform rule layer
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` - banned content gate
- `video_production_skills/VIRAL_GUARDRAILS.md` - scorecard and format minimums
- `video_production_skills/listing-tour-video/SKILL.md` - video VO uses different copy than MLS remarks
- `social_media_skills/flyer-design/SKILL.md` - flyer copy shares the same fact-base but different length/format
- `social_media_skills/list-kit/SKILL.md` - list-kit orchestrator calls this producer as one of its outputs

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md` - Section B, row `listing-description`

## 12. Tool gap suggestions

What would make this 10x better:

1. **Banned-phrase MLS checker**: after generating the description, run it against the ORMLS banned-phrase list (fair housing protected classes, guaranteed income claims) before delivering to Matt.
2. **Character-count enforcer per platform**: the MLS limit (1500 chars), Zillow limit (2000 chars), and website version (uncapped) need separate outputs; a single description with platform-specific trim logic would eliminate the manual editing step.
3. **SEO keyword injection**: pull the top-10 organic search terms for listings in the property's ZIP code from Google Search Console and ensure at least 3 appear naturally in the description.

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

