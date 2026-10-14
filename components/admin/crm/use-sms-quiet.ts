'use client'

import { useEffect, useState } from 'react'
import { quietSmsZone } from '@/lib/crm/quiet-hours'

const TICK_MS = 30_000

/**
 * Live SMS quiet hours for a composer: Pacific plus `zones`, the recipients'
 * area-code zones (the server supplies them from lib/crm/recipient-timezones;
 * Matt 2026-10-04, "Both zones"). Until mount it is `serverQuiet`, so the
 * first client render matches the server HTML (ci:hydration-safety). Then it
 * reads the clock every 30 seconds, so a composer left open across 7:55pm or
 * 8am still tells the truth. Every send is checked again on the server; this
 * only decides what the broker sees.
 */
export function useSmsQuiet(zones: readonly string[], serverQuiet: boolean): boolean {
  const [nowMs, setNowMs] = useState<number | null>(null)
  useEffect(() => {
    setNowMs(Date.now())
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])
  if (nowMs === null) return serverQuiet
  return quietSmsZone(zones, new Date(nowMs)) !== null
}
