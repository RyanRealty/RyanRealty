/**
 * Shot helper: the sourced Bend answer the address sheet reveals.
 * Built from the same DAL reads /sell already makes. No dollar figure
 * for a typed street (Matt). Used only when the taste control opens
 * the answer panel.
 */
import { formatDate } from '@/lib/format/date'
import { buildAnswerFigures, salesPerMonthFrom } from '@/lib/site/answer-figures'
import type { SellBendMarket } from '@/lib/data/market-truth/getSellBendMarket'
import type { PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import { sellAnswerHasSubstance, type SellAnswerData } from './sell-answer'

const PREVIEW_STREET = 'A Bend home'

export function sellPreviewAnswer(
  bend: SellBendMarket | null,
  pace: PublicPaceRow | null,
): SellAnswerData | null {
  if (!bend) return null
  const salesPerMonth = salesPerMonthFrom(bend.activeCount, bend.monthsOfSupply)
  const asOfLabel = bend.computedAt ? formatDate(bend.computedAt) : null
  const figures = buildAnswerFigures({
    placeLabel: 'Bend',
    street: PREVIEW_STREET,
    monthsOfSupply: bend.mosLabel,
    verdictLabel: bend.verdictLabel,
    activeCount: bend.activeCount,
    salesPerMonth,
    daysToPending: pace?.daysToPending90d ?? null,
    cityDaysToPending: null,
    cityLabel: null,
    compMarks: [],
    compCount: null,
    subjectFound: false,
    subjectSummary: null,
    asOfLabel,
    sources: {
      supply: `months of supply ${bend.mosLabel} — market_metric city:bend`,
      pace:
        pace?.daysToPending90d != null
          ? `days to pending ${pace.daysToPending90d} — market_metric city:bend`
          : 'days to pending unpublished for this preview',
    },
    unmatchedSentence: 'Comparable closes arrive after a typed street.',
  })
  const answer: SellAnswerData = {
    address: PREVIEW_STREET,
    street: PREVIEW_STREET,
    placeLabel: 'Bend',
    grain: 'city',
    placeHref: '/housing-market/bend',
    verdictLabel: bend.verdictLabel,
    monthsOfSupply: bend.mosLabel,
    activeCount: bend.activeCount,
    salesPerMonth,
    daysToPending: pace?.daysToPending90d ?? null,
    cashSharePct: pace?.cashShare != null ? pace.cashShare * 100 : null,
    compCount: null,
    subjectFound: false,
    subjectSummary: null,
    figures,
    asOfLabel,
    trace: [
      `months of supply ${bend.mosLabel} (${bend.verdictLabel}) — market_metric city:bend`,
    ],
  }
  return sellAnswerHasSubstance(answer) ? answer : null
}
