# SkySlope Files API quirks

Open this when you need to know why a particular PATCH is failing, or
when you're about to introduce a new mutation against the API.

## PATCH wants the new filename in the JSON BODY

The example in `.cursor/skills/skyslope-api/SKILL.md` shows the
filename as a query parameter:

```
PATCH /api/files/listings/{guid}/documents/{docId}?FileName=<new>
```

This **returns HTTP 500 "Internal Server Error" on every call.** The
v1 rename script used this pattern and got 100% failures on the first
production attempt.

The working pattern is JSON body:

```
PATCH /api/files/listings/{guid}/documents/{docId}
Content-Type: application/json
{ "FileName": "<new filename>" }
```

Probed against the live API on 2026-05-16 against multiple docs with
spaces, underscores, and dashes — all returned HTTP 200 with the new
filename echoed in the response.

The response also includes a warning `"The folder was not updated"`
which is harmless — the document is renamed, only the folder-level
metadata stays untouched.

## Pseudo-document rows can't be PATCHed

`GET /api/files/listings/{guid}/documents` and the equivalent
`/sales/` endpoint return placeholder rows alongside real files.
Markers:

- `fileSize === -1`
- `pages === null`
- `documentServiceKey === ""`
- `modifiedDate === "0001-01-01T00:00:00"`
- Names like `"Canceled Transaction MM/DD/YYYY_Trash"`, `"2026_Admin"`,
  `"2025_Admin"`, `"noname_303"`, `"unknown"`

Any of these signals is enough to skip the doc. PATCH against a
pseudo-row returns HTTP 422 `Unable to find document with guid: <ID>`
or `File Name is invalid`.

Code reference: `isUnpatchablePseudoDoc()` in
`scripts/skyslope-forms-document-taxonomy-v2.mjs`. Always run that
check at task-enumeration time so pseudo-rows never reach the PATCH
worker.

## Documents shared between listing + sale folders

A single document can appear in both the listing folder's
`/documents` listing AND the sibling sale folder's `/documents`
listing — same `id`. SkySlope's PATCH endpoint can only address the
doc from ONE side at a time.

Symptom: PATCH via `/api/files/listings/{listingGuid}/documents/{id}`
returns `Unable to find document with guid: {id}`, but PATCH via
`/api/files/sales/{saleGuid}/documents/{id}` succeeds (or vice
versa).

Cause: the document record lives in one of SkySlope's underlying
tables (ListingDocuments OR SaleDocuments). The other folder shows it
read-only.

Recovery: when PATCH fails with `Unable to find guid`, look up the
sibling folder (via `listing.relatedSales` / `listing.linkedSales` or
`sale.listingGuid`) and retry PATCH against the alternate endpoint.

Code reference: `scripts/skyslope-forms-recover-crossendpoint.mjs`.

## File extension can not be changed

SkySlope locks the file extension to whatever it was on upload. PATCH
attempts that change the extension return HTTP 422 with one of:

- `File Extension can not be changed.` (extension differs)
- `File Name is invalid.` (extension issue or other formatting)

This is why the v2 taxonomy includes `fileExtension(originalFileName)`
and passes it explicitly to `suggestStandardNameV2`. Force `.pdf` on
a `.jpg` file and the PATCH fails.

Recovery when this fails: re-derive the extension from the source
filename, rebuild the suggested name with the correct extension, retry
PATCH. See `scripts/skyslope-forms-recover-failed.mjs`.

## Shared docId X conflicts

When a document is shared between listing + sale folders, the v3 cache
has TWO entries for it — one per folder. The two entries can disagree
on X because the executed detector runs with different folder context:

- Listing-folder cache entry: `folderDetail.sellers = [Millards]`,
  `folderDetail.buyers = []`. Detector matches sellers against PDF
  text → exec=true (1/1 sellers matched).
- Sale-folder cache entry: `folderDetail.sellers = [Millards]`,
  `folderDetail.buyers = [Scotts]`. Detector matches sellers (yes)
  AND buyers (maybe) — if buyer signatures aren't on this particular
  doc, exec=false (2/4 matched).

When `apply-from-cache` PATCHes both entries concurrently, whichever
lands second wins. For shared docs, that's usually the sale-side cache
entry (no X), even when the listing-side correctly identified the doc
as executed.

Resolution: after the main apply pass, run `force-x.mjs`. It groups
cache entries by docId, finds the ones where ANY entry says
executed=true, and force-PATCHes those docs to add `_X` if missing.

Code reference: `scripts/skyslope-forms-force-x.mjs`.

## Folder-level mutation is not exposed

The Files API as we have it scoped (HMAC + Session via
`api-latest.skyslope.com`) only exposes PATCH for document filenames.
We've found no endpoint for:

- Adding/removing parties on a folder
- Editing the property address, MLS number, or status
- Archiving or deleting a folder
- Linking listing folders to sale folders

All of those are SkySlope UI work. The folder gap report
(`scripts/skyslope-forms-folder-gap-report.mjs`) surfaces folders that
need that UI work — but the script doesn't try to fix them.

## Rate limiting

The API returns HTTP 429 occasionally under load. The retry helper
`skyslopeFetchWithRetry` in `scripts/skyslope-files-api.mjs` handles
backoff automatically (exponential up to 60 seconds). Don't disable
this — sustained PATCH activity at concurrency 6+ will trigger 429s
often enough that the retry path is exercised regularly.

## Pagination

Folder listings (`/api/files/listings`, `/api/files/sales`) use
`earliestDate` and `latestDate` as Unix SECONDS (not milliseconds, not
ISO strings), with `pageNumber` 1-based and **exactly 10 items per
page**. No `pageSize` parameter. Scripts that stop iterating after
`rows.length < 50` (a common heuristic) silently under-fetch and only
retrieve page 1.

Code reference: `fetchSkyslopeFileFolderRows` in
`scripts/skyslope-files-api.mjs`.

## Two distinct API surfaces

This skill is for the **Files API** at `api-latest.skyslope.com`
(HMAC + Session). It is NOT:

- SkySlope Forms Partnership API (`forms.skyslope.com`, OAuth)
- SkySlope Offers API (`offers.skyslope.com`, OAuth client credentials)
- SkySlope Suite (a separate brokerage application)

Tokens from any of those will fail against the Files API and vice
versa. See `.cursor/skills/skyslope-api/reference.md` for the full
distinction.
