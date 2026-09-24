# Vault mail audit — 2026-09-23

Read-only. `npx tsx scripts/tc-mail-backfill.ts audit --since 2026-08-22`, rules `mail-rules-v2-2026-09-23`,
all three broker mailboxes (matt@, paul@, rebeccapeterson@) through the Workspace service account, run 2026-09-23.
Nothing in Gmail or the database changed. Source for every count in `docs/TC_MAIL_FILING_RULES.md`.

## What the current rules decide (5,338 unique messages since 2026-08-22)

| Decision | Messages |
|---|---|
| bulk | 3,734 |
| not_deal | 1,179 |
| filed | 372 |
| unfiled_transaction | 53 |

Filed across 19 files:

| File | Messages |
|---|---|
| 19496 Tumalo Reservoir Rd, Bend, OR, 97703 | 61 |
| 54474 Huntington Road, Bend, OR, 97707 | 57 |
| 3480 SW 45th Street, Redmond, OR, 97756 | 45 |
| 60935 Apollo Place, Bend, OR 97702 | 30 |
| 2840 NE Sedalia Loop, Bend, OR 97701 | 29 |
| 712 SW 1st St, Madras, OR, 97741 | 25 |
| 29500 Ochoco Way, Prineville, OR, 97754 | 22 |
| 2129 35th Street, Redmond, OR, 97756 | 20 |
| 61271 Kwinnum Drive, Bend, OR, 97702 | 19 |
| 1974 NW Newport Hills, Bend, OR, 97703 | 18 |
| 15352 Bear St, La Pine, OR, 97739 | 15 |
| 56111 School House Rd, Bend, OR, 97707 | 8 |
| 20702 Beaumont Drive, Bend, OR, 97701 | 7 |
| 2732 Ordway Avenue, Bend, OR, 97703 | 7 |
| 64350 Old Bend Redmond Hwy, Bend, OR, 97703 | 3 |
| 5663 Impala Avenue, Redmond, OR, 97756 | 2 |
| 56628 Sunstone Loop, Bend, OR, 97707 | 2 |
| 820 NW 12th Street, Bend, OR, 97703 | 1 |
| 218 SW 4th St, Redmond, OR, 97756 | 1 |

Queued (53): 52 are one transaction with no file, 909 NW Delaware Ave (offer, escrow opened, inspections, title, closing, final settlement statement); the rest: 1.

## What the 2026-08-23 filer did in the same window

- Filings: 3,295
- Agree with the current rules: 89
- Message no longer in any mailbox (left alone): 21
- Wrong: 3,185

| File | Wrong filings | Documents to archive |
|---|---|---|
| 56111 School House Rd, Bend, OR, 97707 | 3,077 | 88 |
| 19496 Tumalo Reservoir Rd, Bend, OR, 97703 | 77 | 27 |
| 19571 SW Simpson Ave, Bend, OR, 97702 | 15 | 4 |
| 2840 NE Sedalia Loop, Bend, OR 97701 | 7 | 0 |
| 20702 Beaumont Drive, Bend, OR, 97701 | 6 | 0 |
| 5663 Impala Avenue, Redmond, OR, 97756 | 3 | 0 |
