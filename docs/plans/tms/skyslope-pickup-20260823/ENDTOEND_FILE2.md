# End-to-end mission — Vault file 2 + open defects (2026-08-25)

Branch `grok/skyslope-pickup-20260823`, worktree
`/Users/matthewryan/RyanRealty-wt-skyslope-pickup-20260823`. Continues
`ENDTOEND_REMAINING.md`, which closed file 1 (Apollo) and left file 2 pending.

## The goal

When this is finished, a broker opens Vault, walks a second Bend listing from
listing packet through close without touching SkySlope, and every signer
finishes from their email in a browser — adopt once, then tap Sign and
Initials. Nothing about file 2 is hand-repaired: it repeats file 1 without a
new send, sign, assign, or filing bug. The deal page reads correctly on one
screen, and a document that arrives twice is one document on the file.

File 2 is **2840 NE Sedalia Loop, Bend, OR 97701** — MLS 220227583, list
$539,900, 4bd/3ba, 2,135 sf, Arrowhead, built 2005, public water and sewer,
HOA. Party map is file 1's: Matt on both agent lines, Marketing Test Lead as
seller (`marketing@`), Vault Test Buyer as buyer (`admin@`).

## What meets the bar

1. **Facts → checklist.** Confirmed property facts drive the Oregon checklist.
   Done: saved 2026-08-25 (well no, septic no, HOA yes, 2005, no solar /
   tenant / short sale / seller-carried / team).
2. **Listing packet** — OREF 015 + 042 + 043, sent and completed from email.
3. **Sale agreement** — OREF 001 sent, buyer and seller and both agent lines
   signed and initialed, facts written onto the cycle.
4. **Deadlines** — inspection and financing windows land on File deadlines and
   on the CRM calendar.
5. **Repair addendums** — 022A then 022B, each sent and completed.
6. **Contingencies** — 059 delivery, then 060 removal, completed.
7. **Close** — file stage Closed. Title reports stay missing by design.
8. **No new bug.** Any defect the walk surfaces is fixed, gated where it can
   be, and shipped before the walk moves on.

## Defects carried into this mission

- **D1 — deal page overflows horizontally. DOES NOT REPRODUCE.** Measured on
  both files: `documentElement.scrollWidth === clientWidth === 1163`, and zero
  elements anywhere in the document have a right edge past the viewport. The
  facts grid is `repeat(auto-fill, minmax(140px, 1fr))`, which cannot overflow.
  What I read as clipping was the screenshot canvas being wider than the
  rendered viewport. No fix made — there is nothing wrong here.
- **D2 — the same PDF files many times.** Apollo holds six copies of
  "Signed Sale agreement.pdf", identical bytes, plus repeats of both repair
  addendums. Auto-file dedupes on `source_doc_id`, which is per-message, so
  the completion copy and every reply re-file the same document.

## Shipped this mission

- `a4b6c201` — whole-document reads before any execution verdict; per-document
  envelope association; sealed documents stamp their own execution state and
  page count; whole-document signed URLs outlive a reading session.
- D2 closed — documents dedupe on content hash per cycle
  (`lib/tc/document-dedupe.ts`). The mailbox-offer writer now writes `sha256`
  at all; it never did, which is why ten of Apollo's forty rows were unhashed
  duplicates that no filename check could catch.

## Walk log

**Facts → checklist.** Done. Confirmed from MLS 220227583: public water and
sewer (well no, septic no), HOA yes, built 2005, no solar, tenant, short sale,
seller-carried or licensed team. Financing stays unknown until the sale
agreement states it.

**Listing packet.** The packet button built the envelope — 4 forms, 18 pages,
Seller then Seller Agent — and then Send refused. Three defects behind it, each
shipped:

1. `a43dbaa0` — initials rows were split buyer-left / seller-right on every
   form. OREF 015, 042, 020 and 043 have no buyer, so nineteen required
   initials were addressed to a signer the envelope does not have. Apollo's
   packet predates the initials work, which is why it went out and this did
   not. The row now follows the form's own principals.
2. `a43dbaa0` — the packet buttons dropped `createEnvelopeFromTemplate`'s error
   on the floor. A packet that could not be built left the broker looking at a
   file with no envelope and no reason why.
3. `d2844dd8` — the demotion lived in the field map and the row builder
   recomputed `required` over the top of it. The rule now sits next to
   `recipient_id`: a signer-owned field with nobody to sign it is not required.
   Locked with a contract test — third place the same rule had to hold.

Plus `8e7483f2`: re-opening a packet reuses the blank already on the cycle
instead of stacking another copy.

**Apollo cleanup.** 17 duplicate rows folded by content hash
(`scripts/tc-dedupe-documents.mjs`). 40 rows down to 23; the only repeats left
are the listing and sale cycles each holding their own copy, which is correct.

**Listing packet — completed 2026-08-25.** Envelope `8e163909`, sealed
`e00c488f10`. Both signers finished from their own email:

- Seller (Marketing Test Lead) 22:18:26 — consent, adopt once by Type, then
  **3 Sign and 60 Initials and nothing else**. No Full Name, no Date signed.
- Seller Agent (Matt) 22:20:08 — routed only after the seller finished, and saw
  **one Sign box**, which is what a listing agreement asks of the agent.

All 18 pages rendered in the signer view; the sealed copy is 19 pages and
carries `execution_state: fully_executed` with its page count, which is the
seal fix from `a4b6c201` holding on a live file. Every fix shipped today is now
proven end to end on a real envelope.

## Open

Stages 3-8 remain: sale agreement, inspection window, 022A, 022B, 059/060,
close. The listing side is done.

**Contract accepted — 2026-08-25.** Sale cycle `5e90e2af`, accepted today, sale
price $539,900, inspection 10 banking days, financing 30. Vault Test Buyer
added as the buyer party. File deadlines computed and on the file: earnest
money, executed copies, SPDS revocation 2026-09-01, principal review 2026-09-03
(OAR 863-015-0140), inspection ends 2026-09-09, financing ends 2026-10-07.

Found and shipped on the way: accepting a contract re-seeded the sale checklist
from the MLS feed alone and threw away every property answer the broker had
just given (`20c40019`).

**Sale agreement — completed 2026-08-25.** Envelope `30248345`, sealed
`c62b07e0d8`, executed copy 17 pages carrying `fully_executed` and its page
count. Four signers, all from their own email, in order:

1. Buyer (Vault Test Buyer) — 3 Sign, 52 Initials, 16 pages, nothing else
2. Seller (Marketing Test Lead) — 2 Sign, 52 Initials
3. Buyer Agent (Matt) — 1 Sign
4. Seller Agent (Matt) — 1 Sign

### Worth another look

Both agent lines share one email and one signing order. Both were minted a
token, but only one invite reached the inbox; the seller-agent's arrived only
after pressing **Send reminder** on the envelope. It resolved through the
product's own control, so the file was never stuck — but a dual-agency file
should not need a reminder to reach its second agent line. Not yet diagnosed.

The listing packet's completion copy auto-files onto the sale cycle as
`Signed Listing Standard.pdf` with a null page count and `unknown` execution
state, where the same document on the listing cycle reads `fully_executed`.
Worth checking whether the mail path is re-reading a document we sealed
ourselves instead of recognising it.

**Deadlines on the CRM calendar — verified.** Six auto-deadline tasks on the
sale cycle, one row each, inspection included (2026-09-09). The calendar text
reads each twice only because the page renders the desktop and mobile shells
into the same DOM; the data is clean and a broker sees one. Not a defect.

**Buyer's repair addendum 022A — completed 2026-08-26.** Envelope `f0828992`
built from the form library, sealed `33ac4c6841`, executed copy 3 pages,
`fully_executed`. Buyer signed first, seller second; both agent lines were
seeded **Receives a copy**, which is right for 022A.

## The one thing that needs Matt

**Signing invites are not delivering reliably. Reminders always do.**

Of roughly nine invites sent on this file, three never arrived: the sale
agreement's seller-agent line, and both 022A invites. In every case the token
was minted, the envelope moved to `sent`, and `sendEnvelope` had already
checked Resend's response — it refuses to mark an envelope sent when Resend
returns an error, so Resend accepted all three. Pressing **Send reminder** on
the envelope delivered within a minute every time.

So the failure is between Resend accepting and the message landing. Our API key
is send-only and cannot read delivery logs, so the next step is the Resend
dashboard: look at the events for `noreply@mail.ryan-realty.com` around
2026-08-25 22:39-22:50 UTC and see whether those three were deferred, bounced,
or dropped. A signer who never gets the mail has no way to know, and the only
recovery today is a broker noticing and reminding.
