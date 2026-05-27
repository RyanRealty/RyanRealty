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
 * Lifted onto Wave 2 Layer 1 primitives 2026-05-27. Copy edited at the
 * same time to clear the new brand-voice ESLint gate (em-dash replaced
 * with a period, "thinking about" replaced with "Considering").
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
            title="Never miss a new listing"
            body="Save a search and get instant alerts when matching homes hit the market. Set your criteria once and we handle the rest."
            primary={{ href: '/lp/buyer-listing-alerts', label: 'Set up alerts' }}
            secondary={{ href: '/homes-for-sale', label: 'Browse listings' }}
          />
          <CtaCard
            icon={<PinIcon />}
            title="Considering a sale?"
            body="Get a free home valuation from a broker who knows your neighborhood. Local insight, not a national algorithm."
            primary={{ href: '/lp/seller-home-value', label: 'Get a valuation' }}
            secondary={{ href: '/team', label: 'Meet the team' }}
          />
        </Grid>
      </Container>
    </Section>
  )
}
