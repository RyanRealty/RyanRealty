# Vault admin inventory (codebase, 2026-08-21)

Nav source: lib/admin/nav.ts. Closings family: Board /admin/closings, Commissions, Financials, Forms.
Parked from nav (pages live): Signing, Sign-off.

## Routes
- /admin/closings — usable. Stage lanes from tc_deals. Not a 14-col Manage Transactions index. No Create / Assign / Cancel / Duplicate / Archive row actions.
- /admin/deals — redirect to closings.
- /admin/deals/[key] — usable deal file: cycles, docs, checklist, contacts, commissions, anticipated docs, envelopes, events.
- /admin/signing — usable, parked from nav.
- /admin/forms — usable if library loaded; catalog check is manual paste from SkySlope console.
- /admin/commissions — usable rollup.
- /admin/financials — usable P&L.
- /admin/sign-off — usable, parked from nav. 7-banking-day OAR 863-015-0140.
- /admin/tasks — missing. CRM /admin/crm/tasks is a different system.
- Create Transaction — missing. Partial: Start a deal from a person (address + role only).
- /admin/listings — MLS inventory, not listing-side TC pipeline.
- Dead deals — footnote count only.
- Archive — per-document flag on the deal, no cross-deal bucket.

## Beaumont (documented, not invented)
- Phrase "offer received, no response, let expire, never a SkySlope folder" is NOT in the repo.
- TC_SYSTEM: Beaumont 4 folders; dead-folder contamination; docs landing in dead folders.
- skyslope-master-file.mjs: dead Beaumont folder f9e68a69 still receiving uploads.
- Compliance skill: one SkySlope folder per property, not per sale agreement.
- CoS prior (this effort): Beaumont Offer 1 let expire with no counter, then Offers 2 and 3. Impala unread inbound offer. Offers that never entered SkySlope stay in email. No tc_offers table.
