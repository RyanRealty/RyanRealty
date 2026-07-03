# CRM Tag + Smart-List Streamline Plan (2026-07-03)

> **Status: PROPOSAL — awaiting Matt's approval. Nothing executes until he signs off; the migration
> is reversible with a one-command undo.** Author: Claude (Fable/Opus session, 2026-07-03).
> Approved-shape inputs from Matt this session are cited inline.

## 1. The problem (measured)

- **1,447 distinct tags · 263,226 assignments** across 18,226 contacts (~14 tags/contact).
- Two-thirds of the sprawl is **1,038 `subdivision:`-style enrichment tags** that duplicate data
  already stored in custom fields.
- The same concept is tagged 5–15 different ways: expired (15+ variants), absentee/out-of-area
  (11 variants), owner-occupied (2), realtor (98 brokerage/city variants). No single canonical
  marker, so smart lists that key on one tag miss most of the segment (e.g. Expired showed 90 of ~650).

## 2. Principles

1. **A tag means one thing.** One canonical tag per concept.
2. **Derivable tags are derived from truth, not hand-applied.** Occupancy/location come from the
   mailing-vs-property address comparison; realtor local/migration from work market. These
   self-correct as data updates and can never drift into 6 conflicting versions again.
3. **Enrichment data lives in fields, not tags.** Subdivision, year built, equity, etc. are data —
   they already exist as custom fields; the tags are pure duplication.
4. **Compliance tags are sacred.** `contact:do-not-call`, `contact:do-not-text`,
   `compliance:hard-stop`, unsubscribe/DNC/bounce markers are never renamed or dropped.
5. **Reversible.** Full pre-migration backup of every contact's tag array + a one-command restore.

## 3. Canonical taxonomy — 1,447 tags → ~40

| Bucket | Today (distinct → assignments) | Becomes | Canonical tags |
|---|---|---|---|
| **Segment** | 21 → 25,890 | **5 tags** | `segment:seller` · `segment:expired` · `segment:fsbo` · `segment:out-of-area` · `segment:buyer` |
| **Realtor** | 98 → 5,662 | **3 tags** | `industry:realtor` + `realtor:local` / `realtor:migration` |
| **Vendor** | (new) | **1 + type set** | `segment:vendor` + `vendor:<type>` (curated, §3.2) |
| **Occupancy** (address-derived) | (from owner:* + 2 dup) | **2 tags** | `owner:occupied` / `owner:absentee` |
| **Location** (address-derived) | 7 → 29,953 | **3 tags** | `location:local` / `location:out-of-area` / `location:out-of-state` |
| **Source** | 17 → 21,428 | **kept (~14)** | `source:*` — where the lead came from |
| **Compliance** | 17 → 42,383 | **kept, verbatim** | `contact:do-not-call/-text`, `compliance:hard-stop`, `email:invalid/bounced`, unsubscribe |
| **Move to fields** | **1,038 → 93,688** | **0 tags** (data stays as custom fields) | subdivision, neighborhood, city, tenure, equity, seller-score, dom-tier, brokerage, price/value |
| **Delete (noise)** | 166 → 19,977 | **0 tags** | `expired-mls:<id>`, `expired-detected:<date>`, `ExpiredWave1-4`, `import:*`, `auto:*`, `fb-audience:*`, one-offs |
| **Manual review** | 83 → 24,245 | TBD (Matt eyeballs) | e.g. `SOI`, `sphere`, `long-term`, `high-lead-score`, `Real Estate` — mapped to segment/field/keep per review |

**Net: every contact ends up with ~5 meaningful tags** — segment, occupancy, location, source, and
any compliance flag — instead of ~14.

### 3.1 Collapse rules (how the migration maps, by pattern)

- **→ `segment:expired`**: `Expired`, `Expired Listings`, `intent:expired-listing`, `ExpiredWave1-4`,
  `seller:expired-untouched`, `source:expired-listing-cron/-mls`, `expired-status:*`,
  `import:expired-backfill-*`, `status:expired`, any `*expired*` (except the per-listing/per-date
  noise below, which is deleted). ~650 contacts.
- **→ `segment:fsbo`**: `FSBO`, `intent:fsbo`, `source:fsbo*`, any `*fsbo*`. ~21.
- **→ `segment:buyer`**: `Buyer`, `audience:buyer`, buyer-intent tags. ~55.
- **→ `segment:seller`**: `audience:seller`, seller-farm markers (also stage = Seller Prospect). ~7,500.
- **→ `segment:out-of-area`**: **NOT tag-derived — computed** (see §4, the Out Of Area list). The legacy
  `owner:absentee-outofstate`, `geo:out-of-state`, `in-state-out-of-area`, etc. are dropped; the tag is
  re-derived from addresses.
- **→ `owner:occupied` / `owner:absentee`** and **`location:*`**: **re-derived from `crm_people.addresses`**
  (mailing/home entry vs the `type='Property'` entry). Collapses `owner:occupied`, `owner-occupied`,
  `owner:absentee`, `absentee`, `Absentee Owner`, `owner:absentee-local/-outofstate`, `geo:out-of-state`,
  `state:out-of-state`, `out-of-state`, `geo:out-of-area`, `in-state-out-of-area`.
- **→ `realtor:local` / `realtor:migration`**: `industry:realtor` kept as the base; local vs migration
  **derived from work market** — Central Oregon brokerage/mailing → local; a Bend **feeder market**
  (WA / CA metros / Portland metro / Colorado Front Range — from the observed `<City> realtor` tags:
  Seattle, San Francisco, Portland, LA, San Diego, Denver, Boulder, Oakland, Beverly Hills, La Mesa)
  → migration. Collapses the 81 `brokerage:*` tags (→ a `brokerage` field), `migration broker`,
  `audience:broker-recruit`, the per-city `<City> realtor` tags, `realtor-source:*`.
- **→ fields (delete tag, data already in custom field)**: `subdivision:*`→`customSubdivision`,
  `neighborhood:*`, `city:*`, `tenure:*`, `equity:*`→`customEquity`, `seller-score:*`, `dom-tier:*`,
  `brokerage:*`→`brokerage` field.
- **→ delete**: `expired-mls:<id>`, `expired-detected:<date>`, `ExpiredWaveN`, `import:*`, `auto:*`,
  `status:*`, `lifecycle:*`, `repeat-relist:*`, `owner-lookup:*`, `exclude:*`, `fb-audience:*`, dup `Realtor`.
- **→ keep verbatim**: `source:*`, `contact:*`, `compliance:*`, `email:invalid/bounced`, unsubscribe, `vendor:*`.

### 3.2 Vendor type set (curated — Matt-approved 2026-07-03)

Vendors are segment #8. `segment:vendor` drives the Vendors list; `vendor:<type>` is the trade,
from a fixed set (a vendor may carry more than one). Type is a **manual pick** from a dropdown when a
vendor is added — it can't be auto-derived. Canonical set:

`vendor:lender` · `vendor:title` · `vendor:appraiser` · `vendor:inspector` · `vendor:electrician` ·
`vendor:plumber` · `vendor:hvac` · `vendor:roofer` · `vendor:contractor` · `vendor:painter` ·
`vendor:landscaper` · `vendor:stager` · `vendor:photographer` · `vendor:handyman` · `vendor:cleaner` ·
`vendor:pest` · `vendor:surveyor` · `vendor:attorney` · `vendor:insurance` · `vendor:flooring` · `vendor:mover`

The existing `Vendor` stage maps to `segment:vendor`.

## 4. The Smart Lists (the sidebar after)

**8 core workflow lists** — each keys on ONE canonical signal:

| List | Filter | ~Count |
|---|---|---|
| **Sellers** | stage = `Seller Prospect` | ~7,500 |
| **Expired** | tag `segment:expired` | ~650 |
| **FSBO** | tag `segment:fsbo` | ~21 |
| **Out Of Area Home Owners** | **address rule**: has a `type='Property'` address in the service area AND mailing/home address is non-local (state ≠ OR, or OR-city ∉ Central-OR list) | ~1,743 |
| **Buyers** | tag `segment:buyer` | ~55 |
| **Local Realtors** | tag `realtor:local` | (of 2,341) |
| **Migration Realtors** | tag `realtor:migration` (feeder-market referral agents) | (of 2,341) |
| **Vendors** | tag `segment:vendor` (filter within by `vendor:<type>`) | your rolodex |

**Out Of Area = non-local absentee** (Matt-confirmed 2026-07-03): mailing ≠ owned property, from outside
Central Oregon. Central-OR city list: Bend, Redmond, Sisters, La Pine, Sunriver, Terrebonne, Tumalo,
Prineville, Madras, Culver, Powell Butte, Crooked River Ranch, Black Butte Ranch, Camp Sherman, Alfalfa,
Brothers. Verified split: 1,412 out-of-state + 331 in-state-out-of-area = 1,743.

**4 operational lists kept:** Active Clients · Past Clients · Pending · Compliance Blocked.
**Retired** (folded into the above or dropped): Hot Prospects, Nurture, Sphere, Seller Prospects (dup of
Sellers), Stay In Touch, Email Activity, IDX Activity, Realtors (→ split into Local/Migration).

## 5. Default auto-tagging for NEW contacts (keeps it clean forever)

The consolidation is a one-time cleanup; **this section is the ongoing rule set** so new leads land
correctly tagged without hand-work. Implemented as one canonical `deriveCanonicalTags(person)` helper
called at three moments: **on lead creation**, **after enrichment** (skip-trace/county), and **on any
address change**.

| Tag family | Set automatically by | When |
|---|---|---|
| **`segment:*`** | the creation path: expired cron → `segment:expired`; FSBO source → `segment:fsbo`; buyer LP/IDX → `segment:buyer`; seller LP + farm import → `segment:seller`. (Out-of-area is address-derived, not path-derived.) | at creation (hooks into `ensureNativeLead` / lead-router / the LP actions) |
| **`owner:occupied`/`:absentee`** + **`location:*`** | `deriveCanonicalTags` computes from mailing-vs-`Property` address | at creation + after enrichment + on address edit |
| **`segment:out-of-area`** | set when `owner:absentee` AND `location` is non-local | same |
| **`realtor:local`/`:migration`** | when the contact is classified a realtor, from brokerage/mailing market vs the feeder-market list | at creation/enrichment |
| **`segment:vendor` + `vendor:<type>`** | **manual pick** from the curated dropdown (§3.2) — trade can't be auto-derived | when a vendor is added/edited |
| **`source:*`** | the lead source (already wired) | at creation |
| **`contact:*` / `compliance:*`** | skip-trace DNC/litigator/TCPA flags + inbound opt-outs (already wired, unchanged) | at creation + on inbound STOP |

**Guarantees:** the derived tags are recomputed (not appended) so they can't accumulate stale variants;
compliance tags are only ever ADDED, never cleared by the derivation (fail-safe); a contact with an
incomplete address gets `owner:unknown` rather than a guess.

## 6. Execution plan (reversible, staged — runs only on Matt's "go")

1. **Backup** — snapshot every contact's full `tags` array to `out/tag-migration-backup.json` +
   `scripts/_tag-streamline-restore.mjs` (one-command undo, dry-run tested first).
2. **Dry-run** — `scripts/_tag-streamline-migrate.mjs --dry-run` prints the exact before/after: how many
   contacts get each canonical tag, how many tags deleted, how many moved to fields, and the full
   `manual-review` list (83) for Matt to rule on. **No writes.**
3. **Matt reviews** the dry-run output + rules on the 83 manual-review tags.
4. **Apply** — the migration runs idempotently: adds canonical tags, moves enrichment tags to their
   custom fields (only where the field is empty — never overwrite), deletes noise, keeps compliance.
5. **Rebuild smart lists** — create/point the 7 core + 4 operational `crm_saved_views` at the canonical
   filters; retire the noise lists. Wire the Out Of Area + realtor lists to the address/market rules.
6. **Install auto-tagging** — ship `deriveCanonicalTags` + the creation-path hooks (§5) so new leads stay clean.
7. **Verify** — each list returns its expected count; a sample contact shows ~5 clean tags + its
   enrichment as fields; compliance tags intact; net-zero on anything not in the plan.

## 7. Safety

- Nothing in this plan sends a message or changes a stage. It only reorganizes tags/lists.
- Compliance/suppression tags are preserved verbatim; the send gates are untouched.
- Full backup + one-command restore; the migration is idempotent (re-runnable, no double-apply).
- Blast radius (dry-run will confirm): ~1,038 tags → fields, ~166 deleted, ~119 collapsed to canonical,
  ~40 kept; ~18K contacts touched (mostly tag-array rewrites), 0 contacts lose compliance or contact data.

## 8. Open items for Matt

1. **Feeder-market list** for Migration Realtors — use the observed set (greater Seattle/WA, CA metros
   incl. Bay Area + SoCal, Portland metro, Colorado Front Range), or a specific list you work?
2. **`neighborhood`** — RESOLVED (Matt 2026-07-03): move to a single-select **field** "Neighborhood",
   NOT a tag. A property is in exactly one neighborhood → single-valued → field. Populate in the
   migration by moving the existing 28 tag values (already assigned); going forward **derive from the
   owned-property address** (geocode + point-in-polygon against the Bend neighborhood boundaries the CRM
   already has, same mechanism as Out-Of-Area) so new contacts self-fill and it can't drift. Optional
   cheap follow-up: boundary-backfill to correct stale values. The existing "Neighborhoods" smart-list
   collection points at the field (filtering unchanged). Do NOT block the migration on geocoding 17K
   addresses — move-the-values now, derive forward.
3. The **83 manual-review tags** — you rule on these from the dry-run (they're the ambiguous ones like
   `SOI`, `sphere`, `long-term`, `high-lead-score`).
4. Approve → I run steps 1–2 and bring you the dry-run before anything writes.
