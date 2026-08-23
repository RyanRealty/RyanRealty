# Listings → Vault map — live 2026-08-23 + code

Look-only. **Create Listing not clicked.** Write A Listing opened Forms create as Seller, then **Cancel**.

## SkySlope Manage Listings (live)

URL: `Managelisting.aspx`. Columns: MLS# | Property Address | Status | Listing Agent | Office | Expiration Date | Listing Price | Stage | Actions.

### Active

| MLS | Address | Status | Agent | Expiration | Price |
|---|---|---|---|---|---|
| 220221088 | 5663 SW Impala Avenue, Redmond, OR 97756 | Active | Stevenson, Paul | 12/31/2026 | $650,000 |
| 220215931 | 19496 Tumalo Reservoir Rd, Bend, OR 97703 | Active | Ryan, Matt | 10/03/2026 | $1,350,000 |

Matches 22 Aug `skyslope-suite-walk/19-manage-listings.webp`. Stage column blank on both.

### Canceled Listings Pending Approval

| MLS | Address | Status | Agent | Expiration | Price |
|---|---|---|---|---|---|
| 220197955 | 56628 Sunstone Loop, Bend, OR 97707 | Canceled/Pend | Ryan, Matt | 08/31/2026 | $2,635,000 |
| (blank MLS) | 2970 NW Lucus Ct, Bend, OR 97703 | Canceled/Pend | Peterson, Rebecca | 08/31/2025 | $1,095,000 |

### Row kebab (Impala)

Accept Contract · Assign · Duplicate Listing · Withdraw Listing · Merge. None clicked.

## Write A Listing (clicked, cancelled)

Broker Home **Write A Listing** → new tab `forms.skyslope.com/create?representationType=Seller`.

Create Your File:

- File Owner (Matt)
- Representation radios: **Buyer · Tenant · Seller (checked) · Landlord**
- Create a Seller Net Sheet Yes (checked) / No — **not** used
- Primary client + Additional Contact
- Import MLS Data / address
- File name: Address or Primary client
- Brokerage templates: **OREF - New Team Listing Template** (Seller, 14 forms) · **OREF - New Listing Template** (Seller, 13 forms)

**Cancel.** No file created. Shots: `listings/pickup-43-write-listing-create.png`, `pickup-44-write-listing-create-full.png`.

This is **not** the green **Create Listing** button on Manage Listings (forbidden). It is the Forms create-file path (Suite twice).

## Vault code (not a live listing grid)

| SkySlope | Vault today |
|---|---|
| Manage Listings grid | **PARTIAL.** `/admin/listings` is MLS inventory. Closings active-listing lens shows MLS #, expiration, parties from the listing cycle, and search. Row kebabs (Accept/Assign/Duplicate/Withdraw/Merge) are not cloned. |
| Listing folder vs sale folder | `tc_cycles.kind` `'listing'` vs `'sale'`. Listing cycles can show on a deal as “Listing folder”. |
| Checklist Type “Residential — Standard” (seen on 3480 documents) | `tc_cycles.checklist_type` is a copied string, **not** a template table. Native create does not seed `tc_checklist_items` from OR/OREF library. |
| Expiration date on grid | Impala deal file walk (22 Aug) had expires 2026-12-31 — matches this grid. Closings active-listing lens now prints `tc_cycles.expiration_date` (this branch). |
| Write A Listing → Forms create Seller | Vault has no equivalent create-file UI. `createEnvelopeFromTemplate` has **no UI caller**. |
| Listing kebab Accept/Assign/Duplicate/Withdraw/Merge | On the deal (not a 14-col grid). Accept = sale cycle + pending. Assign = broker. Withdraw/Restore = stage. Duplicate = new listing file. Merge = cycles/people/contacts onto this file, other marked dead. |

## Do not build

A cloned SkySlope Offers product. Offer job is Vault + mail. Listing **pipeline** (grid + expiration + write-flow) is a Vault gap; it is not Offers.
