# Oregon Real Estate Law Sweep — 2026-06-10 (DRAFT for Matt + tc-builder review)

Systematic coverage-gap sweep around the deal-document core in `docs/TC_OREGON_COMPLIANCE.md`.
Scope: ORS chapter 696 (license law), OAR chapter 863 (esp. divisions 14/15/25), advertising +
marketing compliance (state + federal), transaction-adjacent statutes, and brokerage-structure rules.

**Discipline:** every rule below cites a primary source actually fetched and read on 2026-06-10.
Where a fetch could not verify something, it sits in section (D) UNVERIFIED instead of being encoded.
This is a research DRAFT — nothing here has been written into `TC_OREGON_COMPLIANCE.md`,
`lib/tc/required-documents.ts`, or any gate. Matt reviews first.

**Headline findings (read these first):**

1. **HB 4058 (2024, eff. 2025-01-01) made written buyer representation agreements MANDATORY**
   for residential (1–4 unit) buyer representation, with required contents and a 24-month cap.
   The matrix's open item #1 ("verify current OREA posture") is resolved: it is now a hard legal
   gate, implemented by **OAR 863-015-0133** (new rule, adopted Dec 2024, amended Oct 2025).
2. **HB 3137 (2025, eff. 2026-01-01) is in effect NOW** and reshapes supervision and teams:
   "managing principal broker" designation, written supervisory agreements, **real estate team
   disclosure at first contact (new OAR 863-015-0143)**, team advertising amendments to
   863-015-0125, and a new mandatory **State and Federal Fair Housing CE course** at renewal.
   Several rules the platform might have modeled from pre-2026 sources were amended effective
   2026-01-01 — the SOS OARD versions are current; oregon.public.law lags on some.
3. **The principal broker must review every document of agreement within 7 banking days** of
   acceptance/rejection/withdrawal, with a timestamped electronic record of reviewer + date
   (OAR 863-015-0140). This is the exact legal spine for the tc-builder sign-off queue (rungs 13/14).
4. **A new wholesaling-disclosure rule (OAR 863-015-0245, eff. 2025-07-01)** exists. Not Ryan
   Realty's business today, but it has advertising-inclusion requirements if it ever touches a deal.
5. Three citation corrections to existing assumptions (section C), including the CO-alarm remedy
   statute and two mislabeled "open item" statutes in the matrix.

---

## (A) PROPOSED ADDITIONS to TC_OREGON_COMPLIANCE.md

Format: **Rule** | exact citation | source URL | fetched | proposed enforcement point.

### A1. Buyer representation agreement is now mandatory (resolves matrix open item #1)

- **Rule:** A licensee representing a buyer in a residential transaction (1–4 dwelling units) must
  act under a **written** buyer representation agreement, entered into before or as soon as
  reasonably practical after brokerage services begin. Required contents: (1) licensee's license
  number, (2) managing/supervising principal broker name + contact, (3) term with specific dates
  (**max 24 months including renewals**), (4) description of the buyer's agent's legal duties
  (statute reference or pamphlet), (5) buyer's search criteria + price range, (6) compensation
  explanation, (7) termination provisions for both parties, (8) exclusive vs. non-exclusive
  designation. Exception: transactions for property improved or improvable with commercial
  structures or 5+ residential units.
- **Citation:** HB 4058 (2024 Or. Laws ch. 3), eff. 2025-01-01; implemented by **OAR 863-015-0133**
  (adopted Dec 2024, amended Oct 2025 eff. 2026-01-01; authority ORS 696.385).
- **Sources:** https://secure.sos.state.or.us/oard/view.action?ruleNumber=863-015-0133 ·
  https://www.oregon.gov/rea/newsroom/pages/2024-oren-j/buyer-agreements-listing-agreements-law-rule-overview.aspx ·
  https://olis.oregonlegislature.gov/liz/2024R1/Measures/Overview/HB4058 — fetched 2026-06-10.
- **Enforcement:** upgrade the matrix `buyer-rep` rule from severity `verify` → `required` for
  buyer/dual roles; TC checklist gate; form-template validation (the 8 required elements + 24-month
  term cap) in the tc form composer.

### A2. Listing agreement statutory contents (extends the matrix's 015 row)

- **Rule:** Written listing agreement required **before marketing begins** (HB 4058). Every listing
  agreement must: state an expiration date; include the agent's license number, exclusivity
  statement, supervising principal broker contact, and legal-obligations description; max 24 months
  incl. renewals. Broker must give the seller "a true, legible copy of the signed listing agreement
  at the time of securing the listing." Prohibited provisions: requiring seller to give notice of
  intent to cancel after expiration; double-commission clauses when seller re-lists with another
  broker after termination/mutual consent. All parties sign.
- **Citation:** **OAR 863-015-0130** (Listing Agreements) + HB 4058 per OREA overview.
- **Sources:** https://oregon.public.law/rules/oar_863-015-0130 ·
  https://www.oregon.gov/rea/newsroom/pages/2024-oren-j/buyer-agreements-listing-agreements-law-rule-overview.aspx — fetched 2026-06-10.
- **Enforcement:** form-template validation when the agent-driven composer instantiates OREF 015;
  TC checklist "copy delivered to seller at signing" event.

### A3. Offers to purchase — handling + delivery deadlines

- **Rule (OAR 863-015-0135):** (1) give a true, legible copy of any offer/counter to the person
  signing it; (2) deliver all written offers/counters to the other party **without unreasonable
  delay**; (3) keep a record of when each offer/counter was delivered and the response (rejected
  offers: copy back to offeror); (4) once signed by both parties, deliver fully executed copies to
  both buyer and seller **within 3 banking days**; (5) offers must contain all terms (conveyance
  method, title evidence timing); (6) promissory-note earnest money must name payee + due date;
  (7) amendments must be in writing, currently dated, signed by all parties.
- **Source:** https://oregon.public.law/rules/oar_863-015-0135 — fetched 2026-06-10.
- **Enforcement:** TC timeline events (offer delivered / response recorded) + a 3-banking-day
  "deliver executed copies" deadline task auto-created at mutual acceptance.

### A4. Principal broker 7-banking-day document review (legal spine of the sign-off queue)

- **Rule (OAR 863-015-0140, amended eff. 2026-01-01 under HB 3137):** the (managing) principal
  broker must directly supervise associated licensees and must review **each document of agreement
  generated in a real estate transaction within seven banking days** after it is accepted, rejected,
  or withdrawn. Electronic review requires "an electronic record of the review showing the name of
  the reviewer and the date of the review"; hard-copy review requires written initials + date.
  A principal broker may not run a license-fee-only shop (rule §1) nor suggest associated licensees
  are independent of supervision (§2). Branch-office managers may review under ORS 696.200.
- **Sources:** https://secure.sos.state.or.us/oard/view.action?ruleNumber=863-015-0140 (current) ·
  https://www.law.cornell.edu/regulations/oregon/Or-Admin-Code-SS-863-015-0140 (pre-2026 text) — fetched 2026-06-10.
- **Enforcement:** the tc-builder sign-off queue (rungs 13/14) gets a hard 7-banking-day SLA per
  document with reviewer-name + date stamping (our `tc_events` already records this); dashboard
  breach alert to Matt.

### A5. Broker → principal broker document transmittal in 3 banking days

- **Rule (OAR 863-015-0250):** an associated real estate broker must forward transaction documents
  to the principal broker **within 3 banking days of receipt**. The rule also enumerates the records
  set: signed agency agreements, written agency acknowledgments, listing/sale/purchase/rental
  agreements, receipts for funds/documents, vouchers + bills + client expenses, documents provided
  within the agency relationship, trust-account financial records, and closing statements (when the
  principal broker closes) showing receipts/disbursements with buyer/seller signatures.
- **Source:** https://oregon.public.law/rules/oar_863-015-0250 — fetched 2026-06-10.
- **Enforcement:** TC ingest deadline — when Paul/Rebecca upload or email a doc, the platform IS the
  transmittal channel; stamp receipt time and surface any doc older than 3 banking days not yet in
  the deal file.

### A6. Records retention mechanics (extends the matrix's 6-year row)

- **Rule:** the **6-year** minimum retention is statutory — **ORS 696.280**: at least 6 years after
  trust account closes / transaction concludes or fails (whichever later) / record creation-receipt;
  records open for inspection by the Commissioner at all times; any inspectable+copyable format
  allowed per rule. **OAR 863-015-0260** adds: records kept at main office, branch, or ONE notified
  alternative location in Oregon, "readily available for inspection"; electronic storage must be
  non-alterable (WORM-class) with reliable indexing + quality control; **computerized systems
  require monthly backups retained at least 60 days**, available to the Commissioner on demand;
  paper copies furnished at the broker's expense. Scope explicitly includes **email communications**.
- **Sources:** https://oregon.public.law/statutes/ors_696.280 ·
  https://oregon.public.law/rules/oar_863-015-0260 — fetched 2026-06-10.
- **Enforcement:** TC storage design doc — immutable storage + append-only events already align;
  ADD: monthly backup job with ≥60-day retention; email-ingest archives count as retained records.

### A7. Earnest money + clients' trust account handling (hardens the matrix's earnest-money row)

- **Rule (OAR 863-015-0257):** earnest-money **checks** may be held undeposited until acceptance if
  the sale agreement says so; **within 3 banking days after acceptance** the check must be deposited
  to a clients' trust account, transferred to a neutral escrow depository, or delivered to the
  seller. Other funds: deliver to principal broker within 3 banking days; deposit within 5 banking
  days. Disbursement only by court order, written instructions of the principals, interpleader, or
  the disputed-earnest-money procedure (863-015-0186). Credit-card receipts must be credited at
  full face amount unless the cardholder signs a separate fee-deduction authorization.
- **Rule (OAR 863-015-0255):** notify the Agency within **10 business days** of opening or closing
  a clients' trust account (Notice of CTA + Authorization to Examine); checks pre-numbered, single
  sequence, faced "Clients' Trust Account"; **no debit cards** on CTAs; voided checks accounted for.
- **Rule (ORS 696.241):** trust funds deposited immediately unless placed with a licensed neutral
  escrow with written agreement of all interested parties; no commingling (exceptions: earned
  interest, earned compensation under conditions); broker may not touch earnest money or interest
  until the transaction is complete or terminated; forfeited-earnest-money split must be negotiated
  in writing and initialed by the seller; interest benefits the broker only with prior written
  approval of all interested parties; CTA funds exempt from execution/attachment against the broker.
- **Sources:** https://oregon.public.law/rules/oar_863-015-0257 ·
  https://oregon.public.law/rules/oar_863-015-0255 ·
  https://oregon.public.law/statutes/ors_696.241 — fetched 2026-06-10.
- **Enforcement:** TC checklist auto-deadline "EM deposited/transferred within 3 banking days of
  acceptance" with evidence doc; note that Ryan Realty's standard practice (EM to title/escrow)
  satisfies the neutral-escrow path — the system should record WHICH path each deal used.

### A8. Final agency acknowledgment + disclosed limited agency agreement contents

- **Rule (OAR 863-015-0200):** five permissible agency relationships (exclusive seller, exclusive
  buyer, disclosed limited agency both parties, designated representation within one firm, DLA for
  competing buyers). When licensees of the same firm represent different parties, **the principal
  broker is the only disclosed limited agent of both parties**. Parties must sign a **final agency
  acknowledgment** before or at execution of the sale agreement (formatting requirements for
  preprinted agreements).
- **Rule (OAR 863-015-0210):** the DLA agreement must be written, signed + dated by the parties to
  be bound, and contain: registered business name, existing listing/service agreements, licensee +
  principal broker names, plain-language explanation of ORS 696.815, full disclosure of multi-party
  representation duties, and consent for future transactions. The rule's template forms are prima
  facie compliance. **ORS 696.815** (amended by HB 4058, eff. 2025-01-01) adds: dual representation
  requires THREE separate written agreements (listing + buyer rep + DLA), and the confidentiality
  triad (seller's floor price, buyer's ceiling, other confidential info) survives unless waived in
  writing.
- **Sources:** https://oregon.public.law/rules/oar_863-015-0200 ·
  https://oregon.public.law/rules/oar_863-015-0210 ·
  https://oregon.public.law/statutes/ors_696.815 — fetched 2026-06-10.
- **Enforcement:** new matrix row "Final agency acknowledgment in/with sale agreement" (always
  required); the existing 040/041 DLA row gains the three-agreement requirement for dual deals.

### A9. Advertising rule — what every ad must carry (CRITICAL for the marketing platform)

- **Rule (OAR 863-015-0125, last amended 2025-10-09, eff. 2026-01-01):**
  - **Definition (§1):** advertising = "all forms of meaningful communication by or on behalf of a
    real estate broker or principal broker designed to attract the public to the use of services
    related to professional real estate activity" — explicitly covering mail, brochures, business
    cards, stationery, signs, billboards, **text messages, voicemail, cold calls**, radio, TV,
    podcasts, **websites, email, social media, MLS, mobile apps**.
  - **Every ad (§2):** must be identifiable as licensee advertising; truthful, not deceptive or
    misleading; must not imply principal-broker status falsely or overstate qualifications; written
    owner permission required to advertise a property for sale/exchange/lease.
  - **Name (§3):** licensed name, a common derivative of first + last name, or a registered
    alternative name + license number.
  - **Electronic media (§5):** the licensee's **primary/home page must display the licensee name
    (per §3) and the registered business name**. Exemptions: sponsored search ads (if the landing
    page complies), emails/texts (if the initial communication contained the required info), social
    media (if it links to a compliant profile/page).
  - **Guarantee ban (§6):** no advertising that guarantees future real estate profits.
  - **Teams (§7, amended eff. 2026-01-01):** team advertising allowed provided the **registered
    business name remains "immediately noticeable"** and non-licensed team members are clearly
    identified; team terminology requires at least one active licensee and all licensee members
    under the same (managing) principal broker.
- **Sources:** https://secure.sos.state.or.us/oard/view.action?ruleNumber=863-015-0125 (current) ·
  https://oregon.public.law/rules/oar_863-015-0125 (pre-2026 detail) — fetched 2026-06-10.
- **Enforcement:** ad-generation gate (every producer + the in-session produce flow): (a) listing
  ads require recorded owner permission (the listing agreement IS it for our own listings — gate
  third-party content); (b) site/page templates show broker licensed name + "Ryan Realty LLC"
  registered business name on primary pages; (c) social profiles must link to a compliant page;
  (d) banned-claim screen: profit guarantees, overstated credentials; (e) name-format check against
  the broker roster.

### A10. Misleading advertising is a discipline ground + ORS 696.301 catalog

- **Rule (ORS 696.301):** the Commissioner may revoke/suspend/reprimand or deny for, among 15
  grounds: material misrepresentations creating probability of damage (§1); accepting compensation
  from anyone other than the associated principal broker (§2); violating ORS 659A.421, the license
  law ranges, or Agency rules (§3); **"knowingly or recklessly published materially misleading or
  untruthful advertising" (§4)**; acting as agent + undisclosed principal (§5); intentional
  interference with others' contracts or another licensee's exclusive representation (§6–7);
  CMA/tax-rep contingent on predetermined values or undisclosed interest (§8–9); **failing to
  provide complete detailed closing statements when the licensee performed the closing (§10)**;
  qualifying felony/misdemeanor (§11); incompetence or untrustworthiness (§12); violating
  commissioner orders (§13); fraud/dishonest conduct related to fitness (§14); **conduct below the
  standard of care for professional real estate practice in Oregon (§15)**.
- **Source:** https://oregon.public.law/statutes/ors_696.301 — fetched 2026-06-10.
- **Enforcement:** reference list in the compliance doc; §4 reinforces the ad gate; §10 reinforces
  the closing-statement record in `tc_commissions`; §3 makes EVERY OAR 863 rule a license matter.

### A11. Licensee-as-principal disclosure (broker buying/selling own property)

- **Rule (OAR 863-015-0145):** when a licensee is a principal (buyer or seller), the licensee must
  disclose licensee status **on all advertising** and **in writing on at least the first written
  document** (offer/contract), stating whether self-represented as buyer or seller. The principal
  broker must run the deal through normal supervision/records. Extends to entities where a licensee
  owns >5% and participates in negotiations.
- **Source:** https://oregon.public.law/rules/oar_863-015-0145 — fetched 2026-06-10.
- **Enforcement:** TC deal-creation flag "is a Ryan Realty licensee a party?" → injects the
  disclosure requirement into the checklist + the ad gate for that property's marketing.

### A12. CMA / letter-opinion content requirements (applies to the CMA producer)

- **Rule (OAR 863-015-0190):** every competitive market analysis or letter opinion must be in
  writing and include: (1) statement of purpose, (2) brief property description, (3) **the basis
  for the value, including applicable market data and/or capitalization computation**, (4) limiting
  conditions, (5) disclosure of any existing or contemplated licensee interest in the property,
  (6) licensee signature + date, (7) a disclaimer that the report does not meet USPAP unless the
  licensee is a certified appraiser, (8) the statement that the CMA **"is not intended as an
  appraisal."** Also ORS 696.301(8): no CMA contingent on a predetermined value.
- **Source:** https://oregon.public.law/rules/oar_863-015-0190 — fetched 2026-06-10.
- **Enforcement:** CMA producer template gate (`marketing_brain_skills/producers/cma/SKILL.md` +
  the HTML template): require all 8 elements; block delivery if signature/date or the two
  disclaimers are missing. (The 228 Soft Tail and future CMAs should be audited against this list.)

### A13. Unlicensed staff + automation boundary

- **Rule:** "Professional real estate activity" (ORS 696.010(17)) includes negotiating, listing,
  procuring prospects, **assisting in negotiation or closing**, advising on values, and "performing
  real estate marketing activity" — all license-required when done for another for compensation.
  ORS 696.030 lists the licensing exemptions (owner-employees, attorneys in legal practice,
  court-appointed fiduciaries, principals transacting their own property, etc.) — clerical staff
  are NOT a listed exemption; they stay legal only by staying outside 696.010(17) activity. OREA
  guidance: an unlicensed assistant may answer phones, take messages, forward calls — and the
  broker must be able to "readily refute" any allegation the assistant engaged in professional real
  estate activity. ORS 696.022: every real estate broker must be "associated with and supervised by
  a principal real estate broker."
- **Sources:** https://oregon.public.law/statutes/ors_696.010 ·
  https://oregon.public.law/statutes/ors_696.030 ·
  https://oregon.public.law/statutes/ors_696.022 ·
  https://www.oregon.gov/rea/newsroom/pages/2022_oren-j/changing-business-models-require-knowledge-of-laws-and-rules.aspx — fetched 2026-06-10.
- **Enforcement:** automation guardrail doc: platform-automated comms run **on behalf of and under
  the supervision of a licensee** (sent in the broker's name, broker-reviewable, drafted-first per
  CLAUDE.md §0.5). Automated messages must not independently negotiate price/terms or render value
  opinions without a licensee in the loop. Every auto-sent message already routes through Matt's
  approval — keep that as the legal control, and say so in the compliance doc.

### A14. Compensation sharing / referral fees

- **Rule (ORS 696.290):** a licensee may not share compensation with or pay a finder's fee to an
  **unlicensed** person (§1(a)). Exceptions: out-of-state licensed brokers on cooperative
  nonresidential deals under written agreement with Oregon-broker supervision (§1(b), §7(a));
  property managers may give tenant-referral fees/rent credits to existing or recent tenants (§6).
  Associated brokers may accept compensation **only from their own principal broker** (§2; echoed
  by ORS 696.301(2)).
- **Source:** https://oregon.public.law/statutes/ors_696.290 — fetched 2026-06-10.
- **Enforcement:** marketing/ops gate — any "refer a friend" incentive, closing gift to a referrer,
  or co-marketing payment gets screened: cash/value to unlicensed referrers for procuring real
  estate business is prohibited. Commission-disbursement module (`tc_commissions`): payee must be
  Matt's brokerage → associated brokers, never direct-to-agent from a third party.

### A15. Business name, branch office, and the new team regime

- **Rule (ORS 696.026 + OAR 863-014-0095):** professional activity must run under an actively
  registered business name (registered to a principal broker; annual renewal; lapse inactivates
  associated licensees + branches). Multiple names only for affiliated/subsidiary organizations
  (OAR 863-014-0061). Alternative personal names register under 863-014-0067.
- **Rule (ORS 696.200):** a main office in Oregon must be registered and signed with the registered
  business name; no other name may be displayed; branch offices register separately
  (OAR 863-014-0100); office relocation requires prior notice to the Agency on the approved form —
  failure is a revocation ground; one principal broker may supervise multiple offices.
- **Rule (ORS 696.310 + HB 3137):** multiple principal brokers under one registered business name
  must execute written supervisory agreements fully allocating supervision; uncovered activity
  defaults to equal responsibility. HB 3137 (eff. 2026-01-01) layers the **managing principal
  broker** designation (the PB who registers/assumes responsibility for the business name) with
  defined duties over trust accounts and licensees, written supervisory agreements including
  succession plans, and recognition of **real estate teams** as subdivisions requiring managing-PB
  approval and client disclosure.
- **Rule (OAR 863-015-0143, NEW, eff. 2026-01-01):** team members must deliver a written **team
  disclosure at first contact** (same "first contact" mechanics as the agency pamphlet): each
  member's name + role, who is licensed, supervisory responsibilities, the managing principal
  broker's name, a statement that the team is a subdivision of a registered business name, and DLA
  language for multi-party representation. Duplicate disclosure not needed if already received from
  another team member. OREA publishes a sample template.
- **Sources:** https://oregon.public.law/statutes/ors_696.026 ·
  https://oregon.public.law/rules/oar_863-014-0095 ·
  https://oregon.public.law/statutes/ors_696.200 ·
  https://oregon.public.law/statutes/ors_696.310 ·
  https://secure.sos.state.or.us/oard/view.action?ruleNumber=863-015-0143 ·
  https://www.oregon.gov/rea/newsroom/pages/2025-oren-j/new-real-estate-license-laws-and-rules-effective-january-1.aspx — fetched 2026-06-10.
- **Enforcement:** (a) confirm with Matt whether Ryan Realty operates or markets any "team" name —
  if yes, the 0143 disclosure joins the at-first-contact bundle next to the agency pamphlet; if no,
  the ad gate should block "team"/"group" terminology in generated copy until the 0143 regime is
  set up. (b) Matt is presumably the managing principal broker under HB 3137 — the supervisory
  agreement + succession-plan requirement applies if a second PB is ever added. (c) Site footer /
  collateral carry the registered business name exactly as registered.

### A16. Fair housing — advertising gate (state list is BROADER than federal)

- **Rule (42 USC 3604(c)):** unlawful to "make, print, or publish... any notice, statement, or
  advertisement, with respect to the sale or rental of a dwelling that indicates any preference,
  limitation, or discrimination based on race, color, religion, sex, handicap, familial status, or
  national origin."
- **Rule (ORS 659A.421):** Oregon adds **sexual orientation, gender identity, marital status, and
  source of income** to the protected list; §2(e) bans publishing/circulating/displaying any
  communication, notice, advertisement, or sign indicating unlawful discrimination; §4 bars
  licensees from accepting listings with a discriminatory understanding. Violating 659A.421 is
  itself a license-discipline ground (ORS 696.301(3)).
- **Rule (24 CFR 110.10):** the HUD fair housing poster must be displayed at all places of business
  involved in selling/renting dwellings and brokerage services (and at model dwellings of covered
  developments); vacant land and FSBO single-family sales are exempt.
- **HB 3137 (eff. 2026-01-01):** active-license renewal now requires the **State and Federal Fair
  Housing course** (and the Law and Rule Required Course drops to a 2-hour minimum).
- **Sources:** https://www.law.cornell.edu/uscode/text/42/3604 ·
  https://oregon.public.law/statutes/ors_659a.421 ·
  https://www.law.cornell.edu/cfr/text/24/110.10 ·
  https://www.oregon.gov/rea/newsroom/pages/2025-oren-j/new-real-estate-license-laws-and-rules-effective-january-1.aspx — fetched 2026-06-10.
- **Enforcement:** ad-generation gate screens every listing description / ad / social caption /
  landing page against the **Oregon ten-class list**, including coded steering language ("perfect
  for families," "ideal for young professionals," "no Section 8" — source-of-income!). Office poster
  is a physical-world item for Matt's office checklist. CE: add fair-housing course to each broker's
  license-renewal calendar reminders (license renewal dates already tracked).

### A17. CAN-SPAM — every commercial email

- **Rule (15 USC 7704):** (a)(1) no materially false/misleading headers; (a)(2) no deceptive
  subject lines; (a)(3) a functioning, clearly displayed opt-out mechanism; (a)(4) honor opt-outs
  within **10 business days**; (a)(5)(A) clear identification that the message is an advertisement
  or solicitation (relaxed with prior affirmative consent) AND **a valid physical postal address of
  the sender**.
- **Source:** https://www.law.cornell.edu/uscode/text/15/7704 — fetched 2026-06-10.
- **Enforcement:** email footer template (`lib/email-templates/layout.tsx` + Resend sends): postal
  address + unsubscribe link on every marketing email; suppression list honored within 10 business
  days (ours is immediate via `lib/crm/suppressions.ts` — keep it that way); transactional deal
  emails (e-sign requests, deadline notices) are not "commercial" but keeping the footer is safe.

### A18. TCPA — texts and calls (current post-2025 state)

- **Rule (47 CFR 64.1200):** (a)(1)–(2) autodialed/artificial/prerecorded calls AND telemarketing
  texts to wireless numbers require prior express consent — **prior express WRITTEN consent for
  marketing**; (c)(1) telephone solicitations only 8 a.m.–9 p.m. local time; (c)(2) no solicitation
  to numbers on the national DNC registry (scrub against a registry version ≤31 days old, written
  procedures required); (d) maintain an internal do-not-call list + written policy, honor requests
  within a reasonable time not to exceed **10 business days**; (a)(10) consent revocation by any
  reasonable method must be honored within 10 business days.
- **Status note (verified via multiple firm analyses, 2026-06-10):** the FCC's "one-to-one consent"
  rule was **vacated** by the Eleventh Circuit in *Insurance Marketing Coalition v. FCC* (Jan 24,
  2025); the FCC declined to appeal and deleted the vacated language — one-to-one consent is NOT
  current law. Standard prior-express-written-consent rules remain.
- **Sources:** https://www.law.cornell.edu/cfr/text/47/64.1200 ·
  https://www.wiley.law/alert-UPDATE-11th-Circuit-Vacates-FCCs-One-to-One-TCPA-Consent-Rule ·
  https://www.womblebonddickinson.com/us/insights/blogs/fcc-repeals-one-one-consent-rule-following-eleventh-circuit-decision — fetched 2026-06-10.
- **Enforcement:** existing `compliance:hard-stop` / `contact:do-not-text` / `contact:do-not-call`
  tag regime (already wired per memory) is the right control; ADD to the compliance doc: 8am–9pm
  send-window check on any automated SMS, written-consent provenance per number (lead-form consent
  language), and 31-day DNC scrub cadence if cold outbound calling ever starts (today: don't).

### A19. RESPA section 8 — kickbacks + affiliated business arrangements (the real AfBA law)

- **Rule (12 USC 2607):** (a) no fee/kickback/thing of value for referrals of settlement-service
  business involving federally related mortgage loans; (b) no fee splitting except for services
  actually performed; (c)(4) affiliated business arrangements allowed ONLY if: disclosure of the
  arrangement + estimated charges (face-to-face at referral; by phone within 3 business days), no
  required use of the affiliate, and only ownership-interest returns. Penalties: up to $10,000 /
  1 year criminal; treble damages civil.
- **Source:** https://www.law.cornell.edu/uscode/text/12/2607 — fetched 2026-06-10.
- **Enforcement:** compliance-doc note. Ryan Realty currently has no affiliated title/escrow/lender —
  if that ever changes, the AfBA disclosure becomes a TC checklist item. Also governs vendor
  referral relationships (no "thing of value" for steering to a lender/title company).

### A20. Smoke alarms at transfer (the matrix's smoke-CO row only cites the CO statutes)

- **Rule (ORS 479.260):** "A person may not convey fee title to any real property that includes a
  dwelling unit or lodging house... unless there is installed... a smoke detector or the required
  number of approved smoke alarms" per building code / State Fire Marshal rules (ionization
  standards per ORS 479.297). Related: ORS 479.265 (action for unlawful transfer), 479.990
  (penalties). (ORS 479.270 is the RENTAL smoke-alarm duty — different statute, only relevant for
  tenant-occupied deals.)
- **Source:** https://oregon.public.law/statutes/ors_479.260 — fetched 2026-06-10.
- **Enforcement:** add ORS 479.260 to the matrix's smoke+CO row citation (currently only
  105.836–838, which is CO-only).

### A21. Wholesaling disclosure (new rule, awareness item)

- **Rule (OAR 863-015-0245, eff. 2025-07-01, authority 2024 Or. Laws ch. 3 §§2–3):** a broker
  marketing residential property while holding only an equitable interest/option (<90 days,
  <$10,000 improvements) must give a written disclosure (10-point bold) to buyers AND sellers
  before contracting, and include it **in all related advertising** (social media exempt if linking
  to a compliant page). Counterparties get a 3-business-day cancellation right with full EM return;
  non-disclosure lets the seller terminate without penalty and exposes the broker to damages + fees.
- **Source:** https://secure.sos.state.or.us/oard/view.action?ruleNumber=863-015-0245 — fetched 2026-06-10.
- **Enforcement:** TC deal-type flag (assignment / equitable-interest deals) → disclosure +
  cancellation-window checklist; ad gate refuses wholesaling-pattern marketing without the
  disclosure block. Not current Ryan Realty business; encode as a conditional rule.

### A22. Escrow instructions (what ORS 696.581 actually is)

- **Rule (ORS 696.581, amended by HB 4058 eff. 2025-01-01):** escrow agents may not accept
  funds/documents without dated written escrow instructions or a dated executed agreement between
  principals; separate written closing instructions required before disbursement (limited EM
  exceptions); no blanks-to-be-filled-after-signing; alterations initialed by all signers; no forced
  liability releases; mandatory 10-point-bold "complete instructions" disclosure above signatures.
- **Source:** https://oregon.public.law/statutes/ors_696.581 — fetched 2026-06-10.
- **Enforcement:** awareness row — escrow's duty, not the broker's, but the TC timeline should
  expect "escrow instructions signed" as a milestone document.

### A23. Litigation reporting (inventory item — detail unverified, see D)

- OAR 863-015-0175 "Reporting Litigation Involving Licensees" exists in division 15. Rule text not
  fetched this session — see (D). If it requires brokers to report lawsuits to OREA, that belongs in
  the compliance doc's broker-duties section.

---

## (B) CONFIRMATIONS — existing matrix rules re-verified against primary sources (2026-06-10)

| Matrix rule | Re-verified against | Result |
|---|---|---|
| Initial Agency Disclosure Pamphlet at first contact, any contact medium; informational only | **ORS 696.820** (https://oregon.public.law/statutes/ors_696.820) + **OAR 863-015-0215** (https://oregon.public.law/rules/oar_863-015-0215) | ✅ Confirmed, incl. the "sufficient contact information" definition of first contact and the exemption when the party already received one from another agent. |
| SPDS + 5-business-day revocation | **ORS 105.464** (form/10 categories), **105.465** (duty + non-residential-use exception), **105.475** (5 business days; waiver; rights persist until closing if seller never delivers; revocation = void offer + immediate return of all deposits; deposit-holder released on buyer's written release + indemnification) — all on oregon.public.law | ✅ Confirmed and extended: the matrix should ADD (1) the four §105.470 exclusions (never-occupied new construction w/ permit statement, foreclosure/REO + custodial holders, court-appointed sellers, government sales), (2) the buyer non-residential-use exception, (3) "rights persist until closing if SPDS never delivered." |
| CO alarms at conveyance | **ORS 105.838** (https://oregon.public.law/statutes/ors_105.838) | ✅ Duty confirmed; violation does not invalidate the transfer. Remedy citation correction → see (C2). |
| E-sign validity + consent | **ORS 84.013** (UETA applies only between parties who agreed to transact electronically, judged from context/conduct; right to refuse future e-transactions is non-waivable) + **ORS 84.019** (equal legal effect) | ✅ Confirmed. Our consent-capture in the signing flow matches 84.013(2)–(3). |
| 6-year records retention | **ORS 696.280** (statutory 6-year floor + triggers) + **OAR 863-015-0250/-0260** | ✅ Confirmed — but the 6-year figure is the STATUTE (696.280); the matrix row should cite it alongside the OARs. -0260 adds WORM/electronic-format + monthly-backup mechanics (see A6). |
| Commission records / closing statements among retained records | **OAR 863-015-0250** enumerates closing statements + vouchers/bills/client expenses | ✅ Confirmed as written (matrix row updated 2026-06-10 was already accurate). |
| Domestic well test (arsenic/nitrates/total coliform) | **ORS 448.271** (https://oregon.public.law/statutes/ors_448.271) | ✅ Confirmed: test on accepting an offer; results to OHA + buyer **within 90 days of receiving the results**; OHA may add area-specific contaminants; non-compliance does not invalidate the conveyance. Nuance: the 90-day clock runs from receipt of results — matrix phrasing ("within 90 days") should pin the trigger. |
| Lead-based paint (pre-1978) | **42 USC 4852d** (https://www.law.cornell.edu/uscode/text/42/4852d) | ✅ Confirmed: pamphlet + known-hazard disclosure + reports, 10-day inspection opportunity (waivable by agreement), Lead Warning Statement + signed acknowledgment IN the contract, and the **agent's affirmative duty to ensure compliance** (§(a)(4)). Penalties incl. treble damages. |
| Disclosed limited agency in writing | **ORS 696.815** + **OAR 863-015-0205/-0210** | ✅ Confirmed + extended (see A8: post-HB-4058 three-agreement structure). |
| Buyer-rep agreement (matrix severity `verify`) | **HB 4058** + **OAR 863-015-0133** | ✅ RESOLVED: now mandatory with required contents → upgrade to `required` (see A1). |

---

## (C) CORRECTIONS — items that don't match the primary source

1. **Matrix open item: "Condo resale disclosure exact timing (ORS 100.480) and the planned-community
   resale packet (ORS 94.665)" — both citations are wrong.**
   - **ORS 100.480** is association records/financial-statement duties (record retention per ORS
     65.771, annual financials within 90 days of FY end, CPA review >$75K assessments, owner access
     in 10 business days) — NOT a seller resale-certificate statute.
     (https://oregon.public.law/statutes/ors_100.480, fetched 2026-06-10.)
   - **ORS 94.665** is the HOA's authority to sell/encumber **common property** (80%/75% approval
     thresholds) — NOT resale disclosure. (https://oregon.public.law/statutes/ors_94.665, fetched
     2026-06-10.)
   - The closest verified statute is **ORS 94.670**: the association must make documents/records
     available and, on written request, provide an assessment-status statement within 10 business
     days (https://oregon.public.law/statutes/ors_94.670, fetched 2026-06-10). No Oregon statute
     verified this session imposes a Washington-style "resale certificate" duty on the SELLER of a
     planned-community lot; the SPDS §6 (common interest) carries the seller's disclosure. The
     matrix open item should be rewritten to cite 94.670 / 100.480 for the association-document
     request path and drop the implication of a statutory seller resale-certificate deadline.
     (Secondary sources agree Oregon has a statutory gap here — e.g. communitypay.us analysis — but
     that is not a primary source; treat the gap itself as the finding.)

2. **CO-alarm remedy lives in ORS 105.840, not 105.838.** The matrix's CO row says "aggrieved buyer
   may recover greater of actual damages or $250/unit" citing 105.838. The duty is 105.838; the
   remedy — "the greater of actual damages or $250 per residential unit" + fees/costs, 1-year
   limitation — is **ORS 105.840** (https://oregon.public.law/statutes/ors_105.840, fetched
   2026-06-10). Cite both.

3. **The matrix's smoke+CO row (OREF 080) cites only ORS 105.836–838 — the SMOKE half is ORS
   479.260** (unlawful transfer without smoke alarms; see A20). As written, the row implies one
   statute covers both alarm types; it doesn't.

4. **Task-prompt premise correction (not a matrix error): ORS 696.581 is NOT "affiliated business
   arrangements."** It is written-escrow-instruction law (see A22). Oregon AfBA-adjacent law:
   ORS 696.026/OAR 863-014-0061 govern *registering* affiliated/subsidiary business names; the
   substantive AfBA disclosure regime is federal RESPA §8, 12 USC 2607(c)(4) (see A19).

5. **Pre-2026 rule text is stale in places the platform might have sourced from.** OAR 863-015-0140
   was retitled/amended ("Managing Principal Broker Supervision Responsibilities") and 863-015-0125
   team provisions amended, both effective 2026-01-01 under HB 3137; oregon.public.law's division-15
   index (fetched this session) still showed the pre-2026 inventory without 0133/0143/0245. Use the
   SOS OARD (secure.sos.state.or.us/oard) as the canonical OAR source going forward.

---

## (D) UNVERIFIED — needs manual confirmation before encoding

1. **HB 3137 bill text (2025 Or. Laws ch. 389).** The enrolled PDF fetched but could not be parsed
   to text this session. The managing-principal-broker duties ("HB 3137 section 20(1)" referenced by
   OAR 863-015-0140), team-registration mechanics, and supervisory-agreement/succession-plan details
   are summarized here from the OREA newsroom page + the implementing OARs — the statutory text
   itself should be read before encoding any HB 3137 rule as a hard gate.
   (https://olis.oregonlegislature.gov/liz/2025R1/Measures/Overview/HB3137)
2. **OAR 863-015-0175 (Reporting Litigation Involving Licensees)** — rule exists in the division-15
   inventory; text not fetched. Likely a broker duty to report litigation to OREA; confirm content
   and deadline.
3. **OAR 863-015-0259 / -0265 / -0275** (recordkeeping/tracking of received funds; interest-bearing
   accounts; CTA reconciliation cadence) — inventoried, not fetched. The reconciliation rule likely
   sets a monthly-reconciliation duty; confirm before encoding trust-account gates.
4. **OREF 047 (compensation advisory) vs 091 (notice of compensation) — mandatory vs advisory.**
   OREF form-level guidance is licensed content, not public law. The LAW now requires compensation
   explanation inside the buyer agreement + listing agreement (A1/A2); whether the standalone OREF
   advisory/notice forms remain required is OREF library policy, not statute. Confirm against Matt's
   OREF library / current OREF release notes.
5. **Fair-housing poster size/content specs** (24 CFR 110.25) and the evidentiary effect of failure
   to post (24 CFR 110.30) — only 110.10 (who/where) was fetched.
6. **Septic evaluation triggers by county** (matrix open item) — unchanged; DEQ/county DIAL program
   rules not swept this session.
7. **Condo FIRST-SALE developer disclosure regime (ORS 100.635/100.640/100.655)** — surfaced in
   search results only; not fetched. Irrelevant to resales but should be pinned if Ryan Realty ever
   lists developer units.
8. **Oregon-specific telemarketing/email statutes** (e.g. ORS 646.608 UTPA angles, ORS 646.872) —
   not swept; federal TCPA/CAN-SPAM verified above. Oregon has its own telephone-solicitation
   registration statutes that MAY exempt real estate licensees; verify before any cold-call program.
9. **863-025 (Property Management) rule contents** — inventoried only (incl. its own advertising
   rule 863-025-0125). Ryan Realty does no property management today; if PM ever starts, division
   24/25 (PM licensing, PM agreements, security-deposit trust accounts) needs its own sweep.
10. **ORS 696.870 / remaining 696.800–.870 sections** (waiver, compensation-doesn't-determine-agency,
    etc.) — not individually fetched; the core (805/810/815/820) is verified above.

---

## Source log (everything fetched this session, 2026-06-10)

ORS via oregon.public.law: 696.010, 696.022, 696.026, 696.030, 696.200, 696.241, 696.280, 696.290,
696.301, 696.310, 696.581, 696.805, 696.810, 696.815, 696.820, 105.464, 105.465, 105.470, 105.475,
105.838, 105.840, 448.271, 479.260, 479.270, 84.013, 84.019, 659A.421, 94.665, 94.670, 100.480.
OAR via oregon.public.law: chapter 863 index, division 14 index, division 15 index, division 25
index, 863-014-0095, 863-015-0125, -0130, -0135, -0145, -0190, -0200, -0210, -0215, -0250, -0255,
-0257, -0260. OAR via secure.sos.state.or.us/oard (current versions): division 15 listing,
863-015-0125, -0133, -0140, -0143, -0245. Cornell LII: 42 USC 3604, 42 USC 4852d, 15 USC 7704,
12 USC 2607, 47 CFR 64.1200, 24 CFR 110.10, OAR 863-015-0140 (pre-2026). oregon.gov/rea newsroom:
HB 4058 buyer/listing-agreement overview, 2026-01-01 new-laws page (HB 3137/HB 2373), unlicensed-
assistant guidance (2022). Searches for status checks: FCC one-to-one consent vacatur (IMC v. FCC),
HB 4058 effective date, OAR division URLs.

**Caveat:** fetched pages were summarized by an automated reader; before encoding any rule as a
mechanical gate, open the cited source and read the operative subsection directly. Statutes and
rules cited as of 2026-06-10; OARs amended effective 2026-01-01 are the current versions.
