# Vault mail filing rules

How the Vault decides which transaction file an email belongs to. Brokers never
file email by hand. The system reads every broker mailbox through the Google
Workspace service account, decides each email with the rules below, files it and
its documents, records offers, and only asks a person when it truly cannot tell.

- Rules (code): [`lib/tc/mail-rules.ts`](../lib/tc/mail-rules.ts), version `mail-rules-v3-2026-09-24`
- Enforcement: [`lib/tc/mail-rules.test.ts`](../lib/tc/mail-rules.test.ts). Every rule below has a
  test, and every misfile found in the 2026-09-23 audit is a regression case.
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
| 0 | **Noise never files.** List mail (List-Unsubscribe, Precedence: bulk), auto-replies, listing alerts ("16 new listings for…", "Copy: Subscription…"), our own pipeline alerts ("[Expired]…", "[Deploy]…"), and digests naming three or more street addresses. | nothing | One exception: bulk mail carrying exactly one deal's escrow number (title's automated notices) files by rule 1. |
| 1 | **Escrow or MLS number** of exactly one file, anywhere in the subject, body, attachment names or attachment text. | that file, any stage | Escrow numbers need 6+ characters with 4+ digits; MLS numbers never match inside a longer number. Two files → queue. |
| 2 | **Same thread** as email already filed (RFC References root, or the Gmail thread). | the thread's file | Unless this email names a different file's address: the property wins. |
| 3 | **Street address**: house number + street name ("909 NW Delaware" or "909 Delaware"). Then the street alone ("SW 45th", "Beaumont Drive"), but only in the subject or attachment names, and only for transaction mail, an e-sign notice, or mail from someone on one of our files. | that file, any stage | Directionals match spelled out or short ("3480 Southwest 45th" is 3480 SW 45th). The city breaks a tie between same-numbered streets; the property in the subject beats one quoted in a forwarded chain. Still tied → queue. |
| 3b | **Our own transaction mail naming one file by its street alone** ("[Ordway forward] OREF 022A Buyers Repair Addendum 2"): a broker wrote it, it carries a transaction form or reads as one, and its subject or a file name calls exactly one file by its bare street name. | that file, any stage | The bare name is the street without number or suffix ("Nordic", "School House"). Numbered streets ("45th") and common words (Main, Park, Old, School…) never count alone. |
| 4 | **Who it touched**, only when the content names no property: our client (buyer/seller on the file) or a file contact (title, escrow, lender, other agent, TC firm) on exactly **one open** file. When they are on several, step two: the file the subject or a file name calls by its bare street ("Home Warranty - Nordic", "Work on Beaumont"). | that file | Open = live, or closed/dead within 120 days of close. A subject naming a property that is not on the candidate file never files by sender. Still several: transaction mail or mail with attachments → the model picks among those files (below), else queue; anything else → not deal mail. |
| 5 | **Transaction mail for a property with no file** (offer, counter, escrow, title, inspection, disclosure, closing, or an e-sign completion, with a transaction form attached or a property in the subject). | the mail queue, grouped by property | The daily sweep opens a file when the group proves a deal is under way (escrow opened, settlement statement, closing notice, fully executed agreement). Offers alone never open a file. |

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
Everything else goes to the cycle whose window holds the send date (listing or
acceptance, 45 days before, through close + 120 days), a live sale cycle ahead of
a cancelled one. After close, closing mail (recorded deed, final statement) and
general mail are labeled "After closing"; a forwarded "Open Escrow" keeps its own
label.

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
  stage `model` is not asked again). Off by default elsewhere (`indexGmailMessage({ modelStage:
  true })` / `review-all --model-stage` / `reviewMailbox({ modelStage: true
  })`): real Grok spend, so a caller — a person or a script run — opts in
  deliberately. Tests and dry runs never call it.
- **Coverage**: `lib/data/tc/mail-coverage.ts` `getMailCoverage()` reads
  Gmail's own `messagesTotal` per mailbox (live `users.getProfile`) against
  `tc_mail_reviews` counts and `tc_mail_review_cursors.finished_at`, shown on
  `/admin/closings` (superuser) as "Every message reviewed": per mailbox,
  Gmail total, reviewed, coverage %, the status breakdown, last reviewed,
  and whether the full-history walk has finished.

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
