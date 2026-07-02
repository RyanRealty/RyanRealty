'use client'

/**
 * DealsSubBar — the §4 pipeline sub-bar for the Deals Kanban.
 *
 * Left (§4.1): pipeline tabs (Buyers / Sellers / custom, from the DB config) +
 * the ⚙ gear that navigates to the full-page Manage Pipelines settings route
 * (owner-only surface; the route 403s everyone else).
 *
 * Right (§4.2): "ℹ How Deals work" help popover · "Deal Reporting" ·
 * "Current deals ▾" status filter (Current / Archived / All, §13) ·
 * "Everyone ▾" agent filter (superuser only — a restricted broker's board is
 * already scoped to their own deals at the data layer, so they see a static
 * "Me" label instead of a dropdown).
 *
 * All filters live in the URL (?pipeline=&status=&agent=) and switch via
 * client-side navigation — content swaps without a full page reload (AC-1 #2).
 * FUB blue/teal → Ryan Realty primary tokens per the rebuild's token swap.
 */

import { useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, ChevronDown, CircleHelp, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { BoardPipeline } from '@/lib/data/crm/getDealPipelines'
import type { DealBoardStatusFilter } from '@/lib/data/crm/listDealsBoard'

const STATUS_LABELS: Record<DealBoardStatusFilter, string> = {
  current: 'Current deals',
  archived: 'Archived',
  all: 'All',
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

  const agentLabel = agent
    ? (brokers.find((b) => b.slug === agent)?.name ?? agent)
    : 'Everyone'

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-1.5">
      {/* §4.1 — pipeline type tabs + gear */}
      <div className="flex items-center gap-1">
        {pipelines.map((p) => {
          const active = p.name === activePipeline
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setParam('pipeline', String(p.id))}
              className={cn(
                'relative rounded-sm px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                active
                  ? 'text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {p.name}
            </button>
          )
        })}
        {isOwner ? (
          <Button asChild variant="ghost" size="icon-sm" aria-label="Manage pipelines" className="ml-1 text-muted-foreground">
            <Link href="/admin/crm/deals/pipelines">
              <Settings className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>

      {/* §4.2 — right toolbar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-primary">
              <CircleHelp className="h-4 w-4" aria-hidden />
              How Deals work
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 text-sm">
            <p className="font-semibold text-foreground">How Deals work</p>
            <p className="mt-1.5 text-muted-foreground">
              Each pipeline is a Kanban board of stages. Drag a deal card between
              columns to change its stage. A stage marked as closed feeds
              commission reporting and the leaderboard. Archive a deal (instead
              of deleting it) when it is lost — archived, closed deals still
              count in reporting.
            </p>
          </PopoverContent>
        </Popover>

        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-primary">
          <Link href="/admin/crm/reporting">
            <BarChart3 className="h-4 w-4" aria-hidden />
            Deal Reporting
          </Link>
        </Button>

        {/* §13 status filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              {STATUS_LABELS[status]}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(STATUS_LABELS) as DealBoardStatusFilter[]).map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={() => setParam('status', s === 'current' ? null : s)}
                className={cn(s === status && 'font-semibold text-foreground')}
              >
                {STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* §13 agent filter — superuser only; brokers are data-layer scoped to Me */}
        {isSuperuser ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                {agentLabel}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => setParam('agent', null)}
                className={cn(!agent && 'font-semibold text-foreground')}
              >
                Everyone
              </DropdownMenuItem>
              {brokers.map((b) => (
                <DropdownMenuItem
                  key={b.slug}
                  onSelect={() => setParam('agent', b.slug)}
                  className={cn(agent === b.slug && 'font-semibold text-foreground')}
                >
                  {b.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" size="sm" disabled className="opacity-100">
            Me
          </Button>
        )}
      </div>
    </div>
  )
}
