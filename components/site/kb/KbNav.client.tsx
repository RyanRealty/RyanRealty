'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CONTACT } from '@/lib/brand/contact'
import { useSessionUser } from '@/lib/hooks/useSessionUser'
import {
  SearchSuggestPanel,
  flattenSuggestions,
  useSearchSuggest,
  type SuggestItem,
} from '@/components/search/SearchSuggest'

// ONE coherent nav that navigates the WHOLE site. The top bar shows the key
// destinations; the overlay is a comprehensive grouped directory (every real
// page is reachable). All REAL routes — no in-page anchors.
const LINKS = [
  // "Homes" (not "Search") — aligned with the portal chrome's primary nav so
  // the vocabulary survives the editorial<->portal seam (design-audit P1).
  { href: '/homes-for-sale', label: 'Homes' },
  { href: '/communities', label: 'Communities' },
  { href: '/cities', label: 'Cities' },
  { href: '/sell', label: 'Sell' },
  // design-audit NAV-4: "Account" as a top-level marketing tab read oddly and
  // clashed with the search chrome's "Sign in". The auth entry now lives in the
  // topbar CTA cluster (Sign in) + the overlay's "Your account" group, matching
  // the search header so the affordance is identical across the seam.
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
  // RC7: signed-in visitors got only "Sign in" here, stranding them from their
  // saved homes/searches. When signed in, the auth affordance links to /account.
  const sessionUser = useSessionUser()
  const signedIn = Boolean(sessionUser)
  const overlayRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // W4.1 global search — the ONE suggestions engine (SearchSuggest), reachable
  // from every page that carries the KB nav. Entry point only: the fetch,
  // flatten, and panel all live in components/search/SearchSuggest.
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const openViaSearchRef = useRef(false)
  const { suggestions, loading: suggestLoading } = useSearchSuggest(query)
  const suggestItems = flattenSuggestions(suggestions)

  // Close the overlay AND clear the search state, so a reopen never shows a
  // stale query or a stale keyboard highlight.
  const closeOverlay = useCallback(() => {
    setOpen(false)
    setQuery('')
    setHighlight(-1)
  }, [])

  const pickSuggestion = useCallback(
    (item: SuggestItem) => {
      closeOverlay()
      router.push(item.href)
    },
    [closeOverlay, router]
  )

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && query) {
      // First Escape clears the query; a second one (empty query) falls
      // through to the overlay's own Escape-to-close handler.
      e.stopPropagation()
      setQuery('')
      setHighlight(-1)
      return
    }
    if (e.key === 'ArrowDown' && suggestItems.length > 0) {
      e.preventDefault()
      setHighlight((h) => (h < suggestItems.length - 1 ? h + 1 : 0))
      return
    }
    if (e.key === 'ArrowUp' && suggestItems.length > 0) {
      e.preventDefault()
      setHighlight((h) => (h > 0 ? h - 1 : suggestItems.length - 1))
      return
    }
    if (e.key !== 'Enter') return
    e.preventDefault()
    const picked = highlight >= 0 ? suggestItems[highlight] : suggestItems[0]
    if (picked) {
      pickSuggestion(picked)
      return
    }
    const q = query.trim()
    if (!q) return
    closeOverlay()
    router.push(`/homes-for-sale?keywords=${encodeURIComponent(q)}`)
  }

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
      // Opened from the topbar Search affordance: put the caret straight into
      // the search field. Opened as the menu: focus the close control.
      if (openViaSearchRef.current) searchInputRef.current?.focus()
      else closeBtnRef.current?.focus()
      openViaSearchRef.current = false
    } else if (hasOpenedRef.current) {
      triggerRef.current?.focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeOverlay()
        return
      }
      if (e.key !== 'Tab' || !open) return
      const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled])'
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
  }, [open, closeOverlay])

  return (
    <>
      <header className={`topbar${solid ? ' scrolled solid' : ''}`} ref={bar}>
        <Link href="/" aria-label="Ryan Realty home" className="topbar-logo">
          <img className="logo-img" src="/images/brand/logo-horizontal-navy-transparent.png" alt="Ryan Realty" />
        </Link>
        <nav className="nav-right">
          {LINKS.map((l) => (
            <a key={l.href} className="nav-link" href={l.href}>
              {l.label}
            </a>
          ))}
          {/* design-audit NAV-4/NAV-5/CNV-5: persistent conversion + auth CTAs in
              the topbar (matching the search chrome), so the seller money action
              and sign-in are one tap from every KB page, not buried in the menu. */}
          {/* W4.1: global search entry — opens the overlay with the caret in
              the search field. Hidden on small screens like the nav links
              (the overlay's search field covers mobile via Menu). */}
          <button
            type="button"
            className="nav-link menu-btn"
            onClick={() => {
              openViaSearchRef.current = true
              setOpen(true)
            }}
            aria-label="Search the site"
          >
            Search
          </button>
          <a className="nav-signin" href={signedIn ? '/account' : '/login'}>
            {signedIn ? 'My account' : 'Sign in'}
          </a>
          <Link className="nav-cta" href="/sell/valuation">
            What’s my home worth
          </Link>
          <button ref={triggerRef} className="menu-btn" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="menu-overlay" aria-label="Open menu">
            Menu +
          </button>
        </nav>
      </header>
      <div id="menu-overlay" ref={overlayRef} className={`menu-overlay${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="menu-top">
          <Link href="/" aria-label="Ryan Realty home">
            <img className="logo-img" src="/images/brand/logo-horizontal-navy-transparent.png" alt="Ryan Realty" />
          </Link>
          <button ref={closeBtnRef} className="menu-close" onClick={closeOverlay}>
            Close ×
          </button>
        </div>
        {/* W4.1 global search — one field, every suggestion category the
            backend returns (addresses, cities, communities, neighborhoods,
            zips, agents, reports, pages). KB idiom: real input, kb.css vars. */}
        <div role="search" className="relative mt-7 w-full">
          <input
            id="kb-nav-search"
            ref={searchInputRef}
            type="search"
            autoComplete="off"
            placeholder="Search addresses, cities, communities, agents"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setHighlight(-1)
            }}
            onKeyDown={onSearchKeyDown}
            role="combobox"
            aria-expanded={open && suggestItems.length > 0}
            aria-controls="kb-nav-suggest-listbox"
            aria-activedescendant={highlight >= 0 ? `kb-nav-suggest-item-${highlight}` : undefined}
            aria-label="Search the site"
            className="w-full border-0 border-b-2 border-[var(--cream-40)] bg-transparent pb-3 font-sans text-lg text-[var(--cream)] outline-none transition-colors placeholder:text-[var(--cream-muted)] focus:border-[var(--cream)]"
          />
          {query.trim().length >= 2 && (
            <SearchSuggestPanel
              items={suggestItems}
              loading={suggestLoading}
              hasResult={suggestions !== null}
              highlight={highlight}
              idPrefix="kb-nav-suggest"
              onPick={pickSuggestion}
              className="absolute inset-x-0 top-full z-10 mt-2 max-h-[50vh] overflow-auto rounded-xl border border-border bg-card pb-1 shadow-lg"
            />
          )}
        </div>
        <nav className="menu-nav menu-grid">
          {MENU_GROUPS.map((g) => (
            <div className="menu-group" key={g.title}>
              <h3 className="menu-group-title">{g.title}</h3>
              {g.links.map((l) => (
                <a key={l.href} href={l.href} onClick={closeOverlay}>
                  {l.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="menu-cta-row">
          <Link className="nav-cta" href="/sell/valuation" onClick={closeOverlay}>
            What’s my home worth
          </Link>
          <a className="nav-signin overlay" href={signedIn ? '/account' : '/login'} onClick={closeOverlay}>
            {signedIn ? 'My account' : 'Sign in'}
          </a>
        </div>
        <div className="menu-foot">
          <span>Bend · Oregon</span>
          <a href={`tel:${CONTACT.phoneDirectTel}`}>{CONTACT.phoneDirect}</a>
        </div>
      </div>
    </>
  )
}
