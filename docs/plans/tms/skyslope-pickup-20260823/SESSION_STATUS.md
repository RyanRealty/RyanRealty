# SkySlope pickup session — 2026-08-23

Branch: `grok/skyslope-pickup-20260823` (worktree `/Users/matthewryan/RyanRealty-wt-skyslope-pickup-20260823`, off `origin/main`, contains `e24c3f0e4`).
CMA checkout `cursor/cma-client-document-7fc3` was **not** touched.

Look-only. No Send. No Create Listing. No Create File. No Offers Terms. No SkySlope mutation that was saved (draft compose left via Leave; contact edit/add cancelled; delete-contact dialog cancelled).

## Chrome

- Playwright MCP, one headed Chrome, profile `~/.grok/browser-profile`.
- Login wall was **real**: `LoginIntegrated.aspx`, `matt@ryan-realty` prefilled, Next not clicked. Matt signed into Suite. Then Broker Home as **Matt Ryan / Ryan Realty**.
- Suite → Apps → FORMS + DIGISIGN. Breeze already in a tab. Did not use forms-login as a second password.

## Captured live this session (the 22 Aug gap)

**Role list** — `ROLE_LIST.md`. Lives on Forms File Details CONTACTS, not DigiSign.

Complete listbox (10 options, no overflow): None, Buyer, Seller, Escrow Officer, Title Officer, Loan Officer, Buyer Agent, Seller Agent, Broker, Other.

Also: Action required (3 values on Forms, 2 on DigiSign), signing groups, DigiSign field palette including Strike, reminders, Cancel/Next/Leave, Write A Listing → Forms create Seller (cancelled).

## Leftovers

See `SUITE_LEFTOVERS.md` and `LISTINGS_MAP.md`. Working Documents already filed 22 Aug. Offers not reopened.

## Not captured / blocked

- Vault `/admin/closings` and `/admin/sign-off` in this Chrome: dedicated profile has **no** ryan-realty admin Google session (`pickup-45-vault-admin-login.png`). Optional tab. 22 Aug `VAULT_WALK` + code still stand. Did not ping Matt for a second login.
- Closed-to-Archive **page 3**.
- Full DTR 4-page recount and Dead Deals 12+2 identities (confirm-only; not contradicted because not opened).
- DigiSign New Envelope chevron options (would start a new envelope).
- Role-specific File Details field blocks besides Buyer Agent and Buyer.
- What Suite receives after a **completed** seal (send forbidden).

## Repo already had (do not redo)

Forms map, fill, envelope modal occupants, DigiSign index/history, libraries OR/OREF/ODS, Vault walk, Manage Listings grid, Closed-to-Archive page 1, Working Documents, Offers empty/404.

## Next Vault build (no SkySlope required)

See `CODE_TRUTH.md`. Role list is no longer the blocker.

1. Map envelope recipients to the live Forms enum (`ROLE_LIST.md`) instead of invented `RECIPIENT_ROLES`.
2. Library-driven checklist seed on a **new** deal (anticipated-docs is the predictor, not the seed).
3. `createEnvelopeFromTemplate` UI (backend exists, no caller).
4. Auto-file inbound mail / Twilio / CRM onto `tc_events` + matching checklist.
5. Sign-off (and signing) onto the left rail.
6. Listing pipeline later; Closings already has an active-listing lens.
