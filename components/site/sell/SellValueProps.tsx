/**
 * SellValueProps — three differentiation cards for the /sell page.
 *
 * Uses shadcn Card + design-token colors only. No raw buttons, no hex
 * colors, no banned vocabulary. Server-renderable.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Body,
  Container,
  Eyebrow,
  Grid,
  H2,
  Section,
  Stack,
} from '@/components/site/primitives'

type ValueProp = {
  title: string
  body: string
  detail?: string
}

const VALUE_PROPS: ValueProp[] = [
  {
    title: 'Priced on real data',
    body: 'We prepare a written CMA with three closed comps, three active comps, an honest list-price range, and the four levers that move it. You see every number we used.',
    detail: 'No guesses. No adjectives.',
  },
  {
    title: 'One broker, first call to closing',
    body: 'The broker who prices your home is the broker who lists it, markets it, negotiates the offers, and closes the transaction. No hand-offs. No call center.',
    detail: 'A small business like ours.',
  },
  {
    title: 'Marketed by someone who knows this market',
    body: 'Professional photography within 48 hours of agreement. MLS description written by a person. Weekly written updates on showings and traffic. Full MLS syndication across Central Oregon.',
    detail: 'No templates. No filler.',
  },
]

export function SellValueProps() {
  return (
    <Section padding="default" tone="default" divider>
      <Container>
        <Stack gap="tight" className="mb-10 max-w-[52ch]">
          <Eyebrow>Why list with us</Eyebrow>
          <H2>A small brokerage that prices on numbers, not adjectives.</H2>
        </Stack>
        <Grid cols={3} gap="loose">
          {VALUE_PROPS.map((v) => (
            <Card key={v.title} className="rounded-[14px] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-[19px] font-bold leading-snug tracking-[-0.01em] text-foreground">
                  {v.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Body size="default" tone="muted" className="leading-[1.65]">
                  {v.body}
                </Body>
                {v.detail ? (
                  <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-primary">
                    {v.detail}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </Grid>
      </Container>
    </Section>
  )
}
