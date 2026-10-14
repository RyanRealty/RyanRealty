import type { V3QuietItem } from '@/components/site/v3'
import { PRICE_CUT_SANITY_MAX_PCT } from '@/lib/data/listings/price-drop-sanity'
import {
  assertPriceDropCopy,
  priceDropAnswerSentences,
  type PriceDropCityContext,
} from '@/lib/price-drops/copy'
import { PRICE_DROP_SIGNAL_DEFINITIONS, type PriceDropSignalKind } from '@/lib/price-drops/signals'

export function priceDropAnswerItems(input: {
  citySlug: string
  cityName: string
  weekCount: number
  medianDropPct: number | null
  totalReducedLabel: string | null
  weekAsOf: string | null
  context: PriceDropCityContext
}): V3QuietItem[] {
  const sentences = priceDropAnswerSentences(input)
  for (const sentence of sentences) assertPriceDropCopy(sentence)
  return sentences.map((body, index) => ({
    kind: 'prose' as const,
    term: index === 0 ? 'This week' : index === sentences.length - 1 ? 'How to read it' : 'Context',
    body,
  }))
}

export function priceDropSignalDefinitionItems(input: {
  kinds: readonly PriceDropSignalKind[]
  counts: Partial<Record<PriceDropSignalKind, number>>
}): V3QuietItem[] {
  return input.kinds.map((kind) => {
    const spec = PRICE_DROP_SIGNAL_DEFINITIONS[kind]
    const count = input.counts[kind]
    const countLabel = count == null ? '' : ` ${count} ${count === 1 ? 'home' : 'homes'} on this pull.`
    const body = `${spec.definition}${countLabel}`
    assertPriceDropCopy(`${spec.label} ${body}`)
    return {
      kind: 'prose' as const,
      term: spec.label,
      body,
    }
  })
}

export function priceDropSanityNote(): V3QuietItem {
  const body =
    `Cuts deeper than ${PRICE_CUT_SANITY_MAX_PCT}% and ~10x decimal-place typos stay out of the count and the list. A recovered or raised ask after a relist is not a current cut.`
  assertPriceDropCopy(body)
  return { kind: 'prose', term: 'What we count', body }
}
