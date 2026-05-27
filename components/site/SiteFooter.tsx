import Image from 'next/image'
import {
  Body,
  Caption,
  Container,
  MiddleDot,
  RyanRealtyMark,
  Stack,
  TextLink,
} from '@/components/site/primitives'

/**
 * Site v2 footer — navy bg, 4-column grid (brand+partners / Search / Market / Company),
 * legal line beneath. Mirrors design_system/ryan-realty/ui_kits/website/index.html §footer.
 *
 * Refactored 2026-05-27 onto the Wave 2 Layer 1 primitives:
 *   - RyanRealtyMark replaces raw <Image src="/logo-header-white.png" />
 *   - TextLink (tone="on-navy", weight="normal") replaces nav-link className soup
 *   - Container handles max-width + horizontal padding
 *   - Stack handles vertical rhythm within each column
 *   - Caption owns the legal copy line
 *   - MiddleDot for the place-separator pattern (BEND · OREGON)
 *
 * No em-dashes, no semicolons, no banned words. License # 201206613 + Equal Housing
 * Opportunity language preserved verbatim.
 */

type FooterColumn = {
  heading: string
  links: ReadonlyArray<{ href: string; label: string }>
}

const COLUMNS: ReadonlyArray<FooterColumn> = [
  {
    heading: 'Search',
    links: [
      { href: '/homes-for-sale', label: 'Homes for sale' },
      { href: '/open-houses', label: 'Open houses' },
      { href: '/communities', label: 'By community' },
      { href: '/search', label: 'Map search' },
    ],
  },
  {
    heading: 'Market',
    links: [
      { href: '/housing-market', label: 'Housing market hub' },
      { href: '/reports/explore', label: 'Monthly reports' },
      { href: '/sold', label: 'Sold data' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/team', label: 'Meet the team' },
      { href: '/sell', label: 'Sell your home' },
      { href: '/contact', label: 'Contact' },
      { href: '/about', label: 'About' },
    ],
  },
] as const

export default function SiteFooter() {
  return (
    <footer className="bg-primary text-white/85">
      <Container className="pt-14 pb-8">
        <div className="grid gap-10 grid-cols-1 md:grid-cols-[1.3fr_repeat(3,1fr)]">
          {/* Brand column */}
          <Stack gap="loose">
            <RyanRealtyMark
              variant="horizontal"
              tone="white"
              width={140}
              className="h-9 w-auto"
            />
            <Body
              size="small"
              tone="on-photo"
              className="max-w-[40ch] text-white/72"
            >
              Your local team for Central Oregon real estate. Bend, Redmond, Sisters,
              Sunriver, and surrounding communities.
            </Body>
            <div className="flex items-center gap-4 opacity-75">
              <Image
                src="/images/oregon-data-share-logo.svg"
                alt="Oregon Data Share"
                width={120}
                height={28}
                className="h-7 w-auto brightness-0 invert"
              />
              <Image
                src="/images/morgan-data-shuttle-logo.svg"
                alt="Morgan Data Shuttle"
                width={120}
                height={28}
                className="h-7 w-auto brightness-0 invert"
              />
            </div>
            <div className="text-[13px] text-white/72 tabular-nums space-y-1">
              <p className="flex items-center gap-1.5">
                <TextLink
                  href="tel:5412136706"
                  tone="on-navy"
                  weight="normal"
                  underline="never"
                >
                  541.213.6706
                </TextLink>
                <MiddleDot className="text-white/40" />
                <TextLink
                  href="https://ryan-realty.com"
                  tone="on-navy"
                  weight="normal"
                  underline="never"
                  external
                >
                  ryan-realty.com
                </TextLink>
              </p>
              <p>
                BEND <MiddleDot className="text-white/40" /> OREGON
              </p>
            </div>
          </Stack>

          {/* Nav columns */}
          {COLUMNS.map((col) => (
            <Stack key={col.heading} gap="default">
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white">
                {col.heading}
              </h4>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <TextLink
                      href={link.href}
                      tone="on-navy"
                      weight="normal"
                      underline="never"
                      className="text-sm"
                    >
                      {link.label}
                    </TextLink>
                  </li>
                ))}
              </ul>
            </Stack>
          ))}
        </div>

        <div className="mt-10 pt-5 border-t border-white/15">
          <Caption tone="on-photo" className="text-white/55 leading-[1.6]">
            Listings data provided by Oregon Data Share and Morgan Data Shuttle.
            Information deemed reliable but not guaranteed. All listings courtesy of
            participating MLS members. © {new Date().getFullYear()} Ryan Realty LLC{' '}
            <MiddleDot className="text-white/40" /> Bend, Oregon{' '}
            <MiddleDot className="text-white/40" /> Licensed in the State of Oregon{' '}
            <MiddleDot className="text-white/40" /> Principal Broker license{' '}
            <span className="tabular-nums">201206613</span>. Equal Housing Opportunity.
          </Caption>
        </div>
      </Container>
    </footer>
  )
}
