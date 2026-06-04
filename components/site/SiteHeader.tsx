import type { ReactNode } from 'react'
import Link from 'next/link'
import { CTAButton, RyanRealtyMark } from '@/components/site/primitives'
import MobileNav from '@/components/site/MobileNav'
import { PRIMARY_NAV } from '@/lib/site-nav'
import { getMegaMenuData } from '@/lib/data'
import type { MegaMenuData } from '@/lib/data'
import { MegaPanel } from '@/components/site/nav/MegaPanel'
import { HomesBento } from '@/components/site/nav/HomesBento'
import { CommunitiesBento } from '@/components/site/nav/CommunitiesBento'
import { CitiesBento } from '@/components/site/nav/CitiesBento'
import { MarketBento } from '@/components/site/nav/MarketBento'
import { SellBento } from '@/components/site/nav/SellBento'
import { CompanyBento } from '@/components/site/nav/CompanyBento'
import { LearnBento } from '@/components/site/nav/LearnBento'

/**
 * SiteHeader — sticky navy bar with a full-width INTELLIGENT bento mega-menu for
 * every parent nav item.
 *
 * SERVER component: it fetches getMegaMenuData() once (unstable_cache-wrapped, so
 * one Data Cache read site-wide, no per-request fan-out) and renders each of the
 * 7 PRIMARY_NAV parents as a MegaPanel (full-bleed CSS-hover panel) holding that
 * parent's data-grounded bento. Desktop interaction is pure CSS (group-hover /
 * group-focus-within) so there is no client JS and no hydration risk. The mobile
 * drawer (MobileNav, a client component) receives the same `mega` data as a plain
 * serializable prop.
 *
 * Nav structure comes from lib/site-nav.ts (single source of truth) so users AND
 * crawlers reach every section. Enforced by check-nav-reachability.
 */

function bentoFor(label: string, mega: MegaMenuData, children: { label: string; href: string }[]): ReactNode {
  switch (label) {
    case 'Homes':
      return <HomesBento data={mega.homes} />
    case 'Communities':
      return <CommunitiesBento data={mega.communities} />
    case 'Cities':
      return <CitiesBento data={mega.cities} />
    case 'Market':
      return <MarketBento data={mega.market} />
    case 'Sell':
      return <SellBento data={mega.sell} />
    case 'Learn':
      return <LearnBento data={mega.learn} />
    case 'Company':
      return <CompanyBento items={children} />
    default:
      return null
  }
}

export default async function SiteHeader() {
  const mega = await getMegaMenuData()

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-primary text-white">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Ryan Realty home" className="shrink-0">
          <RyanRealtyMark variant="horizontal" tone="white" width={140} priority className="h-8 w-auto" />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-0.5 md:flex">
          {PRIMARY_NAV.map((group) => {
            const bento = bentoFor(group.label, mega, group.children)
            // Any parent without a bento falls back to a plain link (keeps the
            // nav resilient if a new nav group is added without a panel).
            if (!bento) {
              return (
                <Link
                  key={group.label}
                  href={group.href ?? '#'}
                  className="rounded-lg px-3 py-2 text-[15px] font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
                >
                  {group.label}
                </Link>
              )
            }
            return (
              <MegaPanel
                key={group.label}
                label={group.label}
                href={group.href ?? '#'}
                panelId={`mega-${group.label.toLowerCase()}`}
              >
                {bento}
              </MegaPanel>
            )
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <CTAButton href="/login" tone="on-navy-ghost" size="md" className="hidden sm:inline-flex">
            Sign in
          </CTAButton>
          <CTAButton href="/lp/seller-home-value" tone="on-navy" size="md" className="hidden sm:inline-flex">
            List your home
          </CTAButton>
          <MobileNav mega={mega} />
        </div>
      </div>
    </header>
  )
}
