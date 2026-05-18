'use client'

/**
 * Sticky scroll CTA bar. Shows once the viewer scrolls past the hero. Hides
 * when the viewer is near the footer. Ports the inline scroll-cta script from
 * public/lp/tetherow/index.html.
 */
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function TetherowStickyCta() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const hero = document.querySelector('header[data-tetherow-hero]')
    let heroBottom = hero ? (hero as HTMLElement).offsetTop + (hero as HTMLElement).offsetHeight : 800

    function check() {
      const scrollY = window.scrollY || window.pageYOffset
      const nearFooter = window.innerHeight + scrollY > document.body.offsetHeight - 320
      setVisible(scrollY > heroBottom && !nearFooter)
    }
    function recompute() {
      heroBottom = hero ? (hero as HTMLElement).offsetTop + (hero as HTMLElement).offsetHeight : 800
    }
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', recompute)
    check()
    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', recompute)
    }
  }, [])

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-[100] border-t border-[rgba(250,248,244,0.18)] bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)] shadow-[0_-4px_20px_rgba(16,39,66,0.18)] transition-transform duration-[350ms] ease-out',
        visible ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-[18px] px-6 py-[14px] sm:px-6">
        <div className="flex items-center gap-[14px]">
          <div>
            <div
              className="text-[18px] font-semibold leading-[1.2] sm:text-[18px]"
              style={{ fontFamily: 'var(--rr-font-display)' }}
            >
              Find out what your Tetherow home is worth
            </div>
            <div className="mt-0.5 hidden text-[12px] leading-[1.4] opacity-70 sm:block">
              Free 12-page value report. Signed by a Bend principal broker. No phone follow-up
              unless you ask.
            </div>
          </div>
        </div>
        <a
          href="#cma"
          className="whitespace-nowrap rounded-lg bg-[color:var(--rr-cream)] px-[22px] py-3 text-[14px] font-bold tracking-[0.02em] text-[color:var(--rr-navy)] transition hover:opacity-90 active:scale-[0.98]"
        >
          Get my value report
        </a>
      </div>
    </div>
  )
}

export default TetherowStickyCta
