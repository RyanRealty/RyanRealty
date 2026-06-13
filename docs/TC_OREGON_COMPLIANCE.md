# TC Oregon Compliance Matrix

The legal spine of the in-house TC system. It maps **broker role** and **property
specifics** to the documents, disclosures, and obligations an Oregon residential
transaction requires — so the system can *anticipate* what a deal needs instead
of the broker having to remember it. Consumed by `lib/tc/required-documents.ts`
(the anticipation engine) and the deal-page "Documents anticipated" surface.

**Discipline (CLAUDE.md §0 + the tc-builder loop):** every rule here cites a
primary source — an Oregon Revised Statute (ORS), an Oregon Administrative Rule
(OAR ch. 863 / others), federal law, or the Oregon Real Estate Agency. Nothing
is asserted from memory. This is a compliance *aid for a licensed principal
broker*, not legal advice; Matt is the broker of record and the final authority.
When a rule can't be verified to a primary source, it is flagged, not encoded.

Last verified: 2026-06-09. Re-verify citations before relying on any rule; statutes
change.

---

## Always-required (every residential sale/purchase)

| Trigger | Required | OREF # | Citation + why |
|---|---|---|---|
| First contact with any party | Initial Agency Disclosure Pamphlet, delivered in writing at first contact | 042 | **ORS 696.820** + **OAR 863-015-0215** — agent must provide the pamphlet at first contact (in person, phone, internet, email); "first contact" = when the agent has enough contact info to deliver it. Informational only, not proof of agency. [ORS 696.820](https://oregon.public.law/statutes/ors_696.820) · [OAR 863-015-0215](https://oregon.public.law/rules/oar_863-015-0215) |
| Any sale of OR residential real property (with limited exemptions) | Seller's Property Disclosure Statement; buyer gets a **5-business-day** right to revoke after delivery unless waived | 020 | **ORS 105.464–105.475** — statutory SPDS (50+ questions); buyer may revoke the offer within 5 business days of delivery by signed written notice and gets an absolute earnest-money refund, unless waived at/prior to the sale agreement. [ORS 105.464](https://oregon.public.law/statutes/ors_105.464) |
| Convey fee title / land-sale-contract possession of a 1–4 family dwelling with a CO source | Properly functioning carbon-monoxide alarm(s) installed for all sleeping areas at transfer | 080 advisory | **ORS 105.836–105.838** — seller may not convey without working CO alarms; aggrieved buyer may recover greater of actual damages or $250/unit (does not invalidate the sale). [ORS 105.838](https://oregon.public.law/statutes/ors_105.838) |
| Any signed document executed electronically | E-sign consent + attribution + retained record | — (system) | **ORS ch. 84 (Oregon UETA)** + federal **ESIGN (15 USC 7001)** — an electronic record/signature is valid; UETA applies only where each party has agreed (from context/conduct) to transact electronically; e-signature = a sound/symbol/process executed with intent to sign. Our signing flow records consent, attribution (tokenized link + IP + timestamp), integrity (sha256 seal), and the signer copy. [ORS 84.013](https://oregon.public.law/statutes/ors_84.013) · [ORS 84.019](https://oregon.public.law/statutes/ors_84.019) |
| Every transaction (records duty) | Retain the complete transaction file | — (system) | **OAR 863-015-0250 / -0255 / -0260** — principal broker must keep records of all professional real estate activity for at least **6 years**. Our immutable storage + append-only `tc_events` satisfy this. [OAR 863-015-0255](https://oregon.public.law/rules/oar_863-015-0255) · [Records of Professional Real Estate Activity](https://www.oregon.gov/rea/brokerage/pages/business-record-keeping.aspx) |
| Commission / compensation records (rung 11) | Commission figures per cycle trace to the closing statement and settlement-era gross; corrections audit-trailed | — (system, `tc_commissions`) | **OAR 863-015-0250** enumerates the transaction records a principal broker must retain, including closing statements and "vouchers, bills, and client expenses paid by the broker" (verified 2026-06-10, [OAR 863-015-0250](https://oregon.public.law/rules/oar_863-015-0250)); retention period per **863-015-0260**. Note: 863-015-0255 governs clients' TRUST accounts (earnest money), not brokerage commission ledgers — commission tracking is business accounting layered on those retained records, with every figure carrying its settlement-verified source in `tc_commissions.source`. |
| Principal-broker document review (sign-off queue) | The managing principal broker reviews each **document of agreement within 7 banking days** of its acceptance/rejection/withdrawal; the system keeps a named + dated electronic review record per document. | — (system, `tc_principal_reviews` + `/admin/sign-off`) | **OAR 863-015-0140(4)** (amended eff. 2026-01-01 under HB 3137; verified 2026-06-13 against [oregon.public.law/rules/oar_863-015-0140](https://oregon.public.law/rules/oar_863-015-0140)): *"The principal broker must review each document of agreement generated in a real estate transaction within seven banking days after it has been accepted, rejected, or withdrawn."* Electronic review must *"make an electronic record of the review showing the name of the reviewer and the date of the review."* Our `recordPrincipalReview` writes that immutable record (reviewer name + `reviewed_at`); the sign-off queue surfaces the 7-banking-day deadline (`lib/tc/banking-days.ts`, weekends + US federal holidays excluded) and flags overdue items. Companion transmittal duty: associated broker forwards documents to the principal broker within **3 banking days** (OAR 863-015-0250). |

---

## Role-conditional (driven by the broker's side)

| Broker role | Required | OREF # | Citation + why |
|---|---|---|---|
| **Listing side** (seller's agent) | Exclusive listing agreement; seller completes the SPDS | 015, 020 | Listing employment contract is the engagement instrument; SPDS is the seller's statutory duty (ORS 105.464). |
| **Buyer side** (buyer's agent) | Buyer representation agreement before showing/representing | 050 (exclusive) / 052 (nonexclusive) | Written buyer-agency engagement (post-2024 NAR practice changes; OREF 050/052 are the OR instruments). Verify current OREA guidance before treating as a hard statutory gate. |
| **Disclosed dual / limited agency** (same firm both sides) | Disclosed Limited Agency Agreement(s) | 040 (sellers) / 041 (buyers) | **ORS 696.815 / 696.820** agency framework + OAR 863-015 — disclosed limited agency must be in writing and acknowledged when one firm represents both. [ORS ch. 696 agency](https://www.oregonlegislature.gov/bills_laws/ors/ors696.html) |
| Compensation arrangement / co-op | Compensation advisory + notice of real estate compensation | 047, 091 | Post-2024 compensation-transparency practice; OREF 047 advisory + 091 notice. Verify current requirement vs. advisory status. |

---

## Property-conditional (driven by the home's specifics)

| Property fact | Required | OREF # | Citation + why |
|---|---|---|---|
| **Domestic well** supplying groundwater | Test well for **arsenic, nitrates, total coliform** upon accepting an offer; submit results to OHA + buyer within **90 days**; + well addendum | 082 + lab + OHA data sheet | **ORS 448.271** (Domestic Well Testing Act) — seller must test on accepting an offer; results to OHA + buyer within 90 days; results valid 1 year. Capped wells on unimproved lots exempt. [ORS 448.271](https://oregon.public.law/statutes/ors_448.271) · [OHA Well Testing](https://www.oregon.gov/oha/PH/HEALTHYENVIRONMENTS/DRINKINGWATER/SOURCEWATER/DOMESTICWELLSAFETY/Pages/Testing-Regulations.aspx) |
| **Septic / on-site sewage** system | On-site sewage system addendum | 081 | Conveys septic condition/inspection terms; DEQ on-site program governs the system. (Form-driven; verify DEQ evaluation triggers per county.) |
| **HOA / planned community / condo** | Owner-association addendum + delivery of association documents (+ CC&Rs); condo adds the condo sale agreement | 023, 024, 031, condo SA | Buyer's review of association docs/CC&Rs; Oregon Planned Community Act (ORS ch. 94) / Condominium Act (ORS ch. 100) govern resale disclosure. Verify ORS 100.480 resale-disclosure timing for condos. |
| **Built before 1978** | Federal lead-based-paint disclosure + advisory; 10-day inspection opportunity | 018, 021 + federal | **42 USC 4852d / 24 CFR 35 (Subpart A)** — federal LBP disclosure for pre-1978 housing; buyer gets a 10-day window to inspect for LBP. [LBP disclosure rule](https://www.epa.gov/lead/real-estate-disclosure) |
| **Manufactured / mobile home** | Manufactured-home sale agreement (without land) or appropriate manufactured form | 012 | Manufactured homes follow a distinct conveyance + title path (ODOT/DMV for personal property vs. real property if affixed). |
| **Vacant land** | Vacant-land sale agreement + vacant-land disclosure + buyer advisory | 008, 019, 030 | Land lacks the SPDS; uses land-specific disclosure + due-diligence advisory. |
| **Solar panel system** | Solar panel system addendum (+ solar advisory) | 105, 116 | Conveys ownership/lease/PPA status of the system; advisory covers transfer pitfalls. |
| **Historic property** | Historic property advisory + addendum | 045, 045A | Discloses historic-designation constraints. |
| **Tenant-occupied** | Tenant-occupied advisory | 106 | Discloses tenancy + ORS ch. 90 landlord-tenant obligations surviving sale. |
| **Short sale** | Short-sale summary + addendum | 027x, 027B | Lender-approval contingency framework. |
| **Seller-carried financing** | Seller-carried advisory + transaction addendum (+ note/trust deed) | 032, 033, 034, 035 | Owner-financing structure; MLO/SAFE Act considerations. |
| **VA / FHA financing** | VA/FHA amendatory clause + real estate certification | 097 | Federal financing requires the amendatory clause protecting buyer if appraisal < price. |

---

## Disclosure-timing rules the system enforces

- **Initial agency disclosure** — at first contact, before substantive representation (ORS 696.820).
- **SPDS delivery → buyer 5-business-day revocation window** — the clock starts on delivery; the system tracks delivery date and the waiver state (ORS 105.475).
- **Well test** — ordered upon offer acceptance; results to OHA + buyer within 90 days (ORS 448.271).
- **LBP** — disclosure before the buyer is obligated; 10-day inspection window (24 CFR 35).
- **CO alarms** — in place at/before conveyance (ORS 105.838).

## Open items to verify before hard-gating (flagged, not yet encoded as mandatory)

- Buyer-representation-agreement timing as a statutory (vs. practice) gate — confirm current OREA / NAR-settlement posture for Oregon.
- Condo resale disclosure exact timing (ORS 100.480) and the planned-community resale packet (ORS 94.665).
- Septic evaluation triggers by county (Deschutes DIAL vs. statewide DEQ).
- Compensation advisory (047) vs. notice (091) — which is mandatory vs. recommended now.

## How the engine uses this

`lib/tc/required-documents.ts` encodes each row as a rule: `{ id, label, orefForm,
trigger: (role, facts) => boolean, citation, severity: 'required'|'conditional'|
'verify' }`. The deal surface evaluates rules against the cycle's role + known
property facts, cross-references the deal's existing checklist items/documents,
and renders **needed / present / missing**, with the citation one click away and
a "confirm this fact" prompt for anything unknown. New rules are added HERE first
(with a verified citation), then encoded — never the reverse.
