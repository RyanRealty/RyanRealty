# SkySlope Forms full map — Forms Review → Chief of Staff
Date: 2026-08-22 PT. Spec only. Look-only. Nothing mutated or sent.

Locked: OR primary. OREF under existing license (not applying to be listed host). Do not strip seals. Current published only. Brokers prepare + send; Matt verifies. Suite + Forms → one Vault. DigiSign send owned by Sign Review / Transaction.

## Auth note (blocker)
Suite→Apps→FORMS is the working path (one Suite login covers Forms). Direct forms.skyslope.com often hits forms-login.
Chrome crashed mid-walk after Home Estimate (Pilot). After relaunch: Suite → LoginIntegrated.aspx AND Forms → forms-login. Shared session gone. Prepare Signature roles NOT captured. Do not ask Matt to sign in again unless CoS directs.

## Nav (exact)
Files · Templates · Browse Libraries · Clauses · Buyer Agreements · Leaderboard · User Settings · Broker Management · Apps · Help · Logout.

## Files
- `/?tab=all` 52 · `/?tab=mine` 41 · `/?tab=archived` 66
- + Create · Search · View as Grid · Filter By · + Start Buyer Agreement
- Columns: File Name | Representation | Forms & Envelopes (+ Archive: Status)
- Create File (cancelled): Owner Matt Ryan (me); Representation Buyer/Tenant/Seller/Landlord; Seller Net Sheet; Import MLS; name by Address/client; brokerage templates OREF listing packs.
- Filter By + View as Grid: NOT re-captured this morning (session lost).

## Browse Libraries `/browse-libraries`
All 298 | OR 101 | OREF 170 | ODS 27. Multi-select.
Filters: All libraries · Oregon Data Share (MLSCO, KCAR, SOMLS) - ODS · Oregon Real Estate Forms - OREF · Oregon Realtors - OR
Footer CTA not clicked: Add additional association libraries. Per row: Add (not clicked).

## Templates `/templates/manage`
Personal: OR Residential Buyers (20), OREF Residential Buyers (24)
Brokerage Owner: OREF New Team Listing (14), OREF New Listing (13)

## Clauses
My + Brokerage empty. + Add Clause not clicked.

## Buyer Agreements `/buyer-agreements`
18 rows. Agent | Buyer | Signed On | Accepted On. View + Accept not clicked. Pending.

## File Millard Referral `/file/12904430/...`
Link to SkySlope on every tab.

### Forms `/documents`
1 FORM. Select All · + Add Forms · Upload Documents · Apply Template (not clicked).
Card: Referral Fee Agreement - 107 OREF. Kebab: Download, Delete (escaped).

### Envelopes `/envelopes`
Columns: Envelope | Date Sent | Status | Action.
- Millard Referral · (blank) · Draft
- Millard Referral · 07/13/26 · Completed

### Signed Documents `/signed-documents`
1 SIGNED DOCUMENT. Upload Documents.
Referral Fee Agreement - 107 OREF / Millard Referral / July 13, 2026 at 12:01 p.m. · More ⋮

### File Details `/details`
BASIC DETAILS: File name, MLS #, Sale price ($), Acceptance date, Closing date.
PROPERTY ADDRESS: Street address, Unit #, State, Postal code, County (+ more below fold).
(Millard Referral name filled; address/price empty on this referral file.)

### Home Estimate
Redirects to pilot.skyslope.com/integrations/forms?fileId=… — Calculate Home Estimate cash-to-close. Purchase Price required. Address fields. Cash to Close $0 (Down Payment / Prepaids / Fixed). Exit · Clear · Preview · Save Estimate · Share By Email. Nothing entered/saved.

## Fill `/fill/envelope/68622087?...`
Referral Fee Agreement - 107 OREF. Auto-merged fields. Page · ink · print · download · email · zoom · Import Data.
Bottom: Save & Exit · Save as a Template · **Prepare Signature**.
No standalone field editor on fill. Recipients + field tools behind Prepare Signature — **not opened** (session lost before click).

## Prepare + send (Forms half)
1. Create file by representation (or Start Buyer Agreement)
2. Add forms (OR primary) / Apply Template / clauses
3. Fill (auto-merge / Import Data)
4. Prepare Signature → roles + tags → DigiSign send (Transaction owns send)
**Role list: NOT YET OBSERVED.** Need re-auth via Suite Apps then open Prepare Signature without Send.

## Suite twice
Deal vs Forms file (Link to SkySlope) · Write Offer/Listing in both · Suite facts → Forms Import Data · Checklist Attach vs Add Forms · Buyer Agreement in both · Docs/Review vs Forms+Envelopes+Signed · Checklist Type vs libraries.
Contacts: Suite Contacts tab; Forms fill uses merged fields. No second Forms Contacts editor seen.

## Library → checklist today
Does NOT. `required-documents.ts` is role × facts → OREF numbers. /admin/forms does not write checklist.

## Jobs vs /admin/forms + ingest (OR 1837 / ODS 1528 / OREF 1340)
| Job | Forms (walked) | Our TC |
|---|---|---|
| Browse libraries | Have | Partial board + freshness |
| Add to file/deal | Add / Add Forms / Apply Template | Missing UI for createEnvelopeFromTemplate |
| Fill | Have | Partial OREF 001 packet |
| Field placement | Behind Prepare Signature (not opened) | Partial ingest field_map + /admin/signing Place fields |
| Templates | Have | Partial OREF packet only |
| Clauses | UI empty | Missing |
| Buyer Agreements | Have | Missing Forms flow |
| Files All/My/Archive | Have | Missing |
| Roles → DigiSign | **Blocked — need session** | Transaction/Sign Review |
| File tabs Envelopes/Signed/Details/Home Estimate | Have | N/A (Vault merge target) |

## Shots
/workspace/forms-walk/files/, libraries/, templates/, clauses/, buyer/, editor/01-02 + 10–13, more/apps-switcher.png, admin-match/
