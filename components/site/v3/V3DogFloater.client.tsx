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

/** A finger resting on the glass is nobody scrolling: this long without a
 *  movement and he looks back to rest even though it has not lifted. */
export const TOUCH_LOOK_HOLD_MS = 1000

/** A finger has to travel this far from where it landed before he watches
 *  it; less is a tap, and a tap never turns his head. */
export const TOUCH_DRAG_SLOP_PX = 10

export function V3DogFloater() {
  const pathname = usePathname()
  const hidden = shouldHidePublicChrome(pathname)
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const headRef = useRef<HTMLSpanElement>(null)
  /* Matt 2026-09-24: "whole dog rotates so that its eyes are following ball,
     not eyes moving, eyes are fixed." The art's own eye never moves; the
     whole head turns about its center toward the pointer (the tennis ball
     on the map), read at most once per frame. At rest (the art's own pose)
     with nothing to look at, while the pointer is on the dog himself, and
     permanently under prefers-reduced-motion, which never starts the
     listeners at all.

     Matt 2026-09-25, on a phone: "I want the dog to always go back to the
     normal position on phone and not stay looking somewhere when no one is
     scrolling." A look lasts only as long as the thing he looks at. A mouse
     on a hover device stays on the page, so he keeps its look until the
     cursor leaves the window. A finger does not: he watches the finger that
     landed only while it drags, and looks back to rest the moment it lifts
     or after TOUCH_LOOK_HOLD_MS without a movement. The finger is read from
     the touch stream, which keeps arriving through a native scroll; the
     browser cancels a finger's pointer events the moment it takes the
     scroll, and that last pointer reading is what used to leave him stuck.
     Pointer events are read for a mouse only, so a pen tap is a tap too.
     Listeners capture on window, so a component that stops a touch from
     bubbling cannot hide the finger from him. */
  const [aim, setAim] = useState<HeadAim>(HEAD_AT_REST)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    type Point = { x: number; y: number }
    const listen = { capture: true, passive: true } as const
    // The same query as useHoverCapable, read here rather than through the
    // hook (ci:hydration-safety refuses a window-reading helper called in
    // render), and followed, so a mouse arriving or leaving later counts.
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)')
    let mouseKeepsLook = hover.matches
    const onHoverChange = () => {
      mouseKeepsLook = hover.matches
    }
    let rafId = 0
    let holdTimer = 0
    let lastMoveAt = 0
    let latest: Point | null = null
    let finger: { id: number; from: Point; dragging: boolean } | null = null
    const measure = () => {
      rafId = 0
      const el = headRef.current
      if (!el || !latest) return
      const rect = el.getBoundingClientRect()
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      const next = aimAtPointer(center, latest, el.offsetWidth / 2)
      setAim((prev) => (prev.deg === next.deg && prev.mirror === next.mirror ? prev : next))
    }
    const rest = () => {
      window.clearTimeout(holdTimer)
      holdTimer = 0
      latest = null
      if (rafId) window.cancelAnimationFrame(rafId)
      rafId = 0
      setAim(HEAD_AT_REST)
    }
    // One timer per look, not one per move: it re-arms for whatever is left.
    const holdCheck = () => {
      const idle = performance.now() - lastMoveAt
      if (idle < TOUCH_LOOK_HOLD_MS) {
        holdTimer = window.setTimeout(holdCheck, TOUCH_LOOK_HOLD_MS - idle)
        return
      }
      holdTimer = 0
      // A finger that went still has to travel the slop again, from here.
      if (finger?.dragging && latest) finger = { ...finger, from: latest, dragging: false }
      rest()
    }
    const lookAt = (point: Point, keep: boolean) => {
      latest = point
      if (!rafId) rafId = window.requestAnimationFrame(measure)
      if (keep) {
        window.clearTimeout(holdTimer)
        holdTimer = 0
        return
      }
      lastMoveAt = performance.now()
      if (!holdTimer) holdTimer = window.setTimeout(holdCheck, TOUCH_LOOK_HOLD_MS)
    }
    const watched = (list: TouchList) => {
      for (let i = 0; i < list.length; i++) if (list[i].identifier === finger?.id) return list[i]
      return null
    }
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      lookAt({ x: event.clientX, y: event.clientY }, mouseKeepsLook)
    }
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      const t = event.touches[0]
      finger = { id: t.identifier, from: { x: t.clientX, y: t.clientY }, dragging: false }
    }
    const onTouchMove = (event: TouchEvent) => {
      const t = finger && watched(event.touches)
      if (!finger || !t) return
      const point = { x: t.clientX, y: t.clientY }
      if (!finger.dragging) {
        if (Math.hypot(point.x - finger.from.x, point.y - finger.from.y) < TOUCH_DRAG_SLOP_PX) return
        finger.dragging = true
      }
      lookAt(point, false)
    }
    const onTouchEnd = (event: TouchEvent) => {
      if (!finger || watched(event.touches)) return
      finger = null
      rest()
    }
    const onMouseOut = (event: MouseEvent) => {
      if (!event.relatedTarget) rest()
    }
    hover.addEventListener?.('change', onHoverChange)
    window.addEventListener('pointermove', onPointerMove, listen)
    window.addEventListener('touchstart', onTouchStart, listen)
    window.addEventListener('touchmove', onTouchMove, listen)
    window.addEventListener('touchend', onTouchEnd, listen)
    window.addEventListener('touchcancel', onTouchEnd, listen)
    window.addEventListener('mouseout', onMouseOut, listen)
    return () => {
      hover.removeEventListener?.('change', onHoverChange)
      window.removeEventListener('pointermove', onPointerMove, listen)
      window.removeEventListener('touchstart', onTouchStart, listen)
      window.removeEventListener('touchmove', onTouchMove, listen)
      window.removeEventListener('touchend', onTouchEnd, listen)
      window.removeEventListener('touchcancel', onTouchEnd, listen)
      window.removeEventListener('mouseout', onMouseOut, listen)
      window.clearTimeout(holdTimer)
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
