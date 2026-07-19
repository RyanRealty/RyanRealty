'use client'

/**
 * CmaBoard — the stateful client container for /admin/cmas (Seller-CMA
 * worklist, sibling of /admin/prospecting). Composes the presentational
 * pieces (filters · card grid · `?id=` detail drawer · send dialog) and
 * wires the server actions passed down from the page, copying the
 * ProspectingBoard container pattern (components/admin/prospecting/
 * ProspectingBoard.client.tsx).
 *
 * ONE responsive tree: the card grid reflows and the detail becomes a bottom
 * Sheet on phones / an in-flow side panel on desktop — no md:hidden twin.
 * Unlike prospecting, the drawer chrome lives inline here rather than in a
 * separate ProspectDetailDrawer-style file (one fewer file for a worklist
 * this size — CmaDetailPanel is still the single shared detail CONTENT tree
 * both breakpoints mount).
 */

import { useCallback, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { KpiStrip } from '@/components/console/KpiStrip'
import type { CmaWorklistFilters, CmaWorklistRow, CmaWorklistSummary } from './types'
import { CmaFilters } from './CmaFilters.client'
import { CmaCard } from './CmaCard.client'
import { CmaDetailPanel } from './CmaDetailPanel.client'
import { CmaSendDialog, type CmaSendContext } from './CmaSendDialog.client'

type Actions = {
  approveAction: (
    slug: string,
    opts?: { acknowledgeReview?: boolean },
  ) => Promise<{ error: string | null; needsReviewAck?: boolean }>
  prepareSendAction: (slug: string) => Promise<{ data: CmaSendContext | null; error: string | null }>
  sendAction: (
    slug: string,
    override?: { subject?: string; bodyText?: string },
  ) => Promise<{ data: { transport: 'gmail' | 'resend'; mailbox: string | null } | null; error: string | null }>
  testSendAction: (args: {
    channel: 'email'
    subject: string
    body: string
  }) => Promise<{ ok: boolean; error?: string; message?: string }>
}

export function CmaBoard({
  filters,
  basePath,
  rows,
  summary,
  cities,
  page,
  totalPages,
  detail,
  approveAction,
  prepareSendAction,
  sendAction,
  testSendAction,
}: Actions & {
  filters: CmaWorklistFilters
  basePath: string
  rows: CmaWorklistRow[]
  summary: CmaWorklistSummary
  cities: string[]
  page: number
  totalPages: number
  detail: CmaWorklistRow | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [dialog, setDialog] = useState<{ open: boolean; context: CmaSendContext | null }>({ open: false, context: null })
  const [busyApprove, setBusyApprove] = useState<string | null>(null)
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

  const openDetail = useCallback((id: string) => withParam((p) => p.set('id', id)), [withParam])
  const closeDetail = useCallback(() => withParam((p) => p.delete('id')), [withParam])

  const handleApprove = useCallback(
    (slug: string) => {
      if (busyApprove) return
      setBusyApprove(slug)
      startTransition(async () => {
        try {
          const res = await approveAction(slug)
          if (res.error && res.needsReviewAck) {
            // Accuracy gate: the build carries review findings. Approving is
            // the broker's call, but only with the findings explicitly
            // acknowledged (mirrors BpoBoard's handleFinalize).
            const ack = confirm(
              `${res.error}\n\nReview the findings on the full review page. Approve anyway, acknowledging the recorded findings?`,
            )
            if (!ack) return
            const retry = await approveAction(slug, { acknowledgeReview: true })
            if (retry.error) toast.error(retry.error)
            else {
              toast.success('Approved with review findings acknowledged. Ready to send.')
              router.refresh()
            }
            return
          }
          if (!res.error) {
            toast.success('Approved. Ready to send.')
            router.refresh()
          } else {
            toast.error(res.error)
          }
        } finally {
          setBusyApprove(null)
        }
      })
    },
    [busyApprove, approveAction, router],
  )

  const openSend = useCallback(
    (slug: string) => {
      if (busySendPrep) return
      setBusySendPrep(slug)
      startTransition(async () => {
        try {
          const res = await prepareSendAction(slug)
          if (res.data) {
            setDialog({ open: true, context: res.data })
          } else {
            toast.error(res.error ?? 'Could not open the send dialog.')
          }
        } finally {
          setBusySendPrep(null)
        }
      })
    },
    [busySendPrep, prepareSendAction],
  )

  const closeSend = useCallback(() => {
    setDialog({ open: false, context: null })
    router.refresh()
  }, [router])

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { label: 'Total', value: summary.total },
          { label: 'Drafts', value: summary.drafts },
          { label: 'Finalized', value: summary.finalized },
          { label: 'Delivered', value: summary.delivered },
          { label: 'Sent', value: summary.sent },
        ]}
      />

      <CmaFilters filters={filters} cities={cities} basePath={basePath} />

      <div className="lg:flex lg:items-start lg:gap-4">
        <div className="min-w-0 flex-1">
          {rows.length === 0 ? (
            <Card className="border border-dashed border-border px-4 py-12 text-center">
              <p className="text-sm text-muted-foreground">No CMAs match these filters.</p>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((row) => (
                <CmaCard
                  key={row.id}
                  row={row}
                  onOpenDetail={openDetail}
                  onApprove={handleApprove}
                  onSend={openSend}
                  pendingApprove={busyApprove === row.slug}
                  pendingSend={busySendPrep === row.slug}
                />
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <Pagination className="mt-4">
              <PaginationContent>
                {page > 1 ? (
                  <PaginationItem>
                    <PaginationPrevious href={pageHref(pathname, searchParams, page - 1)} />
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

        {/* < lg — bottom sheet */}
        <Sheet
          open={Boolean(detail)}
          onOpenChange={(next) => {
            if (!next) closeDetail()
          }}
        >
          <SheetContent side="bottom" className="h-[90vh] overflow-y-auto lg:hidden">
            <SheetHeader>
              <SheetTitle>{detail?.subjectAddress ?? (detail ? 'Loading…' : 'CMA')}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              {detail ? (
                <CmaDetailPanel
                  detail={detail}
                  onApprove={handleApprove}
                  onSend={openSend}
                  pendingApprove={busyApprove === detail.slug}
                  pendingSend={busySendPrep === detail.slug}
                />
              ) : (
                <DetailSkeleton />
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* >= lg — non-modal in-flow aside; sits beside the worklist grid. */}
        {detail ? (
          <aside className="hidden w-[380px] shrink-0 lg:block">
            <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <CmaDetailPanel
                detail={detail}
                onApprove={handleApprove}
                onSend={openSend}
                pendingApprove={busyApprove === detail.slug}
                pendingSend={busySendPrep === detail.slug}
              />
            </div>
          </aside>
        ) : null}
      </div>

      <CmaSendDialog open={dialog.open} onClose={closeSend} context={dialog.context} sendAction={sendAction} testSendAction={testSendAction} />
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-24 w-full" />
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
