'use client'
/**
 * V3DogFloater — SITE-134 sitewide circle CTA (Matt lock 2026-09-19).
 *
 * A circle, bottom-right, with the INNER dog-head disc (not the RYAN
 * REALTY seal). Click opens a cream sheet with exactly five doors.
 * Critiquito 2026-09-19: light → navy-disc head; dark → cream head on
 * navy. Idle is one quiet tilt (≤4s + pause). Menu is 150–220ms rise
 * and fade, no bounce, no pun copy. Replaces sticky Call / Text /
 * Work-with-us bars. Header Work with us stays.
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3DogFloater.css'

export const DOG_FLOATER_MENUS = [
  { href: '/sell', label: 'Sell your home', kind: 'route' },
  { href: '/buy', label: 'Buy your home', kind: 'route' },
  { href: `sms:${CONTACT.phoneDirectTel}`, label: 'Text us', kind: 'sms' },
  { href: '/sell#get-value', label: "Get your home's value", kind: 'route' },
  { href: '/about', label: 'Learn about us', kind: 'route' },
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

  const onDark =
    pathname.startsWith('/homes-for-sale') || pathname.startsWith('/listing')
  const headSrc = onDark ? '/brand/jax-head-cream.png' : '/brand/jax-head-navy.png'

  return (
    <div className={V3_ROOT_CLASS} data-v3-dog-floater="true">
      <Dialog open={open} onOpenChange={onOpenChange}>
        <button
          type="button"
          className={cn('v3-dog-floater', onDark && 'v3-dog-floater--on-dark')}
          data-v3-dog-head="inner"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? titleId : undefined}
          onClick={() => onOpenChange(true)}
        >
          <span className="sr-only">Open Ryan Realty menu</span>
          <span className="v3-dog-floater__head" aria-hidden="true">
            <img
              src={headSrc}
              alt=""
              width={68}
              height={68}
              className="v3-dog-floater__dog"
            />
          </span>
        </button>
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
            Ryan Realty
          </DialogTitle>
          <DialogDescription className="sr-only">
            Sell your home, buy your home, text us, get your home&apos;s value, or learn about us.
          </DialogDescription>
          <nav className="v3-dog-floater-menu__doors" aria-label="Ryan Realty">
            {DOG_FLOATER_MENUS.map((item) =>
              item.kind === 'sms' ? (
                <a
                  key={item.href}
                  href={item.href}
                  className="v3-dog-floater-menu__door"
                  onClick={door('text')}
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
          <DialogClose asChild>
            <button type="button" className="v3-dog-floater-menu__close">
              Close
            </button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  )
}
