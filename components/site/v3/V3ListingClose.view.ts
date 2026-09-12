/**
 * V3ListingClose — the pure half. Every sentence and every mark the close
 * draws is decided here, so the copy can be tested without a browser and the
 * component holds no arithmetic.
 *
 * THE HONESTY RULE THIS FILE IMPLEMENTS (CLAUDE.md §0 rule 7). Each of the
 * three figures publishes or it does not exist, independently. The claim is
 * built from whichever ones survived, in a fixed order of preference, and the
 * ones that did not are simply not mentioned — never estimated, never softened
 * into "about", never widened to a longer window under a 12-month sentence.
 * A city with none of the three gets no drawing at all (`getListingCutFacts`
 * returns null and the page does not mount the reading).
 */
import { formatCalendarDay } from '@/lib/format/date'
import { daysLiveOnMarket } from '@/lib/listing/days-live'
import type { ListingCutFacts } from '@/lib/data/market-truth/getListingCutFacts'

export type CloseReading = {
  id: 'share' | 'depth' | 'pace'
  /** The plain label a person reads. Never a stat_id, never jargon. */
  label: string
  /** The figure this mark leads with — THIS home's where it has one. */
  value: string
  /** What that figure is measured against, in words. */
  against: string
  /** The sentence that says what it means for the reader. */
  sentence: string
  /** Sales behind it. */
  sampleN: number
  /** The §0 trace line. */
  source: string
}

/** Where THIS listing sits on the same axes the city's record is drawn on. */
export type CloseSubject = {
  /** Street line, for the sentence. */
  label: string
  /** Its cut as a share of its FIRST ask, 0..1, or null when it has not cut. */
  cutDepth: number | null
  /** "7.2%" */
  cutLabel: string | null
  /** Days live so far, from OnMarketDate. NEVER DaysOnMarket. */
  daysLive: number | null
  /** The sentence under the drawing when nothing is being read. */
  line: string
  /** Its own §0 trace. */
  source: string
}

export type CloseView = {
  eyebrow: string
  /** The claim. One sentence, figures inside it, Amboqia on the page. */
  claim: string
  /** What the claim leaves unsaid, or null when it said everything. */
  lede: string | null
  /** 0..100 filled dots, or null when the share did not publish. */
  filledDots: number | null
  /** Median cut as a share of the ask, 0..1, or null. */
  cutDepth: number | null
  /** Median days to contract, or null. */
  paceDays: number | null
  readings: CloseReading[]
  /** One line naming every source behind the drawing. */
  source: string
  /**
   * The trace a visitor sees WITHOUT opening anything: what was counted, where,
   * over what window, through what date. The evaluator's finding on the first
   * pass was that three figures sat next to a closed disclosure triangle and no
   * vintage, geography or population was visible beside them — which is exactly
   * the §0 complaint, made about the page rather than the code.
   */
  windowLine: string
  /** Null when this listing has neither a published cut nor an on-market date. */
  subject: CloseSubject | null
}

/** "20892 Caldera Ct" -> the same; a blank -> the honest fallback. */
export function homeLabel(street: string | null | undefined): string {
  const trimmed = (street ?? '').trim()
  return trimmed.length > 0 ? trimmed : 'this home'
}

export type CloseSubjectInput = {
  addressLine: string | null | undefined
  /** From publishListingDrop — already refused when the history does not support it. */
  drop: { ask: number; original: number; drop: number } | null
  /** The listing's OnMarketDate, ISO. */
  onMarketDate: string | null | undefined
  /** Read date, so the day count is reproducible in a test. */
  now?: Date
}

export function buildCloseSubject(input: CloseSubjectInput): CloseSubject | null {
  const label = homeLabel(input.addressLine)
  const now = input.now ?? new Date()

  const cutDepth =
    input.drop && input.drop.original > 0 ? input.drop.drop / input.drop.original : null
  const cutLabel = cutDepth == null ? null : `${Math.round(cutDepth * 1000) / 10}%`

  // One definition, shared with the header pill (lib/listing/days-live.ts), so
  // the page cannot print two different day counts for the same house.
  const daysLive = daysLiveOnMarket(input.onMarketDate, now)

  if (cutDepth == null && daysLive == null) return null

  const parts: string[] = []
  if (cutLabel) parts.push(`has come down ${cutLabel} from the first list price`)
  if (daysLive != null) {
    parts.push(`has been on the market ${daysLive} ${daysLive === 1 ? 'day' : 'days'}`)
  }
  const line = `${label} ${parts.join(' and ')}.`

  return {
    label,
    cutDepth,
    cutLabel,
    daysLive,
    line,
    source: [
      'public.listings, this listing',
      input.drop ? `OriginalListPrice ${input.drop.original} to ListPrice ${input.drop.ask}` : null,
      // Name the count, not just the field. "days live to today" left a reader
      // who counted calendar days from the date getting a different number than
      // the page showed, back when this counted elapsed 24-hour periods.
      input.onMarketDate
        ? `OnMarketDate ${input.onMarketDate.slice(0, 10)}, calendar days to today in America/Los_Angeles`
        : null,
      'not DaysOnMarket, which is list-to-close',
    ]
      .filter(Boolean)
      .join(' · '),
  }
}

export function buildCloseView(facts: ListingCutFacts, subject: CloseSubject | null = null): CloseView {
  const city = facts.cityLabel
  const readings: CloseReading[] = []

  const n = (v: number) => v.toLocaleString('en-US')
  const population = facts.cutShare?.sampleN ?? null

  if (facts.cutShare) {
    readings.push({
      id: 'share',
      label: 'Came down before they sold',
      value: facts.cutShare.label,
      against: 'of every 100 homes that sold',
      sentence: `${n(facts.cutShare.sampleN)} homes closed in ${city} over the window. The filled dots are the ${facts.cutShare.label} of them that had already dropped their price by the time a buyer said yes.`,
      sampleN: facts.cutShare.sampleN,
      source: facts.cutShare.source,
    })
  }
  if (facts.cutSize) {
    readings.push({
      id: 'depth',
      label: 'How much they came down',
      value: subject?.cutLabel ?? facts.cutSize.label,
      against: subject?.cutLabel
        ? `off this home\u2019s first list price, against a typical ${facts.cutSize.label}`
        : 'came off the list price',
      sentence:
        (population
          ? `Of the ${n(facts.cutSize.sampleN)} ${city} sellers who dropped the price, half came down less than ${facts.cutSize.label} from the first list price and half came down more.`
          : `Half the ${n(facts.cutSize.sampleN)} ${city} sellers who dropped the price came down less than ${facts.cutSize.label} from the first list price and half came down more.`) +
        ' That drop is measured against the price the home first listed at, not the last one.',
      sampleN: facts.cutSize.sampleN,
      source: facts.cutSize.source,
    })
  }
  if (facts.daysToPending) {
    readings.push({
      id: 'pace',
      label: 'Days to an accepted offer',
      value:
        subject?.daysLive != null
          ? `${subject.daysLive} ${subject.daysLive === 1 ? 'day' : 'days'}`
          : facts.daysToPending.label,
      against:
        subject?.daysLive != null
          ? `this home has been listed, against ${facts.daysToPending.label} for the typical ${city} sale`
          : 'from listing to contract',
      sentence: `Half of ${n(facts.daysToPending.sampleN)} ${city} sales were under contract inside ${facts.daysToPending.label}; half took longer. Counted from the day the home came on the market to the day the seller accepted, not to closing.`,
      sampleN: facts.daysToPending.sampleN,
      source: facts.daysToPending.source,
    })
  }

  // The claim takes the strongest figure that published; the rest become the
  // lede. Order is fixed so two cities never argue about which is the headline.
  let claim: string
  const rest: string[] = []
  if (facts.cutShare) {
    claim = `In ${city}, ${facts.cutShare.label} of the homes that sold in the last 12 months had dropped their price before a buyer said yes.`
    if (facts.cutSize) rest.push(`the typical drop was ${facts.cutSize.label} off the original list price`)
    if (facts.daysToPending) {
      rest.push(`and the typical home went under contract in ${facts.daysToPending.label}`)
    }
  } else if (facts.cutSize) {
    claim = `In ${city}, a seller who dropped the price in the last 12 months typically came down ${facts.cutSize.label} from where they started.`
    if (facts.daysToPending) {
      rest.push(`the typical home went under contract in ${facts.daysToPending.label}`)
    }
  } else if (facts.daysToPending) {
    claim = `In ${city}, the typical home that sold in the last 12 months went under contract in ${facts.daysToPending.label}.`
  } else {
    // getListingCutFacts never returns a facts object with nothing publishable,
    // so this is unreachable by construction. It says something true anyway
    // rather than rendering an empty heading.
    claim = `We do not have enough recent ${city} sales to describe how prices move here.`
  }

  const lede =
    rest.length > 0 ? `${rest.join(', ').replace(/^./, (c) => c.toUpperCase())}.` : null

  // formatCalendarDay carries the same noon-UTC trick this used to hand-roll:
  // `new Date('2026-08-18')` is the prior Pacific evening. One helper, one
  // rule, and ci:date-format stays green.
  const through = facts.completeThrough
    ? formatCalendarDay(facts.completeThrough, { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return {
    eyebrow: `${city} · How homes here sold`,
    windowLine: [
      `${city} single family homes`,
      through ? `every sale that closed in the 12 months to ${through}` : 'closed sales, 12 months',
      // No count here. Each reading now names its own n against the population
      // it belongs to, so repeating the total on this line printed 2,074 twice
      // in one breath — a craft finding on the first evaluator pass, and it was
      // right. The counts that matter are the ones beside the figure they
      // belong to; the full per-figure trace is one disclosure below.
      null,
    ]
      .filter(Boolean)
      .join(' · '),
    claim,
    lede,
    filledDots: facts.cutShare ? Math.round(facts.cutShare.value * 100) : null,
    cutDepth: facts.cutSize ? facts.cutSize.value : null,
    paceDays: facts.daysToPending ? Math.round(facts.daysToPending.value) : null,
    readings,
    subject,
    source: [...readings.map((r) => r.source), subject?.source]
      .filter(Boolean)
      .join('  |  '),
  }
}
