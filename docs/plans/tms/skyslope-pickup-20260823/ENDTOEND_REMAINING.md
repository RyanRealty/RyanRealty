# End-to-end remaining Vault items — 2026-08-23 (pass 4)

## Goal (e2e)

A broker can walk a live file in Vault without SkySlope: inbound PDFs are classified (needs our signatures vs fully executed), one-sided files collect our signatures then wait for the other broker’s return, dual files run DigiSign groups in Vault, and the deal page shows that state in words.

A broker can walk into Vault and finish the leftover file jobs without SkySlope:

1. **Listing packet** — Forms holds **Listing — Standard** (OREF 015 listing agreement, 042 agency pamphlet, 043 electronic-funds advisory, 020 seller disclosure when the library has a blank). Distinct from sale **Residential — Standard** (001 + 020 + 042 + 043 + 015).
2. **Duplicate listing copies documents** — Duplicate kebab copies live (non-archived) PDFs onto the new file, not only people/checklist.
3. **CDA a closer can send** — Generate CDA prints address, MLS, escrow, close, parties, sale/list price, GCI percent, office gross, and the commission split table.
4. **Calendar after acceptance** — besides expiration / accepted / close, the CRM calendar gets the **7-banking-day principal review** date (OAR 863-015-0140) from contract acceptance. Google Calendar write is granted (verified 2026-08-23).
5. **Who must sign is known before send** — Vault reads the document (field map, page-1 OREF stamp / title, filename) against the Oregon form library. It does not ask the broker to name signers. The listing/buyer broker is Needs to sign only when that form requires it. Unreadable forms cannot be sent. Send refuses if a required role is only Receives a copy. Checklist / sign-off cannot mark complete while that form’s envelope is still out or only partly signed.
6. **The form must be completed as required — not every blank.** Requirement comes from that form: field-map `isOptional`, signature lines tagged to a role, and a small known-fact list (001 needs parties/address/price; 015 needs sellers/address/list price). Optional checkboxes and unknown blanks stay empty. The envelope will not seal while a *required* signature field is empty.
7. **One-sided representation.** We collect our clients' signatures in Vault, email the signed PDF to the other broker, and file the executed copy they send back (mail or SMS). Other-side principals do not get our signing links. Checklist stays open until that return is filed.
8. **Dual representation.** Both principals sign in Vault. Signing groups match DigiSign: who signs first (buyers together), then who signs second (sellers), then agents if the form requires them. A later group cannot sign until the earlier group is done. The next group is emailed only when it is their turn.
9. **Inbound PDF execution state.** A mailed PDF is fully executed only when every obligated role on that form has a signature marker. Buyer-only offer on a listing needs our sellers. Seller-only SPD is our-side signed, not complete. Email "signed/executed" is a hint, not proof. SkySlope Envelope completed is that envelope, not both sides of the deal.

## Remaining (this grind)

Unblocked: catalog apply pulls new/revised licensed PDFs. A deal can confirm property facts (well, septic, HOA, financing, year built) and add the matching Oregon checklist rows. Generate CDA prefills inbound referral % of GCI when the client was referred in, and notes the W-9. Library filter + Open blanks stay on `/admin/forms`.

Blocked on Matt: send a live envelope. Blocked on mail DNS: per-deal inbound address. Blocked on a new license: any library outside OREF / OR / ODS.

## This pass (complete)

- Licensed Oregon library pulled from SkySlope Forms (not samples): **170 OREF + 101 Oregon Realtors + 27 ODS**, each with AcroForm field maps. The leftover 2024-05 ODS input sample is retired in favor of **ORE Residential Input**.
- All three SkySlope libraries Matt uses stay first-class: OREF, Oregon Realtors, and **Oregon Data Share** (MLS entry, change forms, exclusive listing, land/farm/commercial input).
- Versioning: catalog check filters those three libraries by `libraryId` (the list query ignores skip/libraryId). `/admin/forms` shows Current / Update available / New / Retired. The composer will not send a stale blank.
- ODS packets on listing files: **ODS — MLS Entry (Residential)** and **ODS — MLS Change**, plus Exclusive Listing / Land / Farm / Commercial on the Forms packet list.
- Library filter on search and compose (SkySlope “Filter results by: All libraries”). A new market is a new library, not a mixed pile of every blank.

Do not: clone Offers, mutate SkySlope, send a live envelope, guess inspection/financing windows that are not in the Oregon matrix.
