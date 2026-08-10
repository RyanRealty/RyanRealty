/**
 * SellValuationCTA — the mid-page "get your free valuation" CTA band
 * for the /sell page.
 *
 * E5 craft: dominant navy ask column + cream trust rail (not equal gray cards).
 * Primary href defaults to on-page #get-value (B3). Design-token colors only.
 * No em-dashes, no semicolons, no banned words. Server-renderable.
 */

import {
  Body,
  Container,
  CTAButton,
  Eyebrow,
  H2,
  Section,
  Stack,
} from '@/components/site/primitives'
import { CONTACT } from '@/lib/brand/contact'

type Props = {
  /**
   * Where the primary ask goes. On /sell this is the hero form (#get-value).
   * Dedicated valuation page uses /sell/valuation#valuation-form.
   */
  valuationHref?: string
  /** Optional phone link (tel: href). */
  phoneHref?: string
}

const TRUST_LINES = [
  'Written CMA within 24 hours of your request',
  'Three closed comps, three active comps, and the price range they support',
  'The person you talk to is the person who lists your home',
  'If you pass, two follow-up emails and then we stop',
]

export function SellValuationCTA({
  valuationHref = '#get-value',
  phoneHref = `tel:${CONTACT.phoneDirectTel}`,
}: Props) {
  return (
    <Section padding="loose" tone="muted" divider id="valuation-cta">
      <Container>
        <div className="grid grid-cols-1 items-stretch gap-0 overflow-hidden rounded-xl border border-border lg:grid-cols-5">
          {/* Dominant navy ask column — one sharp accent block, not equal cards. */}
          <div className="flex flex-col justify-center gap-6 bg-primary p-8 text-primary-foreground sm:p-10 lg:col-span-3 lg:p-12">
            <Stack gap="tight">
              <Eyebrow className="text-primary-foreground/70">Start with the CMA</Eyebrow>
              <H2 className="text-primary-foreground">
                Send your address. We send a written valuation within 24 hours.
              </H2>
            </Stack>
            <Body size="large" tone="on-photo" className="max-w-md leading-snug">
              It costs nothing and requires no listing agreement. After you read it, you can book a 20-minute call. If you do not reply, we follow up twice by email and then stop.
            </Body>
            <div className="flex flex-wrap gap-3 pt-1">
              <CTAButton href={valuationHref} tone="on-navy" size="lg">
                Get the written valuation
              </CTAButton>
              <CTAButton href={phoneHref} tone="on-navy-ghost" size="lg">
                Or call {CONTACT.phoneDirect}
              </CTAButton>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-4 bg-muted p-8 sm:p-10 lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              What you get
            </p>
            {TRUST_LINES.map((line) => (
              <div key={line} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
                >
                  &#10003;
                </span>
                <Body size="default" tone="muted" className="leading-snug">
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
