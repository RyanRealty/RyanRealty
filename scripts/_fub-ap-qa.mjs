#!/usr/bin/env node
/**
 * QA every step + template referenced by AP 69-75 before wiring.
 * Checks: template exists, body non-empty, merge tokens resolve against
 * known FUB built-ins + the 64 custom fields, brand-voice grep (banned words
 * + em-dash + semicolon).
 *
 * Reads: out/fub-ap-qa/ap-*.json + out/fub-ap-qa/tpl-*.json
 * Writes: out/fub-ap-qa/qa-report.md
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const DIR = path.join(ROOT, 'out/fub-ap-qa')

// Pull list of known FUB custom field merge tokens from our 64-field inventory.
// Custom field merge tokens follow pattern %customFieldNameInCamelCase% per FUB docs.
const CUSTOM_FIELDS = [
  // From earlier inventory dump — top fields we'd expect AP templates to use
  'customMoveTimeline', 'customLeadTier', 'customIsSellerCurious', 'customSellerPropertyAddress',
  'customCmaDeliveredAt', 'customCmaPdfUrl', 'customBuyerBudgetMin', 'customBuyerBudgetMax',
  'customBuyerSearchAreas', 'customBuyerBedsMin', 'customBuyerMoveTimeline', 'customMlsNumber',
  'customListingStatus', 'customListingExpiredDate', 'customOriginalListPrice', 'customListingDaysOnMarket',
  'customPropertyType', 'customEquityPercent', 'customYearsOwned', 'customMarketValue',
  'customPurchasePrice', 'customPurchaseDate', 'customClosingAnniversary', 'customHomeAnniversary',
  'customOpenHouseAddress', 'customLeadScore', 'customOrganization', 'customApn', 'customSubdivision',
  'customNeighborhood', 'customPlannedCommunity', 'customBedrooms', 'customBaths', 'customBuildingSqft',
  'customLotAcres', 'customYearBuilt', 'customEstimatedMarketValue', 'customEquityPct', 'customPurchaseYear',
  'customLastPurchaseDate', 'customSellerScore', 'customSellerScoreBand', 'customClassification',
  'customBrokerage', 'customRealtorLicense', 'customRealtorLicenseType', 'customIncludeInFbCas',
  'customOwnerAge', 'customOwnerAgeRange', 'customBirthday', 'customGender', 'customMaritalStatus',
  'customHouseholdSize', 'customHasChildren', 'customOccupation', 'customIncomeRange', 'customNetWorthRange',
  'customPhoneType', 'customEnrichmentProvider', 'customRecentlyMoved', 'customRecentlyDivorced',
  'customWebsite',
]
const FUB_BUILTINS = [
  'contact_first_name', 'contact_last_name', 'contact_full_name', 'contact_email', 'contact_phone',
  'contact_address', 'contact_city', 'contact_state', 'contact_zip', 'contact_stage',
  'contact_assigned_user', 'contact_source', 'contact_tags',
  'sender_first_name', 'sender_last_name', 'sender_full_name', 'sender_email', 'sender_phone',
  'sender_title', 'sender_signature',
  'firstName', 'lastName', 'address', 'city', 'state', 'zip', 'email', 'phone',
]
const KNOWN_TOKENS = new Set([...CUSTOM_FIELDS, ...FUB_BUILTINS])

const BANNED_WORDS = [
  'stunning', 'breathtaking', 'gorgeous', 'charming', 'pristine', 'nestled', 'boasts', 'must-see',
  'dream home', 'meticulously maintained', 'entertainer', 'tucked away', 'hidden gem',
  'truly', 'spacious', 'cozy', 'luxurious', 'updated throughout', 'turnkey', 'immaculate',
  'captivating', 'exquisite',
  'delve', 'leverage', 'tapestry', 'navigate', 'robust', 'seamless', 'comprehensive', 'elevate',
  'unlock', 'holistic', 'dynamic', 'vibrant', 'bustling', 'eclectic', 'curated', 'bespoke', 'foster',
  'approximately', 'roughly', 'fairly', 'somewhat',
  'top producing', 'top 1 percent', 'white glove', 'luxury concierge', 'premier brokerage',
  'boutique brokerage', 'your real estate journey', 'we are passionate', 'we pride ourselves',
  'act fast', "don't miss out", "won't last", 'get ready to fall in love',
  "you won't believe", 'introducing', 'stunning new listing',
  // case-insensitive match
]

function stripHtml(s) {
  return String(s || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, ' ').trim()
}

function extractTokens(body) {
  const tokens = new Set()
  const re = /%([a-zA-Z_][a-zA-Z0-9_]*)%/g
  let m
  while ((m = re.exec(body)) !== null) tokens.add(m[1])
  return [...tokens]
}

function bannedHits(body) {
  const lc = body.toLowerCase()
  const hits = []
  for (const w of BANNED_WORDS) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    if (re.test(lc)) hits.push(w)
  }
  if (/—/.test(body) || /–/.test(body)) hits.push('em-dash')
  if (/;/.test(body)) hits.push('semicolon')
  return hits
}

async function main() {
  const aps = {}
  const templates = {}
  for (const f of await fs.readdir(DIR)) {
    const full = path.join(DIR, f)
    if (f.startsWith('ap-')) {
      const id = f.replace('ap-', '').replace('.json', '')
      aps[id] = JSON.parse(await fs.readFile(full, 'utf8'))
    } else if (f.startsWith('tpl-')) {
      const id = f.replace('tpl-', '').replace('.json', '')
      templates[id] = JSON.parse(await fs.readFile(full, 'utf8'))
    }
  }

  const report = []
  report.push('# FUB Action Plan QA — pre-wiring template audit\n')
  report.push(`Generated 2026-05-27. Audits ${Object.keys(aps).length} plans, ${Object.keys(templates).length} templates.\n`)
  report.push('## Pass/fail summary\n')
  const summaryRows = []

  for (const apId of Object.keys(aps).sort((a,b)=>+a-+b)) {
    const ap = aps[apId]
    const steps = ap.steps || []
    const stepResults = []
    for (const s of steps) {
      const row = { pos: s.position, day: s.runAfterDays, action: s.action, status: 'OK', issues: [], templateId: s.emailTemplateId || null }
      if (s.action === 'sendEmail') {
        const t = templates[s.emailTemplateId]
        if (!t) { row.status = 'FAIL'; row.issues.push(`template ${s.emailTemplateId} missing`) }
        else if (t.errorMessage) { row.status = 'FAIL'; row.issues.push(`template error: ${t.errorMessage}`) }
        else {
          row.tplName = t.name
          const body = stripHtml(t.body || '')
          if (!body) { row.status = 'FAIL'; row.issues.push('empty body') }
          if (!t.subject) { row.status = 'WARN'; row.issues.push('no subject') }
          const tokens = extractTokens(body + ' ' + (t.subject || ''))
          const unknown = tokens.filter((x) => !KNOWN_TOKENS.has(x))
          if (unknown.length) { row.status = 'FAIL'; row.issues.push(`unknown tokens: ${unknown.join(', ')}`) }
          const banned = bannedHits(body)
          if (banned.length) {
            row.status = row.status === 'FAIL' ? 'FAIL' : 'WARN'
            row.issues.push(`brand-voice: ${banned.join(', ')}`)
          }
        }
      } else if (s.action === 'createTask') {
        row.tplName = s.taskName
        const banned = bannedHits(s.taskName || '')
        if (banned.length) { row.status = 'WARN'; row.issues.push(`brand-voice on task name: ${banned.join(', ')}`) }
      }
      stepResults.push(row)
    }
    const fails = stepResults.filter((r) => r.status === 'FAIL').length
    const warns = stepResults.filter((r) => r.status === 'WARN').length
    const verdict = fails ? `❌ ${fails} fail` : warns ? `⚠️ ${warns} warn` : '✅ clean'
    summaryRows.push({ apId, name: ap.name, steps: steps.length, verdict })

    // Plan detail section
    report.push(`\n---\n\n## AP ${apId} — ${ap.name}\n`)
    report.push(`Status: ${ap.status} | Steps: ${steps.length} | Initial SMS: ${ap.initialTextMessageEnabled} | Stop-on-contact: ${ap.stopOnContacted}\n`)
    if (ap.initialTextMessage) {
      const banned = bannedHits(ap.initialTextMessage)
      const initialTokens = extractTokens(ap.initialTextMessage)
      const unknownIni = initialTokens.filter((x) => !KNOWN_TOKENS.has(x))
      report.push(`\n**Initial SMS (Day 0, fires before Step 1):**\n> ${ap.initialTextMessage.slice(0, 400)}${ap.initialTextMessage.length > 400 ? '...' : ''}\n`)
      if (unknownIni.length) report.push(`- ❌ Unknown tokens: \`${unknownIni.join('`, `')}\``)
      if (banned.length) report.push(`- ⚠️ Brand-voice: ${banned.join(', ')}`)
    }
    report.push(`\n**Verdict: ${verdict}**\n`)
    report.push('| Step | Day+ | Action | Template name / task | Status | Issues |')
    report.push('|---|---|---|---|---|---|')
    for (const r of stepResults) {
      report.push(`| ${r.pos} | ${r.day} | ${r.action} | ${(r.tplName || '').slice(0,60)} | ${r.status === 'OK' ? '✅' : r.status === 'WARN' ? '⚠️' : '❌'} | ${r.issues.join(' · ') || ''} |`)
    }
  }

  report.unshift('## Per-plan verdict\n')
  report.unshift('| AP | Name | Steps | Verdict |')
  report.unshift('|---|---|---|---|')
  for (const s of summaryRows) {
    report.unshift(`| ${s.apId} | ${s.name} | ${s.steps} | ${s.verdict} |`)
  }
  report.unshift('# FUB Action Plan QA — pre-wiring template audit\n')

  await fs.writeFile(path.join(DIR, 'qa-report.md'), report.join('\n'))
  console.log('Wrote:', path.join(DIR, 'qa-report.md'))
  console.log('\n=== Summary ===')
  for (const s of summaryRows) console.log(`  AP ${s.apId} ${s.name}: ${s.verdict}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
