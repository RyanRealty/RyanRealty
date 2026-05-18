# End-to-end procedure

Open this when actually running the pipeline, not just reasoning about it.

All scripts live under `scripts/skyslope-forms-*.mjs`. They share auth
(HMAC + Session via `.env.local` creds) and pagination via
`scripts/skyslope-files-api.mjs`.

Output artifacts go in `tmp/skyslope-{YYYY-MM-DD}/`. The directory is
gitignored — nothing in `tmp/` ever gets committed.

## Step-by-step

### 1. Dry-run with full OCR

Reads every folder, every document. Downloads each PDF, OCRs up to 50
pages, runs `detectExecuted`, extracts `Sale Agreement #` value,
derives the new filename. Writes one JSONL line per doc to the cache.

```bash
SKYSLOPE_RENAME_V2_CONCURRENCY=8 \
SKYSLOPE_RENAME_V2_PDF_MAX_PAGES=50 \
  npm run skyslope:forms-rename-documents-v2 \
  > tmp/skyslope-{date}/dry-run.jsonl 2>&1
```

Wall time: 60–90 minutes for ~1,900 docs. The bottleneck is tesseract
OCR, not network. Concurrency 8 fits in 4 GB RSS on a Mac.

If the run dies partway, build a remainder file (entries whose
`(folderGuid, documentId)` pair isn't already in the output) and resume:

```bash
node -e '
const fs = require("fs")
const done = new Set(fs.readFileSync("tmp/skyslope-{date}/dry-run.jsonl","utf8").split("\n").filter(Boolean).map(l => {
  const j = JSON.parse(l)
  return j.folderGuid + "|" + j.documentId
}))
const out = []
for (const line of fs.readFileSync("tmp/skyslope-{date}/all-cached-from-prior-run.jsonl","utf8").split("\n").filter(Boolean)) {
  const j = JSON.parse(line)
  if (!done.has(j.folderGuid + "|" + j.documentId)) out.push(line)
}
fs.writeFileSync("tmp/skyslope-{date}/dry-run-remaining.jsonl", out.join("\n") + "\n")
'
```

### 2. Sanity-check before applying

Before flipping apply mode, look at three things in the dry-run output:

1. **X rate per category.** Closed sale folders should hit ~50–80% X on
   most categories. If listing agreements are <20% X on closed deals,
   OCR coverage is wrong or the detector is broken — STOP, debug, do
   not apply.
2. **Sale# extraction rate.** Expect 10–20% of docs to have a sale#.
   Higher than that and the regex is over-firing on form-section
   headers. Lower than 5% and the regex is too tight.
3. **Filename collisions.** Two distinct documents shouldn't produce
   the same target filename. SkySlope doesn't enforce uniqueness, but
   it makes the folder unscannable. `jq -r '.to' dry-run.jsonl | sort
   | uniq -d` should be empty or very short.

If any of those fail, fix the taxonomy in
`scripts/skyslope-forms-document-taxonomy-v2.mjs` and re-run the
dry-run. Don't apply on a broken cache.

### 3. Apply from cache

Patches every document's filename via JSON-body PATCH. No OCR — the
script just reads the JSONL and PATCHes.

```bash
node scripts/skyslope-forms-apply-from-cache.mjs \
  tmp/skyslope-{date}/dry-run.jsonl \
  > tmp/skyslope-{date}/apply.jsonl 2>&1
```

Wall time: 3–5 minutes at concurrency 6.

Expected failure modes (see `api-quirks.md`):

- `HTTP 500` — wrong PATCH method (should be JSON body, not query).
  Script is correct; if you see this, look at script regressions.
- `HTTP 422 "Unable to find document with guid"` — shared-folder doc.
  Recover via cross-endpoint.
- `HTTP 422 "File Name is invalid"` or `"File Extension can not be
  changed"` — extension mismatch. Recover via extension-aware retry.

### 4. Recover failed PATCHes

Two recovery scripts. Run both in any order.

```bash
node scripts/skyslope-forms-recover-failed.mjs \
  tmp/skyslope-{date}/apply.jsonl \
  > tmp/skyslope-{date}/recover-ext.jsonl 2>&1

node scripts/skyslope-forms-recover-crossendpoint.mjs \
  tmp/skyslope-{date}/apply.jsonl \
  > tmp/skyslope-{date}/recover-cross.jsonl 2>&1
```

Typical recovery yields:

- `recover-ext` fixes ~80% of extension failures
- `recover-cross` fixes ~50% of "Unable to find" failures (the rest
  are docs whose sibling folder doesn't exist in this account)

### 5. Force X for shared-doc conflicts

For docs where the cache disagreed with itself (one entry says
executed=true, another says executed=false), the apply pass usually
ends with the no-X version winning. This force pass fixes that.

```bash
node scripts/skyslope-forms-force-x.mjs \
  tmp/skyslope-{date}/dry-run.jsonl \
  > tmp/skyslope-{date}/force-x.jsonl 2>&1
```

Wall time: 1–2 minutes.

### 6. Verify

Compares current SkySlope filenames against the cache's expected names.

```bash
node scripts/skyslope-forms-verify.mjs \
  tmp/skyslope-{date}/dry-run.jsonl \
  > tmp/skyslope-{date}/verify.jsonl 2>&1
```

The verify summary reports four buckets:

- `matches` — current filename equals expected
- `mismatch_still_old_name` — doc kept its pre-rename name (probably
  truly un-PATCHable)
- `mismatch_other_name` — doc renamed but to something different
  (usually a `.png.png` cache bug or a shared-doc X conflict; the
  current name is usually correct, the cache is wrong)
- `pseudo_skipped` / `not_found` — pseudo-rows or deleted docs

A healthy run shows >90% in `matches`. Below 90%, investigate.

### 7. Folder gap report

Surfaces folders that need UI work — missing parties, blank addresses,
duplicate folders, address typos, missing 042 pamphlet, missing BBC.

```bash
node scripts/skyslope-forms-folder-gap-report.mjs \
  --json tmp/skyslope-{date}/folder-gaps.json \
  > tmp/skyslope-{date}/folder-gaps.md
```

Wall time: under 1 minute (metadata only, no PDF reads).

The gap report does NOT attempt to fix anything. SkySlope's API
doesn't expose folder-level mutation — Matt has to do those fixes in
the UI.

## Environment knobs

| Variable | Default | Purpose |
|---|---|---|
| `SKYSLOPE_RENAME_V2_CONCURRENCY` | 4 | Parallel OCR workers |
| `SKYSLOPE_RENAME_V2_PDF_MAX_PAGES` | 50 | Max pages OCRed per PDF |
| `SKYSLOPE_RENAME_V2_PDF_BYTES` | 9000000 | Max PDF size accepted |
| `SKYSLOPE_RENAME_V2_SKIP_OCR` | (unset) | Skip OCR entirely (rare; sale# and X both depend on it) |
| `SKYSLOPE_REDETECT_CONCURRENCY` | 8 | Workers for redetect-v3 |
| `SKYSLOPE_REDETECT_PDF_MAX_PAGES` | 50 | OCR depth for redetect-v3 |
| `SKYSLOPE_APPLY_CONCURRENCY` | 6 | Workers for apply-from-cache |
| `SKYSLOPE_APPLY_PACE_MS` | 80 | Delay between PATCH bursts |
| `SKYSLOPE_INCLUDE_ARCHIVED` | (unset) | Set to `1` to include archived folders |

## When to use each script

- **First-time run on a brand-new dataset**: full `rename-documents-v2`
  pipeline (steps 1–7).
- **Re-run after taxonomy improvements**: `redetect-v3.mjs` against the
  previous cache so you don't re-enumerate folders.
- **Only fixing missed X cases**: `force-x.mjs` against the previous
  cache.
- **Only fixing extension mismatches**: `recover-failed.mjs` against
  the previous apply log.
- **Auditing folder state without renaming**: `folder-gap-report.mjs`
  alone.

## Don't write new mutation scripts

The eight scripts under `scripts/skyslope-forms-*.mjs` cover every
mutation path we've validated against the live API. If you think you
need a new one, first read `api-quirks.md` — most "new requirements"
are actually variations of what the existing scripts already do.

If you genuinely need a new mutation script (e.g., SkySlope adds a new
endpoint), copy the auth + helpers from `skyslope-files-api.mjs`,
follow the same logging pattern (one JSONL line per attempt with
`action`, `httpStatus`, `error`), and put a sample run in `tmp/`
before committing.
