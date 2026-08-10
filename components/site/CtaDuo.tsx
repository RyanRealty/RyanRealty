import {
  Body,
  Container,
  CTAButton,
  Grid,
  H3,
  Section,
  Stack,
} from '@/components/site/primitives'

/**
 * Site v2 CTA duo — two conversion cards (buyer listing alerts + seller
 * home value) on a muted surface. Mirrors design_system/ryan-realty/ui_kits/
 * website/index.html §cta-duo.
 *
 * Lifted onto Wave 2 Layer 1 primitives 2026-05-27. Buffett voice pass
 * 2026-08-10: plain one-person CTAs, no urgency, no throat-clear.
 */

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-11 h-11 rounded-[10px] bg-primary text-white flex items-center justify-center">
      {children}
    </div>
  )
}

function CtaCard({
  icon,
  title,
  body,
  primary,
  secondary,
}: {
  icon: React.ReactNode
  title: string
  body: string
  primary: { href: string; label: string }
  secondary: { href: string; label: string }
}) {
  return (
    <div className="bg-card border border-border rounded-[14px] p-7 shadow-sm">
      <Stack gap="tight">
        <IconBadge>{icon}</IconBadge>
        <H3>{title}</H3>
        <Body size="small" tone="muted" className="leading-[1.55] max-w-[60ch]">
          {body}
        </Body>
        <div className="flex gap-2.5 flex-wrap pt-1">
          <CTAButton href={primary.href} tone="primary" size="md">
            {primary.label}
          </CTAButton>
          <CTAButton href={secondary.href} tone="outline" size="md">
            {secondary.label}
          </CTAButton>
        </div>
      </Stack>
    </div>
  )
}

export default function CtaDuo() {
  return (
    <Section padding="default" tone="muted" divider>
      <Container>
        <Grid cols={2} gap="default">
          <CtaCard
            icon={<BellIcon />}
            title="New listings, same day"
            body="Tell us the towns, beds, and budget. We email you when a matching home lists."
            primary={{ href: '/lp/buyer-listing-alerts', label: 'Set up alerts' }}
            secondary={{ href: '/homes-for-sale', label: 'See homes for sale' }}
          />
          <CtaCard
            icon={<PinIcon />}
            title="What would your home sell for?"
            body="A broker pulls closed and active comps near your address and writes the range. Free, with no listing agreement."
            primary={{ href: '/lp/seller-home-value', label: 'Value my home' }}
            secondary={{ href: '/team', label: 'Meet the brokers' }}
          />
        </Grid>
      </Container>
    </Section>
  )
}
