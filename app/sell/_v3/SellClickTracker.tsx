'use client'

/**
 * /sell click tracking (Matt's hard rule, 2026-09-28): every CTA and link click
 * on /sell and /sell?from=cma reaches the contact record through the site's
 * EXISTING two sinks, nothing new:
 *
 *   1. fireFirstPartyEvent('cta_click') → POST /api/visitors/track →
 *      visitor_events, keyed by rr_session_id. The route verifies the signed
 *      arrival token (_pid from a CRM email link) and identifies the session to
 *      the person, so the row shows on the CRM person page (lib/crm/
 *      site-activity). Anonymous rows are stitched to the person when the value
 *      flow submits (stitchFormSubmitIdentity, sessionId).
 *   2. the CTA helper in lib/cta-tracking → GA4 click_cta + trackCtaClickAction, which writes a
 *      "CTA click" event on the CRM contact when the session is identified.
 *
 * One delegated listener on the document, mounted only on /sell, so no link on
 * the page (hero, sections, breadcrumb, footer, chrome) can be missed, and
 * every control the route renders itself also carries `data-sell-cta`, the
 * named hook. app/sell/_v3/sell-cta-tracking.test.ts and
 * scripts/check-sell-cta-tracking.mjs fail the build when a /sell CTA ships
 * without it.
 *
 * A link to the value-flow anchor (#get-value) also moves focus into the
 * address field, so the repeated final ask is the same single action as the
 * hero, not a second one.
 */
import { useEffect } from 'react'
import { fireFirstPartyEvent } from '@/components/VisitTracker'
import { trackCtaClick } from '@/lib/cta-tracking'
import { markAskSource } from '@/lib/ask-source'

const FORM_HASH = '#get-value'
const FOCUS_ID = 'get-value-address'

function sellEntryNow(): 'cma' | null {
  try {
    return new URLSearchParams(window.location.search).get('from') === 'cma' ? 'cma' : null
  } catch {
    return null
  }
}

function labelOf(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label')?.trim()
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  return (aria || text || el.getAttribute('href') || 'unlabeled').slice(0, 120)
}

function contextOf(el: HTMLElement): string {
  const hook = el.closest<HTMLElement>('[data-sell-cta]')?.getAttribute('data-sell-cta')
  if (hook) return `sell:${hook}`
  if (el.closest('header')) return 'sell:chrome-header'
  if (el.closest('footer')) return 'sell:chrome-footer'
  const section = el.closest<HTMLElement>('section[id]')?.id
  return section ? `sell:section-${section}` : 'sell:page'
}

export function SellClickTracker() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null
      if (!target) return
      const el = target.closest<HTMLElement>('a[href], [data-sell-cta]')
      if (!el) return
      // A wrapper carrying the hook (not itself a control) only names the
      // context; the click must land on a link or a button inside it.
      if (!el.matches('a[href], button, [role="button"]')) {
        const inner = target.closest<HTMLElement>('a[href], button, [role="button"]')
        if (!inner) return
      }
      const href = el.getAttribute('href') ?? ''
      const destination =
        href ||
        (el.closest('form')?.id ? `form:${el.closest('form')?.id}` : `control:${el.tagName.toLowerCase()}`)
      const label = labelOf(el)
      const context = contextOf(el)
      const from = sellEntryNow()
      try {
        trackCtaClick({ label, destination, context })
      } catch {
        /* GA or the server action unavailable: the first-party row still goes */
      }
      try {
        fireFirstPartyEvent('cta_click', {
          pageCategory: 'sell',
          metadata: { label, destination, context, surface: 'sell', ...(from ? { from } : {}) },
        })
      } catch {
        /* tracking must never break the click */
      }
      if (href === FORM_HASH || href.endsWith(`/sell${FORM_HASH}`)) {
        if (el.closest('[data-sell-cta]')?.getAttribute('data-sell-cta') === 'final-ask') {
          markAskSource('footer')
        }
        const field = document.getElementById(FOCUS_ID)
        if (field) {
          event.preventDefault()
          document.getElementById('get-value')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          window.setTimeout(() => (field as HTMLInputElement).focus({ preventScroll: true }), 350)
        }
      }
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])
  return null
}
