'use client'

/**
 * PeopleSidebar — the §3 left sidebar of the People list
 * (docs/fub-crm-spec/05-people-list-and-bulk-actions.md).
 *
 * Structure (§3.1):
 *   People                      [section header]
 *     All People          17K   [count badge = total scoped contacts]
 *   COLLECTIONS                 [section header]
 *     Pipeline ▾                [collapsible group]
 *       <smart lists w/ badges>
 *     Neighborhoods ▾
 *       <smart lists w/ badges>
 *     My views / Shared with you (in-house extension of the same pattern)
 *   ⚙ Manage                    [footer link]
 *
 * Badges follow §3.2: ≥1000 → `NK`, 0 → no badge, 1–999 → integer. Counts are
 * computed server-side under the caller's broker scope (getCrmSavedViews) so a
 * restricted broker can never see another book's volume. Pure navigation — all
 * editing lives in the §11 Edit Smart List modal in the list header.
 */

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { describeSegment } from '@/lib/crm/segment-ast'
import {
  groupSavedViews,
  groupSystemByCollection,
  type SavedViewItem,
} from '@/components/admin/crm/saved-view-grouping'
import { fmtSidebarCount } from './people-list-utils'

export type SidebarStage = { key: string; label: string; count: number }

export type PeopleSidebarProps = {
  /** Every view the caller may see, each with a live scoped count. */
  views: SavedViewItem[]
  /** The currently active view id (from ?view=), or null (= All People). */
  activeViewId: number | null
  /** Total contacts in the caller's scope — the All People badge. */
  totalCount: number
  /** Active pipeline stages with live scoped counts — the Stages strip. */
  stages?: SidebarStage[]
  /** The currently active stage (from ?stage=), or null. */
  activeStage?: string | null
  /** Query params to carry across list navigation (broker/pond scope overlay). */
  carry?: Record<string, string | undefined>
}

export default function PeopleSidebar({ views, activeViewId, totalCount, stages = [], activeStage = null, carry = {} }: PeopleSidebarProps) {
  const { system: systemViews, mine: myViews, shared: sharedViews } = groupSavedViews(views)
  const collections = groupSystemByCollection(systemViews)

  const href = (viewId: number | null): string => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(carry)) if (v) p.set(k, v)
    if (viewId != null) p.set('view', String(viewId))
    const qs = p.toString()
    return qs ? `/admin/crm?${qs}` : '/admin/crm'
  }

  const stageHref = (stageKey: string): string => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(carry)) if (v) p.set(k, v)
    p.set('stage', stageKey)
    return `/admin/crm?${p.toString()}`
  }

  return (
    <aside className="hidden w-full shrink-0 md:block md:w-[230px]">
      {/* People — All People */}
      <p className="px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">People</p>
      <ul className="mt-1">
        <SidebarRow
          href={href(null)}
          label="All People"
          count={totalCount}
          active={activeViewId === null}
        />
      </ul>

      {/* STAGES strip — the pipeline as clickable chips w/ live scoped counts (?stage=) */}
      {stages.length > 0 ? (
        <>
          <p className="mt-4 px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Stages</p>
          <ul className="mt-1">
            {stages.map((s) => (
              <SidebarRow
                key={s.key}
                href={stageHref(s.key)}
                label={s.label}
                count={s.count}
                active={activeStage === s.key}
                indent
              />
            ))}
          </ul>
        </>
      ) : null}

      {/* COLLECTIONS */}
      <p className="mt-4 px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Collections</p>
      <div className="mt-1 space-y-1">
        {collections.map((col) => (
          <SidebarGroup key={col.label} title={col.label} defaultOpen>
            {col.views.map((v) => (
              <SidebarRow
                key={v.id}
                href={href(v.id)}
                label={v.name}
                count={v.count}
                active={activeViewId === v.id}
                title={describeSegment(v.ast)}
                indent
              />
            ))}
          </SidebarGroup>
        ))}
        {myViews.length > 0 ? (
          <SidebarGroup title="My views" defaultOpen>
            {myViews.map((v) => (
              <SidebarRow key={v.id} href={href(v.id)} label={v.name} count={v.count} active={activeViewId === v.id} title={describeSegment(v.ast)} indent />
            ))}
          </SidebarGroup>
        ) : null}
        {sharedViews.length > 0 ? (
          <SidebarGroup title="Shared with you" defaultOpen>
            {sharedViews.map((v) => (
              <SidebarRow key={v.id} href={href(v.id)} label={v.name} count={v.count} active={activeViewId === v.id} title={describeSegment(v.ast)} indent />
            ))}
          </SidebarGroup>
        ) : null}
      </div>

      {/* ⚙ Manage footer (§3.1) */}
      <div className="mt-4 border-t border-border pt-2">
        <Link
          href="/admin/crm/settings/segments"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <Settings className="h-3.5 w-3.5" aria-hidden />
          Manage
        </Link>
      </div>
    </aside>
  )
}

function SidebarGroup({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs font-semibold text-foreground hover:bg-muted/60"
        aria-expanded={open}
      >
        {title}
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open ? '' : '-rotate-90')} aria-hidden />
      </button>
      {open ? <ul className="mt-0.5">{children}</ul> : null}
    </div>
  )
}

function SidebarRow({
  href, label, count, active, title, indent,
}: {
  href: string
  label: string
  count: number | null
  active: boolean
  title?: string
  indent?: boolean
}) {
  const badge = fmtSidebarCount(count)
  return (
    <li>
      <Link
        href={href}
        title={title}
        className={cn(
          'flex items-center justify-between gap-2 rounded-md py-1.5 pr-2 text-sm transition-colors',
          indent ? 'pl-4' : 'pl-2',
          active ? 'bg-primary/10 font-semibold text-foreground' : 'text-foreground hover:bg-muted/60',
        )}
      >
        <span className="min-w-0 truncate">{label}</span>
        {badge ? (
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums',
              active ? 'bg-primary/15 font-semibold text-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            {badge}
          </span>
        ) : null}
      </Link>
    </li>
  )
}
