/**
 * The publish contract for a listing money figure. Pure, and deliberately
 * IMPORT-FREE so the mechanical gate (scripts/check-listing-figure-publish.mjs)
 * can transpile this one file and execute the contract itself rather than
 * pattern-match a comment.
 *
 * FOUNDING CASE (verified live 2026-08-19, dev render of the real page).
 * 735 Purcell Boulevard, Bend — MLS 220174840, ListingKey
 * 20231213164224139125000000 — is a sublease of a former bank building. Its
 * MLS PropertyType is 'G', which the feed's own PropertyTypeLabel spells
 * "Commercial Lease", and its ListPrice is 2.5: a lease rate per square foot,
 * not a sale price. /homes-for-sale/bend/735-purcell-220174840 published
 *   H1 "$3"  ·  price strip "$3"
 *   listing history "Back on market $0 / Price change $0 / Listed $0"
 *   mortgage estimate "Loan amount $2 · $1 down · 30 year term"
 *   JSON-LD SingleFamilyResidence with offers.price 2.5
 * Two independent defects sat on that one page, and both are classes:
 *
 *  1. A LEASE RATE PUBLISHED UNDER SALE LABELS. On PropertyType 'G' the
 *     ListPrice field carries rent, so every sale-shaped figure derived from
 *     it — the ask, price per square foot, the loan amount — is a category
 *     error, not a rounding error. Basis for the code (live listings table,
 *     2026-08-19): PropertyType 'G' is labelled "Commercial Lease" on 4,310
 *     rows and carries no label on 25; it is never labelled anything else.
 *     214 'G' rows are Active, 176 of them priced under $1,000.
 *
 *  2. A POSITIVE AMOUNT PRINTED AS $0. The money formatter rounded to the
 *     nearest thousand, so every value under $500 published as "$0" while
 *     claiming to be that value. 149 Active listings carry price_per_sqft
 *     exactly 0 (already withheld by the > 0 guard) and 6 more carry a value
 *     between 0.01 and 0.49 — those printed "$0 per square foot" beside an
 *     ask. Same rounding printed the three "$0" rows on the Purcell history.
 *
 * §0.7 governs the shape of both fixes: publish a figure that is verified, or
 * publish no figure. Neither rule invents a threshold — the lease rule reads
 * the feed's own property-type code, and the zero rule asks only whether the
 * text we are about to print is "$0" for an amount that is not zero. A number
 * whose published form is $0 is not a number; it is the absence of one wearing
 * a dollar sign.
 *
 * WHY NOT A "$40 PER SQUARE FOOT" FLOOR. The 262 Active listings under $40 per
 * square foot are not one population. 179 are commercial leases (rule 1). The
 * rest are real and correct: an in-park manufactured home in Grants Pass at
 * $8,500 over 784 sq ft is $10.84 per square foot, and a 73,720 sq ft
 * commercial building in Hines at $549,000 is $7.45. A blanket floor would
 * withhold verified figures, which §0 forbids as firmly as it forbids wrong
 * ones.
 */

/**
 * SECOND CASE, SAME SHAPE (verified live 2026-08-19, dev render of the real
 * page). 1824 Redtail Hawk Drive, Redmond — MLS 220190868, ListingKey
 * 20240827010740567422000000 — is a fractional interest at Eagle Crest whose
 * ListPrice is 1. /listing/20240827010740567422000000 published
 *   rental analysis "At $1 with 20% down, this property cash-flows $1,310 per
 *     month, a 1571464.0% cap rate and 0.0% cash-on-cash return"
 *     beside "Cash needed $0" and "Loan payment - $0"
 *   monthly payment "Loan amount $1 · — down" / "Total monthly (PITI) $40"
 *   JSON-LD SingleFamilyResidence, offers.price 1, description "$1 · 3 bed,
 *     2 bath · 1,405 sq ft"
 *
 * The ask is not the defect. $1 is what the listing asks for the interest it
 * offers, and the page prints "Tenancy in common" beside it. The defect is
 * every figure that reads that number as the value, the cost, or the yield of
 * the WHOLE HOME: the square footage, the beds, the HUD area rent and the tax
 * bill all describe the whole dwelling, so dividing any of them by a share
 * price is a category error, not a rounding error.
 *
 * Basis for the sub-type list (live listings table, 2026-08-19). Every Active
 * row of both sub types is a fractional interest in the feed's own remarks,
 * at the bottom AND the top of the price range:
 *   Tenancy in Common — 65 Active (ListPrice $1 to $295,000), 7 Pending,
 *     4 Withdrawn, 317 Canceled, 554 Expired, 1,059 Closed. 220190868 "This
 *     fractional…", 220157653 "4 week fractional", 220220877 "One-quarter
 *     shared interest", 220224253 "1/3 share of this vacation home".
 *   Timeshare — 1 Active, 1 Canceled, 10 Closed. 220221076 at $215,000:
 *     "One-quarter ownership".
 * Stock Cooperative (52 rows, $33,000–$829,000) is deliberately NOT here: co-op
 * shares carry the exclusive right to one whole unit, so that price is the ask
 * for the whole dwelling.
 */

/**
 * MLS PropertyType codes whose ListPrice is a lease rate rather than a sale
 * price. Read from the feed's own PropertyTypeLabel — see the docblock trace.
 */
export const LEASE_PRICE_PROPERTY_TYPES: ReadonlySet<string> = new Set(['G'])

/**
 * THIRD CASE, SAME SHAPE, DIFFERENT KEY (verified live 2026-08-19).
 *
 * The sub-type rule above misses eight Active fractional interests because the
 * feed files them under PropertySubType "Condominium". Every one is a cabin at
 * Lake Creek Lodge in Camp Sherman, and each says so in its own remarks:
 *   220218114 $157,900 "25% interest in Camp Sherman!"
 *   220218115 $157,900 "25% interest in Camp Sherman!"
 *   220222476 $159,900 "25% interest available in Camp Sherman!"
 *   220222478 $159,900 "1/4 share in Camp Sherman!"
 *   220215583 $205,000 "Own a one-quarter share in this charming
 *     three-bedroom, two-bath cabin"
 *   220203447 $210,000 "One-quarter shared interest is available"
 *   220218395 $249,000 "Own a 1/4 share interest"
 *   220170948 $269,000 "Experience a 1/4 share interest"
 * /listing/20260529215303245812000000 (220222478) published a 3.5% cap rate,
 * -14.3% cash-on-cash, "Cash needed $31,980", "Gross rent $1,602" (the HUD
 * three-bedroom rent for the WHOLE cabin against a quarter-share price),
 * "$185 /sqft" (a quarter-share price over the whole cabin's 866 sq ft),
 * "Loan amount $127,920", JSON-LD SingleFamilyResidence offers.price 159900,
 * and an OG card reading "$159,900" over "3 bed · 2 bath · 866 sq ft". None of
 * those pages carries a sub-type badge, so nothing on the screen said share.
 *
 * WHY THE KEY IS THE PROPERTY, NOT THE REMARK. Remarks are not the record, and
 * this repo does not parse them at runtime. Cabin 10 proves why: MLS 220222476
 * (unit "10, U1") and 220222478 ("10, U3") both disclose a quarter share, while
 * 220222477 ("10, U2") — the same cabin, the same $159,900, the same 866 sq ft,
 * the same office — discloses nothing. A remark rule would publish one of three
 * identical products as a whole home and withhold the other two, which is the
 * §0.5 contradiction it was meant to prevent. A remark rule is also noisy in
 * the other direction: a share-phrase sweep of all live Active rows returns
 * ~200 matches that are half-baths, half-acres and rate buydowns.
 *
 * The property IS the record. Live `listings`, SubdivisionName 'Lake Creek
 * Lodge', every status, 2026-08-19: 38 rows, 36 of which disclose a share in
 * their own remarks, across all three sub types the feed has used there
 * (Tenancy in Common 20, Condominium 17, Single Family Residence 1). Every
 * ACTIVE per-cabin row carries a share-index unit number — U1, U2, U3, U4 — and
 * the resort itself is separately listed as a going business, MLS 220224690 at
 * $10,000,000 under PropertyType 'F' ("13 charming cabins, an iconic lodge with
 * an active restaurant"). Cabins at a resort that is itself one for-sale
 * business are not fee-simple dwellings. The two rows that do not disclose a
 * share are that resort listing and Cabin 10 U2.
 *
 * THE PROPERTY ALSO SELLS WHOLE CABINS, WHICH IS WHY THE EXCEPTION LIST IS PART
 * OF THE ENTRY AND NOT DECORATION. Counter-query, same table and date: rows at
 * this subdivision whose own remarks claim a full rather than partial ownership
 * — 2, both Canceled, both filed under sub type "Condominium" with a bare cabin
 * number and no share index. MLS 201805357 at $849,500 ("Full interest 3 bed/3
 * bath cabin", unit "18") and MLS 220194788 at $1,100,000 ("the exclusive
 * opportunity to own the entire cabin (four-quarter-share interests)", unit
 * "24"). Both render at /listing/<key> today, so before they were named here
 * the property rule printed "Fractional interest" beside a whole-cabin ask and
 * withheld that cabin's verified $/sq ft and JSON-LD offer. §0 forbids a wrong
 * label as firmly as a wrong number. A whole-property entry is only honest
 * while every non-share row under it is named below.
 *
 * WHY NOT REGISTER EVERY RESORT. A property entry withholds figures for every
 * row filed under it, so it may only name a property where the whole property
 * sells interests. Inn Of The 7th in Bend is the counter-example and is
 * deliberately NOT a property entry: 27 Active Condominium rows there
 * ($150,000–$352,900) disclose no share at all and are whole-condo sales,
 * alongside 9 Active Tenancy in Common rows ($3,000–$38,000) the sub-type rule
 * already catches. Registering that property would delete 27 verified figures.
 * Its one miss, MLS 220216423, is a listing entry instead.
 *
 * ADDING A ROW. A property entry needs: every row ever filed under that
 * subdivision counted, the share-disclosing share of them counted, at least
 * three MLS numbers quoted verbatim from the feed, and every row at the
 * property that is NOT a share named as an exception with its reason. A listing
 * entry needs verbatim remarks about that dwelling — see the next docblock for
 * the two kinds and why there are two. The shape is enforced by
 * scripts/check-listing-figure-publish.mjs, which also executes the rule
 * against 220222478's real row — an entry without evidence fails the commit.
 */

/**
 * FOURTH CASE: THE ROW THAT SAYS NOTHING (verified live 2026-08-19).
 *
 * MLS 220218536, ListingKey 20260403195603425451000000, 57379 Beaver Ridge,
 * Sunriver, $19,500. The feed states no PropertySubType, no PublicRemarks, no
 * bedrooms, no baths and no living area for it. So the sub-type dimension is
 * silent, and a listing entry was unreachable under the rule above, which asked
 * for the row's OWN remark. /listing/20260403195603425451000000 published
 *   "Cash flow $1,054/mo", "Cap rate 71.2%", "Cash on cash 324.3%",
 *   "Cash needed $3,900", "Total monthly (PITI) $115",
 *   "Loan amount $15,600 · $3,900 down", the near-this-price alert promise,
 *   JSON-LD SingleFamilyResidence offers.price 19500, and og:description
 *   "$19,500 · 57379 Beaver Ridge, Sunriver, OR 97707"
 * with no share label anywhere on the screen.
 *
 * THE RULE FOR LISTING ENTRIES CHANGES HERE, DELIBERATELY. "A listing entry
 * needs its own verbatim remark" was written when the only listing entry had
 * one. Its purpose is that an entry carries evidence a reviewer can re-run, and
 * a remark is one kind of that evidence, not the only kind. As written the rule
 * was weakest exactly where the defect is worst: a row that says nothing is the
 * row whose page can say nothing. It now reads: a listing entry needs verbatim
 * remarks ABOUT THAT DWELLING — the row's own, or, when the feed states none
 * for the row, the same street address's own prior listings. A prior listing at
 * the same address is the same dwelling; its words describe what that dwelling
 * sells as. The standard did not widen; it stopped being tied to one row id.
 *
 * THE EVIDENCE. Live `listings`, City 'Sunriver', StreetNumber '57379',
 * StreetName 'Beaver Ridge', every status, 2026-08-19: 4 rows including this
 * one. Every prior listing of this dwelling sells an interval share, and one
 * was taken by the same office that holds 220218536 today:
 *   220185746  Closed    $35,000  Tenancy in Common
 *              "Seller is willing to split into two1/8 shares and sell, ea.1/8
 *               for $20k"        — which is this row's $19,500
 *   220140810  Closed    $17,000  Tenancy in Common, Bend Premier Real Estate
 *              LLC, the same office as 220218536
 *              "Great opportunity to own 6 weeks (1/8th share) in a completely
 *               furnished condo at The Ridge in Sunriver!"
 *   201506821  Canceled   $6,000
 *              "Enjoy 4 weeks a year at this wonderful Ridge Condo."
 * Counter-query, same address and window (§0 forbids reporting absence from one
 * query shape): rows claiming a whole rather than partial interest — 0. That
 * office's whole footprint at this property is 2 rows, $17,000 and $19,500,
 * neither a whole unit.
 *
 * WHY NOT REGISTER THE RIDGE AS A PROPERTY. Because the property sells whole
 * condos, and a property entry claims it does not. Live `listings`,
 * SubdivisionName 'The Ridge', City 'Sunriver', every status, 2026-08-19: 543
 * rows — 534 at or under $55,000 and 9 at or above $199,000, with nothing in
 * between. All 9 are whole units in their own words ("a 100% share of this very
 * well maintained end unit" 220218659 at $399,000, "100% ownership in a 2 bed,
 * 2 bath Ridge Condo" 220122622 at $229,000), and 220218659 was listed
 * 2026-04-06 and is Pending right now. Nine exceptions against Lake Creek
 * Lodge's three, on a product line the record shows arriving regularly, is a
 * §0 wrong label waiting on the next whole-condo listing. A listing entry
 * withholds nothing from any other row, ever.
 *
 * THE CLASS, SWEPT AND COUNTED. Live `listings`, Active or Active Under
 * Contract, PropertyType 'A', 2026-08-19: 4,688 rows, of which 46 state no
 * bedrooms, no baths, no living area and no remarks — the same 46 rows on all
 * four counts. Joining each of those 46 to its own street address and reading
 * every prior remark that matches share language: 220218536 is the only one
 * whose address discloses a share. The six other addresses that matched are
 * "1/2 bath" and "1/4 mile" prose — 1565 Wall (Bend, "within 1/4 mile from
 * parkway access"), 4310 Highland (Klamath Falls), 2363 Dahlia (Medford), 1045
 * Golden Pheasant (Redmond), 61325 King Josiah (Bend), 1089 Brookdale
 * (Medford). Read and dismissed, not counted.
 *
 * WHAT THOSE OTHER 45 GET INSTEAD, AND WHY IT IS NOT THIS. A row stating no
 * bedrooms is not thereby a share: 220218842 asks $1,600,000 in Awbrey Park and
 * 220199852 asks $899,950 in Metolius Meadows, and each ask is the price of a
 * home as far as the record goes. Withholding their asks from a median would be
 * over-withholding, which §0.7 does not license. What the record does NOT
 * support on any of the 46 is a figure computed from a bedroom count the feed
 * never stated — that rule lives in lib/hud-fmr.ts and covers all 46.
 */

/**
 * MLS PropertySubType values whose ListPrice buys a fractional interest in the
 * property rather than the property. Feed strings, matched exactly — see the
 * docblock trace for the per-row evidence.
 */
export const FRACTIONAL_INTEREST_SUB_TYPES: ReadonlySet<string> = new Set([
  'Tenancy in Common',
  'Timeshare',
])

/** One MLS number and the feed's own words, quoted, never paraphrased. */
export type FractionalInterestEvidence = {
  listNumber: string
  /** Verbatim fragment of that listing's PublicRemarks. */
  remark: string
}

/**
 * A property where the listings are interests in the property, not the
 * property. Keyed on subdivision + city, which is what the feed files a
 * listing under and what the reviewer verified.
 */
export type FractionalInterestProperty = {
  subdivision: string
  city: string
  /** The label the page prints beside the ask. Never wider than the evidence. */
  shareLabel: string
  /** ISO date the counts below were pulled. */
  verifiedOn: string
  /** Rows in `listings` filed under this subdivision, every status. */
  rowsAllStatuses: number
  /** How many of those disclose a share in their own remarks. */
  rowsDisclosingShare: number
  evidence: readonly FractionalInterestEvidence[]
  /** Rows at this property that are NOT share sales, each with its reason. */
  exceptions: readonly { listNumber: string; why: string }[]
}

/** One prior listing of the SAME dwelling, quoted. */
export type FractionalInterestPriorListing = FractionalInterestEvidence & {
  /** StandardStatus on verifiedOn. */
  status: string
  listPrice: number
}

/**
 * The same dwelling's own listing history, used when the row itself states no
 * remarks. Keyed on the street line the feed files them all under.
 */
export type FractionalInterestAddressEvidence = {
  /** The street line, verbatim from the feed, that these rows share. */
  address: string
  /** Rows in `listings` at that address, every status, on verifiedOn. */
  rowsAtAddress: number
  /** The counter-query: rows there claiming a whole rather than partial interest. */
  rowsClaimingWholeInterest: number
  priorListings: readonly FractionalInterestPriorListing[]
}

/**
 * A single verified fractional interest at a property that also sells wholes.
 *
 * Exactly one kind of evidence, and the union makes the typechecker say so:
 * `evidence` is the row's own verbatim remark; `addressEvidence` is the same
 * dwelling's prior listings, for a row the feed gives no remarks at all. An
 * entry with neither does not compile, and one with both does not either.
 */
export type FractionalInterestListing = {
  listNumber: string
  city: string
  shareLabel: string
  verifiedOn: string
} & (
  | { evidence: FractionalInterestEvidence; addressEvidence?: undefined }
  | { addressEvidence: FractionalInterestAddressEvidence; evidence?: undefined }
)

export const FRACTIONAL_INTEREST_PROPERTIES: readonly FractionalInterestProperty[] = [
  {
    subdivision: 'Lake Creek Lodge',
    city: 'Camp Sherman',
    shareLabel: 'Fractional interest',
    verifiedOn: '2026-08-19',
    rowsAllStatuses: 38,
    rowsDisclosingShare: 36,
    evidence: [
      { listNumber: '220218114', remark: '25% interest in Camp Sherman!' },
      { listNumber: '220218115', remark: '25% interest in Camp Sherman!' },
      { listNumber: '220222476', remark: '25% interest available in Camp Sherman!' },
      { listNumber: '220222478', remark: '1/4 share in Camp Sherman!' },
      { listNumber: '220215583', remark: 'Own a one-quarter share in this charming three-bedroom, two-bath cabin' },
      { listNumber: '220203447', remark: 'One-quarter shared interest is available' },
      { listNumber: '220218395', remark: 'Own a 1/4 share interest' },
      { listNumber: '220170948', remark: 'Experience a 1/4 share interest' },
      { listNumber: '220220877', remark: 'One-quarter shared interest' },
    ],
    exceptions: [
      {
        listNumber: '220224690',
        why: 'The resort itself, not a cabin: PropertyType F at $10,000,000, remarks "13 charming cabins, an iconic lodge with an active restaurant". Its ListPrice is the price of the whole property.',
      },
      {
        listNumber: '201805357',
        why: 'A whole cabin, not a share: $849,500, sub type Condominium, unit "18", remarks "Full interest 3 bed/3 bath cabin at Historic Lake Creek Lodge" and "Option of 1/4 share with price of $219,000 and 1/2 share with price of $429,000". The ListPrice buys the cabin.',
      },
      {
        listNumber: '220194788',
        why: 'A whole cabin, not a share: $1,100,000, sub type Condominium, unit "24", remarks "the exclusive opportunity to own the entire cabin (four-quarter-share interests)". The ListPrice buys all four quarters.',
      },
    ],
  },
]

export const FRACTIONAL_INTEREST_LISTINGS: readonly FractionalInterestListing[] = [
  {
    listNumber: '220216423',
    city: 'Bend',
    shareLabel: 'Fractional interest',
    verifiedOn: '2026-08-19',
    evidence: {
      listNumber: '220216423',
      remark: 'Imagine owning a slice of paradise with fractional ownership in a condominium',
    },
  },
  {
    // 57379 Beaver Ridge, Sunriver — the row that states nothing at all. Its own
    // dwelling's listing history is the evidence; see the fourth-case docblock.
    listNumber: '220218536',
    city: 'Sunriver',
    shareLabel: 'Fractional interest',
    verifiedOn: '2026-08-19',
    addressEvidence: {
      address: '57379 Beaver Ridge',
      rowsAtAddress: 4,
      rowsClaimingWholeInterest: 0,
      priorListings: [
        {
          listNumber: '220185746',
          status: 'Closed',
          listPrice: 35_000,
          remark:
            'Seller is willing to split into two1/8 shares and sell, ea.1/8 for $20k.',
        },
        {
          listNumber: '220140810',
          status: 'Closed',
          listPrice: 17_000,
          remark:
            'Great opportunity to own 6 weeks (1/8th share) in a completely furnished condo at The Ridge in Sunriver!',
        },
        {
          listNumber: '201506821',
          status: 'Canceled',
          listPrice: 6_000,
          remark: 'Enjoy 4 weeks a year at this wonderful Ridge Condo.',
        },
      ],
    },
  },
]

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * The registry lookup key for a listing's place. Exported so the gate builds
 * keys the same way the runtime does rather than reimplementing the rule.
 */
export function fractionalPropertyKey(
  subdivisionName: string | null | undefined,
  city: string | null | undefined,
): string | null {
  const sub = normalizeToken(subdivisionName)
  const town = normalizeToken(city)
  if (!sub || !town) return null
  return `${sub}|${town}`
}

const FRACTIONAL_PROPERTY_INDEX: ReadonlyMap<string, FractionalInterestProperty> = new Map(
  FRACTIONAL_INTEREST_PROPERTIES.flatMap((p) => {
    const key = fractionalPropertyKey(p.subdivision, p.city)
    return key ? ([[key, p]] as [string, FractionalInterestProperty][]) : []
  }),
)

const FRACTIONAL_LISTING_INDEX: ReadonlyMap<string, FractionalInterestListing> = new Map(
  FRACTIONAL_INTEREST_LISTINGS.map((l) => [normalizeToken(l.listNumber), l]),
)

/**
 * Everything a figure publisher needs to know about which listing it is looking
 * at. Every field is REQUIRED so the typechecker — not a reviewer's memory —
 * makes each surface state it. An optional field reads `undefined` at the call
 * site that forgets it, which is a guard that always passes.
 */
export type FractionalInterestSubject = {
  propertySubType: string | null | undefined
  subdivisionName: string | null | undefined
  city: string | null | undefined
  listNumber: string | null | undefined
}

/** True when this listing's ListPrice is rent, not an asking sale price. */
export function listingPriceIsLeaseRate(propertyType: string | null | undefined): boolean {
  const code = (propertyType ?? '').trim().toUpperCase()
  if (!code) return false
  return LEASE_PRICE_PROPERTY_TYPES.has(code)
}

/**
 * True when the FEED'S OWN SUB TYPE says this ListPrice buys a share.
 *
 * This is one of the three ways a listing qualifies, not the whole rule. Ask
 * `listingIsFractionalInterest` unless you specifically want the sub-type
 * dimension: eight Active rows are fractional interests under sub type
 * "Condominium", and this predicate returns false for every one of them.
 */
export function listingPriceIsFractionalShare(
  propertySubType: string | null | undefined,
): boolean {
  const raw = (propertySubType ?? '').trim()
  if (!raw) return false
  return FRACTIONAL_INTEREST_SUB_TYPES.has(raw)
}

/**
 * The registry entry that classifies this listing as a fractional interest, or
 * null. Returned rather than a bare boolean so the caller can print the entry's
 * own reviewed label instead of inventing one.
 */
export function fractionalInterestEntry(
  subject: FractionalInterestSubject,
): FractionalInterestProperty | FractionalInterestListing | null {
  const listNumber = normalizeToken(subject.listNumber)
  if (listNumber) {
    const listed = FRACTIONAL_LISTING_INDEX.get(listNumber)
    if (listed) return listed
  }
  const key = fractionalPropertyKey(subject.subdivisionName, subject.city)
  if (!key) return null
  const property = FRACTIONAL_PROPERTY_INDEX.get(key)
  if (!property) return null
  // A property entry says the property sells interests. A named exception is a
  // row at that property verified NOT to be one — the resort itself, sold whole.
  if (listNumber && property.exceptions.some((e) => normalizeToken(e.listNumber) === listNumber)) {
    return null
  }
  return property
}

/**
 * THE ONE QUESTION every whole-property figure asks: does this listing's
 * ListPrice buy a share of the property rather than the property?
 *
 * Three ways to qualify, in one predicate so no surface can answer it with two
 * out of three: the feed's own sub type, a reviewed property in the registry,
 * or a reviewed single listing. Verified with the registry's evidence, never by
 * reading PublicRemarks at request time.
 */
export function listingIsFractionalInterest(subject: FractionalInterestSubject): boolean {
  if (listingPriceIsFractionalShare(subject.propertySubType)) return true
  return fractionalInterestEntry(subject) != null
}

/** The three registers the money primitive prints in. */
export type MoneyRegister = 'thousand' | 'exact' | 'compact'

function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000
}

function renderMoney(value: number, register: MoneyRegister): string {
  if (register === 'exact') {
    return `$${Math.round(value).toLocaleString('en-US')}`
  }
  if (register === 'compact') {
    if (value >= 1_000_000) {
      const m = value / 1_000_000
      return `$${m >= 10 ? Math.round(m) : m.toFixed(1)}M`
    }
    if (value >= 1_000) {
      return `$${Math.round(value / 1000)}k`
    }
    return `$${Math.round(value)}`
  }
  return `$${roundToThousand(value).toLocaleString('en-US')}`
}

/**
 * The single money-text publisher. Returns null — never a string — when the
 * amount cannot be published in the requested register:
 *   · nothing to publish (null / NaN / not positive), or
 *   · the register would print "$0" for an amount that is not zero.
 *
 * The caller renders its own withheld placeholder. That is the whole rule; it
 * needs no threshold and no market knowledge.
 */
export function publishMoneyText(
  value: number | null | undefined,
  register: MoneyRegister = 'thousand',
): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  const text = renderMoney(value, register)
  if (isZeroDollarText(text)) return null
  return text
}

/**
 * Whether a rendered money string publishes zero dollars. Kept exported so the
 * gate asserts the same predicate the runtime uses.
 */
export function isZeroDollarText(text: string): boolean {
  return /^\$0(?:\.0+)?(?:[kKmM])?$/.test(text.trim())
}

/**
 * The published price per square foot, or null.
 *
 * A lease rate is not a sale price per square foot, and a figure that prints
 * as "$0" is not a figure. Everything else passes through at the whole-dollar
 * precision the surfaces print.
 */
export function publishPricePerSqft(input: {
  propertyType: string | null | undefined
  pricePerSqft: number | null | undefined
}): number | null {
  if (listingPriceIsLeaseRate(input.propertyType)) return null
  const raw = input.pricePerSqft
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null
  const published = Math.round(raw)
  if (published <= 0) return null
  return published
}

/**
 * The published asking SALE price, or null. Withheld on a lease listing, where
 * the same field means rent.
 */
export function publishSaleAskAmount(input: {
  price: number | null | undefined
  propertyType: string | null | undefined
}): number | null {
  if (listingPriceIsLeaseRate(input.propertyType)) return null
  const raw = input.price
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null
  return Math.round(raw)
}

/**
 * The price OF THE WHOLE PROPERTY, or null.
 *
 * This is the input every figure that describes the dwelling must take: the
 * investment analysis, the monthly cost of ownership, the machine-readable
 * offer, the "homes near this price" band, the comparison against a place
 * median. It is stricter than publishSaleAskAmount by exactly one rule — a
 * fractional interest is withheld — because the two publish different claims
 * from the same field:
 *
 *   publishSaleAskAmount  "this listing asks $295,000"        — true of a 1/3
 *                                                               share, and the
 *                                                               page prints the
 *                                                               sub type beside
 *                                                               it
 *   publishWholePropertyAmount
 *                         "this home is worth / costs / earns
 *                          against $295,000"                  — false of the
 *                                                               same row
 *
 * §0.7 decides the null case for the caller: publish no figure. A page with no
 * cap rate is correct; a page with a 1,571,464% one is not.
 *
 * The ask stays publishable only because the page prints a share label beside
 * it. That label comes from publishListingShareKind, which reads the same three
 * dimensions this does — so a registry-matched row cannot lose its badge while
 * keeping its ask.
 */
export function publishWholePropertyAmount(
  input: FractionalInterestSubject & {
    price: number | null | undefined
    propertyType: string | null | undefined
  },
): number | null {
  if (listingIsFractionalInterest(input)) return null
  return publishSaleAskAmount({ price: input.price, propertyType: input.propertyType })
}
