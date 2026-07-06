/**
 * CRM contact deduper. Builds high-confidence duplicate clusters and merges each
 * into one survivor via the SHARED lib/crm/merge-people core (same code the UI
 * merge uses) — so notes/convos + every person-keyed row move, the loser's
 * emails/phones/tags/custom union onto the survivor, and owned parcels
 * consolidate (multi-property recorded properly).
 *
 * Confidence tiers (a person only merges when we are sure it is the SAME person):
 *   T1  same normalized full name AND a shared email or phone
 *   T2  same owner identity (owner1 name + mailing address) across westside parcels
 * Overlapping clusters are unioned (union-find). Cross-broker clusters are skipped
 * (scope: Matt's book by default). Preview-first; --apply backs up then merges.
 *
 *   npx tsx scripts/_crm-dedupe.ts            # preview
 *   npx tsx scripts/_crm-dedupe.ts --apply    # back up + merge
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { mergePeopleCore } from '../lib/crm/merge-people'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--apply')
const ONLY_BROKERS = new Set(['matt', '', 'unassigned']) // scope: Matt + unassigned farm imports
const env: Record<string, string> = {}
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim()
}
const sb: SupabaseClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const normName = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const normPhone = (s: string) => { const d = (s || '').replace(/[^0-9]/g, ''); return d.length >= 10 ? d.slice(-10) : '' }
const normEmail = (s: string) => (s || '').trim().toLowerCase()

type Person = { id: number; name: string; email: string; phone: string; broker: string; created: string | null; contacts: number }

async function pull<T>(table: string, cols: string, tune?: (q: any) => any): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(cols).range(from, from + 999)
    if (tune) q = tune(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data as T[]))
    if (data.length < 1000) break
  }
  return out
}

// ── union-find ───────────────────────────────────────────────────────────────
const parent = new Map<number, number>()
const find = (x: number): number => { let r = x; while (parent.get(r)! !== r) r = parent.get(r)!; while (parent.get(x)! !== r) { const n = parent.get(x)!; parent.set(x, r); x = n } return r }
const ensure = (x: number) => { if (!parent.has(x)) parent.set(x, x) }
const union = (a: number, b: number) => { ensure(a); ensure(b); parent.set(find(a), find(b)) }

async function main() {
console.log('loading contacts + parcels...')
const raw = await pull<any>('crm_people', 'id,name,emails,phones,assigned_broker,fub_created_at', (q) => q.eq('deleted', false))
const people = new Map<number, Person>()
for (const r of raw) {
  const emails = Array.isArray(r.emails) ? r.emails : []
  const phones = Array.isArray(r.phones) ? r.phones : []
  people.set(Number(r.id), {
    id: Number(r.id), name: normName(r.name), broker: (r.assigned_broker ?? '') || '',
    email: normEmail(emails[0]?.value ?? ''), phone: normPhone(phones[0]?.value ?? ''),
    created: r.fub_created_at ?? null, contacts: emails.length + phones.length,
  })
}

// T1: same full name + shared email/phone
const byNameEmail = new Map<string, number[]>()
const byNamePhone = new Map<string, number[]>()
for (const p of people.values()) {
  if (!p.name) continue
  if (p.email) { const k = `${p.name}|${p.email}`; (byNameEmail.get(k) ?? byNameEmail.set(k, []).get(k)!).push(p.id) }
  if (p.phone) { const k = `${p.name}|${p.phone}`; (byNamePhone.get(k) ?? byNamePhone.set(k, []).get(k)!).push(p.id) }
}
for (const ids of [...byNameEmail.values(), ...byNamePhone.values()]) {
  if (ids.length < 2) continue
  for (let i = 1; i < ids.length; i++) union(ids[0], ids[i])
}

// T2: same owner identity (owner1 name + mailing address) across parcels
const parcels = await pull<any>('westside_parcels', 'person_id,owner1_first,owner1_last,mail_street,mail_zip', (q) => q.not('person_id', 'is', null))
const byOwner = new Map<string, Set<number>>()
for (const r of parcels) {
  if (!r.owner1_last || !String(r.owner1_last).trim()) continue
  const okey = `${normName(r.owner1_last)}|${normName(r.owner1_first ?? '')}|${normName(r.mail_street ?? '')}|${(r.mail_zip ?? '').trim()}`
  ;(byOwner.get(okey) ?? byOwner.set(okey, new Set()).get(okey)!).add(Number(r.person_id))
}
for (const set of byOwner.values()) {
  const ids = [...set].filter((id) => people.has(id))
  if (ids.length < 2) continue
  for (let i = 1; i < ids.length; i++) union(ids[0], ids[i])
}

// ── assemble clusters ────────────────────────────────────────────────────────
const clustersMap = new Map<number, number[]>()
for (const id of parent.keys()) { const r = find(id); (clustersMap.get(r) ?? clustersMap.set(r, []).get(r)!).push(id) }
const clusters = [...clustersMap.values()].filter((c) => c.length > 1)

// timeline counts for survivor selection (batch the in-filter)
const allIds = clusters.flat()
const tlCount = new Map<number, number>()
for (let i = 0; i < allIds.length; i += 200) {
  const batch = allIds.slice(i, i + 200)
  const rows = await pull<any>('crm_timeline', 'person_id', (q) => q.in('person_id', batch))
  for (const r of rows) tlCount.set(Number(r.person_id), (tlCount.get(Number(r.person_id)) ?? 0) + 1)
}

const plan: Array<{ survivor: number; losers: number[]; name: string; broker: string }> = []
let skippedCrossBroker = 0, skippedScope = 0
for (const ids of clusters) {
  const members = ids.map((id) => people.get(id)!).filter(Boolean)
  const brokers = new Set(members.map((m) => m.broker))
  if (brokers.size > 1) { skippedCrossBroker++; continue }              // never merge across brokers
  const broker = [...brokers][0]
  if (![...brokers].every((b) => ONLY_BROKERS.has(b))) { skippedScope++; continue } // Matt/unassigned only
  // survivor = most timeline history, then most contact points, then oldest, then lowest id
  const survivor = [...members].sort((a, b) =>
    (tlCount.get(b.id) ?? 0) - (tlCount.get(a.id) ?? 0) ||
    b.contacts - a.contacts ||
    String(a.created ?? '9999').localeCompare(String(b.created ?? '9999')) ||
    a.id - b.id,
  )[0]
  const losers = members.filter((m) => m.id !== survivor.id).map((m) => m.id)
  const nameRow = raw.find((r) => Number(r.id) === survivor.id)
  plan.push({ survivor: survivor.id, losers, name: nameRow?.name ?? `#${survivor.id}`, broker })
}

const totalMerges = plan.reduce((n, c) => n + c.losers.length, 0)
console.log(`\nclusters: ${clusters.length} | mergeable: ${plan.length} | merges (losers): ${totalMerges}`)
console.log(`skipped cross-broker: ${skippedCrossBroker} | skipped out-of-scope: ${skippedScope}`)
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'out', 'dedupe-plan.json'), JSON.stringify(plan, null, 2))
console.log('sample clusters:')
plan.slice(0, 12).forEach((c) => console.log(`  keep #${c.survivor} "${c.name}"  <-  merge ${c.losers.length}: ${c.losers.join(',')}`))

if (!APPLY) { console.log('\nDRY — pass --apply to back up + merge'); process.exit(0) }

// backup full loser rows (+survivor) before mutating
const backupIds = [...new Set(plan.flatMap((c) => [c.survivor, ...c.losers]))]
const backup: any[] = []
for (let i = 0; i < backupIds.length; i += 500) {
  const { data } = await sb.from('crm_people').select('*').in('id', backupIds.slice(i, i + 500))
  backup.push(...(data ?? []))
}
fs.writeFileSync(path.join(ROOT, 'out', 'dedupe-people-backup.json'), JSON.stringify(backup))
console.log(`\nbacked up ${backup.length} rows -> out/dedupe-people-backup.json`)

const actor = { email: 'matt@ryan-realty.com', brokerSlug: 'matt' }
let done = 0, multiProp = 0
const incidents: string[] = []
const results: any[] = []
for (const c of plan) {
  for (const loser of c.losers) {
    const lname = (raw.find((r) => Number(r.id) === loser)?.name) ?? `#${loser}`
    try {
      const res = await mergePeopleCore(sb, { survivorId: c.survivor, mergedId: loser, mergedName: lname, actor })
      results.push({ survivor: c.survivor, loser, properties: res.propertiesOwned, moved: res.repointed, incidents: res.incidents })
      if (res.propertiesOwned > 1) multiProp = Math.max(multiProp, 1)
      if (res.incidents.length) incidents.push(`#${loser}->#${c.survivor}: ${res.incidents.join('; ')}`)
    } catch (e) {
      incidents.push(`#${loser}->#${c.survivor}: FATAL ${(e as Error).message}`)
    }
    if (++done % 25 === 0) console.log(`  ${done}/${totalMerges}`)
  }
}
fs.writeFileSync(path.join(ROOT, 'out', 'dedupe-results.json'), JSON.stringify(results, null, 2))
const multiSurvivors = new Set(results.filter((r) => r.properties > 1).map((r) => r.survivor)).size
console.log(`\nmerged ${done}. multi-property survivors: ${multiSurvivors}. incidents: ${incidents.length}`)
incidents.slice(0, 40).forEach((i) => console.log('  ! ' + i))
console.log('\nresults -> out/dedupe-results.json | backup -> out/dedupe-people-backup.json')
}
main().catch((e) => { console.error(e); process.exit(1) })
