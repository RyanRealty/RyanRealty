# /admin/forms vs SkySlope Forms — inventory (2026-08-21)

## /admin/forms today
No product tabs. One worklist: catalog check, search, freshness filters, per-library tables.
Gate: transactions.edit. Columns: Form #, Name, Pages, Fields, Signers, Library (freshness), Blank, Open.
Catalog check: OREF 1340 / ODS 1528 / OR 1837 current published only. Copy script → paste JSON → Apply catalog.
Not on page: Add to deal, fill, compose, clauses, packets, buyer agreements, Files All/My/Archive, field-placement editor.

## Ingest
POST /api/admin/forms/ingest — Bearer TC_FORMS_INGEST_SECRET, CORS forms.skyslope.com
Required: libraryCode, name, sourceVersionId, pdfBase64
Does NOT re-check Published; catalog-check script does: status === Published && id === publishedVersionId
Not yet: updateFormVersion PDF pull

## Jobs vs code
- Browse libraries: partial (board + freshness; no Add, no extra association libs)
- Add-to-deal: missing (createEnvelopeFromTemplate has no UI callers)
- Fill: partial (OREF 001 packet only)
- Field maps: partial (ingest translates; no map editor on /admin/forms)
- Templates/packets: partial (OREF packet only; no tc_form_packets UI)
- Clauses: missing
- Buyer agreements: missing as Forms flow
- Files All/My/Archive: missing
- Field placement editor: partial (envelope composer Place fields, per-envelope)

## Locked (from files)
Oregon libs only: OR 1837, ODS 1528, OREF 1340.
OREF under paid membership, never redistribute.
Current published only. Do not send stale layout.
"OR primary", "listed host", "do not strip seals" — CoS locked, not in these files.
