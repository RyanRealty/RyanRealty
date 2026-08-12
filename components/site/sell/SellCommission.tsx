/**
 * SellCommission — the fee conversation for /sell.
 *
 * POSITIONING (Matt, locked in docs/plans/PUBLIC_PRODUCT/decisions.md): ONE plan is
 * marketed, at 3% of the sale price, with a comprehensive feature list. The 2.5%
 * Essential and 3.5% Elite tiers are OFF the public site, the comparison matrix is
 * dead, and the page stays silent on negotiability. Buyer-agent compensation remains a
 * separate, negotiated number.
 *
 * VOICE (VOICE.md): direct, specific, no pressure, no adjectives doing the work of a
 * number. Design-token colors only. Server-renderable. No fabricated figures.
 */

import {
  Body,
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
              <H2>The listing fee is 3% of the sale price.</H2>
            </Stack>
            <Stack gap="default">
              <Body size="default" tone="muted" className="leading-relaxed">
                It covers professional photography, the MLS listing, the full
                marketing plan, every showing, and transaction management from
                contract to close. Nothing is billed on the side, and it is the
                same percentage on a $400,000 home and a $4 million one.
              </Body>
              <Body size="default" tone="muted" className="leading-relaxed">
                Buyer-agent compensation is a separate number, negotiated per
                offer under the current commission rules. Before you sign, we
                show you the settlement statement that lists every dollar at
                closing, the buyer-agency agreement we use, and what a realistic
                buyer credit looks like at your price point.
              </Body>
              <Body size="default" tone="muted" className="leading-relaxed">
                If you read the CMA and decide not to list, we follow up twice
                by email and then stop.
              </Body>
            </Stack>
          </Stack>

          <div className="flex flex-col gap-4">
            {[
              {
                heading: 'What the fee includes',
                body: 'Professional photography, a 3D tour, the MLS listing and every syndicated feed, the marketing plan, open houses, all showings, and transaction management through closing.',
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
