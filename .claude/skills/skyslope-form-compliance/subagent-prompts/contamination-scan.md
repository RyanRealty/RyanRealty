# Subagent prompt — contamination-only scan (cross-folder audit)

Lightweight focused scan: does a folder hold documents that belong to a DIFFERENT property/deal? Much faster than the full classifier (no dedup/signer validation — just "which docs name a different property"). Used for the periodic full-inventory contamination audit.

Fill: `{{GUID}}`, `{{PROPERTY}}` (folder's own street address), `{{NATIVE}}` (parties + any failed offer cycles that are still NATIVE to this property), `{{DOC_COUNT}}`.

---

CONTAMINATION-ONLY scan of ONE SkySlope folder. ANALYSIS ONLY — no API calls, no scripts importing `@anthropic-ai/sdk`, no mutations. Your ONLY job: find documents whose INTERNAL property address belongs to a DIFFERENT property than the folder's own.

FOLDER: {{PROPERTY}} — saleGuid `{{GUID}}`. NATIVE (NOT foreign): the property "{{PROPERTY}}"; {{NATIVE}}. A failed/earlier offer cycle on the SAME property is NATIVE. FOREIGN = a document whose page shows a DIFFERENT street address (a different property entirely).

METHOD: read `tmp/skyslope-pdfs/{{GUID}}/documents.json` (full docId list). The fetched PDFs are at `tmp/skyslope-pdfs/{{GUID}}/<docIdPrefix>__<filename>`. For EACH doc read page 1 (and just enough more to confirm the property address / Sale Agreement #), then move on — be efficient. A doc is FOREIGN only if its property is clearly a different street than {{PROPERTY}}. Reference docs (prelim title, settlement, lender letter) name the property too — use them. Docs already named "ARCHIVE…" can be judged from the name if the property is visible there.

HARD RULES: emit only FULL docIds verbatim from documents.json; never invent. If a doc's property is unreadable (scanned image, blank field), list it under "uncertain" — do NOT call it foreign.

OUTPUT — write JSON to `tmp/skyslope-pdfs/{{GUID}}/contamination.json`:
```
{ "folder":"{{PROPERTY}}", "ownProperty":"{{PROPERTY}}", "docsReviewed": <int>,
  "foreign":[ { "doc_id": <FULL guid>, "name", "internal_property":"<the different address found>", "sale_number":"<if any>", "evidence":"page N: '<quote>'" } ],
  "uncertain":[ { "doc_id", "name", "why" } ] }
```
Then RETURN ONLY a one-line summary: "<N> foreign docs found (from: <properties>)" or "clean — all docs are {{PROPERTY}}". Do NOT paste the JSON.
