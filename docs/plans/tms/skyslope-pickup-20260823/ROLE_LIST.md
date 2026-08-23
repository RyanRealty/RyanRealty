# Prepare Signature / recipient roles — live capture 2026-08-23

Look-only. No Send. No contact saved or deleted. Millard Referral file `12904430`.
Session Chrome: dedicated Playwright profile. Signed in as Matt Ryan / Ryan Realty.

**This is the gap the 22 Aug walk never opened.** Role is **not** a DigiSign picker.

## Where roles actually live

Roles are **Forms file contacts**, File Details → CONTACTS.

Path: Suite → Apps → FORMS → file → **File Details** → CONTACTS table (Name | Role | Email) → Edit / **+ Add Contact** → “Please select a role for your contact”.

They then **flow as static labels** onto the Forms “Create an envelope” modal (Name | Role | Action required). DigiSign compose **does not** show or edit Role.

## Live role enum (complete; listbox scrollHeight === clientHeight, 10 options)

| UI label | wire `data-value` | Notes |
|---|---|---|
| None | `""` | Default on + Add Contact |
| Buyer | `Buyer` | Principal. Form section: **Contact information** (Add Contact, cancelled) |
| Seller | `Seller` | Principal. Field block **not opened** this pass |
| Escrow Officer | `EscrowOfficer` | |
| Title Officer | `TitleOfficer` | |
| Loan Officer | `LoanOfficer` | Not “Lender” |
| Buyer Agent | `BuyerAgent` | Millard file already has **two** of these |
| Seller Agent | `SellerAgent` | |
| Broker | `Broker` | |
| Other | `Other` | |

Shots: `forms/pickup-28-role-dropdown.png`, `forms/pickup-31-add-contact-role-dropdown.png`.

**Not in the live list:** Transaction coordinator, Appraiser, Inspector, Buyer (2nd), Seller (2nd), Listing broker, Buyer’s broker, Lender, CC, Tenant, Landlord.

Multiples of a role: **same role repeated** via + Add Contact (two Buyer Agents on this file). There is no “Buyer 2” role.

## Action required (three different surfaces — not the same)

| Surface | Options |
|---|---|
| Forms File Details Edit/Add Contact | Needs to sign · Receives a copy · **No action** |
| Forms “Create an envelope” modal | Needs to sign · Receives a copy · **No action** |
| DigiSign Edit/New Recipient | Needs to sign · Receives a copy (**no** “No action”) |

Wire on Forms: `NeedsToSign`. DigiSign hidden value: `Signer`.

## Signing order (DigiSign Recipients dialog only)

- Default: both signers in **WHO SIGNS FIRST** (parallel).
- **+ Add a Signer Group** creates **WHO SIGNS SECOND** (and so on).
- Per-recipient **Signing Group** dropdown on this envelope: `1` and `2`.
- **RECEIVES A COPY OF SIGNED DOCUMENTS** is a drag target (CC by placement, not by role).
- Recipients kebab: **Edit Recipients** only.
- Footer: Cancel · Save. Did **not** Save.

## DigiSign compose (after Forms Next; Send stayed disabled)

- Recipients listed by name/email + color, **no role**.
- Field palette: Signature · Initials · Full Name · Date · Time · Checkbox · More → **Text Field · Strike**.
- Signer dropdown: people only (Matthew Ryan, Matthew Le Baron).
- Outgoing email kebab: **Edit Message** (subject “You have documents to sign” / body “Your documents are ready to review and sign.”). Cancelled, not saved.
- Back → “Are you sure you want to leave? Changes you have entered will not be saved.” Stay / Leave. Left. URL `revertedEnvelopeId=68739053`.
- **No Send.**

## Forms Create an envelope modal (Prepare Signature)

- Envelope name, static Role from file contacts, Action required dropdown, checkbox **Enable automatic reminders on this envelope.** (checked), Cancel / Next.
- Role column is **not** a dropdown here.
- Next opens DigiSign compose (draft). Leave discarded compose changes.

## Our Vault `lib/tc/signing.ts` RECIPIENT_ROLES vs live

| Our enum | Live SkySlope |
|---|---|
| `buyer1` / `buyer2` | `Buyer` (multiples of same role) |
| `seller1` / `seller2` | `Seller` (multiples) |
| `listing_broker` | **Seller Agent** (and separate **Broker**) |
| `buyer_broker` | **Buyer Agent** |
| `escrow` | **Escrow Officer** |
| `title` | **Title Officer** |
| `lender` | **Loan Officer** |
| `other` | **Other** |
| `cc` | Not a role. Action = Receives a copy, or drag to RECEIVES A COPY group |

**Do not treat the current Vault enum as observed SkySlope.** It was invented. Replace from this table when building prepare/send.

## Contact form shape by role (partial)

- Buyer Agent: **Agent information** + **Brokerage information** (license, MLS code, brokerage name/phone/fax).
- Buyer (Add Contact, cancelled, not saved): **Contact information** (no brokerage block).
- Other roles’ field blocks: **not** fully opened this pass.

## Not the same as create-file Representation

Write A Listing / Create File radios: **Buyer · Tenant · Seller · Landlord**. Tenant and Landlord are **file representation**, not contact Role dropdown values.

## Do not claim

- That DigiSign has a role picker (it does not).
- That SkySlope has Transaction coordinator / Appraiser / Inspector signing roles (not in this listbox).
- That `RECIPIENT_ROLES` in code is the live list.
- That `TC_CONTACT_ROLES` (deal vendors: appraiser, TC, attorney, …) is this dropdown. Different list.
