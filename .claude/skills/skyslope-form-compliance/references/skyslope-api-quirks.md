# SkySlope API quirks and gotchas

When to read: building a SkySlope API caller; debugging unexpected
HTTP 500/422 responses; downloading PDFs locally for OCR; resolving
broker GUIDs; filtering checklist activities by status.

## PATCH document — body, never query string

`PATCH /api/files/{kind}s/{guid}/documents/{docId}` edits per-document
metadata. **Two fields are editable per swagger: `FileName` and
`Folder`.**

**Always use JSON body, never query string.** Swagger documents both
fields as query parameters but `?FileName=` and `?Folder=` return
HTTP 500. The endpoint only honors `Content-Type: application/json`
with body `{ "FileName": "..." }` or
`{ "Folder": "Admin"|"Trash"|null }`.

**The `Folder` field is a strict enum** (`Admin` / `Trash` / `null`)
**but is decoupled from the SkySlope Documents UI navigation.**
Setting `Folder=Admin` via PATCH returns HTTP 200 with `folder:
"Admin"` in the response body, but the doc does NOT appear in the
Admin folder when a user opens it in the UI. Do NOT use this field for
archiving. See [archive-and-trash-workflows.md](archive-and-trash-workflows.md)
for the actual archive workflow.

**File extension is immutable.** `.pdf` → `.docx` PATCH returns HTTP 422
(`"File Extension can not be changed."`). The same 422 fires when the
current filename has **no extension at all** (e.g. an `unknown` /
`noname_NNN` artifact) and the new name adds one — adding an extension
counts as changing it. These extensionless artifacts are simply
unrenamable; if their wrong-activity assignment was already removed by
an unassign, leave them and move on. (Cedar `fae3cdcd` "unknown" hit
this in the 2026-05-28 batch.)

**GET does not return the `folder` field.** It's write-only via PATCH.

## Linked-listing documents are not renamable from the sale (HTTP 422)

When a sale has `dealType: "Listing"` and a `sale.listingGuid`, the
sale's `/documents` list **includes documents owned by the linked
listing folder** — the Exclusive Listing Agreement, the MLS Input /
Residential Input form, MLS Change forms, Fair Housing / Real Estate
Forms advisories, HOA / association packets, home-warranty docs, even
Outlook-signature image artifacts.

These listing-owned docs behave asymmetrically:

- **They CAN be assigned** to the sale's checklist activities
  (`POST /checklist-items/{activityId}` with `documentGuid` → 200).
  This is the compliance-critical action and it succeeds.
- **They CANNOT be renamed** from the sale endpoint
  (`PATCH /sales/{saleGuid}/documents/{docId}` → HTTP 422
  `"Unable to find document with guid: <id>"`). The sale doesn't own
  them, so it can't mutate their metadata.

This is **correct behavior, not an error.** The filename + dedup of a
listing-owned doc is the LISTING folder's responsibility — applied when
that listing folder runs the pipeline (rename via
`PATCH /listings/{listingGuid}/documents/{docId}`). Do NOT treat these
422s as failures in the sale pass; categorize them
`deferred_to_listing_folder`.

**Pre-classify so Phase 7 logs no false errors:** if
`sale.dealType === 'Listing'` and `sale.listingGuid` is set, GET
`/api/files/listings/{listingGuid}/documents` and build a set of
listing-owned docIds. Any doc in that set will 422 on a sale-side
PATCH — skip the rename (or route it to the listing endpoint) and note
why. A purchase-side sale (`dealType: "Purchase"`, no `listingGuid`)
has no linked-listing docs and never hits this class.

Verified across the 2026-05-28 batch (all confirmed present in the
linked listing's document list): Penhollow 7/7, Newport 4/4, Butler
3/3 rename-422s were listing-owned. Cedar (dealType=Purchase, no
listing) had zero of this class. Substantive checklist work
(unassign + assign) was 99/99 = 100% — only listing-owned renames and
one extensionless artifact were skipped, both correctly.

## Resolving `agentGuid` to a broker name

The `sale.agentGuid` field is opaque — SkySlope doesn't expose an
`/api/agents` endpoint that works for us. Resolution path:

1. Pull `listings.buyer_agent_name` from Supabase by MLS# — this is
   the listing-side record of who the buyer's broker was.
2. Verify by reading the OREF 050 BBSA / OREF 040 buyer-rep agreement
   in the folder — broker's signature block has the name.
3. Cross-check against Ryan Realty's broker roster (Matt Ryan,
   Rebecca Ryser Peterson, Paul Stevenson).

Common Ryan Realty broker GUIDs (collected over time, **not
authoritative** — always verify against PDF signature blocks):

- Matt Ryan: `41c18058-6c25-4acb-affc-3afc4ea9ac52` (often the
  `createdByGuid` because Matt creates folders as principal broker)
- Rebecca Ryser Peterson: `512ee312-9d19-4805-978d-1693774a8da8`
  (was the `agentGuid` on Nordic Closed)
- Paul Stevenson: TBD — verify when next encountered

If `createdByGuid !== agentGuid`, the folder was created by Matt
(admin) on behalf of the actual selling broker — flag this in the
summary.

## Checklist activity status field nuance

The `.status` field on a checklist activity isn't simply Required vs
Optional. Observed values:

- `Required` — no docs attached yet, marked required by template.
- `Optional` — marked "If Applicable" in the template.
- `In Review` — a doc has been attached and is awaiting / under broker
  review.
- `Complete` — terminal state.

When measuring "Required + empty" gap targets, the filter should be:

```js
acts.filter((a) => a.status === 'Required' && !(a.checklistDocs || []).length)
```

NOT just `a.status === 'Required'` because a Required activity with a
doc attached transitions to a different status. The gap-hunt only
fires on truly-empty Required slots.

## Case-sensitivity bug: `checklistDocs[].id` vs `documents[].docId`

`/api/files/sales/{guid}` returns activity assignments under
`checklist.activities[].checklistDocs[].id` as **UPPERCASE** GUIDs.
`/api/files/sales/{guid}/documents` returns the same docs under
`docId` (or `id`) as **lowercase** GUIDs.

Any cross-reference lookup must **case-normalize** (typically
`.toLowerCase()` both sides) or it will silently report 0 matches.
Burned us on 2026-05-24 — earlier "no checklist assignments anywhere"
report was wrong; after case normalization the same data showed 57
docs assigned across the 3 Nordic transactions.

```js
// Right:
const apiAssignments = new Map()
for (const a of activities) {
  for (const cd of (a.checklistDocs || [])) {
    const docId = (cd.id || '').toLowerCase()
    apiAssignments.set(docId, /* ... */)
  }
}
const lookupId = (doc.docId || doc.id || '').toLowerCase()
const assignments = apiAssignments.get(lookupId)
```

## Read PDFs locally when API metadata is thin

The SkySlope `/api/files/sales/{guid}/documents` response does NOT
include all the metadata you need for the transaction summary. To
pull fields like escrow file #, EM amount, settlement officer
signature, recorded deed instrument #, etc., download the PDF
locally:

```js
const docUrl = doc.url || `${BASE}/api/files/sales/{guid}/documents/{docId}/download`
const r = await fetch(docUrl, { headers: { Session, timestamp } })
const buf = Buffer.from(await r.arrayBuffer())
await fs.writeFile('/tmp/<id>.pdf', buf)
// Then render pages (scripts/_render-pdf-pages.mjs) and classify via an
// Agent-tool vision subagent (subagent-prompts/classifier.md). Do NOT
// call scripts/claude-reader.mjs — it bills Matt's Anthropic API console
// separately from his Claude Code plan (see failure-modes.md §6).
```

The `doc.url` field on `/documents` endpoint is a **pre-signed S3
URL that's good for ~5 minutes**. Use it as-is — don't construct
your own.
