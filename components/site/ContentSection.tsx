import type { ReactNode } from 'react'
import {
  Body,
  Container,
  Eyebrow,
  H2,
  Section,
  Stack,
} from '@/components/site/primitives'
import { cn } from '@/lib/utils'

/**
 * Site v2 generic content section — eyebrow + title + intro + children
 * (markdown-friendly prose block). Per plan §9 Layer 3.
 *
 * For long-form article-style pages: blog posts, neighborhood guides,
 * buyer guides, market-report write-ups. Wraps the heading block in a
 * Stack and renders the body content in a max-width readable column
 * (typographic 68ch) so long-form copy stays scannable.
 *
 * Pairs with the @tailwindcss/typography `prose` class on the children
 * container when callers pass markdown-rendered HTML.
 *
 * Example:
 *   <ContentSection
 *     eyebrow="Guide"
 *     title="Buying in Bend"
 *     intro="Honest answers to the questions our clients ask first."
 *   >
 *     <article className="prose">{markdownHtml}</article>
 *   </ContentSection>
 */

type Props = {
  children: ReactNode
  /** Eyebrow above the H2 (sentence-case noun phrase). */
  eyebrow?: string
  /** H2 title. Sentence case per CLAUDE.md voice rules. */
  title?: string
  /** Optional one-line lede beneath the H2. */
  intro?: string
  /** Section tone — default light bg; pass "muted" for the cream surface. */
  tone?: 'default' | 'muted'
  /** When true, render the divider top border between adjacent sections. */
  divider?: boolean
  /** Width of the content column. Default narrow (~68ch). */
  width?: 'narrow' | 'wide'
  className?: string
}

const widthClass: Record<NonNullable<Props['width']>, string> = {
  narrow: 'max-w-[68ch]',
  wide: 'max-w-[80ch]',
}

export function ContentSection({
  children,
  eyebrow,
  title,
  intro,
  tone = 'default',
  divider = false,
  width = 'narrow',
  className,
}: Props) {
  return (
    <Section padding="default" tone={tone} divider={divider} className={className}>
      <Container>
        {(eyebrow || title || intro) ? (
          <Stack gap="tight" className={cn('mb-8', widthClass[width])}>
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            {title ? <H2>{title}</H2> : null}
            {intro ? (
              <Body size="large" tone="muted">
                {intro}
              </Body>
            ) : null}
          </Stack>
        ) : null}
        <div className={widthClass[width]}>{children}</div>
      </Container>
    </Section>
  )
}
