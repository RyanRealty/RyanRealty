'use client'

/**
 * LeadTabs — the mobile information architecture for the Lead Command Center,
 * styled to the FUB reference (docs/MOBILE_CRM_FUB_PARITY.md): a dark identity
 * header band with the avatar, name, owner, and a clean white/blue tab row, then
 * a light grouped body below. One focused section per tab on a phone; on desktop
 * the band shows the identity, the tabs hide, and every section is visible in the
 * original single-scroll arrangement.
 *
 * Visibility is pure CSS — no panel unmounts — so every server-action form inside
 * a slot keeps working unchanged. Colors are console tokens (dark charcoal
 * `bg-primary`, `--console-info` accent) so the band reads intentional and
 * matches the rest of the neutral console.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { StagePill, StatusPill } from '@/components/console/StatusPill'
import { cn } from '@/lib/utils'

export type LeadTabKey = 'overview' | 'comms' | 'tasks' | 'watching' | 'workflow' | 'activity'

const HASH_TO_TAB: Record<string, LeadTabKey> = {
  overview: 'overview',
  comms: 'comms',
  tasks: 'tasks',
  watching: 'watching',
  'saved-searches': 'watching',
  workflow: 'workflow',
  tags: 'workflow',
  activity: 'activity',
}

// Labels follow the FUB contact tabs (Info · Comms · Homes · …). Keys are stable
// (hash routing + slots depend on them); only the visible labels track FUB.
const TABS: { key: LeadTabKey; label: string }[] = [
  { key: 'overview', label: 'Info' },
  { key: 'comms', label: 'Comms' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'watching', label: 'Homes' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'activity', label: 'Activity' },
]

export function LeadTabs({
  name,
  pictureUrl,
  stage,
  live,
  ownerName,
  lastCommLabel,
  dealValueLabel,
  backHref,
  fubHref,
  flushTop = true,
  overview,
  comms,
  tasks,
  watching,
  workflow,
  activity,
}: {
  name: string
  pictureUrl: string | null
  stage: string
  live?: boolean
  ownerName?: string | null
  /** FUB-parity: "Last communication May 21" under the name. Null hides it. */
  lastCommLabel?: string | null
  /** FUB-parity: green deal-value pill (e.g. "$655K") near the stage. Null hides it. */
  dealValueLabel?: string | null
  backHref: string
  fubHref?: string | null
  flushTop?: boolean
} & Record<LeadTabKey, React.ReactNode>) {
  const [active, setActive] = useState<LeadTabKey>('overview')

  useEffect(() => {
    const sync = (scrollToHash?: boolean) => {
      const hash = window.location.hash.replace(/^#/, '')
      const key = HASH_TO_TAB[hash]
      if (key) {
        setActive(key)
        // On mobile the target element is hidden until the active-tab CSS change
        // is applied. Use a micro-task + two-frame delay so the DOM has finished
        // painting before we call scrollIntoView — otherwise scroll fires against
        // a display:none element and silently no-ops.
        if (scrollToHash && hash) {
          const doScroll = () => {
            const el = document.getElementById(hash)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          // First rAF: React re-render scheduled. Second rAF: DOM updated.
          requestAnimationFrame(() => requestAnimationFrame(doScroll))
        }
      }
    }
    sync()
    const onHashChange = () => sync(true)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const slot = (key: LeadTabKey) => cn(active === key ? 'flex' : 'hidden', 'flex-col gap-4 lg:flex')

  return (
    // Break out of the main's padding so the dark band is full-bleed to the top.
    <div className={cn('-mx-4 sm:-mx-6', flushTop && '-mt-5 sm:-mt-7')}>
      {/* ── Dark identity header band ── */}
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-between py-2.5 text-xs">
            <Link href={backHref} className="inline-flex min-h-8 items-center text-primary-foreground/70 transition-colors hover:text-primary-foreground">← Leads</Link>
            {fubHref ? (
              <a href={fubHref} target="_blank" rel="noreferrer" className="text-primary-foreground/45 transition-colors hover:text-primary-foreground/80">Open in FUB ↗</a>
            ) : null}
          </div>

          <div className="flex items-center gap-3 pb-3.5">
            {pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pictureUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-primary-foreground/20" referrerPolicy="no-referrer" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-lg font-semibold text-primary-foreground">
                {(name ?? '?').charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight">{name}</h1>
                {live ? <StatusPill tone="success" label="On site" pulse /> : null}
                {dealValueLabel ? (
                  <span className="rounded-full bg-success px-2 py-0.5 text-xs font-semibold text-success-foreground">{dealValueLabel}</span>
                ) : null}
              </div>
              <div className="mt-0.5 truncate text-sm text-primary-foreground/55">
                {ownerName ? `Owner · ${ownerName}` : 'Unassigned'}
                {lastCommLabel ? <span className="text-primary-foreground/40"> · Last contact {lastCommLabel}</span> : null}
              </div>
            </div>
            <StagePill stage={stage} />
          </div>

          {/* Tabs — phone only (desktop shows every section in one scroll). */}
          <div className="no-scrollbar -mb-px flex gap-5 overflow-x-auto lg:hidden" role="tablist" aria-label="Lead sections">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active === t.key}
                onClick={(e) => {
                  setActive(t.key)
                  e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest' })
                }}
                className={cn(
                  'shrink-0 whitespace-nowrap border-b-2 pb-2.5 text-sm font-medium transition-colors',
                  active === t.key ? 'text-primary-foreground' : 'border-transparent text-primary-foreground/45 hover:text-primary-foreground/80',
                )}
                style={active === t.key ? { borderColor: 'var(--console-info)' } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Light grouped body ── */}
      {/*
       * Desktop (lg+): true 3-column FUB workspace.
       *   LEFT   — identity / contact data (overview)
       *   MIDDLE — composers + timeline (comms → activity)
       *   RIGHT  — action management (tasks → watching → workflow)
       *
       * Mobile (< lg): single focused tab via slot() — unchanged.
       * The slot() helper already emits `lg:flex` on every key so all
       * columns are visible at lg+; the CSS grid positions them.
       */}
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        {/* Mobile: single-column stacking (slot() controls visibility).
            Desktop: 3-column grid — left 1fr · middle 1.4fr · right 1fr */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-4">

          {/* LEFT — contact identity, details, source, memberships */}
          <div className={slot('overview')}>{overview}</div>

          {/* MIDDLE — action bar / composers then full activity timeline */}
          <div className="lg:flex lg:flex-col lg:gap-4">
            <div className={slot('comms')}>{comms}</div>
            <div className={slot('activity')}>{activity}</div>
          </div>

          {/* RIGHT — tasks, watching / saved searches, workflow / tags */}
          <div className="lg:flex lg:flex-col lg:gap-4">
            <div className={slot('tasks')}>{tasks}</div>
            <div className={slot('watching')}>{watching}</div>
            <div className={slot('workflow')}>{workflow}</div>
          </div>

        </div>
      </div>
    </div>
  )
}
