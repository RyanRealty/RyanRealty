# Vault mail filing rules

How the Vault decides which transaction file an email belongs to. Brokers never
file email by hand. The system reads every broker mailbox through the Google
Workspace service account, decides each email with the rules below, files it and
its documents, records offers, and only asks a person when it truly cannot tell.

- Rules (code): [`lib/tc/mail-rules.ts`](../lib/tc/mail-rules.ts), version `mail-rules-v4.1-2026-09-30` (v4 plus the re-decide dry-run fixes, below)
- Enforcement: [`lib/tc/mail-rules.test.ts`](../lib/tc/mail-rules.test.ts). Every rule below has a
  test, and every misfile found in the 2026-09-23 and 2026-09-24 audits is a regression case
  (v4 changes and their measurements: "What changed in v4", below).
- Index: `tc_mail_messages` (migration `20260923180000_tc_mail_index.sql`)
- Runtime: [`lib/tc/mail-index.ts`](../lib/tc/mail-index.ts), called by the 15-minute CRM Gmail sync
  (`/api/cron/crm-gmail-sync`) and the daily sweep (`/api/cron/tc-mail-sweep`)
- History + cleanup: [`scripts/tc-mail-backfill.ts`](../scripts/tc-mail-backfill.ts)

## Which mailboxes

Every broker mailbox (`CRM_MAILBOXES` in `lib/crm/gmail.ts`): matt@, paul@,
rebeccapeterson@. One email delivered to two broker inboxes is one index row: the
key is the RFC Message-ID.

## The rules, in order

The email's own content decides first. Who it touched only decides when the
content is silent and exactly one open file fits.

| # | Rule | Files to | Notes |
|---|---|---|---|
| −1 | **An unsent draft is not mail** (v4.2). A message Gmail still labels DRAFT reached no one, whatever file, offer or escrow number it names. | nothing | Gmail lists drafts beside sent mail under the broker's own From line, and every autosave is a new Gmail id under one Message-ID: the sent copy is decided on its own when it goes out. The 15-minute sync, the daily sweep, the party and offer harvest and the backfill walk list with `-in:drafts` (`lib/crm/gmail-drafts.ts`), so a draft writes no CRM timeline row either; a path that fetches a message by id is refused by this rule before its attachments are read or the model stage sees it. The one-time full-history review walk lists drafts on purpose (coverage counts every message) and records each as not a deal. |
| 0 | **Noise never files.** List mail (List-Unsubscribe, Precedence: bulk), auto-replies, listing alerts ("16 new listings for…", "Copy: Subscription…"), system notices ("[Expired]…", "[Deploy]…", Google's "[Notice]…"), a CRM's reminder list ("Daily Birthday Reminder" names a client and her address), **our own machines** (anything from `mail.ryan-realty.com`: lead notices, CMAs, alerts, newsletters, the Vault's own signing emails; anything from `resend.dev`: the Studio's drafts), and **digests**: three or more street addresses listed as content. | nothing | A subject naming exactly one of our files by full address, MLS or escrow number is never a digest (a street alone is not enough: "Follow-Up: Bluff Dr. Units + New Options" was a buyer's tour of five properties), and letterhead addresses (a suite after them, or on their own line beside a phone or email) never count toward the three. Bulk mail carrying exactly one file's escrow number files by rule 1; bulk mail whose subject names exactly one file by full address or MLS number goes on to rules 1 to 5, which still refuse a stranger's pitch. Our own machines, system notices, and our own list mail to ourselves (a BCC blast, "Great New Price on …") are never lifted. |
| 1 | **Escrow or MLS number** of exactly one file, anywhere in the subject, body, attachment names or attachment text. | that file, any stage | Escrow numbers need 6+ characters with 4+ digits; MLS numbers never match inside a longer number. A number in the subject outweighs one in the body. **A comparables report** (CMA, BPO, appraisal: by file name or its first page) contributes only the property it is about, never its comps' numbers or addresses. Two files → queue. |
| 1b | **Our clients on two open files** (selling one home, buying the next), and the email names no property: the people on it, and the thread it sits in, cannot pick. Only what the email says can: the street it calls one of those files by, in the subject, a file name or the words its sender wrote ("are you back in your Drouillard home"), or the subdivision in the subject or a file name, or a numbered street with its suffix ("7th Street Inspection" among one investor's four files); else someone the email talks about, not someone on it, who is on only one of those files (the purchase's lender, named in the body); else the side it is on ("the <client> purchase", "buying", "the down payment", "our loan", "a jumbo loan amount" → the file where we represent the buyers; "selling", "showings", "open house", "listing" → the file we list; "sold" is neither, "CC Mortgage sold our loan"). | that file | Clients = parties on the file by email, by the name beside their address, or named first-and-last in what the sender wrote ("Mutual Clients \| Pat Client / Lee Client"); a first and last name that are one word ("Test test") names nobody. A file counts while it could be open: open by its dates, or it has a cycle with no dates (SkySlope's listing record often has none) and the email falls in the year before its first contract. What the sender wrote is read first, then the conversation it quotes ("… included it with the listing documents in the mls"); in the body a bare street needs six letters or two words, and a house number alone ("to show 3480") counts. The side is the clients' side of that file **on that date**, by their names on the contract then (they bought 3480 SW 45th in 2025 and sold it in 2026); "the listing agent" is how a buyer's broker names the other side, not a sale word. A side word picks only when one file is on that side (an investor's four purchases are all purchases); a file whose every contract died before the email, with no listing of ours open, is over and does not count on its side (the clients' first purchase fell through on 2025-07-08, so their "Balance of Down Payment" a month later is the purchase that went on to close), except for its own termination paperwork within 30 days. Names both, or neither, and no side (or both sides, "proceeds from the sale … their purchase") → queue. Runs only when the thread, if any, sits on one of those files. |
| 2 | **Same thread** as email already filed (RFC References root, or the Gmail thread). | the thread's file | Unless this email names a different file (address, street, escrow or MLS number): the property wins. If it does not name the thread's own file too, that file is not even a candidate on the thread's word (Supra reuses one thread per sender); if it names both, the thread breaks the tie. **An e-sign platform's no-reply notice with the generic subject never follows its thread**: Gmail threads identical "Envelope completed: You have documents to sign" subjects across unrelated envelopes. An envelope with its own name ("… - Second Offer") keeps its thread. |
| 3 | **Street address**: house number + street name ("909 NW Delaware" or "909 Delaware"). Then the street alone ("SW 45th", "Beaumont Drive"), a SkySlope file address ("BeaumontDrive2070260b4@skyslope.com"), or the subject's street with a house number one keystroke off ("2731 Ordway" for 2732 Ordway Ave), but only in the subject, attachment names or recipients, and only for transaction mail, an e-sign notice, or mail from someone on one of our files. | that file, any stage | Directionals match spelled out or short ("3480 Southwest 45th" is 3480 SW 45th); two-word names match with or without the space ("Schoolhouse" is School House), and keep both words after a directional ("NW Newport Ave" is not 1974 NW Newport Hills Dr). A file name reads with its underscores as spaces ("Ryan Realty_20702 Beaumont Dr, Bend.pdf" names 20702 Beaumont Dr). The city breaks a tie between same-numbered streets; the property in the subject beats one quoted in a forwarded chain, and when the email names several of our files the one its subject names is the one it is about ("Envelope completed: Nordic Ave Offer Letter" carries an offer letter naming the buyers' own home on another of our files). Another house number in front of our street is a neighbour's home, not the file ("510 NW Delaware.pdf", Matt's comps for that owner, is not 909 NW Delaware), and so is a range ("936-946 NW Delaware Ave", "936946 NW Delaware Rent Roll.pdf": an income property down the street); our own number with a slip of the keyboard is still ours. A three-word street is called by all three words: "Old Bend" is a Bend neighbourhood, not 64350 Old Bend Redmond Hwy. Two files named alike → queue, whoever wrote it ("proofs attached for the two installs"); so does a street or SkySlope file address naming one file while the subject calls another by name ("Fwd: Drouillard Plumbing Service Report" sent to 2680 NW Nordic's SkySlope mailbox). Still tied → queue. **A full address alone does not make ordinary mail deal mail**: it files when someone on that file is on it (by email or by name), when a title company, e-sign platform, showing, MLS or listing-report system (Supra, ShowingTime, Flexmls, ListTrac, and the MLS itself: COAR, RMLS) sent it, when it reads as a transaction, when it is the deal's people talking ("my clients", "the sellers", a showing, the yard sign being down or re-installed) or the property's records (invoices, service history, a requested repair or restoration estimate, a service booked at the house, permits, a measurement, Bend's required Home Energy Score, septic and well reports, an income property's cash flow or rent roll, read from the subject, the words the sender wrote and the attached files' names, spreadsheets included), or when a broker filed it by hand ("[Deal: …]"). A stranger's other mail (a vendor's pitch, a magazine's ad sales) is not deal mail. **Our own mail** naming the address files, to whomever it went (the title officer at a mistyped address, the owner's CMA, the media company), unless it went to no one on a file or at a title or transaction company (the MLS counts: "set 363 SW Bluff Dr back to coming soon" to COAR's help desk is the listing's business) and what the broker wrote reads as marketing: "just listed", "new listing", "coming soon", "neighbors", "considering selling", "call today", "price reduced", "back on market", an unsubscribe line. Quoted replies and forwarded mail never count toward that, and a tracked link says nothing (Matt's signature tracks every link). |
| 3b | **Our own mail naming one file by its street alone or its subdivision** ("[Ordway forward] OREF 022A Buyers Repair Addendum 2", "Re: More Clarification on Nordic PA"): a broker wrote it (or an e-sign platform sent it as the broker), and either it carries a transaction form or reads as one, or it went only between our own brokers; and its subject or a file name calls exactly one file by its bare street name or its MLS subdivision. | that file, any stage | The bare name is the street without number or suffix ("Nordic", "School House"). Numbered streets ("45th") and common words (Main, Park, Old, School, Test…) never count alone; between brokers with no transaction words the name needs six letters or two words ("Bluff" does not). A subdivision counts only when exactly one file open on the send date carries it, and never a placeholder ("N/A"), a city, or one ordinary word ("Railroad"). |
| 4 | **Who it touched**, only when the content names no property: our client (buyer/seller on the file) or a file contact (title, escrow, lender, other agent, TC firm) on exactly **one open** file, by email, or by the display name beside their address when the file knows them only by name (SkySlope imports other agents with no email). When they are on several: step two, the file the subject or a file name calls by its bare street or subdivision ("Home Warranty - Nordic", "Valhalla Heights - HOA docs"); step three, on transaction mail or when that person wrote it, the one file a person on the email is on and the others are not; a company counts as one person here (Western Title's escrow assistant on one file writes for the escrow officer on sixteen), a free mailbox (Gmail, Yahoo, Outlook, iCloud…) as its owner. | that file | Open = live, or closed/dead within 120 days of close. A contact (not a client) on a single file comes on for its contract: from 45 days before an acceptance through 120 days after its close; mail from them outside that is about something else (Matt's 2023 coffee invitation to an inspector, a 2024 home-search note to an agent, both later on 17130 Mayfield's sale). This only vetoes the one file: a contact on several files is still on several (dropping the files out of contract that day left one standing and filed a TC firm's "SPDS questions" on the wrong one). A file with no dated contract keeps its open window. A name needs first and last name, never a first name alone, never our own brokers' names, never a no-reply sender's display name; one person is one person however each file knows them. A subject naming a property that is not on the candidate file never files by sender, except the file's own house number followed by a word that is no street ("19496 Septic Invoice") or its street with a mistyped number ("2372 NW Ordway"). A no-reply sender's display name counts only when it says a person acted through it ("Pat Seller (via Google Drive)"). A no-reply sender's recipients are never evidence on ordinary mail, except an e-sign platform's: SkySlope's "Paul Stevenson shared some documents with you." goes from its no-reply to our client, and that client is the file. Still several: transaction mail, mail with attachments, or our client (not just a contact) on more than one of them → the model picks among those files (below), else queue; anything else → not deal mail. |
| 5 | **Transaction mail for a property with no file** (offer, counter, escrow, title, inspection, disclosure, closing, or an e-sign completion, with a transaction form attached or a property in the subject), a broker's own "[Deal: 1405 NW Newport Ave] …" for a property with no file, and an e-sign completion carrying its executed PDF when nothing says which file it is. Never the brokerage's own signed paperwork (an independent contractor agreement, office policies, the association membership, an MLS participant agreement, a vendor's service agreement or order form): not deal mail. | the mail queue, grouped by property | The daily sweep opens a file when the group proves a deal is under way (escrow opened, settlement statement, closing notice, fully executed agreement). Offers alone never open a file. |

### What the email is about (category)

The subject and the attachment names decide first, in this order: auto-reply;
our own machines and system notices; a fully executed sale agreement (by its file name, by a subject announcing the contract with the agreement attached, "Congratulations! You're Under Contract!", or signatures read from it: never the form's own printed words "dated and signed by Buyer and Seller", which every Oregon sale agreement carries, so a buyer's offer is an offer); an e-sign
platform's subject ("Envelope completed", "Documents to sign", DocuSign,
Dotloop, Authentisign, DigiSign), before the listing-alert words, because an
OREF form name can read like an alert ("Envelope completed: Appraisal Price
Change"); a listing alert, never when a transaction form is attached; counter (by the file's name, or by what its text read as when its name does not call it the sale agreement: the buyer's "PSA.pdf" talks about counter offers and is still the offer);
offer (a sale agreement itself, never an "Addendum to Sale Agreement"); addendum,
amendment or termination; closing; disclosure (including HOA documents, CC&Rs, a
reserve study, but never Oregon's Initial Agency Disclosure Pamphlet, which every
broker hands every buyer before there is a property); inspection (including its
kinds: a septic evaluation or ESER, radon, sewer scope, WDO/pest, mold); escrow and
title (including title's own file numbers, Western Title's "WT0278291" and
Deschutes Title's "\| DE22058", an "EM receipt" and an "Online deposit
submitted"); lender (and from the body, a lender's status email's
"Borrower(s): … Subject Property: …").

When those are silent, the body decides, from the part its sender wrote: quoted
lines ("> …") and everything after "On <date> … wrote:", "-----Original
Message-----" or Outlook's "From: … Sent: …" are earlier mail and never count;
a forwarded message does. Only phrases a transaction uses count ("counter
offer", "earnest money", "repair addendum", "inspection report", "escrow
number", "clear to close", "appraisal inspection"), never a word a signature or
a pitch carries: not "escrow" alone (every Western Title message is signed
"Senior Escrow Officer … Western Title & Escrow Company"), not "wire
instructions" (title footers warn about wire fraud), not "purchase price" or
"appraisal purposes" (a pricing letter to a prospective seller says both).
Mail marked as marketing (List-Unsubscribe, "unsubscribe", "opt out", "view in
browser") never reads as a transaction from its body.

Everything else is ordinary email: counted by the sync, not stored in the Vault.
Email with a client still lands on their CRM timeline as before.

### Addresses that are never evidence

- **House addresses** (`@ryan-realty.com`, `@mail.ryan-realty.com`, and Matt's
  forwarding alias `matt.lists.homes@gmail.com`) never identify a file, even when
  a contact row carries one. This is the rule whose absence caused the
  2026-08-23 → 2026-09-23 misfile (below).
- **Test fixture files** never take real mail: the alias harness's files
  (stage detail "TC TEST …"), the "1234 test street" placeholder, and any file
  whose only clients are the test aliases below (60935 Apollo Place, 2840 NE
  Sedalia Loop). They take the harness's own "[TC TEST <run>]" mail and nothing
  else, and the model stage never offers them (`isTestFixtureDeal`).
- **Test aliases** `admin@ryan-realty.com` (Vault Test Buyer) and
  `marketing@ryan-realty.com` (Marketing Test Lead) are outside parties, not the
  house, so the test files behave like real ones, but only on mail the alias
  harness wrote (subject tagged `[TC TEST <run>]`). The same mailboxes get
  Google Workspace notices, sign-in codes and CRM test sends; untagged, they are
  never evidence. Plus-addressing folds to the base mailbox (`admin+x@` is
  `admin@`).

### Which cycle on the file

Offers and counters go to the listing cycle (the offer log lives there) when
that listing was open on the date: the sellers' counter on the clients' 2025
purchase of 3480 SW 45th is not an offer on the listing they opened on it in
2026. Everything else goes by what the message itself says first, then by date:

1. The escrow or MLS number it names, when that number tells the cycles apart;
   another escrow number of the same shape ("WT" and seven digits) counts
   against a cycle that has a different one.
2. A buyer or seller on only one cycle's contract (`tc_cycles.buyers` /
   `sellers`), by full name (which outweighs every date signal), or weakly by
   last name. One person under two spellings ("Pat" buying in 2025, "Patricia"
   selling in 2026) is on both contracts, so on neither alone.
3. A termination or release goes to the contract it ends: a cancelled cycle
   whose window holds the date and that died no more than 30 days before it,
   never a closed cycle that was not in contract that day ("options to
   terminate" asked while the second 2680 NW Nordic contract was live is about
   that contract, not the one that died seven weeks earlier), and never to the listing
   cycle on the strength of an offer word (the offer shortcut above is skipped).
4. The cycle whose contract was live on the send date (acceptance through close,
   or through the day it died, not the close it was scheduled for), then the
   cycle whose window holds the date (a listing from 45 days before its listing
   date through close + 120 days), a live sale cycle ahead of a cancelled one.
   While our listing is open, a contract's window opens a week before its
   acceptance: a showing weeks before a contract is the listing's (19496
   Tumalo's August 2026 showings are not the sale accepted 2026-09-19). With no
   listing of ours open (a purchase), it opens 45 days before: 820 NW 12th's
   initial offer, two weeks before acceptance, is that contract's. A contract
   that died is over: the showings, repairs and next buyer's offer after 20702
   Beaumont's first contract fell through are the listing's again (its
   termination paperwork still finds it, rule 3).
5. A tie goes to the cycle nearest the date: a January listing appointment,
   before any cycle, is the listing's, not the latest contract's. Then a
   cycle with dates over one without (an undated duplicate of 2680 NW Nordic's
   first contract took a forward of its refund request on recency alone), then
   the newest.

After close, closing mail (recorded deed, final statement) and general mail are
labeled "After closing"; a forwarded "Open Escrow" keeps its own label.

## What filing does

1. One `tc_mail_messages` row: who, when, subject, body excerpt, attachments,
   category, the rule that decided and why (`match_detail.reasons`).
2. Each PDF attachment (up to five, 20 MB each) becomes a `tc_documents` row on
   the cycle, deduped by content hash (the same signed PDF arriving three ways
   is one document).
3. Checklist: filing never puts a document on the checklist. The document
   reader ([`TC_DOCUMENT_READER.md`](TC_DOCUMENT_READER.md)) reads each new PDF
   within 15 minutes (the form, who must sign, who did, from page images) and
   places only fully executed copies; duplicates and superseded copies go to
   the archive with a reason.
4. One `tc_events` row (`mail_filed`) with the rule, category and direction.
5. The existing return logic runs: an executed PDF from the other side can close
   an envelope waiting on them.

## Offers (OAR 863-015-0250(1), 863-015-0135)

Oregon requires the principal broker to keep "complete, legible, and permanent
copies of all documents … including all offers received" (OAR 863-015-0250(1)),
and a licensee to "promptly deliver to the offeror or offeree every written offer
or counter-offer" (OAR 863-015-0135(2)). Both verified 2026-09-23 at
oregon.public.law. So:

- Every offer or counter that arrives on one of our listings becomes a
  `tc_offers` row (`source = 'mail'`) **whether or not anyone replied**, with the
  PDF filed and linked, and price, earnest money and financing read from the
  offer document itself (a term that does not parse stays empty; nothing is
  guessed).
- One row per negotiation thread: their counter updates it, ours marks it
  `countered`.
- `replied_at`: the first email we sent in that thread to someone outside.
- `presented_to_seller_at`: the first email we sent to our seller about the
  offer. The deal page flags "Not yet sent to seller" until it exists.
- A broker forwarding old mail into their own inbox never creates an offer.

## The queue

`/admin/closings/mail`. Brokers see their own mailbox; the principal sees all.
Rows are grouped: by property (transaction mail with no file: open a file, file
to an existing deal, or "not a deal") and by candidate files (email that fits
several files: one button per file). A person's answer is final: the rules never
re-decide a row a person decided.

## Correcting a misfile (`lib/tc/mail-refile.ts`)

The 2026-09-24 audit found the filer right ~97% of the time with no way to fix
the rest: moving or unfiling a filed message existed only as a one-off script.
On a deal's Email tab, every filed row carries **"Move to another file"** and
**"Not a deal"** (`app/actions/tc-mail.ts` `moveFiledMailToDeal` /
`unfileDealMail`), same auth/scope as the queue. The move picker defaults to
the rules' own runner-up candidates from `match_detail.candidates` (`docs/TC_MAIL_FILING_RULES.md`'s
own scoring), then a search over every file the broker can see
(`lib/data/tc/mail-reads.ts` `listDealOptions`).

- **A move re-files through `fileIndexedMessageToDeal`** — the exact path any
  other filing uses — so a corrected message is indistinguishable from one the
  rules got right the first time.
- **Documents move with it.** A document nobody has acted on yet is archived
  on the old file (archive is the Vault's delete — nothing is hard-deleted);
  the re-file's own per-cycle-hash dedupe (`existingDocumentIdByHash`) reunites
  it with the message on the new file. A document a person already put to
  work — on a checklist (`tc_checklist_assignments`), in a signing envelope
  (`tc_envelope_documents`), in an actual principal sign-off
  (`tc_principal_reviews`, OAR 863-015-0140), or shared with the client
  (`tc_documents.client_visible`) — is left exactly where it is and flagged
  (`tc_documents.classification.refile_flag`), never moved, never deleted.
- **Unfiling** sets the message `status = 'dismissed'` (same state
  `dismissQueuedMail` uses) and releases its documents the same way.
- **Both write one `tc_events` row** naming who, when, and from/to, and upsert
  the `tc_mail_reviews` row with `stage = 'person'` — the rules never re-decide
  a row `decided_by` names a real person (see "Every message reviewed" below).

## Daily sweep (`/api/cron/tc-mail-sweep`, 13:35 UTC)

1. Re-decide the queue against today's files (oldest decision first), then open
   files where the queue proves a deal is under way.
2. For each open file (oldest sweep first): search every mailbox for its address,
   escrow and MLS numbers since its last sweep, all history the first time.
   Then decide again every message in a thread that has since filed, if it
   was decided before its thread filed (`refileThreadSiblings`): a reply with
   no address, from someone on several files, decided before the first
   message of its thread filed, follows the thread now.
3. Search every mailbox for offer / counter / escrow / closing mail with a PDF
   from the last three days.

Each search skips mail the index already holds for that mailbox; the live stream
or an earlier sweep decided it, and queued mail is re-decided in step 1. Four
messages are read at a time. The run stops at a 240 s budget. A file whose
first, all-history search is larger than one run is not marked swept. The next
run starts with it again and skips what earlier runs stored, until it finishes. The
largest file on 2026-09-23 (2354 NW Drouillard Ave) matched 577 messages across
the three mailboxes. `scripts/tc-mail-backfill.ts sweep-deals --reindex` re-decides
held mail after a rules change.

## The 2026-08-23 misfile and its correction

The filer that went live 2026-08-23 picked a file from who an email touched. A
SkySlope-imported contact row put `matt@ryan-realty.com` on 56111 School House Rd
as "other agent", so every email in Matt's inbox matched that closed file; a TC
firm, a title officer and an escrow officer on several files sent mail about one
property onto another. Read-only audit, `scripts/tc-mail-backfill.ts audit
--since 2026-08-22`, rules v2, run 2026-09-23 over all three mailboxes, 5,338
unique messages (full counts: [`docs/audits/TC_MAIL_AUDIT_2026-09-23.md`](audits/TC_MAIL_AUDIT_2026-09-23.md)):

| Old filer | Count |
|---|---|
| Filings | 3,295 |
| Agree with the current rules | 89 |
| Message no longer in any mailbox (left alone) | 21 |
| 56111 School House Rd (closed): wrong | 3,077 filings, 88 documents |
| 19496 Tumalo Reservoir Rd: wrong | 77 filings, 27 documents |
| 19571 SW Simpson Ave (closed): wrong | 15 filings, 4 documents |
| 2840 NE Sedalia Loop (test), 20702 Beaumont Dr, 5663 Impala Ave: wrong | 7, 6 and 3 filings |

The same window under the current rules: 372 messages filed across 19 files
(closed files included: post-close title mail and forwarded deal history), 53
queued (52 of them one real transaction with no file, 909 NW Delaware Ave), and
none ambiguous.

`scripts/tc-mail-backfill.ts reconcile` archives those documents with a reason
(archive is the Vault's delete), removes their checklist rows, writes one
`mail_misfile_corrected` event per file, and files every message where the
current rules put it. Nothing is deleted; `tc_events` stays append-only.

## What changed in v4 (2026-09-24)

A read-only audit on 2026-09-24 of about 1,500 real messages, and of 150 of the
291 queued rows, measured the v3 filer. Each change below is the class fix for
one defect it found; each has tests in `lib/tc/mail-rules.test.ts` shaped like
the real message.

1. **Digests.** v3 called any message listing three street addresses a digest.
   Western Title signs every message, and every quoted layer, with two office
   addresses, so any reply naming one of our properties counted three. Of 499
   title, e-sign and MLS-platform messages naming one of our 34 real files, 122
   were dropped as bulk, 111 of them by this rule, about 112 of them real deal
   mail ("You're Under Contract | 64350 Old Bend Redmond Hwy" with the sale
   agreement attached); it caused 41 of the 47 missed filings on ordinary files.
   Now a subject naming exactly one of our files is never a digest, letterhead
   addresses never count, and bulk mail whose subject names exactly one file by
   full address or MLS number (a Flexmls "Activity Report for MLS# …") goes on
   to the rules.
2. **E-sign envelopes read as listing alerts.** "Envelope completed: Appraisal
   Price Change" (a fully executed OREF price addendum) and "Envelope
   completed: Price Change Form" matched the listing-alert words "price
   change". E-sign subjects are now read first, a transaction form attached is
   never a listing alert, and an "Addendum to Sale Agreement" is an addendum,
   not an offer. The daily index reads every PDF of an e-sign completion (pass
   2), whatever the platform named it, since its text names the property the
   subject left out.
3. **A full address with no gate.** v3 filed anything naming a file's exact
   address. Paul 11 of 58 filed rows, Rebecca about 24 of 405 address-filed
   rows, and Matt about 3 of 15 were vendor pitches (a portal's "Get more buyers
   for …", magazine ad sales, virtual staging) or our own "NEW LISTING" letters
   to people on no file; one mail-merge for 2354 NW Drouillard was sent 201
   times and 182 copies were filed on that file. Now the full address needs one
   of the signals in rule 3. Transaction mail from a new appraiser, lender or
   escrow officer still files.
4. **The body never read.** Counter offers, earnest money and repair addenda
   that live only in the body left the category "general", so rule 5 and the
   street-only gate never fired ("Re: 61260 Sunflower Lane", a counter offer in
   its body). The body now categorizes, from the part its sender wrote, with the
   guards above so a signature or a pitch never reads as a transaction. Pass 1
   (headers and snippet) now reads on whenever the subject names a property.
5. **A comps report's comps.** An email to our sellers at 19496 Tumalo
   Reservoir Rd with "19496 TRR Comps.pdf" filed to 64350 Old Bend Redmond Hwy,
   comp 5 of 5, by its MLS number. A comparables report now contributes only
   its subject property.
6. **The cycle picker ignored the message.** On 64350 Old Bend Redmond Hwy (a
   first contract cancelled, a second closed) the first contract's escrow
   opening, its sale agreement and its termination landed on the closed cycle.
   The picker now reads the message's escrow and MLS numbers and buyer names,
   sends terminations to the contract they end, and prefers the contract live
   on the send date.
7. **Compound street names.** "56111 Schoolhouse Rd." now matches 56111 School
   House Rd, and the other way round.
8. **A house number and a noun.** "19496 Septic Invoice" parsed as a property
   named "19496 Septic", and rule 4 refused the right sender match (the other
   agent on 19496 Tumalo Reservoir Rd, her only open file). The file's own house
   number followed by a word that is no street is not another property. The
   property hint keeps only the first street word when the subject writes no
   suffix, so "61260 Sunflower Email to Deb" groups with "61260 Sunflower Lane".
9. **SkySlope file addresses.** Mail to "BeaumontDrive2070260b4@skyslope.com"
   is mail about 20702 Beaumont Drive ("Fwd: Deck Receipt"); the house number
   must agree.
10. **Our own machines.** The Studio's drafts (from the Resend sandbox,
    "listing reel draft v2") and the site's lead notices (from
    `mail.ryan-realty.com`) filed to files by address and MLS number. They are
    now noise, and "[Notice]" is a system notice.
11. **People on a file by name only.** At least 17 of 70 sampled ambiguous
    rows were other agents SkySlope imported with a name and no email (an
    11-message "FHA Addendum" thread on 20702 Beaumont Drive). Display names
    now match contact and party names, first and last name both.
12. **A mistyped house number.** "SPD's for 2372 NW Ordway" and "2731 Ordway
    Title Report" are 2732 Ordway Ave: its street with a number one keystroke
    off. A subject property that is simply another property ("909 NW Delaware",
    no file) still is.
13. **Test aliases and machines.** A Google Workspace "[Notice]" to admin@ was
    still queued: it was decided by v2 at 13:35 UTC, before v3 deployed, and a
    queued row the rules later drop never left the queue. The daily re-decide
    now marks such a row `dismissed` (decided_by stays `system`), and a no-reply
    sender's recipients are never evidence on ordinary mail. 6 of 70 sampled
    ambiguous rows were this shape.
14. **Subdivisions.** Brokers call a file by its subdivision ("Cedar Creek" is
    1050 NE Butler Market Rd, "Forked Horn Butte" is 3480 SW 45th St). Each
    file carries its MLS subdivision (`listings."SubdivisionName"` by the
    cycles' MLS numbers, through `lib/data/tc/deal-subdivisions.ts`), used like
    a bare street name.
15. **Threads.** A Supra notice naming 2354 Drouillard and 17130 Mayfield was
    queued with an unrelated dead file (56628 Sunstone Loop) on top at score 80,
    because Supra reuses one thread per sender. The thread's file is no longer a
    candidate when the message names another of our files. Thread filing is
    otherwise unchanged (136 Supra messages file correctly by thread).

**How v4 was checked (2026-09-24, read-only).** Every message named above was
decided again through `indexGmailMessage({ dryRun: true })` (Gmail read-only
scope, database reads only, no review rows written) and lands where the audit
says it belongs, except three kept open below. Then random samples of stored
decisions were decided again by the final v4 code:

| Sample (source) | Rows | Same decision | Changed |
|---|---|---|---|
| Filed (`tc_mail_messages`, of 5,830) | 300 | 270 (9 of them on another cycle) | 30 |
| Ambiguous queue (all) | 126 | 86 | 40 |
| Unfiled-transaction queue (all) | 165 | 142 | 23 |
| Not deal (`tc_mail_reviews`, of 25,203) | 250 | 236 | 14 |
| Bulk (`tc_mail_reviews`, of 40,785) | 200 | 197 | 3 |

Every change was read. Of the 30 filed rows that change, 18 are our own "NEW
LISTING" and "Exclusive Listing" letters, 4 our own machines' mail, 2 delivery
notices; the other 6 are vendors writing in ordinary words (an order
confirmation, a sign company's proof), our own open-house invitation and one
outbound note to people on no file, a CMA whose comp was our file, and one
message of a client family's personal details that was never deal mail. The 9
cycle changes move mail to the contract live on its date or named by its escrow
number. Of the 40 ambiguous rows that change, 30 now file (the FHA Addendum
thread by the other agent's name, Brandon's Loan, subdivision names such as
Cedar Creek, Plaza Condominiums and Forked Horn Butte, replies whose thread is
filed) and 10 leave the queue (Google Workspace and Cloud notices, CRM and
alias test sends, a sign-in code, a sign installer's two messages). The 23
unfiled rows that change now file (17 on 52678 Golden Astor Road, a file opened
since; the FHA Addendum and counter mail by the other agent's name; the Ordway
typos). The 14 not-deal rows that change are 12 of our own machines'
messages now stopped at rule 0 and 2 filings; the 3 bulk rows that change are
title and lender replies the v3 digest rule had dropped. Accepted cost: a sign
installer, a photographer or an order confirmation about one of our listings,
from someone on no file and in ordinary words, no longer files.

**Then the golden eval (2026-09-24).** The first v4 draft, replayed over all 1,522
labeled messages (`npm run tc:mail-eval`, dry run), filed six messages on the wrong
file (v3: three) and newly missed 35 it used to file. Every one was read and fixed
as a class, each with a test shaped like the message (`lib/tc/mail-rules.test.ts`,
"golden eval" blocks), before v4 shipped:

- **Our clients on two files (rule 1b).** One couple was selling 2354 NW
  Drouillard and buying 2680 NW Nordic; another selling 64350 Old Bend Redmond
  Hwy and buying 3480 SW 45th. Who was on the email picked a file: a check-in about
  the listing ("are you back in your Drouillard home … future showings") went to the
  purchase, and "the <client> purchase" went to a third file because Western Title's
  escrow assistant was on only that one. Now only the email's content picks between
  the clients' files; it names neither or both, it queues. Western Title's "We
  received the lenders wire and have released for recording!" in the "Mutual Clients"
  thread names neither, so it queues rather than following its thread.
- **The subject names the one it is about (rule 3).** "Envelope completed: Nordic Ave
  Offer Letter" carries the buyers' letter naming their own home, 2354 NW Drouillard,
  and filed there (v3 did too).
- **A company is one person** when rule 4 looks for the one file someone is on.
- **The full-address gate was too wide.** Our own mail to people on no file is deal
  mail unless it reads as marketing (the title officer at a mistyped address, the
  owner's CMA, the media company, the Golden Astor commission thread): 15 messages on
  52678 Golden Astor Road and the Huntington media forward came back. Deschutes Title
  is a title company, "| DE22058" and "EM receipt" are escrow words, and invoices,
  cash-flow sheets and a yard sign being down are the property's own business. The
  rules now read the names of every attached file, not only PDFs (names only, never
  stored).
- **Two of our files named alike queue** whoever wrote it (the sign company's proofs
  for two installs); "Ryan Realty_20702 Beaumont Dr, Bend.pdf" names 20702 Beaumont
  (an underscore hid the number).
- **Smaller:** a street-only subject no longer exempts a list from being a digest (a
  buyer's tour of five properties); Oregon's Initial Agency Disclosure Pamphlet is no
  disclosure; a CRM's "Daily Birthday Reminder" is noise; an e-sign platform's
  no-reply keeps its recipients as evidence; "NW Newport Ave" is not "NW Newport
  Hills"; a broker's "[Deal: …]" for a property with no file waits in the queue.

| Golden eval, 1,522 rows | v3 | v4 first draft | v4 before relabel | v4 as shipped |
|---|---|---|---|---|
| Precision | 97.0% | 98.1% | 98.9% | **99.3%** |
| Recall | 89.6% | 92.6% | 94.8% | **96.6%** |
| Wrong file | 3 | 6 | 1 | **0** |
| Filed that should not be | 28 | 14 | 11 | **7** |
| Better / worse than v3 | | 92 / 41 | 100 / 22 | **103 / 0** |

**As shipped (2026-09-24, 21:10Z).** Every row below that the review found
mislabeled was relabeled in `data/tc-mail-golden.json` after reading the message
(25 rows, `confidence: "verified"` with a `note` naming the reason): the 9 Studio
drafts and 7 ad-sales/marketing rows are `not_filed`; the two "Updates" emails,
the lender's large-file notice and "Mutual Clients" are `queue`; the sign
company's replies and the net sheet replies file on 5663 SW Impala; "RE:
Schoolhouse Closing" files on 56111 School House Rd. Then the full set was run
again: 74 of Matt's rows came back `error` in one window (Gmail refused a
burst; the same rows passed in the rules pass minutes earlier), so those 74
were run again at concurrency 2 and decided with 0 errors. Final outcomes:
TP 1,054, TP_QUEUE 55, TN 366, SAFE_QUEUE 34, MISS 6, FALSE_FILE 7, WRONG 0,
ERROR 0. The v3 column's outcomes were scored against the labels as they were
before the relabel. `scripts/tc-mail-eval-baseline.json` is now this v4 run.

The 22 rows the pre-relabel run scored worse than v3, each read:

- 9 are the Studio's own drafts from `onboarding@resend.dev` ("Schoolhouse Rd v1 —
  listing video that beats the AI field"), our own machine (change 10 above); the
  hand-judged Studio drafts in the same set are labeled not deal mail.
- 7 are not about the listing: six HAVEN Homes + Lifestyles ad-sales emails ("19496
  Tumalo Reservoir Rd stood out as a fit for our Central Oregon Living section", "I
  can bring the full-page rate down to $295") and a lead-alert forward of our own
  home-value email ("it is most likely a marketing or system generated email"). The
  hand-judged copies of the same pitches in Paul's mailbox are labeled not deal mail.
- 3 queue because the email names both of the clients' files ("Saturday (5/10)
  Updates" and "Tuesday Updates", with a *Drouillard* section and a *Nordic* section)
  or neither (a lender's "Appraisal report.pdf" large-file notice).
- 2 are the sign company's replies in Paul's "new sign needed" thread for 5663 SW
  Impala (a proof named "Ryan Realty_Paul Stevenson_5663 SW Impala Ave,
  Redmond.pdf"); they file with Paul's own order on that listing. Their label (not
  deal mail) disagrees with the label on the same company's proofs for 19496 Tumalo
  (19c2f26db0a023d1, "file"), which now queues because it names two listings.
- 1 is "RE: Schoolhouse Closing" (19e17a4288ec1322), labeled 20702 Beaumont Dr and
  filed on 56111 School House Rd: "I sent out estimated statements for closing on
  5/15", School House's close date. The label is the error.

Still open after v4:

- "Envelope completed: Price Change Form": the PDF's text layer is
  font-garbled, so no rule can read the address; the document reader (page
  images) can.
- A message about two of our files (a status note with "Nordic" and
  "Drouillard" sections, a Supra notice naming two showings) queues:
  `tc_mail_messages` carries one `deal_id`.
- Rows filed by v2 or v3 that v4 would not file (182 copies of one Drouillard
  mail-merge) stay filed until the backfill's reconcile step is run: indexing
  never unfiles a filed row. They also anchor their threads: a virtual-staging
  vendor's replies on 5663 SW Impala still file by thread (3 golden rows) until
  that thread's first message is decided again.
- Two labels in the golden set disagree with the message (see the list above
  for 19e17a4288ec1322 and the sign company): the net sheet replies on 5663 SW
  Impala (19db5eedbf71e860, 19fa610af4350706, labeled "queue") are Paul's net
  sheet for his Impala sellers, whose first message in the thread names "5663
  SW Impala" and "My seller is considering a new price", and they file there.
  The "Mutual Clients" reply (199ced8da06e36cb, labeled 2680 NW Nordic) is from
  Western Title, the escrow on 2354 NW Drouillard, releasing "for recording";
  it queues.

## Every message reviewed

Matt expects an ORE Agency auditor to be able to see that EVERY email in
EVERY broker mailbox was looked at, not just the ones the Vault kept. Before
2026-09-24, `tc_mail_messages` held a row only for mail that was filed,
queued or dismissed (4,295 rows across the three mailboxes, against 72,450
messages Gmail actually holds) — a "not a deal" or "bulk" outcome left no
trace anywhere. `indexGmailMessage` already decided every message in three
passes; it just never wrote down the decisions it discarded.

- **`public.tc_mail_reviews`** (migration `20260924030000_tc_mail_reviews.sql`):
  one row per `(mailbox, gmail_id)`, whatever `indexGmailMessage` decided —
  `filed`, `ambiguous`, `unfiled_transaction`, `kept_manual`, `not_deal`,
  `bulk`, or `error` — with a short `reason`, the `stage` that decided
  (`rules`, `thread`, `model`, or `person`), and `rules_version`. A
  `filed`/`ambiguous`/`unfiled_transaction`/`kept_manual` row's `message_key`
  points at its full `tc_mail_messages` row. A `not_deal`/`bulk`/`error` row
  carries **no subject, sender or body text** — nothing personal about a
  message that never touched a deal is kept, and the `reason` names a rule
  or a count, never quotes the message
  (`lib/tc/mail-index.ts` `reviewReasonFor`).
- **Every call to `indexGmailMessage` writes one** (upsert on `(mailbox,
  gmail_id)`), including the 15-minute CRM Gmail sync, every sweep, and
  `fileIndexedMessageToDeal` (stage `person`, or `rules` when the actor is
  the auto-open-from-mail sweep). Fail-open and cheap: one upsert, never
  blocks filing; skipped entirely on a `dryRun` call.
- **`reviewMailbox`** (`lib/tc/mail-index.ts`) walks a mailbox's ENTIRE
  history — `-in:chats`, no other query, no date window — resuming from
  `public.tc_mail_review_cursors` (page token, running listed/reviewed
  counts, `finished_at` once `users.messages.list` is exhausted). A message
  already in `tc_mail_reviews` for that mailbox is skipped, so a mailbox
  that already went through the deal-term sweeps above only pays to review
  what those never touched.
- **`npx tsx scripts/tc-mail-backfill.ts review-all [--mailbox x] [--concurrency 4] [--limit N] [--model-stage] [--dry-run]`**
  runs it from the command line, with per-page progress. `--dry-run` is
  READ-ONLY: decides every message but writes nothing.
- **The daily sweep** (`/api/cron/tc-mail-sweep`) spends whatever is left of
  its 240 s budget continuing `reviewMailbox` for any mailbox not yet
  finished, after its existing steps (a mailbox already finished costs
  nothing — no Gmail call).
- **The model stage** (`lib/tc/mail-model-stage.ts`, stage `model`): a
  leftover `not_deal`/`unfiled_transaction` message that still looks
  transactional — a non-general category, a transaction-form attachment, or
  a subject naming a property — gets one structured Grok call with the
  open/recent deals list and the message's headers, snippet, body excerpt
  and attachment names. `confidence ≥ 0.9` with a named deal files it
  (`decided_by 'model'`, same path as a rules-filed message); anything else
  queues for a person with the model's reason. **The model never dismisses a
  message on its own word** — a `notDeal: true` answer just leaves the
  rules' status standing. **Choosing among files:** a message the rules left
  ambiguous between two or more files the sender is on goes to the model with
  only those files (and their clients' emails). It files at `confidence ≥ 0.9`
  on one of them, and can never open a new transaction or name another file;
  otherwise it stays queued with the model's reason. The daily sweep's
  re-decide step runs the model once per queued message (a review row with
  stage `model` is not asked again). **The live sync opts in (2026-09-24):**
  `lib/crm/gmail.ts` indexes every new message with `modelStage: true`, so a
  leftover that still looks transactional is read by the model the same
  quarter-hour it arrives rather than waiting for the daily sweep. Measured
  before turning it on: of Matt's 250 most recent messages 3 were
  model-worthy leftovers and 3 ambiguous (about 4 Grok calls a day at his
  30-day rate of 164.7 messages a day); Rebecca's and Paul's latest 60 each
  had none. Other callers stay opt-in (`indexGmailMessage({ modelStage: true })`
  / `review-all --model-stage` / `reviewMailbox({ modelStage: true })`).
  Tests and dry runs never call it.
- **PDFs from people on a file are always read (2026-09-24).** Pass 2 used to
  open a message's PDFs only when their names looked transactional or the
  rules already meant to keep the message. A PDF sent by, or to, a party,
  contact or named person on one of our files is now read whatever it is
  named ("ORE Residential Input - ODS_....pdf" named 1974 NW Newport Hills
  only in its text). About 5 such messages a day, at most 5 PDFs each.
- **Coverage**: `lib/data/tc/mail-coverage.ts` `getMailCoverage()` reads
  Gmail's own `messagesTotal` per mailbox (live `users.getProfile`) against
  `tc_mail_reviews` counts and `tc_mail_review_cursors.finished_at`, shown on
  `/admin/closings` (superuser) as "Every message reviewed": per mailbox,
  Gmail total, reviewed, coverage %, the status breakdown, last reviewed,
  and whether the full-history walk has finished.

## Golden evaluation set

Six auditors hand-judged real mail against the filer on 2026-09-24 (each on a slice —
`filed-matt`, `filed-rp`, `missed-notdeal`, `missed-bulk`, `deal-recall`, `queue` — of the
three mailboxes' `tc_mail_reviews` rows), so a rule change can be measured for precision and
recall instead of eyeballed. Their judgments live as a **permanent regression set**:

- **[`data/tc-mail-golden.json`](../data/tc-mail-golden.json)** — one row per unique
  `(mailbox, gmail_id)`: `{ mailbox, gmail_id, expect: 'file'|'not_filed'|'queue', deal_id,
  deal_not_in_vault, slice, confidence: 'hand'|'classifier'|'verified' }`. **No content** — no
  subject, sender, body or evidence text, ever (real client mail; ids and expectations only).
  Built by [`scripts/tc-mail-golden-build.ts`](../scripts/tc-mail-golden-build.ts), which maps
  each auditor's own verdict word (`correct`, `wrong_deal`, `pertains_to_deal`, `file_to`, …) to
  the golden expectation — see that file's header for the worked table — and resolves a message
  judged more than once by confidence: `verified` (a targeted adversarial re-check that read the
  disputed message directly and cross-checked tc_deals/tc_cycles/tc_deal_people/
  tc_deal_contacts — `mail-audit/verify/findings.json`) outranks `hand` (an auditor who read the
  message), which outranks `deal-recall`'s lower-confidence regex classifier sweep. Re-run it
  after a new audit slice lands, or a new `verify` finding: `npx tsx
  scripts/tc-mail-golden-build.ts [--audit-dir <path>] [--out <path>]`. It refuses to overwrite
  the committed file with one less than half its size (the default `--audit-dir` is a Claude
  session's own scratchpad, gone in a later session) unless `--force` says so deliberately.
- **[`scripts/tc-mail-eval.ts`](../scripts/tc-mail-eval.ts)** (`npm run tc:mail-eval`) replays
  every golden row through the PRODUCTION path — `indexGmailMessage(..., dryRun: true)`, the
  same call the 15-minute sync and the daily sweep make, against a universe loaded ONCE via
  `loadMailUniverse` — and scores it: filing the right deal is `TP`; filing the *wrong* one is
  `WRONG` (the worst outcome); landing in the queue instead of filing is `SAFE_QUEUE`; getting
  dropped as `not_deal`/`bulk` when a deal or the queue was expected is `MISS`; filing something
  that should have stayed out (or been queued) is `FALSE_FILE`; correctly staying out, whether
  dropped or queued, is `TN`; correctly landing in the queue when the queue was the right call is
  `TP_QUEUE`. It prints precision (`TP / every
  row the system filed`) and recall (`TP / every row the golden set expected filed`) overall,
  per slice and per mailbox, plus the wrong-deal count, false-file count and queue rate.
  `--slice`, `--limit` and `--only-errors` narrow a run; `--save-baseline <file>` and
  `--baseline <file>` snapshot and diff outcomes (ids + outcome only) across runs, and the
  script exits non-zero if any row got worse. Read-only: Gmail is opened readonly-scoped, and
  `dryRun: true` is passed on every call and asserted in code — nothing is written to Gmail or
  Supabase.
- **[`scripts/tc-mail-eval-baseline.json`](../scripts/tc-mail-eval-baseline.json)** — the
  committed baseline (outcomes only, no content) from the run against `mail-rules-v4-2026-09-24`
  as shipped (the v3 run it replaced is summarized in the v4 table above).
  A rule change must not lower precision, raise the wrong-deal count, or raise the false-file
  count against this baseline; regenerate it deliberately (`--save-baseline`) once a change
  ships, never to paper over a regression.
- **This needs the Google service account (`GOOGLE_SERVICE_ACCOUNT_*`) and Supabase
  (`SUPABASE_*`) in the process env, so it is a local/nightly check, not part of the
  secret-less `ci:gates` chain.** Run it by hand before and after any change to
  `lib/tc/mail-rules.ts` or the filing path in `lib/tc/mail-index.ts`.

## Re-deciding history after a rules change

Every `tc_mail_reviews` row carries the `rules_version` that decided it. When
`MAIL_RULES_VERSION` changes, the history is decided again under the new rules
and corrected: [`lib/tc/mail-redecide.ts`](../lib/tc/mail-redecide.ts), run by

```
npx tsx scripts/tc-mail-backfill.ts redecide [--dry-run | --apply]
    [--mailbox x@ryan-realty.com] [--status bulk,not_deal,filed]
    [--since YYYY-MM-DD] [--limit N] [--concurrency 4] [--batch 200] [--max-minutes N]
```

**Dry run is the default** and is read-only: every database handle it holds
refuses writes, it takes no lock, and it prints the count of each transition
per mailbox, ten samples of each (subject and reasons), and writes every row
that is not unchanged to `tmp/tc-mail-redecide/<run>/changes.{jsonl,csv}`
plus `summary.json` (counts, documents, timings, Gmail calls).

What it selects: every review row whose `rules_version` is not the current
one (`--mailbox`, `--status` and `--since` narrow it), **oldest message
first**. A row done carries the new version, so a run that stops (a
`--limit`, `--max-minutes`, Ctrl-C) resumes by running again, and a second
run over finished history selects only the rows a person owns and changes
nothing.

How each message is decided: `indexGmailMessage` itself, dry first. A message
delivered to two mailboxes is decided once per copy and the best copy wins (a
copy that files beats one that is ordinary mail in another inbox; a copy that
failed to decide holds the message back for the next run; a copy deleted from
its mailbox does not vote). **Thread anchors**: rule 2 follows a sibling only
once that sibling has been decided again under the new rules (or a person, the
model or the auto-open sweep decided it), so a thread the old rules misfiled
as a whole cannot hold itself on the old file. Replies run after their opener
(one thread's rows run in order). Rule 2 has no time order (a reply can follow
a later email that names the property), so a message about to leave its file
while a sibling in its thread still waits to be decided again is held back and
decided at the end of the run, once the thread has settled; when that sibling
is outside the run (past `--limit` or the deadline) the message is left for
the next run instead of being decided early.

| Transition | Was → now | `--apply` does |
|---|---|---|
| unchanged | same | re-stamps the review row; a filed row gets the new version and reasons |
| relabel | not_deal ↔ bulk, ambiguous ↔ unfiled_transaction | re-stamps; a queued row is refreshed by the live path |
| file | bulk / not_deal / queued → filed | the live path files it: documents, offers, `mail_filed` |
| queue | bulk / not_deal → queued | the live path queues it for a person |
| move | filed on A → filed on B (or another cycle of A) | the live path files it on B; A is corrected (below); `mail_moved` on both files |
| unfile | filed → not_deal / bulk | A is corrected; the index row becomes `dismissed` with `decided_by 'system'`; `mail_unfiled` on A |
| requeue | filed → queued | A is corrected; the live path queues it; `mail_unfiled` on A |
| dequeue | queued → not_deal / bulk | the index row becomes `dismissed`, `decided_by 'system'` |
| kept_model | queued by the model stage; the rules alone do not file it | stays in the queue for a person; the review row says so |
| protected | a person decided it | nothing, ever (below) |
| gone | the message is in no mailbox any more | nothing |
| error | Gmail or the decision failed after retries | nothing; the next run retries it |

**A person's decision is never touched.** Protected: an index row whose
`decided_by` is not `system` (a broker's email, `model`, the auto-open sweep
`system:mail-index`, the test harness), a review row with stage `person`, or
status `kept_manual` / `dismissed`. Such a message is not even read from Gmail.
Apply re-reads the index row right before every write; a broker who answers the
queue during the run wins, and the live path itself returns `kept_manual`.
A row the rules dismissed keeps `decided_by 'system'`, which is how it differs
from a broker's "not a deal" (that row carries the broker's email).

**Correcting the file a message leaves** (`lib/tc/mail-reconcile.ts`
`planDocumentsOffDeal`): a document is archived (the Vault's delete, with a
reason starting `Mail re-decision:`) only when this message's filing created
it (`source_doc_id` `gmail:<message key>:…`), no other filing uses it (another
email filed on that deal, a text, an uncorrected earlier filing) and no person
relies on it: a person's event on it, a principal review, shared with the
client, in a signing envelope, linked to an offer, or on the checklist by any
hand but the document reader's. Only reader-made checklist rows are removed,
and each archived document gets its own `document_archived` event.
Everything kept is named in the event with its reason. Documents an index row
filed (`classification.mail_message_id`) on a deal the row no longer names
(left there when the live index re-filed it elsewhere, or by a run that
stopped between filing and correcting) are corrected the same way whenever the
row is decided again (`correctLeftovers`), so an interrupted run heals on the
next one. **Offers are never
deleted**: an offer the message recorded on the old file is named in the event
(`offers_left_for_review`) for a broker. A later rules version that files the
message back restores exactly the documents this archived
(`planDocumentsOnDeal`); a move between cycles of one file moves the documents.

**Running it**: one run at a time (a lock row `lock:tc-mail-redecide` in
`tc_mail_review_cursors`, taken over only after 20 minutes without a
heartbeat); batches of `--batch` rows, `--concurrency` threads at a time; Gmail
429 / 5xx / rate-limit 403 retried with backoff (1 s doubling to 32 s, six
tries) on top of the client's own retry; read-only Gmail scope; the model stage
never runs. Events are written by `system:tc-mail-redecide`. After an apply,
the daily sweep's `refileThreadSiblings` (or `refile-threads`) lets a reply
decided before a later sibling filed follow that thread, as it does for live
mail.

**Sizing** (`redecide --dry-run`, 2026-09-24 20:56 UTC, all three mailboxes,
rules `mail-rules-v3-2026-09-24` over the history decided under v2): 72,056
rows selected (matt@ 61,056, paul@ 8,664, rebeccapeterson@ 2,336), 55 minutes
at `--concurrency 10`, 85,191 Gmail reads (72,341 metadata, 9,119 full, 3,731
attachments; 81 retries, no 429s). Rows: unchanged 71,793, file 107, queue
92, protected 26 (model 20, kept_manual 5, test harness 1), unfile 16,
kept_model 13, relabel 4, requeue 2, move 1, error 2 (Gmail "Precondition
check failed", left for the next run). 179 messages were held back until their
thread settled, none left over. No document would be archived (2 kept: not the
email's own), no offer touched; 221 messages would go through the live path on
apply. The v4 run will differ: these are v3's changes only.

### Dry run of v4.1 (2026-09-30)

**Why a new version.** Production has run v4 as shipped since 2026-09-25 and
stamped 1,077 review rows `mail-rules-v4-2026-09-24` (matt@ 904, paul@ 71,
rebeccapeterson@ 102) with decisions these rules no longer make (a TC firm's
"SPDS questions" thread, a client's loan note on a purchase that had died).
Under the same string the re-decision would never select those rows, and a
thread anchor carrying it would count as decided under the current rules. The
branch is `mail-rules-v4.1-2026-09-30`, so every row is selected: 73,259.

**How it ran.** `redecide --dry-run`, read-only, in four pieces of 13 to 21
minutes, each short enough to finish between container restarts. A dry run carries nothing from one
run to the next, so a piece that begins where another ends starts two weeks
earlier and keeps only its own range (its thread anchors settle first):

| Piece | Flags (all `--concurrency 10-16 --batch 500`) | Rows kept | Minutes |
|---|---|---|---|
| paul@, rebeccapeterson@ | `--mailbox paul@…,rebeccapeterson@…` | 11,234 | 13.4 |
| matt@ before 2025-04-01 | `--mailbox matt@… --limit 24505` | 24,503 | 17.5 |
| matt@ 2025-04-01 to 2026-03-31 | `--mailbox matt@… --since 2025-03-18 --limit 16452` | 15,873 | 20.4 |
| matt@ from 2026-04-01 | `--mailbox matt@… --since 2026-03-18` | 21,644 | 17.5 |

The paul@ and rebeccapeterson@ piece ran first, the two older matt@ pieces
side by side, then the newest: 05:14 to 06:04 UTC. Gmail: 76,616
metadata reads, 11,364 full, 4,952 attachments; 1,308 transient retries, no
429s; 3 messages gone from the mailbox. 5 rows at the seams were left for the
next run (a thread running past its piece's end: 2 and 3). 7 document previews
failed on a transient database error; their decisions stand.

Rows per transition (first pass, the code before the fixes below):

| Mailbox | unchanged | relabel | file | queue | unfile | requeue | move | kept_model | protected | gone |
|---|---|---|---|---|---|---|---|---|---|---|
| matt@ | 59,307 | 981 | 553 | 160 | 367 | 35 | 511 | 66 | 37 | 3 |
| paul@ | 8,722 | 0 | 9 | 5 | 12 | 0 | 1 | 0 | 0 | 0 |
| rebeccapeterson@ | 2,050 | 5 | 65 | 46 | 237 | 18 | 32 | 28 | 4 | 0 |
| **Total** | **70,079** | **986** | **627** | **211** | **616** | **53** | **544** | **94** | **41** | **3** |

Moves: 519 to another cycle of the same file, 25 to another file. Documents:
16 would be archived, 28 kept (27 not the email's own, 1 still filed by another
email), no offer touched. No dequeue and no error.

**Every class read, with its verdict.** Of the 3,175 changed rows, 3,071
repeat the 2026-09-25 dry run exactly (its classes were read and fixed then,
and were sampled again here); the other 104 were listed and read row by row
(the model's queue rows by class).

| Class | Rows | Verdict |
|---|---|---|
| move, cycle: showings, marketing, a listing appointment and CMAs before a contract go to the listing; contract mail to the contract live that day or named by its escrow number (3480 SW 45th's 2026 relisting, 20702 Beaumont, 19496 Tumalo's contract of 2026-09-19) | 519 | right, except Tumalo's offer mail in the week before acceptance, which went to the contract because the offer read as fully executed: fixed (1 below); the TC firm's "You're Under Contract" to that contract is right and stays so (7) |
| move, file: "Schoolhouse Closing" (12) to 56111 School House, "Today's Call at 530" with the comps (2) to 19496 Tumalo, the owners' CMA reply to 64350 Old Bend Redmond Hwy, an envelope naming 909 NW Delaware off 3480 SW 45th, "Mutual Clients" (8) to 2680 NW Nordic, a note about the clients' loan officer off a dead purchase | 25 | right |
| file: Flexmls activity reports by MLS number, title and escrow threads, e-sign envelopes naming the address, the clients' own mail on one open file, the Nordic and Drouillard threads, Paul's Impala net sheet and sign thread | 627 | right file for all but five: four "936-946 NW Delaware Ave" rows (an income property down the street) on 909 NW Delaware, and our "[TEST] Buyers looking for … Old Bend" on 64350 Old Bend Redmond Hwy: fixed (3, 4). Right file, wrong cycle for 11 rows of 3480 SW 45th's 2026 escrow, put on its 2025 purchase: fixed (8) |
| unfile: our own listing announcements ("New NWX Listing", "Discover Bend Living – Exclusive Listing", "New Bend OR Listing", 299 rows), vendors and pitches (HAVEN, virtual staging, auction academies, delivery notices), our machines and the Studio (CMA requests, seller leads, signing emails, listing reels), test-fixture mail, neighbours on our street | 616 | right, except our note to the MLS help desk ("I need help with a listing", 3) and RMLS's notice about the Sunstone listing's record (2): fixed (2) |
| queue: e-sign completions with an executed PDF nothing places, transaction mail for properties with no file, clients on two files, a firm on several | 211 | right (a person picks) |
| requeue: the forwards for 423 and 1405 NW Newport Ave off 1974 NW Newport Hills (19), a buyer's pre-approval for 886 NW 12th, clients on two or more files ("Mutual Clients", the weekly updates), executed PDFs nothing places, a title officer's invitation with a PDF | 53 | right |
| relabel: not_deal ↔ bulk, our own system mail and strangers naming an address | 986 | right (nothing stored either way) |
| kept_model, protected, gone | 138 | right: the model's and a person's decisions are kept; deleted mail is left alone |

**Fixed as classes, each with a test shaped like the message:**

1. **A sale agreement's printed words are not a signature** (`lib/tc/execution-state.ts`).
   The 2026 Oregon sale agreement prints "reviewed and signed by Buyer, Seller
   and Agent(s)" and "dated and signed by Buyer and Seller". With DigiSign
   stamps flattened onto one line by the text read, the fallback took those
   words for both signatures, so a buyer's offer ("Offer on Tumalo Reservoir",
   stamped on the buyer's initials) read as a fully executed agreement: it went
   to the contract instead of the listing's offer log, logged no offer, and in
   the queue would have opened a file ("Offers alone never open a file"). The
   same read decides when a returned PDF may close an envelope waiting on the
   other side. The printed clause no longer counts; a stamp that names its
   signer still does. And a file named as the sale agreement ("PSA.pdf") is not
   a counter because its text talks about counter offers.
2. **The MLS is part of the listing** (COAR and RMLS are transaction senders):
   our note asking COAR's help desk to set 363 SW Bluff Dr back to "coming
   soon" is the listing's business, not marketing; RMLS's "in-progress listing
   is scheduled to be deleted" notice names the Sunstone listing's record.
3. **A range of house numbers on our street is a neighbour**: "936-946 NW
   Delaware Ave" and "936946 NW Delaware Rent Roll.pdf" are not 909 NW Delaware.
4. **A three-word street is called by all three words**: "Old Bend" is a Bend
   neighbourhood, not 64350 Old Bend Redmond Hwy (its SkySlope mailbox and
   "Old Bend Redmond" still name it).
5. **A purchase that died before the email is over** (rule 1b, found by the
   golden eval): SkySlope added the clients as buyers on their first purchase
   (dead 2025-07-08, no address) on 2026-09-26, and "Balance of Down Payment",
   a note about their loan officer and their replies (4 rows) queued between two purchases. The side
   word now names the purchase still going.
6. **A dated cycle wins a tie over its undated duplicate** (`pickCycleForMail`):
   the forward of 2680 NW Nordic's first contract's refund request (2 rows).

Two more classes surfaced when the second pass (below) was compared with the
first, each fixed with a test:

7. **The contract announced is the contract.** With fix 1, a TC firm's
   "Congratulations! You're Under Contract! | 19496 Tumalo Reservoir Rd",
   carrying the sale agreement and the counters that made it, read as a
   counter and stayed on the listing's offer log. A subject announcing the
   contract with the agreement attached is the executed agreement: it goes to
   the contract, and in the queue it proves a deal is under way.
8. **One person under two spellings is on both contracts.** The clients
   bought 3480 SW 45th in 2025 under a short first name and sold it in 2026 under the full one: the
   full name, found only on the 2025 purchase, pulled 11 messages of the 2026
   escrow (WT0289392) back to that purchase. Names that are the same person
   (`looseSameName`) now count as on both.

**The final pass** (the same four pieces on the code with all eight fixes,
07:41 to 08:09 UTC, 28 minutes with all four side by side; 73,276 rows
selected, 5 left at the seams again):

| Mailbox | unchanged | relabel | file | queue | unfile | requeue | move | kept_model | protected | gone |
|---|---|---|---|---|---|---|---|---|---|---|
| matt@ | 59,318 | 981 | 548 | 160 | 362 | 35 | 527 | 66 | 37 | 3 |
| paul@ | 8,722 | 0 | 9 | 5 | 12 | 0 | 1 | 0 | 0 | 0 |
| rebeccapeterson@ | 2,049 | 5 | 65 | 46 | 237 | 18 | 33 | 28 | 4 | 0 |
| **Total** | **70,089** | **986** | **622** | **211** | **611** | **53** | **561** | **94** | **41** | **3** |

Moves: 536 to another cycle, 25 to another file. Documents: 16 would be
archived, 28 kept (27 not the email's own, 1 still filed by another email), no
offer touched. No error, no dequeue. Gmail: 78,776 metadata reads, 11,630 full,
5,081 attachments; 3,846 transient retries, no 429s; 5 reads failed after
retries: the 3 messages gone from matt@, and 2 that left no row in error. 47
rows differ from the first pass, each checked against its message and the
file's dates: the 13 the fixes leave where they are (the MLS note
and its replies, the RMLS notices, the Delaware range, "Old Bend", Tumalo's
offers), the "Under Contract" announcements of 64350 Old Bend Redmond Hwy (both
contracts), 20473 Jacklight, 17130 Mayfield, 20702 Beaumont (both contracts),
3480 SW 45th and 19496 Tumalo now on the contract they announce, and the 2026
3480 SW 45th escrow's mail on its own contract. One of those is arguable:
"Envelope completed: OFFER 2 REJECTION" on the day the first offer was
accepted goes to that contract, where the listing's offer log would be as
right; an e-sign notice is never read as an offer.

Read and kept as they are: a vendor thread about two listings follows the
thread's file when a reply names both ("Re: New Signs for Ryan Realty", 3
rows on 17130 Mayfield, the later two about the 64350 sign); a seller's own
search for a next property files on the one listing open for them ("Glacier Ave
Comps" and three Flexmls notes, 4 rows on 1050 NE Butler Market); a TC firm on four files writing
"56111 invoice" queues (the firm is not on 56111 School House); a stranger's
"I came across your listing" and a client family's personal details are not deal
mail.

**Golden eval** (`npm run tc:mail-eval`, 1,522 labeled rows, dry run). It
scores the file, not the cycle, so fixes 6 and 8 move no row. Its thread
anchors are read from the live index, which production v4 keeps changing.

| Run | Filed right | Wrong file | Filed, should not be | Safe queue | Missed | Precision | Recall |
|---|---|---|---|---|---|---|---|
| v4 as shipped (committed baseline, 2026-09-24) | 1,054 | 0 | 7 | 34 | 6 | 99.3% | 96.6% |
| this branch, 2026-09-25 (9a93fd9c9) | 1,054 | 0 | 31 | 32 | 8 | 97.1% | 96.6% |
| 2026-09-30, after the merge and fix 6 | 1,059 | 1 | 31 | 26 | 8 | 97.1% | 97.1% |
| + fix 5 | 1,062 | 1 | 31 | 23 | 8 | 97.1% | 97.3% |
| final, fixes 1 to 8 | 1,062 | 1 | 31 | 23 | 8 | 97.1% | 97.3% |

25 of the 31 "filed, should not be" are labels written before 909 NW Delaware
had a file: transaction mail for a property with no file, labeled "queue";
the file was opened 2026-09-24 22:11 UTC and they file on it. Without them the
count is 6 and precision 99.3%. Against the committed baseline: 12 rows better,
28 worse: those 25, the two untagged "TEST:" listing-reel emails the set files
on the 2840 NE Sedalia Loop test fixture, and "Home Warranty"
(19e1e3c557de2ace), general mail from a title officer on nine open files that
names none. The one wrong file is a label error (below).

Between 2026-09-25 and today the live data moved, and the eval shows it:
production filed the "SPDS questions" thread on 20473 Jacklight, so its
replies follow it; SkySlope added the clients as buyers on their dead first
purchase on 2026-09-26 (fix 5 recovers the three rows it cost).

**Labels in the golden set that disagree with the message** (corrected 2026-10-01, with the evidence for each, in the next subsection):

- 19959e2013e3d02d, labeled 20702 Beaumont Drive: Matt's reply in the "SPDS
  questions" thread ("I spoke with the seller and have an addendum out now to
  the buyers that corrects line 201"). The thread is 20473 Jacklight Lane's:
  its contract was accepted 2025-09-14, three days before; the other agent
  asking is on Jacklight only; Beaumont had no contract until 2026. The same
  set labels the opener and two replies Jacklight.
- The 25 "queue" rows for 909 NW Delaware (1a05ddbabdb38eb8 through
  1a0b5305a8217f96, "Offer to purchase 909 Delaware", "CLOSING TODAY!! 909 NW
  Delaware Avenue"): the file exists now; they are that file's.
- 19e28a9f11e2c224 (matt@) and 19e2c0963e2501d2 (paul@), labeled filed on
  2840 NE Sedalia Loop: "TEST: listing reel for MLS 220189422", the Studio's
  test mail, untagged, on a test fixture. Not deal mail.

### Golden labels corrected, "Home Warranty" read, and the signing-envelope watch (2026-10-01)

Read-only throughout: Gmail through the eval's own `getGmailFor` with the
readonly scope, the database through row reads (`-- audit:`). Nothing was
written to either.

**The golden file** (`data/tc-mail-golden.json`): 29 rows changed, each after
reading the message and the file's rows. The schema is as it was; a changed row
carries `confidence: "verified"` and a dated `note` (no names, no addresses),
the way the 2026-09-24 relabels do. `scripts/tc-mail-eval-baseline.json` is not
regenerated: it stays the v4 run, so the next rule change still measures
against what shipped.

| Rows | Label was | Now | Evidence |
|---|---|---|---|
| The 25 "queue" rows, 1a05ddbabdb38eb8 through 1a0b5305a8217f96 | queue (no file) | file on 909 NW Delaware Avenue (`71f04c3b`) | All 25 read in full (bodies and subjects). They are one purchase, from "Offer to purchase 909 Delaware" on 2026-09-01 (the accepted sale agreement came back at 4:02 pm that day) to "CLOSING TODAY!! 909 NW Delaware Avenue" on 2026-09-18: the offer thread with the other agent and the transaction coordinator, the inspector's confirmation, First American's "Escrow/Title Opened" and its escrow number 4416459, the earnest money receipt, the preliminary title report, the buyers' question about its exceptions and the one about extended coverage, the property disclosure addendum, the closing-day notices. Every one names 909 (NW) Delaware in its subject or thread; none contains "936", "946" or "Rent Roll" (the neighbour's range, fix 3). The file's one cycle is a sale, MLS 220222734, accepted 2026-09-01, closing 2026-09-18; the file was created 2026-09-24 22:11:30 UTC, after these labels were written, which is why they said "no file". Production v4.1 files all 25 on it. |
| 19959e2013e3d02d | file on 20702 Beaumont Drive (`880b5387`) | file on 20473 Jacklight Lane (`3e1e54a4`) | Matt's reply of 2025-09-17 in "SPDS questions" ("I have an addendum out now to the buyers that corrects line 201"), to the TC. The thread was opened by the other agent on Jacklight's sale cycle; her surname appears on no other file's contacts (Jacklight alone carries her and two other-party contacts of that name). Jacklight's sale was accepted 2025-09-14, three days before; the Beaumont file's first contract was accepted 2026-03-28 (a listing cycle only before it). The set already labels the thread's opener and two replies Jacklight. Production v4.1 files the row on Jacklight by thread. |
| 19e28a9f11e2c224 (matt@), 19e2c0963e2501d2 (paul@) | file on 2840 NE Sedalia Loop (`ca50ab4a`) | not filed | Both are the marketing line's automatic replies ("Adding this to the brain queue now", "Working on this now") to a "TEST:" request, from marketing@ to Matt and to Paul. The MLS numbers in the subjects (220189422, 220189999) are on no `tc_cycles` row; the fixture's is 220227583. The rules say a test fixture takes only mail tagged "[TC TEST <run>]" and the test aliases are never evidence untagged (section "Addresses that are never evidence"). Production v4.1: not_deal, "no deal evidence". |
| 19e1e3c557de2ace ("Home Warranty") | file on 20702 Beaumont Drive | not filed | Below. |

**"Home Warranty" (19e1e3c557de2ace) is a label error, and v4.1 is right.**
The message is an empty draft: Gmail label DRAFT, subject only, no body, no
attachment, started 2026-05-12 22:08:50 UTC to Western Title's title officer.
She is a title or escrow contact on 19 files, Beaumont among them. Ninety
seconds later, 22:10:24 UTC, Matt began a second draft to her, "Home warranty on
school house" (19e1e3dc363ccdf3), which production files on 56111 School House
Rd by its street name; her mail with Matt that week (05-10 to 05-14) is the
School House closing, which was 05-15. Beaumont had no
contract open that day: its previous one was canceled 2026-04-24 and the next
was accepted 2026-05-13. So nothing supports Beaumont, and what is nearest
points at School House. v4.1 decided "not_deal: general mail from someone on 9
open deals, naming none", which is what the message says; the label is now
`not_filed`. If the rules should file it, its file is School House, not
Beaumont.

*A rule gap, closed by v4.2 (section below):* v4.1 read a never-sent
draft as correspondence. The sibling draft above carries no body and was never
sent, yet it is filed on School House as mail ("street name of one deal"). A
rule that skips a message whose only label is DRAFT would keep unsent drafts out
of a file's mail. How many filed rows are drafts is not counted here.

**Golden eval** (`npm run tc:mail-eval`, 1,522 rows, dry run, 0 errors), the
same production decisions both times (no row's status or deal differs between
the two runs; only the labels moved):

| Run | Filed right | Wrong file | Filed, should not be | Safe queue | Missed | Precision | Recall |
|---|---|---|---|---|---|---|---|
| 2026-10-01 before, labels as committed | 1,060 | 1 | 29 | 23 | 10 | 97.2% | 97.2% |
| 2026-10-01 after, 29 labels corrected | 1,086 | 0 | 4 | 23 | 7 | 99.6% | 97.6% |

Outcomes that moved: 25 FALSE_FILE to TP (Delaware), 1 WRONG to TP (SPDS), 3 MISS
to TN (the two TEST replies and Home Warranty; TN 369 to 372). TP_QUEUE is 30 in
both runs: the committed v4 baseline has 55, the 25 more being the Delaware rows,
which v4 queued correctly while the file did not exist and v4.1 files. Against
the committed v4 baseline: 16 rows better, 3 worse, 1,474 unchanged. The 3 worse:
two `deal-recall` rows (classifier-confidence labels, 19ebc627dd43eb5e and
19ec0de81fc28e1c, filed under v4 and now `not_deal`) and one paul@ row
(19e0967b64b0243c, a `missed-bulk` label of not filed that v4.1 now files). The
remaining 4 "filed, should not be" are 19cc437e704fa1f5, 19dc7e836dd19e73,
19f493c215743389 and 19e0967b64b0243c; none was read in this pass. The 09-30
"final" row above (1,062 / 1 / 31 / 23 / 8) differs from this run's "before"
by two rows in each of three columns: production applied the v4.1 re-decide on
the evening of 2026-09-30 and the eval's thread anchors come from the live index.
That was not traced row by row.

**Signing-envelope watch (since 2026-09-30 09:51 UTC).** PR #396 stopped the
sale agreement's printed "signed by Buyer and Seller" from reading as a
signature in `lib/tc/execution-state.ts`; the same reader decides when a
returned PDF closes an envelope waiting on the other side
(`lib/tc/file-comms-write.ts`: status `awaiting_other_side` to `completed`,
event `envelope_completed_from_return`). Read-only SQL on `tc_envelopes`,
`tc_envelope_recipients`, `tc_events` and `tc_documents`, with a second-shape
check (the newest 40 envelopes of any status, to see the window filter missed
none):

| Count | Result |
|---|---|
| Envelopes closed or touched in the window | 7: 2 completed, 5 voided |
| Still open (`sent`, `partially_signed`, `awaiting_other_side`) with every signer signed | **0** (no envelope in the table is open at all) |
| Closed `completed` with a signer missing | **0** |
| Closed by a returned PDF (`envelope_completed_from_return`, ever) | 0 events; `envelope_sent_to_other_side` has 1 event ever, 2026-08-24 |

The rows (all on the test fixture 99001 Alias Test Loop, none a client's):

| Envelope | Status | Sent | Closed | Signers (NeedsToSign) |
|---|---|---|---|---|
| 20efae33 SPD 020 | completed | 09-30 10:57 | completed 11:12:34 | Seller 11:10:19, Buyer 11:11:47 |
| 37a0f3a6 SPD 020 | completed | 09-30 13:33 | completed 13:42:35 | Seller 13:39:36, Buyer 13:42:31 |
| 0c871437 Addendum 1 - 002 | voided | 09-30 07:58 | voided 10:43:40, "Superseded test packet" | none signed (Buyer viewed) |
| 15d45522, 33a04ee3, 012a48c3, 560e0142 SPD 020 | voided | never sent | voided 10:44 to 15:16, "Draft discarded" | none signed |

Both completions are our own in-house seal (`envelope_completed`; 4 recipients
each, 2 of them NeedsToSign and both of those completed, the other 2
ReceivesACopy), not the reader. No code change: neither count is non-zero. One side note on 20efae33's
sealed copy: the document reader's first read of it (11:22 UTC) was "Needs
review" with `execution_state: unknown` (its form check saw no signatures or
initials on a document whose envelope record has both signers complete); the
13:42 envelope's copy read "Fully executed". That is the document reader and
the form check on a test fixture, a different path from `execution-state.ts`;
not looked into further.

### v4.2: an unsent draft is not mail (2026-10-01)

`mail-rules-v4.2-2026-10-01`, rule −1 in the table above. Gmail's
`users.messages.list` returns drafts beside sent mail, under the broker's own
From line, and v4.1 decided them like mail he had sent.

**Measured 2026-10-01, before the change** (Gmail `users.drafts.list` read-only
per mailbox, matched by Gmail id):

| Where | Rows that are a current draft |
|---|---|
| Gmail drafts | 410 (matt@ 400, rebeccapeterson@ 10, paul@ 0) |
| `tc_mail_messages` | 152: 142 filed on 26 deals, 8 ambiguous, 1 unfiled_transaction, 1 dismissed (149 decided by v4.1, 3 by v2) |
| `tc_mail_reviews` | 410: 142 filed, 252 not_deal, 8 ambiguous, 7 bulk, 1 unfiled_transaction |
| `crm_timeline` (source gmail) | 143 `email_out` rows on 65 people |

The timeline rows are the costlier half: `lib/crm/response-clock.ts` counts a
Gmail-synced `email_out` with a broker on it as a person touching the lead, so a
draft to a new lead could stamp its first broker action and stop its five-minute
clock for an email nobody received.

**Draft ids.** Every autosave and the send itself get a new Gmail id under one
RFC Message-ID (rows with two to five same-mailbox `gmail_refs` seconds apart:
"Inspection Items (Draft)", "Offer 2", "Septic Items"). The index already keys on
the Message-ID, so a sent message carries its drafts' ids beside its own and
stays one row; only a message that is still a draft is wrong.

**The change.**
- `lib/tc/mail-rules.ts`: `MailFacts.draft`; rule −1 decides a draft `not_deal`
  ("an unsent draft (Gmail label DRAFT): it reached no one") before every other
  rule, the thread anchor included.
- `lib/tc/mail-index.ts`: the facts carry `isUnsentDraft(labelIds)`; a draft stops
  after pass 1, before its PDFs are read or the model stage sees it.
- `lib/crm/gmail-drafts.ts` (`withoutDrafts`, `isUnsentDraft`): the 15-minute sync
  (CRM timeline and Vault), `sweepQuery` (the daily sweep's deal and transaction
  queries), the party and offer harvest (`lib/tc/mailbox-harvest-run.ts`) and the
  backfill walk list with `-in:drafts` (checked live: 20 of 20 sampled drafts
  listed without it, 0 with it). The sync also skips a DRAFT-labeled message if
  one is listed anyway. The one-time full-history review walk keeps listing
  drafts so its coverage still counts every message; the rule records each.
- `lib/crm/gmail-drafts.test.ts` fails if any of those walks lists without the
  filter (4 of 6 fail with the change reverted).

**Golden set.** 23 rows labeled `file` are current drafts (in `users.drafts.list`
on 2026-10-01); relabeled `not_filed`, `confidence: "verified"`, dated note. Six
more drafts were already `not_filed`. Golden eval, the same corrected labels,
one run at a time (an earlier pair run beside other Gmail readers hit the
per-user quota and is discarded):

| Run | Filed right | Wrong file | Filed, should not be | Safe queue | Missed | Correctly not filed | Precision | Recall |
|---|---|---|---|---|---|---|---|---|
| v4.1 | 1,067 | 0 | 23 | 19 | 7 | 376 | 97.9% | 97.9% |
| v4.2 | 1,067 | 0 | 4 | 19 | 7 | 395 | 99.6% | 97.9% |

Row by row against the v4.1 run: 19 better (each a draft, FALSE_FILE to TN),
0 worse, 1,503 unchanged; 0 errors either run.

**CRM timeline repair** (`scripts/crm-timeline-mail-repair.ts`, first dry run
2026-10-02 00:16Z, drafts only): of 13,918 Gmail email rows, 13,710 are messages that exist and are not
drafts, **143 are drafts (65 people)**, 0 were written from an autosave the send
replaced, and 65 point at a message gone from Gmail with nothing of its
Message-ID left in its thread (a discarded draft, or mail deleted for good: not
provable either way, so left alone). The conversation model holds a copy of
124 of the 143: the July 2026 backfill (migration `20260716210000`) copied the
timeline into `crm_message`, so those drafts also sit in the CRM inbox as sent
email, in 55 conversations. `--apply` deletes each draft's copy with its
timeline row (none is replied to; a copy that is stays, with its row), deletes a
conversation left with no message (0 of the 55; read with paging, since a
1,000-row read had counted 39), and recomputes the 55 conversations' rollups
the way `recompute_conversation_rollups()` does
(`lib/crm/conversation-rollups.ts`, tested), without touching any other
conversation. Every row it changes or removes is written whole to
`tmp/crm-timeline-mail-repair/<run>/before.json` first.

### Copied on an email: `email_cc` (Matt 2026-10-02)

The CRM sync wrote every CRM person on an email's To or Cc as `email_out`,
whoever sent it. Of the latest 400 Gmail `email_out` rows on 2026-10-01, 174
were outside senders' mail copying 10 clients (Western Title 52, First American
35, Bridgetown 26), and every one counted as a broker touching that client
(`isHumanTouch`, speed-to-lead, contact attempts, the first-broker-action stamp).
Asked whether to leave them off the timeline or show them as their own entry,
Matt chose **"Copied on an email"**.

- `lib/crm/gmail-timeline-kind.ts`: `email_in` when the person sent it;
  `email_out` only when one of our brokers did (the mailbox holds it as SENT, or
  its From is ours by `isHouseAddress`: our domains and Matt's own Gmail alias);
  otherwise `email_cc`, with the sender in `payload.from`.
- Migration `20261002011238_crm_timeline_email_cc_kind` adds `email_cc` to
  `crm_timeline_kind_check` (applied 2026-10-02 before the code, so the sync's
  batch never meets the old constraint; the live definition matched
  `20260713140100` before it).
- `email_cc` is on the contact's activity feed ("Copied on an email"), the
  person page's Emails tab with a "Copied on" chip, and the global activity
  feed's email filter. It is in no human-touch, conversation, inbox, deal
  conversation or broker-activity report kind list.
- `scripts/crm-timeline-mail-repair.ts` recasts the existing rows: an
  `email_out` row whose message is not SENT in its mailbox and not From us
  becomes `email_cc`, its `crm_message` copy (the July backfill's "our outbound
  email") leaves the conversation model, and a first-broker-action stamp taken
  from it, or from a draft, is recomputed from the rows left through
  `isHumanTouch` (cleared when none is left). A journey stage that stamp
  advanced is not moved back.

### v4.2 and copied-on mail applied to production (2026-10-02)

PR #419 merged `3333337302` and deployed (`dpl_7UZHk8b5GK28zN8c4ng5TFaS6dSo`,
deploy:verify clean) before either repair, so no old code wrote behind them.
Run one Gmail job at a time.

**Re-decide under v4.2** (`redecide --apply`, 02:11Z to 04:09Z, 73,683 rows,
one piece, COMPLETE, 0 errors), the same as its dry run: 140 messages unfiled
(139 drafts), 7 dequeued, 7 relabeled (all drafts), 1 filed (`19a7e8a7fddeec36`
on 2354 NW Drouillard, its hand label), 72,982 unchanged, 46 kept for a person,
42 protected, 5 gone. Documents: 3 archived (restorable), 31 kept (another
email or a person uses them), 0 offers touched, 0 moves; one message's leftover
documents (2) stayed on its deal, kept, none archived.

**Five drafts the re-decide could not reach.** The model stage had decided
them, and the re-decide never overrides a model or person decision: three
filed (`1935aacbac642705` "2129 Seller Counter" and `19379a5c18ead6e6`
"Property disclosures" on 2129 35th Street, Redmond; `197fbcbc7df35fe6` "Re:
FW: 3235 Closing" on 3235 NW Cedar Ave) and two queued (`193d2967cbaa1ffd`,
`1975675d9618f041`). Gmail still labeled each DRAFT on 2026-10-02. Corrected
through `unfileMailFromDeal` and the queue's dismiss path, actor
`system:mail-v4.2-drafts` (one document archived, restorable). v4.2 stops a
draft before the model stage, so the class cannot recur.

**After:** of the 152 Vault rows that were drafts on 2026-10-01, 0 are filed or
queued; every one is dismissed.

**CRM repair** (`scripts/crm-timeline-mail-repair.ts --apply`, 04:17Z, the
same as its dry run): 143 draft rows deleted, 1,748 copied-on rows recast to
`email_cc` (112 people), 1,629 conversation copies removed (none replied to),
16 conversations deleted (their only messages were drafts or copied-on mail),
103 recomputed, 65 rows gone from Gmail left alone. Three first-broker-action
stamps had come from these rows; none of those people has a human touch left,
so the stamps were cleared. Before-image:
`tmp/crm-timeline-mail-repair/apply-2026-10-02T04-17-47-404Z/before.json`.
**After:** 0 timeline rows point at a current draft; 1,748 `email_cc` rows.
No Gmail mail had matched a CRM person between the deploy and 04:20Z, so the
sync's live `email_cc` write was not yet observed in production (the kind
logic is tested; the constraint accepts it).
