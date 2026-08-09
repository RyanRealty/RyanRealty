'use client'

/**
 * DealsSubBar — the §4 pipeline sub-bar for the Deals Kanban.
 *
 * Left (§4.1): pipeline tabs (Buyers / Sellers / custom, from the DB config) +
 * the ⚙ gear that navigates to the full-page Manage Pipelines settings route
 * (owner-only surface; the route 403s everyone else).
 *
 * Right (§4.2): "ℹ How Deals work" help dialog · "Deal Reporting" ·
 * "Current deals ▾" status filter (Current / Archived / All, §13) ·
 * "Everyone ▾" agent filter (superuser only — a restricted broker's board is
 * already scoped to their own deals at the data layer, so they see a static
 * "Me" label instead of a dropdown).
 *
 * All filters live in the URL (?pipeline=&status=&agent=) and switch via
 * client-side navigation — content swaps without a full page reload (AC-1 #2).
 *
 * 11F: migrated to the admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only. The DropdownMenu status/agent pickers become ToolbarSelect
 * (a compact native <select> — the same substitution TasksView's agent-scope
 * filter already uses); the Popover help panel becomes a Dialog, matching the
 * HowReportingWorks precedent; the gear and "Deal Reporting" stay real <a>
 * elements (Next Link) since both NAVIGATE — a button here would silently drop
 * middle-click / Cmd-click / "open in new tab", the exact regression flagged
 * twice already in this migration.
 */

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, CircleHelp, Settings } from 'lucide-react'
import { Button, Dialog, ToolbarSelect } from '@/components/admin/v2'
import type { BoardPipeline } from '@/lib/data/crm/getDealPipelines'
import type { DealBoardStatusFilter } from '@/lib/data/crm/listDealsBoard'

const STATUS_LABELS: Record<DealBoardStatusFilter, string> = {
  current: 'Current deals',
  archived: 'Archived',
  all: 'All',
}

/** "How Deals work" — Dialog trigger, matching the HowReportingWorks pattern. */
function HowDealsWorkButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="quiet"
        onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--a-text-sm)' }}
      >
        <CircleHelp className="h-4 w-4" aria-hidden />
        How Deals work
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="How Deals work">
        <p>
          Each pipeline is a Kanban board of stages. Drag a deal card between
          columns to change its stage. A stage marked as closed feeds
          commission reporting and the leaderboard. Archive a deal (instead
          of deleting it) when it is lost — archived, closed deals still
          count in reporting.
        </p>
      </Dialog>
    </>
  )
}

export function DealsSubBar({
  pipelines,
  activePipeline,
  status,
  agent,
  brokers,
  isSuperuser,
  isOwner,
}: {
  pipelines: BoardPipeline[]
  activePipeline: string
  status: DealBoardStatusFilter
  agent: string | null
  brokers: Array<{ slug: string; name: string }>
  isSuperuser: boolean
  isOwner: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const sp = new URLSearchParams(searchParams.toString())
      if (value === null) sp.delete(key)
      else sp.set(key, value)
      sp.delete('deal') // filter changes close an open deal modal
      const qs = sp.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5"
      style={{ borderBottom: '1px solid var(--a-border)', background: 'var(--a-bg)' }}
    >
      {/* §4.1 — pipeline type tabs + gear */}
      <div className="flex items-center gap-1">
        {pipelines.map((p) => {
          const active = p.name === activePipeline
          return (
            <Button
              key={p.id}
              variant="quiet"
              onClick={() => setParam('pipeline', String(p.id))}
              aria-current={active ? 'page' : undefined}
              className="relative px-3 text-sm"
              style={{
                minHeight: 36,
                background: 'transparent',
                border: 'none',
                borderRadius: 0,
                color: active ? 'var(--a-text)' : 'var(--a-text-2)',
                fontWeight: active ? 600 : 500,
              }}
            >
              {p.name}
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full"
                  style={{ background: 'var(--a-accent)' }}
                />
              ) : null}
            </Button>
          )
        })}
        {isOwner ? (
          <Link
            href="/admin/crm/deals/pipelines"
            aria-label="Manage pipelines"
            title="Manage pipelines"
            className="av2-iconbtn"
            style={{ marginLeft: 4 }}
          >
            <Settings className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </div>

      {/* §4.2 — right toolbar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <HowDealsWorkButton />

        <Link
          href="/admin/crm/reporting"
          className="av2-btn av2-btn--quiet"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <BarChart3 className="h-4 w-4" aria-hidden />
          Deal Reporting
        </Link>

        {/* §13 status filter */}
        <ToolbarSelect
          aria-label="Filter deals by status"
          value={status}
          onChange={(e) => setParam('status', e.target.value === 'current' ? null : e.target.value)}
        >
          {(Object.keys(STATUS_LABELS) as DealBoardStatusFilter[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </ToolbarSelect>

        {/* §13 agent filter — superuser only; brokers are data-layer scoped to Me */}
        {isSuperuser ? (
          <ToolbarSelect
            aria-label="Filter deals by agent"
            value={agent ?? ''}
            onChange={(e) => setParam('agent', e.target.value || null)}
          >
            <option value="">Everyone</option>
            {brokers.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </ToolbarSelect>
        ) : (
          <Button variant="quiet" disabled>
            Me
          </Button>
        )}
      </div>
    </div>
  )
}
