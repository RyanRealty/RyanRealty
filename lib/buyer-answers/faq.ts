import type { BuyerAnswerDef, BuyerAnswerFaq, BuyerAnswerFigures, SourcedStrFact } from './types'
import { formatCount, formatDays, formatMos, formatUsd, formatUsdExact, mlsCitation } from './format'

function faq(question: string, answer: string): BuyerAnswerFaq {
  return { question, answer }
}

export function buildFaqs(input: {
  def: BuyerAnswerDef
  place: BuyerAnswerFigures
  other?: BuyerAnswerFigures | null
  str?: SourcedStrFact | null
  asOf: string | null
}): BuyerAnswerFaq[] {
  const { def, place, other, str, asOf } = input
  const cite = mlsCitation(asOf)
  const items: BuyerAnswerFaq[] = []
  const count = place.activeCount ?? (place.listingCount > 0 ? place.listingCount : null)

  if (count != null) {
    items.push(
      faq(
        `How many homes are for sale in ${place.name}?`,
        count === 0
          ? `None right now. ${cite}. Inventory updates as homes list or go pending.`
          : `There ${count === 1 ? 'is' : 'are'} ${formatCount(count)} single-family home${count === 1 ? '' : 's'} for sale in ${place.name}. ${cite}.`,
      ),
    )
  }

  if (place.medianListPrice != null && place.medianListPrice > 0) {
    items.push(
      faq(
        `What is the median list price in ${place.name}?`,
        `The median list price for single-family homes in ${place.name} is ${formatUsd(place.medianListPrice)}. ${cite}.`,
      ),
    )
  }

  const days = formatDays(place.medianDaysToPending)
  if (days) {
    items.push(
      faq(
        `How long do homes take to go pending in ${place.name}?`,
        `The median is ${days} days to pending. ${cite}. Pace varies by house and by week.`,
      ),
    )
  }

  const mos = formatMos(place.monthsOfSupply)
  if (mos) {
    items.push(
      faq(
        `What is months of supply in ${place.name}?`,
        `Months of supply is ${mos}. ${cite}.`,
      ),
    )
  }

  if (def.kind === 'hoa' && place.hoaAnnual != null) {
    items.push(
      faq(
        `What are ${place.name} HOA fees?`,
        place.hoaKind === 'measured'
          ? `Listings that report dues show ${formatUsd(place.hoaAnnual)} a year${place.hoaBasis ? ` (${place.hoaBasis})` : ''}. Confirm the current amount with the association.`
          : `The published master assessment is ${formatUsdExact(place.hoaAnnual)} a year. Sub-neighborhood dues can sit on top. Confirm the current amount with the association.`,
      ),
    )
  }

  if (def.kind === 'str' && str) {
    items.push(faq(`Can I rent a ${place.name} home short-term?`, `${str.summary} Source: ${str.sourceLabel}.`))
  }

  if (def.kind === 'vs' && other) {
    const otherCount = other.activeCount ?? (other.listingCount > 0 ? other.listingCount : null)
    if (otherCount != null) {
      items.push(
        faq(
          `How does ${place.name} compare with ${other.name} right now?`,
          `${place.name} has ${count == null ? 'an unpublished single-family count' : formatCount(count)} for sale. ${other.name} has ${formatCount(otherCount)}. ${cite}. Those are inventory counts, not a ranking.`,
        ),
      )
    }
  }

  if (def.kind === 'cost' || def.kind === 'living') {
    items.push(
      faq(
        `Does this page say who should live in ${place.name}?`,
        `No. It states the live housing-market figures only: inventory, asking prices, and pace. It does not describe who belongs there.`,
      ),
    )
  }

  if (def.kind === 'from-out-of-state') {
    items.push(
      faq(
        `Can I buy a house in ${place.name} from out of state?`,
        `Yes. The live list is the same list we use in town. ${cite}. Ryan Realty has been doing this work since Matt Ryan founded the firm in 2014.`,
      ),
    )
  }

  if (def.kind === 'second-home') {
    items.push(
      faq(
        `Does this page say I can rent a ${place.name} home short-term?`,
        `No. It states live single-family inventory only. Short-term rental rules are not a single sourced figure on this page. Confirm use with the association before you buy.`,
      ),
    )
  }

  if (def.kind === 'buying') {
    items.push(
      faq(
        `What does buying a home in ${place.name} start with?`,
        `The live MLS list. ${cite}. This page does not rank neighborhoods or name a best first house.`,
      ),
    )
  }

  return items.slice(0, 5)
}
