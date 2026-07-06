#!/usr/bin/env node
// Matt-directed "Split all" (2026-07-02): recreate the remaining 13 FUB
// merge-victims. Evidence source: FUB relationship snapshots (per-person
// emails/phones captured at merge time) — pulled read-only this session.
// Smoke pair (Kim Anderson ← Brian Smith #52285) already executed + verified.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const ten = (v) => String(v ?? '').replace(/\D/g, '').slice(-10)
const fmt = (p) => `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}`

// { survivor, first, last, email, phones[], kind, mergeDate, copyCompliance, moveSmsToNumber }
const PAIRS = [
  { survivor: 5746, first: 'Charise', last: 'Millard', email: 'millardcharise@gmail.com', phones: ['5415985219'], kind: 'spouse', mergeDate: '2025-07-06' },
  { survivor: 5736, first: 'Tess', last: 'McFeley', email: 'tessabellmcfeley@yahoo.com', phones: ['5416402918', '5417716456'], kind: 'other', mergeDate: '2025-11-12' },
  { survivor: 5687, first: 'Martha', last: 'Detweiler', email: 'mkddetweiler@gmail.com', phones: ['5414013159'], kind: 'spouse', mergeDate: '2025-11-12', copyCompliance: true, moveSmsToNumber: '5414013159' },
  { survivor: 5566, first: 'Abby', last: 'Hogge', email: 'abby.rowley@gmail.com', phones: ['7078897226'], kind: 'spouse', mergeDate: '2025-11-12' },
  { survivor: 5737, first: 'Brenda', last: 'Timms', email: 'brendamtimms@gmail.com', phones: ['5412232719'], kind: 'spouse', mergeDate: '2025-11-12' },
  { survivor: 5744, first: 'Gail', last: 'Newton', email: 'quiltygail53@gmail.com', phones: ['5209540662'], kind: 'spouse', mergeDate: '2025-11-12' },
  { survivor: 5686, first: 'Edward', last: 'Fess', email: 'pacifichealth@earthlink.net', phones: ['8083452605'], kind: 'spouse', mergeDate: '2025-11-12' },
  { survivor: 5739, first: 'Susan', last: 'Reese', email: 'susan.reese057@gmail.com', phones: [], kind: 'spouse', mergeDate: '2025-11-12' },
  { survivor: 5745, first: 'Evan', last: 'Karp', email: 'evantkarp@gmail.com', phones: ['5033672215'], kind: 'other', mergeDate: '2025-11-12' },
  { survivor: 5688, first: 'Debra', last: 'Creekmore', email: 'dscreekmore@icloud.com', phones: ['7073193740'], kind: 'spouse', mergeDate: '2025-12-07' },
  { survivor: 5715, first: 'Samuel', last: 'Robinson', email: 'abcseamlessgutters@yahoo.com', phones: ['9162903765'], kind: 'spouse', mergeDate: '2025-12-07' },
  { survivor: 5749, first: 'Devin', last: 'Pohl', email: 'devinpohl@gmail.com', phones: ['5413509697'], kind: 'other', mergeDate: '2025-12-07' },
  { survivor: 5568, first: 'Becky', last: 'Crawley', email: 'beckyjcrawley@gmail.com', phones: ['9705568424'], kind: 'spouse', mergeDate: '2025-12-07' },
]
const RECIP = { spouse: 'spouse', other: 'other' }
const die = (m) => { console.error('FATAL:', m); process.exit(1) }

for (const P of PAIRS) {
  const name = `${P.first} ${P.last}`
  const { data: s, error: se } = await sb.from('crm_people').select('id,name,stage,source,assigned_broker,tags,emails,phones').eq('id', P.survivor).single()
  if (se || !s) die(`survivor ${P.survivor}: ${se?.message}`)

  // Guard: never run twice — skip if a linked relationship to this name already exists.
  const { data: existingRel } = await sb.from('crm_relationships').select('id').eq('person_id', P.survivor).eq('related_name', name).not('related_person_id', 'is', null).limit(1).maybeSingle()
  if (existingRel) { console.log(`SKIP ${name} — already split (linked relationship exists)`); continue }

  const complianceTags = P.copyCompliance ? (s.tags ?? []).filter((t) => /do-not|hard-stop|compliance|unsub/i.test(t)) : []
  const newRow = {
    name, first_name: P.first, last_name: P.last,
    stage: s.stage, source: s.source, assigned_broker: s.assigned_broker,
    emails: [{ type: 'home', value: P.email, status: 'Valid', isPrimary: 1 }],
    phones: P.phones.map((p, i) => ({ type: 'mobile', value: fmt(p), status: 'Valid', isPrimary: i === 0 ? 1 : 0, normalized: p })),
    tags: complianceTags,
  }
  const { data: created, error: ce } = await sb.from('crm_people').insert(newRow).select('id').single()
  if (ce || !created) die(`create ${name}: ${ce?.message}`)
  const nid = created.id

  // Move contact points (email + phones) from survivor.
  const values = [P.email, ...P.phones]
  const { data: moved, error: me } = await sb.from('crm_contact_points').update({ person_id: nid }).eq('person_id', P.survivor).in('value', values).select('id')
  if (me) die(`points ${name}: ${me.message}`)

  // Survivor jsonb: drop the moved email/phones.
  const emails = (s.emails ?? []).filter((e) => String(e.value ?? '').toLowerCase() !== P.email)
  const phones = (s.phones ?? []).filter((p) => !P.phones.includes(ten(p.normalized ?? p.value)))
  const { error: je } = await sb.from('crm_people').update({ emails, phones }).eq('id', P.survivor)
  if (je) die(`jsonb ${name}: ${je.message}`)

  // Replace the FUB name-only relationship row with linked reciprocals.
  await sb.from('crm_relationships').delete().eq('person_id', P.survivor).is('related_person_id', null).eq('related_name', name)
  const { error: re } = await sb.from('crm_relationships').insert([
    { person_id: P.survivor, related_person_id: nid, related_name: name, kind: P.kind },
    { person_id: nid, related_person_id: P.survivor, related_name: s.name, kind: RECIP[P.kind] },
  ])
  if (re) die(`rels ${name}: ${re.message}`)

  // Compliance copy (fail-safe): suppression rows mirror to the recreated person.
  let suppCopied = 0
  if (P.copyCompliance) {
    const { data: supps } = await sb.from('crm_suppressions').select('channel,value,reason,source').eq('person_id', P.survivor)
    for (const row of supps ?? []) {
      const { error } = await sb.from('crm_suppressions').insert({ ...row, person_id: nid })
      if (!error) suppCopied++
    }
  }

  // Provably-theirs message rows (toNumber/fromNumber = their phone).
  let msgMoved = 0
  if (P.moveSmsToNumber) {
    const { data: rows } = await sb.from('crm_timeline').select('id,dedupe_key,payload').eq('person_id', P.survivor).in('kind', ['sms_in', 'sms_out'])
    for (const r of rows ?? []) {
      const f = ten(r.payload?.fromNumber), t = ten(r.payload?.toNumber)
      if (f === P.moveSmsToNumber || t === P.moveSmsToNumber) {
        const { error } = await sb.from('crm_timeline').update({
          person_id: nid,
          dedupe_key: r.dedupe_key ? r.dedupe_key.replace(`:p${P.survivor}`, `:p${nid}`) : r.dedupe_key,
        }).eq('id', r.id)
        if (!error) msgMoved++
      }
    }
  }

  // Change Logs.
  const relWord = P.kind === 'spouse' ? 'Spouse' : 'Relationship (type unconfirmed — flagged for Matt)'
  await sb.from('crm_timeline').insert([
    {
      person_id: P.survivor, kind: 'system', source: 'app', broker: s.assigned_broker,
      title: `Contact split: ${name} recreated from this record (a FUB duplicate-merge on ${P.mergeDate} had collapsed them into it). Moved per the FUB relationship snapshot: ${P.email}${P.phones.length ? ' + ' + P.phones.map(fmt).join(', ') : ''}${msgMoved ? ` + ${msgMoved} message(s)` : ''}. Linked as ${relWord}. Matt directed the split 2026-07-02.`,
    },
    {
      person_id: nid, kind: 'system', source: 'app', broker: s.assigned_broker,
      title: `Recreated from ${s.name} (#${P.survivor}) after a ${P.mergeDate} FUB duplicate-merge collapsed this contact. Contact info restored per the FUB relationship snapshot. Linked as ${relWord}.${suppCopied ? ` Compliance suppressions copied from the survivor (${suppCopied}) — fail-safe.` : ''} Matt directed the split 2026-07-02.`,
    },
  ])

  console.log(`OK ${s.name} (#${P.survivor}) → ${name} (#${nid}) · points ${moved?.length ?? 0} · msgs ${msgMoved} · supp ${suppCopied} · kind ${P.kind}`)
}
console.log('Done.')
