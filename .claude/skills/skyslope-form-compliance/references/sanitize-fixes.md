# v5-namer sanitize fixes

When to read: writing or modifying the `sanitize()` function in
[scripts/v5-namer.mjs](../scripts/v5-namer.mjs); seeing HTTP 422 "File
Name is invalid" responses from SkySlope's document PATCH endpoint;
adding a new banned character to the filename allowlist.

## Forbidden characters

SkySlope's filename validator rejects more than just internal periods.
The canonical `sanitize()` strips every char that triggers HTTP 422 on
`PATCH /api/files/{kind}s/{guid}/documents/{docId}`:

| Char | Codepoint | Replacement | Why |
|---|---|---|---|
| `.` (period inside stem) | U+002E | `-` | SkySlope treats every period as an extension boundary; extension is applied separately by the caller |
| `–` en-dash | U+2013 | `-` (ASCII hyphen-minus) | Several OREF form names use en-dash (e.g. "Buyer Representation Agreement – Exclusive"); rejected before this fix |
| `—` em-dash | U+2014 | `-` | Same reason |
| `…` horizontal ellipsis | U+2026 | `etc` | Rare in form names; appeared in a few archive labels |
| `&` ampersand | U+0026 | ` and ` | SkySlope rejects |
| `#` hash/pound | U+0023 | `No ` | **Confirmed 2026-06-01** — rejected ("Counter No 2", "Repair No 1"). The current `sanitize()` maps `#`→`No `. |
| `,` comma · `;` semicolon | U+002C/3B | stripped | **Confirmed 2026-06-01** — rejected in archive-reason tails ("seller-only, older", "misnamed; actually..."). |
| `%` `{` `}` | various | stripped | Added 2026-06-01 to the strip class as likely-forbidden. |
| `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|` | various | `/ \`→`-`, rest stripped | Filesystem/SkySlope forbidden. **Note (2026-06-01): `/ \` were in this table but were NOT in the code's strip class until this date** — a date like "8/1/2025" in an archive reason 422'd. Now mapped to `-`. |

Current `sanitize()` strip class (after the 2026-06-01 pass): `.replace(/#/g,'No ').replace(/[/\\]/g,'-').replace(/[<>:"|?*,;%{}]/g,'')` plus the period/dash/`&`/ellipsis rules above.

## Hard rules beyond character sanitizing (confirmed 2026-06-01, 8-deal Jeanette pass)

1. **Extension MUST be preserved.** A rename whose new name drops or changes the file extension → HTTP 422 `"File Extension can not be changed."` The SkySlope `name` field often omits the real extension, so derive it from the fetch **manifest.json** (`fileName`), not the `name` field — `.htm` / `.eml` Outlook attachments and `.docx`/`.pdf` scans all carry their true extension only in the manifest. A doc absent from the manifest (e.g. a SkySlope "Canceled Transaction" admin/trash marker) has no binary and cannot be renamed — skip it.
2. **Length cap ~92 chars (stem).** A ~115-char archive name 422'd `"File Name is invalid."` Budget the archive-reason suffix so `ARCHIVE - <stem> - <reason>.ext` stays ≤ ~92.
3. **Bare `X_<descriptive>` stem 422s** when there is no form number after it (e.g. `X_Broker Notes - Transaction Summary`). `X_042_Initial Agency Disclosure` (X_ + form#) is accepted. For non-OREF docs needing the executed marker, prefix with the sale# or a descriptive token (`<Addr>-Closing_X_`).
4. **Listing-side sale folders carry linked listing-folder docs.** They appear in the sale's `/documents` list but the sale rename endpoint returns 422 `"Unable to find document with guid"` — they live in `sale.listingGuid`'s folder. Expected, not a failure; UNASSIGN from the sale activity still works. Rename them (if needed) via the listings endpoint.

## Truncation marker

Long filenames are truncated at 100 chars. The truncation marker was
originally `...` (three literal periods). Those survived the period-replace
in `sanitize()` because truncation ran AFTER sanitize. **Changed to
` (truncated)`** — a sanitize-compliant marker.

## Retry script

If you add a new banned-char to the sanitize regex, also rerun a retry
against past runs' `report.jsonl` files via
[scripts/_nordic-retry-422.mjs](../../../../scripts/_nordic-retry-422.mjs)
which probes the proposed-name field for forbidden chars and re-PATCHes
with the cleaned name. The retry does not re-OCR, so it's fast.
