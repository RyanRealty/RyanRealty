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
    title: 'Six comps, and the range they support',
    body: 'We write a CMA with three closed comps, three active comps, the list-price range those six support, and the four variables that move it. You see every number we used.',
    detail: 'Free. No listing agreement required.',
  },
  {
    title: 'One broker, first call to closing',
    body: 'The broker who prices your home is the broker who lists it, markets it, negotiates the offers, and closes the transaction. No hand-offs. No call center.',
    detail: 'Matt Ryan, Paul Stevenson, or Rebecca Peterson.',
  },
  {
    title: 'Photos in 48 hours, listed in a week',
    body: 'Professional photography within 48 hours of a signed agreement. Live on the MLS in 5 to 7 business days with full Central Oregon syndication. The description is written by the broker who priced your home.',
    detail: 'A written traffic report every week it is listed.',
  },
]

export function SellValueProps() {
  return (
    <Section padding="default" tone="default" divider>
      <Container>
        <Stack gap="tight" className="mb-10 max-w-[52ch]">
          <Eyebrow>Why list with us</Eyebrow>
          <H2>Every price we quote arrives with the comps behind it.</H2>
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
