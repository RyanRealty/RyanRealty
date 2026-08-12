/**
 * Single public listing plan: 3% with expandable inclusions (Enhanced set).
 * No matrix. No 2.5% / 3.5% on the public site (Matt 2026-08-11).
 */

import {
  Body,
  Container,
  Eyebrow,
  H2,
  Section,
  Stack,
  TextLink,
} from '@/components/site/primitives'

const GROUPS: { title: string; lines: string[] }[] = [
  {
    title: 'Pricing and the transaction',
    lines: [
      'Written valuation with the sales behind the price',
      'Independent transaction coordinator through close',
      'A written report every week: showings, traffic, feedback',
      'Post-sale support for your next move',
    ],
  },
  {
    title: 'Where your home shows up',
    lines: [
      'Central Oregon MLS',
      'Zillow, Redfin, Trulia and the national feeds',
      'Its own page on ryan-realty.com',
      'Vetted lender, title, mover and contractor network',
    ],
  },
  {
    title: 'Photography and media',
    lines: [
      'Professional photography',
      '3D walkthrough tour',
      'Yard sign with a QR code to the listing',
      'Aerial drone video',
      'Cinematic video walkthrough',
    ],
  },
  {
    title: 'Getting buyers through the door',
    lines: [
      'Staging consult using your own furnishings',
      'Open houses on a set cadence',
      'Broker tour for local agents',
      'Virtual staging for vacant rooms',
    ],
  },
  {
    title: 'Marketing reach',
    lines: [
      'Organic posts on @ryanrealtybend',
      'Short-form video (Reels, TikTok)',
      'Email to 300 nearby homeowners',
      'Printed mailers to 200 neighbors',
      'Direct outreach to thousands of local agents',
      'Outreach to 50 top agents in Portland, Seattle, LA and SF',
    ],
  },
  {
    title: 'While you are away',
    lines: [
      'Remote-owner care: mail, snow, plant watering, security checks',
      'Move-out and deep-cleaning coordination',
    ],
  },
]

export function SellPlanSingle({ valuationHref = '#get-value' }: { valuationHref?: string }) {
  return (
    <Section id="listing-plan" padding="default" tone="default" divider className="scroll-mt-24">
      <Container>
        <Stack gap="tight" className="mb-8 max-w-2xl">
          <Eyebrow>Listing fee</Eyebrow>
          <H2>3% of the sale price</H2>
          <Body size="large" tone="muted" className="mt-1 leading-relaxed">
            One plan on this site. Photos within 48 hours of signing. On the MLS in 5 to 7 business
            days. Written report every week it is listed.
          </Body>
        </Stack>

        <div className="grid gap-6 lg:grid-cols-2">
          {GROUPS.map((g) => (
            <details
              key={g.title}
              className="border border-border bg-card open:bg-muted/30"
            >
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  {g.title}
                  <span className="text-muted-foreground font-normal" aria-hidden>
                    +
                  </span>
                </span>
              </summary>
              <ul className="space-y-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
                {g.lines.map((line) => (
                  <li key={line} className="leading-relaxed">
                    {line}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Start with a free written valuation.{' '}
          <TextLink href={valuationHref}>Get your home&apos;s value</TextLink>
        </p>
      </Container>
    </Section>
  )
}
