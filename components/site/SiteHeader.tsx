import Link from 'next/link'
import { CTAButton, RyanRealtyMark } from '@/components/site/primitives'
import MobileNav from '@/components/site/MobileNav'
import MegaMenu from '@/components/site/nav/MegaMenu'
import { MENU } from '@/lib/site-menu'

/**
 * SiteHeader — sticky navy bar with a CLEAN EDITORIAL mega-menu (approved
 * direction "menu-B"). Each parent opens a single full-width panel: intent-
 * grouped text-link columns on the left, one editorial photo with a caption and
 * CTA on the right. No stats, tiles, sparklines, counts, or verdict pills.
 *
 * SERVER component: it renders the static, serializable MENU (lib/site-menu.ts)
 * into <MegaMenu> on desktop and <MobileNav> on mobile. No data fetching, no
 * per-request fan-out. The interaction (hover-intent + click + keyboard) lives
 * in the MegaMenu client component so the cursor can travel from a trigger to a
 * link without the panel dropping — the failure mode of the old CSS-hover bento.
 *
 * Nav structure source of truth stays lib/site-nav.ts (PRIMARY_NAV drives the
 * reachability gate); MENU is the editorial display layer over the same routes.
 */

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-primary text-white">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Ryan Realty home" className="shrink-0">
          <RyanRealtyMark variant="horizontal" tone="white" width={140} priority className="h-8 w-auto" />
        </Link>

        <MegaMenu menu={MENU} />

        <div className="flex items-center gap-2.5">
          <CTAButton href="/login" tone="on-navy-ghost" size="md" className="hidden sm:inline-flex">
            Sign in
          </CTAButton>
          {/* Buyer counterpart to "List your home" — drives the listing-alerts
              LP so buyers have a one-click capture path, not just sellers. Ghost
              (secondary to the solid seller CTA); lg+ only so the header never
              crowds — smaller screens reach it via the Homes menu + mobile nav. */}
          <CTAButton href="/lp/buyer-listing-alerts" tone="on-navy-ghost" size="md" className="hidden lg:inline-flex">
            Get listing alerts
          </CTAButton>
          <CTAButton href="/lp/seller-home-value" tone="on-navy" size="md" className="hidden sm:inline-flex">
            List your home
          </CTAButton>
          <MobileNav menu={MENU} />
        </div>
      </div>
    </header>
  )
}
