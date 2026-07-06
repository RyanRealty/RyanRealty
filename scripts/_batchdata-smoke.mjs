#!/usr/bin/env node
/**
 * BatchData skip-trace SMOKE TEST — 25 mail-only westside contacts.
 * Validates: API response shape, match rate, compliance flags, cost, AND the
 * write path (empty-only append of phones/emails + TCPA compliance tags, backed
 * up first). Proves the full pipeline before scaling to the ~4,404 mail-only set.
 *
 *   node scripts/_batchdata-smoke.mjs            # call API + report (NO writes)
 *   node scripts/_batchdata-smoke.mjs --write    # also write the 25 (backup first)
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { batchDataSkipTrace } from '../lib/owner-resolution.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const WRITE = process.argv.includes('--write')
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// candidate set: mail-only westside contacts with a person-type parcel + site address
const { data: parcels } = await sb
  .from('westside_parcels')
  .select('person_id,site_street,site_city,site_zip,owner1_first,owner1_last,mail_street,mail_city,mail_state,mail_zip')
  .eq('owner_type', 'person').not('site_street', 'is', null).not('owner1_last', 'is', null).not('person_id', 'is', null)
  .limit(400)
const byPerson = new Map()
for (const p of parcels) if (!byPerson.has(p.person_id)) byPerson.set(p.person_id, p)
const ids = [...byPerson.keys()]
const { data: people } = await sb.from('crm_people').select('id,name,tags,phones,emails,deleted').in('id', ids)
const candidates = people
  .filter((p) => !p.deleted && (!p.phones || p.phones.length === 0) && (!p.emails || p.emails.length === 0))
  .slice(0, 25)
  .map((p) => ({ person: p, parcel: byPerson.get(p.id) }))

console.log(`smoke test: ${candidates.length} mail-only westside contacts → BatchData skip-trace\n`)
const results = []
for (const { person, parcel } of candidates) {
  const trace = await batchDataSkipTrace({
    street: parcel.site_street, city: parcel.site_city, state: 'OR', zip: parcel.site_zip,
    firstName: parcel.owner1_first, lastName: parcel.owner1_last,
    mailingStreet: parcel.mail_street, mailingCity: parcel.mail_city, mailingState: parcel.mail_state, mailingZip: parcel.mail_zip,
  })
  const matched = !!trace && ((trace.phones?.length ?? 0) > 0 || (trace.emails?.length ?? 0) > 0)
  results.push({ id: person.id, name: person.name, owner: `${parcel.owner1_first} ${parcel.owner1_last}`, trace, matched })
  const flags = trace ? [trace.litigator && 'LITIGATOR', trace.dncTcpa && 'DNC-TCPA', trace.deceased && 'DECEASED'].filter(Boolean).join(',') : ''
  console.log(`  #${person.id} ${parcel.owner1_first} ${parcel.owner1_last}: ${matched ? `${trace.phones.length}ph ${trace.emails.length}em` : 'no match'}${flags ? '  ⚠ ' + flags : ''}`)
}

const matches = results.filter((r) => r.matched)
const withPhone = matches.filter((r) => r.trace.phones.length > 0)
const withEmail = matches.filter((r) => r.trace.emails.length > 0)
const compliance = results.filter((r) => r.trace?.hardStop)
console.log(`\n── RESULTS ──`)
console.log(`attempted:   ${results.length}`)
console.log(`matched:     ${matches.length}  (${Math.round(100 * matches.length / results.length)}%)`)
console.log(`got a phone: ${withPhone.length}   got an email: ${withEmail.length}`)
console.log(`compliance hard-stops (litigator/TCPA/deceased): ${compliance.length}`)
console.log(`cost @ $0.07/lookup: $${(results.length * 0.07).toFixed(2)} (billed per match ≈ $${(matches.length * 0.07).toFixed(2)})`)
console.log(`\nprojection to 4,404 mail-only: ${Math.round(100 * matches.length / results.length)}% match ≈ ${Math.round(4404 * matches.length / results.length)} contacts reached, ~$${(4404 * matches.length / results.length * 0.07).toFixed(0)} billed`)

fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'out', 'batchdata-smoke-results.json'), JSON.stringify(results, null, 2))

if (!WRITE) { console.log('\nNO writes (validation only). Re-run with --write to append the 25 + compliance tags.'); process.exit(0) }

// write path: backup, then empty-only append phones/emails + TCPA tags
const backup = candidates.map(({ person }) => ({ id: person.id, phones: person.phones, emails: person.emails, tags: person.tags }))
fs.writeFileSync(path.join(ROOT, 'out', 'batchdata-smoke-backup.json'), JSON.stringify(backup))
let wrote = 0
for (const r of matches) {
  const cand = candidates.find((c) => c.person.id === r.id)
  const phones = r.trace.phones.map((p) => ({ value: p.number, type: p.type, label: null, dnc: p.dnc }))
  const emails = r.trace.emails.map((e) => ({ value: e }))
  const tags = new Set(cand.person.tags ?? [])
  if (r.trace.hardStop) { tags.add('contact:do-not-call'); tags.add('contact:do-not-text'); tags.add('compliance:hard-stop') }
  tags.add('enriched:batchdata')
  const { error } = await sb.from('crm_people').update({ phones, emails, tags: [...tags] }).eq('id', r.id)
  if (error) { console.log(`  ! #${r.id}: ${error.message}`); continue }
  wrote++
}
console.log(`\nwrote ${wrote} enriched contacts (empty-only). backup: out/batchdata-smoke-backup.json`)
