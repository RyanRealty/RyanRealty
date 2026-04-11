#!/usr/bin/env node
/**
 * Read tmp/geocode-easy-progress.json and print geocode batch status (ETA, counts, last 3 updates).
 *
 *   node scripts/geocode-easy-progress-report.mjs
 *   node scripts/geocode-easy-progress-report.mjs --json
 *
 * Env not required (reads local progress file only).
 */

import fs from 'fs'
import path from 'path'

const PROGRESS_FILE = path.join(process.cwd(), 'tmp', 'geocode-easy-progress.json')
const asJson = process.argv.includes('--json')

function fmtDuration(sec) {
  if (sec == null || !Number.isFinite(sec)) return 'n/a'
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.round(sec / 60)} min`
  return `${Math.round((sec / 3600) * 10) / 10} h`
}

function main() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    const empty = { status: 'none', message: 'No progress file. Run geocode batch or tmp/geocode-easy-progress.json missing.' }
    if (asJson) console.log(JSON.stringify(empty, null, 2))
    else console.log(empty.message)
    return
  }

  let raw
  try {
    raw = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'))
  } catch {
    const err = { status: 'error', message: 'Could not parse progress file' }
    if (asJson) console.log(JSON.stringify(err, null, 2))
    else console.log(err.message)
    process.exit(1)
    return
  }

  if (asJson) {
    console.log(JSON.stringify(raw, null, 2))
    return
  }

  const st = raw.stats ?? {}
  const pr = raw.progress ?? {}
  console.log('Geocode easy batch report')
  console.log('-------------------------')
  console.log(`Run id:           ${raw.runId ?? 'n/a'}`)
  console.log(`Status:           ${raw.status ?? 'unknown'}`)
  console.log(`Mode:             ${raw.mode ?? 'n/a'}${raw.dryRun ? ' (dry-run)' : ''}`)
  console.log(`Started:          ${raw.startedAt ?? 'n/a'}`)
  console.log(`Last heartbeat:   ${raw.lastHeartbeatAt ?? 'n/a'}`)
  console.log(`Cohort at start:  ${raw.cohortTotalAtStart ?? 'n/a'} rows (PropertyType A, both coords null)`)
  console.log(`Scanned:          ${st.scanned ?? 0}`)
  console.log(`Updated:          ${st.updated ?? 0}`)
  console.log(`Geocode OK:       ${st.geocode_ok ?? 0}`)
  console.log(`Rejected type:    ${st.reject_location_type ?? 0}`)
  console.log(`Skipped (addr):   ${st.skip ?? 0}`)
  console.log(`No geocode hit:   ${st.geocode_no_result ?? 0}`)
  console.log(`Update errors:    ${st.update_errors ?? 0}`)
  console.log(`Elapsed:          ${pr.elapsedSeconds ?? 'n/a'} s`)
  console.log(`Est. progress:      ${pr.estimatedPercentByUpdates ?? 'n/a'} % (updates in apply mode, geocode OK in dry-run)`)
  console.log(`ETA (by update rate): ${fmtDuration(pr.etaSecondsRemainingByUpdateRate)}`)
  console.log('')
  const last = raw.lastThreeUpdates ?? []
  if (last.length === 0) {
    console.log('Last 3 updates:   (none yet)')
  } else {
    console.log('Last 3 updates:')
    for (const u of last) {
      const dry = u.dryRun ? ' [dry-run]' : ''
      console.log(
        `  - ${u.listNumber}  ${u.city ?? ''}  ${u.locationType ?? ''}  (${u.latitude}, ${u.longitude})  @ ${u.at ?? ''}${dry}`
      )
    }
  }
}

main()
