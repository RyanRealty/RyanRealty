import { FAQBlock } from '@/components/site/FAQBlock'
import type { GolfFaqItem } from '@/data/golf-landing'

/**
 * GolfFaq — wraps FAQBlock with golf-specific items and JSON-LD.
 *
 * FAQBlock handles the Section, Container, schema.org FAQPage JSON-LD,
 * and Q/A rendering. This component is a thin adapter that passes the
 * golf FAQ data with the canonical title and enables the JSON-LD schema.
 */

type Props = {
  items: GolfFaqItem[]
}

export function GolfFaq({ items }: Props) {
  return (
    <FAQBlock
      eyebrow="Questions"
      title="Golf real estate questions"
      intro="Answers to what buyers ask most about on-course and golf-view homes in Central Oregon."
      items={items}
      includeJsonLd
      tone="muted"
    />
  )
}
