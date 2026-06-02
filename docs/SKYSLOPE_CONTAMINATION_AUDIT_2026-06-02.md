# SkySlope Cross-Folder Contamination Audit — 2026-06-02

**Question:** which closed deals have documents that belong to a *different* deal/property, and are the source deals missing their own copies?

## Scope + method

All **21 closed deals** in Ryan Realty's SkySlope audited. Two evidence sources, both verified against **live** SkySlope state:

1. **17 folders** — the page-by-page subagent form-compliance analyses (every page of every PDF read; each doc's internal property + Sale Agreement # classified).
2. **4 folders** (712 SW 1st, Bear St, Ochoco Way, Nordic) — had no current analysis, so a **dedicated contamination scan** read each doc's page-1 property address and compared it to the folder's own property.

A document is "foreign" only when its **internal property address** is a genuinely different street than the folder's own (a prior offer cycle on the *same* property is native, not foreign). Two earlier subagent property verdicts were spot-wrong, so every contaminated-folder finding here was re-read against the actual PDF.

## Result: 4 of 21 folders held files from a different deal

| Folder | Foreign docs | From | Live status now |
|---|---|---|---|
| **Kwinnum** (61271 Kwinnum Dr) | **24** | 3 *other* deals — King (RRP01102025, "King Hezekiah / Dority Estate"), King Saul (RRP12302024), Brown Revere (RRP12162024) | all archived; **14 were still assigned to Counter Offers / Sale Addendums — unassigned this audit** |
| **703 SW 7th** | 13 | 122 SW 10th St (Hakkila, MR08012025 — a *canceled* deal) | all archived + unassigned ✓ |
| **Huntington** (54474 Huntington Rd) | 6 | 712 SW 1st St, Madras (a *failed Boynton offer*) | all archived + unassigned ✓ |
| **Old Bend** (64350 Old Bend Rd) | 1 | 3480 SW 45th (a Christel Panther SPD) | unassigned from all sale activities; the doc itself sits in Old Bend's **listing** folder (sale endpoint can't rename it — harmless, not on the checklist) |

**The other 17 folders are clean** — 712 SW 1st, Bear St, Ochoco Way, Nordic, 35th, Crowson, Ordway, Butler, Cedar, Penhollow, Newport, School House, Mayfield, Simpson, Drouillard, Jacklight, 3480 SW 45th. Every document references its own property.

## Source cross-reference — is anything *missing* from the source deals?

| Source | In our inventory? | Status |
|---|---|---|
| 122 SW 10th (→ 703) | Yes — `c1ac8195`, Canceled | Its own folder **has** its RSAs + counters. Nothing missing. |
| 3480 SW 45th (→ Old Bend) | Yes — `59152e77`, Closed | Its own SPD (`732a1d7f`) is in its folder. Nothing missing. |
| 712 SW 1st (→ Huntington) | Yes — `f50fe2a6`, Closed | Retains its own Boynton-cycle docs (e.g. EFA `5c3d1878`). The Huntington copies were duplicates. Nothing missing. |
| King / King Saul / Brown Revere (→ Kwinnum) | **No** — not in the 37-sale inventory pull | Can't confirm their folders from this pull. The Kwinnum copies are duplicates that don't belong there regardless. |

## Remediation applied this audit

- **Kwinnum** — unassigned 14 `WRONG-PROPERTY-RRP...` docs from Counter Offers + Sale Addendums (prior pass had renamed but not unassigned them). Now 0 foreign docs on the checklist.
- **Old Bend** — the stray 3480 SPD confirmed unassigned from all sale activities (it's a listing-folder doc; renaming it needs the listing endpoint).

## Open / optional follow-ups

1. **Kwinnum is the anomaly** — 24 documents from 3 *other* transactions in one folder. Now cleaned (archived + unassigned), but worth understanding how that happened (bulk-upload error? folder reused?).
2. **The King / King Saul / Brown Revere deals are not in the current 37-sale inventory pull.** If they're Ryan Realty transactions, a fuller SkySlope enumeration would let us confirm their own folders are complete.
3. **Listing-folder dedup** — the listing-side deals carry duplicate/foreign docs in their separate *listing* folders (e.g. Old Bend's 3480 SPD, Penhollow's 3 dups) that no sale-folder pass can touch. A listing-folder pass is the only remaining cleanup, if ever wanted.

## Bottom line

**4 of 21 closed deals had files from another deal; all are now archived and off their checklists.** No closed deal is missing its own documents (for the sources we can see). The cross-folder contamination is remediated on the sale side.
