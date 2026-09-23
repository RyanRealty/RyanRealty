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
import { pupilOffset, type PupilOffset } from '@/lib/geo/pupil-offset'
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

/**
 * Where the pupil sits at rest, as a percent of the head box — measured off
 * the actual art (public/brand/jax-head-cream.png: a 1024x1024 canvas, the
 * eye's own ink hole centered at [318.5, 240.0], both jax-head PNGs share
 * the identical silhouette). object-fit: contain on a SQUARE image inside a
 * SQUARE box scales 1:1 with no letterboxing, so the percent maps directly.
 */
const PUPIL_EYE_X_PCT = 31.1
const PUPIL_EYE_Y_PCT = 23.4
/** How far the pupil may drift from rest, in css px — "a small radius." */
const PUPIL_MAX_RADIUS_PX = 3

export function V3DogFloater() {
  const pathname = usePathname()
  const hidden = shouldHidePublicChrome(pathname)
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const headRef = useRef<HTMLSpanElement>(null)
  /* Matt 2026-09-23: "have the dogs eyes rotate to follow it." One visible
     eye — the art is a side profile — tracked from window pointermove,
     throttled to one measurement per frame. Stays at {0,0} (centered, the
     art's own rest position) with no pointer reading yet, on touch before
     the first touch move, and permanently under prefers-reduced-motion,
     which never starts the listener at all. */
  const [pupil, setPupil] = useState<PupilOffset>({ dx: 0, dy: 0 })

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
      const eye = {
        x: rect.left + rect.width * (PUPIL_EYE_X_PCT / 100),
        y: rect.top + rect.height * (PUPIL_EYE_Y_PCT / 100),
      }
      setPupil(pupilOffset(eye, latest, PUPIL_MAX_RADIUS_PX))
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
              {/* The pupil: a small dot over the art's own eye, moved by JS,
                  never a redraw of the mascot. One per dog layer so it stays
                  the right color through the brief navy/cream inversion. */}
              <span
                className="v3-dog-floater__pupil v3-dog-floater__pupil--cream"
                style={{ transform: `translate(-50%, -50%) translate(${pupil.dx}px, ${pupil.dy}px)` }}
              />
              <span
                className="v3-dog-floater__pupil v3-dog-floater__pupil--navy"
                style={{ transform: `translate(-50%, -50%) translate(${pupil.dx}px, ${pupil.dy}px)` }}
              />
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
