'use client'
/**
 * V3DogFloater — SITE-153 (placement + six doors; crop lock SITE-146).
 *
 * Mid-end circle (vertical center, trailing edge). Material FAB is
 * bottom-end, 16dp from the edge, and must not cover a snackbar / banner;
 * a cookie chip+bar owns that corner here, and cream-on-cream hid the dog.
 * Mid-trailing-edge is the researched alternative when the bottom-end is
 * occupied (help / a11y launchers). Navy disc, cream head — not a cream
 * disc on cream chrome.
 *
 * Click the dog to open, click the dog again to close. No Close link.
 * Esc and the scrim still dismiss. Six doors, this order. Brief
 * flip / spin / invert on the head (not a continuous idle). Inner head
 * from the full seals. `prefers-reduced-motion: reduce` stills it.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { CONTACT } from '@/lib/brand/contact'
import { shouldHidePublicChrome } from '@/lib/site/public-chrome-hide'
import { trackEvent } from '@/lib/tracking'
import { aimAtPointer, headAimTransform, HEAD_AT_REST, type HeadAim } from '@/lib/geo/aim-at-pointer'
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

/** Matt lock 2026-09-21: these six strings, this order. Do not shorten. */
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
  const headRef = useRef<HTMLSpanElement>(null)
  /* Matt 2026-09-24: "whole dog rotates so that its eyes are following ball,
     not eyes moving, eyes are fixed." The art's own eye never moves; the
     whole head turns about its center toward the pointer (the tennis ball
     on the map), read from window pointermove at most once per frame. At
     rest (the art's own pose) with no pointer reading yet, on touch before
     the first touch move, and permanently under prefers-reduced-motion,
     which never starts the listener at all. */
  const [aim, setAim] = useState<HeadAim>(HEAD_AT_REST)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let rafId = 0
    let latest: { x: number; y: number } | null = null
    const measure = () => {
      rafId = 0
      const el = headRef.current
      if (!el || !latest) return
      const rect = el.getBoundingClientRect()
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      setAim(aimAtPointer(center, latest))
    }
    const onMove = (event: PointerEvent) => {
      latest = { x: event.clientX, y: event.clientY }
      if (!rafId) rafId = window.requestAnimationFrame(measure)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [])

  useEffect(() => {
    if (hidden) setOpen(false)
  }, [hidden])

  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      const t = event.target
      if (!(t instanceof Element)) return
      if (t.closest('.v3-dog-floater') || t.closest('.v3-dog-floater-menu')) return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open])

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
      {open ? <div className="v3-dog-floater-scrim" aria-hidden="true" /> : null}
      <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn('v3-dog-floater', open && 'v3-dog-floater--open')}
            data-v3-dog-head="inner"
            data-v3-dog-place="mid-end"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? titleId : undefined}
          >
            <span className="sr-only">Open Ryan Realty menu</span>
            <span className="v3-dog-floater__head" data-v3-dog-idle="notice" aria-hidden="true" ref={headRef}>
              {/* The aim turns BOTH dog layers as one piece, inside the head's
                  own flip/spin, so the notice animation and the look compose. */}
              <span className="v3-dog-floater__aim" style={{ transform: headAimTransform(aim) }}>
                <img
                  src="/brand/jax-head-cream.png"
                  alt=""
                  width={68}
                  height={68}
                  className="v3-dog-floater__dog v3-dog-floater__dog--cream"
                />
                <img
                  src="/brand/jax-head-navy.png"
                  alt=""
                  width={68}
                  height={68}
                  className="v3-dog-floater__dog v3-dog-floater__dog--navy"
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
          overlayClassName={cn(V3_ROOT_CLASS, 'v3-dog-floater-scrim pointer-events-none')}
          aria-describedby={undefined}
          onInteractOutside={(event) => {
            const t = event.target
            if (t instanceof Element && t.closest('.v3-dog-floater')) event.preventDefault()
          }}
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
