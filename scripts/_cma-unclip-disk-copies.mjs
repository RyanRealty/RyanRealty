#!/usr/bin/env node
/**
 * Un-clip the on-disk CMA copies.
 *
 * `resolveCmaDir()` in lib/cma-pdf.ts checks `public/cmas/<slug>/` and
 * `public/drafts/<slug>/` BEFORE the database, so for any slug with a file on
 * disk the stored-HTML remediation is invisible — the disk copy is what
 * production serves, and `next.config.ts` bundles these into the deployment via
 * outputFileTracingIncludes.
 *
 * Six of them still carried the sheet-clipper after the whole DB corpus was
 * fixed. They are hand-built documents that predate the deterministic builder
 * (2026-07-07), so four have no `render_args` and cannot be re-rendered — the
 * clipper is removed by the same exact string replacement used on the database,
 * which stops the silent content deletion.
 *
 * They do NOT gain the flowing model. What they gain is honesty: content that
 * does not fit is now visible and measurable, and assertPdfPageSafety blocks any
 * of them from being sent while it bleeds, instead of shipping short in silence.
 *
 * Run: node scripts/_cma-unclip-disk-copies.mjs [--apply]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')

/** Both rules clip. The print block overrides only what it restates, so the
 *  base rule's `height` + `overflow: hidden` still apply under print media. */
const REPLACEMENTS = [
  {
    name: 'base',
    from: `.page {
    width: 8.5in;
    height: 11in;
    min-height: 11in;
    margin: 0.4in auto;
    background: var(--cream);
    padding: 0.4in 0.6in 0.85in 0.6in;
    box-shadow: 0 6px 24px rgba(16, 39, 66, 0.18);
    position: relative;
    page-break-after: always;
    overflow: hidden;
  }`,
    to: `.page {
    width: 8.5in;
    min-height: 11in;
    margin: 0.4in auto;
    background: var(--cream);
    padding: 0.4in 0.6in 0.85in 0.6in;
    box-shadow: 0 6px 24px rgba(16, 39, 66, 0.18);
    position: relative;
    page-break-after: always;
    overflow: visible;
  }`,
  },
  {
    name: 'print',
    from: `    .page {
      box-shadow: none;
      margin: 0;
      width: 8.5in;
      height: 11in;
      min-height: 11in;
      max-height: 11in;
      overflow: hidden;
      page-break-after: always;
    }`,
    to: `    .page {
      box-shadow: none;
      margin: 0;
      width: 8.5in;
      min-height: 11in;
      page-break-after: always;
    }`,
  },
  // cma-18705-tumalo-reservoir was hand-built with a compact rule style and
  // three separate .page rules (base + two print overrides). Matched exactly
  // rather than by a loose regex, so an unexpected variant still gets flagged
  // for review instead of silently half-edited.
  {
    name: 'compact-base',
    from: `.page {
    width: 8.5in; height: 11in; margin: 0.4in auto;
    background: var(--cream); padding: 0.30in 0.6in 0.57in 0.6in;
    box-shadow: 0 6px 24px rgba(16, 39, 66, 0.18); position: relative;
    page-break-after: always; break-after: page; overflow: hidden;
  }`,
    to: `.page {
    width: 8.5in; min-height: 11in; margin: 0.4in auto;
    background: var(--cream); padding: 0.30in 0.6in 0.57in 0.6in;
    box-shadow: 0 6px 24px rgba(16, 39, 66, 0.18); position: relative;
    page-break-after: always; break-after: page; overflow: visible;
  }`,
  },
  {
    name: 'compact-print-a',
    from: `.page { margin: 0; box-shadow: none; height: 11in; overflow: hidden; }`,
    to: `.page { margin: 0; box-shadow: none; min-height: 11in; overflow: visible; }`,
  },
  {
    name: 'compact-print-b',
    from: `.page { box-shadow: none; margin: 0; width: 8.5in; height: 11in; overflow: hidden; page-break-after: always; }`,
    to: `.page { box-shadow: none; margin: 0; width: 8.5in; min-height: 11in; page-break-after: always; }`,
  },
]

/** Node 20 has no fs.globSync — walk the two document roots directly. */
function documentFiles() {
  const out = []
  for (const root of ['public/drafts', 'public/cmas']) {
    if (!existsSync(root)) continue
    for (const dir of readdirSync(root)) {
      for (const name of ['cma.html', 'net-sheet.html']) {
        const f = `${root}/${dir}/${name}`
        if (existsSync(f)) out.push(f)
      }
    }
  }
  return out
}

const files = documentFiles()

let patched = 0
let already = 0
let unmatched = 0

for (const file of files.sort()) {
  const src = readFileSync(file, 'utf8')
  if (!src.includes('max-height: 11in') && !/\.page \{[^}]*overflow: hidden/.test(src)) {
    already++
    console.log(`  · ${file} — already clean`)
    continue
  }
  let out = src
  const hit = []
  for (const r of REPLACEMENTS) {
    if (out.includes(r.from)) {
      out = out.replace(r.from, r.to)
      hit.push(r.name)
    }
  }
  if (!hit.length) {
    unmatched++
    console.log(`  ✗ ${file} — carries a clipper in an UNRECOGNISED shape, left alone for review`)
    continue
  }
  if (APPLY) writeFileSync(file, out)
  patched++
  console.log(`  ${APPLY ? '✓' : '→'} ${file} — ${hit.join(' + ')}`)
}

console.log(`\n${APPLY ? 'patched' : 'would patch'}: ${patched} · already clean: ${already} · unrecognised: ${unmatched}`)
if (unmatched) process.exitCode = 1
