#!/usr/bin/env node
/**
 * check-listing-figure-publish.mjs (ci:listing-figure-publish)
 *
 * WHY THIS GATE EXISTS. On 2026-08-19 a dev render of the real page
 * /homes-for-sale/bend/735-purcell-220174840 (MLS 220174840, ListingKey
 * 20231213164224139125000000) published, on one screen:
 *   H1 "$3" and price strip "$3"
 *   listing history "Back on market $0 / Price change $0 / Listed $0"
 *   mortgage estimate "Loan amount $2 · $1 down"
 *   JSON-LD SingleFamilyResidence with offers.price 2.5
 * 735 Purcell is a sublease of a former bank building. Its MLS PropertyType is
 * 'G' — "Commercial Lease" in the feed's own PropertyTypeLabel — so its
 * ListPrice 2.5 is rent per square foot, and the nearest-thousand money rule
 * turned every value under $500 into "$0". Every gate in the chain was green.
 *
 * The same day, /listing/20240827010740567422000000 (MLS 220190868, a $1
 * fractional interest at Eagle Crest, MLS PropertySubType "Tenancy in Common")
 * published on one screen:
 *   rental analysis "At $1 with 20% down, this property cash-flows $1,310 per
 *     month, a 1571464.0% cap rate and 0.0% cash-on-cash return"
 *   monthly payment "Loan amount $1 · — down" / "Total monthly (PITI) $40"
 *   JSON-LD SingleFamilyResidence, offers.price 1
 * A share price is not the price of the home. 65 Active rows carry that sub
 * type, plus 1 Timeshare; a further 213 Active rows are lease-priced.
 *
 * WHAT IT CHECKS.
 *  1. THE CONTRACT, EXECUTED. lib/listing/publish-listing-figure.ts is
 *     import-free on purpose: this gate transpiles it and RUNS the adversarial
 *     matrix, so the rule is verified rather than pattern-matched. A published
 *     money string may never be "$0" for an amount that is not zero, and a
 *     lease listing may never publish a sale ask or a sale $/sq ft.
 *  2. THE WIRING. The surfaces that print those figures must route through the
 *     contract: components/site/primitives/Price.tsx through publishMoneyText,
 *     lib/listing/publish-listing-share.ts through publishPricePerSqft, and
 *     lib/listing/publish-listing-ask.ts through publishSaleAskAmount. An
 *     executed contract nothing calls is a green gate over a broken page.
 *  3. NO SECOND FORMATTER. No file under app/ or components/ may hand-roll the
 *     nearest-thousand money render (Math.round(x / 1000) * 1000 with a dollar
 *     sign) — that expression is exactly what published "$0", and a copy of it
 *     outside the primitive is the same defect wearing a different filename.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { walkFiles } from './lib/walk.mjs'

const CONTRACT = 'lib/listing/publish-listing-figure.ts'
const failures = []

// ── 1. Execute the contract ────────────────────────────────────────────────
const source = readFileSync(CONTRACT, 'utf8')
if (/^\s*import\s/m.test(source)) {
  failures.push(
    `${CONTRACT} must stay import-free — this gate transpiles and executes it directly.`,
  )
}
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

const {
  publishMoneyText,
  publishPricePerSqft,
  publishSaleAskAmount,
  publishWholePropertyAmount,
  listingPriceIsLeaseRate,
  listingPriceIsFractionalShare,
  listingIsFractionalInterest,
  fractionalInterestEntry,
  FRACTIONAL_INTEREST_PROPERTIES,
  FRACTIONAL_INTEREST_LISTINGS,
} = mod

function expect(label, actual, wanted) {
  const ok = Object.is(actual, wanted)
  if (!ok) failures.push(`contract: ${label} — got ${JSON.stringify(actual)}, want ${JSON.stringify(wanted)}`)
}

// A positive amount may never publish as zero dollars, in any register.
for (const register of ['thousand', 'exact', 'compact']) {
  for (const value of [0.0007, 0.36, 0.49, 2.5, 2.75, 499]) {
    const text = publishMoneyText(value, register)
    if (text != null && /^\$0(?:\.0+)?[kKmM]?$/.test(text)) {
      failures.push(`contract: publishMoneyText(${value}, '${register}') published ${text}`)
    }
  }
}
expect("publishMoneyText(2.5,'thousand') — the Purcell history rows", publishMoneyText(2.5, 'thousand'), null)
expect("publishMoneyText(0.36,'exact')", publishMoneyText(0.36, 'exact'), null)
expect("publishMoneyText(895000)", publishMoneyText(895_000, 'thousand'), '$895,000')
expect("publishMoneyText(771,'exact')", publishMoneyText(771, 'exact'), '$771')

// A commercial lease publishes no sale-shaped figure.
expect('listingPriceIsLeaseRate(G)', listingPriceIsLeaseRate('G'), true)
expect('listingPriceIsLeaseRate(A)', listingPriceIsLeaseRate('A'), false)
expect('publishSaleAskAmount 735 Purcell', publishSaleAskAmount({ price: 2.5, propertyType: 'G' }), null)
expect('publishSaleAskAmount lease $4,200', publishSaleAskAmount({ price: 4200, propertyType: 'G' }), null)
expect('publishPricePerSqft lease 3.26', publishPricePerSqft({ propertyType: 'G', pricePerSqft: 3.26 }), null)
expect('publishPricePerSqft would print $0', publishPricePerSqft({ propertyType: 'A', pricePerSqft: 0.36 }), null)

// A verified figure still publishes, however low. A blanket "too cheap" floor
// would delete the real $10.84/sq ft on an in-park manufactured home.
expect('publishPricePerSqft in-park manufactured 10.84', publishPricePerSqft({ propertyType: 'B', pricePerSqft: 10.84 }), 11)
expect('publishPricePerSqft commercial sale 7.45', publishPricePerSqft({ propertyType: 'F', pricePerSqft: 7.45 }), 7)
expect('publishSaleAskAmount $1,695,000 condo', publishSaleAskAmount({ price: 1_695_000, propertyType: 'A' }), 1_695_000)

// A fractional interest publishes no WHOLE-PROPERTY figure. These are the three
// Active rows whose JSON-LD advertised a single-family residence at a share
// price, plus the top of the range — the sub type decides, never the amount.
expect('listingPriceIsFractionalShare(Tenancy in Common)', listingPriceIsFractionalShare('Tenancy in Common'), true)
expect('listingPriceIsFractionalShare(Timeshare)', listingPriceIsFractionalShare('Timeshare'), true)
expect('listingPriceIsFractionalShare(Single Family Residence)', listingPriceIsFractionalShare('Single Family Residence'), false)
// A co-op share carries the exclusive right to one whole unit, so its price is
// the whole unit's. 52 rows, $33,000–$829,000.
expect('listingPriceIsFractionalShare(Stock Cooperative)', listingPriceIsFractionalShare('Stock Cooperative'), false)
expect('listingPriceIsFractionalShare(null)', listingPriceIsFractionalShare(null), false)

// ── The registry dimension ─────────────────────────────────────────────────
// The sub type is one of three ways a listing qualifies, and on 2026-08-19 it
// was the only one wired. Eight Active fractional interests are filed under sub
// type "Condominium", so listingPriceIsFractionalShare returned false for all
// eight and /listing/20260529215303245812000000 (MLS 220222478, a $159,900
// quarter share of an 866 sq ft cabin at Lake Creek Lodge) published a 3.5% cap
// rate, "Cash needed $31,980", "$185 /sqft", a "homes near this price" promise,
// a SingleFamilyResidence offer at 159900, and an OG pill reading "$159,900"
// over "3 bed · 2 bath · 866 sq ft".
//
// EVERY CASE BELOW IS A REAL LIVE ROW, and the negative cases run the SAME
// branch the defect lived on — sub type "Condominium", PropertyType 'A' — so a
// revert to the sub-type-only rule fails here rather than passing green.
const CABIN_10_U3 = {
  propertySubType: 'Condominium',
  subdivisionName: 'Lake Creek Lodge',
  city: 'Camp Sherman',
  listNumber: '220222478',
}
expect(
  'listingPriceIsFractionalShare(Condominium) — the sub type alone still says no',
  listingPriceIsFractionalShare('Condominium'),
  false,
)
expect('listingIsFractionalInterest 220222478 (Lake Creek quarter share)', listingIsFractionalInterest(CABIN_10_U3), true)
// The eight Condominium-typed quarter shares, each quoted in the registry.
for (const listNumber of [
  '220218114',
  '220218115',
  '220222476',
  '220222478',
  '220215583',
  '220203447',
  '220218395',
  '220170948',
]) {
  expect(
    `listingIsFractionalInterest ${listNumber}`,
    listingIsFractionalInterest({ ...CABIN_10_U3, listNumber }),
    true,
  )
}
// Cabin 10 U2 discloses no share of its own. Its U1 and U3 siblings are the
// same cabin at the same $159,900 over the same 866 sq ft and both do. The key
// is the property, so all three answer the same.
expect(
  'listingIsFractionalInterest 220222477 (Cabin 10 U2, no remark of its own)',
  listingIsFractionalInterest({ ...CABIN_10_U3, listNumber: '220222477' }),
  true,
)
// The resort itself, sold whole at $10,000,000 under PropertyType 'F'.
expect(
  'listingIsFractionalInterest 220224690 (the resort, a named exception)',
  listingIsFractionalInterest({ ...CABIN_10_U3, propertySubType: null, listNumber: '220224690' }),
  false,
)
// A property entry is wrong in the other direction too, and this property sells
// whole cabins as well as quarters. Both rows render at /listing/<key>, and
// before they were named the page printed "Fractional interest" beside a
// whole-cabin ask and withheld that cabin's $/sq ft and JSON-LD offer. A wrong
// label is a §0 failure exactly like a wrong number.
for (const [listNumber, price, what] of [
  ['201805357', 849_500, '"Full interest 3 bed/3 bath cabin", unit 18'],
  ['220194788', 1_100_000, '"own the entire cabin (four-quarter-share interests)", unit 24'],
]) {
  expect(
    `listingIsFractionalInterest ${listNumber} (whole cabin at Lake Creek Lodge — ${what})`,
    listingIsFractionalInterest({ ...CABIN_10_U3, listNumber }),
    false,
  )
  expect(
    `publishWholePropertyAmount ${listNumber} (whole cabin, ${what})`,
    publishWholePropertyAmount({ ...CABIN_10_U3, listNumber, price, propertyType: 'A' }),
    price,
  )
}
// The one reviewed listing at a property that also sells whole condos.
expect(
  'listingIsFractionalInterest 220216423 (Inn Of The 7th, listing entry)',
  listingIsFractionalInterest({
    propertySubType: 'Multi Family',
    subdivisionName: 'Inn Of The 7th',
    city: 'Bend',
    listNumber: '220216423',
  }),
  true,
)
// A property entry withholds every row filed under it, so Inn Of The 7th is
// deliberately NOT one: 27 Active Condominium rows there ($150,000–$352,900)
// disclose no share and are whole-condo sales.
expect(
  'listingIsFractionalInterest — a whole condo at Inn Of The 7th',
  listingIsFractionalInterest({
    propertySubType: 'Condominium',
    subdivisionName: 'Inn Of The 7th',
    city: 'Bend',
    listNumber: '220999111',
  }),
  false,
)
expect(
  'listingIsFractionalInterest — an ordinary Bend home',
  listingIsFractionalInterest({
    propertySubType: 'Single Family Residence',
    subdivisionName: 'Awbrey Butte',
    city: 'Bend',
    listNumber: '220000000',
  }),
  false,
)
// The registry key normalizes case and whitespace, so a feed casing change
// cannot silently un-register a property.
expect(
  'listingIsFractionalInterest — registry key is case and space insensitive',
  listingIsFractionalInterest({ ...CABIN_10_U3, subdivisionName: '  lake  creek lodge ', city: 'CAMP SHERMAN' }),
  true,
)

// THE ROW THAT STATES NOTHING, on the branch the defect lived on. MLS
// 220218536 (57379 Beaver Ridge, Sunriver, $19,500) carries no sub type, no
// remarks, no beds, no baths and no living area, so both dimensions above are
// silent on it and /listing/20260403195603425451000000 published "Cap rate
// 71.2%", "Cash on cash 324.3%", "Cash flow $1,054/mo", "Cash needed $3,900",
// "Total monthly (PITI) $115", "Loan amount $15,600 · $3,900 down", JSON-LD
// offers.price 19500 and og:description "$19,500 · 57379 Beaver Ridge" with no
// share label anywhere. The fields below are that row's real values.
const BEAVER_RIDGE = {
  propertySubType: null,
  subdivisionName: 'The Ridge',
  city: 'Sunriver',
  listNumber: '220218536',
}
expect(
  'listingPriceIsFractionalShare(null) — no sub type, so that dimension cannot answer',
  listingPriceIsFractionalShare(BEAVER_RIDGE.propertySubType),
  false,
)
expect('listingIsFractionalInterest 220218536 (57379 Beaver Ridge, no remark of its own)', listingIsFractionalInterest(BEAVER_RIDGE), true)
expect(
  'publishWholePropertyAmount 220218536 ($19,500, sub type null, no remarks)',
  publishWholePropertyAmount({ ...BEAVER_RIDGE, price: 19_500, propertyType: 'A' }),
  null,
)
// THE RIDGE IS NOT A REGISTERED PROPERTY, and must not become one. It sold 9
// whole condos ($199,000–$399,000, one Pending right now), so a property entry
// would print "Fractional interest" beside the next whole-condo ask there.
// Every other row at the subdivision answers on its own sub type.
expect(
  'listingIsFractionalInterest 220218659 (a 100% share at The Ridge, $399,000)',
  listingIsFractionalInterest({ ...BEAVER_RIDGE, propertySubType: 'Condominium', listNumber: '220218659' }),
  false,
)
expect(
  'publishWholePropertyAmount 220218659 (whole condo at The Ridge)',
  publishWholePropertyAmount({
    ...BEAVER_RIDGE,
    propertySubType: 'Condominium',
    listNumber: '220218659',
    price: 399_000,
    propertyType: 'A',
  }),
  399_000,
)
// Its 11 Active siblings are all Tenancy in Common and were already caught.
expect(
  'listingIsFractionalInterest 220215789 (1/8 at The Ridge, sub type says so)',
  listingIsFractionalInterest({ ...BEAVER_RIDGE, propertySubType: 'Tenancy in Common', listNumber: '220215789' }),
  true,
)
// A row stating no sub type ANYWHERE ELSE still publishes. 45 of the 46 live
// Active class-A rows that state no bedrooms, no baths, no living area and no
// remarks are ordinary homes — 220218842 asks $1,600,000 in Awbrey Park — and
// §0.7 does not license deleting a verified ask.
expect(
  'listingIsFractionalInterest 220218842 (Awbrey Park, states nothing, not a share)',
  listingIsFractionalInterest({
    propertySubType: null,
    subdivisionName: 'Awbrey Park',
    city: 'Bend',
    listNumber: '220218842',
  }),
  false,
)
expect(
  'publishWholePropertyAmount 220218842 ($1,600,000 Awbrey Park)',
  publishWholePropertyAmount({
    propertySubType: null,
    subdivisionName: 'Awbrey Park',
    city: 'Bend',
    listNumber: '220218842',
    price: 1_600_000,
    propertyType: 'A',
  }),
  1_600_000,
)

// EVERY REGISTRY ROW CARRIES ITS EVIDENCE. A guess list is not a verified
// source under §0.1, so an entry that names no MLS number and quotes no remark
// fails the commit rather than silently withholding figures.
//
// The week forms are share vocabulary in THIS feed, not a widening for
// convenience: The Ridge in Sunriver sells interval ownership and says so in
// exactly those words — "6-week deeded ownership" (220224950), "12-week
// fractional ownership" (220223353), "rare 1/8 ownership at The Ridge (6 weeks
// of annual use)" (220215789), "own 6 weeks (1/8th share)" (220140810).
const SHARE_PHRASE =
  /(\b1\/[2-9](?:st|nd|rd|th)?\b|\b\d{1,2}%\s+(interest|ownership)|quarter|third|half|fractional|shared? interest|\b\d{1,2}[-\s]weeks?\b|weeks? of annual use)/i
for (const p of FRACTIONAL_INTEREST_PROPERTIES ?? []) {
  const where = `${p.subdivision}, ${p.city}`
  if (!p.subdivision?.trim() || !p.city?.trim()) {
    failures.push(`registry: a property entry must name both a subdivision and a city (${where}).`)
  }
  if (!p.shareLabel?.trim()) {
    failures.push(`registry: ${where} must carry the shareLabel the page prints beside the ask.`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.verifiedOn ?? '')) {
    failures.push(`registry: ${where} must carry an ISO verifiedOn date.`)
  }
  if (!Number.isInteger(p.rowsAllStatuses) || p.rowsAllStatuses <= 0) {
    failures.push(`registry: ${where} must count the rows it was verified over.`)
  }
  if (!Number.isInteger(p.rowsDisclosingShare) || p.rowsDisclosingShare <= 0) {
    failures.push(`registry: ${where} must count the rows that disclose a share.`)
  }
  if (p.rowsDisclosingShare > p.rowsAllStatuses) {
    failures.push(`registry: ${where} claims more disclosing rows than rows.`)
  }
  // A property entry withholds figures for EVERY row filed under it. Three
  // independent listings is the floor for calling the property, not the row.
  if (!Array.isArray(p.evidence) || p.evidence.length < 3) {
    failures.push(
      `registry: ${where} names a whole property, so it needs at least three MLS numbers quoted from the feed (has ${p.evidence?.length ?? 0}).`,
    )
  }
  for (const e of p.evidence ?? []) {
    if (!/^\d{6,}$/.test(e.listNumber ?? '')) {
      failures.push(`registry: ${where} evidence row has no MLS number.`)
    }
    if (!SHARE_PHRASE.test(e.remark ?? '')) {
      failures.push(
        `registry: ${where} evidence for ${e.listNumber} quotes no share language — "${e.remark}". Quote the feed's own words, never a paraphrase.`,
      )
    }
  }
  for (const x of p.exceptions ?? []) {
    if (!/^\d{6,}$/.test(x.listNumber ?? '') || !x.why?.trim()) {
      failures.push(`registry: ${where} exception must name an MLS number and say why it is not a share.`)
    }
    if (fractionalInterestEntry({ ...CABIN_10_U3, subdivisionName: p.subdivision, city: p.city, propertySubType: null, listNumber: x.listNumber }) != null) {
      failures.push(`registry: ${where} exception ${x.listNumber} is still classified as a share.`)
    }
  }
}
// A LISTING ENTRY NEEDS VERBATIM REMARKS ABOUT THAT DWELLING, IN ONE OF EXACTLY
// TWO KINDS. `evidence` is the row's own remark. `addressEvidence` is the same
// street address's prior listings, for a row the feed gives no remarks at all —
// MLS 220218536 is one, and under the older rule ("a listing entry needs its own
// verbatim remark") it could not be registered at all, which left the rule
// weakest on the row whose page could say nothing. Both kinds, neither kind, or
// an address entry that quotes nothing all fail here.
for (const l of FRACTIONAL_INTEREST_LISTINGS ?? []) {
  const where = `listing ${l.listNumber}`
  if (!/^\d{6,}$/.test(l.listNumber ?? '')) {
    failures.push('registry: a listing entry must name an MLS number.')
  }
  if (!l.shareLabel?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(l.verifiedOn ?? '')) {
    failures.push(`registry: ${where} needs a shareLabel and an ISO verifiedOn date.`)
  }
  if (!l.city?.trim()) {
    failures.push(`registry: ${where} must name the city the row is filed under.`)
  }
  const hasOwn = l.evidence != null
  const hasAddress = l.addressEvidence != null
  if (hasOwn === hasAddress) {
    failures.push(
      `registry: ${where} must carry exactly one kind of evidence — the row's own verbatim remark, or, when the feed states none for it, the same address's prior listings (has ${hasOwn && hasAddress ? 'both' : 'neither'}).`,
    )
  }
  if (hasOwn && !SHARE_PHRASE.test(l.evidence.remark ?? '')) {
    failures.push(
      `registry: ${where} quotes no share language — "${l.evidence.remark}".`,
    )
  }
  if (hasAddress) {
    const a = l.addressEvidence
    if (!a.address?.trim()) {
      failures.push(`registry: ${where} address evidence must name the street line it read.`)
    }
    if (!Number.isInteger(a.rowsAtAddress) || a.rowsAtAddress < 2) {
      failures.push(
        `registry: ${where} address evidence must count the rows at that address, and there must be a prior listing to read (got ${a.rowsAtAddress}).`,
      )
    }
    // §0 forbids reporting absence from one query shape, so the entry states
    // the counter-query's answer rather than leaving it unasked. A dwelling
    // that has ALSO been listed whole is not settled by its history.
    if (!Number.isInteger(a.rowsClaimingWholeInterest)) {
      failures.push(
        `registry: ${where} address evidence must state how many rows at that address claim a whole interest — the counter-query, not just the matches.`,
      )
    } else if (a.rowsClaimingWholeInterest > 0) {
      failures.push(
        `registry: ${where} address evidence reports ${a.rowsClaimingWholeInterest} row(s) at ${a.address} claiming a whole interest. A dwelling that has been listed whole is not classified by its history alone.`,
      )
    }
    const priors = Array.isArray(a.priorListings) ? a.priorListings : []
    if (priors.length === 0) {
      failures.push(
        `registry: ${where} address evidence quotes no prior listing. The claim is that this dwelling sells as a share; the feed's own words about this dwelling are what say so.`,
      )
    }
    for (const p of priors) {
      if (!/^\d{6,}$/.test(p.listNumber ?? '')) {
        failures.push(`registry: ${where} address evidence has a prior listing with no MLS number.`)
      }
      if (p.listNumber === l.listNumber) {
        failures.push(
          `registry: ${where} address evidence cites the row itself as its own prior listing.`,
        )
      }
      if (!p.status?.trim() || typeof p.listPrice !== 'number' || !(p.listPrice > 0)) {
        failures.push(
          `registry: ${where} prior listing ${p.listNumber} must carry the status and asking price it was read at.`,
        )
      }
      if (!SHARE_PHRASE.test(p.remark ?? '')) {
        failures.push(
          `registry: ${where} prior listing ${p.listNumber} quotes no share language — "${p.remark}". Quote the feed's own words, never a paraphrase.`,
        )
      }
    }
  }
}

const share = (price, propertySubType) =>
  publishWholePropertyAmount({
    price,
    propertyType: 'A',
    propertySubType,
    subdivisionName: 'Awbrey Butte',
    city: 'Bend',
    listNumber: '220000000',
  })
expect('publishWholePropertyAmount 220190868 ($1 fractional)', share(1, 'Tenancy in Common'), null)
expect('publishWholePropertyAmount 220157653 ($250 fractional)', share(250, 'Tenancy in Common'), null)
expect('publishWholePropertyAmount 220218225 ($500 fractional)', share(500, 'Tenancy in Common'), null)
expect('publishWholePropertyAmount 220224253 ($295,000 1/3 share)', share(295_000, 'Tenancy in Common'), null)
expect('publishWholePropertyAmount 220221076 ($215,000 quarter timeshare)', share(215_000, 'Timeshare'), null)
expect(
  'publishWholePropertyAmount 735 Purcell (lease)',
  publishWholePropertyAmount({
    price: 2.5,
    propertyType: 'G',
    propertySubType: null,
    subdivisionName: null,
    city: 'Bend',
    listNumber: '220174840',
  }),
  null,
)
// THE FOUNDING CASE OF THE REGISTRY DIMENSION, on its own branch. Sub type
// "Condominium", PropertyType 'A', $159,900 — a shape the sub-type-only rule
// published. Every whole-property figure on 220222478's page came off this.
expect(
  'publishWholePropertyAmount 220222478 ($159,900 quarter share, sub type Condominium)',
  publishWholePropertyAmount({ ...CABIN_10_U3, price: 159_900, propertyType: 'A' }),
  null,
)
expect(
  'publishWholePropertyAmount 220222477 (Cabin 10 U2, no remark of its own)',
  publishWholePropertyAmount({ ...CABIN_10_U3, listNumber: '220222477', price: 159_900, propertyType: 'A' }),
  null,
)
// The identical shape anywhere else still publishes. Withholding is per
// verified property, not per price and not per sub type.
expect('publishWholePropertyAmount $159,900 condo elsewhere', share(159_900, 'Condominium'), 159_900)
// The whole-home rows still publish, including a fee-simple home cheaper than
// every share above. Withholding is per sub type, not per price.
expect('publishWholePropertyAmount $1,695,000 condo', share(1_695_000, 'Condominium'), 1_695_000)
expect('publishWholePropertyAmount $8,500 in-park manufactured', share(8_500, 'In Park'), 8_500)
expect('publishWholePropertyAmount no sub type', share(475_000, null), 475_000)

// ── 2. The wiring ──────────────────────────────────────────────────────────
const WIRED = [
  ['components/site/primitives/Price.tsx', 'publishMoneyText'],
  ['lib/listing/publish-listing-share.ts', 'publishPricePerSqft'],
  ['lib/listing/publish-listing-ask.ts', 'publishSaleAskAmount'],
  // The featured rail: the ONE source for the homepage, every city and community
  // page, and the listing page's nearby-homes band. It handed KbFeatured a raw
  // ListPrice, so 725 Broadway Street (a Bend commercial lease) published "$2"
  // as an ask in the rail on 735 Purcell's own page.
  ['lib/kb/resolve-featured-items.ts', 'publishSaleAskAmount'],
  // The whole-property surfaces. Each one makes a claim about the DWELLING —
  // its yield, its monthly cost, its machine-readable offer, its share card,
  // its price-band promise — so each takes the whole-property price, never the
  // ask. MLS 220190868 asks $1 for a fractional interest at Eagle Crest.
  ['app/listing/[listingKey]/page.tsx', 'publishWholePropertyAmount'],
  ['components/site/listing-detail/RentalAnalysis.tsx', 'publishWholePropertyAmount'],
  ['components/site/listing-detail/PriceCtaStrip.tsx', 'publishWholePropertyAmount'],
  ['app/api/og/route.tsx', 'publishWholePropertyAmount'],
]
for (const [file, symbol] of WIRED) {
  const text = readFileSync(file, 'utf8')
  if (!text.includes(`from '@/lib/listing/publish-listing-figure'`) || !text.includes(symbol)) {
    failures.push(`wiring: ${file} must publish through ${symbol} from the figure contract.`)
  }
}

// AN IMPORT IS NOT A CALL. The substring check above passes on a file that
// imports the publisher and never calls it, which is exactly the shape a
// regression takes: the body goes back to the raw ListPrice and the import line
// survives. Proven on this gate 2026-08-19 — RentalAnalysis.tsx reverted to
// `listing.listPrice ?? 0` with its import intact and the gate stayed green
// while the page published a 1,571,464% cap rate again. Nothing else catches
// it: an unused import is a warning to eslint and nothing at all to tsc. So the
// whole-property surfaces are asserted at the CALL SITE, in the AST.
for (const [file, symbol] of WIRED.filter(([, s]) => s === 'publishWholePropertyAmount')) {
  const text = readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ES2022,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  let calls = 0
  const countCalls = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === symbol
    ) {
      calls++
    }
    ts.forEachChild(node, countCalls)
  }
  countCalls(sourceFile)
  if (calls === 0) {
    failures.push(
      `wiring: ${file} imports ${symbol} but never calls it. An unused import withholds nothing.`,
    )
  }
}

// THE CARD PRINTS THE SHARE LABEL, AND PRINTS IT FROM THE SUBJECT IT ALREADY
// HOLDS. A card's ask is the same claim the listing page's is, in less space,
// and the label is the condition on publishing it at all. Rendered before this
// rule: /cities/camp-sherman and /homes-for-sale/camp-sherman/lake-creek-lodge
// printed "$249,000 · 13375 Forest Service Road · 3 bd · 3 ba · 1,306 sqft"
// over ten quarter shares with the string "Fractional" nowhere on either page.
// Asserted at the CALL SITE for the reason proven above — an unused import
// withholds nothing — and the label may not arrive through the optional `badge`
// prop, which every surface that forgot it would leave empty.
const SHARE_LABEL_SURFACES = [
  // The one card shape. Search results, the map list, subdivision browse, golf,
  // the LP grids, saved and hidden homes, video tiles.
  'components/site/ListingCard.tsx',
  // The same card with the tour playing inline. It takes ListingCardData, so it
  // holds the subject already and has no excuse for a bare share ask.
  'components/site/VideoListingCard.tsx',
  // The v3 Field row builders on the place pages (2026-08-26): these replaced
  // the dual-pane inventory list — the module that printed the Camp Sherman
  // quarter shares — so each must resolve the share label beside its price.
  'app/cities/[slug]/_v3/city-field-items.ts',
  'app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections.ts',
  'app/communities/[slug]/_v3/community-opening.ts',
  // The price tape between sections on the homepage, cities, neighborhoods and
  // communities. It runs a share ask between whole-home asks.
  'lib/kb/place-sections.ts',
  'app/page.tsx',
]
for (const file of SHARE_LABEL_SURFACES) {
  const text = readFileSync(file, 'utf8')
  if (!text.includes(`from '@/lib/listing/publish-listing-share'`)) {
    failures.push(`wiring: ${file} must resolve its share label through publishListingShareKind.`)
    continue
  }
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ES2022,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  let calls = 0
  const countCalls = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'publishListingShareKind'
    ) {
      calls++
    }
    ts.forEachChild(node, countCalls)
  }
  countCalls(sourceFile)
  if (calls === 0) {
    failures.push(
      `wiring: ${file} imports publishListingShareKind and never calls it. A fractional ask with no label beside it is the listing page's defect at tile size.`,
    )
  }
}
{
  // The label may not arrive as a caller-supplied field on the card row.
  // `badge` is optional by design, and every surface that forgot it would print
  // a share ask bare — which is why ListingCardData already requires the
  // property type and the place fields.
  const cardText = readFileSync('components/site/ListingCard.tsx', 'utf8')
  if (/^\s*(shareKind|shareLabel)\??:/m.test(cardText)) {
    failures.push(
      'wiring: components/site/ListingCard.tsx declares the share label as a field on ListingCardData. It must be computed inside the card from the subject it already carries.',
    )
  }
  // The two row shapes feeding the place surfaces take the sub type as a
  // REQUIRED field, so the typechecker asks rather than a reviewer remembering.
  for (const [file, shape] of [
    ['lib/explore/subdivision-page-extras.ts', 'the splitRowsFromTiles tile'],
    ['lib/kb/place-sections.ts', 'TileRow'],
  ]) {
    const text = readFileSync(file, 'utf8')
    if (!/\n\s*propertySubType: string \| null\n/.test(text)) {
      failures.push(
        `wiring: ${file} must take propertySubType as a REQUIRED field on ${shape}. Optional reads undefined at the caller that forgets it.`,
      )
    }
  }
}

// THE REST OF THE CLASS, COUNTED — AND IT MAY ONLY SHRINK.
//
// Sixteen more call sites in ten files publish a per-listing ask and cannot say
// what it buys, because they take a bare price. Each is the same defect as the
// Camp Sherman cards, on a different surface: the v3 field items on city,
// neighborhood, community, subdivision and blog pages, the KB featured rail and
// activity tape, the builder rail, and the map-pin label.
//
// They are NOT converted here because two of them are map pin labels, where the
// fix is a product decision (a pin cannot carry a second line, so a share pin
// either shows its label instead of its price or is not drawn) that needs each
// place-page family rendered to settle. Shipping that unrendered across five
// page families is the drift §8 forbids. So the population is named and frozen:
// a new surface may not join it, and the number comes down as each is converted.
// A gate that lets a known class grow is not a gate.
const UNLABELLED_ASK_SURFACES_MAX = 7
{
  const unlabelled = []
  for (const f of [...walkFiles('app'), ...walkFiles('components'), ...walkFiles('lib')]) {
    if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue
    if (f === 'lib/listing/publish-listing-ask.ts') continue
    const text = readFileSync(f, 'utf8')
    if (!/formatPublishedAsk\(|formatPublishedSaleAsk\(/.test(text)) continue
    if (/publishListingShareKind\s*\(/.test(text)) continue
    unlabelled.push(f)
  }
  if (unlabelled.length > UNLABELLED_ASK_SURFACES_MAX) {
    failures.push(
      `unlabelled ask: ${unlabelled.length} files publish a listing ask without resolving publishListingShareKind, over the frozen ${UNLABELLED_ASK_SURFACES_MAX}. New: ${unlabelled.join(', ')}. A share ask with nothing beside it claims the price of the whole dwelling.`,
    )
  }
  if (unlabelled.length < UNLABELLED_ASK_SURFACES_MAX) {
    failures.push(
      `unlabelled ask: ${unlabelled.length} files remain, below the recorded ${UNLABELLED_ASK_SURFACES_MAX}. Lower UNLABELLED_ASK_SURFACES_MAX to ${unlabelled.length} so the ratchet holds the ground you just took.`,
    )
  }
}

// A RENT NEEDS A DWELLING. lib/hud-fmr.ts read `bedrooms ?? 2` and then
// labelled its answer "HUD Fair Market Rent (FY2025), Deschutes County, 2BR" —
// a bedroom count the feed never stated, published under a sourced label. On
// MLS 220218536 that produced "Gross rent $1,667", "Cap rate 71.2%" and "Cash
// on cash 324.3%".
//
// THE POPULATION IS ALL THREE RENTAL-ELIGIBLE CLASSES (re-counted 2026-08-19).
// Live Active or Active Under Contract rows stating no BedroomsTotal: 46 of
// 4,685 'A', 5 of 228 'B', 155 of 155 'C'. 193 sit in the section's render
// window; 57 of those are in a HUD-mapped city and published the fabricated
// label — verified on /listing/20260501203559794588000000 (MLS 220220657,
// Madras multi-family), which read "HUD Fair Market Rent (FY2025), Jefferson
// County, 2BR" over a building the feed gives no bedroom count for.
{
  const hudSrc = readFileSync('lib/hud-fmr.ts', 'utf8')
  const hudCode = hudSrc.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
  if (/bedrooms\s*\?\?/.test(hudCode)) {
    failures.push(
      'wiring: lib/hud-fmr.ts substitutes a bedroom count when the feed states none. A figure labelled "2BR" for a row with no bedrooms is a fabricated basis (§0), not a default.',
    )
  }
  if (!/typeof bedrooms !== 'number'/.test(hudCode)) {
    failures.push(
      'wiring: lib/hud-fmr.ts must return null when the bedroom count is not stated.',
    )
  }
  const rentalSrc = readFileSync('components/site/listing-detail/RentalAnalysis.tsx', 'utf8')
  const rentalCode = rentalSrc.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
  // The section also carries a price-ratio fallback for cities outside the HUD
  // map. Withholding the HUD figure without this guard would route those 46
  // rows into it and swap one unsourced rent for another.
  if (!/listing\.beds\s*==\s*null\)\s*return null/.test(rentalCode)) {
    failures.push(
      'wiring: components/site/listing-detail/RentalAnalysis.tsx must render nothing when the feed states no bedroom count. Every figure in the section descends from a monthly rent, and its fallback rent is a price ratio — $500/mo off a $19,500 share on MLS 220218536.',
    )
  }
}

// The $/sq ft publisher takes the property type AND the whole fractional
// subject, so a caller cannot omit either check by forgetting a field — the
// typechecker asks for both by name. The subject is what carries the registry
// dimension: an interface that took only the sub type published "$185 /sqft"
// on MLS 220222478.
const shareSrc = readFileSync('lib/listing/publish-listing-share.ts', 'utf8')
if (
  !/publishListingSharePricePerSqft\(\s*input:\s*FractionalInterestSubject\s*&\s*\{[^}]*propertyType:/s.test(
    shareSrc,
  )
) {
  failures.push(
    'wiring: publishListingSharePricePerSqft must take FractionalInterestSubject plus a REQUIRED propertyType, so no surface can skip the lease or the registry check.',
  )
}
if (!/publishListingShareKind\(\s*subject:\s*FractionalInterestSubject/.test(shareSrc)) {
  failures.push(
    'wiring: publishListingShareKind must take the whole FractionalInterestSubject. The badge is what lets a share ask publish at all, and eight Active shares carry sub type "Condominium" — a sub-type-only label leaves them bare.',
  )
}

// THE POOLING SURFACES ASK THE WHOLE QUESTION. Each of these drops fractional
// rows out of a published price statistic. Asking listingPriceIsFractionalShare
// (the sub-type dimension alone) is exactly the state that published a $249,000
// Camp Sherman median against a $922,475 whole-home one.
const WHOLE_RULE_SURFACES = [
  'lib/market/tile-medians.ts',
  'lib/search/price-ladder.ts',
  'app/zip/[zip]/page.tsx',
]
for (const file of WHOLE_RULE_SURFACES) {
  const text = readFileSync(file, 'utf8')
  const code = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
  if (!/listingIsFractionalInterest\s*\(/.test(code)) {
    failures.push(
      `wiring: ${file} filters a published price statistic, so it must ask listingIsFractionalInterest — the whole rule, not the sub-type dimension alone.`,
    )
  }
  if (/listingPriceIsFractionalShare\s*\(/.test(code)) {
    failures.push(
      `wiring: ${file} calls listingPriceIsFractionalShare, which answers only the sub-type dimension. Eight Active fractional interests carry sub type "Condominium".`,
    )
  }
}

// The ladder counts a DIFFERENT population from the page's inventory count, so
// it may not wear the inventory caption. Sunriver printed 122 in the hero and
// 89 under the same words in the card below it.
const ladderSrc = readFileSync('lib/search/price-ladder.ts', 'utf8')
if (!/grain:\s*'sfr-whole-home-priced'/.test(ladderSrc) || /grain:\s*'sfr'/.test(ladderSrc)) {
  failures.push(
    "wiring: lib/search/price-ladder.ts must publish its banded count at grain 'sfr-whole-home-priced'. Grain 'sfr' is the page's inventory caption, which counts the fractional rows this card drops.",
  )
}

// The structured data takes the whole-property price by name. A machine node
// carries no "Tenancy in common" badge, so the ask the page prints beside that
// badge is not the figure an ingester may read as the price of the home.
const jsonLdSrc = readFileSync('app/listing/[listingKey]/listing-json-ld.ts', 'utf8')
if (!/wholePropertyPrice:\s*number \| null/.test(jsonLdSrc) || /publishedSaleAsk/.test(jsonLdSrc)) {
  failures.push(
    'wiring: buildListingJsonLd must take wholePropertyPrice — the offer and the priced description may not be built from a badged share ask.',
  )
}

// ── 3. No second rule on the listing surface ───────────────────────────────
// Scoped to the surface this contract governs. `$${Math.round(x / 1000) * 1000}`
// is the exact expression that printed "$0" three times on the Purcell history;
// a private copy of it beside the primitive reopens the class. Fifteen files
// OUTSIDE this surface still carry that expression (charts, CRM views, LP copy)
// — a real finding, but a different owner's population, so this gate names its
// scope rather than baselining files it has not read.
const LISTING_SURFACE = (f) =>
  f.startsWith('app/listing/') ||
  f.startsWith('components/site/listing-detail/') ||
  f.startsWith('lib/listing/') ||
  f === 'components/site/ListingCard.tsx' ||
  f === 'components/site/VideoListingCard.tsx' ||
  f === 'lib/site/listing-card.ts' ||
  f === 'components/site/primitives/Price.tsx'
const SELF = new Set([CONTRACT, 'scripts/check-listing-figure-publish.mjs'])
const THOUSAND_ROUND_CURRENCY = /\$\$\{[^}]*Math\.round\([^}]*\/\s*1000\s*\)\s*\*\s*1000/
// Second rule, same idea in the sub-type dimension: ONE fractional-interest
// list, in the contract this gate executes. A private copy on the surface
// drifts silently — the page keeps withholding while the copy decides
// something else.
const SUBTYPE_LITERALS = /['"]Tenancy in Common['"][\s\S]{0,120}['"]Timeshare['"]/
for (const file of [...walkFiles('app'), ...walkFiles('components'), ...walkFiles('lib')]) {
  if (SELF.has(file) || !LISTING_SURFACE(file)) continue
  if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue
  const text = readFileSync(file, 'utf8')
  if (THOUSAND_ROUND_CURRENCY.test(text)) {
    failures.push(
      `second formatter: ${file} renders thousand-rounded currency itself. That expression published "$0" on 735 Purcell — render through the Price primitive / publishMoneyText.`,
    )
  }
  // Prose may name the sub types; code may not re-declare them. Comments are
  // stripped first so a docblock citing 220190868 is not a violation.
  const code = text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  if (SUBTYPE_LITERALS.test(code)) {
    failures.push(
      `second rule: ${file} declares its own fractional sub-type list. The one list lives in ${CONTRACT} (FRACTIONAL_INTEREST_SUB_TYPES).`,
    )
  }
}

if (failures.length > 0) {
  console.error('✗ listing figure publish contract')
  for (const f of failures) console.error(`  - ${f}`)
  console.error(
    '\n  §0.7: publish a figure you have verified, or publish no figure. A positive amount',
  )
  console.error(
    '  printed as $0, a lease rate printed under a sale label, or a share price read as the',
  )
  console.error('  price of the whole home, is none of them.')
  process.exit(1)
}

console.log(
  `✓ listing figure publish contract — money never publishes $0, lease and fractional-share listings publish no whole-home figure (${WIRED.length} surfaces wired)`,
)
