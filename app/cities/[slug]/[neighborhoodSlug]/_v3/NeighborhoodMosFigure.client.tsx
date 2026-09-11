'use client'

/**
 * Neighborhood MOS insight (SITE-104): hover/focus on #place-mos reveals how
 * sales moved via InsightPager (beautifului-insight). PlaceAreaHero still owns
 * the two named bars — this mounts beside them without replacing the house.
 */

import { useCallback, useEffect, useState } from 'react'
import { InsightPager } from '@/components/motion/insight-pager'
import './neighborhood-mos-figure.css'

export type NeighborhoodMosFigureProps = {
  /** Year / now pages from buildNeighborhoodSupplyPages. */
  supplyPages: readonly string[]
  /** The MOS figure id PlaceAreaHero / V3MosBars emit. */
  mosId?: string
}

export function NeighborhoodMosFigure({
  supplyPages,
  mosId = 'place-mos',
}: NeighborhoodMosFigureProps) {
  const last = Math.max(0, supplyPages.length - 1)
  const [page, setPage] = useState(last)
  const [open, setOpen] = useState(false)
  const hasInsight = supplyPages.length >= 2

  const show = useCallback(() => setOpen(true), [])
  const hide = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!hasInsight) return
    const el = document.getElementById(mosId)
    if (!el) return
    el.addEventListener('mouseenter', show)
    el.addEventListener('mouseleave', hide)
    el.addEventListener('focusin', show)
    el.addEventListener('focusout', hide)
    return () => {
      el.removeEventListener('mouseenter', show)
      el.removeEventListener('mouseleave', hide)
      el.removeEventListener('focusin', show)
      el.removeEventListener('focusout', hide)
    }
  }, [hasInsight, hide, mosId, show])

  if (!hasInsight || !open) return null

  return (
    <div className="nbh-mos nbh-mos--insight-only" role="status">
      <div className="nbh-mos__insight">
        <p className="nbh-mos__insight-kicker">How sales moved</p>
        <InsightPager title="Year" pages={supplyPages} page={page} onPage={setPage} />
        <p className="nbh-mos__insight-read">{supplyPages[page] ?? supplyPages[last]}</p>
      </div>
    </div>
  )
}
