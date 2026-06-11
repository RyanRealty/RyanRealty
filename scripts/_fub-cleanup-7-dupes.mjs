#!/usr/bin/env node
/**
 * Clean up 7 duplicate FUB contacts from first smoke push (2026-05-27 02:34).
 * Strategy: sync any unique dupe tags → master, then DELETE the dupe.
 * Usage:
 *   node --env-file=.env.local scripts/_fub-cleanup-7-dupes.mjs --dry-run
 *   node --env-file=.env.local scripts/_fub-cleanup-7-dupes.mjs --apply
 */
const PAIRS = [
  { dupe: 26932, master: 22108, name: 'Daniel Wachsnicht' },
  { dupe: 26931, master: 22107, name: 'Douglas Smith' },
  { dupe: 26930, master: 22106, name: 'Amy Hunter' },
  { dupe: 26929, master: 22105, name: 'Jessica Salisbury' },
  { dupe: 26928, master: 22104, name: 'William Carwile' },
  { dupe: 26927, master: 22103, name: 'Jon Borsting' },
  { dupe: 26926, master: 22102, name: 'Dennis Oshea' },
]

const FUB_KEY = (process.env.FOLLOWUPBOSS_API_KEY || '').trim()
if (!FUB_KEY) { console.error('Missing FOLLOWUPBOSS_API_KEY'); process.exit(1) }
const AUTH = `Basic ${Buffer.from(`${FUB_KEY}:`).toString('base64')}`
const apply = process.argv.includes('--apply')

async function fubGet(path) {
  const r = await fetch(`https://api.followupboss.com/v1${path}`, { headers: { Authorization: AUTH, Accept: 'application/json' } })
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}: ${(await r.text()).slice(0,200)}`)
  return r.json()
}
async function fubPut(path, body) {
  const r = await fetch(`https://api.followupboss.com/v1${path}`, {
    method: 'PUT', headers: { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`PUT ${path} → ${r.status}: ${(await r.text()).slice(0,200)}`)
  return r.json()
}
async function fubDelete(path) {
  const r = await fetch(`https://api.followupboss.com/v1${path}`, {
    method: 'DELETE', headers: { Authorization: AUTH, Accept: 'application/json' },
  })
  if (!r.ok && r.status !== 204) throw new Error(`DELETE ${path} → ${r.status}: ${(await r.text()).slice(0,200)}`)
  return r.status
}

const summary = []
for (const { dupe, master, name } of PAIRS) {
  const [d, m] = await Promise.all([fubGet(`/people/${dupe}`), fubGet(`/people/${master}`)])
  const dTags = new Set(d.tags || [])
  const mTags = new Set(m.tags || [])
  const uniqueDupeTags = [...dTags].filter((t) => !mTags.has(t))
  const merged = [...new Set([...(m.tags || []), ...uniqueDupeTags])]

  const row = {
    pair: `${dupe}→${master}`, name,
    dupeTags: dTags.size, masterTags: mTags.size,
    uniqueOnDupe: uniqueDupeTags.length,
    mergedTotal: merged.length,
    action: apply ? 'PENDING' : 'DRY-RUN',
  }
  summary.push(row)

  if (apply) {
    if (uniqueDupeTags.length) {
      await fubPut(`/people/${master}`, { tags: merged })
    }
    const status = await fubDelete(`/people/${dupe}`)
    row.action = `MERGED-${uniqueDupeTags.length}-tags + DELETED (${status})`
    await new Promise((r) => setTimeout(r, 250))
  }
}
console.table(summary)
console.log(`\nMode: ${apply ? 'APPLIED' : 'DRY-RUN'} — ${PAIRS.length} pairs processed.`)
