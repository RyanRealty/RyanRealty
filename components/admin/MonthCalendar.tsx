'use client'

/**
 * MonthCalendar — the mobile month calendar (docs/MOBILE_CRM_FUB_PARITY.md #6).
 *
 * FUB's calendar tab is a month grid (dots on days that have something) with the
 * selected day's items listed below. Ours shows the same broker calendar the
 * dashboard already builds (closings, contracts, tasks, GCal), defaulting the
 * day list to today so it keeps the at-a-glance value while adding browse.
 *
 * Presentation only — items are passed in; `todayIso` comes from the server so
 * there is no client/server date mismatch.
 */

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type CalItem = { date: string; label: string; sublabel: string | null; type: string; href: string | null }

const ICON: Record<string, string> = { closing: '🔑', contract: '📋', expiration: '⏰', task: '✓', gcal: '📅' }
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function MonthCalendar({ items, todayIso }: { items: CalItem[]; todayIso: string }) {
  const [year, month] = todayIso.split('-').map(Number) // month is 1-12
  const [selected, setSelected] = useState<string>(todayIso)

  const byDate = new Map<string, CalItem[]>()
  for (const it of items) {
    const d = it.date.slice(0, 10)
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d)!.push(it)
  }

  // Current-month grid (UTC math keeps the day numbers stable regardless of tz).
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)

  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const dayItems = byDate.get(selected) ?? []
  const selectedLabel = new Date(`${selected}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })

  return (
    <div>
      <div className="mb-2 px-1 text-sm font-semibold text-foreground">{monthName}</div>
      <div className="grid grid-cols-7 gap-1 text-center sm:grid-cols-7">
        {DOW.map((d) => (
          <div key={d} className="py-1 text-xs font-medium text-muted-foreground">{d}</div>
        ))}
        {cells.map((iso, i) =>
          iso === null ? (
            <div key={`b${i}`} />
          ) : (
            <Button
              key={iso}
              type="button"
              variant={selected === iso ? 'default' : iso === todayIso ? 'secondary' : 'ghost'}
              onClick={() => setSelected(iso)}
              className="relative h-9 w-full rounded-lg p-0 font-medium"
              aria-label={iso}
              aria-pressed={selected === iso}
            >
              <span className="tabular-nums">{Number(iso.slice(8))}</span>
              {byDate.has(iso) ? (
                <span className={cn('absolute bottom-1 h-1 w-1 rounded-full', selected === iso ? 'bg-primary-foreground' : 'bg-primary')} />
              ) : null}
            </Button>
          ),
        )}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{selectedLabel}</div>
        {dayItems.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">Nothing scheduled.</p>
        ) : (
          <div className="space-y-1.5">
            {dayItems.map((it, i) => (
              <div key={i} className="flex items-center gap-2 px-1 text-sm">
                <span className="text-base leading-none">{ICON[it.type] ?? '•'}</span>
                <span className="min-w-0 flex-1">
                  {it.href ? (
                    <Link href={it.href} className="font-medium text-foreground hover:underline">{it.label}</Link>
                  ) : (
                    <span className="font-medium text-foreground">{it.label}</span>
                  )}
                  {it.sublabel ? <span className="ml-1 text-xs text-muted-foreground">· {it.sublabel}</span> : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
