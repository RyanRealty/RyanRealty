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
| `verify` | `ci:place-documents`. Asserts no published link is a non-governing instrument or unconfirmed-and-unreviewed |

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

## OCR text is never page copy

`ocr_text` is stored for classification, verification and search. It is not
rendered. Vision misreads microfilm-era type badly enough that a quoted covenant
could misstate a legal restriction to a buyer.

## Building the OCR binary

```
swiftc -O -o scripts/place-documents/ocr scripts/place-documents/ocr.swift
```
