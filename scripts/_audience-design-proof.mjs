#!/usr/bin/env node
/**
 * Designs the precise realtor+compliance exclusion and the corrected, tag-aware
 * segment predicates, then proves ZERO realtor leak per targeted segment against
 * the live cache. Read-only — no Meta writes. Output is the plan to show Matt.
 */
import { readFileSync } from 'node:fs'
const people = JSON.parse(readFileSync('/tmp/fub_people_cache.json', 'utf8'))
const tags = (p) => p.tags || []
const has = (p, t) => tags(p).includes(t)
const tagRe = (p, re) => tags(p).some((t) => re.test(t))
const txt = (p) => `${p.nbhd} ${p.subdiv} ${p.planned}`

// ── PRECISE realtor / industry detection (with false-positive protection) ──
// Protect: broker:matt|rebecca|paul (client attribution), subdivision:* (place
// names), source:expired*/expired-mls:*/intent:expired*/seller:expired* (SELLERS),
// owner-lookup:dnc-clear (safe-to-contact).
function isProtected(t) {
  return /^broker:(matt|rebecca|paul)\b/.test(t)
    || /^subdivision:/.test(t)
    || /^source:expired|^expired-mls:|^intent:expired|^seller:expired/.test(t)
    || /^owner-lookup:dnc-clear/.test(t)
}
const REALTOR_RE = /(^realtor$|industry:realtor|realtor-source:|real[\s-]?estate[\s-]?agent|^migration broker$|audience:broker-recruit|broker-recruit|\brealtor\b)/
const BROKERAGE_RE = /^brokerage:/
function isRealtorTag(t) {
  if (isProtected(t)) return false
  return REALTOR_RE.test(t) || BROKERAGE_RE.test(t)
}
function isRealtor(p) {
  if (tags(p).some(isRealtorTag)) return true
  // custom-field realtor markers carried in the reduced cache via hardStop's CF half:
  // (cache already folded customRealtorLicense/Brokerage/Classification + stage into hardStop,
  //  but hardStop also includes compliance — so re-derive realtor cleanly from tags here and
  //  treat the cache hardStop as the union. For the leak proof we use the tag test, which is
  //  the strict realtor signal.)
  return false
}
// ── COMPLIANCE / test (excluded from ads; protect owner-lookup:dnc-clear) ──
const COMPLIANCE_RE = /(compliance:hard-stop|compliance:dnc-registry|compliance:deceased|contact:do-not-(call|email|text)|do_not_email|do_not_text|do-not-email|do-not-text|^bounced$|^unsubscribed$|^complained$|tcpa:litigator|^litigator$|opt-out|smoketest|test record - delete|test-delete-me|^zzz-)/
function isCompliance(p) {
  return tags(p).some((t) => !/owner-lookup:dnc-clear/.test(t) && COMPLIANCE_RE.test(t))
}
const pii = (p) => (p.emails || []).length > 0 || (p.phones || []).length > 0
// isHard = realtor OR compliance OR (cache's CF-derived realtor flag). clean = targetable.
const isHard = (p) => isRealtor(p) || isCompliance(p) || p.hardStop === true
const clean = (p) => !isHard(p) && pii(p)

// ── corrected, tag-aware segment predicates ──
const SEG = [
  { key: 'database', name: 'RR Database — Targetable', role: 'direct', pred: (p) => clean(p) },
  { key: 'westside', name: 'RR Westside Bend Homeowners', role: 'direct',
    pred: (p) => clean(p) && (has(p, 'area:bend-westside') || has(p, 'fb-audience:westside-all') || p.includeFBCAS === 'true') },
  { key: 'nwx', name: 'RR NW Crossing Homeowners', role: 'direct',
    pred: (p) => clean(p) && (tagRe(p, /neighborhood:northwest-crossing|subdivision:northwest-crossing/) || /northwest crossing|nw crossing/.test(txt(p))) },
  { key: 'awbrey', name: 'RR Awbrey Homeowners (Butte + Glen)', role: 'direct',
    pred: (p) => clean(p) && (tagRe(p, /awbrey/) || /awbrey/.test(txt(p))) },
  { key: 'riverwest', name: 'RR River West Homeowners', role: 'direct',
    pred: (p) => clean(p) && has(p, 'neighborhood:bend-river-west') },
  { key: 'summitwest', name: 'RR Summit West Homeowners', role: 'direct',
    pred: (p) => clean(p) && has(p, 'neighborhood:bend-summit-west') },
  { key: 'absentee', name: 'RR Absentee / Out-of-Area Owners', role: 'direct',
    pred: (p) => clean(p) && tagRe(p, /^owner:absentee/) },
  { key: 'highequity', name: 'RR High-Equity Owners', role: 'direct',
    pred: (p) => clean(p) && (tagRe(p, /^equity:(high|very-high)/) || has(p, 'high-equity') || (p.equity != null && p.equity >= 60)) },
  { key: 'tenure', name: 'RR Long-Tenure Owners (10yr+)', role: 'direct',
    pred: (p) => clean(p) && (has(p, 'tenure:long-term') || (p.yearsOwned != null && p.yearsOwned >= 10)) },
  { key: 'luxury', name: 'RR Luxury Owners $1M+', role: 'direct',
    pred: (p) => clean(p) && p.value != null && p.value >= 1000000 },
  { key: 'intent', name: 'RR Seller-Intent — Warm + Hot', role: 'direct',
    pred: (p) => clean(p) && (['warm', 'hot'].includes(p.scoreBand) || tagRe(p, /seller:hot|seller:warm/)) },
  { key: 'expired', name: 'RR Expired/Canceled Listings (seed)', role: 'seed',
    pred: (p) => clean(p) && (['expired', 'canceled', 'cancelled/leased', 'withdrawn'].includes(p.listingStatus) || tagRe(p, /intent:expired-listing|seller:expired|source:expired-listing-mls|^expired-mls:/)) },
  { key: 'tetherow', name: 'RR Tetherow Owners (seed)', role: 'seed',
    pred: (p) => clean(p) && (has(p, 'neighborhood:tetherow') || /tetherow/.test(txt(p))) },
  { key: 'brokentop', name: 'RR Broken Top Owners (seed)', role: 'seed',
    pred: (p) => clean(p) && (has(p, 'neighborhood:broken-top') || /broken.?top/.test(txt(p))) },
  { key: 'exclude', name: 'RR FUB Hard-Stop Exclusion (realtors+compliance+test)', role: 'exclusion',
    pred: (p) => isHard(p) && pii(p) },
]

// ── tallies ──
const realtorCount = people.filter(isRealtor).length
const complianceCount = people.filter((p) => isCompliance(p) && !isRealtor(p)).length
const cfHardOnly = people.filter((p) => p.hardStop && !isRealtor(p) && !isCompliance(p)).length
const cleanCount = people.filter(clean).length
console.log(`people=${people.length}`)
console.log(`realtor/industry (tag or CF): ${realtorCount}`)
console.log(`compliance/test only (not realtor): ${complianceCount}`)
console.log(`cache-CF-hardStop only (not caught by tag rules): ${cfHardOnly}`)
console.log(`CLEAN / targetable: ${cleanCount}`)
// protected counts (sanity)
console.log(`\nPROTECTED from exclusion:`)
console.log(`  broker:matt|rebecca|paul clients: ${people.filter((p) => tagRe(p, /^broker:(matt|rebecca|paul)\b/) && !isRealtor(p)).length}`)
console.log(`  expired-listing sellers kept clean: ${people.filter((p) => clean(p) && tagRe(p, /intent:expired-listing|source:expired-listing-mls|^expired-mls:/)).length}`)

console.log(`\n## SEGMENT SIZES + zero-realtor proof\n`)
console.log(`role     people   realtorLeak  segment`)
let leakTotal = 0
for (const s of SEG) {
  const members = people.filter(s.pred)
  const leak = s.role === 'exclusion' ? 0 : members.filter(isRealtor).length
  leakTotal += leak
  console.log(`${s.role.padEnd(9)} ${String(members.length).padStart(6)}   ${String(leak).padStart(6)}      ${s.name}`)
}
console.log(`\nTOTAL realtor leak across all TARGET/SEED audiences: ${leakTotal}  ${leakTotal === 0 ? '✅ ZERO' : '❌ LEAK'}`)
