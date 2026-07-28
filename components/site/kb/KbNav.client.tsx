'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CONTACT } from '@/lib/brand/contact'
import { useSessionUser } from '@/lib/hooks/useSessionUser'
import {
  KB_ABOUT_DROPDOWN,
  KB_MENU_GROUPS,
  KB_TOP_LINKS,
  VALUATION_FORM,
} from '@/lib/site-nav'
import {
  SearchSuggestPanel,
  flattenSuggestions,
  useSearchSuggest,
  type SuggestItem,
} from '@/components/search/SearchSuggest'

/**
 * KB top bar — transparent over the hero, flips to solid navy past the hero.
 * Structure from lib/site-nav.ts (KB_TOP_LINKS / KB_MENU_GROUPS). About carries
 * a lightweight Team / Reviews / Contact dropdown for trust findability.
 */
export function KbNav({ solid = false }: { solid?: boolean } = {}) {
  const bar = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const sessionUser = useSessionUser()
  const signedIn = Boolean(sessionUser)
  const overlayRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const aboutWrapRef = useRef<HTMLDivElement>(null)

  const router = useRouter()
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const openViaSearchRef = useRef(false)
  const { suggestions, loading: suggestLoading } = useSearchSuggest(query)
  const suggestItems = flattenSuggestions(suggestions)

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
    if (solid) return
    const onScroll = () => {
      if (!bar.current) return
      bar.current.classList.toggle('scrolled', window.scrollY > window.innerHeight * 0.82)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [solid])

  useEffect(() => {
    if (!aboutOpen) return
    const onDoc = (e: MouseEvent) => {
      if (!aboutWrapRef.current?.contains(e.target as Node)) setAboutOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAboutOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [aboutOpen])

  const hasOpenedRef = useRef(false)
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) {
      hasOpenedRef.current = true
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
          {KB_TOP_LINKS.map((l) =>
            l.href === '/about' ? (
              <div className="nav-about" key={l.href} ref={aboutWrapRef}>
                <button
                  type="button"
                  className="nav-link nav-about-trigger"
                  aria-expanded={aboutOpen}
                  aria-haspopup="true"
                  aria-controls="about-dropdown"
                  onClick={() => setAboutOpen((v) => !v)}
                  onMouseEnter={() => setAboutOpen(true)}
                >
                  {l.label}
                </button>
                <div
                  id="about-dropdown"
                  className={`nav-about-menu${aboutOpen ? ' open' : ''}`}
                  role="menu"
                  onMouseLeave={() => setAboutOpen(false)}
                >
                  <a href="/about" role="menuitem" onClick={() => setAboutOpen(false)}>
                    About Ryan Realty
                  </a>
                  {KB_ABOUT_DROPDOWN.map((d) => (
                    <a key={d.href} href={d.href} role="menuitem" onClick={() => setAboutOpen(false)}>
                      {d.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <a key={l.href} className="nav-link" href={l.href}>
                {l.label}
              </a>
            )
          )}
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
          <Link className="nav-cta" href={VALUATION_FORM.href}>
            {VALUATION_FORM.label}
          </Link>
          <button
            ref={triggerRef}
            className="menu-btn"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="menu-overlay"
            aria-label="Open menu"
          >
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
          {KB_MENU_GROUPS.map((g) => (
            <div className="menu-group" key={g.title}>
              <h3 className="menu-group-title">{g.title}</h3>
              {g.links.map((l) => (
                <a key={`${g.title}-${l.href}`} href={l.href} onClick={closeOverlay}>
                  {l.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="menu-cta-row">
          <Link className="nav-cta" href={VALUATION_FORM.href} onClick={closeOverlay}>
            {VALUATION_FORM.label}
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
