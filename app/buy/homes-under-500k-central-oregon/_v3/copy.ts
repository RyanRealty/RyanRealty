/**
 * Live-token copy for /buy/homes-under-500k-central-oregon.
 * Numbers come from the snapshot. Never invent a count or a median.
 * Say "buyers have leverage", never "buyer's market".
 */
import { formatCount } from '@/lib/format/count'
import { formatPriceExact } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { shareDescription } from '@/lib/share-metadata'
import type { Under500kSnapshot, Under500kTownRow } from './data'
import { unpublishedOr } from './data'
import { CELL_UNPUBLISHED, H1, LINKS, MLS_SOURCE, TITLE } from './constants'

const MIXED_TYPE_MEDIAN_LOW = 740_000
const MIXED_TYPE_MEDIAN_HIGH = 750_000

export type Under500kFaq = {
  question: string
  answer: string
}

export type Under500kCopy = {
  title: string
  metaDescription: string
  h1: string
  eyebrow: string
  answer: string[]
  leverageLine: string | null
  methodLine: string
  tableCaption: string
  lotsLine: string
  questionsHeading: string
  faqs: Under500kFaq[]
  sourcesHeading: string
  nextHeading: string
}

export function formatMoneyExact(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  if (n >= MIXED_TYPE_MEDIAN_LOW && n <= MIXED_TYPE_MEDIAN_HIGH) return null
  const label = formatPriceExact(n)
  return label === '—' ? null : label
}

export function formatDays(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null
  const label = formatCount(n)
  return label || null
}

function townNamed(towns: readonly Under500kTownRow[], slug: string): Under500kTownRow | undefined {
  return towns.find((t) => t.slug === slug)
}

function listTownCounts(towns: readonly Under500kTownRow[]): string {
  return towns.map((t) => `${t.name} (${formatCount(t.residential)})`).join(', ')
}

function mostSfrLine(headline: readonly Under500kTownRow[]): string {
  const ranked = [...headline].sort((a, b) => b.sfr - a.sfr || a.name.localeCompare(b.name))
  const [first, second] = ranked
  if (!first || first.sfr <= 0) return ''
  if (!second || second.sfr <= 0) {
    return `For a single-family house under $500K, ${first.name} (${formatCount(first.sfr)}) has the most.`
  }
  return `For a single-family house under $500K, ${first.name} (${formatCount(first.sfr)}) and ${second.name} (${formatCount(second.sfr)}) have the most.`
}

function bendSplit(bend: Under500kTownRow | undefined): string {
  if (!bend) return ''
  const bits: string[] = []
  if (bend.condoTownhome > 0) bits.push(`${formatCount(bend.condoTownhome)} condos and townhomes`)
  if (bend.manufacturedOnLand > 0) bits.push(`${formatCount(bend.manufacturedOnLand)} manufactured homes on land`)
  if (bend.sharedOrLeased > 0) bits.push(`${formatCount(bend.sharedOrLeased)} shared or leased-land listings`)
  const rest = bits.length > 0 ? ` The rest are ${bits.join(', ')}.` : ''
  return `In Bend, most are condos, townhomes and manufactured homes (${formatCount(bend.sfr)} single-family houses).${rest}`
}

function leverageTowns(headline: readonly Under500kTownRow[]): Under500kTownRow[] {
  return headline.filter((t) => {
    const mosOk = t.monthsSupply != null && t.monthsSupply >= 6
    const slowAndCut =
      t.daysToOffer90 != null &&
      t.daysToOffer90 >= 50 &&
      t.priceCutShare != null &&
      t.priceCutShare >= 0.45
    return mosOk || slowAndCut
  })
}

function leverageSentence(snap: Under500kSnapshot): string | null {
  const named = leverageTowns(snap.headlineTowns).slice().sort((a, b) => {
    const mos = (b.monthsSupply ?? -1) - (a.monthsSupply ?? -1)
    if (mos !== 0) return mos
    return a.name.localeCompare(b.name)
  })
  if (named.length === 0) return null
  const names = named.map((t) => t.name)
  const who =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
  return `Buyers have leverage in ${who} on price.`
}

function metaDescription(snap: Under500kSnapshot): string {
  const asOf = snap.asOfLabel ?? 'today'
  const raw = `${formatCount(snap.headlineResidential)} homes under $500K across Redmond, Bend, La Pine and Prineville as of ${asOf}, and ${formatCount(snap.headlineSfr)} are single-family houses. Compare towns and see listings.`
  return shareDescription(raw, 155)
}

function faqAnswers(snap: Under500kSnapshot): Under500kFaq[] {
  const asOf = snap.asOfLabel ?? 'this refresh'
  const bend = townNamed(snap.towns, 'bend')
  const redmond = townNamed(snap.towns, 'redmond')
  const laPine = townNamed(snap.towns, 'la-pine')
  const prineville = townNamed(snap.towns, 'prineville')
  const bendMedian = formatMoneyExact(bend?.sfrMedianList ?? null)
  const bendMedianLine = bendMedian
    ? ` The median Bend single-family list price is ${bendMedian}.`
    : ''

  const mostHouse = [laPine, prineville, redmond]
    .filter((t): t is Under500kTownRow => t != null && t.sfr > 0)
    .sort((a, b) => b.sfr - a.sfr)
    .map((t) => `${t.name} (${formatCount(t.sfr)} single-family)`)
    .join(', then ')

  const townhomeLead =
    redmond && redmond.townhouse > 0
      ? ` ${redmond.name} leads on townhomes (${formatCount(redmond.townhouse)}).`
      : ''

  const prinevilleMos =
    prineville?.monthsSupply != null ? `${formatMonthsOfSupply(prineville.monthsSupply)} months of supply` : null
  const laPineDays = formatDays(laPine?.daysToOffer90 ?? null)
  const redmondMos =
    redmond?.monthsSupply != null ? `${formatMonthsOfSupply(redmond.monthsSupply)} months` : null
  const bendMos = bend?.monthsSupply != null ? `${formatMonthsOfSupply(bend.monthsSupply)} months` : null

  const leverageBits: string[] = []
  if (prinevilleMos) leverageBits.push(`Prineville has ${prinevilleMos}`)
  if (laPineDays) leverageBits.push(`La Pine homes take a median ${laPineDays} days to an offer`)
  const namedLeverage = leverageTowns(snap.headlineTowns)
  const leverageLead =
    leverageBits.length > 0
      ? `${leverageBits.join(' and ')}${
          namedLeverage.length > 0 ? ', so buyers have leverage on price there' : ''
        }.`
      : 'It depends on the town.'
  const mosCompare = [redmondMos && `Redmond is at ${redmondMos}`, bendMos && `Bend at ${bendMos}`]
    .filter(Boolean)
    .join(' and ')
  const mosTail = mosCompare ? ` ${mosCompare}.` : ''

  return [
    {
      question: 'How many homes are for sale under $500,000 in Central Oregon?',
      answer: `As of ${asOf}, there are ${formatCount(snap.headlineResidential)} residential listings in Redmond, Bend, La Pine and Prineville. ${formatCount(snap.headlineSfr)} are single-family houses, and the rest are townhomes, condos, manufactured homes on land and shared-ownership listings.`,
    },
    {
      question: 'Can you still buy a house under $500K in Bend?',
      answer: bend
        ? `Yes, but few are detached houses. As of ${asOf}, Bend has ${formatCount(bend.residential)} residential listings under $500K, and ${formatCount(bend.sfr)} are single-family houses.${bendRestSentence(bend)}${bendMedianLine}`
        : `Yes, but few are detached houses. Check the Bend listings page for the live set.`,
    },
    {
      question: 'Which Central Oregon town has the most houses under $500K?',
      answer: mostHouse
        ? `${mostHouse}.${townhomeLead}`
        : 'The live table on this page ranks the towns by single-family count.',
    },
    {
      question: 'What about under $400K or $300K?',
      answer:
        'Open the live city pages for each band, such as Bend under $400K and Bend under $300K. Those pages still count every listing type, including lots, so this page does not quote a residential-only count for those bands.',
    },
    {
      question: 'Is this the same as "affordable housing"?',
      answer:
        'No. These are market-rate listings. Income-restricted housing is handled by public agencies such as Housing Works and Oregon Housing and Community Services.',
    },
    {
      question: 'Do buyers have leverage under $500K?',
      answer: `It depends on the town. As of ${asOf}, ${leverageLead}${mosTail} Ask about price cuts and seller credits on homes that have sat.`,
    },
  ]
}

function bendRestSentence(bend: Under500kTownRow): string {
  const bits: string[] = []
  if (bend.condo > 0) bits.push(`${formatCount(bend.condo)} condos`)
  if (bend.manufacturedOnLand > 0) bits.push(`${formatCount(bend.manufacturedOnLand)} manufactured homes on land`)
  if (bend.townhouse > 0) bits.push(`${formatCount(bend.townhouse)} townhomes`)
  if (bend.sharedOrLeased > 0) bits.push(`${formatCount(bend.sharedOrLeased)} shared or leased-land listings`)
  if (bits.length === 0) return ''
  if (bits.length === 1) return ` The rest are ${bits[0]}.`
  return ` The rest are ${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}.`
}

const UNPUBLISHED_META =
  'Compare residential listings under $500,000 across Redmond, Bend, La Pine and Prineville. Live counts by town and property type.'

function unpublishedCopy(): Under500kCopy {
  return {
    title: TITLE,
    metaDescription: shareDescription(UNPUBLISHED_META, 155),
    h1: H1,
    eyebrow: 'Central Oregon · live MLS counts',
    answer: [
      'Live residential counts under $500,000 are not published on this refresh. Open a city listings page or check back shortly.',
    ],
    leverageLine: null,
    methodLine: `Source: ${MLS_SOURCE}.`,
    tableCaption: 'Residential listings under $500,000 by town. Counts are not published on this refresh.',
    lotsLine: 'Lots and land under $500K are not counted here.',
    questionsHeading: 'Questions',
    faqs: [
      {
        question: 'How many homes are for sale under $500,000 in Central Oregon?',
        answer: 'Live counts are not published on this refresh. Open a city listings page for the current set.',
      },
      {
        question: 'Can you still buy a house under $500K in Bend?',
        answer: 'Yes, but few are detached houses. Check the Bend listings page for the live set.',
      },
      {
        question: 'Which Central Oregon town has the most houses under $500K?',
        answer: 'The live table on this page ranks the towns by single-family count when counts publish.',
      },
      {
        question: 'What about under $400K or $300K?',
        answer:
          'Open the live city pages for each band, such as Bend under $400K and Bend under $300K. Those pages still count every listing type, including lots, so this page does not quote a residential-only count for those bands.',
      },
      {
        question: 'Is this the same as "affordable housing"?',
        answer:
          'No. These are market-rate listings. Income-restricted housing is handled by public agencies such as Housing Works and Oregon Housing and Community Services.',
      },
      {
        question: 'Do buyers have leverage under $500K?',
        answer: 'It depends on the town. Ask about price cuts and seller credits on homes that have sat.',
      },
    ],
    sourcesHeading: 'Sources',
    nextHeading: 'From this page',
  }
}

export function under500kCopy(snap: Under500kSnapshot): Under500kCopy {
  if (!snap.published) return unpublishedCopy()
  const asOf = snap.asOfLabel ?? 'this refresh'
  const bend = townNamed(snap.towns, 'bend')
  const answer: string[] = [
    `As of ${asOf}, ${formatCount(snap.headlineResidential)} residential listings are for sale under $500,000 in ${listTownCounts(snap.headlineTowns)}. Only ${formatCount(snap.headlineSfr)} of them are single-family houses. ${bendSplit(bend)} ${mostSfrLine(snap.headlineTowns)}`.replace(/\s+/g, ' ').trim(),
  ]

  return {
    title: TITLE,
    metaDescription: metaDescription(snap),
    h1: H1,
    eyebrow: 'Central Oregon · live MLS counts',
    answer,
    leverageLine: leverageSentence(snap),
    methodLine: `Source: ${MLS_SOURCE}.`,
    tableCaption: `Residential listings under $500,000 by town, as of ${asOf}. Sisters and Sunriver sit in the footnote because counting them would oversell single-family supply.`,
    lotsLine: 'Lots and land under $500K are not counted here.',
    questionsHeading: 'Questions',
    faqs: faqAnswers(snap),
    sourcesHeading: 'Sources',
    nextHeading: 'From this page',
  }
}

export function townMedianLabel(n: number | null | undefined): string {
  return unpublishedOr(formatMoneyExact(n))
}

export function townDaysLabel(n: number | null | undefined): string {
  return unpublishedOr(formatDays(n))
}

export function copyHasBannedClaim(text: string): boolean {
  const lower = text.toLowerCase()
  if (lower.includes("buyer's market") || lower.includes('buyers market')) return true
  if (/\bcheap\b/.test(lower) || /\bbargain\b/.test(lower)) return true
  if (lower.includes('below market')) return true
  if (
    lower.includes('affordable housing') &&
    !lower.includes('income-restricted') &&
    !lower.includes('is this the same as')
  ) {
    return true
  }
  if (lower.includes('$745') || lower.includes('745,000') || lower.includes('745k')) return true
  if (text.includes('\u2014') || text.includes('\u2013')) return true
  return false
}

export function nextItems(): Array<{ href: string; label: string; detail?: string }> {
  return [
    { href: LINKS.homes, label: 'Search homes for sale', detail: 'The live Central Oregon inventory.' },
    { href: LINKS.priceDrops, label: 'Homes with a price cut', detail: 'Ask about credits on homes that have sat.' },
    { href: LINKS.firstTimeGuide, label: 'First-time buyer guide', detail: 'How a purchase works here.' },
    { href: LINKS.firstTimeBuyer, label: 'First-time home buyer help', detail: 'A broker who stays with you.' },
    { href: LINKS.mortgage, label: 'Mortgage calculator', detail: 'A payment sketch, not a quote.' },
    { href: LINKS.closingCosts, label: 'Buyer closing costs', detail: 'What typically shows up on the statement.' },
    { href: LINKS.book, label: 'Book a consult', detail: 'Talk through a town and a price band.' },
    { href: LINKS.fairHousing, label: 'Fair housing', detail: 'Equal housing opportunity.' },
  ]
}
