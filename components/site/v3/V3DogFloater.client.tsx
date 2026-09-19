'use client'
/**
 * V3DogFloater — SITE-134 sitewide circle CTA (Matt lock 2026-09-19).
 *
 * A navy circle, bottom-right, with the logo dog head. Click opens a big
 * cream menu with exactly five doors. Replaces sticky Call / Text /
 * Work-with-us thinking. Header Work with us stays. Hidden on the same
 * routes the public chrome hides on (LP, admin, sign, account).
 *
 * Doors are real routes. Text uses CONTACT.phoneDirectTel. No invented
 * phone numbers. Animation is CSS (bob / tilt / blink); reduced-motion
 * gets a still dog.
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

  return (
    <div className={V3_ROOT_CLASS} data-v3-dog-floater="true">
      <Dialog open={open} onOpenChange={onOpenChange}>
        <button
          type="button"
          className="v3-dog-floater"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? titleId : undefined}
          onClick={() => onOpenChange(true)}
        >
          <span className="sr-only">Open Ryan Realty menu</span>
          <span className="v3-dog-floater__head" aria-hidden="true">
            <img
              src="/brand/jax-white.png"
              alt=""
              width={72}
              height={68}
              className="v3-dog-floater__dog"
            />
            <span className="v3-dog-floater__lid" />
          </span>
        </button>
        <DialogContent
          showCloseButton={false}
          className={cn(
            V3_ROOT_CLASS,
            'v3-dog-floater-menu top-auto left-auto translate-x-0 translate-y-0 rounded-none',
          )}
          overlayClassName={cn(V3_ROOT_CLASS, 'v3-dog-floater-scrim')}
          aria-describedby={undefined}
        >
          <DialogTitle id={titleId} className="v3-dog-floater-menu__title">
            How can we help
          </DialogTitle>
          <DialogDescription className="v3-dog-floater-menu__line">
            Buy, sell, text, or get a take on your home.
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
