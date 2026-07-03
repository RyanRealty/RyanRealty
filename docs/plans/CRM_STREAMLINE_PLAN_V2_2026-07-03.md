# CRM Streamline Plan v2 — Corrected & Execution-Ready (2026-07-03)

> **Supersedes the *execution* halves of `CRM_TAG_SMARTLIST_STREAMLINE_PLAN_2026-07-03.md` and
> `CRM_STAGES_AUTOMATION_2026-07-03.md`.** The *design intent* of both is kept; this doc replaces
> the parts the adversarial audit ([`CRM_STREAMLINE_AUDIT_FINDINGS_2026-07-03.md`](CRM_STREAMLINE_AUDIT_FINDINGS_2026-07-03.md))
> proved wrong or unbuilt. Every fix below cites the finding it closes. **Status: PROPOSAL — nothing
> runs until Matt approves.** The in-tree scripts (`_tag-streamline-migrate.mjs`, `lib/tag-streamline.mjs`)
> are treated as a *starting point to be corrected*, not as ready.

Author: Claude (Opus session, 2026-07-03).

---

## 0. What the audit changed (one-line each)

| Finding | v1 said | v2 does |
|---|---|---|
| P0-1 | "move to field" (non-destructive) | **Actually write the field** before dropping the tag; nothing is dropped until its data is captured |
| P0-2 | backup after the loop | **Full pre-image backup to disk BEFORE the first write** |
| P0-3 | "re-runnable + undo" | backup is **write-once/versioned**; a resume never clobbers the original |
| P0-4 | Sellers = stage Seller Prospect | **Sellers = `segment:seller`**, backfilled from both signals; stage remap runs *after* the tag exists |
| P0-5 | derive realtor local/migration | **built** — `industry:realtor` kept as base + `realtor:local`/`:migration` emitted; drop rules reversed |
| P1-1 | segment:buyer/seller "already canonical" | **emit** `segment:buyer`/`segment:seller` from the audience/bare tags |
| P1-2 | one coordinated batch | build the **4 missing pieces** (field-write, stage script, list rebuild, demote) before calling it a migration |
| P1-3 | demote on `last_activity_at` | demote on a **real two-way signal** computed from `crm_timeline` |
| P1-4 | move to existing fields | **create the missing fields**; neighborhood → single-select |
| P2-1/2 | keep email:*/do_not_text | add `do_not_text` to SACRED; decide email:* (recommend keep invalid/bounced) |
| P2-3 | Out-Of-Area = 1,743 | state the **address-complete ceiling** (~2,006 derivable) |
| P2-4 | address/market saved views | emit `segment:out-of-area` + `realtor:*` **as tags** so lists are plain tag filters |
| P2-5 | §7 blast-radius numbers | regenerate from the corrected map before the dry-run |

---

## 1. Corrected canonical taxonomy (the classifier rewrite)

The classifier (`lib/tag-streamline.mjs` `classify()` + `rewritePersonTags()`) is rebuilt so each family
produces the segment the smart lists key on. Changes from the in-tree version:

**Segments (emit the tag; additive — never lose attribution):**
- **`segment:expired`** — any `*expired*` signal adds it, INCLUDING `seller:expired-untouched`,
  `source:expired-listing-cron/-mls`, `intent:expired-listing`, `Expired`, `Expired Listings`,
  `ExpiredWave1-4`, `status:expired`, `expired-status:expired`, and `custom.customClassification='EXPIRED'`.
  The `source:*` attribution tag is **kept alongside** (source ≠ segment). Per-listing/per-date noise
  (`expired-mls:*`, `expired-detected:*`, `import:expired-backfill-*`) is still deleted. *(closes the
  expired-undercount half of P1-2.)*
- **`segment:fsbo`** — `FSBO`, `intent:fsbo`, any `*fsbo*`; keep `source:fsbo*` alongside.
- **`segment:buyer`** — `Buyer`, `Buyer Intent`, `audience:buyer`, `buyer:*` intent → add `segment:buyer`
  (keep the `buyer:*`/`audience:buyer` tier tag). *(closes P1-1.)*
- **`segment:seller`** — `audience:seller`, `seller:*` intent, **and** every contact whose *current* stage
  is `Seller Prospect` (the farm) → add `segment:seller`. This unifies the two conflicting definitions.
  **Recommended = the union (~7,524).** *(closes P0-4/P1-1. Matt: confirm union vs. tagged-only 3,511.)*
- **`segment:out-of-area`** — **emitted by the address derivation** (below) when `owner:absentee` AND
  `location` ∈ {out-of-area, out-of-state}. Makes the Out-Of-Area list a plain tag filter. *(closes P2-4.)*
- **`segment:vendor`** + `vendor:<type>` — deferred exactly as v1 §3.2 (no existing list; manual dropdown).

**Realtor (rebuilt — closes P0-5):**
- Keep **`industry:realtor`** as the base identity tag (remove it from move-to-field).
- Emit **`realtor:migration`** for a realtor carrying any `<City> realtor` feeder tag (the 10 present are
  all feeders: Seattle, San Francisco, Portland, Denver, San Diego, Boulder, La Mesa, Oakland, Beverly
  Hills, Los Angeles) **or** `migration broker`. Emit **`realtor:local`** for every other realtor.
- Realtor identity = `industry:realtor` tag **or** bare `Realtor` tag **or** stage `Real Estate Agent`
  (2,342 live). Fold bare `Realtor` into `industry:realtor` (don't just delete it).
- `audience:broker-recruit` (233) → treat as `realtor:local`, retire the recruit tag (Matt: no recruiting).
- `brokerage:*` → **`brokerage` field** (created — see §2), tag then dropped. `<City> realtor` feeder tags
  are consumed by the migration rule, then dropped.

**Occupancy / location (address-derived — unchanged logic, now also emits `segment:out-of-area`):**
- `deriveFromAddresses` keeps A/B/C shapes but now returns `segment:out-of-area` when absentee+non-local.
- **Coverage ceiling (state it in the dry-run, P2-3):** only 2,738 contacts have a `Property` address,
  2,615 have Property+mailing, **2,006** have Property+mailing-with-state (the only fully-derivable set).
  7,141 contacts (39%) have no address → `owner:unknown`, no guess.

**Compliance (verified intact — keep as-is, two additions, P2-1/2):**
- SACRED set unchanged + **add `do_not_text`**. Confirmed: all 7 live `TAG_CHANNEL` send-gate tags are
  already SACRED; `crm_suppressions` untouched. **Matt decision:** keep `email:invalid`/`email:bounced`
  (v1 §3.1 said keep) vs. retire (recommend **keep invalid/bounced**, retire valid/unverified/catchall).

**Keep / retire:** `source:*`, `audience:*`, `seller:*`, `buyer:*`, `exclude:*`, `contact:do-not-*`,
`compliance:*`, `tcpa:*`, `segment:*`, `vendor:*` kept. Operational cruft (`import:*`, `auto:*`,
`fb-audience:*`, `owner-lookup:*`, `expired-mls/detected:*`, UTM) retired.

---

## 2. Fields — create the missing targets, then write them (closes P0-1, P1-4)

**New/changed `crm_field_definitions` (a migration ships these first):**
- `brokerage` (text, group Property) — **new** (163 contacts lose it today with no field).
- `city` (text, Property) — **new** (11,099 tagged).
- `neighborhoodArea` (text, Property) — **new**, for `area:*` (7,606 tagged).
- `tenureBand` (text, Seller) — **new**, for `tenure:*` (~20k). *(Or: drop — it's recomputable from
  `purchaseDate`. Recommend **create**, cheap.)*
- **`neighborhood` → convert to single-select** (`type=select`, options = the 28 values) + derive forward
  by point-in-polygon on the owned-property address (same boundary mechanism as Out-Of-Area). §8.2 intent.
- `subdivision`, `equityPercent`, `marketValue`, `yearsOwned`, `sellerScore` already exist → write into them.
- **Recompute-only families NOT preserved** (they self-regenerate; no field, tag deleted): `seller-score:*`
  bucket, `lead-tier`, `lifecycle:*`, `contact:has-*`/`contact:*-phone`. *(Matt: OK to drop these?)*

**Field-write step (new, runs BEFORE the tag drop):** for each move-to-field tag, upsert the value into
its `crm_people.custom` key **only where that key is empty** (never overwrite). Measured to preserve the
**2,643 neighborhood + 2,984 subdivision + 163 brokerage** values that would otherwise be lost. A tag is
only removed after its value is confirmed captured (or is in the recompute-only set).

---

## 3. Reversibility, made real (closes P0-2, P0-3)

1. **Single pre-image snapshot BEFORE any write.** Page all 18,226 non-deleted contacts, capture
   `{id, tags, stage, custom_touched_keys}` to `out/streamline-backup-<runId>.json`, `fsync`, verify row
   count == live count, THEN begin writes. No write happens before the backup exists on disk.
2. **Write-once backup.** `<runId>` is generated once; a resume reuses the same file and **refuses to
   overwrite** a different run's backup. Restore reads the immutable snapshot.
3. **Resumable, not re-derived.** A `crm_streamline_progress` marker (last processed id) lets an
   interrupted run continue from where it stopped against the *original* snapshot — a crash never leaves
   an un-backed-up mutation.
4. **Restore covers tags AND stage** (v1 restored tags only). One `--apply` rolls both back byte-faithful.
5. Dry-run writes **zero** (verified in v1 — kept).

---

## 4. Stages (closes P0-4 ordering, P1-2)

- Build `scripts/_stage-migration.mjs` + `_stage-migration-restore.mjs` (neither exists today).
- Old→new map (counts reconcile to live, all verified): Lead 8,265 · Seller Prospect 7,524 · A/B/C 48 ·
  Renter → **Nurture**; Active Client 12 → **Active**; Pending → **Under Contract**; Closed → **Closed**;
  Past Client 32 → **Past Client**; Real Estate Agent 2,342 · Vendor 1 → **Sphere**; Archive 2 → **Trash**.
- **Sequencing rule (the P0-4 fix):** stage remap runs **after** `segment:seller`/`industry:realtor` are on
  the contacts, so moving `Seller Prospect`→`Nurture` and `Real Estate Agent`→`Sphere` never orphans a list.
- Deactivate (don't delete) the old stage rows; the new stage rows already exist and are active.

---

## 5. Smart-list rebuild — in the same batch (closes P1-2)

Every saved view is repointed to a canonical filter in the migration (today they still key on old tags;
renaming a tag without repointing empties the view). Final set, all expressible as plain `{tagsAny}`/`{stage}`
filters because §1 now emits the derived tags:

| List | Filter | Expected (verify live post-migration) |
|---|---|---|
| Sellers | `segment:seller` | ~7,524 (union) |
| Buyers | `segment:buyer` | ~95 (Buyer 53 + audience:buyer 42, deduped) |
| Expired | `segment:expired` | ~650 (reconcile after the additive fold) |
| FSBO | `segment:fsbo` | ~21 |
| Out Of Area Home Owners | `segment:out-of-area` | ≤ 2,006 derivable; ~1,743 target |
| Local Realtors | `realtor:local` | ~2,240 |
| Migration Realtors | `realtor:migration` | ~100 |
| Vendors | `segment:vendor` | deferred |
| Active Clients · Past Clients · Pending · Compliance Blocked | stage / `compliance:hard-stop` | kept |

Retire the old views (Hot Prospects, Nurture, Seller Prospects, Stay In Touch, Email/IDX Activity, Realtors).
**Acceptance gate:** each list's live count is printed and sanity-checked before sign-off.

---

## 6. Automation (closes P1-3, P1-2)

- **`deriveCanonicalTags(person)`** — build the shared helper (does not exist). Called at lead creation,
  post-enrichment, and on address change. It recomputes (not appends) the derived tags and only ever ADDS
  compliance tags. The migration uses the same helper so one-time cleanup and ongoing rule can't drift.
- **Two-way activity source (the P1-3 fix):** do NOT use `last_activity_at` (written only by the manual
  call-log, on outbound outcomes, blind to inbound). Compute `last_two_way_at` from `crm_timeline`: inbound
  SMS/email rows + held-call outcomes (`Spoke with lead`) + kept appointments. Persist it (nightly) or query
  it in the sweep.
- **Demote sweep:** Engaged → Nurture when `now - last_two_way_at > 30d`. **Active/Under Contract exempt.**
  Build this + the transaction-side auto-moves first (highest value, lowest risk). Promotions stay gated on
  a real reply/form/appointment; soft signals (opens, IDX) raise `priority`, never move stage.

---

## 7. Execution order (one batch, on Matt's go)

```
0. Ship the new/changed field definitions (§2) + add do_not_text to SACRED.
1. PRE-IMAGE BACKUP to disk (tags + stage) — verify count, fsync — before any write. (§3)
2. FIELD-WRITE pass: capture every move-to-field value into custom (empty-only). (§2)
3. TAG rewrite with the corrected classifier: emit segment:*/realtor:*, keep compliance, drop captured/noise. (§1)
4. STAGE remap (after step 3 so lists survive) + deactivate old stages. (§4)
5. REBUILD saved views to canonical filters; retire old ones. (§5)
6. INSTALL deriveCanonicalTags hooks + the demote/transaction sweeps. (§6)
7. VERIFY: each list count vs a live query; a sample contact shows ~5 clean tags + enrichment as fields;
   compliance tags intact; stage distribution reconciles; regenerate the §7-v1 blast-radius numbers. (P2-5)
```

Dry-run (steps 1–5 in report-only mode) produces the real before/after for Matt, including the 83
manual-review tags, BEFORE any write.

---

## 8. Decisions for Matt (recommended defaults in bold — override any)

1. **Sellers = `segment:seller` as the union of `audience:seller` + stage `Seller Prospect` (~7,524).**
   (Alt: tagged-only 3,511.)
2. **Keep `email:invalid` + `email:bounced`; retire `email:valid/unverified/catchall`.**
3. **Create `brokerage`/`city`/`neighborhoodArea`/`tenureBand` fields and preserve those values; drop the
   recompute-only buckets (`seller-score:*`, `lead-tier`, `lifecycle:*`, `contact:has-*`).**
4. Feeder-market realtor rule stays **data-driven** (any `<City> realtor` tag = migration) — no hardcoded list.

Approve these four and the "go", and the build order is §7. Nothing writes before the dry-run is in front of you.
```
