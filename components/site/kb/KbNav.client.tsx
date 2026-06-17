'use client'

import { useEffect, useRef, useState } from 'react'

const LINKS = [
  { href: '#towns', label: 'Towns' },
  { href: '#communities', label: 'Communities' },
  { href: '#listings', label: 'Listings' },
  { href: '#sell', label: 'Sell' },
]
const MENU = [
  { href: '#market-report', label: 'Market' },
  { href: '#towns', label: 'Towns' },
  { href: '#communities', label: 'Communities' },
  { href: '#listings', label: 'Listings' },
  { href: '#sell', label: 'Sell' },
  { href: '#team', label: 'Team' },
]

/**
 * KB top bar — transparent over the hero, flips to solid navy past the hero.
 * Full-screen menu overlay. Replaces the default site chrome on the KB surface.
 */
export function KbNav() {
  const bar = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      if (!bar.current) return
      bar.current.classList.toggle('scrolled', window.scrollY > window.innerHeight * 0.82)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <header className="topbar" ref={bar}>
        <a href="#top" aria-label="Ryan Realty home">
          <img className="logo-img" src="/images/brand/logo-white.png" alt="Ryan Realty" />
        </a>
        <nav className="nav-right">
          {LINKS.map((l) => (
            <a key={l.href} className="nav-link" href={l.href}>
              {l.label}
            </a>
          ))}
          <button className="menu-btn" onClick={() => setOpen(true)}>
            Menu +
          </button>
        </nav>
      </header>
      <div className={`menu-overlay${open ? ' open' : ''}`}>
        <div className="menu-top">
          <img className="logo-img" src="/images/brand/logo-white.png" alt="Ryan Realty" />
          <button className="menu-close" onClick={() => setOpen(false)}>
            Close ×
          </button>
        </div>
        <nav className="menu-nav">
          {MENU.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="menu-foot">
          <span>Central Oregon</span>
          <span>Bend · Redmond · Sisters</span>
        </div>
      </div>
    </>
  )
}
