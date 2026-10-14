/**
 * How far the CRM county homeowner check reaches (Matt 2026-10-14).
 *
 *   npx tsx --conditions=react-server scripts/_county-ownership-reach.ts [sampleSize]
 *
 * 1. measureCountyOwnershipReach: how many contacts carry a usable name or
 *    street address (the DAL pages crm_people; nothing is aggregated here in SQL).
 * 2. getCountyOwnershipForPerson on an evenly spaced sample of searchable
 *    contacts, live county reads, no cache.
 *
 * Prints counts only. No name, address or id of a contact is printed.
 * Read-only: Supabase reads and public county GETs.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=')
  if (i > 0 && !line.startsWith('#') && process.env[line.slice(0, i).trim()] === undefined) {
    process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '')
  }
}

async function main() {
  const { measureCountyOwnershipReach } = await import('../lib/data/crm/countyOwnershipReach')
  const { getCountyOwnershipForPerson } = await import('../lib/data/crm/getCountyOwnership')
  const sampleSize = Number(process.argv[2] ?? 50)

  const reach = await measureCountyOwnershipReach(sampleSize)
  console.log(`crm_people read ${reach.readAt}`)
  console.log(`  contacts (deleted = false)          ${reach.contacts}`)
  console.log(`  with a first and last name          ${reach.withFullName}`)
  console.log(`  with a street address               ${reach.withStreetAddress}`)
  console.log(`  with an Oregon street address       ${reach.withOregonStreetAddress}`)
  console.log(`  searchable (name or street address) ${reach.searchable}`)

  const tally = { sampled: 0, high: 0, mediumOnly: 0, residentOnly: 0, none: 0, failed: 0 }
  const rows = { high: 0, medium: 0, resident: 0, live: 0, export: 0, withFigures: 0 }
  const county = { deschutesUnavailable: 0, crookUnavailable: 0, truncated: 0 }
  const queue = [...reach.sampleIds]
  async function worker() {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      tally.sampled++
      try {
        const out = await getCountyOwnershipForPerson(id, { cache: false })
        for (const c of out.counties) {
          if (c.status === 'unavailable') county[c.county === 'deschutes' ? 'deschutesUnavailable' : 'crookUnavailable']++
          if (c.truncated) county.truncated++
        }
        for (const r of out.rows) {
          rows[r.strength]++
          if (r.sourceIsLive) rows.live++
          else rows.export++
          if (r.figures) rows.withFigures++
        }
        const s = new Set(out.rows.map((r) => r.strength))
        if (s.has('high')) tally.high++
        else if (s.has('medium')) tally.mediumOnly++
        else if (s.has('resident')) tally.residentOnly++
        else tally.none++
      } catch (err) {
        tally.failed++
        console.warn('  a sample read failed:', err instanceof Error ? err.message : String(err))
      }
    }
  }
  await Promise.all([worker(), worker(), worker()])

  console.log(`\nsample of ${tally.sampled} searchable contacts, evenly spaced by id`)
  console.log(`  owner of record (high) on at least one parcel   ${tally.high}`)
  console.log(`  name match only (medium), no high               ${tally.mediumOnly}`)
  console.log(`  their address, someone else on record, only     ${tally.residentOnly}`)
  console.log(`  nothing found                                   ${tally.none}`)
  console.log(`  read failed                                     ${tally.failed}`)
  console.log(`rows: high ${rows.high}, medium ${rows.medium}, resident ${rows.resident}; live ${rows.live}, export ${rows.export}; with export figures ${rows.withFigures}`)
  console.log(`county reads: Deschutes unavailable ${county.deschutesUnavailable}, Crook unavailable ${county.crookUnavailable}, truncated ${county.truncated}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
