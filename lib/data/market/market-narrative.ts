/**
 * market-narrative — deterministic, §0-safe market narrative generator (W8.7).
 *
 * WHY DETERMINISTIC, NOT LLM: CLAUDE.md §0 requires every published number to
 * trace to a verified source. An LLM narrative can fabricate or drift a figure;
 * a template that interpolates ONLY the market_stats_cache row's own values
 * cannot. Every number in the output is a formatted field of the input stats,
 * so §0 holds by construction — and ci:market-narrative-integrity proves it by
 * executing this function and checking every emitted number against the source.
 *
 * The "Mohtashami corpus" is applied as ANALYTICAL METHOD, not reproduced text:
 * his framing — months of supply as the demand/supply balance, price vs.
 * inventory vs. days-on-market read together, buyer/seller outlook from the
 * direction of those three — drives the interpretive branches below. No quotes.
 *
 * Voice: sentence case, "you/your", no em-dashes or semicolons, currency
 * rounded to the nearest thousand, days as an integer, percents with one
 * decimal and a signed arrow. checkBrandVoice runs over the output in the gate.
 */

// The ONE source of the months-of-supply thresholds (ci:market-formula) — never
// inline the boundary numbers here. lib/market/classify.ts is pure threshold
// constants + a function, so it bundles cleanly for the §0 gate.
import { marketVerdict } from '@/lib/market/classify'

// Pure currency-rounded formatter, inlined on purpose: the equivalent in
// lib/crm/market-report-email.ts transitively imports 'server-only', which would
// make this module un-bundleable — and the §0 gate (ci:market-narrative-integrity)
// must esbuild-bundle and EXECUTE this file to prove every number traces. Keeping
// it dependency-free is what makes that possible (same rule as deliverable-path.ts).
function formatCurrencyRounded(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `$${Math.round(value / 1000) * 1000}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** The market_stats_cache fields the narrative reads. All numbers come from here. */
export interface NarrativeStats {
  geoLabel: string
  periodLabel: string // e.g. "June 2026" or "year to date"
  medianSalePrice: number | null
  soldCount: number
  medianDom: number | null
  avgSaleToListRatio: number | null
  medianPpsf: number | null
  endOfPeriodInventory: number | null
  yoyMedianPriceDeltaPct: number | null
  yoyDomChange: number | null
  yoyInventoryChangePct: number | null
  /** active / (closed_last_6_months / 6); null when not computable. */
  monthsOfSupply: number | null
}

export interface MarketNarrative {
  overview: string
  priceAnalysis: string
  speedAnalysis: string
  inventoryAnalysis: string
  buyerOutlook: string
  sellerOutlook: string
  faq: Array<{ q: string; a: string }>
  /** Every figure the prose emitted, with the source field. The §0 audit trail. */
  figureTrace: Array<{ value: string; source: keyof NarrativeStats }>
}

// ── formatters (brand voice) ─────────────────────────────────────────────────
const usd = (n: number | null): string => (n == null ? '—' : formatCurrencyRounded(n))
/** Price per square foot is small (hundreds), so round to the dollar, not the thousand. */
const usdPerSqft = (n: number | null): string =>
  n == null || !Number.isFinite(n) ? '—' : `$${Math.round(n)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const days = (n: number | null): string => (n == null ? '—' : `${Math.round(n)} days`)
const pct1 = (n: number | null): string => (n == null ? '—' : `${n.toFixed(1)}%`)
/**
 * Sale-to-list is stored as a RATIO in market_stats_cache (0.9697 = 96.97%), so
 * it is multiplied by 100 for display. Formatting the raw ratio produced an
 * absurd "1.0% of asking" — a §0 unit bug caught by the writer int test.
 */
const pctFromRatio = (n: number | null): string => (n == null ? '—' : `${(n * 100).toFixed(1)}%`)
/** Signed-arrow percent for YoY: ↑ 2.1% / ↓ 3.4% / no change. */
function yoyArrow(n: number | null): string {
  if (n == null) return 'about level with a year ago'
  if (Math.abs(n) < 0.05) return 'about level with a year ago'
  const arrow = n > 0 ? '↑' : '↓'
  return `${arrow} ${Math.abs(n).toFixed(1)}% from a year ago`
}
/** Integer with thousands separators, so 4-digit counts read "1,075" not "1075". */
const int = (n: number | null): string =>
  n == null ? '—' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/**
 * Mohtashami balance read: months of supply is the demand/supply verdict.
 * Delegates to the canonical marketVerdict thresholds (ci:market-formula) —
 * mapped to this module's local terms, with 'unknown' -> null so a missing MoS
 * makes no market-direction claim.
 */
function supplyVerdict(mos: number | null): 'seller' | 'balanced' | 'buyer' | null {
  const kind = marketVerdict(mos).kind
  if (kind === 'sellers') return 'seller'
  if (kind === 'balanced') return 'balanced'
  if (kind === 'buyers') return 'buyer'
  return null
}

export function buildMarketNarrative(s: NarrativeStats): MarketNarrative {
  const trace: MarketNarrative['figureTrace'] = []
  const record = (value: string, source: keyof NarrativeStats): string => {
    if (value !== '—') trace.push({ value, source })
    return value
  }

  const median = record(usd(s.medianSalePrice), 'medianSalePrice')
  const sold = record(int(s.soldCount), 'soldCount')
  const dom = record(days(s.medianDom), 'medianDom')
  const stl = record(pctFromRatio(s.avgSaleToListRatio), 'avgSaleToListRatio')
  const ppsf = record(usdPerSqft(s.medianPpsf), 'medianPpsf')
  const inv = record(int(s.endOfPeriodInventory), 'endOfPeriodInventory')
  const mosStr = record(s.monthsOfSupply == null ? '—' : `${s.monthsOfSupply.toFixed(1)} months`, 'monthsOfSupply')
  // YoY phrases carry a number, so trace them when present.
  if (s.yoyMedianPriceDeltaPct != null && Math.abs(s.yoyMedianPriceDeltaPct) >= 0.05) {
    trace.push({ value: `${Math.abs(s.yoyMedianPriceDeltaPct).toFixed(1)}%`, source: 'yoyMedianPriceDeltaPct' })
  }
  if (s.yoyInventoryChangePct != null && Math.abs(s.yoyInventoryChangePct) >= 0.05) {
    trace.push({ value: `${Math.abs(s.yoyInventoryChangePct).toFixed(1)}%`, source: 'yoyInventoryChangePct' })
  }

  const verdict = supplyVerdict(s.monthsOfSupply)
  const where = `${s.geoLabel}, ${s.periodLabel}`

  const overview =
    `${s.geoLabel} closed ${sold} single-family sales ${s.periodLabel}, with a median sale price of ${median}. ` +
    `Prices are ${yoyArrow(s.yoyMedianPriceDeltaPct)}. ` +
    (verdict === 'seller'
      ? `At ${mosStr} of supply this is a seller's market, so well-priced homes move quickly.`
      : verdict === 'balanced'
        ? `At ${mosStr} of supply the market is balanced between buyers and sellers.`
        : verdict === 'buyer'
          ? `At ${mosStr} of supply this is a buyer's market, so buyers have room to negotiate.`
          : `Inventory sits at ${inv} homes at period end.`)

  const priceAnalysis =
    `The median sale price was ${median}${s.medianPpsf != null ? `, or ${ppsf} per square foot` : ''}. ` +
    `That is ${yoyArrow(s.yoyMedianPriceDeltaPct)}. ` +
    (s.avgSaleToListRatio != null
      ? `Homes sold for ${stl} of asking on average.`
      : `Sale-to-list data was thin this period, so read the median with that in mind.`)

  const speedAnalysis =
    s.medianDom != null
      ? `Homes took a median of ${dom} from list to an accepted offer` +
        (s.yoyDomChange != null
          ? `, ${s.yoyDomChange > 0 ? 'slower' : s.yoyDomChange < 0 ? 'faster' : 'the same pace'} than a year ago.`
          : '.') +
        ` The slower a market gets, the more negotiating room a buyer usually has.`
      : `Days-on-market data was too thin to report a reliable median this period.`

  const inventoryAnalysis =
    s.endOfPeriodInventory != null
      ? `There were ${inv} homes for sale at period end, ${yoyArrow(s.yoyInventoryChangePct)}. ` +
        (verdict != null
          ? `Read against sales, that is ${mosStr} of supply, a ${verdict === 'seller' ? "seller's" : verdict === 'buyer' ? "buyer's" : 'balanced'} market.`
          : `A months-of-supply read was not available this period, so weigh that count against how fast homes are selling.`)
      : `End-of-period inventory was not available for ${where}.`

  const buyerOutlook =
    verdict === 'buyer'
      ? `You have leverage right now. More homes for sale and a slower pace mean you can take your time and negotiate on price and terms.`
      : verdict === 'balanced'
        ? `The market is even, so a strong, well-supported offer competes without needing to stretch. Move at a steady pace.`
        : verdict === 'seller'
          ? `Move decisively on the right home. Low supply means the best listings go fast, so have your financing and your agent ready.`
          : `Supply data was thin this period. Work from the closed comps above, and ask for a current read on inventory before you write an offer.`

  const sellerOutlook =
    verdict === 'seller'
      ? `This is your market. Price to the recent comps, present the home well, and you can expect solid interest and a quick, clean sale.`
      : verdict === 'balanced'
        ? `Price it right and it sells. Buyers have choices, so the homes that show best and price accurately are the ones that move.`
        : verdict === 'buyer'
          ? `Price carefully and lead with preparation. With more competition, an accurately priced, well-presented home is what earns the offer.`
          : `Price to the closed comps above. Supply data was thin this period, so ask for a current inventory read before you set a number.`

  const faq: MarketNarrative['faq'] = [
    {
      q: `What is the median home price in ${s.geoLabel} right now?`,
      a: `The median single-family sale price ${s.periodLabel} was ${median}, ${yoyArrow(s.yoyMedianPriceDeltaPct)}.`,
    },
    {
      q:
        verdict != null
          ? `${s.geoLabel} is a ${verdict === 'seller' ? "seller's" : verdict === 'buyer' ? "buyer's" : 'balanced'} market`
          : `What is the ${s.geoLabel} market like?`,
      a:
        verdict != null
          ? `At ${mosStr} of supply, ${s.geoLabel} is a ${verdict === 'seller' ? "seller's" : verdict === 'buyer' ? "buyer's" : 'balanced'} market. Four months or less favors sellers, four to six is balanced, six or more favors buyers.`
          : `Supply was close to balanced ${s.periodLabel}. Ask for a current read tailored to your price range.`,
    },
    {
      q: `How fast are homes selling in ${s.geoLabel}?`,
      a:
        s.medianDom != null
          ? `A median of ${dom} from listing to an accepted offer ${s.periodLabel}.`
          : `Days-on-market was too thin to report reliably ${s.periodLabel}.`,
    },
  ]

  return {
    overview,
    priceAnalysis,
    speedAnalysis,
    inventoryAnalysis,
    buyerOutlook,
    sellerOutlook,
    faq,
    figureTrace: trace,
  }
}
