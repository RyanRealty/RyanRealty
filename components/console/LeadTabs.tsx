'use client'

/**
 * LeadTabs — the mobile information architecture for the Lead Command Center.
 *
 * Matt directive 2026-06-16 (docs/MOBILE_CRM_FUB_PARITY.md, pattern #1): FUB
 * mobile shows a lead as a TABBED detail, not one long scroll. We match the bar
 * and beat it. This component is PRESENTATION ONLY — it receives the existing
 * console panels as already-rendered slots and reorganizes them:
 *
 *   - On a phone (< lg): a sticky horizontal tab bar; one focused section at a
 *     time. Tab set per the contract: Overview · Comms · Tasks · Watching ·
 *     Workflow · Activity.
 *   - On desktop (lg+): every slot is visible and laid out in the original
 *     single-scroll arrangement — Overview full-width, then a two-column grid
 *     (main 1.3fr: Comms + Tasks; side 1fr: Watching + Workflow), then Activity
 *     full-width. Pixel-identical to the pre-tabs desktop layout.
 *
 * Why a purpose-built component instead of the Radix Tabs primitive: Radix hides
 * inactive panels at every width. We need the opposite on desktop (show all,
 * single scroll). Visibility here is pure CSS — `hidden` on mobile when inactive,
 * `lg:block` always — so no panel ever unmounts and every server-action form
 * inside a slot keeps working unchanged.
 */

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type LeadTabKey = 'overview' | 'comms' | 'tasks' | 'watching' | 'workflow' | 'activity'

// Map an in-page hash (set by the quick-action FAB and the header anchors) to the
// tab that owns that content, so a deep link like `#comms` opens the Comms tab on
// mobile. Existing anchors (#comms, #saved-searches) keep working — they now also
// select their tab before scrolling into view.
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

const TABS: { key: LeadTabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'comms', label: 'Comms' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'watching', label: 'Watching' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'activity', label: 'Activity' },
]

export function LeadTabs({
  overview,
  comms,
  tasks,
  watching,
  workflow,
  activity,
}: Record<LeadTabKey, React.ReactNode>) {
  const [active, setActive] = useState<LeadTabKey>('overview')

  // Deep links: select the tab named by the URL hash on load and on hashchange.
  // No-op on desktop (every slot is visible), so the hash just scrolls there.
  useEffect(() => {
    const sync = () => {
      const key = HASH_TO_TAB[window.location.hash.replace(/^#/, '')]
      if (key) setActive(key)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  // A slot is visible on mobile only when it is the active tab; on desktop every
  // slot is always visible (single scroll). Every slot stacks its children with a
  // consistent gap so multi-panel slots (Overview, Watching, Workflow) read right.
  const slot = (key: LeadTabKey) => cn(active === key ? 'flex' : 'hidden', 'flex-col gap-4 lg:flex')

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile tab bar — hidden on desktop (single scroll). Sticks under the
          console header (h-14). */}
      <div className="sticky top-14 z-10 -mx-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Lead sections">
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
                'shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                active === t.key
                  ? 'text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              style={active === t.key ? { borderColor: 'var(--console-info)' } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview — full width in both modes */}
      <div className={slot('overview')}>{overview}</div>

      {/* Middle: the original desktop two-column grid (main 1.3fr / side 1fr),
          reconstructed so desktop is unchanged. On mobile this is plain block
          flow and only the active slot shows. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-4">
        <div className="flex flex-col gap-4">
          <div className={slot('comms')}>{comms}</div>
          <div className={slot('tasks')}>{tasks}</div>
        </div>
        <div className="flex flex-col gap-4">
          <div className={slot('watching')}>{watching}</div>
          <div className={slot('workflow')}>{workflow}</div>
        </div>
      </div>

      {/* Activity — full width */}
      <div className={slot('activity')}>{activity}</div>
    </div>
  )
}
