# Westside-import data-quality sweep — flag list for Matt (2026-07-02)

**READ-ONLY sweep. Nothing was mutated.** This report + `out/westside-mismatch-flags.csv` are the
only writes. No parcel data is stripped until Matt approves per-flag or per-batch.

## Why

The 2026-05-27 westside CSV import update-matched **2,880 pre-existing contacts** (dedupe on
email OR phone+name) and stamped county deed-owner parcel data onto them: parcel address, APN,
valuation, equity/tenure tags, seller scores, and a broker-brief Background. The Hoffman case
(#13014) proved the vendor skip-trace can attach a parcel to the WRONG household — a San Diego
couple (619 phones) was stamped as the owner-occupant of 20223 Star Ridge Ct under the deed name
"Kevin Hoffman". Matt confirmed the data was wrong and it was stripped. This sweep hunts for
every other likely instance.

## Population (verified live, count:'exact' discipline)

| Segment | Count | Note |
|---|---|---|
| Contacts carrying `import:westside-2026-05` (not deleted) | 7,673 | |
| — net-new county rows (created 2026-05-26/27 by the import) | 4,794 | CANNOT be mis-matched: they ARE the deed owner |
| — update-matched pre-existing contacts (created before 2026-05-26) | **2,879** | the at-risk population (2,880 minus the repaired Hoffman #13014, whose westside tags were stripped) |

## Detectors (validated on the known cases BEFORE output was trusted)

| Detector | Signal | Hoffman signature |
|---|---|---|
| **A. Geography conflict** | `owner:occupied` stamp vs (A1) ALL phone area codes outside Oregon (541/458/503/971) and/or (A2) a pre-existing non-Property address outside Oregon | 619 San Diego phones vs "owner-occupied 25 yr" stamp |
| **B. Name conflict** | a family email local-part (contains the stamped surname) carries a DIFFERENT first name than the stamped deed-owner first name (nickname-aware, initials-suppressed, middle-name-suppressed) | `mariahoffman1@aol.com` vs stamped "Kevin" |

**Smoke tests (both must pass or the script refuses to emit output — `scripts/_westside-mismatch-sweep.mjs`):**
- Reconstructed pre-repair Hoffman #13014 (deed stamp "Kevin Hoffman" + owner-occupied long-tenure
  + 619 phones + mariahoffman1@aol.com) → flags **high** on BOTH detectors, alt identity "maria" ✅
- Live Steve Olivieri #5694 (parcel 530 NW Georgia Ave genuinely his, Matt-confirmed) → **zero
  signals** ✅ (and DIAL returns OWNER "OLIVIER, LANNY & STEVEN" mailing to his own Springfield
  address — the honest-both-directions check)

**Confidence rubric:**
- **high** — name conflict AND a geography conflict (the full Hoffman signature)
- **medium** — name conflict alone; or owner-occupied + out-of-state phones + out-of-state address;
  or owner-occupied + out-of-state phones + 13+ yr tenure stamp
- **low** — owner-occupied + a single geography signal (out-of-area cells are common for genuine
  Bend transplants; listed for completeness, not for action)

## DIAL verification (authoritative owner-of-record)

Top flags (all high + top medium, cap 250) were checked against the Deschutes County DIAL taxlot
layer (`maps.deschutes.org … Dial2_Taxlots`, ACCOUNT_ID = the stamped APN), per the
GIS-authoritative-only rule. Per flag the CSV carries DIAL OWNER, IN_CARE_OF, mailing address,
situs, and a verdict:

- **false-positive: email identity IS on the deed** — e.g. deed "SMITH, JOHN & MARY" and the
  "conflicting" email is mary…@ → the spouse is on the deed, parcel is genuinely theirs → *looks fine*.
- **likely fine: county mails the owner at this contact's own address** — the contact's pre-existing
  address equals the DIAL tax-mailing address → they ARE the owner (absentee) → *looks fine*.
- **deed matches STAMPED name only — contact identity unproven (Hoffman pattern)** — DIAL confirms
  the deed name, but that is the name the import STAMPED, so it can't clear the contact. The
  pre-import identity evidence (email/phones) still contradicts → flag stands.
- **deed owner surname differs from stamped name** — stamp/APN drift, needs Matt.

Note the deed-name circularity: the import overwrote contact names WITH the deed name, so
"DIAL owner == CRM name" alone can never clear a flag. Only the contact's pre-import identity
signals (family email, own mailing address on the deed's tax-mailing line) can.

## Results

**995 flags across the 2,879 at-risk contacts** (high 113 · medium 376 · low 506). The top 250
(all high + top medium) were DIAL-verified against the county deed of record.

### The actionable set — 114 "Hoffman-pattern" flags (75 high-confidence)

DIAL confirms the stamped deed name, but the contact's **pre-import identity** (their own family
email and/or phones) names a different person — the exact Star Ridge signature. These are the
records where the county skip-trace most likely stapled the wrong household's parcel onto a real
contact. **Recommended: strip the parcel data** (same strip applied to Maria Hoffman #13014) after
your per-batch OK. The CSV lists each with its stamped parcel, the contradicting identity, and the
DIAL owner line.

### Cleared by DIAL — no action

- **32 false-positives** — the "conflicting" email identity is actually ON the deed (a spouse);
  the parcel is genuinely theirs. Some may deserve a spouse relationship row instead (optional).
- **86 likely-fine** — the county mails the tax bill to this contact's own pre-import
  address, i.e. they ARE the (absentee) owner.

### Not yet DIAL-checked — 745 flags

Mostly the medium/low tail below the top-250 DIAL cap. Re-runnable with a higher cap
(`node scripts/_westside-mismatch-sweep.mjs --skip-extract`) if you want the full set verified;
the detector caveat stands (out-of-area cells are common for genuine Bend transplants, so low-
confidence geography-only hits are noise-heavy and listed for completeness, not action).

## Recommended next step

Matt reviews `out/westside-mismatch-flags.csv` (sorted: high first, then by pre-import engagement).
Suggested batch actions:
1. **high + "Hoffman pattern" DIAL verdict** — strip parcel data (same strip as #13014: parcel
   address, custom property fields, parcel-derived tags, Background brief) after Matt's per-batch OK.
2. **false-positive / likely-fine verdicts** — no action; spouse-on-deed cases may instead deserve
   a spouse relationship row (separate, optional).
3. **medium without DIAL clearance** — Matt eyeballs; anything he recognizes as a real relationship
   with wrong parcel data gets the strip.
4. **low** — leave; re-visit only if a send campaign will use parcel merge fields.

## Provenance

- Sweep script: `scripts/_westside-mismatch-sweep.mjs` (read-only; smoke-gated; re-runnable —
  `node scripts/_westside-mismatch-sweep.mjs --skip-extract` reuses the cached extraction)
- Flag CSV: `out/westside-mismatch-flags.csv` · summary: `out/westside-sweep/summary.json`
- Population extraction: live Supabase `crm_people` (`import:westside-2026-05` tag, `deleted=false`,
  `fub_created_at < 2026-05-26`), engagement from `crm_timeline` pre-import rows
- Owner-of-record: Deschutes DIAL ArcGIS taxlot layer (public, ~3 req/s max, 300 ms spacing)
- Sibling-agent guard: flags whose surname matches the 14 in-flight couple-split pairs are marked
  `split_agent_overlap=YES` in the CSV — those records may be mid-split; re-check before acting.
