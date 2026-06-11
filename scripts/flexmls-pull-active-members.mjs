#!/usr/bin/env node
/**
 * Pull every active Central Oregon MLS member (broker / agent) from the Spark
 * Platform API (FlexMLS / Oregon Data Share) and save them to a local cache.
 *
 * This is the canonical list of currently-licensed, currently-active
 * Central Oregon real estate professionals — far more accurate for our
 * "exclude realtors from outreach" purpose than the broader OREA license
 * registry (which includes property managers, timeshare agents, inactive
 * licensees, etc).
 *
 * The Spark API returns ALL Oregon members (Oregon Data Share serves 3
 * boards: Cascade East Association of Realtors = Bend/Redmond/Sisters area,
 * Rogue Valley, Klamath County). We pull everyone and filter client-side.
 *
 * Output: out/westside-bend-merge/flexmls_members.json
 *   {
 *     fetchedAt,
 *     totalAccounts,
 *     activeCascadeEastMembers,
 *     members: [{ id, firstName, lastName, office, localType, associations,
 *                 licenseNumber, idxParticipant, addresses, phones, emails }]
 *   }
 *
 * Usage:
 *   node --env-file=.env.local scripts/flexmls-pull-active-members.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUTDIR = resolve(ROOT, 'out/westside-bend-merge')
const OUT = resolve(OUTDIR, 'flexmls_members.json')

const BASE = (process.env.SPARK_API_BASE_URL || '').trim()
const KEY = (process.env.SPARK_API_KEY || '').trim()
if (!BASE || !KEY) {
  console.error('Missing SPARK_API_BASE_URL or SPARK_API_KEY in .env.local')
  process.exit(1)
}

const HEADERS = { Authorization: `Bearer ${KEY}`, Accept: 'application/json' }
const FILTER = "UserType Eq 'Member' And (Visible Eq true Or Visible Eq false)"
const SELECT = [
  'Id', 'FirstName', 'MiddleName', 'LastName', 'Name',
  'LocalType', 'Active', 'Office', 'OfficeId', 'Company',
  'LicenseNumber', 'NrdsId', 'Associations', 'IdxParticipant',
  'Mls', 'ModificationTimestamp',
  'Phones', 'Emails', 'Addresses',
].join(',')
const PAGE = 500

const COAR_ASSOCIATION = 'Cascade East Association of Realtors'
const KEEP_LOCAL_TYPES = new Set([
  'REALTOR',
  'Designated REALTOR',
  // Edge cases — keep but flagged
  'MLS Only SalesPerson',
  'Non-Member Salespersons',
])

function isRelevantMember(m) {
  if (!m) return false
  if (!m.Active) return false
  const assoc = Array.isArray(m.Associations) ? m.Associations : []
  if (!assoc.some((a) => String(a).toLowerCase() === COAR_ASSOCIATION.toLowerCase())) return false
  const lt = String(m.LocalType || '').trim()
  if (!KEEP_LOCAL_TYPES.has(lt)) return false
  if (!m.FirstName || !m.LastName) return false
  return true
}

async function main() {
  await mkdir(OUTDIR, { recursive: true })

  console.log('[flexmls] starting Spark members pull')
  const all = []
  const t0 = Date.now()
  let skip = 0
  let page = 0
  let totalSeen = 0
  let totalCoarActive = 0

  while (true) {
    const url = `${BASE}/accounts?_filter=${encodeURIComponent(FILTER)}&_limit=${PAGE}&_skip=${skip}&_select=${encodeURIComponent(SELECT)}`
    const r = await fetch(url, { headers: HEADERS })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      console.error(`[flexmls] HTTP ${r.status} at skip=${skip}: ${t.slice(0, 200)}`)
      break
    }
    const data = await r.json()
    const batch = data?.D?.Results || []
    if (batch.length === 0) break

    totalSeen += batch.length
    for (const m of batch) {
      if (isRelevantMember(m)) {
        totalCoarActive += 1
        all.push({
          id: m.Id,
          firstName: m.FirstName || '',
          middleName: m.MiddleName || '',
          lastName: m.LastName || '',
          fullName: m.Name || `${m.FirstName} ${m.LastName}`,
          office: m.Office || '',
          officeId: m.OfficeId || '',
          company: m.Company || '',
          licenseNumber: m.LicenseNumber || '',
          nrdsId: m.NrdsId || '',
          localType: m.LocalType || '',
          associations: m.Associations || [],
          idxParticipant: !!m.IdxParticipant,
          modifiedAt: m.ModificationTimestamp || '',
          phones: (m.Phones || []).map((p) => ({ type: p.Type, number: p.Number, primary: !!p.Primary })),
          emails: (m.Emails || []).map((e) => ({ type: e.Type, address: e.Address, primary: !!e.Primary })),
          addresses: (m.Addresses || []).map((a) => ({
            type: a.Type,
            street: a.Address || a.Street || '',
            city: a.City || '',
            state: a.State || a.StateOrProvince || '',
            postalCode: a.PostalCode || '',
            primary: !!a.Primary,
          })),
        })
      }
    }
    page += 1
    skip += batch.length

    if (page % 5 === 0 || batch.length < PAGE) {
      console.log(`[flexmls] page=${page} totalSeen=${totalSeen} coarActive=${totalCoarActive}`)
    }
    if (batch.length < PAGE) break
    await new Promise((res) => setTimeout(res, 200))
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    totalAccountsScanned: totalSeen,
    activeCascadeEastMembers: all.length,
    filterCriteria: {
      userType: 'Member',
      active: true,
      association: COAR_ASSOCIATION,
      localTypes: [...KEEP_LOCAL_TYPES],
    },
    members: all,
  }
  await writeFile(OUT, JSON.stringify(payload, null, 0), 'utf8')

  const sec = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[flexmls] DONE. scanned=${totalSeen} kept=${all.length} (${sec}s) → ${OUT}`)

  const byOffice = {}
  for (const m of all) byOffice[m.office] = (byOffice[m.office] || 0) + 1
  console.log('[flexmls] Top brokerages (Cascade East active):')
  for (const [k, v] of Object.entries(byOffice).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(k).slice(0, 60).padEnd(60)} ${v}`)
  }
}

main().catch((err) => {
  console.error('[flexmls] FATAL:', err.message)
  console.error(err.stack)
  process.exit(1)
})
