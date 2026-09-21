#!/usr/bin/env node
/**
 * backfill-listing-videos.mjs — SITE-154 (2026-09-21).
 *
 * Closes the two gaps verified live against Spark + Supabase on 2026-09-21
 * (re-verify with this script's own printed counts — do not trust these
 * numbers without re-running):
 *
 *   1. `listings.details.Videos` / `has_virtual_tour` lag Spark for a small
 *      set of listings the scheduled delta sync's `ModificationTimestamp`
 *      window has not re-touched since a video was added in the MLS.
 *      Measured: 11 of 1,050 Active listings with a real Spark video had
 *      empty/missing `details.Videos` in Supabase; a further ~47 had
 *      `details.Videos` correct but `has_virtual_tour` still false.
 *   2. `listing_videos` (Tier 1 of getListingVideos()) was never written by
 *      the scheduled sync before this node — see the `videoSyncTargets`
 *      wiring in lib/sync/deltaSync.ts for the forward-going fix. This
 *      script closes the gap for listings that were ALREADY synced before
 *      that wiring existed.
 *
 * SAFETY: this script's Spark fetch requests ONLY `Videos,VirtualTours` — a
 * far lighter expand than the full sync's
 * Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents,CustomFields.
 * It NEVER upserts a full row (that would silently null out PhotoURL /
 * OpenHouses / CustomFields-derived fields this script never fetched). It
 * patches ONLY two columns via a scoped `.update()`:
 *   - details:          the EXISTING details object with Videos/VirtualTours
 *                        merged in (never replaced wholesale)
 *   - has_virtual_tour:  recomputed the same way the mapper does
 *                        (lib/listing-mapper.ts sparkToListingRow)
 * and rewrites listing_videos for that key via the SAME extraction the
 * scheduled sync now uses (extractListingVideoRows, lib/listing-mapper.ts),
 * so this backfill and the live sync can never derive different rows.
 *
 * DEFAULT IS DRY RUN (no writes). Real writes require --execute.
 *
 * DO NOT run a full-market pass from a sandbox (SITE-154 brief). This script
 * requires either --list-numbers (explicit — the safest, used to prove this
 * on the exact verified-gap sample) or --limit, capped at 200 without
 * --i-understand-the-cost.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SPARK_API_KEY
 *           (loaded from .env.local automatically when not already in env)
 *
 * Usage:
 *   node scripts/backfill-listing-videos.mjs --list-numbers 220219000,220219002 --execute
 *   node scripts/backfill-listing-videos.mjs --limit 25                          # dry run, Active, newest-modified first
 *   node scripts/backfill-listing-videos.mjs --limit 25 --execute
 */
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolvingNodeModules } from './lib/resolve-node-modules.mjs'
import { createClient } from '@supabase/supabase-js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

// ── env (.env.local, without clobbering an already-set env) ─────────────────
const envPath = join(ROOT, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[m[1]] == null) process.env[m[1]] = v
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SPARK_KEY = (process.env.SPARK_API_KEY || '').trim()
const SPARK_BASE = (process.env.SPARK_API_BASE_URL || 'https://sparkapi.com/v1').replace(/\/$/, '')
if (!SUPABASE_URL || !SERVICE_KEY || !SPARK_KEY) {
  console.error('Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SPARK_API_KEY)')
  process.exit(1)
}

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const EXECUTE = argv.includes('--execute')
const UNDERSTAND_COST = argv.includes('--i-understand-the-cost')
const flagVal = (name) => {
  const eq = argv.find((a) => a.startsWith(`${name}=`))
  if (eq) return eq.split('=')[1]
  const i = argv.indexOf(name)
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1]
  return null
}
const LIST_NUMBERS_ARG = flagVal('--list-numbers')
const LIMIT_ARG = Number(flagVal('--limit') ?? 0) || 0
const SAFETY_CAP = 200

if (!LIST_NUMBERS_ARG && LIMIT_ARG === 0) {
  console.error(
    'Refusing to run with no bound: pass --list-numbers <csv> (safest — an explicit, known sample) ' +
      'or --limit <n> (bounded scan of Active listings). SITE-154: never a full-market pass from a sandbox.',
  )
  process.exit(1)
}
if (LIMIT_ARG > SAFETY_CAP && !UNDERSTAND_COST) {
  console.error(`--limit ${LIMIT_ARG} exceeds the ${SAFETY_CAP} safety cap. Pass --i-understand-the-cost to override.`)
  process.exit(1)
}

// ── canonical mapper (esbuild-bundled from lib/listing-mapper.ts — the SAME
//    extractListingVideoRows the scheduled delta sync now uses) ────────────
async function loadMapper() {
  const dir = mkdtempSync(join(tmpdir(), 'rr-video-mapper-'))
  const out = join(dir, 'listing-mapper.mjs')
  try {
    execFileSync(
      join(resolvingNodeModules(), '.bin/esbuild'),
      [join(ROOT, 'lib/listing-mapper.ts'), '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error'],
      { stdio: 'pipe' },
    )
    return await import(pathToFileURL(out).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchSparkListNumbers(listNumbers) {
  const clauses = listNumbers.map((n) => `ListingId Eq '${n.replace(/'/g, "''")}'`).join(' Or ')
  const filter = listNumbers.length > 1 ? `(${clauses})` : clauses
  const params = new URLSearchParams()
  params.set('_pagination', '1')
  params.set('_limit', String(Math.min(200, listNumbers.length)))
  params.set('_expand', 'Videos,VirtualTours')
  const url = `${SPARK_BASE}/listings?${params.toString()}&_filter=${encodeURIComponent(filter)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${SPARK_KEY}`, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Spark API error ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  if (data.D?.Errors?.length) throw new Error(`Spark API errors: ${JSON.stringify(data.D.Errors)}`)
  return data.D?.Results ?? []
}

async function fetchSparkActivePage(page, limit) {
  const params = new URLSearchParams()
  params.set('_pagination', '1')
  params.set('_limit', String(limit))
  params.set('_page', String(page))
  params.set('_expand', 'Videos,VirtualTours')
  params.set('_orderby', '-ModificationTimestamp')
  const url = `${SPARK_BASE}/listings?${params.toString()}&_filter=${encodeURIComponent("StandardStatus Eq 'Active'")}`
  const doFetch = () => fetch(url, { headers: { Authorization: `Bearer ${SPARK_KEY}`, Accept: 'application/json' } })
  let res = await doFetch()
  if (res.status === 429) {
    console.warn('  [spark] 429 rate limited, waiting 60s then retrying once')
    await sleep(60_000)
    res = await doFetch()
  }
  if (!res.ok) throw new Error(`Spark API error ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  if (data.D?.Errors?.length) throw new Error(`Spark API errors: ${JSON.stringify(data.D.Errors)}`)
  return data.D?.Results ?? []
}

async function main() {
  const mapper = await loadMapper()
  const { extractListingVideoRows, redactPublicDetails } = mapper

  console.log(
    `backfill-listing-videos — ${EXECUTE ? 'EXECUTE (real writes)' : 'DRY RUN (no writes)'}` +
      (LIST_NUMBERS_ARG ? `, list-numbers=${LIST_NUMBERS_ARG}` : `, limit=${LIMIT_ARG} Active listings, newest-modified first`),
  )
  console.log(`Date: ${new Date().toISOString()}`)

  let sparkResults
  if (LIST_NUMBERS_ARG) {
    const listNumbers = LIST_NUMBERS_ARG.split(',').map((s) => s.trim()).filter(Boolean)
    sparkResults = await fetchSparkListNumbers(listNumbers)
    console.log(`Requested ${listNumbers.length} ListNumbers from Spark, got ${sparkResults.length} back.`)
  } else {
    sparkResults = await fetchSparkActivePage(1, LIMIT_ARG)
    console.log(`Fetched ${sparkResults.length} Active listings from Spark (page 1, limit ${LIMIT_ARG}).`)
  }

  let checked = 0
  let videoRowsBefore = 0
  let videoRowsAfter = 0
  let detailsPatched = 0
  let hvtCorrected = 0
  let listingVideosWritten = 0
  let skippedNoDbRow = 0
  let skippedUpToDate = 0

  for (const result of sparkResults) {
    checked++
    const fields = result.StandardFields ?? {}
    const listNumber = String(fields.ListingId ?? fields.ListNumber ?? '').trim()
    if (!listNumber) continue

    const { data: dbRow, error: readErr } = await sb
      .from('listings')
      .select('ListNumber, ListingKey, details, has_virtual_tour')
      .eq('ListNumber', listNumber)
      .maybeSingle()
    if (readErr) {
      console.error(`  [${listNumber}] DB read error: ${readErr.message}`)
      continue
    }
    if (!dbRow) {
      skippedNoDbRow++
      console.log(`  [${listNumber}] no DB row yet (not synced) — skipped, the regular sync will pick it up`)
      continue
    }

    const listingKey = String(dbRow.ListingKey ?? listNumber).trim()
    const existingDetails = (dbRow.details && typeof dbRow.details === 'object') ? dbRow.details : {}
    const newVideos = Array.isArray(fields.Videos) ? fields.Videos : []
    const newTours = Array.isArray(fields.VirtualTours) ? fields.VirtualTours : []
    const newHasVirtualTour = newVideos.length > 0

    const { data: beforeRows } = await sb.from('listing_videos').select('id').eq('listing_key', listingKey)
    videoRowsBefore += beforeRows?.length ?? 0

    const detailsChanged =
      JSON.stringify(existingDetails.Videos ?? null) !== JSON.stringify(newVideos.length ? newVideos : null) ||
      JSON.stringify(existingDetails.VirtualTours ?? null) !== JSON.stringify(newTours.length ? newTours : null)
    const hvtChanged = Boolean(dbRow.has_virtual_tour) !== newHasVirtualTour

    if (!detailsChanged && !hvtChanged) {
      skippedUpToDate++
      console.log(`  [${listNumber}] already up to date (details.Videos + has_virtual_tour match Spark) — skipped`)
    } else {
      console.log(
        `  [${listNumber}] STALE — details ${detailsChanged ? 'CHANGED' : 'ok'}, has_virtual_tour ${
          hvtChanged ? `${dbRow.has_virtual_tour} -> ${newHasVirtualTour}` : 'ok'
        }`,
      )
      if (EXECUTE) {
        const mergedDetails = redactPublicDetails({
          ...existingDetails,
          Videos: newVideos,
          VirtualTours: newTours,
        })
        const { error: updErr } = await sb
          .from('listings')
          .update({ details: mergedDetails, has_virtual_tour: newHasVirtualTour })
          .eq('ListNumber', listNumber)
        if (updErr) {
          console.error(`    update error: ${updErr.message}`)
          continue
        }
        detailsPatched += detailsChanged ? 1 : 0
        hvtCorrected += hvtChanged ? 1 : 0
      }
    }

    // listing_videos rewrite — same extraction the scheduled sync uses.
    const videoRows = extractListingVideoRows(listingKey, { Videos: newVideos })
    if (EXECUTE) {
      const { error: delErr } = await sb.from('listing_videos').delete().eq('listing_key', listingKey)
      if (delErr) {
        console.error(`    listing_videos delete error: ${delErr.message}`)
        continue
      }
      if (videoRows.length > 0) {
        const { error: insErr } = await sb.from('listing_videos').insert(videoRows)
        if (insErr) {
          console.error(`    listing_videos insert error: ${insErr.message}`)
          continue
        }
      }
      listingVideosWritten += videoRows.length
    }

    if (EXECUTE) {
      const { data: afterRows } = await sb
        .from('listing_videos')
        .select('id')
        .eq('listing_key', listingKey)
      videoRowsAfter += afterRows?.length ?? 0
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Checked:              ${checked}`)
  console.log(`No DB row (skipped):  ${skippedNoDbRow}`)
  console.log(`Already up to date:   ${skippedUpToDate}`)
  console.log(`details patched:      ${EXECUTE ? detailsPatched : '(dry run — see STALE lines above)'}`)
  console.log(`has_virtual_tour fix: ${EXECUTE ? hvtCorrected : '(dry run)'}`)
  console.log(`listing_videos rows written: ${EXECUTE ? listingVideosWritten : '(dry run)'}`)
  if (EXECUTE) {
    console.log(`listing_videos row count for these keys — before: ${videoRowsBefore}, after: ${videoRowsAfter}`)
  } else {
    console.log(`listing_videos row count for these keys right now: ${videoRowsBefore} (pass --execute to write)`)
  }
  if (!EXECUTE) console.log('\nDry run only — pass --execute to write.')
}

main().catch((err) => {
  console.error('FATAL', err)
  process.exit(1)
})
