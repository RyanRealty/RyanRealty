# Vault mail filing rules

How the Vault decides which transaction file an email belongs to. Brokers never
file email by hand. The system reads every broker mailbox through the Google
Workspace service account, decides each email with the rules below, files it and
its documents, records offers, and only asks a person when it truly cannot tell.

- Rules (code): [`lib/tc/mail-rules.ts`](../lib/tc/mail-rules.ts), version `mail-rules-v4-2026-09-24`
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
| 0 | **Noise never files.** List mail (List-Unsubscribe, Precedence: bulk), auto-replies, listing alerts ("16 new listings for…", "Copy: Subscription…"), system notices ("[Expired]…", "[Deploy]…", Google's "[Notice]…"), a CRM's reminder list ("Daily Birthday Reminder" names a client and her address), **our own machines** (anything from `mail.ryan-realty.com`: lead notices, CMAs, alerts, newsletters, the Vault's own signing emails; anything from `resend.dev`: the Studio's drafts), and **digests**: three or more street addresses listed as content. | nothing | A subject naming exactly one of our files by full address, MLS or escrow number is never a digest (a street alone is not enough: "Follow-Up: Bluff Dr. Units + New Options" was a buyer's tour of five properties), and letterhead addresses (a suite after them, or on their own line beside a phone or email) never count toward the three. Bulk mail carrying exactly one file's escrow number files by rule 1; bulk mail whose subject names exactly one file by full address or MLS number goes on to rules 1 to 5, which still refuse a stranger's pitch. Our own machines and system notices are never lifted. |
| 1 | **Escrow or MLS number** of exactly one file, anywhere in the subject, body, attachment names or attachment text. | that file, any stage | Escrow numbers need 6+ characters with 4+ digits; MLS numbers never match inside a longer number. A number in the subject outweighs one in the body. **A comparables report** (CMA, BPO, appraisal: by file name or its first page) contributes only the property it is about, never its comps' numbers or addresses. Two files → queue. |
| 1b | **Our clients on two open files** (selling one home, buying the next), and the email names no property: the people on it, and the thread it sits in, cannot pick. Only what the email says can: the street it calls one of those files by, in the subject, a file name or the words its sender wrote ("are you back in your Drouillard home"), or the subdivision in the subject or a file name, or a numbered street with its suffix ("7th Street Inspection" among one investor's four files); else someone the email talks about, not someone on it, who is on only one of those files (the purchase's lender, named in the body); else the side it is on ("the <client> purchase", "buying", "the down payment", "our loan", "a jumbo loan amount" → the file where we represent the buyers; "selling", "showings", "open house", "listing" → the file we list; "sold" is neither, "CC Mortgage sold our loan"). | that file | Clients = parties on the file by email, by the name beside their address, or named first-and-last in what the sender wrote ("Mutual Clients \| Pat Client / Lee Client"). A file counts while it could be open: open by its dates, or it has a cycle with no dates (SkySlope's listing record often has none) and the email falls in the year before its first contract. Names both, or neither, and no side (or both sides) → queue. Runs only when the thread, if any, sits on one of those files. |
| 2 | **Same thread** as email already filed (RFC References root, or the Gmail thread). | the thread's file | Unless this email names a different file (address, street, escrow or MLS number): the property wins. If it does not name the thread's own file too, that file is not even a candidate on the thread's word (Supra reuses one thread per sender); if it names both, the thread breaks the tie. |
| 3 | **Street address**: house number + street name ("909 NW Delaware" or "909 Delaware"). Then the street alone ("SW 45th", "Beaumont Drive"), a SkySlope file address ("BeaumontDrive2070260b4@skyslope.com"), or the subject's street with a house number one keystroke off ("2731 Ordway" for 2732 Ordway Ave), but only in the subject, attachment names or recipients, and only for transaction mail, an e-sign notice, or mail from someone on one of our files. | that file, any stage | Directionals match spelled out or short ("3480 Southwest 45th" is 3480 SW 45th); two-word names match with or without the space ("Schoolhouse" is School House), and keep both words after a directional ("NW Newport Ave" is not 1974 NW Newport Hills Dr). A file name reads with its underscores as spaces ("Ryan Realty_20702 Beaumont Dr, Bend.pdf" names 20702 Beaumont Dr). The city breaks a tie between same-numbered streets; the property in the subject beats one quoted in a forwarded chain, and when the email names several of our files the one its subject names is the one it is about ("Envelope completed: Nordic Ave Offer Letter" carries an offer letter naming the buyers' own home on another of our files). Two files named alike → queue, whoever wrote it ("proofs attached for the two installs"). Still tied → queue. **A full address alone does not make ordinary mail deal mail**: it files when someone on that file is on it (by email or by name), when a title company, e-sign platform, showing, MLS or listing-report system (Supra, ShowingTime, Flexmls, ListTrac) sent it, when it reads as a transaction, when it is the deal's people talking ("my clients", "the sellers", a showing, the yard sign being down or installed) or the property's records (invoices, service history, permits, septic and well reports, an income property's cash flow or rent roll, read from the subject, the words the sender wrote and the attached files' names, spreadsheets included), or when a broker filed it by hand ("[Deal: …]"). A stranger's other mail (a vendor's pitch, a magazine's ad sales) is not deal mail. **Our own mail** naming the address files, to whomever it went (the title officer at a mistyped address, the owner's CMA, the media company), unless what the broker wrote reads as marketing: "just listed", "new listing", "coming soon", "neighbors", "considering selling", "call today", "price reduced", "back on market", an unsubscribe line. Quoted replies and forwarded mail never count toward that, and a tracked link says nothing (Matt's signature tracks every link). |
| 3b | **Our own mail naming one file by its street alone or its subdivision** ("[Ordway forward] OREF 022A Buyers Repair Addendum 2", "Re: More Clarification on Nordic PA"): a broker wrote it (or an e-sign platform sent it as the broker), and either it carries a transaction form or reads as one, or it went only between our own brokers; and its subject or a file name calls exactly one file by its bare street name or its MLS subdivision. | that file, any stage | The bare name is the street without number or suffix ("Nordic", "School House"). Numbered streets ("45th") and common words (Main, Park, Old, School, Test…) never count alone; between brokers with no transaction words the name needs six letters or two words ("Bluff" does not). A subdivision counts only when exactly one file open on the send date carries it, and never a placeholder ("N/A"), a city, or one ordinary word ("Railroad"). |
| 4 | **Who it touched**, only when the content names no property: our client (buyer/seller on the file) or a file contact (title, escrow, lender, other agent, TC firm) on exactly **one open** file, by email, or by the display name beside their address when the file knows them only by name (SkySlope imports other agents with no email). When they are on several: step two, the file the subject or a file name calls by its bare street or subdivision ("Home Warranty - Nordic", "Valhalla Heights - HOA docs"); step three, on transaction mail or when that person wrote it, the one file a person on the email is on and the others are not; a company counts as one person here (Western Title's escrow assistant on one file writes for the escrow officer on sixteen), a free mailbox (Gmail, Yahoo, Outlook, iCloud…) as its owner. | that file | Open = live, or closed/dead within 120 days of close. A name needs first and last name, never a first name alone, never our own brokers' names, never a no-reply sender's display name; one person is one person however each file knows them. A subject naming a property that is not on the candidate file never files by sender, except the file's own house number followed by a word that is no street ("19496 Septic Invoice") or its street with a mistyped number ("2372 NW Ordway"). A no-reply sender's recipients are never evidence on ordinary mail, except an e-sign platform's: SkySlope's "Paul Stevenson shared some documents with you." goes from its no-reply to our client, and that client is the file. Still several: transaction mail or mail with attachments → the model picks among those files (below), else queue; anything else → not deal mail. |
| 5 | **Transaction mail for a property with no file** (offer, counter, escrow, title, inspection, disclosure, closing, or an e-sign completion, with a transaction form attached or a property in the subject), and a broker's own "[Deal: 1405 NW Newport Ave] …" for a property with no file. | the mail queue, grouped by property | The daily sweep opens a file when the group proves a deal is under way (escrow opened, settlement statement, closing notice, fully executed agreement). Offers alone never open a file. |

### What the email is about (category)

The subject and the attachment names decide first, in this order: auto-reply;
our own machines and system notices; a fully executed sale agreement; an e-sign
platform's subject ("Envelope completed", "Documents to sign", DocuSign,
Dotloop, Authentisign, DigiSign), before the listing-alert words, because an
OREF form name can read like an alert ("Envelope completed: Appraisal Price
Change"); a listing alert, never when a transaction form is attached; counter;
offer (a sale agreement itself, never an "Addendum to Sale Agreement"); addendum,
amendment or termination; closing; disclosure (including HOA documents, CC&Rs, a
reserve study, but never Oregon's Initial Agency Disclosure Pamphlet, which every
broker hands every buyer before there is a property); inspection (including its
kinds: a septic evaluation or ESER, radon, sewer scope, WDO/pest, mold); escrow and
title (including title's own file numbers, Western Title's "WT0278291" and
Deschutes Title's "\| DE22058", and an "EM receipt"); lender.

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
- **Test aliases** `admin@ryan-realty.com` (Vault Test Buyer) and
  `marketing@ryan-realty.com` (Marketing Test Lead) are outside parties, not the
  house, so the test files behave like real ones, but only on mail the alias
  harness wrote (subject tagged `[TC TEST <run>]`). The same mailboxes get
  Google Workspace notices, sign-in codes and CRM test sends; untagged, they are
  never evidence. Plus-addressing folds to the base mailbox (`admin+x@` is
  `admin@`).

### Which cycle on the file

Offers and counters go to the listing cycle (the offer log lives there).
Everything else goes by what the message itself says first, then by date:

1. The escrow or MLS number it names, when that number tells the cycles apart;
   another escrow number of the same shape ("WT" and seven digits) counts
   against a cycle that has a different one.
2. A buyer or seller on only one cycle's contract (`tc_cycles.buyers` /
   `sellers`), by full name, or weakly by last name.
3. A termination or release goes to the contract it ends: a cancelled cycle
   whose window holds the date, never a closed cycle, and never to the listing
   cycle on the strength of an offer word (the offer shortcut above is skipped).
4. The cycle whose contract was live on the send date (acceptance through close
   or cancellation), then the cycle whose window holds the date (listing or
   acceptance, 45 days before, through close + 120 days), a live sale cycle
   ahead of a cancelled one.

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
