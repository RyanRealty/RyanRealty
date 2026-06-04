import { Container, DisplayHeading, Body, Section } from '@/components/site/primitives'
import { CTAButton } from '@/components/site/primitives'
import { GOLF_LANDING_PHONE } from '@/data/golf-landing'

/**
 * GolfCtaBand — closing navy CTA band.
 *
 * Honest, direct offer to connect: phone number + a link to the full
 * golf results. No fake urgency, no hype. Brand voice sentence case.
 *
 * Design-system rules:
 *   - tone="navy" Section (bg-primary text-white)
 *   - CTAButton tone="on-navy" for the primary action
 *   - CTAButton tone="on-navy-ghost" for the secondary phone link
 *   - No hex, no gold, no arbitrary brackets
 */

type Props = {
  allHomesHref: string
  totalHomes: number
}

export function GolfCtaBand({ allHomesHref, totalHomes }: Props) {
  return (
    <Section tone="navy" padding="loose">
      <Container>
        <div className="flex flex-col items-center text-center gap-6 max-w-2xl mx-auto">
          <DisplayHeading
            as="h2"
            className="text-white text-4xl sm:text-5xl"
          >
            Ready to tour a golf community?
          </DisplayHeading>

          <Body size="large" className="text-white/80 max-w-prose">
            {totalHomes > 0
              ? `There are ${totalHomes} active golf-course homes across Central Oregon right now. We know these communities and their courses well.`
              : 'Golf-course inventory moves fast in Central Oregon. We know these communities and their courses well.'}
          </Body>

          <div className="flex flex-wrap gap-3 justify-center">
            <CTAButton tone="on-navy" size="lg" href={allHomesHref}>
              Browse golf homes
            </CTAButton>
            <CTAButton
              tone="on-navy-ghost"
              size="lg"
              href={`tel:+1${GOLF_LANDING_PHONE.replace(/\./g, '')}`}
            >
              Call {GOLF_LANDING_PHONE}
            </CTAButton>
          </div>
        </div>
      </Container>
    </Section>
  )
}
