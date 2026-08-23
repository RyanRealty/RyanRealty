# End-to-end remaining Vault items — 2026-08-23

## Goal

A broker opens a live deal and the file is usable without retyping mail:

1. **Offer PDFs** from inbound Offer threads land on the cycle as documents.
2. **Form auto-fill** stamps more SkySlope `dataRef` names (premises, purchase price, EM).
3. **Residential — Standard** is a saved form packet a broker can instantiate.
4. **CDA** is a readable disbursement page (address, escrow, GCI, nets).
5. **PDF markup:** composer can place a highlight (yellow bar), sealed onto the PDF.
6. **Calendar:** CRM calendar already has dates; Google write is attempted; if DWD lacks `calendar` scope that is a named credential gap, not a code gap.
7. **esign.send** stays parked (D1 lock vs “complete remaining” — send already lives on the composer).
8. **Tyler Nicoll** stays other-side; we do not invent a personal email.

Shipped 2026-08-23: offer PDF pull, extra dataRefs, Highlight, CDA, Residential packet, esign.send unparked (matches composer Send).

## Stops (named)

1. **Credential:** Google Admin DWD is `calendar.readonly`. Verified 2026-08-23: `calendar` write returns `unauthorized_client`. CRM calendar still gets listing expiration / acceptance / close. To land events on Google Calendar, add `https://www.googleapis.com/auth/calendar` to the Workspace DWD client for the service account.
2. **Tyler Nicoll:** other-side buyer (Tiffany Clark). 12 Beaumont/Nicoll bodies scanned — no personal `nicoll@` / `tyler@`. Not a CRM lead.
