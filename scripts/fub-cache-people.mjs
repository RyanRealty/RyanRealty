#!/usr/bin/env node
/**
 * Cache the entire FollowUp Boss people roster to a single local JSON file.
 *
 * Output: out/fub-cache/people.json
 *   {
 *     fetchedAt: ISO string,
 *     total: number,
 *     people: FubPerson[]
 *   }
 *
 * Pulls the minimal-but-useful field set needed for downstream dedupe + DNC
 * checks: id, name, firstName, lastName, emails, phones, addresses, tags,
 * stage, source, sourceUrl, created, updated, plus a handful of custom
 * property-address fields (used by listing identify + seller flows).
 *
 * Re-run any time you want to refresh the cache. ~13k people takes ~3 min
 * (100 per page, ~130 pages). Safe to re-run; overwrites in place.
 *
 * Usage:
 *   node --env-file=.env.local scripts/fub-cache-people.mjs
 *   node --env-file=.env.local scripts/fub-cache-people.mjs --output custom/path.json
 *   node --env-file=.env.local scripts/fub-cache-people.mjs --max-age-hours 24   # skip refresh if cache is fresh
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DEFAULT_OUT = resolve(ROOT, 'out/fub-cache/people.json')
const FUB_BASE = 'https://api.followupboss.com/v1'
const PAGE_SIZE = 100

const FIELDS = [
  'id',
  'name',
  'firstName',
  'lastName',
  'emails',
  'phones',
  'addresses',
  'tags',
  'stage',
  'source',
  'sourceUrl',
  'created',
  'updated',
  'lastActivity',
  'assignedUserId',
  'customSellerPropertyAddress',
  'customOpenHouseAddress',
  'customMLSNumber',
  'customPurchaseDate',
  'customPurchasePrice',
  'customYearsOwned',
  'customPropertyType',
].join(',')

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i]
    if (!t.startsWith('--')) { out._.push(t); continue }
    const eq = t.indexOf('=')
    if (eq > -1) { out[t.slice(2, eq)] = t.slice(eq + 1); continue }
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) { out[t.slice(2)] = next; i += 1 }
    else { out[t.slice(2)] = true }
  }
  return out
}

async function isFresh(path, maxAgeHours) {
  if (!maxAgeHours) return false
  try {
    const s = await stat(path)
    const ageMs = Date.now() - s.mtimeMs
    return ageMs < maxAgeHours * 60 * 60 * 1000
  } catch { return false }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const outPath = args.output ? resolve(ROOT, String(args.output)) : DEFAULT_OUT
  const maxAgeHours = args['max-age-hours'] ? Number(args['max-age-hours']) : 0

  if (await isFresh(outPath, maxAgeHours)) {
    const existing = JSON.parse(await readFile(outPath, 'utf8'))
    console.log(`[fub-cache] Cache fresh (${maxAgeHours}h window). ${existing.people?.length ?? 0} people, fetched ${existing.fetchedAt}.`)
    return
  }

  const apiKey = (process.env.FOLLOWUPBOSS_API_KEY || '').trim()
  if (!apiKey) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
  const auth = 'Basic ' + Buffer.from(apiKey + ':').toString('base64')
  const headers = { Authorization: auth, Accept: 'application/json' }

  const people = []
  let next = null
  let page = 0
  let total = null
  const t0 = Date.now()

  while (true) {
    const url = next
      ? `${FUB_BASE}/people?limit=${PAGE_SIZE}&next=${next}&fields=${FIELDS}`
      : `${FUB_BASE}/people?limit=${PAGE_SIZE}&fields=${FIELDS}`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`FUB HTTP ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = await res.json()
    const batch = Array.isArray(data.people) ? data.people : []
    if (page === 0) total = data._metadata?.total ?? null
    people.push(...batch)
    page += 1
    next = data._metadata?.next || null

    if (page % 5 === 0 || !next || batch.length === 0) {
      const pct = total ? Math.round((people.length / total) * 100) : null
      console.log(`[fub-cache] page=${page} got=${batch.length} cumulative=${people.length}${total ? `/${total}` : ''}${pct != null ? ` (${pct}%)` : ''}`)
    }

    if (!next || batch.length === 0) break
    // Be polite — small jitter
    await new Promise((r) => setTimeout(r, 60))
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    total: people.length,
    reportedTotal: total,
    people,
  }
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(payload, null, 0), 'utf8')
  const sec = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[fub-cache] DONE. people=${people.length} reported=${total ?? '?'} elapsed=${sec}s out=${outPath}`)
}

main().catch((err) => {
  console.error(`[fub-cache] FATAL: ${err.message}`)
  process.exit(1)
})
