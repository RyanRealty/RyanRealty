import {
  Body,
  Container,
  CTAButton,
  Eyebrow,
  H2,
  Section,
  Stack,
} from '@/components/site/primitives'
import { cn } from '@/lib/utils'

/**
 * Site v2 CTA bar — full-width call-to-action band placed at the bottom
 * of a page or between content sections. Eyebrow + title + optional
 * body + 1 to 2 buttons in a row. Per plan §9 Layer 3.
 *
 * Tones map to surface choice:
 *   default — light bg with divider
 *   muted   — cream stone surface
 *   navy    — navy bg, white text (the canonical "ready to talk" bar)
 *
 * Used by LP routes (after the lead form), market-report pages (after
 * the chart), and the homepage above the footer.
 *
 * Example:
 *   <CTABar
 *     eyebrow="Ready to talk"
 *     title="Have a question about a listing?"
 *     primary={{ href: '/contact', label: 'Schedule a call' }}
 *     secondary={{ href: 'tel:5412136706', label: '541.213.6706' }}
 *     tone="navy"
 *   />
 */

type Tone = 'default' | 'muted' | 'navy'

type Cta = { href: string; label: string }

type Props = {
  title: string
  body?: string
  eyebrow?: string
  primary?: Cta
  secondary?: Cta
  tone?: Tone
  className?: string
}

const sectionTone: Record<Tone, 'default' | 'muted' | 'navy'> = {
  default: 'default',
  muted: 'muted',
  navy: 'navy',
}

export function CTABar({
  title,
  body,
  eyebrow,
  primary,
  secondary,
  tone = 'navy',
  className,
}: Props) {
  const onNavy = tone === 'navy'

  return (
    <Section padding="default" tone={sectionTone[tone]} divider={!onNavy} className={className}>
      <Container>
        <div
          className={cn(
            'flex flex-col gap-6 items-start',
            'md:flex-row md:items-center md:justify-between md:gap-10',
          )}
        >
          <Stack gap="tight" className="max-w-[60ch]">
            {eyebrow ? (
              <Eyebrow className={onNavy ? 'text-white/72' : undefined}>{eyebrow}</Eyebrow>
            ) : null}
            <H2 className={onNavy ? 'text-white' : undefined}>{title}</H2>
            {body ? (
              <Body size="default" tone={onNavy ? 'on-photo' : 'muted'} className={onNavy ? 'text-white/85' : undefined}>
                {body}
              </Body>
            ) : null}
          </Stack>
          {primary || secondary ? (
            <div className="flex gap-2.5 flex-wrap shrink-0">
              {primary ? (
                <CTAButton href={primary.href} tone={onNavy ? 'on-navy' : 'primary'} size="md">
                  {primary.label}
                </CTAButton>
              ) : null}
              {secondary ? (
                <CTAButton
                  href={secondary.href}
                  tone={onNavy ? 'on-navy-ghost' : 'outline'}
                  size="md"
                >
                  {secondary.label}
                </CTAButton>
              ) : null}
            </div>
          ) : null}
        </div>
      </Container>
    </Section>
  )
}
