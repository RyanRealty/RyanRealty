#!/usr/bin/env node
/**
 * scripts/meta-rebuild-fub-audiences.mjs
 *
 * Pulls every FUB contact, splits them into two cohorts, hashes per Meta's
 * Custom Audience spec, and pushes to two Meta Custom Audiences:
 *
 *   1. "RR Database — Targetable (no realtors/compliance/test)"
 *        Used as INCLUSION on the Tier 1 Database Nurture campaign.
 *        Anyone in FUB EXCEPT the hard-stop set.
 *
 *   2. "RR FUB Hard-Stop Exclusion (realtors+compliance+test)"
 *        Used as EXCLUSION on every campaign tier so realtors,
 *        unsubscribed users, bounced emails, and test records NEVER
 *        see Ryan Realty ads.
 *
 * Hard-stop set:
 *   - Realtors:    realtor, Realtor, real estate, Real Estate, real estate agent,
 *                  real-estate-agent, industry:realtor
 *   - Compliance:  do_not_email, do_not_text, compliance:hard-stop, bounced,
 *                  Bounced, unsubscribed, Unsubscribed, complained
 *   - Test:        test record - delete, test-delete-me
 *
 * (Same set as HARD_STOP_TAGS in lib/canonical-lead-tagger.ts so the
 * Meta exclusion stays in lock-step with the FUB workflow exclusion.)
 *
 * Hashing per Meta spec:
 *   - Email: lowercase + trim → SHA-256 hex
 *   - Phone: digits-only, prepend US country code (1) if missing → SHA-256 hex
 *
 * Usage:
 *   vercel env pull .env.tmp --environment=production --yes
 *   set -a && source .env.tmp && set +a
 *   node scripts/meta-rebuild-fub-audiences.mjs --dry-run  # preview only
 *   node scripts/meta-rebuild-fub-audiences.mjs            # apply
 *   rm .env.tmp
 */

import { createHash } from 'node:crypto'

const DRY_RUN = process.argv.includes('--dry-run')

const FUB_KEY = (process.env.FOLLOWUPBOSS_API_KEY || process.env.FUB_API_KEY || '').trim()
const META_TOKEN = (process.env.META_PAGE_ACCESS_TOKEN || '').trim()
const AD_ACCT_RAW = (process.env.META_AD_ACCOUNT_ID || '').trim()
if (!FUB_KEY || !META_TOKEN || !AD_ACCT_RAW) {
  console.error('Missing env: FOLLOWUPBOSS_API_KEY, META_PAGE_ACCESS_TOKEN, META_AD_ACCOUNT_ID required.')
  process.exit(1)
}
const AD_ACCT = AD_ACCT_RAW.startsWith('act_') ? AD_ACCT_RAW : `act_${AD_ACCT_RAW}`
const fubAuth = Buffer.from(`${FUB_KEY}:`).toString('base64')

const HARD_STOP_TAGS = new Set([
  'realtor', 'Realtor',
  'real estate', 'Real Estate',
  'real estate agent', 'Real Estate Agent',
  'real-estate-agent',
  'industry:realtor',
  'do_not_email', 'do_not_text',
  'compliance:hard-stop',
  'bounced', 'Bounced',
  'unsubscribed', 'Unsubscribed',
  'complained',
  'test record - delete',
  'test-delete-me',
].map(s => s.toLowerCase()))

const TARGET_NAME = 'RR Database — Targetable (no realtors/compliance/test)'
const EXCLUDE_NAME = 'RR FUB Hard-Stop Exclusion (realtors+compliance+test)'

const sha256 = s => createHash('sha256').update(s).digest('hex')
const normalizeEmail = e => (e || '').trim().toLowerCase()
const normalizePhone = p => {
  const digits = (p || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return `1${digits}`  // US numbers need country code prefix
  if (digits.length === 11 && digits.startsWith('1')) return digits
  return digits  // best effort for non-US
}

async function fub(path) {
  const r = await fetch(`https://api.followupboss.com/v1${path}`, {
    headers: { Authorization: `Basic ${fubAuth}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`FUB ${r.status}: ${text.slice(0, 200)}`)
  }
  return await r.json()
}

async function meta(method, path, body) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `https://graph.facebook.com/v21.0/${path}${sep}access_token=${encodeURIComponent(META_TOKEN)}`
  const init = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) init.body = JSON.stringify(body)
  const r = await fetch(url, init)
  const text = await r.text()
  let parsed; try { parsed = JSON.parse(text) } catch { parsed = text }
  return { status: r.status, ok: r.ok, body: parsed }
}

// ─── Pull all FUB contacts (paginated) ────────────────────────────────────

console.log(`${'='.repeat(70)}\nFUB → Meta Custom Audience Rebuild\nMode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}\n${'='.repeat(70)}\n`)

async function pullAllContacts() {
  const all = []
  let offset = 0
  const limit = 100
  while (true) {
    const fields = 'id,name,emails,phones,tags'
    const page = await fub(`/people?limit=${limit}&offset=${offset}&fields=${encodeURIComponent(fields)}&sort=created`)
    const people = page.people || []
    all.push(...people)
    process.stdout.write(`  fetched ${all.length}/${page._metadata?.total ?? '?'}...\r`)
    if (people.length < limit) break
    offset += limit
  }
  console.log(`  fetched ${all.length} total contacts`.padEnd(50))
  return all
}

console.log('## Pulling all FUB contacts...')
const contacts = await pullAllContacts()

// ─── Split into target vs hard-stop ───────────────────────────────────────

const target = { emails: new Set(), phones: new Set() }
const exclude = { emails: new Set(), phones: new Set() }
const stats = { total: 0, hardStop: 0, clean: 0, noPII: 0 }

for (const p of contacts) {
  stats.total++
  const tags = (p.tags || []).map(t => t.toLowerCase())
  const isHardStop = tags.some(t => HARD_STOP_TAGS.has(t))
  const emails = (p.emails || []).map(e => normalizeEmail(e.value)).filter(Boolean)
  const phones = (p.phones || []).map(ph => normalizePhone(ph.value)).filter(Boolean)
  if (emails.length === 0 && phones.length === 0) {
    stats.noPII++
    continue
  }
  if (isHardStop) {
    stats.hardStop++
    for (const e of emails) exclude.emails.add(e)
    for (const ph of phones) exclude.phones.add(ph)
  } else {
    stats.clean++
    for (const e of emails) target.emails.add(e)
    for (const ph of phones) target.phones.add(ph)
  }
}

console.log(`\n## Split:`)
console.log(`  total contacts:       ${stats.total}`)
console.log(`  hard-stop (excluded): ${stats.hardStop}`)
console.log(`  clean (target):       ${stats.clean}`)
console.log(`  no PII (skipped):     ${stats.noPII}`)
console.log(`  TARGET unique emails: ${target.emails.size}, phones: ${target.phones.size}`)
console.log(`  EXCLUDE unique emails: ${exclude.emails.size}, phones: ${exclude.phones.size}`)

if (DRY_RUN) {
  console.log('\n(DRY RUN — no audiences created/updated.)')
  process.exit(0)
}

// ─── Build/find Meta Custom Audiences ─────────────────────────────────────

async function findOrCreateCA(name, description) {
  const list = await meta('GET', `${AD_ACCT}/customaudiences?fields=id,name&limit=200`)
  const existing = (list.body.data ?? []).find(a => a.name === name)
  if (existing) {
    console.log(`  ✓ Found existing CA "${name}" (${existing.id})`)
    return existing.id
  }
  const create = await meta('POST', `${AD_ACCT}/customaudiences`, {
    name, description, subtype: 'CUSTOM', customer_file_source: 'USER_PROVIDED_ONLY',
  })
  if (!create.ok) throw new Error(`CA create failed: ${JSON.stringify(create.body).slice(0, 200)}`)
  console.log(`  ✓ Created new CA "${name}" (${create.body.id})`)
  return create.body.id
}

async function pushUsers(caId, emails, phones) {
  // Meta CA users add: schema is array of types, data is array of arrays.
  // For multi-key (email + phone), each row is [email_hash, phone_hash]
  // (empty string when unknown). Batch size: Meta accepts up to 10K rows per call.
  const emailArr = [...emails]
  const phoneArr = [...phones]
  // Build rows from the union; if we have email and phone separately, send 2 rows.
  const rows = []
  // Single-schema approach is simpler: send EMAIL_SHA256 rows + PHONE_SHA256 rows
  // separately. This matches Meta's recommended bulk-add pattern.
  for (const e of emailArr) rows.push({ kind: 'email', value: e })
  for (const p of phoneArr) rows.push({ kind: 'phone', value: p })

  const batchSize = 5000
  let pushed = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const emailBatch = batch.filter(r => r.kind === 'email').map(r => [sha256(r.value)])
    const phoneBatch = batch.filter(r => r.kind === 'phone').map(r => [sha256(r.value)])
    if (emailBatch.length > 0) {
      const r = await meta('POST', `${caId}/users`, {
        payload: { schema: ['EMAIL_SHA256'], data: emailBatch },
      })
      if (!r.ok) console.warn(`     ! email batch ${i}: HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`)
      else pushed += emailBatch.length
    }
    if (phoneBatch.length > 0) {
      const r = await meta('POST', `${caId}/users`, {
        payload: { schema: ['PHONE_SHA256'], data: phoneBatch },
      })
      if (!r.ok) console.warn(`     ! phone batch ${i}: HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`)
      else pushed += phoneBatch.length
    }
  }
  return pushed
}

console.log('\n## Target audience (Database Nurture target)')
const targetCaId = await findOrCreateCA(TARGET_NAME, 'FUB contacts excluding realtors, compliance hard-stops, and test records. Used as Tier 1 Database Nurture targeting.')
console.log(`  Pushing ${target.emails.size} emails + ${target.phones.size} phones...`)
const t = await pushUsers(targetCaId, target.emails, target.phones)
console.log(`  ✓ Pushed ${t} records to target CA`)

console.log('\n## Exclusion audience (Hard-Stop Exclude)')
const excludeCaId = await findOrCreateCA(EXCLUDE_NAME, 'FUB contacts tagged realtor/industry-realtor/do_not_email/bounced/unsubscribed/test. Applied as EXCLUSION on every campaign tier.')
console.log(`  Pushing ${exclude.emails.size} emails + ${exclude.phones.size} phones...`)
const e = await pushUsers(excludeCaId, exclude.emails, exclude.phones)
console.log(`  ✓ Pushed ${e} records to exclusion CA`)

console.log(`\n${'='.repeat(70)}\nSummary\n${'='.repeat(70)}`)
console.log(`Target audience ID:    ${targetCaId}  ("${TARGET_NAME}")`)
console.log(`Exclusion audience ID: ${excludeCaId}  ("${EXCLUDE_NAME}")`)
console.log(`\nNext step: use these IDs in the campaign-creation script.`)
console.log(`Meta typically takes 30 min – 2 hr to match the hashed records against`)
console.log(`its user base. Final audience sizes show up in Ads Manager after match.`)
