# Archive folder and Trash workflows

When to read: organizing ARCHIVE-prefixed docs into a per-transaction
Archive folder; the SkySlope UI shows a "You cannot move a document
attached to the checklist out of its current folder" banner; you need to
move docs to/from Trash; bulk archive cleanup on a new transaction
following the v5-namer pass.

## Three independent state stores (critical context)

SkySlope's "document folder" concept is actually three independent
mechanisms that are NOT in sync with each other. Understanding which
one you're touching is the difference between a working script and
silent corruption.

| Concept | Where it lives | Reflects in UI? |
|---|---|---|
| API `folder` field (`Admin`/`Trash`/`null`) | `PATCH /api/files/{kind}s/{guid}/documents/{docId}` body | **No.** Setting it to `Admin` has no observable UI effect. |
| Checklist activity assignment | `POST /checklist-items/{activityId}` / `…/unassign` | Yes — assigned docs appear under their activity in the Checklist tab. |
| **UI Documents folder navigation** | `divdrpDownMoveButton` ASP.NET dropdown postback | **Yes — this is what users see.** |

**Practical consequence:** users see #3. Do not use #1 (API folder
field) thinking it'll move a doc to where users can see it. Use #3
(Playwright postback) for any folder organization a human will look at.

## Post-rename UNASSIGN-archive workflow (Phase 8a)

When the rename pass converts a previously-canonical doc to ARCHIVE
prefix (because it's a duplicate, not_executed, or superseded), the
doc's prior checklist-activity assignment **persists**. SkySlope does
not auto-unassign when a filename changes. The activity row still
shows the ARCHIVE-prefixed doc — clutter in the checklist UI.

Add an explicit unassign pass after Phase 7 (rename) and BEFORE Phase
8b (move to Archive folder). For each activity:

```js
for (const d of activity.checklistDocs) {
  if (d.fileName.startsWith('ARCHIVE')) {
    POST /api/files/sales/{guid}/checklist-items/{activityId}/unassign
    body: { documentGuid: d.id }
  }
}
```

Verify post-unassign by re-querying the checklist and counting docs
whose fileName starts with `ARCHIVE` — target is 0.

Example: [scripts/_nordic-closed-finalize.mjs](../../../../scripts/_nordic-closed-finalize.mjs)
unassigned 94 ARCHIVE docs across 3 Nordic folders (Closed 54 +
Canceled-A 26 + Canceled-B 14).

## UI custom folder mechanics

**Folders in the Documents UI** (per transaction, not per template):

- `Main Documents` (id = transaction integer ID, value `<txnInt>Z0-0`)
- `Admin` (id 245, value `<txnInt>Z245-0`) — system
- `Trash` (id 246, value `<txnInt>Z246-0`) — system
- Any number of **custom folders** created via the "Add Folder" button
  (`#CreateFolderModalButton`) — each gets a database row id and the
  encoding `<txnInt>Z<folderDbId>-1` (the `-1` flags custom)

Custom folders are **per-transaction**. Adding an "Archive" folder to
one transaction does NOT propagate to others. There is no template-level
folder concept. There is no API endpoint to create or list custom
folders — only the `CreateFolderModal` UI flow works.

## Bulk move to Archive folder (Phase 8b)

The move uses ASP.NET `__doPostBack` on the dropdown menu after at
least one row checkbox under `.bg1` is checked. The wrapper function
`RaiseDropDownPostBack` short-circuits with `return false` when no
boxes are checked.

```js
// Per ARCHIVE-prefixed doc row, find the chkdoc checkbox and check it
document.getElementById(checkboxId).checked = true
// Then once per batch, fire:
__doPostBack('divdrpDownMoveButton', `${archiveFolderValue}:Archive`)
// e.g. value = '20176853Z33096-1' (txn 20176853, folder id 33096, custom)
```

**Script of record:** [scripts/_nordic-ui-move-to-archive.mjs](../../../../scripts/_nordic-ui-move-to-archive.mjs).
Drives Playwright with saved login state from
[scripts/_skyslope-login-capture.mjs](../../../../scripts/_skyslope-login-capture.mjs)
(auto-fills creds from `.env.local` `SKYSLOPE_LOGIN_EMAIL` +
`SKYSLOPE_LOGIN_PASSWORD`).

Per-transaction flow:

1. Navigate to `TransactionDocuments.aspx?TransactionID=<base64-int>`
2. Read `#divdrpDownMoveButton` to find an existing "Archive" folder
   value, OR create one via the `#CreateFolderModal` modal (fill
   `#txtFolderName`, click Save)
3. Check every checkbox in `#ContentPlaceHolder1_GVListingCheckList`
   whose row label matches `/^ARCHIVE\s/i`
4. Verify `.bg1 input[type=checkbox]:checked` count matches the
   expected count (`RaiseDropDownPostBack` measures the same selector)
5. Invoke `__doPostBack('divdrpDownMoveButton', '<value>:Archive')`
6. Wait ~5s, screenshot the after-state

**Verification:** the script's after-count is unreliable because the
post-postback DOM nests moved docs under the folder header row in the
same `GVListingCheckList`. Use screenshot inspection as the source of
truth, not the count.

**Nordic pass result (2026-05-24):**

| Transaction | TxnInt | API GUID | Docs moved | Folder ID |
|---|---|---|---|---|
| Closed | 20597300 | ce3c30de-1b10-4946-bf06-6dbad8e1d53d | 72 | 33098 (auto-created) |
| Canceled-A (buyer-side, "Elsa Uchikawa") | 20176813 | 6be4810f-eda4-433d-ad6f-f27b80a1c6e0 | 14 | 33097 (auto-created) |
| Canceled-B (seller-side, "Halpin") | 20176853 | 0ec95d31-1fed-4519-a114-e967513eac33 | 33 | 33096 (pre-existing) |
| **Total** | | | **119** | |

The label/GUID mapping is non-obvious: the seller-side and buyer-side
canceled transactions share the same property but have different file
headers (address vs party name). Always confirm by GUID when scripting.

**Resolving Closed-status TxnInt:** the `Closed Transactions to be
Archived` section on `ManageTransactions.aspx` uses `gvClosed_…` row
IDs with `data-href` (not `data-url`) and the link format
`/CreateTransaction.aspx?TransactionID=<base64>`. The Canceled-status
transactions use `gvManageTransacion_…` rows with `data-url` and
`/TransactionChecklist.aspx?TransactionID=<base64>`.

## Anti-patterns (what NOT to do)

- **Do not PATCH `Folder: "Admin"` via API** thinking it'll show up in
  the Admin folder. It won't. The API folder field has no observable
  downstream effect we've discovered. (We tested.)
- **Do not try to create custom folders via the API** — there is no
  endpoint. Only the `CreateFolderModal` UI flow works.
- **Do not skip the smoke step on the first transaction** — the
  ASP.NET postback flow has multiple gotchas (`.bg1` checkbox scope,
  `value` attribute case, `:Archive` text suffix) and a fresh
  transaction is the cheapest place to debug.

## Restoring a Trash doc that's checklist-assigned

SkySlope's UI blocks the Move postback for any document currently
attached to a checklist activity with the banner:

> "You cannot move a document attached to the checklist out of its current folder."

The natural API workaround would be:
1. `POST /checklist-items/{activityId}/unassign` { documentGuid }
2. UI Move postback (Trash → Main)
3. `POST /checklist-items/{activityId}` { documentGuid } (reassign)

**This does NOT work.** SkySlope maintains TWO independent state
stores for "attached to checklist":

| Store | What it controls | What clears it |
|---|---|---|
| `activity.checklistDocs[]` (returned by GET `/api/files/sales/{guid}`) | the API view of which docs are linked to which activities | `POST /checklist-items/{activityId}/unassign` works |
| UI "attached to checklist" lock (drives the move-block banner) | the UI Move postback gate | only the UI's own Unassign modal flow works |

The API `/unassign` returns HTTP 200 and clears `checklistDocs[]`
correctly. But the UI Move postback still fires the lock banner because
the second store is unchanged.

**Working procedure** (manual UI, ~30 sec per doc):

```
1. Open TransactionDocuments.aspx and expand Trash
2. Check the doc's checkbox
3. Click #unassignButton (top toolbar) → opens unassign modal
4. Modal lists activities the doc is in. Select target activity.
5. Click #btnChecklistUnassign (the modal's confirm button)
6. Wait for ASP.NET postback
7. Now check the doc again → Move ▾ → Main Documents (will succeed)
8. Check again in Main → click #assignButton → reassign to the activity
```

The modal-driven Unassign fires a postback that updates BOTH state
stores in one operation. The API unassign endpoint only updates the
first. (Likely a SkySlope-side bug; report if your CSM relationship
allows.)

**For 1-2 docs, manual UI is faster than scripting.** A scripted
version would need Playwright to drive the unassign modal selectors
precisely (target list dropdown, confirm button) — not built yet. The
recipe above is the documented procedure.

**Tested smoke 2026-05-24** with Canceled-B's `RRP04212025_X_C-527_Seller's
Repair Addendum.pdf` (assigned to "Repair Addendum" In Review activity,
sitting in Trash). API unassign returned 200 and cleared
`checklistDocs[]` to length 0. Subsequent UI Move postback still fired
the lock banner. Reassigned via API to restore prior state.

## Future-transaction workflow

For any agent doing SkySlope cleanup on a new transaction:

1. Run v5-namer to rename docs (Phase 7) — gets ARCHIVE prefix on
   duplicates / not_executed / superseded.
2. Run unassign-from-activities pass (Phase 8a) — leaves the ARCHIVE
   docs in the main bucket but not under any activity row.
3. Run `_nordic-ui-move-to-archive.mjs` (or a copy with new TxnInts)
   with `--execute` (Phase 8b) — bulk-moves them to the Archive folder
   (auto-creates the folder if missing).
4. Visually confirm in the UI.
5. If any docs landed in Trash with assignments, follow the Trash
   restore procedure above.
