#!/usr/bin/env node
/**
 * Ingest the ENTIRE "Area Guides" Google Drive library into the Supabase
 * asset_library + Storage. ~90 Central Oregon location folders (cities + resort
 * communities + Bend neighborhoods), each with Photo/ and Video/ subfolders of
 * professionally-shot, owned footage.
 *
 * Walks the root, derives the geo tag from each LOCATION FOLDER NAME (e.g.
 * "Northwest Crossing" -> northwest-crossing), and ingests every file underneath
 * it (photos + videos, auto-typed by lib/drive-ingest inferType). Idempotent:
 * source_id = drive:<file-id>, so a re-run resumes where it left off and never
 * double-imports — safe to run repeatedly until complete.
 *
 * Media split (per the snowdrift "Area Guide" reality):
 *   - PHOTOS = clean stills -> hero/card surfaces (subject: landscape,exterior).
 *   - VIDEOS = finished marketing cuts w/ text+voiceover -> the area-guide page
 *     video (subject: area-guide), NOT a silent looping hero.
 *
 * Run (local; needs ffmpeg + GOOGLE_SERVICE_ACCOUNT_* env):
 *   node --env-file=.env.local scripts/ingest-area-guides.mjs --dry-run
 *   node --env-file=.env.local scripts/ingest-area-guides.mjs --only redmond
 *   node --env-file=.env.local scripts/ingest-area-guides.mjs            # full batch
 */
import { ingestFolder, listSubfolders } from '../lib/drive-ingest.mjs'

const AREA_GUIDES_ROOT = '1DdtBs4L0woLcLWvKcBb6tnD4MGsbliAj'
// Non-location subfolders inside the root that are NOT a geo to ingest.
const SKIP_NAMES = new Set(['for youtube', 'website landing'])

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // drop parentheticals like "(Squaw Creek)"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Retry a flaky network call (the Drive/token fetch occasionally ETIMEDOUTs on a
// long unattended batch). Exponential-ish backoff; throws after the last try.
async function withRetry(fn, label, tries = 4) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const ms = 2000 * (i + 1)
      console.warn(`  retry ${label} (${i + 1}/${tries}) after ${ms}ms: ${e instanceof Error ? e.message : String(e)}`)
      await new Promise((r) => setTimeout(r, ms))
    }
  }
  throw lastErr
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i]
      else out[a.slice(2)] = true
    } else out._.push(a)
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dryRun = !!args['dry-run']
  const only = typeof args.only === 'string' ? args.only.toLowerCase() : null

  console.log('\n=== Ingest Area Guides → asset_library ===')
  console.log(`root: ${AREA_GUIDES_ROOT}  dryRun: ${dryRun}${only ? `  only: ${only}` : ''}\n`)

  const locations = await withRetry(() => listSubfolders(AREA_GUIDES_ROOT), 'listSubfolders(root)')
  console.log(`Found ${locations.length} subfolders under the root.\n`)

  const totals = { locations: 0, files_ingested: 0, files_skipped: 0, errors: 0 }
  const startedAt = Date.now()

  for (const loc of locations) {
    if (SKIP_NAMES.has(loc.name.trim().toLowerCase())) {
      console.log(`SKIP non-location folder: ${loc.name}`)
      continue
    }
    const slug = slugify(loc.name)
    if (only && slug !== only && !loc.name.toLowerCase().includes(only)) continue

    console.log(`\n──── ${loc.name}  (geo=${slug}) ────`)
    try {
      const assets = await withRetry(
        () =>
          ingestFolder(loc.id, {
            recursive: true, // walks Photo/ + Video/
            geo: `${slug},central-oregon`,
            subject: 'area-guide,landscape,exterior',
            source: 'curated',
            license: 'owned',
            approval: 'approved', // owned, professionally-shot footage
            dryRun,
            onProgress: (msg) => console.log(`    ${msg}`),
          }),
        `ingestFolder(${slug})`,
      )
      totals.locations++
      const n = Array.isArray(assets) ? assets.length : 0
      totals.files_ingested += n
      console.log(`  ${dryRun ? 'would ingest' : 'ingested'} ${n} file(s) for ${slug}`)
    } catch (e) {
      totals.errors++
      console.error(`  ERROR ingesting ${loc.name}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const mins = ((Date.now() - startedAt) / 60000).toFixed(1)
  console.log(`\n=== DONE in ${mins} min — locations: ${totals.locations}, files: ${totals.files_ingested}, errors: ${totals.errors} ===`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
