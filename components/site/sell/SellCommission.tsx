/**
 * SellCommission — straight-up commission conversation for the /sell page.
 *
 * Mirrors the "What it costs" section from the mockup. Design-token
 * colors only. Server-renderable. No hard numbers fabricated.
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
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16 lg:items-start">
          <Stack gap="loose">
            <Stack gap="tight">
              <Eyebrow>How the fee works</Eyebrow>
              <H2>3% to list. No add-ons.</H2>
            </Stack>
            <Stack gap="default">
              <Body size="default" tone="muted" className="leading-[1.65]">
                The 3% listing fee covers professional photography, the MLS listing, every piece of the marketing plan above, every showing, and full transaction management from contract to close. Nothing is billed on the side.
              </Body>
              <Body size="default" tone="muted" className="leading-[1.65]">
                Buyer-agent compensation is a separate number, negotiated per offer under the current commission rules. We show you the exact ALTA breakdown, the buyer-agency agreement we use, and the realistic concession math for your price point before you sign.
              </Body>
              <Body size="default" tone="muted" className="leading-[1.65]">
                We are not a high-pressure shop. If after reading the CMA you decide not to list, we do not follow up beyond two emails.
              </Body>
            </Stack>
            <Caption className="text-muted-foreground">
              Commission is negotiable. Every listing agreement is its own conversation.
            </Caption>
          </Stack>

          <div className="flex flex-col gap-4">
            {[
              {
                heading: 'Everything is in the 3%',
                body: 'Photography, the MLS listing, the full marketing plan, every showing, and complete transaction management. No tiers, no add-on fees.',
              },
              {
                heading: 'Buyer-agent compensation, explained',
                body: 'A separate number, negotiated per offer. We show you the exact ALTA breakdown and the buyer-agency agreement we use before you sign anything.',
              },
              {
                heading: 'No contract to get the CMA',
                body: 'A comparative market analysis is free and requires no listing agreement. If you decide to list with us, that is a separate signed contract.',
              },
            ].map((item) => (
              <div
                key={item.heading}
                className="rounded-[12px] border border-border bg-card p-5"
              >
                <p className="mb-1.5 text-[15px] font-semibold text-foreground leading-snug">
                  {item.heading}
                </p>
                <Body size="default" tone="muted" className="leading-[1.6]">
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
