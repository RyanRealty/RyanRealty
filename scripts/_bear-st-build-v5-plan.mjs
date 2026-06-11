#!/usr/bin/env node
/**
 * Build the canonical v5 rename plan for Bear St (15352 Bear St) using
 * the corrected v3 vision data + Matt's three decisions:
 *
 *   1. Hernandez sale# = `Hernandez-15352-Bear-St` (all hyphens)
 *   2. Failed-cycle docs that are individually executed → keep `_X_` mark
 *      AND wrap as `ARCHIVE - <sale#>_X_<form#>_<formName> - failed cycle.<ext>`
 *   3. SkySlope sale.salePrice updated to $92,034 (done separately)
 *
 * Input:
 *   tmp/bear-st-phase0/v3-page1-vision.jsonl   (vision sale# + form ID per doc)
 *   tmp/bear-st-phase0/v3-cycles.json          (cycle inventory)
 *   tmp/bear-st-phase0/phase0-summary.json     (activity list with IDs)
 *   tmp/skyslope-pdfs/<guid>/texts/*.json      (pdfjs OCR text for party-match)
 *
 * Output:
 *   tmp/bear-st-phase0/v4-rename-plan.json
 *   tmp/bear-st-phase0/v4-checklist-plan.json
 *   tmp/bear-st-phase0/v4-summary.md
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = '/Users/matthewryan/RyanRealty'
const GUID = '2b9046c3-25aa-4efd-b4b1-bd381d6f2a8d'

// === Load inputs ===
const visionRaw = await fs.readFile(`${ROOT}/tmp/bear-st-phase0/v3-page1-vision.jsonl`, 'utf8')
const vision = visionRaw.trim().split('\n').map((l) => JSON.parse(l))
const cycles = JSON.parse(await fs.readFile(`${ROOT}/tmp/bear-st-phase0/v3-cycles.json`, 'utf8'))
const phase0 = JSON.parse(await fs.readFile(`${ROOT}/tmp/bear-st-phase0/phase0-summary.json`, 'utf8'))
const activities = phase0.activities

// Load every doc's OCR full text for party-match
const docTexts = {}
const textDir = `${ROOT}/tmp/skyslope-pdfs/${GUID}/texts`
for (const f of await fs.readdir(textDir)) {
  if (!f.endsWith('.json')) continue
  try {
    const x = JSON.parse(await fs.readFile(`${textDir}/${f}`, 'utf8'))
    const short = x.docId?.substring(0, 8) || f.replace('.json', '')
    docTexts[short] = (x.fullText || '') + ' ' + (x.original || '')
  } catch (e) {}
}

// === Sale# resolution rules ===
// Listing-level OREF numbers — these are signed once per listing intake by sellers/listing broker.
// They are NEVER cycle-specific even if forwarded-email OCR text mentions a buyer name.
const LISTING_LEVEL_OREF = new Set(['015', '018', '020', '040', '042', '043', '047', '091', '092', '108'])
// Buyer-side cycle-specific OREF numbers
const BUYER_CYCLE_OREF = new Set(['041', '050'])

function resolveSaleNumber(v, text, formNumber) {
  // 1. Vision-extracted sale# from page 1 ALWAYS wins (broker typed it intentionally)
  if (v.saleNumberRaw) {
    const raw = v.saleNumberRaw.trim()
    return {
      raw,
      safe: raw === 'Hernandez/15352 Bear St' ? 'Hernandez-15352-Bear-St' : sanitizeSaleNumber(raw),
      basis: 'extracted',
    }
  }
  // 2. Vision blank + listing-level OREF → listing-level (no body-text party-match)
  // Per the skill: forwarded-email artifacts contaminate the body text with party names;
  // only rely on body-text party-match for cycle-specific form classes (041, 050, 081, 082, etc).
  if (formNumber && LISTING_LEVEL_OREF.has(formNumber)) {
    return { raw: null, safe: null, basis: 'listing-level' }
  }
  // 3. Body-text party-match — only for forms NOT in LISTING_LEVEL_OREF
  const t = (text || '').toLowerCase()
  if (t.includes('hernandez') && (t.includes('uriel') || t.includes('framing'))) {
    return { raw: 'Hernandez/15352 Bear St', safe: 'Hernandez-15352-Bear-St', basis: 'party-match' }
  }
  if (t.includes('dallimore')) {
    return { raw: 'JB93024', safe: 'JB93024', basis: 'party-match' }
  }
  if (t.includes('parks') && t.includes('tavares')) {
    return { raw: '15352Bear24', safe: '15352Bear24', basis: 'party-match' }
  }
  if (t.includes('detweiler') && !t.includes('hernandez') && !t.includes('dallimore') && !t.includes('parks')) {
    return { raw: null, safe: null, basis: 'listing-level' }
  }
  if (t.includes('western title') || t.includes('arianna lease') || t.includes('wt0267574')) {
    return { raw: null, safe: null, basis: 'title-internal' }
  }
  return { raw: null, safe: null, basis: 'unknown' }
}

function sanitizeSaleNumber(s) {
  return s
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]/g, '')
}

// v5-namer sanitize for form names (per the skill)
function sanitizeFormName(s) {
  if (!s) return ''
  return s
    .replace(/\./g, '-')           // periods → hyphens (PATCH validator rejects)
    .replace(/–/g, '-')        // en-dash → hyphen
    .replace(/—/g, '-')        // em-dash → hyphen
    .replace(/…/g, ' etc')     // ellipsis
    .replace(/&/g, ' and ')         // ampersand
    .replace(/\//g, '-')           // slash → hyphen
    .replace(/[<>:"|?*]/g, '')      // FS-forbidden chars
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim()
}

// === Form ID → form# + clean form name lookup ===
// Convert vision's formIdHeader (e.g. "OREF 001") + formName to v5 components
function parseFormHeader(v) {
  const h = (v.formIdHeader || '').trim()
  const n = (v.formName || '').trim()
  // OREF NNN pattern in header
  const orefMatch = h.match(/OREF\s*(\d{3})/i)
  if (orefMatch) return { number: orefMatch[1], name: cleanFormName(n, orefMatch[1]) }
  // OREF NNN pattern in name (some vision entries didn't carry it in header)
  const orefMatchN = n.match(/OREF\s*(\d{3})/i)
  if (orefMatchN) return { number: orefMatchN[1], name: cleanFormName(n, orefMatchN[1]) }
  // OR REALTORS Form X.Y
  const orMatch = h.match(/OR\s*REALTORS?\s*Form\s*([\d.\-]+)/i)
  if (orMatch) {
    return { number: null, name: `OR REALTORS Form ${orMatch[1].replace(/\./g, '-')} ${n || 'Generic'}` }
  }
  if (/OR\s*REALTORS?\s*Final\s*Agency/i.test(h)) {
    return { number: null, name: 'OR REALTORS PSA Bundle' }
  }
  // Name-based form# lookup for non-OREF-tagged forms with known names
  const NAME_TO_NUM = {
    'exterior siding': '025',
    'eifs disclosure': '025',
    'private well addendum': '082',
    'septic addendum': '081',
    'septic - onsite sewage': '081',
    'firpta advisory': '092',
    'notice of real estate compensation': '091',
    'real estate compensation advisory': '047',
    'initial agency disclosure': '042',
    'advisory regarding electronic funds': '043',
    'advisory to seller regarding lead-based paint': '018',
    'sellers property disclosure': '020',
    "seller's property disclosure": '020',
    'lead-based paint disclosure': '021',
    'back-up offer addendum': '009',
    'seller contributions addendum': '048',
    'real estate forms advisory': '108',
    'residential real estate sale agreement': '001',
    'disclosed limited agency agreement for sellers': '040',
    'disclosed limited agency agreement for buyers': '041',
  }
  const hLow = h.toLowerCase(), nLow = n.toLowerCase()
  for (const [k, num] of Object.entries(NAME_TO_NUM)) {
    if (hLow.includes(k) || nLow.includes(k)) return { number: num, name: cleanFormName(n || h, num) }
  }
  return { number: null, name: cleanFormName(n || h, null) }
}

function cleanFormName(name, formNum) {
  if (!name) return ''
  // Canonical OREF form names (from skill library)
  const CANONICAL = {
    '001': 'Residential Real Estate Sale Agreement',
    '002': 'Sale Addendum',
    '003': "Seller's Counteroffer",
    '009': 'Back-Up Offer Addendum',
    '015': 'Listing Agreement',
    '018': 'Advisory to Seller Regarding Lead-Based Paint',
    '020': "Seller's Property Disclosure",
    '021': 'Lead-Based Paint Disclosure Addendum',
    '025': 'Exterior Siding-Stucco-EIFS Disclosure',
    '040': 'Disclosed Limited Agency Agreement for Sellers',
    '041': 'Disclosed Limited Agency Agreement for Buyers',
    '042': 'Initial Agency Disclosure',
    '043': 'Advisory Regarding Electronic Funds',
    '047': 'Real Estate Compensation Advisory',
    '048': 'Seller Contributions Addendum',
    '050': 'Residential Buyer Representation Agreement - Exclusive',
    '057': 'Residential Termination Agreement',
    '059': 'Receipt of Reports - Removal of Contingencies',
    '081': 'Septic - Onsite Sewage System Addendum',
    '082': 'Private Well Addendum',
    '091': 'Notice of Real Estate Compensation',
    '092': 'FIRPTA Advisory',
    '108': 'Real Estate Forms Advisory',
    '109': 'Notice from Buyer to Seller',
    '110': 'Notice from Seller to Buyer',
  }
  if (formNum && CANONICAL[formNum]) return CANONICAL[formNum]
  return sanitizeFormName(name)
}

// === Activity mapping ===
// Map form# / formName → activityId for assignment
function findActivity(formNum, formName, cycle) {
  if (cycle !== 'closing') return null  // only closing-cycle docs go on activities

  const byNum = {
    '001': 'Residential Sale Agreement',
    '002': 'Sale Addendums',
    '009': null,  // back-up offer no slot
    '015': 'Listing Agreement',
    '018': 'Lead Based Paint Advisory',
    '020': 'Sellers Property Disclosures',
    '021': 'Lead Based Paint Disclosure',
    '025': null,  // EIFS no slot
    '040': 'Disclosed Limited Agency Agreement for Sellers',
    '041': null,  // buyer-side DLA — sellers-only rep, no slot
    '042': 'Initial Agency Disclosure (042  10.4)',
    '043': 'Electronic Funds Advisory',
    '047': 'Real Estate Compensation Advisory',
    '048': null,
    '081': 'Septic Addendum',
    '082': 'Private Well Addendum',
    '091': 'Broker Commission Demand from Title',  // per Matt's confirmation
    '092': 'FIRPTA Advisory',
    '108': 'Real Estate Forms Advisory',
  }
  const nameLookup = {
    'final settlement statement': 'Final HUD',
    'final seller': 'Final HUD',
    'proof of funds': 'Pre Approval Letter or Proof of Funds',
    'bank of america': 'Pre Approval Letter or Proof of Funds',
    'firpta statement of qualified substitute': 'FIRPTA Advisory',
    'exclusive listing agreement': 'Listing Agreement',
    'ods exclusive listing': 'Listing Agreement',
    'oregon data share residential input': 'Oregon DataShare Property Data Form',
    'oregon datashare residential input': 'Oregon DataShare Property Data Form',
    'ode residential input': 'Oregon DataShare Property Data Form',
    'ore residential input': 'Oregon DataShare Property Data Form',
    'epa lead paint': 'Lead Based Paint Advisory',
    'initial agency disclosure': 'Initial Agency Disclosure (042  10.4)',
    'exterior siding': null,  // no slot
    'eifs disclosure': null,
  }

  let actName = formNum && byNum[formNum] !== undefined ? byNum[formNum] : null
  if (!actName && formName) {
    const fnLow = formName.toLowerCase()
    for (const [k, v] of Object.entries(nameLookup)) {
      if (fnLow.includes(k.toLowerCase())) { actName = v; break }
    }
  }
  if (!actName) return null
  const a = activities.find((x) => (x.name || '').trim() === actName.trim())
  return a ? { id: a.activityId, name: a.name, type: a.typeName } : null
}

// === Build the plan ===
const ORIGINAL_DOCS = {}
for (const a of activities) {
  for (const d of (a.docs || [])) {
    ORIGINAL_DOCS[d.docId] = d.fileName
  }
}

// Build a lookup of original filename by docId from the documents.json
const docsJson = JSON.parse(await fs.readFile(`${ROOT}/tmp/bear-st-phase0/documents.json`, 'utf8'))
const allDocs = docsJson.value?.documents || docsJson.documents || []
const docIdToFilename = {}
for (const d of allDocs) {
  const id = (d.id || d.docId || '').toLowerCase()
  if (id) docIdToFilename[id] = d.fileName || d.documentName
}

// Track to dedupe identical proposed names within a cycle
const proposedSeen = new Map()

const plan = []
const checklistAssign = []
const seenCycles = new Map()

for (const v of vision) {
  const docId = v.docId
  const short = v.shortId
  const text = docTexts[short] || ''
  const current = docIdToFilename[docId.toLowerCase()] || v.currentName || ''

  const form = parseFormHeader(v)
  const sale = resolveSaleNumber(v, text, form.number)
  const isExecuted = v.executed !== false  // assume executed unless explicit

  // Cycle classification
  let cycle = null
  if (sale.raw === 'Hernandez/15352 Bear St') cycle = 'closing'
  else if (sale.raw === 'JB93024') cycle = 'failed-dallimore'
  else if (sale.raw === '15352Bear24') cycle = 'failed-parks-tavares'
  else if (sale.basis === 'listing-level' || sale.basis === 'title-internal') cycle = 'listing-level'
  else cycle = 'unknown'

  // Image-only / unidentified → ARCHIVE - needs_label
  if (!v.formIdHeader && !v.formName) {
    plan.push({
      docId, shortId: short, currentName: current,
      proposedName: `ARCHIVE - ${current.replace(/\.pdf$/i, '')} - needs_label.pdf`,
      cycle: 'needs_review',
      isCanonical: false,
      assignToActivity: null,
    })
    continue
  }

  // Build the v5 base name
  function buildBase(executed) {
    const parts = []
    if (sale.safe) parts.push(sale.safe)
    if (executed) parts.push('X')
    if (form.number) parts.push(form.number)
    if (form.name) parts.push(form.name)
    return parts.join('_') + '.pdf'
  }

  let proposed, isCanonical, assignToActivity = null, archiveReason = null

  if (cycle === 'closing') {
    // Canonical for closing — gets X (assume executed; signature validation should refine later)
    proposed = buildBase(isExecuted)
    isCanonical = true
    const act = findActivity(form.number, form.name, 'closing')
    if (act) assignToActivity = act
  } else if (cycle === 'failed-dallimore' || cycle === 'failed-parks-tavares') {
    // Failed cycle — ARCHIVE prefix, keep X if executed
    const base = buildBase(isExecuted).replace(/\.pdf$/i, '')
    proposed = `ARCHIVE - ${base} - failed cycle.pdf`
    isCanonical = false
    archiveReason = 'failed cycle'
  } else if (cycle === 'listing-level') {
    // Listing-level canonical — gets X if executed, no sale# prefix
    proposed = buildBase(isExecuted)
    isCanonical = true
    const act = findActivity(form.number, form.name, 'closing')  // listing-level still assigns to canonical activities
    if (act) assignToActivity = act
  } else {
    // Unknown — archive as needs_review
    proposed = `ARCHIVE - ${current.replace(/\.pdf$/i, '')} - needs_review.pdf`
    isCanonical = false
    archiveReason = 'needs_review'
  }

  // Dedupe duplicate proposed names: append _A, _B, _C suffix
  const key = proposed
  if (proposedSeen.has(key)) {
    const n = proposedSeen.get(key) + 1
    proposedSeen.set(key, n)
    const suffix = String.fromCharCode(64 + n) // 2 → B
    proposed = proposed.replace(/\.pdf$/i, ` ${suffix}.pdf`)
  } else {
    proposedSeen.set(key, 1)
  }

  plan.push({
    docId, shortId: short, currentName: current,
    proposedName: proposed,
    saleNumberRaw: sale.raw, saleNumberSafe: sale.safe, saleNumberBasis: sale.basis,
    formNumber: form.number, formName: form.name,
    cycle, isCanonical, archiveReason,
    assignToActivity,
  })

  if (assignToActivity && isCanonical) {
    checklistAssign.push({
      docId, activityId: assignToActivity.id, activityName: assignToActivity.name,
      activityType: assignToActivity.type, proposedFileName: proposed,
    })
  }
}

// === Write outputs ===
await fs.writeFile(`${ROOT}/tmp/bear-st-phase0/v4-rename-plan.json`, JSON.stringify(plan, null, 2))
await fs.writeFile(`${ROOT}/tmp/bear-st-phase0/v4-checklist-plan.json`, JSON.stringify({ assign: checklistAssign, unassign: [] }, null, 2))

// Summary markdown
const byCycle = {}
for (const p of plan) {
  byCycle[p.cycle] = byCycle[p.cycle] || []
  byCycle[p.cycle].push(p)
}
const md = []
md.push('# Bear St v4 Rename Plan (canonical v5 format)')
md.push('')
md.push('Generated from v3 vision data + Matt approval (Hernandez sale# = hyphens, failed-cycle keeps X, salePrice→$92,034 done).')
md.push('')
md.push(`**Total docs**: ${plan.length}  ·  **Canonical**: ${plan.filter((p) => p.isCanonical).length}  ·  **Archive**: ${plan.filter((p) => !p.isCanonical).length}  ·  **Checklist assignments**: ${checklistAssign.length}`)
md.push('')
for (const [cycle, docs] of Object.entries(byCycle)) {
  md.push(`## ${cycle} (${docs.length} docs)`)
  md.push('')
  for (const d of docs) {
    md.push(`- \`${d.currentName}\`  →  **\`${d.proposedName}\`**`)
    if (d.assignToActivity) md.push(`    - → activity: **${d.assignToActivity.name}** (id ${d.assignToActivity.id})`)
  }
  md.push('')
}
await fs.writeFile(`${ROOT}/tmp/bear-st-phase0/v4-summary.md`, md.join('\n'))

console.log(`Wrote v4-rename-plan.json (${plan.length} renames)`)
console.log(`Wrote v4-checklist-plan.json (${checklistAssign.length} assigns)`)
console.log(`Wrote v4-summary.md`)
console.log('')
console.log('Cycle breakdown:')
for (const [k, v] of Object.entries(byCycle)) console.log(`  ${k}: ${v.length}`)
