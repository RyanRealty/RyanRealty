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
import { NewsletterSignup } from '@/components/site/NewsletterSignup'
import { FOOTER_NAV, LEGAL_LINKS } from '@/lib/site-nav'
import { BRAND, CONTACT, BROKERS } from '@/lib/brand/contact'

/**
 * SiteFooter — comprehensive multi-column footer driven by FOOTER_NAV
 * from lib/site-nav.ts.
 *
 * Columns: brand + partners, Search, Communities, Cities, Market, Sell,
 * Company, Learn. Legal row beneath. The stale /sold link is replaced with
 * /homes-for-sale?status=Sold.
 *
 * License 201206613 + Equal Housing legal line preserved verbatim.
 * No em-dashes, no semicolons, no banned words, no hex colors.
 */

export default function SiteFooter() {
  return (
    <footer data-default-chrome className="bg-primary text-white/85">
      <Container className="pt-14 pb-8">
        {/* Newsletter signup band — above the nav grid */}
        <div className="mb-10 border-b border-white/15 pb-10">
          <NewsletterSignup source="site-footer" />
        </div>

        {/* Main grid: brand col + nav columns */}
        <div className="grid gap-10 grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1.4fr_repeat(4,1fr)_repeat(3,1fr)]">

          {/* Brand column — spans full width on mobile, 1 col on lg */}
          <Stack gap="loose" className="col-span-2 sm:col-span-3 lg:col-span-1">
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
              Central Oregon real estate with direct-broker accountability. Bend,
              Redmond, Sisters, Sunriver, and the surrounding communities.
            </Body>

            {/* MLS data-source attribution logos. On a light pill so the
                original brand marks stay legible on the navy footer (inverting
                them to solid white flattened them into unreadable blobs). */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-md bg-white/95 px-3 py-1.5 shadow-sm">
                <Image
                  src="/images/oregon-data-share-logo.svg"
                  alt="Oregon Data Share"
                  width={120}
                  height={28}
                  className="h-6 w-auto"
                />
              </span>
              <span className="inline-flex items-center rounded-md bg-white/95 px-3 py-1.5 shadow-sm">
                <Image
                  src="/images/morgan-data-shuttle-logo.svg"
                  alt="Morgan Data Shuttle"
                  width={120}
                  height={28}
                  className="h-6 w-auto"
                />
              </span>
            </div>

            {/* Contact */}
            <div className="text-[13px] text-white/72 tabular-nums space-y-1">
              <p className="flex items-center gap-1.5">
                <TextLink
                  href={`tel:${CONTACT.phoneDirectTel}`}
                  tone="on-navy"
                  weight="normal"
                  underline="never"
                >
                  {CONTACT.phoneDirect}
                </TextLink>
                <MiddleDot className="text-white/40" />
                <TextLink
                  href={BRAND.url}
                  tone="on-navy"
                  weight="normal"
                  underline="never"
                  external
                  className="whitespace-nowrap"
                >
                  {BRAND.domain}
                </TextLink>
              </p>
              <p>
                BEND <MiddleDot className="text-white/40" /> OREGON
              </p>
            </div>
          </Stack>

          {/* Nav columns — driven by FOOTER_NAV */}
          {FOOTER_NAV.map((col) => (
            <Stack key={col.heading} gap="default">
              <h4 className="text-[12px] font-semibold uppercase tracking-[0.09em] text-white">
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
                      className="text-sm leading-snug"
                    >
                      {link.label}
                    </TextLink>
                  </li>
                ))}
              </ul>
            </Stack>
          ))}
        </div>

        {/* Legal row */}
        <div className="mt-10 border-t border-white/15 pt-5">
          {/* Legal links row */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            {LEGAL_LINKS.map((link, i) => (
              <span key={link.href} className="flex items-center gap-4">
                {i > 0 && (
                  <MiddleDot className="mr-0 text-white/30" />
                )}
                <TextLink
                  href={link.href}
                  tone="on-navy"
                  weight="normal"
                  underline="never"
                  className="text-[12px] text-white/55 hover:text-white/85"
                >
                  {link.label}
                </TextLink>
              </span>
            ))}
          </div>

          <Caption tone="on-photo" className="text-white/50 leading-[1.6]">
            Listings data provided by Oregon Data Share and Morgan Data Shuttle.
            Information deemed reliable but not guaranteed. All listings courtesy of
            participating MLS members. &copy; {new Date().getFullYear()} {BRAND.legalName}{' '}
            <MiddleDot className="text-white/40" /> {BRAND.address.city}, {BRAND.address.regionFull}{' '}
            <MiddleDot className="text-white/40" /> Licensed in the State of Oregon{' '}
            <MiddleDot className="text-white/40" /> Principal Broker license{' '}
            <span className="tabular-nums">{BROKERS.matt.license}</span>. Equal Housing Opportunity.
          </Caption>
        </div>
      </Container>
    </footer>
  )
}
