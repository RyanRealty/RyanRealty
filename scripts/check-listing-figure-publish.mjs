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

const share = (price, propertySubType) =>
  publishWholePropertyAmount({ price, propertyType: 'A', propertySubType })
expect('publishWholePropertyAmount 220190868 ($1 fractional)', share(1, 'Tenancy in Common'), null)
expect('publishWholePropertyAmount 220157653 ($250 fractional)', share(250, 'Tenancy in Common'), null)
expect('publishWholePropertyAmount 220218225 ($500 fractional)', share(500, 'Tenancy in Common'), null)
expect('publishWholePropertyAmount 220224253 ($295,000 1/3 share)', share(295_000, 'Tenancy in Common'), null)
expect('publishWholePropertyAmount 220221076 ($215,000 quarter timeshare)', share(215_000, 'Timeshare'), null)
expect(
  'publishWholePropertyAmount 735 Purcell (lease)',
  publishWholePropertyAmount({ price: 2.5, propertyType: 'G', propertySubType: null }),
  null,
)
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

// The $/sq ft publisher takes the property type, so a caller cannot omit the
// lease check by forgetting it — the typechecker asks for it by name.
const shareSrc = readFileSync('lib/listing/publish-listing-share.ts', 'utf8')
if (!/publishListingSharePricePerSqft\(input:\s*\{[^}]*propertyType:/s.test(shareSrc)) {
  failures.push(
    'wiring: publishListingSharePricePerSqft must take a REQUIRED propertyType so no surface can skip the lease check.',
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
