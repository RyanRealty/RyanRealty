/**
 * Sticky Background cheat sheet for FUB contacts (westside import + expired backfill).
 * Rendered into the "Background" CSV column → shows on the contact sidebar in FUB.
 *
 * Design rules (Matt 2026-05-26):
 *   - Skip any line where the data is missing — no "—" placeholders.
 *   - Skip whole sections when there's no useful info.
 *   - Lead with what a broker needs to ACT on, not metadata.
 *   - Cap NEXT STEPS at 3-5 critical actions per contact type.
 *   - No batch tag in body, no "Updated" footer, no "FUB match: new record" noise.
 */

import {
  demographicBriefLines,
} from './westside-demographics.mjs'

// ---------- formatters ----------

function fmtMoney(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return null
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2) + 'M'
  if (v >= 10_000) return '$' + Math.round(v / 1000) + 'K'
  return '$' + Math.round(v).toLocaleString('en-US')
}

function fmtYears(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return null
  if (v < 1) return null
  return `${Math.round(v)} yrs`
}

function fmtPhone(p) {
  if (!p) return null
  const digits = String(p).replace(/\D/g, '')
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits[0] === '1') return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`
  return p
}

// ---------- helpers ----------

function hasEmail(r) {
  return !!(r.fub_email || r.enriched_email) && r.fub_email_blocked !== 'TRUE'
}
function hasPhone(r) {
  return !!(r.fub_phone || r.enriched_phone) && r.fub_phone_blocked !== 'TRUE'
}
function getEmail(r) {
  return (r.enriched_email || r.fub_email || '').trim()
}
function getPhone(r) {
  return fmtPhone((r.enriched_phone || r.fub_phone || '').trim())
}

function hasExpiredData(r) {
  if (r.expired_status || r.expired_listing_key) return true
  if (String(r.intent || r.fub_tags || '').includes('intent:expired-listing')) return true
  if (String(r.classification || '').includes('EXPIRED')) return true
  return false
}

function isPureExpired(r) {
  return String(r.classification || '') === 'EXPIRED' && !r.purchase_date
}

function isLitigator(r)  { return r.enriched_litigator === 'TRUE' }
function isDeceased(r)   { return r.enriched_deceased === 'TRUE' }
function isFederalDnc(r) { return r.enriched_tcpa_dnc === 'TRUE' }
function isAllPhoneDnc(r){ return r.enriched_all_phones_dnc === 'TRUE' }

// ---------- section builders ----------

function headerLine(r) {
  const band = String(r.score_band || '').toUpperCase()
  if (r.is_realtor_any === 'TRUE') {
    return 'INDUSTRY REALTOR' + (r.realtor_brokerage ? ` · ${r.realtor_brokerage}` : '')
  }
  if (isPureExpired(r)) {
    return 'EXPIRED LISTING' + (r.expired_status ? ` · ${r.expired_status}` : '')
  }
  if (hasExpiredData(r)) {
    return `WESTSIDE HOMEOWNER · listing expired ${r.expired_status_change_date || ''}`.trim()
  }
  return 'WESTSIDE HOMEOWNER' + (band ? ` · ${band}` : '')
}

function addressLines(r) {
  const lines = []
  const street = (r.site_address || '').trim()
  const cityZip = [r.site_city, r.site_state, r.site_zip].filter(Boolean).join(' ')
  if (street || cityZip) lines.push([street, cityZip].filter(Boolean).join(', '))
  const area = [r.neighborhood_label, r.planned_community_label, r.subdivision_label]
    .filter((s) => s && s !== r.neighborhood_label || true)
    .filter(Boolean)
  const uniqueAreas = [...new Set(area.filter(Boolean))]
  if (uniqueAreas.length) lines.push(uniqueAreas.join(' · '))
  return lines
}

function propertyLine(r) {
  const num = (v) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const bits = []
  const bd = num(r.bedrooms)
  if (bd) bits.push(`${bd} bd`)
  const ba = num(r.baths)
  if (ba) bits.push(`${ba} ba`)
  const sf = num(r.building_sqft)
  if (sf) bits.push(`${sf.toLocaleString('en-US')} sqft`)
  const yr = num(r.year_built)
  if (yr) bits.push(`built ${yr}`)
  const ac = num(r.acreage)
  if (ac) bits.push(`${ac} ac`)
  return bits.length ? bits.join(' · ') : null
}

function ownershipLines(r) {
  if (isPureExpired(r)) return []
  const lines = []
  const purchasedBits = []
  if (r.purchase_date && r.purchase_date !== '0000-00-00') {
    const yr = r.purchase_date.slice(0, 4)
    if (yr && yr !== '0000') purchasedBits.push(`Bought ${yr}`)
  }
  const price = fmtMoney(r.purchase_price)
  if (price) purchasedBits.push(`for ${price}`)
  const yrs = fmtYears(r.years_owned)
  if (yrs) purchasedBits.push(`· ${yrs} owned`)
  if (purchasedBits.length) lines.push(purchasedBits.join(' '))

  const mv = fmtMoney(r.market_value)
  const eqPctRaw = Number(r.equity_pct || r.score_equity_pct)
  const eqBits = []
  if (mv) eqBits.push(`Assessed ${mv}`)
  // Only show equity if it's a positive number — negative equity is noise / data-quality issue
  if (Number.isFinite(eqPctRaw) && eqPctRaw > 0) {
    eqBits.push(`${Math.round(eqPctRaw)}% equity`)
    if (r.equity_bucket === 'very-high' || r.equity_bucket === 'very_high') eqBits.push('(very high)')
    else if (r.equity_bucket === 'high') eqBits.push('(high)')
  }
  if (eqBits.length) lines.push(eqBits.join(' · '))
  return lines
}

function ownerLine(r) {
  if (r.is_entity === 'TRUE') return 'Entity-owned (LLC / trust / estate)'
  if (r.is_out_of_state === 'TRUE') {
    const mail = [r.mail_city, r.mail_state].filter(Boolean).join(', ')
    return `Out-of-state absentee${mail ? ` · mails to ${mail}` : ''}`
  }
  if (r.is_absentee === 'TRUE') {
    const mail = [r.mail_city, r.mail_state].filter(Boolean).join(', ')
    return `In-state absentee${mail ? ` · mails to ${mail}` : ''}`
  }
  if (r.mail_city || r.mail_state) {
    return 'Owner-occupied'
  }
  return null
}

function scoreLines(r) {
  if (r.is_realtor_any === 'TRUE' || r.is_entity === 'TRUE') return []
  if (!r.score_total && !r.score_band) return []
  const lines = []
  const band = String(r.score_band || '').toUpperCase()
  lines.push(`SCORE: ${r.score_total || ''} ${band}`.trim())
  const parts = []
  if (Number(r.score_tenure) > 0) parts.push(`Tenure ${r.score_tenure}`)
  if (Number(r.score_equity) > 0) parts.push(`Equity ${r.score_equity}`)
  if (Number(r.score_absentee) > 0) parts.push(`Absentee ${r.score_absentee}`)
  if (Number(r.score_property_age) > 0) parts.push(`Age ${r.score_property_age}`)
  if (Number(r.score_lot_size) > 0) parts.push(`Lot ${r.score_lot_size}`)
  if (Number(r.score_tenure_penalty) < 0) parts.push(`Rate-lock ${r.score_tenure_penalty}`)
  if (parts.length) lines.push(parts.join(' · '))
  // Lifecycle flags — only if non-empty
  const lifecycle = (r.score_lifecycle_tags || '').split('; ').filter(Boolean)
  if (lifecycle.length) lines.push(lifecycle.join(', '))
  return lines
}

function expiredLines(r) {
  if (!hasExpiredData(r)) return []
  const lines = []
  const status = r.expired_status || 'Expired'
  const date = r.expired_status_change_date || ''
  const days = r.expired_days_ago ? ` (${r.expired_days_ago} days ago)` : ''
  lines.push(`${status} ${date}${days}`.trim())
  const lp = fmtMoney(r.expired_list_price)
  const op = fmtMoney(r.expired_original_list_price)
  const priceBits = []
  if (lp) priceBits.push(`List ${lp}`)
  if (op && op !== lp) priceBits.push(`(orig ${op})`)
  if (r.expired_dom) priceBits.push(`${r.expired_dom} DOM`)
  if (priceBits.length) lines.push(priceBits.join(' · '))
  const agentBits = []
  if (r.expired_list_agent_name) agentBits.push(r.expired_list_agent_name)
  if (r.expired_list_office_name) agentBits.push(r.expired_list_office_name)
  if (agentBits.length) lines.push(`Former agent: ${agentBits.join(' · ')}`)
  return lines
}

function contactLines(r) {
  const lines = []
  const phone = getPhone(r)
  const email = getEmail(r)
  if (phone) {
    const type = (r.enriched_phone_type || '').toLowerCase()
    const typeLabel = type ? ` (${type})` : ''
    lines.push(`Phone: ${phone}${typeLabel}`)
  }
  if (email) lines.push(`Email: ${email}`)
  const phoneCount = Number(r.enriched_phone_count || 0)
  const emailCount = Number(r.enriched_email_count || 0)
  if (phoneCount > 1 || emailCount > 1) {
    const extras = []
    if (phoneCount > 1) extras.push(`${phoneCount} phones`)
    if (emailCount > 1) extras.push(`${emailCount} emails`)
    lines.push(`(${extras.join(', ')} on file)`)
  }
  if (!phone && !email) {
    if (r.is_entity === 'TRUE') lines.push('Direct mail only — no skip trace on entities')
    else lines.push('No phone or email on file — needs enrichment')
  }
  return lines
}

function complianceLines(r) {
  const flags = []
  if (isLitigator(r)) flags.push('⚠ TCPA LITIGATOR — do not text or auto-dial (lawsuit risk)')
  if (isDeceased(r))  flags.push('⚠ DECEASED — skip all outreach')
  if (isFederalDnc(r)) flags.push('⚠ Federal DNC registry — do not auto-call')
  if (isAllPhoneDnc(r) && !isLitigator(r) && !isFederalDnc(r)) flags.push('All phones DNC-flagged — phone calls restricted')
  if (r.fub_email_blocked === 'TRUE') flags.push('Email blocked (DNC) — call/text only')
  if (r.fub_phone_blocked === 'TRUE') flags.push('Phone blocked (DNC) — email only')
  return flags
}

function realtorLines(r) {
  if (r.is_realtor_any !== 'TRUE') return []
  const lines = []
  if (r.realtor_license_number) lines.push(`License: ${r.realtor_license_number}`)
  if (r.realtor_sources) lines.push(`Source: ${r.realtor_sources}`)
  return lines
}

// ---------- NEXT STEPS (the action layer) ----------

function expiredNextSteps(r) {
  const lines = []
  lines.push('• Plan 71 (Expired Recovery) auto-enrolled — confirm in Action Plans')
  if (String(r.owner_lookup_status || '').startsWith('pending')) {
    lines.push('• Owner not yet identified — run DIAL skip trace or call cold before any blast')
  }
  if (r.is_out_of_state === 'TRUE' || (r.enriched_mailing_state && r.enriched_mailing_state !== 'OR')) {
    lines.push('• OOS owner — lead with remote-seller logistics in your script')
  }
  lines.push('• Empathy-first script — never "most agents do X" framing')
  lines.push('• DO NOT enroll Plan 69 (LP-only) or 74 (neighborhood) on first touch')
  return lines
}

function realtorNextSteps(r) {
  return [
    '• Stage: Real Estate Agent (do not promote)',
    '• No automation — recruit / listing share only',
    `• First touch: manual call or email re ${r.realtor_brokerage || 'their brokerage'}`,
    '• Excluded from all seller plans + FB CAS',
  ]
}

function entityNextSteps() {
  return [
    '• Stage: Seller Prospect (or leave blank if Active Client / Pending)',
    '• No automation — direct mail only',
    '• Research the decision-maker (manager / trustee) before calling',
  ]
}

function homeownerNextSteps(r) {
  const lines = []
  const band = String(r.score_band || '').toLowerCase()
  const name = [r.owner_first, r.owner_last].filter(Boolean).join(' ') || 'owner'
  const addr = r.site_address || 'subject property'

  if (band === 'hot') {
    if (hasPhone(r)) {
      lines.push(`• CALL TODAY: ${name} re ${addr} — tenure + equity hook, offer free CMA`)
    } else if (hasEmail(r)) {
      lines.push(`• EMAIL TODAY: short CMA offer for ${addr}`)
    } else {
      lines.push('• HOLD until enrichment fills phone or email')
    }
    lines.push('• If they engage → Apply Plan ' + (r.is_out_of_state === 'TRUE' ? '73 (OOS Owner Nurture)' : '74 (Neighborhood Resident Nurture)'))
  } else if (band === 'warm') {
    if (hasEmail(r)) lines.push('• Send neighborhood market update email this week')
    else if (hasPhone(r)) lines.push('• Quarterly check-in call (low pressure)')
    lines.push('• If they respond → Stage to Warm, apply Plan 73 (OOS) or 74 (local)')
  } else {
    lines.push('• Annual mailer only until score promotes to warm/hot')
    lines.push('• Re-score on next county refresh')
  }

  if (r.is_out_of_state === 'TRUE' && (band === 'hot' || band === 'warm')) {
    lines.push('• OOS angle: remote-owner logistics (vacancy, property mgmt, paperwork)')
  }
  lines.push('• NEVER apply Plan 69 (seller LP only) · Plan 71 (expired listing only)')
  return lines
}

function nextStepsFor(r) {
  if (r.is_realtor_any === 'TRUE') return realtorNextSteps(r)
  if (r.is_entity === 'TRUE') return entityNextSteps()
  if (hasExpiredData(r)) return expiredNextSteps(r)
  return homeownerNextSteps(r)
}

// ---------- main render ----------

/**
 * @param {Record<string, string>} r
 * @returns {string}
 */
export function buildBrokerBrief(r) {
  const sections = []

  // Header + address (always present)
  sections.push([headerLine(r), ...addressLines(r)].filter(Boolean).join('\n'))

  // PROPERTY (only if any spec data)
  const prop = propertyLine(r)
  if (prop) sections.push('PROPERTY\n' + prop)

  // EXPIRED LISTING (only if applicable)
  const expiredBlock = expiredLines(r)
  if (expiredBlock.length) sections.push('EXPIRED LISTING\n' + expiredBlock.join('\n'))

  // OWNERSHIP (skip for realtors / pure expireds)
  if (r.is_realtor_any !== 'TRUE') {
    const own = ownershipLines(r)
    if (own.length) sections.push('OWNERSHIP\n' + own.join('\n'))
    const ownerSummary = ownerLine(r)
    if (ownerSummary) sections.push('OWNER\n' + ownerSummary)
  }

  // SCORE (homeowners only, only if scored)
  const score = scoreLines(r)
  if (score.length) sections.push(score.join('\n'))

  // REALTOR (realtors only)
  const realtor = realtorLines(r)
  if (realtor.length) sections.push('REALTOR\n' + realtor.join('\n'))

  // CONTACT (always — but lean)
  const contact = contactLines(r)
  if (contact.length) sections.push('CONTACT\n' + contact.join('\n'))

  // COMPLIANCE (only if any flag)
  const compliance = complianceLines(r)
  if (compliance.length) sections.push('COMPLIANCE\n' + compliance.join('\n'))

  // DEMOGRAPHICS (only if BatchData actually returned data) — strip all
  // placeholder/no-match lines. BatchData $0.07 tier never returns this.
  const demo = demographicBriefLines(r).filter((l) =>
    l && !/pending|skip trace|no demographic|no match|not\s+(available|returned|found)/i.test(l)
  )
  if (demo.length) sections.push('DEMOGRAPHICS\n' + demo.join('\n'))

  // NEXT STEPS (always)
  const steps = nextStepsFor(r)
  if (steps.length) sections.push('NEXT STEPS\n' + steps.join('\n'))

  return sections.join('\n\n').slice(0, 8000)
}
