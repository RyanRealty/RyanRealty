/**
 * TC required-document anticipation engine.
 *
 * Pure, deterministic mapping of (broker role + property facts) -> the documents
 * an Oregon residential transaction needs. The legal source of every rule is
 * docs/TC_OREGON_COMPLIANCE.md (each rule cites an ORS/OAR/federal/OREF source).
 * This is a compliance AID for a licensed principal broker, not legal advice.
 *
 * Add a rule HERE only after its citation is verified in the compliance matrix.
 */

export type BrokerRole = 'listing' | 'buyer' | 'dual' | 'unknown'

/** Facts about the home + deal that trigger conditional documents. `null` = unknown. */
export type PropertyFacts = {
  yearBuilt: number | null
  hasWell: boolean | null
  hasSeptic: boolean | null
  hasHOA: boolean | null
  isCondo: boolean | null
  isManufactured: boolean | null
  isVacantLand: boolean | null
  hasSolar: boolean | null
  isTenantOccupied: boolean | null
  isShortSale: boolean | null
  isSellerCarried: boolean | null
  financing: 'va' | 'fha' | 'conventional' | 'cash' | null
}

export type RuleSeverity = 'required' | 'conditional' | 'verify'

export type DocRule = {
  id: string
  label: string
  orefForm: string | null
  severity: RuleSeverity
  citation: string
  /** Substrings that mark this doc as already present among checklist activity names / doc names. */
  matchAny: string[]
  applies: (role: BrokerRole, f: PropertyFacts) => boolean
}

const T = (v: boolean | null) => v === true

/** The matrix, encoded. Order = display order. */
export const DOC_RULES: DocRule[] = [
  // ----- always-required -----
  {
    id: 'agency-disclosure',
    label: 'Initial Agency Disclosure Pamphlet (at first contact)',
    orefForm: '042',
    severity: 'required',
    citation: 'ORS 696.820 / OAR 863-015-0215',
    matchAny: ['initial agency disclosure', '042'],
    applies: () => true,
  },
  {
    id: 'sale-agreement',
    label: 'Residential Real Estate Sale Agreement',
    orefForm: '001',
    severity: 'required',
    citation: 'Engagement instrument (OREF 001)',
    matchAny: ['residential sale agreement', 'residential real estate sale agreement', 'purchase agreement', '001'],
    applies: (_role, f) => !T(f.isVacantLand) && !T(f.isManufactured),
  },
  {
    id: 'spds',
    label: "Seller's Property Disclosure Statement (buyer 5-business-day revocation)",
    orefForm: '020',
    severity: 'required',
    citation: 'ORS 105.464-105.475',
    matchAny: ['sellers property disclosure', "seller's property disclosure", 'property disclosure', '020'],
    applies: (_role, f) => !T(f.isVacantLand),
  },
  {
    id: 'earnest-money',
    label: 'Earnest Money Receipt',
    orefForm: null,
    severity: 'required',
    citation: 'OAR 863-025 (clients trust account)',
    matchAny: ['earnest money'],
    applies: () => true,
  },
  {
    id: 'prelim-title',
    label: 'Preliminary Title Report',
    orefForm: null,
    severity: 'required',
    citation: 'Title review (standard of practice)',
    matchAny: ['preliminary title', 'prelim title'],
    applies: () => true,
  },
  {
    id: 'closing-statement',
    label: 'Closing Statement (CD / ALTA / HUD)',
    orefForm: null,
    severity: 'required',
    citation: 'OAR 863-015 records duty (6-year retention)',
    matchAny: ['closing statement', 'final hud', 'alta', 'settlement'],
    applies: () => true,
  },
  {
    id: 'efa',
    label: 'Advisory Regarding Electronic Funds (wire-fraud)',
    orefForm: '043',
    severity: 'required',
    citation: 'Wire-fraud advisory (OREF 043)',
    matchAny: ['electronic funds', '043'],
    applies: () => true,
  },
  {
    id: 'smoke-co',
    label: 'Smoke + Carbon Monoxide Alarms (in place at conveyance)',
    orefForm: '080',
    severity: 'required',
    citation: 'ORS 105.836-105.838',
    matchAny: ['smoke alarm', 'carbon monoxide', 'smoke and carbon', '080'],
    applies: (_role, f) => !T(f.isVacantLand),
  },

  // ----- role-conditional -----
  {
    id: 'listing-agreement',
    label: 'Exclusive Listing Agreement',
    orefForm: '015',
    severity: 'conditional',
    citation: 'Listing engagement (OREF 015)',
    matchAny: ['listing agreement', 'exclusive listing', '015', 'mlsco'],
    applies: (role) => role === 'listing' || role === 'dual',
  },
  {
    id: 'buyer-rep',
    label: 'Buyer Representation Agreement',
    orefForm: '050',
    severity: 'required',
    citation:
      'MANDATORY when representing a buyer (sole buyer agency or the buyer side of disclosed limited/dual agency): a written buyer representation agreement is required for a 1-4 unit residential transaction, entered into before or as soon as reasonably practical after brokerage services begin. HB 4058 (2024 Or. Laws ch. 3, eff. 2025-01-01) + OAR 863-015-0133 (8 required contents incl. license #, supervising PB, dated term capped at 24 months, duties, search criteria + price range, compensation, termination, exclusive vs non-exclusive). Exception: commercial or 5+ residential units. Verified 2026-06-13. OREF 050 (exclusive) / 052 (non-exclusive).',
    matchAny: ['buyer representation', 'buyers rep', 'buyer rep', '050', '052'],
    applies: (role) => role === 'buyer' || role === 'dual',
  },
  {
    id: 'disclosed-limited-agency',
    label: 'Disclosed Limited Agency Agreement(s)',
    orefForm: '040/041',
    severity: 'conditional',
    citation: 'ORS 696.815/696.820 disclosed limited agency',
    matchAny: ['disclosed limited agency', 'limited agency', '040', '041'],
    applies: (role) => role === 'dual',
  },
  {
    id: 'compensation',
    label: 'Real Estate Compensation Advisory / Notice',
    orefForm: '047/091',
    severity: 'verify',
    citation: 'Post-2024 compensation transparency — verify mandatory vs advisory',
    matchAny: ['compensation advisory', 'notice of real estate compensation', '047', '091'],
    applies: () => true,
  },

  // ----- property-conditional -----
  {
    id: 'well',
    label: 'Private Well Addendum + arsenic/nitrate/coliform test (results to OHA + buyer in 90 days)',
    orefForm: '082',
    severity: 'conditional',
    citation: 'ORS 448.271 (Domestic Well Testing Act)',
    matchAny: ['well addendum', 'private well', 'well log', 'well report', '082'],
    applies: (_role, f) => T(f.hasWell),
  },
  {
    id: 'septic',
    label: 'On-Site Sewage System (Septic) Addendum',
    orefForm: '081',
    severity: 'conditional',
    citation: 'DEQ on-site program (OREF 081)',
    matchAny: ['septic', 'on-site sewage', 'onsite sewage', '081'],
    applies: (_role, f) => T(f.hasSeptic),
  },
  {
    id: 'hoa',
    label: 'Owner Association Addendum + Delivery of Association Documents + CC&Rs',
    orefForm: '023/024',
    severity: 'conditional',
    citation: 'ORS ch. 94 (Planned Community) / ch. 100 (Condo) resale disclosure',
    matchAny: ['association', 'owner association', 'ccr', 'hoa', '023', '024'],
    applies: (_role, f) => T(f.hasHOA) || T(f.isCondo),
  },
  {
    id: 'lbp',
    label: 'Lead-Based Paint Disclosure + Advisory (10-day inspection)',
    orefForm: '018/021',
    severity: 'conditional',
    citation: '42 USC 4852d / 24 CFR 35 (pre-1978 housing)',
    matchAny: ['lead based paint', 'lead-based paint', 'lbp', '018', '021'],
    applies: (_role, f) => f.yearBuilt != null && f.yearBuilt < 1978,
  },
  {
    id: 'manufactured',
    label: 'Manufactured Home Sale Agreement',
    orefForm: '012',
    severity: 'conditional',
    citation: 'Manufactured-home conveyance path (OREF 012)',
    matchAny: ['manufactured home', '012'],
    applies: (_role, f) => T(f.isManufactured),
  },
  {
    id: 'vacant-land',
    label: 'Vacant Land Sale Agreement + Disclosure + Buyer Advisory',
    orefForm: '008/019/030',
    severity: 'conditional',
    citation: 'Land lacks SPDS — land-specific disclosure (OREF 008/019/030)',
    matchAny: ['vacant land', '008', '019', '030'],
    applies: (_role, f) => T(f.isVacantLand),
  },
  {
    id: 'solar',
    label: 'Solar Panel System Addendum + Advisory',
    orefForm: '105/116',
    severity: 'conditional',
    citation: 'Solar transfer disclosure (OREF 105/116)',
    matchAny: ['solar panel', 'solar', '105', '116'],
    applies: (_role, f) => T(f.hasSolar),
  },
  {
    id: 'tenant-occupied',
    label: 'Tenant-Occupied Property Advisory',
    orefForm: '106',
    severity: 'conditional',
    citation: 'ORS ch. 90 tenancy survives sale (OREF 106)',
    matchAny: ['tenant occupied', 'tenant-occupied', '106'],
    applies: (_role, f) => T(f.isTenantOccupied),
  },
  {
    id: 'short-sale',
    label: 'Short-Sale Summary + Addendum',
    orefForm: '027/027B',
    severity: 'conditional',
    citation: 'Lender-approval contingency (OREF 027x)',
    matchAny: ['short sale', '027'],
    applies: (_role, f) => T(f.isShortSale),
  },
  {
    id: 'seller-carried',
    label: 'Seller-Carried Advisory + Transaction Addendum',
    orefForm: '032/033',
    severity: 'conditional',
    citation: 'Owner-financing structure (OREF 032/033)',
    matchAny: ['seller-carried', 'seller carried', '032', '033'],
    applies: (_role, f) => T(f.isSellerCarried),
  },
  {
    id: 'va-fha',
    label: 'VA/FHA Amendatory Clause + Real Estate Certification',
    orefForm: '097',
    severity: 'conditional',
    citation: 'Federal financing amendatory clause (OREF 097)',
    matchAny: ['amendatory', 'va/fha', 'va fha', '097'],
    applies: (_role, f) => f.financing === 'va' || f.financing === 'fha',
  },
]

export type AnticipatedDoc = {
  id: string
  label: string
  orefForm: string | null
  severity: RuleSeverity
  citation: string
  present: boolean
}

/** Evaluate the matrix for a deal and mark each applicable doc present/missing. */
export function anticipateDocuments(
  role: BrokerRole,
  facts: PropertyFacts,
  presentNames: string[]
): AnticipatedDoc[] {
  const haystack = presentNames.map((n) => n.toLowerCase())
  return DOC_RULES.filter((r) => r.applies(role, facts)).map((r) => ({
    id: r.id,
    label: r.label,
    orefForm: r.orefForm,
    severity: r.severity,
    citation: r.citation,
    present: r.matchAny.some((m) => haystack.some((h) => h.includes(m.toLowerCase()))),
  }))
}

/** Which property facts are still unknown — surfaced as "confirm" prompts. */
export function unknownFacts(facts: PropertyFacts): string[] {
  const labels: Record<keyof PropertyFacts, string> = {
    yearBuilt: 'Year built (lead-based paint)',
    hasWell: 'Has a well?',
    hasSeptic: 'Has septic / on-site sewage?',
    hasHOA: 'In an HOA / planned community?',
    isCondo: 'Is a condominium?',
    isManufactured: 'Manufactured / mobile home?',
    isVacantLand: 'Vacant land?',
    hasSolar: 'Has solar panels?',
    isTenantOccupied: 'Tenant-occupied?',
    isShortSale: 'Short sale?',
    isSellerCarried: 'Seller-carried financing?',
    financing: 'Financing type (VA/FHA)',
  }
  return (Object.keys(labels) as (keyof PropertyFacts)[])
    .filter((k) => facts[k] == null)
    .map((k) => labels[k])
}
