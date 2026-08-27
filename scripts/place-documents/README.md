# Place documents — the CC&R pipeline

Hosted copies of recorded governing documents (CC&Rs, amendments, bylaws, design
guidelines) attached to subdivision pages. Governed by
[`PLACE_CONTENT_RULES.md`](../../docs/plans/MARKET_TRUTH/PLACE_CONTENT_RULES.md) R7.

## The source, and the thing to know about it

`https://deschutescountytitle.com/ccrs` — public, unauthenticated, 3,787 documents
across 971 distinct subdivision names, each row carrying its book-and-page or
year-instrument reference. 645 names carry an enumerated amendment chain, which is
the thing the county recorder cannot give you: ORS 205.160 indexes party name,
document type, date and instrument number, with no subdivision field and no
cross-reference from an amendment to what it amends.

**It is a title-plant research bucket, not a curated governing-document set.** It
files everything recorded that touches a plat. Measured over the 2,189 ingested
documents:

- the `Larch Meadows` bucket holds a warranty deed
- `Indian Ford Meadows` holds Crooked Horseshoe Homeowner's Association
  declarations, a water-system sale agreement, an easement and a contract assignment
- `Awbrey Court` holds declarations titled VALHALLA HEIGHTS PHASE IV
- corpus-wide: 118 easements, 41 deeds, 40 liens, 16 trust deeds, 12 assignments

Publishing the bucket verbatim would put another subdivision's declaration, and a
warranty deed, in front of a buyer as this plat's governing documents. Everything
below exists to stop that.

## Pipeline

Run in order. Every step is idempotent, so the whole thing is safe to re-run —
and it **must** be re-run when `boundaries` grows. Five plats were added on
2026-08-26 after the first pass, and Sunrise Village alone had 29 documents
sitting in the index that nothing had fetched.

```
node scripts/place-documents/fetch-index.mjs
node --env-file=.env.local scripts/place-documents/match-plats.mjs
node --env-file=.env.local scripts/place-documents/download.mjs
node --env-file=.env.local scripts/place-documents/ingest.mjs
swiftc -O -o scripts/place-documents/ocr scripts/place-documents/ocr.swift
node --env-file=.env.local scripts/place-documents/ocr.mjs
node --env-file=.env.local scripts/place-documents/classify.mjs
node --env-file=.env.local scripts/place-documents/foreign-association.mjs --apply
node --env-file=.env.local scripts/place-documents/regate.mjs
node --env-file=.env.local scripts/place-documents/two-signal-publish.mjs --apply
node --env-file=.env.local scripts/place-documents/book-page-stamp-publish.mjs --apply
node --env-file=.env.local scripts/place-documents/deep-stamp-publish.mjs --apply
node --env-file=.env.local scripts/place-documents/phase-governance.mjs --apply
node --env-file=.env.local scripts/place-documents/foreign-plat.mjs --apply
node --env-file=.env.local scripts/place-documents/backfill-geo-label.mjs
npm run ci:place-documents
```

| Step | What it does |
|---|---|
| `fetch-index` | Parse the index into rows: name, recording reference, PDF URL |
| `match-plats` | Match `boundaries` plats to published names. `exact` = name equality. `parent` = a phase-level plat resolved to its declaration-level entry. An ambiguous parent is REJECTED — a guess is not a match |
| `download` | Fetch only documents not already hosted, so a re-run does not re-request thousands of files from a small title company's host. **Checks `%PDF-` magic bytes** — the source serves 404s as HTTP 200 with `Content-Type: application/pdf` |
| `ingest` | Upload to the bucket, insert `place_document`, write links as `pending_review`. Reuses an existing row on a sha collision, because one instrument can legitimately serve two plats |
| `ocr` | On-device Apple Vision OCR of the front matter, for rows with none yet. Free, nothing leaves the machine |
| `classify` | `doc_kind` and `name_confirmed` from the document's own front matter. **Skips rows with no OCR** rather than calling them `other` — an unreadable document is evidence of nothing, and defaulting them silently unpublished six Caldera governing documents once |
| `foreign-association` | Flags a document whose front matter names only associations foreign to the plat. This is what caught Crooked Horseshoe on Indian Ford Meadows |
| `regate` | Applies the publish policy both ways: demotes anything that now fails, promotes exact matches whose document names the plat |
| `two-signal-publish` | Clears parent matches carrying two independent confirmations |
| `book-page-stamp-publish` | The same bar for the book-page era, where no instrument number exists: the recorder's volume-and-page stamp running across consecutive pages of the document itself |
| `deep-stamp-publish` | The same bar again, read deeper. `ocr.mjs` stores two pages; a stamp run needs a stamp on two consecutive ones, so a document whose first page is a cover sheet or an unreadable scan had its run out of reach. Reads twelve pages from the hosted PDF and applies the rule `book-page-stamp-publish` owns — literally, by evaluating it out of that file |
| `phase-governance` | The per-chain ruling on parent matches whose document names a different phase than the plat. Every stamp signal proves identity, not governance. **Must run after all three publish scripts** — they select on `pending_review` + `parent` and would re-publish what this demotes |
| `foreign-plat` | The per-document ruling on a published instrument that is a genuine governing document for a DIFFERENT subdivision. Runs last, for the same reason `phase-governance` runs late: `regate` re-promotes exact matches and the publish scripts re-promote parent matches |
| `backfill-geo-label` | Stamps each link with its plat's `boundaries.geo_label`, so a listing page can match the label its own row carries instead of re-deriving the slug — see below |
| `verify` | `ci:place-documents`. Asserts no published link is a non-governing instrument, unconfirmed-and-unreviewed, or unreachable from a listing page |

## Why the link row carries the plat's label

`listings.boundary_subdivision` holds `boundaries.geo_label` verbatim —
`refresh_listing_boundary_tags` copies the label and throws the slug away. The
listing page therefore used to re-derive the slug by running lib/slug.ts
`slugify()` over that label, and `slugify()` is not the function that minted
`geo_slug`. Measured 2026-08-26 over all 3,218 `geo_type='subdivision'` rows, it
fails to reproduce the slug on **202** of them:

- **187 punctuation.** `geo_slug` turns `&` into `and` and every other
  non-alphanumeric run into a hyphen; `slugify()` deletes them.
  `Redmond Vacation Alley Blocks 1 & 20` is
  `redmond-vacation-alley-blocks-1-and-20`, slugify says
  `redmond-vacation-alley-blocks-1-20`. 98 listing rows across 53 labels sit on
  one of these plats.
- **15 duplicated labels.** The county files more than one plat under one name,
  so all but one carry a numeric suffix: `Bend` is `bend`, `bend-05281` **and**
  `bend-16913`. In every one of the 13 duplicated groups a row holds the bare
  slug, so those 15 plats resolved onto a real, DIFFERENT recorded plat — not,
  as the old comment claimed, onto nothing.

Only `Evergreen Park` among the 15 has a published document today, and its
collision target is linked to the same instrument, so nothing wrong ever reached
a page. That is the corpus, not the code. `geo_label` removes the derivation.

## What decides whether a document publishes

The database trigger `place_document_link_publish_gate()` is the authority. Two
conditions, deliberately asymmetric:

- **`doc_kind` must be a governing instrument** — always, with no human override.
  A warranty deed is not this subdivision's CC&Rs no matter who says so.
- **the document's own text must name the subdivision** (`name_confirmed`) —
  unless a human has reviewed the link. OCR reads the first pages only, so a
  one-page amendment may legitimately never restate the plat name, and a reviewer
  who has opened the PDF knows more than the OCR does.

Three signals feed `name_confirmed`, in increasing order of strength:

1. **Token scan** — do the plat's distinctive words appear in the front matter?
   Fuzzy to one substitution, because OCR of microfilm mangles characters.
2. **Stamped instrument number** — the county's recording stamp carries the
   instrument number. When it matches the index's reference, the document is
   definitively the one the index claims. Applies to 1,036 year-instrument
   documents; 887 match.
3. **Foreign-association check** — find `<NAME> OWNERS ASSOCIATION` in the front
   matter. If every association named is foreign to the plat, the document belongs
   to someone else. This is what caught Crooked Horseshoe on Indian Ford Meadows.
   Deliberately narrow: high precision, low recall, because a false flag only
   sends a real CC&R to review while a false pass puts a wrong CC&R on a page.

The clerk's own stamped type code (`D-CCR`, `D-BYLAWS`) outranks any inference
drawn from title text and is tried first when classifying.

## The book-page era's identity mark

Signal 2 above is a year-instrument number, and the book-page era has none — so
1,358 governing, name-confirmed parent links had no second signal available to
them, which was most of the review queue. They have their own mark, and it is
stronger than an instrument number: the recorder stamped the volume and page on
**every page**, and the page number increments. `book-page-stamp-publish.mjs`
requires the index's book and page on one OCR'd page and the same book with the
next page on the page after it — Chuckanut Estates 276-28 reads `VOL 276 PACE
28` then `VOL 276 PACE: 29`.

The increment is the whole point. A declaration is full of book-and-page
references to other instruments ("recorded in Volume 235, Page 835"), so a
single reference proves nothing about which document you are holding. Only the
recorder's own header walks forward one page at a time. Measured over the 1,159
book-page documents with OCR: 0 fires in 3,476,975 (document, synthetic
reference) pairs, and 7 fires in 1,289,967 (document, every other real
reference) pairs — all seven a stamp the document physically carries, from a
re-recording that bears two stamp sequences or an adjacent-page instrument.
Never once did the matcher invent a stamp that is not on the page.

A fuzzy book number was tried, to recover OCR manglings like `BOOK 3222 PAGE
190` for 322-190. It recovers 26 documents and produces 38 cross-subdivision
false fires — 233-710 "Meadow Village" answering to 293-710 "West Ridge" and 37
more of that shape. The book number is matched exactly and the manglings go to a
human.

**The stamp proves identity, not governance**, so this script also holds a link
whose document names a different phase than the plat: a declaration titled
ROCKWOOD ESTATES PHASE IV does not publish onto `rockwood-estates-phase-ii`.
`two-signal-publish.mjs` does not make that check, and 99 links it published sat
on a plat whose phase their own document contradicts.

## Two pages was the limit, not the rule

`ocr.mjs` reads two pages, because two pages is what `classify.mjs` needs — title,
recording stamp, subdivision name. But a stamp RUN needs a stamp on page k and on
page k+1, and two OCR'd pages offer exactly one pair to test. A document whose
first page is a return-address cover, an exhibit or an unreadable scan had its run
one page out of reach. `deep-stamp-publish.mjs` reads twelve pages from the hosted
PDF and applies the same rule, unchanged.

**Twelve is measured.** Over the 195 held book-page documents:

| OCR depth | documents whose stamp run is found |
|---:|---:|
| 2 (what is stored) | 40 |
| 3 | 59 |
| 4 | 66 |
| 6 | 75 |
| 12 | **79** |
| 20, 40 | 79 |

Recall plateaus at twelve, and every extra page is extra surface for a
coincidence, so the depth is not set higher "to be safe".

**It clears 86 links across 72 plats and 35 documents** — 39 documents gain the
run and the phase guard holds every link on four of them. Isolated against the
same database state, the queue drops from 200 groups carrying a governing
instrument to 194, and from 282 groups to 279.

**Adversarially tested exactly as the book-page signal was**, over all 1,159
book-page documents, at the shipped depth:

| | stored 2-page read | 12-page read |
|---|---:|---:|
| A — against every OTHER real reference (1,288,808 pairs) | 7 fires | 10 fires |
| of those, filed under a different published name | 1 | 1 |
| B — against 3,000 synthetic references (3,477,000 pairs) | 0 fires | 1 fire |

The stored-read column reproduces the number this README already documents, which
is what says the harness is measuring the shipped bar. Every one of the 10 real
fires is a stamp the document physically carries: five re-recordings bearing two
stamp sequences (Tollgate 184-253 also carries 183-557/558; Providence 299-2860
also carries 268-2081/2082; Justin Glen, Indian Ford Meadows and Tyrion Sky the
same), three whose scan starts a page before the index reference, and two whose
index reference is malformed — `436-00010000`, `187-7130000` — so their real stamp
answers to the reference the index should have carried. The single synthetic fire
is Woodriver Village, filed at 339-477, whose pages are stamped 330-0478 and
330-0479: the transposed digit is in the INDEX, and the document's own reference
does not fire, so it stays in review. **Not one fire is a stamp the matcher
invented.**

All 39 clearances were read against their OCR by hand.

**What was rejected, with the measurement.**

- **Extending the year-instrument check over the deeper text.** Two documents gain
  it and neither is a depth gain — both stamps are on page 1 and the stored read
  misread them (2001-34487 reads "2001-3487"). An instrument number is a string a
  declaration RECITES: measured against every other real instrument number, the
  check answers to a number that is not its own 35 times on the stored text and 34
  on twelve pages. Depth buys nothing and the recital exposure is real.
- **Relaxing the anchor** to accept a run in the right book at any page, for scans
  that start late. Of the 155 held documents with no strict run, 6 carry a
  same-book run elsewhere; the offsets are -2 and five beyond ±5. They are other
  instruments in the same volume. One recovered, five wrong ones admitted.
- **Storing the deeper text in `ocr_text`.** It would silently change what
  `name_confirmed` and `doc_kind` MEAN, because `classify.mjs` scans the whole
  column for the plat name and falls back to testing every governing pattern over
  the whole column. Measured on the 290 held documents, `doc_kind` changes on 4
  from depth alone — and those are documents already confirmed, so the exposure on
  the 408 pending links that are NOT name-confirmed is larger and untested. The
  deeper read stays inside the one script that uses it.
- **The clerk's type code and receipt/serial digits.** `D-CCR` is already the
  authority `classify.mjs` uses. The long digit run —
  `00233576200400005840840043` — decodes as an 8-digit clerk serial, the year, the
  7-digit instrument number, a trailing counter. The instrument number inside it is
  the stamp already checked; nothing else in it can be cross-checked, because the
  index publishes name, recording reference and a PDF link and **nothing else**. A
  serial with nothing to compare it against is not a confirmation. The same kills
  **recording date plus declarant name**: the index carries neither field.
- **Chain adjacency** — a held document whose index reference is one page after a
  confirmed document's last page. That is a statement about two INDEX rows. Identity
  is a claim about the PDF in front of you.

**There is one definition of the rule.** `deep-stamp-publish.mjs` does not copy
`stampRun` or the phase guard; it evaluates them out of `book-page-stamp-publish.mjs`
and refuses to run if it cannot find them. There is no second copy to drift, and no
way for the deeper read to be applying a laxer bar than the one that shipped.

## Identity is not governance

`phase-governance.mjs` rules on those 263 links — 99 published, 164 held here —
one declaration chain at a time, by reading the documents. A Phase 1 declaration
is often the master, with later phases brought in by an annexation or a
supplemental declaration; then the fan-out is right. A phase-specific
declaration with no expansion mechanism does not reach its siblings. Both
patterns sit inside this corpus, so no blanket rule works.

A plat may only be published on a line that is verbatim in the cited
instrument's stored `ocr_text`; the script re-checks that on every run and
refuses to publish a ruling it cannot show. A hold needs no evidence — it goes
to a human. Three rulings quote a page rendered at higher scale instead, because
Vision reads Plat III as Plat II and would have demoted three links off the plat
they actually govern.

The RULINGS table in that file is the evidence ledger: per document, the plats it
binds, the line that says so, and the instrument the line comes from. The rule it
implements is R7 in
[`PLACE_CONTENT_RULES.md`](../../docs/plans/MARKET_TRUTH/PLACE_CONTENT_RULES.md).

## A real CC&R for the wrong subdivision

`foreign-association.mjs` reads the front matter and flags a document whose named
associations are all foreign to the plat. `foreign-plat.mjs` is the wider version
of the same failure, and it is the one the bucket produces most: not a lookalike,
not a misfiled deed, but somebody else's real declaration published as this
plat's governing document. Six Holliday Park, Third Addition instruments sat on
all five `hillside-park` phases. A declaration titled GLACIER RIDGE sat on
`gemstone-estates`. The Sunset View Estates Phase II annexation sat on
`sunset-west` six times over, because the source served the same PDF for six
different index rows.

**No pattern finds these without destroying more than it saves.** The obvious
check — flag a document whose title names a different subdivision — was written
and measured, and three of its first four flags were CORRECT documents: a plat's
PRIOR RECORDED NAME (`Southwest Pines` under QUAIL PINE ESTATES PHASE XI), a
MASTER (`Northside Terrace` under RIVER BEND), and a SHARED WELL regulating named
lots (`Tres Jolie` under ANDERSON ACRES). Recorded instruments name other
subdivisions constantly and legitimately, and every false flag takes a real CC&R
off a buyer's page.

So the method is reading. Three differently-shaped screens over all 4,376
published links and the 1,550 distinct documents behind them — does the plat's
name occur at all; whose name sits in the TITLE position; what type did the clerk
stamp — produced 132 documents, and all 132 were OCR'd end to end from the hosted
PDF (1,836 pages, about eight minutes on-device) rather than from the two pages
`ocr_text` holds. 31 demote, off 130 links across 95 plats. The rest are in that
file's CLEARED table with the reason, which is the more useful half: `Ponderosa
Pines` reads "Ponderous Pines" in the microfilm, `Blakley South` is spelled
"BLAKELY SOUTH" by its own drafter, the WHISPER RIDGE declaration on Golf
Townhomes at Broken Top carries an exhibit headed "Golf Tracts at Broken Top,
Phase 3", and the SKYSTONE ESTATES bylaws on North Mountain View Estates certify
adoption "by the owners of Lots in NMV Estates Subdivision".

**Its asymmetry is the mirror of `phase-governance`'s.** That script publishes, so
its publishes carry the burden of proof. This one only demotes, so its DEMOTIONS
do: a plat comes off only on a line verbatim in the cited instrument's text, and
the check re-runs on every invocation against text re-derived from the hosted PDF
— never from the ledger file. One ruling quotes a sibling instrument, because
118-455's own title is illegible even rendered at 7x and its amendment names it
by book and page. A keep needs nothing.

Where it stops: a neighbourhood's documents inside a master-planned community
(Lewis and Clark Townhomes and Fremont Place across 21 NorthWest Crossing plats,
six "ANNEXING PHASE N OF <NEIGHBOURHOOD>" declarations across 57 Ridge plats, five
Quail Pine Estates phase supplementals across every Quail Pine phase) are
`phase-governance`'s class, ruled one chain at a time. The line held here: the
document never names the place at any depth, and its own subject is a different
association or a different plat.

## OCR text is never page copy

`ocr_text` is stored for classification, verification and search. It is not
rendered. Vision misreads microfilm-era type badly enough that a quoted covenant
could misstate a legal restriction to a buyer.

## Building the OCR binary

```
swiftc -O -o scripts/place-documents/ocr scripts/place-documents/ocr.swift
```
