'use client'

import { useEffect, useRef, useState } from 'react'
import { CONTACT } from '@/lib/brand/contact'

// ONE coherent nav that navigates the WHOLE site. The top bar shows the key
// destinations; the overlay is a comprehensive grouped directory (every real
// page is reachable). All REAL routes — no in-page anchors.
const LINKS = [
  // "Homes" (not "Search") — aligned with the portal chrome's primary nav so
  // the vocabulary survives the editorial<->portal seam (design-audit P1).
  { href: '/homes-for-sale', label: 'Homes' },
  { href: '/communities', label: 'Communities' },
  { href: '/cities', label: 'Cities' },
  { href: '/sell/valuation', label: 'Sell' },
  // Account affordance carried across the seam: a signed-in buyer who saw
  // saved-homes/alerts on the portal chrome no longer loses them on editorial
  // pages. /account self-gates (signed-out lands on /login?next=/account).
  { href: '/account', label: 'Account' },
]

const MENU_GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Buy',
    links: [
      { href: '/homes-for-sale', label: 'Search homes' },
      { href: '/search', label: 'Map search' },
      { href: '/communities', label: 'Communities' },
      { href: '/cities', label: 'Cities' },
      { href: '/open-houses', label: 'Open houses' },
      { href: '/price-drops', label: 'Price drops' },
      { href: '/our-homes', label: 'Our listings' },
    ],
  },
  {
    title: 'Sell',
    links: [
      { href: '/sell', label: 'Sell your home' },
      { href: '/sell/valuation', label: "What's my home worth" },
      { href: '/motivated-sellers', label: 'Sell on a deadline' },
    ],
  },
  {
    title: 'Market & area',
    links: [
      { href: '/housing-market', label: 'Housing market' },
      { href: '/area-guides', label: 'Area guides' },
      { href: '/schools', label: 'Schools' },
      { href: '/parks', label: 'Parks' },
      { href: '/tools/mortgage-calculator', label: 'Mortgage calculator' },
    ],
  },
  {
    title: 'Things to do',
    links: [
      { href: '/central-oregon/events', label: 'Events' },
      { href: '/central-oregon/venues', label: 'Live music & shows' },
      { href: '/central-oregon/trails', label: 'Trails' },
      { href: '/lp/central-oregon-golf', label: 'Golf' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/blog', label: 'Guides and blog' },
      { href: '/reviews', label: 'Reviews' },
      { href: '/about', label: 'About' },
      { href: '/team', label: 'Our team' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    // The account system (saved homes, searches, alerts) was unreachable from
    // this menu — the only sign-in affordance lived on the portal chrome
    // (design-audit navigation finding).
    title: 'Your account',
    links: [
      { href: '/account', label: 'Saved homes and searches' },
      { href: '/login', label: 'Sign in' },
    ],
  },
]

/**
 * KB top bar — transparent over the hero, flips to solid navy past the hero.
 * Horizontal wordmark (whitened over the photo via CSS filter). The menu overlay
 * is a comprehensive grouped directory. Replaces the default site chrome on KB.
 */
export function KbNav({ solid = false }: { solid?: boolean } = {}) {
  const bar = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Solid mode: always-navy bar for hero-less surfaces (e.g. /search) that can't
    // take the full kb-root shell. No transparent-over-hero state, no scroll listener.
    if (solid) return
    const onScroll = () => {
      if (!bar.current) return
      bar.current.classList.toggle('scrolled', window.scrollY > window.innerHeight * 0.82)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [solid])

  // Focus management: opening the overlay left focus on the trigger button
  // behind it, so Tab walked a keyboard user out of the (invisible) overlay
  // into the page content underneath, and closing never returned focus to
  // where the user was (design-audit P2, accessibility). Move focus into
  // the overlay on open, trap Tab within it while open, restore focus to
  // the trigger on close.
  const hasOpenedRef = useRef(false)
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    // Skip the very first (mount) run — only move focus on an actual
    // open/close transition, never steal it from the page on initial load.
    if (open) {
      hasOpenedRef.current = true
      closeBtnRef.current?.focus()
    } else if (hasOpenedRef.current) {
      triggerRef.current?.focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key !== 'Tab' || !open) return
      const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <header className={`topbar${solid ? ' scrolled solid' : ''}`} ref={bar}>
        <a href="/" aria-label="Ryan Realty home" className="topbar-logo">
          <img className="logo-img" src="/images/brand/logo-horizontal-navy-transparent.png" alt="Ryan Realty" />
        </a>
        <nav className="nav-right">
          {LINKS.map((l) => (
            <a key={l.href} className="nav-link" href={l.href}>
              {l.label}
            </a>
          ))}
          <button ref={triggerRef} className="menu-btn" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="menu-overlay" aria-label="Open menu">
            Menu +
          </button>
        </nav>
      </header>
      <div id="menu-overlay" ref={overlayRef} className={`menu-overlay${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="menu-top">
          <a href="/" aria-label="Ryan Realty home">
            <img className="logo-img" src="/images/brand/logo-horizontal-navy-transparent.png" alt="Ryan Realty" />
          </a>
          <button ref={closeBtnRef} className="menu-close" onClick={() => setOpen(false)}>
            Close ×
          </button>
        </div>
        <nav className="menu-nav menu-grid">
          {MENU_GROUPS.map((g) => (
            <div className="menu-group" key={g.title}>
              <h3 className="menu-group-title">{g.title}</h3>
              {g.links.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                  {l.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="menu-foot">
          <span>Bend · Oregon</span>
          <a href={`tel:${CONTACT.phoneDirectTel}`}>{CONTACT.phoneDirect}</a>
        </div>
      </div>
    </>
  )
}
