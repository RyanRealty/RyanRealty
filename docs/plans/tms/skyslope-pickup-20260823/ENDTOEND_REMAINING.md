# End-to-end remaining Vault items — 2026-08-23 (pass 4)

## Goal

A broker can walk into Vault and finish the leftover file jobs without SkySlope:

1. **Listing packet** — Forms holds **Listing — Standard** (OREF 015 listing agreement, 042 agency pamphlet, 043 electronic-funds advisory, 020 seller disclosure when the library has a blank). Distinct from sale **Residential — Standard** (001 + 020 + 042 + 043 + 015).
2. **Duplicate listing copies documents** — Duplicate kebab copies live (non-archived) PDFs onto the new file, not only people/checklist.
3. **CDA a closer can send** — Generate CDA prints address, MLS, escrow, close, parties, sale/list price, GCI percent, office gross, and the commission split table.
4. **Calendar after acceptance** — besides expiration / accepted / close, the CRM calendar gets the **7-banking-day principal review** date (OAR 863-015-0140) from contract acceptance. Google write stays fail-open.
5. **Tyler Nicoll** stays other-side. No invented email.

Credential stops:

1. Google Workspace DWD must include `https://www.googleapis.com/auth/calendar` for writes.
2. Tyler’s personal address is not in Matt/Paul/Rebecca mail.

Do not: clone Offers, mutate SkySlope, send a live envelope, create Tyler as a CRM lead, guess inspection/financing windows that are not in the Oregon matrix.
