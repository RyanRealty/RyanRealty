'use client'
/**
 * V3DogFloater — SITE-134 / SITE-135 / SITE-146 / SITE-153 sitewide circle CTA
 * (Matt lock 2026-09-21, superseding the 2026-09-19/20 five-door lock).
 *
 * PLACEMENT (SITE-153, researched — Matt: "kind of out of sight... do some
 * research on where it should be, but not right there"). NN/g's chat-widget
 * eyetracking work and the Intercom/Drift default both land on the same
 * answer: a persistent contact affordance belongs bottom-right — moving it to
 * an unconventional corner (top, left) measurably HURTS discovery ("people
 * commonly ignore floating buttons... placed in positions other than the
 * standard one"; left-side placement "took users by surprise"). So this stays
 * corner-anchored. What NN/g also names as the failure mode is exactly what a
 * live screenshot of this site showed pre-SITE-153: a small, low-contrast
 * button that "blends in with the rest of the page" gets ignored (their HSBC
 * example). Here that was literal — the circle was cream-on-cream (a 1px navy
 * hairline the only edge) sitting on this site's cream page background, tucked
 * into the exact pixel corner where the cookie chip and the last content row
 * also compete. Two fixes, not a relocation off the proven corner: (1) the
 * circle is now solid navy / cream head everywhere — no more light-page vs
 * listing-page color branch, one consistent brand mark per NN/g's
 * "consistency" principle, readable against any page; (2) it now rests a full
 * --v3-space-3xl off the bottom edge instead of --v3-space-md, clearing the
 * mobile browser chrome / home-indicator band and the last content row it was
 * colliding with on desktop listing pages. "Up" per Matt's own words, not
 * "elsewhere."
 *
 * MOTION (SITE-153 — Matt: "flip, spin, invert, do stuff"). Two independent
 * layers so they compose instead of clobbering one transform: an inner
 * __head does the SITE-135/146 quiet 3-6deg tilt (continuous, ~3s, the "it's
 * alive" register), and an outer __stage plays a rotateY flip-spin flourish
 * once every ~10s — brief (~1s), so it reads as a deliberate flip-and-invert
 * (the image genuinely mirrors through 180deg), not a spinning toy. That
 * split follows the NN/g "Animation and Motion in UX" + CXL guidance this
 * node researched: bold/attention motion should be short and infrequent
 * ("anticipation... notification icon that wiggles gently"), continuous
 * motion should stay subtle. `prefers-reduced-motion: reduce` stills BOTH
 * layers — non-negotiable, Matt's ask does not override it.
 *
 * MENU (SITE-153 permanent lock 2026-09-21): exactly six doors, this order,
 * these strings. No "Close" text link — DialogTrigger already toggles (a
 * second tap on the dog closes), and DialogContent's Escape / outside-click
 * stay wired through unmodified, so the sheet is still fully dismissable
 * without a visible close affordance. The sr-only trigger label flips
 * between Open/Close so assistive tech has the same toggle cue a sighted
 * visitor gets from tapping the dog again.
 *
 * `modal={false}` on Dialog is load-bearing, verified in a real browser
 * (SITE-153): Radix's DEFAULT modal Dialog sets `body { pointer-events:
 * none }` and `aria-hidden="true"` on every sibling of the portal — including
 * this trigger, since the FAB lives outside DialogContent's own subtree. A
 * modal Dialog therefore makes the second tap literally unclickable and
 * hides the trigger from assistive tech while open, silently defeating the
 * toggle this node was asked to build. `modal={false}` drops that body-wide
 * lockout while Escape / outside-click keep working (Radix's
 * DismissableLayer handles both regardless of `modal`).
 *
 * Head assets are unchanged from SITE-146: the INNER dog-head crop from the
 * full seals at public/brand/jax-navy.png and public/brand/jax-white.png
 * (full-seal crop, 4-8% pad) — this node does not re-crop or swap them.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useId, useState } from 'react'
import { cn } from '@/lib/utils'
import { CONTACT } from '@/lib/brand/contact'
import { shouldHidePublicChrome } from '@/lib/site/public-chrome-hide'
import { trackEvent } from '@/lib/tracking'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3DogFloater.css'

/** Matt permanent lock 2026-09-21: these six strings, this order. Do not shorten. */
export const DOG_FLOATER_MENUS = [
  { href: '/sell', label: 'List your home', kind: 'route' },
  { href: '/reviews', label: 'Read our reviews', kind: 'route' },
  { href: `tel:${CONTACT.phoneDirectTel}`, label: 'Give us a call', kind: 'tel' },
  { href: '/contact', label: 'Send us a message', kind: 'route' },
  { href: '/sell#get-value', label: "Get your home's value", kind: 'route' },
  { href: '/about', label: 'Learn more about us', kind: 'route' },
] as const

export function V3DogFloater() {
  const pathname = usePathname()
  const hidden = shouldHidePublicChrome(pathname)
  const [open, setOpen] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (hidden) setOpen(false)
  }, [hidden])

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next)
    if (next) trackEvent('click_cta', { cta: 'dog_floater', action: 'open', surface: 'site' })
  }, [])

  const door = useCallback(
    (action: string) => () => {
      trackEvent('click_cta', { cta: 'dog_floater_menu', action, surface: 'site' })
      setOpen(false)
    },
    [],
  )

  if (hidden) return null

  const onListing =
    pathname.startsWith('/homes-for-sale') || pathname.startsWith('/listing')
  /** Solid navy / cream head everywhere (SITE-153) — one brand mark, not a
   *  light-page/listing-page color branch. See the placement note above. */
  const headSrc = '/brand/jax-head-cream.png'

  return (
    <div className={V3_ROOT_CLASS} data-v3-dog-floater="true">
      <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              'v3-dog-floater',
              onListing && 'v3-dog-floater--listing',
              open && 'v3-dog-floater--open',
            )}
            data-v3-dog-head="inner"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? titleId : undefined}
          >
            <span className="sr-only">{open ? 'Close' : 'Open'} Ryan Realty menu</span>
            <span className="v3-dog-floater__stage" data-v3-dog-idle="flourish" aria-hidden="true">
              <span className="v3-dog-floater__head" data-v3-dog-idle="tilt">
                <img
                  src={headSrc}
                  alt=""
                  width={68}
                  height={68}
                  className="v3-dog-floater__dog"
                />
              </span>
            </span>
          </button>
        </DialogTrigger>
        <DialogContent
          showCloseButton={false}
          className={cn(
            V3_ROOT_CLASS,
            'v3-dog-floater-menu top-auto left-auto translate-x-0 translate-y-0 rounded-none data-open:zoom-in-100 data-closed:zoom-out-100',
          )}
          overlayClassName={cn(V3_ROOT_CLASS, 'v3-dog-floater-scrim')}
          aria-describedby={undefined}
        >
          <DialogTitle id={titleId} className="sr-only">
            Help
          </DialogTitle>
          <DialogDescription className="sr-only">
            List your home, read our reviews, give us a call, send us a message, get your
            home&apos;s value, or learn more about us.
          </DialogDescription>
          <nav className="v3-dog-floater-menu__doors" aria-label="Help">
            {DOG_FLOATER_MENUS.map((item) =>
              item.kind === 'tel' ? (
                <a
                  key={item.href}
                  href={item.href}
                  className="v3-dog-floater-menu__door"
                  onClick={door('call')}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="v3-dog-floater-menu__door"
                  onClick={door(item.href)}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
        </DialogContent>
      </Dialog>
    </div>
  )
}
