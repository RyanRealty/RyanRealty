# Vault document reader

The Vault reads every transaction PDF it holds. For each document it answers three questions. Then it keeps the file clean: one copy of each form instance stays, and only fully executed copies sit on the checklist. Every other copy goes to the archive with a reason. Archive is the Vault's delete, and it can be undone.

1. **What form is this?** The OREF number, the title, which addendum or counteroffer it is, and the Sale Agreement #.
2. **Who must sign it?** Every buyer and seller the form names, plus any agent the form obligates.
3. **Is it signed, and by whom?** Each signature line, the name on it, the date, and how it was signed (e-sign stamp, handwritten, or typed).

Code lives in [`lib/tc/doc-read/`](../lib/tc/doc-read/). Reads are stored in `tc_document_readings` (migration `20260923200000_tc_document_readings.sql`). The runtime is `/api/cron/tc-document-read`, every 15 minutes. History and cleanup run through [`scripts/tc-doc-read-backfill.ts`](../scripts/tc-doc-read-backfill.ts), and model comparison through [`scripts/tc-doc-read-eval.ts`](../scripts/tc-doc-read-eval.ts).

## Why it reads page images

SkySlope DigiSign and DocuSign draw signatures as images on the page. The PDF's text layer holds the form, and usually the typed values, but never the signature itself. The old text-only classifier therefore called most signed documents unsigned. On 2026-09-23, 898 of 1,788 live documents were marked `unsigned` and 85 `fully_executed`.

The reader renders pages and has a vision model look at them.

## How it reads (`anatomy.ts`, `read-document.ts`)

1. **Text layer first, which is free.** The OREF footer stamp (`OREF 001 | Released 01/2025 | Page 14 of 15`) splits a packet into its forms. A mention of "OREF 003" in the body of a sale agreement is not a second form. The stamp also finds printed signature lines ("Buyer ____ Print ____ Date") and e-sign evidence: the DocuSign envelope id, and the DigiSign envelope id held in a link annotation.
2. **Pick the pages that matter.** Each form's first page (what it is, its number, the parties) plus every page with a signature line. A 15-page OREF 001 is read from 3 pages. A scan with no text layer gets one low-detail pass over every page first, to find where each form starts and which pages carry signatures.
3. **Render with fonts.** Forms filled in SkySlope and DocuSign draw typed values in the standard PDF fonts, which are not embedded. Without pdfjs's standard font data, every name, date and Sale Agreement # renders blank (`pdfjsFontOptions` in `lib/pdf/pdfjs-node.ts`).
4. **Transcribe** (`vision-reading.ts`). For each form the model returns:
   - the title, number, instance number, Sale Agreement # and terms excerpt
   - the buyers and sellers the form names
   - the response box (accept / counter / reject)
   - every signature line, with its section, party, whether it is signed, the name, the date and the method

   The model transcribes; it never decides execution.

## How it decides (`verdict.ts`, `profiles.ts`)

Who must sign comes from the canonical library, [`oref-form-library.md`](../.claude/skills/skyslope-form-compliance/references/oref-form-library.md). `profiles.test.ts` parses that file and fails if the reader drifts from it.

- **Every named person signs.** Every named buyer and every named seller signs their own line in every section their party signs. Two buyers named means two buyer signatures.
- **Sale agreement (OREF 001).**
  - It is accepted only by the Seller's Response box. A seller signing the Final Agency Acknowledgment is not acceptance.
  - Signed by all parties with 51.2 checked is **Signed, countered**: the contract continues in the counteroffer.
  - A seller signature with no box checked is **Needs review**. The form itself says it is void.
- **Counteroffers.** A counteroffer is accepted when the party it went to signs it. Signed only by the side that made it is **Partially signed**.
- **One-side forms.** Advisories, FIRPTA and one-way notices are complete when that side signs. An advisory's "Client" line counts as the client's signature.
- **Receipts.** An earnest money receipt is executed by the title company's "By:" signature.
- **Conditional lines** ("sellers claiming exclusion", "if applicable") are not missing when unsigned.
- **Reports and informational documents** (title reports, inspections, the OREF 000 guides, audit summaries with no signature lines) are **Reference**.
- **Receipts** can repeat on a deal (initial and additional earnest money), so two receipts are never treated as copies of each other without a telling detail.
- **Forms not in the library** take their signers from the lines printed on them. They are marked as such and never drive an automatic change.

Names come from the form only. A 2026-09-23 dry run showed the deal's people records can hold a sale's sellers as its buyers.

The verdict is recomputed from the stored transcription whenever it is needed, so a rule fix applies without paying to read the file again (`backfill reverdict`).

## How it keeps the file (`lineage.ts`)

A form instance is one form, number and Sale Agreement # for one set of buyers. The Sale Agreement # separates a deal that fell through from the one that replaced it with the same buyers. Within one deal cycle:

| Situation | What happens |
|---|---|
| An image an email carried inline (a logo, a signature graphic: small, named `image001.png`, `_WRD0005.jpg`, `noname`) | Archived: not a transaction document. The old filer stored these; the reader reads only PDFs. |
| Identical files | One stays: the one on the checklist, else the first filed. |
| A fully executed (or signed-and-countered, or signed-and-rejected) copy exists | Every other copy of that instance is archived with "Superseded … the fully executed copy is …" and `superseded_by` pointing at it. |
| One copy's signers are a subset of another's | The subset copy is archived as an earlier copy. |
| Live deal, only copy is partially signed | It stays, off the checklist, shown as waiting on the named people. |
| A blank copy, when a filled copy of the same form is on file | Archived, pointing at the filled copy. A blank copy that is the only one stays. |
| An executed copy and a rejected copy of the same instance | Flagged: they cannot both be the final record. |
| Closed deal, an offer or counteroffer copy nobody accepted, when the deal's executed contract is on file | Archived: "Offer copy not accepted … Kept per OAR 863-015-0250". Without the executed contract on file it is flagged instead, because it may be the only record of the contract. |
| Closed deal, the only copy of any other form is partially signed | It stays where it is and is flagged: "No fully executed copy of … on this closed file". The partial copy is the only record; hiding it would hide the gap. |
| Copies the reader cannot tell apart (no names, no number or terms), a form outside the library, or a printed number that contradicts the title | Flagged for a person. Nothing moves. |

**Checklist.**
- An archived copy comes off its rows. An identical file that replaces it keeps those rows (a SkySlope packet filed under several rows). A different, better copy takes a row only when the row fits its form, so rows the old keyword filer set are not carried forward.
- An executed copy on no row goes on the one row its form matches: an empty row for one-per-deal forms, or the matching row for forms a deal has several of (addenda, counteroffers, notices).
- Filing (mail and text) no longer puts documents on the checklist. The reader places them after reading.

**Never automatic:**
- a document a person archived or restored
- a file the Vault made (a sealed envelope, a filled OREF form, a CDA): who signed it is a fact in `tc_envelope_recipients`, not a reading
- a source document of a signing envelope
- a checklist row the principal already approved (flagged instead)
- a removal whose only ground is "not fully executed" unless a second, different model (`GROK_MODELS.documentsConfirm`) reads the document and agrees

Every change writes a `tc_events` row with actor `vault-reader`: `document_archived`, `document_linked_by_reader`, `document_unlinked_by_reader` or `document_needs_review`.

## Models and cost

The model registry is `lib/grok/client.ts` (CLAUDE.md §4: every Grok call goes through `lib/grok/`).

**Reader: `grok-4.20-0309-non-reasoning`.** Chosen 2026-09-23 on 16 production documents covering:
- DocuSign, DigiSign, handwritten and scanned documents
- OREF and Oregon REALTORS® forms, and a 21-page scanned packet

The four checked by eye against the rendered pages all matched on every signature line: two copies of one sale agreement (buyer-only, and countered), a seller's counteroffer, and a rejected repair addendum. Averages on the 16 documents: $0.0617 and 5.6 s per document (xAI's `cost_in_usd_ticks`). The 60 documents of 2680 NW Nordic Ave cost $2.14 on the second read, with 12 identical files reused.

**Confirmer: `grok-4.3`.** It agreed with the reader on every signature line of the three documents compared, and missed one addendum number. `grok-4.6`, the reasoning model, read the same pages correctly at $0.20 to $0.40 per document, so it is not used.

Every read row stores its model, pages, tokens and cost.

## Operating it

```bash
npx tsx scripts/tc-doc-read-backfill.ts read [--deal <uuid>] [--concurrency 10]   # read what the current version has not read
npx tsx scripts/tc-doc-read-backfill.ts reverdict [--deal <uuid>]                 # re-derive verdicts after a rule change (no model call)
npx tsx scripts/tc-doc-read-backfill.ts plan [--deal <uuid>]                      # read-only: out/doc-read-plan.json
npx tsx scripts/tc-doc-read-backfill.ts apply [--deal <uuid>]                     # do it (confirm reads for removals)
npx tsx scripts/tc-doc-read-eval.ts --models a,b --dump <docId>...                # compare models on real documents
```

`/api/cron/tc-document-read?doc=<uuid>` reads one document and plans its cycle. Add `&dry=1` to plan without changing anything.

## Forms outside the library

The reader meets forms the canonical library does not list:
- OREF 011 (Residential Condominium Real Estate Sale Agreement)
- OREF 024 (on files named "Earnest Money Receipt")
- OREF 028 (Seller's Property Disclosure Statement Addendum)
- OREF 053 (Agreement to Occupy Before Closing)
- OREF 083A (Contingent Right to Purchase notice)
- the Oregon REALTORS® 2.x series (2.1 Counteroffer, 2.2 General Addendum, 2.5 Repair Addendum)

Per the library's own rule, their signer profiles are added there once Matt confirms them, never guessed in code. Until then they get signers from the lines printed on them and are flagged rather than acted on. Counteroffers and addenda from other publishers get the mutual buyer + seller profile by title and are marked "generic".
