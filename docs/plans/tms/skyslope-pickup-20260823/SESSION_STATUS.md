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

## Continuation (same Chrome)

- Vault Closings + Sign-off live as Matt. 17 / 14 overdue / 3 deals confirmed. See `VAULT_LIVE_2026-08-23.md`.
- Breeze look-only. 52 clients; 3480 listing packet OREF SPDS filled + OR LBP canceled. See `BREEZE_WALK.md`. Do not clone Breeze.
- Closed-to-Archive page 3: 712 SW 1st St Madras only.
- **Code on this branch:** Closings rail unparks Signing (brokers) and Sign-off (superuser). Envelope picker uses live Forms roles. New in-house deals seed a checklist from the Oregon matrix. Deal New envelope has Form library → `createEnvelopeFromTemplate`. Gmail sync + Twilio inbound SMS auto-file onto the matching deal (`mail_filed` / `sms_filed`, PDFs onto inbox + checklist). Production still the old surfaces until this ships.

## Still blocked / not this pass

- Full DTR 4-page recount and Dead Deals 12+2 identities (confirm-only; not opened).
- DigiSign New Envelope chevron options (would start a new envelope).
- Role-specific File Details field blocks besides Buyer Agent and Buyer.
- What Suite receives after a **completed** seal (send forbidden).
- Production Closings rail still parked until this branch deploys.

## Repo already had (do not redo)

Forms map, fill, envelope modal occupants, DigiSign index/history, libraries OR/OREF/ODS, Vault walk, Manage Listings grid, Closed-to-Archive page 1, Working Documents, Offers empty/404.

## Next Vault build (no SkySlope required)

See `CODE_TRUTH.md`. Role list is no longer the blocker.

Done on this branch: live Forms recipient roles; checklist seed; Form-library envelope compose; Signing/Sign-off on Closings rail; auto-file inbound mail/Twilio.

1. `action_required` as a real column (Needs to sign / Receives a copy / No action) instead of `cc` as a role.
2. Twilio MMS PDF fetch (optional; media URLs expire and need auth).
3. Listing pipeline later; Closings already has an active-listing lens.
4. Merge/deploy.
