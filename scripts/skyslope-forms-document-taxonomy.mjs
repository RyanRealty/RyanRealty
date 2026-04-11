/** Shared filename classification and standard naming for SkySlope Forms tooling. */

export function parseDate(d) {
  if (!d || d === '0001-01-01T00:00:00') return null
  const t = Date.parse(d)
  return Number.isFinite(t) ? t : null
}

export function fmtDate(iso) {
  const t = parseDate(iso)
  if (!t) return 'n/a'
  return new Date(t).toISOString().slice(0, 10)
}

export function inferKind(fileName, name) {
  const t = `${fileName || ''} ${name || ''}`.toLowerCase()
  const rules = [
    [/termination|terminate|mutual.*rescission|withdrawn|withdraw|rescind|release of earnest|release of buyer/i, 'termination_or_release'],
    [/counter|counteroffer/i, 'counter_or_counteroffer'],
    [/addendum/i, 'addendum'],
    [
      /buyer\s*representation|buyer\s*agency|exclusive\s+buyer|non[-\s]?exclusive\s+buyer|buyer.?broker|oref\s*0?40|brbc|buyer.?broker\s*compensation/i,
      'buyer_representation_agreement',
    ],
    [
      /residential sale agreement|sale agreement|rsa\b|oref 101|oref101|oref.?001|residential_real_estate_sale|rrea|sale_agreement\.pdf/i,
      'sale_agreement_or_rsa',
    ],
    [/listing agreement|listing contract|exclusive|oref 015|oref015/i, 'listing_agreement'],
    [/initial agency|042|pamphlet|disclosure pamphlet|orea_pamphlet/i, 'agency_disclosure_pamphlet'],
    [/disclosure|spd|seller.*property|property disclosure/i, 'seller_property_disclosure'],
    [/inspection|repair|request for repair/i, 'inspection_or_repair'],
    [/pre[-\s]?approval|prequal|approval letter|underwrit|loan/i, 'lender_financing'],
    [/earnest|wire|deposit|em_/i, 'earnest_or_wire'],
    [/hoa|ccr|title|preliminary|title report/i, 'title_or_hoa'],
    [/offer|purchase agreement/i, 'buyer_offer_or_package'],
    [/counteroffer no|seller.?s counter|buyer.?s counter/i, 'numbered_counter'],
    [/amendment|notice/i, 'amendment_or_notice'],
    [/walk|final|verification|signing|closing statement|seller.*statement/i, 'closing_adjacent'],
  ]
  for (const [re, k] of rules) {
    if (re.test(t)) return k
  }
  if (t.includes('.pdf')) return 'other_pdf'
  return 'other'
}

export function sanitizeStem(s) {
  return String(s || 'document')
    .replace(/\.pdf$/i, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 72)
}

/**
 * Grouping for principal-brief Word output: listing-only block, buyer-agency block, or transaction block.
 */
export function wordSectionForKind(kind) {
  if (kind === 'listing_agreement' || kind === 'agency_disclosure_pamphlet') return 'listing'
  if (kind === 'buyer_representation_agreement') return 'buyer'
  return 'transaction'
}

export function suggestStandardName({ lane, uploadIso, mls, category, seq, origName }) {
  const d = fmtDate(uploadIso)
  const m = String(mls || 'none').replace(/[^\w.-]/g, '') || 'none'
  const cat = String(category || 'misc').replace(/_/g, '-').slice(0, 28)
  const stem = sanitizeStem(origName)
  return `${d}__${lane}__MLS-${m}__${cat}__${String(seq).padStart(3, '0')}__${stem}.pdf`
}
