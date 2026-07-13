'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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

  if (!clientId || !slot || !canRender || unfilled) return null

  return (
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
  )
}
