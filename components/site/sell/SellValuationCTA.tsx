/**
 * SellValuationCTA — the mid-page "get your free valuation" CTA band
 * for the /sell page.
 *
 * Two-column split: copy on the left, trust bullets on the right.
 * Design-token colors only. No em-dashes, no semicolons, no banned words.
 * Server-renderable.
 */

import {
  Body,
  Container,
  CTAButton,
  Eyebrow,
  H2,
  Section,
  Stack,
  TextLink,
} from '@/components/site/primitives'
import { CONTACT } from '@/lib/brand/contact'

type Props = {
  /** The valuation landing page URL. */
  valuationHref?: string
  /** Optional phone link (tel: href). */
  phoneHref?: string
}

const TRUST_LINES = [
  'Written CMA within 24 hours of your request',
  'Three closed comps, three active comps, and an honest price range',
  'The person you talk to is the person who lists your home',
  'No high pressure. No follow-up beyond two emails if you pass.',
]

export function SellValuationCTA({
  valuationHref = '/lp/seller-home-value',
  phoneHref = `tel:${CONTACT.phoneDirectTel}`,
}: Props) {
  return (
    <Section padding="loose" tone="muted" divider>
      <Container>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16 lg:items-center">
          <Stack gap="loose">
            <Stack gap="tight">
              <Eyebrow>Start with the CMA</Eyebrow>
              <H2>Tell us your address. We will do the rest.</H2>
            </Stack>
            <Body size="large" tone="muted" className="leading-[1.55] max-w-[44ch]">
              A written valuation within 24 hours. If after reading it you want a 20-minute call, you book one. If you do not reply, we do not follow up beyond two emails.
            </Body>
            <Body size="default" tone="muted" className="leading-[1.65] max-w-[44ch]">
              We are not a national lead-gen funnel. We do not sell your contact info. The person you meet here is the person who lists your home.
            </Body>
            <div className="flex flex-wrap gap-3">
              <CTAButton href={valuationHref} tone="primary" size="lg">
                Get my free valuation
              </CTAButton>
              <CTAButton href={phoneHref} tone="outline" size="lg">
                Or call {CONTACT.phoneDirect}
              </CTAButton>
            </div>
          </Stack>

          <div className="flex flex-col gap-3">
            {TRUST_LINES.map((line) => (
              <div key={line} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold"
                >
                  &#10003;
                </span>
                <Body size="default" tone="muted" className="leading-[1.6]">
                  {line}
                </Body>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  )
}
