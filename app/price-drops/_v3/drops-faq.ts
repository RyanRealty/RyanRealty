import type { V3Answer } from '@/components/site/v3'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  assertPriceDropCopy,
  priceDropFaqItems,
  type PriceDropCityContext,
} from '@/lib/price-drops/copy'
import { underPriceDoors } from '@/lib/price-drops/links'

export function priceDropFaqAnswers(input: {
  citySlug: string
  cityName: string
  weekCount: number
  context: PriceDropCityContext
  reoCount: number | null
  reoEnabled: boolean
}): V3Answer[] {
  const items = priceDropFaqItems(input)
  return items.map((item, index) => {
    assertPriceDropCopy(`${item.question} ${item.answer}`)
    const under = underPriceDoors(input.citySlug)
    const action =
      item.question.startsWith('What are the cheapest') && under[0]
        ? { label: under[0].label, href: under[0].href }
        : item.question.startsWith('How do I make an offer')
          ? {
              label: 'Buyer-broker agreement in Bend',
              href: '/blog/buyers-agent-bend-buyer-broker-agreement',
            }
          : undefined
    return {
      question: item.question,
      body: item.answer,
      open: index === 0,
      id: `faq-${index + 1}`,
      ...(action ? { action } : {}),
    }
  })
}

export function priceDropFaqSchema(
  answers: readonly V3Answer[],
  dateModified: string | null,
): SchemaInput | null {
  if (answers.length === 0) return null
  return {
      type: 'faqPage',
      items: answers.map((row) => ({
        question: row.question,
        answer: Array.isArray(row.body) ? row.body.join(' ') : String(row.body ?? ''),
      })),
      ...(dateModified ? { dateModified } : {}),
    }
}
