# Billing & Subscription

The Billing & Subscription surface lives under `Admin > Billing` and is accessible only to the account owner. It exposes the current plan tier and seat count, optional add-ons (Calling), the total annual or monthly cost with discount breakdown, the business billing address (used for tax determination), and the credit card on file. The in-house CRM is an owned, single-tenant tool — it does not need a subscriber billing system. This section therefore serves two purposes: (1) a faithful reconstruction of every FUB billing UI element and business rule so the team knows exactly what is being replaced, and (2) a set of internal cost-tracking and seat-management requirements that map to the real operational needs of a multi-broker shop (seat provisioning, add-on flags, cost ledger). Acceptance criteria marked "not applicable — owned tool" explain why the FUB concept does not carry over, rather than simply omitting it.

---

## 1. Admin Navigation — Billing entry point

### 1.1 Subnav bar (Admin section)

The Admin section sub-navigation renders a horizontal row of tabs across the top of every Admin page. Billing appears as the rightmost named tab before any `More ▾` overflow.

**Tabs (left to right):**
`Overview · Lead Flow · Groups · Team · Action Plans · Automations · Ponds · Email Templates · Text Templates · Import · Custom Fields · Billing ∨`

- The `Billing` tab carries a **dropdown chevron (`∨`)** indicating it is a `<DropdownMenu>` with sub-items (likely `Overview`, `Change Plan`, `Cancel Subscription` — sub-items were not captured in GIF frames).
- Alongside the `Billing ∨` tab, a persistent **pill button** reads: `ⓘ How Billing works` — rendered in the subnav row itself, not in the page body. This button is present on every Billing route.
- When the user navigates to a **Billing sub-page** (e.g., the Calling Add-on enrollment page), the subnav adapts: the `Billing ∨` tab collapses into a `More ∨` overflow item and an **`Admin Overview`** button appears in its place.
- On return to the Billing overview, the subnav re-expands to show `Billing ∨` and `ⓘ How Billing works`.

**Build note:** The `Billing ∨` tab must be gated behind the `account_owner` role check — all other roles see the subnav but this tab is hidden or disabled (per FUB docs). In the in-house CRM, map this to the `principal_broker` or `owner` role in the `brokers` / `users` permission model.

---

## 2. Billing Overview Page

**Route (FUB):** `/admin/billing` (full-page SSR navigation, not SPA AJAX)  
**Route (in-house, inferred):** `/admin/billing`  
**Access gate:** Account owner only (per FUB docs). All other roles: redirect or 403.

### 2.1 Page layout

- **Page background:** light gray (`bg-muted` in design-system terms; `--rr-cream` / `bg-background` for the in-house build).
- **Content:** a single centered card, approximately **430 px wide**, with standard card padding. No sidebar. No secondary columns.
- The card is divided into five named sections separated by `<Separator>` rules (not headings — visual dividers only):
  1. Header / Account Stats block
  2. Product Plan
  3. Calling Add-on
  4. Total Annual Payment
  5. Business Location Information
  6. Credit Card

### 2.2 Header / Account Stats block

```
[Avatar: Matt's headshot, ~40 px circle]
Hi, Matt!
Together we've tracked 17,314 people and 33,788 emails 🔥
Customer Since 2025
```

| Element | Detail |
|---|---|
| Avatar | Circular headshot of the account owner, ~40 px |
| Greeting | `Hi, {firstName}!` — first name from account owner profile |
| Stats line | `Together we've tracked {N} people and {M} emails 🔥` — live counts from CRM database |
| Caption | `Customer Since {year}` — derived from account creation date |

**Build note — in-house CRM:** This block is a vanity/engagement surface. Implement as: avatar from `brokers.portrait_url`, greeting from `brokers.first_name`, people count from `SELECT COUNT(*) FROM crm_people`, email count from `SELECT COUNT(*) FROM crm_timeline WHERE channel = 'email'`, customer-since year from `brokers.created_at` or a fixed constant. For an owned tool, this block can be simplified or removed; the data is accurate and pleasant to show but carries no billing function.

**Acceptance criteria:** Not applicable as a billing feature — owned tool. Retain as a dashboard vanity metric block if desired.

### 2.3 Product Plan section

**Section label:** `Product Plan` (rendered as a row label, left-aligned)

| UI Element | Observed Value | Description |
|---|---|---|
| Plan name + formula | `Grow ($828/yr x 3 team members)` | Plan name + per-seat annual price × seat count |
| Plan price | `$2,484/yr` | Right-aligned; gross annual total (before discount) |
| Seat info line | `You currently have 3 team members - Edit Team Members` | Inline sentence; `Edit Team Members` is a blue hyperlink |

**"Edit Team Members" link:** Navigates to the Admin > Team management page (see `15-admin-company-team-and-roles.md`). Does not open a modal.

**Pricing formula observed:**
- Per-seat price shown on the account (Grow): **$828/yr per user** — NOTE this equals the monthly rate ($69/mo) annualized. FUB's **published annual-billing** plan is **$58/mo = $696/yr per user** (followupboss.com/pricing, verified 2026-06-30)
- Seat count: **3** (Matt Ryan, Rebecca Peterson, Paul Stevenson)
- Gross total: `3 × $828 = $2,484/yr`

**Per FUB docs — plan tiers:**

| Plan | Target user count | Calling included? | Support tier |
|---|---|---|---|
| **Grow** | Solo users and teams of ≤5 | No — add-on at $39/user/month | Phone + email 7 days/week; dedicated onboarding for 3+ users |
| **Pro Teams** | 5–20 users | Yes — included | Phone + email 7 days/week; dedicated onboarding; dedicated success manager; bi-annual growth sessions |
| **Platform Teams** | 20+ users | Yes — included | Phone + email 7 days/week; dedicated onboarding; dedicated success manager; quarterly growth sessions; Teams feature + segmentation |

"$828/yr per seat" is the live value observed in the billing GIF, which equals the **monthly** rate ($69/mo) annualized. FUB's published **annual-billing** price is **$58/mo = $696/yr per seat**; the calling add-on is $39/user/mo on monthly billing, $33/user/mo on annual (followupboss.com/pricing, verified 2026-06-30).

**Build note — in-house CRM:**

The in-house CRM has no per-seat SaaS billing. However, for **internal cost tracking** (knowing how much FUB costs the brokerage per broker, tracking when to add or remove a seat during transition), implement a lightweight table:

```sql
-- internal cost ledger (mirrors FUB seat cost during transition)
CREATE TABLE admin_cost_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end   date,
  plan_name    text NOT NULL,           -- 'Grow', 'Pro Teams', 'Platform Teams'
  seat_count   int NOT NULL,
  per_seat_annual_usd numeric(10,2),
  gross_annual_usd    numeric(10,2),
  discount_usd        numeric(10,2),
  net_annual_usd      numeric(10,2),
  vendor               text DEFAULT 'Follow Up Boss',
  notes                text,
  created_at   timestamptz DEFAULT now()
);
```

**Acceptance criteria:** Not applicable — owned tool (no per-seat billing). Internal cost-ledger record recommended for transition accounting.

### 2.4 Calling Add-on section

**Section label:** `Calling Add-on`

| State | UI shown |
|---|---|
| Not enrolled (Ryan Realty's state) | Single blue link: `Try calling for 14 days` |
| Enrolled (inferred from docs) | Presumably shows per-seat cost breakdown and enrolled users |

**"Try calling for 14 days" link:** Full-page navigation to the Calling Add-on enrollment sub-page (see §4 below). This is not a modal.

**Per FUB docs — Calling add-on rules:**
- **Cost (Grow plan):** $39/user/month per enabled user (not per account)
- **Pro Teams / Platform Teams:** Calling is included (no add-on charge)
- **Free trial:** 14 days, up to 20 users per account, available once every 6 months for paid accounts (per FUB docs)
- **Free trial accounts** automatically include Calling access (no separate enrollment)
- Calling provides: individual phone numbers per agent, outbound dialing, automatic call logging, call recording (via Power-Up), detailed call reports
- Calling management per-user (Grow): `Admin > Team > user row > calling enabled checkbox` (inferred)

**Build note — in-house CRM:**

The in-house CRM uses Twilio for calling (541.703.3095 ported; per `project_twilio_cutover.md`). Calling capability is not an add-on — it is built into the platform. The relevant schema is already live:

```sql
-- from existing brokers table (per project_twilio_cutover.md)
brokers.twilio_number     text   -- individual Twilio number per broker
brokers.forward_to_cell   text   -- cell number for call forwarding
```

**Acceptance criteria:** Not applicable — owned tool with Twilio built in. No per-seat calling charge.

### 2.5 Total Annual Payment section

**Section label:** `Total Annual Payment` (or equivalent — exact label inferred from context)

| Line item | Observed value | Description |
|---|---|---|
| Annual Discount | `$414` | Savings from annual vs monthly billing |
| Next billing date | `Invalid date` | **Data bug** — the date field is null or unparseable in the live account |
| Annual Cost | `_/yr*` (value truncated in GIF scroll) | Gross annual charge before discount |
| Sales Tax | *(blank / zero)* | Oregon has no sales tax; field exists but shows $0 |
| **Total** | *(bold label; value not fully visible)* | Net annual charge |

**Computed from observed values:**
- Gross: $2,484/yr
- Annual Discount: $414
- Net: $2,484 − $414 = **$2,070/yr**
- Sales Tax: $0 (Oregon)
- **Total: $2,070/yr**

**"Annual Discount: $414" math:** the spec computed $414/$2,070 via exact 2-months-free math. **CORRECTION (verified 2026-06-30 vs followupboss.com/pricing):** FUB's published annual rate is **$58/user/mo → 3 users = $2,088/yr, a $396 savings** (not $2,070/$414). Confirm the exact on-account net against the live billing screen. (Billing is a deferred feature — low build impact.)

**Billing period options (per FUB docs):**
- Monthly billing: available
- Annual billing: available; saves approximately 2 months' cost
- Switch at any time via `Admin > Billing > Change Plan > toggle in upper-right`
- Switching frequency resets the billing date to the date of the change
- Unused time in the current billing cycle is prorated as a credit
- Credit appears in Admin > Billing and offsets future invoices

**"Invalid date" bug:** The `next_billing_date` field is null in the Ryan Realty FUB account. The FUB UI renders this as the literal string `Invalid date` rather than a fallback. The in-house CRM must guard all date renders: `billingDate ? format(billingDate, 'MMM d, yyyy') : '—'`.

**Acceptance criteria:** Not applicable — owned tool (no billing cycle). If an internal renewal reminder is desired, implement a `notifications` row for the FUB contract end date.

### 2.6 Business Location Information section

**Section label:** `Business Location Information`

**Info box (full text, light blue border):**
> "Your business billing address is the address where your business receives services purchased from Follow Up Boss and is used for sales tax purposes. It may differ from your Business Registration Address or payment method address. **Please verify its accuracy and make updates, if needed.**"

**Business billing address sub-card:**

| Element | Observed value |
|---|---|
| Sub-card label | `Business billing address` + `?` tooltip icon |
| Address line 1 | `115 NW Oregon Ave` |
| Address line 2 | `Suite #2` |
| City / State / ZIP | `Bend, OR 97703` |
| Edit control | `Edit` link — top-right of sub-card |

**"?" tooltip:** Clicking reveals an explanation of the difference between business billing address and payment card address (tooltip content not captured — inferred from the presence of the icon).

**"Edit" link behavior:** Opens an inline edit form within the sub-card, or a small drawer, for updating the address (exact interaction not captured in GIF). Fields expected: Street Address, Suite/Unit, City, State, ZIP, Country.

**Per FUB docs — address rules:**
- Business billing address is where the company **receives FUB services** (not necessarily where the card is billed or where the business is registered)
- Used to determine applicable sales tax rate
- If missing or invalid, FUB applies Streamlined Sales and Use Tax Agreement (SSUTA) sourcing rules
- Must be retained for at least **10 years** (regulatory / tax compliance requirement)
- Separate from the payment method's billing address — two distinct address objects

**Canadian accounts (per FUB docs):**
- GST/HST registration number required (nine-digit business number + "RT 0001")
- Stored for tax filing and remittance
- Data retention: at least 10 years
- Displayed in a separate `GST/HST` field on the billing page (not observed for Ryan Realty — US account)

**Build note — in-house CRM:**

No SaaS billing address is needed, but the business address is used in other contexts (invoices, letterhead, CMA reports, broker documents). Use the existing `brokers` table or a `company_settings` table:

```sql
-- recommended fields in company_settings (or expand existing brokers / admin config)
billing_address_line1   text,
billing_address_line2   text,
billing_city            text,
billing_state           text,
billing_zip             text,
billing_country         text DEFAULT 'US',
billing_address_updated_at timestamptz,
-- Canadian accounts (not applicable to Ryan Realty but included for completeness)
gst_hst_number          text,
```

**Acceptance criteria:** Not applicable as a billing feature — owned tool. The address is needed for document generation (see `10-deals-pipelines.md`, CMA spec). Store in `company_settings` with an audit timestamp.

### 2.7 Credit Card section

**Section label:** `Credit Card`

| Element | Observed value |
|---|---|
| Card icon | Generic credit card icon (brand not identified) |
| Masked PAN | `•••• 6787` |
| Expiry | `Exp. 8/2028` |
| Update control | `Update credit card` — blue hyperlink |

**"Update credit card" link behavior:** Navigates to an external payment processor flow (likely Stripe Checkout or Stripe Customer Portal — not captured in GIF). This is a full-page redirect away from FUB, then returns.

**Per FUB docs — payment method rules:**
- Single credit card per account — **cannot split payment across multiple cards or sources**
- FUB uses PCI-Compliant payment networks
- Card is updated via an external Stripe-equivalent flow, not inline on this page
- Separate billing contact email (for invoices) can be configured independently of the card or account owner email (per FUB docs — billing contact field not observed in GIF, may be on a sub-page)

**Build note — in-house CRM:** Not applicable — owned tool with no subscription payment. If Stripe or a payment processor is needed for future client-facing features (e.g., client portals with transaction-related billing), implement separately. Store no raw card data in the CRM database.

**Acceptance criteria:** Not applicable — owned tool.

---

## 3. "How Billing Works" Video Modal

**Trigger:** Clicking the `ⓘ How Billing works` pill button in the Admin subnav.  
**Modal type:** Full-page backdrop overlay + centered modal.

### 3.1 Modal structure

| Element | Detail |
|---|---|
| Title row | 🔧 `How Billing works` — wrench emoji + text, left-aligned |
| Close button | `×` (top-right corner of modal) |
| Video embed | Full-width thumbnail ~460 px × ~180 px |
| Video content | Dark navy background; FUB triple-chevron logo (top center); white text: `How to manage your billing`; blue play button (center overlay) |
| Backdrop | Full-page dim overlay behind modal |
| Modal width | ~480 px, centered |

### 3.2 Modal behavior

| Trigger | Response |
|---|---|
| Click `×` button | Modal closes immediately; no page reload; backdrop removed; billing overview page visible |
| Press `Escape` key | Same as clicking `×` — client-side dismiss, no reload |
| Click backdrop (outside modal) | Expected dismiss behavior (not confirmed in GIF but standard modal pattern) |
| Click play button inside video | Video plays inline (iframe/`<video>` element) |

### 3.3 Build implementation

```tsx
// @/components/ui/dialog — standard shadcn Dialog
<Dialog open={showBillingVideo} onOpenChange={setShowBillingVideo}>
  <DialogContent className="max-w-[480px]">
    <DialogHeader>
      <DialogTitle>🔧 How Billing works</DialogTitle>
    </DialogHeader>
    <div className="aspect-video w-full">
      {/* FUB-branded video or internal equivalent */}
      <iframe src="..." className="w-full h-full" allowFullScreen />
    </div>
  </DialogContent>
</Dialog>
```

**Escape + X dismiss:** Standard `<Dialog>` behavior in shadcn/ui handles both automatically.

**Build note — in-house CRM:** Replace with an internal "How our system works" video or a help article link. The modal pattern is reusable (see `@/components/ui/dialog`).

**Acceptance criteria (for owned build):** A `?` or `ⓘ` help button in the admin nav that opens a `<Dialog>` with a help video or article. Escape + X close. Not a billing requirement.

---

## 4. Calling Add-on Enrollment Sub-Page

**Route (FUB):** Sub-route of `/admin/billing/` (exact path not captured)  
**Navigation:** Full-page route change (not modal) from the `Try calling for 14 days` link  
**Subnav state:** `Billing ∨` collapses into `More ∨`; `Admin Overview` button appears

### 4.1 Page layout

Two-column layout (approximately 60% left / 40% right):
- **Left column:** Team member selector
- **Right column:** Live Totals card + marketing upsell block

**Breadcrumb (top of page):**
`< Back to overview` — blue link; full-page navigation back to Billing overview

**Page H1:**
`Try calling free for 14 days`

### 4.2 Left column — Team member selector

| Element | Detail |
|---|---|
| Column header | Phone icon + `Select team members` |
| Row: Matt Ryan | Avatar (initials `MR`) · `Matt Ryan` · unchecked `<Checkbox>` |
| Row: Rebecca Peterson | Avatar (initials `RP`) · `Rebecca Peterson` · unchecked `<Checkbox>` |
| Row: Paul Stevenson | Avatar (initials `PS`) · `Paul Stevenson` · unchecked `<Checkbox>` |

- All three checkboxes are **unchecked by default** (no calling add-on currently enrolled)
- Each row is a toggle: checking enrolls that broker in the Calling add-on; unchecking removes enrollment
- Broker list is sourced from `public.brokers` (or the equivalent users/team table)
- Avatar shows initials if no headshot is configured; otherwise shows headshot

### 4.3 Right column — Totals card

| Label | Value | Notes |
|---|---|---|
| **Product Plan** | (section header) | |
| Plan line | `Grow ($828/yr x 3 team members)` · `$2,484/yr` | Same formula as billing overview; includes `edit team` blue inline link |
| **Sales Tax** | `$0` | Oregon: no sales tax |
| **Total Yearly Payment** | `$2,070` | Net of annual discount ($2,484 − $414); rendered in blue/teal, bold |
| Support link | `Have a question? Contact support.` | `Contact support.` is a blue link → support channel (intercom/chat/mailto) |

**"edit team" inline link:** Navigates to Team admin (seat management) — same target as "Edit Team Members" on the billing overview.

**"Save Changes" button:**
- Rendered below the Totals card; teal/blue color; bold label
- **Disabled state:** button is disabled (inferred) until at least one broker checkbox is checked — no brokers selected = no add-on to enroll
- **Active state:** enabled when ≥1 broker is checked
- **On click:** commits the Calling add-on enrollment for the selected brokers; expected to trigger a confirmation or success state, then return to billing overview

**Live Totals recalculation (inferred):**
When a broker checkbox is checked, the Totals card should update to show the additional Calling add-on cost per selected user: `$39/user/month × [selected count]` added as a new line item. Only the 0-selected state was captured in the GIF.

Expected Totals card with 1 broker selected (inferred):
```
Product Plan
  Grow ($828/yr x 3 team members)   $2,484/yr
Calling Add-on
  FUB Calling (1 user)              $468/yr   ($39/mo × 12)
Sales Tax                           $0
─────────────────────────────────────────────
Total Yearly Payment                $2,538    (after annual discount on base plan only)
```
Note: whether the Calling add-on also receives an annual discount is not confirmed — treat as "(inferred)" above.

### 4.4 Marketing upsell block (below Totals)

| Element | Content |
|---|---|
| Illustration | Phone + desk scene; light blue tones |
| Headline | `Make, record, and log calls with a single click in Follow Up Boss` |
| Bullet: connect | ✓ `Connect with leads instantly` |
| Bullet: logging | ✓ `Automatic call logging` |
| Bullet: number | ✓ `Unique number for each agent` |
| Bullet: reporting | ✓ `Detailed reporting` |
| Learn more link | `Learn more` — blue link → external FUB marketing/help page |

### 4.5 Build implementation

```tsx
// Component: CallingAddonEnrollment
// Layout: two-column grid (lg:grid-cols-[3fr_2fr])
// Left: broker checklist sourced from /api/admin/brokers
// Right: Totals card with live recalculation on checkbox change

interface CallingAddonState {
  selectedBrokers: string[];         // broker IDs
  baseAnnualGross: number;           // 2484 for Ryan Realty
  annualDiscount: number;            // 414
  callingMonthlyPerSeat: number;     // 39
  salesTaxRate: number;              // 0 for Oregon
}
```

**Acceptance criteria — in-house CRM:** Not applicable — Twilio calling is built in. However, a `Calling Settings` admin page should allow enabling/disabling Twilio for individual brokers (maps to `brokers.twilio_number` presence). Use the same two-column checklist pattern.

---

## 5. Plan Change Flow

**Entry:** `Billing ∨` dropdown sub-item (likely `Change Plan`) or a dedicated route.  
**GIF coverage:** Dropdown sub-items not captured. Behavior inferred from per FUB docs.

### 5.1 Change Plan behavior (per FUB docs)

| Step | Detail |
|---|---|
| Navigate | `Admin > Billing > Change Plan` |
| Plan toggle | Toggle between monthly and annual billing period (upper-right of Change Plan screen) |
| Confirmation screen | Shows exact amount due before finalizing any plan or period change |
| Upgrade | No waiting period; effective immediately |
| Downgrade | **Blocked** if current user count exceeds the lower plan's seat cap; must remove team members first |
| Frequency switch | Changes billing date to the current date; unused time in old period prorated as credit |
| Proration credit | Appears in `Admin > Billing`; offsets next invoice |

**Blocked downgrade example:** Ryan Realty has 3 users on Grow (max 5). Downgrading from Pro to Grow is allowed only if current user count ≤5. If on Pro with 8 users, must delete 3 users before downgrade is permitted.

**Acceptance criteria:** Not applicable — owned tool. Document for FUB contract transition reference.

---

## 6. Cancellation Flow

**Entry:** `Admin > Billing > Cancel Subscription` (inferred from per FUB docs — not captured in GIF)

### 6.1 Cancellation steps (per FUB docs)

1. Navigate to `Admin > Billing > Cancel Subscription`
2. Select one or more **cancellation reason(s)** from a list (reasons not enumerated in docs)
3. Provide written **feedback** (free-text field)
4. Confirm cancellation

### 6.2 Post-cancellation state (per FUB docs)

| State | Detail |
|---|---|
| Credit card | Stops being charged immediately |
| Account access | Continues through end of current billing period |
| Reactivation | Available before billing period end via `Admin > Billing > Reactivate Your Subscription` |
| Immediate deletion | Separate option: `Admin > Billing > Delete Account Immediately` → access lost instantly for account owner AND all team members |

### 6.3 Pre-cancellation checklist (per FUB docs)

FUB documentation recommends completing these steps before canceling:
1. Export all contacts (`Admin > Export`)
2. Remove or archive API keys (`Admin > API`)
3. Archive or document all active lead sources

### 6.4 Reactivation window

A cancelled account can be reactivated before the billing period end date. After that date, data may not be recoverable. Implement a `reactivation_available_until` timestamp in the internal ledger.

**Acceptance criteria:** Not applicable — owned tool. Document for FUB data export / migration planning. See `21-gap-map-vs-inhouse-crm.md` for migration checklist.

---

## 7. Page Loading States

Both inbound and outbound navigation on Billing routes produces a **loading state** before content renders.

| Element | Detail |
|---|---|
| Page body during load | Blank light-gray; full `content-area` is empty |
| Loader | Centered animated spinner (blue arc, ~24–32 px) |
| Nav/subnav | Fully rendered immediately; only content area shows loader |
| Pattern | Full-page SSR/navigation (not SPA AJAX) — each Billing sub-page is a distinct route load |

**Build implementation:**

```tsx
// Standard Next.js loading.tsx pattern for /admin/billing route group
// app/admin/billing/loading.tsx
export default function BillingLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  );
}
```

Alternatively, use `<Skeleton>` components from `@/components/ui/skeleton` that match the shape of the Billing overview card sections.

---

## 8. Business Registration (A2P / 10DLC)

While not part of the `Admin > Billing` UI directly, Business Registration is tightly coupled to billing and texting capability. It appears in the Admin subnav under `More` and is referenced in the Billing docs.

**Route (FUB):** `Admin > Business Registration`  
**In-house CRM:** The Ryan Realty A2P registration is already complete (per `project_twilio_cutover.md`). This section documents the FUB model for completeness.

### 8.1 Registration statuses (per FUB docs)

| Status | Color badge | Meaning |
|---|---|---|
| `Not Started` | — | Not submitted |
| `Submitted to FUB` | Yellow | FUB internal review in progress (~48 hours) |
| `Passed FUB, Under Carrier Review` | Yellow | Submitted to US carriers |
| `Rejected by FUB` | Red | Business info / website needs updates; resubmit after corrections |
| `Rejected by Carriers` | Red | Carrier declined; correct and resubmit |
| `Fully Registered` | Green | Final carrier approval; no action needed |

### 8.2 Registration requirements (per FUB docs)

1. Valid EIN (Employer Identification Number, IRS-issued)
2. Legal business name, address, and details matching IRS records exactly
3. Website with opt-in consent language on the primary contact form
4. Privacy policy explicitly stating collected phone numbers are not shared for marketing
5. SMS Terms and Conditions covering: appointment confirmations, cancellation (STOP), support (HELP), carrier liability disclaimers, message rate notices

### 8.3 Registration scope (per FUB docs)

- **One registration per account** covers all team members and all phone numbers
- Additional numbers added after registration automatically inherit approved status
- Form is completed once; no per-user or per-number re-registration
- US-only requirement; Canadian accounts have a separate process
- FUB covers all registration fees (per FUB docs)

### 8.4 Spam Label Calling Protection (per FUB docs)

- Auto-activated once Business Registration is `Fully Registered`
- Registers FUB phone numbers with major US carriers to prevent legitimate calls being flagged as spam
- Uses first 15 characters of legal business name from registration
- No extra cost
- Not available for Canadian phone numbers
- Requires TCPA-compliant calling practices to remain effective

**Build note — in-house CRM:** Ryan Realty's A2P registration is via Twilio (not FUB). Status is tracked in `brokers.twilio_number`. Spam label protection equivalent: Twilio SHAKEN/STIR caller verification. Implement a `business_registration` table mirroring the status enum above for audit purposes.

---

## 9. Invoices & Billing Contact

**Not directly observed in GIF.** Behavior from per FUB docs only.

### 9.1 Billing contact email (per FUB docs)

- A **separate billing contact email** can be configured to receive invoices
- This is distinct from the account owner's login email
- Location in FUB UI: likely in `Admin > Billing` settings (not captured in GIF)

### 9.2 Invoice content (per FUB docs)

Invoices include:
- Business billing address (determines tax rate)
- Plan name and seat count
- Add-on charges
- Annual discount (if applicable)
- Sales tax (if applicable)
- Total charge

### 9.3 Build note — in-house CRM

Store in `company_settings`:
```sql
billing_contact_email   text,   -- where invoices/receipts are sent
billing_contact_name    text,   -- optional display name
```

**Acceptance criteria:** Not applicable — owned tool. Implement for vendor invoice tracking (FUB contract invoices stored in Google Drive, not the CRM).

---

## 10. Data Touched

### 10.1 Entities read on Billing overview

| Entity / Table | Fields read |
|---|---|
| `brokers` (account owner) | `first_name`, `portrait_url`, `created_at` |
| Account stats | `COUNT(crm_people)`, `COUNT(crm_timeline WHERE channel='email')` |
| Subscription record | `plan_name`, `per_seat_annual_usd`, `seat_count`, `gross_annual_usd`, `discount_usd`, `net_annual_usd`, `next_billing_date`, `billing_period` (monthly\|annual) |
| Business billing address | `billing_address_line1`, `billing_address_line2`, `billing_city`, `billing_state`, `billing_zip`, `billing_country` |
| Payment method (masked) | `card_last4`, `card_exp_month`, `card_exp_year`, `card_brand` |
| Calling add-on | `calling_addon_enabled`, `calling_users[]` |

### 10.2 Entities written

| Action | Entity / Field written |
|---|---|
| Edit business billing address | `billing_address_*` fields |
| Update credit card | External Stripe record; local `card_last4`, `card_exp_*` updated on success |
| Enroll in Calling add-on | `calling_addon_enabled = true`, `calling_users` array updated |
| Remove from Calling add-on | `calling_addon_enabled`, `calling_users` updated |
| Cancel subscription | `subscription_status = 'cancelled'`, `cancellation_reason`, `cancelled_at`, `access_until` |
| Reactivate subscription | `subscription_status = 'active'`, `reactivated_at` |

---

## 11. Acceptance Criteria

### 11.1 Admin > Billing overview page

1. **Access gate:** Only the account owner / principal broker role can access `/admin/billing`. All other roles receive a redirect to `/admin` or a 403 error page.
2. **Header block:** Displays account owner avatar, personalized greeting, live people count, live email count, and customer-since year. Counts are sourced from live DB queries, not cached values.
3. **Product Plan section:** Displays plan name, per-seat price formula, total gross price, and a link to seat management. Formula is `per_seat_annual × seat_count = gross_total`.
4. **Calling add-on section:** When calling is not enrolled, shows `Try calling for 14 days` link. When enrolled, shows per-user breakdown.
5. **Total Annual Payment section:** Displays discount line, next billing date (formatted as `MMM d, yyyy`; shows `—` if null — do not render `Invalid date`), annual cost, sales tax, and bold total. All values are computed, not hardcoded.
6. **Business billing address:** Displays address in a sub-card with a `?` tooltip and an `Edit` control. Edit action opens an inline form or `<Sheet>` for address update. Address is saved and persisted.
7. **Credit card:** Displays masked PAN (`•••• {last4}`), expiry (`Exp. {M}/{YYYY}`), card brand icon, and `Update credit card` link. Update link navigates to external payment processor.
8. **`ⓘ How Billing works` button:** Present in the Admin subnav on all Billing routes. Clicking opens a `<Dialog>` modal with a help video. Modal dismisses on `×` click, `Escape` key, and backdrop click.

### 11.2 Calling add-on enrollment page

9. **Route:** Accessible from the `Try calling for 14 days` link. Full-page navigation; subnav adapts (Billing tab collapses into More ▾).
10. **Broker list:** All active brokers shown as checkable rows with avatar, full name, and `<Checkbox>`. Sourced from `brokers` table.
11. **Totals card:** Shows base plan line, sales tax, and total. Updates live as broker checkboxes are toggled (adds calling add-on cost per selected broker: $39/user/month × 12 = $468/user/year).
12. **Save Changes button:** Disabled when no broker is selected. Enabled when ≥1 broker is selected. On click, persists the enrollment and returns to billing overview.
13. **Breadcrumb:** `< Back to overview` navigates back to Billing overview as a full-page navigation.
14. **Marketing upsell block:** Renders below Totals card with illustration, headline, 4 feature bullets, and `Learn more` link.

### 11.3 Plan changes and lifecycle (FUB behavior — document only for transition reference)

15. **Plan upgrade:** No waiting period; effective immediately; confirmation screen shows amount before charging.
16. **Plan downgrade:** Blocked if seat count exceeds new plan maximum. User must remove team members before downgrade proceeds.
17. **Billing period switch (monthly ↔ annual):** Billing date resets to date of change; unused time in old period credited.
18. **Cancellation:** Owner-only. Requires reason selection + feedback. Access continues through billing period end. Reactivation available before period end.
19. **Immediate deletion:** Separate action from cancellation. Causes instant loss of access for all users.

### 11.4 Loading states

20. **Page load:** While any Billing route is loading, the content area renders a centered spinner. Nav and subnav are immediately visible. `<Skeleton>` components acceptable as alternative.
21. **Navigation transitions:** Full-page navigations between Billing overview and sub-pages (Calling add-on, Change Plan) show loading state during transition.

### 11.5 Not applicable — owned tool (with reasoning)

| FUB Feature | Status | Reasoning |
|---|---|---|
| Per-seat billing & invoices | Not applicable | Ryan Realty's in-house CRM is owned software; no SaaS subscription fee per broker |
| Credit card / payment method | Not applicable | No external payment processor needed for internal tool |
| Annual discount / proration | Not applicable | No billing period; tool cost is fixed development + hosting |
| Plan tiers (Grow / Pro / Platform) | Not applicable | Single internal deployment; feature flags replace plan-gating |
| Cancellation / reactivation flow | Not applicable | Owned tool cannot be "cancelled" — decommission is a deployment decision |
| Calling add-on ($39/user/month) | Not applicable | Twilio calling is built in; no per-seat add-on charge |
| FUB Business Registration (A2P) | Complete (external) | Ryan Realty's A2P registration is via Twilio, already approved |
| GST/HST registration | Not applicable | US-based business (Oregon); no Canadian tax requirements |
| Sales tax | Not applicable | Oregon has no sales tax; no billing surface to apply tax to |
| Billing contact email | Partially applicable | Store vendor invoice delivery email in `company_settings` for FUB/Twilio/Vercel contract invoices |
| Business billing address (billing surface) | Partially applicable | Address needed for document generation (CMAs, letters) — store in `company_settings`, not in a billing UI |
| Billing address 10-year retention | Retained | Company address is a permanent record regardless of billing context |

---

## 12. Component Inventory

| Component | Implementation |
|---|---|
| `BillingOverviewCard` | `<Card>` from `@/components/ui/card`; max-w ~430px; centered on `bg-background` |
| Account stats bar | Static stat display; inline `<span>` elements; emoji allowed in header blocks |
| Section separators | `<Separator>` from `@/components/ui/separator` |
| `BillingVideoModal` | `<Dialog>` from `@/components/ui/dialog`; video `<iframe>` inside `<DialogContent>` |
| Address sub-card | Nested `<Card>` inside main card; `<Tooltip>` on `?` icon |
| `Edit` address link | `<Button variant="link">` or `<Sheet>` trigger |
| Credit card display | Read-only `<div>` with card icon SVG + masked PAN + expiry |
| `CallingAddonEnrollment` | Two-column `<div className="grid lg:grid-cols-[3fr_2fr]">` |
| Broker checklist row | `<Checkbox>` from `@/components/ui/checkbox` + `<Avatar>` from `@/components/ui/avatar` |
| Totals card | `<Card>` with live-updating numeric display |
| Save Changes button | `<Button>` from `@/components/ui/button`; `disabled` when no selection |
| Loading spinner | `<div className="animate-spin ...">` or `<Skeleton>` from `@/components/ui/skeleton` |
| Subnav dropdown | `<DropdownMenu>` from `@/components/ui/dropdown-menu` for `Billing ∨` |

---

## 13. Edge Cases & Gotchas

1. **`Invalid date` on next billing date:** The FUB billing page renders `Invalid date` when `next_billing_date` is null. The in-house build must guard: `billingDate ? format(billingDate, 'MMM d, yyyy') : '—'`.

2. **Billing access is owner-only:** No other role (not even admin) can view or modify billing in FUB. The in-house CRM must enforce this at the route level, not just the UI level.

3. **Annual discount is a separate line item:** The gross total ($2,484) and the discount ($414) are displayed separately, with the net total ($2,070) as the bottom line. Do not show only the net without the discount — the savings figure is a retention/upsell message.

4. **Calling add-on trial can only be started once every 6 months** (per FUB docs). Implement `calling_trial_last_started_at` to gate repeated trial requests.

5. **Downgrade blocked until seats reduced:** The plan-change flow must validate `current_seat_count ≤ target_plan_max_seats` before allowing the change. Surface a blocking error with the required action: "Remove N team members before downgrading."

6. **Business billing address ≠ payment card billing address:** Two distinct address objects. The business billing address determines tax; the card billing address is stored by the payment processor. Never conflate or copy one to the other.

7. **One payment method:** FUB does not allow splitting payment across multiple cards or accounts. The in-house build (if it ever needs payment) must enforce this same constraint.

8. **Subnav adapts between Billing overview and sub-pages:** The `Billing ∨` tab in the subnav is replaced by `More ∨` + `Admin Overview` button on sub-pages. This requires active route detection in the subnav renderer.

9. **Calling add-on Totals panel is live-updated per checkbox:** The recalculation must happen client-side (optimistic) before Save — not after a round-trip to the server. Use `useMemo` or `useEffect` on the selected brokers state.

10. **Oregon sales tax = $0:** The Sales Tax line exists in the UI even when zero. Always render it explicitly (do not hide); this signals that the tax calculation ran and returned zero, not that it was skipped.

---

## Sources

| Source | Type | Coverage |
|---|---|---|
| `/scratchpad/fub-analysis-gif/billing.md` | GIF analysis (f01–f07) | Billing overview page all sections; How Billing Works modal; Calling add-on enrollment page; loading states; dynamic interaction table |
| `/scratchpad/fub-docs/account-team-billing.md` | Official FUB documentation (34 articles) | Plan tiers, pricing model, calling add-on cost, billing period options, proration, downgrade blocking, cancellation flow, business billing address rules, GST/HST, A2P registration, payment method, invoice/billing contact, data retention requirements |
| `docs/FUB_CRM_FEATURE_SPEC.md` | Prior spec | Section referenced as "not in prior spec — new"; no billing section existed to supersede |
| `project_twilio_cutover.md` (memory) | Project context | Twilio cutover complete; 541.703.3095 ported; A2P verified; calling built-in (not FUB add-on) |
| `project_crm_replacement_initiative.md` (memory) | Project context | FUB replacement scope; dialer 103 calls ever (low utilization confirms calling add-on was not heavily used) |
