/**
 * SellProcess — numbered steps for the /sell page.
 *
 * Three concrete steps from valuation request to closing table.
 * Design-token colors only. Server-renderable.
 */

import {
  Body,
  Container,
  Eyebrow,
  H2,
  H3,
  Section,
  Stack,
} from '@/components/site/primitives'

type Step = {
  n: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    n: '1',
    title: 'Free written CMA',
    body: 'We prepare a one-page comparative market analysis and email it to you. Three closed comps, three active comps, the list-price range they support, and the four variables that move it. No cost. No contract required to get it.',
  },
  {
    n: '2',
    title: 'List and go to market',
    body: 'Professional photos within 48 hours of signing the listing agreement. MLS description written by a person. Strategic open-house cadence. Weekly written updates on showings and traffic. You know what is happening at every step.',
  },
  {
    n: '3',
    title: 'Close and move on',
    body: 'We review every offer in writing with you: what it actually says, not just the headline number. We negotiate. We manage the transaction through inspection, appraisal, and close. When you get to the finish line, the same broker you met on day one is there with you.',
  },
]

export function SellProcess() {
  return (
    <Section padding="default" tone="muted" divider>
      <Container>
        <Stack gap="tight" className="mb-10 max-w-[52ch]">
          <Eyebrow>Our process</Eyebrow>
          <H2>Three steps. No surprises.</H2>
        </Stack>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="relative pl-0">
              <div
                aria-hidden
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white text-[17px] font-bold select-none"
              >
                {step.n}
              </div>
              <H3 className="mb-2 text-[20px]">{step.title}</H3>
              <Body size="default" tone="muted" className="leading-[1.65]">
                {step.body}
              </Body>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
