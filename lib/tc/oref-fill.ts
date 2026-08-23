/**
 * Fill one OREF from deal facts on tc_deals / tc_cycles.
 *
 * Brokers never build forms. Known facts map onto field bindings; missing
 * facts are omitted. Nothing is invented (no TBD, no $0, no today's date).
 *
 * Live library (2026-08-13): OREF 001 is the Residential Real Estate Sale
 * Agreement. OREF 110 is "Notice From Seller To Buyer", not a sale agreement.
 * Prefer 001. Fall back to the best-supported sale-agreement-named version.
 *
 * When `tc_form_versions.field_map` is empty for 001, use the checked-in
 * overlay in oref-001-field-map.ts (measured on the 01/2026 15-page sample).
 */

import { namesByDealRole, type DealPersonRole } from './deal-people'
import { isOref001OverlayApplicable, oref001OverlayFieldMap } from './oref-001-field-map'

export const PREFERRED_OREF_LIBRARY = 'OREF'
export const PREFERRED_OREF_FORM_NUMBER = '001'

export type DealFactKey =
  | 'address'
  | 'city'
  | 'state'
  | 'zip'
  | 'buyers'
  | 'sellers'
  | 'salePrice'
  | 'listingPrice'
  | 'mlsNumber'
  | 'escrowNumber'
  | 'escrowCompany'
  | 'contractAcceptanceDate'
  | 'escrowClosingDate'
  | 'actualClosingDate'
  | 'brokerName'
  | 'earnestMoneyAmount'

export type DealFacts = {
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  buyers: string[]
  sellers: string[]
  salePrice: number | null
  listingPrice: number | null
  mlsNumber: string | null
  escrowNumber: string | null
  escrowCompany: string | null
  contractAcceptanceDate: string | null
  escrowClosingDate: string | null
  actualClosingDate: string | null
  brokerName: string | null
  earnestMoneyAmount: number | null
}

export type FillableField = {
  type?: string
  dataRef?: string | null
  binding?: string | null
  key?: string | null
  label?: string | null
  page?: number
  x?: number
  y?: number
  w?: number
  h?: number
}

export type FillValue = {
  factKey: DealFactKey
  binding: string
  label: string
  value: string
  page?: number
  x?: number
  y?: number
  w?: number
  h?: number
}

export type OrefFormCandidate = {
  id: string
  libraryCode: string
  formNumber: string | null
  name: string
  fieldCount: number
  blankPath: string | null
  updateAvailable?: boolean
}

/** SkySlope / AcroForm aliases → one deal fact. Normalized before match. */
export const DEAL_FACT_ALIASES: Record<DealFactKey, readonly string[]> = {
  address: ['propertyaddress', 'property_address', 'address', 'propertystreetaddress', 'streetaddress', 'property', 'premisesaddress'],
  city: ['propertycity', 'city'],
  state: ['propertystate', 'state'],
  zip: ['propertyzip', 'propertyzipcode', 'zip', 'zipcode', 'postalcode'],
  buyers: ['buyer1', 'buyer1name', 'buyername', 'buyers', 'buyer'],
  sellers: ['seller1', 'seller1name', 'sellername', 'sellers', 'seller'],
  salePrice: ['saleprice', 'purchaseprice', 'price', 'contractprice'],
  listingPrice: ['listingprice', 'listprice'],
  mlsNumber: ['mlsnumber', 'mls', 'listnumber'],
  escrowNumber: ['escrownumber', 'escrowno'],
  escrowCompany: ['escrowcompany', 'escrow', 'titlecompany'],
  contractAcceptanceDate: ['contractacceptancedate', 'acceptancedate', 'accepteddate'],
  escrowClosingDate: ['escrowclosingdate', 'closingdate', 'closedate'],
  actualClosingDate: ['actualclosingdate'],
  brokerName: ['listingbroker', 'brokername', 'broker', 'listingagent'],
  earnestMoneyAmount: ['earnestmoney', 'earnestmoneyamount', 'earnest'],
}

const FACT_LABEL: Record<DealFactKey, string> = {
  address: 'Property address',
  city: 'City',
  state: 'State',
  zip: 'ZIP',
  buyers: 'Buyers',
  sellers: 'Sellers',
  salePrice: 'Sale price',
  listingPrice: 'Listing price',
  mlsNumber: 'MLS number',
  escrowNumber: 'Escrow number',
  escrowCompany: 'Escrow company',
  contractAcceptanceDate: 'Acceptance date',
  escrowClosingDate: 'Escrow closing date',
  actualClosingDate: 'Actual closing date',
  brokerName: 'Broker',
  earnestMoneyAmount: 'Earnest money',
}

export function normalizeBinding(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function formatDealMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export function formatDealDate(raw: string): string | null {
  const slice = raw.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : null
}

function nonEmpty(s: string | null | undefined): string | null {
  const t = (s ?? '').trim()
  return t ? t : null
}

/** Positive finite amounts only. Zero and junk are treated as missing. */
export function parseEarnestMoneyAmount(raw: unknown): number | null {
  if (raw == null) return null
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? raw : null
  }
  if (typeof raw === 'string') {
    const n = Number(raw.replace(/[$,]/g, '').trim())
    return Number.isFinite(n) && n > 0 ? n : null
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    return parseEarnestMoneyAmount(o.amount ?? o.value ?? o.earnest ?? null)
  }
  return null
}

function nameFromUnknown(n: unknown): string | null {
  if (typeof n === 'string') return nonEmpty(n)
  if (!n || typeof n !== 'object') return null
  const o = n as Record<string, unknown>
  const direct = nonEmpty(typeof o.name === 'string' ? o.name : typeof o.full_name === 'string' ? o.full_name : null)
  if (direct) return direct
  const first = nonEmpty(typeof o.first === 'string' ? o.first : typeof o.first_name === 'string' ? o.first_name : null)
  const last = nonEmpty(typeof o.last === 'string' ? o.last : typeof o.last_name === 'string' ? o.last_name : null)
  return nonEmpty([first, last].filter(Boolean).join(' '))
}

function namesList(names: unknown): string[] {
  if (!Array.isArray(names)) return []
  return names.map(nameFromUnknown).filter((n): n is string => Boolean(n))
}

export function dealFactsFromRows(
  deal: {
    address?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    broker_name?: string | null
  },
  cycle: {
    sellers?: unknown
    buyers?: unknown
    listing_price?: number | string | null
    sale_price?: number | string | null
    mls_number?: string | null
    escrow_number?: string | null
    escrow_company?: string | null
    earnest_money?: unknown
    contract_acceptance_date?: string | null
    escrow_closing_date?: string | null
    actual_closing_date?: string | null
    broker_name?: string | null
  },
): DealFacts {
  const num = (v: number | string | null | undefined): number | null => {
    if (v == null || v === '') return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return {
    address: nonEmpty(deal.address),
    city: nonEmpty(deal.city),
    state: nonEmpty(deal.state),
    zip: nonEmpty(deal.zip),
    buyers: namesList(cycle.buyers),
    sellers: namesList(cycle.sellers),
    salePrice: num(cycle.sale_price),
    listingPrice: num(cycle.listing_price),
    mlsNumber: nonEmpty(cycle.mls_number),
    escrowNumber: nonEmpty(cycle.escrow_number),
    escrowCompany: nonEmpty(cycle.escrow_company),
    contractAcceptanceDate: cycle.contract_acceptance_date
      ? formatDealDate(cycle.contract_acceptance_date)
      : null,
    escrowClosingDate: cycle.escrow_closing_date ? formatDealDate(cycle.escrow_closing_date) : null,
    actualClosingDate: cycle.actual_closing_date ? formatDealDate(cycle.actual_closing_date) : null,
    brokerName: nonEmpty(cycle.broker_name) ?? nonEmpty(deal.broker_name),
    earnestMoneyAmount: parseEarnestMoneyAmount(cycle.earnest_money),
  }
}

/**
 * Prefer CRM parties on the file. Cycle jsonb stays the fallback for
 * SkySlope-mirrored names when no named buyer/seller is linked yet.
 */
export function mergePartyNamesIntoFacts(
  facts: DealFacts,
  parties: ReadonlyArray<{ role: DealPersonRole; name: string | null | undefined }>,
): DealFacts {
  const named = namesByDealRole(parties)
  return {
    ...facts,
    buyers: named.buyers.length ? named.buyers : facts.buyers,
    sellers: named.sellers.length ? named.sellers : facts.sellers,
  }
}

export function presentFactValues(facts: DealFacts): Partial<Record<DealFactKey, string>> {
  const out: Partial<Record<DealFactKey, string>> = {}
  if (facts.address) out.address = facts.address
  if (facts.city) out.city = facts.city
  if (facts.state) out.state = facts.state
  if (facts.zip) out.zip = facts.zip
  if (facts.buyers.length) out.buyers = facts.buyers.join(', ')
  if (facts.sellers.length) out.sellers = facts.sellers.join(', ')
  if (facts.salePrice != null) out.salePrice = formatDealMoney(facts.salePrice)
  if (facts.listingPrice != null) out.listingPrice = formatDealMoney(facts.listingPrice)
  if (facts.mlsNumber) out.mlsNumber = facts.mlsNumber
  if (facts.escrowNumber) out.escrowNumber = facts.escrowNumber
  if (facts.escrowCompany) out.escrowCompany = facts.escrowCompany
  if (facts.contractAcceptanceDate) out.contractAcceptanceDate = facts.contractAcceptanceDate
  if (facts.escrowClosingDate) out.escrowClosingDate = facts.escrowClosingDate
  if (facts.actualClosingDate) out.actualClosingDate = facts.actualClosingDate
  if (facts.brokerName) out.brokerName = facts.brokerName
  if (facts.earnestMoneyAmount != null) out.earnestMoneyAmount = formatDealMoney(facts.earnestMoneyAmount)
  return out
}

export function resolveFactKey(binding: string): DealFactKey | null {
  const n = normalizeBinding(binding)
  if (!n) return null
  for (const key of Object.keys(DEAL_FACT_ALIASES) as DealFactKey[]) {
    if (DEAL_FACT_ALIASES[key].includes(n)) return key
  }
  return null
}

function fieldBinding(field: FillableField): string {
  return field.dataRef || field.binding || field.key || field.label || ''
}

export type OrefFieldMapSource = 'db' | 'oref-001-overlay' | 'empty'

/**
 * Prefer a non-empty DB field_map. If live 001 rows have `[]` (flat sample
 * PDF, no AcroForm), use the checked-in overlay so fill writes onto the blank.
 */
export function resolveOrefFieldMap(opts: {
  formNumber?: string | null
  pageCount?: number | null
  fieldMap?: FillableField[] | null
}): { fields: FillableField[]; source: OrefFieldMapSource } {
  const db = Array.isArray(opts.fieldMap) ? opts.fieldMap : []
  if (db.length > 0) return { fields: db, source: 'db' }
  if (isOref001OverlayApplicable(opts.formNumber, opts.pageCount)) {
    return { fields: oref001OverlayFieldMap(), source: 'oref-001-overlay' }
  }
  return { fields: [], source: 'empty' }
}

/**
 * Map deal facts onto a form field_map. Unknown bindings and missing facts
 * are omitted. Sale price is never filled from listing price.
 */
export function mapDealFactsToFillValues(
  facts: DealFacts,
  fieldMap: FillableField[] | null | undefined,
): { filled: FillValue[]; omittedBindings: string[]; omittedFactKeys: DealFactKey[] } {
  const present = presentFactValues(facts)
  const omittedFactKeys = (Object.keys(DEAL_FACT_ALIASES) as DealFactKey[]).filter((k) => present[k] == null)
  const fields = Array.isArray(fieldMap) ? fieldMap : []
  const filled: FillValue[] = []
  const omittedBindings: string[] = []

  for (const field of fields) {
    const binding = fieldBinding(field)
    const factKey = resolveFactKey(binding)
    if (!factKey) {
      if (binding.trim()) omittedBindings.push(binding)
      continue
    }
    const value = present[factKey]
    if (value == null) {
      omittedBindings.push(binding)
      continue
    }
    filled.push({
      factKey,
      binding,
      label: field.label?.trim() || FACT_LABEL[factKey],
      value,
      page: field.page,
      x: field.x,
      y: field.y,
      w: field.w,
      h: field.h,
    })
  }

  return { filled, omittedBindings, omittedFactKeys }
}

/** Cover-page rows: every present fact, in a stable order. No invented rows. */
export function coverRowsFromFacts(facts: DealFacts): Array<{ factKey: DealFactKey; label: string; value: string }> {
  const present = presentFactValues(facts)
  const order: DealFactKey[] = [
    'address',
    'city',
    'state',
    'zip',
    'buyers',
    'sellers',
    'salePrice',
    'listingPrice',
    'mlsNumber',
    'escrowNumber',
    'escrowCompany',
    'earnestMoneyAmount',
    'contractAcceptanceDate',
    'escrowClosingDate',
    'actualClosingDate',
    'brokerName',
  ]
  return order.flatMap((factKey) => {
    const value = present[factKey]
    return value ? [{ factKey, label: FACT_LABEL[factKey], value }] : []
  })
}

export function pickPreferredOrefForm(versions: OrefFormCandidate[]): OrefFormCandidate | null {
  if (!versions.length) return null
  const oref001 = versions.find(
    (v) => v.libraryCode === PREFERRED_OREF_LIBRARY && v.formNumber === PREFERRED_OREF_FORM_NUMBER,
  )
  if (oref001) return oref001

  const namedSale = versions.find(
    (v) =>
      /sale agreement/i.test(v.name) && !/addendum|assignment|notice|advisory/i.test(v.name),
  )
  if (namedSale) return namedSale

  const form110Sale = versions.find(
    (v) => v.formNumber === '110' && /sale agreement/i.test(v.name),
  )
  if (form110Sale) return form110Sale

  return [...versions].sort((a, b) => b.fieldCount - a.fieldCount || a.name.localeCompare(b.name))[0] ?? null
}
