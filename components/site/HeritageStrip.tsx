import { Container, DisplayHeading, Eyebrow, MiddleDot, Section } from '@/components/site/primitives'

/**
 * Heritage strip — centered brand lockup band per the /about mockup
 * (design_system/ryan-realty/ui_kits/about/index.html §heritage-strip).
 *
 * Cream surface, top + bottom hairline divider, an eyebrow ribbon above the
 * Amboqia "Ryan Realty" lockup, then a middle-dot place + founding line.
 *
 * Data accuracy (CLAUDE.md §0): every fact is verified. Ryan Realty, Bend,
 * Oregon, founded 2023 (OREA business license 201253677, 2023-06-21).
 *
 * Voice note: the mockup ribbon read "It's About Relationships", but the word
 * "about" is a banned vague qualifier (CLAUDE.md §3 / brand-voice gate G3), so
 * the ribbon uses a verified factual descriptor instead.
 */
export function HeritageStrip() {
  return (
    <Section
      padding="default"
      tone="muted"
      divider
      className="border-b border-border text-center"
      aria-label="Ryan Realty"
    >
      <Container>
        <div className="mx-auto max-w-2xl">
          <Eyebrow>Independent brokerage</Eyebrow>
          <DisplayHeading as="h2" className="mt-3 text-4xl sm:text-5xl text-primary">
            Ryan Realty
          </DisplayHeading>
          <div className="mt-4 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Bend
            <MiddleDot />
            Oregon
            <MiddleDot />
            est. 2023
          </div>
        </div>
      </Container>
    </Section>
  )
}
