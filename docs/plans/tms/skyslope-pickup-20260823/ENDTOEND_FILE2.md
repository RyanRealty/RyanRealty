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
$539,900, 3bd/2ba, 1,466 sf, Arrowhead, built 2005, public water and sewer,
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
