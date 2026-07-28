'use client'

/**
 * ProspectingBoard — the stateful client container for /admin/prospecting.
 *
 * Composes the filter bar, the sortable worklist and the send dialog, and wires
 * the server actions passed down from the page. Sorting is URL state
 * (`?sort=&dir=`) so it survives refresh/share/back and is resolved server-side
 * over the whole set; the send dialog is client state fed by `prepareSendAction`
 * so the preview always matches what the server would compose.
 *
 * The review detail is a REAL ROUTE (/admin/prospecting/<kind>/<id>), not a
 * `?id=` drawer. The drawer looked like a dead end — it dimmed the page and
 * offered nothing actionable (Brain Dump 2, 2026-07-28).
 */

import { useCallback, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import type {
  ProspectKind,
  ProspectListFilters,
  ProspectRow,
  ProspectSortKey,
  ProspectSummary,
  SendIntroResult,
  SortDir,
} from '@/lib/data/prospecting/types'
import { ProspectFilters } from './ProspectFilters.client'
import { ProspectTable } from './ProspectTable.client'
import { ProspectSendDialog, type ProspectSendContext } from './ProspectSendDialog.client'

type Actions = {
  buildAction: (kind: ProspectKind, id: string) => Promise<{ ok: boolean; error?: string } | { ok: true; slug: string }>
  prepareSendAction: (
    kind: ProspectKind,
    id: string,
  ) => Promise<{ ok: true; context: ProspectSendContext } | { ok: false; error: string }>
  sendIntroAction: (
    kind: ProspectKind,
    id: string,
    args: { idempotencyKey: string; bodyOverride?: string | null },
  ) => Promise<SendIntroResult>
  sendTestAction: (args: { channel: 'sms' | 'email'; subject?: string; body: string }) => Promise<{ ok: boolean; error?: string }>
  approveAction: (slug: string) => Promise<{ ok: boolean; error?: string }>
}

export function ProspectingBoard({
  kind,
  filters,
  basePath,
  rows,
  summary,
  cities,
  page,
  totalPages,
  buildAction,
  prepareSendAction,
  sendIntroAction,
  sendTestAction,
  approveAction,
}: Actions & {
  kind: ProspectKind
  filters: ProspectListFilters
  basePath: string
  rows: ProspectRow[]
  summary: ProspectSummary
  cities: string[]
  page: number
  totalPages: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [dialog, setDialog] = useState<{ open: boolean; context: ProspectSendContext | null }>({ open: false, context: null })
  const [busyBuild, setBusyBuild] = useState<string | null>(null)
  const [busySendPrep, setBusySendPrep] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const withParam = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(searchParams.toString())
      mutate(p)
      const qs = p.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  // Sorting is a URL concern so it survives a refresh, a share and the back
  // button, and so the server sorts the WHOLE set rather than the visible page.
  const sortHref = useCallback(
    (key: ProspectSortKey, nextDir: SortDir) => {
      const p = new URLSearchParams(searchParams.toString())
      p.set('sort', key)
      p.set('dir', nextDir)
      p.delete('page')
      return `${pathname}?${p.toString()}`
    },
    [pathname, searchParams],
  )

  const detailHref = useCallback((row: ProspectRow) => `${basePath}/${row.kind}/${encodeURIComponent(row.id)}`, [basePath])

  const handleBuild = useCallback(
    (id: string) => {
      if (busyBuild) return
      setBusyBuild(id)
      startTransition(async () => {
        try {
          const res = await buildAction(kind, id)
          if (res.ok) {
            toast.success('Audit build started.')
            router.refresh()
          } else {
            toast.error(res.error ?? 'Build failed.')
          }
        } finally {
          setBusyBuild(null)
        }
      })
    },
    [busyBuild, buildAction, kind, router],
  )

  const openSend = useCallback(
    (id: string) => {
      if (busySendPrep) return
      setBusySendPrep(id)
      startTransition(async () => {
        try {
          const res = await prepareSendAction(kind, id)
          if (res.ok) {
            setDialog({ open: true, context: res.context })
          } else {
            toast.error(res.error ?? 'Could not open the send dialog.')
          }
        } finally {
          setBusySendPrep(null)
        }
      })
    },
    [busySendPrep, prepareSendAction, kind],
  )

  const closeSend = useCallback(() => {
    setDialog({ open: false, context: null })
    router.refresh()
  }, [router])

  // Approve a still-draft audit from inside the send dialog (Matt's "review,
  // approve, send on this page" requirement — the only approve affordance in the
  // hub). On success, re-prepare so the dialog's clientReady flips true and the
  // now-live link is composed; refresh the worklist so the pill/CTA update too.
  const handleApproveInDialog = useCallback(
    async (k: ProspectKind, id: string, slug: string): Promise<boolean> => {
      const res = await approveAction(slug)
      if (!res.ok) {
        toast.error(res.error ?? 'Approve failed.')
        return false
      }
      toast.success('Audit approved. The link is live.')
      const prep = await prepareSendAction(k, id)
      if (prep.ok) setDialog({ open: true, context: prep.context })
      router.refresh()
      return true
    },
    [approveAction, prepareSendAction, router],
  )

  return (
    <div className="space-y-4">
      {/* One quiet line instead of six oversized KPI cards. The six numbers ate
          ~430px before a single lead was visible; the same counts now live in the
          status filter chips right below, where they are also actionable. */}
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{summary.total}</span>{' '}
        {kind === 'expired' ? 'expired listings' : 'FSBOs'} ·{' '}
        <span className="font-medium text-foreground tabular-nums">{summary.sendable}</span> ready to send ·{' '}
        <span className="font-medium text-foreground tabular-nums">{summary.needsAudit}</span> need an audit ·{' '}
        <span className="tabular-nums">{summary.sent}</span> sent
      </p>

      <ProspectFilters filters={filters} cities={cities} basePath={basePath} />

      <div className="lg:flex lg:items-start lg:gap-4">
        <div className="min-w-0 flex-1">
          {rows.length === 0 ? (
            <Card className="border border-dashed border-border px-4 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No {kind === 'expired' ? 'expired listings' : 'FSBOs'} match these filters.
              </p>
            </Card>
          ) : (
            <ProspectTable
              rows={rows}
              sort={filters.sort ?? 'date'}
              dir={filters.dir ?? 'desc'}
              hrefFor={sortHref}
              detailHref={detailHref}
              onBuild={handleBuild}
              onSend={openSend}
              pendingBuildId={busyBuild}
              pendingSendId={busySendPrep}
            />
          )}

          {totalPages > 1 ? (
            <Pagination className="mt-4">
              <PaginationContent>
                {page > 1 ? (
                  <PaginationItem>
                    <PaginationPrevious
                      href={pageHref(pathname, searchParams, page - 1)}
                    />
                  </PaginationItem>
                ) : null}
                {pageWindow(page, totalPages).map((n) => (
                  <PaginationItem key={n}>
                    <PaginationLink href={pageHref(pathname, searchParams, n)} isActive={n === page}>
                      {n}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                {page < totalPages ? (
                  <PaginationItem>
                    <PaginationNext href={pageHref(pathname, searchParams, page + 1)} />
                  </PaginationItem>
                ) : null}
              </PaginationContent>
            </Pagination>
          ) : null}
        </div>

      </div>

      <ProspectSendDialog
        open={dialog.open}
        onClose={closeSend}
        context={dialog.context}
        sendIntroAction={sendIntroAction}
        sendTestAction={sendTestAction}
        onApprove={handleApproveInDialog}
      />
    </div>
  )
}

function pageHref(pathname: string, searchParams: URLSearchParams, n: number): string {
  const p = new URLSearchParams(searchParams.toString())
  p.set('page', String(n))
  return `${pathname}?${p.toString()}`
}

function pageWindow(page: number, total: number): number[] {
  const out: number[] = []
  const start = Math.max(1, Math.min(page - 2, total - 4))
  const end = Math.min(total, start + 4)
  for (let n = start; n <= end; n++) out.push(n)
  return out
}
