# Westside parcel strip — wrong-household cleanup (2026-07-02)

**Matt-approved 2026-07-02: "Clean up the wrong household."** Surgical removal of the
import-stamped county parcel data from the high-confidence wrong-household contacts the
2026-07-02 sweep flagged (`docs/plans/WESTSIDE_DATA_SWEEP_2026-07-02.md`). Maximum
reversibility: full backup written before any mutation, one-command restore built and
tested, per-contact Change Log audit rows, idempotent strip. Reference template: the
earlier Maria Hoffman #13014 Star Ridge strip (commit 624c864d).

## Target set

The strip targets the `out/westside-mismatch-flags.csv` rows where
`confidence == 'high'` AND `dial_verdict` contains `'Hoffman pattern'` — DIAL confirms the
stamped deed name, but the contact's own pre-import email/phone identity names a different
person = the county skip-trace stapled the WRONG household's parcel onto a real lead.

- **75** flags matched the target criteria (in the expected 70–80 window). IDs cached to
  `out/westside-target-ids.json`.
- **67 stripped.**
- **8 skipped for manual review** (left fully intact, handed to Matt):
  - `8036` Marx Wein, `8161` Sian Heyworth — carry expired-listing data (customMLSNumber,
    customListingStatus=Expired/Cancelled, customListingExpiredDate + Expired/ExpiredWave
    tags). This overlaps Matt's expired-listing pipeline gold; not auto-stripped.
  - `11727` Jonathan Gemme — `intent:expired-listing` / `expired-status:expired` pipeline.
  - `2401` Patrick Acton, `6729` Thomas Howard — Real Estate Agent / broker-recruit sphere.
  - `5173` Peter Mccaffrey, `12362` David Moore — realtor records (customBrokerage +
    customRealtorLicense + broker-recruit tags).
  - `12099` Diana Robinson — `split_agent_overlap=YES` (surname matches an in-flight
    couple-split pair; may be mid-split, so left untouched).

## What was removed (county-import-stamped only)

Rules are the single source of truth in `scripts/_westside-strip-rules.mjs`, shared by the
backup, strip, and restore scripts so all three agree.

- **Tags** — `import:westside-2026-05`, `source:county-assessor`, `area:bend-westside`,
  `fb-audience:westside-all`, `source:farm-merge-2026-06`, the legacy un-namespaced stamps
  (`owner-occupied`, `absentee`, `long-term`, `recent-purchase`, `high-equity`,
  `high-lead-score`), and every tag under the parcel-derived prefixes `owner:`, `equity:`,
  `tenure:`, `seller-score:`, `neighborhood:`, `subdivision:`, `geo:`, `lifecycle:`.
- **Custom (jsonb) fields** — the 28 county-assessor / enrichment keys
  (`customSellerPropertyAddress`, `customAPN`, `customYearBuilt`, `customBuildingSqft`,
  `customBaths`, `customBedrooms`, `customSubdivision`, `customNeighborhood`,
  `customPlannedCommunity`, `customPurchasePrice`/`Year`/`Date`, `customLastPurchaseDate`,
  `customHomeAnniversary`, `customMarketValue`, `customEstimatedMarketValue`,
  `customEquityPct`, `customYearsOwned`, `customSellerScore`/`Band`, `customLeadScore`,
  `customLeadTier`, `customClassification`, `customIncludeInFBCAS`, `customOpenHouseAddress`,
  `customPhoneType`, `customEnrichmentProvider`). Verified 2026-07-02: every custom key on
  the 75 flagged contacts is county/enrichment-derived — zero Matt-authored keys.
- **Addresses** — both import-stamped shapes: (1) the blank-type row whose street equals
  `customSellerPropertyAddress`, and (2) every `type:"Property"` row (the Zillow-enrich
  parcel match). **68 stamped address rows removed, 24 real pre-import identity addresses
  kept** — every kept address is a blank-type, non-stamped row (the out-of-state mailing
  address that is the exact identity signal proving the mismatch, e.g. Allyson Crowe's
  Santa Barbara CA address). The rule keys on address TYPE + street match, never on `zpid`
  (21 of 24 real-identity rows also carry a zpid, so zpid is not a stamped-marker).
- **Background** — the stamped homeowner-brief only (matches `WESTSIDE HOMEOWNER` /
  `INDUSTRY REALTOR` header + `NEXT STEPS` block). All 67 had the template background; **0**
  had a non-template (Matt-written) background. Had any been non-template, it would have been
  KEPT and flagged for manual review, not stripped.

## What was preserved

Real contact points (phones + emails — stored in `crm_contact_points` and mirrored jsonb,
never touched), stage, relationships, and all real tags (`Import`, `Bend`, `city:*`,
`state:*`, `audience:*`, `seller:*`, `compliance:*`, `contact:*`, `email:*`, `enrich:*`,
`Expired*`, `industry:*`, `brokerage:*`, `1M`/`2M`/`3M`, `Matt Ryan`, …).

## Reversibility

- **Backup (restore source of truth):** `out/westside-strip-backup.json` — the COMPLETE
  pre-strip state (tags, custom, addresses, background) of all 75 flagged contacts, written
  before any mutation. Gitignored (PII) — referenced by path, never committed.
- **One-command undo:**
  `node scripts/_westside-parcel-restore.mjs --apply` (restore all) or
  `node scripts/_westside-parcel-restore.mjs --apply --ids <id,id>` (restore specific).
  Restores byte-for-byte and writes a "RESTORED from backup" Change Log row. Idempotent.
- **Per-contact audit:** every stripped contact got a `crm_timeline` `kind='system'` row —
  "Westside parcel data removed (wrong-household skip-trace match, Matt-approved 2026-07-02)"
  — listing every removed field and pointing at the backup + restore script.

## Verification (live, dev server, real crm_* data)

- **Smoke (id 9828 Allyson Crowe):** stripped live → CRM page confirmed the WESTSIDE
  HOMEOWNER background, Seller Property Address, Year Built, Market Value, and APN no longer
  render; the real Santa Barbara CA address, phone, email, and Seller Prospect stage remain;
  the Change Log removal row shows at the top of the timeline. Restored from backup →
  verified byte-identical to pre-strip (34 tags, 24 custom keys, 2 addresses, background all
  match). Re-stripped in the batch.
- **Batch (67):** post-strip DB scan — 0 residual county tags, 0 county custom keys, 0
  stamped addresses, 0 stamped backgrounds; 0 contacts lost all contact points; all retain a
  stage; all 67 have a removal audit row.
- **Idempotency:** second `--apply` run = 0 stripped, 67 no-op.
- **8 skips:** all fully intact vs backup.
- **No regression:** the f99a45df custom-field display fix still renders legit enrichment
  fields on a non-target (18187 Katherine Hamada — Year Built, Seller Property Address,
  Subdivision, Classification, background all present; she is a genuine owner, not a flag).

## Scripts

- `scripts/_westside-strip-rules.mjs` — shared strip rules (pure `computeStrip`).
- `scripts/_westside-parcel-backup.mjs` — full backup (run first).
- `scripts/_westside-parcel-strip.mjs` — the strip (`--dry-run` / `--smoke <id>` / `--apply`).
- `scripts/_westside-parcel-restore.mjs` — one-command undo (`--dry-run` / `--apply` / `--ids`).
