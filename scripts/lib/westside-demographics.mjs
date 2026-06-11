/**
 * Demographic tags + brief lines for west-side Bend FUB records.
 * Populated from BatchData enrichment when available; tags are no-ops until then.
 */

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function truthyFlag(v) {
  const s = String(v || '').trim().toUpperCase()
  return s === 'TRUE' || s === 'Y' || s === 'YES' || s === '1'
}

function falsyFlag(v) {
  const s = String(v || '').trim().toUpperCase()
  return s === 'FALSE' || s === 'N' || s === 'NO' || s === '0'
}

/**
 * @param {Record<string, string>} r
 * @returns {string[]}
 */
export function deriveDemographicTags(r) {
  const tags = []

  const age = Number(r.enriched_age)
  if (Number.isFinite(age) && age > 0) {
    if (age >= 55) tags.push('demo:age-55-plus')
    if (age >= 65) tags.push('demo:age-65-plus')
    if (age < 35) tags.push('demo:age-under-35')
    else if (age < 55) tags.push('demo:age-mid-career')
  }

  const ageRange = String(r.enriched_age_range || '').trim()
  if (ageRange) {
    const slug = slugify(ageRange)
    if (slug) tags.push(`demo:age-range-${slug}`)
  }

  const gender = String(r.enriched_gender || '').trim().toLowerCase()
  if (gender.startsWith('m')) tags.push('demo:gender-male')
  else if (gender.startsWith('f')) tags.push('demo:gender-female')

  const marital = slugify(r.enriched_marital_status)
  if (marital) tags.push(`demo:marital-${marital}`)

  if (truthyFlag(r.enriched_presence_of_children)) tags.push('demo:has-children')
  else if (falsyFlag(r.enriched_presence_of_children)) tags.push('demo:empty-nest')

  const hs = Number(r.enriched_household_size)
  if (hs === 1) tags.push('demo:household-solo')
  else if (hs >= 2) tags.push('demo:household-multi')

  const income = String(r.enriched_income_range || '')
  if (income.trim()) {
    const incomeSlug = slugify(income)
    if (incomeSlug) tags.push(`demo:income-${incomeSlug}`)
    if (/\$?\s*(1[5-9]\d|2\d{2}|\d{3,})/.test(income.replace(/,/g, '')) || /150|200|250|500|750|1m|million/i.test(income)) {
      tags.push('demo:income-high')
    }
  }

  const netWorth = String(r.enriched_net_worth || '')
  if (netWorth.trim()) {
    const nwSlug = slugify(netWorth)
    if (nwSlug) tags.push(`demo:net-worth-${nwSlug}`)
    if (/high|750|1m|million|500/i.test(netWorth)) tags.push('demo:high-net-worth')
  }

  const occupation = slugify(r.enriched_occupation)
  if (occupation) tags.push(`demo:occupation-${occupation.slice(0, 48)}`)

  if (r.enriched_flag_recently_divorced === 'TRUE') tags.push('life:recently-divorced')
  if (r.enriched_flag_recently_moved === 'TRUE') tags.push('life:recently-moved')
  if (r.enriched_flag_equity_rich === 'TRUE') tags.push('life:equity-rich')

  if (r.enriched_dob) tags.push('demo:has-birthday')

  const phoneType = String(r.enriched_phone_type || '')
  if (r.enriched_phone && /mobile|cell/i.test(phoneType)) tags.push('contact:mobile-phone')
  else if (r.enriched_phone && /land/i.test(phoneType)) tags.push('contact:landline-phone')

  if (r.enrichment_matched === 'TRUE') tags.push('enrich:batchdata-matched')
  else if (r.enrichment_provider === 'batchdata' && r.enrichment_matched !== 'TRUE') {
    tags.push('enrich:batchdata-no-match')
  }

  return tags
}

/**
 * @param {Record<string, string>} r
 * @returns {string[]}
 */
export function demographicBriefLines(r) {
  const lines = []
  const hasDemo =
    r.enriched_age ||
    r.enriched_age_range ||
    r.enriched_gender ||
    r.enriched_marital_status ||
    r.enriched_household_size ||
    r.enriched_presence_of_children ||
    r.enriched_occupation ||
    r.enriched_income_range ||
    r.enriched_net_worth ||
    r.enriched_dob

  if (!hasDemo && r.enrichment_provider !== 'batchdata') {
    lines.push('Pending BatchData skip trace (age, income, household, life events).')
    return lines
  }

  if (!hasDemo && r.enrichment_provider === 'batchdata') {
    lines.push('BatchData ran — no demographic match on this owner.')
    return lines
  }

  const ageBits = []
  if (r.enriched_age) ageBits.push(`Age ${r.enriched_age}`)
  if (r.enriched_age_range) ageBits.push(`Range ${r.enriched_age_range}`)
  if (r.enriched_dob) ageBits.push(`DOB ${r.enriched_dob}`)
  if (ageBits.length) lines.push(ageBits.join(' · '))

  const profile = [
    r.enriched_gender || '',
    r.enriched_marital_status ? `${r.enriched_marital_status}` : '',
    r.enriched_household_size ? `Household ${r.enriched_household_size}` : '',
  ].filter(Boolean)
  if (profile.length) lines.push(profile.join(' · '))

  if (truthyFlag(r.enriched_presence_of_children)) lines.push('Children in household.')
  else if (falsyFlag(r.enriched_presence_of_children)) lines.push('No children in household (empty nest signal).')

  if (r.enriched_occupation) lines.push(`Occupation: ${r.enriched_occupation}`)
  if (r.enriched_income_range) lines.push(`Income: ${r.enriched_income_range}`)
  if (r.enriched_net_worth) lines.push(`Net worth: ${r.enriched_net_worth}`)

  const life = []
  if (r.enriched_flag_recently_divorced === 'TRUE') life.push('Recently divorced')
  if (r.enriched_flag_recently_moved === 'TRUE') life.push('Recently moved')
  if (r.enriched_flag_equity_rich === 'TRUE') life.push('Equity rich (vendor flag)')
  if (life.length) lines.push(`Life events: ${life.join(' · ')}`)

  return lines
}

/**
 * Smart list names that apply once demographic tags land.
 * @param {Record<string, string>} r
 * @returns {string[]}
 */
export function demographicSmartListsFor(r) {
  const lists = []
  const age = Number(r.enriched_age)
  if (falsyFlag(r.enriched_presence_of_children) || (Number.isFinite(age) && age >= 55)) {
    lists.push('Empty Nest Owners')
  }
  if (r.enriched_flag_recently_divorced === 'TRUE') lists.push('Life Event — Recently Divorced')
  if (r.enriched_flag_recently_moved === 'TRUE') lists.push('Life Event — Recently Moved')
  if (Number.isFinite(age) && age >= 55 && Number(r.years_owned) >= 8) lists.push('Retirement Age Long-Term')
  if (String(r.score_lifecycle_tags || '').includes('lifecycle:rate-locked')) lists.push('Rate Locked Owners')
  if (r.enriched_phone && /mobile|cell/i.test(r.enriched_phone_type || '')) lists.push('Has Mobile Phone')
  if (r.enrichment_matched === 'TRUE') lists.push('BatchData Enriched')
  return lists
}
