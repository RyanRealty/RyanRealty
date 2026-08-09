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
 *
 * 11F: migrated onto the admin v2 language (design_system/admin/ADMIN_UI.md).
 * Every shadcn semantic class is gone; colour comes from var(--a-*). The three
 * interactive row types carry `av2-rail__subitem` — the v2 language's sidebar
 * sub-navigation row — purely for the hover/focus affordance a `hover:` class
 * used to supply and an inline style cannot express. Geometry is overridden
 * inline so the row keeps its original padding, size and indent; the sibling
 * `av2-rail__item` was rejected because its 1024–1199px collapse rule would
 * centre these rows and hide their counts on a laptop viewport.
 *
 * Two rules that follow from that, both of which the first migration pass got
 * wrong and which are the reason this note exists:
 *   - NOTHING inline may set `background` on a row that wants the hover. An
 *     inline declaration outranks `.av2-rail__subitem:hover`, so the group
 *     toggle sat dead under the pointer. The button's own UA/preflight
 *     background is cleared with `bg-transparent` (a utility, therefore still
 *     outranked by the unlayered stylesheet rule) instead.
 *   - The ACTIVE row's count badge may not reuse `--a-inset`. The active row
 *     is `--a-accent-wash` and the inactive badge is already `--a-inset`, so
 *     that fill said nothing; the badge carries the solid accent pair
 *     (`--a-btn-bg` / `--a-btn-fg`, AA-proven in both themes, ADMIN_UI §4).
 *     Pre-migration the two states were an accent tint against a neutral one,
 *     i.e. two fills — restoring one fill for both was the regression.
 */

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Settings } from 'lucide-react'
import '@/components/admin/v2/admin-v2.css'
import { cn } from '@/lib/utils'
import { describeSegment } from '@/lib/crm/segment-ast'
import {
  groupSavedViews,
  groupSystemByCollection,
  type SavedViewItem,
} from '@/components/admin/shared/people-list/saved-view-grouping'
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
    <aside data-tour="crm-sidebar" className="hidden w-full shrink-0 md:block md:w-[230px]">
      {/* People — All People */}
      <p className="px-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--a-text-2)' }}>People</p>
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
          <p className="mt-4 px-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--a-text-2)' }}>Stages</p>
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
      <p className="mt-4 px-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--a-text-2)' }}>Collections</p>
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
      <div className="mt-4 pt-2" style={{ borderTop: '1px solid var(--a-border)' }}>
        <Link
          href="/admin/crm/settings/segments"
          className="av2-rail__subitem gap-2"
          style={{ padding: '6px 8px', fontSize: 'var(--a-text-md)' }}
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
        className="av2-rail__subitem w-full bg-transparent text-left font-semibold"
        style={{
          justifyContent: 'space-between',
          padding: '4px 8px',
          fontSize: 'var(--a-text-xs)',
          color: 'var(--a-text)',
          border: 'none',
          cursor: 'pointer',
        }}
        aria-expanded={open}
      >
        {title}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open ? '' : '-rotate-90')} style={{ color: 'var(--a-text-2)' }} aria-hidden />
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
        className="av2-rail__subitem transition-colors"
        style={{
          justifyContent: 'space-between',
          gap: 'var(--a-s2)',
          padding: indent ? '6px 8px 6px 16px' : '6px 8px',
          fontSize: 'var(--a-text-md)',
          color: 'var(--a-text)',
          ...(active ? { background: 'var(--a-accent-wash)', fontWeight: 600 } : null),
        }}
      >
        <span className="min-w-0 truncate">{label}</span>
        {badge ? (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums"
            style={
              active
                ? { background: 'var(--a-btn-bg)', color: 'var(--a-btn-fg)', fontWeight: 600 }
                : { background: 'var(--a-inset)', color: 'var(--a-text-2)' }
            }
          >
            {badge}
          </span>
        ) : null}
      </Link>
    </li>
  )
}
