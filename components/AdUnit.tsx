'use client'

/**
 * One explicit AdSense slot, and the ONLY place adsbygoogle.js loads.
 *
 * UXLIVE-5 (visibility audit 2026-09-22): the script used to load sitewide from
 * components/GoogleAnalytics.tsx, which ran Auto-ads auctions on every
 * brokerage page. It now loads here, so it reaches a page only when that page
 * renders an explicit slot, and only after marketing consent. The one live
 * slot is on /tools/appreciation, a non-transactional tools page. Do not put a
 * slot on a listing, place, search, sell, or home page: those pages exist to
 * convert, and an auto-placed ad on them can be a competitor's.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Script from 'next/script'
import { Card, CardContent } from '@/components/ui/card'
import { hasMarketingConsent } from '@/components/CookieConsentBanner'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

type Props = {
  slot: string
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical'
  className?: string
  showLabel?: boolean
}

export default function AdUnit({ slot, format = 'auto', className, showLabel = true }: Props) {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() ?? ''
  const [canRender, setCanRender] = useState(false)
  // design-audit STA-2: when AdSense has no inventory it leaves the <ins> with
  // data-ad-status="unfilled" and zero height, so the wrapping "Sponsored" Card
  // renders as a dead empty box on a first-party conversion hub. Collapse the
  // whole unit when the slot doesn't fill (revenue is preserved when it does).
  const [unfilled, setUnfilled] = useState(false)
  const insRef = useRef<HTMLModElement>(null)

  useEffect(() => {
    const syncConsent = () => setCanRender(hasMarketingConsent())
    syncConsent()
    const onConsent = () => syncConsent()
    window.addEventListener('cookie-consent', onConsent)
    return () => window.removeEventListener('cookie-consent', onConsent)
  }, [])

  const adStyle = useMemo<CSSProperties>(() => {
    if (format === 'rectangle') return { display: 'block', minHeight: 280 }
    if (format === 'horizontal') return { display: 'block', minHeight: 120 }
    if (format === 'vertical') return { display: 'block', minHeight: 320 }
    return { display: 'block' }
  }, [format])

  useEffect(() => {
    if (!clientId || !slot || !canRender) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // Ads can fail silently due to blockers or ad inventory.
    }

    const ins = insRef.current
    if (!ins) return
    const check = () => {
      const status = ins.getAttribute('data-ad-status')
      if (status === 'unfilled') setUnfilled(true)
      else if (status === 'filled') setUnfilled(false)
    }
    check()
    const obs = new MutationObserver(check)
    obs.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] })
    // Fallback: if the slot never resolves to a real height, treat it as unfilled.
    const t = window.setTimeout(() => {
      if (ins.getAttribute('data-ad-status') !== 'filled' && ins.getBoundingClientRect().height < 40) {
        setUnfilled(true)
      }
    }, 3000)
    return () => {
      obs.disconnect()
      window.clearTimeout(t)
    }
  }, [clientId, slot, canRender])

  if (!clientId || !slot || !canRender) return null

  // lazyOnload: the script runs at browser idle, AFTER hydration. It mutates
  // the DOM, and under afterInteractive that produced the intermittent
  // hydration mismatches the 2026-06-10 audit caught (P0-5). The push above
  // queues on window.adsbygoogle, which the script drains when it loads.
  // next/script dedupes by id, so two slots on one page load it once.
  const script = (
    <Script
      id="adsense"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      strategy="lazyOnload"
      crossOrigin="anonymous"
    />
  )

  if (unfilled) return script

  return (
    <>
    {script}
    <Card className={className}>
      <CardContent className="p-4">
        {showLabel && <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Sponsored</p>}
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={adStyle}
          data-ad-client={clientId}
          data-ad-slot={slot}
          data-ad-format={format === 'auto' ? 'auto' : undefined}
          data-full-width-responsive="true"
        />
      </CardContent>
    </Card>
    </>
  )
}
