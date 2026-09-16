'use client'
/**
 * V3PhoneDock — THE bottom bar on a phone. (SITE-122, Matt 2026-09-16.)
 *
 * "We also keep losing the bottom bar for the call text. I want an optimized
 * CTA that says work with us and has buy a home / sell your home options.
 * Right now there is no easy way for people to learn about us in mobile."
 *
 * WHAT WAS LOST. The site had three bottom-fixed bars and no page carried the
 * same one: the listing page's Tour / Call / Text (which drops Call and Text
 * on every sold, expired, canceled or withdrawn home — most listing pages),
 * the place pages' "Value my home" plate (which the alerts strip sat on top
 * of), and nothing at all everywhere else. On a phone the header is
 * logo · search · Sign in · menu, so Buy, Sell, About and the brokers were
 * behind the hamburger.
 *
 * WHAT THIS IS. One bar, one geometry, every public page below 64rem:
 *
 *   site pages   [Call] [Text] [Work with us]
 *   listing page [Tour] [Call] [Text] [Work with us]          (active)
 *                [Homes for sale] [Call] [Text] [Work with us] (off market)
 *
 * The shell, the contact pair and the ask are three exports so the listing
 * page (components/site/listing-detail/ListingMobileContactBar.client.tsx)
 * composes them around its own lead control and keeps the catalog
 * ButtonGroup import the taste receipt names. The site composition is
 * `V3PhoneDock`, mounted once in app/layout.tsx beside V3Chrome; it hides
 * itself on the routes the chrome hides on, and by CSS whenever a page mounts
 * its own dock, so no page ever has two.
 *
 * WHOSE PHONE. Call and Text on a site page, and on a sold home, are the
 * BROKERAGE line (lib/brand/contact CONTACT), labelled as the brokerage —
 * never a listing agent "about this home", which is the SITE-21 point and
 * the reason the off-market gate still guards the broker-line reads in the
 * listing file. An active listing passes its attributed broker's line and
 * first name, and the labels say who answers.
 *
 * WORK WITH US is the catalog shadcn Drawer (vaul), a bottom sheet a thumb
 * can drag closed, restyled navy on cream at the house radius: a navy head
 * with one true line about the brokerage, the two doors — Buy a home, Sell
 * your home — then the four ways to learn about us, then the phone. The
 * recruiting door that used to say "Work with us" now says Join Ryan Realty,
 * so the phrase means one thing on this site.
 *
 * THE ONE-FILLED-CONTROL RULE (PUBLIC_UI §1) HOLDS. Every control in the bar
 * is the outline variant, the same as the listing bar has always been, so the
 * page's own primary stays the one filled control in the viewport. Inside the
 * drawer nothing is filled either; the navy head is a surface, not a control.
 *
 * THE BOTTOM EDGE IS CLAIMED. While mounted the shell publishes its measured
 * height on the document root as --rr-dock-h; the alerts strip docks above it
 * (`bottom: var(--rr-dock-h, 0px)`), and V3StickyAsk retires on a phone while
 * a dock is present (its desktop plate is unchanged).
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/tracking'
import { shouldHidePublicChrome } from '@/lib/site/public-chrome-hide'
import { BRAND, BROKERS, CONTACT } from '@/lib/brand/contact'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3PhoneDock.css'

/** Where the bar is: the site's own composition, or a page that brought its own lead control. */
export type V3PhoneDockVariant = 'site' | 'page'

export type V3PhoneDockShellProps = {
  variant: V3PhoneDockVariant
  /** GA4 surface name. */
  surface: string
  children: ReactNode
  className?: string
}

/**
 * The fixed frame. Publishes --rr-dock-h while mounted; the site variant also
 * hides itself on the routes the chrome hides on (LP, admin, sign, account).
 */
export function V3PhoneDockShell({ variant, surface, children, className }: V3PhoneDockShellProps) {
  const pathname = usePathname()
  const frame = useRef<HTMLDivElement | null>(null)
  const hidden = variant === 'site' && shouldHidePublicChrome(pathname)

  /**
   * Publish the occupied height for whatever docks above it. Measured, not
   * assumed: the safe-area inset is real only on the device.
   *
   * ONE OWNER, BECAUSE BOTH DOCKS ARE IN THE DOM. A listing page renders its
   * own bar AND the layout's; the CSS hides the layout's, but both components
   * still run this effect, and the hidden one measures 0. Without an owner the
   * hidden bar would clear the height the visible bar just published, and the
   * alerts strip would drop back onto it. So a bar claims the property by
   * writing its variant beside it, and only the claimant may clear it — which
   * also releases it correctly when a real dock is hidden by a resize past
   * 64rem or unmounted by a route change.
   */
  useEffect(() => {
    if (hidden) return
    const root = document.documentElement
    const release = () => {
      if (root.dataset.rrDockOwner !== variant) return
      root.style.removeProperty('--rr-dock-h')
      delete root.dataset.rrDockOwner
    }
    const publish = () => {
      const el = frame.current
      if (!el) return
      const height = el.getBoundingClientRect().height
      if (height > 0) {
        root.style.setProperty('--rr-dock-h', `${Math.round(height)}px`)
        root.dataset.rrDockOwner = variant
      } else {
        release()
      }
    }
    publish()
    window.addEventListener('resize', publish)
    window.addEventListener('orientationchange', publish)
    return () => {
      window.removeEventListener('resize', publish)
      window.removeEventListener('orientationchange', publish)
      release()
    }
  }, [hidden, variant])

  if (hidden) return null

  return (
    <div
      ref={frame}
      className={cn(V3_ROOT_CLASS, 'v3-dock', className)}
      data-v3-dock={variant}
      data-surface={surface}
    >
      <div className="v3-dock__inner">{children}</div>
    </div>
  )
}

/** Digits only, for a tel:/sms: URI. Null when there is nothing to dial. */
function dialable(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/[^\d+]/g, '')
  return digits.length >= 10 ? digits : null
}

export type V3PhoneDockContactsProps = {
  /**
   * The line that answers. Omit for the brokerage line (CONTACT.phoneDirectTel).
   * An active listing passes its attributed broker's line.
   */
  phone?: string | null
  /** Who answers, for the labels: "Call Matt". Omit for "Call Ryan Realty". */
  name?: string | null
  surface: string
}

/**
 * Call and Text, side by side, on the brokerage line unless a page names the
 * person whose line it is. Both are plain anchors: tel: and sms: are the
 * phone's own affordances and need no JavaScript to work.
 */
export function V3PhoneDockContacts({ phone, name, surface }: V3PhoneDockContactsProps) {
  const line = dialable(phone) ?? CONTACT.phoneDirectTel
  const who = name?.trim() || 'Ryan Realty'
  const onCall = useCallback(() => {
    trackEvent('click_cta', { cta: 'phone_dock', action: 'call', surface }) // hydration-safe: click handler
  }, [surface])
  const onText = useCallback(() => {
    trackEvent('click_cta', { cta: 'phone_dock', action: 'text', surface }) // hydration-safe: click handler
  }, [surface])
  return (
    <>
      <Button variant="outline" size="lg" className="v3-dock__control" asChild>
        <a href={`tel:${line}`} aria-label={`Call ${who}`} onClick={onCall}>
          Call
        </a>
      </Button>
      <Button variant="outline" size="lg" className="v3-dock__control" asChild>
        <a href={`sms:${line}`} aria-label={`Text ${who}`} onClick={onText}>
          Text
        </a>
      </Button>
    </>
  )
}

export type V3WorkWithUsProps = {
  /** The line the drawer's own Call / Text use. Same default as the bar. */
  phone?: string | null
  name?: string | null
  surface: string
}

/** The four ways to learn about the brokerage, in the About menu's own order. */
const LEARN_LINKS = [
  { href: '/about', label: 'About Ryan Realty' },
  { href: '/team', label: 'Our team' },
  { href: '/reviews', label: 'Client reviews' },
  { href: '/contact', label: 'Contact us' },
] as const

const BROKER_COUNT = Object.keys(BROKERS).length
const COUNT_WORD: Record<number, string> = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five' }

/**
 * The ask and its sheet. The button sits in the bar as its last control; the
 * sheet is the catalog Drawer, direction bottom, which is the one bottom
 * sheet on this site.
 */
export function V3WorkWithUs({ phone, name, surface }: V3WorkWithUsProps) {
  const [open, setOpen] = useState(false)
  const line = dialable(phone) ?? CONTACT.phoneDirectTel
  const who = name?.trim() || 'Ryan Realty'
  const brokers = `${COUNT_WORD[BROKER_COUNT] ?? BROKER_COUNT} brokers`

  const onOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (next) trackEvent('click_cta', { cta: 'phone_dock', action: 'work_with_us', surface }) // hydration-safe: user gesture
    },
    [surface],
  )
  const door = useCallback(
    (action: string) => () => {
      trackEvent('click_cta', { cta: 'phone_dock_sheet', action, surface }) // hydration-safe: click handler
      setOpen(false)
    },
    [surface],
  )

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="lg" className="v3-dock__control v3-dock__ask" data-v3-dock-ask="true">
          Work with us
        </Button>
      </DrawerTrigger>
      <DrawerContent className={cn(V3_ROOT_CLASS, 'v3-dock-sheet')} aria-describedby={undefined}>
        <div className="v3-dock-sheet__head">
          <DrawerTitle className="v3-dock-sheet__title">Work with us</DrawerTitle>
          <DrawerDescription className="v3-dock-sheet__line">
            Ryan Realty is a Bend brokerage at {BRAND.address.street}. {brokers}, and the whole of
            Central Oregon.
          </DrawerDescription>
        </div>
        <nav className="v3-dock-sheet__doors" aria-label="Buy or sell with Ryan Realty">
          <Link href="/buy" className="v3-dock-sheet__door" onClick={door('buy')}>
            <span className="v3-dock-sheet__kicker">Buy</span>
            <span className="v3-dock-sheet__label">Buy a home</span>
            <span className="v3-dock-sheet__fact">Every home for sale in Central Oregon, by town, community or map.</span>
            <span className="v3-dock-sheet__arrow" aria-hidden="true">
              &#8594;
            </span>
          </Link>
          <Link href="/sell" className="v3-dock-sheet__door" onClick={door('sell')}>
            <span className="v3-dock-sheet__kicker">Sell</span>
            <span className="v3-dock-sheet__label">Sell your home</span>
            <span className="v3-dock-sheet__fact">Value my home: a written valuation from a principal broker.</span>
            <span className="v3-dock-sheet__arrow" aria-hidden="true">
              &#8594;
            </span>
          </Link>
        </nav>
        <nav className="v3-dock-sheet__learn" aria-label="About the brokerage">
          <ul className="v3-dock-sheet__list">
            {LEARN_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="v3-dock-sheet__link" onClick={door(link.href)}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="v3-dock-sheet__contact">
          <a href={`tel:${line}`} className="v3-dock-sheet__phone" onClick={door('call')}>
            Call {who === 'Ryan Realty' ? CONTACT.phoneDirect : who}
          </a>
          <a href={`sms:${line}`} className="v3-dock-sheet__phone" onClick={door('text')}>
            Text {who === 'Ryan Realty' ? 'us' : who}
          </a>
        </div>
        <DrawerClose asChild>
          <button type="button" className="v3-dock-sheet__close">
            Close
          </button>
        </DrawerClose>
      </DrawerContent>
    </Drawer>
  )
}

/**
 * The site's own bar: Call · Text · Work with us on the brokerage line.
 * Mounted once in app/layout.tsx. A page that mounts a `page` dock hides
 * this one by CSS (V3PhoneDock.css), so a route never carries two.
 */
export function V3PhoneDock() {
  return (
    <V3PhoneDockShell variant="site" surface="site">
      <ButtonGroup aria-label="Reach Ryan Realty" className="v3-dock__group">
        <V3PhoneDockContacts surface="site" />
        <V3WorkWithUs surface="site" />
      </ButtonGroup>
    </V3PhoneDockShell>
  )
}
