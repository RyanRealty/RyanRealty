'use client'
/**
 * V3WorkWithUs sheet — header Work with us (Matt / Critiquito 2026-09-19).
 *
 * SITE-122 built a phone bottom bar (Call · Text · Work with us). The CTA
 * lock drops that sticky and the listing Tour|Call|Text|Work with us bar.
 * Work with us lives in V3Chrome at every width. Listing Tour is the one
 * ask beside the price. Call / Text live inside this sheet and the agent
 * card — not equal sticky verbs.
 *
 * WHOSE PHONE. Call and Text in this sheet default to the BROKERAGE line
 * (lib/brand/contact CONTACT). The listing agent card (TextMattCTA) is the
 * other Call / Text home; SITE-21 still guards those tel:/sms: URIs.
 *
 * WORK WITH US is the catalog shadcn Drawer (vaul), a bottom sheet a thumb
 * can drag closed, restyled navy on cream at the house radius. The chip stays
 * "Work with us"; the sheet is the door — title Buy or sell, one short true
 * line, then Buy a home / Sell your home (teases, not page headlines), then
 * About / team / reviews / contact, then the street and the phone. Never a
 * broker count. The recruiting door that used to say "Work with us" now says
 * Join Ryan Realty, so the phrase means one thing on this site.
 *
 * THE ONE-FILLED-CONTROL RULE (PUBLIC_UI §1) HOLDS. The header trigger is
 * outline, so the page's own primary stays the one filled control. Inside
 * the drawer nothing is filled either; the navy head is a surface, not a
 * control.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/tracking'
import { shouldHidePublicChrome } from '@/lib/site/public-chrome-hide'
import { BRAND, CONTACT } from '@/lib/brand/contact'
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

export type V3WorkWithUsPlacement = 'chrome' | 'inline' | 'dock'

export type V3WorkWithUsProps = {
  /** The line the drawer's own Call / Text use. Same default as the bar. */
  phone?: string | null
  name?: string | null
  surface: string
  /**
   * Matt / Critiquito 2026-09-19 CTA lock: chrome is the sitewide header
   * trigger; inline is the listing agent card; dock is the retired sticky bar.
   */
  placement?: V3WorkWithUsPlacement
  className?: string
}

/** The four ways to learn about the brokerage, in the About menu's own order. */
const LEARN_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/team', label: 'Our team' },
  { href: '/reviews', label: 'Client reviews' },
  { href: '/contact', label: 'Contact' },
] as const

/**
 * The ask and its sheet. Copy stays the SITE-122 sheet (Buy or sell, two
 * doors, About / team / reviews / contact, Call / Text). The trigger
 * placement moved: chrome sitewide, listing agent card for Call / Text,
 * not a bottom sticky bar (Matt / Critiquito 2026-09-19).
 */
export function V3WorkWithUs({
  phone,
  name,
  surface,
  placement = 'dock',
  className,
}: V3WorkWithUsProps) {
  const [open, setOpen] = useState(false)
  const line = dialable(phone) ?? CONTACT.phoneDirectTel
  const who = name?.trim() || 'Ryan Realty'

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
        <Button
          variant="outline"
          size="lg"
          className={cn(
            placement === 'chrome' && 'v3-chrome__work',
            placement === 'inline' && 'rounded-none first:rounded-l-lg last:rounded-r-lg',
            placement === 'dock' && 'v3-dock__control v3-dock__ask',
            className,
          )}
          data-v3-dock-ask="true"
        >
          Work with us
        </Button>
      </DrawerTrigger>
      <DrawerContent className={cn(V3_ROOT_CLASS, 'v3-dock-sheet')} aria-describedby={undefined}>
        <div className="v3-dock-sheet__head">
          <DrawerTitle className="v3-dock-sheet__title">Buy or sell</DrawerTitle>
          <DrawerDescription className="v3-dock-sheet__line">
            Boutique Central Oregon buy-and-sell firm.
          </DrawerDescription>
        </div>
        <nav className="v3-dock-sheet__doors" aria-label="Buy or sell with Ryan Realty">
          <Link href="/buy" className="v3-dock-sheet__door" onClick={door('buy')}>
            <span className="v3-dock-sheet__kicker">Buy</span>
            <span className="v3-dock-sheet__label">Buy a home</span>
            <span className="v3-dock-sheet__fact">See homes on the map.</span>
            <span className="v3-dock-sheet__arrow" aria-hidden="true">
              &#8594;
            </span>
          </Link>
          <Link href="/sell" className="v3-dock-sheet__door" onClick={door('sell')}>
            <span className="v3-dock-sheet__kicker">Sell</span>
            <span className="v3-dock-sheet__label">Sell your home</span>
            <span className="v3-dock-sheet__fact">Get a pricing take on your home.</span>
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
          <p className="v3-dock-sheet__addr">{BRAND.address.street}</p>
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
 * Retired sticky site bar. Kept so the sheet file stays one unit; not
 * mounted (Matt / Critiquito 2026-09-19).
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
