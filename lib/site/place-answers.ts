// brand-voice:exempt — factual market Q&A generated from verified live data, no marketing prose
/**
 * THE CITED Q&A FOR A PLACE PAGE (site queue SITE-08).
 *
 * One array in, one array out, and the page renders it twice: as the visible
 * V3Answers rows and as the FAQPage JSON-LD. `answersFaqItems` is the only way
 * to make the second from the first, so the markup cannot describe a sentence
 * the page does not show — which is the single biggest reason Google and the
 * answer engines discard a page's schema, and the defect this node exists to
 * prevent. Do not build a FaqPageInput from anything else on these routes.
 *
 * WHAT MAKES THIS DIFFERENT FROM lib/site/market-faq.ts, which stays. That
 * builder produces question-and-answer PROSE: strings for a page to print. This
 * one produces ANSWERS WITH THEIR FIGURE ATTACHED — the number, its plain label,
 * its drawing, and its own §0 trace — because TASTE.md (Matt 2026-09-01) bans a
 * question set whose rows are paragraphs: "FAQ blocks count. If the prose is
 * needed for search, it sits under a disclosure or beside a display, never as
 * the section." A closed row here already carries its answer as a figure; an
 * open row draws it. market-faq keeps the questions that have no figure at all
 * (the HOA, the school district, which subdivisions a community holds), and the
 * routes append those after these.
 *
 * §0, AND IT IS THE WHOLE DESIGN. Every field below is optional and null-guarded.
 * A figure that is null produces NO question, NO sentence and NO schema entry.
 * Nothing is estimated, nothing is borrowed from a parent geography under this
 * place's name, and nothing is rounded except through lib/format. The callers do
 * the PUBLICATION gating (publishMonthsOfSupply, publishSoldCount,
 * publishSubdivisionClosedPrice) before they get here, so a figure that reached
 * this module is one its own grain is allowed to print; this module decides only
 * how it reads and how it draws.
 *
 * THE DRAWINGS. components/site/v3/V3Answers.marks.ts refuses any geometry it
 * cannot draw honestly (a value outside its domain, a band list with a hole), so
 * a mark specified here can never place a dot somewhere the number is not. The
 * domains are FIXED per statistic rather than fitted to each place, because the
 * class is every city, neighborhood, community and plat: a rule that rescales
 * per page makes two places with the same figure look different, and two places
 * with different figures look the same.
 */
import type { V3Answer, V3AnswerTally } from '@/components/site/v3'
import { marketVerdict, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPriceExact } from '@/lib/format/money'

/** What one question renders as, plus the trace that survives into the report. */
export type PlaceAnswersResult = {
  answers: V3Answer[]
  /** One line per published figure, in the §0 report form. */
  traces: string[]
  /** The machine handle from the input, passed straight to V3Answers. */
  sourceKey?: string | null
}

export type PlaceAnswersFigures = {
  /** Already through publishMonthsOfSupply. Null withholds the verdict question. */
  monthsOfSupply?: number | null
  /**
   * The active count the RATIO was computed on, which on a neighborhood is the
   * metric layer's membership count and NOT always the count the page's own
   * inventory section publishes (Awbrey Butte, 2026-09-08: 49 by place
   * membership, 60 inside the recorded polygon in a publicly active status).
   * Two honest counts of two populations. The verdict's trace names its own
   * numerator so the two can never be read as one number disagreeing with
   * itself — §0 rule 5, and the same reason publishMonthsOfSupply withholds
   * when a page prints a different active count beside a pulse ratio.
   */
  monthsOfSupplyActiveCount?: number | null
  /** Active listings the PAGE publishes — the count in its own Field or face. */
  activeCount?: number | null
  /** The population clause for that count, when it is not the metric layer's. */
  activeCountTrace?: string | null
  /**
   * Extra lines on the inventory answer, for a place where the page shows a
   * second, wider count somewhere else and the reader deserves to be told why
   * the two differ rather than left to spot it (the community grain's
   * every-property-type Field beside its single-family figures). ONE SENTENCE
   * PER LINE: each becomes its own paragraph, because a reconciliation that
   * packs two counts into one clause is the thing it was written to prevent.
   */
  activeCountNotes?: readonly string[] | null
  /**
   * Closed sales, with the window they cover in the reader's words.
   *
   * `trace` overrides the page's population clause for THIS figure, and every
   * object figure below carries the same escape for the same reason: a plat
   * page reads four populations that are not interchangeable (§0, and
   * app/subdivisions/[slug]/_v3/subdivision-traces.ts spells out why). Its
   * yearly closed counts come from the sales-history RPC, its days on market
   * from the statistics cache, and its list median from the live counted set —
   * one clause covering all three would be false for two of them, which is
   * exactly what the first build of this section shipped: "$785,000 median
   * list price" under a sentence reading "closed single-family sales … a
   * closed-price statistic at plat grain is withheld".
   */
  closedCount?: {
    count: number
    windowLabel: string
    trace?: string | null
    /**
     * What these closes ARE, when they are not the page's population.
     * `populationLabel` above names the set the page mostly talks about
     * (single-family homes); this figure can come from a different one. The
     * plat grain's boundary-attributed closes are EVERY property type, and Golf
     * Homes At Tetherow is a townhome plat — calling its 107 closes
     * "single-family homes" would be §0 rule 5 in one word.
     */
    populationLabel?: string | null
    /**
     * The SAME count over the window before it, drawn as a second run of marks
     * under the first (SITE-08 pass 2). Only from the same query as `count` —
     * the plat grain's yearly closed counts are one sales-history RPC read
     * twice — or it is two populations pretending to be a comparison.
     */
    priorWindow?: { count: number; label: string } | null
  } | null
  /**
   * EVERY closed sale on record inside the place's own recorded boundary,
   * attributed by geometry rather than by an MLS name (SITE-24).
   *
   * It is a different question from `closedCount` and it exists because on a
   * sub-plat of a resort `closedCount` cannot be asked at all: the yearly
   * series behind it is a join on MLS SubdivisionName, every home inside Golf
   * Homes At Tetherow is recorded under "Tetherow", and the plat therefore
   * answered ZERO questions with a number — /subdivisions/golf-homes-at-tetherow
   * shipped a section headed "questions, answered with the number" whose only
   * row was the valuation ask. The polygon count is the one figure that grain
   * can state, and 107 sales inside a recorded boundary is a fact about the
   * place, not a statistic about its prices.
   *
   * A COUNT, never a rate and never a price. `trace` is required in practice
   * for the same reason every object figure above carries one: this figure
   * comes from its own query (public.subdivision_plat_closed_mv) and the
   * page-level population clause describes a different one.
   */
  lifetimeClosedCount?: { count: number; trace?: string | null } | null
  /** Median list-to-pending days. NOT active-inventory age (ci:days-to-pending-source). */
  daysToPending?: number | null
  /** The same statistic for the parent city, drawn as the context mark. */
  cityDaysToPending?: number | null
  /** Median days on market — a different population, used only where no to-pending figure exists. */
  daysOnMarket?: { days: number; windowLabel: string; trace?: string | null } | null
  /** Median close as a share of the ORIGINAL list price, 0..1. */
  saleToOriginal?: number | null
  citySaleToOriginal?: number | null
  /** Share of closes paid in cash, 0..1. */
  cashShare?: number | null
  cityCashShare?: number | null
  /** Median closed price with the window it covers. */
  medianSalePrice?: { price: number; windowLabel: string; trace?: string | null } | null
  /** Median list price of the homes currently for sale. */
  medianListPrice?: number | null
  /** The population clause for THAT median, when it is a different set. */
  medianListPriceTrace?: string | null
}

export type PlaceAnswersInput = {
  /** The name a visitor reads. Never a slug. */
  placeName: string
  /** The parent city, for the comparison marks and the honest scope sentences. */
  cityName?: string | null
  /** What the counted population is, in the reader's words. */
  populationLabel?: string
  figures: PlaceAnswersFigures
  /**
   * The population clause every trace on this page opens with, IN THE READER'S
   * WORDS: the feed, the population, and the membership rule. Example:
   * "regional MLS, detached single-family homes inside the Awbrey Butte
   * boundary".
   *
   * NOT the table and not the key. A separate taste evaluator on 2026-09-08
   * read the live trace on all three place grains as "market_metric
   * neighborhood:bend-awbrey-butte through the Market Truth layer" and called
   * it by name: the "raw slugs, internal labels, methodology jargon" tell
   * design_system/public/TASTE.md bans. §0 still needs the machine handle to be
   * auditable, so it moved to `sourceKey` below — in the served HTML, out of
   * the body copy. A trace a client cannot read is not a trace they can check.
   */
  sourceTrace: string
  /**
   * The machine handle behind `sourceTrace`: table plus key, e.g.
   * "market_metric:neighborhood:bend-awbrey-butte". Rendered as
   * `data-source-key` on the answers section, so §0's "name the source" stays
   * greppable in the served HTML and auditable by a reviewer, while the
   * sentence a visitor reads stays a sentence.
   */
  sourceKey?: string | null
  /** "September 2026". Appended to every trace as the stamp §0 requires. */
  asOfLabel?: string | null
  /**
   * Where the reader goes to find out what THEIR home is worth, and whether
   * that field is on this page (SITE-01's address ask) or one step away.
   */
  valueAsk: { href: string; onPage: boolean }
  /**
   * The questions this place answers that carry no figure of their own — the
   * HOA, the school district, which subdivisions a community holds. They come
   * from lib/site/market-faq.ts, they sit after the figured rows and before the
   * closing ask, and any whose question this module already answered is
   * DROPPED rather than shown twice with two different sentences.
   */
  /**
   * Prose rows appended after the cited ones. `source` is optional because most
   * are prose (HOA rules, the school district); a row that DOES publish a figure
   * in its sentence owes the same §0 trace every cited row carries, and gets one
   * here rather than being the only number on the page with no source line
   * (evaluator, /communities/tetherow HOA dues, 2026-09-08).
   */
  extra?: readonly { question: string; answer: string; source?: string | null }[]
}

/** A share as the site publishes shares: one decimal, never a bare integer. */
function sharePct(ratio: number): string {
  return `${(Math.round(ratio * 1000) / 10).toFixed(1)}%`
}

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function positive(value: number | null | undefined): value is number {
  return finite(value) && value > 0
}

/** The comparison run's own §0 line, when there is one. */
function priorTrace(
  prior: { count: number; label: string } | null | undefined,
  trace: string,
): string[] {
  if (!prior || !positive(prior.count) || !prior.label.trim()) return []
  return [`${prior.count} closed sales ${prior.label.trim()} (the comparison run) — ${trace}`]
}

/**
 * The window before, as a sentence, when the caller published one. Same query,
 * same population, so it reads as one series and not as a second statistic.
 */
function priorSentence(
  prior: { count: number; label: string } | null | undefined,
  homes: string,
): string[] {
  if (!prior || !positive(prior.count) || !prior.label.trim()) return []
  return [`${prior.count.toLocaleString('en-US')} ${homes} closed ${prior.label.trim()}.`]
}

/**
 * The closed-sales drawing. One mark per sale, and — where the caller has the
 * SAME count over the window before, from the same query — a second run under
 * it so the reader compares two lengths rather than subtracting two numerals.
 * The prior run is dropped rather than half-drawn when it is not a positive
 * count or has no window name to sit under.
 */
function closedTally(
  count: number,
  windowLabel: string,
  prior: { count: number; label: string } | null | undefined,
): V3AnswerTally {
  const priorOk = prior && positive(prior.count) && prior.label.trim().length > 0
  return {
    kind: 'tally',
    count,
    unitLabel: 'closed sale',
    unitPlural: 'closed sales',
    runLabel: windowLabel,
    ...(priorOk ? { context: { count: prior.count, label: prior.label.trim() } } : {}),
  }
}

/**
 * The visible questions, in the order a person asks them, each carrying the one
 * figure it is about.
 */
export function buildPlaceAnswers(input: PlaceAnswersInput): PlaceAnswersResult {
  const place = input.placeName.trim()
  const city = input.cityName?.trim() || null
  const homes = input.populationLabel?.trim() || 'single-family homes'
  // The closed figure may measure a wider set than the page's own population.
  const closedHomes = input.figures.closedCount?.populationLabel?.trim() || homes
  const f = input.figures
  const answers: V3Answer[] = []
  const traces: string[] = []
  const stamp = input.asOfLabel ? `, updated ${input.asOfLabel}` : ''
  // The population clause is written as a sentence by some callers and as a
  // clause by others; the trailing stop is stripped so a joined trace does not
  // read "…is withheld., closed sales in 2025" (live on /subdivisions/*).
  const population = input.sourceTrace.trim().replace(/\.+$/, '')
  const trace = (window: string): string => `${population}, ${window}${stamp}`
  /**
   * A figure whose population is not the page's default names its own, AND ITS
   * OWN FRESHNESS. An override is a complete clause: the page stamp is not
   * appended to it, because a stamp is a fact about one query. The plat's
   * `asOfLabel` is its statistics-cache `refreshed_at`, and appending that to
   * the yearly closed count (a different RPC) and to the live list median (a
   * live read) dated three figures by a fourth's clock — §0, "one trace per
   * query, one stamp per trace". A caller that wants a date on an override
   * writes it into the override. The trailing stop is stripped either way, so
   * a clause written as a sentence does not read "…in Redmond., updated Sep 8".
   */
  const traceWith = (override: string | null | undefined, window: string): string =>
    override?.trim() ? override.trim().replace(/\.+$/, '') : trace(window)
  /**
   * Questions this builder has ALREADY answered, so `extra` cannot reintroduce
   * one under a slightly different sentence. It also holds the questions a
   * figure ANSWERED ELSEWHERE covers: the no-verdict row IS the closed-count
   * answer, and lib/site/market-faq.ts asks for that count again in its own
   * words. /communities/tetherow shipped both — "24 closed sales" as the
   * verdict row's figure and a second bare row saying the same 24.
   */
  const asked = new Set<string>()
  const ask = (question: string) => asked.add(question.trim().toLowerCase())

  // ── The verdict, drawn as a position rather than said as a word ───────────
  // The bands ARE lib/market/classify.ts: 4 or less is a seller's market, above
  // 4 and under 6 balanced, 6 or more a buyer's. marketVerdict reads the RAW
  // value and formatMonthsOfSupply is the only thing that rounds it, so the
  // word, the digits and the filled band can never disagree (ci:market-formula).
  if (positive(f.monthsOfSupply)) {
    const raw = f.monthsOfSupply
    const shown = formatMonthsOfSupply(raw)
    const verdict = marketVerdict(raw)
    const kind =
      verdict.kind === 'sellers' ? "seller's" : verdict.kind === 'buyers' ? "buyer's" : 'balanced'
    answers.push({
      id: 'answer-verdict',
      open: true,
      question: `Is ${place} a buyer's or seller's market?`,
      body: [
        `${place} has ${shown} months of supply, which is a ${kind} market. ${MOS_THRESHOLD_CLAUSE}`,
        `Months of supply is how long it would take to sell every home on the market here at the pace homes have actually been selling. Fewer months means buyers are competing; more means they can take their time.`,
      ],
      figure: {
        value: shown,
        label: 'months of supply',
        // 0 to 12 covers the whole honest range at every grain we publish, and
        // it is FIXED so Bend at 3.9 and a resort at 9.1 are read on one rule.
        mark: {
          kind: 'scale',
          min: 0,
          max: 12,
          at: raw,
          minLabel: '0 months',
          maxLabel: '12 months',
          subjectLabel: place,
          format: { unit: ' months', decimals: 1 },
          bands: [
            { to: 4, label: "seller's" },
            { to: 6, label: 'balanced' },
            { to: 12, label: "buyer's" },
          ],
        },
      },
      source: trace(
        `months of supply is ${
          positive(f.monthsOfSupplyActiveCount)
            ? `the ${f.monthsOfSupplyActiveCount.toLocaleString('en-US')} listings this layer counts as active`
            : 'active listings'
        } divided by the last six months of closings divided by six`,
      ),
    })
    traces.push(
      `${shown} months of supply (${verdict.label}) — ${trace(`months of supply on ${f.monthsOfSupplyActiveCount ?? '?'} active`)}`,
    )
  } else if (f.closedCount && positive(f.closedCount.count)) {
    // NO VERDICT, SAID OUT LOUD, with the figure that explains the refusal.
    // Same sentence pattern SITE-01 put on the community answer step: we do not
    // print a verdict we cannot attribute, and we say which number is thin
    // rather than leaving the reader to assume we have nothing.
    const { count, windowLabel } = f.closedCount
    answers.push({
      id: 'answer-verdict',
      open: true,
      question: `Is ${place} a buyer's or seller's market?`,
      body: [
        `${place} has had fewer sales we can attribute to it on its own than a fair buyer's or seller's verdict needs, so we are not printing one.`,
        `${count.toLocaleString('en-US')} ${closedHomes} closed in ${place} ${windowLabel}${city ? `, and ${city} as a whole is the wider reading we do stand behind` : ''}. Ask us and we will read the comparable sales for your street instead.`,
        // The drawing carries the window before as a second run of marks, so
        // the sentence carries it too — the FAQPage payload is derived from
        // these lines, and a schema that omits what the page shows is the
        // drift this module exists to prevent.
        ...priorSentence(f.closedCount.priorWindow, closedHomes),
      ],
      figure: {
        value: count.toLocaleString('en-US'),
        label: `closed sales ${windowLabel}`,
        mark: closedTally(count, windowLabel, f.closedCount.priorWindow),
      },
      source: traceWith(f.closedCount.trace, `closed sales ${windowLabel}`),
    })
    traces.push(
      `${count} closed sales ${windowLabel} (no verdict published at this grain) — ${traceWith(f.closedCount.trace, `closed sales ${windowLabel}`)}`,
    )
    // The comparison run is a published figure too, so it gets its own line in
    // the §0 report rather than riding along inside the subject's.
    for (const line of priorTrace(f.closedCount.priorWindow, traceWith(f.closedCount.trace, 'closed sales, grouped by calendar year'))) {
      traces.push(line)
    }
    // The count is answered here, so the prose builder's version of the same
    // question does not get a second row further down.
    ask(`How many homes sold in ${place} in the last year?`)
  }

  // ── What they cost ────────────────────────────────────────────────────────
  // The SALE median answers the question a person asked; the LIST median is a
  // different population (homes for sale, not homes sold) and says so. An
  // answer engine quoted the list-only form of this sentence as Bend's "median
  // home price" beside four peers' sale medians (2026-09-07).
  const sale = f.medianSalePrice && positive(f.medianSalePrice.price) ? f.medianSalePrice : null
  const list = positive(f.medianListPrice) ? f.medianListPrice : null
  if (sale || list) {
    const body: string[] = []
    if (sale) {
      body.push(
        `The median sale price for a ${homes.replace(/s$/, '')} in ${place} was ${formatPriceExact(sale.price)} ${sale.windowLabel}.`,
      )
    }
    if (list) {
      body.push(
        sale
          ? `The homes on the market right now are asking a median of ${formatPriceExact(list)}, which is a different set of homes from the ones that sold.`
          : `The ${homes} for sale in ${place} are asking a median of ${formatPriceExact(list)}.`,
      )
    }
    const figureValue = sale ? formatPriceExact(sale.price) : formatPriceExact(list as number)
    const figureLabel = sale ? 'median sale price' : 'median list price'
    answers.push({
      id: 'answer-price',
      question: `What is the median home price in ${place}?`,
      body,
      // No drawing: a single price has no honest scale of its own, and the
      // question of where it sits against the asking price is its own row below.
      figure: { value: figureValue, label: figureLabel },
      source: sale
        ? traceWith(sale.trace, `median closed price ${sale.windowLabel}`)
        : traceWith(f.medianListPriceTrace, 'median list price of the homes now for sale'),
    })
    if (sale) {
      traces.push(
        `${formatPriceExact(sale.price)} median sale price — ${traceWith(sale.trace, `median closed price ${sale.windowLabel}`)}`,
      )
    }
    if (list) {
      traces.push(
        `${formatPriceExact(list)} median list price — ${traceWith(f.medianListPriceTrace, 'median list price of the homes now for sale')}`,
      )
    }
  }

  // ── How fast ──────────────────────────────────────────────────────────────
  // Days to PENDING measures homes the market absorbed. Days ON MARKET of the
  // active set measures homes that have not sold, is systematically larger, and
  // gets its own question and its own label (ci:days-to-pending-source). Only
  // one of the two ships, so the section never asks the same thing twice.
  if (positive(f.daysToPending)) {
    const days = Math.round(f.daysToPending)
    const cityDays = positive(f.cityDaysToPending) ? Math.round(f.cityDaysToPending) : null
    const body = [
      `Half the ${place} homes that went under contract in the last 90 days did it inside ${days} days.`,
    ]
    if (cityDays != null && city) {
      body.push(`Across ${city} the median over the same window was ${cityDays} days.`)
    }
    answers.push({
      id: 'answer-pace',
      question: `How long do homes take to sell in ${place}?`,
      body,
      figure: {
        value: `${days} days`,
        label: 'median days to pending',
        mark: {
          kind: 'scale',
          min: 0,
          max: 120,
          at: days,
          minLabel: '0 days',
          maxLabel: '120 days',
          subjectLabel: place,
          format: { unit: ' days', decimals: 0 },
          ...(cityDays != null && city ? { context: { at: cityDays, label: `${city} ${cityDays}` } } : {}),
        },
      },
      source: trace('median days from listing to under contract, last 90 days'),
    })
    traces.push(`${days} median days to pending — ${trace('median days from listing to under contract, last 90 days')}`)
  } else if (f.daysOnMarket && positive(f.daysOnMarket.days)) {
    const days = Math.round(f.daysOnMarket.days)
    answers.push({
      id: 'answer-pace',
      question: `How long do homes stay on the market in ${place}?`,
      body: [
        `${homes.charAt(0).toUpperCase()}${homes.slice(1)} in ${place} had a median of ${days} days on market ${f.daysOnMarket.windowLabel}.`,
        `Days on market counts from the day a home is listed. It is a longer measure than how fast a home goes under contract, and it is the one we can attribute at this grain.`,
      ],
      figure: {
        value: `${days} days`,
        label: 'median days on market',
        mark: {
          kind: 'scale',
          min: 0,
          max: 120,
          at: days,
          minLabel: '0 days',
          maxLabel: '120 days',
          subjectLabel: place,
          format: { unit: ' days', decimals: 0 },
        },
      },
      source: traceWith(f.daysOnMarket.trace, `median days on market ${f.daysOnMarket.windowLabel}`),
    })
    traces.push(
      `${days} median days on market — ${traceWith(f.daysOnMarket.trace, `median days on market ${f.daysOnMarket.windowLabel}`)}`,
    )
  }

  // ── What they close at against the ask ───────────────────────────────────
  if (positive(f.saleToOriginal)) {
    const shown = sharePct(f.saleToOriginal)
    const pct = Math.round(f.saleToOriginal * 1000) / 10
    const cityPct = positive(f.citySaleToOriginal) ? Math.round(f.citySaleToOriginal * 1000) / 10 : null
    const body = [
      `The typical ${place} home closed at ${shown} of the price it was first listed at, over the last 12 months.`,
      `Under 100% means sellers here generally came down from their first number before the home sold. Over 100% means buyers bid past it.`,
    ]
    if (cityPct != null && city) {
      body.splice(1, 0, `Across ${city} it was ${cityPct.toFixed(1)}%.`)
    }
    answers.push({
      id: 'answer-ask',
      question: `Do homes in ${place} sell for the asking price?`,
      body,
      figure: {
        value: shown,
        label: 'of the original asking price',
        mark: {
          kind: 'scale',
          min: 85,
          max: 105,
          at: pct,
          minLabel: '85%',
          maxLabel: '105%',
          subjectLabel: place,
          format: { unit: '%', decimals: 1 },
          context: { at: 100, label: 'the asking price' },
        },
      },
      source: trace('median closed price as a share of the original list price, last 12 months'),
    })
    traces.push(`${shown} of original list — ${trace('median closed price as a share of the original list price, last 12 months')}`)
  }

  // ── Who is buying ─────────────────────────────────────────────────────────
  if (positive(f.cashShare)) {
    const shown = sharePct(f.cashShare)
    const pct = Math.round(f.cashShare * 1000) / 10
    const cityPct = positive(f.cityCashShare) ? Math.round(f.cityCashShare * 1000) / 10 : null
    const body = [
      `${shown} of the homes that closed in ${place} over the last 12 months were paid for in cash.`,
    ]
    if (cityPct != null && city) {
      body.push(`Across ${city} it was ${cityPct.toFixed(1)}%. A high cash share is why a financed offer here often needs to be stronger somewhere else.`)
    } else {
      body.push(`A high cash share is why a financed offer here often needs to be stronger somewhere else.`)
    }
    answers.push({
      id: 'answer-cash',
      question: `How many buyers pay cash in ${place}?`,
      body,
      figure: {
        value: shown,
        label: 'of closes paid in cash',
        mark: {
          kind: 'scale',
          min: 0,
          max: 100,
          at: pct,
          minLabel: '0%',
          maxLabel: '100%',
          subjectLabel: place,
          format: { unit: '%', decimals: 0 },
          ...(cityPct != null && city ? { context: { at: cityPct, label: `${city} ${cityPct.toFixed(0)}%` } } : {}),
        },
      },
      source: trace('share of closings recorded as cash, last 12 months'),
    })
    traces.push(`${shown} cash share — ${trace('share of closings recorded as cash, last 12 months')}`)
  }

  // ── How many ──────────────────────────────────────────────────────────────
  if (positive(f.activeCount)) {
    const n = f.activeCount
    // The count the PAGE publishes, worded exactly as lib/site/market-faq.ts
    // words it, so the two builders answer one question and the merge below
    // drops the duplicate instead of shipping the same question twice.
    const inventoryTrace = traceWith(f.activeCountTrace, 'active listings at the last sync')
    answers.push({
      id: 'answer-inventory',
      question: `How many ${homes} are for sale in ${place}?`,
      body: [
        `${n.toLocaleString('en-US')} ${homes} are on the market in ${place} right now.`,
        ...(f.activeCountNotes ?? []).map((line) => line.trim()).filter((line) => line.length > 0),
      ],
      figure: {
        value: n.toLocaleString('en-US'),
        label: n === 1 ? 'home for sale' : 'homes for sale',
        mark: { kind: 'tally', count: n, unitLabel: 'home for sale', unitPlural: 'homes for sale' },
      },
      source: inventoryTrace,
    })
    traces.push(`${n} active listings — ${inventoryTrace}`)
  }

  // The closed count only gets its own row when it did not already answer the
  // verdict question above. One figure, one row.
  const verdictUsedClosed = !positive(f.monthsOfSupply)
  if (!verdictUsedClosed && f.closedCount && positive(f.closedCount.count)) {
    const { count, windowLabel } = f.closedCount
    answers.push({
      id: 'answer-sales',
      question: `How many homes sold in ${place} in the last year?`,
      body: [
        `${count.toLocaleString('en-US')} ${closedHomes} closed in ${place} ${windowLabel}.`,
        ...priorSentence(f.closedCount.priorWindow, closedHomes),
      ],
      figure: {
        value: count.toLocaleString('en-US'),
        label: `closed sales ${windowLabel}`,
        mark: closedTally(count, windowLabel, f.closedCount.priorWindow),
      },
      source: traceWith(f.closedCount.trace, `closed sales ${windowLabel}`),
    })
    traces.push(`${count} closed sales ${windowLabel} — ${traceWith(f.closedCount.trace, `closed sales ${windowLabel}`)}`)
    for (const line of priorTrace(f.closedCount.priorWindow, traceWith(f.closedCount.trace, 'closed sales, grouped by calendar year'))) {
      traces.push(line)
    }
  }

  // How many have EVER sold here — the boundary question, not the name question
  // (SITE-24). It rides after the yearly count because a reader asks "how is it
  // selling now" before "how big is it", and it is the only figure a sub-plat of
  // a resort can answer at all: its sales are all recorded under the resort's
  // MLS name, so every row above this one is absent for it.
  if (f.lifetimeClosedCount && positive(f.lifetimeClosedCount.count)) {
    const lifetime = f.lifetimeClosedCount.count
    const lifetimeTrace = traceWith(
      f.lifetimeClosedCount.trace,
      'closed sales inside the recorded boundary, every year on record',
    )
    answers.push({
      id: 'answer-lifetime-sales',
      question: `How many homes have ever sold in ${place}?`,
      body: [
        `${lifetime.toLocaleString('en-US')} sales have closed inside the ${place} boundary across every year the MLS holds.`,
        // The method is the point of the figure, so it is said in the body and
        // not only in the trace: this is the count a name join cannot produce.
        `They are counted by where the home actually sits, not by the subdivision name a listing was filed under, so a home inside ${place} counts here even when the MLS recorded it under a larger name.`,
      ],
      figure: {
        value: lifetime.toLocaleString('en-US'),
        label: 'sales on record',
        // No runLabel: there is no second run under it, and the question above
        // already named the window (every year on record).
        mark: { kind: 'tally', count: lifetime, unitLabel: 'closed sale', unitPlural: 'closed sales' },
      },
      source: lifetimeTrace,
    })
    traces.push(`${lifetime} closed sales inside the recorded boundary — ${lifetimeTrace}`)
    ask(`How many homes have ever sold in ${place}?`)
  }

  // ── The questions with no figure, after the ones that have one ───────────
  if (input.extra && input.extra.length > 0) {
    for (const answer of answers) ask(answer.question)
    for (const item of input.extra) {
      const question = item?.question?.trim()
      const answer = item?.answer?.trim()
      if (!question || !answer) continue
      const key = question.toLowerCase()
      if (asked.has(key)) continue
      asked.add(key)
      const extraSource = item?.source?.trim()
      // `reference: true` is set HERE and nowhere else. These are the rows the
      // page appends in prose after the cited ones; the value ask below is also
      // figure-less and must NOT wear this, because it is the row the section
      // exists for.
      answers.push({
        question,
        body: answer,
        reference: true,
        ...(extraSource ? { source: extraSource } : {}),
      })
      if (extraSource) traces.push(extraSource)
    }
  }

  // ── The last question is the one they came to ask ─────────────────────────
  // No figure on this row: it is the act, not a fact, and repeating the closed
  // count as a second identical tally would put the same drawing on the page
  // twice. The number and its window stay in the sentence.
  const basis = f.closedCount && positive(f.closedCount.count) ? f.closedCount : null
  const valueBody: string[] = [
    input.valueAsk.onPage
      ? `Put your street address into the value field at the top of this page. You will see how ${place} is selling against your home before anyone asks for an email.`
      : `Give us your street address and we will send back a written valuation for it: the number, the comparable sales, and what we would list at.`,
  ]
  if (basis) {
    valueBody.push(
      `We build it on the ${basis.count.toLocaleString('en-US')} ${homes} that closed in ${place} ${basis.windowLabel}, plus what your home has that those did not.`,
    )
  }
  answers.push({
    id: 'answer-value',
    question: `What is my ${place} home worth?`,
    body: valueBody,
    action: {
      label: input.valueAsk.onPage ? `Value my ${place} home` : 'Start a valuation',
      href: input.valueAsk.href,
    },
    ...(basis ? { source: traceWith(basis.trace, `closed sales ${basis.windowLabel}`) } : {}),
  })

  return { answers, traces, sourceKey: input.sourceKey ?? null }
}

/**
 * The FAQPage payload, made FROM the rendered rows and from nothing else.
 *
 * This is the whole point of the module: two sinks, one array. A route that
 * builds its schema items from a second source can ship markup describing a
 * sentence the page does not show, which is what an answer engine penalises and
 * what SITE-08 exists to stop. One paragraph per string, joined with a space,
 * because a Question's acceptedAnswer is one text node.
 */
export function answersFaqItems(
  answers: readonly V3Answer[],
): Array<{ question: string; answer: string }> {
  const items: Array<{ question: string; answer: string }> = []
  for (const answer of answers) {
    if (!answer || typeof answer !== 'object') continue
    const question = answer.question?.trim()
    const paragraphs = (typeof answer.body === 'string' ? [answer.body] : (answer.body ?? []))
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    if (!question || paragraphs.length === 0) continue
    items.push({ question, answer: paragraphs.join(' ') })
  }
  return items
}
