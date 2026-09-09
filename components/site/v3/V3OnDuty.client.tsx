'use client'
/**
 * V3OnDuty — the published hours, against the clock, as a live line.
 *
 * The reasoning for what this may and may not claim is in ./V3OnDuty.view.ts.
 * This file is only the mount: it renders the state the server computed, then
 * re-computes on the reader's own clock so the line is live rather than a
 * cached sentence from whenever the page was built.
 *
 * HYDRATION. The first client render uses `nowIso` — the server's instant —
 * so the markup matches byte for byte; the effect then switches to the real
 * clock. Without that the server's "Open now, until 5:00 pm" and a client
 * three minutes later can disagree and React throws the whole subtree away.
 *
 * The dot is a mark, not decoration: it says which of two states this is at a
 * glance, and it is navy at whatever opacity the state deserves — never a
 * green/red light, which would be a second hue and a third meaning.
 */
import { useEffect, useState } from 'react'
import type { OfficeHoursBlock } from '@/lib/data/crm/getCrmCompanySettings'
import { cn } from '@/lib/utils'
import { onDutyLabel, onDutyState } from './V3OnDuty.view'
import './tokens.css'
import './V3OnDuty.css'

export type V3OnDutyProps = {
  /** The published hours. Empty renders nothing at all (view.ts). */
  blocks: readonly OfficeHoursBlock[] | null | undefined
  /** The company's IANA zone, from the same settings row as the blocks. */
  timeZone: string
  /** The server's instant, so the first client render matches the HTML. */
  nowIso: string
  /** How the reader can check the claim: "Bend office hours". */
  note?: string
  className?: string
}

/** One minute: the smallest step that can change the sentence. */
const TICK_MS = 60_000

export function V3OnDuty({ blocks, timeZone, nowIso, note, className }: V3OnDutyProps) {
  const [now, setNow] = useState(() => new Date(nowIso))

  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  const state = onDutyState({ blocks, timeZone, now })
  if (!state) return null

  return (
    <p className={cn('v3-onduty', state.open && 'is-open', className)}>
      <span className="v3-onduty__dot" aria-hidden="true" />
      <span className="v3-onduty__label">{onDutyLabel(state)}</span>
      {note ? <span className="v3-onduty__note">{note}</span> : null}
    </p>
  )
}
