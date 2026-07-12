/**
 * SellCommission — the straight-up commission conversation for /sell.
 *
 * POSITIONING (Matt, 2026-07-11): 3% is the headline (the Enhanced plan). A
 * seller can trim to 2.5% (Essential) for less reach or move to 3.5% (Elite)
 * for the full push. Buyer-agent compensation is a separate, negotiated number.
 * Commission is negotiable and every listing agreement is its own conversation.
 *
 * VOICE (VOICE.md): direct, specific, no pressure, no adjectives doing the work
 * of a number. No banned words, no em-dash, no semicolons. Design-token colors
 * only. Server-renderable. No hard numbers fabricated.
 */

import {
  Body,
  Caption,
  Container,
  Eyebrow,
  H2,
  Section,
  Stack,
} from '@/components/site/primitives'

export function SellCommission() {
  return (
    <Section padding="default" tone="default" divider>
      <Container>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">
          <Stack gap="loose">
            <Stack gap="tight">
              <Eyebrow>How the fee works</Eyebrow>
              <H2>3% is the plan. Pay less for less, or more for the full push.</H2>
            </Stack>
            <Stack gap="default">
              <Body size="default" tone="muted" className="leading-relaxed">
                The 3% listing fee covers professional photography, the MLS
                listing, the full marketing plan, every showing, and transaction
                management from contract to close. Nothing is billed on the side.
                The same fee runs on a 400,000 dollar home and a 4 million dollar
                one.
              </Body>
              <Body size="default" tone="muted" className="leading-relaxed">
                Want to spend less? Essential is 2.5% and keeps the essentials
                while trimming the reach. Want every channel working at once?
                Elite is 3.5% and adds a pre-listing inspection, a professional
                stager, paid social, and a placement in Bend Magazine.
              </Body>
              <Body size="default" tone="muted" className="leading-relaxed">
                Buyer-agent compensation is a separate number, negotiated per
                offer under the current commission rules. Before you sign, we
                show you the settlement statement that lists every dollar at
                closing, the buyer-agency agreement we use, and what a realistic
                buyer credit looks like at your price point.
              </Body>
              <Body size="default" tone="muted" className="leading-relaxed">
                We are not a high-pressure shop. If after reading the CMA you
                decide not to list, we do not follow up beyond two emails.
              </Body>
            </Stack>
            <Caption className="text-muted-foreground">
              Commission is negotiable. Every listing agreement is its own conversation.
            </Caption>
          </Stack>

          <div className="flex flex-col gap-4">
            {[
              {
                heading: 'Pick the reach, not a mystery fee',
                body: 'Essential 2.5%, Enhanced 3%, Elite 3.5%. Every tier lists on the MLS, gets professional photos and a 3D tour, and closes with one broker. What changes is how hard the marketing pushes.',
              },
              {
                heading: 'Buyer-agent compensation, explained',
                body: 'A separate number, negotiated per offer. We show you the closing settlement statement and the buyer-agency agreement we use before you sign anything.',
              },
              {
                heading: 'No contract to get the CMA',
                body: 'A comparative market analysis is free and requires no listing agreement. If you decide to list with us, that is a separate signed contract.',
              },
            ].map((item) => (
              <div
                key={item.heading}
                className="rounded-[14px] border border-border bg-card p-5"
              >
                <p className="mb-1.5 text-base font-semibold leading-snug text-foreground">
                  {item.heading}
                </p>
                <Body size="default" tone="muted" className="leading-relaxed">
                  {item.body}
                </Body>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  )
}
