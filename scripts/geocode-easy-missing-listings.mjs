#!/usr/bin/env node
/**
 * Geocode "easy" listings missing Latitude/Longitude.
 *
 * Criteria:
 * - PropertyType = 'A' (residential)
 * - Both Latitude and Longitude null
 * - Non-empty StreetNumber, StreetName, City, State, PostalCode
 * - Google Geocoding OK; location_type must be in the allowed set (see --more-coverage)
 *
 * Pagination uses keyset (ListNumber) so rows that drop out of the filter after update
 * are not skipped (offset pagination would skip rows).
 *
 * Usage:
 *   node --env-file=.env.local scripts/geocode-easy-missing-listings.mjs --dry-run --limit 50
 *   node --env-file=.env.local scripts/geocode-easy-missing-listings.mjs --apply
 *   node --env-file=.env.local scripts/geocode-easy-missing-listings.mjs --apply --more-coverage
 *
 * --more-coverage: also accept Google geometry.location_type APPROXIMATE and GEOMETRIC_CENTER (wider pin accuracy).
 *
 * Progress (npm run geocode:easy-missing:report):
 *   tmp/geocode-easy-progress.json  (gitignored via tmp/)
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * Optional: GEOCODE_EASY_DELAY_MS (default 120), GEOCODE_EASY_PROGRESS_MS (default 2000) min interval between progress file writes
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'
const PAGE_SIZE = 250
const PROGRESS_DIR = path.join(process.cwd(), 'tmp')
const PROGRESS_FILE = path.join(PROGRESS_DIR, 'geocode-easy-progress.json')

const LOCATION_TYPES_STRICT = new Set(['ROOFTOP', 'RANGE_INTERPOLATED'])
const LOCATION_TYPES_MORE = new Set(['ROOFTOP', 'RANGE_INTERPOLATED', 'GEOMETRIC_CENTER', 'APPROXIMATE'])

function argFlag(name) {
  return process.argv.includes(`--${name}`)
}

function argValue(name, fallback) {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i === -1) return fallback
  return process.argv[i + 1] ?? fallback
}

function nonempty(s) {
  return typeof s === 'string' && s.trim().length > 0
}

function buildAddress(row) {
  const line1 = [row.StreetNumber, row.StreetName].filter(nonempty).join(' ').trim()
  const line2 = [row.City, row.State, row.PostalCode].filter(nonempty).join(' ').trim()
  return [line1, line2].filter(Boolean).join(', ')
}

async function geocodeRow(apiKey, row, acceptLocationTypes) {
  const address = buildAddress(row)
  if (!address.replace(/,/g, '').trim()) {
    return { status: 'skip', reason: 'empty_address' }
  }
  const params = new URLSearchParams({
    address,
    key: apiKey,
    region: 'us',
  })
  const res = await fetch(`${GEOCODE_URL}?${params.toString()}`)
  const data = await res.json()

  if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'REQUEST_DENIED') {
    return { status: 'fatal', reason: data.status, error_message: data.error_message }
  }
  if (data.status !== 'OK' || !data.results?.length) {
    return { status: 'no_result', reason: data.status ?? 'UNKNOWN' }
  }
  const first = data.results[0]
  const locType = first.geometry?.location_type ?? ''
  if (!acceptLocationTypes.has(locType)) {
    return { status: 'reject_location_type', reason: locType || 'MISSING' }
  }
  const { lat, lng } = first.geometry?.location ?? {}
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { status: 'bad_coords' }
  }
  return { status: 'ok', lat, lng, location_type: locType }
}

function ensureProgressDir() {
  fs.mkdirSync(PROGRESS_DIR, { recursive: true })
}

function computeEtaSeconds(stats, cohortTotal, startedAtMs, dryRun) {
  const elapsedSec = (Date.now() - startedAtMs) / 1000
  if (elapsedSec < 1) return null
  const basis = dryRun ? stats.geocode_ok : stats.updated
  if (basis < 5) return null
  const rate = basis / elapsedSec
  if (rate <= 0) return null
  const remaining = Math.max(0, cohortTotal - basis)
  return Math.round(remaining / rate)
}

function writeProgress(payload) {
  ensureProgressDir()
  const tmp = `${PROGRESS_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8')
  fs.renameSync(tmp, PROGRESS_FILE)
}

async function main() {
  const dryRun = argFlag('dry-run') || !argFlag('apply')
  const moreCoverage = argFlag('more-coverage')
  const acceptLocationTypes = moreCoverage ? LOCATION_TYPES_MORE : LOCATION_TYPES_STRICT
  const limitRaw = argValue('limit', '0')
  const maxRows = Number.parseInt(limitRaw, 10)
  const maxTotal = Number.isFinite(maxRows) && maxRows > 0 ? maxRows : Infinity

  const delayMs = Math.max(
    0,
    Number.parseInt(process.env.GEOCODE_EASY_DELAY_MS ?? '120', 10) || 120
  )
  const progressMinMs = Math.max(
    500,
    Number.parseInt(process.env.GEOCODE_EASY_PROGRESS_MS ?? '2000', 10) || 2000
  )

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  if (!apiKey?.trim()) {
    console.error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { count: cohortCount, error: countErr } = await supabase
    .from('listings')
    .select('ListNumber', { count: 'exact', head: true })
    .is('Latitude', null)
    .is('Longitude', null)
    .eq('PropertyType', 'A')

  if (countErr) {
    console.error('[count]', countErr.message)
    process.exit(1)
  }

  const cohortTotalAtStart = cohortCount ?? 0
  const startedAtMs = Date.now()
  const runId = `${startedAtMs}-${moreCoverage ? 'more' : 'strict'}-${dryRun ? 'dry' : 'apply'}`

  const stats = {
    scanned: 0,
    geocode_ok: 0,
    geocode_no_result: 0,
    reject_location_type: 0,
    skip: 0,
    updated: 0,
    update_errors: 0,
    fatal: 0,
  }

  const lastThreeUpdates = []
  let lastProgressWrite = 0
  let afterListNumber = null

  function pushUpdate(entry) {
    lastThreeUpdates.unshift(entry)
    while (lastThreeUpdates.length > 3) lastThreeUpdates.pop()
  }

  function emitProgress(status) {
    const etaSeconds = computeEtaSeconds(stats, cohortTotalAtStart, startedAtMs, dryRun)
    const elapsedSeconds = Math.round((Date.now() - startedAtMs) / 1000)
    const basisPct = dryRun ? stats.geocode_ok : stats.updated
    const pct =
      cohortTotalAtStart > 0
        ? Math.min(100, Math.round((basisPct / cohortTotalAtStart) * 10000) / 100)
        : null
    const payload = {
      runId,
      status,
      startedAt: new Date(startedAtMs).toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      mode: moreCoverage ? 'more_coverage' : 'strict',
      dryRun,
      cohortTotalAtStart,
      afterListNumber,
      stats: { ...stats },
      lastThreeUpdates: [...lastThreeUpdates],
      progress: {
        elapsedSeconds,
        estimatedPercentByUpdates: pct,
        etaSecondsRemainingByUpdateRate: etaSeconds,
        note:
          dryRun
            ? 'Dry run ETA uses geocode_ok successes vs cohort size at start (approximate).'
            : 'ETA uses successful DB updates per second so far; skips and API errors change actual time.',
      },
    }
    writeProgress(payload)
  }

  console.log(
    dryRun
      ? '[dry-run] No database writes. Pass --apply to update listings.'
      : `[apply] Writes when Google returns: ${[...acceptLocationTypes].join(', ')}`
  )
  if (moreCoverage) {
    console.log('[config] --more-coverage includes APPROXIMATE and GEOMETRIC_CENTER (less precise pins).')
  }
  console.log(
    `[config] cohort candidates (A, both coords null): ${cohortTotalAtStart}, delay ${delayMs}ms, page ${PAGE_SIZE}, max rows: ${maxTotal}`
  )
  console.log(`[config] progress file: ${PROGRESS_FILE}`)

  emitProgress('running')

  try {
    while (stats.scanned < maxTotal && stats.fatal === 0) {
      const remaining = maxTotal === Infinity ? PAGE_SIZE : maxTotal - stats.scanned
      const take = Math.min(PAGE_SIZE, remaining)

      let q = supabase
        .from('listings')
        .select('ListNumber, StreetNumber, StreetName, City, State, PostalCode, Latitude, Longitude')
        .is('Latitude', null)
        .is('Longitude', null)
        .eq('PropertyType', 'A')
        .order('ListNumber', { ascending: true })
        .limit(take)

      if (afterListNumber) {
        q = q.gt('ListNumber', afterListNumber)
      }

      const { data, error } = await q
      if (error) {
        console.error('[query]', error.message)
        stats.fatal += 1
        break
      }
      const rows = data ?? []
      if (rows.length === 0) break

      for (const row of rows) {
        if (stats.scanned >= maxTotal) break

        if (
          !nonempty(row.StreetNumber) ||
          !nonempty(row.StreetName) ||
          !nonempty(row.City) ||
          !nonempty(row.State) ||
          !nonempty(row.PostalCode)
        ) {
          stats.skip += 1
          stats.scanned += 1
          continue
        }

        const g = await geocodeRow(apiKey, row, acceptLocationTypes)
        if (g.status === 'fatal') {
          console.error('[fatal]', g.reason, g.error_message ?? '')
          stats.fatal += 1
          break
        }
        if (g.status === 'skip') {
          stats.skip += 1
        } else if (g.status === 'no_result' || g.status === 'bad_coords') {
          stats.geocode_no_result += 1
        } else if (g.status === 'reject_location_type') {
          stats.reject_location_type += 1
        } else if (g.status === 'ok') {
          stats.geocode_ok += 1
          if (!dryRun) {
            const { error: upErr } = await supabase
              .from('listings')
              .update({ Latitude: g.lat, Longitude: g.lng })
              .eq('ListNumber', row.ListNumber)
            if (upErr) {
              console.error('[update]', row.ListNumber, upErr.message)
              stats.update_errors += 1
            } else {
              stats.updated += 1
              pushUpdate({
                listNumber: row.ListNumber,
                city: row.City,
                latitude: g.lat,
                longitude: g.lng,
                locationType: g.location_type,
                at: new Date().toISOString(),
              })
            }
          } else {
            pushUpdate({
              listNumber: row.ListNumber,
              city: row.City,
              latitude: g.lat,
              longitude: g.lng,
              locationType: g.location_type,
              at: new Date().toISOString(),
              dryRun: true,
            })
          }
        }

        stats.scanned += 1
        afterListNumber = row.ListNumber

        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))

        const now = Date.now()
        if (stats.scanned % 100 === 0) {
          console.log('[progress]', { ...stats, afterListNumber })
        }
        if (now - lastProgressWrite >= progressMinMs) {
          lastProgressWrite = now
          emitProgress('running')
        }
      }

      if (rows.length < take) break
    }

    console.log('[done]', stats)
    emitProgress(stats.fatal ? 'failed' : 'completed')
  } catch (e) {
    console.error(e)
    emitProgress('failed')
    throw e
  }

  if (stats.fatal) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
