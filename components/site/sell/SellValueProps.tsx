/**
 * SellValueProps — three differentiation cards for the /sell page.
 *
 * E5 craft: asymmetric section head + numbered cards (first card muted accent).
 * Uses shadcn Card + design-token colors only. Server-renderable.
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
    <Section padding="default" tone="default" divider id="what-you-get">
      <Container>
        <div className="mb-10 grid grid-cols-1 items-end gap-6 lg:grid-cols-12">
          <Stack gap="tight" className="max-w-xl lg:col-span-7">
            <Eyebrow>What you get when you list</Eyebrow>
            <H2>Every price we quote arrives with the comps behind it.</H2>
          </Stack>
          <Body size="default" tone="muted" className="max-w-sm leading-relaxed lg:col-span-5 lg:justify-self-end">
            Free CMA first. One broker from pricing to close. Photos in 48 hours, listed in a week.
          </Body>
        </div>
        <Grid cols={3} gap="loose">
          {VALUE_PROPS.map((v, i) => (
            <Card
              key={v.title}
              className={
                i === 0
                  ? 'rounded-xl border-primary/20 bg-muted shadow-none'
                  : 'rounded-xl border-border shadow-none'
              }
            >
              <CardHeader className="pb-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <CardTitle className="text-lg font-bold leading-snug tracking-tight text-foreground">
                  {v.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Body size="default" tone="muted" className="leading-relaxed">
                  {v.body}
                </Body>
                {v.detail ? (
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-primary">
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
