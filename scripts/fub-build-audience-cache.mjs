#!/usr/bin/env node
/**
 * scripts/fub-build-audience-cache.mjs
 *
 * Builds the reduced FUB people cache that meta-rebuild-audiences-from-fub.mjs
 * consumes (/tmp/fub_people_cache.json), using nextLink pagination (FUB rejects
 * offset >= 2000). Pulls tags + the audience-relevant custom fields, computes the
 * hard-stop flag (realtor / compliance / test), and prints a tag histogram +
 * custom-field fill-rate audit so we can confirm the rebuild predicates match the
 * live tag scheme before pushing anything to Meta.
 *
 * Scope: Matt-assigned only by default (standing FUB rule). Pass --all for the
 * whole company database.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const ALL = process.argv.includes('--all')
const env = readFileSync('/Users/matthewryan/RyanRealty/.env.local', 'utf8')
const g = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : null }
const KEY = (g('FOLLOWUPBOSS_API_KEY') || g('FUB_API_KEY') || '').trim()
if (!KEY) { console.error('No FOLLOWUPBOSS_API_KEY'); process.exit(1) }
const AUTH = 'Basic ' + Buffer.from(KEY + ':').toString('base64')
const H = { Authorization: AUTH, Accept: 'application/json', 'X-System': 'RyanRealtyAudit' }

const MATT_USER_ID = 1
const HARD_STOP_TAGS = new Set(['realtor', 'real estate', 'real estate agent', 'real-estate-agent', 'industry:realtor', 'do_not_email', 'do_not_text', 'do-not-email', 'do-not-text', 'do-not-call', 'contact:do-not-call', 'contact:do-not-text', 'contact:do-not-email', 'compliance:hard-stop', 'bounced', 'unsubscribed', 'complained', 'litigator', 'dnc', 'test record - delete', 'test-delete-me'])
const lc = (s) => (s || '').toString().toLowerCase().trim()
const CF = ['customIncludeInFBCAS', 'customSellerScoreBand', 'customSellerScore', 'customLeadTier', 'customNeighborhood', 'customSubdivision', 'customPlannedCommunity', 'customEstimatedMarketValue', 'customMarketValue', 'customEquityPct', 'customEquityPercent', 'customYearsOwned', 'customRecentlyMoved', 'customMoveTimeline', 'customIsSellerCurious', 'customListingStatus', 'customRealtorLicense', 'customBrokerage', 'customClassification']
const fields = ['id', 'firstName', 'lastName', 'emails', 'phones', 'tags', 'addresses', 'stage', 'assignedUserId', 'assignedTo', ...CF].join(',')

// ── pull via nextLink ──
const first = new URL('https://api.followupboss.com/v1/people')
first.searchParams.set('limit', '100')
first.searchParams.set('fields', fields)
first.searchParams.set('sort', 'created')
let url = first.toString()
const all = []
let pages = 0
while (url) {
  let r
  try { r = await fetch(url, { headers: H, cache: 'no-store' }) }
  catch (e) { console.error('\nnetwork err', e.message); await new Promise(s => setTimeout(s, 1000)); continue }
  if (r.status === 429) { await new Promise(s => setTimeout(s, 2000)); continue }
  if (!r.ok) { console.error(`\nFUB ${r.status}: ${(await r.text()).slice(0, 200)}`); break }
  const j = await r.json()
  const p = j.people || []
  all.push(...p)
  pages++
  process.stdout.write(`\r  pulled ${all.length} (${pages} pages)...`)
  let next = j._metadata?.nextLink || j._metadata?.next || null
  if (next && !/^https?:\/\//i.test(next)) next = next.startsWith('/') ? 'https://api.followupboss.com' + next : null
  url = next
}
process.stdout.write('\n')
console.log(`Total pulled: ${all.length}`)

// ── assignment distribution (visibility) ──
const byAssignee = {}
for (const p of all) { const k = p.assignedUserId ?? 'null'; byAssignee[k] = (byAssignee[k] || 0) + 1 }
console.log('assignedUserId distribution:', JSON.stringify(byAssignee))

const mine = ALL ? all : all.filter(p => p.assignedUserId === MATT_USER_ID || p.assignedTo === 'Matt Ryan')
console.log(`Scope: ${ALL ? 'ALL company' : 'Matt-only'} -> ${mine.length} people`)

// ── reduce (mirror meta-rebuild-audiences-from-fub.mjs) ──
const realtorCF = p => !!(lc(p.customRealtorLicense) || lc(p.customBrokerage) || /realtor|agent/.test(lc(p.customClassification)) || /real estate agent|realtor/.test(lc(p.stage)))
const reduced = mine.map(p => {
  const ad = (p.addresses || [])[0] || {}
  const tags = (p.tags || []).map(lc)
  return {
    fn: lc(p.firstName), ln: lc(p.lastName),
    emails: (p.emails || []).map(e => lc(e.value)).filter(Boolean),
    phones: (p.phones || []).map(x => (x.value || '').replace(/\D/g, '')).filter(Boolean),
    zip: ad.code || '', city: lc(ad.city), state: lc(ad.state),
    tags,
    hardStop: tags.some(t => HARD_STOP_TAGS.has(t)) || realtorCF(p),
    nbhd: lc(p.customNeighborhood), subdiv: lc(p.customSubdivision), planned: lc(p.customPlannedCommunity),
    scoreBand: lc(p.customSellerScoreBand), listingStatus: lc(p.customListingStatus), includeFBCAS: lc(p.customIncludeInFBCAS),
    value: parseFloat(p.customEstimatedMarketValue || p.customMarketValue) || null,
    equity: parseFloat(p.customEquityPct || p.customEquityPercent) || null,
    yearsOwned: parseFloat(p.customYearsOwned) || null,
  }
})
writeFileSync('/tmp/fub_people_cache.json', JSON.stringify(reduced))
console.log(`Wrote /tmp/fub_people_cache.json (${reduced.length})`)

// ── audit ──
const pii = reduced.filter(p => p.emails.length || p.phones.length).length
const hard = reduced.filter(p => p.hardStop).length
console.log(`\nwith PII: ${pii}  |  hardStop (realtor/compliance/test): ${hard}  |  targetable (clean): ${reduced.filter(p => !p.hardStop && (p.emails.length || p.phones.length)).length}`)

const th = {}
for (const p of reduced) for (const t of p.tags) th[t] = (th[t] || 0) + 1
const rel = Object.entries(th).filter(([k]) => /owner:|tenure:|neighborhood:|subdivision:|audience:|equity:|area:|seller:|intent:|city:/.test(k)).sort((a, b) => b[1] - a[1])
console.log(`\n# targeting-relevant tags (${rel.length} distinct):`)
for (const [k, v] of rel.slice(0, 60)) console.log(`   ${String(v).padStart(5)}  ${k}`)

const cfFill = {}
for (const f of ['nbhd', 'subdiv', 'planned', 'scoreBand', 'listingStatus', 'includeFBCAS']) cfFill[f] = reduced.filter(p => p[f]).length
cfFill['value(non-null)'] = reduced.filter(p => p.value != null).length
cfFill['equity(non-null)'] = reduced.filter(p => p.equity != null).length
cfFill['yearsOwned(non-null)'] = reduced.filter(p => p.yearsOwned != null).length
console.log('\n# custom-field fill rates (drives several segments):')
for (const [k, v] of Object.entries(cfFill)) console.log(`   ${String(v).padStart(5)}  ${k}`)
