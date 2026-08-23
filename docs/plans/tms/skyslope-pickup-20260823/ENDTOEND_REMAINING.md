# End-to-end remaining Vault items — 2026-08-23 (pass 3)

## Goal

A broker opens Vault and uses it as the file without SkySlope:

1. **New file from Closings** — Seller opens a listing (Residential — Standard); Buyer opens an accepted-offer sale. Primary client name + email become the CRM party. File owner is the acting broker’s SkySlope-style name (`Matt Ryan`, not slug `matt`).
2. **DigiSign palette complete** — Signature, Initials, Full Name, Date, Time, Checkbox, Text, Strike, Highlight. Full Name and Time stamp on tap (Pacific).
3. **Outgoing signing email** — composer Edit message (subject + body) is what the signer receives. Empty fields keep the Ryan Realty default copy.
4. **Offer PDFs** from Offer threads stay on the cycle. Beaumont already has Nicoll Offer 3 / counters on the file.
5. **MLS facts seed the checklist** when an MLS number is on the new file or on Accept Contract (well / septic / HOA / LBP).
6. **Calendar** — CRM calendar already has listing expiration / accepted / close. Google write is attempted; DWD `calendar` scope is the named credential stop if it still fails.
7. **Tyler Nicoll** stays other-side. We do not invent a personal email.

Shipped this pass (on production after Vercel `a95e57f1`): new file, Full Name + Time, Edit message, broker file name, MLS fact seed, live CHECK + invite columns. Verified 2026-08-23: Closings New file (Seller/Buyer, Open file requires email), Beaumont offer PDFs on the file, Tyler Nicoll labeled other-side.

Credential stops (unchanged unless Admin grants them):

1. Google Workspace DWD must include `https://www.googleapis.com/auth/calendar` for writes.
2. Tyler’s personal address is not in Matt/Paul/Rebecca mail.

Do not: clone Offers, mutate SkySlope, send a live envelope, create Tyler as a CRM lead.
