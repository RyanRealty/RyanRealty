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
              <Eyebrow>What it costs</Eyebrow>
              <H2>A straight commission conversation.</H2>
            </Stack>
            <Stack gap="default">
              <Body size="default" tone="muted" className="leading-[1.65]">
                We charge a total commission split between the listing brokerage and the buyer&apos;s brokerage. That covers professional photography, the MLS listing, all marketing, every showing, and full transaction management from contract to close.
              </Body>
              <Body size="default" tone="muted" className="leading-[1.65]">
                The commission structure changed in 2025. We work under the new model and can walk you through the exact breakdown, the buyer-agency agreement we use, and realistic concession math for your price point. No surprises at the table.
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
                heading: 'Photography and marketing included',
                body: 'Professional photos, MLS listing, all showings, and full transaction management are included in the commission. No add-on fees.',
              },
              {
                heading: 'New commission model, fully explained',
                body: 'We can show you the exact ALTA breakdown and the buyer-agency agreement we use before you sign anything.',
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
