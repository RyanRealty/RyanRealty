import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  Body,
  Container,
  Eyebrow,
  H2,
  H3,
  Section,
  Stack,
} from '@/components/site/primitives'

/**
 * Site v2 FAQ block — rendered as a semantic <dl> of question + answer
 * pairs. Pairs with a schema.org FAQPage JSON-LD block so the questions
 * surface in Google rich results without each page hand-writing the
 * schema.
 *
 * Per plan §9 Layer 3. Used by /faq, /contact, and any page-bottom
 * "common questions" section. The block stays brand-voice clean — the
 * ESLint gate catches any em-dash / banned word in the Q/A strings at
 * caller sites.
 *
 * Example:
 *   <FAQBlock
 *     eyebrow="Common questions"
 *     title="Buying in Bend"
 *     intro="Quick answers to the questions we hear most."
 *     items={[
 *       { question: 'How fast is Bend selling?',
 *         answer: 'Median DOM is 38 days as of May 2026.' },
 *       { question: 'What is a typical earnest money deposit?',
 *         answer: '1 to 3 percent of the offer price.' },
 *     ]}
 *   />
 */

export type FAQItem = {
  question: string
  answer: string
}

type Props = {
  items: ReadonlyArray<FAQItem>
  /** Eyebrow above the H2 (sentence-case noun phrase). */
  eyebrow?: string
  /** H2 title. Sentence case per CLAUDE.md voice rules. */
  title?: string
  /** Optional one-line lede beneath the H2. */
  intro?: string
  /** Render the matching schema.org FAQPage JSON-LD. Default true. */
  includeJsonLd?: boolean
  /** Section tone — default light bg; pass "muted" for the cream surface. */
  tone?: 'default' | 'muted'
  className?: string
}

export function FAQBlock({
  items,
  eyebrow,
  title,
  intro,
  includeJsonLd = true,
  tone = 'default',
  className,
}: Props) {
  if (items.length === 0) return null

  return (
    <Section padding="default" tone={tone} divider className={className}>
      <Container>
        {(eyebrow || title || intro) ? (
          <Stack gap="tight" className="mb-8 max-w-[60ch]">
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            {title ? <H2>{title}</H2> : null}
            {intro ? (
              <Body size="default" tone="muted">
                {intro}
              </Body>
            ) : null}
          </Stack>
        ) : null}

        <dl className="max-w-[68ch] flex flex-col gap-6">
          {items.map((item, i) => (
            <div key={`${i}-${item.question.slice(0, 20)}`} className="border-t border-border pt-5 first:border-t-0 first:pt-0">
              <dt>
                <H3 className="text-[18px]">{item.question}</H3>
              </dt>
              <dd className="mt-2">
                <Body size="default" tone="muted" className="leading-[1.6]">
                  {item.answer}
                </Body>
              </dd>
            </div>
          ))}
        </dl>

        {includeJsonLd ? (
          <MetadataBlock schema={{ type: 'faqPage', items }} />
        ) : null}
      </Container>
    </Section>
  )
}
