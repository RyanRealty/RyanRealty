/**
 * Homepage ATF guides + Q&A (SITE-125).
 *
 * Questions are the live site FAQ — same strings /faq and /faq/[slug] publish.
 * Doors come from SITE-123 AEO hub tip-mins (published titles only).
 * Do not invent a closing-costs slug or a buyer-broker brief here.
 */
import { getFaqBySlug } from '@/app/faq/data'
import { generateFAQSchema } from '@/lib/structured-data'
import type { V3Answer } from '@/components/site/v3'

export const HOME_GUIDE_QA_IDS = ['first-time-buyers', 'cost-to-list', 'bend-neighborhoods'] as const

export function homeGuideQaQuestions(): V3Answer[] {
  return HOME_GUIDE_QA_IDS.flatMap((id) => {
    const item = getFaqBySlug(id)
    if (!item) return []
    return [
      {
        id: `home-qa-${item.id}`,
        question: item.question,
        body: item.answer,
        action: { label: 'Full answer', href: `/faq/${item.id}` },
      },
    ]
  })
}

export function homeGuideQaJsonLd(): Record<string, unknown> | null {
  const faqs = HOME_GUIDE_QA_IDS.flatMap((id) => {
    const item = getFaqBySlug(id)
    return item ? [{ question: item.question, answer: item.answer }] : []
  })
  if (faqs.length === 0) return null
  return generateFAQSchema(faqs)
}
