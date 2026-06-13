# SkySlope — complete feature inventory → our TC system (parity + "do it better")

Cataloged 2026-06-13 from a deep live crawl of the authed SkySlope Suite + SkySlope Forms (Matt's session, in Chrome) plus the models we already hold: the compliance skill (`.claude/skills/skyslope-form-compliance/`), the Partnership API spec (`tmp/skyslope-master/skyslope-partner-openapi.json`), and `reference_skyslope_forms_api`. This is the build map to match SkySlope and beat it.

**Our TC today** (`docs/TC_SYSTEM.md`): `tc_deals → tc_cycles → tc_documents / tc_checklist_items / tc_events`, + `tc_commissions`, `tc_expenses`, `tc_deal_contacts`, the Oregon required-docs engine, sign-off queue, forms library, and the full envelope + e-signature system (shipped 2026-06-13). Surfaces: `/admin/deals`, `/admin/signing`, `/admin/commissions`, `/admin/financials`, `/admin/sign-off`, `/admin/forms`.

Legend: ✅ have · 🟡 partial · ❌ missing · ⭐ where we beat them.

---

## PART 1 — SkySlope Suite (transaction & listing management) — `app.skyslope.com`

### 1.1 Broker home / global nav
Quick actions: Write an Offer, Write a Listing. Global: **Documents to Review**, **Working Documents**, **Incomplete Checklist**, **Manage Transactions**, **Manage Listings**, **Dead Deals**, **Archive**, **Tasks (MyTasks)**, document viewer, **Search**, **office selector** (ALL / per office), **Apps** switcher, account menu.

### 1.2 Manage Transactions (the index)
- **Create Transaction** / Create Listing.
- Search + **Show All**; sort asc/desc.
- **Sortable/filter columns** (14): File Name, MLS#, Sales Price, Listing Price, List Date, Acceptance Date, Closing Date, Expiration Date, Escrow#, Agent, Office, Status, No. of Items (incomplete), Stage.
- **Stage Filter**, **Reviewer Filter**, **date-range filter** (acceptance/closing/expiration).
- Three workflow buckets: **Active**, **Canceled Transactions Pending Approval**, **Closed Transactions to be Archived**.
- Per-row: Status pill (Pre-Contract / Pending / Cancel-Pending / Closed), Agent, Office, Incomplete-Items count, Closing Date, Stage, **Log/Note**, row actions (**Assign, Cancel, Duplicate, Archive**).

### 1.3 Transaction detail — tabs: Transaction · Contacts · Commission · Checklist · Documents · Log · Tasks · Property
- **Transaction (property):** address, agent, close of escrow, sale price, buyer, acceptance date, escrow#, **per-deal inbound EMAIL** (`<Address>@skyslope.com` → email-to-file ingest), seller, **Reviewer** (assignable), year built, **Type** (Sale/Listing), **Checklist Type** (e.g. "Residential — Standard"), office. **Transaction Actions:** Download Summary, Cancel, Close, Duplicate. "Linked to Forms" badge ties the deal to its Forms file.
- **Contacts:** 8 contact roles — **Seller/Landlord, Purchaser/Tenant, Title/Escrow/Attorney, Agent Representing Other Side, Lender, Home Warranty, Transaction Coordinator, Misc**. Each: address-book search OR new contact; "is a trust/company/entity" toggle; first/last/company/email/full address/phone/alt phone/fax/notes/forwarding address.
- **Commission:** sale price, personal-deal flag, listing commission (%/$), office gross commission, sale commission (%/$), admin brokerage comp; **TC name + fee**; **deposits** (brokerage holds earnest money? amount, check date, log-book date); **referral** (none/external/internal, referral agent, brokerage, amount, W9 PDF); commission instructions + private note; **Commission Split / Breakdown — multiple payees (name / address-phone-fax / amount)** ← this is SkySlope's multi-agent payout.
- **Checklist:** per **Checklist Type** template; document **groups** — Buyer Agreement, Sales, Disclosure, Reports, Miscellaneous, Closing, Listing — each with ordered items; per-item **Status** (If Applicable / Incomplete / Pending / Completed / Required / Not Required / Must Upload), **Attach**, **Accept/Unaccept**; status filter; **Add New** item per group; **Order Home Warranty**; **Update Agent**; **Docs to Review**. (The full Oregon OREF item list is captured below in Appendix A — gold for our required-docs engine.)
- **Documents:** stored docs per deal. **Log:** activity history. **Tasks:** per-deal tasks. **Property:** property details.

### 1.4 Other Suite surfaces
Manage Listings (listing-side pipeline) · Incomplete Checklists (cross-deal) · Documents to Review queue (broker accept/reject across deals) · Working Documents · Dead Deals · Archive · Tasks (MyTasks) · multi-office scoping · reviewer assignment · checklist-type templates.

## PART 2 — SkySlope Forms — `forms.skyslope.com`
Nav: **Files · Templates · Browse Libraries · Clauses · Buyer Agreements · Leaderboard** · Help · Apps.
- **Files:** All / My / Archive tabs (counts); search; grid/list; **Filter By**; per file: name, agent, **Representation** (Buyer/Seller), **Forms count + Envelopes count**, More Options; detail at `/file/{id}/documents`. **Create**, **Start Buyer Agreement**.
- **Create by representation:** Write an Offer (`?representationType=buyer`), Write a Listing (`?representationType=seller`), Start Buyer Agreement.
- **Browse Libraries:** **Filter by library** — **Oregon Data Share (MLSCO, KCAR, SOMLS) — ODS**, **Oregon Real Estate Forms — OREF**, **Oregon Realtors — OR**, + **"Add additional association libraries."** 294 forms; search; per-form **Add** (to a file). Forms numbered/versioned (e.g. "1.1 Oregon Residential Real Estate Purchase And Sale Agreement — OR").
- **Templates:** saved form packets (pre-built sets of forms).
- **Clauses:** **My Clauses + Brokerage Clauses**, categorized, search, **Add Clause** — reusable text inserts into forms.
- **Buyer Agreements:** dedicated buyer-rep agreement flow.
- **Leaderboard:** usage/production gamification across the brokerage.
- Per file: fill forms (auto-merge transaction data), **field placement editor**, build **envelopes** for signature (DigiSign).

## PART 3 — DigiSign (e-signature)
Envelopes from file documents; block types **signature, initials, date, text, checkbox, strike**; recipients + roles + **signing order**; email signing (no login); per-envelope **audit certificate**; reminders + per-recipient status; sealed copy to all parties.

## PART 4 — Product family (Apps switcher)
SkySlope (TC) · Forms · DigiSign · **Offers** (listing-side offer collection + comparison) · **SkyTC** (done-for-you human TC service) · **Breeze** (modern UI reskin) · **Books** (commission disbursement + brokerage accounting) · **SkySight** (broker analytics mobile) · **Ayce** (AI coaching) · **Smart Suite** (AI features) · **MLS-Connect** · **Member Benefits**.

---

## PART 5 — Gap map vs our TC system

| Area | SkySlope | Our status | Plan |
|---|---|---|---|
| **Create deal/listing** | Create Transaction/Listing intake | ❌ migrated-only | **Build the create flow** (MLS pre-fill from Spark). Front door. |
| **Transactions index** | 14-col filter, stage/reviewer filters, 3 buckets, row actions | 🟡 basic list | Filterable index + buckets + assign/cancel/duplicate/archive. |
| **Multiple agents on a deal** | Primary agent + **Update Agent** + **commission split/breakdown (N payees)** + co-agent via "agent representing other side" + reviewer | 🟡 `tc_commissions` has per-agent splits; single primary agent; no co-agent assignment UI | ⭐ **Build a `tc_deal_agents` model** (primary + co-agents + reviewer + roles + split %), surfaced on the deal — cleaner than SkySlope's split-buried approach. |
| **Contacts (8 roles)** | Seller/Buyer/Title/Escrow/Other-agent/Lender/Warranty/TC/Misc + entity toggle + address book | ✅ `tc_deal_contacts` (co-agents, lender, title, escrow, TC, etc.) | Add the trust/entity toggle + a reusable address book + forwarding address. |
| **Commission detail** | %/$ both sides, office gross, admin comp, TC fee, deposits, referral+W9, split breakdown | ✅ `tc_commissions` + `/admin/financials` | Add deposits + referral + W9 capture + breakdown payees. |
| **Checklist** | Checklist TYPES with grouped items, per-item status incl. If-Applicable / Must-Upload, accept/unaccept | ✅ status transitions; 🟡 no checklist-type templates / grouping | ⭐ Our Oregon engine **anticipates by law** — add checklist-type templates + groups (Appendix A) and keep the law citations they lack. |
| **Reviewer + Docs-to-Review queue** | Per-deal reviewer; cross-deal review queue | ✅ `/admin/sign-off` | ⭐ Tie to the 7-banking-day OAR 863-015-0140 clock. |
| **Per-deal email ingest** | `<address>@skyslope.com` inbound filing | ❌ (Phase 3) | Per-deal inbound address → classify → file. |
| **Tasks** | MyTasks, per-deal | ❌ | `tc_tasks` (deal-scoped + standalone, due dates, assignee) → notifications + calendar. |
| **Dead deals** | Cancelled/expired bucket | 🟡 `dead_date` only | Dead/cancelled view + cancel action. |
| **Archive** | Broken UI (the reason we left) | ✅⭐ one flag + audit row | Keep — already better. |
| **Log** | Activity log | ✅⭐ immutable `tc_events`, ORS-defensible | — |
| **Forms: multiple libraries** | ODS / OREF / OR + add association libraries; 294 forms; per-form Add | 🟡 `tc_form_libraries` seeded (OREF/ODS/OR/RR); no production blanks, no browse-and-add | ⭐ **Pull Matt's licensed ODS+OREF+OR blanks** (`reference_skyslope_forms_api`); build a Browse-Libraries surface + per-form add to a deal. |
| **Forms: fill + field maps** | Auto-merge transaction data; place fields once per form | ✅ composer places fields on any PDF; ❌ no per-form saved field map / auto-fill | ⭐ **Template field-mapper + auto-fill from deal/MLS** — the big Forms differentiator. |
| **Templates** | Saved form packets | ❌ | `tc_form_packets` (a checklist-type's default form set). |
| **Clauses** | My + Brokerage clause library, categorized | ❌ | `tc_clauses` reusable snippets. |
| **Buyer Agreements** | Dedicated buyer-rep flow | 🟡 envelope flow exists | Buyer-rep wizard (mandatory since 2025 — OAR 863-015-0133). |
| **e-signature (DigiSign)** | Full | ✅ shipped (only "strike" block missing) | Add strike + auto-reminder cron. |
| **Offers** | Offer collection + comparison grid | ❌ | ⭐ High value — offer intake + comparison for listing clients. |
| **Reporting / SkySight** | Production + compliance reports, mobile | 🟡 commissions + financials | Compliance + production reports per agent/office/period. |
| **Books** | Disbursement + accounting | ✅ `tc_commissions` + financials P&L | Add CDA/disbursement docs. |
| **Leaderboard / Ayce / Smart Suite** | Gamification + AI coaching | ⭐ we're agent-native end to end | Our differentiator. |
| **Breeze (modern UI)** | Reskin of dated .aspx | ⭐ ours is modern Next + design system | Already ahead. |

---

## PART 6 — Prioritized build plan

**Tier 1 — the daily driver (front door + multi-agent + tasks):**
1. **Create Transaction/Listing** intake (MLS pre-fill).
2. **Transactions index v2** — filter columns, stage/agent/office/reviewer filters, 3 buckets, row actions.
3. **Multiple agents per deal** — `tc_deal_agents` (primary + co-agents + reviewer + role + split), surfaced on the deal + feeding commissions.
4. **Tasks** — `tc_tasks`.

**Tier 2 — the Forms moat (beat them on automation):**
5. **Pull licensed libraries** (ODS/OREF/OR blanks) + **Browse Libraries** surface + add-to-deal.
6. **Template field-mapper + auto-fill** from deal/MLS data; per-form saved field maps.
7. **Checklist-type templates + groups** (Appendix A) wired to the Oregon law engine.
8. **Templates (packets)** + **Clauses** libraries.

**Tier 3 — listing-side + completeness:**
9. **Offers** intake + comparison.
10. **Manage Listings** + listing checklist.
11. **Compliance + production reporting**; **dead-deals view**; **per-deal email ingest**; **buyer-agreement wizard**; strike field + auto-reminders.

**Already ahead of SkySlope:** archiving (one flag, no lock bug), immutable ORS-defensible audit, law-cited document anticipation, modern agent-native UI, inline ESIGN/UETA certificates. Lead with these.

---

## Appendix A — the live Oregon checklist (from the Beaumont deal, "Residential — Standard")
Groups + items observed — the template to encode for our checklist-type + required-docs engine:

- **Buyer Agreement:** Buyers Rep Agreement · Disclosed Limited Agency · Record of Properties Shown · CMA or Comparables
- **Sales:** Residential Sale Agreement · Pre-Approval/Proof of Funds · Counter Offers · Sale Addendums · Professional Inspection Addendum · Repair Addendums · Delivery Addendum · Owner Association Addendum · Solar Panel Addendum · Wood Stove/Fireplace Insert Addendum · Contingency Removal Addendum · Agreement to Occupy · Bill of Sale · VA/FHA Amendatory Clause · Contingent Right to Purchase · Notice of Real Estate Compensation (OREF 091) · Termination of Contract
- **Disclosure:** Sellers Property Disclosures · Lead-Based Paint Disclosure · Electronic Funds Advisory · Real Estate Compensation Advisory · FIRPTA Advisory · Real Estate Forms Advisory · Smoke Alarms Advisory · Association Advisory · Lead-Based Paint Advisory
- **Reports:** CCRs · Association Documents · Appraisal · Home Inspection
- **Miscellaneous:** Documentation of Repairs/Maintenance · Transaction Timeline · Broker Notes
- **Closing:** Broker Commission Demand from Title · Earnest Money Receipt · Preliminary Title Report · Closing Statement (CD/ALTA/HUD) · Initial Agency Disclosure (042)
- **Listing:** Initial Agency Disclosure (042) · Listing Agreement + SA (015) · MLS Residential Input Form (ODS) · Sellers Property Disclosures · Disclosed Limited Agency · Listing Change Forms · Sellers Estimated Net Sheet · CMA or Comparables · Cancellation/Expired MLS Page · Association & CCRs

Cross-reference this against `docs/TC_OREGON_COMPLIANCE.md` (our cited matrix) when building checklist-type templates.

Source of truth for status: `docs/TC_SYSTEM.md`. This file is the parity ledger — update each row as it ships.
